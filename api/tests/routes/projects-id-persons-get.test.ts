import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Person, Project, ProjectPerson, User } from '@jiku/models';

describe('GET /api/projects/:projid/persons', () => {
  let application: Application;

  before(function () {
    this.timeout(30000);
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' })
      .then(() => Project.create({ id: 1, name: 'Project1', code: 'P1', type: 'comercial', status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-01' }))
      .then(() => Person.create({ id: 10, firstName: 'Ana', lastName: 'Gómez', enabled: true, initDate: new Date() }))
      .then(() => Person.create({ id: 11, firstName: 'Luis', lastName: 'Pérez', enabled: true, initDate: new Date() }))
      .then(() => ProjectPerson.create({ projectId: 1, personId: 10 }))
      .then(() => ProjectPerson.create({ projectId: 1, personId: 11 }));
  });

  after(() => {
    return ProjectPerson.destroy({ where: {} })
      .then(() => Person.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  it('should return 401 if no token is provided', () => {
    return request(application)
      .get('/api/projects/1/persons')
      .expect(401);
  });

  // TS-11: proyecto inexistente
  it('TS-11: should return 404 for non-existent project', () => {
    return request(application)
      .get('/api/projects/99999/persons')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then((res) => {
        res.body.code.should.equal('project_not_found');
      });
  });

  // TS-10: personas del proyecto
  it('TS-10: should return persons associated with the project', () => {
    return request(application)
      .get('/api/projects/1/persons')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((res) => {
        res.body.should.be.an.Array();
        res.body.length.should.equal(2);
        const ana = res.body.find((p: any) => p.id === 10);
        ana.should.be.an.Object();
        ana.firstName.should.equal('Ana');
        ana.lastName.should.equal('Gómez');
        res.body.forEach((p: any) => {
          p.should.have.property('id');
          p.should.have.property('firstName');
          p.should.have.property('lastName');
        });
      });
  });
});
