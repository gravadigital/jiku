import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, File, Project, Requirement, RequirementActivity, User } from '@jiku/models';


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
      .then(() => File.destroy({ where: {}, force: true }))
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

  describe('comentarios con archivos vinculados (REQ-001, S-003)', () => {
    /**
     * `fileIds` son ids de `files`: el archivo existe por sí solo y el vínculo se crea contra
     * el comentario recién creado. `uploadedBy` decide la titularidad (RF-12).
     */
    function createFile(uploadedBy: string = 'zitadel-sub-01', overrides: Record<string, any> = {}): Promise<File> {
      return File.create({
        fileName: 'file.png',
        fileSize: 1024,
        mimeType: 'image/png',
        storageKey: `grava-gestion/f/${Math.random()}.png`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        byteStatus: 'pending',
        retentionStatus: 'active',
        uploadedBy,
        ...overrides,
      } as any, { validate: false });
    }

    afterEach(() => {
      return Attachment.destroy({ where: {}, force: true })
        .then(() => File.destroy({ where: {}, force: true }));
    });

    // TS-19: comentario con archivo válido → el vínculo apunta a la actividad creada.
    it('TS-19: crea el comentario y vincula el archivo a la actividad nueva', () => {
      let file: File;
      return createFile()
        .then((created) => { file = created; })
        .then(() => request(application)
          .post('/api/requirements/1/comments')
          .set('Authorization', 'Bearer token_01_user')
          .send({ comment: 'texto con adjunto', visibilityLevel: 'internal', fileIds: [file.id] })
          .expect(201))
        .then(() => RequirementActivity.findOne({
          where: { requirementId: 1, typeOfActivity: 'comment', newValue: 'texto con adjunto' },
        }))
        .then((activity) => {
          activity!.should.not.be.null();
          return Attachment.findOne({ where: { fileId: file.id } }).then((att) => {
            att!.entityType.should.equal('requirement_comment');
            att!.entityId!.should.equal(activity!.id);
            return File.findByPk(file.id);
          });
        })
        .then((refreshed) => {
          (refreshed as any).byteStatus.should.equal('uploaded');
        });
    });

    // TS-20: comentario sin archivos
    it('TS-20: crea el comentario sin tocar vínculos cuando no se mandan fileIds', () => {
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

    // TS-21 (RF-12): archivo de otro usuario → 403 y, sobre todo, NO queda el comentario.
    it('TS-21: devuelve 403 file_not_owned y no crea el comentario cuando el archivo es ajeno', () => {
      let countBefore: number;
      return RequirementActivity.count()
        .then((c) => { countBefore = c; })
        .then(() => createFile('zitadel-sub-02'))
        .then((file) => request(application)
          .post('/api/requirements/1/comments')
          .set('Authorization', 'Bearer token_01_user')
          .send({ comment: 'texto', fileIds: [file.id] })
          .expect(403))
        .then((response) => {
          response.body.code.should.equal('file_not_owned');
          return RequirementActivity.count();
        })
        .then((countAfter) => {
          countAfter.should.equal(countBefore);
        });
    });

    // TS-22: `fileId` inexistente → `invalid_fields`, que es distinto de "no es tuyo".
    it('TS-22: devuelve 400 invalid_fields cuando el fileId no existe', () => {
      return request(application)
        .post('/api/requirements/1/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'texto', fileIds: [987654] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    // TS-23: archivo retirado. Sigue existiendo, así que no es "no existe" pero tampoco es
    // vinculable: la vida del archivo se valida antes que la titularidad.
    it('TS-23: devuelve 400 invalid_fields cuando el archivo ya no está activo', () => {
      return createFile('zitadel-sub-01', { retentionStatus: 'scheduled_for_deletion' })
        .then((file) => request(application)
          .post('/api/requirements/1/comments')
          .set('Authorization', 'Bearer token_01_user')
          .send({ comment: 'texto', fileIds: [file.id] })
          .expect(400))
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    // TS-24: el tope de 10 lo corta Joi antes del bus.
    it('TS-24: devuelve 400 invalid_fields con más de 10 fileIds', () => {
      return request(application)
        .post('/api/requirements/1/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'texto', fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    // ELIMINADO (REQ-001, S-003): "TS-24 viejo: entityType distinto de comment_draft" y
    // "TS-16 (S-095): re-anclar un requirement_comment_draft". Probaban el re-anclaje de
    // drafts, que ya no existe: el archivo vive solo en `files` y el vínculo se crea contra
    // el comentario ya creado, así que no hay `entityType` de draft que validar.
  });
});
