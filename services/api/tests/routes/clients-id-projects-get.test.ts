import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Client, Project, User } from '@jiku/models';

describe('GET /api/clients/:clientId/projects', () => {
  let application: Application;

  before(function() {
    application = start();

    return Promise.all([
      User.create({
        id: 'zitadel-sub-01',
        name: 'User 01',
        username: 'user01',
        email: 'user01@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-04',
        name: 'External User 01',
        username: 'external01',
        email: 'external01@mail.com'
      }),
    ])
      .then(() => {
        return Promise.all([
          Client.create({ id: 1, name: 'Cliente Con Proyectos', description: 'Desc' }),
          Client.create({ id: 2, name: 'Cliente Sin Proyectos', description: 'Desc' }),
        ]);
      })
      .then(() => {
        return Promise.all([
          Project.create({
            id: 1,
            code: 'ALPHA',
            name: 'Proyecto Alpha',
            type: 'comercial',
            status: 'analisis',
            priority: 5,
            initDate: new Date(),
            clientId: 1,
            createdBy: 'zitadel-sub-01'
          }),
          Project.create({
            id: 2,
            code: 'BETA',
            name: 'Proyecto Beta',
            type: 'comercial',
            status: 'activo',
            priority: 3,
            initDate: new Date(),
            clientId: 1,
            createdBy: 'zitadel-sub-01'
          }),
          Project.create({
            id: 3,
            code: 'GAMMA',
            name: 'Proyecto Gamma',
            type: 'interno',
            status: 'inactivo',
            priority: 1,
            initDate: new Date(),
            clientId: 1,
            createdBy: 'zitadel-sub-01'
          }),
        ]);
      });
  });

  after(() => {
    return Project.destroy({where: {}})
      .then(() => Client.destroy({where: {}}))
      .then(() => User.destroy({where: {}}));
  });

  // TS-1: Listado exitoso de proyectos de un cliente
  it('should list projects of an existing client', () => {
    return request(application)
      .get('/api/clients/1/projects')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(3);
        response.body.should.containDeep([
          {id: 1, code: 'ALPHA', name: 'Proyecto Alpha', type: 'comercial', status: 'analisis', clientId: 1, priority: 5, createdBy: 'zitadel-sub-01'},
        ]);
      });
  });

  // TS-2: Cliente existente sin proyectos
  it('should return an empty array for an existing client with no projects', () => {
    return request(application)
      .get('/api/clients/2/projects')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(0);
      });
  });

  // TS-3: Filtro por múltiples estados
  it('should filter projects by multiple status values', () => {
    return request(application)
      .get('/api/clients/1/projects')
      .query({status: 'activo,inactivo'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(2);
        const ids = response.body.map((p: any) => p.id);
        ids.should.containEql(2);
        ids.should.containEql(3);
        ids.should.not.containEql(1);
      });
  });

  // TS-4: Sin filtro de estado devuelve todos
  it('should return projects in any status when status filter is omitted', () => {
    return request(application)
      .get('/api/clients/1/projects')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.length(3);
      });
  });

  // TS-5 / TS-6: Paginación
  it('should return the first page when paginating', () => {
    return request(application)
      .get('/api/clients/1/projects')
      .query({page: 1, limit: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(1);
      });
  });

  it('should return the second page when paginating', () => {
    return request(application)
      .get('/api/clients/1/projects')
      .query({page: 2, limit: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(1);
      });
  });

  // TS-7: Cliente inexistente
  it('should fail with 404 when clientId does not exist', () => {
    return request(application)
      .get('/api/clients/9999/projects')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then((response) => {
        response.body.should.eql({code: 'client_not_found', message: 'Client not found'});
      });
  });

  // TS-8: status fuera del enum válido
  it('should fail with 400 when status is not a valid enum value', () => {
    return request(application)
      .get('/api/clients/1/projects')
      .query({status: 'no_existe'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-9: page no numérico
  it('should fail with 400 when page is not numeric', () => {
    return request(application)
      .get('/api/clients/1/projects')
      .query({page: 'abc'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-10: limit negativo
  it('should fail with 400 when limit is negative', () => {
    return request(application)
      .get('/api/clients/1/projects')
      .query({limit: -5})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-11: limit supera el máximo permitido
  it('should fail with 400 when limit exceeds the maximum allowed', () => {
    return request(application)
      .get('/api/clients/1/projects')
      .query({limit: 31})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-12: Usuario externo sin acceso
  it('should fail with 403 for external-user role', () => {
    return request(application)
      .get('/api/clients/1/projects')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-13: Sin token de autenticación
  it('should fail with 401 when no token is provided', () => {
    return request(application)
      .get('/api/clients/1/projects')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  // TS-14: clientId no numérico en el path
  it('should fail with 400 when clientId is not numeric', () => {
    return request(application)
      .get('/api/clients/abc/projects')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });
});
