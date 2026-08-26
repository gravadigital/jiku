import 'mocha';
import 'should';
import sinon from 'sinon';
import nock from 'nock';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, AttachmentEntityType, File, Project, Requirement, RequirementActivity, RetentionStatus, User, UserProjectPermission } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

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

  describe('archivos vinculados al comentario (REQ-001, S-003)', () => {
    /**
     * `fileIds` son ids de `files`: el archivo ya existe y el vínculo se crea contra el
     * comentario recién creado. `uploadedBy` decide la titularidad (RF-12).
     */
    function createFile(uploadedBy: string = 'zitadel-sub-04'): Promise<File> {
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

    // TS-10: el vínculo apunta al comentario creado, con entityType requirement_comment.
    it('TS-10: vincula el archivo al comentario como requirement_comment', () => {
      let file: File;
      return createFile()
        .then((created) => { file = created; })
        .then(() => request(application)
          .post(`/api/opus/requirements/${requirementId}/comments`)
          .set('Authorization', 'Bearer token_04_external_user')
          .send({ comment: 'Comentario con adjunto', fileIds: [file.id] })
          .expect(200))
        .then((response) => Attachment.findOne({ where: { fileId: file.id } })
          .then((link) => {
            link!.entityType.should.equal(AttachmentEntityType.RequirementComment);
            link!.entityId!.should.equal(response.body.id);
            return File.findByPk(file.id);
          }))
        .then((refreshed) => {
          (refreshed as any).byteStatus.should.equal('uploaded');
        });
    });

    // ELIMINADO (REQ-001, S-003): "TS-11: confirmar un comment_draft legado durante la
    // ventana de transición". No hay drafts ni ventana que sostener: el archivo existe solo
    // en `files` y el vínculo se crea contra el comentario ya creado.

    // RF-12: el externo no puede vincular lo que subió el interno, aunque tenga permiso
    // sobre el proyecto.
    it('devuelve 403 file_not_owned y no crea el comentario cuando el archivo es ajeno', () => {
      let countBefore: number;
      return RequirementActivity.count({ where: { requirementId } })
        .then((c) => { countBefore = c; })
        .then(() => createFile('zitadel-sub-01'))
        .then((file) => request(application)
          .post(`/api/opus/requirements/${requirementId}/comments`)
          .set('Authorization', 'Bearer token_04_external_user')
          .send({ comment: 'Comentario con archivo ajeno', fileIds: [file.id] })
          .expect(403))
        .then((response) => {
          response.body.code.should.equal('file_not_owned');
          return RequirementActivity.count({ where: { requirementId } });
        })
        .then((countAfter) => {
          countAfter.should.equal(countBefore);
        });
    });

    it('devuelve 400 invalid_fields cuando el fileId no existe', () => {
      return request(application)
        .post(`/api/opus/requirements/${requirementId}/comments`)
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ comment: 'Comentario con archivo inexistente', fileIds: [99999999] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    it('devuelve 400 invalid_fields con más de 10 fileIds', () => {
      return request(application)
        .post(`/api/opus/requirements/${requirementId}/comments`)
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ comment: 'Demasiados', fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });
  });

  /**
   * S-030 (CA-7, CA-9, CA-10, CA-11): la traducción a HTTP de los dos rechazos que core emite,
   * vista desde una ruta real y no desde el mapa.
   *
   * EL REPLY ES FIJO Y NO UNA EJECUCIÓN REAL DE CORE, y no es un atajo: mientras la api siga
   * autorizando por su cuenta (CA-14), `validateProjectPermissions` rechaza al external-user
   * ANTES de publicar, así que el rechazo de core no es alcanzable desde una ruta. Se vuelve
   * alcanzable en S-034, y para entonces esta traducción ya tiene que estar puesta.
   */
  describe('la traducción de los rechazos de core a HTTP (S-030)', () => {
    it('TS-9 (S-030): traduce access_denied a 403 con el cuerpo que los fronts conocen', () => {
      fakeBus.reply(`requirements.${requirementId}.comment`, {
        status: 'failure',
        errorCode: 'access_denied',
        errorMessage: 'No tenés permiso sobre esta entidad',
      });

      return request(application)
        .post(`/api/opus/requirements/${requirementId}/comments`)
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ comment: 'Comentario de prueba' })
        .expect(403)
        .then((response) => {
          response.body.code.should.equal('access_denied');
          response.body.message.should.equal('No tenés permiso sobre esta entidad');
          // Sin esta aserción, un 403 emitido por un middleware de la api pasaría el test
          // igual, y estaríamos probando `validateProjectPermissions` en vez de la traducción.
          fakeBus.last!.command.should.equal(`requirements.${requirementId}.comment`);
        });
    });

    // CA-10 vista desde HTTP: mismo status, `code` distinto. Sin este test, "no se fusionan" es
    // una afirmación sobre el catálogo y no sobre lo que recibe el front.
    it('TS-10 (S-030): caller_not_authorized sale también 403, con su propio code', () => {
      fakeBus.reply(`requirements.${requirementId}.comment`, {
        status: 'failure',
        errorCode: 'caller_not_authorized',
        errorMessage: 'Caller no autorizado',
      });

      return request(application)
        .post(`/api/opus/requirements/${requirementId}/comments`)
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ comment: 'Comentario de prueba' })
        .expect(403)
        .then((response) => {
          response.body.code.should.equal('caller_not_authorized');
          response.body.message.should.equal('Caller no autorizado');
          fakeBus.last!.command.should.equal(`requirements.${requirementId}.comment`);
        });
    });

    // TS-12 — el guardián de CA-14 en este archivo: SIN reply fijo, con core real ejecutando el
    // comando. Si se pone rojo, alguien tocó una regla de autorización de la api.
    it('TS-12 (S-030): el camino feliz del portal sigue en 200, con core real ejecutando', () => {
      return request(application)
        .post(`/api/opus/requirements/${requirementId}/comments`)
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ comment: 'Comentario de prueba' })
        .expect(200)
        .then((response) => {
          response.body.should.have.property('id');
          response.body.visibilityLevel.should.equal('public');
          response.body.requirementId.should.equal(requirementId);
          return RequirementActivity.findByPk(response.body.id);
        })
        .then((activity) => {
          (activity !== null).should.be.true();
        });
    });
  });
});
