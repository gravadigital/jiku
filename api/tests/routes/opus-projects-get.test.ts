import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Project, User, UserProjectPermission } from '@jiku/models';

describe('GET /opus/projects', () => {
  let application: Application;

  before(() => {
    application = start();

    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com'
    })
      .then(() => User.create({
        id: 'zitadel-sub-04',
        name: 'User 04',
        username: 'user04',
        email: 'user04@mail.com'
      }))
      .then(() => {
        return Promise.all([
          Project.create({
            id: 1,
            name: 'Project1',
            code: 'P1',
            type: 'comercial',
            status: 'activo',
            initDate: new Date(),
            createdBy: 'zitadel-sub-01',
          }),
          Project.create({
            id: 2,
            name: 'Project2',
            code: 'P2',
            type: 'comercial',
            status: 'analisis',
            initDate: new Date(),
            createdBy: 'zitadel-sub-01',
          }),
          Project.create({
            id: 3,
            name: 'Project3',
            code: 'P3',
            type: 'comercial',
            status: 'activo',
            initDate: new Date(),
            createdBy: 'zitadel-sub-01',
          })
        ]);
      })
      .then(() => UserProjectPermission.create({
        userId: 'zitadel-sub-04',
        projectId: 1,
      }));
  });

  after(() => {
    return UserProjectPermission.destroy({ where: {} })
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  it('should return 401 if no token is provided', () => {
    return request(application)
      .get('/api/opus/projects')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.message.should.equal('Unauthorized');
      });
  });

  it('should return all active projects for a user with "user" role', () => {
    return request(application)
      .get('/api/opus/projects')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.length(2);
        response.body.should.containDeep([{
          id: 1,
          name: 'Project1'
        }, {
          id: 3,
          name: 'Project3'
        }]);
      });
  });

  // TS-20: external-user obtiene proyectos sin filtro por permission_type
  it('TS-20: should return permitted projects for external-user without permission_type filter', () => {
    return request(application)
      .get('/api/opus/projects')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.length(1);
        response.body.should.containDeep([{
          id: 1,
          name: 'Project1'
        }]);
        response.body[0].should.have.properties(['id', 'name']);
      });
  });

  // TS-12 (S-034, CA-6/CA-14): un external-user AUTENTICADO pero SIN ninguna fila en
  // user_project_permissions ve el portal vacío -- 200 [], no un error. El WHERE id IN ()
  // de prepareQuery acota a cero proyectos sin lanzar. Este describe agrega su propio
  // external-user (zitadel-sub-06) sin fila en `users` ni en `user_project_permissions`, a
  // diferencia de zitadel-sub-04 (que sí tiene una fila en el describe de arriba) -- para
  // cubrir el caso realmente vacío y, de paso, CA-1/CA-2: la ausencia de fila en `users` no
  // bloquea la request.
  describe('external-user sin ninguna fila en user_project_permissions ni en users', () => {
    it('TS-12: should return 200 with empty array', () => {
      return request(application)
        .get('/api/opus/projects')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_06_external_user_no_permissions')
        .expect(200)
        .then((response) => {
          response.body.should.eql([]);
        });
    });
  });
});
