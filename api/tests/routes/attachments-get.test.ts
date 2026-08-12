import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, Objective, Project, User, UserProjectPermission } from '@jiku/models';

// Tokens del mock:
// token_01_user          → sub: zitadel-sub-01, rol: user
// token_04_external_user → sub: zitadel-sub-04, rol: external-user

const makeAttachment = (overrides: object = {}) => ({
  entityType: 'objective' as const,
  entityId: 1,
  fileName: 'file.pdf',
  fileSize: 1024,
  mimeType: 'application/pdf',
  storageKey: `grava-gestion/objective/1/${Math.random()}.pdf`,
  storageBucket: 'test-bucket',
  storageRegion: 'sfo2',
  uploadedBy: 'zitadel-sub-01',
  ...overrides
});

describe('GET /api/attachments', () => {
  let application: Application;

  before(function() {
    this.timeout(30000);
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'u1@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuser', email: 'ext@mail.com' }))
      .then(() => Project.create({
        id: 1, code: 'P1', name: 'Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        id: 1, title: 'Objective 1', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: 1, createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        id: 2, title: 'Objective 2 Empty', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: 1, createdBy: 'zitadel-sub-01'
      }))
      // 3 attachments activos con fechas distintas
      .then(() => Attachment.create(makeAttachment({ fileName: 'oldest.pdf', createdAt: new Date('2026-01-01') })))
      .then(() => Attachment.create(makeAttachment({ fileName: 'middle.pdf', createdAt: new Date('2026-01-15') })))
      .then(() => Attachment.create(makeAttachment({ fileName: 'newest.pdf', createdAt: new Date('2026-02-01') })))
      // 2 attachments soft-deleted
      .then(() => Attachment.create(makeAttachment({ fileName: 'deleted1.pdf', deletedAt: new Date(), deletedBy: 'zitadel-sub-01' })))
      .then(() => Attachment.create(makeAttachment({ fileName: 'deleted2.pdf', deletedAt: new Date(), deletedBy: 'zitadel-sub-01' })));
  });

  after(() => {
    return Attachment.destroy({ where: {}, force: true })
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Objective.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-4: Sin token
  it('should return 401 without token', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
      });
  });

  // TS-7: Sin entityType
  it('should return 400 when entityType is missing', () => {
    return request(application)
      .get('/api/attachments?entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_query');
        res.body.message.should.equal('entityType and entityId are required');
      });
  });

  // TS-8: Sin entityId
  it('should return 400 when entityId is missing', () => {
    return request(application)
      .get('/api/attachments?entityType=objective')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_query');
      });
  });

  // TS-5: entityType inválido
  it('should return 400 with invalid entityType', () => {
    return request(application)
      .get('/api/attachments?entityType=xxx&entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_entity_type');
      });
  });

  // TS-6: entityId no numérico
  it('should return 400 when entityId is not numeric', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=abc')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_entity_id');
        res.body.message.should.equal('entityId must be a valid integer');
      });
  });

  // TS-9: Usuario externo sin permisos
  it('should return 403 for external user without permission', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
      });
  });

  // TS-1: Listado exitoso con uploader
  it('should return 200 with active attachments including uploader', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.should.be.an.Array();
        res.body[0].should.have.properties([
          'id', 'entityType', 'entityId', 'fileName', 'fileSize',
          'mimeType', 'storageKey', 'uploadedBy', 'createdAt', 'uploader'
        ]);
        res.body[0].uploader.should.have.properties(['id', 'name', 'email']);
        res.body[0].uploader.id.should.equal('zitadel-sub-01');
      });
  });

  // TS-2: Solo attachments activos (excluye soft-deleted)
  it('should return only active attachments (excluding soft-deleted)', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        // 5 attachments created: 3 active + 2 soft-deleted → only 3 returned
        res.body.should.be.an.Array().with.length(3);
        res.body.forEach((a: any) => {
          (a.deletedAt === null).should.be.true();
        });
      });
  });

  // TS-3: Ordenamiento DESC por createdAt
  it('should return attachments ordered by createdAt DESC', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.should.be.an.Array().with.length(3);
        const dates = res.body.map((a: any) => new Date(a.createdAt).getTime());
        dates[0].should.be.aboveOrEqual(dates[1]);
        dates[1].should.be.aboveOrEqual(dates[2]);
        res.body[0].fileName.should.equal('newest.pdf');
        res.body[2].fileName.should.equal('oldest.pdf');
      });
  });

  // TS-10: Usuario interno siempre tiene acceso
  it('should allow internal user without checking UserProjectPermission', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200);
  });

  // TS-11: Entidad sin attachments (usando objetivo existente del que el usuario es creador)
  it('should return empty array for entity without attachments', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=2')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.should.be.an.Array().with.length(0);
      });
  });
});

describe('GET /api/attachments/:id', () => {
  let application: Application;
  let activeAttachmentId: number;
  let deletedAttachmentId: number;

  before(function() {
    this.timeout(30000);
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'u1@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuser', email: 'ext@mail.com' }))
      .then(() => Project.create({
        id: 1, code: 'P1', name: 'Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        id: 1, title: 'Objective 1', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: 1, createdBy: 'zitadel-sub-01'
      }))
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 1,
        fileName: 'active-file.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        storageKey: 'grava-gestion/objective/1/active-uuid.pdf',
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { activeAttachmentId = a.id; })
      .then(() => Attachment.create({
        entityType: 'objective',
        entityId: 1,
        fileName: 'deleted-file.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageKey: 'grava-gestion/objective/1/deleted-uuid.pdf',
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        uploadedBy: 'zitadel-sub-01',
        deletedAt: new Date(),
        deletedBy: 'zitadel-sub-01'
      }))
      .then((a: Attachment) => { deletedAttachmentId = a.id; });
  });

  after(() => {
    return Attachment.destroy({ where: {}, force: true })
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Objective.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-17: Sin token
  it('should return 401 without token', () => {
    return request(application)
      .get(`/api/attachments/${activeAttachmentId}`)
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
      });
  });

  // TS-18: ID no numérico
  it('should return 400 when id is not numeric', () => {
    return request(application)
      .get('/api/attachments/abc')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_id');
        res.body.message.should.equal('Attachment ID must be a valid integer');
      });
  });

  // TS-14: Attachment inexistente
  it('should return 404 for non-existent attachment', () => {
    return request(application)
      .get('/api/attachments/9999')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
        res.body.message.should.equal('Attachment not found');
      });
  });

  // TS-15: Attachment soft-deleted → 404
  it('should return 404 for soft-deleted attachment', () => {
    return request(application)
      .get(`/api/attachments/${deletedAttachmentId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
      });
  });

  // TS-16: Usuario externo sin permisos
  it('should return 403 for external user without permission on entity', () => {
    return request(application)
      .get(`/api/attachments/${activeAttachmentId}`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
      });
  });

  // TS-12: Detalle exitoso con uploader
  it('should return 200 with full attachment details including uploader', () => {
    return request(application)
      .get(`/api/attachments/${activeAttachmentId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.should.have.properties([
          'id', 'entityType', 'entityId', 'fileName', 'fileSize',
          'mimeType', 'storageKey', 'storageBucket', 'storageRegion',
          'uploadedBy', 'retentionStatus', 'createdAt', 'updatedAt', 'uploader'
        ]);
        res.body.id.should.equal(activeAttachmentId);
        res.body.fileName.should.equal('active-file.pdf');
        res.body.uploader.should.have.properties(['id', 'name', 'email']);
        res.body.uploader.id.should.equal('zitadel-sub-01');
      });
  });

  // TS-13: No incluye checksum
  it('should not include checksum field in response', () => {
    return request(application)
      .get(`/api/attachments/${activeAttachmentId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.should.not.have.property('checksum');
      });
  });
});
