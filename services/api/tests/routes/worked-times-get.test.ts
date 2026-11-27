import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Objective, Person, Project, Requirement, User, WorkedTime } from '@jiku/models';

describe('GET /api/worked-times', () => {
  let application: Application;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  before(function() {
    application = start();

    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com'
    })
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
        return Promise.all([
          
          Objective.create({
            id: 1,
            title: 'Objetivo Test',
            state: 'activo',
            area: 'desarrollo',
            priority: 1,
            projectId: 1,
            createdBy: 'zitadel-sub-01',
            visibilityLevel: 'public'
          }),
          Requirement.create({
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
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          WorkedTime.create({
            id: 100,
            date: todayStr,
            minutes: 120,
            projectId: 1,
            personId: 1,
            objectiveId: 1
          }),
          WorkedTime.create({
            id: 101,
            date: todayStr,
            minutes: 60,
            projectId: 1,
            personId: 1,
            objectiveId: null
          }),
          // Carga imputada a un requisito (TS-16)
          WorkedTime.create({
            id: 102,
            date: todayStr,
            minutes: 90,
            projectId: 1,
            personId: 1,
            requirementId: 1
          }),
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

  // TS-5: Happy path - list worked times for a day
  it('should get worked times for person and date', () => {
    return request(application)
      .get('/api/worked-times')
      .query({date: todayStr, personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(3);
        // Should be ordered by createdAt DESC
        response.body[0].should.have.property('id');
        response.body[0].should.have.property('minutes');
        response.body[0].should.have.property('projectId', 1);
        response.body[0].should.have.property('project');
        response.body[0].project.should.have.property('id', 1);
        response.body[0].project.should.have.property('name', 'Proyecto Alpha');
        response.body[0].project.should.have.property('code', 'ALPHA');
        response.body[0].should.have.property('personId', 1);
        response.body[0].should.have.property('createdAt');
      });
  });

  it('should include objective data when present', () => {
    return request(application)
      .get('/api/worked-times')
      .query({date: todayStr, personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const withObjective = response.body.find((wt: any) => wt.objectiveId === 1);
        withObjective.should.be.ok();
        withObjective.objective.should.have.property('id', 1);
        withObjective.objective.should.have.property('title', 'Objetivo Test');

        const withoutObjective = response.body.find((wt: any) => wt.objectiveId === null);
        withoutObjective.should.be.ok();
        (withoutObjective.objective === null).should.be.true();
      });
  });

  // TS-16: el listado expone el requisito en el item imputado a requisito
  it('TS-16: should expose requirement data for items imputed to a requirement', () => {
    return request(application)
      .get('/api/worked-times')
      .query({date: todayStr, personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const withRequirement = response.body.find((wt: any) => wt.requirementId === 1);
        withRequirement.should.be.ok();
        withRequirement.requirement.should.have.property('id', 1);
        withRequirement.requirement.should.have.property('title', 'Req A');
      });
  });

  // TS-17: el listado devuelve requirement null para items sin requisito
  it('TS-17: should return requirement null for items without a requirement', () => {
    return request(application)
      .get('/api/worked-times')
      .query({date: todayStr, personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const withoutRequirement = response.body.find((wt: any) => wt.id === 101);
        withoutRequirement.should.be.ok();
        (withoutRequirement.requirementId === null).should.be.true();
        (withoutRequirement.requirement === null).should.be.true();
      });
  });

  // TS-6: Missing query params → 400
  it('should fail without date or personId', () => {
    return request(application)
      .get('/api/worked-times')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  it('should fail without date param', () => {
    return request(application)
      .get('/api/worked-times')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-7: No results → 200 empty array
  it('should return empty array when no results', () => {
    return request(application)
      .get('/api/worked-times')
      .query({date: todayStr, personId: 999})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(0);
      });
  });

  it('should fail without token', () => {
    return request(application)
      .get('/api/worked-times')
      .query({date: todayStr, personId: 1})
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });
});
