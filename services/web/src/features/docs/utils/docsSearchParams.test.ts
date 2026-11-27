import { describe, expect, it } from 'vitest';
import {
  addToken,
  parseDocsSearch,
  removeTokenAt,
  serializeDocsSearch,
  SIN_TOKENS,
  toListFilters,
  toSearchQuery,
  tokenKey,
  viewOf,
} from './docsSearchParams';

const parse = (qs: string) => parseDocsSearch(new URLSearchParams(qs));

describe('docsSearchParams', () => {
  it('TS-8: URL → estado en orden', () => {
    expect(
      parse('cliente=4&proyecto=12&tema=video&persona=sub-ana&publico=1&orden=az&pagina=2')
    ).toEqual({
      tokens: [
        { kind: 'cliente', id: 4 },
        { kind: 'proyecto', id: 12 },
        { kind: 'tema', value: 'video' },
        { kind: 'persona', sub: 'sub-ana' },
      ],
      publico: true,
      orden: 'az',
      pagina: 2,
      origen: null,
    });
  });

  it('TS-9: ida y vuelta estable', () => {
    const qs = 'cliente=4&proyecto=12&sinTema=1&publico=1&orden=az&pagina=3';
    expect(serializeDocsSearch(parse(qs))).toBe(qs);
  });

  it('TS-10: valores inválidos se ignoran', () => {
    const state = parse(
      'proyecto=abc&proyecto=0&cliente=-1&pagina=-2&orden=foo&sinProyecto=0&q=a&volver=https://evil.example'
    );
    expect(state).toEqual({
      tokens: [],
      publico: false,
      orden: 'recientes',
      pagina: 1,
      origen: null,
    });
    expect(serializeDocsSearch(state)).toBe('');
  });

  it('TS-11: topes del contrato', () => {
    const proyectos = Array.from({ length: 21 }, (_, i) => `proyecto=${i + 1}`).join('&');
    const personas = Array.from({ length: 11 }, (_, i) => `persona=s${i + 1}`).join('&');
    const state = parse(`${proyectos}&${personas}&requisito=5&requisito=6`);
    const kinds = (kind: string) => state.tokens.filter((t) => t.kind === kind);
    expect(kinds('proyecto')).toHaveLength(20);
    expect(kinds('proyecto')[19]).toEqual({ kind: 'proyecto', id: 20 });
    expect(kinds('persona')).toHaveLength(10);
    expect(kinds('requisito')).toEqual([{ kind: 'requisito', id: 5 }]);
  });

  it('TS-12: filtros de listado', () => {
    expect(
      toListFilters(parse('cliente=4&proyecto=12&proyecto=31&sinTema=1&publico=1&orden=az'))
    ).toEqual({
      clientId: [4],
      projectId: [12, 31],
      hasTopic: false,
      visibility: 'public',
      sort: 'title',
      limit: 20,
      count: true,
    });
  });

  it('TS-13: query de texto', () => {
    const state = parse('q=video&tema=video&q=arquitectura&requisito=5');
    expect(toSearchQuery(state)).toEqual({
      q: 'video arquitectura',
      topic: ['video'],
      requirementId: 5,
      limit: 50,
    });
    expect(viewOf(state).mode).toBe('texto');
    expect(state.orden).toBe('relevancia');
  });

  it('TS-14: exclusividad y no duplicados', () => {
    const base = parse('proyecto=12&cliente=4');
    const sin = addToken(base, { kind: 'sinProyecto' });
    expect(sin.tokens).toEqual([{ kind: 'cliente', id: 4 }, { kind: 'sinProyecto' }]);
    expect(addToken(sin, { kind: 'proyecto', id: 31 }).tokens).toEqual([
      { kind: 'cliente', id: 4 },
      { kind: 'proyecto', id: 31 },
    ]);
    expect(addToken(parse('proyecto=12'), { kind: 'proyecto', id: 12 }).tokens).toEqual([
      { kind: 'proyecto', id: 12 },
    ]);
  });

  it('TS-15: los cambios borran página y origen', () => {
    const state = parse('proyecto=12&origen=proyecto&pagina=3');
    expect(serializeDocsSearch(removeTokenAt(state, 0))).toBe('');
    expect(serializeDocsSearch(addToken(state, { kind: 'tema', value: 'video' }))).toBe(
      'proyecto=12&tema=video&origen=proyecto'
    );
  });

  it('TS-16: vistas y origen', () => {
    expect(viewOf(parse('')).mode).toBe('inicio');
    expect(viewOf(parse('publico=1')).mode).toBe('listado');
    const sinProyecto = viewOf(parse('sinProyecto=1'));
    expect(sinProyecto.mode).toBe('listado');
    expect(sinProyecto.sinProyecto).toBe(true);
    expect(viewOf(parse('proyecto=12&origen=proyecto')).origin).toEqual({
      kind: 'proyecto',
      id: 12,
      href: '/projects/12',
    });
    expect(viewOf(parse('requisito=5&origen=requisito')).origin?.href).toBe('/requirements/5');
    expect(viewOf(parse('tarea=7&origen=tarea')).origin?.href).toBe('/objectives/7');
    expect(viewOf(parse('origen=proyecto')).origin).toBeNull();
  });

  it('el orden inválido para el modo cae al default y el default no se escribe', () => {
    expect(parse('cliente=4&orden=relevancia').orden).toBe('recientes');
    expect(parse('q=video&orden=az').orden).toBe('relevancia');
    expect(serializeDocsSearch(parse('q=video&orden=recientes'))).toBe('q=video&orden=recientes');
    expect(serializeDocsSearch(parse('q=video'))).toBe('q=video');
  });

  it('tokenKey y SIN_TOKENS', () => {
    expect(tokenKey({ kind: 'proyecto', id: 12 })).toBe('proyecto:12');
    expect(tokenKey({ kind: 'sinCliente' })).toBe('sinCliente');
    expect(SIN_TOKENS.map((t) => t.kind)).toEqual(['sinProyecto', 'sinCliente', 'sinTema']);
  });
});
