import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Objective, Person, PersonObjective, Project, Requirement, User, WorkedTime } from '@jiku/models';

describe('GET /api/objectives', () => {
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
        return Promise.all([
          Person.create({
            id: 1,
            firstName: 'john',
            lastName: 'doe',
            enabled: true,
            initDate: new Date()
          })
        ]);
      })
      .then(() => {
        return Promise.all([
          Person.create({
            id: 2,
            firstName: 'Jane',
            lastName: 'doe',
            enabled: true,
            initDate: new Date()
          })
        ]);
      })
      .then(() => {
        return Promise.all([
          Project.create({
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
          }),
          Project.create({
            id: 2,
            code: 'code2',
            name: 'Project2',
            type: 'comercial',
            description: 'Project test 2',
            status: 'finalizado',
            priority: 2,
            originId: 1,
            initDate: new Date(),
            createdBy: 'zitadel-sub-01'
          })
        ]);
      })
      .then(() => {
        return Promise.all([
          Objective.create({
            id: 4,
            title: 'Objective test 4',
            description: 'objective description 4',
            state: 'activo',
            area: 'diseño',
            priority: 5,
            projectId: 1,
            visibilityLevel: 'internal',
            createdAt: '2024-01-01',
            createdBy: 'zitadel-sub-01'
          }),
          Objective.create({
            id: 1,
            title: 'Objective test 1',
            description: 'objective description 1',
            state: 'activo',
            area: 'diseño',
            priority: 1,
            projectId: 1,
            createdAt: '2024-01-02',
            createdBy: 'zitadel-sub-01'
          }),
          Objective.create({
            id: 3,
            title: 'Objective test 3',
            description: 'objective description 3',
            state: 'finalizado',
            area: 'diseño',
            priority: 3,
            projectId: 1,
            createdAt: '2024-01-03',
            createdBy: 'zitadel-sub-01'
          }),
          Objective.create({
            id: 2,
            title: 'Objective test 2',
            description: 'objective description 2',
            state: 'backlog',
            area: 'diseño',
            priority: 2,
            projectId: 1,
            createdAt: '2024-01-04',
            createdBy: 'zitadel-sub-01'
          }),
          Objective.create({
            id: 5,
            title: 'Objective test 5',
            description: 'objective description 5',
            state: 'activo',
            area: 'diseño',
            priority: 2,
            projectId: 2,
            createdAt: '2024-01-05',
            createdBy: 'zitadel-sub-01'
          }),
          Objective.create({
            id: 6,
            title: 'Objective test 6',
            description: 'objective description 6',
            state: 'backlog',
            area: 'diseño',
            priority: 2,
            projectId: 1,
            createdAt: '2024-01-06',
            createdBy: 'zitadel-sub-01'
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          PersonObjective.create({
            objectiveId: 1,
            personId: 1,
            isLeader: true
          }),
          PersonObjective.create({
            objectiveId: 2,
            personId: 1,
            isLeader: true
          }),
          PersonObjective.create({
            objectiveId: 1,
            personId: 2,
            isLeader: false
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
            objectiveId: 2,
            projectId: 1,
            personId: 1,
            minutes: 90,
            date: new Date('2024-01-02')
          }),
          WorkedTime.create({
            id: 3,
            objectiveId: 1,
            projectId: 1,
            personId: 2,
            minutes: 120,
            date: new Date('2024-01-03')
          })
        ]);
      });
  });

  after(() => {
    return Objective.destroy({where: {}})
      .then(() => {
        return Project.destroy({where: {}});
      })
      .then(() => {
        return User.destroy({where: {}});
      })
      .then(() => {
        return Person.destroy({where: {}});
      })
      .then(() => {
        return PersonObjective.destroy({where: {}});
      })
      .then(() => {
        return WorkedTime.destroy({where: {}});
      });

  });

  it('should fail with invalid query params', () => {
    const filters = {
      limit: -2
    };
    return request(application)
      .get('/api/objectives')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.be.equal('invalid_fields');
        response.body.message.should.be.equal('Invalid field - "limit" must be greater than or equal to 1');
      });
  });

  it('should get all objectives', () => {
    return request(application)
      .get('/api/objectives')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedObjects = [
          {
            id: 1,
            title: 'Objective test 1',
            description: 'objective description 1',
            state: 'activo',
            area: 'diseño',
            priority: 1,
            createdBy: 'zitadel-sub-01',
            project: {name: 'Project1'},
            workedMinutes: 180,
            persons: [{
              id: 1,
              firstName: 'john',
              lastName: 'doe'
            },
            {
              id: 2,
              firstName: 'Jane',
              lastName: 'doe'
            }],
          },
          {
            id: 2,
            title: 'Objective test 2',
            description: 'objective description 2',
            state: 'backlog',
            area: 'diseño',
            priority: 2,
            createdBy: 'zitadel-sub-01',
            workedMinutes: 90,
            project: {name: 'Project1'},
          },
          {
            id: 3,
            title: 'Objective test 3',
            description: 'objective description 3',
            state: 'finalizado',
            area: 'diseño',
            priority: 3,
            createdBy: 'zitadel-sub-01',
            workedMinutes: 0,
            project: {name: 'Project1'},
          },
          {
            id: 4,
            title: 'Objective test 4',
            description: 'objective description 4',
            state: 'activo',
            area: 'diseño',
            priority: 5,
            createdBy: 'zitadel-sub-01',
            visibilityLevel: 'internal',
            workedMinutes: 0,
            project: {name: 'Project1'},
          },
          {
            id: 5,
            title: 'Objective test 5',
            description: 'objective description 5',
            state: 'activo',
            area: 'diseño',
            priority: 2,
            createdBy: 'zitadel-sub-01',
            workedMinutes: 0,
            projectId: 2,
          },
          {
            id: 6,
            title: 'Objective test 6',
            description: 'objective description 6',
            state: 'backlog',
            area: 'diseño',
            priority: 2,
            createdBy: 'zitadel-sub-01',
            workedMinutes: 0,
            project: {name: 'Project1'},
          }
        ];
        response.body.should.containDeep(expectedObjects);
        response.body.should.have.length(6);
      });
  });

  it('should get filtered objectives', () => {
    const filters = {
      sort: '-priority',
      limit: 2
    };
    return request(application)
      .get('/api/objectives')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedObjects = [
          {
            id: 4,
            title: 'Objective test 4',
            description: 'objective description 4',
            state: 'activo',
            area: 'diseño',
            priority: 5,
            createdBy: 'zitadel-sub-01',
            project: {name: 'Project1'},
            workedMinutes: 0,
          },
          {
            id: 3,
            title: 'Objective test 3',
            description: 'objective description 3',
            state: 'finalizado',
            area: 'diseño',
            priority: 3,
            createdBy: 'zitadel-sub-01',
            project: {name: 'Project1'},
            workedMinutes: 0,
          },
        ];
        response.body.should.containDeep(expectedObjects);
        response.body.should.have.length(2);
      });
  });

  it('should only get pending objectives', () => {
    const filters = {
      state: 'backlog'
    };
    return request(application)
      .get('/api/objectives')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedObjects = [
          {
            id: 2,
            title: 'Objective test 2',
            description: 'objective description 2',
            state: 'backlog',
            area: 'diseño',
            priority: 2,
            createdBy: 'zitadel-sub-01',
            project: {name: 'Project1'},
            workedMinutes: 90,
          },
          {
            id: 6,
            title: 'Objective test 6',
            description: 'objective description 6',
            state: 'backlog',
            area: 'diseño',
            priority: 2,
            createdBy: 'zitadel-sub-01',
            project: {name: 'Project1'},
            workedMinutes: 0,
          },
        ];
        response.body.should.containDeep(expectedObjects);
        response.body.should.have.length(2);
      });
  });

  it('should search objective 3', () => {
    const filters = {
      search: 'TesT 3'
    };
    return request(application)
      .get('/api/objectives')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedObject = [
          {
            id: 3,
            title: 'Objective test 3',
            description: 'objective description 3',
            state: 'finalizado',
            area: 'diseño',
            priority: 3,
            createdBy: 'zitadel-sub-01',
            project: {name: 'Project1'},
            workedMinutes: 0,
          },
        ];
        response.body.should.containDeep(expectedObject);
        response.body.should.have.length(1);
      });
  });

  it('should get all objectives with projectId = 1', () => {
    const filters = {
      projectId: 1
    };
    return request(application)
      .get('/api/objectives')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedObjects = [
          {
            id: 1,
            title: 'Objective test 1',
            description: 'objective description 1',
            state: 'activo',
            area: 'diseño',
            priority: 1,
            createdBy: 'zitadel-sub-01',
            project: {name: 'Project1'},
            workedMinutes: 180,
            persons: [{
              id: 1,
              firstName: 'john',
              lastName: 'doe'
            },
            {
              id: 2,
              firstName: 'Jane',
              lastName: 'doe'
            }]
          },
          {
            id: 2,
            title: 'Objective test 2',
            description: 'objective description 2',
            state: 'backlog',
            area: 'diseño',
            priority: 2,
            createdBy: 'zitadel-sub-01',
            project: {name: 'Project1'},
            workedMinutes: 90,
          },
          {
            id: 3,
            title: 'Objective test 3',
            description: 'objective description 3',
            state: 'finalizado',
            area: 'diseño',
            priority: 3,
            createdBy: 'zitadel-sub-01',
            project: {name: 'Project1'},
            workedMinutes: 0,
          },
          {
            id: 4,
            title: 'Objective test 4',
            description: 'objective description 4',
            state: 'activo',
            area: 'diseño',
            priority: 5,
            createdBy: 'zitadel-sub-01',
            project: {name: 'Project1'},
            workedMinutes: 0,
          },
          {
            id: 6,
            title: 'Objective test 6',
            description: 'objective description 6',
            state: 'backlog',
            area: 'diseño',
            priority: 2,
            createdBy: 'zitadel-sub-01',
            project: {name: 'Project1'},
            workedMinutes: 0,
          }
        ];
        response.body.should.containDeep(expectedObjects);
        response.body.should.have.length(5);
      });
  });

  it('should get all objective related to project 2 using search by projectName', () => {
    const filters = {
      projectName: 'Project2'
    };
    return request(application)
      .get('/api/objectives')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedObject = [
          {
            id: 5,
            title: 'Objective test 5',
            description: 'objective description 5',
            state: 'activo',
            area: 'diseño',
            priority: 2,
            createdBy: 'zitadel-sub-01',
            project: {name: 'Project2'},
          },
        ];
        response.body.should.containDeep(expectedObject);
        response.body.should.have.length(1);
      });
  });

  it('should return a empty array with incorrect project name', () => {
    const filters = {
      projectName: 'Project3'
    };
    return request(application)
      .get('/api/objectives')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.length(0);
      });
  });

  it('should use pagination to filter objectives', () => {
    const filters = {
      limit: 2,
      page: 3
    };
    return request(application)
      .get('/api/objectives')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedObjects = [
          {
            id: 1,
            title: 'Objective test 1',
          },
          {
            id: 4,
            title: 'Objective test 4',
          },
        ];
        response.body.should.containDeep(expectedObjects);

        response.body.should.have.length(filters.limit);
      });
  });

  it('should get objectives with state "active" and "finished" ', () => {
    const filters = {
      state: 'activo,finalizado'
    };
    return request(application)
      .get('/api/objectives')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedObjects = [
          {
            id: 4,
            title: 'Objective test 4',
            state: 'activo',
            area: 'diseño',
          },
          {
            id: 1,
            title: 'Objective test 1',
            state: 'activo',
            area: 'diseño',
          },
          {
            id: 3,
            title: 'Objective test 3',
            state: 'finalizado',
            area: 'diseño',
          },
          {
            id: 5,
            title: 'Objective test 5',
            state: 'activo',
            area: 'diseño',
          },
        ];
        response.body.should.containDeep(expectedObjects);
        response.body.should.have.length(4);
      });
  });

  it('should get all objective related to a person" ', () => {
    const filters = {
      personId: 1
    };
    return request(application)
      .get('/api/objectives')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedObjects = [
          {
            id: 1,
            title: 'Objective test 1',
            description: 'objective description 1',
            state: 'activo',
            area: 'diseño',
            priority: 1,
            createdBy: 'zitadel-sub-01',
          },
          {
            id: 2,
            title: 'Objective test 2',
            description: 'objective description 2',
            state: 'backlog',
            area: 'diseño',
            priority: 2,
            createdBy: 'zitadel-sub-01',
          },
        ];
        response.body.should.containDeep(expectedObjects);
        response.body.should.have.length(2);
      });
  });

  it('should get all objective count', () => {
    const filters = {
      count: true
    };
    return request(application)
      .get('/api/objectives')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.equal(6);
      });
  });

  it('should get objective count with filters', () => {
    const filters = {
      limit: 2,
      page: 3,
      projectId: 1,
      count: true
    };
    return request(application)
      .get('/api/objectives')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.equal(5);
      });
  });

  describe('requirementId en listado (S-060, TS-18)', () => {
    before(() => {
      return Requirement.create({
        id: 70,
        title: 'Requisito vinculado',
        description: 'Desc',
        type: 'funcionalidad',
        state: 'analisis',
        projectId: 1,
        createdBy: 'zitadel-sub-01',
      })
        .then(() => Objective.update({ requirementId: 70 }, { where: { id: 1 } }));
    });

    after(() => {
      return Objective.update({ requirementId: null }, { where: { id: 1 } })
        .then(() => Requirement.destroy({ where: { id: 70 } }));
    });

    it('TS-18: should expose requirementId in listing when objective is linked', () => {
      return request(application)
        .get('/api/objectives')
        .query({ projectId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const linked = response.body.find((o: any) => o.id === 1);
          linked.requirementId.should.equal(70);
          const unlinked = response.body.find((o: any) => o.id === 2);
          (unlinked.requirementId === null).should.be.true();
        });
    });
  });

  /**
   * S-010: el listado deja de traer las 6 claves de la integración por cada elemento.
   * Aserción sobre `Object.keys(...)`: una clave presente con valor `undefined` también
   * incumpliría el criterio, y `res.body[i].externalUrl === undefined` no lo detectaría.
   */
  describe('S-010: la integración con sistemas externos no viaja en el listado', () => {
    const OBJECTIVE_INTEGRATION_KEYS = [
      'externalProjectId',
      'externalIssueId',
      'externalIssueKey',
      'externalUrl',
      'externalRawData',
      'lastSyncedAt',
    ];

    it('TS-9: ningún elemento del listado expone las 6 claves de la integración', () => {
      return request(application)
        .get('/api/objectives')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.be.above(0);
          response.body.forEach((objective: any) => {
            const keys = Object.keys(objective);
            OBJECTIVE_INTEGRATION_KEYS.forEach((key) => {
              keys.should.not.containEql(key);
            });
            keys.should.containEql('id');
            keys.should.containEql('title');
          });
        });
    });
  });
});
