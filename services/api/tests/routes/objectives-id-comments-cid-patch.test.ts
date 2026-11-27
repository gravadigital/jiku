import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Attachment, File, Objective, ObjectiveActivity, Project, User } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

// `fileIds` son ids de `files` ya subidos (REQ-001, S-003): el archivo existe por sí solo y el
// vínculo lo crea core al vincularlo al comentario. Mismo patrón que
// `requirements-id-activity-post.test.ts`.
function createFile(uploadedBy: string = 'zitadel-sub-01'): Promise<File> {
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
  } as any, { validate: false });
}

describe('PATCH /api/objectives/:id/comment/:cid', () => {
  let application : Application;

  before(function() {
    application = start();
    return Promise.all([
      User.create({
        id: 'zitadel-sub-01',
        name: 'User 01',
        username: 'user01',
        email: 'user01@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-02',
        name: 'User 02',
        username: 'user02',
        email: 'user02@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-03',
        name: 'User 03',
        username: 'user03',
        email: 'user03@mail.com'
      }),
    ])
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
      });
  });

  after(() => {
    return Attachment.destroy({where: {}, force: true})
      .then(() => File.destroy({where: {}, force: true}))
      .then(() => Objective.destroy({where: {}}))
      .then(() => {
        return Project.destroy({where: {}});
      })
      .then(() => {
        return User.destroy({where: {}});
      });
  });

  // El bus de tests ejecuta los comandos contra core con la misma base, así que las
  // actividades tienen que existir de verdad para que la edición no falle. Se recrean antes
  // de cada test para que ninguno dependa del estado que dejó otro.
  beforeEach(() => {
    fakeBus.reset();
    return Attachment.destroy({where: {}, force: true})
      .then(() => File.destroy({where: {}, force: true}))
      .then(() => ObjectiveActivity.destroy({where: {}}))
      .then(() => {
        return Promise.all([
          ObjectiveActivity.create({
            id: 1,
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'comment',
            previousValue: '',
            newValue: 'New Comment',
            objectiveId: 1
          }),
          ObjectiveActivity.create({
            id: 2,
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'priority',
            previousValue: '0',
            newValue: '1',
            objectiveId: 1,
          }),
        ]);
      });
  });

  // TS-1: el autor edita, se publica tasks.1.comment.1.edit, core escribe newValue, editedAt, editedBy.
  it('publica tasks.{id}.comment.{cid}.edit y core escribe la edición', () => {
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'Edited comment'
      })
      .expect(200)
      .then((response) => {
        response.body.code.should.be.equal('comment_updated');
        response.body.message.should.be.equal('Comment Updated');

        fakeBus.last!.command.should.equal('tasks.1.comment.1.edit');
        fakeBus.last!.payload.comment.should.equal('Edited comment');

        return ObjectiveActivity.findByPk(1);
      })
      .then((activity) => {
        activity!.newValue.should.equal('Edited comment');
        (activity!.editedAt !== null).should.be.true();
        activity!.editedBy!.should.equal('zitadel-sub-01');
      });
  });

  // TS-2: bus sin suscriptores -> 503, y la base no cambió (ya no escribe con el ORM).
  it('TS-2: sin suscriptores del bus responde 503 y no escribe', () => {
    fakeBus.failWithNoResponders();
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'No debe escribirse'
      })
      .expect(503)
      .then((response) => {
        response.body.should.deepEqual({
          code: 'service_unavailable',
          message: 'El servicio no está disponible en este momento',
        });
        return ObjectiveActivity.findByPk(1);
      })
      .then((activity) => {
        activity!.newValue.should.equal('New Comment');
      });
  });

  // TS-3: timeout del bus -> 504.
  it('TS-3: timeout del bus responde 504', () => {
    fakeBus.failWithTimeout();
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'Edited'
      })
      .expect(504)
      .then((response) => {
        response.body.should.deepEqual({
          code: 'gateway_timeout',
          message: 'La operación tardó demasiado',
        });
      });
  });

  // TS-4: comment ausente -> 400 invalid_fields, sin publicar.
  it('TS-4: comment ausente responde 400 invalid_fields sin publicar', () => {
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({})
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        response.body.message.should.startWith('Invalid field - ');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-5: rol no habilitado -> 403 access_denied, sin publicar.
  it('TS-5: external-user responde 403 access_denied sin publicar', () => {
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .send({
        comment: 'x'
      })
      .expect(403)
      .then((response) => {
        response.body.should.deepEqual({
          code: 'access_denied',
          message: 'Access denied',
        });
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-10: fileIds presente viaja en el payload del comando, y core vincula los archivos reales.
  it('TS-10: fileIds presente viaja en el payload del comando', () => {
    let fileA: File;
    let fileB: File;
    return Promise.all([createFile(), createFile()])
      .then(([a, b]) => {
        fileA = a;
        fileB = b;
        return request(application)
          .patch('/api/objectives/1/comment/1')
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer token_01_user')
          .send({
            comment: 'Con adjuntos',
            fileIds: [fileA.id, fileB.id],
          })
          .expect(200);
      })
      .then(() => {
        fakeBus.last!.payload.fileIds.should.deepEqual([fileA.id, fileB.id]);
      });
  });

  // TS-12: fileIds: [] explícito SÍ viaja (desvincula) — chequeo de presencia, no de longitud.
  it('TS-12: fileIds vacío explícito viaja en el payload', () => {
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'Sin adjuntos',
        fileIds: [],
      })
      .expect(200)
      .then(() => {
        fakeBus.last!.payload.should.have.property('fileIds');
        fakeBus.last!.payload.fileIds.should.deepEqual([]);
      });
  });

  // TS-13: fileIds ausente NO viaja en el payload.
  it('TS-13: fileIds ausente no viaja en el payload', () => {
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'Solo texto',
      })
      .expect(200)
      .then(() => {
        fakeBus.last!.payload.should.not.have.property('fileIds');
      });
  });

  // TS-14: fileIds con 11 elementos se rechaza en el borde, sin round-trip.
  it('TS-14: fileIds con 11 elementos se rechaza sin publicar', () => {
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'x',
        fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-16: visibilityLevel se rechaza en el borde (no forma parte del contrato).
  it('TS-16: visibilityLevel se rechaza sin publicar', () => {
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'x',
        visibilityLevel: 'public',
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-18: el admin edita un comentario ajeno y ahora se acepta; la autoría original no se toca.
  it('TS-18: el admin edita un comentario ajeno y se acepta', () => {
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        comment: 'Editado por admin'
      })
      .expect(200)
      .then((response) => {
        response.body.code.should.equal('comment_updated');
        return ObjectiveActivity.findByPk(1);
      })
      .then((activity) => {
        activity!.newValue.should.equal('Editado por admin');
        activity!.editedBy!.should.equal('zitadel-sub-03');
        activity!.changedBy.should.equal('zitadel-sub-01');
      });
  });

  // TS-28: un no-autor sin rol admin recibe 403 comment_not_owned, propagado de core.
  it('TS-28: un no-autor recibe 403 comment_not_owned y el comentario queda intacto', () => {
    return request(application)
      .patch('/api/objectives/1/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_02_user')
      .send({
        comment: 'Ajeno'
      })
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('comment_not_owned');
        return ObjectiveActivity.findByPk(1);
      })
      .then((activity) => {
        activity!.newValue.should.equal('New Comment');
      });
  });

  // TS-30: editar una actividad que no es comentario devuelve 400 activity_not_editable.
  it('TS-30: editar una actividad que no es comentario responde 400 activity_not_editable', () => {
    return request(application)
      .patch('/api/objectives/1/comment/2')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'x'
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('activity_not_editable');
      });
  });

  // TS-32: comentario inexistente devuelve 400 comment_not_found, no 500.
  it('TS-32: comentario inexistente responde 400 comment_not_found', () => {
    return request(application)
      .patch('/api/objectives/1/comment/999')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'x'
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('comment_not_found');
      });
  });

  it('responde 400 objective_not_found cuando la tarea del path no existe', () => {
    return request(application)
      .patch('/api/objectives/999/comment/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        comment: 'Edited comment'
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.be.equal('objective_not_found');
        fakeBus.sent.length.should.equal(0);
      });
  });
});
