import 'mocha';
import 'should';
import * as sinon from 'sinon';
import { ErrorCode, Reply } from '@jiku/nats-protocol';
import { readDb } from '../../src/models/read';
import { dispatchQuery } from '../helpers/dispatch';
import {
  CREATOR,
  PROJECT_MAIN,
  PROJECT_OTHER,
  Q_EXTERNAL,
  Q_INTERNAL,
  Q_MIXED,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
  grantProjects,
} from './task-fixtures';
import { createDomainWorld, destroyDomainWorld } from './domain-fixtures';
import {
  CA_INTERNAL,
  CA_MAIN,
  CR_MAIN,
  Q_EXTERNAL_2,
  REQ_MAIN,
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
  FILE_LINKED_NAME,
  createFileWorld,
  destroyFileWorld,
  getInternalTaskFileId,
  getLinkedFileId,
  getOnlyForeignFileId,
  getOrphanMineFileId,
  getOrphanTheirsFileId,
  getPurgedFileId,
  getUnlinkedAgainFileId,
} from './file-fixtures';

/**
 * `files.get` CONTRA BASE REAL, por el despachador (S-027).
 *
 * LO QUE DECIDE SI LA TAREA SALIÓ BIEN ES EL RECORTE. La rama (A) —entidad visible— es la
 * evidente; la rama (B) —archivo sin vínculo VIVO, solo quien lo subió— es la que se olvida, y su
 * ausencia rompe el flujo de subida: un externo sube un archivo y no puede consultarlo hasta
 * vincularlo. Y al revés: implementarla como un `orSelfColumn` la hace DEMASIADO ANCHA.
 *
 * SON CUATRO CASOS, NO DOS (TS-80, TS-81, TS-83, TS-84): sin vínculo × mío/ajeno, con vínculo ×
 * visible/no visible. TS-84 es el único que falla si alguien lo implementó ancho.
 */

interface FileItem extends Record<string, unknown> {
  id: number;
}

function data(reply: Reply<FileItem>): FileItem {
  reply.status.should.equal('success', JSON.stringify(reply));
  return reply.data!;
}

function failed(reply: Reply<unknown>): Reply<unknown> {
  reply.status.should.equal('failure', JSON.stringify(reply));
  return reply;
}

describe('queries/files — el contrato del recurso (S-027)', () => {
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
   * CA-6, CA-9 · LA FORMA DEL RECURSO
   * ---------------------------------------------------------------------------------------- */

  it('TS-69 · el camino feliz con `checksum`: las ocho de base más una, y NI UNA CLAVE MÁS', async () => {
    const item = data(
      await dispatchQuery<FileItem>('files.get', {
        id: getLinkedFileId(),
        include: ['checksum'],
      })
    );

    Object.keys(item).should.deepEqual([
      'id',
      'fileName',
      'fileSize',
      'mimeType',
      'byteStatus',
      'retentionStatus',
      'uploadedBy',
      'createdAt',
      'checksum',
    ]);
    item.fileName!.should.equal(FILE_LINKED_NAME);
    item.checksum!.should.equal(FILE_LINKED_CHECKSUM);
    item.retentionStatus!.should.equal('active');
  });

  it('TS-70 · la base SIN `checksum`: es incluible y no base (RF-17)', async () => {
    const item = data(await dispatchQuery<FileItem>('files.get', { id: getLinkedFileId() }));

    Object.keys(item).length.should.equal(8);
    (item.checksum === undefined).should.be.true();
  });

  it('TS-71 · un `checksum` nulo se devuelve como `null`, no se omite', async () => {
    const item = data(
      await dispatchQuery<FileItem>(
        'files.get',
        { id: getOrphanMineFileId(), include: ['checksum'] },
        Q_INTERNAL
      )
    );

    (item.checksum === null).should.be.true();
  });

  /* ------------------------------------------------------------------------------------------
   * CA-7, CA-8 · LOS CAMPOS PROHIBIDOS Y LAS CERO URLS
   * ---------------------------------------------------------------------------------------- */

  const FORBIDDEN = ['storageKey', 'storageBucket', 'storageRegion'];

  it('TS-72 · CA-7: los tres campos de ubicación física en `fields`', async () => {
    for (const forbidden of FORBIDDEN) {
      const error = failed(
        await dispatchQuery('files.get', { id: getLinkedFileId(), fields: [forbidden] })
      );

      error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS, forbidden);
      error.errorDetails!.field!.should.equal('fields');
      error.errorDetails!.value!.should.equal(forbidden);
      (error.errorDetails!.allowed as string[]).should.deepEqual([
        'id',
        'fileName',
        'fileSize',
        'mimeType',
        'byteStatus',
        'retentionStatus',
        'uploadedBy',
        'createdAt',
        'checksum',
      ]);
    }
  });

  it('TS-73 · CA-7: los tres en `include`', async () => {
    for (const forbidden of FORBIDDEN) {
      const error = failed(
        await dispatchQuery('files.get', { id: getLinkedFileId(), include: [forbidden] })
      );

      error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS, forbidden);
      (error.errorDetails!.allowed as string[]).should.deepEqual(['checksum']);
    }
  });

  it('TS-74 · CA-7: `filter` no es una palanca de un `get`', async () => {
    const error = failed(
      await dispatchQuery('files.get', { id: getLinkedFileId(), filter: { storageKey: 'x' } })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.value!.should.equal('filter');
  });

  it('TS-75 · las otras tres palancas de `list` tampoco aplican', async () => {
    for (const payload of [
      { id: 4, sort: ['id'] },
      { id: 4, page: { limit: 1 } },
      { id: 4, count: true },
    ]) {
      const error = failed(await dispatchQuery('files.get', payload));

      error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS, JSON.stringify(payload));
      // Las claves de primer nivel de este `get` son exactamente tres: no hay discriminador.
      (error.errorDetails!.allowed as string[]).should.deepEqual(['id', 'fields', 'include']);
    }
  });

  it('TS-76 · un `get` sin `id`', async () => {
    const error = failed(await dispatchQuery('files.get', { include: ['checksum'] }));

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('id');
  });

  it('TS-77 · CA-8: CERO URLS en la respuesta completa', async () => {
    // `files.get` devuelve METADATOS. Obtener los bytes sigue siendo el comando
    // `files.{fileId}.request-download`: mintear una prefirmada es un EFECTO, y una consulta es
    // idempotente y sin efectos.
    const reply = await dispatchQuery<FileItem>('files.get', {
      id: getLinkedFileId(),
      include: ['checksum'],
    });
    const serialized = JSON.stringify(reply);

    for (const forbidden of ['http', 'storage', 'downloadUrl', 'expiresIn', 'X-Amz']) {
      serialized.should.not.containEql(forbidden);
    }
  });

  /* ------------------------------------------------------------------------------------------
   * CA-10 · `file_not_found` Y SUS TRES CAUSAS, CON EL MISMO MENSAJE
   * ---------------------------------------------------------------------------------------- */

  it('TS-78 · CA-10: un archivo NO RETENIDO responde `file_not_found`', async () => {
    // El predicado es DEL RECURSO y no del filtro: el ciclo de retención de REQ-001 no es
    // negociable por payload.
    const error = failed(await dispatchQuery('files.get', { id: getPurgedFileId() }, Q_INTERNAL));

    error.errorCode!.should.equal(ErrorCode.FILE_NOT_FOUND);
    error.errorMessage!.should.equal('No existe un archivo con ese id');
  });

  it('TS-79 · un id inexistente responde EXACTAMENTE LO MISMO', async () => {
    const missing = failed(await dispatchQuery('files.get', { id: 999999 }, Q_INTERNAL));
    const purged = failed(await dispatchQuery('files.get', { id: getPurgedFileId() }, Q_INTERNAL));

    missing.errorCode!.should.equal(ErrorCode.FILE_NOT_FOUND);
    // MISMO CÓDIGO Y MISMO MENSAJE: distinguirlos le confirmaría a un externo que el archivo
    // existe (RF-31).
    missing.errorMessage!.should.equal(purged.errorMessage!);
  });

  /* ------------------------------------------------------------------------------------------
   * CA-11, CA-12 · LAS CUATRO RAMAS DEL RECORTE EXTERNO
   * ---------------------------------------------------------------------------------------- */

  it('TS-80 · CA-11 caso A: SIN vínculo y lo subió ÉL -> lo ve', async () => {
    // Un archivo con 0 vínculos es un estado válido (REQ-001). Sin esta rama, un externo sube un
    // archivo y NO PUEDE CONSULTARLO hasta vincularlo.
    const item = data(
      await dispatchQuery<FileItem>('files.get', { id: getOrphanMineFileId() }, Q_EXTERNAL)
    );

    item.id.should.equal(getOrphanMineFileId());
    item.uploadedBy!.should.equal(Q_EXTERNAL);
  });

  it('TS-81 · CA-11 caso B: SIN vínculo y lo subió OTRO -> `file_not_found`', async () => {
    const error = failed(
      await dispatchQuery('files.get', { id: getOrphanTheirsFileId() }, Q_EXTERNAL)
    );

    error.errorCode!.should.equal(ErrorCode.FILE_NOT_FOUND);
    error.errorMessage!.should.equal('No existe un archivo con ese id');
  });

  it('TS-82 · la simetría del caso B: el otro externo tampoco ve el mío', async () => {
    const error = failed(
      await dispatchQuery('files.get', { id: getOrphanMineFileId() }, Q_EXTERNAL_2)
    );

    error.errorCode!.should.equal(ErrorCode.FILE_NOT_FOUND);
  });

  it('TS-83 · CA-12: con vínculo a una entidad VISIBLE -> lo ve', async () => {
    const item = data(
      await dispatchQuery<FileItem>('files.get', { id: getLinkedFileId() }, Q_EXTERNAL)
    );

    item.id.should.equal(getLinkedFileId());
  });

  it('TS-84 · CA-12 + H-4: vínculo VIVO solo a entidad AJENA, subido por el caller -> NO lo ve', async () => {
    // ES EL TEST QUE DISTINGUE ESTE RECORTE DE UN `orSelfColumn` COPIADO. Con la semántica ancha
    // —"la fila propia entra siempre"— este archivo se le filtraría a quien lo subió, y CA-12 dice
    // exactamente lo contrario: si ninguna de sus entidades dueñas es visible, `file_not_found`.
    const error = failed(
      await dispatchQuery('files.get', { id: getOnlyForeignFileId() }, Q_EXTERNAL)
    );

    error.errorCode!.should.equal(ErrorCode.FILE_NOT_FOUND);
  });

  it('TS-85 · vínculo vivo a una tarea INTERNA de un proyecto permitido -> NO lo ve', async () => {
    const error = failed(
      await dispatchQuery('files.get', { id: getInternalTaskFileId() }, Q_EXTERNAL)
    );

    error.errorCode!.should.equal(ErrorCode.FILE_NOT_FOUND);
  });

  it('TS-86 · EL VÍNCULO BORRADO DEVUELVE EL ARCHIVO A SU DUEÑO', async () => {
    // El vínculo se borró, el archivo se retuvo: la rama (B) vuelve a aplicar, y es el estado
    // normal de un archivo al que le sacaron el adjunto.
    const item = data(
      await dispatchQuery<FileItem>('files.get', { id: getUnlinkedAgainFileId() }, Q_EXTERNAL)
    );

    item.id.should.equal(getUnlinkedAgainFileId());
  });

  it('TS-87 · …y NO al que no lo subió', async () => {
    const error = failed(
      await dispatchQuery('files.get', { id: getUnlinkedAgainFileId() }, Q_EXTERNAL_2)
    );

    error.errorCode!.should.equal(ErrorCode.FILE_NOT_FOUND);
  });

  /* ------------------------------------------------------------------------------------------
   * LOS OTROS DOS MODOS DE CALLER
   * ---------------------------------------------------------------------------------------- */

  it('TS-88 · el modo INTERNO ve cualquier archivo activo (RF-23)', async () => {
    const item = data(
      await dispatchQuery<FileItem>('files.get', { id: getOnlyForeignFileId() }, Q_INTERNAL)
    );

    item.id.should.equal(getOnlyForeignFileId());
  });

  it('TS-89 · …pero NO el no retenido: `retention_status` es del RECURSO, no del recorte', async () => {
    failed(
      await dispatchQuery('files.get', { id: getPurgedFileId() }, Q_INTERNAL)
    ).errorCode!.should.equal(ErrorCode.FILE_NOT_FOUND);
  });

  it('TS-90 · el caller CONECTOR (el publicador confiable) tampoco', async () => {
    failed(
      await dispatchQuery('files.get', { id: getPurgedFileId() })
    ).errorCode!.should.equal(ErrorCode.FILE_NOT_FOUND);
  });

  it('TS-91 · un campo de identidad en el payload', async () => {
    const error = failed(
      await dispatchQuery('files.get', { id: getLinkedFileId(), caller: 'otro' })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorMessage!.should.containEql('sale del subject');
  });

  it('TS-106 · un error inesperado es `internal_error` y NO filtra el subject', async () => {
    sinon.stub(readDb, 'query').rejects(new Error('boom'));

    const error = failed(await dispatchQuery('files.get', { id: getLinkedFileId() }, Q_INTERNAL));

    error.errorCode!.should.equal(ErrorCode.INTERNAL_ERROR);
    error.errorMessage!.should.not.containEql(Q_INTERNAL);
    error.errorMessage!.should.not.containEql('jiku-queries');
  });

  it('el modo externo ve el archivo del CREADOR si su entidad es visible (no hace falta subirlo)', async () => {
    // La rama (A) NO mira `uploaded_by`: lo que decide es la ENTIDAD DUEÑA. `FILE_LINKED` lo subió
    // el creador y el externo lo ve igual.
    const item = data(
      await dispatchQuery<FileItem>('files.get', { id: getLinkedFileId() }, Q_EXTERNAL)
    );

    item.uploadedBy!.should.equal(CREATOR);
  });
});
