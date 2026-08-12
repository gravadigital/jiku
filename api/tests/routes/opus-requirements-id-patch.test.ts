import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Project, Requirement, RequirementActivity, User } from '@jiku/models';

describe('PATCH /api/opus/requirements/:reqid', () => {
  let application: Application;

  before(() => {
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' })
      .then(() => Project.create({ id: 1, name: 'Project1', code: 'P1', type: 'comercial', status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-01' }))
      .then(() => Requirement.create({
        id: 1,
        title: 'Req analisis',
        description: 'Desc',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'analisis',
        estimatedFinishDate: '2026-07-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }));
  });

  after(() => {
    return RequirementActivity.destroy({ where: {} })
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-4: valor viejo "finalizado" rechazado por schema Joi en opus
  it('TS-4: should return 400 if state is old value "finalizado" in opus endpoint', () => {
    return request(application)
      .patch('/api/opus/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'finalizado' })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-5: priority se acepta como string del enum (regresión: el schema Joi exigía number)
  it('TS-5: should update priority as a valid string', () => {
    return request(application)
      .patch('/api/opus/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({ priority: 'urgente' })
      .expect(200)
      .then((response) => {
        response.body.priority.should.equal('urgente');
      });
  });

  // TS-6: priority numerico (formato viejo) es rechazado por el schema Joi
  it('TS-6: should return 400 if priority is sent as a number (old schema)', () => {
    return request(application)
      .patch('/api/opus/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({ priority: 4 })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });
});
