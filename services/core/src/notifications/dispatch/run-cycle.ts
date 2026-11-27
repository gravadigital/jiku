import { QueryTypes, Transaction } from 'sequelize';
import logger from '../../logger';
import { sequelize } from '../../models';
import { NotificationPayload } from '../types';
import { renderNotification } from '../templates';
import { nextAttemptAt } from './backoff';
import { ClaimedRow, claimBatch } from './claim-batch';
import { getTransport } from './transport';
import { readNotificationSettings } from './settings';

/**
 * El ciclo de envío completo (REQ-015/S-073, CA-1, CA-3, CA-4): toma el lote (Task 4), renderiza
 * con la plantilla de su tipo (Task 3), envía por SMTP y actualiza el estado de cada fila.
 *
 * GARANTÍA DE NO-RECHAZO (vinculante por analogía con `bus/emit-events.ts`): esta función NUNCA
 * rechaza ni lanza. En producción, un `unhandledRejection` del timer que la invoca MATA EL
 * PROCESO —el logger corre con `exitOnError: true` en `NODE_ENV=production`—, así que un fallo
 * dentro del ciclo tiene que resolverse en un `catch` local, nunca escapar.
 *
 * ENVÍOS SECUENCIALES, NUNCA EN PARALELO (`for...of` + `await`, deliberadamente sin
 * `Promise.all`/`allSettled` — la diferencia consciente con `emit-events.ts`): 50 conexiones SMTP
 * en paralelo es la forma más rápida de que un proveedor aplique rate limit. Un lote de 50 con
 * ~500ms de latencia por envío tarda ~25s en serie, que entra cómodo en el ciclo por defecto
 * (60s).
 *
 * AT-LEAST-ONCE DECLARADO, NO DESCUBIERTO: la ventana de duplicado está entre el `sendMail()` que
 * salió y el `UPDATE status='sent'` que no llegó a correr (por ejemplo, un `SIGTERM` a mitad de
 * ciclo). No hay deduplicación: es el mismo compromiso de producto que ya fija el modelo
 * (`notification-outbox.model.ts`).
 *
 * ESTE MÓDULO NO NOMBRA NINGÚN TIPO NI RECURSO DE DOMINIO (CA-10): recibe `type` como string
 * opaco, se lo pasa a `renderNotification()` (el único lugar que lo resuelve), y nunca lo compara
 * contra un literal ni lo usa en un `switch`.
 */

/** El log del descarte NUNCA lleva el payload — el formato es LITERAL, no se cambia (misma razón que `emit-events.ts`: un `grep` en producción tiene que encontrar siempre el mismo patrón). */
function logDiscard(row: ClaimedRow, reason: string): void {
  const payload = row.payload as Partial<NotificationPayload>;
  const entityType = payload.entity?.type ?? 'desconocido';
  const entityId = payload.entity?.id ?? 'desconocido';
  logger.error(
    `[notifications] discard id=${row.id} type=${row.type} ` +
      `entity=${entityType}:${entityId} recipient=${row.recipient_user_id} reason=${reason}`
  );
}

/** Acota el largo de lo que se persiste en `last_error`: nunca un objeto de error entero. */
function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 500 ? `${message.slice(0, 500)}…` : message;
}

async function markSent(id: string, transaction: Transaction): Promise<void> {
  await sequelize.query(
    'UPDATE notification_outbox SET status = \'sent\', sent_at = NOW() WHERE id = :id',
    { type: QueryTypes.UPDATE, replacements: { id }, transaction }
  );
}

async function markFailedOrDiscard(
  row: ClaimedRow,
  maxAttempts: number,
  errorMessage: string,
  transaction: Transaction
): Promise<void> {
  const attempts = row.attempts + 1;

  if (attempts >= maxAttempts) {
    // DELETE, no un `status = 'failed'`: la columna solo admite 'pending'/'sent' (Database
    // Context del Story Plan). El rastro que queda es exclusivamente el log de abajo.
    await sequelize.query('DELETE FROM notification_outbox WHERE id = :id', {
      type: QueryTypes.DELETE,
      replacements: { id: row.id },
      transaction,
    });
    logDiscard(row, errorMessage);
    return;
  }

  const nextAt = nextAttemptAt(row.attempts, new Date());
  await sequelize.query(
    `UPDATE notification_outbox
        SET attempts = :attempts, next_attempt_at = :nextAt, last_error = :lastError
      WHERE id = :id`,
    {
      type: QueryTypes.UPDATE,
      replacements: {
        id: row.id,
        attempts,
        nextAt,
        lastError: errorMessage,
      },
      transaction,
    }
  );
}

/** Procesa UNA fila del lote: nunca lanza — cualquier fallo se atrapa acá y se traduce a backoff o descarte. */
async function processRow(row: ClaimedRow, maxAttempts: number, transaction: Transaction): Promise<void> {
  try {
    const rendered = renderNotification(row.type, row.payload as unknown as NotificationPayload);
    if (!rendered) {
      // Un `type` que ya no está en el registro (o cuyo `template` no resuelve) se trata como
      // fallo de envío normal: cuenta intento y termina descartándose por el camino del máximo,
      // en vez de crashear el ciclo (decisión del Story Plan, Reusable Code).
      throw new Error(`tipo de notificación desconocido o sin plantilla: ${row.type}`);
    }

    const transport = getTransport();
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: row.recipient_email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    await markSent(row.id, transaction);
  } catch (error) {
    await markFailedOrDiscard(row, maxAttempts, toErrorMessage(error), transaction);
  }
}

/**
 * Corre un ciclo completo del proceso de envío: lee la configuración vigente, toma el lote y
 * procesa cada fila en secuencia. Resuelve SIEMPRE, nunca rechaza.
 */
export async function runDispatchCycle(): Promise<void> {
  // La configuración se relee EN CADA CICLO, sin caché (CA-5): un cambio por SQL aplica desde
  // la corrida siguiente. La lectura de `batchSize` necesita su propia transacción liviana,
  // separada de la del lote — es una lectura chica que no tiene por qué competir con la
  // transacción larga de abajo.
  let maxAttempts: number;
  let batchSize: number;
  try {
    const settingsTx = await sequelize.transaction();
    try {
      const settings = await readNotificationSettings(settingsTx);
      maxAttempts = settings.maxAttempts;
      batchSize = settings.batchSize;
      await settingsTx.commit();
    } catch (error) {
      await settingsTx.rollback().catch(() => undefined);
      throw error;
    }
  } catch (error) {
    logger.error(`[notifications] no se pudo leer la configuración del ciclo: ${toErrorMessage(error)}`);
    return;
  }

  let claimed: { transaction: Transaction; rows: ClaimedRow[] };
  try {
    claimed = await claimBatch(batchSize);
  } catch (error) {
    logger.error(`[notifications] no se pudo tomar el lote: ${toErrorMessage(error)}`);
    return;
  }

  const { transaction, rows } = claimed;

  try {
    // SECUENCIAL, DELIBERADAMENTE: ver la nota de cabecera. Un `for...of` con `await` adentro,
    // nunca `Promise.all`.
    for (const row of rows) {
      await processRow(row, maxAttempts, transaction);
    }
    await transaction.commit();
  } catch (error) {
    // LA TRANSACCIÓN DEL LOTE SE CIERRA SIEMPRE: el patrón defensivo de
    // `dispatcher.ts:159-162` — un rollback sobre una transacción ya terminada (porque el fallo
    // fue el propio commit) rechazaría, y ese segundo rechazo taparía el original.
    await transaction.rollback().catch(() => undefined);
    logger.error(`[notifications] el ciclo falló: ${toErrorMessage(error)}`);
  }
}

export default runDispatchCycle;
