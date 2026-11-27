import 'mocha';
import 'should';
import { toPositional } from '../../src/queries/engine/positional';

describe('queries/engine/positional — reemplazos con nombre a parámetros posicionales', () => {
  it('numera en orden de aparición y reusa el número de un nombre repetido', () => {
    toPositional('a = :p0 AND b = :p1 OR c = :p0', { p0: 1, p1: 'x' })!.should.deepEqual({
      sql: 'a = $1 AND b = $2 OR c = $1',
      bind: [1, 'x'],
    });
  });

  it('`IN (:lista)` pasa a `= ANY($n)` y `NOT IN (:lista)` a `<> ALL($n)`', () => {
    toPositional('x IN (:p0) AND y NOT IN ( :p1 )', { p0: [1, 2], p1: ['a'] })!.should.deepEqual({
      sql: 'x = ANY($1) AND y <> ALL($2)',
      bind: [[1, 2], ['a']],
    });
  });

  it('no toca los casts de PostgreSQL ni un `:nombre` que no es reemplazo', () => {
    toPositional('CAST(:p0 AS jsonb) AND t::text = \':nada\'', { p0: '[]' })!.should.deepEqual({
      sql: 'CAST($1 AS jsonb) AND t::text = \':nada\'',
      bind: ['[]'],
    });
  });

  it('el patrón de búsqueda libre queda como parámetro, sin concatenarlo al SQL', () => {
    toPositional('t.title ILIKE \'%\' || :p0 || \'%\'', { p0: 'O\'Brien' })!.should.deepEqual({
      sql: 't.title ILIKE \'%\' || $1 || \'%\'',
      bind: ['O\'Brien'],
    });
  });

  it('una lista fuera de `IN (…)` no se sabe reescribir: devuelve null', () => {
    (toPositional('x = :p0', { p0: [1, 2] }) === null).should.be.true();
  });

  it('un valor ausente no se sabe expresar: devuelve null', () => {
    (toPositional('x = :p0', { p0: undefined }) === null).should.be.true();
  });
});
