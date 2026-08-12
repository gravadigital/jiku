import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Objective, Person, Project, Requirement, User, WorkedTime } from '@jiku/models';

describe('GET /api/worked-times/report/by-project/:projid', () => {
  let application: Application;

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
        id: 'zitadel-sub-03',
        name: 'Admin 01',
        username: 'admin01',
        email: 'admin01@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-04',
        name: 'External User 01',
        username: 'external01',
        email: 'external01@mail.com'
      }),
    ])
      .then(() => {
        return Person.create({
          id: 1,
          firstName: 'Juan',
          lastName: 'Pérez',
          enabled: true,
          mustChargeWorkedTime: true,
          initDate: new Date('2024-01-01'),
          userId: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Promise.all([
          // Proyecto 1 — TS-1 y TS-2 (destinos con objetivo/requisito/solo-proyecto)
          Project.create({
            id: 1, code: 'ALPHA', name: 'Proyecto Alpha', type: 'comercial',
            status: 'activo', priority: 5, initDate: new Date(), createdBy: 'zitadel-sub-01'
          }),
          // Proyecto 2 — TS-1 (otra carga, no debe sumarse) y TS-4 (existente sin horas en período)
          Project.create({
            id: 2, code: 'BETA', name: 'Proyecto Beta', type: 'interno',
            status: 'activo', priority: 3, initDate: new Date(), createdBy: 'zitadel-sub-01'
          }),
          // Proyecto 3 — TS-3 (suma independiente del destino de la carga)
          Project.create({
            id: 3, code: 'GAMMA', name: 'Proyecto Gamma', type: 'interno',
            status: 'activo', priority: 3, initDate: new Date(), createdBy: 'zitadel-sub-01'
          }),
          // Proyecto 4 — TS-9 (rol admin)
          Project.create({
            id: 4, code: 'DELTA', name: 'Proyecto Delta', type: 'interno',
            status: 'activo', priority: 3, initDate: new Date(), createdBy: 'zitadel-sub-01'
          }),
          // Proyecto 5 — TS-4 (existente pero sin worked_times en el período)
          Project.create({
            id: 5, code: 'EPSILON', name: 'Proyecto Epsilon', type: 'interno',
            status: 'activo', priority: 3, initDate: new Date(), createdBy: 'zitadel-sub-01'
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          // Requisito del proyecto 1 (TS-2 destino requisito)
          Requirement.create({
            id: 1, title: 'Requisito X', description: 'Desc', type: 'funcionalidad',
            priority: 'alta', state: 'analisis', estimatedFinishDate: '2026-06-01',
            projectId: 1, tags: null, createdBy: 'zitadel-sub-01'
          }),
          // Requisito del proyecto 3 (TS-3 destino requisito)
          Requirement.create({
            id: 2, title: 'Requisito Y', description: 'Desc', type: 'funcionalidad',
            priority: 'alta', state: 'analisis', estimatedFinishDate: '2026-06-01',
            projectId: 3, tags: null, createdBy: 'zitadel-sub-01'
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          // Objetivo del proyecto 1 (TS-2 destino objetivo)
          Objective.create({
            id: 1, title: 'Objetivo A', state: 'activo', area: 'desarrollo',
            priority: 1, projectId: 1, createdBy: 'zitadel-sub-01', visibilityLevel: 'public'
          }),
          // Objetivo del proyecto 3 (TS-3 destino objetivo)
          Objective.create({
            id: 2, title: 'Objetivo B', state: 'activo', area: 'desarrollo',
            priority: 1, projectId: 3, createdBy: 'zitadel-sub-01', visibilityLevel: 'public'
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          // --- Proyecto 1 (TS-1, TS-2) ---
          // TS-1/TS-2: {date:'2026-01-15', minutes:120} destino objetivo
          WorkedTime.create({ id: 400, date: '2026-01-15', minutes: 120, projectId: 1, personId: 1, objectiveId: 1, requirementId: null }),
          // TS-1/TS-2: {date:'2026-01-17', minutes:50} destino requisito
          WorkedTime.create({ id: 401, date: '2026-01-17', minutes: 50, projectId: 1, personId: 1, objectiveId: null, requirementId: 1 }),
          // TS-2: {date:'2026-01-25', minutes:90} fuera del rango [15,17] y de [15,20]
          WorkedTime.create({ id: 402, date: '2026-01-25', minutes: 90, projectId: 1, personId: 1, objectiveId: null, requirementId: null }),
          // --- Proyecto 2 (TS-1: otra carga que NO debe sumarse al proyecto 1) ---
          WorkedTime.create({ id: 410, date: '2026-01-15', minutes: 90, projectId: 2, personId: 1, objectiveId: null, requirementId: null }),
          // --- Proyecto 3 (TS-3: destinos objetivo + requisito + solo-proyecto = 200) ---
          WorkedTime.create({ id: 420, date: '2026-01-15', minutes: 120, projectId: 3, personId: 1, objectiveId: 2, requirementId: null }),
          WorkedTime.create({ id: 421, date: '2026-01-16', minutes: 50, projectId: 3, personId: 1, objectiveId: null, requirementId: 2 }),
          WorkedTime.create({ id: 422, date: '2026-01-17', minutes: 30, projectId: 3, personId: 1, objectiveId: null, requirementId: null }),
          // --- Proyecto 4 (TS-9: admin, minutes:60 en rango) ---
          WorkedTime.create({ id: 430, date: '2026-01-16', minutes: 60, projectId: 4, personId: 1, objectiveId: null, requirementId: null }),
        ]);
      });
  });

  after(() => {
    return WorkedTime.destroy({where: {}})
      .then(() => Objective.destroy({where: {}}))
      .then(() => Requirement.destroy({where: {}}))
      .then(() => Person.destroy({where: {}}))
      .then(() => Project.destroy({where: {}}))
      .then(() => User.destroy({where: {}}));
  });

  // TS-1: Total de horas de un proyecto en el período (happy path)
  it('should return the total minutes of a project in the period (only that project)', () => {
    return request(application)
      .get('/api/worked-times/report/by-project/1')
      .query({dateFrom: '2026-01-15', dateTo: '2026-01-20'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        // Proyecto 1 en [2026-01-15, 2026-01-20]: 120 (15) + 50 (17) = 170
        // (excluye el proyecto 2 y el registro del 2026-01-25)
        response.body.projectId.should.equal(1);
        response.body.dateFrom.should.equal('2026-01-15');
        response.body.dateTo.should.equal('2026-01-20');
        response.body.totalMinutes.should.equal(170);
      });
  });

  // TS-2: Rango inclusivo en ambos extremos (excluye el 2026-01-20)
  it('should include both range boundaries and exclude out-of-range records', () => {
    return request(application)
      .get('/api/worked-times/report/by-project/1')
      .query({dateFrom: '2026-01-15', dateTo: '2026-01-17'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        // 120 (15) + 50 (17) = 170; incluye ambos extremos y excluye el 2026-01-25 (90)
        response.body.projectId.should.equal(1);
        response.body.dateFrom.should.equal('2026-01-15');
        response.body.dateTo.should.equal('2026-01-17');
        response.body.totalMinutes.should.equal(170);
      });
  });

  // TS-3: Suma independiente del destino de la carga (objetivo + requisito + solo-proyecto)
  it('should sum hours regardless of their charge destination', () => {
    return request(application)
      .get('/api/worked-times/report/by-project/3')
      .query({dateFrom: '2026-01-15', dateTo: '2026-01-20'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        // objetivo (120) + requisito (50) + solo-proyecto (30) = 200
        response.body.projectId.should.equal(3);
        response.body.totalMinutes.should.equal(200);
      });
  });

  // TS-4: Proyecto existente sin horas devuelve cero
  it('should return zero for an existing project with no hours in the period', () => {
    return request(application)
      .get('/api/worked-times/report/by-project/5')
      .query({dateFrom: '2026-01-15', dateTo: '2026-01-20'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        // Proyecto 5 existe pero no tiene worked_times en el período
        response.body.projectId.should.equal(5);
        response.body.dateFrom.should.equal('2026-01-15');
        response.body.dateTo.should.equal('2026-01-20');
        response.body.totalMinutes.should.equal(0);
      });
  });

  // TS-5: Proyecto inexistente
  it('should return 404 for a non-existent project', () => {
    return request(application)
      .get('/api/worked-times/report/by-project/99999')
      .query({dateFrom: '2026-01-15', dateTo: '2026-01-20'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('project_not_found');
      });
  });

  // TS-6a: Falta dateFrom
  it('should return 400 when dateFrom is missing', () => {
    return request(application)
      .get('/api/worked-times/report/by-project/1')
      .query({dateTo: '2026-01-20'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-6b: Formato de fecha inválido
  it('should return 400 when a date format is invalid', () => {
    return request(application)
      .get('/api/worked-times/report/by-project/1')
      .query({dateFrom: '15-01-2026', dateTo: '2026-01-20'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-6c: dateFrom posterior a dateTo
  it('should return 400 when dateFrom is after dateTo', () => {
    return request(application)
      .get('/api/worked-times/report/by-project/1')
      .query({dateFrom: '2026-01-25', dateTo: '2026-01-20'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-7: Acceso denegado a usuario externo
  it('should return 403 for external-user role', () => {
    return request(application)
      .get('/api/worked-times/report/by-project/1')
      .query({dateFrom: '2026-01-15', dateTo: '2026-01-20'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-8: Token ausente/inválido
  it('should return 401 without token', () => {
    return request(application)
      .get('/api/worked-times/report/by-project/1')
      .query({dateFrom: '2026-01-15', dateTo: '2026-01-20'})
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  // TS-9: Rol admin también puede consultar
  it('should allow admin role to query the endpoint', () => {
    return request(application)
      .get('/api/worked-times/report/by-project/4')
      .query({dateFrom: '2026-01-15', dateTo: '2026-01-20'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_03_admin')
      .expect(200)
      .then((response) => {
        // Proyecto 4 con 60 min en rango
        response.body.projectId.should.equal(4);
        response.body.totalMinutes.should.equal(60);
      });
  });
});
