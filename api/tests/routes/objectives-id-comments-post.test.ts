import 'mocha';
import 'should';
import sinon from 'sinon';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import nock from 'nock';
import { Attachment, File, Objective, ObjectiveActivity, ObjectiveMailThread, Project, User } from '@jiku/models';

const MATTERMOST_BASE = process.env.MATTERMOST_INTEGRATION_URL || 'https://mattermost-bot.gestion.dev.grava.io/api';

describe('POST /api/objectives/:id/comments', () => {
  let application : Application;

  before(function() {
    application = start();
    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com'
    })
      // Segundo usuario: es el que sube el archivo ajeno del caso de titularidad (RF-12).
      .then(() => User.create({
        id: 'zitadel-sub-02',
        name: 'User 02',
        username: 'user02',
        email: 'user02@mail.com'
      }))
      .then(() => {
        return Project.create({
          id: 1,
          code: 'code1',
          name: 'Project1',
          type: 'comercial',
          description: 'Project test 1',
          status: 'activo',
          priority: 1,
          originId: 1,
          initDate: new Date(),
          createdBy: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Project.create({
          id: 30,
          name: 'Proyecto Con Mattermost',
          type: 'comercial',
          status: 'activo',
          initDate: new Date(),
          createdBy: 'zitadel-sub-01',
          keyValuePairs: { mattermost_group_name: 'canal-interno' },
        });
      })
      .then(() => {
        return Objective.create({
          id: 1,
          title: 'Objective test 1',
          description: 'objective description 1',
          state: 'activo',
          area: 'diseño',
          priority: 1,
          projectId: 1,
          createdAt: '2024-01-02',
          createdBy: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Objective.create({
          id: 2,
          title: 'Objective with Mattermost',
          description: 'objective with mattermost project',
          state: 'activo',
          area: 'desarrollo',
          priority: 1,
          projectId: 30,
          createdAt: '2024-01-02',
          createdBy: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Promise.all([
          ObjectiveActivity.create({
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'state',
            previousValue: '',
            newValue: 'activo',
            objectiveId: 1
          }),
          ObjectiveActivity.create({
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'priority',
            previousValue: '0',
            newValue: '1',
            objectiveId: 1,
          }),
          ObjectiveActivity.create({
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'area',
            previousValue: '',
            newValue: 'desarrollo',
            objectiveId: 1,
          })
        ]);
      });
  });

  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });

  after(() => {
    return ObjectiveActivity.destroy({where: {}})
      .then(() => {
        return Objective.destroy({where: {}});
      })
      .then(() => {
        return Project.destroy({where: {}});
      })
      .then(() => {
        return User.destroy({where: {}});
      });
  });

  it('should create a comment in objective 1 with internal visibility by default', () => {
    return request(application)
      .post('/api/objectives/1/comments')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'Comment test 1'
      })
      .expect(201)
      .then((response) => {
        const expectedObject = {
          objectiveId: 1,
          typeOfActivity: 'comment',
          newValue: 'Comment test 1',
          previousValue: '',
          changedBy: 'zitadel-sub-01',
          visibilityLevel: 'internal',
        };
        response.body.should.containDeep(expectedObject);

        return ObjectiveActivity.findAll();
      })
      .then((activities) => {
        const expectedObject = [
          { changedBy: 'zitadel-sub-01', typeOfActivity: 'state', previousValue: '', newValue: 'activo' },
          { changedBy: 'zitadel-sub-01', typeOfActivity: 'priority', previousValue: '0', newValue: '1' },
          { changedBy: 'zitadel-sub-01', typeOfActivity: 'area', previousValue: '', newValue: 'desarrollo' },
          { changedBy: 'zitadel-sub-01', typeOfActivity: 'comment', previousValue: '', newValue: 'Comment test 1', visibilityLevel: 'internal' },
        ];
        activities.should.containDeep(expectedObject);
        activities.length.should.be.equal(4);
      });
  });

  it('should create a public comment when visibilityLevel is specified as public', () => {
    return request(application)
      .post('/api/objectives/1/comments')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'Public comment test',
        visibilityLevel: 'public'
      })
      .expect(201)
      .then((response) => {
        const expectedObject = {
          objectiveId: 1,
          typeOfActivity: 'comment',
          newValue: 'Public comment test',
          previousValue: '',
          changedBy: 'zitadel-sub-01',
          visibilityLevel: 'public',
        };
        response.body.should.containDeep(expectedObject);
      });
  });

  it('should reject invalid visibilityLevel value', () => {
    return request(application)
      .post('/api/objectives/1/comments')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'Test comment',
        visibilityLevel: 'invalid'
      })
      .expect(400);
  });

  describe('Mattermost Notifications (S-079: apagadas globalmente)', () => {
    before(() => {
      return ObjectiveMailThread.create({ objectiveId: 2, messageId: '', mattermostPostId: 'post-obj2' });
    });

    after(() => {
      return ObjectiveMailThread.destroy({ where: { objectiveId: 2 } });
    });

    // TS-1: comentario publico en Objective ya NO dispara Mattermost
    it('TS-1: should NOT call Mattermost when comment is public (notifications turned off globally)', () => {
      const scope = nock(MATTERMOST_BASE).post('/messages/group').reply(200, { ok: true });

      return request(application)
        .post('/api/objectives/2/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'Comentario publico', visibilityLevel: 'public' })
        .expect(201)
        .then(() => new Promise(resolve => setTimeout(resolve, 100)))
        .then(() => {
          scope.isDone().should.be.false();
        });
    });

    it('should NOT call Mattermost when comment has visibilityLevel internal', () => {
      const scope = nock(MATTERMOST_BASE).post('/messages/group').reply(200, { ok: true });

      return request(application)
        .post('/api/objectives/2/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'secreto interno', visibilityLevel: 'internal' })
        .expect(201)
        .then(() => new Promise(resolve => setTimeout(resolve, 100)))
        .then(() => {
          scope.isDone().should.be.false();
        });
    });

    it('should NOT call Mattermost when comment has default visibility (internal)', () => {
      const scope = nock(MATTERMOST_BASE).post('/messages/group').reply(200, { ok: true });

      return request(application)
        .post('/api/objectives/2/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'comentario sin visibilityLevel explícito' })
        .expect(201)
        .then(() => new Promise(resolve => setTimeout(resolve, 100)))
        .then(() => {
          scope.isDone().should.be.false();
        });
    });

    it('should NOT call Mattermost when project has no mattermost_group_name', () => {
      const scope = nock(MATTERMOST_BASE).post('/messages/group').reply(200, { ok: true });

      return request(application)
        .post('/api/objectives/1/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'Comentario sin canal', visibilityLevel: 'public' })
        .expect(201)
        .then(() => new Promise(resolve => setTimeout(resolve, 100)))
        .then(() => {
          scope.isDone().should.be.false();
        });
    });
  });


  describe('archivos vinculados al comentario (REQ-001, S-003)', () => {
    /**
     * `fileIds` son ids de `files`, no de `attachments`: el archivo ya existe y el vínculo se
     * crea contra el comentario recién creado. `uploadedBy` decide la titularidad (RF-12).
     */
    function createFile(uploadedBy: string = 'zitadel-sub-01'): Promise<File> {
      return File.create({
        fileName: 'adjunto.png',
        fileSize: 1024,
        mimeType: 'image/png',
        storageKey: `grava-gestion/f/${Math.random()}.png`,
        storageBucket: 'test-bucket',
        storageRegion: 'sfo2',
        byteStatus: 'pending',
        retentionStatus: 'active',
        uploadedBy,
      } as any, { validate: false });
    }

    afterEach(() => {
      return Attachment.destroy({ where: {}, force: true })
        .then(() => File.destroy({ where: {}, force: true }));
    });

    it('acepta un fileIds vacío, porque la web siempre lo manda', () => {
      return request(application)
        .post('/api/objectives/1/comments')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'comentario sin adjuntos', fileIds: [] })
        .expect(201)
        .then((response) => {
          response.body.newValue.should.equal('comentario sin adjuntos');
        });
    });

    it('vincula el archivo al comentario creado', () => {
      let file: File;
      return createFile()
        .then((created) => { file = created; })
        .then(() => request(application)
          .post('/api/objectives/1/comments')
          .set('Authorization', 'Bearer token_01_user')
          .send({ comment: 'comentario con adjunto', fileIds: [file.id] })
          .expect(201))
        .then((response) => Attachment.findOne({ where: { fileId: file.id } })
          .then((att) => {
            att!.entityType.should.equal('objective_comment');
            att!.entityId!.should.equal(response.body.id);
            return File.findByPk(file.id);
          }))
        .then((refreshed) => {
          (refreshed as any).byteStatus.should.equal('uploaded');
        });
    });

    // RF-12: sin excepción por rol. Acá el actor es el dueño del comentario, no del archivo.
    it('devuelve 403 file_not_owned y no crea el comentario cuando el archivo es ajeno', () => {
      let countBefore: number;
      return ObjectiveActivity.count()
        .then((c) => { countBefore = c; })
        .then(() => createFile('zitadel-sub-02'))
        .then((file) => request(application)
          .post('/api/objectives/1/comments')
          .set('Authorization', 'Bearer token_01_user')
          .send({ comment: 'archivo ajeno', fileIds: [file.id] })
          .expect(403))
        .then((response) => {
          response.body.code.should.equal('file_not_owned');
          return ObjectiveActivity.count();
        })
        .then((countAfter) => {
          countAfter.should.equal(countBefore);
        });
    });

    it('devuelve 400 invalid_fields cuando el fileId no existe', () => {
      return request(application)
        .post('/api/objectives/1/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'archivo inexistente', fileIds: [987654] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    it('devuelve 400 invalid_fields con más de 10 fileIds', () => {
      return request(application)
        .post('/api/objectives/1/comments')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'demasiados', fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });
  });

});
