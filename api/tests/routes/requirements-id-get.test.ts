import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { IdentityType, Objective, Person, PersonObjective, PersonRequirement, Project, Requirement, RequirementActivity, User } from '@jiku/models';

describe('GET /api/requirements/:reqid', () => {
  let application: Application;

  before(function () {
    this.timeout(30000);
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' })
      .then(() => Project.create({ id: 1, name: 'Project1', code: 'P1', type: 'comercial', status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-01' }))
      .then(() => Person.create({ id: 10, firstName: 'Ana', lastName: 'Gómez', enabled: true, initDate: new Date() }))
      .then(() => Person.create({ id: 11, firstName: 'Beto', lastName: 'Lopez', enabled: true, initDate: new Date() }))
      .then(() => Requirement.create({
        id: 1,
        title: 'Requisito con actividad',
        description: 'Descripcion',
        type: 'funcionalidad',
        priority: 'alta',
        state: 'planificacion',
        estimatedFinishDate: '2026-06-01',
        projectId: 1,
        scheduledAt: new Date('2026-05-01T10:00:00Z'),
        tags: null,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: 2,
        title: 'Requisito sin responsable',
        description: 'Sin responsable',
        type: 'mejora',
        state: 'analisis',
        estimatedFinishDate: '2026-06-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: 3,
        title: 'Requisito sin tipo',
        description: 'Sin tipo',
        type: null,
        state: 'analisis',
        estimatedFinishDate: '2026-06-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Promise.all([
        PersonRequirement.create({ personId: 10, requirementId: 1, isLeader: true }),
        PersonRequirement.create({ personId: 11, requirementId: 1, isLeader: false }),
      ]))
      .then(() => RequirementActivity.create({
        typeOfActivity: 'state',
        previousValue: 'analisis',
        newValue: 'planificacion',
        visibilityLevel: 'public',
        requirementId: 1,
        changedBy: 'zitadel-sub-01',
      }))
      // S-019: la identidad automatica. El `name` 'Conector Portal' es el ejemplo de la story:
      // es el nombre que un avatar de iniciales convierte en "CP" y hace pasar por persona.
      .then(() => User.create({
        id: 'zitadel-sub-svc',
        name: 'Conector Portal',
        username: 'conector-portal',
        email: 'conector@portal.test',
        identityType: IdentityType.Service,
      }))
      .then(() => Requirement.create({
        id: 4,
        title: 'Requisito creado por el conector',
        description: 'Alta automatica',
        type: 'funcionalidad',
        priority: 'media',
        state: 'analisis',
        estimatedFinishDate: '2026-06-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-svc',
      }))
      // Va sobre el requisito 1 y con `typeOfActivity: 'comment'` a proposito: la actividad
      // 'state' que siembra este mismo `before` la busca un test preexistente con
      // `find(a => a.typeOfActivity === 'state')`, y una segunda 'state' lo volveria ambiguo.
      .then(() => RequirementActivity.create({
        typeOfActivity: 'comment',
        previousValue: '',
        newValue: 'Sincronizado desde el portal',
        visibilityLevel: 'public',
        requirementId: 1,
        changedBy: 'zitadel-sub-svc',
      }));
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
      .get('/api/requirements/1')
      .expect(401);
  });

  it('should return 404 when requirement does not exist', () => {
    return request(application)
      .get('/api/requirements/9999')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('requirement_not_found');
      });
  });

  // TS-19: incluye timestamps en response
  it('TS-19: should return requirement detail with timestamps and project object', () => {
    return request(application)
      .get('/api/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.id.should.equal(1);
        response.body.title.should.equal('Requisito con actividad');
        response.body.project.should.be.an.Object();
        response.body.project.id.should.equal(1);
        response.body.should.not.have.property('projects');
        response.body.should.have.property('scheduledAt');
        response.body.should.have.property('inProgressAt');
        response.body.should.have.property('inReviewAt');
        response.body.should.have.property('finishedAt');
        (response.body.scheduledAt !== null).should.be.true();
        response.body.should.have.property('activity');
        response.body.activity.should.be.an.Array();
        response.body.activity.length.should.be.aboveOrEqual(1);
      });
  });

  // TS-1: multiples responsables en GET detalle
  it('TS-1: should include responsiblePeople array with isLeader in requirement detail', () => {
    return request(application)
      .get('/api/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.not.have.property('responsiblePerson');
        response.body.responsiblePeople.should.be.an.Array();
        response.body.responsiblePeople.should.have.length(2);
        response.body.responsiblePeople.should.containDeep([
          { id: 10, firstName: 'Ana', lastName: 'Gómez', isLeader: true },
          { id: 11, firstName: 'Beto', lastName: 'Lopez', isLeader: false },
        ]);
      });
  });

  it('should return responsiblePeople as empty array when no responsibles assigned', () => {
    return request(application)
      .get('/api/requirements/2')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.responsiblePeople.should.be.an.Array();
        response.body.responsiblePeople.should.have.length(0);
      });
  });

  // TS-8: changedByUser expandido en requirementActivity
  it('TS-8: should include changedByUser expanded in activity entries', () => {
    return request(application)
      .get('/api/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.activity.should.be.an.Array();
        const stateActivity = response.body.activity.find((a: any) => a.typeOfActivity === 'state');
        stateActivity.changedBy.should.equal('zitadel-sub-01');
        stateActivity.changedByUser.should.be.an.Object();
        stateActivity.changedByUser.id.should.equal('zitadel-sub-01');
        stateActivity.changedByUser.name.should.equal('User 01');
        stateActivity.changedByUser.email.should.equal('user01@mail.com');
      });
  });

  // TS-10 (S-062): creator expandido
  it('TS-10: should include creator expanded alongside createdBy', () => {
    return request(application)
      .get('/api/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.createdBy.should.equal('zitadel-sub-01');
        response.body.creator.should.be.an.Object();
        response.body.creator.id.should.equal('zitadel-sub-01');
        response.body.creator.name.should.equal('User 01');
        response.body.creator.email.should.equal('user01@mail.com');
      });
  });

  describe('linkedObjectives (S-062)', () => {
    before(() => {
      return Promise.all([
        Objective.create({
          id: 20,
          title: 'Objetivo vinculado 1',
          state: 'backlog',
          area: 'desarrollo',
          priority: 1,
          projectId: 1,
          requirementId: 1,
          createdBy: 'zitadel-sub-01',
        }),
        Objective.create({
          id: 21,
          title: 'Objetivo vinculado 2',
          state: 'backlog',
          area: 'desarrollo',
          priority: 1,
          projectId: 1,
          requirementId: 1,
          createdBy: 'zitadel-sub-01',
        }),
      ])
        .then(() => PersonObjective.create({ personId: 10, objectiveId: 20, isLeader: true }));
    });

    after(() => {
      return PersonObjective.destroy({ where: { objectiveId: [20, 21] } })
        .then(() => Objective.destroy({ where: { id: [20, 21] } }));
    });

    // TS-5 (S-066): responsables visibles en objetivos vinculados
    it('TS-5: should include persons with isLeader in each linked objective', () => {
      return request(application)
        .get('/api/requirements/1')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const objective20 = response.body.linkedObjectives.find((o: any) => o.id === 20);
          objective20.persons.should.be.an.Array();
          objective20.persons.should.have.length(1);
          objective20.persons[0].id.should.equal(10);
          objective20.persons[0].firstName.should.equal('Ana');
          objective20.persons[0].PersonObjective.isLeader.should.equal(true);
        });
    });

    // TS-6 (S-066): objetivo vinculado sin responsables
    it('TS-6: should return an empty persons array for a linked objective without responsibles', () => {
      return request(application)
        .get('/api/requirements/1')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const objective21 = response.body.linkedObjectives.find((o: any) => o.id === 21);
          objective21.persons.should.be.an.Array();
          objective21.persons.should.have.length(0);
        });
    });

    // TS-11: linkedObjectives con objetivos vinculados
    it('TS-11: should include linkedObjectives with objectives pointing to this requirement', () => {
      return request(application)
        .get('/api/requirements/1')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.linkedObjectives.should.be.an.Array();
          response.body.linkedObjectives.should.have.length(2);
          const ids = response.body.linkedObjectives.map((o: any) => o.id);
          ids.should.containDeep([20, 21]);
        });
    });

    // TS-12: linkedObjectives vacio sin vinculos
    it('TS-12: should return linkedObjectives as empty array when no objectives are linked', () => {
      return request(application)
        .get('/api/requirements/2')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.linkedObjectives.should.be.an.Array();
          response.body.linkedObjectives.should.have.length(0);
        });
    });
  });

  /**
   * S-019: `identityType` en los payloads de autoria de `detalle-requisito` de `web`.
   *
   * Son DOS puntos, y el inventario de la story solo nombraba uno: el `creator` del requisito
   * (`requirements-id-get.ts:14`) y el `changedByUser` de cada entrada del feed (linea 24).
   * CA-3 pide la marca en los dos lugares.
   */
  describe('S-019: identityType en creator y en el autor de cada actividad', () => {
    // La asercion es sobre las CLAVES PRESENTES y no sobre la ausencia de `roles`: un
    // `should.not.have.property('roles')` pasaria igual el dia que se agregue otra columna al
    // modelo. Es el patron que dejo S-015 CA-12.
    it('S-019 TS-1: should return creator with exactly id, name, email and identityType', () => {
      return request(application)
        .get('/api/requirements/1')
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
        });
    });

    // CA-11: la marca ACOMPAÑA al nombre, no lo reemplaza. Ocultar o filtrar al autor de
    // servicio contradiria REQ-001 ("el publicador externo es el autor") y dejaria al
    // requisito sin autor visible.
    it('S-019 TS-2: should mark a service creator and keep its name', () => {
      return request(application)
        .get('/api/requirements/4')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.creator.identityType.should.equal('service');
          response.body.creator.name.should.equal('Conector Portal');
        });
    });

    it('S-019 TS-3: should return every activity author with exactly the four keys', () => {
      return request(application)
        .get('/api/requirements/1')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.activity.should.be.an.Array();
          response.body.activity.length.should.be.above(0);
          response.body.activity.forEach((entry: { changedByUser: Record<string, unknown> }) => {
            Object.keys(entry.changedByUser).should.have.length(4);
            entry.changedByUser.should.have.property('id');
            entry.changedByUser.should.have.property('name');
            entry.changedByUser.should.have.property('email');
            entry.changedByUser.should.have.property('identityType');
          });
          const serviceEntry = response.body.activity
            .find((entry: any) => entry.changedBy === 'zitadel-sub-svc');
          serviceEntry.changedByUser.identityType.should.equal('service');
          serviceEntry.changedByUser.name.should.equal('Conector Portal');
        });
    });

    // `roles` es el campo que NO puede salir: exponer el modelo de roles del producto en una
    // respuesta HTTP seria filtrar informacion de autorizacion (D-12 de REQ-005). La unica
    // barrera es el `attributes` acotado del `include`.
    it('S-019 TS-4: should not leak roles nor username in any author object', () => {
      return request(application)
        .get('/api/requirements/1')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          Object.keys(response.body.creator).should.not.containEql('roles');
          Object.keys(response.body.creator).should.not.containEql('username');
          response.body.activity.forEach((entry: { changedByUser: Record<string, unknown> }) => {
            Object.keys(entry.changedByUser).should.not.containEql('roles');
            Object.keys(entry.changedByUser).should.not.containEql('username');
          });
        });
    });
  });

  // TS-13 (S-085/TS-12): detalle devuelve type null correctamente
  it('TS-13: should return type null in requirement detail when the requirement has no type', () => {
    return request(application)
      .get('/api/requirements/3')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        (response.body.type === null).should.be.true();
      });
  });
});
