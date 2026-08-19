import { Op, Transaction } from 'sequelize';
import { SystemSetting } from '@jiku/models';

/**
 * Lector de la política de archivos desde `system_settings`.
 *
 * POR QUÉ LA TABLA Y NO `process.env`: `core` no lee variables de entorno para negocio
 * (convención `commands`). Las credenciales de S3 sí son `env` —son infraestructura—, pero el
 * tamaño máximo y las listas blancas son política del producto y las ajusta un operador por SQL.
 *
 * POR QUÉ LOS DEFAULTS VIVEN ACÁ Y NO SOLO EN EL SEED: RF-16 y CA-7 exigen que el sistema
 * funcione SIN ninguna fila cargada. La migración `20260819_05` siembra las cinco claves por
 * conveniencia; estas constantes son la garantía.
 *
 * POR QUÉ NO HAY CACHÉ DE NINGÚN TIPO: CA-6 exige que un cambio por SQL aplique en el comando
 * siguiente, sin reinicio. Cachear con TTL rompería exactamente eso. El costo es aceptable: es
 * una tabla de pocas filas, la lectura va por el índice UNIQUE de `key`, y ocurre dentro de la
 * transacción que el despachador ya abrió.
 */

/** `expiresIn` de la prefirmada de PUT, en segundos. */
export const DEFAULT_UPLOAD_URL_TTL_SECONDS = 300;

/**
 * `expiresIn` de la prefirmada de GET, en segundos.
 *
 * Es el default más sensible de los cinco: una URL de lectura filtrada da acceso al contenido
 * sin ninguna credencial. Conviene el más corto que la UI tolere.
 */
export const DEFAULT_DOWNLOAD_URL_TTL_SECONDS = 300;

/** 10 MB, el tope histórico de la api (`MAX_FILE_SIZE` de `attachments-post.ts`). */
export const DEFAULT_MAX_SIZE_BYTES = 10485760;

/**
 * Las 13 extensiones y los 12 MIME, copiados de `CLAVES_A_SEMBRAR` de la migración
 * `20260819_05_harden_attachments_schema.js` — la fuente que ya está en la base.
 *
 * LA ASIMETRÍA 13/12 ES REAL Y NO UN ERROR: `.jpg` y `.jpeg` comparten `image/jpeg`. No hay
 * una entrada 13 de MIME que agregar.
 */
export const DEFAULT_ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv',
];

export const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];

/**
 * Los nombres de las cinco claves son parte del contrato con el operador que las ajusta por
 * SQL. No se renombran ni se agregan claves nuevas sin cambiar el contrato.
 */
export const SETTING_KEYS = {
  uploadUrlTtlSeconds: 'upload-url-ttl-seconds',
  downloadUrlTtlSeconds: 'download-url-ttl-seconds',
  maxSizeBytes: 'file-max-size-bytes',
  allowedExtensions: 'file-allowed-extensions',
  allowedMimeTypes: 'file-allowed-mime-types',
} as const;

export interface FileSettings {
  uploadUrlTtlSeconds: number;
  downloadUrlTtlSeconds: number;
  maxSizeBytes: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
}

/**
 * Un valor presente pero no parseable cae al default en vez de propagar el error.
 *
 * `Number.isFinite` y no un `Number(...) || default`: un `NaN` silencioso propagándose a la
 * comparación de tamaño haría que TODO pase la validación, porque `2048 > NaN` es `false`. Es
 * el peor modo de fallo posible acá — un tope de tamaño que deja de existir sin avisar.
 */
function parseNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Las listas vienen separadas por comas, en el formato que siembra la migración. Se toleran
 * espacios alrededor de cada elemento y se descartan los vacíos: una lista con solo comas o
 * en blanco cae al default, porque una allowlist vacía bloquearía todas las subidas por lo que
 * casi con seguridad es un error de tipeo del operador.
 */
function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (raw === undefined) {
    return fallback;
  }
  const items = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : fallback;
}

/**
 * Lee las cinco claves y devuelve la política resuelta.
 *
 * UNA SOLA CONSULTA para las cinco, no cinco: la tabla es chica y el índice es por `key`, pero
 * cinco round-trips dentro de una transacción es gasto sin motivo.
 *
 * La transacción es obligatoria: la convención `orm` exige que TODA operación de Sequelize la
 * lleve, incluidas las lecturas.
 */
export async function readFileSettings(transaction: Transaction): Promise<FileSettings> {
  const rows = await SystemSetting.findAll({
    where: { key: { [Op.in]: Object.values(SETTING_KEYS) } },
    transaction,
  });

  const byKey = new Map<string, string>(rows.map((row) => [row.key, row.value]));

  return {
    uploadUrlTtlSeconds: parseNumber(
      byKey.get(SETTING_KEYS.uploadUrlTtlSeconds),
      DEFAULT_UPLOAD_URL_TTL_SECONDS
    ),
    downloadUrlTtlSeconds: parseNumber(
      byKey.get(SETTING_KEYS.downloadUrlTtlSeconds),
      DEFAULT_DOWNLOAD_URL_TTL_SECONDS
    ),
    maxSizeBytes: parseNumber(byKey.get(SETTING_KEYS.maxSizeBytes), DEFAULT_MAX_SIZE_BYTES),
    allowedExtensions: parseList(
      byKey.get(SETTING_KEYS.allowedExtensions),
      DEFAULT_ALLOWED_EXTENSIONS
    ),
    allowedMimeTypes: parseList(
      byKey.get(SETTING_KEYS.allowedMimeTypes),
      DEFAULT_ALLOWED_MIME_TYPES
    ),
  };
}
