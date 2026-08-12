const ATTACHMENT_PLACEHOLDER_REGEX = /!?\[attach:(\d+)\]/g;

/**
 * Extrae los ids de attachment embebidos como `[attach:N]` / `![attach:N]`
 * en un texto (descripción, comentario). Usado para poblar `attachmentIds`
 * al confirmar la creación/edición de la entidad que contiene el texto.
 */
export function extractAttachmentIds(value: string): number[] {
  const ids: number[] = [];
  let match: RegExpExecArray | null;
  ATTACHMENT_PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = ATTACHMENT_PLACEHOLDER_REGEX.exec(value)) !== null) {
    ids.push(Number(match[1]));
  }
  return ids;
}
