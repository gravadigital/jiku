import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import sinon from 'sinon';
import { Attachment, Objective, Project, Requirement, User, UserProjectPermission } from '@jiku/models';
import storageService from '../../lib/utils/storage-service';

// Tokens del mock:
// token_01_user   → sub: zitadel-sub-01, rol: user
// token_04_external_user → sub: zitadel-sub-04, rol: external-user

describe('POST /api/attachments', () => {
  let application: Application;
  let uploadStub: sinon.SinonStub;
  let deleteStub: sinon.SinonStub;

  before(function() {
    this.timeout(30000);
    application = start();

    uploadStub = sinon.stub(storageService, 'uploadFromBuffer').resolves({
      key: 'mocked-key',
      bucket: 'test-bucket',
      region: 'us-east-1',
      etag: 'etag-mock',
      size: 1024
    });
    deleteStub = sinon.stub(storageService, 'deleteFile').resolves({ deleted: true });

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'u1@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuser', email: 'ext@mail.com' }))
      .then(() => Project.create({
        id: 1, code: 'P1', name: 'Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        id: 1, title: 'Objective 1', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: 1, createdBy: 'zitadel-sub-01'
      }));
  });

  after(() => {
    uploadStub.restore();
    deleteStub.restore();
    return Attachment.destroy({ where: {}, force: true })
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Objective.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  afterEach(() => {
    uploadStub.resetHistory();
    deleteStub.resetHistory();
  });

  // TS-6: Sin token
  it('should fail without token', () => {
    return request(application)
      .post('/api/attachments')
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
      });
  });

  // TS-9: entityType faltante
  it('should fail when entityType is missing', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityId', '1')
      .attach('files', Buffer.from('test'), { filename: 'test.txt', contentType: 'text/plain' })
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_fields');
      });
  });

  // TS-10: entityId faltante
  it('should fail when entityId is missing', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'objective')
      .attach('files', Buffer.from('test'), { filename: 'test.txt', contentType: 'text/plain' })
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_fields');
      });
  });

  // TS-11: Sin archivos
  it('should fail when no files are attached', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'objective')
      .field('entityId', '1')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('no_files');
      });
  });

  // TS-12: entityType inválido
  it('should fail with invalid entityType', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'invoice')
      .field('entityId', '1')
      .attach('files', Buffer.from('test'), { filename: 'test.txt', contentType: 'text/plain' })
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_entity_type');
      });
  });

  // TS-4: Extensión no permitida (.exe)
  it('should fail with disallowed extension .exe', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'objective')
      .field('entityId', '1')
      .attach('files', Buffer.alloc(1024), { filename: 'malware.exe', contentType: 'application/octet-stream' })
      .expect(400)
      .then(res => {
        res.body.code.should.equal('upload_failed');
        res.body.message.should.containEql('.exe');
      });
  });

  // TS-5: Extensión no permitida (.sh)
  it('should fail with disallowed extension .sh', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'objective')
      .field('entityId', '1')
      .attach('files', Buffer.alloc(1024), { filename: 'script.sh', contentType: 'application/x-sh' })
      .expect(400)
      .then(res => {
        res.body.code.should.equal('upload_failed');
      });
  });

  // TS-8: Usuario externo sin permisos
  it('should fail with 403 for external user without permission', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .field('entityType', 'objective')
      .field('entityId', '1')
      .attach('files', Buffer.alloc(1024), { filename: 'test.pdf', contentType: 'application/pdf' })
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
      });
  });

  // TS-1: Upload exitoso de 1 archivo
  it('should upload a single valid file successfully', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'objective')
      .field('entityId', '1')
      .field('description', 'Test file')
      .attach('files', Buffer.alloc(1024), { filename: 'image.jpg', contentType: 'image/jpeg' })
      .expect(201)
      .then(res => {
        res.body.should.be.an.Array().with.length(1);
        res.body[0].should.have.properties([
          'id', 'entityType', 'entityId', 'fileName', 'fileSize',
          'mimeType', 'storageKey', 'storageBucket', 'uploadedBy', 'createdAt'
        ]);
        res.body[0].entityType.should.equal('objective');
        res.body[0].entityId.should.equal(1);
        res.body[0].fileName.should.equal('image.jpg');
        res.body[0].uploadedBy.should.equal('zitadel-sub-01');
        res.body[0].description.should.equal('Test file');
      });
  });

  // TS-2: Upload de múltiples archivos
  it('should upload multiple files in one request', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'project')
      .field('entityId', '1')
      .attach('files', Buffer.alloc(1024), { filename: 'a.pdf', contentType: 'application/pdf' })
      .attach('files', Buffer.alloc(1024), { filename: 'b.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      .expect(201)
      .then(res => {
        res.body.should.be.an.Array().with.length(2);
        uploadStub.callCount.should.equal(2);
      });
  });

  // TS-3: Archivo > 10MB (multer rechaza antes con 400 o handler lo captura)
  it('should fail with file exceeding 10MB', () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'objective')
      .field('entityId', '1')
      .attach('files', bigBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' })
      .then(res => {
        res.status.should.be.oneOf([400, 413]);
      });
  });

  // TS-15: Usuario externo con permisos sobre el proyecto del objective pero sin relación con el objetivo
  // Ahora recibe 403 porque project permission no es suficiente para objetivos: se requiere creador o asignado
  it('should deny external user with only project permission but no objective relation', () => {
    return UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: 1 })
      .then(() => {
        return request(application)
          .post('/api/attachments')
          .set('Authorization', 'Bearer token_04_external_user')
          .field('entityType', 'objective')
          .field('entityId', '1')
          .attach('files', Buffer.alloc(1024), { filename: 'allowed.pdf', contentType: 'application/pdf' })
          .expect(403);
      })
      .then(res => {
        res.body.code.should.equal('access_denied');
      });
  });

  // TS-13: Rollback cuando falla la BD
  it('should rollback Spaces upload if DB creation fails', () => {
    const createStub = sinon.stub(Attachment, 'create').rejects(new Error('DB constraint violation'));

    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'objective')
      .field('entityId', '1')
      .attach('files', Buffer.alloc(1024), { filename: 'rollback.jpg', contentType: 'image/jpeg' })
      .then(res => {
        createStub.restore();
        res.status.should.equal(500);
        deleteStub.calledOnce.should.be.true();
      });
  });

  // TS-15: Upload requirement_draft con entityId = projectId
  it('TS-15: should upload attachment with entityType requirement_draft and entityId as projectId', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'requirement_draft')
      .field('entityId', '1')
      .attach('files', Buffer.alloc(1024), { filename: 'draft.png', contentType: 'image/png' })
      .expect(201)
      .then((res) => {
        res.body.should.be.an.Array().with.length(1);
        res.body[0].entityType.should.equal('requirement_draft');
        res.body[0].entityId.should.equal(1);
      });
  });

  // S-047 / REQ-033: requirement_draft sin entityId → anclado al usuario (entity_id null)
  it('S-047: should upload requirement_draft without entityId, persisting entity_id null', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'requirement_draft')
      .attach('files', Buffer.alloc(1024), { filename: 'draft.png', contentType: 'image/png' })
      .expect(201)
      .then((res) => {
        res.body.should.be.an.Array().with.length(1);
        res.body[0].entityType.should.equal('requirement_draft');
        (res.body[0].entityId === null || res.body[0].entityId === undefined).should.be.true();
        return Attachment.findByPk(res.body[0].id).then((att) => {
          (att!.entityId === null).should.be.true();
          att!.uploadedBy.should.equal('zitadel-sub-01');
        });
      });
  });

  describe('comment_draft sobre requisitos (S-060)', () => {
    before(() => {
      return Project.create({
        id: 300, code: 'P300', name: 'Project 300', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      })
        .then(() => Promise.all([
          Requirement.create({
            id: 200,
            title: 'Requisito para comentario',
            description: 'Desc',
            type: 'funcionalidad',
            state: 'analisis',
            projectId: 1,
            createdBy: 'zitadel-sub-01',
          }),
          Requirement.create({
            id: 201,
            title: 'Requisito sin permiso',
            description: 'Desc',
            type: 'funcionalidad',
            state: 'analisis',
            projectId: 300,
            createdBy: 'zitadel-sub-01',
          }),
        ]));
    });

    after(() => {
      return UserProjectPermission.destroy({ where: { projectId: 300 } })
        .then(() => Requirement.destroy({ where: { id: [200, 201] } }))
        .then(() => Project.destroy({ where: { id: 300 } }));
    });

    // TS-26: usuario interno con permiso sobre el proyecto del requisito
    it('TS-26: should accept comment_draft with entityId as requirementId for internal user', () => {
      return request(application)
        .post('/api/attachments')
        .set('Authorization', 'Bearer token_01_user')
        .field('entityType', 'comment_draft')
        .field('entityId', '200')
        .attach('files', Buffer.alloc(1024), { filename: 'comment.pdf', contentType: 'application/pdf' })
        .expect(201)
        .then((res) => {
          res.body.should.be.an.Array().with.length(1);
          res.body[0].entityType.should.equal('comment_draft');
          res.body[0].entityId.should.equal(200);
          res.body[0].retentionStatus.should.equal('active');
        });
    });

    // TS-27: external-user sin permiso sobre el proyecto del requisito
    it('TS-27: should deny comment_draft with entityId as requirementId for external user without project permission', () => {
      return request(application)
        .post('/api/attachments')
        .set('Authorization', 'Bearer token_04_external_user')
        .field('entityType', 'comment_draft')
        .field('entityId', '201')
        .attach('files', Buffer.alloc(1024), { filename: 'comment.pdf', contentType: 'application/pdf' })
        .expect(403)
        .then((res) => {
          res.body.code.should.equal('access_denied');
        });
    });

    // Regresion: external-user CON permiso sobre el proyecto del requisito debe poder subir
    it('should allow comment_draft with entityId as requirementId for external user with project permission', () => {
      return UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: 300 })
        .then(() => {
          return request(application)
            .post('/api/attachments')
            .set('Authorization', 'Bearer token_04_external_user')
            .field('entityType', 'comment_draft')
            .field('entityId', '201')
            .attach('files', Buffer.alloc(1024), { filename: 'comment.pdf', contentType: 'application/pdf' })
            .expect(201);
        })
        .then((res) => {
          res.body.should.be.an.Array().with.length(1);
          res.body[0].entityType.should.equal('comment_draft');
          res.body[0].entityId.should.equal(201);
        });
    });
  });
});
