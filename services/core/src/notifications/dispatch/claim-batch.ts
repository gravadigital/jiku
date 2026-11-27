import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../../models';

/**
 * La toma del lote de `notification_outbox` (REQ-015/S-073, CA-1, CA-2): abre su propia
 * transacción y selecciona hasta `batchSize` filas pendientes vencidas con
 * `FOR UPDATE SKIP LOCKED`.
 *
 * ESTA TRANSACCIÓN ES DE ESTE MÓDULO, NO DEL DESPACHADOR (ADR-003). El proceso de envío corre
 * por TIEMPO, no por mensaje: no hay ningún comando en curso cuya transacción reusar, así que
 * este módulo es la única pieza de `core`, fuera del despachador, que abre y cierra su propia
 * transacción. Es una ampliación consciente de ADR-003, no una excepción disimulada.
 *
 * `FOR UPDATE SKIP LOCKED` ES REQUISITO, NO DETALLE (CA-2): el proceso corre por tiempo, así que
 * el queue group `gestion` no lo reparte entre réplicas — las dos réplicas disparan su propio
 * timer, al mismo tiempo, sin coordinación entre ellas. Sin `SKIP LOCKED`, dos réplicas
 * ejecutando esta misma consulta a la vez leerían y tomarían las MISMAS filas, y cada mail
 * saldría dos veces. Con él, la segunda transacción SALTEA las filas que la primera ya bloqueó
 * y toma las siguientes disponibles — cada mail sale una sola vez, sin coordinación explícita.
 *
 * POR QUÉ ESTA ES LA TRANSACCIÓN MÁS LARGA DEL SERVICIO: queda abierta durante TODOS los envíos
 * SMTP del lote (Task 5), que son secuenciales. Ocupa 1 de las 5 conexiones del pool implícito
 * de Sequelize durante ese tiempo, compitiendo con el pool de comandos — es la razón real por la
 * que el tamaño del lote (`batchSize`) es configurable: un lote más chico acorta cuánto tiempo
 * se retiene esa conexión.
 *
 * SOBRE `readDb`: NO SIRVE PARA ESTO. Es una conexión de SOLO LECTURA (sin `UPDATE`/`DELETE`,
 * necesarios más adelante en el mismo ciclo) y tiene `statement_timeout: 8000` en
 * `dialectOptions` — cortaría la transacción del lote antes de que termine de enviar. El raw
 * query va sobre `sequelize` (la conexión de escritura, el usuario dueño).
 */

/** Una fila del lote, tal como la devuelve el driver: nombres de COLUMNA (snake_case), no de propiedad TS. */
export interface ClaimedRow {
  id: string;
  type: string;
  recipient_user_id: string;
  recipient_email: string;
  payload: Record<string, unknown>;
  attempts: number;
}

/**
 * Abre una transacción propia y toma hasta `batchSize` filas de `notification_outbox` cuyo
 * `next_attempt_at` ya venció, bloqueándolas con `SKIP LOCKED`.
 *
 * Devuelve la transacción JUNTO con las filas: el llamador (Task 5) es quien decide qué hacer
 * con cada fila y quien cierra la transacción — este módulo solo abre y selecciona.
 *
 * Los valores van por `replacements`, NUNCA interpolados (regla de `src/`: listas blancas para
 * nombres de columna —literales acá, la tabla no es un parámetro—, parámetros para valores).
 */
export async function claimBatch(
  batchSize: number
): Promise<{ transaction: Transaction; rows: ClaimedRow[] }> {
  const transaction = await sequelize.transaction();

  try {
    const rows = await sequelize.query<ClaimedRow>(
      `SELECT id, type, recipient_user_id, recipient_email, payload, attempts
         FROM notification_outbox
        WHERE status = 'pending'
          AND next_attempt_at <= NOW()
        ORDER BY next_attempt_at, id
        LIMIT :batchSize
          FOR UPDATE SKIP LOCKED`,
      {
        type: QueryTypes.SELECT,
        replacements: { batchSize },
        transaction,
      }
    );

    return { transaction, rows };
  } catch (error) {
    // EL ROLLBACK NO PUEDE SER LA FUENTE DE UN RECHAZO (patrón de `dispatcher.ts:159-162`): si
    // la propia consulta es lo que falló, la transacción puede seguir viva o no según el error;
    // el `.catch(() => undefined)` evita que un segundo rechazo tape el original.
    await transaction.rollback().catch(() => undefined);
    throw error;
  }
}
