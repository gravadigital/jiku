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
        // Personas de los escenarios nuevos (TS-20 a TS-28). userId: null salvo donde el
        // escenario no lo requiera explícitamente distinto (TS-25 es la única razón de ser
        // del null, pero el resto también lo deja null porque el desglose no depende de users).
        Person.create({ id: 10, firstName: 'Ana', lastName: 'García', enabled: true, mustChargeWorkedTime: true, initDate: new Date('2024-01-01'), userId: null }),
        Person.create({ id: 11, firstName: 'Beto', lastName: 'Ruiz', enabled: true, mustChargeWorkedTime: true, initDate: new Date('2024-01-01'), userId: null }),
        Person.create({ id: 12, firstName: 'Ana', lastName: 'García', enabled: true, mustChargeWorkedTime: true, initDate: new Date('2024-01-01'), userId: null }),
        Person.create({ id: 20, firstName: 'Ana', lastName: 'Alfa', enabled: true, mustChargeWorkedTime: true, initDate: new Date('2024-01-01'), userId: null }),
        Person.create({ id: 21, firstName: 'Zoe', lastName: 'Zeta', enabled: true, mustChargeWorkedTime: true, initDate: new Date('2024-01-01'), userId: null }),
        // TS-23: persona deshabilitada, igual aparece en el desglose (CA-4)
        Person.create({ id: 30, firstName: 'Carla', lastName: 'Cruz', enabled: false, mustChargeWorkedTime: true, initDate: new Date('2024-01-01'), userId: null }),
        // TS-24: persona con endDate pasada, igual aparece en el desglose (CA-4)
        Person.create({ id: 31, firstName: 'Diego', lastName: 'Diaz', enabled: true, mustChargeWorkedTime: true, initDate: new Date('2024-01-01'), endDate: new Date('2025-01-31'), userId: null }),
        // TS-25: persona sin Usuario vinculado (userId: null) — la razón de ser del escenario
        Person.create({ id: 40, firstName: 'Elena', lastName: 'Esteves', enabled: true, mustChargeWorkedTime: true, initDate: new Date('2024-01-01'), userId: null }),
        // TS-26: doble imputación de igual monto, misma persona (UNION ALL, no UNION)
        Person.create({ id: 50, firstName: 'Fabio', lastName: 'Fis', enabled: true, mustChargeWorkedTime: true, initDate: new Date('2024-01-01'), userId: null }),
        // TS-27: horas de otro requisito no deben contaminar el desglose
        Person.create({ id: 60, firstName: 'Gina', lastName: 'Gil', enabled: true, mustChargeWorkedTime: true, initDate: new Date('2024-01-01'), userId: null }),
        // TS-28: horas de una tarea de otro requisito no deben contaminar el desglose
        Person.create({ id: 61, firstName: 'Hugo', lastName: 'Haz', enabled: true, mustChargeWorkedTime: true, initDate: new Date('2024-01-01'), userId: null }),
      ]))
      .then(() => Promise.all([
        // req 1: directas (120) + objectives con worked_times (60 + 90) = 270 (TS-11)
        Requirement.create({ id: 1, title: 'Req con horas', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 2: sin objectives vinculados ni directas → 0
        Requirement.create({ id: 2, title: 'Req sin objectives', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'analisis', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 3: con objectives pero sin worked_times → 0 (TS-32)
        Requirement.create({ id: 3, title: 'Req objectives sin horas', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'analisis', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 5: solo horas directas (50) → 50 (TS-12)
        Requirement.create({ id: 5, title: 'Req solo directas', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 6: solo horas de objetivos (150) → 150 (TS-13)
        Requirement.create({ id: 6, title: 'Req solo objetivos', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 7: sin ninguna fuente → 0 (TS-14)
        Requirement.create({ id: 7, title: 'Req sin fuentes', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 10: desglose con dos personas, ordenado de mayor a menor (TS-20, TS-29, TS-30, TS-31)
        Requirement.create({ id: 10, title: 'Req dos personas', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 11: una sola fila por persona sumando las dos fuentes (TS-21)
        Requirement.create({ id: 11, title: 'Req una fila por persona', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 12: desempate por personId ASC (TS-22)
        Requirement.create({ id: 12, title: 'Req desempate', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 13: persona deshabilitada (TS-23)
        Requirement.create({ id: 13, title: 'Req persona deshabilitada', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 14: persona con endDate pasada (TS-24)
        Requirement.create({ id: 14, title: 'Req persona con baja', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 15: persona sin Usuario vinculado (TS-25)
        Requirement.create({ id: 15, title: 'Req persona sin usuario', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 16: sin doble conteo, UNION ALL (TS-26)
        Requirement.create({ id: 16, title: 'Req sin doble conteo', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 17 y 18: aislamiento entre requisitos, horas directas (TS-27)
        Requirement.create({ id: 17, title: 'Req aislamiento directas', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        Requirement.create({ id: 18, title: 'Otro req con horas directas', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        // req 19 y 20: aislamiento entre requisitos, horas de tarea (TS-28)
        Requirement.create({ id: 19, title: 'Req aislamiento tareas', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        Requirement.create({ id: 20, title: 'Otro req con horas de tarea', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
      ]))
      .then(() => Promise.all([
        Objective.create({ id: 1, title: 'Obj 1', description: 'Desc', projectId: 1, requirementId: 1, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 1 }),
        Objective.create({ id: 2, title: 'Obj 2', description: 'Desc', projectId: 1, requirementId: 1, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 2 }),
        Objective.create({ id: 3, title: 'Obj sin horas', description: 'Desc', projectId: 1, requirementId: 3, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 1 }),
        Objective.create({ id: 6, title: 'Obj req 6', description: 'Desc', projectId: 1, requirementId: 6, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 1 }),
        // req 10: Beto imputa vía tarea (TS-20)
        Objective.create({ id: 10, title: 'Obj req 10', description: 'Desc', projectId: 1, requirementId: 10, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 1 }),
        // req 11: Ana imputa vía tarea, además de directa (TS-21)
        Objective.create({ id: 11, title: 'Obj req 11', description: 'Desc', projectId: 1, requirementId: 11, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 1 }),
        // req 16: Fabio imputa vía tarea, además de directa, mismo monto (TS-26)
        Objective.create({ id: 16, title: 'Obj req 16', description: 'Desc', projectId: 1, requirementId: 16, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 1 }),
        // req 19 y 20: tareas de dos requisitos distintos (TS-28)
        Objective.create({ id: 19, title: 'Obj req 19', description: 'Desc', projectId: 1, requirementId: 19, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 1 }),
        Objective.create({ id: 20, title: 'Obj req 20', description: 'Desc', projectId: 1, requirementId: 20, createdBy: 'zitadel-sub-01', state: 'activo', area: 'desarrollo', priority: 1 }),
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
        // TS-20: req 10 — Ana 180 directas, Beto 120 vía tarea → orden [Ana(180), Beto(120)]
        WorkedTime.create({ id: 10, date: '2026-06-06', minutes: 180, projectId: 1, personId: 10, requirementId: 10 }),
        WorkedTime.create({ id: 11, date: '2026-06-06', minutes: 120, projectId: 1, personId: 11, objectiveId: 10 }),
        // TS-21: req 11 — Ana(12) 60 directas + 90 vía tarea = 150, una sola fila
        WorkedTime.create({ id: 12, date: '2026-06-07', minutes: 60, projectId: 1, personId: 12, requirementId: 11 }),
        WorkedTime.create({ id: 13, date: '2026-06-07', minutes: 90, projectId: 1, personId: 12, objectiveId: 11 }),
        // TS-22: req 12 — Zoe(21) y Ana(20) con 100 minutos cada uno, directas → desempate por personId
        WorkedTime.create({ id: 14, date: '2026-06-08', minutes: 100, projectId: 1, personId: 21, requirementId: 12 }),
        WorkedTime.create({ id: 15, date: '2026-06-08', minutes: 100, projectId: 1, personId: 20, requirementId: 12 }),
        // TS-23: req 13 — Carla (deshabilitada) con 45 minutos directos
        WorkedTime.create({ id: 16, date: '2026-06-09', minutes: 45, projectId: 1, personId: 30, requirementId: 13 }),
        // TS-24: req 14 — Diego (con baja) con 30 minutos directos
        WorkedTime.create({ id: 17, date: '2026-06-10', minutes: 30, projectId: 1, personId: 31, requirementId: 14 }),
        // TS-25: req 15 — Elena (sin Usuario) con 75 minutos directos
        WorkedTime.create({ id: 18, date: '2026-06-11', minutes: 75, projectId: 1, personId: 40, requirementId: 15 }),
        // TS-26: req 16 — Fabio con 60 directos + 60 vía tarea, mismo monto → total 120, no 60
        WorkedTime.create({ id: 19, date: '2026-06-12', minutes: 60, projectId: 1, personId: 50, requirementId: 16 }),
        WorkedTime.create({ id: 20, date: '2026-06-12', minutes: 60, projectId: 1, personId: 50, objectiveId: 16 }),
        // TS-27: req 17 (80) y req 18 (999) — el 18 no debe contaminar el desglose del 17
        WorkedTime.create({ id: 21, date: '2026-06-13', minutes: 80, projectId: 1, personId: 60, requirementId: 17 }),
        WorkedTime.create({ id: 22, date: '2026-06-13', minutes: 999, projectId: 1, personId: 60, requirementId: 18 }),
        // TS-28: req 19 (40, vía tarea) y req 20 (777, vía otra tarea) — el 20 no contamina al 19
        WorkedTime.create({ id: 23, date: '2026-06-14', minutes: 40, projectId: 1, personId: 61, objectiveId: 19 }),
        WorkedTime.create({ id: 24, date: '2026-06-14', minutes: 777, projectId: 1, personId: 61, objectiveId: 20 }),
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
        response.body.byPerson.length.should.equal(1);
        response.body.byPerson[0].should.eql({ personId: 1, firstName: 'Juan', lastName: 'Perez', minutes: 270 });
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
        response.body.byPerson.should.eql([{ personId: 1, firstName: 'Juan', lastName: 'Perez', minutes: 50 }]);
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
        response.body.byPerson.should.eql([{ personId: 1, firstName: 'Juan', lastName: 'Perez', minutes: 150 }]);
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
        response.body.byPerson.should.eql([]);
      });
  });

  // TS-32: requisito con tareas pero sin ningún WorkedTime imputado
  it('TS-32: should return totalMinutes: 0 and byPerson: [] when the requirement has objectives but no worked time', () => {
    return request(application)
      .get('/api/requirements/3/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.requirementId.should.equal(3);
        response.body.totalMinutes.should.equal(0);
        response.body.byPerson.should.eql([]);
      });
  });

  // TS-20: desglose con dos personas, ordenado de mayor a menor
  it('TS-20: should return byPerson ordered by minutes DESC with two people', () => {
    return request(application)
      .get('/api/requirements/10/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.totalMinutes.should.equal(300);
        response.body.byPerson.should.eql([
          { personId: 10, firstName: 'Ana', lastName: 'García', minutes: 180 },
          { personId: 11, firstName: 'Beto', lastName: 'Ruiz', minutes: 120 },
        ]);
      });
  });

  // TS-21: una sola fila por persona sumando las dos fuentes
  it('TS-21: should return a single row per person summing both sources', () => {
    return request(application)
      .get('/api/requirements/11/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.byPerson.length.should.equal(1);
        response.body.byPerson[0].should.eql({ personId: 12, firstName: 'Ana', lastName: 'García', minutes: 150 });
        response.body.totalMinutes.should.equal(150);
      });
  });

  // TS-22: a igual cantidad de minutos, desempata el personId menor
  it('TS-22: should tie-break by personId ASC when minutes are equal', () => {
    return request(application)
      .get('/api/requirements/12/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.byPerson.map((p: { personId: number }) => p.personId).should.eql([20, 21]);
      });
  });

  // TS-23: persona deshabilitada (enabled: false) aparece en el desglose
  it('TS-23: should include a disabled person in byPerson', () => {
    return request(application)
      .get('/api/requirements/13/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.byPerson.length.should.equal(1);
        response.body.byPerson[0].should.eql({ personId: 30, firstName: 'Carla', lastName: 'Cruz', minutes: 45 });
        response.body.totalMinutes.should.equal(45);
      });
  });

  // TS-24: persona con endDate pasada aparece en el desglose
  it('TS-24: should include a person with a past endDate in byPerson', () => {
    return request(application)
      .get('/api/requirements/14/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.byPerson.should.eql([{ personId: 31, firstName: 'Diego', lastName: 'Diaz', minutes: 30 }]);
        response.body.totalMinutes.should.equal(30);
      });
  });

  // TS-25: persona sin Usuario vinculado (userId: null) aparece con nombre y apellido
  it('TS-25: should include a person without a linked User in byPerson', () => {
    return request(application)
      .get('/api/requirements/15/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.byPerson.should.eql([{ personId: 40, firstName: 'Elena', lastName: 'Esteves', minutes: 75 }]);
      });
  });

  // TS-26: sin doble conteo — dos imputaciones de igual monto no se deduplican (UNION ALL)
  it('TS-26: should not deduplicate two equal-amount entries from the same person', () => {
    return request(application)
      .get('/api/requirements/16/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.totalMinutes.should.equal(120);
        response.body.byPerson.should.eql([{ personId: 50, firstName: 'Fabio', lastName: 'Fis', minutes: 120 }]);
      });
  });

  // TS-27: horas directas de otro requisito no contaminan el desglose
  it('TS-27: should not leak direct hours from another requirement', () => {
    return request(application)
      .get('/api/requirements/17/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.totalMinutes.should.equal(80);
        response.body.byPerson.should.eql([{ personId: 60, firstName: 'Gina', lastName: 'Gil', minutes: 80 }]);
      });
  });

  // TS-28: horas de una tarea de otro requisito no contaminan el desglose
  it('TS-28: should not leak objective hours from another requirement', () => {
    return request(application)
      .get('/api/requirements/19/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.totalMinutes.should.equal(40);
        response.body.byPerson.should.eql([{ personId: 61, firstName: 'Hugo', lastName: 'Haz', minutes: 40 }]);
      });
  });

  // TS-29: el SUM de PostgreSQL vuelve como bigint (string en `pg`); sin Number() esto falla
  it('TS-29: should return minutes as numbers, not strings', () => {
    return request(application)
      .get('/api/requirements/10/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        (typeof response.body.totalMinutes).should.equal('number');
        (typeof response.body.byPerson[0].minutes).should.equal('number');
      });
  });

  // TS-30: invariante estructural — la suma de byPerson es exactamente totalMinutes
  it('TS-30: should have byPerson minutes sum exactly equal to totalMinutes', () => {
    return request(application)
      .get('/api/requirements/10/worked-hours')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const sum = response.body.byPerson.reduce((acc: number, p: { minutes: number }) => acc + p.minutes, 0);
        sum.should.equal(response.body.totalMinutes);
        sum.should.equal(300);
      });
  });

  // TS-31: rol admin accede igual que user
  it('TS-31: should allow access to admin role the same way as user', () => {
    return request(application)
      .get('/api/requirements/10/worked-hours')
      .set('Authorization', 'Bearer token_03_admin')
      .expect(200)
      .then((response) => {
        response.body.totalMinutes.should.equal(300);
        response.body.byPerson.length.should.equal(2);
      });
  });
});
