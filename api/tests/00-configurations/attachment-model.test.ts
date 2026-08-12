import 'mocha';
import 'should';
import { initDb } from '../mocks/app';
import { Attachment, AttachmentEntityType, RetentionStatus, User } from '@jiku/models';

const BASE_ATTACHMENT = {
  entityType: AttachmentEntityType.Objective,
  entityId: 1,
  fileName: 'test.pdf',
  fileSize: 1024,
  mimeType: 'application/pdf',
  storageKey: 'test/key.pdf',
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
      .then(() => User.destroy({ where: { id: 'user-attach-test-01' } }));
  });

  // TS-1: Crear attachment con todos los campos obligatorios
  it('should create an attachment with required fields', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-1.pdf',
      uploadedBy: userId,
    }).then((attachment) => {
      attachment.id.should.be.a.Number();
      attachment.entityType.should.equal('objective');
      attachment.retentionStatus.should.equal('active');
      attachment.fileName.should.equal('test.pdf');
      attachment.fileSize.should.equal(1024);
      (attachment.deletedAt === null).should.be.true();
      (attachment.deletedBy === null).should.be.true();
    });
  });

  // TS-2: DefaultScope excluye campo checksum
  it('should exclude checksum field by default', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-2.pdf',
      uploadedBy: userId,
      checksum: 'abc123',
    }).then((created) => {
      return Attachment.findByPk(created.id);
    }).then((attachment) => {
      Object.keys(attachment!.dataValues).should.not.containEql('checksum');
    });
  });

  // TS-3: Crear sin campo obligatorio (fileName)
  it('should throw ValidationError when fileName is missing', () => {
    return Attachment.create({
      entityType: AttachmentEntityType.Objective,
      entityId: 1,
      fileSize: 1024,
      mimeType: 'application/pdf',
      storageKey: 'test/ts-3.pdf',
      storageBucket: 'test-bucket',
      storageRegion: 'nyc3',
      uploadedBy: userId,
    } as any).should.be.rejected();
  });

  // TS-4: Crear con fileSize = 0
  it('should throw ValidationError when fileSize is 0', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-4.pdf',
      uploadedBy: userId,
      fileSize: 0,
    }).should.be.rejected();
  });

  // TS-5: Crear con fileSize > 10MB
  it('should throw ValidationError when fileSize exceeds 10MB', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-5.pdf',
      uploadedBy: userId,
      fileSize: 10485761,
    }).should.be.rejected();
  });

  // TS-6: Enums AttachmentEntityType exportados y usables
  it('should export AttachmentEntityType enum with correct values', () => {
    AttachmentEntityType.Objective.should.equal('objective');
    AttachmentEntityType.Project.should.equal('project');
    AttachmentEntityType.Stage.should.equal('stage');
  });

  // TS-7: Enums RetentionStatus exportados y usables
  it('should export RetentionStatus enum with correct values', () => {
    RetentionStatus.Active.should.equal('active');
    RetentionStatus.ScheduledForDeletion.should.equal('scheduled_for_deletion');
    RetentionStatus.Deleted.should.equal('deleted');
  });

  // TS-8: Include uploader retorna datos del usuario que subió
  it('should include uploader data when queried with include', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-8.pdf',
      uploadedBy: userId,
    }).then((created) => {
      return Attachment.findByPk(created.id, {
        include: [{ model: User, as: 'uploader' }],
      });
    }).then((attachment) => {
      attachment!.should.have.property('uploader');
      (attachment as any).uploader.id.should.equal(userId);
      (attachment as any).uploader.should.have.property('name');
    });
  });

  // TS-9: Include deleter retorna null si no fue eliminado
  it('should return null deleter when attachment has not been soft deleted', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-9.pdf',
      uploadedBy: userId,
    }).then((created) => {
      return Attachment.findByPk(created.id, {
        include: [{ model: User, as: 'deleter' }],
      });
    }).then((attachment) => {
      ((attachment as any).deleter === null).should.be.true();
    });
  });

  // TS-10: Include deleter retorna User tras soft delete
  it('should include deleter data after softDelete with userId', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-10.pdf',
      uploadedBy: userId,
    }).then((created) => {
      return created.softDelete(userId).then(() => {
        return Attachment.findByPk(created.id, {
          include: [{ model: User, as: 'deleter' }],
        });
      });
    }).then((attachment) => {
      (attachment as any).deleter.id.should.equal(userId);
    });
  });

  // TS-11: Scope 'active' solo retorna attachments no eliminados
  it('should return only active attachments when using scope active', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-11a.pdf',
      uploadedBy: userId,
    }).then(() => {
      return Attachment.create({
        ...BASE_ATTACHMENT,
        storageKey: 'test/ts-11b.pdf',
        uploadedBy: userId,
      }).then((a2) => {
        return a2.softDelete().then(() => {
          return Attachment.scope('active').findAll({
            where: { storageKey: ['test/ts-11a.pdf', 'test/ts-11b.pdf'] },
          });
        });
      }).then((results) => {
        results.length.should.equal(1);
        results[0].storageKey.should.equal('test/ts-11a.pdf');
      });
    });
  });

  // TS-12: Scope 'active' excluye attachments con deletedAt seteado manualmente
  it('should exclude attachment with manually set deletedAt from active scope', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-12.pdf',
      uploadedBy: userId,
    }).then((attachment) => {
      return attachment.update({ deletedAt: new Date() });
    }).then(() => {
      return Attachment.scope('active').findAll({
        where: { storageKey: 'test/ts-12.pdf' },
      });
    }).then((results) => {
      results.length.should.equal(0);
    });
  });

  // TS-13: destroy() sin force no elimina físicamente el registro
  it('should throw error on destroy() without force and keep record in DB', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-13.pdf',
      uploadedBy: userId,
    }).then((attachment) => {
      const attachmentId = attachment.id;
      return attachment.destroy().should.be.rejected().then(() => {
        return Attachment.findByPk(attachmentId);
      }).then((found) => {
        found!.should.not.be.null();
        found!.id.should.equal(attachmentId);
      });
    });
  });

  // TS-14: softDelete(userId) setea los tres campos correctamente
  it('should set retentionStatus, deletedAt, and deletedBy on softDelete with userId', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-14.pdf',
      uploadedBy: userId,
    }).then((attachment) => {
      return attachment.softDelete(userId).then(() => attachment.reload());
    }).then((attachment) => {
      attachment.retentionStatus.should.equal('scheduled_for_deletion');
      attachment.deletedAt!.should.not.be.null();
      attachment.deletedBy!.should.equal(userId);
    });
  });

  // TS-15: softDelete() sin userId deja deletedBy en null
  it('should leave deletedBy as null on softDelete without userId', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-15.pdf',
      uploadedBy: userId,
    }).then((attachment) => {
      return attachment.softDelete().then(() => attachment.reload());
    }).then((attachment) => {
      attachment.retentionStatus.should.equal('scheduled_for_deletion');
      attachment.deletedAt!.should.not.be.null();
      (attachment.deletedBy === null).should.be.true();
    });
  });

  // TS-16: isImage() retorna true para imágenes
  it('should return true from isImage() for image mimeType', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-16.png',
      uploadedBy: userId,
      mimeType: 'image/png',
    }).then((attachment) => {
      attachment.isImage().should.be.true();
    });
  });

  // TS-17: isPdf() retorna true para PDFs
  it('should return true from isPdf() for application/pdf mimeType', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-17.pdf',
      uploadedBy: userId,
      mimeType: 'application/pdf',
    }).then((attachment) => {
      attachment.isPdf().should.be.true();
    });
  });

  // TS-18: canPreview() retorna false para tipos no previewables
  it('should return false from canPreview() for non-previewable mimeType', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-18.zip',
      uploadedBy: userId,
      mimeType: 'application/zip',
    }).then((attachment) => {
      attachment.canPreview().should.be.false();
    });
  });

  // TS-19: storageKey debe ser único en la BD
  it('should throw UniqueConstraintError on duplicate storageKey', () => {
    return Attachment.create({
      ...BASE_ATTACHMENT,
      storageKey: 'test/ts-19-unique.pdf',
      uploadedBy: userId,
    }).then(() => {
      return Attachment.create({
        ...BASE_ATTACHMENT,
        storageKey: 'test/ts-19-unique.pdf',
        uploadedBy: userId,
      }).should.be.rejected();
    });
  });
});
