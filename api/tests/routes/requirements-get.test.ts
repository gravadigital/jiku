import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import sinon from 'sinon';
import { Objective, Person, PersonRequirement, Project, Requirement, RequirementActivity, User, UserProjectPermission, WorkedTime } from '@jiku/models';

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

  // S-040: `state` acepta un CSV de uno o varios valores separados por coma. El fixture del
  // `before` de este archivo tiene id 1 y 3 en 'analisis', id 2 en 'planificacion', id 4 en
  // 'desarrollo'. Los escenarios que necesitan un estado no representado ('en_cola', 'revision',
  // 'resuelto', 'cancelado') crean su propio requisito y lo limpian en su `after`.
  describe('multi-state filter (S-040)', () => {
    it('TS-1: should return the union of two valid states', () => {
      return request(application)
        .get('/api/requirements?state=analisis,desarrollo')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(3);
          const ids = response.body.map((r: any) => r.id).sort();
          ids.should.eql([1, 3, 4]);
          response.body.forEach((req: any) => {
            (req.state === 'analisis' || req.state === 'desarrollo').should.be.true();
            req.state.should.not.equal('planificacion');
          });
        });
    });

    it('TS-2: should return the union of four valid states', () => {
      return request(application)
        .get('/api/requirements?state=analisis,planificacion,desarrollo,revision')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(4);
          const ids = response.body.map((r: any) => r.id).sort();
          ids.should.eql([1, 2, 3, 4]);
        });
    });

    it('TS-3: a single state behaves exactly as before (list)', () => {
      return request(application)
        .get('/api/requirements?state=analisis')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(2);
          const ids = response.body.map((r: any) => r.id).sort();
          ids.should.eql([1, 3]);
          response.body.forEach((req: any) => req.state.should.equal('analisis'));
        });
    });

    it('TS-4: a single state behaves exactly as before (count)', () => {
      return request(application)
        .get('/api/requirements?state=analisis&count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(2);
        });
    });

    it('TS-5: a CSV with one member outside the enum rejects the whole request', () => {
      return request(application)
        .get('/api/requirements?state=analisis,inventado')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
          response.body.message.should.match(/^Invalid field - /);
          response.body.should.not.be.an.Array();
        });
    });

    it('TS-6: an invalid member invalidates the whole parameter, does not filter by the valid ones', () => {
      return request(application)
        .get('/api/requirements?state=inventado,analisis')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    it('TS-7: a single invalid value still rejects as before', () => {
      return request(application)
        .get('/api/requirements?state=inventado')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    it('TS-8: an invalid CSV also rejects with count=true', () => {
      return request(application)
        .get('/api/requirements?state=analisis,inventado&count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
          response.body.should.not.be.a.Number();
        });
    });

    it('TS-9: a role without permission gets 403 even with a valid CSV', () => {
      return request(application)
        .get('/api/requirements?state=analisis,desarrollo')
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(403)
        .then((response) => {
          response.body.should.have.property('code', 'access_denied');
          response.body.should.have.property('message', 'Access denied');
        });
    });

    it('TS-10: a role without permission gets 403 even with an invalid CSV (403 precedes 400)', () => {
      return request(application)
        .get('/api/requirements?state=inventado,otro')
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(403)
        .then((response) => {
          response.body.should.have.property('code', 'access_denied');
        });
    });

    it('TS-11: without a token, a valid CSV still returns 401', () => {
      return request(application)
        .get('/api/requirements?state=analisis,desarrollo')
        .set('Accept', 'application/json')
        .expect(401);
    });

    it('TS-12: repeated values do not duplicate rows', () => {
      return request(application)
        .get('/api/requirements?state=analisis,analisis')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(2);
          const ids = response.body.map((r: any) => r.id).sort();
          ids.should.eql([1, 3]);
        });
    });

    it('TS-13: repeated values do not inflate the count', () => {
      return request(application)
        .get('/api/requirements?state=analisis,analisis&count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(2);
        });
    });

    it('TS-14: the count respects the multi-state filter', () => {
      return request(application)
        .get('/api/requirements?state=analisis,desarrollo&count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(3);
        });
    });

    it('TS-15: the count for the real use case (four states) matches the equivalent list length', () => {
      const query = 'state=planificacion,en_cola,desarrollo,revision';
      return Promise.all([
        request(application)
          .get(`/api/requirements?${query}&count=true`)
          .set('Authorization', 'Bearer token_01_user')
          .expect(200),
        request(application)
          .get(`/api/requirements?${query}`)
          .set('Authorization', 'Bearer token_01_user')
          .expect(200),
      ]).then(([countResponse, listResponse]) => {
        countResponse.body.should.be.a.Number();
        countResponse.body.should.equal(2);
        listResponse.body.should.be.an.Array();
        countResponse.body.should.equal(listResponse.body.length);
      });
    });

    it('TS-16: the multi-state filter combines with projectId', () => {
      return request(application)
        .get('/api/requirements?projectId=1&state=analisis,desarrollo&count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(3);
        });
    });

    it('TS-17: the multi-state filter combines with search', () => {
      return request(application)
        .get('/api/requirements?search=factura&state=analisis,desarrollo')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(2);
          const titles = response.body.map((r: any) => r.title).sort();
          titles.should.eql(['Ajuste de factura anual', 'Nueva facturación mensual']);
        });
    });

    it('TS-18: the multi-state filter combines with type', () => {
      return request(application)
        .get('/api/requirements?type=mejora&state=planificacion,desarrollo')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(2);
          const ids = response.body.map((r: any) => r.id).sort();
          ids.should.eql([2, 4]);
          response.body.forEach((req: any) => req.type.should.equal('mejora'));
        });
    });

    it('TS-19: without state the list is not filtered by state (no regression)', () => {
      return request(application)
        .get('/api/requirements')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(4);
        });
    });

    it('TS-20: without state the count is not filtered by state', () => {
      return request(application)
        .get('/api/requirements?count=true')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(4);
        });
    });

    it('TS-21: spaces around commas are tolerated', () => {
      return request(application)
        .get('/api/requirements?state=' + encodeURIComponent('analisis, desarrollo'))
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(3);
          const ids = response.body.map((r: any) => r.id).sort();
          ids.should.eql([1, 3, 4]);
        });
    });

    it('TS-22: a CSV with an empty member is rejected', () => {
      return request(application)
        .get('/api/requirements?state=' + encodeURIComponent('analisis,'))
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    it('TS-23: all seven enum states accepted together match the unfiltered count', () => {
      const allStates = 'analisis,planificacion,en_cola,desarrollo,revision,resuelto,cancelado';
      return request(application)
        .get(`/api/requirements?state=${allStates}&count=true`)
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(4);
        });
    });

    it('TS-24: a valid state with no matching requirements returns an empty list, not an error', () => {
      return request(application)
        .get('/api/requirements?state=cancelado,resuelto')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.should.have.length(0);
        });
    });
  });

  // S-044: `include=totalMinutes` es opt-in. El estado de horas se monta ACA y no en el
  // `before` global a proposito: hay tests del bloque multi-estado que esperan que el listado
  // sin filtros tenga exactamente 4 requisitos, asi que agregar requisitos nuevos arriba los
  // romperia. Estas filas cuelgan de los requisitos que ya existen (ids 1..4) y se limpian al
  // salir del describe.
  describe('include=totalMinutes', () => {
    before(function () {
      this.timeout(30000);

      return Objective.create({
        id: 100,
        title: 'Tarea del req 1',
        description: 'Desc',
        state: 'activo',
        area: 'desarrollo',
        priority: 1,
        projectId: 1,
        requirementId: 1,
        createdBy: 'zitadel-sub-01',
      })
        .then(() => Objective.create({
          id: 101,
          title: 'Tarea del req 3',
          description: 'Desc',
          state: 'activo',
          area: 'desarrollo',
          priority: 1,
          projectId: 1,
          requirementId: 3,
          createdBy: 'zitadel-sub-01',
        }))
        .then(() => Promise.all([
          WorkedTime.create({ date: new Date(), minutes: 120, projectId: 1, personId: 10, requirementId: 1 }),
          WorkedTime.create({ date: new Date(), minutes: 45, projectId: 1, personId: 10, requirementId: 2 }),
          WorkedTime.create({ date: new Date(), minutes: 60, projectId: 1, personId: 10, objectiveId: 100 }),
          WorkedTime.create({ date: new Date(), minutes: 90, projectId: 1, personId: 10, objectiveId: 101 }),
        ]));
    });

    after(() => {
      return WorkedTime.destroy({ where: {} })
        .then(() => Objective.destroy({ where: {} }));
    });

    it('TS-1: without include, the list does not carry the field (no-regression of the default)', () => {
      return request(application)
        .get('/api/requirements')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(4);
          response.body.forEach((req: any) => {
            req.should.not.have.property('totalMinutes');
          });
          const one = response.body.find((r: any) => r.id === 1);
          one.should.have.property('id');
          one.should.have.property('title');
          one.should.have.property('state');
          one.project.should.eql({ id: 1, name: 'Project1' });
          one.responsiblePeople.should.be.an.Array();
        });
    });

    it('TS-2: does not add the subqueries when include is absent', () => {
      const spy = sinon.spy(Requirement, 'findAll');
      return request(application)
        .get('/api/requirements')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then(() => {
          spy.calledOnce.should.be.true();
          spy.firstCall!.args[0]!.should.not.have.property('attributes');
        })
        .finally(() => spy.restore());
    });

    it('TS-3: with include=totalMinutes, every row carries the total', () => {
      return request(application)
        .get('/api/requirements?include=totalMinutes')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(4);
          const byId = (id: number) => response.body.find((r: any) => r.id === id);
          byId(1).totalMinutes.should.equal(180);
          byId(2).totalMinutes.should.equal(45);
          byId(3).totalMinutes.should.equal(90);
          byId(4).totalMinutes.should.equal(0);
          response.body.forEach((req: any) => {
            req.should.not.have.property('directMinutes');
            req.should.not.have.property('objectiveMinutes');
          });
        });
    });

    it('TS-4: totalMinutes sums direct and task hours', () => {
      return request(application)
        .get('/api/requirements?include=totalMinutes')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const one = response.body.find((r: any) => r.id === 1);
          one.totalMinutes.should.equal(180);
        });
    });

    it('TS-5: a requirement with no hours returns 0, not null nor absent', () => {
      return request(application)
        .get('/api/requirements?include=totalMinutes')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const four = response.body.find((r: any) => r.id === 4);
          four.should.have.property('totalMinutes');
          four.totalMinutes.should.equal(0);
          (typeof four.totalMinutes).should.equal('number');
        });
    });

    it('TS-6: totalMinutes matches GET /requirements/:reqid/worked-hours', () => {
      return Promise.all([
        request(application)
          .get('/api/requirements?include=totalMinutes')
          .set('Authorization', 'Bearer token_01_user')
          .expect(200),
        request(application)
          .get('/api/requirements/1/worked-hours')
          .set('Authorization', 'Bearer token_01_user')
          .expect(200),
      ]).then(([listado, workedHours]) => {
        const fromList = listado.body.find((r: any) => r.id === 1).totalMinutes;
        fromList.should.equal(workedHours.body.totalMinutes);
        fromList.should.equal(180);
      });
    });

    it('TS-7: include with a name outside the whitelist returns 400', () => {
      return request(application)
        .get('/api/requirements?include=byPerson')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
          response.body.message.should.match(/^Invalid field - /);
        });
    });

    it('TS-8: an invalid member invalidates the whole parameter (no partial include)', () => {
      return request(application)
        .get('/api/requirements?include=totalMinutes,byPerson')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
          response.body.should.not.be.an.Array();
        });
    });

    it('TS-9: an empty include returns 400', () => {
      return request(application)
        .get('/api/requirements?include=')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    it('TS-10: a CSV with an empty member returns 400', () => {
      return request(application)
        .get('/api/requirements?include=' + encodeURIComponent('totalMinutes,'))
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    it('TS-11: spaces around the comma are tolerated', () => {
      return request(application)
        .get('/api/requirements?include=' + encodeURIComponent(' totalMinutes '))
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(4);
          response.body.forEach((req: any) => req.should.have.property('totalMinutes'));
        });
    });

    it('TS-12: totalMinutes repeated in the CSV is valid', () => {
      return request(application)
        .get('/api/requirements?include=totalMinutes,totalMinutes')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(4);
          const one = response.body.find((r: any) => r.id === 1);
          one.totalMinutes.should.equal(180);
        });
    });

    it('TS-13: count=true&include=totalMinutes returns the usual integer', () => {
      return request(application)
        .get('/api/requirements?count=true&include=totalMinutes')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(4);
        });
    });

    it('TS-14: count=true&include=totalMinutes does not drag the subqueries into COUNT', () => {
      const spy = sinon.spy(Requirement, 'count');
      return request(application)
        .get('/api/requirements?count=true&include=totalMinutes')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.equal(4);
          spy.calledOnce.should.be.true();
          spy.firstCall!.args[0]!.should.not.have.property('attributes');
        })
        .finally(() => spy.restore());
    });

    it('TS-15: count=true&include=totalMinutes respects filters as always', () => {
      return request(application)
        .get('/api/requirements?count=true&include=totalMinutes&state=analisis')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.a.Number();
          response.body.should.equal(2);
        });
    });

    it('TS-16: count=false with include returns the list with the field', () => {
      return request(application)
        .get('/api/requirements?count=false&include=totalMinutes')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(4);
          response.body.forEach((req: any) => req.should.have.property('totalMinutes'));
        });
    });

    it('TS-17: without a token, include changes nothing', () => {
      return request(application)
        .get('/api/requirements?include=totalMinutes')
        .set('Accept', 'application/json')
        .expect(401);
    });

    it('TS-18: external-user still gets 403 with include', () => {
      return request(application)
        .get('/api/requirements?include=totalMinutes')
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(403)
        .then((response) => {
          response.body.should.have.property('code', 'access_denied');
          response.body.should.not.have.property('totalMinutes');
          response.body.should.not.be.an.Array();
        });
    });

    it('TS-19: admin gets the field just like user', () => {
      return request(application)
        .get('/api/requirements?include=totalMinutes')
        .set('Authorization', 'Bearer token_03_admin')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(4);
          const one = response.body.find((r: any) => r.id === 1);
          one.totalMinutes.should.equal(180);
        });
    });

    it('TS-20: include does not enable filtering by totalMinutes', () => {
      return request(application)
        .get('/api/requirements?include=totalMinutes&totalMinutes=180')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    it('TS-21: include does not enable sorting by totalMinutes', () => {
      return Promise.all([
        request(application)
          .get('/api/requirements?include=totalMinutes&sort=totalMinutes')
          .set('Authorization', 'Bearer token_01_user')
          .expect(200),
        request(application)
          .get('/api/requirements?include=totalMinutes')
          .set('Authorization', 'Bearer token_01_user')
          .expect(200),
      ]).then(([withSort, withoutSort]) => {
        const idsWithSort = withSort.body.map((r: any) => r.id);
        const idsWithoutSort = withoutSort.body.map((r: any) => r.id);
        idsWithSort.should.eql(idsWithoutSort);
      });
    });

    describe('opus portal (CA-7)', () => {
      before(() => {
        return UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: 1 });
      });

      after(() => {
        return UserProjectPermission.destroy({ where: {} });
      });

      it('TS-22: the external portal does not expose totalMinutes in its list', () => {
        return request(application)
          .get('/api/opus/projects/1/requirements')
          .set('Authorization', 'Bearer token_04_external_user')
          .expect(200)
          .then((response) => {
            response.body.should.be.an.Array();
            response.body.length.should.be.above(0);
            response.body.forEach((req: any) => {
              req.should.not.have.property('totalMinutes');
            });
          });
      });

      it('TS-23: the external portal does not expose totalMinutes even if requested', () => {
        return request(application)
          .get('/api/opus/projects/1/requirements?include=totalMinutes')
          .set('Authorization', 'Bearer token_04_external_user')
          .then((response) => {
            response.body.should.be.an.Array();
            response.body.forEach((req: any) => {
              req.should.not.have.property('totalMinutes');
            });
          });
      });
    });

    it('TS-24: include combines with the list filters', () => {
      return request(application)
        .get('/api/requirements?include=totalMinutes&state=analisis')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(2);
          const ids = response.body.map((r: any) => r.id).sort();
          ids.should.eql([1, 3]);
          const byId = (id: number) => response.body.find((r: any) => r.id === id);
          byId(1).totalMinutes.should.equal(180);
          byId(3).totalMinutes.should.equal(90);
        });
    });

    it('TS-25: include combines with pagination and only pays for the page', () => {
      return request(application)
        .get('/api/requirements?include=totalMinutes&page=1&limit=2')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.length.should.equal(2);
          response.body.forEach((req: any) => {
            req.should.have.property('totalMinutes');
            (typeof req.totalMinutes).should.equal('number');
          });
        });
    });

    it('TS-26: a database error with include comes out as a generic 500', () => {
      const stub = sinon.stub(Requirement, 'findAll').rejects(new Error('db down'));

      return request(application)
        .get('/api/requirements?include=totalMinutes')
        .set('Authorization', 'Bearer token_01_user')
        .expect(500)
        .then((response) => {
          response.body.should.have.property('code', 'internal_error');
          response.body.should.have.property('message', 'Internal error');
          JSON.stringify(response.body).should.not.containEql('db down');
        })
        .finally(() => stub.restore());
    });

    it('TS-27: the rest of the body does not change when requesting include', () => {
      return request(application)
        .get('/api/requirements?include=totalMinutes&projectId=1')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.be.an.Array();
          response.body.forEach((req: any) => {
            req.project.should.eql({ id: 1, name: 'Project1' });
            req.should.have.property('responsiblePeople');
          });
          const one = response.body.find((r: any) => r.id === 1);
          one.responsiblePeople.should.have.length(1);
          one.responsiblePeople[0].should.eql({ id: 10, firstName: 'Ana', lastName: 'Gómez', isLeader: true });
        });
    });
  });
});
