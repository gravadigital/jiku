import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Project, Requirement, User, UserProjectPermission } from '@jiku/models';

describe('GET /opus/projects/:projid/requirements', () => {
  let application: Application;

  before(() => {
    application = start();

    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com',
    })
      .then(() => User.create({
        id: 'zitadel-sub-04',
        name: 'User 04',
        username: 'user04',
        email: 'user04@mail.com',
      }))
      .then(() => Project.create({
        id: 1,
        name: 'Project 1',
        type: 'comercial',
        status: 'activo',
        initDate: new Date(),
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Project.create({
        id: 2,
        name: 'Project 2',
        type: 'comercial',
        status: 'activo',
        initDate: new Date(),
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: 1,
        title: 'Requirement 1',
        description: 'req 1',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'analisis',
        estimatedFinishDate: '2026-12-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: 2,
        title: 'Requirement 2',
        description: 'req 2',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'planificacion',
        estimatedFinishDate: '2026-12-01',
        projectId: 2,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: 3,
        title: 'Requirement 3',
        description: 'req 3',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'analisis',
        estimatedFinishDate: '2026-12-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: 4,
        title: 'Requirement 4',
        description: 'req 4',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'resuelto',
        estimatedFinishDate: '2026-12-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => UserProjectPermission.create({
        userId: 'zitadel-sub-04',
        projectId: 2
      }));
  });

  after(() => {
    return Requirement.destroy({ where: {} })
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  it('should return 200 if project exists and requirements are found', () => {
    return request(application)
      .get('/api/opus/projects/1/requirements?state=analisis&limit=10&skip=0')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expected = [
          { id: 1, title: 'Requirement 1', description: 'req 1', state: 'analisis' },
          { id: 3, title: 'Requirement 3', description: 'req 3', state: 'analisis' },
        ];
        response.body.should.containDeep(expected);
      });
  });

  it('should return priority and creator for each requirement', () => {
    return request(application)
      .get('/api/opus/projects/1/requirements')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.greaterThan(0);
        response.body.forEach((req: any) => {
          req.should.have.property('priority');
          req.should.have.property('creator');
          req.creator.should.have.property('id', 'zitadel-sub-01');
          req.creator.should.have.property('name', 'User 01');
          req.creator.should.have.property('email', 'user01@mail.com');
        });
      });
  });

  it('should return priority and creator when filtering by state', () => {
    return request(application)
      .get('/api/opus/projects/1/requirements?state[]=analisis')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.greaterThan(0);
        response.body.forEach((req: any) => {
          req.state.should.equal('analisis');
          req.should.have.property('priority');
          req.should.have.property('creator');
        });
      });
  });

  it('should return 200 if requirements sorted by title', () => {
    return request(application)
      .get('/api/opus/projects/1/requirements?sort=title')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expected = [
          { id: 1, title: 'Requirement 1', state: 'analisis' },
          { id: 3, title: 'Requirement 3', state: 'analisis' },
          { id: 4, title: 'Requirement 4', state: 'resuelto' },
        ];
        response.body.should.containDeep(expected);
      });
  });

  it('should return 200 and only project 2 requirements', () => {
    return request(application)
      .get('/api/opus/projects/2/requirements')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expected = [{ id: 2, title: 'Requirement 2', state: 'planificacion' }];
        response.body.should.containDeep(expected);
      });
  });

  it('should return 404 if project not found', () => {
    return request(application)
      .get('/api/opus/projects/9999/requirements?state=analisis&limit=10&skip=0')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('project_not_found');
        response.body.message.should.equal('Project not found');
      });
  });

  it('should return 403 if the external-user does not have permission to access the project', () => {
    return request(application)
      .get('/api/opus/projects/1/requirements?state=analisis&limit=10&skip=0')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
        response.body.message.should.equal('Access denied for this project.');
      });
  });
});
