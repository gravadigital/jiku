/**
 * El markdown embebido maneja DOS espacios de identificadores y no se pueden
 * confundir:
 *
 * - `[attach:N]` / `![attach:N]` — N es id de **vínculo** (`attachments.id`).
 *   Es lo que trae el markdown ya guardado, y se lee por
 *   `/api/attachments/{N}/preview`.
 * - `[file:N]` / `![file:N]` — N es id de **archivo** (`files.id`). Es lo que el
 *   editor emite al subir, cuando el vínculo todavía no existe, y se lee por
 *   `/api/files/{N}/preview`.
 *
 * Resolver un `fileId` contra la ruta de vínculos daría un 404 o —peor— el
 * preview de OTRO adjunto que casualmente tenga ese id. Por eso el prefijo.
 */
const FILE_PLACEHOLDER_REGEX = /!?\[file:(\d+)\]/g;
const ATTACHMENT_PLACEHOLDER_REGEX = /!?\[attach:(\d+)\]/g;

function extractIds(value: string, regex: RegExp): number[] {
  const ids: number[] = [];
  let match: RegExpExecArray | null;
  regex.lastIndex = 0;
  while ((match = regex.exec(value)) !== null) {
    ids.push(Number(match[1]));
  }
  return ids;
}

/**
 * Extrae los ids de `files` embebidos como `[file:N]` / `![file:N]`. Es lo que
 * puebla `fileIds` al guardar la entidad que contiene el texto.
 */
export function extractFileIds(value: string): number[] {
  return extractIds(value, FILE_PLACEHOLDER_REGEX);
}

/**
 * Extrae los ids de vínculo embebidos como `[attach:N]` / `![attach:N]`. Los
 * usa el visor de markdown ya guardado, no el armado del payload.
 */
export function extractAttachmentIds(value: string): number[] {
  return extractIds(value, ATTACHMENT_PLACEHOLDER_REGEX);
}
