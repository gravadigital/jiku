import 'mocha';
import 'should';
import * as sinon from 'sinon';
import { Sequelize } from 'sequelize-typescript';
import { tasksSpec } from '../../src/queries/tasks/tasks-spec';
import { attachCollections } from '../../src/queries/engine/include';
import { QueryContext } from '../../src/queries/types';

/**
 * Las relaciones de COLECCIÓN, por lote.
 *
 * Acá se lee el SQL generado; el comportamiento contra la base real está en `tasks.test.ts`. Lo
 * que se verifica es la propiedad estructural de RF-36: UNA consulta por relación, con los ids de
 * la página, y nunca una por item.
 */

function contextWith(rows: Record<string, unknown>[]): { ctx: QueryContext; query: sinon.SinonStub } {
  const query = sinon.stub().resolves(rows);
  return {
    ctx: { caller: 'test', callerClass: 'internal', db: { query } as unknown as Sequelize },
    query,
  };
}

describe('queries/engine/include — resolución por lote (CA-11)', () => {
  it('CA-11 · una consulta por relación, con TODOS los ids de la página', async () => {
    const items = Array.from({ length: 50 }, (_, index) => ({ id: index + 1 }));
    const { ctx, query } = contextWith([]);

    await attachCollections(tasksSpec, ['comments', 'subscriptors'], items, ctx, 'tasks.list');

    // Dos relaciones, dos consultas. Con 50 items. No 100, no 50 por relación.
    query.callCount.should.equal(2);
    (query.firstCall.args[1] as any).replacements.ids.length.should.equal(50);
  });

  it('sin items no se consulta nada', async () => {
    const { ctx, query } = contextWith([]);

    await attachCollections(tasksSpec, ['comments'], [], ctx, 'tasks.list');

    query.callCount.should.equal(0);
  });

  it('el tope por item se resuelve con una FUNCIÓN DE VENTANA y `cap + 1`', async () => {
    const { ctx, query } = contextWith([]);

    await attachCollections(tasksSpec, ['comments'], [{ id: 1 }], ctx, 'tasks.list');

    const sql = String(query.firstCall.args[0]);
    // Particionada por el id del recurso: el tope es POR ITEM, no por página.
    sql.should.containEql('ROW_NUMBER() OVER (PARTITION BY r.objective_id');
    sql.should.containEql('ORDER BY r.created_at DESC, r.id DESC');
    // El 11 es lo que permite saber si hay que marcar el truncado SIN un COUNT.
    sql.should.containEql('<= 11');
    // La condición fija de la ficha, no del payload.
    sql.should.containEql("r.type_of_activity = 'comment'");
    // Y el ORDER BY DE AFUERA: PostgreSQL no garantiza que la subconsulta conserve su orden al
    // atravesar el filtro, y el recorte a `cap` que hace el código se quedaría con diez filas
    // cualesquiera de las once en vez de con las diez más recientes.
    sql.should.containEql('ORDER BY s."__parent", s."__rn"');
    // La traducción de vocabulario va en el SELECT.
    sql.should.containEql('r.new_value AS "body"');
    sql.should.containEql('r.changed_by AS "authorId"');
  });

  it('la relación con JOIN trae los campos de la otra tabla, y filtra por `active`', async () => {
    const { ctx, query } = contextWith([]);

    await attachCollections(tasksSpec, ['responsiblePersons'], [{ id: 1 }], ctx, 'tasks.list');

    const sql = String(query.firstCall.args[0]);
    sql.should.containEql('FROM people_objectives r');
    sql.should.containEql('INNER JOIN people j ON j.id = r.person_id');
    sql.should.containEql('j.first_name AS "firstName"');
    // La regla OPUESTA a la del filtro `responsiblePersonId`, y es deliberado.
    sql.should.containEql('r.active = true');
  });

  it('los ids van como VALOR, nunca concatenados al SQL', async () => {
    const { ctx, query } = contextWith([]);

    await attachCollections(tasksSpec, ['subscriptors'], [{ id: 8140 }, { id: 8141 }], ctx, 'x');

    String(query.firstCall.args[0]).should.containEql('IN (:ids)');
    String(query.firstCall.args[0]).should.not.containEql('8140');
    (query.firstCall.args[1] as any).replacements.ids.should.deepEqual([8140, 8141]);
  });

  it('agrupa por item y marca el truncado cuando hay más que el tope', async () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({
      __parent: 1,
      id: index + 1,
      body: `c${index}`,
      authorId: 'u',
      createdAt: '2026-08-01T00:00:00.000Z',
    }));
    const item: Record<string, unknown> = { id: 1 };
    const { ctx } = contextWith(rows);

    await attachCollections(tasksSpec, ['comments'], [item], ctx, 'tasks.list');

    // Se devuelven 10 y se marca: la fila 11 solo existía para saberlo.
    (item.comments as unknown[]).length.should.equal(10);
    item.commentsTruncated!.should.be.true();
  });

  it('con menos que el tope, la marca es `false`', async () => {
    const rows = [{ __parent: 1, id: 1, body: 'c', authorId: 'u', createdAt: 'x' }];
    const item: Record<string, unknown> = { id: 1 };
    const { ctx } = contextWith(rows);

    await attachCollections(tasksSpec, ['comments'], [item], ctx, 'tasks.list');

    (item.comments as unknown[]).length.should.equal(1);
    item.commentsTruncated!.should.be.false();
  });

  it('una relación escalar devuelve la lista de valores, no de objetos', async () => {
    const item: Record<string, unknown> = { id: 1 };
    const { ctx } = contextWith([
      { __parent: 1, userId: 'u-1' },
      { __parent: 1, userId: 'u-2' },
    ]);

    await attachCollections(tasksSpec, ['subscriptors'], [item], ctx, 'tasks.list');

    item.subscriptors!.should.deepEqual(['u-1', 'u-2']);
  });

  it('un item sin filas en el lote queda con la colección vacía, no sin la clave', async () => {
    const item: Record<string, unknown> = { id: 99 };
    const { ctx } = contextWith([{ __parent: 1, userId: 'u-1' }]);

    await attachCollections(tasksSpec, ['subscriptors'], [item], ctx, 'tasks.list');

    item.subscriptors!.should.deepEqual([]);
  });
});
