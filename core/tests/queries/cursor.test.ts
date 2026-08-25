import 'mocha';
import 'should';
import {
  CURSOR_VERSION,
  decodeCursor,
  encodeCursor,
  fingerprint,
  normalizeForHash,
} from '../../src/queries/engine/cursor';
import { CursorScope } from '../../src/queries/engine/types';

const SORT = ['-createdAt', '-id'];
const scope = (filter: unknown, sort: string[] = SORT): CursorScope => ({ filter, sort });

describe('queries/engine/cursor — el cursor keyset (CA-17, CA-18)', () => {
  it('ida y vuelta: lo que se codifica es lo que se decodifica', () => {
    const keys = ['2026-08-01T00:00:00.000Z', 8140];
    const s = scope({ projectId: 12 });

    const decoded = decodeCursor(encodeCursor(keys, s), s, 2);

    ('keys' in decoded).should.be.true();
    (decoded as { keys: unknown[] }).keys.should.deepEqual(keys);
  });

  it('es base64url: viaja en un JSON sin escapes y sin padding', () => {
    const cursor = encodeCursor(['2026-08-01T00:00:00.000Z', 8140], scope({}));
    cursor.should.match(/^[A-Za-z0-9_-]+$/);
  });

  it('los Date viajan como ISO, para que el JSON del cursor sea determinístico', () => {
    const date = new Date('2026-08-01T00:00:00.000Z');
    const s = scope({});

    const first = encodeCursor([date, 1], s);
    const second = encodeCursor([date.toISOString(), 1], s);

    first.should.equal(second);
  });

  it('TS-32 · reordenar las claves del MISMO filtro NO invalida el cursor', () => {
    // Si el hash se calculara sobre el JSON tal como llegó, un caller que reordene las claves
    // recibiría `invalid_cursor` sin haber cambiado nada.
    const cursor = encodeCursor(['x', 1], scope({ projectId: 12, state: 'activo' }));

    const decoded = decodeCursor(cursor, scope({ state: 'activo', projectId: 12 }), 2);

    ('keys' in decoded).should.be.true();
  });

  it('reordenar una LISTA del filtro tampoco lo invalida: `IN` no tiene orden', () => {
    const cursor = encodeCursor(['x', 1], scope({ state: ['backlog', 'activo'] }));

    const decoded = decodeCursor(cursor, scope({ state: ['activo', 'backlog'] }), 2);

    ('keys' in decoded).should.be.true();
  });

  it('TS-28 · cambiar el FILTRO sí lo invalida', () => {
    const cursor = encodeCursor(['x', 1], scope({ projectId: 12 }));

    const decoded = decodeCursor(cursor, scope({ projectId: 13 }), 2);

    (decoded as any).error.errorCode.should.equal('invalid_cursor');
  });

  it('cambiar el ORDEN sí lo invalida, y el orden del `sort` NO se normaliza', () => {
    const cursor = encodeCursor(['x', 1], scope({}, ['-createdAt', 'title', '-id']));

    // Las mismas claves, en otro orden: es OTRO `ORDER BY`, y el cursor no sirve.
    const decoded = decodeCursor(cursor, scope({}, ['title', '-createdAt', '-id']), 3);

    (decoded as any).error.errorCode.should.equal('invalid_cursor');
  });

  it('TS-31 · el `limit` NO participa del hash: cambiarlo entre páginas es válido', () => {
    // Es un REQUISITO, no un olvido (CA-17). El `limit` ni siquiera entra en el `CursorScope`.
    Object.keys(scope({ projectId: 12 })).sort().should.deepEqual(['filter', 'sort']);
    fingerprint(scope({ projectId: 12 })).should.equal(fingerprint(scope({ projectId: 12 })));
  });

  it('TS-29 · un cursor basura devuelve invalid_cursor, NUNCA lanza', () => {
    for (const garbage of ['no-es-base64url-####', 'YWJj', '{}', '.....']) {
      const decoded = decodeCursor(garbage, scope({}), 2);
      (decoded as any).error.errorCode.should.equal('invalid_cursor', garbage);
    }
  });

  it('TS-30 · un cursor de OTRA VERSIÓN se rechaza', () => {
    const cursor = Buffer.from(
      JSON.stringify({ v: 99, k: ['2026-08-01T00:00:00.000Z', 1], h: 'loquesea' }),
      'utf8'
    ).toString('base64url');

    (decodeCursor(cursor, scope({}), 2) as any).error.errorCode.should.equal('invalid_cursor');
  });

  it('un `k` de largo distinto al ORDER BY se rechaza', () => {
    const s = scope({});
    const cursor = encodeCursor(['x', 1], s);

    // El predicado keyset necesita exactamente una clave por criterio de orden.
    (decodeCursor(cursor, s, 3) as any).error.errorCode.should.equal('invalid_cursor');
  });

  it('un cursor sin `k` o sin `h` se rechaza', () => {
    for (const body of [{ v: CURSOR_VERSION, h: 'x' }, { v: CURSOR_VERSION, k: ['a', 1] }]) {
      const cursor = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
      (decodeCursor(cursor, scope({}), 2) as any).error.errorCode.should.equal('invalid_cursor');
    }
  });

  it('CA-18 · el cursor NO transporta identidad ni resultados: solo `v`, `k` y `h`', () => {
    const cursor = encodeCursor(['2026-08-01T00:00:00.000Z', 8140], scope({ projectId: 12 }));

    const body = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));

    Object.keys(body).sort().should.deepEqual(['h', 'k', 'v']);
    body.v.should.equal(CURSOR_VERSION);
    // Ni el caller, ni el filtro en claro, ni el conjunto de resultados.
    JSON.stringify(body).should.not.containEql('projectId');
  });

  it('el hash es de largo fijo y no reversible: es un detector de cambio, no un secreto', () => {
    const short = fingerprint(scope({ projectId: 12 }));
    const long = fingerprint(scope({ projectId: 12, state: ['a', 'b', 'c'], q: 'x'.repeat(500) }));

    short.length.should.equal(long.length);
    short.should.match(/^[0-9a-f]+$/);
  });

  it('la normalización ordena claves en TODOS los niveles y omite `undefined`', () => {
    const normalized = normalizeForHash({
      b: 1,
      a: { z: 1, y: { n: 2, m: 3 } },
      c: undefined,
    });

    JSON.stringify(normalized).should.equal('{"a":{"y":{"m":3,"n":2},"z":1},"b":1}');
  });
});
