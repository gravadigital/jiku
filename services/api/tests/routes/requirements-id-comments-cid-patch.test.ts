import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, File, Project, Requirement, RequirementActivity, User } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

// `fileIds` son ids de `files` ya subidos (REQ-001, S-003). Mismo patrón que
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

describe('PATCH /api/requirements/:reqid/comments/:cid', () => {
  let application: Application;

  before(() => {
    application = start();

    return Promise.all([
      User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' }),
      User.create({ id: 'zitadel-sub-02', name: 'User 02', username: 'user02', email: 'user02@mail.com' }),
      User.create({ id: 'zitadel-sub-03', name: 'User 03', username: 'user03', email: 'user03@mail.com' }),
    ])
      .then(() => Project.create({
        id: 1,
        code: 'code1',
        name: 'Project1',
        type: 'comercial',
        description: 'Project test 1',
        status: 'activo',
        priority: 1,
        originId: 1,
        initDate: new Date(),
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: 1,
        title: 'Requirement test 1',
        description: 'requirement description 1',
        type: 'funcionalidad',
        priority: 'alta',
        state: 'analisis',
        estimatedFinishDate: '2026-06-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }));
  });

  after(() => {
    return Attachment.destroy({ where: {}, force: true })
      .then(() => File.destroy({ where: {}, force: true }))
      .then(() => RequirementActivity.destroy({ where: {} }))
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // El bus de tests ejecuta los comandos contra core con la misma base, así que las
  // actividades tienen que existir de verdad. Se recrean antes de cada test.
  beforeEach(() => {
    fakeBus.reset();
    return Attachment.destroy({ where: {}, force: true })
      .then(() => File.destroy({ where: {}, force: true }))
      .then(() => RequirementActivity.destroy({ where: {} }))
      .then(() => {
        return Promise.all([
          RequirementActivity.create({
            id: 1,
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'comment',
            previousValue: '',
            newValue: 'New Comment',
            visibilityLevel: 'internal',
            requirementId: 1,
          }),
          RequirementActivity.create({
            id: 2,
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'priority',
            previousValue: 'media',
            newValue: 'alta',
            visibilityLevel: 'internal',
            requirementId: 1,
          }),
        ]);
      });
  });

  // TS-6: el autor edita su comentario de requisito por la ruta nueva.
  it('TS-6: publica requirements.{id}.comment.{cid}.edit y core escribe la edición', () => {
    return request(application)
      .patch('/api/requirements/1/comments/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({ comment: 'Comentario editado' })
      .expect(200)
      .then((response) => {
        response.body.code.should.equal('comment_updated');
        response.body.message.should.equal('Comment Updated');

        fakeBus.last!.command.should.equal('requirements.1.comment.1.edit');

        return RequirementActivity.findByPk(1);
      })
      .then((activity) => {
        activity!.newValue.should.equal('Comentario editado');
        (activity!.editedAt !== null).should.be.true();
        activity!.editedBy!.should.equal('zitadel-sub-01');
      });
  });

  // TS-7: requisito inexistente en la ruta nueva -> 404, sin publicar.
  it('TS-7: requisito inexistente responde 404 sin publicar', () => {
    return request(application)
      .patch('/api/requirements/999/comments/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({ comment: 'x' })
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('requirement_not_found');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-8: rol no habilitado en la ruta nueva.
  it('TS-8: external-user responde 403 access_denied sin publicar', () => {
    return request(application)
      .patch('/api/requirements/1/comments/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ comment: 'x' })
      .expect(403)
      .then((response) => {
        response.body.should.deepEqual({
          code: 'access_denied',
          message: 'Access denied',
        });
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-9: bus caído en la ruta nueva.
  it('TS-9: bus caído responde 503', () => {
    fakeBus.failWithNoResponders();
    return request(application)
      .patch('/api/requirements/1/comments/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({ comment: 'x' })
      .expect(503)
      .then((response) => {
        response.body.code.should.equal('service_unavailable');
      });
  });

  // TS-11: fileIds viaja en el payload del comando (requisito).
  it('TS-11: fileIds viaja en el payload del comando', () => {
    let file: File;
    return createFile()
      .then((created) => { file = created; })
      .then(() => request(application)
        .patch('/api/requirements/1/comments/1')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'Con adjuntos', fileIds: [file.id] })
        .expect(200))
      .then(() => {
        fakeBus.last!.payload.fileIds.should.deepEqual([file.id]);
      });
  });

  // TS-15: fileIds con elemento no entero positivo se rechaza.
  it('TS-15: fileIds con elemento inválido se rechaza sin publicar', () => {
    return request(application)
      .patch('/api/requirements/1/comments/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({ comment: 'x', fileIds: [0] })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-17: visibilityLevel se rechaza en el borde en la ruta de requisito.
  it('TS-17: visibilityLevel se rechaza sin publicar', () => {
    return request(application)
      .patch('/api/requirements/1/comments/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({ comment: 'x', visibilityLevel: 'public' })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-19: el admin edita un comentario ajeno de un requisito y se acepta.
  it('TS-19: el admin edita un comentario ajeno y se acepta', () => {
    return request(application)
      .patch('/api/requirements/1/comments/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_03_admin')
      .send({ comment: 'Editado por admin' })
      .expect(200)
      .then((response) => {
        response.body.code.should.equal('comment_updated');
        return RequirementActivity.findByPk(1);
      })
      .then((activity) => {
        activity!.editedBy!.should.equal('zitadel-sub-03');
        activity!.changedBy.should.equal('zitadel-sub-01');
      });
  });

  // TS-29: un no-autor sin rol admin recibe 403 comment_not_owned.
  it('TS-29: un no-autor recibe 403 comment_not_owned y el comentario queda intacto', () => {
    return request(application)
      .patch('/api/requirements/1/comments/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_02_user')
      .send({ comment: 'Ajeno' })
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('comment_not_owned');
        return RequirementActivity.findByPk(1);
      })
      .then((activity) => {
        activity!.newValue.should.equal('New Comment');
      });
  });

  // TS-31: editar una actividad que no es comentario devuelve 400 activity_not_editable.
  it('TS-31: editar una actividad que no es comentario responde 400 activity_not_editable', () => {
    return request(application)
      .patch('/api/requirements/1/comments/2')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({ comment: 'x' })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('activity_not_editable');
      });
  });

  it('comment ausente responde 400 invalid_fields sin publicar', () => {
    return request(application)
      .patch('/api/requirements/1/comments/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({})
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        fakeBus.sent.length.should.equal(0);
      });
  });
});
