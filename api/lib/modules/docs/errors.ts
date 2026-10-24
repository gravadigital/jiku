import { Reply } from '../../utils/bus/protocol';

/**
 * Traducción de los `errorCode` de jiku-docs a HTTP (DD-7).
 *
 * ES PROPIO DEL MÓDULO y NO se mezcla con `STATUS_BY_ERROR_CODE` de core: los códigos se
 * superponen (`invalid_fields`, `caller_not_authorized`) y la regla de traducción es por
 * servicio. El catálogo de jiku-docs puede crecer dentro de v1, así que un código desconocido
 * se trata como error genérico (500) conservando el `code` original.
 */
export const DOCS_STATUS_BY_ERROR_CODE: Record<string, number> = {
  // 400: entrada rechazada por el módulo.
  invalid_fields: 400,
  invalid_cursor: 400,
  file_name_invalid: 400,
  frontmatter_invalid: 400,
  invalid_relation: 400,
  content_too_large: 400,
  checksum_mismatch: 400,
  upload_not_found: 400,
  attachment_type_not_allowed: 400,
  attachment_too_large: 400,
  share_expiry_invalid: 400,
  secret_warning_not_acknowledged: 400,
  semantic_search_not_configured: 400,

  // 403: describen un PERMISO del caller, no una entrada inválida.
  permission_denied: 403,
  sharing_blocked: 403,
  unknown_caller: 403,
  caller_not_authorized: 403,

  // 404: estado del recurso pedido.
  document_not_found: 404,
  folder_not_found: 404,
  attachment_not_found: 404,
  share_not_found: 404,

  // 409: conflicto con el estado actual del recurso.
  version_conflict: 409,
  document_locked: 409,
  lock_not_held: 409,
  already_exists: 409,
  folder_not_empty: 409,

  // 503: una dependencia del módulo no respondió. `upstream_unavailable` es core que no
  // contestó: NO marca al módulo como `unavailable`.
  upstream_unavailable: 503,
  attachments_not_configured: 503,

  // 504: la base cortó la consulta.
  query_timeout: 504,

  internal_error: 500,
};

export function docsHttpStatusFor(errorCode: string | undefined): number {
  return (errorCode && DOCS_STATUS_BY_ERROR_CODE[errorCode]) || 500;
}

/**
 * `{ code, message, details? }`: `code` es el `errorCode` sin traducir y `details` el
 * `errorDetails` verbatim, solo si viene (la clave no existe si no hay).
 */
export function docsErrorBody(reply: Reply): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
} {
  const body: { code: string; message: string; details?: Record<string, unknown> } = {
    code: reply.errorCode || 'internal_error',
    message: reply.errorMessage || 'Internal error',
  };
  if (reply.errorDetails !== undefined) {
    body.details = reply.errorDetails;
  }
  return body;
}
