import { describe, it, expect } from 'vitest';
import { highlightSnippet } from './snippet';

describe('highlightSnippet (TS-21, P-8)', () => {
  it('(a) convierte las marcas <b> en segmentos marcados', () => {
    expect(
      highlightSnippet('pasos de <b>despliegue</b> en <b>producción</b>', 'despliegue')
    ).toEqual([
      { text: 'pasos de ' },
      { text: 'despliegue', mark: true },
      { text: ' en ' },
      { text: 'producción', mark: true },
    ]);
  });

  it('(b) sin marcas resalta los términos sin distinguir mayúsculas ni acentos', () => {
    expect(highlightSnippet('pasos de Despliegue en prod', 'despliegue')).toEqual([
      { text: 'pasos de ' },
      { text: 'Despliegue', mark: true },
      { text: ' en prod' },
    ]);
    expect(highlightSnippet('la producción', 'produccion')).toEqual([
      { text: 'la ' },
      { text: 'producción', mark: true },
    ]);
  });

  it('(c) el HTML ajeno queda como texto', () => {
    const segments = highlightSnippet('<img src=x onerror=alert(1)> despliegue', 'despliegue');
    expect(segments[0].text).toBe('<img src=x onerror=alert(1)> ');
    expect(segments[0].mark).toBeUndefined();
    expect(segments[1]).toEqual({ text: 'despliegue', mark: true });
  });

  it('ignora operadores de la consulta y devuelve el texto entero si nada coincide', () => {
    expect(highlightSnippet('hola mundo', '"foo" OR -bar')).toEqual([{ text: 'hola mundo' }]);
  });
});
