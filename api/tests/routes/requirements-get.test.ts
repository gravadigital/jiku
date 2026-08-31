import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import sinon from 'sinon';
import { Person, PersonRequirement, Project, Requirement, RequirementActivity, User } from '@jiku/models';

describe('GET /api/requirements', () => {
  let application: Application;

  before(function () {
    this.timeout(30000);
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'User 04', username: 'user04', email: 'user04@mail.com' }))
      .then(() => Project.create({ id: 1, name: 'Project1', code: 'P1', type: 'comercial', status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-01' }))
      .then(() => Person.create({ id: 10, firstName: 'Ana', lastName: 'Gómez', enabled: true, initDate: new Date() }))
      .then(() => Promise.all([
        Requirement.create({
          id: 1,
          title: 'Requisito analisis',
          description: 'Descripcion 1',
          type: 'funcionalidad',
          priority: 'alta',
          state: 'analisis',
          estimatedFinishDate: '2026-06-01',
          projectId: 1,
          tags: [{ key: 'tipo', value: 'bug' }],
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 2,
          title: 'Requisito planificacion',
          description: 'Descripcion 2',
          type: 'mejora',
          priority: 'media',
          state: 'planificacion',
          estimatedFinishDate: '2026-07-01',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 3,
          title: 'Nueva facturación mensual',
          description: 'Descripcion 3',
          type: 'funcionalidad',
          priority: 'media',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 4,
          title: 'Ajuste de factura anual',
          description: 'Descripcion 4',
          type: 'mejora',
          priority: 'media',
          state: 'desarrollo',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
      ]))
      .then(() => PersonRequirement.create({ personId: 10, requirementId: 1, isLeader: true }));
  });

  after(() => {
    return RequirementActivity.destroy({ where: {} })
      .then(() => PersonRequirement.destroy({ where: {} }))
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Person.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  it('should return 401 if no token is provided', () => {
    return request(application)
      .get('/api/requirements')
      .set('Accept', 'application/json')
      .expect(401);
  });

  it('should return 403 for external-user role', () => {
    return request(application)
      .get('/api/requirements')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403);
  });

  it('should return all requirements for internal user', () => {
    return request(application)
      .get('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.aboveOrEqual(2);
      });
  });

  // TS-18: retorna project como objeto singular
  it('TS-18: should return project as singular object (not array)', () => {
    return request(application)
      .get('/api/requirements?projectId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.aboveOrEqual(1);
        response.body.forEach((req: any) => {
          req.projectId.should.equal(1);
          req.project.should.be.an.Object();
          req.project.id.should.equal(1);
          req.project.name.should.equal('Project1');
          req.should.not.have.property('projects');
        });
      });
  });

  // TS-16: filtra por estado del nuevo enum
  it('TS-16: should filter requirements by new enum state analisis', () => {
    return request(application)
      .get('/api/requirements?state=analisis')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.aboveOrEqual(1);
        response.body.forEach((req: any) => {
          req.state.should.equal('analisis');
        });
      });
  });

  // TS-17: valor de enum viejo retorna 400
  it('TS-17: should return 400 when filtering by old enum value en_espera', () => {
    return request(application)
      .get('/api/requirements?state=en_espera')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-13: responsables en GET listado
  it('TS-13: should include responsiblePeople in each item of the listing', () => {
    return request(application)
      .get('/api/requirements?projectId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.aboveOrEqual(2);
        response.body.forEach((req: any) => {
          req.should.have.property('responsiblePeople');
          req.responsiblePeople.should.be.an.Array();
        });
        const withPerson = response.body.find((r: any) => r.id === 1);
        withPerson.responsiblePeople.should.have.length(1);
        withPerson.responsiblePeople[0].id.should.equal(10);
        withPerson.responsiblePeople[0].isLeader.should.equal(true);
        const withoutPerson = response.body.find((r: any) => r.id === 2);
        withoutPerson.responsiblePeople.should.have.length(0);
      });
  });

  // TS-1 (S-066): busqueda por titulo con coincidencia parcial
  it('TS-1: should filter requirements by partial title match with search', () => {
    return request(application)
      .get('/api/requirements?search=facturación')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.equal(1);
        response.body[0].title.should.equal('Nueva facturación mensual');
      });
  });

  // TS-2 (S-066): busqueda sin coincidencias
  it('TS-2: should return an empty array when search has no matches', () => {
    return request(application)
      .get('/api/requirements?search=inexistente123')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.should.have.length(0);
      });
  });

  // TS-3 (S-066): busqueda combinada con projectId
  it('TS-3: should combine search with projectId filter', () => {
    return request(application)
      .get('/api/requirements?search=factura&projectId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.equal(2);
        response.body.forEach((req: any) => {
          req.projectId.should.equal(1);
          req.title.toLowerCase().should.containEql('factura');
        });
      });
  });

  // TS-4 (S-066): busqueda combinada con state
  it('TS-4: should combine search with state filter', () => {
    return request(application)
      .get('/api/requirements?search=factura&state=analisis')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.equal(1);
        response.body[0].title.should.equal('Nueva facturación mensual');
        response.body[0].state.should.equal('analisis');
      });
  });

  // TS-19 (S-085/TS-6): filtro type rechaza sin_tipo
  it('TS-19: should return 400 when filtering by type sin_tipo', () => {
    return request(application)
      .get('/api/requirements?type=sin_tipo')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-20 (S-085/TS-7): filtro type sigue aceptando valores validos
  it('TS-20: should filter requirements by valid type value', () => {
    return request(application)
      .get('/api/requirements?type=funcionalidad')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.aboveOrEqual(1);
        response.body.forEach((req: any) => {
          req.type.should.equal('funcionalidad');
        });
      });
  });

  /**
   * S-019 CA-15: `listado-requisitos` NO tiene columna de autor.
   *
   * Es la pantalla que el diseño tecnico nombro y que se cayo al verificarla: la tabla no tiene
   * donde poner la marca, y `requirements-get.ts` no tiene `include` de `creator`. No se le
   * agrega. Si este test empieza a fallar, alguien sumo el `include` por simetria con el
   * detalle: el criterio dice que no.
   *
   * La asercion es sobre `Object.keys(...)` y no sobre `req.creator === undefined`: lo segundo
   * pasa igual si la clave existe con valor `undefined`.
   */
  it('S-019 TS-23: should not expose creator in the requirements list', () => {
    return request(application)
      .get('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.above(0);
        response.body.forEach((req: Record<string, unknown>) => {
          Object.keys(req).should.not.containEql('creator');
        });
      });
  });

  describe('count', () => {
    // TS-1: fixture tiene 4 requisitos del proyecto 1 (ids 1 y 3 en analisis, 2 en
    // planificacion, 4 en desarrollo)
    it('TS-1: should return the total count with count=true', () => {
      return request(application)
        .get('/api/requirements?count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(4);
        });
    });

    it('TS-2: should return the count filtered by state', () => {
      return request(application)
        .get('/api/requirements?state=analisis&count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(2);
        });
    });

    // TS-3: el caso de uso real de S-038 (7 totales por estado dentro de un proyecto)
    it('TS-3: should return the count filtered by projectId and state', () => {
      return request(application)
        .get('/api/requirements?projectId=1&state=desarrollo&count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(1);
        });
    });

    it('TS-4: should return the count filtered by search (ILIKE on title)', () => {
      return request(application)
        .get('/api/requirements?search=factura&count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(2);
        });
    });

    it('TS-5: should return the count filtered by tag (jsonb contains)', () => {
      return request(application)
        .get('/api/requirements?tag=tipo:bug&count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(1);
        });
    });

    it('TS-6: should return the array as before when count is not provided', () => {
      return request(application)
        .get('/api/requirements')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(4);
          response.body.forEach((req: any) => {
            req.should.have.property('id');
            req.should.have.property('title');
            req.should.have.property('state');
            req.should.have.property('project');
            req.should.have.property('responsiblePeople');
          });
        });
    });

    /**
     * TS-7: `count=false` tiene que devolver el LISTADO.
     *
     * Es el test que atrapa el `if (!count)` copiado de objectives: en req.query el valor llega
     * como el string 'false', que es truthy, asi que esa comparacion devolveria el conteo a
     * quien pidio el listado. Si este test empieza a fallar con un numero en el body, alguien
     * cambio la comparacion contra 'true' por una evaluacion de verdad.
     */
    it('TS-7: should return the list (not the count) when count=false', () => {
      return request(application)
        .get('/api/requirements?count=false')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(4);
        });
    });

    it('TS-8: should keep filtering the list when count is not provided', () => {
      return request(application)
        .get('/api/requirements?state=analisis')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(2);
          response.body.forEach((req: any) => {
            req.state.should.equal('analisis');
          });
        });
    });

    /**
     * TS-9: el conteo ignora `page` y `limit` — devuelve el total filtrado, no el tamaño de la
     * pagina. Si este test empieza a devolver 1, alguien colo page/limit dentro del count().
     */
    it('TS-9: should ignore page and limit when counting', () => {
      return request(application)
        .get('/api/requirements?count=true&page=2&limit=1')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(4);
        });
    });

    it('TS-10: should return 400 when count is not a boolean value', () => {
      return request(application)
        .get('/api/requirements?count=quizas')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
          response.body.message.should.match(/^Invalid field - /);
        });
    });

    it('TS-11: should return 400 when limit is below the minimum (0)', () => {
      return request(application)
        .get('/api/requirements?limit=0')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    it('TS-12: should return 400 when limit is above the maximum (101)', () => {
      return request(application)
        .get('/api/requirements?limit=101')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    it('TS-13: should return 401 when no token is provided, even with count=true', () => {
      return request(application)
        .get('/api/requirements?count=true')
        .set('Accept', 'application/json')
        .expect(401);
    });

    it('TS-14: should return 401 when no token is provided, without count (regression)', () => {
      return request(application)
        .get('/api/requirements')
        .set('Accept', 'application/json')
        .expect(401);
    });

    it('TS-15: should return 403 for external-user role with count=true, without a number in the body', () => {
      return request(application)
        .get('/api/requirements?count=true')
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(403)
        .then((response) => {
          response.body.should.have.property('code', 'access_denied');
        });
    });

    it('TS-16: should return 403 for external-user role without count (regression)', () => {
      return request(application)
        .get('/api/requirements')
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(403);
    });

    it('TS-17: should return 500 when the count query fails', () => {
      const stub = sinon.stub(Requirement, 'count').rejects(new Error('db down'));

      return request(application)
        .get('/api/requirements?count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(500)
        .then((response) => {
          response.body.should.have.property('code', 'internal_error');
          response.body.should.have.property('message', 'Internal error');
          JSON.stringify(response.body).should.not.containEql('db down');
        })
        .finally(() => stub.restore());
    });

    it('TS-18: should return 0 (not null nor empty array) when the filter matches nothing', () => {
      return request(application)
        .get('/api/requirements?projectId=1&state=resuelto&count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(0);
        });
    });
  });
});
