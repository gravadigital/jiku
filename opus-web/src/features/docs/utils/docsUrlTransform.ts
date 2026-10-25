import { ULID_PATTERN } from '../constants/docs.constants';

const ATTACHMENT_URL =
  /^(?:https?:\/\/[^/?#\s]+)?\/docs\/attachments\/([0-9A-HJKMNP-TV-Z]{26})(?:[?#].*)?$/;

const DOCUMENT_URL = /^(?:https?:\/\/[^/?#\s]+)?\/docs\/([0-9A-HJKMNP-TV-Z]{26})(?:[?#].*)?$/;

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * Fábrica del `urlTransform` del visor de documentos (DD-15; REQ-017 DD-2).
 *
 * Todo enlace o imagen cuyo path sea `/docs/attachments/{ULID}` —relativo o absoluto con
 * cualquier host— se reescribe hacia el proxy propio de opus-web, bajo el id del documento
 * abierto: `/api/docs/documents/{documentId}/attachments/{ULID}`. Un adjunto de otro documento
 * queda igualmente bajo el documento abierto y la api responde 404 (REQ-017 R-3, sin
 * tratamiento visible). Si `documentId` no es un ULID, los adjuntos se vacían (falla cerrado).
 * Todo enlace `/docs/{ULID}` —relativo o con cualquier host, con `?`/`#` opcional— también se
 * vacía: apunta a la web interna, que el externo no puede abrir (REQ-019 DD-6), y el visor lo
 * muestra como texto (DD-7). Se reconoce por el path, sin comparar el host.
 * `http(s)` y `mailto` pasan; todo lo demás (`javascript:`, `data:`, rutas internas, `//host`)
 * se vacía.
 */
export function createDocsUrlTransform(documentId: string): (url: string) => string {
  const validDocument = ULID_PATTERN.test(documentId);
  return (url: string): string => {
    const trimmed = url.trim();
    const attachment = ATTACHMENT_URL.exec(trimmed);
    if (attachment) {
      return validDocument ? `/api/docs/documents/${documentId}/attachments/${attachment[1]}` : '';
    }
    if (DOCUMENT_URL.test(trimmed)) return '';
    try {
      return SAFE_PROTOCOLS.has(new URL(trimmed).protocol) ? url : '';
    } catch {
      return '';
    }
  };
}
