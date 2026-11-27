
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Objective, ObjectiveActivity, Person, PersonObjective, Project, Requirement, User } from '@jiku/models';


describe('PATCH /api/objectives/:id', () => {
  let application : Application;
  let validDate : string;

  before(function() {
    application = start();
    const nowDate = new Date();
    validDate = nowDate.toISOString().split('T')[0];

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
            initDate: validDate
          }),
          Person.create({
            id: 2,
            firstName: 'john',
            lastName: 'doe',
            enabled: true,
            initDate: validDate
          }),
          Person.create({
            id: 3,
            firstName: 'john',
            lastName: 'doe',
            enabled: true,
            initDate: validDate
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          Objective.create({
            id: 1,
            title: 'Objective test 1',
            description: 'Objective description 1',
            estimatedFinishDate: '2023-02-02',
            state: 'activo',
            area: 'desarrollo',
            priority: 1,
            projectId: 1,
            createdBy: 'zitadel-sub-01',
          }),
          Objective.create({
            id: 2,
            title: 'Objective test 2',
            description: 'Objective description 2',
            state: 'finalizado',
            area: 'desarrollo',
            priority: 2,
            projectId: 1,
            createdBy: 'zitadel-sub-01',
          }),
          Objective.create({
            id: 3,
            title: 'Objective test 3',
            description: 'Objective description 3',
            estimatedFinishDate: '2024-03-03',
            state: 'backlog',
            area: 'desarrollo',
            priority: 1,
            projectId: 1,
            createdBy: 'zitadel-sub-01',
          })
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
            personId: 3,
            isLeader: true
          }),
          PersonObjective.create({
            objectiveId: 3,
            personId: 1,
            isLeader: true
          }),
          PersonObjective.create({
            objectiveId: 3,
            personId: 2,
            isLeader: false
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
      });
  });

  it('should fail with update a invalid id objective', () => {
    return request(application)
      .patch('/api/objectives/5')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'Objective test 5',
        state: 'finalizado',
        area: 'desarrollo',
        priority: 2,
        personIds: [1]
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.be.equal('objective_not_found');
        response.body.message.should.be.equal('Objective not found');
      });
  });

  it('should fail with update a invalid id person', () => {
    return request(application)
      .patch('/api/objectives/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'Objective test 1',
        state: 'activo',
        area: 'desarrollo',
        priority: 2,
        estimatedFinishDate: '2023-02-02',
        personIds: [4]
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.be.equal('person_not_found');
        response.body.message.should.be.equal('Person not found');
      });
  });

  it('should update a objective by id 1', () => {
    return request(application)
      .patch('/api/objectives/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'Objective test 1',
        description: 'New objective description 1',
        state: 'activo',
        area: 'diseño',
        priority: 2,
        estimatedFinishDate: '2023-02-02',
        personIds: [1],
      })
      .expect(200)
      .then((response) => {
        response.body.code.should.be.equal('objective_updated');
        response.body.message.should.be.equal('Objective Updated');

        return Objective.findAll();
      })
      .then((objectives) => {
        objectives.should.have.length(3);
        objectives.should.containDeep([{
          id: 1,
          title: 'Objective test 1',
          description: 'New objective description 1',
          estimatedFinishDate: '2023-02-02',
          state: 'activo',
          area: 'diseño',
          priority: 2,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
        }, {
          id: 2,
          title: 'Objective test 2',
          description: 'Objective description 2',
          state: 'finalizado',
          area: 'desarrollo',
          priority: 2,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
        }, {
          id: 3,
          title: 'Objective test 3',
          description: 'Objective description 3',
          state: 'backlog',
          area: 'desarrollo',
          priority: 1,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
        }]);

        return PersonObjective.findAll();
      })
      .then((personObjective) => {
        personObjective.should.have.length(4);
        personObjective.should.containDeep([{
          objectiveId: 1,
          personId: 1,
          isLeader: true
        }, {
          objectiveId: 2,
          personId: 3,
          isLeader: true
        }, {
          objectiveId: 3,
          personId: 1,
          isLeader: true
        }, {
          objectiveId: 3,
          personId: 2,
          isLeader: false
        }]);
        return ObjectiveActivity.findAll();
      })
      .then ((changes) => {
        changes.should.have.length(3);
        changes.should.containDeep([
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'description',
            previousValue: 'Objective description 1',
            newValue: 'New objective description 1',
            objectiveId: 1
          }, {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'priority',
            previousValue: '1',
            newValue: '2',
            objectiveId: 1,
          },
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'area',
            previousValue: 'desarrollo',
            newValue: 'diseño',
            objectiveId: 1,
          }]);
      });
  });

  it('should update relations with person', () => {
    return request(application)
      .patch('/api/objectives/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'Objective test 1',
        description: 'New objective description 1',
        state: 'activo',
        area: 'diseño',
        priority: 2,
        personIds: [2, 3],
        estimatedFinishDate: '2023-02-02',
      })
      .expect(200)
      .then((response) => {

        response.body.code.should.be.equal('objective_updated');
        response.body.message.should.be.equal('Objective Updated');

        return Objective.findAll();
      })
      .then((objectives) => {
        objectives.should.have.length(3);
        objectives.should.containDeep([{
          id: 1,
          title: 'Objective test 1',
          description: 'New objective description 1',
          estimatedFinishDate: '2023-02-02',
          state: 'activo',
          area: 'diseño',
          priority: 2,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
        }, {
          id: 2,
          title: 'Objective test 2',
          description: 'Objective description 2',
          state: 'finalizado',
          area: 'desarrollo',
          priority: 2,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
        }, {
          id: 3,
          title: 'Objective test 3',
          description: 'Objective description 3',
          estimatedFinishDate: '2024-03-03',
          state: 'backlog',
          area: 'desarrollo',
          priority: 1,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
        }]);

        return PersonObjective.findAll();
      })
      .then((persons) => {
        persons.length.should.be.equal(5);
        persons.should.containDeep([{
          objectiveId: 1,
          personId: 2,
          isLeader: true
        }, {
          objectiveId: 1,
          personId: 3,
          isLeader: false
        }, {
          objectiveId: 2,
          personId: 3,
          isLeader: true
        }, {
          objectiveId: 3,
          personId: 1,
          isLeader: true
        }, {
          objectiveId: 3,
          personId: 2,
          isLeader: false
        }]);
        return ObjectiveActivity.findAll();
      })
      .then ((changes) => {
        changes.should.have.length(3);
        changes.should.containDeep([
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'priority',
            previousValue: '1',
            newValue: '2',
            objectiveId: 1,
          },
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'area',
            previousValue: 'desarrollo',
            newValue: 'diseño',
            objectiveId: 1,
          }]);
      });
  });

  it('should register new updates in objective 2', () => {
    return request(application)
      .patch('/api/objectives/2')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'new title',
        state: 'finalizado',
        area: 'desarrollo',
        estimatedFinishDate: '2024-05-17',
        priority: 5,
        personIds: [3]
      })
      .expect(200)
      .then((response) => {

        response.body.code.should.be.equal('objective_updated');
        response.body.message.should.be.equal('Objective Updated');

        return Objective.findAll();
      })
      .then((objectives) => {
        objectives.should.have.length(3);
        objectives.should.containDeep([{
          id: 2,
          title: 'new title',
          state: 'finalizado',
          area: 'desarrollo',
          priority: 5,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
        }]);

        return ObjectiveActivity.findAll();
      })
      .then ((changes) => {
        changes.should.have.length(6);
        changes.should.containDeep([
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'title',
            previousValue: 'Objective test 2',
            newValue: 'new title',
            objectiveId: 2
          }, {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'estimatedFinishDate',
            previousValue: '',
            newValue: '2024-05-17',
            objectiveId: 2,
          }, {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'priority',
            previousValue: '2',
            newValue: '5',
            objectiveId: 2,
          }]);
      });
  });

  it('should only register changes in estimatedFinishDate in objective 2', () => {
    return request(application)
      .patch('/api/objectives/2')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'new title',
        state: 'finalizado',
        area: 'desarrollo',
        estimatedFinishDate: '2024-06-30',
        priority: 5,
        personIds: [3]
      })
      .expect(200)
      .then((response) => {

        response.body.code.should.be.equal('objective_updated');
        response.body.message.should.be.equal('Objective Updated');

        return Objective.findAll();
      })
      .then((objectives) => {
        objectives.should.have.length(3);
        objectives.should.containDeep([{
          id: 2,
          title: 'new title',
          state: 'finalizado',
          area: 'desarrollo',
          priority: 5,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
        }]);

        return ObjectiveActivity.findAll();
      })
      .then ((changes) => {
        changes.should.have.length(7);
        changes.should.containDeep([
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'estimatedFinishDate',
            previousValue: '2024-05-17',
            newValue: '2024-06-30',
            objectiveId: 2,
          }]);
      });
  });

  it('should update and register all fields in objective 3', () => {
    return request(application)
      .patch('/api/objectives/3')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'new title 3',
        state: 'activo',
        area: 'gestion',
        priority: 3,
        personIds: [1, 2]
      })
      .expect(200)
      .then((response) => {

        response.body.code.should.be.equal('objective_updated');
        response.body.message.should.be.equal('Objective Updated');

        return Objective.findAll();
      })
      .then((objectives) => {
        objectives.should.have.length(3);
        objectives.should.containDeep([{
          title: 'new title 3',
          state: 'activo',
          area: 'gestion',
          priority: 3,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
        }]);

        return ObjectiveActivity.findAll();
      })
      .then ((changes) => {
        changes.should.have.length(12);
        changes.should.containDeep([
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'title',
            previousValue: 'Objective test 3',
            newValue: 'new title 3',
            objectiveId: 3
          }, {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'estimatedFinishDate',
            previousValue: '2024-03-03',
            newValue: '',
            objectiveId: 3,
          }, {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'state',
            previousValue: 'backlog',
            newValue: 'activo',
            objectiveId: 3,
          }, {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'area',
            previousValue: 'desarrollo',
            newValue: 'gestion',
            objectiveId: 3,
          }
          , {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'priority',
            previousValue: '1',
            newValue: '3',
            objectiveId: 3,
          }]);
      });
  });

  it('should update area in objective 3', () => {
    return request(application)
      .patch('/api/objectives/3')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'new title 3',
        state: 'activo',
        description: 'New description',
        area: 'diseño',
        priority: 3,
        personIds: [1, 2]
      })
      .expect(200)
      .then((response) => {

        response.body.code.should.be.equal('objective_updated');
        response.body.message.should.be.equal('Objective Updated');

        return Objective.findAll();
      })
      .then((objectives) => {
        objectives.should.have.length(3);
        objectives.should.containDeep([{
          title: 'new title 3',
          state: 'activo',
          area: 'diseño',
          description: 'New description',
          priority: 3,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
        }]);

        return ObjectiveActivity.findAll();
      })
      .then ((changes) => {
        changes.should.have.length(14);
        changes.should.containDeep([
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'area',
            previousValue: 'gestion',
            newValue: 'diseño',
            objectiveId: 3,
          },
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'description',
            previousValue: '',
            newValue: 'New description',
            objectiveId: 3,
          }]);
      });
  });

  it('should delete description in objective 3', () => {
    return request(application)
      .patch('/api/objectives/3')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'new title 3',
        state: 'activo',
        area: 'diseño',
        priority: 3,
        personIds: [1, 2]
      })
      .expect(200)
      .then((response) => {

        response.body.code.should.be.equal('objective_updated');
        response.body.message.should.be.equal('Objective Updated');

        return Objective.findAll();
      })
      .then((objectives) => {
        objectives.should.have.length(3);
        objectives.should.containDeep([{
          title: 'new title 3',
          state: 'activo',
          area: 'diseño',
          priority: 3,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
        }]);

        return ObjectiveActivity.findAll();
      })
      .then ((changes) => {
        changes.should.have.length(14);
        changes.should.containDeep([
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'area',
            previousValue: 'gestion',
            newValue: 'diseño',
            objectiveId: 3,
          }]);
      });
  });

  it('should register finishedAt in objective 3', () => {
    return request(application)
      .patch('/api/objectives/3')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'new title 3',
        state: 'finalizado',
        area: 'diseño',
        priority: 3,
        personIds: [1, 2]
      })
      .expect(200)
      .then((response) => {

        response.body.code.should.be.equal('objective_updated');
        response.body.message.should.be.equal('Objective Updated');

        return Objective.findAll();
      })
      .then((objectives) => {
        objectives.should.have.length(3);
        objectives.should.containDeep([{
          title: 'new title 3',
          state: 'finalizado',
          area: 'diseño',
          priority: 3,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
        }]);

        return ObjectiveActivity.findAll();
      })
      .then ((changes) => {
        changes.should.have.length(15);
        changes.should.containDeep([
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'state',
            previousValue: 'activo',
            newValue: 'finalizado',
            objectiveId: 3,
          },
        ]);
      });
  });

  it('should delete finishedAt in objective 3', () => {
    return request(application)
      .patch('/api/objectives/3')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'new title 3',
        state: 'activo',
        area: 'diseño',
        priority: 3,
        personIds: [1, 2]
      })
      .expect(200)
      .then((response) => {

        response.body.code.should.be.equal('objective_updated');
        response.body.message.should.be.equal('Objective Updated');

        return Objective.findAll();
      })
      .then((objectives) => {
        objectives.should.have.length(3);
        objectives.should.containDeep([{
          title: 'new title 3',
          state: 'activo',
          area: 'diseño',
          priority: 3,
          projectId: 1,
          createdBy: 'zitadel-sub-01',
          finishedAt: null
        }]);

        return ObjectiveActivity.findAll();
      })
      .then ((changes) => {
        changes.should.have.length(16);
        changes.should.containDeep([
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'state',
            previousValue: 'finalizado',
            newValue: 'activo',
            objectiveId: 3,
          },
        ]);
      });
  });

  it('should change state to "under review" in objective 1', () => {
    return request(application)
      .patch('/api/objectives/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'Objective test 1',
        description: 'New objective description 1',
        state: 'en_revision',
        area: 'diseño',
        priority: 2,
        personIds: [2, 3],
        estimatedFinishDate: '2023-02-02',
      })
      .expect(200)
      .then((response) => {

        response.body.code.should.be.equal('objective_updated');
        response.body.message.should.be.equal('Objective Updated');

        return Objective.findAll();
      })
      .then((objectives) => {
        objectives.should.have.length(3);
        objectives.should.containDeep([{
          id: 1,
          title: 'Objective test 1',
          description: 'New objective description 1',
          estimatedFinishDate: '2023-02-02',
          state: 'en_revision',
          area: 'diseño',
          priority: 2,
          projectId: 1,
        }]);

        return ObjectiveActivity.findAll();
      })
      .then ((changes) => {
        changes.should.have.length(17);
        changes.should.containDeep([
          {
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'state',
            previousValue: 'activo',
            newValue: 'en_revision',
            objectiveId: 1,
          },
        ]);
      });
  });




  it('TS-10: should link objective to requirement via requirementId', () => {
    return Requirement.create({
      id: 100,
      title: 'Req para vincular',
      description: 'Desc',
      type: 'funcionalidad',
      priority: 'alta',
      state: 'analisis',
      estimatedFinishDate: '2026-06-01',
      projectId: 1,
      tags: null,
      createdBy: 'zitadel-sub-01',
    })
      .then(() => request(application)
        .patch('/api/objectives/1')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .send({
          title: 'Objective test 1',
          state: 'activo',
          area: 'desarrollo',
          priority: 1,
          personIds: [1],
          requirementId: 100,
        })
        .expect(200))
      .then(() => Objective.findByPk(1))
      .then((objective) => {
        if (!objective) throw new Error('Objective not found');
        objective.requirementId!.should.equal(100);
      })
      .then(() => Requirement.destroy({ where: { id: 100 } }));
  });

  it('TS-10: should unlink objective from requirement with null requirementId', () => {
    return request(application)
      .patch('/api/objectives/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'Objective test 1',
        state: 'activo',
        area: 'desarrollo',
        priority: 1,
        personIds: [1],
        requirementId: null,
      })
      .expect(200)
      .then(() => Objective.findByPk(1))
      .then((objective) => {
        if (!objective) throw new Error('Objective not found');
        (objective.requirementId === null).should.be.true();
      });
  });

  describe('vinculo requisito-objetivo con validacion de proyecto (S-060)', () => {
    before(() => {
      return Project.create({
        id: 2,
        code: 'code2',
        name: 'Project2',
        type: 'comercial',
        status: 'activo',
        priority: 1,
        initDate: new Date(),
        createdBy: 'zitadel-sub-01',
      })
        .then(() => Promise.all([
          Requirement.create({
            id: 50,
            title: 'Requisito proyecto 1',
            description: 'Desc',
            type: 'funcionalidad',
            state: 'analisis',
            projectId: 1,
            createdBy: 'zitadel-sub-01',
          }),
          Requirement.create({
            id: 51,
            title: 'Requisito proyecto 1 bis',
            description: 'Desc',
            type: 'funcionalidad',
            state: 'analisis',
            projectId: 1,
            createdBy: 'zitadel-sub-01',
          }),
          Requirement.create({
            id: 60,
            title: 'Requisito proyecto 2',
            description: 'Desc',
            type: 'funcionalidad',
            state: 'analisis',
            projectId: 2,
            createdBy: 'zitadel-sub-01',
          }),
        ]));
    });

    after(() => {
      return Requirement.destroy({ where: { id: [50, 51, 60] } })
        .then(() => Project.destroy({ where: { id: 2 } }));
    });

    // TS-9: vincular objetivo existente a requisito del mismo proyecto
    it('TS-9: should link objective to a requirement in the same project', () => {
      return request(application)
        .patch('/api/objectives/1')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .send({
          title: 'Objective test 1',
          state: 'activo',
          area: 'desarrollo',
          priority: 1,
          personIds: [1],
          requirementId: 50,
        })
        .expect(200)
        .then(() => Objective.findByPk(1))
        .then((objective) => {
          if (!objective) throw new Error('Objective not found');
          objective.requirementId!.should.equal(50);
        });
    });

    // TS-10: reemplazar vinculo por otro requisito valido
    it('TS-10: should replace existing link with another valid requirement in the same project', () => {
      return request(application)
        .patch('/api/objectives/1')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .send({
          title: 'Objective test 1',
          state: 'activo',
          area: 'desarrollo',
          priority: 1,
          personIds: [1],
          requirementId: 51,
        })
        .expect(200)
        .then(() => Objective.findByPk(1))
        .then((objective) => {
          if (!objective) throw new Error('Objective not found');
          objective.requirementId!.should.equal(51);
        });
    });

    // TS-11: rechazo por proyecto distinto
    it('TS-11: should return 400 requirement_project_mismatch when requirement belongs to another project', () => {
      return request(application)
        .patch('/api/objectives/1')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .send({
          title: 'Objective test 1',
          state: 'activo',
          area: 'desarrollo',
          priority: 1,
          personIds: [1],
          requirementId: 60,
        })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('requirement_project_mismatch');
        });
    });
  });
});
