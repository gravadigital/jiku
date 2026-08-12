import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, Project, Requirement, RequirementActivity, User } from '@jiku/models';


describe('POST /api/requirements/:reqid/comments', () => {
  let application: Application;

  before(() => {
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-02', name: 'User 02', username: 'user02', email: 'user02@mail.com' }))
      .then(() => Project.create({ id: 1, name: 'Project1', code: 'P1', type: 'comercial', status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-01' }))
      .then(() => Promise.all([
        Requirement.create({
          id: 1,
          title: 'Req con actividad',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'alta',
          state: 'analisis',
          estimatedFinishDate: '2026-06-01',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 6,
          title: 'Otro requisito',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'alta',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
      ]));
  });

  after(() => {
    return RequirementActivity.destroy({ where: {} })
      .then(() => Attachment.destroy({ where: {}, force: true }))
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  it('should return 401 if no token is provided', () => {
    return request(application)
      .post('/api/requirements/1/comments')
      .send({ comment: 'Test comment' })
      .expect(401);
  });

  it('should return 400 if comment is missing', () => {
    return request(application)
      .post('/api/requirements/1/comments')
      .set('Authorization', 'Bearer token_01_user')
      .send({})
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  it('should add a comment with default visibility internal', () => {
    return request(application)
      .post('/api/requirements/1/comments')
      .set('Authorization', 'Bearer token_01_user')
      .send({ comment: 'Comentario interno' })
      .expect(201)
      .then(() => RequirementActivity.findOne({ where: { requirementId: 1, typeOfActivity: 'comment' } }))
      .then((activity) => {
        activity!.newValue.should.equal('Comentario interno');
        activity!.visibilityLevel.should.equal('internal');
      });
  });

  it('should add a comment with explicit visibility public', () => {
    return request(application)
      .post('/api/requirements/1/comments')
      .set('Authorization', 'Bearer token_01_user')
      .send({ comment: 'Comentario publico', visibilityLevel: 'public' })
      .expect(201)
      .then(() => RequirementActivity.findOne({
        where: { requirementId: 1, typeOfActivity: 'comment', visibilityLevel: 'public' },
      }))
      .then((activity) => {
        activity!.newValue.should.equal('Comentario publico');
        activity!.visibilityLevel.should.equal('public');
      });
  });

  // TS-25: requisito inexistente
  it('TS-25: should return 404 requirement_not_found when requirement does not exist', () => {
    return request(application)
      .post('/api/requirements/9999/comments')
      .set('Authorization', 'Bearer token_01_user')
      .send({ comment: 'Test' })
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('requirement_not_found');
      });
  });

  describe('comentarios con adjuntos (S-060)', () => {
    beforeEach(() => {
      return Promise.all([
        Attachment.create({
          id: 500,
          entityType: 'comment_draft',
          entityId: 1,
          fileName: 'file500.png',
          fileSize: 1024,
          mimeType: 'image/png',
          storageKey: 'key-500',
          storageBucket: 'test-bucket',
          storageRegion: 'sfo2',
          uploadedBy: 'zitadel-sub-01',
          retentionStatus: 'active',
        }),
        Attachment.create({
          id: 501,
          entityType: 'comment_draft',
          entityId: 1,
          fileName: 'file501.png',
          fileSize: 1024,
          mimeType: 'image/png',
          storageKey: 'key-501',
          storageBucket: 'test-bucket',
          storageRegion: 'sfo2',
          uploadedBy: 'zitadel-sub-02',
          retentionStatus: 'active',
        }),
        Attachment.create({
          id: 502,
          entityType: 'comment_draft',
          entityId: 6,
          fileName: 'file502.png',
          fileSize: 1024,
          mimeType: 'image/png',
          storageKey: 'key-502',
          storageBucket: 'test-bucket',
          storageRegion: 'sfo2',
          uploadedBy: 'zitadel-sub-01',
          retentionStatus: 'active',
        }),
        Attachment.create({
          id: 503,
          entityType: 'comment_draft',
          entityId: 1,
          fileName: 'file503.png',
          fileSize: 1024,
          mimeType: 'image/png',
          storageKey: 'key-503',
          storageBucket: 'test-bucket',
          storageRegion: 'sfo2',
          uploadedBy: 'zitadel-sub-01',
          retentionStatus: 'scheduled_for_deletion',
        }),
        Attachment.create({
          id: 504,
          entityType: 'requirement_draft',
          entityId: 1,
          fileName: 'file504.png',
          fileSize: 1024,
          mimeType: 'image/png',
          storageKey: 'key-504',
          storageBucket: 'test-bucket',
          storageRegion: 'sfo2',
          uploadedBy: 'zitadel-sub-01',
          retentionStatus: 'active',
        }),
      ]);
    });

    afterEach(() => {
      return Attachment.destroy({ where: { id: [500, 501, 502, 503, 504] }, force: true });
    });

    // TS-19: comentario con adjunto valido
    it('TS-19: should create comment and re-link attachment to the new activity', () => {
      return request(application)
        .post('/api/requirements/1/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'texto ![attach:500]', visibilityLevel: 'internal', attachmentIds: [500] })
        .expect(201)
        .then(() => RequirementActivity.findOne({
          where: { requirementId: 1, typeOfActivity: 'comment', newValue: 'texto ![attach:500]' },
        }))
        .then((activity) => {
          activity!.should.not.be.null();
          return Attachment.findByPk(500).then((att) => {
            att!.entityType.should.equal('requirement_comment');
            att!.entityId!.should.equal(activity!.id);
          });
        });
    });

    // TS-20: comentario sin adjuntos
    it('TS-20: should create comment without touching attachments when attachmentIds is not sent', () => {
      return request(application)
        .post('/api/requirements/1/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'solo texto', visibilityLevel: 'public' })
        .expect(201)
        .then(() => RequirementActivity.findOne({
          where: { requirementId: 1, typeOfActivity: 'comment', newValue: 'solo texto' },
        }))
        .then((activity) => {
          activity!.should.not.be.null();
          activity!.visibilityLevel.should.equal('public');
        });
    });

    // TS-21: adjunto de otro usuario
    it('TS-21: should return 400 invalid_attachment_id when attachment belongs to another user', () => {
      let countBefore: number;
      return RequirementActivity.count()
        .then((c) => { countBefore = c; })
        .then(() => request(application)
          .post('/api/requirements/1/comments')
          .set('Authorization', 'Bearer token_01_user')
          .send({ comment: 'texto', attachmentIds: [501] })
          .expect(400))
        .then((response) => {
          response.body.code.should.equal('invalid_attachment_id');
          return RequirementActivity.count();
        })
        .then((countAfter) => {
          countAfter.should.equal(countBefore);
        });
    });

    // TS-22: adjunto de otro requisito
    it('TS-22: should return 400 invalid_attachment_id when attachment belongs to another requirement', () => {
      return request(application)
        .post('/api/requirements/1/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'texto', attachmentIds: [502] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_attachment_id');
        });
    });

    // TS-23: adjunto inactivo
    it('TS-23: should return 400 invalid_attachment_id when attachment is not active', () => {
      return request(application)
        .post('/api/requirements/1/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'texto', attachmentIds: [503] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_attachment_id');
        });
    });

    // TS-24: adjunto de tipo incorrecto
    it('TS-24: should return 400 invalid_attachment_id when attachment entityType is not comment_draft', () => {
      return request(application)
        .post('/api/requirements/1/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'texto', attachmentIds: [504] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_attachment_id');
        });
    });

    // TS-16 (S-095): comentario con adjunto requirement_comment_draft persiste como requirement_comment
    it('TS-16 (S-095): should create comment and re-link a requirement_comment_draft attachment as requirement_comment', () => {
      return Attachment.create({
        id: 505,
        entityType: 'requirement_comment_draft',
        entityId: 1,
        fileName: 'file505.png',
        fileSize: 1024,
        mimeType: 'image/png',
        storageKey: 'key-505',
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01',
        retentionStatus: 'active',
      })
        .then(() => request(application)
          .post('/api/requirements/1/comments')
          .set('Authorization', 'Bearer token_01_user')
          .send({ comment: 'texto ![attach:500]', visibilityLevel: 'internal', attachmentIds: [505] })
          .expect(201))
        .then(() => RequirementActivity.findOne({
          where: { requirementId: 1, typeOfActivity: 'comment', newValue: 'texto ![attach:500]' },
          order: [['id', 'DESC']],
        }))
        .then((activity) => Attachment.findByPk(505).then((att) => {
          att!.entityType.should.equal('requirement_comment');
          att!.entityId!.should.equal(activity!.id);
          return Attachment.destroy({ where: { id: 505 }, force: true });
        }));
    });
  });
});
