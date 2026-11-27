/**
 * Quita el frontmatter YAML: solo un bloque que empieza en la primera línea con `---` y cierra
 * en la siguiente línea `---` (o `...`). Sin bloque inicial o sin cierre, devuelve el contenido
 * intacto.
 */
export const FRONTMATTER = /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

export function stripFrontmatter(content: string): string {
  return content.replace(FRONTMATTER, '');
}
