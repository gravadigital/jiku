import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Client, IdentityType, Project, User } from '@jiku/models';

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
      })
      // S-019: las tres identidades que hacen falta para cubrir los tres estados posibles de
      // la columna -- servicio explicito, default de la columna, y un valor inesperado.
      .then(() => {
        return User.create({
          id: 'zitadel-sub-svc',
          name: 'Conector Portal',
          username: 'conector-portal',
          email: 'conector@portal.test',
          identityType: IdentityType.Service,
        });
      })
      // SIN pasar `identityType` a proposito: lo que se verifica es el default de la columna
      // que dejo S-015 CA-6.
      .then(() => {
        return User.create({
          id: 'zitadel-sub-def',
          name: 'Sin Tipo',
          username: 'sintipo',
          email: 'sintipo@mail.com',
        });
      })
      // El esquema de test lo crea `sync()`, donde `identity_type` es un VARCHAR sin CHECK
      // (divergencia deliberada documentada en docs/db-schemas/jiku.md). Eso es lo que permite
      // sembrar un valor invalido sin pelear con el ENUM nativo de produccion.
      .then(() => {
        return User.create({
          id: 'zitadel-sub-raro',
          name: 'Valor Raro',
          username: 'valorraro',
          email: 'valorraro@mail.com',
          identityType: 'algo-raro' as unknown as IdentityType,
        });
      })
      // Los ids arrancan en 20 y no en 2: el proyecto 2 lo usa el test de "id incorrecto", que
      // espera un 400 `project_not_found`.
      .then(() => {
        return Project.create({
          id: 20, code: 'code20', name: 'Project Servicio', type: 'comercial',
          status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-svc',
        });
      })
      .then(() => {
        return Project.create({
          id: 21, code: 'code21', name: 'Project Default', type: 'comercial',
          status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-def',
        });
      })
      .then(() => {
        return Project.create({
          id: 22, code: 'code22', name: 'Project Raro', type: 'comercial',
          status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-raro',
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
            // S-019 CA-1: el payload de autoria suma `identityType`.
            identityType: 'person',
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

  // CA-12 (S-015) + CA-1 (S-019): la respuesta acota el usuario embebido a id, name, email y
  // identityType. La asercion es sobre las CLAVES PRESENTES, no sobre la ausencia de `roles`:
  // un `should.not.have.property('roles')` pasaria igual el dia que se agregue otra columna.
  //
  // El 3 paso a 4 por S-019: el cuarto campo es `identityType`, y `roles` sigue afuera.
  it('S-019 TS-5: should return creator with exactly id, name, email and identityType', () => {
    return request(application)
      .get('/api/projects/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        Object.keys(response.body.creator).should.have.length(4);
        response.body.creator.should.eql({
          id: 'zitadel-sub-01',
          name: 'User 01',
          email: 'user01@mail.com',
          identityType: 'person',
        });
        Object.keys(response.body.creator).should.not.containEql('roles');
        Object.keys(response.body.creator).should.not.containEql('username');
      });
  });

  describe('S-019: los tres estados de identityType en el creator', () => {
    // CA-11: el nombre sigue viajando. La marca lo acompaña.
    it('S-019 TS-6: should mark a service creator and keep its name', () => {
      return request(application)
        .get('/api/projects/20')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.creator.identityType.should.equal('service');
          response.body.creator.name.should.equal('Conector Portal');
        });
    });

    // CA-10: el estado por omision es "no es un servicio". Lo garantiza el default de la
    // columna (S-015 CA-6), no una rama en la api.
    it('S-019 TS-10: should return person for a row that never set identityType', () => {
      return request(application)
        .get('/api/projects/21')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.creator.identityType.should.equal('person');
        });
    });

    // CA-10: la api NO normaliza ni valida el valor -- seria un lugar mas donde divergir del
    // proveedor de identidad. Lo pasa tal cual, y como la condicion del front es
    // `=== 'service'`, un valor inesperado no marca nada.
    it('S-019 TS-11: should pass an unexpected identityType through without normalizing it', () => {
      return request(application)
        .get('/api/projects/22')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.creator.identityType.should.equal('algo-raro');
        });
    });
  });
});
