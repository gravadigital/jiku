import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Objective, Person, PersonObjective, Project, Requirement, User } from '@jiku/models';

describe('POST /api/objectives', () => {
  let application: Application;
  let validDate : string;

  before(function () {
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
        return  Project.create({
          id: 1,
          code: 'code1',
          name: 'Project1',
          type: 'comercial',
          description: 'Project test 1',
          status: 'activo',
          priority: 1,
          originId: 1,
          initDate: validDate,
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
          })
        ]);
      })
      .then(() => {
        return Project.create({
          id: 99,
          code: 'code99',
          name: 'Project99',
          type: 'comercial',
          description: 'Project test 99',
          status: 'activo',
          priority: 1,
          initDate: validDate,
          createdBy: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Promise.all([
          Requirement.create({
            id: 40,
            title: 'Requisito proyecto 1',
            description: 'Desc',
            type: 'funcionalidad',
            state: 'analisis',
            projectId: 1,
            createdBy: 'zitadel-sub-01',
          }),
          Requirement.create({
            id: 41,
            title: 'Requisito proyecto 99',
            description: 'Desc',
            type: 'funcionalidad',
            state: 'analisis',
            projectId: 99,
            createdBy: 'zitadel-sub-01',
          }),
        ]);
      });
  });


  after(() => {
    return PersonObjective.destroy({where: {}})
      .then(() => {
        return Promise.all([
          Objective.destroy({where: {}}),
          Person.destroy({where: {}}),
          Requirement.destroy({where: {}}),
        ]);
      })
      .then(() => {
        return Project.destroy({where: {id: [1, 99]}})
      })
      .then(() => {
        return User.destroy({where: {}});
      });
  });

  it('should fail with a invalid id in project', () => {
    return request(application)
      .post('/api/objectives')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'objective title',
        estimatedFinishDate: validDate,
        state: 'finalizado',
        area: 'desarrollo',
        priority: 1,
        projectId: 2,
        personIds: [1, 2, 3],
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('project_not_found');
        response.body.message.should.equal('Project not found');
      });
  });

  it('should fail with a invalid ids in persons', () => {
    return request(application)
      .post('/api/objectives')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'objective title',
        estimatedFinishDate: validDate,
        state: 'finalizado',
        area: 'desarrollo',
        priority: 1,
        projectId: 1,
        personIds: [5, 6]
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('person_not_found');
        response.body.message.should.equal('Person not found');
      });
  });

  it('should create a objective and his relations', () => {
    return request(application)
      .post('/api/objectives')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'objective title',
        estimatedFinishDate: validDate,
        state: 'finalizado',
        area: 'desarrollo',
        priority: 1,
        projectId: 1,
        personIds: [1, 2, 3],
      })
      .expect(201)
      .then((response) => {
        const expectedObject =
        {
          title: 'objective title',
          estimatedFinishDate: `${validDate}`,
          state: 'finalizado',
          area: 'desarrollo',
          priority: 1,
          projectId: 1,
          personIds: [1, 2, 3],
          createdBy: 'zitadel-sub-01',
        };
        response.body.should.containDeep(expectedObject);
        const objectiveId = response.body.id;
        return Objective.findByPk(objectiveId).then((objective) => {
          const expectedObject = {
            title: 'objective title',
            estimatedFinishDate: `${validDate}`,
            state: 'finalizado',
            area: 'desarrollo',
            projectId: 1,
            priority: 1,
            createdBy: 'zitadel-sub-01',
          };
          objective!.should.containDeep(expectedObject);

          return PersonObjective.findAll({ where: { objectiveId } });
        });
      })
      .then((persons) => {
        const objectiveId = persons[0].objectiveId;
        const expectePersonObjective= [
          {
            objectiveId,
            personId: 1,
            isLeader: true
          },
          {
            objectiveId,
            personId: 2
          },
          {
            objectiveId,
            personId: 3
          },
        ];
        persons.length.should.be.equal(3);
        persons.should.containDeep(expectePersonObjective);
      });
  });


  it('should create objective with explicit null stageId (sin etapa)', () => {
    return request(application)
      .post('/api/objectives')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'objective explicitly without stage',
        estimatedFinishDate: validDate,
        state: 'activo',
        area: 'desarrollo',
        priority: 1,
        projectId: 1,
        personIds: [1],
        visibilityLevel: 'public'
      })
      .expect(201)
      .then((response) => {
        const expectedObject = {
          title: 'objective explicitly without stage',
          estimatedFinishDate: `${validDate}`,
          state: 'activo',
          area: 'desarrollo',
          priority: 1,
          projectId: 1,
          personIds: [1],
          createdBy: 'zitadel-sub-01',
        };
        response.body.should.containDeep(expectedObject);
        return Objective.findByPk(response.body.id);
      })
      .then((objective) => {
        if (objective) {
          objective.should.not.be.null();
        }
      });
  });

  // TS-12: crear objetivo con requirementId valido (mismo proyecto)
  it('TS-12: should create objective with valid requirementId in the same project', () => {
    return request(application)
      .post('/api/objectives')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'objective linked to requirement',
        estimatedFinishDate: validDate,
        state: 'backlog',
        area: 'desarrollo',
        priority: 1,
        projectId: 1,
        personIds: [1],
        requirementId: 40,
      })
      .expect(201)
      .then((response) => {
        response.body.requirementId.should.equal(40);
      });
  });

  // TS-13: crear objetivo sin requirementId (opcional)
  it('TS-13: should create objective without requirementId and expose it as null', () => {
    return request(application)
      .post('/api/objectives')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'objective without requirement',
        estimatedFinishDate: validDate,
        state: 'backlog',
        area: 'desarrollo',
        priority: 1,
        projectId: 1,
        personIds: [1],
      })
      .expect(201)
      .then((response) => {
        (response.body.requirementId === null).should.be.true();
      });
  });

  // TS-14: requirementId de otro proyecto
  it('TS-14: should return 400 requirement_project_mismatch when requirementId belongs to another project', () => {
    return request(application)
      .post('/api/objectives')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'objective mismatch',
        estimatedFinishDate: validDate,
        state: 'backlog',
        area: 'desarrollo',
        priority: 1,
        projectId: 1,
        personIds: [1],
        requirementId: 41,
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('requirement_project_mismatch');
      });
  });

  // TS-15: requirementId inexistente
  it('TS-15: should return 400 requirement_project_mismatch when requirementId does not exist', () => {
    return request(application)
      .post('/api/objectives')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'objective invalid requirement',
        estimatedFinishDate: validDate,
        state: 'backlog',
        area: 'desarrollo',
        priority: 1,
        projectId: 1,
        personIds: [1],
        requirementId: 99999,
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('requirement_project_mismatch');
      });
  });
});
