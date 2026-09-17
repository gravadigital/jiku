import 'mocha';
import 'should';
import sinon from 'sinon';
import nock from 'nock';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, AttachmentEntityType, File, Project, Requirement, RequirementActivity, RequirementSubscriptor, RetentionStatus, User, UserProjectPermission } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

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
      return RequirementActivity.destroy({ where: {} })
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

  describe('archivos vinculados (REQ-001, S-003)', () => {
    /**
     * `fileIds` son ids de `files`: el archivo ya existe y el vínculo se crea contra el
     * requisito recién creado. `uploadedBy` es lo que decide la titularidad (RF-12), y acá
     * importa doble porque el portal lo usa tanto el externo como el interno.
     */
    function createFile(uploadedBy: string): Promise<File> {
      return File.create({
        fileName: 'test.png',
        fileSize: 1024,
        mimeType: 'image/png',
        storageKey: `grava-gestion/f/${Math.random()}.png`,
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        byteStatus: 'pending',
        retentionStatus: RetentionStatus.Active,
        uploadedBy,
      } as any, { validate: false });
    }

    afterEach(() => {
      return Attachment.destroy({ where: {}, force: true })
        .then(() => File.destroy({ where: {}, force: true }));
    });

    it('TS-1: vincula el archivo con entityType requirement para el externo con permiso', () => {
      let file: File;
      return createFile('zitadel-sub-04')
        .then((created) => { file = created; })
        .then(() => request(application)
          .post('/api/opus/requirements')
          .set('Authorization', 'Bearer token_04_external_user')
          .send({ title: 'Req con adjunto', description: 'Descripcion', projectId, fileIds: [file.id] })
          .expect(201))
        .then((response) => Attachment.findOne({ where: { fileId: file.id } })
          .then((link) => {
            link!.entityType.should.equal(AttachmentEntityType.Requirement);
            link!.entityId!.should.equal(response.body.id);
            return File.findByPk(file.id);
          }))
        .then((refreshed) => {
          (refreshed as any).byteStatus.should.equal('uploaded');
        });
    });

    it('TS-2: vincula el archivo también para el usuario interno', () => {
      let file: File;
      return createFile('zitadel-sub-01')
        .then((created) => { file = created; })
        .then(() => request(application)
          .post('/api/opus/requirements')
          .set('Authorization', 'Bearer token_01_user')
          .send({ title: 'Req interno con adjunto', description: 'Descripcion', projectId, fileIds: [file.id] })
          .expect(201))
        .then(() => Attachment.findOne({ where: { fileId: file.id } }))
        .then((link) => {
          link!.entityType.should.equal(AttachmentEntityType.Requirement);
        });
    });

    // ELIMINADO (REQ-001, S-005): "TS-3: preview del adjunto vinculado". La preview ya no
    // sirve el byte —autoriza y redirige a una URL prefirmada que pide por el bus—, así que
    // ejercitarla acá exigiría fijar la respuesta del bus y solo duplicaría lo que ya cubre
    // tests/routes/attachments-preview.test.ts.

    it('TS-4: devuelve 400 invalid_fields y no crea el requisito cuando el fileId no existe', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Req con adjunto invalido', description: 'Descripcion', projectId, fileIds: [99999999] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
          return Requirement.findOne({ where: { title: 'Req con adjunto invalido' } });
        })
        .then((found) => {
          (found === null).should.be.true();
        });
    });

    it('TS-5: crea el requisito normalmente sin fileIds', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Req sin adjuntos', description: 'Descripcion', projectId })
        .expect(201);
    });

    // TS-6 (RF-12): antes esto probaba "el draft es de otro proyecto". El proyecto ya no
    // ata al archivo: lo que lo ata es quién lo subió. Un externo no puede vincular lo que
    // subió otro, ni siquiera dentro de un proyecto donde sí tiene permiso.
    it('TS-6: devuelve 403 file_not_owned y no crea el requisito cuando el archivo es ajeno', () => {
      let file: File;
      return createFile('zitadel-sub-01')
        .then((created) => { file = created; })
        .then(() => request(application)
          .post('/api/opus/requirements')
          .set('Authorization', 'Bearer token_04_external_user')
          .send({ title: 'Req cruzado', description: 'Descripcion', projectId, fileIds: [file.id] })
          .expect(403))
        .then((response) => {
          response.body.code.should.equal('file_not_owned');
          return Requirement.findOne({ where: { title: 'Req cruzado' } });
        })
        .then((found) => {
          (found === null).should.be.true();
        });
    });

    it('TS-7: devuelve 400 invalid_fields con más de 10 fileIds', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({
          title: 'Demasiados',
          description: 'Descripcion',
          projectId,
          fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });
  });

  /**
   * S-070: la ruta pasa de N+1 comandos (`requirements.new` + un
   * `requirements.{id}.subscriptors.new` por suscriptor) a un solo `requirements.new` con
   * `subscriberUserIds`, armando el set con el creador incluido y primero.
   */
  describe('S-070: un solo comando con subscriberUserIds', () => {
    afterEach(() => {
      fakeBus.reset();
    });

    // TS-8 (CA-6): el N+1 desaparece, se publica exactamente un comando
    it('TS-8: publica exactamente UN comando requirements.new, ninguno de suscripción', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Alta unificada', description: 'Desc', projectId, subscriberUserIds: ['zitadel-sub-01'] })
        .expect(201)
        .then(() => {
          fakeBus.sent.should.have.length(1);
          fakeBus.sent[0].command.should.equal('requirements.new');
          fakeBus.sent.some((c) => /subscriptors\.new$/.test(c.command)).should.be.false();
        });
    });

    // TS-9 (CA-6, CA-7): el creador va en el set junto al suscriptor explícito
    it('TS-9: el creador y el suscriptor explícito quedan ambos en el set y en la base', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Alta con creador y suscriptor', description: 'Desc', projectId, subscriberUserIds: ['zitadel-sub-01'] })
        .expect(201)
        .then((res) => {
          const payload = fakeBus.last!.payload as any;
          payload.subscriberUserIds.should.have.length(2);
          payload.subscriberUserIds.should.containDeep(['zitadel-sub-04', 'zitadel-sub-01']);
          return RequirementSubscriptor.findAll({ where: { requirementId: res.body.id } });
        })
        .then((rows) => {
          rows.should.have.length(2);
          rows.map((r) => r.userId).should.containDeep(['zitadel-sub-04', 'zitadel-sub-01']);
        });
    });

    // TS-10 (CA-6, CA-7): sin subscriberUserIds, el creador se suscribe igual
    it('TS-10: sin subscriberUserIds, el creador se suscribe igual (un solo comando)', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Alta sin suscriptores', description: 'Desc', projectId })
        .expect(201)
        .then((res) => {
          fakeBus.sent.should.have.length(1);
          (fakeBus.last!.payload as any).subscriberUserIds.should.deepEqual(['zitadel-sub-04']);
          return RequirementSubscriptor.count({ where: { requirementId: res.body.id } });
        })
        .then((count) => count.should.equal(1));
    });

    // TS-11 (CA-6, CA-7): el creador repetido en el cuerpo se colapsa por el Set de la api
    it('TS-11: el creador repetido en el cuerpo se colapsa a un solo elemento', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Alta creador repetido', description: 'Desc', projectId, subscriberUserIds: ['zitadel-sub-04', 'zitadel-sub-01'] })
        .expect(201)
        .then((res) => {
          const payload = fakeBus.last!.payload as any;
          payload.subscriberUserIds.should.have.length(2);
          payload.subscriberUserIds.filter((id: string) => id === 'zitadel-sub-04').should.have.length(1);
          return RequirementSubscriptor.count({ where: { requirementId: res.body.id } });
        })
        .then((count) => count.should.equal(2));
    });

    // TS-12 (CA-7): el creador va primero en el array
    it('TS-12: el creador va primero en subscriberUserIds', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Alta orden creador', description: 'Desc', projectId, subscriberUserIds: ['zitadel-sub-04', 'zitadel-sub-01'] })
        .expect(201)
        .then(() => {
          (fakeBus.last!.payload as any).subscriberUserIds[0].should.equal('zitadel-sub-04');
        });
    });

    // TS-13 (CA-6): userId inexistente → 404 y rollback completo, nada nuevo queda escrito
    it('TS-13: un userId inexistente responde 404 user_not_found y hace rollback completo', () => {
      let subscriptorCountBefore: number;
      return RequirementSubscriptor.count({ where: { userId: 'zitadel-sub-04' } })
        .then((c) => { subscriptorCountBefore = c; })
        .then(() => request(application)
          .post('/api/opus/requirements')
          .set('Authorization', 'Bearer token_04_external_user')
          .send({ title: 'Alta con fantasma', description: 'Desc', projectId, subscriberUserIds: ['no-existe-jamas'] })
          .expect(404))
        .then((res) => {
          res.body.code.should.equal('user_not_found');
          return Requirement.findOne({ where: { title: 'Alta con fantasma' } });
        })
        .then((found) => {
          (found === null).should.be.true();
          return RequirementSubscriptor.count({ where: { userId: 'zitadel-sub-04' } });
        })
        .then((countAfter) => {
          countAfter.should.equal(subscriptorCountBefore);
        });
    });

    // TS-14: ids numéricos rechazados por Joi (regresión, el esquema ya lo declaraba)
    it('TS-14: ids numéricos en subscriberUserIds son rechazados por Joi', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Alta ids numericos', description: 'Desc', projectId, subscriberUserIds: [123] })
        .expect(400)
        .then((res) => {
          res.body.code.should.equal('invalid_fields');
          (fakeBus.last === undefined).should.be.true();
        });
    });

    // TS-15: bus caído → 503 y no escribe nada
    it('TS-15: bus caído responde 503 y no escribe nada', () => {
      fakeBus.failWithNoResponders();

      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Alta bus caido', description: 'Desc', projectId, subscriberUserIds: ['zitadel-sub-01'] })
        .expect(503)
        .then((res) => {
          res.body.code.should.equal('service_unavailable');
          return Requirement.findOne({ where: { title: 'Alta bus caido' } });
        })
        .then((found) => {
          (found === null).should.be.true();
        });
    });

    // TS-16: timeout → 504, sin comandos de suscripción como reintento
    it('TS-16: timeout responde 504 y no publica comandos de suscripción', () => {
      fakeBus.failWithTimeout();

      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Alta timeout', description: 'Desc', projectId, subscriberUserIds: ['zitadel-sub-01'] })
        .expect(504)
        .then((res) => {
          res.body.code.should.equal('gateway_timeout');
          fakeBus.sent.some((c) => /subscriptors\.new$/.test(c.command)).should.be.false();
        });
    });

    // TS-17: regresión, fileIds + subscriberUserIds conviven
    it('TS-17: fileIds y subscriberUserIds juntos siguen funcionando', () => {
      return File.create({
        fileName: 'attach.png',
        fileSize: 2048,
        mimeType: 'image/png',
        storageKey: `grava-gestion/f/${Math.random()}.png`,
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        byteStatus: 'pending',
        retentionStatus: RetentionStatus.Active,
        uploadedBy: 'zitadel-sub-04',
      } as any, { validate: false })
        .then((file) => request(application)
          .post('/api/opus/requirements')
          .set('Authorization', 'Bearer token_04_external_user')
          .send({
            title: 'Req con adjunto y suscriptor', description: 'Desc', projectId,
            fileIds: [file.id], subscriberUserIds: ['zitadel-sub-01'],
          })
          .expect(201)
          .then((res) => Attachment.findOne({ where: { fileId: file.id } })
            .then((att) => {
              att!.entityType.should.equal(AttachmentEntityType.Requirement);
              att!.entityId!.should.equal(res.body.id);
              return RequirementSubscriptor.count({ where: { requirementId: res.body.id } });
            })
            .then((count) => count.should.equal(2))
            .then(() => Attachment.destroy({ where: { fileId: file.id }, force: true }))
            .then(() => File.destroy({ where: { id: file.id }, force: true }))));
    });

    // TS-18: regresión, el 403 de permiso de proyecto sigue vigente. La autorización la
    // hace `core` (compuerta del despachador, no `validateProject`), así que el comando SÍ
    // se publica y es `core` quien lo rechaza — igual que TS-4 de este mismo archivo.
    it('TS-18: el 403 access_denied sigue vigente y no crea nada', () => {
      return request(application)
        .post('/api/opus/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ title: 'Alta sin permiso', description: 'Desc', projectId: projectNoPermId, subscriberUserIds: ['zitadel-sub-01'] })
        .expect(403)
        .then((res) => {
          res.body.code.should.equal('access_denied');
          return Requirement.findOne({ where: { title: 'Alta sin permiso' } });
        })
        .then((found) => {
          (found === null).should.be.true();
        });
    });
  });
});
