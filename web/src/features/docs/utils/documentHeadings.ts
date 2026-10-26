export interface DocHeading {
  level: 1 | 2;
  text: string;
  id: string;
  /** 1-based sobre el string recibido. */
  line: number;
}

const ATX = /^(#{1,2})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const FENCE = /^(```|~~~)/;

const slugOf = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'seccion';

const plainText = (raw: string): string => raw.replace(/[*_`]/g, '').trim();

/**
 * Encabezados ATX de nivel 1 y 2 fuera de bloques cercados. El id se ata a la línea porque el
 * componente de react-markdown conoce `node.position.start.line`, no el orden de aparición.
 */
export function extractHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const seen = new Map<string, number>();
  let fence: string | null = null;

  markdown.split(/\r?\n/).forEach((line, index) => {
    const marker = FENCE.exec(line)?.[1];
    if (marker) {
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      return;
    }
    if (fence !== null) return;

    const match = ATX.exec(line);
    if (!match) return;
    const text = plainText(match[2] ?? '');
    if (!text) return;

    const base = slugOf(text);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    headings.push({
      level: match[1] === '#' ? 1 : 2,
      text,
      id: count === 1 ? base : `${base}-${count}`,
      line: index + 1,
    });
  });

  return headings;
}
