import 'mocha';
import 'should';
import { ErrorCode, Reply } from '@jiku/nats-protocol';
import { activitySpec } from '../../src/queries/activity/activity-spec';
import { CREATOR, PROJECT_MAIN, PROJECT_OTHER, createWorld, destroyWorld } from './task-fixtures';
import { dispatchQuery } from '../helpers/dispatch';
import { createDomainWorld, destroyDomainWorld } from './domain-fixtures';
import {
  MISSING_ID,
  REQ_MAIN,
  TASK_MAIN,
  createActivityTasks,
  createObjectiveActivity,
  createRequirementActivity,
  destroyActivityWorld,
} from './activity-fixtures';

/**
 * `activity.list` CONTRA BASE REAL, por el despachador (S-025).
 *
 * `activity` ES `comments` SIN EL PREDICADO DE TIPO: la misma tabla, las mismas dos variantes, el
 * mismo recorte — y sin `where`, así que devuelve CAMBIOS DE CAMPO **Y** COMENTARIOS.
 *
 * Lo propio de esta ficha es el enum de `type`: camelCase y DISTINTO POR ENTIDAD. Los dos enums
 * comparten seis valores de nueve, así que el 70% de los tests pasa igual con la validación mal
 * hecha: los que lo atrapan son LOS DOS CRUCES (TS-44 y TS-45).
 */

interface Collection {
  items: Record<string, unknown>[];
  page: { limit: number; returned: number; cursor?: string; total?: number };
}

function items(reply: Reply<Collection>): Record<string, unknown>[] {
  reply.status.should.equal('success', JSON.stringify(reply));
  return reply.data!.items;
}

function ids(reply: Reply<Collection>): number[] {
  return items(reply).map((item) => item.id as number);
}

function failed(reply: Reply<unknown>): Reply<unknown> {
  reply.status.should.equal('failure', JSON.stringify(reply));
  return reply;
}

const TASK_FILTER = { entityType: 'task', entityId: TASK_MAIN };

/** Los seis ids de la tarea: dos comentarios, tres `state` y un `title`. */
const A_COMMENT_1 = 7001;
const A_COMMENT_2 = 7002;
const A_STATE_1 = 7003;
const A_STATE_2 = 7004;
const A_STATE_3 = 7005;
const A_TITLE = 7006;

describe('queries/activity — el historial completo (S-025)', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN, PROJECT_OTHER]);
    await createDomainWorld();
    await createActivityTasks();

    await createObjectiveActivity([
      { id: A_COMMENT_1, objectiveId: TASK_MAIN, newValue: 'Primero', createdAt: '2026-01-01T00:00:00.000Z' },
      {
        id: A_STATE_1,
        objectiveId: TASK_MAIN,
        type: 'state',
        previousValue: 'backlog',
        newValue: 'activo',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      { id: A_COMMENT_2, objectiveId: TASK_MAIN, newValue: 'Segundo', createdAt: '2026-01-03T00:00:00.000Z' },
      {
        id: A_STATE_2,
        objectiveId: TASK_MAIN,
        type: 'state',
        previousValue: 'activo',
        newValue: 'revision',
        createdAt: '2026-01-04T00:00:00.000Z',
      },
      {
        id: A_STATE_3,
        objectiveId: TASK_MAIN,
        type: 'state',
        previousValue: 'revision',
        newValue: 'finalizado',
        createdAt: '2026-01-05T00:00:00.000Z',
      },
      {
        id: A_TITLE,
        objectiveId: TASK_MAIN,
        type: 'title',
        previousValue: 'Viejo',
        newValue: 'Nuevo',
        createdAt: '2026-01-06T00:00:00.000Z',
      },
    ]);

    await createRequirementActivity([
      {
        id: 7100,
        requirementId: REQ_MAIN,
        type: 'state',
        previousValue: 'analisis',
        newValue: 'desarrollo',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 7101,
        requirementId: REQ_MAIN,
        type: 'resolution',
        previousValue: '',
        newValue: 'resuelto',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
  });

  after(async () => {
    await destroyActivityWorld();
    await destroyDomainWorld();
    await destroyWorld();
  });

  it('TS-40 · devuelve cambios de campo **Y** comentarios', async () => {
    const reply = await dispatchQuery<Collection>('activity.list', { filter: TASK_FILTER });

    // ES `comments` SIN el predicado `type_of_activity = 'comment'`. Toda la diferencia entre los
    // dos recursos es una línea que esta ficha NO declara.
    ids(reply).should.deepEqual([
      A_COMMENT_1,
      A_STATE_1,
      A_COMMENT_2,
      A_STATE_2,
      A_STATE_3,
      A_TITLE,
    ]);
  });

  it('TS-41 · el conjunto base son los DIEZ campos declarados, y NO incluye `body`', async () => {
    const reply = await dispatchQuery<Collection>('activity.list', { filter: TASK_FILTER });

    Object.keys(items(reply)[0]).sort().should.deepEqual([
      'authorId',
      'createdAt',
      'entityId',
      'entityType',
      'id',
      'newValue',
      'previousValue',
      'type',
      'updatedAt',
      'visibilityLevel',
    ]);
    // `activity` NO traduce `new_value` a `body`: eso solo tiene sentido cuando la fila ES un
    // comentario, y esta ficha devuelve todo el historial.
    items(reply)[0].should.not.have.property('body');
    items(reply)[0].should.not.have.property('attachments');
  });

  it('TS-48 · traduce `previousValue`/`newValue`, `authorId` y `type`', async () => {
    const reply = await dispatchQuery<Collection>('activity.list', {
      filter: { ...TASK_FILTER, type: 'state' },
    });
    const first = items(reply)[0];

    first.previousValue!.should.equal('backlog');
    first.newValue!.should.equal('activo');
    first.authorId!.should.equal(CREATOR);
    first.type!.should.equal('state');
    for (const column of ['previous_value', 'new_value', 'changed_by', 'type_of_activity']) {
      first.should.not.have.property(column);
    }
  });

  it('TS-42 · `filter.type` acepta los valores del enum DE LA TAREA', async () => {
    for (const type of ['area', 'stageId', 'person']) {
      const reply = await dispatchQuery<Collection>('activity.list', {
        filter: { ...TASK_FILTER, type },
      });
      reply.status.should.equal('success', type);
    }
  });

  it('TS-43 · `filter.type` acepta los valores del enum DEL REQUISITO', async () => {
    for (const type of ['resolution', 'tag', 'type']) {
      const reply = await dispatchQuery<Collection>('activity.list', {
        filter: { entityType: 'requirement', entityId: REQ_MAIN, type },
      });
      reply.status.should.equal('success', type);
    }
  });

  it('TS-44 · EL ENUM CRUZADO: `area` con `entityType: "requirement"`', async () => {
    const error = failed(
      await dispatchQuery('activity.list', {
        filter: { entityType: 'requirement', entityId: REQ_MAIN, type: 'area' },
      })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('filter.type');
    error.errorDetails!.value!.should.equal('area');
    // EL ENUM DEL REQUISITO, no la unión de los dos: validar contra la unión aceptaría `area` y la
    // consulta devolvería `items: []` en vez de decir que el valor no vale para esa entidad.
    (error.errorDetails!.allowed as string[]).should.deepEqual([
      'state',
      'comment',
      'type',
      'priority',
      'estimatedFinishDate',
      'tag',
      'resolution',
      'title',
      'description',
    ]);
  });

  it('TS-45 · el enum cruzado en la OTRA dirección', async () => {
    for (const type of ['resolution', 'tag']) {
      const error = failed(
        await dispatchQuery('activity.list', { filter: { ...TASK_FILTER, type } })
      );
      error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS, type);
      (error.errorDetails!.allowed as string[]).should.deepEqual([
        'state',
        'area',
        'comment',
        'title',
        'person',
        'priority',
        'estimatedFinishDate',
        'description',
        'stageId',
      ]);
    }
  });

  it('TS-46 · los valores del enum son camelCase, no snake_case', async () => {
    const ok = await dispatchQuery<Collection>('activity.list', {
      filter: { ...TASK_FILTER, type: 'estimatedFinishDate' },
    });
    ok.status.should.equal('success');

    // Es la inconsistencia 7 del esquema: el resto de los enums del producto son snake_case.
    failed(
      await dispatchQuery('activity.list', {
        filter: { ...TASK_FILTER, type: 'estimated_finish_date' },
      })
    ).errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
  });

  it('TS-47 · `sort: ["id"]` no duplica el desempate, y el default es ascendente', async () => {
    const sorted = await dispatchQuery<Collection>('activity.list', {
      filter: TASK_FILTER,
      sort: ['id'],
      page: { limit: 2 },
    });
    sorted.status.should.equal('success');
    ids(sorted).should.deepEqual([A_COMMENT_1, A_COMMENT_2]);

    // `activity` SÍ declara `id` ordenable, así que el motor NO lo agrega otra vez: el cursor
    // transporta UNA SOLA clave de orden. Se mira adentro del cursor y no solo el resultado: con
    // el desempate duplicado la paginación TAMBIÉN funciona —`ORDER BY t.id ASC, t.id ASC` ordena
    // igual— y el bug solo se ve en la forma del cursor y en el SQL.
    const cursor = sorted.data!.page.cursor!;
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    decoded.k.length.should.equal(1);
    decoded.k[0].should.equal(A_COMMENT_2);
    const next = await dispatchQuery<Collection>('activity.list', {
      filter: TASK_FILTER,
      sort: ['id'],
      page: { limit: 2, cursor },
    });
    ids(next).should.deepEqual([A_STATE_1, A_STATE_2]);

    // Y sin `sort`, el primero es el MÁS VIEJO.
    const byDefault = await dispatchQuery<Collection>('activity.list', { filter: TASK_FILTER });
    ids(byDefault)[0].should.equal(A_COMMENT_1);
  });

  it('TS-49 · `activity` NO TIENE `get`: el patrón no está registrado', async () => {
    const error = failed(await dispatchQuery('activity.get', { id: 1 }));

    error.errorCode!.should.equal(ErrorCode.UNKNOWN_COMMAND);
    error.errorMessage!.should.containEql('activity.get');
  });

  it('TS-30 · `activity.list` SIN `filter.entityType`', async () => {
    const error = failed(await dispatchQuery('activity.list', { filter: { entityId: TASK_MAIN } }));

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('filter.entityType');
    (error.errorDetails!.allowed as string[]).should.deepEqual(['task', 'requirement']);
  });

  it('TS-75 · un filtro sin coincidencias devuelve `items: []`', async () => {
    const reply = await dispatchQuery<Collection>('activity.list', {
      filter: { entityType: 'requirement', entityId: MISSING_ID },
    });

    items(reply).should.deepEqual([]);
    reply.data!.page.returned.should.equal(0);
  });

  it('TS-76 · un nombre inventado en las cuatro palancas es `invalid_fields`', async () => {
    const payloads: unknown[] = [
      { filter: { ...TASK_FILTER, nombreInventado: 1 } },
      { filter: TASK_FILTER, sort: ['nombreInventado'] },
      { filter: TASK_FILTER, fields: ['nombreInventado'] },
      { filter: TASK_FILTER, include: ['nombreInventado'] },
    ];

    for (const payload of payloads) {
      failed(await dispatchQuery('activity.list', payload)).errorCode!.should.equal(
        ErrorCode.INVALID_FIELDS
      );
    }
  });

  it('`author` es incluible también acá, con los mismos tres campos y sin `email`', async () => {
    const reply = await dispatchQuery<Collection>('activity.list', {
      filter: TASK_FILTER,
      include: ['author'],
      page: { limit: 1 },
    });

    items(reply)[0].author!.should.deepEqual({
      id: CREATOR,
      name: 'Creador',
      username: 'creador-queries',
    });
  });
});

/** LA FICHA COMO DATO (TS-89, TS-94). No toca la base. */
describe('queries/activity — la ficha como dato (S-025)', () => {
  it('TS-89 · la ficha NO declara `where`: la ausencia ES la diferencia con `comments`', () => {
    (activitySpec.where === undefined).should.be.true();
    for (const value of Object.values(activitySpec.discriminator!.variants)) {
      (value.where === undefined).should.be.true();
    }
  });

  it('TS-94 · NO declara `notFoundCode` ni `notFoundMessage`: no tiene `get`', () => {
    (activitySpec.notFoundCode === undefined).should.be.true();
    (activitySpec.notFoundMessage === undefined).should.be.true();
  });

  it('TS-94 · los cuatro arrays de nombres se derivan de sus mapas', () => {
    [...activitySpec.baseNames].should.deepEqual(Object.keys(activitySpec.base));
    [...activitySpec.includableNames].should.deepEqual(Object.keys(activitySpec.includable));
    [...activitySpec.filterableNames].should.deepEqual(Object.keys(activitySpec.filterable));
    [...activitySpec.sortableNames].should.deepEqual(['createdAt', 'id']);
  });

  it('los dos enums de `type`, VALOR POR VALOR contra el DBML', () => {
    // Se copian literales del DBML porque son valores de una columna `ENUM` de PostgreSQL: un
    // valor mal escrito no falla al compilar, falla en la base.
    const task = activitySpec.discriminator!.variants.task.enums!.type;
    const requirement = activitySpec.discriminator!.variants.requirement.enums!.type;

    [...task].should.deepEqual([
      'state',
      'area',
      'comment',
      'title',
      'person',
      'priority',
      'estimatedFinishDate',
      'description',
      'stageId',
    ]);
    [...requirement].should.deepEqual([
      'state',
      'comment',
      'type',
      'priority',
      'estimatedFinishDate',
      'tag',
      'resolution',
      'title',
      'description',
    ]);
    // Nueve y nueve, con SEIS compartidos: es lo que hace que validar contra la unión pase el 70%
    // de los tests.
    task.length.should.equal(9);
    requirement.length.should.equal(9);
  });

  it('`truncatable` cubre las dos columnas TEXT sin cota (decisión documentada)', () => {
    [...activitySpec.truncatable].should.deepEqual(['previousValue', 'newValue']);
  });
});
