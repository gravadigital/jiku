import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import sinon from 'sinon';
import { Attachment, Project, User, UserProjectPermission } from '@jiku/models';
import storageService from '../../lib/utils/storage-service';

// Tokens del mock:
// token_01_user            → sub: zitadel-sub-01, rol: user
// token_04_external_user   → sub: zitadel-sub-04, rol: external-user

describe('POST /api/opus/attachments — objective_draft', () => {
  let application: Application;
  let uploadStub: sinon.SinonStub;
  let deleteStub: sinon.SinonStub;

  const projectWithPermId = 7000;
  const projectNoPermId = 7001;

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

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01od', email: 'user01od@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'ext04od', email: 'ext04od@mail.com' }))
      .then(() => Project.create({
        id: projectWithPermId, code: 'OD1', name: 'ObjDraft Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Project.create({
        id: projectNoPermId, code: 'OD2', name: 'ObjDraft Project 2', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: projectWithPermId }));
  });

  after(() => {
    uploadStub.restore();
    deleteStub.restore();
    return Attachment.destroy({ where: {}, force: true })
      .then(() => UserProjectPermission.destroy({ where: { userId: 'zitadel-sub-04' } }))
      .then(() => Project.destroy({ where: { id: [projectWithPermId, projectNoPermId] } }))
      .then(() => User.destroy({ where: { id: ['zitadel-sub-01', 'zitadel-sub-04'] } }));
  });

  afterEach(() => {
    uploadStub.resetHistory();
    deleteStub.resetHistory();
  });

  // TS-1: Upload exitoso con objective_draft
  it('TS-1: should upload a file as objective_draft and return 201', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .field('entityType', 'objective_draft')
      .field('entityId', String(projectWithPermId))
      .attach('files', Buffer.alloc(1024), { filename: 'imagen.png', contentType: 'image/png' })
      .expect(201)
      .then(res => {
        res.body.should.be.an.Array().with.length(1);
        res.body[0].entityType.should.equal('objective_draft');
        res.body[0].entityId.should.equal(projectWithPermId);
        res.body[0].fileName.should.equal('imagen.png');
        res.body[0].mimeType.should.equal('image/png');
        res.body[0].uploadedBy.should.equal('zitadel-sub-04');
        res.body[0].storageKey.should.containEql(`objective_draft/${projectWithPermId}/`);
        res.body[0].should.have.properties(['id', 'storageKey', 'storageBucket', 'storageRegion', 'createdAt']);
        uploadStub.calledOnce.should.be.true();
      });
  });

  // TS-2: Upload objective_draft sin permiso → 403
  it('TS-2: should return 403 when external user has no permission on the project', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .field('entityType', 'objective_draft')
      .field('entityId', String(projectNoPermId))
      .attach('files', Buffer.alloc(1024), { filename: 'file.pdf', contentType: 'application/pdf' })
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
        uploadStub.called.should.be.false();
      });
  });

  // Usuario interno (rol user) puede subir objective_draft sin permiso explícito
  it('should allow internal user (role: user) to upload objective_draft without UserProjectPermission', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'objective_draft')
      .field('entityId', String(projectNoPermId))
      .attach('files', Buffer.alloc(1024), { filename: 'doc.pdf', contentType: 'application/pdf' })
      .expect(201)
      .then(res => {
        res.body[0].entityType.should.equal('objective_draft');
        res.body[0].uploadedBy.should.equal('zitadel-sub-01');
      });
  });
});
