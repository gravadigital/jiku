/**
 * Quita el frontmatter YAML: solo un bloque que empieza en la primera línea con `---` y cierra
 * en la siguiente línea `---` (o `...`). Sin bloque inicial o sin cierre, devuelve el contenido
 * intacto.
 *
 * Con jiku-docs 1.3.0 el contenido de un documento para un externo ya llega sin frontmatter;
 * la función queda como defensa (instalaciones con jiku-docs anterior o un contenido que lo
 * traiga) y no debe quitarse (REQ-021 decisión 12, S-099 CA-3).
 */
const FRONTMATTER = /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

export function stripFrontmatter(content: string): string {
  return content.replace(FRONTMATTER, '');
}
