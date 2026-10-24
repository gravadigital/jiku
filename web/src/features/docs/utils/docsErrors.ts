// Mapeo `code` → texto de interfaz para los errores de escritura de docs (DD-7). El `code` llega
// sin traducir desde jiku-docs; los textos son los de los screen.md (o de P-15 si la UX no los fija).

export const DOCS_UNAVAILABLE_MESSAGE =
  'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.';

export const codeOf = (error: unknown): string | undefined =>
  (error as { code?: string } | null | undefined)?.code;

const messageOf = (error: unknown): string =>
  (error as { message?: string } | null | undefined)?.message ?? '';

/** Errores del alta (O-11): el de validación va junto al campo; el resto, como aviso bajo los campos. */
export function describeCreateError(error: unknown): { field?: string; notice?: string } {
  switch (codeOf(error)) {
    case 'already_exists':
      return { field: 'Ya hay un documento con ese nombre en esta carpeta.' };
    case 'file_name_invalid':
      return { field: 'Ese nombre no es válido. Usá minúsculas, números y guiones.' };
    case 'module_unavailable':
      return { notice: DOCS_UNAVAILABLE_MESSAGE };
    default:
      // Incluye `folder_not_found`: se muestra como error de sistema.
      return { notice: 'No se pudo crear el documento. Intentá de nuevo.' };
  }
}

/** Errores de validación del módulo al guardar: van debajo del editor. `null` si no es uno de ellos. */
export function saveValidationMessage(error: unknown): string | null {
  switch (codeOf(error)) {
    case 'frontmatter_invalid':
      return `El frontmatter no es válido: ${messageOf(error)}. Corregilo y volvé a guardar.`;
    case 'invalid_relation':
      return `Uno de los vínculos no existe: ${messageOf(error)}.`;
    case 'content_too_large':
      return 'El documento supera los 256 KiB que se pueden guardar desde acá.';
    default:
      return null;
  }
}

export const SAVE_FAILED_MESSAGE =
  'No se pudo guardar. Tu texto sigue en el editor; intentá de nuevo.';
export const PERMISSION_DENIED_MESSAGE = 'No tenés permiso para editar este documento.';
export const START_EDIT_FAILED_MESSAGE = 'No se pudo empezar a editar. Intentá de nuevo.';
export const CURRENT_VERSION_FAILED_MESSAGE =
  'No se pudo cargar la versión actual. Recargá la página para verla.';

export const savedMessage = (version: number, warnings?: string[]): string =>
  warnings?.includes('possible_secret_detected')
    ? `Guardaste la versión ${version}. Revisalo: parece contener una clave o un token.`
    : `Guardaste la versión ${version}.`;

/** Errores de la subida de un adjunto (zona de adjuntos). */
export function attachmentErrorMessage(error: unknown): string {
  switch (codeOf(error)) {
    case 'attachment_type_not_allowed':
      return 'Ese tipo de archivo no está permitido.';
    case 'attachment_too_large':
      return 'El archivo supera el tamaño máximo permitido.';
    default:
      return 'No se pudo adjuntar el archivo. Intentá de nuevo.';
  }
}
