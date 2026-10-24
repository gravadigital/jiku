import { stripFrontmatter } from './frontmatter';

describe('stripFrontmatter', () => {
  it('TS-18: quita el bloque inicial', () => {
    expect(stripFrontmatter('---\nprojects: [12]\nvisibility: public\n---\n# Instalación\n')).toBe(
      '# Instalación\n'
    );
  });

  it('no toca un --- que no está en la primera línea', () => {
    const input = '# Sin frontmatter\n---\nno es frontmatter\n';
    expect(stripFrontmatter(input)).toBe(input);
  });

  it('tolera CRLF', () => {
    expect(stripFrontmatter('---\r\na: 1\r\n---\r\n# T\r\n')).toBe('# T\r\n');
  });

  it('un frontmatter sin cierre deja el contenido intacto', () => {
    const input = '---\na: 1\n# T\n';
    expect(stripFrontmatter(input)).toBe(input);
  });
});
