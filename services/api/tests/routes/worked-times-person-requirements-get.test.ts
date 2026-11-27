import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Person, PersonRequirement, Project, Requirement, User } from '@jiku/models';

describe('GET /api/worked-times/person-requirements', () => {
  let application: Application;

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

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
        id: 'zitadel-sub-03',
        name: 'Admin 01',
        username: 'admin01',
        email: 'admin01@mail.com'
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
          Person.create({
            id: 1,
            firstName: 'Juan',
            lastName: 'Pérez',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-01'
          }),
          Person.create({
            id: 2,
            firstName: 'Sin',
            lastName: 'Requisitos',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01')
          }),
          Project.create({
            id: 1,
            code: 'ALPHA',
            name: 'Proyecto Alpha',
            type: 'comercial',
            status: 'activo',
            priority: 5,
            initDate: new Date(),
            createdBy: 'zitadel-sub-01'
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          Requirement.create({
            id: 1,
            title: 'Req Analisis',
            description: 'Desc',
            priority: 'sin_prioridad',
            state: 'analisis',
            projectId: 1,
            tags: null,
            createdBy: 'zitadel-sub-01'
          }),
          Requirement.create({
            id: 2,
            title: 'Req Cancelado',
            description: 'Desc',
            priority: 'sin_prioridad',
            state: 'cancelado',
            projectId: 1,
            tags: null,
            createdBy: 'zitadel-sub-01'
          }),
          Requirement.create({
            id: 3,
            title: 'Req Resuelto Reciente',
            description: 'Desc',
            priority: 'sin_prioridad',
            state: 'resuelto',
            finishedAt: threeDaysAgo,
            projectId: 1,
            tags: null,
            createdBy: 'zitadel-sub-01'
          }),
          Requirement.create({
            id: 4,
            title: 'Req Resuelto Antiguo',
            description: 'Desc',
            priority: 'sin_prioridad',
            state: 'resuelto',
            finishedAt: tenDaysAgo,
            projectId: 1,
            tags: null,
            createdBy: 'zitadel-sub-01'
          }),
          Requirement.create({
            id: 5,
            title: 'Req Planificacion',
            description: 'Desc',
            priority: 'sin_prioridad',
            state: 'planificacion',
            projectId: 1,
            tags: null,
            createdBy: 'zitadel-sub-01'
          }),
          Requirement.create({
            id: 6,
            title: 'Req En Cola',
            description: 'Desc',
            priority: 'sin_prioridad',
            state: 'en_cola',
            projectId: 1,
            tags: null,
            createdBy: 'zitadel-sub-01'
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          PersonRequirement.create({ personId: 1, requirementId: 1, isLeader: true }),
          PersonRequirement.create({ personId: 1, requirementId: 2, isLeader: true }),
          PersonRequirement.create({ personId: 1, requirementId: 3, isLeader: true }),
          PersonRequirement.create({ personId: 1, requirementId: 4, isLeader: true }),
          PersonRequirement.create({ personId: 1, requirementId: 5, isLeader: true }),
          PersonRequirement.create({ personId: 1, requirementId: 6, isLeader: true }),
        ]);
      });
  });

  after(() => {
    return PersonRequirement.destroy({where: {}})
      .then(() => Requirement.destroy({where: {}}))
      .then(() => Person.destroy({where: {}}))
      .then(() => Project.destroy({where: {}}))
      .then(() => User.destroy({where: {}}));
  });

  // TS-1: Happy path - devuelve requisitos donde la persona es responsable
  it('TS-1: should get requirements where the person is responsible', () => {
    return request(application)
      .get('/api/worked-times/person-requirements')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.containDeep([
          {id: 1, title: 'Req Analisis', state: 'analisis', projectId: 1, projectName: 'Proyecto Alpha'},
        ]);
      });
  });

  // TS-2: Excluye requisito cancelado
  it('TS-2: should exclude requirements in state cancelado', () => {
    return request(application)
      .get('/api/worked-times/person-requirements')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const ids = response.body.map((r: any) => r.id);
        ids.should.not.containEql(2);
      });
  });

  // TS-3: Excluye resuelto hace mas de 7 dias
  it('TS-3: should exclude requirements resolved more than 7 days ago', () => {
    return request(application)
      .get('/api/worked-times/person-requirements')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const ids = response.body.map((r: any) => r.id);
        ids.should.not.containEql(4);
      });
  });

  // TS-4: Incluye resuelto hace 7 dias o menos
  it('TS-4: should include requirements resolved 7 days ago or less', () => {
    return request(application)
      .get('/api/worked-times/person-requirements')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const ids = response.body.map((r: any) => r.id);
        ids.should.containEql(3);
      });
  });

  // TS-5: Incluye no-terminales sin importar antiguedad
  it('TS-5: should include requirements in any non-terminal state regardless of age', () => {
    return request(application)
      .get('/api/worked-times/person-requirements')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const ids = response.body.map((r: any) => r.id);
        ids.should.containEql(1);
        ids.should.containEql(5);
        ids.should.containEql(6);
      });
  });

  // TS-6: personId faltante
  it('TS-6: should fail without personId query param', () => {
    return request(application)
      .get('/api/worked-times/person-requirements')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-7: Sin token
  it('TS-7: should fail without token', () => {
    return request(application)
      .get('/api/worked-times/person-requirements')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  // TS-8: Rol no autorizado
  it('TS-8: should fail with external-user role', () => {
    return request(application)
      .get('/api/worked-times/person-requirements')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-9: Rol admin puede consultar cualquier personId
  it('TS-9: should work with admin role', () => {
    return request(application)
      .get('/api/worked-times/person-requirements')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_03_admin')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        const ids = response.body.map((r: any) => r.id);
        ids.should.containEql(1);
      });
  });

  // TS-10: Response shape exacto (sin requirementId)
  it('TS-10: should return items with exactly id, title, state, projectId, projectName', () => {
    return request(application)
      .get('/api/worked-times/person-requirements')
      .query({personId: 1})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.length.should.be.above(0);
        response.body.forEach((item: any) => {
          Object.keys(item).sort().should.deepEqual(['id', 'projectId', 'projectName', 'state', 'title']);
        });
      });
  });

  // TS-11: Persona sin requisitos asignados devuelve array vacio
  it('TS-11: should return an empty array for a person with no assigned requirements', () => {
    return request(application)
      .get('/api/worked-times/person-requirements')
      .query({personId: 2})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(0);
      });
  });

  // TS-12: personId de una persona inexistente
  it('TS-12: should return an empty array for a non-existent personId', () => {
    return request(application)
      .get('/api/worked-times/person-requirements')
      .query({personId: 999999})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(0);
      });
  });
});
