/**
 * `urlTransform` del visor de documentos (DD-15).
 *
 * Todo enlace o imagen cuyo path sea `/docs/attachments/{ULID}` —relativo o absoluto con
 * cualquier host— se reescribe hacia el proxy propio de opus-web. Es seguro porque el proxy
 * solo le pide a la api ese id con la sesión de quien mira. `http(s)` y `mailto` pasan; todo lo
 * demás (`javascript:`, `data:`, rutas internas, `//host`) se vacía.
 */
const ATTACHMENT_URL =
  /^(?:https?:\/\/[^/?#\s]+)?\/docs\/attachments\/([0-9A-HJKMNP-TV-Z]{26})(?:[?#].*)?$/;

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function docsUrlTransform(url: string): string {
  const trimmed = url.trim();
  const attachment = ATTACHMENT_URL.exec(trimmed);
  if (attachment) return `/api/docs/attachments/${attachment[1]}`;
  try {
    return SAFE_PROTOCOLS.has(new URL(trimmed).protocol) ? url : '';
  } catch {
    return '';
  }
}
