import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Client, Project, User } from '@jiku/models';

describe('GET /api/projects', () => {
  let application : Application;

  before(function() {
    application = start();

    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com'
    })
      .then(() => {
        // `description` existe a propósito: TS-3 demuestra que el include recorta a id y name.
        return Client.create({ id: 1, name: 'EXO', description: 'Cliente EXO' });
      })
      .then(() => {
        return Promise.all([
          Project.create({
            id: 1,
            clientId: 1,
            code: 'code1',
            name: 'Project1',
            type: 'comercial',
            description: 'Project test 1',
            status: 'activo',
            priority: 5,
            originId: 1,
            initDate: new Date(),
            createdAt: '2024-01-01',
            createdBy: 'zitadel-sub-01'
          }),
          Project.create({
            id: 2,
            clientId: 1,
            code: 'code2',
            name: 'Project2',
            type: 'interno',
            description: 'Project test 2',
            status: 'inactivo',
            priority: 3,
            originId: 1,
            initDate: new Date(),
            createdAt: '2024-01-02',
            createdBy: 'zitadel-sub-01'
          }),
          Project.create({
            id: 3,
            code: 'code3',
            name: 'Project3',
            type: 'propuesta',
            description: 'Project test 3',
            status: 'analisis',
            priority: 4,
            originId: 1,
            initDate: new Date(),
            createdAt: '2024-01-03',
            createdBy: 'zitadel-sub-01'
          }),
          Project.create({
            id: 4,
            code: 'code4',
            name: 'Project4',
            type: 'propuesta',
            description: 'Project test 4',
            status: 'activo',
            priority: 2,
            originId: 1,
            initDate: new Date(),
            createdAt: '2024-01-04',
            createdBy: 'zitadel-sub-01'
          }),
        ]);
      });
  });

  after(() => {
    return Project.destroy({where: {}})
      .then(() => {
        return Client.destroy({where: {}});
      })
      .then(() => {
        return User.destroy({where: {}});
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

  it('should fail with invalid query params', () => {
    const filters = {
      limit: -2
    };
    return request(application)
      .get('/api/projects')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.be.equal('invalid_fields');
        response.body.message.should.be.equal('Invalid field - "limit" must be greater than or equal to 1');
      });
  });

  it('should get all projects', () => {
    return request(application)
      .get('/api/projects')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.length(4);
        response.body.should.containDeep([
          {
            id: 1,
            code: 'code1',
            name: 'Project1',
            type: 'comercial',
            description: 'Project test 1',
            status: 'activo',
            priority: 5,
            originId: 1,
            clientId: 1,
            client: {id: 1, name: 'EXO'},
            createdBy: 'zitadel-sub-01',
            creator: {name: 'User 01'}
          },
          {
            id: 4,
            code: 'code4',
            name: 'Project4',
            type: 'propuesta',
            description: 'Project test 4',
            status: 'activo',
            priority: 2,
            originId: 1,
            clientId: null,
            client: null,
            createdBy: 'zitadel-sub-01',
            creator: {name: 'User 01'}
          },
          {
            id: 2,
            code: 'code2',
            name: 'Project2',
            type: 'interno',
            description: 'Project test 2',
            status: 'inactivo',
            priority: 3,
            originId: 1,
            clientId: 1,
            client: {id: 1, name: 'EXO'},
            createdBy: 'zitadel-sub-01',
            creator: {name: 'User 01'}
          },
          {
            id: 3,
            code: 'code3',
            name: 'Project3',
            type: 'propuesta',
            description: 'Project test 3',
            status: 'analisis',
            priority: 4,
            originId: 1,
            clientId: null,
            client: null,
            createdBy: 'zitadel-sub-01',
            creator: {name: 'User 01'}
          }
        ]);
      });
  });

  it('should get filtered projects', () => {
    const filters = {
      sort: '-priority',
      limit: 2
    };
    return request(application)
      .get('/api/projects')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedProjects = [
          {
            id: 1,
            code: 'code1',
            name: 'Project1',
            type: 'comercial',
            description: 'Project test 1',
            status: 'activo',
            endDate: null,
            priority: 5,
            originId: 1,
            createdBy: 'zitadel-sub-01',
            creator: {name: 'User 01'}
          },
          {
            id: 3,
            code: 'code3',
            name: 'Project3',
            type: 'propuesta',
            description: 'Project test 3',
            status: 'analisis',
            endDate: null,
            priority: 4,
            originId: 1,
            createdBy: 'zitadel-sub-01',
            creator: {name: 'User 01'}
          },
        ];
        response.body.should.containDeep(expectedProjects);
        response.body.should.have.length(2);
      });
  });

  it('should only get active projects', () => {
    const filters = {
      state: 'activo'
    };
    return request(application)
      .get('/api/projects')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedProjects = [
          {
            id: 1,
            code: 'code1',
            name: 'Project1',
            type: 'comercial',
            description: 'Project test 1',
            status: 'activo',
            priority: 5,
            originId: 1,
            createdBy: 'zitadel-sub-01',
            creator: {name: 'User 01'}
          },
          {
            id: 4,
            code: 'code4',
            name: 'Project4',
            type: 'propuesta',
            description: 'Project test 4',
            status: 'activo',
            priority: 2,
            originId: 1,
            createdBy: 'zitadel-sub-01',
            creator: {name: 'User 01'}
          },
        ];
        response.body.should.containDeep(expectedProjects);
        response.body.should.have.length(2);
      });
  });

  it('should get active and analysis projects', () => {
    const filters = {
      state: 'activo,analisis'
    };
    return request(application)
      .get('/api/projects')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedProjects = [
          {
            id: 1,
            code: 'code1',
            name: 'Project1',
            type: 'comercial',
            description: 'Project test 1',
            status: 'activo',
            priority: 5,
            originId: 1,
            createdBy: 'zitadel-sub-01',
            creator: {name: 'User 01'}
          },
          {
            id: 4,
            code: 'code4',
            name: 'Project4',
            type: 'propuesta',
            description: 'Project test 4',
            status: 'activo',
            priority: 2,
            originId: 1,
            createdBy: 'zitadel-sub-01',
            creator: {name: 'User 01'}
          },
          {
            id: 3,
            code: 'code3',
            name: 'Project3',
            type: 'propuesta',
            description: 'Project test 3',
            status: 'analisis',
            priority: 4,
            originId: 1,
            createdBy: 'zitadel-sub-01',
            creator: {name: 'User 01'}
          }
        ];
        response.body.should.containDeep(expectedProjects);
        response.body.should.have.length(3);
      });
  });

  it('should search project 3', () => {
    const filters = {
      search: 'Project3'
    };
    return request(application)
      .get('/api/projects')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedProject = [
          {
            id: 3,
            code: 'code3',
            name: 'Project3',
            type: 'propuesta',
            description: 'Project test 3',
            status: 'analisis',
            priority: 4,
            originId: 1,
            createdBy: 'zitadel-sub-01',
            creator: {name: 'User 01'}
          },
        ];
        response.body.should.containDeep(expectedProject);
        response.body.should.have.length(1);
      });
  });

  it('should get all projects with type "propuesta"', () => {
    const filters = {
      type: 'propuesta'
    };
    return request(application)
      .get('/api/projects')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedProjects = [
          {
            id: 3,
            name: 'Project3',
            type: 'propuesta',
          },
          {
            id: 4,
            name: 'Project4',
            type: 'propuesta',
          },
        ];
        response.body.should.containDeep(expectedProjects);
        response.body.should.have.length(2);
      });
  });

  it('should get a project with multiple filters', () => {
    const filters = {
      type: 'comercial',
      state: 'activo',
      search: 'PROJECT',
      limit: 1,
      sort: '-priority'
    };
    return request(application)
      .get('/api/projects')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedProject = [
          {
            id: 1,
            code: 'code1',
            name: 'Project1',
            type: 'comercial',
            status: 'activo',
          },
        ];
        response.body.should.containDeep(expectedProject);
        response.body.should.have.length(1);
      });
  });

  it('should use pagination to filter projects', () => {
    const filters = {
      limit: 1,
      page: 3
    };
    return request(application)
      .get('/api/projects')
      .query(filters)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedProject = [
          {
            id: 2,
            name: 'Project2',
          },
        ];
        response.body.should.containDeep(expectedProject);
        response.body.should.have.length(filters.limit);
      });
  });

  // CA-12 (S-015): es el caso MAS EXPUESTO de todos, porque devuelve una lista: un `include`
  // sin acotar filtraria los roles de CADA creador de proyecto en una sola respuesta. Por eso
  // el test recorre todos los elementos, no solo el primero. La asercion es sobre las CLAVES
  // PRESENTES, no sobre la ausencia de `roles`.
  it('should return every project creator with exactly id, name and email', () => {
    return request(application)
      .get('/api/projects')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.above(0);
        response.body.forEach((project: { creator: Record<string, unknown> }) => {
          Object.keys(project.creator).should.have.length(3);
          project.creator.should.have.property('id');
          project.creator.should.have.property('name');
          project.creator.should.have.property('email');
        });
      });
  });

  it('should fail without token on the list endpoint', () => {
    return request(application)
      .get('/api/projects')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
        response.body.message.should.equal('Unauthorized');
      });
  });

  const list = (query: Record<string, unknown> = {}) => request(application)
    .get('/api/projects')
    .query(query)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer token_01_user')
    .expect(200);

  type Item = { id: number; clientId: number | null; client: Record<string, unknown> | null };

  it('should include client for projects with client and keep clientId', () => {
    return list().then((response) => {
      [1, 2].forEach((id) => {
        const p = response.body.find((x: Item) => x.id === id);
        p.clientId.should.equal(1);
        p.client.should.eql({ id: 1, name: 'EXO' });
      });
    });
  });

  it('should return client null (present) for projects without client', () => {
    return list().then((response) => {
      [3, 4].forEach((id) => {
        const p = response.body.find((x: Item) => x.id === id);
        (p.clientId === null).should.be.true();
        p.should.have.property('client', null);
      });
    });
  });

  it('should limit client to exactly id and name', () => {
    return list().then((response) => {
      response.body.forEach((p: Item) => {
        if (p.client !== null) {
          Object.keys(p.client).sort().should.eql(['id', 'name']);
        }
      });
    });
  });

  it('should paginate correctly with the client join', () => {
    return list({ limit: 1, page: 3 }).then((response) => {
      response.body.should.have.length(1);
      response.body.should.containDeep([{ id: 2, name: 'Project2', client: { id: 1, name: 'EXO' } }]);
    });
  });

  it('should sort and limit with the client join', () => {
    return list({ sort: '-priority', limit: 2 }).then((response) => {
      response.body.should.have.length(2);
      response.body[0].id.should.equal(1);
      response.body[0].client.should.eql({ id: 1, name: 'EXO' });
      response.body[1].id.should.equal(3);
      (response.body[1].client === null).should.be.true();
    });
  });

  it('should search by project name with the client join', () => {
    return list({ search: 'Project1' }).then((response) => {
      response.body.should.have.length(1);
      response.body.should.containDeep([{ id: 1, name: 'Project1', client: { id: 1, name: 'EXO' } }]);
    });
  });

  it('should not match projects when searching by client name', () => {
    return list({ search: 'EXO' }).then((response) => {
      response.body.should.have.length(0);
    });
  });

  it('should sort by name without ambiguous column errors', () => {
    return list({ sort: 'name' }).then((response) => {
      response.body.map((p: Item) => p.id).should.eql([1, 2, 3, 4]);
    });
  });

  it('should keep combined filters working with client', () => {
    return list({ type: 'comercial', state: 'activo', search: 'PROJECT', limit: 1, sort: '-priority' })
      .then((response) => {
        response.body.should.have.length(1);
        response.body.should.containDeep([{
          id: 1, code: 'code1', name: 'Project1', type: 'comercial', status: 'activo',
          client: { id: 1, name: 'EXO' },
        }]);
      });
  });
});
