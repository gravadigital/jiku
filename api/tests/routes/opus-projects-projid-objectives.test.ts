import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { IdentityType, Project, Requirement, User, UserProjectPermission } from '@jiku/models';

describe('GET /opus/projects/:projid/requirements', () => {
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
        name: 'Project 2',
        type: 'comercial',
        status: 'activo',
        initDate: new Date(),
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: 1,
        title: 'Requirement 1',
        description: 'req 1',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'analisis',
        estimatedFinishDate: '2026-12-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: 2,
        title: 'Requirement 2',
        description: 'req 2',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'planificacion',
        estimatedFinishDate: '2026-12-01',
        projectId: 2,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: 3,
        title: 'Requirement 3',
        description: 'req 3',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'analisis',
        estimatedFinishDate: '2026-12-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: 4,
        title: 'Requirement 4',
        description: 'req 4',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'resuelto',
        estimatedFinishDate: '2026-12-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => UserProjectPermission.create({
        userId: 'zitadel-sub-04',
        projectId: 2
      }))
      // S-019: la identidad automatica. La siembra del REQUISITO que crea vive en el describe
      // de mas abajo, no aca: el test preexistente "should return priority and creator for each
      // requirement" afirma que TODO item del proyecto 1 tiene `creator.name === 'User 01'`, y
      // meter el requisito del conector en el `before` del archivo lo romperia.
      .then(() => User.create({
        id: 'zitadel-sub-svc',
        name: 'Conector Portal',
        username: 'conector-portal',
        email: 'conector@portal.test',
        identityType: IdentityType.Service,
      }));
  });

  after(() => {
    return Requirement.destroy({ where: {} })
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  it('should return 200 if project exists and requirements are found', () => {
    return request(application)
      .get('/api/opus/projects/1/requirements?state=analisis&limit=10&skip=0')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expected = [
          { id: 1, title: 'Requirement 1', description: 'req 1', state: 'analisis' },
          { id: 3, title: 'Requirement 3', description: 'req 3', state: 'analisis' },
        ];
        response.body.should.containDeep(expected);
      });
  });

  it('should return priority and creator for each requirement', () => {
    return request(application)
      .get('/api/opus/projects/1/requirements')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.greaterThan(0);
        response.body.forEach((req: any) => {
          req.should.have.property('priority');
          req.should.have.property('creator');
          req.creator.should.have.property('id', 'zitadel-sub-01');
          req.creator.should.have.property('name', 'User 01');
          req.creator.should.have.property('email', 'user01@mail.com');
        });
      });
  });

  it('should return priority and creator when filtering by state', () => {
    return request(application)
      .get('/api/opus/projects/1/requirements?state[]=analisis')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.greaterThan(0);
        response.body.forEach((req: any) => {
          req.state.should.equal('analisis');
          req.should.have.property('priority');
          req.should.have.property('creator');
        });
      });
  });

  it('should return 200 if requirements sorted by title', () => {
    return request(application)
      .get('/api/opus/projects/1/requirements?sort=title')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expected = [
          { id: 1, title: 'Requirement 1', state: 'analisis' },
          { id: 3, title: 'Requirement 3', state: 'analisis' },
          { id: 4, title: 'Requirement 4', state: 'resuelto' },
        ];
        response.body.should.containDeep(expected);
      });
  });

  it('should return 200 and only project 2 requirements', () => {
    return request(application)
      .get('/api/opus/projects/2/requirements')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expected = [{ id: 2, title: 'Requirement 2', state: 'planificacion' }];
        response.body.should.containDeep(expected);
      });
  });

  it('should return 404 if project not found', () => {
    return request(application)
      .get('/api/opus/projects/9999/requirements?state=analisis&limit=10&skip=0')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('project_not_found');
        response.body.message.should.equal('Project not found');
      });
  });

  // S-019 CA-6: el `creator` de CADA requisito del listado que alimenta `tablero-requisitos`
  // trae exactamente las cuatro claves de autoria. Recorre todos los items y no solo el
  // primero: un `include` sin acotar filtraria los roles de cada creador en una sola respuesta.
  it('S-019 TS-12: should return every requirement creator with the four author keys', () => {
    return request(application)
      .get('/api/opus/projects/1/requirements')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.above(0);
        response.body.forEach((requirement: { creator: Record<string, unknown> }) => {
          Object.keys(requirement.creator).should.have.length(4);
          requirement.creator.should.have.property('id');
          requirement.creator.should.have.property('name');
          requirement.creator.should.have.property('email');
          requirement.creator.should.have.property('identityType', 'person');
        });
      });
  });

  /**
   * S-019 TS-14: la misma garantia, pero pedida por un `external-user` de verdad.
   *
   * Va sobre el proyecto 2 y no sobre el 1 porque `zitadel-sub-04` tiene permiso sobre el 2:
   * darle permiso sobre el 1 romperia el test de 403 de este mismo archivo. Lo que importa del
   * escenario es la SUPERFICIE (la menos confiable), no el numero de proyecto.
   */
  it('S-019 TS-14: should not leak roles to an external-user', () => {
    return request(application)
      .get('/api/opus/projects/2/requirements')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        response.body.length.should.be.above(0);
        response.body.forEach((requirement: { creator: Record<string, unknown> }) => {
          Object.keys(requirement.creator).should.not.containEql('roles');
          Object.keys(requirement.creator).should.not.containEql('username');
          Object.keys(requirement.creator).should.have.length(4);
        });
      });
  });

  it('should return 403 if the external-user does not have permission to access the project', () => {
    return request(application)
      .get('/api/opus/projects/1/requirements?state=analisis&limit=10&skip=0')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
        response.body.message.should.equal('Access denied for this project.');
      });
  });

  /**
   * S-019 CA-6 + CA-11: un requisito creado por el conector se marca y conserva el nombre.
   *
   * Fixture propia, y con PROYECTO propio (el 3), no con el 1. Los dos motivos:
   *   - el `before` del archivo no puede tenerla: el test preexistente "should return priority
   *     and creator for each requirement" afirma que TODO item del proyecto 1 tiene
   *     `creator.name === 'User 01'`;
   *   - un proyecto aparte hace que este describe no dependa del orden en que Mocha corre los
   *     suites del archivo (`testing`: "un test no depende del estado que dejo otro").
   */
  describe('S-019: el requisito creado por una identidad automatica', () => {
    const serviceProjectId = 3;
    const serviceRequirementId = 5;

    before(() => {
      return Project.create({
        id: serviceProjectId,
        name: 'Project 3 - alta automatica',
        type: 'comercial',
        status: 'activo',
        initDate: new Date(),
        createdBy: 'zitadel-sub-01',
      })
        .then(() => Requirement.create({
          id: serviceRequirementId,
          title: 'Requirement del conector',
          description: 'Alta automatica',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'analisis',
          estimatedFinishDate: '2026-12-01',
          projectId: serviceProjectId,
          tags: null,
          createdBy: 'zitadel-sub-svc',
        }));
    });

    after(() => {
      return Requirement.destroy({ where: { id: serviceRequirementId } })
        .then(() => Project.destroy({ where: { id: serviceProjectId } }));
    });

    it('S-019 TS-13: should mark the service creator and keep its name', () => {
      return request(application)
        .get(`/api/opus/projects/${serviceProjectId}/requirements`)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const serviceRequirement = response.body
            .find((requirement: any) => requirement.id === serviceRequirementId);
          serviceRequirement.creator.identityType.should.equal('service');
          serviceRequirement.creator.name.should.equal('Conector Portal');
        });
    });
  });
});
