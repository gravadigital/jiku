import { describe, it, expect } from 'vitest';
import { stripFrontmatter } from './frontmatter';

const CONTENT_FM =
  '---\ntitle: Arquitectura de videoconferencia\njiku:\n  projects: [12]\n---\n# Contexto\n\nTexto.\n\n## Decisiones\n\nMás texto.\n';

describe('stripFrontmatter (TS-6)', () => {
  it('quita el bloque inicial', () => {
    expect(stripFrontmatter(CONTENT_FM)).toBe(
      '# Contexto\n\nTexto.\n\n## Decisiones\n\nMás texto.\n'
    );
    expect(stripFrontmatter('---\na: 1\n...\n# T')).toBe('# T');
    expect(stripFrontmatter('---\r\na: 1\r\n---\r\n# T')).toBe('# T');
  });
  it('deja intacto lo que no es frontmatter', () => {
    expect(stripFrontmatter('# Sin frontmatter\n---\nx')).toBe('# Sin frontmatter\n---\nx');
    expect(stripFrontmatter('---\nsin cierre\n# T')).toBe('---\nsin cierre\n# T');
    expect(stripFrontmatter(' ---\na\n---\n')).toBe(' ---\na\n---\n');
  });
});
