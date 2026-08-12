import 'mocha';
import 'should';
import sinon from 'sinon';
import nock from 'nock';
import { Readable } from 'stream';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, AttachmentEntityType, Project, Requirement, RequirementActivity, RequirementMailThread, RequirementSubscriptor, RetentionStatus, User, UserProjectPermission } from '@jiku/models';
import storageService from '../../lib/utils/storage-service';

const MATTERMOST_BASE = process.env.MATTERMOST_INTEGRATION_URL || 'https://mattermost-bot.gestion.dev.grava.io/api';

// Tokens del mock:
// token_01_user            → sub: zitadel-sub-01, rol: user
// token_04_external_user   → sub: zitadel-sub-04, rol: external-user

describe('POST /api/opus/requirements', () => {
  let application: Application;

  const projectId = 7000;
  const projectNoPermId = 7001;

  before(function () {
    this.timeout(30000);
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01opusreq', email: 'user01opusreq@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuser04opusreq', email: 'extopusreq@mail.com' }))
      .then(() => Project.create({
        id: projectId, code: 'OR1', name: 'Opus Requirements Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01',
      }))
      .then(() => Project.create({
        id: projectNoPermId, code: 'OR2', name: 'Opus Requirements Project 2', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01',
      }))
      .then(() => UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId }));
  });

  after(() => {
    return RequirementActivity.destroy({ where: {} })
      .then(() => RequirementSubscriptor.destroy({ where: {} }))
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Project.destroy({ where: { id: [projectId, projectNoPermId] } }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-1 (S-077): incidencia de cliente externo crea en analisis (reemplaza TS-7 de S-066)
  it('TS-1: should create an incidencia requirement with state analisis for external user with permission', () => {
    return request(application)
      .post('/api/opus/requirements')
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ title: 'Incidencia externa', description: 'Descripcion', type: 'incidencia', projectId })
      .expect(201)
      .then((response) => {
        response.body.state.should.equal('analisis');
      });
  });

  // TS-2 (S-066, sin cambios): otro tipo de requisito de cliente externo sigue en analisis
  it('TS-2: should create a funcionalidad requirement with state analisis for external user', () => {
    return request(application)
      .post('/api/opus/requirements')
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ title: 'Funcionalidad externa', description: 'Descripcion', type: 'funcionalidad', projectId })
      .expect(201)
      .then((response) => {
        response.body.state.should.equal('analisis');
      });
  });

  // TS-3 (S-077): incidencia de usuario interno via opus tambien crea en analisis (reemplaza TS-9 de S-066)
  it('TS-3: should create an incidencia requirement with state analisis for internal user too', () => {
    return request(application)
      .post('/api/opus/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Incidencia interna via opus', description: 'Descripcion', type: 'incidencia', projectId })
      .expect(201)
      .then((response) => {
        response.body.state.should.equal('analisis');
      });
  });

  // TS-4 (S-066, sin cambios): cliente externo sin permiso no llega a aplicar la regla de estado
  it('TS-4: should return 403 access_denied for external user without permission on the project', () => {
    return request(application)
      .post('/api/opus/requirements')
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ title: 'Incidencia sin permiso', description: 'Descripcion', type: 'incidencia', projectId: projectNoPermId })
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-6: priority se acepta como string del enum (regresión: el schema Joi exigía number)
  it('TS-6: should create a requirement with a valid string priority', () => {
    return request(application)
      .post('/api/opus/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Con prioridad alta', description: 'Descripcion', priority: 'alta', projectId })
      .expect(201)
      .then((response) => {
        response.body.priority.should.equal('alta');
      });
  });

  // TS-7: priority numerico (formato viejo) es rechazado por el schema Joi
  it('TS-7: should return 400 if priority is sent as a number (old schema)', () => {
    return request(application)
      .post('/api/opus/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Con prioridad numerica', description: 'Descripcion', priority: 3, projectId })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-5 (S-077): dato historico en_cola persistido antes de este cambio no se migra ni se modifica
  it('TS-5: should not migrate or modify a historical requirement already persisted with state en_cola', () => {
    return Requirement.create({
      title: 'Historico en_cola',
      description: 'Desc',
      type: 'incidencia',
      state: 'en_cola',
      priority: 'sin_prioridad',
      projectId,
      createdBy: 'zitadel-sub-01',
    })
      .then((created) => Requirement.findByPk(created.id))
      .then((found) => {
        found!.state.should.equal('en_cola');
      });
  });

  describe('Notificacion de creacion (S-079)', () => {
    const mmProjectId = 8300;

    before(() => {
      return Project.create({
        id: mmProjectId, code: 'OMM1', name: 'Opus Mattermost Project', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01',
        keyValuePairs: { mattermost_group_name: 'canal-opus-creacion' },
      })
        .then(() => UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: mmProjectId }));
    });

    afterEach(() => {
      sinon.restore();
      nock.cleanAll();
    });

    after(() => {
      return RequirementMailThread.destroy({ where: {} })
        .then(() => RequirementActivity.destroy({ where: {} }))
        .then(() => RequirementSubscriptor.destroy({ where: {} }).then(() => Requirement.destroy({ where: { projectId: mmProjectId } })))
        .then(() => UserProjectPermission.destroy({ where: { projectId: mmProjectId } }))
        .then(() => Project.destroy({ where: { id: mmProjectId } }));
    });

    it('TS-mm-1: ya no notifica a Mattermost (notificaciones eliminadas del alcance)', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({
          title: 'Requisito con grupo mattermost',
          description: 'descripcion',
          projectId: mmProjectId,
        })
        .expect(201)
        .then((response) => {
          // Antes esta ruta disparaba una notificación a Mattermost. Ahora solo crea.
          response.body.title.should.equal('Requisito con grupo mattermost');
        });
    });

    it('should NOT call Mattermost when project has no mattermost_group_name', () => {
      const scope = nock(MATTERMOST_BASE).post('/messages/group').reply(200, { ok: true });

      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Incidencia sin canal', description: 'Desc', type: 'incidencia', projectId })
        .expect(201)
        .then(() => new Promise(resolve => setTimeout(resolve, 100)))
        .then(() => {
          scope.isDone().should.be.false();
        });
    });

    it('should return 201 even when Mattermost fails', () => {
      nock(MATTERMOST_BASE).post('/messages/group').reply(500, { error: 'Server error' });

      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Incidencia fallo mm', description: 'Desc', type: 'incidencia', projectId: mmProjectId })
        .expect(201);
    });
  });

  describe('Attachments (S-094)', () => {
    const otherProjectId = 7002;
    let getFileStreamStub: sinon.SinonStub;

    function createDraft(uploadedBy: string, entityId: number = projectId) {
      return Attachment.create({
        entityType: AttachmentEntityType.RequirementDraft,
        entityId,
        fileName: 'test.png',
        fileSize: 'fake-file-content'.length,
        mimeType: 'image/png',
        storageKey: `test-key-${Math.random()}`,
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        uploadedBy,
        retentionStatus: RetentionStatus.Active,
      });
    }

    before(function () {
      this.timeout(30000);
      getFileStreamStub = sinon.stub(storageService, 'getFileStream').callsFake(() =>
        Promise.resolve(Readable.from(Buffer.from('fake-file-content')))
      );
      return Project.create({
        id: otherProjectId, code: 'OR3', name: 'Opus Requirements Project 3', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01',
      });
    });

    after(() => {
      getFileStreamStub.restore();
      return Attachment.destroy({ where: {}, force: true })
        .then(() => Project.destroy({ where: { id: otherProjectId } }));
    });

    it('TS-1: should link attachments with entityType requirement for external user with permission', () => {
      return createDraft('zitadel-sub-04').then((draft) =>
        request(application)
          .post('/api/opus/requirements')
          .set('Authorization', 'Bearer token_04_external_user')
          .send({ title: 'Req con adjunto', description: 'Descripcion', projectId, attachmentIds: [draft.id] })
          .expect(201)
          .then((response) =>
            Attachment.findByPk(draft.id).then((updated) => {
              updated!.entityType.should.equal(AttachmentEntityType.Requirement);
              updated!.entityId!.should.equal(response.body.id);
            })
          )
      );
    });

    it('TS-2: should link attachments with entityType requirement for internal user too', () => {
      return createDraft('zitadel-sub-01').then((draft) =>
        request(application)
          .post('/api/opus/requirements')
          .set('Authorization', 'Bearer token_01_user')
          .send({ title: 'Req interno con adjunto', description: 'Descripcion', projectId, attachmentIds: [draft.id] })
          .expect(201)
          .then(() =>
            Attachment.findByPk(draft.id).then((updated) => {
              updated!.entityType.should.equal(AttachmentEntityType.Requirement);
            })
          )
      );
    });

    it('TS-3: should allow preview of the linked attachment after confirmation', async () => {
      const draft = await createDraft('zitadel-sub-04');

      await request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Req con adjunto preview', description: 'Descripcion', projectId, attachmentIds: [draft.id] })
        .expect(201);

      await request(application)
        .get(`/api/attachments/${draft.id}/preview`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(200);
    });

    it('TS-4: should return 400 invalid_attachment_id and not create the requirement when attachmentId is invalid', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Req con adjunto invalido', description: 'Descripcion', projectId, attachmentIds: [99999999] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_attachment_id');
          return Requirement.findOne({ where: { title: 'Req con adjunto invalido' } });
        })
        .then((found) => {
          (found === null).should.be.true();
        });
    });

    it('TS-5: should create the requirement normally without attachmentIds', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Req sin adjuntos', description: 'Descripcion', projectId })
        .expect(201);
    });

    it('TS-6: should not link an attachment whose requirement_draft belongs to another project', () => {
      return createDraft('zitadel-sub-04', otherProjectId).then((draft) =>
        request(application)
          .post('/api/opus/requirements')
          .set('Authorization', 'Bearer token_04_external_user')
          .send({ title: 'Req cruzado', description: 'Descripcion', projectId, attachmentIds: [draft.id] })
          .expect(400)
          .then((response) => {
            response.body.code.should.equal('invalid_attachment_id');
          })
      );
    });
  });
});
