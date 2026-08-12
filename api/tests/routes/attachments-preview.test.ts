import 'mocha';
import 'should';
import sinon from 'sinon';
import { Readable } from 'stream';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, Objective, ObjectiveActivity, Project, Requirement, RequirementActivity, User, UserProjectPermission } from '@jiku/models';
import storageService from '../../lib/utils/storage-service';

// Tokens del mock:
// token_01_user          → sub: zitadel-sub-01, rol: user
// token_04_external_user → sub: zitadel-sub-04, rol: external-user

describe('GET /api/attachments/:id/preview', () => {
  let application: Application;
  let smallAttachmentId: number;
  let largeAttachmentId: number;
  let deletedAttachmentId: number;
  let externalUserAttachmentId: number;
  let restrictedAttachmentId: number;

  let getFileStreamStub: sinon.SinonStub;
  let getPresignedUrlStub: sinon.SinonStub;

  before(function() {
    this.timeout(30000);
    application = start();

    getFileStreamStub = sinon.stub(storageService, 'getFileStream').callsFake(() =>
      Promise.resolve(Readable.from(Buffer.from('fake-file-content')))
    );
    getPresignedUrlStub = sinon.stub(storageService, 'getPresignedUrl').resolves(
      'https://fake-spaces.example.com/grava-gestion/key?X-Amz-Signature=abc123'
    );

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'u1@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuser', email: 'ext@mail.com' }))
      // Project 1: external-user tiene permiso
      .then(() => Project.create({
        id: 1, code: 'P1', name: 'Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      // Project 2: external-user NO tiene permiso (para test 403)
      .then(() => Project.create({
        id: 2, code: 'P2', name: 'Project 2', type: 'comercial',
        status: 'activo', priority: 2, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        id: 1, title: 'Objective 1', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: 1, createdBy: 'zitadel-sub-01'
      }))
      // Objective 2 pertenece a project 2 (sin permiso para external-user)
      .then(() => Objective.create({
        id: 2, title: 'Objective 2', state: 'activo', area: 'desarrollo',
        priority: 2, projectId: 2, createdBy: 'zitadel-sub-01'
      }))
      // Attachment pequeño (17 bytes, coincide con stub 'fake-file-content') → streaming, project 1 (permisos OK para external-user)
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 1,
        fileName: 'small-image.jpg',
        fileSize: 17,
        mimeType: 'image/jpeg',
        storageKey: `grava-gestion/objective/1/small-${Math.random()}.jpg`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { smallAttachmentId = a.id; })
      // Attachment grande (16MB) → presigned URL (bypass max validation: archivos históricos pueden ser >10MB)
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 1,
        fileName: 'large-file.pdf',
        fileSize: 16 * 1024 * 1024,
        mimeType: 'application/pdf',
        storageKey: `grava-gestion/objective/1/large-${Math.random()}.pdf`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01'
      }, { validate: false }))
      .then((a: Attachment) => { largeAttachmentId = a.id; })
      // Attachment soft-deleted
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 1,
        fileName: 'deleted-file.pdf',
        fileSize: 17,
        mimeType: 'application/pdf',
        storageKey: `grava-gestion/objective/1/deleted-${Math.random()}.pdf`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01',
        deletedAt: new Date(),
        deletedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { deletedAttachmentId = a.id; })
      // Attachment para test de external-user con permisos (project 1, 17 bytes para streaming)
      .then(() => Attachment.create({
        entityType: 'project',
        entityId: 1,
        fileName: 'project-file.jpg',
        fileSize: 17,
        mimeType: 'image/jpeg',
        storageKey: `grava-gestion/project/1/ext-${Math.random()}.jpg`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { externalUserAttachmentId = a.id; })
      // Attachment para test 403: objective 2, project 2 (external-user sin permiso)
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 2,
        fileName: 'restricted-file.jpg',
        fileSize: 17,
        mimeType: 'image/jpeg',
        storageKey: `grava-gestion/objective/2/restricted-${Math.random()}.jpg`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { restrictedAttachmentId = a.id; })
      // UserProjectPermission para external-user sobre project 1 solamente
      .then(() => UserProjectPermission.create({
        userId: 'zitadel-sub-04',
        projectId: 1
      }));
  });

  after(() => {
    getFileStreamStub.restore();
    getPresignedUrlStub.restore();

    return Attachment.destroy({ where: {}, force: true })
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Objective.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-3: Sin token de autenticación
  it('should return 401 without token', () => {
    return request(application)
      .get(`/api/attachments/${smallAttachmentId}/preview`)
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
      });
  });

  // TS-4: ID no numérico
  it('should return 400 when id is not numeric', () => {
    return request(application)
      .get('/api/attachments/abc/preview')
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
      .get('/api/attachments/9999/preview')
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
      .get(`/api/attachments/${deletedAttachmentId}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
      });
  });

  // TS-7: Usuario externo sin permisos → 403 (attachment en project 2, sin permiso)
  it('should return 403 for external user without permission on entity', () => {
    return request(application)
      .get(`/api/attachments/${restrictedAttachmentId}/preview`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
      });
  });

  // TS-1: Preview exitoso - archivo pequeño (streaming)
  it('should return 200 with binary stream for small files (≤15MB)', () => {
    return request(application)
      .get(`/api/attachments/${smallAttachmentId}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.status.should.equal(200);
      });
  });

  // TS-10 / TS-11: Headers de seguridad y Content-Disposition inline en streaming
  it('should return correct security headers and inline Content-Disposition for streaming', () => {
    return request(application)
      .get(`/api/attachments/${smallAttachmentId}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.headers['content-type'].should.containEql('image/jpeg');
        res.headers['content-disposition'].should.containEql('inline');
        res.headers['content-disposition'].should.containEql('small-image.jpg');
        res.headers['x-content-type-options'].should.equal('nosniff');
        res.headers['content-security-policy'].should.containEql('sandbox');
      });
  });

  // TS-2: Preview exitoso - archivo grande (presigned URL)
  it('should return 302 with Location header for large files (>15MB)', () => {
    return request(application)
      .get(`/api/attachments/${largeAttachmentId}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302)
      .then(res => {
        res.headers['location'].should.containEql('fake-spaces.example.com');
      });
  });

  // TS-12: Presigned URL TTL de 60 segundos
  it('should call getPresignedUrl with expiresIn=60', () => {
    getPresignedUrlStub.resetHistory();
    return request(application)
      .get(`/api/attachments/${largeAttachmentId}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302)
      .then(() => {
        getPresignedUrlStub.calledOnce.should.be.true();
        getPresignedUrlStub.firstCall.args[1].should.equal(60);
      });
  });

  // TS-9: Usuario interno siempre tiene acceso
  it('should allow internal user (role: user) to preview without UserProjectPermission check', () => {
    return request(application)
      .get(`/api/attachments/${smallAttachmentId}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200);
  });

  // TS-8: Usuario externo con permisos → 200
  it('should return 200 for external user with valid UserProjectPermission', () => {
    return request(application)
      .get(`/api/attachments/${externalUserAttachmentId}/preview`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(200);
  });

  // TS-16: Error en Spaces al hacer getFileStream → 500
  it('should return 500 when storageService.getFileStream throws an error', () => {
    getFileStreamStub.rejects(new Error('Spaces connection error'));

    return request(application)
      .get(`/api/attachments/${smallAttachmentId}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(500)
      .then(res => {
        res.body.code.should.equal('internal_error');
        res.body.message.should.equal('Failed to preview attachment');
        // Restaurar para los demás tests (aunque after() también lo hace)
        getFileStreamStub.callsFake(() => Promise.resolve(Readable.from(Buffer.from('fake-file-content'))));
      });
  });

  describe('Comentarios sin ambigüedad de entityType (S-095)', () => {
    const commentProjectId = 9100;
    const commentOtherProjectId = 9101;
    const collisionId = 9500;

    let reqCommentAttachmentId: number;
    let objCommentAttachmentId: number;
    let noPermissionCommentAttachmentId: number;
    let legacyCommentAttachmentId: number;

    before(function () {
      this.timeout(30000);

      return Project.create({
        id: commentProjectId, code: 'CP1', name: 'Comment Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01',
      })
        .then(() => Project.create({
          id: commentOtherProjectId, code: 'CP2', name: 'Comment Project 2 (no permission)', type: 'comercial',
          status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01',
        }))
        .then(() => Requirement.create({
          id: commentProjectId, title: 'Requisito con comentarios', description: 'Desc',
          priority: 'sin_prioridad', state: 'analisis', projectId: commentProjectId, createdBy: 'zitadel-sub-01',
        }))
        .then(() => Objective.create({
          id: commentProjectId, title: 'Objetivo con comentarios', state: 'activo', area: 'desarrollo',
          priority: 1, projectId: commentOtherProjectId, createdBy: 'zitadel-sub-01',
        }))
        // Colisión deliberada: misma id numérica en dos PKs autoincrementales independientes
        .then(() => RequirementActivity.create({
          id: collisionId, typeOfActivity: 'comment', previousValue: '', newValue: 'Comentario de requisito',
          visibilityLevel: 'internal', requirementId: commentProjectId, changedBy: 'zitadel-sub-01',
        }))
        .then(() => ObjectiveActivity.create({
          id: collisionId, typeOfActivity: 'comment', previousValue: '', newValue: 'Comentario de objetivo',
          visibilityLevel: 'internal', objectiveId: commentProjectId, changedBy: 'zitadel-sub-01',
        }))
        .then(() => UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: commentProjectId }))
        .then(() => Attachment.create({
          entityType: 'requirement_comment',
          entityId: collisionId,
          fileName: 'req-comment.jpg',
          fileSize: 17,
          mimeType: 'image/jpeg',
          storageKey: `grava-gestion/requirement_comment/${collisionId}/${Math.random()}.jpg`,
          storageBucket: 'test-bucket',
          storageRegion: 'sfo2',
          uploadedBy: 'zitadel-sub-01',
        }))
        .then((a: Attachment) => { reqCommentAttachmentId = a.id; })
        .then(() => Attachment.create({
          entityType: 'objective_comment',
          entityId: collisionId,
          fileName: 'obj-comment.jpg',
          fileSize: 17,
          mimeType: 'image/jpeg',
          storageKey: `grava-gestion/objective_comment/${collisionId}/${Math.random()}.jpg`,
          storageBucket: 'test-bucket',
          storageRegion: 'sfo2',
          uploadedBy: 'zitadel-sub-01',
        }))
        .then((a: Attachment) => { objCommentAttachmentId = a.id; })
        // Comentario de requisito en un proyecto SIN permiso para external-user
        .then(() => Requirement.create({
          id: commentOtherProjectId, title: 'Requisito sin permiso', description: 'Desc',
          priority: 'sin_prioridad', state: 'analisis', projectId: commentOtherProjectId, createdBy: 'zitadel-sub-01',
        }))
        .then(() => RequirementActivity.create({
          typeOfActivity: 'comment', previousValue: '', newValue: 'Comentario sin permiso',
          visibilityLevel: 'internal', requirementId: commentOtherProjectId, changedBy: 'zitadel-sub-01',
        }))
        .then((activity: RequirementActivity) => Attachment.create({
          entityType: 'requirement_comment',
          entityId: activity.id,
          fileName: 'no-permission-comment.jpg',
          fileSize: 17,
          mimeType: 'image/jpeg',
          storageKey: `grava-gestion/requirement_comment/no-perm-${Math.random()}.jpg`,
          storageBucket: 'test-bucket',
          storageRegion: 'sfo2',
          uploadedBy: 'zitadel-sub-01',
        }))
        .then((a: Attachment) => { noPermissionCommentAttachmentId = a.id; })
        // Rama legada: entityType='comment' sin migrar, sin colisión, resuelve por fallback a RequirementActivity
        .then(() => RequirementActivity.create({
          typeOfActivity: 'comment', previousValue: '', newValue: 'Comentario legado',
          visibilityLevel: 'internal', requirementId: commentProjectId, changedBy: 'zitadel-sub-01',
        }))
        .then((activity: RequirementActivity) => Attachment.create({
          entityType: 'comment',
          entityId: activity.id,
          fileName: 'legacy-comment.jpg',
          fileSize: 17,
          mimeType: 'image/jpeg',
          storageKey: `grava-gestion/comment/legacy-${Math.random()}.jpg`,
          storageBucket: 'test-bucket',
          storageRegion: 'sfo2',
          uploadedBy: 'zitadel-sub-01',
        }))
        .then((a: Attachment) => { legacyCommentAttachmentId = a.id; });
    });

    after(() => {
      return Attachment.destroy({ where: { id: [reqCommentAttachmentId, objCommentAttachmentId, noPermissionCommentAttachmentId, legacyCommentAttachmentId] }, force: true })
        .then(() => RequirementActivity.destroy({ where: { requirementId: [commentProjectId, commentOtherProjectId] } }))
        .then(() => ObjectiveActivity.destroy({ where: { objectiveId: commentProjectId } }))
        .then(() => UserProjectPermission.destroy({ where: { userId: 'zitadel-sub-04', projectId: commentProjectId } }))
        .then(() => Requirement.destroy({ where: { id: [commentProjectId, commentOtherProjectId] } }))
        .then(() => Objective.destroy({ where: { id: commentProjectId } }))
        .then(() => Project.destroy({ where: { id: [commentProjectId, commentOtherProjectId] } }));
    });

    // TS-1: preview de comentario de requisito sin colisión (no regresión)
    it('TS-1: should return 200 for a requirement_comment attachment without id collision', () => {
      return request(application)
        .get(`/api/attachments/${legacyCommentAttachmentId}/preview`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(200);
    });

    // TS-2: preview de comentario de requisito CON colisión real de id — debe resolver contra RequirementActivity, no ObjectiveActivity
    it('TS-2: should resolve requirement_comment against RequirementActivity even with a colliding ObjectiveActivity id', () => {
      return request(application)
        .get(`/api/attachments/${reqCommentAttachmentId}/preview`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(200);
    });

    // TS-3: preview de comentario de objetivo con la misma colisión de id, dirección inversa.
    // El usuario solo tiene permiso sobre el proyecto del requirement (commentProjectId), no
    // sobre el proyecto del objective (commentOtherProjectId, donde vive el Objective colisionante).
    // Se espera 403: si el sistema resolviera por error contra RequirementActivity (donde SÍ hay
    // permiso) en vez de ObjectiveActivity, respondería 200 y el bug de colisión quedaría expuesto.
    it('TS-3: should resolve objective_comment against ObjectiveActivity even with a colliding RequirementActivity id', () => {
      return request(application)
        .get(`/api/attachments/${objCommentAttachmentId}/preview`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(403);
    });

    // TS-5: acceso denegado no cambia por el fix
    it('TS-5: should return 403 access_denied when external user has no permission on the requirement project', () => {
      return request(application)
        .get(`/api/attachments/${noPermissionCommentAttachmentId}/preview`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(403)
        .then((res) => {
          res.body.code.should.equal('access_denied');
        });
    });

    // TS-6: usuario interno accede sin chequeo adicional
    it('TS-6: should allow internal user to preview a comment attachment without additional checks', () => {
      return request(application)
        .get(`/api/attachments/${noPermissionCommentAttachmentId}/preview`)
        .set('Authorization', 'Bearer token_01_user')
        .expect(200);
    });

    // TS-7: rama legada 'comment' sigue funcionando durante la transición
    it('TS-7: should still resolve a legacy comment attachment via the legacy fallback branch', () => {
      return request(application)
        .get(`/api/attachments/${legacyCommentAttachmentId}/preview`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(200);
    });
  });
});
