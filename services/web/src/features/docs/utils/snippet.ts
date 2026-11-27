export interface SnippetSegment {
  text: string;
  mark?: boolean;
}

// P-8: el `snippet` se trata SIEMPRE como texto. Nunca se interpreta como HTML ni se usa
// `innerHTML`: la web solo parte el string en segmentos y el componente los pinta con <mark>.

const BOLD_MARKS = /<b>([\s\S]*?)<\/b>/gi;

// Un carácter → exactamente un carácter normalizado (sin acento, minúscula), para que los
// índices de la cadena normalizada coincidan con los del texto original.
const normChar = (ch: string): string => {
  const base = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return base.length === 1 ? base : (ch.toLowerCase()[0] ?? ch);
};
const normalize = (text: string): string => Array.from(text, normChar).join('');

const termsOf = (q: string): string[] =>
  q
    .replace(/"/g, ' ')
    .split(/\s+/)
    .filter((term) => term && term.toUpperCase() !== 'OR' && !term.startsWith('-'))
    .map(normalize);

export function highlightSnippet(snippet: string, q: string): SnippetSegment[] {
  if (/<b>/i.test(snippet)) {
    const segments: SnippetSegment[] = [];
    let last = 0;
    for (const match of snippet.matchAll(BOLD_MARKS)) {
      const start = match.index ?? 0;
      if (start > last) segments.push({ text: snippet.slice(last, start) });
      if (match[1]) segments.push({ text: match[1], mark: true });
      last = start + match[0].length;
    }
    if (last < snippet.length) segments.push({ text: snippet.slice(last) });
    return segments;
  }

  const haystack = normalize(snippet);
  const ranges: Array<[number, number]> = [];
  for (const term of termsOf(q)) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(term, from);
      if (at === -1) break;
      ranges.push([at, at + term.length]);
      from = at + term.length;
    }
  }
  if (ranges.length === 0) return snippet ? [{ text: snippet }] : [];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const prev = merged[merged.length - 1];
    if (prev && range[0] <= prev[1]) prev[1] = Math.max(prev[1], range[1]);
    else merged.push([...range]);
  }

  const chars = Array.from(snippet);
  const segments: SnippetSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: chars.slice(cursor, start).join('') });
    segments.push({ text: chars.slice(start, end).join(''), mark: true });
    cursor = end;
  }
  if (cursor < chars.length) segments.push({ text: chars.slice(cursor).join('') });
  return segments;
}
