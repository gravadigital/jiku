import 'mocha';
import 'should';
import sinon from 'sinon';
import { readDb } from '../../src/models/read';
import { sequelize } from '../../src/models';
import { dispatchQuery } from '../helpers/dispatch';
import {
  PROJECT_MAIN,
  Q_EXTERNAL,
  Q_INTERNAL,
  REQUIREMENT,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
} from './task-fixtures';
import {
  PERSON_LINKED,
  TASK_WT,
  WT_LATE,
  WT_OTHER,
  WT_REQ,
  WT_TASK,
  createTeamWorld,
  destroyTeamWorld,
} from './team-fixtures';

/**
 * `worked-times.list` — EL RECURSO DE MAYOR VOLUMEN DEL CONTRATO (S-026, Task 6).
 *
 * Concentra las dos decisiones más finas de la story —la traducción `taskId` <- `objective_id` y el
 * `items: []` de la exclusión mutua— y es el primero de los tres recursos SIN ACCESO EXTERNO.
 */

function ids(reply: any): number[] {
  return reply.data.items.map((item: any) => item.id);
}

describe('queries/worked-times.list — la ficha, la traducción y la exclusión mutua', () => {
  before(async () => {
    await createWorld();
    await createQueryCallers();
    await createTeamWorld();
  });

  after(async () => {
    await destroyTeamWorld();
    await destroyQueryCallers();
    await destroyWorld();
  });

  it('TS-41 · el conjunto base son NUEVE campos exactos, con `taskId`', async () => {
    const reply: any = await dispatchQuery('worked-times.list', { filter: { id: WT_TASK } });

    reply.status.should.equal('success');
    Object.keys(reply.data.items[0]).should.deepEqual([
      'id',
      'date',
      'minutes',
      'projectId',
      'personId',
      'taskId',
      'requirementId',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('TS-42 · CA-10 · `taskId` sale de `objective_id` y `objectiveId` NO EXISTE', async () => {
    const reply: any = await dispatchQuery('worked-times.list', { filter: { id: WT_TASK } });

    const item = reply.data.items[0];
    item.taskId.should.equal(TASK_WT);
    item.should.have.property('requirementId', null);
    ('objectiveId' in item).should.be.false();
  });

  it('TS-43 · CA-10 · `filter.taskId` filtra por `objective_id`', async () => {
    const reply: any = await dispatchQuery('worked-times.list', { filter: { taskId: TASK_WT } });

    ids(reply).should.deepEqual([WT_TASK]);
  });

  it('TS-44 · `objectiveId` NO es un nombre del contrato, ni como filtro ni como campo', async () => {
    const asFilter: any = await dispatchQuery('worked-times.list', {
      filter: { objectiveId: TASK_WT },
    });
    asFilter.errorCode.should.equal('invalid_fields');
    asFilter.errorDetails.allowed.should.containEql('taskId');
    asFilter.errorDetails.allowed.should.not.containEql('objectiveId');

    const asField: any = await dispatchQuery('worked-times.list', { fields: ['objectiveId'] });
    asField.errorCode.should.equal('invalid_fields');
  });

  it('TS-45 · CA-11 · `taskId` + `requirementId` juntos -> `items: []`, NUNCA un error', async () => {
    /*
     * EL `items: []` ES LA CONSECUENCIA NATURAL DEL `AND`, no una validación.
     *
     * La exclusión entre `objective_id` y `requirement_id` es una regla DE ESCRITURA y NO TIENE
     * CONSTRAINT en la base (inconsistencia 6 del esquema): la validan la api y `core` al escribir.
     * Que el servicio de consultas la validara sería DUPLICARLA EN UN TERCER LUGAR, y el día que la
     * regla cambie quedarían tres verdades. El contrato no reimplementa la regla de dominio: la
     * refleja (ADR-004).
     *
     * El mundo tiene las DOS clases de hora —`6001` solo tarea, `6002` solo requisito—, así que el
     * vacío es SIGNIFICATIVO y no un falso positivo por tabla vacía.
     */
    const reply: any = await dispatchQuery('worked-times.list', {
      filter: { taskId: TASK_WT, requirementId: REQUIREMENT },
    });

    reply.status.should.equal('success');
    reply.data.items.should.deepEqual([]);
  });

  it('TS-46 · los cuatro incluibles, con sus campos exactos y sus `null`', async () => {
    const reply: any = await dispatchQuery('worked-times.list', {
      filter: { id: [WT_TASK, WT_REQ] },
      include: ['person', 'project', 'task', 'requirement'],
    });

    const byId = new Map(reply.data.items.map((item: any) => [item.id, item]));

    const withTask = byId.get(WT_TASK) as any;
    withTask.person.should.deepEqual({
      id: PERSON_LINKED,
      firstName: 'Carla',
      lastName: 'Benítez',
    });
    withTask.project.should.deepEqual({ id: PROJECT_MAIN, name: 'Portal Jiku', code: 'PJK' });
    withTask.task.should.deepEqual({ id: TASK_WT, title: 'Tarea con horas', state: 'activo' });
    withTask.should.have.property('requirement', null);

    const withRequirement = byId.get(WT_REQ) as any;
    withRequirement.should.have.property('task', null);
    withRequirement.requirement.should.deepEqual({
      id: REQUIREMENT,
      title: 'Requisito A',
      state: 'analisis',
    });
  });

  it('TS-47 · `filter.date` con rango combinado `gte` + `lte`', async () => {
    const reply: any = await dispatchQuery('worked-times.list', {
      filter: { personId: PERSON_LINKED, date: { gte: '2026-08-01', lte: '2026-09-01' } },
    });

    ids(reply).sort().should.deepEqual([WT_TASK, WT_REQ, WT_LATE].sort());
    ids(reply).should.not.containEql(WT_OTHER);
  });

  it('TS-48 · el sort default es `["-date"]` y el desempate que agrega el motor es `id` DESC', async () => {
    const reply: any = await dispatchQuery('worked-times.list', {
      filter: { personId: PERSON_LINKED },
    });

    // `6004` (31 a las 14:30) > `6002` (31 a medianoche) > `6001` (10 de agosto).
    // Si sale [6001, 6002, 6004] se copió un default ascendente.
    ids(reply).should.deepEqual([WT_LATE, WT_REQ, WT_TASK]);
  });

  it('TS-49 · H-7 · las cuatro relaciones son UNA consulta, no una por item', async () => {
    const spy = sinon.spy(readDb, 'query');
    try {
      await dispatchQuery('worked-times.list', {
        filter: { personId: PERSON_LINKED },
        include: ['person', 'project', 'task', 'requirement'],
      });

      // Son cuatro LEFT JOIN en la consulta principal. Si registra más de una por item, la relación
      // se declaró como colección.
      spy.callCount.should.equal(1);
    } finally {
      spy.restore();
    }
  });

  it('TS-50 · lo ordenable son tres nombres', async () => {
    const ok: any = await dispatchQuery('worked-times.list', { sort: ['minutes'] });
    ok.status.should.equal('success');

    const bad: any = await dispatchQuery('worked-times.list', { sort: ['createdAt'] });
    bad.errorCode.should.equal('invalid_fields');
    bad.errorDetails.allowed.should.deepEqual(['date', 'minutes', 'id']);
  });

  it('TS-51 · el keyset recorre sin repetir ni saltear', async () => {
    const first: any = await dispatchQuery('worked-times.list', {
      filter: { personId: PERSON_LINKED },
      page: { limit: 2 },
    });
    first.data.page.should.have.property('cursor');

    const second: any = await dispatchQuery('worked-times.list', {
      filter: { personId: PERSON_LINKED },
      page: { limit: 2, cursor: first.data.page.cursor },
    });

    [...ids(first), ...ids(second)].should.deepEqual([WT_LATE, WT_REQ, WT_TASK]);
    // La ausencia de `cursor` es la ÚNICA señal de fin de colección.
    second.data.page.should.not.have.property('cursor');
  });

  it('TS-52 · H-5 · el orden por una columna NULL-able NO corta el recorrido', async () => {
    // La fila con `date NULL` se inserta POR SQL: el modelo no permite escribirla, y es justamente
    // la que destapa que `nullable: true` no es decorativo.
    await sequelize.query(
      'INSERT INTO worked_times (id, date, minutes, project_id, person_id, created_at, updated_at) ' +
        'VALUES (6099, NULL, 45, :project, :person, NOW(), NOW())',
      { replacements: { project: PROJECT_MAIN, person: PERSON_LINKED } }
    );

    try {
      const collected: number[] = [];
      let cursor: string | undefined;
      // Cota de seguridad: si el keyset se cortara solo, el bucle termina igual y la aserción falla.
      for (let page = 0; page < 6; page += 1) {
        const reply: any = await dispatchQuery('worked-times.list', {
          filter: { personId: PERSON_LINKED },
          page: cursor ? { limit: 2, cursor } : { limit: 2 },
        });
        collected.push(...ids(reply));
        cursor = reply.data.page.cursor;
        if (!cursor) {
          break;
        }
      }

      // LAS CUATRO, incluida la de `date NULL`. Si falta alguna, `nullable` quedó en `false`.
      collected.sort().should.deepEqual([WT_TASK, WT_REQ, WT_LATE, 6099].sort());
    } finally {
      await sequelize.query('DELETE FROM worked_times WHERE id = 6099');
    }
  });

  it('TS-80 · `page.limit` mayor a 200 se recorta SIN AVISAR', async () => {
    const reply: any = await dispatchQuery('worked-times.list', { page: { limit: 500 } });

    reply.status.should.equal('success');
    reply.data.page.limit.should.equal(200);
  });
});

describe('queries/worked-times.list — SIN ACCESO EXTERNO (CA-9)', () => {
  before(async () => {
    await createWorld();
    await createQueryCallers();
    await createTeamWorld();
  });

  after(async () => {
    await destroyTeamWorld();
    await destroyQueryCallers();
    await destroyWorld();
  });

  it('TS-3 · un caller externo recibe `items: []` SIN EJECUTAR UNA SOLA CONSULTA', async () => {
    const spy = sinon.spy(readDb, 'query');
    try {
      const reply: any = await dispatchQuery('worked-times.list', {}, Q_EXTERNAL);

      reply.status.should.equal('success');
      reply.data.items.should.deepEqual([]);
      reply.data.page.returned.should.equal(0);
      // CERO LLAMADAS: es lo que distingue el corte de un `WHERE FALSE`, que daría el mismo
      // resultado y pagaría un round-trip a la base por cada request.
      spy.callCount.should.equal(0);
    } finally {
      spy.restore();
    }
  });

  it('TS-6 · `count: true` devuelve `total: 0`, coherentemente y sin SQL', async () => {
    const spy = sinon.spy(readDb, 'query');
    try {
      const reply: any = await dispatchQuery('worked-times.list', { count: true }, Q_EXTERNAL);

      reply.data.page.total.should.equal(0);
      reply.data.items.should.deepEqual([]);
      spy.callCount.should.equal(0);
    } finally {
      spy.restore();
    }
  });

  it('TS-8 · el corte es por CLASE, no por recurso: la clase interna sí trae filas', async () => {
    const reply: any = await dispatchQuery(
      'worked-times.list',
      { filter: { personId: PERSON_LINKED } },
      Q_INTERNAL
    );

    // RF-23: el modo interno NO recorta a nivel de fila, y en esta story es donde más se nota.
    ids(reply).sort().should.deepEqual([WT_TASK, WT_REQ, WT_LATE].sort());
  });

  it('TS-9 · el `page` del corte respeta el `limit` pedido y NO trae `cursor`', async () => {
    const reply: any = await dispatchQuery(
      'worked-times.list',
      { page: { limit: 7 } },
      Q_EXTERNAL
    );

    reply.data.page.should.deepEqual({ limit: 7, returned: 0 });
  });

  it('TS-10 · el corte va DESPUÉS de validar: un nombre inválido sigue siendo `invalid_fields`', async () => {
    const reply: any = await dispatchQuery(
      'worked-times.list',
      { filter: { noExiste: 1 } },
      Q_EXTERNAL
    );

    // La gramática es LA MISMA para las tres clases. NUNCA `success` con `items: []`.
    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.field.should.equal('filter');
  });
});
