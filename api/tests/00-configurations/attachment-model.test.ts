import 'mocha';
import 'should';
import { initDb } from '../mocks/app';
import { Attachment, AttachmentEntityType, File, RetentionStatus, User } from '@jiku/models';

/**
 * REESCRITO por el cierre de REQ-001. La migración `20260819_05` dropeó de `attachments` las
 * 10 columnas que este archivo probaba —los metadatos del archivo, `checksum`, `description` y
 * `retention_status`—, así que 16 de sus 19 escenarios probaban un modelo que ya no existe.
 *
 * QUÉ SE FUE Y POR QUÉ:
 *   - `fileName` / `fileSize` / `mimeType` / `storageKey` / `storageBucket` / `storageRegion` /
 *     `uploadedBy` -> migraron a `files`. Sus tests viven en `file-model.test.ts`.
 *   - El `DefaultScope` que excluía `checksum` -> la columna es de `files`.
 *   - `softDelete()` / `retentionStatus` -> el ciclo de retención es del ARCHIVO (D-04).
 *     Desvincular es BORRAR la fila, porque un `File` tiene 0..N vínculos y marcar el vínculo
 *     no diría nada sobre los otros.
 *   - `isImage()` / `isPdf()` / `canPreview()` -> leían `this.mimeType`, que ya no está acá.
 *
 * Lo que queda son las cuatro cosas que el vínculo sigue siendo: el par polimórfico, la FK al
 * archivo, la asociación al archivo y la guarda del borrado.
 */

const BASE_ATTACHMENT = {
  entityType: AttachmentEntityType.Objective,
  entityId: 1,
};

const BASE_FILE = {
  fileName: 'test.pdf',
  fileSize: 1024,
  mimeType: 'application/pdf',
  storageBucket: 'test-bucket',
  storageRegion: 'nyc3',
};

describe('Attachment model', () => {
  let userId: string;

  before(function () {
    this.timeout(30000);
    return initDb().then(() => {
      return User.create({
        id: 'user-attach-test-01',
        name: 'Attach Test User',
        username: 'attachtest',
        email: 'attachtest@mail.com',
      }).then((u) => {
        userId = u.id;
      });
    });
  });

  after(() => {
    return Attachment.destroy({ where: {}, force: true })
      .then(() => File.destroy({ where: {}, force: true }))
      .then(() => User.destroy({ where: { id: 'user-attach-test-01' } }));
  });

  /** Un `File` por test: `storage_key` sigue siendo UNIQUE en `files`. */
  function makeFile(key: string) {
    return File.create({
      ...BASE_FILE,
      storageKey: `test/${key}.pdf`,
      uploadedBy: userId,
    });
  }

  // TS-1: el vínculo se crea con el par polimórfico y la FK al archivo, y NADA MÁS.
  it('should create an attachment with required fields', () => {
    return makeFile('ts-1').then((file) => {
      return Attachment.create({ ...BASE_ATTACHMENT, fileId: file.id });
    }).then((attachment) => {
      attachment.id.should.be.a.Number();
      attachment.entityType.should.equal('objective');
      attachment.entityId!.should.equal(1);
      (attachment.deletedAt === null).should.be.true();
      (attachment.deletedBy === null).should.be.true();
    });
  });

  // TS-2: el modelo NO declara ninguna de las columnas que dropeó la 20260819_05.
  //
  // Es la guarda contra la divergencia que rompió la vinculación en producción: los tests
  // corren contra el esquema que `sync()` construye DESDE EL MODELO, así que una columna de
  // más acá es una columna que existe para los tests y no en la base.
  it('should not declare any of the columns dropped by 20260819_05', () => {
    const columnas = Object.values(Attachment.getAttributes())
      .map((attribute: any) => attribute.field as string);

    const dropeadas = [
      'file_name', 'file_size', 'mime_type', 'storage_key', 'storage_bucket',
      'storage_region', 'uploaded_by', 'checksum', 'retention_status', 'description',
    ];

    const sobrantes = dropeadas.filter((columna) => columnas.includes(columna));
    sobrantes.should.deepEqual([], `El modelo declara columnas inexistentes: ${sobrantes.join(', ')}`);
  });

  // TS-3: los enums siguen exportados y usables.
  it('should export AttachmentEntityType enum with correct values', () => {
    AttachmentEntityType.Objective.should.equal('objective');
    AttachmentEntityType.Project.should.equal('project');
    AttachmentEntityType.Requirement.should.equal('requirement');
    AttachmentEntityType.ObjectiveComment.should.equal('objective_comment');
    AttachmentEntityType.RequirementComment.should.equal('requirement_comment');
  });

  // TS-4: `RetentionStatus` se sigue re-exportando desde acá, aunque la columna sea de `files`.
  it('should export RetentionStatus enum with correct values', () => {
    RetentionStatus.Active.should.equal('active');
    RetentionStatus.ScheduledForDeletion.should.equal('scheduled_for_deletion');
    RetentionStatus.Deleted.should.equal('deleted');
  });

  // TS-5: el include del ARCHIVO resuelve los metadatos. Es el reemplazo de las columnas
  // homónimas: después de la 20260819_05 la respuesta de la api no tiene nombre ni tamaño sin
  // este include.
  it('should include file data when queried with include', () => {
    return makeFile('ts-5').then((file) => {
      return Attachment.create({ ...BASE_ATTACHMENT, fileId: file.id });
    }).then((attachment) => {
      return Attachment.findByPk(attachment.id, {
        include: [{ model: File, as: 'file' }],
      });
    }).then((found) => {
      found!.file!.fileName.should.equal('test.pdf');
      found!.file!.uploadedBy.should.equal(userId);
    });
  });

  // TS-6: `deleter` sigue colgando del vínculo — `deleted_by` NO se dropeó.
  it('should return null deleter when attachment has not been deleted', () => {
    return makeFile('ts-6').then((file) => {
      return Attachment.create({ ...BASE_ATTACHMENT, fileId: file.id });
    }).then((attachment) => {
      return Attachment.findByPk(attachment.id, {
        include: [{ model: User, as: 'deleter' }],
      });
    }).then((found) => {
      ((found as any).deleter === null).should.be.true();
    });
  });

  // TS-7: el scope `active` filtra por `deletedAt`, que sigue existiendo en el vínculo.
  it('should exclude attachment with deletedAt set from active scope', () => {
    return makeFile('ts-7').then((file) => {
      return Attachment.create({ ...BASE_ATTACHMENT, entityId: 707, fileId: file.id });
    }).then((attachment) => {
      return attachment.update({ deletedAt: new Date() });
    }).then(() => {
      return Attachment.scope('active').findAll({ where: { entityId: 707 } });
    }).then((results) => {
      results.length.should.equal(0);
    });
  });

  // TS-8: `destroy()` sin `force` sigue bloqueado.
  //
  // Ya NO es porque haya un borrado lógico alternativo —`softDelete()` se fue con la columna—
  // sino para que borrar un vínculo sea siempre explícito en el call site.
  it('should throw error on destroy() without force and keep record in DB', () => {
    let attachmentId: number;
    return makeFile('ts-8').then((file) => {
      return Attachment.create({ ...BASE_ATTACHMENT, fileId: file.id });
    }).then((attachment) => {
      attachmentId = attachment.id;
      return attachment.destroy().then(
        () => { throw new Error('destroy() sin force debería haber lanzado'); },
        () => Attachment.findByPk(attachmentId)
      );
    }).then((found) => {
      (found !== null).should.be.true();
    });
  });

  // TS-9: `destroy({ force: true })` borra la fila. Desvincular es esto.
  it('should hard delete the link with force: true', () => {
    let attachmentId: number;
    let fileId: number;
    return makeFile('ts-9').then((file) => {
      fileId = file.id;
      return Attachment.create({ ...BASE_ATTACHMENT, fileId: file.id });
    }).then((attachment) => {
      attachmentId = attachment.id;
      return attachment.destroy({ force: true });
    }).then(() => {
      return Attachment.findByPk(attachmentId);
    }).then((found) => {
      (found === null).should.be.true();
      // Y EL ARCHIVO SOBREVIVE: desvincular nunca borra el `File` (D-04).
      return File.findByPk(fileId);
    }).then((file) => {
      (file !== null).should.be.true();
    });
  });

  // TS-10: un `File` admite 0..N vínculos (CA-13).
  it('should allow two attachments to share the same file (0..N links per file)', () => {
    return makeFile('ts-10').then((file) => {
      return Attachment.create({
        ...BASE_ATTACHMENT, entityType: AttachmentEntityType.Requirement, entityId: 10, fileId: file.id,
      }).then(() => {
        return Attachment.create({
          ...BASE_ATTACHMENT, entityType: AttachmentEntityType.Objective, entityId: 11, fileId: file.id,
        });
      });
    }).then((second) => {
      second.id.should.be.a.Number();
    });
  });
});
