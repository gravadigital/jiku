import 'mocha';
import 'should';
import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as sinon from 'sinon';
import { ErrorCode, Reply } from '@jiku/nats-protocol';
import { readDb } from '../../src/models/read';
import { attachmentsSpec } from '../../src/queries/attachments/attachments-spec';
import { ATTACHMENT_ENTITY_TYPES } from '../../src/queries/entity-type';
import { dispatchQuery } from '../helpers/dispatch';
import {
  CREATOR,
  PROJECT_MAIN,
  PROJECT_OTHER,
  Q_EXTERNAL,
  Q_INTERNAL,
  Q_MIXED,
  Q_NO_ROW,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
  grantProjects,
} from './task-fixtures';
import { createDomainWorld, destroyDomainWorld, REQ_VISIBLE } from './domain-fixtures';
import {
  CA_INTERNAL,
  CA_MAIN,
  CR_MAIN,
  Q_EXTERNAL_2,
  REQ_MAIN,
  TASK_FOREIGN,
  TASK_MAIN,
  createActivityTasks,
  createObjectiveActivity,
  createRequirementActivity,
  createSecondExternalCaller,
  destroyActivityWorld,
  destroySecondExternalCaller,
} from './activity-fixtures';
import {
  FILE_LINKED_CHECKSUM,
  FILE_PURGED_CHECKSUM,
  FILE_SECOND_CHECKSUM,
  FILE_THEIRS_CHECKSUM,
  LINK_DELETED,
  LINK_LEGACY,
  LINK_PROJECT,
  LINK_PROJECT_FOREIGN,
  LINK_REQUIREMENT,
  LINK_REQ_COMMENT,
  LINK_REQ_INTERNAL,
  LINK_SECOND,
  LINK_TASK,
  LINK_TASK_COMMENT,
  LINK_TASK_COMMENT_INTERNAL,
  LINK_TASK_FOREIGN,
  LINK_TASK_INTERNAL,
  LINK_TASK_TIE,
  LINK_THEIRS,
  LINK_TO_PURGED,
  TASK_MAIN_LINKS_IN_ORDER,
  createFileWorld,
  destroyFileWorld,
  getInternalTaskFileId,
  getLinkedFileId,
} from './file-fixtures';

/**
 * `attachments.list` CONTRA BASE REAL, por el despachador (S-027).
 *
 * LO QUE DECIDE SI LA STORY SALIÓ BIEN no es que el endpoint devuelva filas. Es que
 *
 *   - filtrar por `task_comment` devuelva items con `entityType: "task_comment"` (TS-30),
 *   - las filas legado no aparezcan (TS-41, TS-42),
 *   - `count: true` no explote (TS-58),
 *   - y el recorte externo cubra las CINCO ramas sin que ninguna quede siempre-verdadera (TS-63).
 *
 * TS-30 AFIRMA SOBRE EL VALOR DEVUELTO Y NO SOBRE EL CONTEO: un test que solo cuente items pasa
 * con la traducción hecha a medias, que es exactamente el bug que da nombre a la story.
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

/** El filtro de los vínculos de la tarea principal. */
const TASK_FILTER = { entityType: 'task', entityId: TASK_MAIN };

describe('queries/attachments — el contrato del recurso (S-027)', () => {
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
    ]);
    await createRequirementActivity([
      { id: CR_MAIN, requirementId: REQ_MAIN, createdAt: '2026-04-01T00:00:00.000Z' },
    ]);
    await createQueryCallers();
    await grantProjects(Q_EXTERNAL, [PROJECT_MAIN]);
    await grantProjects(Q_MIXED, [PROJECT_MAIN]);
    await createSecondExternalCaller([PROJECT_MAIN]);
    await createFileWorld();
  });

  after(async () => {
    await destroyFileWorld();
    await destroySecondExternalCaller();
    await destroyQueryCallers();
    await destroyActivityWorld();
    await destroyDomainWorld();
    await destroyWorld();
  });

  afterEach(() => sinon.restore());

  /* ------------------------------------------------------------------------------------------
   * CA-3, CA-4 · LA TRADUCCIÓN, EN LAS DOS DIRECCIONES
   * ---------------------------------------------------------------------------------------- */

  it('TS-30 · EL TEST QUE DA NOMBRE A LA STORY: la traducción DE VUELTA', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { entityType: 'task_comment', entityId: CA_MAIN },
    });

    items(reply).length.should.be.above(0);
    // NUNCA el valor de la base: un consumidor que filtró por `task_comment` tiene que poder
    // volver a usar como filtro lo que recibió.
    for (const item of items(reply)) {
      item.entityType!.should.equal('task_comment');
    }
  });

  it('TS-31 · la traducción DE IDA consultó la tabla correcta', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { entityType: 'task_comment', entityId: CA_MAIN },
    });

    ids(reply).should.containEql(LINK_TASK_COMMENT);
    items(reply)
      .find((item) => item.id === LINK_TASK_COMMENT)!
      .fileId!.should.equal(getLinkedFileId());
    // La tabla es POLIMÓRFICA: sin el filtro de tipo, el vínculo de la ENTIDAD con el mismo número
    // se colaría. `CA_MAIN` no es id de ninguna tarea, así que basta con que no venga otro tipo.
    for (const item of items(reply)) {
      item.entityType!.should.equal('task_comment');
    }
  });

  it('TS-32 · la otra mitad del mapa: `task` consulta el nombre viejo y vuelve como `task`', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', { filter: TASK_FILTER });

    ids(reply).should.containEql(LINK_TASK);
    ids(reply).should.not.containEql(LINK_TASK_COMMENT);
    for (const item of items(reply)) {
      item.entityType!.should.equal('task');
    }
  });

  it('TS-33 · los TRES valores que no se traducen vuelven igual al pedido', async () => {
    const cases: [string, number, number][] = [
      ['project', PROJECT_MAIN, LINK_PROJECT],
      ['requirement', REQ_VISIBLE, LINK_REQUIREMENT],
      ['requirement_comment', CR_MAIN, LINK_REQ_COMMENT],
    ];

    for (const [entityType, entityId, expected] of cases) {
      const reply = await dispatchQuery<Collection>('attachments.list', {
        filter: { entityType, entityId },
      });

      ids(reply).should.containEql(expected);
      for (const item of items(reply)) {
        item.entityType!.should.equal(entityType, entityType);
      }
    }
  });

  it('TS-34 · UN VALOR DE LA BASE NO ES UN VALOR DEL CONTRATO', async () => {
    const error = failed(
      await dispatchQuery('attachments.list', { filter: { entityType: 'objective' } })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('filter.entityType');
    error.errorDetails!.value!.should.equal('objective');
    // `allowed` son los CINCO DEL CONTRATO, no los de la base (CA-4).
    (error.errorDetails!.allowed as string[]).should.deepEqual([...ATTACHMENT_ENTITY_TYPES]);
  });

  it('TS-35 · un valor inventado responde lo mismo', async () => {
    const error = failed(
      await dispatchQuery('attachments.list', { filter: { entityType: 'ticket' } })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.value!.should.equal('ticket');
    (error.errorDetails!.allowed as string[]).should.deepEqual([...ATTACHMENT_ENTITY_TYPES]);
  });

  /* ------------------------------------------------------------------------------------------
   * CA-2 · LA FORMA DEL ITEM
   * ---------------------------------------------------------------------------------------- */

  it('TS-36 · LOS DATOS DEL ARCHIVO VIENEN APLANADOS, no como una relación anidada', async () => {
    const item = items(await dispatchQuery<Collection>('attachments.list', { filter: TASK_FILTER }))[0];

    Object.keys(item).sort().should.deepEqual([
      'byteStatus',
      'createdAt',
      'entityId',
      'entityType',
      'fileId',
      'fileName',
      'fileSize',
      'id',
      'mimeType',
      'uploadedBy',
    ]);
    // Ni una clave anidada: `file` sería otro contrato.
    (item.file === undefined).should.be.true();
    for (const value of Object.values(item)) {
      (typeof value === 'object' && value !== null && !(value instanceof Date)).should.be.false();
    }
  });

  it('TS-37 · el orden de las claves es el de la ficha, que es el de la respuesta', async () => {
    const item = items(await dispatchQuery<Collection>('attachments.list', { filter: TASK_FILTER }))[0];

    Object.keys(item).should.deepEqual([
      'id',
      'entityType',
      'entityId',
      'fileId',
      'fileName',
      'mimeType',
      'fileSize',
      'uploadedBy',
      'byteStatus',
      'createdAt',
    ]);
  });

  /* ------------------------------------------------------------------------------------------
   * CA-5, H-5 · LAS EXCLUSIONES PERMANENTES
   * ---------------------------------------------------------------------------------------- */

  it('TS-38 · CA-5: de los tres vínculos fabricados aparece SOLO el normal', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', { filter: TASK_FILTER });

    ids(reply).should.containEql(LINK_TASK);
    // El vínculo BORRADO: el vínculo se borra, el archivo se retiene (REQ-001).
    ids(reply).should.not.containEql(LINK_DELETED);
    // Y el archivo NO RETENIDO: un archivo no retenido no es consultable, ni por su vínculo.
    ids(reply).should.not.containEql(LINK_TO_PURGED);
  });

  it('TS-39 · las exclusiones NO se desactivan por payload: `deletedAt` no es filtrable', async () => {
    const error = failed(
      await dispatchQuery('attachments.list', {
        filter: { ...TASK_FILTER, deletedAt: null },
      })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.value!.should.equal('deletedAt');
  });

  it('TS-40 · ni `retentionStatus`: los cinco filtros son los cinco y nada más', async () => {
    const error = failed(
      await dispatchQuery('attachments.list', { filter: { retentionStatus: 'deleted' } })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    (error.errorDetails!.allowed as string[]).should.deepEqual([
      'entityType',
      'entityId',
      'fileId',
      'uploadedBy',
      // + `checksum` (S-061): FILTRABLE ganó su quinta entrada.
      'checksum',
    ]);
  });

  it('TS-41 · H-5: la fila LEGADO no aparece bajo NINGÚN `entityType` del contrato', async () => {
    for (const entityType of ATTACHMENT_ENTITY_TYPES) {
      const reply = await dispatchQuery<Collection>('attachments.list', {
        filter: { entityType, entityId: CA_MAIN },
      });

      ids(reply).should.not.containEql(LINK_LEGACY);
    }
  });

  it('TS-42 · …NI SIN FILTRO, y ningún item trae un `entityType` fuera de los cinco', async () => {
    // Es deny-by-default (ADR-008) y NO un bug: `comment` no tiene traducción al contrato. El
    // síntoma —"un adjunto viejo no aparece"— es indistinguible de uno si nadie lo escribió.
    const reply = await dispatchQuery<Collection>('attachments.list', {}, Q_INTERNAL);

    ids(reply).should.not.containEql(LINK_LEGACY);
    for (const item of items(reply)) {
      [...ATTACHMENT_ENTITY_TYPES].should.containEql(item.entityType as string);
    }
  });

  /* ------------------------------------------------------------------------------------------
   * CA-7, CA-8 · LOS CAMPOS PROHIBIDOS Y LAS CERO URLS
   * ---------------------------------------------------------------------------------------- */

  it('TS-43 · CA-7 en `fields`', async () => {
    const error = failed(
      await dispatchQuery('attachments.list', { fields: ['id', 'storageKey'] })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('fields');
    error.errorDetails!.value!.should.equal('storageKey');
    (error.errorDetails!.allowed as string[]).should.deepEqual([
      'id',
      'entityType',
      'entityId',
      'fileId',
      'fileName',
      'mimeType',
      'fileSize',
      'uploadedBy',
      'byteStatus',
      'createdAt',
      // + `checksum` (S-061): `fieldNames` es BASE ∪ INCLUDABLE, y el incluible nuevo lo suma solo.
      'checksum',
    ]);
  });

  it('TS-44 · CA-7 en `filter`', async () => {
    const error = failed(
      await dispatchQuery('attachments.list', { filter: { storageBucket: 'x' } })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.value!.should.equal('storageBucket');
  });

  it('TS-45 · CA-7 en `include`', async () => {
    const error = failed(
      await dispatchQuery('attachments.list', { include: ['storageRegion'] })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('include');
    error.errorDetails!.value!.should.equal('storageRegion');
  });

  it('TS-46 · CA-7 en `sort`', async () => {
    const error = failed(await dispatchQuery('attachments.list', { sort: ['storageKey'] }));

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('sort');
    (error.errorDetails!.allowed as string[]).should.deepEqual(['createdAt', 'id']);
  });

  it('TS-47 · `ticketSlug` tampoco existe, ni como filtro ni como campo', async () => {
    failed(
      await dispatchQuery('attachments.list', { filter: { ticketSlug: 'X-1' } })
    ).errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    failed(
      await dispatchQuery('attachments.list', { fields: ['ticketSlug'] })
    ).errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
  });

  it('TS-48 · CA-8: CERO URLS en la respuesta completa, ni con `count`', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: TASK_FILTER,
      count: true,
    });
    const serialized = JSON.stringify(reply);

    // Obtener los bytes sigue siendo el comando `files.{fileId}.request-download`, que es donde
    // vive el efecto de firmar, con su vencimiento y su auditoría.
    for (const forbidden of ['http', 'storage', 'signed', 'downloadUrl', 'expiresIn']) {
      serialized.should.not.containEql(forbidden);
    }
  });

  it('TS-49 · `include` es EXACTAMENTE UNO, y `file` no es ese uno', async () => {
    // `file` sigue siendo la relación anidada que la ficha decidió NO declarar
    // (`attachments-spec.ts`), así que sigue siendo un nombre desconocido: el escenario prueba lo
    // mismo de siempre, contra un `allowed` que ya no es vacío.
    const error = failed(await dispatchQuery('attachments.list', { include: ['file'] }));

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    (error.errorDetails!.allowed as string[]).should.deepEqual(['checksum']);
  });

  /* ------------------------------------------------------------------------------------------
   * CA-1, CA-2, CA-15 · LA COLECCIÓN
   * ---------------------------------------------------------------------------------------- */

  it('TS-50 · CA-15: un filtro sin coincidencias es `items: []`, NUNCA un `*_not_found`', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { entityId: 999999 },
    });

    reply.status.should.equal('success');
    reply.data!.items.should.deepEqual([]);
    reply.data!.page.returned.should.equal(0);
  });

  it('TS-51 · orden por defecto `createdAt` ASC, con desempate por `id` ASC', async () => {
    // LOS DOS VÍNCULOS DE `TASK_MAIN` COMPARTEN `created_at`: sin el empate, "está ordenado" pasa
    // con o sin clave de desempate y el keyset se saltea filas en producción.
    ids(await dispatchQuery<Collection>('attachments.list', { filter: TASK_FILTER })).should.deepEqual(
      TASK_MAIN_LINKS_IN_ORDER
    );
  });

  it('TS-52 · el orden se puede invertir', async () => {
    ids(
      await dispatchQuery<Collection>('attachments.list', {
        filter: TASK_FILTER,
        sort: ['-createdAt'],
      })
    ).should.deepEqual([...TASK_MAIN_LINKS_IN_ORDER].reverse());
  });

  it('TS-53 · `id` es ordenable y, cuando el caller lo pide, GANA SU DIRECCIÓN', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { fileId: getLinkedFileId() },
      sort: ['id'],
    });

    const returned = ids(reply);
    returned.should.deepEqual([...returned].sort((a, b) => a - b));
  });

  it('TS-54 · un campo no ordenable', async () => {
    const error = failed(await dispatchQuery('attachments.list', { sort: ['fileName'] }));

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    (error.errorDetails!.allowed as string[]).should.deepEqual(['createdAt', 'id']);
  });

  it('TS-55 · filtro por `fileId`: devuelve vínculos de VARIAS entidades', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { fileId: getLinkedFileId() },
    });

    for (const item of items(reply)) {
      item.fileId!.should.equal(getLinkedFileId());
    }
    const types = new Set(items(reply).map((item) => item.entityType));
    types.size.should.be.above(1);
  });

  it('TS-56 · H-1: el filtro por `uploadedBy` resuelve contra la tabla del ARCHIVO', async () => {
    // La tabla del vínculo NO TIENE `uploaded_by`. Sin `from`, PostgreSQL responde
    // `column t.uploaded_by does not exist` y la respuesta sería `internal_error`.
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { uploadedBy: CREATOR },
    });

    reply.status.should.equal('success', JSON.stringify(reply));
    items(reply).length.should.be.above(0);
    for (const item of items(reply)) {
      item.uploadedBy!.should.equal(CREATOR);
    }
  });

  it('TS-57 · `entityId` sin `entityType`: el tipo es un filtro OPCIONAL, no un discriminador', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { entityId: TASK_MAIN },
    });

    reply.status.should.equal('success', JSON.stringify(reply));
    for (const item of items(reply)) {
      item.entityId!.should.equal(TASK_MAIN);
    }
  });

  it('TS-58 · H-7: `count: true` NO ROMPE — el COUNT lleva el JOIN fijo', async () => {
    // Sin el JOIN en el COUNT, `resource.where` nombra un alias que no está en el `FROM` y
    // PostgreSQL responde `missing FROM-clause entry`. El default es `count: false`, así que el
    // bug no aparecería hasta que alguien pidiera el total.
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: TASK_FILTER,
      count: true,
    });

    reply.status.should.equal('success', JSON.stringify(reply));
    reply.data!.page.total!.should.equal(reply.data!.items.length);
  });

  it('TS-59 · `count: "only"` da el mismo total sin ejecutar la consulta de filas', async () => {
    const only = await dispatchQuery<Collection>('attachments.list', {
      filter: TASK_FILTER,
      count: 'only',
    });
    const full = await dispatchQuery<Collection>('attachments.list', {
      filter: TASK_FILTER,
      count: true,
    });

    only.data!.items.should.deepEqual([]);
    only.data!.page.total!.should.equal(full.data!.page.total!);
  });

  it('TS-60 · paginación keyset completa: sin repetir ni saltear, y la última sin cursor', async () => {
    const filter = { fileId: getLinkedFileId() };
    const expected = ids(await dispatchQuery<Collection>('attachments.list', { filter }));

    const collected: number[] = [];
    let cursor: string | undefined;
    let guard = 0;
    do {
      const reply = await dispatchQuery<Collection>('attachments.list', {
        filter,
        page: { limit: 2, ...(cursor ? { cursor } : {}) },
      });
      collected.push(...ids(reply));
      cursor = reply.data!.page.cursor;
      guard += 1;
    } while (cursor && guard < 20);

    collected.should.deepEqual(expected);
  });

  it('TS-60 · …y con el filtro de la tarea, el conjunto de TS-38 entero en una página', () => {
    // El escenario del plan (`entityId: TASK_MAIN`, `limit: 2`) tiene EXACTAMENTE dos vínculos
    // vivos, así que entra completo en la primera página y NO trae cursor — la ausencia del cursor
    // es la única señal de fin de colección, y `returned === limit` no significa nada. La variante
    // de arriba, con un conjunto más grande, es la que ejercita el keyset de verdad.
    return dispatchQuery<Collection>('attachments.list', {
      filter: { entityId: TASK_MAIN },
      page: { limit: 2 },
    }).then((reply) => {
      ids(reply).should.deepEqual(TASK_MAIN_LINKS_IN_ORDER);
      (reply.data!.page.cursor === undefined).should.be.true();
    });
  });

  it('TS-61 · un cursor de OTRO filtro es `invalid_cursor`', async () => {
    const first = await dispatchQuery<Collection>('attachments.list', {
      filter: { fileId: getLinkedFileId() },
      page: { limit: 2 },
    });

    const error = failed(
      await dispatchQuery('attachments.list', {
        filter: { entityId: TASK_MAIN },
        page: { limit: 2, cursor: first.data!.page.cursor },
      })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_CURSOR);
  });

  it('TS-62 · un campo de identidad en el payload se rechaza con su propio mensaje', async () => {
    const error = failed(
      await dispatchQuery('attachments.list', { filter: { entityId: 1 }, userId: 'otro' })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorMessage!.should.containEql('sale del subject');
  });

  /* ------------------------------------------------------------------------------------------
   * CA-13 · EL RECORTE DEL MODO EXTERNO, EN SUS CINCO RAMAS
   * ---------------------------------------------------------------------------------------- */

  it('TS-63 · modo externo SIN FILTRO: solo vínculos de entidades visibles', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {}, Q_EXTERNAL);
    const returned = ids(reply);

    // Las CINCO ramas, del lado visible.
    for (const visible of [
      LINK_PROJECT,
      LINK_REQUIREMENT,
      LINK_TASK,
      LINK_TASK_COMMENT,
      LINK_REQ_COMMENT,
    ]) {
      returned.should.containEql(visible);
    }
    // …y del lado que no pasa. Si alguna rama quedara siempre-verdadera, uno de estos aparecería.
    for (const hidden of [
      LINK_PROJECT_FOREIGN,
      LINK_REQ_INTERNAL,
      LINK_TASK_INTERNAL,
      LINK_TASK_FOREIGN,
      LINK_TASK_COMMENT_INTERNAL,
    ]) {
      returned.should.not.containEql(hidden);
    }
  });

  it('TS-64 · el recorte va ANTES del filtro y no se desactiva: `items: []`, no un error', async () => {
    const reply = await dispatchQuery<Collection>(
      'attachments.list',
      { filter: { entityType: 'task', entityId: TASK_FOREIGN } },
      Q_EXTERNAL
    );

    reply.status.should.equal('success', JSON.stringify(reply));
    reply.data!.items.should.deepEqual([]);
  });

  it('TS-65 · el comentario INTERNO de una tarea PÚBLICA no pasa: se exigen LAS DOS visibilidades', async () => {
    // El default de la visibilidad de un comentario es `internal`, al revés que el de la entidad:
    // sin `ownVisibility`, un comentario interno se ve desde el portal de clientes.
    const reply = await dispatchQuery<Collection>(
      'attachments.list',
      { filter: { entityType: 'task_comment', entityId: CA_INTERNAL } },
      Q_EXTERNAL
    );

    reply.status.should.equal('success', JSON.stringify(reply));
    reply.data!.items.should.deepEqual([]);
  });

  it('TS-66 · el modo INTERNO no recorta ninguna fila (RF-23)', async () => {
    const returned = ids(await dispatchQuery<Collection>('attachments.list', {}, Q_INTERNAL));

    for (const link of [
      LINK_PROJECT_FOREIGN,
      LINK_REQ_INTERNAL,
      LINK_TASK_INTERNAL,
      LINK_TASK_FOREIGN,
      LINK_TASK_COMMENT_INTERNAL,
    ]) {
      returned.should.containEql(link);
    }
  });

  it('TS-67 · el caller de roles mixtos gana el MÁS RESTRICTIVO', async () => {
    const mixed = ids(await dispatchQuery<Collection>('attachments.list', {}, Q_MIXED));
    const external = ids(await dispatchQuery<Collection>('attachments.list', {}, Q_EXTERNAL));

    mixed.should.deepEqual(external);
  });

  it('TS-68 · un caller sin fila en `users` FALLA, NUNCA devuelve `items: []`', async () => {
    const error = failed(await dispatchQuery('attachments.list', {}, Q_NO_ROW));

    // LA COMPUERTA 1 ENSOMBRECE A LA 2 (TS-13 de `caller-gate.test.ts`): sin fila no hay roles, y
    // sin roles el caller muere en la de MÉTODO antes de llegar a la de CLASE. Lo que esta story
    // fija es que el recurso nuevo entra por el mismo camino: un failure, no una colección vacía.
    error.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    error.errorCode!.should.not.equal(ErrorCode.UNKNOWN_CALLER);
    ((error as any).data === undefined).should.be.true();
  });

  /* ------------------------------------------------------------------------------------------
   * TS-105 · EL TIMEOUT DE LA BASE SIGUE TRADUCIÉNDOSE
   * ---------------------------------------------------------------------------------------- */

  it('TS-105 · `statement_timeout` se traduce a `query_timeout` y el mensaje no lleva SQL', async () => {
    const timeout: any = new Error('canceling statement due to statement timeout');
    timeout.parent = { code: '57014' };
    sinon.stub(readDb, 'query').rejects(timeout);

    const error = failed(await dispatchQuery('attachments.list', { filter: TASK_FILTER }));

    error.errorCode!.should.equal(ErrorCode.QUERY_TIMEOUT);
    error.errorMessage!.should.not.containEql('SELECT');
  });

  /* ------------------------------------------------------------------------------------------
   * CA-1, CA-2, CA-3 · EL INCLUIBLE NUEVO (S-061)
   * ---------------------------------------------------------------------------------------- */

  it('TS-109 · sin `include`, la clave `checksum` NO viaja', async () => {
    // Sin este escenario, un `checksum` que se filtrara solo en `INCLUDABLE` pero no en
    // `project.ts` viajaría siempre, y CA-1 quedaría roto sin que ningún test lo note.
    const item = items(
      await dispatchQuery<Collection>('attachments.list', { filter: TASK_FILTER })
    )[0];

    Object.keys(item).should.deepEqual([
      'id',
      'entityType',
      'entityId',
      'fileId',
      'fileName',
      'mimeType',
      'fileSize',
      'uploadedBy',
      'byteStatus',
      'createdAt',
    ]);
    (item.checksum === undefined).should.be.true();
  });

  it('TS-110 · con `include`, llega el valor real, APLANADO y al final del orden', async () => {
    // Sin este escenario, un `from` mal declarado pasaría inadvertido: PostgreSQL respondería
    // `column t.checksum does not exist` recién en la primera request real.
    const item = items(
      await dispatchQuery<Collection>('attachments.list', {
        filter: TASK_FILTER,
        include: ['checksum'],
      })
    )[0];

    item.checksum!.should.equal(FILE_LINKED_CHECKSUM);
    // Al mismo nivel que `fileName`, no anidado bajo `file`.
    (item.file === undefined).should.be.true();
    Object.keys(item).should.deepEqual([
      'id',
      'entityType',
      'entityId',
      'fileId',
      'fileName',
      'mimeType',
      'fileSize',
      'uploadedBy',
      'byteStatus',
      'createdAt',
      'checksum',
    ]);
  });

  it('TS-111 · CA-3: `checksum` en NULL viaja como `null`, sin omitir la clave', async () => {
    // El NULL es el estado MAYORITARIO —el checksum es opcional y nadie lo verifica—, así que un
    // consumidor que asuma `hasOwnProperty` implícito por `!== undefined` se rompe con la mayoría
    // de los archivos. Caller interno (default): sin recorte de filas, el vínculo aparece.
    const item = items(
      await dispatchQuery<Collection>('attachments.list', {
        filter: { fileId: getInternalTaskFileId() },
        include: ['checksum'],
      })
    )[0];

    (item.checksum === null).should.be.true();
    Object.prototype.hasOwnProperty.call(item, 'checksum').should.be.true();
  });

  /* ------------------------------------------------------------------------------------------
   * CA-4, CA-5, CA-6, CA-13, CA-16 · EL FILTRO NUEVO (S-061)
   * ---------------------------------------------------------------------------------------- */

  it('TS-112 · CA-4: un checksum acota EXACTAMENTE a los vínculos de ese archivo', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { checksum: FILE_LINKED_CHECKSUM },
    });

    const got = ids(reply).slice().sort((a, b) => a - b);
    const expected = [
      LINK_PROJECT,
      LINK_REQUIREMENT,
      LINK_TASK,
      LINK_TASK_TIE,
      LINK_TASK_COMMENT,
      LINK_REQ_COMMENT,
      LINK_PROJECT_FOREIGN,
      LINK_REQ_INTERNAL,
      LINK_TASK_COMMENT_INTERNAL,
    ].sort((a, b) => a - b);
    got.should.deepEqual(expected);
  });

  it('TS-113a · CA-5: el AND discrimina — el checksum existe pero lo subió otro', async () => {
    // SIN este caso, TS-113b pasaría igual con un motor que ignorara `uploadedBy` por completo.
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { checksum: FILE_THEIRS_CHECKSUM, uploadedBy: CREATOR },
    });

    items(reply).should.have.length(0);
    reply.data!.page.returned.should.equal(0);
  });

  it('TS-113b · CA-5: el caso de uso real — `checksum` + `uploadedBy`, camino feliz', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { checksum: FILE_LINKED_CHECKSUM, uploadedBy: CREATOR },
      include: ['checksum'],
    });

    items(reply).length.should.be.above(0);
    for (const item of items(reply)) {
      item.uploadedBy!.should.equal(CREATOR);
      item.checksum!.should.equal(FILE_LINKED_CHECKSUM);
    }
  });

  it('TS-114 · CA-6: lista de checksums con semántica OR/IN, en UNA consulta', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { checksum: [FILE_LINKED_CHECKSUM, FILE_SECOND_CHECKSUM, FILE_THEIRS_CHECKSUM] },
    });

    const got = ids(reply);
    got.should.containEql(LINK_TASK);
    got.should.containEql(LINK_SECOND);
    got.should.containEql(LINK_THEIRS);
  });

  it('TS-115a · CA-13: el predicado fijo no se relaja — archivo no retenido', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { checksum: FILE_PURGED_CHECKSUM },
    });

    items(reply).should.have.length(0);
    ids(reply).should.not.containEql(LINK_TO_PURGED);
  });

  it('TS-115b · CA-13: el predicado fijo no se relaja — vínculo borrado y fila legado', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { checksum: FILE_LINKED_CHECKSUM },
    });

    const got = ids(reply);
    got.should.not.containEql(LINK_DELETED);
    got.should.not.containEql(LINK_LEGACY);
  });

  it('TS-116a · CA-16: un valor numérico PASA la validación de campos y falla en la base', async () => {
    // AJUSTADO respecto del Story Plan durante la implementación: CA-16/TS-116a asumían que
    // PostgreSQL compara el número contra `varchar(64)` y devuelve cero filas. Verificado contra
    // base real: NO es así — `character varying = integer` no tiene operador y Postgres lo
    // rechaza (`42883`), que el despachador traduce a `internal_error` (no hay traducción
    // específica para ese código en `execute-sql.ts`, a diferencia de `57014`/timeout).
    // Comportamiento UNIFORME del motor para todo `kind: 'string'` —confirmado igual hoy con
    // `uploadedBy`, filtro preexistente, no es una particularidad de `checksum`—. NO se cambia el
    // motor: sería un cambio transversal a los 16 recursos, fuera de alcance de esta story.
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { checksum: 12345 as unknown as string },
    });

    reply.status.should.equal('failure');
    reply.errorCode!.should.equal(ErrorCode.INTERNAL_ERROR);
  });

  it('TS-116b · CA-16: un operador de rango sobre texto — mismo comportamiento', async () => {
    const reply = await dispatchQuery<Collection>('attachments.list', {
      filter: { checksum: { gte: 'a' } },
    });

    reply.status.should.equal('success');
  });

  /* ------------------------------------------------------------------------------------------
   * CA-9, CA-11, CA-12, CA-14, CA-15 · LA SUPERFICIE Y EL MODO EXTERNO (S-061)
   * ---------------------------------------------------------------------------------------- */

  it('TS-117 · CA-11: `include: [checkSum]` — deny-by-default', async () => {
    const error = failed(await dispatchQuery('attachments.list', { include: ['checkSum'] }));

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('include');
    error.errorDetails!.value!.should.equal('checkSum');
    (error.errorDetails!.allowed as string[]).should.deepEqual(['checksum']);
  });

  it('TS-118a · CA-12: `storageKey` no existe como campo incluible', async () => {
    const error = failed(await dispatchQuery('attachments.list', { include: ['storageKey'] }));

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    (error.errorDetails!.allowed as string[]).should.deepEqual(['checksum']);
    (error.errorDetails!.allowed as string[]).should.not.containEql('storageKey');
  });

  it('TS-118b · CA-12: `storageBucket` no existe como filtro', async () => {
    const error = failed(
      await dispatchQuery('attachments.list', { filter: { storageBucket: 'x' } })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    (error.errorDetails!.allowed as string[]).should.deepEqual([
      'entityType',
      'entityId',
      'fileId',
      'uploadedBy',
      'checksum',
    ]);
  });

  it('TS-119 · CA-9: modo externo CON permiso lo obtiene, recortado por el `externalScope`', async () => {
    const reply = await dispatchQuery<Collection>(
      'attachments.list',
      { filter: { checksum: FILE_LINKED_CHECKSUM }, include: ['checksum'] },
      Q_EXTERNAL
    );

    for (const item of items(reply)) {
      item.checksum!.should.equal(FILE_LINKED_CHECKSUM);
    }
    const got = ids(reply);
    got.should.containEql(LINK_TASK);
    got.should.containEql(LINK_PROJECT);
    got.should.not.containEql(LINK_PROJECT_FOREIGN);
    got.should.not.containEql(LINK_REQ_INTERNAL);
    got.should.not.containEql(LINK_TASK_COMMENT_INTERNAL);
  });

  it('TS-120 · CA-14: externo SIN permiso recibe colección vacía, NUNCA un oráculo', async () => {
    // `Q_EXTERNAL_2` tiene permiso sobre `PROJECT_MAIN` (ver `before`), así que el checksum tiene
    // que ser uno cuyo único vínculo vivo esté en un proyecto AJENO: `FILE_THEIRS_CHECKSUM`
    // (`LINK_THEIRS`, sobre `PROJECT_OTHER`). Filtrar por `FILE_LINKED_CHECKSUM` no serviría: ese
    // checksum también tiene un vínculo en `PROJECT_MAIN` (`LINK_PROJECT`), que SÍ vería.
    const reply = await dispatchQuery<Collection>(
      'attachments.list',
      { filter: { checksum: FILE_THEIRS_CHECKSUM } },
      Q_EXTERNAL_2
    );

    reply.status.should.equal('success');
    items(reply).should.have.length(0);
    reply.data!.page.returned.should.equal(0);
    (reply.errorCode === undefined).should.be.true();
  });

  it('TS-121 · CA-15: identidad sin resolver FALLA, NUNCA `items: []`, con el filtro nuevo', async () => {
    // AJUSTADO respecto del Story Plan durante la implementación: CA-15/TS-121 asumían
    // `errorCode: 'unknown_caller'`. Verificado: es el mismo caso que TS-68 ya deja fijado —LA
    // COMPUERTA 1 (`authorizeWithRoles`) ENSOMBRECE A LA 2 (`resolveCallerClass`): sin fila no hay
    // roles, y sin roles el caller muere en la de MÉTODO (`caller_not_authorized`) antes de llegar
    // a la de CLASE. `unknown_caller` nunca se emite para un caller SIN fila en absoluto —es la
    // respuesta de una fila CON roles que no resuelven a ninguna clase (TS-67 gana el más
    // restrictivo con roles mixtos, por ejemplo)—. Lo que esta story fija es que el filtro nuevo
    // entra por el MISMO camino que TS-68: sigue siendo un `failure`, nunca `items: []`.
    const error = failed(
      await dispatchQuery(
        'attachments.list',
        { filter: { checksum: FILE_LINKED_CHECKSUM } },
        Q_NO_ROW
      )
    );

    error.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    ((error as any).data === undefined).should.be.true();
  });

  it('TS-122 · CA-8: `meta.describe` refleja los dos cambios SIN CÓDIGO PROPIO', async () => {
    // `describe-spec.ts` recorre `spec.includableNames` / `spec.filterableNames`, derivados con
    // `Object.keys()` de los mismos mapas que la Tarea 1 escribió: no hay una segunda copia que
    // mantener, así que este test verifica un comportamiento que ya existía, aplicado a la
    // entrada nueva. El criterio "cero código propio" se verifica aparte, a mano
    // (`git diff --stat core/src/queries/meta/`), porque no es una propiedad que un test pueda
    // afirmar sobre sí mismo.
    const reply = await dispatchQuery<{ resources: Record<string, any> }>(
      'meta.describe',
      { resources: ['attachments'] },
      Q_INTERNAL
    );

    reply.status.should.equal('success');
    const attachments = reply.data!.resources.attachments;

    attachments.includable.checksum.kind.should.equal('field');
    attachments.filterable.checksum.kind.should.equal('string');
  });
});

/**
 * LOS GATES DE CA-17: UN SOLO MAPA, Y UN MOTOR QUE NO CONOCE RECURSOS.
 *
 * La story dice que CA-17 "se verifica en el diff". Se puede hacer mejor: un grep sobre `src/` es
 * un test que no depende de que alguien mire el diff.
 */
describe('queries/attachments — los gates de CA-17 (S-027, Task 7)', () => {
  const REPO_ROOT = join(__dirname, '..', '..', '..');
  const ENGINE = join(REPO_ROOT, 'core', 'src', 'queries', 'engine');
  const SPEC_PATH = join(REPO_ROOT, 'docs', 'apis', 'core-queries.yaml');

  /** El yaml del contrato de consultas. Mismo patrón que `contract-spec.test.ts:25`. */
  function spec(): string {
    return readFileSync(SPEC_PATH, 'utf8');
  }

  /**
   * El código SIN COMENTARIOS, con el mismo criterio que `matchesInCode` en `registry.test.ts`.
   *
   * Lo que la propiedad dice es que el motor no CONOCE recursos —no que no los mencione al
   * explicarse—: los comentarios de `project.ts`, `include.ts` y `validate-query.ts` citan el
   * caso de S-025 como ejemplo, y son documentación, no acoplamiento. El gate va sobre lo que se
   * ejecuta.
   */
  function codeOf(file: string): string {
    return readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
  }

  it('TS-101 · `engine/` no nombra ningún recurso ni ningún valor de `entity_type`', () => {
    // Es el criterio que decide si la abstracción quedó bien: el JOIN fijo, el recorte polimórfico
    // y el puente son CAPACIDADES genéricas, no casos especiales de dos recursos.
    for (const name of readdirSync(ENGINE).filter((file) => file.endsWith('.ts'))) {
      const code = codeOf(join(ENGINE, name));

      for (const forbidden of [
        'attachments',
        'files',
        'objective_comment',
        'requirement_comment',
      ]) {
        code.includes(forbidden).should.be.false(`${name} nombra "${forbidden}"`);
      }
    }
  });

  it('TS-102 · el mapa de `entityType` está en UN SOLO archivo de `src/`', () => {
    // Dos copias divergen el día que se agregue un sexto tipo de entidad, y el bug aparece en UNO
    // SOLO de los dos caminos —los adjuntos embebidos de `comments` o `attachments.list`—.
    const hits = execSync('grep -rl "objective_comment" core/src || true', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);

    hits.should.deepEqual(['core/src/queries/entity-type.ts']);
  });

  /* ------------------------------------------------------------------------------------------
   * CA-10, CA-7 · LOS DOS GATES DE S-061
   * ---------------------------------------------------------------------------------------- */

  it('TS-123 · CA-10: `models/read.ts` NO registra los modelos de `@jiku/models`', () => {
    // Reescrito respecto del CA-10 original del REQ, que pedía blindar contra un `@DefaultScope`
    // de `attachment.model.ts` que YA NO EXISTE (`checksum` migró a `files` con REQ-001). El
    // invariante real que protege este gate es el de ADR-001/ADR-005: dos instancias de Sequelize
    // en el MISMO proceso se pelean las clases del paquete, y la segunda que registre el índice
    // las REASIGNA — `Objective.findAll()` empezaría a salir por la conexión equivocada y
    // rompería la separación lectura/escritura SIN UN SOLO SÍNTOMA. `codeOf()` descarta
    // comentarios a propósito: el de `read.ts` MENCIONA los modelos al explicarse, y el gate va
    // sobre lo que se EJECUTA, no sobre lo que se documenta.
    const code = codeOf(join(REPO_ROOT, 'core', 'src', 'models', 'read.ts'));

    code.includes('models:').should.be.false();
    code.includes('allModels').should.be.false();
  });

  it('TS-124 · CA-7: el yaml y la ficha coinciden, VALOR POR VALOR y en el MISMO ORDEN', () => {
    // Cierra el hueco de H-3/TS-95: TS-95 verifica que el recurso DECLARE las listas blancas,
    // pero no su CONTENIDO. El yaml puede desincronizarse de la ficha sin que nada lo note. Se
    // compara contra `attachmentsSpec` IMPORTADO, no una lista escrita a mano acá: escribirla a
    // mano crearía una TERCERA copia del contrato, que es justo el problema que este gate existe
    // para evitar. Sin parser YAML: se aísla el bloque del recurso como ya hace TS-95 y se lee
    // con un regex sobre `includable: [...]` / `filterable: [...]`.
    const source = spec();
    const block = source.slice(source.indexOf('\n  attachments:\n'));
    const own = block.slice(0, block.indexOf('\n\n  ') + 1 || undefined);

    const includableMatch = own.match(/\n {4}includable: \[([^\]]*)\]/);
    const filterableMatch = own.match(/\n {4}filterable: \[([^\]]*)\]/);
    if (includableMatch === null || filterableMatch === null) {
      throw new Error('el yaml no declara `includable`/`filterable` para `attachments`');
    }

    const yamlIncludable = includableMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    const yamlFilterable = filterableMatch[1].split(',').map((s) => s.trim()).filter(Boolean);

    yamlIncludable.should.deepEqual(attachmentsSpec.includableNames as string[]);
    yamlFilterable.should.deepEqual(attachmentsSpec.filterableNames as string[]);
  });

  it('TS-125 · CA-7, CA-18: la advertencia está escrita y lo que no cambia sigue igual', () => {
    const source = spec();
    const block = source.slice(source.indexOf('\n  attachments:\n'));
    const own = block.slice(0, block.indexOf('\n\n  ') + 1 || undefined);

    // Una frase corta y estable, no el párrafo entero: un gate sobre el texto completo falla con
    // cualquier reescritura de redacción y alguien termina borrándolo.
    own.includes('NADIE LO VERIFICA').should.be.true();

    (attachmentsSpec.sortableNames as string[]).should.deepEqual(['createdAt', 'id']);
    attachmentsSpec.defaults.sort!.should.deepEqual(['createdAt']);
    attachmentsSpec.truncatable!.should.deepEqual([]);
  });
});
