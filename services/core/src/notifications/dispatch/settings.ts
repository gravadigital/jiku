import { Op, Transaction } from 'sequelize';
import { SystemSetting } from '@jiku/models';

/**
 * Lector de los tres parámetros del proceso de envío de notificaciones (REQ-015/S-073), desde
 * `system_settings`.
 *
 * POR QUÉ NO HAY CACHÉ DE NINGÚN TIPO: CA-5 exige que un cambio por SQL aplique en la corrida
 * siguiente del proceso periódico, sin redeploy. Cachear con TTL rompería exactamente eso — el
 * mismo criterio que ya fijó `commands/files/settings.ts` (S-018) para su propia tabla. El costo
 * es aceptable: es una tabla de pocas filas y la lectura va por el índice UNIQUE de `key`.
 *
 * ESTA FUNCIÓN NO ASUME DE QUIÉN ES LA TRANSACCIÓN QUE RECIBE: la convención `orm` exige la
 * transacción incluso en lecturas, pero el módulo llamante decide cuál — `run-cycle.ts` la
 * invoca DOS VECES con transacciones DISTINTAS: una propia y liviana para leer `intervalSeconds`
 * en el scheduler, y otra (también propia, separada de la de `claim-batch.ts`) para leer
 * `batchSize`/`maxAttempts` antes de tomar el lote. Nunca se ejecuta dentro de la transacción
 * larga que `claim-batch.ts` abre para el lote en sí — mantenerla corta es intencional.
 *
 * POR QUÉ LOS DEFAULTS VIVEN ACÁ Y NO SOLO EN EL SEED: el sistema tiene que funcionar con la tabla
 * de `system_settings` vacía. La migración de S-069 siembra las tres claves con estos mismos
 * valores por conveniencia; estas constantes son la garantía.
 *
 * NO SE AGREGAN ESTAS CLAVES A `src/queries/settings/settings-spec.ts`: esa lista blanca expone
 * claves por el plano de consultas y es deny-by-default a propósito — una clave nueva agregada
 * por SQL para este proceso no tiene por qué aparecer en un contrato público de lectura.
 */

/**
 * Los nombres de las tres claves son parte del contrato con el operador que las ajusta por SQL.
 * No se renombran ni se agregan claves nuevas sin cambiar el contrato.
 */
export const NOTIFICATION_SETTING_KEYS = {
  intervalSeconds: 'notification-dispatch-interval-seconds',
  batchSize: 'notification-batch-size',
  maxAttempts: 'notification-max-attempts',
} as const;

/** Los mismos valores que siembra la migración de S-069 — la garantía de que el sistema funciona con la tabla vacía. */
export const DEFAULT_INTERVAL_SECONDS = 60;
export const DEFAULT_BATCH_SIZE = 50;
export const DEFAULT_MAX_ATTEMPTS = 5;

export interface NotificationSettings {
  intervalSeconds: number;
  batchSize: number;
  maxAttempts: number;
}

/**
 * Un valor presente pero no parseable cae al default en vez de propagar el error.
 *
 * `Number.isFinite` y no un `Number(...) || default`: un `NaN` silencioso propagándose a las
 * comparaciones de tamaño del lote o de intentos haría que se comporten de forma impredecible.
 * Es el mismo patrón de `commands/files/settings.ts`.
 */
function parseNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Un valor parseable pero absurdo (`0` o negativo) también cae al default: un intervalo o un
 * tamaño de lote de `0` congelaría el proceso o lo pondría en un busy loop, y un máximo de
 * intentos de `0` descartaría cada fila en su primer intento — ninguno es un estado que un
 * operador quiera con un valor tan chico por accidente de tipeo.
 */
function parsePositiveNumber(raw: string | undefined, fallback: number): number {
  const parsed = parseNumber(raw, fallback);
  return parsed > 0 ? parsed : fallback;
}

/**
 * Lee los tres parámetros y devuelve la configuración resuelta.
 *
 * UNA SOLA CONSULTA para las tres, no tres: la tabla es chica y el índice es por `key`.
 *
 * La transacción es obligatoria: la convención `orm` exige que TODA operación de Sequelize la
 * lleve, incluidas las lecturas.
 */
export async function readNotificationSettings(
  transaction: Transaction
): Promise<NotificationSettings> {
  const rows = await SystemSetting.findAll({
    where: { key: { [Op.in]: Object.values(NOTIFICATION_SETTING_KEYS) } },
    transaction,
  });

  const byKey = new Map<string, string>(rows.map((row) => [row.key, row.value]));

  return {
    intervalSeconds: parsePositiveNumber(
      byKey.get(NOTIFICATION_SETTING_KEYS.intervalSeconds),
      DEFAULT_INTERVAL_SECONDS
    ),
    batchSize: parsePositiveNumber(
      byKey.get(NOTIFICATION_SETTING_KEYS.batchSize),
      DEFAULT_BATCH_SIZE
    ),
    maxAttempts: parsePositiveNumber(
      byKey.get(NOTIFICATION_SETTING_KEYS.maxAttempts),
      DEFAULT_MAX_ATTEMPTS
    ),
  };
}
