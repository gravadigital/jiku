/**
 * La validación de tipo y tamaño dejó de ser autoritativa acá (REQ-001, CA-12).
 * La fuente de verdad es `core`, que lee la política de `system_settings` en
 * caliente: el tope de tamaño y la lista de extensiones cambian por SQL sin
 * redespliegue, así que el cliente no puede declararlos ni nombrarlos.
 *
 * Lo único que queda es el rechazo de un archivo vacío, que no depende de
 * ninguna política configurable y evita un ticket y un PUT inútiles.
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size === 0) {
    return { valid: false, error: `El archivo "${file.name}" está vacío` };
  }

  return { valid: true };
}
