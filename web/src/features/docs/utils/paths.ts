/** Carpeta de un documento: su `path` sin el nombre de archivo ("/clientes/acme/spec.md" → "/clientes/acme/"). */
export const folderPathOf = (path: string): string => path.slice(0, path.lastIndexOf('/') + 1);

/** Título a mostrar: el del documento o, si no tiene, el nombre de archivo sin `.md`. */
export const displayTitle = (doc: { title?: string | null; fileName: string }): string =>
  doc.title || doc.fileName.replace(/\.md$/i, '');
