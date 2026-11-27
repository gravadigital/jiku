import 'mocha';
import 'should';
import { Reply } from '@jiku/nats-protocol';
import { getTrustedPublisherId } from '../../src/config';
import { dispatchQuery } from '../helpers/dispatch';
import {
  CREATOR,
  PERSON_ACTIVE,
  PERSON_INACTIVE,
  PROJECT_MAIN,
  PROJECT_OTHER,
  createWorld,
  destroyWorld,
} from './task-fixtures';
import {
  FILE_MAIN,
  MISSING_ID,
  getFileMainId,
  REQ_MAIN,
  REQ_NUMERIC,
  REQ_OTHER,
  REQ_TAGGED_BOTH,
  REQ_TAGGED_ONE,
  createDomainWorld,
  destroyDomainWorld,
} from './domain-fixtures';

/**
 * `requirements.list` y `requirements.get` CONTRA BASE REAL, por el despachador.
 *
 * Es la ficha que ejercita LAS CUATRO EXTENSIONES DEL MOTOR a la vez: el campo calculado, el
 * filtro de contención, el desvío numérico de `q` y el desempate por `id` que no se duplica.
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

describe('queries/requirements — el contrato del recurso (S-024)', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN, PROJECT_OTHER]);
    await createDomainWorld();
  });

  after(async () => {
    await destroyDomainWorld();
    await destroyWorld();
  });

  /* ------------------------------------------------------------------------------------------
   * El conjunto base, los enums y los incluibles
   * ---------------------------------------------------------------------------------------- */

  it('TS-16 · CA-8 · el conjunto base son doce campos y `priority` viaja como NOMBRE', async () => {
    const reply = await dispatchQuery<Collection>('requirements.list', {});

    Object.keys(items(reply)[0]).sort().should.deepEqual([
      'createdAt',
      'createdBy',
      'estimatedFinishDate',
      'id',
      'priority',
      'projectId',
      'state',
      'tags',
      'title',
      'type',
      'updatedAt',
      'visibilityLevel',
    ]);
    // El más nuevo primero (`-createdAt`), y la prioridad como STRING y no como número.
    items(reply)[0].id!.should.equal(REQ_MAIN);
    items(reply)[0].priority!.should.equal('alta');
    (typeof items(reply)[0].priority).should.equal('string');
  });

  it('TS-17 · CA-8 · `priorityValue` NO EXISTE en este recurso', async () => {
    const reply = await dispatchQuery('requirements.list', { fields: ['priorityValue'] });

    reply.status.should.equal('failure');
    reply.errorCode!.should.equal('invalid_fields');
    reply.errorDetails!.field!.should.equal('fields');
    reply.errorDetails!.value!.should.equal('priorityValue');
  });

  it('TS-18 · CA-8 · `estimatedFinishDate` SÍ es ordenable acá, y en `tasks` NO', async () => {
    const here = await dispatchQuery<Collection>('requirements.list', {
      sort: ['estimatedFinishDate'],
    });
    const there = await dispatchQuery('tasks.list', { sort: ['estimatedFinishDate'] });

    here.status.should.equal('success');
    // El contraste, en el mismo `it`: allá la columna es `VARCHAR` y por eso no se declara.
    there.status.should.equal('failure');
    there.errorCode!.should.equal('invalid_fields');
  });

  it('TS-19 · CA-7 · con la columna en NULL, `tags` es `[]` y no `null`', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('requirements.get', {
      id: REQ_OTHER,
    });

    reply.data!.tags!.should.deepEqual([]);
  });

  it('TS-20 · CA-12 · los once campos de texto y de ciclo de vida son INCLUIBLES', async () => {
    const names = [
      'description',
      'scope',
      'technicalSolution',
      'acceptanceCriteria',
      'resolutionComment',
      'resolutionType',
      'resolutionConclusion',
      'scheduledAt',
      'inProgressAt',
      'inReviewAt',
      'finishedAt',
    ];
    const included = await dispatchQuery<Record<string, unknown>>('requirements.get', {
      id: REQ_MAIN,
      include: names,
    });
    const plain = await dispatchQuery<Record<string, unknown>>('requirements.get', { id: REQ_MAIN });

    for (const name of names) {
      included.data!.should.have.property(name);
      plain.data!.should.not.have.property(name);
    }
  });

  /* ------------------------------------------------------------------------------------------
   * Las cuatro colecciones, por lote
   * ---------------------------------------------------------------------------------------- */

  it('TS-21 · `responsiblePersons` viene por lote, con sus cuatro campos', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('requirements.get', {
      id: REQ_MAIN,
      include: ['responsiblePersons'],
    });

    reply.data!.responsiblePersons!.should.deepEqual([
      { id: PERSON_ACTIVE, firstName: 'Ana', lastName: 'Pérez', isLeader: true },
      { id: PERSON_INACTIVE, firstName: 'Beto', lastName: 'Gómez', isLeader: false },
    ]);
  });

  it('TS-22 · `subscriptors` es una lista de ESCALARES, no de objetos', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('requirements.get', {
      id: REQ_MAIN,
      include: ['subscriptors'],
    });

    // LOS DOS IDS SON LOS DEL FIXTURE, no los de un caller de consulta: `requirement_subscriptors`
    // tiene FK a `users.id`, y los únicos usuarios que `createWorld()` garantiza son el creador y
    // el publicador confiable. Lo que el escenario verifica —que la lista sea de ESCALARES y no de
    // objetos, y en el orden de la relación— no depende de QUIÉNES sean.
    reply.data!.subscriptors!.should.deepEqual([CREATOR, getTrustedPublisherId()]);
  });

  it('TS-23/TS-24 · `attachments` filtra por `entity_type` y descarta los borrados', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('requirements.get', {
      id: REQ_MAIN,
      include: ['attachments'],
    });
    const attachments = reply.data!.attachments as Record<string, unknown>[];

    // La tabla es POLIMÓRFICA: sin el `where` de la ficha vendrían también el vínculo de tipo
    // `requirement_comment` y el que tiene `deleted_at`.
    attachments.should.have.length(1);
    // EL ITEM ENTERO, no campo por campo: un campo de más o mal nombrado en `attachments.fields`
    // pasaría una aserción parcial.
    Object.keys(attachments[0]).sort().should.deepEqual([
      'fileId',
      'fileName',
      'fileSize',
      'id',
      'mimeType',
    ]);
    attachments[0].fileName!.should.equal(FILE_MAIN);
    attachments[0].mimeType!.should.equal('application/pdf');
    attachments[0].fileSize!.should.equal(1024);
    // `fileId` apunta al `File`, no al vínculo: es lo que un `attachments.fields` mal armado
    // confundiría, porque en un mundo chico los dos ids coinciden por casualidad.
    attachments[0].fileId!.should.equal(getFileMainId());
  });

  it('TS-25 · `filter.responsiblePersonId` resuelve por subconsulta', async () => {
    const reply = await dispatchQuery<Collection>('requirements.list', {
      filter: { responsiblePersonId: PERSON_ACTIVE },
    });

    ids(reply).should.deepEqual([REQ_MAIN]);
  });

  /* ------------------------------------------------------------------------------------------
   * El filtro `tag`
   * ---------------------------------------------------------------------------------------- */

  it('TS-26 · CA-9 · `tag` filtra por PAR EXACTO, no por clave', async () => {
    const reply = await dispatchQuery<Collection>('requirements.list', {
      filter: { tag: { key: 'modulo', value: 'facturacion' } },
    });

    // Los requisitos 90 y 91 tienen la MISMA clave (`modulo`) con OTRO valor (`compras`) y no
    // matchean: el par tiene que coincidir ENTERO, no solo la clave.
    ids(reply).should.deepEqual([REQ_MAIN]);
  });

  it('TS-27 · CA-9 · una LISTA de pares se combina con AND, no con OR', async () => {
    const reply = await dispatchQuery<Collection>('requirements.list', {
      filter: {
        projectId: PROJECT_MAIN,
        tag: [
          { key: 'modulo', value: 'compras' },
          { key: 'cliente', value: 'acme' },
        ],
      },
    });

    // El 91 tiene SOLO el primer par: si apareciera, la lista se combinó con OR.
    ids(reply).should.deepEqual([REQ_TAGGED_BOTH]);
    ids(reply).should.not.containEql(REQ_TAGGED_ONE);
  });

  it('TS-28 · CA-9 · una forma distinta a `{key, value}` es `invalid_fields`', async () => {
    const hostiles = ['facturacion', { key: 'modulo' }, { key: 'm', value: 'f', extra: 1 }];

    for (const tag of hostiles) {
      const reply = await dispatchQuery('requirements.list', { filter: { tag } });

      reply.status.should.equal('failure', JSON.stringify(tag));
      reply.errorCode!.should.equal('invalid_fields');
      reply.errorDetails!.field!.should.equal('filter.tag');
      (reply.errorDetails!.allowed as string[]).should.deepEqual(['key', 'value']);
    }
  });

  /* ------------------------------------------------------------------------------------------
   * El `q` numérico
   * ---------------------------------------------------------------------------------------- */

  it('TS-30 · CA-10 · `q` de solo dígitos busca por `id`', async () => {
    const reply = await dispatchQuery<Collection>('requirements.list', {
      filter: { q: String(REQ_NUMERIC) },
    });

    // El `title` del 8140 NO contiene "8140": si lo encontrara por texto, el test no probaría el
    // desvío.
    ids(reply).should.deepEqual([REQ_NUMERIC]);
  });

  it('TS-31 · CA-10 · `q` con texto busca en `title` y `description`', async () => {
    const reply = await dispatchQuery<Collection>('requirements.list', {
      filter: { q: 'facturación' },
    });

    ids(reply).should.containEql(REQ_MAIN);
    ids(reply).should.not.containEql(REQ_NUMERIC);
  });

  it('TS-32 · CA-10 · un texto de VEINTE dígitos no rompe: cae en el `ILIKE`', async () => {
    const reply = await dispatchQuery<Collection>('requirements.list', {
      filter: { q: '99999999999999999999' },
    });

    // Sin la cota de nueve dígitos, PostgreSQL fallaría con "value out of range" -> internal_error.
    reply.status.should.equal('success');
    items(reply).should.deepEqual([]);
  });

  /* ------------------------------------------------------------------------------------------
   * `totalMinutes`
   * ---------------------------------------------------------------------------------------- */

  it('TS-33 · CA-11 · `totalMinutes` suma las horas propias MÁS las de sus tareas', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('requirements.get', {
      id: REQ_MAIN,
      include: ['description', 'project', 'totalMinutes'],
    });

    // 120 del requisito + 60 de su tarea. Con la mitad de la fórmula daría 120 o 60.
    reply.data!.totalMinutes!.should.equal(180);
    // NÚMERO y no `"180"`: `SUM(integer)` vuelve como `bigint`, o sea string.
    (typeof reply.data!.totalMinutes).should.equal('number');
    reply.data!.project!.should.deepEqual({
      id: PROJECT_MAIN,
      name: 'Portal Jiku',
      code: 'PJK',
      status: 'activo',
    });
    reply.data!.should.have.property('description');
  });

  it('TS-34 · CA-11 · un requisito sin horas devuelve `0`, no `null`', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('requirements.get', {
      id: REQ_OTHER,
      include: ['totalMinutes'],
    });

    reply.data!.totalMinutes!.should.equal(0);
  });

  it('TS-35 · CA-12 · `totalMinutes` NO viene por defecto', async () => {
    const reply = await dispatchQuery<Collection>('requirements.list', {});

    // Son dos subconsultas correlacionadas POR FILA: con `limit: 200` serían 400.
    for (const item of items(reply)) {
      item.should.not.have.property('totalMinutes');
    }
  });

  /* ------------------------------------------------------------------------------------------
   * `comments`
   * ---------------------------------------------------------------------------------------- */

  it('TS-36 · CA-13 · `comments` viene acotado a 10 y marcado como truncado', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('requirements.get', {
      id: REQ_MAIN,
      include: ['comments'],
    });
    const comments = reply.data!.comments as Record<string, unknown>[];

    comments.should.have.length(10);
    reply.data!.commentsTruncated!.should.be.true();
    // LOS 10 MÁS RECIENTES: el fixture crea 25 en orden, así que el último es el primero.
    comments[0].body!.should.equal('Comentario 25');
    Object.keys(comments[0]).sort().should.deepEqual(['authorId', 'body', 'createdAt', 'id']);
    comments[0].authorId!.should.equal(CREATOR);
  });

  it('TS-37 · CA-13 · con diez o menos, `commentsTruncated` es `false`', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('requirements.get', {
      id: REQ_OTHER,
      include: ['comments'],
    });

    (reply.data!.comments as unknown[]).should.have.length(3);
    reply.data!.commentsTruncated!.should.be.false();
  });

  it('TS-38 · CA-13 · `comments` solo trae las filas de tipo `comment`', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('requirements.get', {
      id: REQ_OTHER,
      include: ['comments'],
    });

    // El requisito tiene además cuatro filas de actividad de tipo `state`.
    (reply.data!.comments as unknown[]).should.have.length(3);
  });

  /* ------------------------------------------------------------------------------------------
   * Listas blancas, listas independientes y el desempate
   * ---------------------------------------------------------------------------------------- */

  it('TS-44 · CA-16 · filtrar por un campo que NO vuelve funciona', async () => {
    const reply = await dispatchQuery<Collection>('requirements.list', {
      filter: { finishedAt: { gte: '2026-01-01' } },
    });

    // `finishedAt` es incluible Y filtrable: las dos listas son independientes.
    ids(reply).should.deepEqual([REQ_OTHER]);
    for (const item of items(reply)) {
      item.should.not.have.property('finishedAt');
    }
  });

  it('TS-46 · CA-7 · `sort: ["id"]` no duplica el desempate y recorre sin repetidos', async () => {
    const first = await dispatchQuery<Collection>('requirements.list', {
      sort: ['id'],
      page: { limit: 2 },
    });
    const second = await dispatchQuery<Collection>('requirements.list', {
      sort: ['id'],
      page: { limit: 2, cursor: first.data!.page.cursor },
    });

    // El cursor transporta UNA SOLA clave de orden: si el desempate se hubiera duplicado, llevaría
    // dos entradas idénticas.
    const decoded = JSON.parse(
      Buffer.from(first.data!.page.cursor!, 'base64url').toString('utf8')
    );
    (decoded.k as unknown[]).should.have.length(1);

    const recorridos = [...ids(first), ...ids(second)];
    new Set(recorridos).size.should.equal(4);
    recorridos.should.deepEqual([...recorridos].sort((a, b) => a - b));
  });

  it('TS-43 · un nombre inventado en las cuatro palancas responde `invalid_fields`', async () => {
    const cases: [unknown, string][] = [
      [{ filter: { nombreInventado: 1 } }, 'filter'],
      [{ sort: ['nombreInventado'] }, 'sort'],
      [{ fields: ['nombreInventado'] }, 'fields'],
      [{ include: ['nombreInventado'] }, 'include'],
    ];

    for (const [payload, field] of cases) {
      const reply = await dispatchQuery('requirements.list', payload);

      reply.status.should.equal('failure', field);
      reply.errorCode!.should.equal('invalid_fields');
      reply.errorDetails!.field!.should.equal(field);
    }
  });

  it('TS-45 · un filtro sin coincidencias devuelve `items: []`', async () => {
    const reply = await dispatchQuery<Collection>('requirements.list', {
      filter: { projectId: MISSING_ID },
    });

    reply.status.should.equal('success');
    items(reply).should.deepEqual([]);
  });

  it('TS-69 · la identidad NO puede viajar en el payload, ni en `filter` ni arriba', async () => {
    const inFilter = await dispatchQuery('requirements.list', { filter: { userId: 'otro' } });
    // LAS DOS POSICIONES, y la de arriba no es redundante: son dos compuertas distintas del
    // validador (`parseGroup` y `checkTopLevelKeys`), y un campo de identidad IGNORADO sugeriría
    // que el caller puede preguntar en nombre de otro.
    const topLevel = await dispatchQuery('requirements.list', { userId: 'otro' });

    for (const reply of [inFilter, topLevel]) {
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
      reply.errorMessage!.should.containEql('quién pregunta sale del subject');
    }
  });

  it('TS-70 · las cuatro palancas de `list` son un ERROR en el `get`', async () => {
    for (const key of ['filter', 'sort', 'page', 'count']) {
      const reply = await dispatchQuery('requirements.get', { id: REQ_MAIN, [key]: {} });

      reply.status.should.equal('failure', key);
      reply.errorCode!.should.equal('invalid_fields');
      (reply.errorDetails!.allowed as string[]).should.deepEqual(['id', 'fields', 'include']);
    }
  });

  it('un id inexistente responde `requirement_not_found`', async () => {
    const reply = await dispatchQuery('requirements.get', { id: MISSING_ID });

    reply.status.should.equal('failure');
    reply.errorCode!.should.equal('requirement_not_found');
  });
});
