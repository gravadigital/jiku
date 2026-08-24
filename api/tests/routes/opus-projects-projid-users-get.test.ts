import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { IdentityType, Project, User, UserProjectPermission } from '@jiku/models';

describe('GET /opus/projects/:projid/users', () => {
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
      .then(() => User.create({
        id: 'external-user-01',
        name: 'Zeta External',
        username: 'zeta-external',
        email: 'zeta@external.com',
      }))
      .then(() => User.create({
        id: 'external-user-02',
        name: 'Alpha External',
        username: 'alpha-external',
        email: 'alpha@external.com',
      }))
      .then(() => User.create({
        id: 'external-user-03',
        name: 'Beta External',
        username: 'beta-external',
        email: 'beta@external.com',
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
        name: 'Project 2 - No external users',
        type: 'comercial',
        status: 'activo',
        initDate: new Date(),
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Project.create({
        id: 3,
        name: 'Project 3',
        type: 'comercial',
        status: 'activo',
        initDate: new Date(),
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => UserProjectPermission.create({
        userId: 'zitadel-sub-04',
        projectId: 3
      }))
      .then(() => UserProjectPermission.create({
        userId: 'external-user-01',
        projectId: 1
      }))
      .then(() => UserProjectPermission.create({
        userId: 'external-user-02',
        projectId: 1
      }))
      .then(() => UserProjectPermission.create({
        userId: 'external-user-03',
        projectId: 1
      }))
      // Siembra del filtro de identityType (CA-7, CA-8). Va en proyectos NUEVOS (4 y 5) y no
      // en el 1: meter el service user en el proyecto 1 convertiria las aserciones existentes
      // (`should.have.length(3)`) en una red de regresion implicita, que seguiria pasando solo
      // porque el filtro funciona. El dia que el filtro se rompa fallarian cuatro tests de tres
      // describe distintos y ninguno diria "el filtro de identityType se rompio".
      //
      // Los dos User llevan `identityType` EXPLICITO, aunque el default cubriria el primero: un
      // test que depende del default para expresar su propia premisa se vuelve ilegible.
      .then(() => Project.create({
        id: 4,
        name: 'Project 4 - Identity type filter',
        type: 'comercial',
        status: 'activo',
        initDate: new Date(),
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Project.create({
        id: 5,
        name: 'Project 5 - Only service identities',
        type: 'comercial',
        status: 'activo',
        initDate: new Date(),
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => User.create({
        id: 'person-with-perm-01',
        name: 'Persona Con Permiso',
        username: 'personacp',
        email: 'personacp@mail.com',
        identityType: IdentityType.Person,
      }))
      .then(() => User.create({
        id: 'service-with-perm-01',
        name: 'Servicio Con Permiso',
        username: 'serviciocp',
        email: 'serviciocp@mail.com',
        identityType: IdentityType.Service,
      }))
      .then(() => User.create({
        id: 'service-only-01',
        name: 'Servicio Solo',
        username: 'servicioSolo',
        email: 'serviciosolo@mail.com',
        identityType: IdentityType.Service,
      }))
      // El service user tiene permiso de proyecto A PROPOSITO: sin el permiso sembrado el test
      // pasaria sin probar nada, porque un service user ya estaria fuera del listado por otra
      // razon (el listado sale de user_project_permissions).
      .then(() => UserProjectPermission.create({
        userId: 'person-with-perm-01',
        projectId: 4
      }))
      .then(() => UserProjectPermission.create({
        userId: 'service-with-perm-01',
        projectId: 4
      }))
      .then(() => UserProjectPermission.create({
        userId: 'service-only-01',
        projectId: 5
      }));
  });

  after(() => {
    return UserProjectPermission.destroy({ where: {} })
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  describe('Authentication', () => {
    it('should return 401 without token', () => {
      return request(application)
        .get('/api/opus/projects/1/users')
        .set('Accept', 'application/json')
        .expect(401)
        .then((response) => {
          response.body.code.should.equal('unauthorized');
          response.body.message.should.equal('Unauthorized');
        });
    });
  });

  describe('Project validation', () => {
    it('should return 404 if project not found', () => {
      return request(application)
        .get('/api/opus/projects/9999/users')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(404)
        .then((response) => {
          response.body.code.should.equal('project_not_found');
          response.body.message.should.equal('Project not found');
        });
    });
  });

  describe('Authorization', () => {
    it('should return 403 if external-user does not have permission to access the project', () => {
      return request(application)
        .get('/api/opus/projects/1/users')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(403)
        .then((response) => {
          response.body.code.should.equal('access_denied');
          response.body.message.should.equal('Access denied for this project.');
        });
    });

    it('should allow internal user (role: user) to access any project', () => {
      return request(application)
        .get('/api/opus/projects/1/users')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200);
    });

    it('should allow external-user with permission to access the project', () => {
      return request(application)
        .get('/api/opus/projects/3/users')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(200);
    });
  });

  describe('Success responses', () => {
    it('should return empty array when project has no external users assigned', () => {
      return request(application)
        .get('/api/opus/projects/2/users')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.should.have.length(0);
        });
    });

    it('should return users with only id, name, email fields', () => {
      return request(application)
        .get('/api/opus/projects/1/users')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.should.have.length(3);
          response.body.forEach((user: Record<string, unknown>) => {
            Object.keys(user).should.have.length(3);
            user.should.have.property('id');
            user.should.have.property('name');
            user.should.have.property('email');
            user.should.not.have.property('username');
            user.should.not.have.property('createdAt');
            user.should.not.have.property('updatedAt');
          });
        });
    });

    it('should return users ordered by name ASC', () => {
      return request(application)
        .get('/api/opus/projects/1/users')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.should.have.length(3);
          response.body[0].name.should.equal('Alpha External');
          response.body[1].name.should.equal('Beta External');
          response.body[2].name.should.equal('Zeta External');
        });
    });

    it('should return correct user data', () => {
      return request(application)
        .get('/api/opus/projects/1/users')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const expectedUsers = [
            { id: 'external-user-02', name: 'Alpha External', email: 'alpha@external.com' },
            { id: 'external-user-03', name: 'Beta External', email: 'beta@external.com' },
            { id: 'external-user-01', name: 'Zeta External', email: 'zeta@external.com' },
          ];
          response.body.should.containDeep(expectedUsers);
        });
    });
  });

  describe('Identity type filter (CA-7, CA-8)', () => {
    it('should return the person and exclude the service identity, both with project permission', () => {
      return request(application)
        .get('/api/opus/projects/4/users')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.should.have.length(1);
          response.body[0].id.should.equal('person-with-perm-01');
          response.body[0].name.should.equal('Persona Con Permiso');
          response.body[0].email.should.equal('personacp@mail.com');
          response.body.map((u: { id: string }) => u.id)
            .should.not.containEql('service-with-perm-01');
        });
    });

    it('should return an empty array when every permitted user is a service identity', () => {
      return request(application)
        .get('/api/opus/projects/5/users')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.should.have.length(0);
        });
    });
  });
});
