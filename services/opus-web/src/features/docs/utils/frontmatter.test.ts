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

  it('TS-6: contenido 1.3.0 sin frontmatter queda intacto', () => {
    const input = '# Instalación\n\nPaso uno.\n';
    expect(stripFrontmatter(input)).toBe(input);
  });

  it('TS-7: frontmatter 1.3.0 con temas y relaciones, si llegara', () => {
    expect(
      stripFrontmatter(
        '---\ntitle: Guía\nvisibility: public\ntopics: [despliegue]\nprojects: [12]\n---\n# Guía\n'
      )
    ).toBe('# Guía\n');
  });

  it('TS-8: cierre con ...', () => {
    expect(stripFrontmatter('---\nvisibility: public\n...\nTexto\n')).toBe('Texto\n');
  });

  it('TS-9: un --- como separador horizontal en medio no se toca', () => {
    const input = 'Intro\n\n---\n\nResto\n';
    expect(stripFrontmatter(input)).toBe(input);
  });
});
