import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Objective, Person, Project, Requirement, User, WorkedTime } from '@jiku/models';

describe('GET /api/requirements/:reqid/worked-hours', () => {
  let application: Application;

  before(() => {
    application = start();

    return Promise.all([
      User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' }),
      User.create({ id: 'zitadel-sub-04', name: 'External User 01', username: 'external01', email: 'external01@mail.com' }),
    ])
      .then(() => Promise.all([
        Project.create({ id: 1, name: 'Project1', code: 'P1', type: 'comercial', status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-01' }),
        Person.create({ id: 1, firstName: 'Juan', lastName: 'Perez', enabled: true, mustChargeWorkedTime: true, initDate: new Date('2024-01-01'), userId: 'zitadel-sub-01' }),
      ]))
      .then(() => Promise.all([
        // req 1: directas (120) + objectives con worked_times (60 + 90) = 270 (TS-11)
        Requirement.create({ id: 1, title: 'Req con horas', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 2: sin objectives vinculados ni directas → 0
        Requirement.create({ id: 2, title: 'Req sin objectives', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'analisis', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 3: con objectives pero sin worked_times → 0
        Requirement.create({ id: 3, title: 'Req objectives sin horas', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'analisis', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 5: solo horas directas (50) → 50 (TS-12)
        Requirement.create({ id: 5, title: 'Req solo directas', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 6: solo horas de objetivos (150) → 150 (TS-13)
        Requirement.create({ id: 6, title: 'Req solo objetivos', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 7: sin ninguna fuente → 0 (TS-14)
        Requirement.create({ id: 7, title: 'Req sin fuentes', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
      ]))
      .then(() => Promise.all([
        Objective.create({ id: 1, title: 'Obj 1', description: 'Desc', projectId: 1, requirementId: 1, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 1 }),
        Objective.create({ id: 2, title: 'Obj 2', description: 'Desc', projectId: 1, requirementId: 1, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 2 }),
        Objective.create({ id: 3, title: 'Obj sin horas', description: 'Desc', projectId: 1, requirementId: 3, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 1 }),
        Objective.create({ id: 6, title: 'Obj req 6', description: 'Desc', projectId: 1, requirementId: 6, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 1 }),
      ]))
      .then(() => Promise.all([
        // req 1: objetivos (60 + 90 = 150) + directa (120) = 270
        WorkedTime.create({ id: 1, date: '2026-06-01', minutes: 60, projectId: 1, personId: 1, objectiveId: 1 }),
        WorkedTime.create({ id: 2, date: '2026-06-02', minutes: 90, projectId: 1, personId: 1, objectiveId: 2 }),
        WorkedTime.create({ id: 3, date: '2026-06-03', minutes: 120, projectId: 1, personId: 1, requirementId: 1 }),
        // req 5: solo directas (50)
        WorkedTime.create({ id: 4, date: '2026-06-04', minutes: 50, projectId: 1, personId: 1, requirementId: 5 }),
        // req 6: solo objetivos (150)
        WorkedTime.create({ id: 5, date: '2026-06-05', minutes: 150, projectId: 1, personId: 1, objectiveId: 6 }),
      ]));
  });

  after(() => {
    return WorkedTime.destroy({ where: {} })
      .then(() => Objective.destroy({ where: {} }))
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Person.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-19: sin token retorna 401
  it('TS-19: should return 401 if no token is provided', () => {
    return request(application)
      .get('/api/requirements/1/worked-hours')
      .expect(401);
  });

  // TS-18: usuario externo recibe 403
  it('TS-18: should return 403 for external-user', () => {
    return request(application)
      .get('/api/requirements/1/worked-hours')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-15: requisito inexistente retorna 404
  it('TS-15: should return 404 when requirement does not exist', () => {
    return request(application)
      .get('/api/requirements/9999/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('requirement_not_found');
      });
  });

  // TS-11: total = horas directas + horas de objetivos vinculados (120 + 60 + 90 = 270)
  it('TS-11: should return totalMinutes as sum of direct and objective hours', () => {
    return request(application)
      .get('/api/requirements/1/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.requirementId.should.equal(1);
        response.body.totalMinutes.should.equal(270);
      });
  });

  // TS-12: total solo con horas directas (sin objetivos) → 50
  it('TS-12: should return totalMinutes from direct hours only', () => {
    return request(application)
      .get('/api/requirements/5/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.requirementId.should.equal(5);
        response.body.totalMinutes.should.equal(50);
      });
  });

  // TS-13: total solo con horas de objetivos (sin directas) → 150
  it('TS-13: should return totalMinutes from objective hours only', () => {
    return request(application)
      .get('/api/requirements/6/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.requirementId.should.equal(6);
        response.body.totalMinutes.should.equal(150);
      });
  });

  // TS-14: total cero (sin ninguna fuente)
  it('TS-14: should return totalMinutes: 0 when there is no source', () => {
    return request(application)
      .get('/api/requirements/7/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.requirementId.should.equal(7);
        response.body.totalMinutes.should.equal(0);
      });
  });
});
