import 'mocha';
import 'should';
import { paginate } from '../../src/queries/engine/paginate';
import { ProjectedEntry } from '../../src/queries/engine/project';
import { CursorScope } from '../../src/queries/engine/types';

/**
 * El presupuesto de bytes y la emisión del cursor.
 *
 * La regla que se verifica acá es la que evita el peor modo de falla del contrato: NUNCA una
 * página vacía con cursor, que para el cliente es un bucle infinito.
 */

const SCOPE: CursorScope = { filter: {}, sort: ['-createdAt', '-id'] };

function entry(id: number, description?: string): ProjectedEntry {
  const item: Record<string, unknown> = { id, title: `Tarea ${id}` };
  if (description !== undefined) {
    item.description = description;
  }
  return { item, keys: ['2026-08-01T00:00:00.000Z', id] };
}

const options = (overrides: Partial<Parameters<typeof paginate>[1]> = {}) => ({
  hasMore: false,
  budgetBytes: 524288,
  truncatable: ['description'],
  scope: SCOPE,
  ...overrides,
});

describe('queries/engine/paginate — presupuesto y cursor (CA-13, CA-14, CA-15)', () => {
  it('con presupuesto amplio entran todos los items pedidos', () => {
    const page = paginate([entry(1), entry(2), entry(3)], options());

    page.items.length.should.equal(3);
  });

  it('TS-19 · la última página NO trae cursor', () => {
    const page = paginate([entry(1), entry(2)], options({ hasMore: false }));

    (page.cursor === undefined).should.be.true();
  });

  it('con la fila extra del `LIMIT limit + 1` se emite cursor', () => {
    const page = paginate([entry(1), entry(2)], options({ hasMore: true }));

    (page.cursor === undefined).should.be.false();
  });

  it('TS-21 · con presupuesto chico CORTA la página y emite cursor igual', () => {
    const big = 'x'.repeat(400);
    const entries = Array.from({ length: 20 }, (_, index) => entry(index + 1, big));

    const page = paginate(entries, options({ budgetBytes: 2048, hasMore: false }));

    // Menos items que los que había, y CURSOR PRESENTE aunque no hubiera fila extra: el corte
    // por bytes también es "hay más".
    page.items.length.should.be.below(20);
    page.items.length.should.be.above(0);
    (page.cursor === undefined).should.be.false();
  });

  it('TS-22 · el primer item que SOLO no entra se devuelve TRUNCADO Y MARCADO', () => {
    const entries = [entry(1, 'y'.repeat(5000)), entry(2, 'z'.repeat(5000))];

    const page = paginate(entries, options({ budgetBytes: 512 }));

    // NUNCA una página vacía con cursor: la regla gana sobre el presupuesto.
    page.items.length.should.be.aboveOrEqual(1);
    page.items[0].descriptionTruncated!.should.be.true();
    (page.items[0].description as string).length.should.be.below(5000);
    (page.cursor === undefined).should.be.false();
  });

  it('el truncado no parte un carácter multi-byte', () => {
    const entries = [entry(1, 'ñ'.repeat(3000))];

    const page = paginate(entries, options({ budgetBytes: 512 }));

    // Si partiera un carácter, el JSON dejaría de ser decodificable.
    JSON.parse(JSON.stringify(page.items[0])).description.should.be.a.String();
  });

  it('un item que entra NO se marca como truncado', () => {
    const page = paginate([entry(1, 'corto')], options());

    page.items[0].should.not.have.property('descriptionTruncated');
    page.items[0].description!.should.equal('corto');
  });

  it('TS-49 · una colección vacía no lleva cursor y no es un error', () => {
    const page = paginate([], options({ hasMore: false }));

    page.items.should.deepEqual([]);
    (page.cursor === undefined).should.be.true();
  });

  it('el cursor sale de la clave del ÚLTIMO item DEVUELTO, no del último traído', () => {
    const big = 'x'.repeat(400);
    const entries = Array.from({ length: 20 }, (_, index) => entry(index + 1, big));

    const page = paginate(entries, options({ budgetBytes: 2048 }));

    const body = JSON.parse(Buffer.from(page.cursor!, 'base64url').toString('utf8'));
    body.k[1].should.equal(page.items[page.items.length - 1].id);
  });
});
