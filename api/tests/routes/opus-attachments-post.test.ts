import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import sinon from 'sinon';
import { Attachment, Objective, Project, Requirement, User, UserProjectPermission } from '@jiku/models';
import storageService from '../../lib/utils/storage-service';

// Tokens del mock:
// token_01_user            → sub: zitadel-sub-01, rol: user
// token_04_external_user   → sub: zitadel-sub-04, rol: external-user

describe('POST /api/opus/attachments', () => {
  let application: Application;
  let uploadStub: sinon.SinonStub;
  let deleteStub: sinon.SinonStub;

  const projectId = 6000;
  const projectNoPermId = 6001;
  let objectiveId: number;
  let objectiveNoPermId: number;

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

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01opus', email: 'user01opus@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuser04opus', email: 'extopus@mail.com' }))
      .then(() => Project.create({
        id: projectId, code: 'OP1', name: 'Opus Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Project.create({
        id: projectNoPermId, code: 'OP2', name: 'Opus Project 2', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        title: 'Opus Objective 1', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: projectId, createdBy: 'zitadel-sub-01'
      }))
      .then((obj) => { objectiveId = obj.id; })
      .then(() => Objective.create({
        title: 'Opus Objective NoPerm', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: projectNoPermId, createdBy: 'zitadel-sub-01'
      }))
      .then((obj) => { objectiveNoPermId = obj.id; })
      .then(() => UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: projectId }));
  });

  after(() => {
    uploadStub.restore();
    deleteStub.restore();
    return Attachment.destroy({ where: {}, force: true })
      .then(() => UserProjectPermission.destroy({ where: { userId: 'zitadel-sub-04', projectId: projectId } }))
      .then(() => Objective.destroy({ where: { projectId: [projectId, projectNoPermId] } }))
      .then(() => Project.destroy({ where: { id: [projectId, projectNoPermId] } }))
      .then(() => User.destroy({ where: { id: ['zitadel-sub-01', 'zitadel-sub-04'] } }));
  });

  afterEach(() => {
    uploadStub.resetHistory();
    deleteStub.resetHistory();
  });

  // TS-1: Upload exitoso comment_draft
  it('TS-1: should upload a file as comment_draft and return 201', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .field('entityType', 'comment_draft')
      .field('entityId', String(objectiveId))
      .attach('files', Buffer.alloc(1024), { filename: 'imagen.png', contentType: 'image/png' })
      .expect(201)
      .then(res => {
        res.body.should.be.an.Array().with.length(1);
        res.body[0].entityType.should.equal('comment_draft');
        res.body[0].entityId.should.equal(objectiveId);
        res.body[0].fileName.should.equal('imagen.png');
        res.body[0].mimeType.should.equal('image/png');
        res.body[0].uploadedBy.should.equal('zitadel-sub-04');
        res.body[0].should.have.properties(['id', 'storageKey', 'storageBucket', 'storageRegion', 'createdAt']);
      });
  });

  // TS-2: Upload exitoso objective
  it('TS-2: should upload a file as objective and return 201', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .field('entityType', 'objective')
      .field('entityId', String(objectiveId))
      .attach('files', Buffer.alloc(1024), { filename: 'doc.pdf', contentType: 'application/pdf' })
      .expect(201)
      .then(res => {
        res.body.should.be.an.Array().with.length(1);
        res.body[0].entityType.should.equal('objective');
        res.body[0].fileName.should.equal('doc.pdf');
      });
  });

  // TS-3: Archivo >10MB → 400 upload_failed
  it('TS-3: should fail with 400 when file exceeds 10MB', function() {
    this.timeout(10000);
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024);
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .field('entityType', 'comment_draft')
      .field('entityId', String(objectiveId))
      .attach('files', bigBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' })
      .then(res => {
        res.status.should.be.oneOf([400, 413]);
        if (res.status === 400) {
          res.body.code.should.equal('upload_failed');
        }
      });
  });

  // TS-4: Extensión no permitida → 400 upload_failed
  it('TS-4: should fail with 400 for disallowed extension (.exe)', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .field('entityType', 'comment_draft')
      .field('entityId', String(objectiveId))
      .attach('files', Buffer.alloc(1024), { filename: 'malware.exe', contentType: 'application/octet-stream' })
      .expect(400)
      .then(res => {
        res.body.code.should.equal('upload_failed');
      });
  });

  // TS-5: Usuario sin permiso en el proyecto → 403 access_denied
  it('TS-5: should return 403 when external user has no permission on the project', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .field('entityType', 'comment_draft')
      .field('entityId', String(objectiveNoPermId))
      .attach('files', Buffer.alloc(1024), { filename: 'file.pdf', contentType: 'application/pdf' })
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
      });
  });

  // entityType inválido (project, stage no permitidos en /opus/attachments)
  it('should fail with 400 for entityType not allowed in opus endpoint (project)', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'project')
      .field('entityId', String(projectId))
      .attach('files', Buffer.alloc(1024), { filename: 'file.pdf', contentType: 'application/pdf' })
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_entity_type');
      });
  });

  describe('requirement_comment_draft (S-095)', () => {
    let requirementId: number;
    let requirementNoPermId: number;

    before(() => {
      return Requirement.create({
        title: 'Requisito con comment draft', description: 'Desc',
        priority: 'sin_prioridad', state: 'analisis', projectId, createdBy: 'zitadel-sub-01',
      })
        .then((r) => { requirementId = r.id; })
        .then(() => Requirement.create({
          title: 'Requisito sin permiso', description: 'Desc',
          priority: 'sin_prioridad', state: 'analisis', projectId: projectNoPermId, createdBy: 'zitadel-sub-01',
        }))
        .then((r) => { requirementNoPermId = r.id; });
    });

    after(() => {
      return Requirement.destroy({ where: { id: [requirementId, requirementNoPermId] }, force: true } as any);
    });

    // TS-8: subida de adjunto en borrador para comentario de requisito
    it('TS-8: should upload a file as requirement_comment_draft and return 201', () => {
      return request(application)
        .post('/api/opus/attachments')
        .set('Authorization', 'Bearer token_04_external_user')
        .field('entityType', 'requirement_comment_draft')
        .field('entityId', String(requirementId))
        .attach('files', Buffer.alloc(1024), { filename: 'req-comment.png', contentType: 'image/png' })
        .expect(201)
        .then(res => {
          res.body.should.be.an.Array().with.length(1);
          res.body[0].entityType.should.equal('requirement_comment_draft');
          res.body[0].entityId.should.equal(requirementId);
        });
    });

    // TS-12: subida sin permiso sigue denegada
    it('TS-12: should return 403 when external user has no permission on the requirement project', () => {
      return request(application)
        .post('/api/opus/attachments')
        .set('Authorization', 'Bearer token_04_external_user')
        .field('entityType', 'requirement_comment_draft')
        .field('entityId', String(requirementNoPermId))
        .attach('files', Buffer.alloc(1024), { filename: 'file.pdf', contentType: 'application/pdf' })
        .expect(403)
        .then(res => {
          res.body.code.should.equal('access_denied');
        });
    });

    // TS-13: requisito inexistente
    it('TS-13: should return 404 not_found when the requirement does not exist', () => {
      return request(application)
        .post('/api/opus/attachments')
        .set('Authorization', 'Bearer token_04_external_user')
        .field('entityType', 'requirement_comment_draft')
        .field('entityId', '999999')
        .attach('files', Buffer.alloc(1024), { filename: 'file.pdf', contentType: 'application/pdf' })
        .expect(404)
        .then(res => {
          res.body.code.should.equal('not_found');
        });
    });

    // TS-14: no regresión, comment_draft legado para objetivo sigue funcionando
    it('TS-14: should still upload a file as legacy comment_draft for an objective', () => {
      return request(application)
        .post('/api/opus/attachments')
        .set('Authorization', 'Bearer token_04_external_user')
        .field('entityType', 'comment_draft')
        .field('entityId', String(objectiveId))
        .attach('files', Buffer.alloc(1024), { filename: 'legacy-draft.png', contentType: 'image/png' })
        .expect(201)
        .then(res => {
          res.body[0].entityType.should.equal('comment_draft');
        });
    });
  });
});
