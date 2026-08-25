import 'mocha';
import 'should';
import * as sinon from 'sinon';
import { Client, Objective, ObjectiveActivity } from '@jiku/models';
import { readDb } from '../../src/models/read';
import { dispatch, dispatchQuery } from '../helpers/dispatch';
import {
  CREATOR,
  PERSON_ACTIVE,
  PERSON_INACTIVE,
  PROJECT_MAIN,
  PROJECT_OTHER,
  REQUIREMENT,
  assignPerson,
  createComments,
  createTasks,
  createWorld,
  destroyWorld,
  subscribe,
} from './task-fixtures';

/**
 * `tasks.list` y `tasks.get` contra la base real, ENTRANDO POR EL DESPACHADOR.
 *
 * Es la convención `testing` de `core` y no una preferencia: un test que llame al `execute` de la
 * consulta se saltea la compuerta de autorización, la validación y el envelope, o sea todo lo que
 * hace que la respuesta sea un CONTRATO y no el retorno de una función.
 */

const PROJECT_BULK = 14;
const PROJECT_COUNT = 15;
const PROJECT_PRIORITY = 16;

interface Page {
  items: Record<string, any>[];
  page: { limit: number; returned: number; cursor?: string; total?: number };
}

const ids = (items: Record<string, any>[]): number[] => items.map((item) => item.id);

describe('queries/tasks — el contrato del recurso', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN, PROJECT_OTHER, PROJECT_BULK, PROJECT_COUNT, PROJECT_PRIORITY]);

    await createTasks([
      // El conjunto curado del proyecto principal.
      {
        id: 8140,
        title: 'Tarea base',
        description: 'Descripción base',
        state: 'backlog',
        priority: 2,
        createdAt: '2026-08-05T00:00:00.000Z',
        estimatedFinishDate: '2026-09-01',
      },
      {
        id: 8141,
        title: 'Refactor del motor',
        description: 'nada',
        state: 'activo',
        priority: 4,
        requirementId: REQUIREMENT,
        createdAt: '2026-08-06T00:00:00.000Z',
      },
      {
        id: 8142,
        title: 'Otra',
        description: 'toca el motor',
        state: 'activo',
        priority: 1,
        createdAt: '2026-08-07T00:00:00.000Z',
      },
      {
        id: 8143,
        title: 'Finalizada vieja',
        state: 'finalizado',
        createdAt: '2026-08-02T00:00:00.000Z',
        finishedAt: '2026-08-10T00:00:00.000Z',
      },
      {
        id: 8144,
        title: 'Finalizada nueva',
        state: 'finalizado',
        priority: 3,
        createdAt: '2026-08-03T00:00:00.000Z',
        finishedAt: '2026-08-20T00:00:00.000Z',
      },
      {
        id: 8145,
        title: 'Cancelada',
        state: 'cancelado',
        visibilityLevel: 'internal',
        createdAt: '2026-08-04T00:00:00.000Z',
      },
      {
        id: 8146,
        title: 'En revisión',
        state: 'en_revision',
        priority: 2,
        createdAt: '2026-07-25T00:00:00.000Z',
      },
      // El par EMPATADO en `createdAt`: es lo que ejercita el desempate por `id`.
      { id: 8150, title: 'Empate A', createdAt: '2026-08-08T00:00:00.000Z' },
      { id: 8151, title: 'Empate B', createdAt: '2026-08-08T00:00:00.000Z' },
      // Relaciones de colección.
      { id: 8160, title: 'Con 25 comentarios', createdAt: '2026-07-20T00:00:00.000Z' },
      { id: 8161, title: 'Con 3 comentarios', createdAt: '2026-07-19T00:00:00.000Z' },
      { id: 8180, title: 'Con responsables', createdAt: '2026-07-18T00:00:00.000Z' },
      { id: 8190, title: 'Sin requisito', createdAt: '2026-07-17T00:00:00.000Z' },
      // Otro proyecto: tiene que quedar afuera de todo filtro por `projectId: 12`.
      {
        id: 8200,
        title: 'De otro proyecto',
        projectId: PROJECT_OTHER,
        state: 'activo',
        createdAt: '2026-08-09T00:00:00.000Z',
      },
      { id: 8201, title: 'De otro proyecto 2', projectId: PROJECT_OTHER },
      // Prioridades, una por entero, incluido el 5 que la api aceptaba.
      { id: 8170, title: 'P5', projectId: PROJECT_PRIORITY, priority: 5 },
      { id: 8171, title: 'P2', projectId: PROJECT_PRIORITY, priority: 2 },
      { id: 8172, title: 'P0', projectId: PROJECT_PRIORITY, priority: 0 },
      { id: 8173, title: 'P1', projectId: PROJECT_PRIORITY, priority: 1 },
      { id: 8174, title: 'P3', projectId: PROJECT_PRIORITY, priority: 3 },
      { id: 8175, title: 'P4', projectId: PROJECT_PRIORITY, priority: 4 },
    ]);

    // 250 tareas para las reglas de `page.limit`, y 128 para el `count`.
    await createTasks(
      Array.from({ length: 250 }, (_, index) => ({
        id: 9000 + index,
        title: `Bulk ${String(index).padStart(3, '0')}`,
        projectId: PROJECT_BULK,
      }))
    );
    await createTasks(
      Array.from({ length: 128 }, (_, index) => ({
        id: 9500 + index,
        title: `Count ${index}`,
        projectId: PROJECT_COUNT,
      }))
    );

    await createComments(8160, 25);
    await createComments(8161, 3);
    await assignPerson(8180, PERSON_ACTIVE, { isLeader: true, active: true });
    // La misma persona en las cuatro que TS-9 discrimina: dos activas, una finalizada nueva y una
    // finalizada vieja. Es lo que hace que el `or` tenga algo que dejar afuera.
    for (const taskId of [8141, 8142, 8143, 8144]) {
      await assignPerson(taskId, PERSON_ACTIVE, { isLeader: false, active: true });
    }
    await assignPerson(8180, PERSON_INACTIVE, { isLeader: false, active: false });
    await subscribe(8180);
  });

  after(async () => {
    await destroyWorld();
  });

  afterEach(() => sinon.restore());

  describe('CA-1 · los endpoints dejan de responder unknown_command', () => {
    it('TS-1 · `tasks.list` responde el contrato', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {});

      reply.status.should.equal('success');
      reply.data!.items.should.be.an.Array();
      reply.data!.page.limit.should.equal(50);
      (reply.errorCode === undefined).should.be.true();
    });

    it('TS-2 · los otros cuatro SIGUEN en `pendingContract`', async () => {
      // `projects` llega con S-024 y `comments` con S-025. `pending.ts` no se elimina en S-022.
      for (const [method, payload] of [
        ['projects.list', {}],
        ['projects.get', { id: 1 }],
        ['comments.list', {}],
        ['comments.get', { id: 1 }],
      ] as [string, unknown][]) {
        const reply = await dispatchQuery(method, payload);

        reply.status.should.equal('failure', method);
        reply.errorCode!.should.equal('unknown_command', method);
        reply.errorMessage!.should.containEql('todavía no tiene contrato definido');
      }
    });
  });

  describe('CA-2, CA-3 · los seis operadores del filtro', () => {
    it('TS-3 · AND, `IN` y rango combinados', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: {
          projectId: PROJECT_MAIN,
          state: ['backlog', 'activo'],
          createdAt: { gte: '2026-08-01T00:00:00.000Z' },
        },
      });

      reply.status.should.equal('success');
      reply.data!.items.length.should.be.above(0);
      for (const item of reply.data!.items) {
        item.projectId.should.equal(PROJECT_MAIN);
        ['backlog', 'activo'].should.containEql(item.state);
        new Date(item.createdAt).getTime().should.be.aboveOrEqual(
          new Date('2026-08-01T00:00:00.000Z').getTime()
        );
      }
      // Ni el otro proyecto ni las finalizadas.
      ids(reply.data!.items).should.not.containEql(8200);
      ids(reply.data!.items).should.not.containEql(8144);
    });

    it('TS-4 · igualdad simple', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_MAIN, state: 'activo' },
      });

      reply.data!.items.length.should.be.above(0);
      reply.data!.items.forEach((item) => item.state.should.equal('activo'));
    });

    it('TS-5 · `null` significa IS NULL', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_MAIN, requirementId: null },
      });

      reply.data!.items.forEach((item) => (item.requirementId === null).should.be.true());
      // La única con requisito no aparece.
      ids(reply.data!.items).should.not.containEql(8141);
    });

    it('TS-6 · `{not}` significa distinto', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_MAIN, state: { not: 'cancelado' } },
      });

      reply.data!.items.forEach((item) => item.state.should.not.equal('cancelado'));
      ids(reply.data!.items).should.not.containEql(8145);
      ids(reply.data!.items).should.containEql(8140);
    });

    it('TS-7 · `gt` y `lt` son COMBINABLES en el mismo objeto', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: {
          projectId: PROJECT_MAIN,
          createdAt: { gt: '2026-08-02T00:00:00.000Z', lt: '2026-08-06T00:00:00.000Z' },
        },
      });

      ids(reply.data!.items).sort().should.deepEqual([8140, 8144, 8145]);
      // El extremo exacto NO entra: `gt` es estricto.
      ids(reply.data!.items).should.not.containEql(8143);
    });

    it('TS-8 · `q` busca sobre `title` Y `description`', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_MAIN, q: 'motor' },
      });

      // 8141 lo tiene en el título, 8142 en la descripción.
      ids(reply.data!.items).sort().should.deepEqual([8141, 8142]);
    });

    it('TS-9 · `filter.or` de un nivel, combinado con AND contra el resto', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: {
          // El AND de afuera es un filtro POR SUBCONSULTA, que es el caso difícil: el grupo del
          // `or` tiene que quedar parentizado contra él y no absorberlo.
          responsiblePersonId: PERSON_ACTIVE,
          or: [
            { state: 'activo' },
            { state: 'finalizado', finishedAt: { gt: '2026-08-16T00:00:00.000Z' } },
          ],
        },
      });

      // Las dos activas y la finalizada NUEVA. Quedan afuera la finalizada VIEJA (8143, también
      // asignada a la persona 77) y la backlog 8180, que no matchea ninguna rama del `or`.
      ids(reply.data!.items).sort().should.deepEqual([8141, 8142, 8144]);
    });

    it('TS-56 · `responsiblePersonId` filtra IGNORANDO `active: false`', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { responsiblePersonId: PERSON_INACTIVE },
      });

      // La asignación está inactiva y la tarea SÍ aparece: buscar "las tareas de fulano" tiene
      // que encontrar también las que ya no tiene asignadas.
      ids(reply.data!.items).should.containEql(8180);
    });
  });

  describe('CA-5, CA-6, CA-21 · el orden', () => {
    it('TS-11 · sin `sort`, default de la ficha y desempate por `id` DESC', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_MAIN },
      });

      const items = reply.data!.items;
      // Primero lo que el escenario dice primero: el orden es `createdAt` DESCENDENTE.
      for (let index = 1; index < items.length; index += 1) {
        new Date(items[index - 1].createdAt)
          .getTime()
          .should.be.aboveOrEqual(new Date(items[index].createdAt).getTime());
      }

      const order = ids(items);
      // Entre las dos empatadas en `createdAt`, la de id mayor va primero.
      order.indexOf(8151).should.be.below(order.indexOf(8150));

      // Y el orden es ESTABLE entre dos corridas idénticas.
      const again = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_MAIN },
      });
      ids(again.data!.items).should.deepEqual(order);
    });

    it('TS-12 · `sort` explícito, en orden y con dirección', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_MAIN },
        sort: ['-priority', 'title'],
      });

      const items = reply.data!.items;
      for (let index = 1; index < items.length; index += 1) {
        const previous = items[index - 1];
        const current = items[index];
        previous.priorityValue.should.be.aboveOrEqual(current.priorityValue);
        if (previous.priorityValue === current.priorityValue) {
          (previous.title <= current.title).should.be.true(
            `${previous.title} <= ${current.title}`
          );
        }
      }
    });

    it('TS-40 · `-priority` ordena por la COLUMNA NUMÉRICA, no por el nombre del enum', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_PRIORITY },
        sort: ['-priority'],
      });

      // El orden alfabético de los nombres sería `urgente, sin_prioridad, media, baja, alta`.
      reply.data!.items.map((item) => item.priorityValue).should.deepEqual([5, 4, 3, 2, 1, 0]);
    });

    it('TS-13 · `estimatedFinishDate` no es ordenable, con el `errorDetails` exacto', async () => {
      const reply = await dispatchQuery('tasks.list', { sort: ['estimatedFinishDate'] });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
      reply.errorDetails!.should.deepEqual({
        field: 'sort',
        value: 'estimatedFinishDate',
        allowed: ['title', 'state', 'priority', 'finishedAt', 'createdAt', 'updatedAt'],
      });
    });
  });

  describe('CA-8, CA-9, CA-10 · el conjunto devuelto', () => {
    it('TS-14 · el conjunto base EXACTO cuando no se pide nada', async () => {
      const reply = await dispatchQuery<Record<string, any>>('tasks.get', { id: 8140 });

      reply.status.should.equal('success');
      Object.keys(reply.data!).sort().should.deepEqual([
        'area',
        'createdAt',
        'createdBy',
        'estimatedFinishDate',
        'finishedAt',
        'id',
        'priority',
        'priorityValue',
        'projectId',
        'requirementId',
        'state',
        'title',
        'updatedAt',
        'visibilityLevel',
      ]);
    });

    it('TS-15 · `( fields ?? base ) ∪ include ∪ { id }`, con `id` aunque no se lo pida', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_MAIN },
        fields: ['title', 'project'],
        include: ['description'],
      });

      for (const item of reply.data!.items) {
        Object.keys(item).sort().should.deepEqual(['description', 'id', 'project', 'title']);
      }
    });

    it('TS-16 · `comments` acotada a 10 y MARCADA', async () => {
      const many = await dispatchQuery<Record<string, any>>('tasks.get', {
        id: 8160,
        include: ['comments'],
      });

      many.data!.comments.length.should.equal(10);
      many.data!.commentsTruncated.should.be.true();

      // LOS 10 MÁS RECIENTES, no diez cualesquiera devueltos en orden: se comparan contra los 10
      // ids más altos de los 25 que existen. Sin esta comparación, una implementación que
      // devolviera los 10 MÁS VIEJOS ordenados descendentemente pasaría igual.
      const commentIds = many.data!.comments.map((comment: any) => comment.id);
      const newest = (
        await ObjectiveActivity.findAll({
          where: { objectiveId: 8160 },
          order: [['createdAt', 'DESC'], ['id', 'DESC']],
          limit: 10,
        })
      ).map((row) => row.id);
      commentIds.should.deepEqual(newest);
      // Y vienen en el orden de la ficha: `created_at DESC, id DESC`.
      commentIds.should.deepEqual([...commentIds].sort((a: number, b: number) => b - a));
      // Y la traducción de vocabulario: `new_value` es `body`, `changed_by` es `authorId`.
      many.data!.comments[0].body.should.startWith('Comentario ');
      many.data!.comments[0].authorId.should.equal(CREATOR);

      const few = await dispatchQuery<Record<string, any>>('tasks.get', {
        id: 8161,
        include: ['comments'],
      });
      few.data!.comments.length.should.equal(3);
      few.data!.commentsTruncated.should.be.false();
    });

    it('TS-56 · `responsiblePersons` devuelve SOLO los `active = true`', async () => {
      const reply = await dispatchQuery<Record<string, any>>('tasks.get', {
        id: 8180,
        include: ['responsiblePersons'],
      });

      // La otra regla de `active`, la opuesta a la del filtro. Parece un bug y no lo es.
      reply.data!.responsiblePersons.should.deepEqual([
        { id: PERSON_ACTIVE, firstName: 'Ana', lastName: 'Pérez', isLeader: true },
      ]);
    });

    it('`subscriptors` es una lista de escalares', async () => {
      const reply = await dispatchQuery<Record<string, any>>('tasks.get', {
        id: 8180,
        include: ['subscriptors'],
      });

      reply.data!.subscriptors.should.deepEqual([CREATOR]);
    });

    it('TS-57 · relación 1:1 con FK nula: `null`, y la tarea se devuelve igual', async () => {
      const reply = await dispatchQuery<Record<string, any>>('tasks.get', {
        id: 8190,
        include: ['requirement', 'project'],
      });

      reply.status.should.equal('success');
      (reply.data!.requirement === null).should.be.true();
      reply.data!.project.should.deepEqual({
        id: PROJECT_MAIN,
        name: 'Portal Jiku',
        code: 'PJK',
        status: 'activo',
      });
    });

    it('la relación 1:1 presente trae sus campos declarados', async () => {
      const reply = await dispatchQuery<Record<string, any>>('tasks.get', {
        id: 8141,
        include: ['requirement'],
      });

      reply.data!.requirement.should.deepEqual({
        id: REQUIREMENT,
        title: 'Requisito A',
        state: 'analisis',
      });
    });

    it('TS-17 · el número de consultas NO depende de la cantidad de items', async () => {
      const spy = sinon.spy(readDb, 'query');

      await dispatchQuery('tasks.list', {
        filter: { projectId: PROJECT_BULK },
        page: { limit: 5 },
        include: ['project', 'responsiblePersons'],
      });
      const withFive = spy.callCount;

      spy.resetHistory();
      await dispatchQuery('tasks.list', {
        filter: { projectId: PROJECT_BULK },
        page: { limit: 200 },
        include: ['project', 'responsiblePersons'],
      });
      const withTwoHundred = spy.callCount;

      // Una constante, no una función de la cantidad de items: JOIN para las 1:1 y UNA consulta
      // por lote para las de colección (RF-36).
      withTwoHundred.should.equal(withFive);
      withTwoHundred.should.be.belowOrEqual(4);
    });

    it('TS-58 · `ticketSlug` no se expone ni se acepta como filtro', async () => {
      const rejected = await dispatchQuery('tasks.list', { filter: { ticketSlug: 'X' } });
      rejected.status.should.equal('failure');
      rejected.errorCode!.should.equal('invalid_fields');

      const reply = await dispatchQuery<Record<string, any>>('tasks.get', { id: 8140 });
      reply.data!.should.not.have.property('ticketSlug');
    });
  });

  describe('CA-16, CA-13 · página y límites', () => {
    it('TS-23 · sin `page.limit` se usan 50', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_BULK },
      });

      reply.data!.items.length.should.equal(50);
      reply.data!.page.limit.should.equal(50);
      (reply.data!.page.cursor === undefined).should.be.false();
    });

    it('TS-24 · `limit: 0` significa "usá el default"', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_BULK },
        page: { limit: 0 },
      });

      reply.data!.page.limit.should.equal(50);
    });

    it('TS-25 · `limit: 500` se recorta a 200 SIN AVISAR', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_BULK },
        page: { limit: 500 },
      });

      // `success`, no un `failure`: el valor efectivo viaja en `page.limit`.
      reply.status.should.equal('success');
      reply.data!.items.length.should.equal(200);
      reply.data!.page.limit.should.equal(200);
    });

    it('TS-19 · la última página no trae cursor', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_OTHER },
        page: { limit: 50 },
      });

      reply.data!.items.length.should.equal(2);
      reply.data!.page.returned.should.equal(2);
      (reply.data!.page.cursor === undefined).should.be.true();
    });

    it('TS-26, TS-27 · límite negativo y no entero se rechazan', async () => {
      const negative = await dispatchQuery('tasks.list', { page: { limit: -1 } });
      negative.errorCode!.should.equal('invalid_fields');
      negative.errorDetails!.field!.should.equal('page.limit');
      negative.errorDetails!.value!.should.equal(-1);

      const fractional = await dispatchQuery('tasks.list', { page: { limit: 10.5 } });
      fractional.errorCode!.should.equal('invalid_fields');
      fractional.errorDetails!.field!.should.equal('page.limit');
    });
  });

  describe('CA-17, CA-18 · el cursor', () => {
    async function firstPage(filter: unknown, limit = 2): Promise<Page> {
      const reply = await dispatchQuery<Page>('tasks.list', { filter, page: { limit } });
      reply.status.should.equal('success');
      return reply.data!;
    }

    it('TS-28 · un cursor reusado con OTRO filtro se rechaza', async () => {
      const page = await firstPage({ projectId: PROJECT_MAIN });

      const reply = await dispatchQuery('tasks.list', {
        filter: { projectId: PROJECT_OTHER },
        page: { limit: 2, cursor: page.page.cursor },
      });

      reply.errorCode!.should.equal('invalid_cursor');
    });

    it('TS-29, TS-30 · un cursor malformado o de otra versión se rechaza, sin internal_error', async () => {
      const garbage = await dispatchQuery('tasks.list', {
        page: { cursor: 'no-es-base64url-####' },
      });
      garbage.errorCode!.should.equal('invalid_cursor');

      const otherVersion = Buffer.from(
        JSON.stringify({ v: 99, k: ['2026-08-01T00:00:00.000Z', 1], h: 'loquesea' }),
        'utf8'
      ).toString('base64url');
      const wrong = await dispatchQuery('tasks.list', { page: { cursor: otherVersion } });
      wrong.errorCode!.should.equal('invalid_cursor');
    });

    it('TS-31 · cambiar SOLO el `limit` entre páginas es válido', async () => {
      const page = await firstPage({ projectId: PROJECT_MAIN });

      const next = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_MAIN },
        page: { limit: 5, cursor: page.page.cursor },
      });

      next.status.should.equal('success');
      next.data!.items.length.should.be.above(0);
      for (const id of ids(next.data!.items)) {
        ids(page.items).should.not.containEql(id);
      }
    });

    it('TS-32 · reordenar las claves del MISMO filtro no invalida el cursor', async () => {
      const page = await firstPage({ projectId: PROJECT_MAIN, state: 'activo' });

      const next = await dispatchQuery<Page>('tasks.list', {
        filter: { state: 'activo', projectId: PROJECT_MAIN },
        page: { limit: 2, cursor: page.page.cursor },
      });

      next.status.should.equal('success');
    });

    it('TS-33 · los filtros se REAPLICAN en cada página: el cursor no congela nada', async () => {
      const page = await firstPage({ projectId: PROJECT_MAIN, state: 'activo' }, 1);
      const remaining = ids(page.items);

      // La que habría caído en la página siguiente deja de matchear el filtro.
      await Objective.update({ state: 'cancelado' }, { where: { id: 8141 }, silent: true });
      try {
        const next = await dispatchQuery<Page>('tasks.list', {
          filter: { projectId: PROJECT_MAIN, state: 'activo' },
          page: { limit: 5, cursor: page.page.cursor },
        });

        remaining.should.not.containEql(8141);
        ids(next.data!.items).should.not.containEql(8141);
      } finally {
        await Objective.update({ state: 'activo' }, { where: { id: 8141 }, silent: true });
      }
    });
  });

  describe('CA-19 · `count` y sus tres valores', () => {
    it('TS-34 · ausente no calcula total', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_COUNT },
      });

      (reply.data!.page.total === undefined).should.be.true();
      reply.data!.items.should.be.an.Array();
    });

    it('TS-35 · `true` devuelve items Y total exacto', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_COUNT },
        page: { limit: 50 },
        count: true,
      });

      reply.data!.items.length.should.equal(50);
      reply.data!.page.total!.should.equal(128);
    });

    it('TS-36 · `"only"` NO ejecuta la consulta de filas', async () => {
      const spy = sinon.spy(readDb, 'query');

      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_COUNT },
        count: 'only',
      });

      reply.data!.items.should.deepEqual([]);
      reply.data!.page.total!.should.equal(128);
      (reply.data!.page.cursor === undefined).should.be.true();
      // UNA sola consulta, y es un COUNT: ningún SQL lleva LIMIT.
      spy.callCount.should.equal(1);
      String(spy.firstCall.args[0]).should.containEql('COUNT(*)');
      String(spy.firstCall.args[0]).should.not.containEql('LIMIT');
    });
  });

  describe('CA-20, CA-21, CA-29 · traducción y SQL', () => {
    it('TS-37 · el SQL dice `objectives` y la respuesta dice `tasks`', async () => {
      const spy = sinon.spy(readDb, 'query');

      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_MAIN },
      });

      const sql = String(spy.firstCall.args[0]);
      sql.should.containEql('FROM objectives');
      sql.should.not.containEql('tasks');
      // Y la respuesta usa los nombres del contrato, no los de la base.
      reply.data!.items[0].should.have.property('projectId');
      reply.data!.items[0].should.have.property('createdAt');
      reply.data!.items[0].should.not.have.property('project_id');
      reply.data!.items[0].should.not.have.property('created_at');
    });

    it('TS-38 · `priority` va doble y el 5 no se pierde', async () => {
      const urgent = await dispatchQuery<Record<string, any>>('tasks.get', { id: 8170 });
      urgent.data!.priority.should.equal('urgente');
      urgent.data!.priorityValue.should.equal(5);

      const media = await dispatchQuery<Record<string, any>>('tasks.get', { id: 8171 });
      media.data!.priority.should.equal('media');
      media.data!.priorityValue.should.equal(2);
    });

    it('TS-39 · filtrar acepta las DOS formas, y no significan lo mismo', async () => {
      const byName = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_PRIORITY, priority: 'urgente' },
      });
      // El 4 y el 5: los dos se LEEN `urgente`.
      ids(byName.data!.items).sort().should.deepEqual([8170, 8175]);

      const byValue = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_PRIORITY, priorityValue: 5 },
      });
      ids(byValue.data!.items).should.deepEqual([8170]);
    });

    it('TS-52 · un valor hostil viaja en `replacements` y la tabla sigue en pie', async () => {
      const spy = sinon.spy(readDb, 'query');
      const hostile = "O'Brien; DROP TABLE objectives;--";

      const reply = await dispatchQuery<Page>('tasks.list', { filter: { q: hostile } });

      reply.status.should.equal('success');
      reply.data!.items.should.deepEqual([]);
      String(spy.firstCall.args[0]).should.not.containEql(hostile);
      JSON.stringify((spy.firstCall.args[1] as any).replacements).should.containEql('DROP TABLE');
      // Y la tabla existe: si la inyección hubiera pasado, esto reventaría.
      (await Objective.count()).should.be.above(0);
    });
  });

  describe('CA-22, CA-23 · nombres y identidad', () => {
    it('TS-41 · un nombre inventado en `filter` NO devuelve datos', async () => {
      const reply = await dispatchQuery('tasks.list', { filter: { nombreInventado: 1 } });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
      reply.errorDetails!.field!.should.equal('filter');
      reply.errorDetails!.value!.should.equal('nombreInventado');
      (reply.data === undefined).should.be.true();
    });

    it('TS-42, TS-43, TS-44 · lo mismo en `sort`, `fields` e `include`', async () => {
      for (const [lever, payload] of [
        ['sort', { sort: ['nombreInventado'] }],
        ['fields', { fields: ['id', 'nombreInventado'] }],
        ['include', { include: ['nombreInventado'] }],
      ] as [string, unknown][]) {
        const reply = await dispatchQuery('tasks.list', payload);

        reply.errorCode!.should.equal('invalid_fields', lever);
        reply.errorDetails!.field!.should.equal(lever, lever);
        reply.errorDetails!.value!.should.equal('nombreInventado', lever);
        (reply.errorDetails!.allowed as string[]).should.not.containEql('nombreInventado');
      }
    });

    it('TS-45 · un campo de identidad en el payload se rechaza', async () => {
      const onList = await dispatchQuery('tasks.list', {
        userId: CREATOR,
        filter: { projectId: PROJECT_MAIN },
      });
      onList.errorCode!.should.equal('invalid_fields');
      onList.errorDetails!.value!.should.equal('userId');

      const onGet = await dispatchQuery('tasks.get', { id: 8140, caller: CREATOR });
      onGet.errorCode!.should.equal('invalid_fields');
      onGet.errorDetails!.value!.should.equal('caller');
    });
  });

  describe('CA-24, CA-25, CA-26 · la forma `get` y el vacío', () => {
    it('TS-46 · `get` sin `id`', async () => {
      const reply = await dispatchQuery('tasks.get', {});

      reply.errorCode!.should.equal('invalid_fields');
      reply.errorDetails!.field!.should.equal('id');
    });

    it('TS-47 · `get` con las palancas de `list`', async () => {
      for (const [lever, payload] of [
        ['filter', { id: 8140, filter: { state: 'activo' } }],
        ['sort', { id: 8140, sort: ['title'] }],
        ['page', { id: 8140, page: { limit: 10 } }],
        ['count', { id: 8140, count: true }],
      ] as [string, unknown][]) {
        const reply = await dispatchQuery('tasks.get', payload);

        reply.errorCode!.should.equal('invalid_fields', lever);
        reply.errorDetails!.value!.should.equal(lever, lever);
      }
    });

    it('TS-48 · `get` de un id inexistente responde `task_not_found`', async () => {
      const reply = await dispatchQuery('tasks.get', { id: 999999 });

      reply.status.should.equal('failure');
      // El código NUEVO de S-020. `objective_not_found` se queda en los comandos.
      reply.errorCode!.should.equal('task_not_found');
      reply.errorCode!.should.not.equal('objective_not_found');
    });

    it('TS-49 · un `list` sin coincidencias NO es un error', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: 999999 },
      });

      reply.status.should.equal('success');
      reply.data!.items.should.deepEqual([]);
      reply.data!.page.returned.should.equal(0);
      (reply.data!.page.cursor === undefined).should.be.true();
      (reply.errorCode === undefined).should.be.true();
    });
  });

  describe('CA-28 · ADR-001 sigue intacto después de que el motor lee', () => {
    it('TS-51 · una escritura DESPUÉS de la consulta sigue saliendo por el usuario dueño', async () => {
      // EL TEST QUE MENOS PARECE NECESARIO Y EL QUE MÁS IMPORTA. Es el mismo criterio de CA-6 de
      // S-013, repetido acá porque ACÁ es donde empieza a haber SQL de verdad: si alguien
      // registrara los modelos en `readDb` para "usar el ORM que ya está ahí", las clases del
      // paquete se reasignarían y las escrituras saldrían por la conexión de solo lectura. No
      // fallaría hoy: fallaría el día del refactor, sin un solo síntoma.
      const query = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_MAIN },
      });
      query.status.should.equal('success');

      const command = await dispatch<{ id: number }>('clients.new', {
        name: 'Post-Query',
        description: 'x',
      });

      command.status.should.equal('success');
      command.data!.id.should.be.a.Number();
      const row = await Client.findByPk(command.data!.id);
      (row === null).should.be.false();
      await Client.destroy({ where: { id: command.data!.id } });

      // Y la conexión de lectura sigue SIN modelos registrados.
      Object.keys(readDb.models).length.should.equal(0);
    });
  });
});
