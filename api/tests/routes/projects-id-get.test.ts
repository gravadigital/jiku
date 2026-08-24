import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Client, Project, User } from '@jiku/models';

describe('GET /api/projects/:id', () => {
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
        return Client.create({
          id: 1,
          name: 'EXO',
        });
      })
      .then(() => {
        return Project.create({
          id: 1,
          code: 'code1',
          clientId: 1,
          name: 'Project1',
          type: 'comercial',
          description: 'Project test 1',
          status: 'activo',
          priority: 1,
          originId: 1,
          initDate: new Date(),
          createdBy: 'zitadel-sub-01',
          keyValuePairs: {
            'documentacion': 'Url de la documentacion',
            'diseño': 'Url del diseño',
            'board_de_tareas': 'Url del board de tareas'
          }
        });
      });
  });

  after(() => {
    return Project.destroy({ where: {} })
      .then(() => {
        return User.destroy({ where: {} });
      })
      .then(() => {
        return Client.destroy({ where: {} });
      });
  });

  it('should fail without token', () => {
    return request(application)
      .get('/api/projects/4')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
        response.body.message.should.equal('Unauthorized');
      });
  });

  it('should fail with incorrect id', () => {
    return request(application)
      .get('/api/projects/2')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('project_not_found');
        response.body.message.should.equal('Project not found');
      });
  });

  it('should get a project by id 1', () => {
    return request(application)
      .get('/api/projects/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedObject =
        {
          id: 1,
          code: 'code1',
          clientId: 1,
          name: 'Project1',
          type: 'comercial',
          description: 'Project test 1',
          status: 'activo',
          endDate: null,
          priority: 1,
          originId: 1,
          createdBy: 'zitadel-sub-01',
          // `username` se quito de este objeto esperado por CA-12 de S-015: el `include` de
          // `User` se acoto a ['id','name','email'], asi que la respuesta ya no lo trae. Es la
          // UNICA asercion preexistente que esta story cambia, y el cambio lo causa CA-12, no
          // un alcance que se escapo.
          creator: {
            id: 'zitadel-sub-01',
            name: 'User 01',
            email: 'user01@mail.com',
          },
          client: {
            id: 1,
            name: 'EXO',
          },
          keyValuePairs: {
            'documentacion': 'Url de la documentacion',
            'diseño': 'Url del diseño',
            'board_de_tareas': 'Url del board de tareas'
          }
        };
        response.body.should.containDeep(expectedObject);
      });
  });

  // CA-12 (S-015): la respuesta acota el usuario embebido a id, name y email. La asercion es
  // sobre las CLAVES PRESENTES, no sobre la ausencia de `roles`: un
  // `should.not.have.property('roles')` pasaria igual el dia que se agregue otra columna.
  it('should return creator with exactly id, name and email', () => {
    return request(application)
      .get('/api/projects/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        Object.keys(response.body.creator).should.have.length(3);
        response.body.creator.should.have.property('id');
        response.body.creator.should.have.property('name');
        response.body.creator.should.have.property('email');
      });
  });
});
