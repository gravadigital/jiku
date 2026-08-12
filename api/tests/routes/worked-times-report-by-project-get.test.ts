import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Objective, Person, Project, Requirement, User, WorkedTime } from '@jiku/models';

describe('GET /api/worked-times/report/by-project', () => {
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
        id: 'zitadel-sub-04',
        name: 'External User 01',
        username: 'external01',
        email: 'external01@mail.com'
      }),
    ])
      .then(() => {
        return Promise.all([
          Person.create({
            id: 1,
            firstName: 'Juan',
            lastName: 'Pérez',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-01'
          }),
          Person.create({
            id: 2,
            firstName: 'María',
            lastName: 'García',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01')
          }),
          Project.create({
            id: 1,
            code: 'ALPHA',
            name: 'Proyecto Alpha',
            type: 'comercial',
            status: 'activo',
            priority: 5,
            initDate: new Date(),
            createdBy: 'zitadel-sub-01'
          }),
          Project.create({
            id: 2,
            code: 'BETA',
            name: 'Proyecto Beta',
            type: 'interno',
            status: 'activo',
            priority: 3,
            initDate: new Date(),
            createdBy: 'zitadel-sub-01'
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          
          Requirement.create({
            id: 1,
            title: 'Requisito X',
            description: 'Desc',
            type: 'funcionalidad',
            priority: 'alta',
            state: 'analisis',
            estimatedFinishDate: '2026-06-01',
            projectId: 1,
            tags: null,
            createdBy: 'zitadel-sub-01'
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          Objective.create({
            id: 1,
            title: 'Objetivo A',
            state: 'activo',
            area: 'desarrollo',
            priority: 1,
            projectId: 1,
            createdBy: 'zitadel-sub-01',
            visibilityLevel: 'public',
            requirementId: 1
          }),
          Objective.create({
            id: 2,
            title: 'Objetivo B',
            state: 'activo',
            area: 'desarrollo',
            priority: 2,
            projectId: 1,
            createdBy: 'zitadel-sub-01',
            visibilityLevel: 'public'
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          // Juan - Project Alpha - Objetivo A: 120 min
          WorkedTime.create({ id: 300, date: '2026-01-15', minutes: 120, projectId: 1, personId: 1, objectiveId: 1 }),
          // Juan - Project Alpha - Objetivo B: 60 min
          WorkedTime.create({ id: 301, date: '2026-01-15', minutes: 60, projectId: 1, personId: 1, objectiveId: 2 }),
          // Juan - Project Alpha - Sin objetivo: 30 min
          WorkedTime.create({ id: 302, date: '2026-01-15', minutes: 30, projectId: 1, personId: 1, objectiveId: null }),
          // Juan - Project Beta - Sin objetivo: 90 min
          WorkedTime.create({ id: 303, date: '2026-01-20', minutes: 90, projectId: 2, personId: 1, objectiveId: null }),
          // Juan - Project Alpha - Requisito X (directo): 50 min
          WorkedTime.create({ id: 306, date: '2026-01-17', minutes: 50, projectId: 1, personId: 1, objectiveId: null, requirementId: 1 }),
          // María - Project Alpha - Objetivo A: 180 min
          WorkedTime.create({ id: 304, date: '2026-01-15', minutes: 180, projectId: 1, personId: 2, objectiveId: 1 }),
          // María - Project Alpha - Sin objetivo: 45 min
          WorkedTime.create({ id: 305, date: '2026-01-16', minutes: 45, projectId: 1, personId: 2, objectiveId: null }),
        ]);
      });
  });

  after(() => {
    return WorkedTime.destroy({where: {}})
      .then(() => Requirement.destroy({where: {}}))
      .then(() => Objective.destroy({where: {}}))
      .then(() => Person.destroy({where: {}}))
      .then(() => Project.destroy({where: {}}))
      .then(() => User.destroy({where: {}}));
  });

  // TS-2: Happy path with data
  it('should return report grouped by project with objectives and persons', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.length.should.be.greaterThan(0);

        const alpha = response.body.find((p: any) => p.projectId === 1);
        alpha.should.be.ok();
        alpha.projectName.should.equal('Proyecto Alpha');
        alpha.projectCode.should.equal('ALPHA');
        alpha.should.have.property('objectives');
        alpha.objectives.should.be.Array();
        alpha.should.have.property('persons');
        alpha.persons.should.be.Array();
      });
  });

  // TS-4: No-objective hours appear in persons[] (not in objectives[])
  it('should have no-objective persons in persons[] and exclude null from objectives[]', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const alpha = response.body.find((p: any) => p.projectId === 1);

        // objectives should NOT have a pure project-only entry (sin objetivo ni requisito)
        const projectOnly = alpha.objectives.find((o: any) => o.objectiveId === null && o.requirementId === null);
        (projectOnly === undefined).should.be.true();

        // objectives should have named objectives + the requirement entry
        alpha.objectives.length.should.equal(3); // Objetivo A, Objetivo B, Requisito X

        // persons at project level should have the pure project-only persons
        alpha.persons.should.be.Array();
        alpha.persons.length.should.equal(2); // Juan (30) and María (45)
        const juan = alpha.persons.find((p: any) => p.personId === 1);
        juan.totalMinutes.should.equal(30);
        const maria = alpha.persons.find((p: any) => p.personId === 2);
        maria.totalMinutes.should.equal(45);
      });
  });

  // TS-S055: requirement appears as its own entry in objectives[]
  it('should include requirement-charged hours as a distinct objectives[] entry', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const alpha = response.body.find((p: any) => p.projectId === 1);
        const reqEntry = alpha.objectives.find((o: any) => o.requirementId === 1 && o.objectiveId === null);
        reqEntry.should.be.ok();
        (reqEntry.objectiveId === null).should.be.true();
        reqEntry.requirementTitle.should.equal('Requisito X');
        reqEntry.totalMinutes.should.equal(50);
        const juan = reqEntry.persons.find((p: any) => p.personId === 1);
        juan.totalMinutes.should.equal(50);
      });
  });

  // TS-2 (objectiveRequirementId): Task entry exposes its own requirement
  it('should include objectiveRequirementId and objectiveRequirementTitle for a task linked to a requirement', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const alpha = response.body.find((p: any) => p.projectId === 1);
        const objA = alpha.objectives.find((o: any) => o.objectiveId === 1);
        objA.should.be.ok();
        objA.objectiveRequirementId.should.equal(1);
        objA.objectiveRequirementTitle.should.equal('Requisito X');
      });
  });

  // Regression: objectiveRequirementTitle must be present even without any direct-requirement entry in range
  it('should include objectiveRequirementTitle for a task even without any direct-requirement entry in range', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2026-01-15', dateTo: '2026-01-15'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        // Jan 15 only has Objetivo A hours (id 300); the direct-requirement entry (id 306) is on Jan 17, out of range
        const alpha = response.body.find((p: any) => p.projectId === 1);
        const objA = alpha.objectives.find((o: any) => o.objectiveId === 1);
        objA.should.be.ok();
        objA.objectiveRequirementId.should.equal(1);
        objA.objectiveRequirementTitle.should.equal('Requisito X');
        const directReq = alpha.objectives.find((o: any) => o.objectiveId === null && o.requirementId === 1);
        (directReq === undefined).should.be.true();
      });
  });

  // TS-4 (objectiveRequirementId): Task entry without its own requirement -> null
  it('should return objectiveRequirementId null for a task without a requirement', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const alpha = response.body.find((p: any) => p.projectId === 1);
        const objB = alpha.objectives.find((o: any) => o.objectiveId === 2);
        objB.should.be.ok();
        (objB.objectiveRequirementId === null).should.be.true();
        (objB.objectiveRequirementTitle === null).should.be.true();
      });
  });

  // TS-6 (objectiveRequirementId): Direct requirement hours entry does not expose it
  it('should not expose an objectiveRequirementId value for direct requirement hours', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const alpha = response.body.find((p: any) => p.projectId === 1);
        const reqEntry = alpha.objectives.find((o: any) => o.requirementId === 1 && o.objectiveId === null);
        reqEntry.should.be.ok();
        (reqEntry.objectiveRequirementId === null || reqEntry.objectiveRequirementId === undefined).should.be.true();
        (reqEntry.objectiveRequirementTitle === null || reqEntry.objectiveRequirementTitle === undefined).should.be.true();
      });
  });

  // TS-6: Empty range
  it('should return empty array for range with no data', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2099-01-01', dateTo: '2099-12-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(0);
      });
  });

  // TS-9: Missing dateFrom
  it('should return 400 when dateFrom is missing', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-10: Missing dateTo
  it('should return 400 when dateTo is missing', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2026-01-01'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-12: dateFrom > dateTo
  it('should return 400 when dateFrom is after dateTo', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2026-02-01', dateTo: '2026-01-01'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-14: No token
  it('should return 401 without token', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  // TS-16: external-user role
  it('should return 403 for external-user role', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-20: Correct totals at each hierarchy level
  it('should calculate correct totalMinutes at each level', () => {
    return request(application)
      .get('/api/worked-times/report/by-project')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        // Project Alpha: 120+60+30+180+45+50 = 485
        const alpha = response.body.find((p: any) => p.projectId === 1);
        alpha.totalMinutes.should.equal(485);

        // Objetivo A: Juan(120) + María(180) = 300 (single entry, no duplication from the new group column)
        const objAEntries = alpha.objectives.filter((o: any) => o.objectiveId === 1);
        objAEntries.length.should.equal(1);
        const objA = objAEntries[0];
        objA.totalMinutes.should.equal(300);
        objA.objectiveRequirementId.should.equal(1);
        objA.objectiveRequirementTitle.should.equal('Requisito X');
        objA.persons.should.be.Array();
        const objAJuan = objA.persons.find((p: any) => p.personId === 1);
        objAJuan.totalMinutes.should.equal(120);
        const objAMaria = objA.persons.find((p: any) => p.personId === 2);
        objAMaria.totalMinutes.should.equal(180);

        // Objetivo B: Juan(60)
        const objB = alpha.objectives.find((o: any) => o.objectiveId === 2);
        objB.totalMinutes.should.equal(60);
        objB.persons.length.should.equal(1);

        // Requisito X: Juan(50) — fila propia con requirementId, objectiveId null
        const reqX = alpha.objectives.find((o: any) => o.requirementId === 1);
        reqX.totalMinutes.should.equal(50);

        // No pure project-only entry in objectives[] (sin objetivo ni requisito)
        const projectOnly = alpha.objectives.find((o: any) => o.objectiveId === null && o.requirementId === null);
        (projectOnly === undefined).should.be.true();
        alpha.objectives.length.should.equal(3); // Obj A, Obj B, Requisito X

        // persons (no-objective): Juan 30, María 45
        const alphaPersonJuan = alpha.persons.find((p: any) => p.personId === 1);
        alphaPersonJuan.totalMinutes.should.equal(30);
        const alphaPersonMaria = alpha.persons.find((p: any) => p.personId === 2);
        alphaPersonMaria.totalMinutes.should.equal(45);

        // Project Beta: 90 (only no-objective hours)
        const beta = response.body.find((p: any) => p.projectId === 2);
        beta.totalMinutes.should.equal(90);
        beta.objectives.length.should.equal(0); // No named objectives
        beta.persons.length.should.equal(1); // Only Juan
        beta.persons[0].totalMinutes.should.equal(90);
      });
  });
});
