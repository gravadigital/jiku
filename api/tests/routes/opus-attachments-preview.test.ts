import 'mocha';
import 'should';
import sinon from 'sinon';
import { Readable } from 'stream';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, Objective, ObjectiveActivity, Project, Requirement, RequirementActivity, User, UserProjectPermission, activityVisibilityLevel } from '@jiku/models';
import storageService from '../../lib/utils/storage-service';

// Tokens del mock:
// token_01_user            → sub: zitadel-sub-01, rol: user
// token_04_external_user   → sub: zitadel-sub-04, rol: external-user

describe('GET /api/opus/attachments/:id/preview', () => {
  let application: Application;
  let getFileStreamStub: sinon.SinonStub;
  let getPresignedUrlStub: sinon.SinonStub;

  const projectId = 6300;
  const projectNoPermId = 6301;
  let objectiveId: number;
  let objectiveNoPermId: number;
  let activityId: number;

  let commentAttachmentId: number;
  let draftAttachmentId: number;
  let noPermAttachmentId: number;

  before(function() {
    this.timeout(30000);
    application = start();

    getFileStreamStub = sinon.stub(storageService, 'getFileStream').callsFake(() =>
      Promise.resolve(Readable.from(Buffer.from('fake-file-content')))
    );
    getPresignedUrlStub = sinon.stub(storageService, 'getPresignedUrl').resolves(
      'https://fake-spaces.example.com/grava-gestion/key?X-Amz-Signature=abc123'
    );

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01prev', email: 'user01prev@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'ext04prev', email: 'ext04prev@mail.com' }))
      .then(() => Project.create({
        id: projectId, code: 'PR1', name: 'Preview Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Project.create({
        id: projectNoPermId, code: 'PR2', name: 'Preview Project 2', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        title: 'Preview Objective 1', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: projectId, createdBy: 'zitadel-sub-01'
      }))
      .then((obj) => { objectiveId = obj.id; })
      .then(() => Objective.create({
        title: 'Preview Objective NoPerm', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: projectNoPermId, createdBy: 'zitadel-sub-01'
      }))
      .then((obj) => { objectiveNoPermId = obj.id; })
      // Create an ObjectiveActivity (comment) for objectiveId
      .then(() => ObjectiveActivity.create({
        typeOfActivity: 'comment',
        previousValue: '',
        newValue: 'Test comment',
        objectiveId: objectiveId,
        changedBy: 'zitadel-sub-01',
        visibilityLevel: activityVisibilityLevel.Public,
      }))
      .then((activity) => { activityId = activity.id; })
      // Attachment with entity_type='comment' pointing to the activity
      .then(() => Attachment.create({
        entityType: 'comment',
        entityId: activityId,
        fileName: 'comment-image.jpg',
        fileSize: 17,
        mimeType: 'image/jpeg',
        storageKey: `grava-gestion/comment/${activityId}/ts11-${Date.now()}.jpg`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-04',
      }))
      .then((att) => { commentAttachmentId = att.id; })
      // Attachment with entity_type='comment_draft' (owned by sub-04)
      .then(() => Attachment.create({
        entityType: 'comment_draft',
        entityId: objectiveId,
        fileName: 'draft-file.pdf',
        fileSize: 17,
        mimeType: 'application/pdf',
        storageKey: `grava-gestion/comment_draft/${objectiveId}/ts12-${Date.now()}.pdf`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-04',
      }))
      .then((att) => { draftAttachmentId = att.id; })
      // Attachment for objective without permission (objectiveNoPermId)
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: objectiveNoPermId,
        fileName: 'noperm.jpg',
        fileSize: 17,
        mimeType: 'image/jpeg',
        storageKey: `grava-gestion/objective/${objectiveNoPermId}/ts13-${Date.now()}.jpg`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01',
      }))
      .then((att) => { noPermAttachmentId = att.id; })
      // UserProjectPermission: sub-04 has access to projectId only
      .then(() => UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: projectId }));
  });

  after(() => {
    getFileStreamStub.restore();
    getPresignedUrlStub.restore();
    return Attachment.destroy({ where: {}, force: true })
      .then(() => ObjectiveActivity.destroy({ where: {} }))
      .then(() => UserProjectPermission.destroy({ where: { userId: 'zitadel-sub-04' } }))
      .then(() => Objective.destroy({ where: { projectId: [projectId, projectNoPermId] } }))
      .then(() => Project.destroy({ where: { id: [projectId, projectNoPermId] } }))
      .then(() => User.destroy({ where: { id: ['zitadel-sub-01', 'zitadel-sub-04'] } }));
  });

  // TS-11: Preview de attachment comment — usuario con permiso → 200 stream
  it('TS-11: should return 200 stream for comment attachment with permission', () => {
    return request(application)
      .get(`/api/opus/attachments/${commentAttachmentId}/preview`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(200)
      .then(res => {
        res.headers['content-type'].should.containEql('image/jpeg');
        res.headers['content-disposition'].should.containEql('inline');
      });
  });

  // TS-12: Preview de attachment comment_draft — usuario propietario → 200 stream
  it('TS-12: should return 200 stream for comment_draft attachment owned by user', () => {
    return request(application)
      .get(`/api/opus/attachments/${draftAttachmentId}/preview`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(200)
      .then(res => {
        res.headers['content-type'].should.containEql('application/pdf');
      });
  });

  // TS-13: Preview denegado — usuario sin permiso → 403
  it('TS-13: should return 403 when external user has no permission on the project', () => {
    return request(application)
      .get(`/api/opus/attachments/${noPermAttachmentId}/preview`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
      });
  });

  // TS-14: Preview de attachment inexistente → 404
  it('TS-14: should return 404 for non-existent attachment', () => {
    return request(application)
      .get('/api/opus/attachments/99999/preview')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
      });
  });

  // Sin token → 401
  it('should return 401 without token', () => {
    return request(application)
      .get(`/api/opus/attachments/${commentAttachmentId}/preview`)
      .expect(401);
  });
});

describe('GET /api/opus/attachments/:id/public (S-095)', () => {
  let application: Application;
  let getFileStreamStub: sinon.SinonStub;

  const publicProjectId = 6400;
  const collisionId = 9600;

  let publicReqCommentAttachmentId: number;

  before(function () {
    this.timeout(30000);
    application = start();

    getFileStreamStub = sinon.stub(storageService, 'getFileStream').callsFake(() =>
      Promise.resolve(Readable.from(Buffer.from('fake-file-content')))
    );

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01pub', email: 'user01pub@mail.com' })
      .then(() => Project.create({
        id: publicProjectId, code: 'PUB1', name: 'Public Preview Project', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: publicProjectId, title: 'Requisito preview publico', description: 'Desc',
        priority: 'sin_prioridad', state: 'analisis', projectId: publicProjectId, createdBy: 'zitadel-sub-01',
      }))
      .then(() => Objective.create({
        id: publicProjectId, title: 'Objetivo preview publico', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: publicProjectId, createdBy: 'zitadel-sub-01',
      }))
      // Colisión deliberada de id, con visibilityLevel distinto para poder distinguir cuál rama se evaluó
      .then(() => RequirementActivity.create({
        id: collisionId, typeOfActivity: 'comment', previousValue: '', newValue: 'Comentario publico de requisito',
        visibilityLevel: 'public', requirementId: publicProjectId, changedBy: 'zitadel-sub-01',
      }))
      .then(() => ObjectiveActivity.create({
        id: collisionId, typeOfActivity: 'comment', previousValue: '', newValue: 'Comentario interno de objetivo',
        visibilityLevel: 'internal', objectiveId: publicProjectId, changedBy: 'zitadel-sub-01',
      }))
      .then(() => Attachment.create({
        entityType: 'requirement_comment',
        entityId: collisionId,
        fileName: 'public-req-comment.jpg',
        fileSize: 17,
        mimeType: 'image/jpeg',
        storageKey: `grava-gestion/requirement_comment/${collisionId}/public-${Math.random()}.jpg`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01',
      }))
      .then((a: Attachment) => { publicReqCommentAttachmentId = a.id; });
  });

  after(() => {
    getFileStreamStub.restore();
    return Attachment.destroy({ where: { id: publicReqCommentAttachmentId }, force: true })
      .then(() => RequirementActivity.destroy({ where: { requirementId: publicProjectId } }))
      .then(() => ObjectiveActivity.destroy({ where: { objectiveId: publicProjectId } }))
      .then(() => Requirement.destroy({ where: { id: publicProjectId } }))
      .then(() => Objective.destroy({ where: { id: publicProjectId } }))
      .then(() => Project.destroy({ where: { id: publicProjectId } }))
      .then(() => User.destroy({ where: { id: 'zitadel-sub-01' } }));
  });

  // TS-4: endpoint publico resuelve requirement_comment sin ambiguedad, con colision de id
  it('TS-4: should resolve requirement_comment visibility against RequirementActivity, not the colliding internal ObjectiveActivity', () => {
    return request(application)
      .get(`/api/opus/attachments/${publicReqCommentAttachmentId}/public`)
      .expect(200);
  });
});
