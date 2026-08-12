import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Objective, ObjectiveActivity, Person, PersonObjective, Project, Requirement, User, WorkedTime } from '@jiku/models';

describe('GET /api/objectives/:id', () => {
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
        return Project.create({
          id: 1,
          code: 'code1',
          name: 'Project1',
          type: 'comercial',
          description: 'Project test 1',
          status: 'activo',
          priority: 1,
          originId: 1,
          initDate: new Date(),
          createdBy: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Promise.all([
          Person.create({
            id: 1,
            firstName: 'john',
            lastName: 'doe',
            enabled: true,
            initDate: new Date()
          }),
          Person.create({
            id: 2,
            firstName: 'jane',
            lastName: 'doe',
            enabled: true,
            initDate: new Date()
          })
        ]);
      })
      .then(() => {
        return Objective.create({
          id: 1,
          title: 'Objective test 1',
          description: 'Objective test 1 description',
          state: 'activo',
          area: 'desarrollo',
          priority: 1,
          projectId: 1,
          createdBy: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Promise.all([
          PersonObjective.create({personId: 1, objectiveId: 1}),
          PersonObjective.create({personId: 2, objectiveId: 1, isLeader: true})
        ]);
      })
      .then(() => {
        return Promise.all([
          ObjectiveActivity.create({
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'state',
            previousValue: '',
            newValue: 'activo',
            objectiveId: 1
          }),
          ObjectiveActivity.create({
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'priority',
            previousValue: '0',
            newValue: '1',
            objectiveId: 1,
          }),
          ObjectiveActivity.create({
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'area',
            previousValue: '',
            newValue: 'desarrollo',
            objectiveId: 1,
          })
        ]);
      })
      .then(() => {
        return Promise.all([
          WorkedTime.create({
            id: 1,
            objectiveId: 1,
            projectId: 1,
            personId: 1,
            minutes: 60,
            date: new Date('2024-01-01')
          }),
          WorkedTime.create({
            id: 2,
            objectiveId: 1,
            projectId: 1,
            personId: 1,
            minutes: 90,
            date: new Date('2024-01-02')
          }),
        ]);
      });
  });

  after(() => {
    return Objective.destroy({where: {}})
      .then(() => {
        return Project.destroy({where: {}});
      })
      .then(() => {
        return Person.destroy({where: {}});
      })
      .then(() => {
        return PersonObjective.destroy({where: {}});
      })
      .then(() => {
        return ObjectiveActivity.destroy({where: {}});
      })
      .then(() => {
        return User.destroy({where: {}});
      })
      .then(() => {
        return WorkedTime.destroy({where: {}});
      });
  });

  it('should fail with incorrect id', () => {
    return request(application)
      .get('/api/objectives/4')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('objective_not_found');
        response.body.message.should.equal('Objective not found');
      });
  });

  it('should get a objective by id 1', () => {
    return request(application)
      .get('/api/objectives/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedObject =
          {
            id: 1,
            title: 'Objective test 1',
            description: 'Objective test 1 description',
            state: 'activo',
            area: 'desarrollo',
            priority: 1,
            project: {name: 'Project1'},
            creator: {name: 'User 01'},
            workedMinutes: 150,
            persons: [
              {firstName: 'jane', lastName: 'doe'},
              {firstName: 'john', lastName: 'doe'}
            ],
            ObjectiveActivity: [
              {changedBy: 'zitadel-sub-01', typeOfActivity: 'state', previousValue: '', newValue: 'activo', user: {name: 'User 01'}},
              {changedBy: 'zitadel-sub-01', typeOfActivity: 'priority', previousValue: '0', newValue: '1', user: {name: 'User 01'}},
              {changedBy: 'zitadel-sub-01', typeOfActivity: 'area', previousValue: '', newValue: 'desarrollo', user: {name: 'User 01'}},
            ]
          };
        response.body.should.containDeep(expectedObject);
      });
  });

  // TS-17: objective sin vinculo expone requirementId null
  it('TS-17: should expose requirementId as null when objective has no linked requirement', () => {
    return request(application)
      .get('/api/objectives/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        (response.body.requirementId === null).should.be.true();
      });
  });

  describe('requirementId en detalle (S-060, TS-16)', () => {
    before(() => {
      return Requirement.create({
        id: 80,
        title: 'Requisito vinculado a detalle',
        description: 'Desc',
        type: 'funcionalidad',
        state: 'analisis',
        projectId: 1,
        createdBy: 'zitadel-sub-01',
      })
        .then(() => Objective.update({ requirementId: 80 }, { where: { id: 1 } }));
    });

    after(() => {
      return Objective.update({ requirementId: null }, { where: { id: 1 } })
        .then(() => Requirement.destroy({ where: { id: 80 } }));
    });

    it('TS-16: should expose requirementId in objective detail when linked', () => {
      return request(application)
        .get('/api/objectives/1')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.requirementId.should.equal(80);
        });
    });
  });
});

