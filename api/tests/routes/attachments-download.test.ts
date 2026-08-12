import 'mocha';
import 'should';
import sinon from 'sinon';
import { Readable } from 'stream';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, Objective, Project, User, UserProjectPermission } from '@jiku/models';
import storageService from '../../lib/utils/storage-service';

// Tokens del mock:
// token_01_user          → sub: zitadel-sub-01, rol: user
// token_04_external_user → sub: zitadel-sub-04, rol: external-user

describe('GET /api/attachments/:id/download', () => {
  let application: Application;
  let attachmentId: number;
  let deletedAttachmentId: number;
  let externalUserAttachmentId: number;
  let restrictedAttachmentId: number;

  let getFileStreamStub: sinon.SinonStub;

  before(function() {
    this.timeout(30000);
    application = start();

    getFileStreamStub = sinon.stub(storageService, 'getFileStream').callsFake(() =>
      Promise.resolve(Readable.from(Buffer.from('fake-file-content')))
    );

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01dl', email: 'u1dl@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuserdl', email: 'extdl@mail.com' }))
      .then(() => Project.create({
        id: 101, code: 'DL1', name: 'DL Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Project.create({
        id: 102, code: 'DL2', name: 'DL Project 2', type: 'comercial',
        status: 'activo', priority: 2, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        id: 101, title: 'DL Objective 1', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: 101, createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        id: 102, title: 'DL Objective 2', state: 'activo', area: 'desarrollo',
        priority: 2, projectId: 102, createdBy: 'zitadel-sub-01'
      }))
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 101,
        fileName: 'test-file.txt',
        fileSize: 17,
        mimeType: 'text/plain',
        storageKey: `grava-gestion/objective/101/file-${Math.random()}.txt`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { attachmentId = a.id; })
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 101,
        fileName: 'deleted-file.txt',
        fileSize: 17,
        mimeType: 'text/plain',
        storageKey: `grava-gestion/objective/101/deleted-${Math.random()}.txt`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01',
        deletedAt: new Date(),
        deletedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { deletedAttachmentId = a.id; })
      .then(() => Attachment.create({
        entityType: 'project',
        entityId: 101,
        fileName: 'project-file.jpg',
        fileSize: 17,
        mimeType: 'image/jpeg',
        storageKey: `grava-gestion/project/101/ext-${Math.random()}.jpg`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { externalUserAttachmentId = a.id; })
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 102,
        fileName: 'restricted-file.jpg',
        fileSize: 17,
        mimeType: 'image/jpeg',
        storageKey: `grava-gestion/objective/102/restricted-${Math.random()}.jpg`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { restrictedAttachmentId = a.id; })
      .then(() => UserProjectPermission.create({
        userId: 'zitadel-sub-04',
        projectId: 101
      }));
  });

  after(() => {
    getFileStreamStub.restore();

    return Attachment.destroy({ where: {}, force: true })
      .then(() => UserProjectPermission.destroy({ where: { userId: 'zitadel-sub-04', projectId: 101 } }))
      .then(() => Objective.destroy({ where: { id: [101, 102] } }))
      .then(() => Project.destroy({ where: { id: [101, 102] } }))
      .then(() => User.destroy({ where: { id: ['zitadel-sub-01', 'zitadel-sub-04'] } }));
  });

  // TS-2: Sin token
  it('should return 401 without token', () => {
    return request(application)
      .get(`/api/attachments/${attachmentId}/download`)
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
      });
  });

  // TS-7: ID no numérico
  it('should return 400 when id is not numeric', () => {
    return request(application)
      .get('/api/attachments/abc/download')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_id');
        res.body.message.should.equal('Attachment ID must be a valid integer');
      });
  });

  // TS-5: Attachment no existe
  it('should return 404 for non-existent attachment', () => {
    return request(application)
      .get('/api/attachments/9999/download')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
        res.body.message.should.equal('Attachment not found');
      });
  });

  // TS-6: Attachment soft-deleted → 404
  it('should return 404 for soft-deleted attachment', () => {
    return request(application)
      .get(`/api/attachments/${deletedAttachmentId}/download`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
      });
  });

  // TS-3: Usuario externo sin permisos → 403
  it('should return 403 for external user without permission on entity', () => {
    return request(application)
      .get(`/api/attachments/${restrictedAttachmentId}/download`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
        res.body.message.should.equal('You do not have permission to download this attachment');
      });
  });

  // TS-1: Download exitoso - usuario interno
  it('should download attachment with status 200 for internal user', () => {
    return request(application)
      .get(`/api/attachments/${attachmentId}/download`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.status.should.equal(200);
      });
  });

  // TS-1: Content-Disposition attachment y Content-Type correcto
  it('should return Content-Disposition: attachment with encoded filename', () => {
    return request(application)
      .get(`/api/attachments/${attachmentId}/download`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.headers['content-disposition'].should.containEql('attachment');
        res.headers['content-disposition'].should.containEql(encodeURIComponent('test-file.txt'));
        res.headers['content-type'].should.containEql('text/plain');
      });
  });

  // TS-4: Usuario externo con permisos → 200
  it('should return 200 for external user with valid UserProjectPermission', () => {
    return request(application)
      .get(`/api/attachments/${externalUserAttachmentId}/download`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(200);
  });

  // TS-8: Usuario interno siempre tiene acceso (sin UserProjectPermission)
  it('should allow internal user (role: user) to download without UserProjectPermission check', () => {
    return request(application)
      .get(`/api/attachments/${attachmentId}/download`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200);
  });
});
