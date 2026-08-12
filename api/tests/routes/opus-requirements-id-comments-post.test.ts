import 'mocha';
import 'should';
import sinon from 'sinon';
import nock from 'nock';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, AttachmentEntityType, Project, Requirement, RequirementActivity, RetentionStatus, User, UserProjectPermission } from '@jiku/models';

const MATTERMOST_BASE = process.env.MATTERMOST_INTEGRATION_URL || 'https://mattermost-bot.gestion.dev.grava.io/api';

// token_04_external_user -> sub: 'zitadel-sub-04'

describe('POST /api/opus/requirements/:reqid/comments', () => {
  let application: Application;

  const projectId = 8200;
  const requirementId = 8200;

  before(() => {
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01opuscomment', email: 'user01opuscomment@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuser04opuscomment', email: 'extopuscomment@mail.com' }))
      .then(() => Project.create({
        id: projectId, code: 'OC1', name: 'Opus Comment Project', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01',
        keyValuePairs: { mattermost_group_name: 'canal-opus-comment' },
      }))
      .then(() => Requirement.create({
        id: requirementId,
        title: 'Requisito opus comment',
        description: 'Desc',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'analisis',
        projectId,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId }));
  });

  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });

  after(() => {
    return RequirementActivity.destroy({ where: { requirementId } })
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Requirement.destroy({ where: { id: requirementId } }))
      .then(() => Project.destroy({ where: { id: projectId } }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-6: comentario publico desde opus-web dispara notificaciones
  it('TS-6: ya no notifica: las notificaciones se eliminaron del alcance', () => {
    return request(application)
      .post(`/api/opus/requirements/${requirementId}/comments`)
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ comment: 'comentario del cliente' })
      .expect(200)
      .then((response) => {
        // Esta ruta no notifica: las notificaciones están fuera del alcance.
        response.body.newValue.should.equal('comentario del cliente');
      });
  });

  it('should always store the comment as public, even for an internal user', () => {
    return request(application)
      .post(`/api/opus/requirements/${requirementId}/comments`)
      .set('Authorization', 'Bearer token_01_user')
      .send({ comment: 'comentario de un usuario interno' })
      .expect(200)
      .then((response) => {
        // Opus es la vista que comparte el cliente: todo lo que se escribe ahí es
        // público, sin importar quién lo escribió ni qué mande el cuerpo.
        response.body.visibilityLevel.should.equal('public');
      });
  });

  it('should ignore visibilityLevel sent in the body', () => {
    return request(application)
      .post(`/api/opus/requirements/${requirementId}/comments`)
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ comment: 'intento de comentario interno', visibilityLevel: 'internal' })
      .expect(400)
      .then((response) => {
        // El esquema no acepta el campo: la visibilidad no es configurable acá.
        response.body.code.should.equal('invalid_fields');
      });
  });

  it('should return 200 even when Mattermost fails', () => {
    nock(MATTERMOST_BASE).post('/messages/group').reply(500, { error: 'Server error' });

    return request(application)
      .post(`/api/opus/requirements/${requirementId}/comments`)
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ comment: 'Comentario fallo mm' })
      .expect(200);
  });

  describe('Attachments (S-095)', () => {
    function createDraft(entityType: AttachmentEntityType, uploadedBy: string = 'zitadel-sub-04') {
      return Attachment.create({
        entityType,
        entityId: requirementId,
        fileName: 'test.png',
        fileSize: 1024,
        mimeType: 'image/png',
        storageKey: `test-key-${Math.random()}`,
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        uploadedBy,
        retentionStatus: RetentionStatus.Active,
      });
    }

    afterEach(() => {
      return Attachment.destroy({ where: {}, force: true });
    });

    // TS-10: confirmacion de comentario con adjunto persiste como requirement_comment
    it('TS-10: should re-link attachment to requirement_comment on comment confirmation', () => {
      return createDraft(AttachmentEntityType.RequirementCommentDraft).then((draft) =>
        request(application)
          .post(`/api/opus/requirements/${requirementId}/comments`)
          .set('Authorization', 'Bearer token_04_external_user')
          .send({ comment: 'Comentario con adjunto', attachmentIds: [draft.id] })
          .expect(200)
          .then(() =>
            Attachment.findByPk(draft.id).then((updated) => {
              updated!.entityType.should.equal(AttachmentEntityType.RequirementComment);
            })
          )
      );
    });

    // TS-11: compatibilidad transitoria con el valor legado comment_draft
    it('TS-11: should still confirm a legacy comment_draft attachment during the transition window', () => {
      return createDraft(AttachmentEntityType.CommentDraft).then((draft) =>
        request(application)
          .post(`/api/opus/requirements/${requirementId}/comments`)
          .set('Authorization', 'Bearer token_04_external_user')
          .send({ comment: 'Comentario con adjunto legado', attachmentIds: [draft.id] })
          .expect(200)
          .then(() =>
            Attachment.findByPk(draft.id).then((updated) => {
              updated!.entityType.should.equal(AttachmentEntityType.RequirementComment);
            })
          )
      );
    });
  });
});
