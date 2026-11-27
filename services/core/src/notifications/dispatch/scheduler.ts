import logger from '../../logger';
import { sequelize } from '../../models';
import { runDispatchCycle } from './run-cycle';
import { readNotificationSettings } from './settings';

/**
 * El scheduler del proceso de envío (REQ-015/S-073, CA-6, CA-7): dispara `runDispatchCycle()`
 * periódicamente con `setTimeout` ENCADENADO — nunca `setInterval`.
 *
 * POR QUÉ NO `setInterval`: si una corrida tarda más que el intervalo configurado, `setInterval`
 * dispararía la siguiente ANTES de que la primera termine, en la MISMA réplica. Ahí
 * `FOR UPDATE SKIP LOCKED` no ayuda: las dos corridas usarían conexiones DISTINTAS del mismo
 * pool de Sequelize, así que cada una tomaría un lote propio y sin ningún problema de bloqueo
 * entre sí — la garantía de "nunca dos corridas solapadas en la misma réplica" se perdería sin
 * ningún síntoma visible hasta que dos corridas concurrentes empiecen a competir por conexiones
 * del pool de 5. `setTimeout` encadenado evita el problema de raíz: el siguiente ciclo se
 * programa RECIÉN CUANDO el anterior terminó.
 *
 * EL INTERVALO SE RELEE DENTRO DEL CICLO (CA-5, CA-6), justo antes de reprogramar: es lo que
 * hace que un cambio de `notification-dispatch-interval-seconds` por SQL aplique sin reinicio,
 * con la latencia de un ciclo que CA-5 declara (el ciclo en curso ya arrancó con el intervalo
 * viejo; el que se reprograma al final usa el nuevo).
 *
 * LA GARANTÍA DE NO-RECHAZO ES UNA SEGUNDA RED ACÁ TAMBIÉN, aunque `runDispatchCycle()` ya
 * prometa no rechazar: el mismo criterio que `emit-events.ts` aplica al `try/catch` propio del
 * despachador — "esa garantía tiene que ser local y visible en cada archivo". Un rechazo que
 * escapara del ciclo mataría el proceso completo (`exitOnError: true` en producción) y dejaría
 * de reprogramarse, lo que además violaría la garantía "el loop sigue programando aunque un
 * ciclo haya fallado".
 */

let timer: ReturnType<typeof setTimeout> | null = null;
let runningCycle: Promise<void> | null = null;
let stopping = false;

/** Lee el intervalo vigente en su propia transacción liviana, sin caché (CA-5). */
async function readIntervalSeconds(): Promise<number> {
  const transaction = await sequelize.transaction();
  try {
    const settings = await readNotificationSettings(transaction);
    await transaction.commit();
    return settings.intervalSeconds;
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  }
}

/** Ejecuta un ciclo y, al terminar (sin importar el resultado), programa el siguiente — salvo que se esté parando. */
async function tick(): Promise<void> {
  const cycle = runDispatchCycle().catch((error) => {
    // SEGUNDA RED: `runDispatchCycle()` ya promete no rechazar, pero si algún día lo hiciera,
    // este `catch` es lo que evita que el rechazo escape del scheduler y mate el proceso.
    logger.error(`[notifications] ciclo no manejado: ${error?.message ?? String(error)}`);
  });
  runningCycle = cycle;
  await cycle;
  runningCycle = null;

  if (stopping) {
    return;
  }

  let intervalSeconds: number;
  try {
    intervalSeconds = await readIntervalSeconds();
  } catch (error: any) {
    logger.error(`[notifications] no se pudo leer el intervalo, se reintenta: ${error?.message ?? String(error)}`);
    // Sin la configuración no hay forma de saber cuánto esperar: se reintenta con un intervalo
    // corto fijo en vez de no reprogramar nada, que dejaría el proceso de envío parado en
    // silencio.
    intervalSeconds = 5;
  }

  if (stopping) {
    return;
  }

  timer = setTimeout(() => {
    void tick();
  }, intervalSeconds * 1000);
}

/** Arranca el loop: programa el primer ciclo. Se llama una sola vez, después de `host.start()` (CA-7). */
export function startDispatchLoop(): void {
  stopping = false;
  logger.info('[notifications] proceso de envío arrancado');
  void tick();
}

/**
 * Para el loop: cancela el timer pendiente y ESPERA la corrida en curso antes de resolver
 * (CA-7). Un `SIGTERM` a mitad de lote no corta el envío en seco.
 */
export async function stopDispatchLoop(): Promise<void> {
  stopping = true;
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (runningCycle !== null) {
    await runningCycle;
  }
  logger.info('[notifications] proceso de envío detenido');
}
