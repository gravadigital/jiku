import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Objective, Person, Project, User, WorkedTime } from '@jiku/models';

describe('GET /api/projects/objectives-summary', () => {
  let application: Application;

  before(function () {
    application = start();

    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com'
    })
      .then(() => {
        return Person.create({
          id: 1,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@mail.com',
          userId: 'zitadel-sub-01',
          initDate: new Date(),
          enabled: true
        });
      })
      .then(() => {
        return Project.create({
          id: 1,
          code: 'PRJ001',
          name: 'Test Project',
          type: 'comercial',
          description: 'Test project',
          status: 'activo',
          priority: 1,
          originId: 1,
          initDate: new Date(),
          createdBy: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Promise.all([
          Objective.create({
            id: 1,
            title: 'Active Objective 1',
            description: 'Test active objective',
            state: 'activo',
            area: 'desarrollo',
            priority: 1,
            projectId: 1,
            createdBy: 'zitadel-sub-01'
          }),
          Objective.create({
            id: 2,
            title: 'Finished Objective',
            description: 'Test finished objective',
            state: 'finalizado',
            area: 'desarrollo',
            priority: 1,
            projectId: 1,
            finishedAt: new Date(),
            createdBy: 'zitadel-sub-01'
          })
        ]);
      })
      .then(() => {
        return Promise.all([
          WorkedTime.create({
            id: 1,
            date: new Date(),
            minutes: 120,
            projectId: 1,
            personId: 1,
            objectiveId: 1
          }),
          WorkedTime.create({
            id: 2,
            date: new Date(),
            minutes: 180,
            projectId: 1,
            personId: 1,
            objectiveId: 2
          })
        ]);
      });
  });

  after(() => {
    return WorkedTime.destroy({ where: {} })
      .then(() => Objective.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => Person.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  it('should fail without token', () => {
    return request(application)
      .get('/api/projects/objectives-summary')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
        response.body.message.should.equal('Unauthorized');
      });
  });

  it('should return projects with objectives and calculated hours', () => {
    return request(application)
      .get('/api/projects/objectives-summary')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.equal(1);

        const projectSummary = response.body[0];
        projectSummary.should.have.property('project');
        projectSummary.should.have.property('objectives');
        projectSummary.should.have.property('totalWorkedMinutes');
        projectSummary.should.have.property('monthWorkedMinutes');

        projectSummary.project.id.should.equal(1);
        projectSummary.project.name.should.equal('Test Project');

        projectSummary.objectives.length.should.equal(1);
        projectSummary.objectives[0].state.should.equal('activo');


        projectSummary.totalWorkedMinutes.should.equal(300); // 120 + 180
      });
  });

  it('should not return projects without active objectives', () => {
    return Objective.update(
      { state: 'finalizado' },
      { where: { id: 1 } }
    )
      .then(() => {
        return request(application)
          .get('/api/projects/objectives-summary')
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer token_01_user')
          .expect(200);
      })
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.equal(0);
      })
      .then(() => {
        return Objective.update(
          { state: 'activo' },
          { where: { id: 1 } }
        );
      });
  });
});
