import 'mocha';
import 'should';
import { initDb } from '../mocks/app';
import { allModels, Attachment, AttachmentEntityType, ByteStatus, File, RetentionStatus, User } from '@jiku/models';

const BASE_FILE = {
  fileName: 'test.pdf',
  fileSize: 1024,
  mimeType: 'application/pdf',
  storageBucket: 'test-bucket',
  storageRegion: 'nyc3',
};

describe('File model', () => {
  let userId: string;

  before(function () {
    this.timeout(30000);
    return initDb().then(() => {
      return User.create({
        id: 'user-file-test-01',
        name: 'File Test User',
        username: 'filetest',
        email: 'filetest@mail.com',
      }).then((u) => {
        userId = u.id;
      });
    });
  });

  after(() => {
    // Orden hijo -> padre: el vínculo referencia al archivo, y el archivo al usuario.
    return Attachment.destroy({ where: {}, force: true })
      .then(() => File.destroy({ where: {}, force: true }))
      .then(() => User.destroy({ where: { id: 'user-file-test-01' } }));
  });

  // TS-34: crea con los obligatorios y los defaults salen 'pending' / 'active'
  it('should create a file with required fields and default statuses', () => {
    return File.create({
      ...BASE_FILE,
      storageKey: 'test/ts-34.pdf',
      uploadedBy: userId,
    }).then((file) => {
      file.id.should.be.a.Number();
      file.byteStatus.should.equal('pending');
      file.retentionStatus.should.equal('active');
      (file.checksum === null).should.be.true();
      (file.deletedAt === null).should.be.true();
      (file.deletedBy === null).should.be.true();
    });
  });

  // TS-35: storageKey duplicado rechaza
  it('should throw UniqueConstraintError on duplicate storageKey', () => {
    return File.create({
      ...BASE_FILE,
      storageKey: 'test/ts-35-dup.pdf',
      uploadedBy: userId,
    }).then(() => {
      return File.create({
        ...BASE_FILE,
        storageKey: 'test/ts-35-dup.pdf',
        uploadedBy: userId,
      }).should.be.rejected();
    });
  });

  // TS-36: checksum NO se excluye por default (a diferencia de Attachment)
  it('should return checksum by default, unlike Attachment', () => {
    return File.create({
      ...BASE_FILE,
      storageKey: 'test/ts-36.pdf',
      uploadedBy: userId,
      checksum: 'abc123',
    }).then((created) => {
      return File.findByPk(created.id);
    }).then((file) => {
      file!.checksum!.should.equal('abc123');
      Object.keys(file!.dataValues).should.containEql('checksum');
    });
  });

  // TS-37: isImage / isPdf / canPreview
  it('should expose isImage, isPdf and canPreview with Attachment semantics', () => {
    return File.create({
      ...BASE_FILE,
      storageKey: 'test/ts-37-image.png',
      uploadedBy: userId,
      mimeType: 'image/png',
    }).then((imagen) => {
      imagen.isImage().should.be.true();
      imagen.isPdf().should.be.false();
      imagen.canPreview().should.be.true();

      return File.create({
        ...BASE_FILE,
        storageKey: 'test/ts-37-text.txt',
        uploadedBy: userId,
        mimeType: 'text/plain',
      });
    }).then((texto) => {
      texto.isImage().should.be.false();
      texto.isPdf().should.be.false();
      texto.canPreview().should.be.false();
    });
  });

  // TS-38: sin tope de fileSize — el límite pasa a ser configurable por file-max-size-bytes
  it('should accept a fileSize above the old 10MB Attachment limit', () => {
    return File.create({
      ...BASE_FILE,
      storageKey: 'test/ts-38.zip',
      uploadedBy: userId,
      fileSize: 20971520,
    }).then((file) => {
      file.fileSize.should.equal(20971520);
    });
  });

  // TS-39: File.hasMany(Attachment)
  it('should bring both links through the attachments association', () => {
    return File.create({
      ...BASE_FILE,
      storageKey: 'test/ts-39.pdf',
      uploadedBy: userId,
    }).then((file) => {
      return Attachment.create({
        entityType: AttachmentEntityType.Objective,
        entityId: 1,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageKey: 'test/ts-39-a.pdf',
        storageBucket: 'test-bucket',
        storageRegion: 'nyc3',
        uploadedBy: userId,
        fileId: file.id,
      }).then(() => Attachment.create({
        entityType: AttachmentEntityType.Requirement,
        entityId: 2,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageKey: 'test/ts-39-b.pdf',
        storageBucket: 'test-bucket',
        storageRegion: 'nyc3',
        uploadedBy: userId,
        fileId: file.id,
      })).then(() => File.findByPk(file.id, { include: ['attachments'] }));
    }).then((file) => {
      (file as any).attachments.length.should.equal(2);
    });
  });

  // TS-40: Attachment.belongsTo(File)
  it('should bring the file through the attachment association', () => {
    return File.create({
      ...BASE_FILE,
      storageKey: 'test/ts-40.pdf',
      uploadedBy: userId,
      fileName: 'doc.pdf',
    }).then((file) => {
      return Attachment.create({
        entityType: AttachmentEntityType.Objective,
        entityId: 3,
        fileName: 'doc.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageKey: 'test/ts-40-a.pdf',
        storageBucket: 'test-bucket',
        storageRegion: 'nyc3',
        uploadedBy: userId,
        fileId: file.id,
      });
    }).then((attachment) => {
      return Attachment.findByPk(attachment.id, { include: ['file'] });
    }).then((attachment) => {
      (attachment as any).file.fileName.should.equal('doc.pdf');
    });
  });

  // TS-41: registrado en allModels — si falta, ningún servicio registra el modelo
  it('should be registered in allModels', () => {
    allModels.includes(File).should.be.true();
  });

  // Los enums exportados por el paquete
  it('should export ByteStatus enum with correct values', () => {
    ByteStatus.Pending.should.equal('pending');
    ByteStatus.Uploaded.should.equal('uploaded');
  });

  // TS-34 (parte): reutiliza el RetentionStatus de attachment.model, no define uno propio
  it('should reuse the RetentionStatus enum for retentionStatus', () => {
    return File.create({
      ...BASE_FILE,
      storageKey: 'test/ts-retention.pdf',
      uploadedBy: userId,
      retentionStatus: RetentionStatus.ScheduledForDeletion,
    }).then((file) => {
      file.retentionStatus.should.equal('scheduled_for_deletion');
    });
  });
});
