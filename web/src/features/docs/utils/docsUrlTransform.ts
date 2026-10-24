export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

// DD-15: todo enlace cuyo path sea /docs/attachments/{ULID} se reescribe al propio origen,
// sin mirar el host. Es seguro: el proxy solo le pide a jiku-docs ese id con la sesión de quien mira.
const ATTACHMENT_URL =
  /^(?:https?:\/\/[^/?#\s]+)?\/docs\/attachments\/([0-9A-HJKMNP-TV-Z]{26})(?:[?#].*)?$/;

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * `urlTransform` del visor de documentos. Solo deja pasar adjuntos (reescritos), http(s) y
 * mailto; cualquier otra cosa (javascript:, data:, relativos, protocol-relative) queda vacía.
 */
export function docsUrlTransform(url: string): string {
  const trimmed = url.trim();

  const attachment = ATTACHMENT_URL.exec(trimmed);
  if (attachment) {
    return `/docs/attachments/${attachment[1]}`;
  }

  try {
    if (SAFE_PROTOCOLS.has(new URL(trimmed).protocol)) {
      return url;
    }
  } catch {
    // no es una URL absoluta: relativo, ancla o protocol-relative
  }
  return '';
}
