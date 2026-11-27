import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Objective, Person, Project, Requirement, User, WorkedTime } from '@jiku/models';

describe('GET /api/worked-times/report/by-person', () => {
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
          WorkedTime.create({ id: 200, date: '2026-01-15', minutes: 120, projectId: 1, personId: 1, objectiveId: 1 }),
          // Juan - Project Alpha - Objetivo B: 60 min
          WorkedTime.create({ id: 201, date: '2026-01-15', minutes: 60, projectId: 1, personId: 1, objectiveId: 2 }),
          // Juan - Project Alpha - Sin objetivo: 30 min
          WorkedTime.create({ id: 202, date: '2026-01-15', minutes: 30, projectId: 1, personId: 1, objectiveId: null }),
          // Juan - Project Beta - Sin objetivo: 90 min
          WorkedTime.create({ id: 203, date: '2026-01-20', minutes: 90, projectId: 2, personId: 1, objectiveId: null }),
          // Juan - Project Alpha - Requisito X (directo): 50 min
          WorkedTime.create({ id: 206, date: '2026-01-17', minutes: 50, projectId: 1, personId: 1, objectiveId: null, requirementId: 1 }),
          // María - Project Alpha - Objetivo A: 180 min
          WorkedTime.create({ id: 204, date: '2026-01-15', minutes: 180, projectId: 1, personId: 2, objectiveId: 1 }),
          // María - Project Alpha - Sin objetivo: 45 min
          WorkedTime.create({ id: 205, date: '2026-01-16', minutes: 45, projectId: 1, personId: 2, objectiveId: null }),
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

  // TS-1: Happy path with data
  it('should return report grouped by person > project > objective', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.length.should.be.greaterThan(0);

        // Find Juan
        const juan = response.body.find((p: any) => p.personId === 1);
        juan.should.be.ok();
        juan.personFirstName.should.equal('Juan');
        juan.personLastName.should.equal('Pérez');
        juan.should.have.property('projects');
        juan.projects.should.be.Array();
      });
  });

  // TS-3: Includes entries without objective
  it('should include entries with objectiveId null', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const juan = response.body.find((p: any) => p.personId === 1);
        const alphaProject = juan.projects.find((pr: any) => pr.projectId === 1);
        const noObjective = alphaProject.objectives.find((o: any) => o.objectiveId === null && o.requirementId === null);
        noObjective.should.be.ok();
        (noObjective.objectiveId === null).should.be.true();
        (noObjective.objectiveTitle === null).should.be.true();
        noObjective.totalMinutes.should.equal(30);
      });
  });

  // TS-1: Task entry exposes objectiveRequirementId/objectiveRequirementTitle when the objective has its own requirement
  it('should include objectiveRequirementId and objectiveRequirementTitle for a task linked to a requirement', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const juan = response.body.find((p: any) => p.personId === 1);
        const alphaProject = juan.projects.find((pr: any) => pr.projectId === 1);
        const juanObjA = alphaProject.objectives.find((o: any) => o.objectiveId === 1);
        juanObjA.should.be.ok();
        juanObjA.objectiveRequirementId.should.equal(1);
        juanObjA.objectiveRequirementTitle.should.equal('Requisito X');
      });
  });

  // Regression: objectiveRequirementTitle must be present even when NO direct-requirement hours exist in the period
  it('should include objectiveRequirementTitle for a task even without any direct-requirement entry in range', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-15', dateTo: '2026-01-15'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        // Jan 15 only has Objetivo A hours (id 200); the direct-requirement entry (id 206) is on Jan 17, out of range
        const juan = response.body.find((p: any) => p.personId === 1);
        const alphaProject = juan.projects.find((pr: any) => pr.projectId === 1);
        const juanObjA = alphaProject.objectives.find((o: any) => o.objectiveId === 1);
        juanObjA.should.be.ok();
        juanObjA.objectiveRequirementId.should.equal(1);
        juanObjA.objectiveRequirementTitle.should.equal('Requisito X');
        // No direct-requirement entry should exist in this narrower range
        const directReq = alphaProject.objectives.find((o: any) => o.objectiveId === null && o.requirementId === 1);
        (directReq === undefined).should.be.true();
      });
  });

  // TS-3 (objectiveRequirementId): Task entry without its own requirement -> null
  it('should return objectiveRequirementId null for a task without a requirement', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const juan = response.body.find((p: any) => p.personId === 1);
        const alphaProject = juan.projects.find((pr: any) => pr.projectId === 1);
        const juanObjB = alphaProject.objectives.find((o: any) => o.objectiveId === 2);
        juanObjB.should.be.ok();
        (juanObjB.objectiveRequirementId === null).should.be.true();
        (juanObjB.objectiveRequirementTitle === null).should.be.true();
      });
  });

  // TS-5: Direct requirement hours entry does not expose objectiveRequirementId
  it('should not expose an objectiveRequirementId value for direct requirement hours', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const juan = response.body.find((p: any) => p.personId === 1);
        const alphaProject = juan.projects.find((pr: any) => pr.projectId === 1);
        const juanReq = alphaProject.objectives.find((o: any) => o.requirementId === 1 && o.objectiveId === null);
        juanReq.should.be.ok();
        (juanReq.objectiveRequirementId === null || juanReq.objectiveRequirementId === undefined).should.be.true();
      });
  });

  // TS-9: Project-only entry (no objective, no requirement) still works with the new field
  it('should return objectiveRequirementId null for a project-only entry', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const juan = response.body.find((p: any) => p.personId === 1);
        const alphaProject = juan.projects.find((pr: any) => pr.projectId === 1);
        const noObjective = alphaProject.objectives.find((o: any) => o.objectiveId === null && o.requirementId === null);
        noObjective.should.be.ok();
        (noObjective.objectiveRequirementId === null || noObjective.objectiveRequirementId === undefined).should.be.true();
      });
  });

  // TS-5: Empty range
  it('should return empty array for range with no data', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2099-01-01', dateTo: '2099-12-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(0);
      });
  });

  // TS-7: Missing dateFrom
  it('should return 400 when dateFrom is missing', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-8: Missing dateTo
  it('should return 400 when dateTo is missing', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-01'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-11: dateFrom > dateTo
  it('should return 400 when dateFrom is after dateTo', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-02-01', dateTo: '2026-01-01'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-13: No token
  it('should return 401 without token', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  // TS-15: external-user role
  it('should return 403 for external-user role', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-17: Single day range (dateFrom = dateTo)
  it('should return data for a single day range', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-15', dateTo: '2026-01-15'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.length.should.be.greaterThan(0);
        // Only data from Jan 15 - Juan has 120+60+30=210 on Alpha, María has 180 on Alpha
        // Juan should NOT have Beta (that's Jan 20)
        const juan = response.body.find((p: any) => p.personId === 1);
        juan.should.be.ok();
        const betaProject = juan.projects.find((pr: any) => pr.projectId === 2);
        (betaProject === undefined).should.be.true();
      });
  });

  // TS-18: Multiple persons in multiple projects
  it('should return multiple persons with their respective projects', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.length.should.equal(2);

        const juan = response.body.find((p: any) => p.personId === 1);
        juan.projects.length.should.equal(2); // Alpha and Beta

        const maria = response.body.find((p: any) => p.personId === 2);
        maria.projects.length.should.equal(1); // Only Alpha
      });
  });

  // TS-19: Correct totals at each hierarchy level
  it('should calculate correct totalMinutes at each level', () => {
    return request(application)
      .get('/api/worked-times/report/by-person')
      .query({dateFrom: '2026-01-01', dateTo: '2026-01-31'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        // Juan: 120+60+30+90+50 = 350
        const juan = response.body.find((p: any) => p.personId === 1);
        juan.totalMinutes.should.equal(350);

        // Juan - Alpha: 120+60+30+50 = 260
        const juanAlpha = juan.projects.find((pr: any) => pr.projectId === 1);
        juanAlpha.totalMinutes.should.equal(260);

        // Juan - Alpha - Objetivo A: 120 (single entry, no duplication from the new group column)
        const juanObjAEntries = juanAlpha.objectives.filter((o: any) => o.objectiveId === 1);
        juanObjAEntries.length.should.equal(1);
        const juanObjA = juanObjAEntries[0];
        juanObjA.totalMinutes.should.equal(120);
        juanObjA.objectiveRequirementId.should.equal(1);
        juanObjA.objectiveRequirementTitle.should.equal('Requisito X');

        // Juan - Alpha - Objetivo B: 60
        const juanObjB = juanAlpha.objectives.find((o: any) => o.objectiveId === 2);
        juanObjB.totalMinutes.should.equal(60);

        // Juan - Alpha - Sin objetivo (solo proyecto): 30
        const juanNoObj = juanAlpha.objectives.find((o: any) => o.objectiveId === null && o.requirementId === null);
        juanNoObj.totalMinutes.should.equal(30);

        // Juan - Alpha - Requisito X (directo): 50
        const juanReq = juanAlpha.objectives.find((o: any) => o.requirementId === 1);
        juanReq.should.be.ok();
        juanReq.totalMinutes.should.equal(50);
        juanReq.requirementTitle.should.equal('Requisito X');
        (juanReq.objectiveId === null).should.be.true();

        // Juan - Beta: 90
        const juanBeta = juan.projects.find((pr: any) => pr.projectId === 2);
        juanBeta.totalMinutes.should.equal(90);

        // María: 180+45 = 225
        const maria = response.body.find((p: any) => p.personId === 2);
        maria.totalMinutes.should.equal(225);

        // María - Alpha: 225
        const mariaAlpha = maria.projects.find((pr: any) => pr.projectId === 1);
        mariaAlpha.totalMinutes.should.equal(225);
      });
  });
});
