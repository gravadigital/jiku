import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Objective, Person, PersonObjective, Project, Requirement, User } from '@jiku/models';

describe('GET /api/worked-times/person-objectives', () => {
  let application: Application;

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

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
        ]);
      })
      .then(() => {
        return Requirement.create({
          id: 1,
          title: 'Req A',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'desarrollo',
          estimatedFinishDate: '2026-07-01',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Promise.all([
          Objective.create({
            id: 1,
            title: 'Objetivo Activo',
            state: 'activo',
            area: 'desarrollo',
            priority: 1,
            projectId: 1,
            requirementId: 1,
            createdBy: 'zitadel-sub-01',
            visibilityLevel: 'public'
          }),
          Objective.create({
            id: 2,
            title: 'Objetivo Finalizado Reciente',
            state: 'finalizado',
            finishedAt: threeDaysAgo,
            area: 'desarrollo',
            priority: 2,
            projectId: 1,
            createdBy: 'zitadel-sub-01',
            visibilityLevel: 'public'
          }),
          Objective.create({
            id: 3,
            title: 'Objetivo Finalizado Antiguo',
            state: 'finalizado',
            finishedAt: tenDaysAgo,
            area: 'desarrollo',
            priority: 3,
            projectId: 1,
            createdBy: 'zitadel-sub-01',
            visibilityLevel: 'public'
          }),
          Objective.create({
            id: 4,
            title: 'Objetivo Backlog',
            state: 'backlog',
            area: 'desarrollo',
            priority: 4,
            projectId: 1,
            createdBy: 'zitadel-sub-01',
            visibilityLevel: 'public'
          }),
          // Objetivo activo SIN requisito (TS-19): requirementId null
          Objective.create({
            id: 5,
            title: 'Objetivo Activo Sin Requisito',
            state: 'activo',
            area: 'desarrollo',
            priority: 5,
            projectId: 1,
            requirementId: null,
            createdBy: 'zitadel-sub-01',
            visibilityLevel: 'public'
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          PersonObjective.create({ personId: 1, objectiveId: 1, isLeader: false, active: true }),
          PersonObjective.create({ personId: 1, objectiveId: 2, isLeader: false, active: true }),
          PersonObjective.create({ personId: 1, objectiveId: 3, isLeader: false, active: true }),
          PersonObjective.create({ personId: 1, objectiveId: 4, isLeader: false, active: true }),
          PersonObjective.create({ personId: 1, objectiveId: 5, isLeader: false, active: true }),
        ]);
      });
  });

  after(() => {
    return PersonObjective.destroy({where: {}})
      .then(() => Objective.destroy({where: {}}))
      .then(() => Requirement.destroy({where: {}}))
      .then(() => Person.destroy({where: {}}))
      .then(() => Project.destroy({where: {}}))
      .then(() => User.destroy({where: {}}));
  });

  // TS-1: Happy path - objectives activos + finalizados < 7 días
  it('should get person objectives with active and recently finished', () => {
    return request(application)
      .get('/api/worked-times/person-objectives')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(3);
        response.body.should.containDeep([
          {id: 1, title: 'Objetivo Activo', state: 'activo', projectId: 1, projectName: 'Proyecto Alpha'},
          {id: 2, title: 'Objetivo Finalizado Reciente', state: 'finalizado', projectId: 1, projectName: 'Proyecto Alpha'},
          {id: 5, title: 'Objetivo Activo Sin Requisito', state: 'activo', projectId: 1, projectName: 'Proyecto Alpha'},
        ]);
      });
  });

  // TS-18: objetivo con requisito expone requirementId
  it('TS-18: should expose requirementId for an objective linked to a requirement', () => {
    return request(application)
      .get('/api/worked-times/person-objectives')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const withRequirement = response.body.find((obj: any) => obj.id === 1);
        withRequirement.should.be.ok();
        withRequirement.should.have.property('requirementId', 1);
      });
  });

  // TS-19: objetivo activo sin requisito expone requirementId null
  it('TS-19: should expose requirementId null for an objective without a requirement', () => {
    return request(application)
      .get('/api/worked-times/person-objectives')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const withoutRequirement = response.body.find((obj: any) => obj.id === 5);
        withoutRequirement.should.be.ok();
        withoutRequirement.should.have.property('state', 'activo');
        (withoutRequirement.requirementId === null).should.be.true();
      });
  });

  // TS-2: Missing personId → 400
  it('should fail without personId query param', () => {
    return request(application)
      .get('/api/worked-times/person-objectives')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-3: No token → 401
  it('should fail without token', () => {
    return request(application)
      .get('/api/worked-times/person-objectives')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  // TS-4: Finished > 7 days ago should not appear
  it('should not include objectives finished more than 7 days ago', () => {
    return request(application)
      .get('/api/worked-times/person-objectives')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        const ids = response.body.map((obj: any) => obj.id);
        ids.should.not.containEql(3);
        ids.should.not.containEql(4);
      });
  });

  it('should work with admin role', () => {
    return request(application)
      .get('/api/worked-times/person-objectives')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_03_admin')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(3);
      });
  });

  it('should fail with external-user role', () => {
    return request(application)
      .get('/api/worked-times/person-objectives')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });
});
