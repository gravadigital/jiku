import { describe, expect, it } from 'vitest';
import { buildSuggestions } from './suggestionOptions';

const SUGGESTIONS = {
  projects: [
    { id: 12, name: 'Videoconferencia', code: 'VID', clientId: 4, clientName: 'EXO', mine: true },
  ],
  clients: [],
  persons: [],
  topics: [{ topic: 'video', documents: 7 }],
};

describe('buildSuggestions', () => {
  it('la primera fila siempre es buscar texto; los grupos vacíos no se dibujan', () => {
    const list = buildSuggestions('vid', SUGGESTIONS);
    expect(list.flat[0]?.label).toBe('Buscar «vid» en títulos y contenido');
    expect(list.groups.map((g) => g.label)).toEqual(['Proyectos', 'Temas']);
    expect(list.flat.map((o) => o.index)).toEqual([0, 1, 2]);
    expect(list.groups[1]?.options[0]?.secondary).toBe('7 documentos');
  });

  it('sin coincidencias: solo buscar texto', () => {
    expect(buildSuggestions('zzz', undefined).flat).toHaveLength(1);
  });

  it('"sin" ofrece los tres "Sin …"; "sin p" solo proyecto', () => {
    expect(buildSuggestions('Sin', undefined).leading.map((o) => o.label)).toEqual([
      'Buscar «Sin» en títulos y contenido',
      'Sin proyecto',
      'Sin cliente',
      'Sin tema',
    ]);
    expect(buildSuggestions('sin p', undefined).leading.map((o) => o.label)).toEqual([
      'Buscar «sin p» en títulos y contenido',
      'Sin proyecto',
    ]);
  });

  it('cada opción arma su token', () => {
    const list = buildSuggestions('vid', SUGGESTIONS);
    expect(list.flat[1]?.token).toEqual({ kind: 'proyecto', id: 12 });
    expect(list.flat[2]?.token).toEqual({ kind: 'tema', value: 'video' });
  });
});
