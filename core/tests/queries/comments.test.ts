import 'mocha';
import 'should';
import * as sinon from 'sinon';
import { ErrorCode, Reply } from '@jiku/nats-protocol';
import { commentsSpec } from '../../src/queries/comments/comments-spec';
import { getTrustedPublisherId } from '../../src/config';
import { readDb } from '../../src/models/read';
import { dispatchQuery, resetQueryBudget, setQueryBudget } from '../helpers/dispatch';
import { CREATOR, PROJECT_MAIN, PROJECT_OTHER, createWorld, destroyWorld } from './task-fixtures';
import { createDomainWorld, destroyDomainWorld } from './domain-fixtures';
import {
  ACT_NOT_COMMENT,
  CA_DIGITS,
  CA_INTERNAL,
  CA_MAIN,
  CA_MID,
  CA_NEW,
  CA_OLD,
  CA_OTHER_AUTHOR,
  CA_SEARCH,
  CA_TIE_A,
  CA_TIE_B,
  CR_MAIN,
  FILE_ACTIVE,
  MISSING_ID,
  REQ_MAIN,
  SHARED_ID,
  SHARED_REQUIREMENT_BODY,
  SHARED_TASK_BODY,
  TASK_MAIN,
  createActivityTasks,
  createCommentAttachments,
  createObjectiveActivity,
  createRequirementActivity,
  destroyActivityWorld,
  getActiveFileId,
} from './activity-fixtures';

/**
 * `comments.list` y `comments.get` CONTRA BASE REAL, por el despachador (S-025).
 *
 * ES LA SUITE DE LA FAMILIA DE LAS DOS TABLAS. Lo que decide si la story salió bien no son los
 * endpoints: es que NINGÚN CAMINO pueda resolver un id sin saber de qué tabla es. El test que lo
 * atrapa es TS-34 — el mismo id en las dos tablas, con contenidos distintos.
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

/** El filtro mínimo de un `comments.list` sobre la tarea principal. */
const TASK_FILTER = { entityType: 'task', entityId: TASK_MAIN };

describe('queries/comments — el contrato del recurso (S-025)', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN, PROJECT_OTHER]);
    await createDomainWorld();
    await createActivityTasks();

    await createObjectiveActivity([
      { id: CA_MAIN, objectiveId: TASK_MAIN, newValue: 'Hola', createdAt: '2026-04-01T00:00:00.000Z' },
      {
        id: CA_INTERNAL,
        objectiveId: TASK_MAIN,
        newValue: 'Comentario interno',
        visibilityLevel: 'internal',
        createdAt: '2026-04-02T00:00:00.000Z',
      },
      // Los tres del orden ASCENDENTE.
      { id: CA_OLD, objectiveId: TASK_MAIN, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: CA_MID, objectiveId: TASK_MAIN, createdAt: '2026-02-01T00:00:00.000Z' },
      { id: CA_NEW, objectiveId: TASK_MAIN, createdAt: '2026-03-01T00:00:00.000Z' },
      // LOS DOS DEL EMPATE: mismo `created_at`, el desempate por `id` tiene que ser ASC.
      { id: CA_TIE_A, objectiveId: TASK_MAIN, createdAt: '2026-05-01T00:00:00.000Z' },
      { id: CA_TIE_B, objectiveId: TASK_MAIN, createdAt: '2026-05-01T00:00:00.000Z' },
      // El del `q` y el de los dígitos.
      {
        id: CA_SEARCH,
        objectiveId: TASK_MAIN,
        newValue: 'Alta de comprobantes',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
      {
        id: CA_DIGITS,
        objectiveId: TASK_MAIN,
        newValue: 'El numero 8140 aparece en el texto',
        createdAt: '2026-06-02T00:00:00.000Z',
      },
      // Otro autor, para que `filter.authorId` sea observable.
      {
        id: CA_OTHER_AUTHOR,
        objectiveId: TASK_MAIN,
        newValue: 'De otro autor',
        changedBy: getTrustedPublisherId(),
        createdAt: '2026-06-03T00:00:00.000Z',
      },
      // UNA FILA QUE NO ES UN COMENTARIO: sin el predicado fijo de la ficha se colaría.
      {
        id: ACT_NOT_COMMENT,
        objectiveId: TASK_MAIN,
        type: 'state',
        previousValue: 'backlog',
        newValue: 'activo',
        createdAt: '2026-06-04T00:00:00.000Z',
      },
      // EL MISMO ID QUE EN LA OTRA TABLA. Ver TS-34.
      {
        id: SHARED_ID,
        objectiveId: TASK_MAIN,
        newValue: SHARED_TASK_BODY,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ]);

    await createRequirementActivity([
      {
        id: CR_MAIN,
        requirementId: REQ_MAIN,
        newValue: 'Comentario del requisito',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: SHARED_ID,
        requirementId: REQ_MAIN,
        newValue: SHARED_REQUIREMENT_BODY,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ]);

    await createCommentAttachments();
  });

  after(async () => {
    await destroyActivityWorld();
    await destroyDomainWorld();
    await destroyWorld();
  });

  afterEach(() => sinon.restore());

  /* ------------------------------------------------------------------------------------------
   * CA-1, CA-4, CA-5 · el camino feliz, la ficha y las traducciones
   * ---------------------------------------------------------------------------------------- */

  it('TS-1 · `comments.list` DEJA DE RESPONDER `pendingContract`', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', { filter: TASK_FILTER });

    reply.status.should.equal('success');
    reply.data!.items.should.be.an.Array();
    (reply.errorCode === undefined).should.be.true();
    JSON.stringify(reply).should.not.containEql('todavía no tiene contrato definido');
  });

  it('TS-2 · `comments.get` DEJA DE RESPONDER `pendingContract`', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('comments.get', {
      id: CA_MAIN,
      entityType: 'task',
    });

    reply.status.should.equal('success', JSON.stringify(reply));
    reply.data!.id!.should.equal(CA_MAIN);
  });

  it('TS-3 · el conjunto base son los NUEVE campos declarados, ni uno más', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', { filter: TASK_FILTER });

    Object.keys(items(reply)[0]).sort().should.deepEqual([
      'attachments',
      'authorId',
      'body',
      'createdAt',
      'entityId',
      'entityType',
      'id',
      'updatedAt',
      'visibilityLevel',
    ]);
  });

  it('TS-4 · lee `objective_activity` CON el predicado de tipo, y traduce `body` y `authorId`', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', { filter: TASK_FILTER });
    const main = items(reply).find((item) => item.id === CA_MAIN)!;

    main.body!.should.equal('Hola');
    main.authorId!.should.equal(CREATOR);
    // Los nombres de la BASE no existen en el contrato.
    main.should.not.have.property('newValue');
    main.should.not.have.property('changedBy');
    // Y la fila de `state` NO es un comentario.
    ids(reply).should.not.containEql(ACT_NOT_COMMENT);
  });

  it('TS-5 · `entityType` viaja TRADUCIDO, nunca el nombre de la base', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', { filter: TASK_FILTER });

    for (const item of items(reply)) {
      item.entityType!.should.equal('task');
    }
    JSON.stringify(items(reply)).should.not.containEql('objective');
  });

  it('TS-6 · `entityId` sale de la columna DE LA VARIANTE', async () => {
    const task = await dispatchQuery<Collection>('comments.list', { filter: TASK_FILTER });
    items(task)[0].entityId!.should.equal(TASK_MAIN);

    const requirement = await dispatchQuery<Collection>('comments.list', {
      filter: { entityType: 'requirement', entityId: REQ_MAIN },
    });
    items(requirement)[0].entityId!.should.equal(REQ_MAIN);
  });

  it('TS-7 · con `entityType: "requirement"` resuelve LA OTRA TABLA', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', {
      filter: { entityType: 'requirement', entityId: REQ_MAIN },
    });

    items(reply).map((item) => item.body).should.containEql('Comentario del requisito');
    for (const item of items(reply)) {
      item.entityType!.should.equal('requirement');
    }
    // Ningún comentario de `objective_activity` se cuela.
    ids(reply).should.not.containEql(CA_MAIN);
  });

  it('TS-8 · `author` es INCLUIBLE, no base, y nunca trae `email`', async () => {
    const withAuthor = await dispatchQuery<Record<string, unknown>>('comments.get', {
      id: CA_MAIN,
      entityType: 'task',
      include: ['author'],
    });

    withAuthor.data!.author!.should.deepEqual({
      id: CREATOR,
      name: 'Creador',
      username: 'creador-queries',
    });

    const without = await dispatchQuery<Record<string, unknown>>('comments.get', {
      id: CA_MAIN,
      entityType: 'task',
    });
    without.data!.should.not.have.property('author');
  });

  it('TS-9 · `authorId`, `visibilityLevel` y `createdAt` filtran', async () => {
    const byAuthor = await dispatchQuery<Collection>('comments.list', {
      filter: { ...TASK_FILTER, authorId: getTrustedPublisherId() },
    });
    ids(byAuthor).should.deepEqual([CA_OTHER_AUTHOR]);

    const byVisibility = await dispatchQuery<Collection>('comments.list', {
      filter: { ...TASK_FILTER, visibilityLevel: 'internal' },
    });
    ids(byVisibility).should.deepEqual([CA_INTERNAL]);

    const byDate = await dispatchQuery<Collection>('comments.list', {
      filter: { ...TASK_FILTER, createdAt: { gte: '2026-07-01T00:00:00.000Z' } },
    });
    ids(byDate).should.deepEqual([SHARED_ID]);
  });

  it('TS-10 · `filter.q` busca en `body`', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', {
      filter: { ...TASK_FILTER, q: 'comproban' },
    });

    ids(reply).should.deepEqual([CA_SEARCH]);
  });

  it('TS-11 · `filter.q` con SOLO DÍGITOS no se desvía a `id`', async () => {
    // `comments` NO declara `searchNumericColumn`: en un comentario un texto de dígitos ES TEXTO.
    const reply = await dispatchQuery<Collection>('comments.list', {
      filter: { ...TASK_FILTER, q: '8140' },
    });

    ids(reply).should.deepEqual([CA_DIGITS]);
  });

  it('TS-12 · el sort declarado es `createdAt` y `updatedAt`, y nada más', async () => {
    const ok = await dispatchQuery<Collection>('comments.list', {
      filter: TASK_FILTER,
      sort: ['updatedAt'],
    });
    ok.status.should.equal('success');

    const error = failed(
      await dispatchQuery('comments.list', { filter: TASK_FILTER, sort: ['id'] })
    );
    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('sort');
    (error.errorDetails!.allowed as string[]).should.deepEqual(['createdAt', 'updatedAt']);
  });

  /* ------------------------------------------------------------------------------------------
   * CA-15 · el default ASCENDENTE y la paginación
   * ---------------------------------------------------------------------------------------- */

  it('TS-13 · sin `sort`, el PRIMER item es el comentario MÁS VIEJO', async () => {
    // SI SALE AL REVÉS, se copió el `-createdAt` del resto del contrato: un hilo de comentarios se
    // lee del más viejo al más nuevo, y con el orden invertido la primera página del hilo es la
    // última del hilo. Se compara contra un id, no contra "está ordenado".
    const reply = await dispatchQuery<Collection>('comments.list', {
      filter: { ...TASK_FILTER, createdAt: { lte: '2026-03-31T00:00:00.000Z' } },
    });

    ids(reply).should.deepEqual([CA_OLD, CA_MID, CA_NEW]);
  });

  it('TS-14 · el desempate que agrega el motor es `id` ASC, no DESC', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', {
      filter: {
        ...TASK_FILTER,
        createdAt: { gte: '2026-05-01T00:00:00.000Z', lte: '2026-05-01T00:00:00.000Z' },
      },
    });

    ids(reply).should.deepEqual([CA_TIE_A, CA_TIE_B]);
  });

  it('TS-15 · el keyset recorre el hilo completo sin repetir ni saltear', async () => {
    const seen: number[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 10; page += 1) {
      const reply: Reply<Collection> = await dispatchQuery<Collection>('comments.list', {
        filter: { ...TASK_FILTER, createdAt: { lte: '2026-06-30T00:00:00.000Z' } },
        page: cursor ? { limit: 2, cursor } : { limit: 2 },
      });
      seen.push(...ids(reply));
      cursor = reply.data!.page.cursor;
      if (!cursor) {
        break;
      }
    }

    // Los diez comentarios anteriores al 2026-07, en orden ASCENDENTE de `createdAt`.
    seen.should.deepEqual([
      CA_OLD,
      CA_MID,
      CA_NEW,
      CA_MAIN,
      CA_INTERNAL,
      CA_TIE_A,
      CA_TIE_B,
      CA_SEARCH,
      CA_DIGITS,
      CA_OTHER_AUTHOR,
    ]);
    new Set(seen).size.should.equal(seen.length);
    // LA AUSENCIA DE CURSOR ES LA ÚNICA SEÑAL DE FIN.
    (cursor === undefined).should.be.true();
  });

  it('TS-16 · el cursor está ATADO a `entityType`', async () => {
    const first = await dispatchQuery<Collection>('comments.list', {
      filter: TASK_FILTER,
      page: { limit: 2 },
    });
    const cursor = first.data!.page.cursor!;

    const crossed = failed(
      await dispatchQuery('comments.list', {
        filter: { entityType: 'requirement', entityId: REQ_MAIN },
        page: { cursor },
      })
    );

    // NUNCA filas de la otra tabla: el `scope.filter` del cursor lleva el filtro CRUDO, que incluye
    // `entityType`, así que el hash no coincide.
    crossed.errorCode!.should.equal(ErrorCode.INVALID_CURSOR);
  });

  it('TS-17 · `count: "only"` cuenta sobre la tabla DE LA VARIANTE', async () => {
    const task = await dispatchQuery<Collection>('comments.list', {
      filter: TASK_FILTER,
      count: 'only',
    });
    task.data!.items.should.deepEqual([]);
    // Los ONCE comentarios de la tarea. La fila de `state` NO cuenta: el predicado fijo también
    // gobierna el COUNT, y olvidarlo ahí haría que el total incluyera cambios de campo.
    task.data!.page.total!.should.equal(11);

    const requirement = await dispatchQuery<Collection>('comments.list', {
      filter: { entityType: 'requirement', entityId: REQ_MAIN },
      count: 'only',
    });
    // Los 25 de `domain-fixtures` más los dos de esta suite.
    requirement.data!.page.total!.should.equal(27);
  });

  /* ------------------------------------------------------------------------------------------
   * CA-6 · los adjuntos embebidos
   * ---------------------------------------------------------------------------------------- */

  it('TS-18 · `attachments` viene EN LA BASE, sin pedirlo', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', { filter: TASK_FILTER });
    const main = items(reply).find((item) => item.id === CA_MAIN)!;

    (main.attachments as Record<string, unknown>[]).should.deepEqual([
      {
        id: (main.attachments as any)[0].id,
        fileId: getActiveFileId(),
        fileName: FILE_ACTIVE,
        mimeType: 'application/pdf',
        fileSize: 1024,
      },
    ]);
  });

  it('TS-19 · de los TRES adjuntos fabricados solo aparece el vivo y retenido', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', { filter: TASK_FILTER });
    const main = items(reply).find((item) => item.id === CA_MAIN)!;
    const attachments = main.attachments as Record<string, unknown>[];

    // NI EL BORRADO NI EL NO RETENIDO. Las dos exclusiones son permanentes (RF-26): con dos
    // adjuntos el test pasaría con una sola implementada.
    attachments.length.should.equal(1);
    attachments[0].fileName!.should.equal(FILE_ACTIVE);
  });

  it('TS-20 · el adjunto de la ENTIDAD, no del comentario, no se cuela', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', { filter: TASK_FILTER });
    const main = items(reply).find((item) => item.id === CA_MAIN)!;

    // Hay una fila `entity_type: 'objective', entity_id: 4001` con el MISMO número.
    (main.attachments as unknown[]).length.should.equal(1);
  });

  it('TS-21 · la traducción del `entity_type` del adjunto va EN LA VARIANTE', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', {
      filter: { entityType: 'requirement', entityId: REQ_MAIN },
    });
    const comment = items(reply).find((item) => item.id === CR_MAIN)!;

    // Se consulta `attachments.entity_type = 'requirement_comment'` y el comentario vuelve con
    // `entityType: "requirement"`: la traducción va en LAS DOS DIRECCIONES (RF-25).
    (comment.attachments as unknown[]).length.should.equal(1);
    comment.entityType!.should.equal('requirement');
  });

  /**
   * TS-103 de S-027 · LA REGRESIÓN DE LOS ADJUNTOS EMBEBIDOS.
   *
   * S-027 agregó al motor el JOIN fijo de la ficha y dos formas nuevas de recorte, y `comments`
   * NO CAMBIÓ una línea: sigue trayendo sus adjuntos como RELACIÓN DE COLECCIÓN por lote, con las
   * mismas cinco claves y las mismas tres condiciones de seguridad. Lo que las dos comparten es
   * EL MAPA de `entityType`, y nada más — acoplar los dos contratos haría que un cambio en uno
   * moviera el otro en silencio.
   */
  it('TS-22 / TS-103 · los adjuntos NUNCA traen datos de almacenamiento ni URL', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', { filter: TASK_FILTER });
    const serialized = JSON.stringify(items(reply));

    for (const forbidden of ['storageKey', 'storageBucket', 'storageRegion', 'checksum', 'url']) {
      serialized.should.not.containEql(forbidden);
    }
    const main = items(reply).find((item) => item.id === CA_MAIN)!;
    Object.keys((main.attachments as any)[0]).sort().should.deepEqual([
      'fileId',
      'fileName',
      'fileSize',
      'id',
      'mimeType',
    ]);
  });

  it('TS-23 · `attachments` NO es incluible: pedirlo en `include` es `invalid_fields`', async () => {
    const error = failed(
      await dispatchQuery('comments.list', { filter: TASK_FILTER, include: ['attachments'] })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('include');
    error.errorDetails!.value!.should.equal('attachments');
    (error.errorDetails!.allowed as string[]).should.deepEqual(['author']);
  });

  it('TS-24 · UN SOLO LOTE de adjuntos para toda la página, no uno por item', async () => {
    const spy = sinon.spy(readDb, 'query');

    await dispatchQuery<Collection>('comments.list', {
      filter: TASK_FILTER,
      page: { limit: 20 },
    });

    // EXACTAMENTE DOS: la de la página y la del lote. Con `limit: 200` la diferencia entre esta
    // forma y una consulta por item sería 2 contra 201 (RF-36).
    spy.callCount.should.equal(2);
  });

  it('TS-25 · un comentario sin adjuntos trae `[]`, no `null`', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', { filter: TASK_FILTER });
    const internal = items(reply).find((item) => item.id === CA_INTERNAL)!;

    internal.attachments!.should.deepEqual([]);
  });

  /* ------------------------------------------------------------------------------------------
   * CA-7 · `bodyTruncated`
   * ---------------------------------------------------------------------------------------- */

  describe('el presupuesto de bytes (CA-7)', () => {
    const BIG = 6000;

    /** Los CINCO de ~2 KB del corte por presupuesto (TS-27), aparte del enorme y del corto. */
    const MEDIUM_FIRST = 6100;

    before(async () => {
      await createObjectiveActivity([
        {
          id: BIG,
          objectiveId: TASK_MAIN,
          newValue: 'x'.repeat(40000),
          createdAt: '2026-09-01T00:00:00.000Z',
        },
        {
          id: BIG + 1,
          objectiveId: TASK_MAIN,
          newValue: 'corto',
          createdAt: '2026-09-02T00:00:00.000Z',
        },
      ]);

      // CINCO de ~2 KB: con un presupuesto de 8 KB entran unos pocos por página, así que el corte
      // es POR BYTES y no por falta de filas — que es exactamente lo que TS-27 verifica.
      await createObjectiveActivity(
        Array.from({ length: 5 }, (_, index) => ({
          id: MEDIUM_FIRST + index,
          objectiveId: TASK_MAIN,
          newValue: `${index}`.repeat(2000),
          createdAt: `2026-10-0${index + 1}T00:00:00.000Z`,
        }))
      );
    });

    afterEach(() => resetQueryBudget());

    it('TS-26 · un `body` que solo no entra se devuelve TRUNCADO Y MARCADO', async () => {
      setQueryBudget(4096);

      const reply = await dispatchQuery<Collection>('comments.list', {
        filter: { ...TASK_FILTER, createdAt: { gte: '2026-09-01T00:00:00.000Z' } },
      });

      // NUNCA CERO ITEMS: la regla de "nunca una página vacía con cursor" gana sobre el
      // presupuesto, porque una página vacía con cursor es un bucle infinito para el cliente.
      items(reply).length.should.be.above(0);
      items(reply)[0].bodyTruncated!.should.be.true();
      (items(reply)[0].body as string).length.should.be.below(40000);
      (reply.data!.page.cursor !== undefined).should.be.true();
    });

    it('TS-28 · un `body` corto NO se marca', async () => {
      const reply = await dispatchQuery<Collection>('comments.list', {
        filter: { ...TASK_FILTER, createdAt: { gte: '2026-09-02T00:00:00.000Z' } },
      });

      items(reply)[0].should.not.have.property('bodyTruncated');
    });

    it('TS-27 · el corte por presupuesto emite cursor y las páginas juntas traen los CINCO', async () => {
      setQueryBudget(8192);
      const filter = { ...TASK_FILTER, createdAt: { gte: '2026-10-01T00:00:00.000Z' } };

      const first = await dispatchQuery<Collection>('comments.list', {
        filter,
        page: { limit: 10 },
      });

      // MENOS DE CINCO Y CON CURSOR: `returned < limit` NO significa fin, porque el corte por
      // bytes es legítimo. La ÚNICA señal de fin es la ausencia de cursor.
      items(first).length.should.be.below(5);
      items(first).length.should.be.above(0);
      first.data!.page.returned.should.be.below(first.data!.page.limit);

      const seen = [...ids(first)];
      let cursor = first.data!.page.cursor;
      (cursor !== undefined).should.be.true();

      for (let page = 0; page < 10 && cursor; page += 1) {
        const next: Reply<Collection> = await dispatchQuery<Collection>('comments.list', {
          filter,
          page: { limit: 10, cursor },
        });
        seen.push(...ids(next));
        cursor = next.data!.page.cursor;
      }

      // Los CINCO, sin repetidos y en orden ascendente.
      seen.should.deepEqual([
        MEDIUM_FIRST,
        MEDIUM_FIRST + 1,
        MEDIUM_FIRST + 2,
        MEDIUM_FIRST + 3,
        MEDIUM_FIRST + 4,
      ]);
      (cursor === undefined).should.be.true();
    });
  });

  /* ------------------------------------------------------------------------------------------
   * CA-2, CA-3 · `entityType` obligatorio — los tests que justifican la story
   * ---------------------------------------------------------------------------------------- */

  it('TS-29 · `comments.list` SIN `filter.entityType`', async () => {
    const error = failed(await dispatchQuery('comments.list', { filter: { entityId: TASK_MAIN } }));

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('filter.entityType');
    (error.errorDetails!.allowed as string[]).should.deepEqual(['task', 'requirement']);
    error.errorMessage!.should.containEql('obligatorio');
  });

  it('TS-32 · `comments.list` SIN `filter` en absoluto: nunca la tabla por defecto', async () => {
    const error = failed(await dispatchQuery('comments.list', {}));

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('filter.entityType');
  });

  it('TS-33 · `comments.get` SIN `entityType`', async () => {
    const error = failed(await dispatchQuery('comments.get', { id: SHARED_ID }));

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    // Sin el prefijo `filter.`: en un `get` el discriminador es una clave de primer nivel.
    error.errorDetails!.field!.should.equal('entityType');
    (error.errorDetails!.allowed as string[]).should.deepEqual(['task', 'requirement']);
  });

  it('TS-34 · EL TEST QUE ATRAPA EL BUG QUE LA STORY EXISTE PARA PREVENIR', async () => {
    // El id 1234 existe en LAS DOS tablas, con cuerpos distintos. `entityType` es lo que decide
    // cuál vuelve; sin él, el motor devolvería "algún" comentario con ese id y el bug sería
    // SILENCIOSO E INTERMITENTE — funciona hasta que las dos tablas crecen lo suficiente.
    const task = await dispatchQuery<Record<string, unknown>>('comments.get', {
      id: SHARED_ID,
      entityType: 'task',
    });
    task.data!.body!.should.equal(SHARED_TASK_BODY);
    task.data!.entityType!.should.equal('task');
    task.data!.entityId!.should.equal(TASK_MAIN);

    const requirement = await dispatchQuery<Record<string, unknown>>('comments.get', {
      id: SHARED_ID,
      entityType: 'requirement',
    });
    requirement.data!.body!.should.equal(SHARED_REQUIREMENT_BODY);
    requirement.data!.entityType!.should.equal('requirement');
    requirement.data!.entityId!.should.equal(REQ_MAIN);
  });

  it('TS-35 · un valor fuera de `{task, requirement}` es `invalid_fields`', async () => {
    // `objective` es el nombre de la BASE y no se acepta en el contrato.
    for (const payload of [
      { filter: { entityType: 'objective', entityId: TASK_MAIN } },
      { filter: { entityType: 'project' } },
    ]) {
      const error = failed(await dispatchQuery('comments.list', payload));
      error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      (error.errorDetails!.allowed as string[]).should.deepEqual(['task', 'requirement']);
    }

    const get = failed(await dispatchQuery('comments.get', { id: 1, entityType: 'objective' }));
    get.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
  });

  it('TS-36 · varios valores, un operador o `null`: la variante es UNA TABLA', async () => {
    for (const value of [['task', 'requirement'], { not: 'task' }, null] as unknown[]) {
      const error = failed(
        await dispatchQuery('comments.list', { filter: { entityType: value, entityId: TASK_MAIN } })
      );
      error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    }
  });

  it('TS-37 · dentro de un `or` no selecciona variante', async () => {
    const error = failed(
      await dispatchQuery('comments.list', {
        filter: { or: [{ entityType: 'task' }, { entityType: 'requirement' }] },
      })
    );

    error.errorDetails!.field!.should.equal('filter.entityType');
  });

  it('TS-38 · `entityType` es un campo DEVUELTO y pedible en `fields`', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', {
      filter: TASK_FILTER,
      fields: ['entityType', 'body'],
    });

    // `id` se agrega SIEMPRE (RF-15).
    Object.keys(items(reply)[0]).sort().should.deepEqual(['body', 'entityType', 'id']);
    items(reply)[0].entityType!.should.equal('task');
  });

  it('TS-39 · `entityType` NO es ordenable', async () => {
    const error = failed(
      await dispatchQuery('comments.list', { filter: TASK_FILTER, sort: ['entityType'] })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('sort');
  });

  /* ------------------------------------------------------------------------------------------
   * CA-13, CA-14 · `comment_not_found`
   * ---------------------------------------------------------------------------------------- */

  it('TS-71 · `comments.get` de un id INEXISTENTE responde `comment_not_found`', async () => {
    const error = failed(
      await dispatchQuery('comments.get', { id: MISSING_ID, entityType: 'task' })
    );

    error.errorCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
  });

  it('TS-73 · un id que existe SOLO en la otra tabla responde `comment_not_found`', async () => {
    // El id solo tiene significado con su `entityType`.
    const found = await dispatchQuery<Record<string, unknown>>('comments.get', {
      id: SHARED_ID,
      entityType: 'task',
    });
    found.status.should.equal('success');

    const missing = failed(
      await dispatchQuery('comments.get', { id: CR_MAIN, entityType: 'task' })
    );
    missing.errorCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
  });

  it('TS-74 · una fila que NO es un comentario responde `comment_not_found`', async () => {
    // EL PREDICADO FIJO DEL RECURSO TAMBIÉN GOBIERNA EL `get`: la fila 5000 es un cambio de
    // `state` y existe en la tabla.
    const error = failed(
      await dispatchQuery('comments.get', { id: ACT_NOT_COMMENT, entityType: 'task' })
    );

    error.errorCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
  });

  it('TS-75 · un filtro sin coincidencias devuelve `items: []`, nunca un `*_not_found`', async () => {
    const reply = await dispatchQuery<Collection>('comments.list', {
      filter: { entityType: 'task', entityId: MISSING_ID },
    });

    items(reply).should.deepEqual([]);
    reply.data!.page.returned.should.equal(0);
    (reply.data!.page.cursor === undefined).should.be.true();
  });

  /* ------------------------------------------------------------------------------------------
   * CA-16 · las cuatro palancas y los nombres de la base
   * ---------------------------------------------------------------------------------------- */

  it('TS-76 · un nombre inventado en las CUATRO palancas es `invalid_fields`', async () => {
    const payloads: [string, unknown][] = [
      ['filter', { filter: { ...TASK_FILTER, nombreInventado: 1 } }],
      ['sort', { filter: TASK_FILTER, sort: ['nombreInventado'] }],
      ['fields', { filter: TASK_FILTER, fields: ['nombreInventado'] }],
      ['include', { filter: TASK_FILTER, include: ['nombreInventado'] }],
    ];

    for (const [label, payload] of payloads) {
      const error = failed(await dispatchQuery('comments.list', payload));
      error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS, label);
      error.errorDetails!.should.have.property('field');
      error.errorDetails!.should.have.property('allowed');
    }
  });

  it('TS-77 · los nombres de la BASE no se aceptan en el contrato', async () => {
    const payloads: unknown[] = [
      { filter: { entityType: 'task', objective_id: TASK_MAIN } },
      { filter: TASK_FILTER, fields: ['new_value'] },
      { filter: TASK_FILTER, fields: ['changed_by'] },
      { filter: { ...TASK_FILTER, type_of_activity: 'comment' } },
    ];

    for (const payload of payloads) {
      failed(await dispatchQuery('comments.list', payload)).errorCode!.should.equal(
        ErrorCode.INVALID_FIELDS
      );
    }
  });

  it('TS-78 · las cuatro palancas de `list` siguen siendo un error en `comments.get`', async () => {
    for (const key of ['filter', 'sort', 'page', 'count']) {
      const error = failed(
        await dispatchQuery('comments.get', {
          id: CA_MAIN,
          entityType: 'task',
          [key]: key === 'sort' ? [] : {},
        })
      );
      (error.errorDetails!.allowed as string[]).should.deepEqual([
        'id',
        'fields',
        'include',
        'entityType',
      ]);
    }
  });

  it('TS-79 · la identidad sigue sin poder viajar en el payload', async () => {
    const list = failed(
      await dispatchQuery('comments.list', { filter: TASK_FILTER, callerId: 'otro' })
    );
    list.errorMessage!.should.containEql('quién pregunta sale del subject, no del cuerpo');

    const get = failed(
      await dispatchQuery('comments.get', { id: CA_MAIN, entityType: 'task', principal: 'otro' })
    );
    get.errorMessage!.should.containEql('quién pregunta sale del subject, no del cuerpo');

    // `comments` NO declara `userId` filtrable, así que ahí SIGUE siendo identidad.
    const filtered = failed(
      await dispatchQuery('comments.list', { filter: { ...TASK_FILTER, userId: 'otro' } })
    );
    filtered.errorMessage!.should.containEql('quién pregunta sale del subject, no del cuerpo');
  });
});

/**
 * LA FICHA COMO DATO (TS-94, TS-95).
 *
 * No toca la base: lo que se verifica es que la ficha se pueda LEER ENTERA sin ejecutar nada, que
 * es la propiedad de la que `meta.describe` (S-028) va a depender.
 */
describe('queries/comments — la ficha como dato (S-025)', () => {
  it('TS-94 · los cuatro arrays de nombres se derivan de sus mapas', () => {
    [...commentsSpec.baseNames].should.deepEqual(Object.keys(commentsSpec.base));
    [...commentsSpec.includableNames].should.deepEqual(Object.keys(commentsSpec.includable));
    [...commentsSpec.filterableNames].should.deepEqual(Object.keys(commentsSpec.filterable));
    [...commentsSpec.sortableNames].should.deepEqual(Object.keys(commentsSpec.sortable));
    [...commentsSpec.fieldNames].should.deepEqual([
      ...Object.keys(commentsSpec.base),
      ...Object.keys(commentsSpec.includable),
    ]);
  });

  it('TS-94 · el discriminador declara sus dos valores en el orden del contrato', () => {
    [...commentsSpec.discriminator!.values].should.deepEqual(['task', 'requirement']);
    Object.keys(commentsSpec.discriminator!.variants).should.deepEqual(['task', 'requirement']);
    commentsSpec.discriminator!.field.should.equal('entityType');
  });

  it('TS-94 · el código de "no encontrado" es la CONSTANTE, no el literal', () => {
    commentsSpec.notFoundCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
  });

  it('TS-95 · `truncatable` es `["body"]`: es todo lo que `bodyTruncated` necesita', () => {
    [...commentsSpec.truncatable].should.deepEqual(['body']);
  });

  it('el default de orden es ASCENDENTE, a diferencia del resto del contrato', () => {
    [...commentsSpec.defaults.sort].should.deepEqual(['createdAt']);
    commentsSpec.defaults.sort.should.not.containEql('-createdAt');
  });
});
