/**
 * Traducción de los códigos de error de dominio que la api devuelve al
 * vincular o subir archivos. El mensaje prioriza el de la api; estos son el
 * texto que la interfaz usa cuando reconoce el código, porque el crudo del
 * servidor no está en lenguaje de personas.
 *
 * `file_not_owned` se dice como un problema de PERMISOS, no como un archivo
 * inválido: el archivo está bien, lo que falta es el derecho a vincularlo. Y no
 * tiene excepción por rol — un admin recibe el mismo mensaje (RF-13).
 */
const FILE_ERROR_MESSAGES: Record<string, string> = {
  file_not_owned: 'No podés adjuntar un archivo que subió otra persona',
  file_not_available: 'El archivo no está disponible',
  file_too_large: 'El archivo supera el tamaño máximo permitido',
  file_type_not_allowed: 'Ese tipo de archivo no está permitido',
};

interface MaybeApiError {
  code?: string;
  message?: string;
}

/**
 * Devuelve el mensaje que corresponde mostrar para un error de archivo, o
 * `fallback` si el error no es uno de los códigos conocidos.
 */
export function fileErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as MaybeApiError | null;
  const code = candidate?.code;
  if (code && FILE_ERROR_MESSAGES[code]) {
    return FILE_ERROR_MESSAGES[code];
  }
  return candidate?.message || fallback;
}
