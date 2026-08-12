import 'mocha';
import 'should';
import sinon from 'sinon';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, Objective, Project, User } from '@jiku/models';
import storageService from '../../lib/utils/storage-service';

// Tokens del mock:
// token_01_user  → sub: zitadel-sub-01, rol: user  (uploader en estos tests)
// token_02_user  → sub: zitadel-sub-02, rol: user  (otro usuario, no uploader)
// token_03_admin → sub: zitadel-sub-03, rol: admin

describe('DELETE /api/attachments/:id', () => {
  let application: Application;
  let attachmentId: number;
  let attachmentForAdminId: number;
  let attachmentForOtherUserId: number;
  let attachmentForGracePeriodId: number;
  let attachmentAlreadyDeletedId: number;

  let deleteFileStub: sinon.SinonStub;

  before(function() {
    this.timeout(30000);
    application = start();

    deleteFileStub = sinon.stub(storageService, 'deleteFile').resolves();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01del', email: 'u1del@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-02', name: 'User 02', username: 'user02del', email: 'u2del@mail.com' }))
      .then(() => User.create({ id: 'zitadel-sub-03', name: 'Admin User', username: 'admindel', email: 'admindel@mail.com' }))
      .then(() => Project.create({
        id: 201, code: 'DEL1', name: 'DEL Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        id: 201, title: 'DEL Objective 1', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: 201, createdBy: 'zitadel-sub-01'
      }))
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 201,
        fileName: 'my-file.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageKey: `grava-gestion/objective/201/myfile-${Math.random()}.pdf`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { attachmentId = a.id; })
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 201,
        fileName: 'admin-target.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        storageKey: `grava-gestion/objective/201/admin-${Math.random()}.pdf`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { attachmentForAdminId = a.id; })
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 201,
        fileName: 'other-user-file.pdf',
        fileSize: 512,
        mimeType: 'application/pdf',
        storageKey: `grava-gestion/objective/201/other-${Math.random()}.pdf`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { attachmentForOtherUserId = a.id; })
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 201,
        fileName: 'grace-period-file.pdf',
        fileSize: 256,
        mimeType: 'application/pdf',
        storageKey: `grava-gestion/objective/201/grace-${Math.random()}.pdf`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { attachmentForGracePeriodId = a.id; })
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 201,
        fileName: 'already-deleted.pdf',
        fileSize: 128,
        mimeType: 'application/pdf',
        storageKey: `grava-gestion/objective/201/already-deleted-${Math.random()}.pdf`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01',
        deletedAt: new Date(),
        deletedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { attachmentAlreadyDeletedId = a.id; });
  });

  after(() => {
    deleteFileStub.restore();

    return Attachment.destroy({ where: {}, force: true })
      .then(() => Objective.destroy({ where: { id: [201] } }))
      .then(() => Project.destroy({ where: { id: [201] } }))
      .then(() => User.destroy({ where: { id: ['zitadel-sub-01', 'zitadel-sub-02', 'zitadel-sub-03'] } }));
  });

  // TS-15: Sin token
  it('should return 401 without token', () => {
    return request(application)
      .delete(`/api/attachments/${attachmentId}`)
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
      });
  });

  // TS-16: ID no numérico
  it('should return 400 when id is not numeric', () => {
    return request(application)
      .delete('/api/attachments/abc')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_id');
        res.body.message.should.equal('Attachment ID must be a valid integer');
      });
  });

  // TS-13: Attachment no existe
  it('should return 404 for non-existent attachment', () => {
    return request(application)
      .delete('/api/attachments/9999')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
        res.body.message.should.equal('Attachment not found');
      });
  });

  // TS-14: Attachment ya soft-deleted → 404
  it('should return 404 for already soft-deleted attachment', () => {
    return request(application)
      .delete(`/api/attachments/${attachmentAlreadyDeletedId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
      });
  });

  // TS-11: Usuario que no es uploader ni admin → 403
  it('should return 403 for user who is not uploader nor admin', () => {
    return request(application)
      .delete(`/api/attachments/${attachmentForOtherUserId}`)
      .set('Authorization', 'Bearer token_02_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
        res.body.message.should.equal('Only the uploader or admin can delete this attachment');
      });
  });

  // TS-9: Delete exitoso como uploader (happy path)
  it('should soft delete attachment as uploader and return 200 with deletion info', () => {
    return request(application)
      .delete(`/api/attachments/${attachmentId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.message.should.equal('Attachment marked for deletion');
        res.body.attachmentId.should.equal(attachmentId);
        res.body.deletedBy.should.equal('zitadel-sub-01');
        res.body.should.have.property('deletedAt');
        res.body.should.have.property('scheduledPermanentDeletion');
      });
  });

  // TS-10: Delete exitoso como admin (no es el uploader)
  it('should soft delete attachment as admin even if not the uploader', () => {
    return request(application)
      .delete(`/api/attachments/${attachmentForAdminId}`)
      .set('Authorization', 'Bearer token_03_admin')
      .expect(200)
      .then(res => {
        res.body.message.should.equal('Attachment marked for deletion');
        res.body.deletedBy.should.equal('zitadel-sub-03');
        res.body.should.have.property('deletedAt');
        res.body.should.have.property('scheduledPermanentDeletion');
      });
  });

  // TS-17: scheduledPermanentDeletion es ~7 días después de deletedAt
  it('should have scheduledPermanentDeletion approximately 7 days after deletedAt', () => {
    return request(application)
      .delete(`/api/attachments/${attachmentForGracePeriodId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        const deletedAt = new Date(res.body.deletedAt);
        const scheduled = new Date(res.body.scheduledPermanentDeletion);
        const diffDays = (scheduled.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24);
        diffDays.should.be.approximately(7, 0.1);
      });
  });

  // TS-12: Attachment soft-deleted no aparece en listados (scope 'active')
  it('should not include soft-deleted attachment in GET /api/attachments list', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=201')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        const ids = res.body.map((a: any) => a.id);
        ids.should.not.containEql(attachmentId);
      });
  });

  // TS-19: storageService.deleteFile NO fue llamado durante el delete
  it('should NOT call storageService.deleteFile when soft deleting', () => {
    deleteFileStub.resetHistory();

    return Attachment.create({
      entityType: 'objective',
      entityId: 201,
      fileName: 'no-spaces-delete.pdf',
      fileSize: 64,
      mimeType: 'application/pdf',
      storageKey: `grava-gestion/objective/201/no-spaces-${Math.random()}.pdf`,
      storageBucket: 'test-bucket',
      storageRegion: 'sfo2',
      uploadedBy: 'zitadel-sub-01'
    })
      .then((a: Attachment) => {
        return request(application)
          .delete(`/api/attachments/${a.id}`)
          .set('Authorization', 'Bearer token_01_user')
          .expect(200);
      })
      .then(() => {
        deleteFileStub.called.should.be.false();
      });
  });
});
