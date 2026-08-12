import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Objective, Person, Project, Requirement, RequirementActivity, User, WorkedTime } from '@jiku/models';

describe('GET /api/requirements/report', () => {
  let application: Application;

  before(() => {
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' })
      .then(() => Promise.all([
        Project.create({ id: 1, name: 'Project1', code: 'P1', type: 'comercial', status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-01' }),
        Person.create({ id: 1, firstName: 'Persona', lastName: 'Uno', userId: 'zitadel-sub-01', initDate: new Date('2026-01-01') }),
      ]))
      .then(() => Promise.all([
        // Requisito para búsqueda por título
        Requirement.create({
          id: 100,
          title: 'Falla en login',
          description: 'Desc',
          type: 'incidencia',
          priority: 'alta',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
          createdAt: new Date('2026-03-15T00:00:00.000Z'),
        }),
        // Requisito fuera de rango de fecha
        Requirement.create({
          id: 101,
          title: 'Otro requisito',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'media',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
          createdAt: new Date('2020-01-01T00:00:00.000Z'),
        }),
        // Requisito con los 3 campos de resolución cargados en columna propia (TS-15)
        Requirement.create({
          id: 102,
          title: 'Incidencia con historial',
          description: 'Desc',
          type: 'incidencia',
          priority: 'alta',
          state: 'desarrollo',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          resolutionType: 'error_interno',
          resolutionConclusion: 'conclusión',
          resolutionComment: 'nota pública',
        }),
        // Requisito sin ningún campo de resolución cargado (TS-16)
        Requirement.create({
          id: 109,
          title: 'Funcionalidad sin resolucion',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'media',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
        }),
        // Requisito para suma de horas (TS-13)
        Requirement.create({
          id: 103,
          title: 'Requisito con horas',
          description: 'Desc',
          type: 'incidencia',
          priority: 'alta',
          state: 'desarrollo',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
        }),
      ]))
      .then(() => {
        return Objective.create({
          id: 200,
          title: 'Objetivo vinculado',
          description: 'Desc',
          state: 'activo',
          area: 'desarrollo',
          priority: 1,
          projectId: 1,
          requirementId: 103,
          createdBy: 'zitadel-sub-01',
        });
      })
      .then(() => Promise.all([
        WorkedTime.create({
          date: new Date('2026-05-02T00:00:00.000Z'),
          minutes: 60,
          projectId: 1,
          personId: 1,
          requirementId: 103,
        }),
        WorkedTime.create({
          date: new Date('2026-05-03T00:00:00.000Z'),
          minutes: 90,
          projectId: 1,
          personId: 1,
          objectiveId: 200,
        }),
      ]));
  });

  after(() => {
    return WorkedTime.destroy({ where: {} })
      .then(() => Objective.destroy({ where: {} }))
      .then(() => RequirementActivity.destroy({ where: {} }))
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Person.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-14: sin autenticación
  it('TS-14: should return 401 without authentication', () => {
    return request(application)
      .get('/api/requirements/report')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  // TS-12: sin filtros devuelve todos
  it('TS-12: should return all requirements without filters', () => {
    return request(application)
      .get('/api/requirements/report')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        const ids = response.body.map((r: any) => r.id);
        ids.should.containDeep([100, 101, 102, 103]);
      });
  });

  // TS-7: reporte con filtros de búsqueda y fecha
  it('TS-7: should filter by search and date range', () => {
    return request(application)
      .get('/api/requirements/report')
      .query({ search: 'login', createdFrom: '2026-01-01', createdTo: '2026-12-31' })
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.length(1);
        const item = response.body[0];
        item.id.should.equal(100);
        item.title.should.equal('Falla en login');
        item.should.have.properties([
          'id', 'title', 'type', 'state', 'createdBy', 'createdAt',
          'inProgressAt', 'finishedAt', 'totalMinutes',
          'resolutionType', 'resolutionConclusion', 'resolutionComment', 'project'
        ]);
        item.project.id.should.equal(1);
        item.project.name.should.equal('Project1');
      });
  });

  // TS-15: reporte refleja los 3 campos de resolución leídos de columna propia
  it('TS-15: should return resolutionType, resolutionConclusion and resolutionComment read from own columns', () => {
    return request(application)
      .get('/api/requirements/report')
      .query({ search: '102' })
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.length(1);
        response.body[0].resolutionType.should.equal('error_interno');
        response.body[0].resolutionConclusion.should.equal('conclusión');
        response.body[0].resolutionComment.should.equal('nota pública');
      });
  });

  // TS-16: reporte no falla si no hay resolución cargada
  it('TS-16: should return null resolution fields when none are set', () => {
    return request(application)
      .get('/api/requirements/report')
      .query({ search: '109' })
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.length(1);
        (response.body[0].resolutionType === null).should.be.true();
        (response.body[0].resolutionConclusion === null).should.be.true();
        (response.body[0].resolutionComment === null).should.be.true();
      });
  });

  // TS-13: totalMinutes suma horas directas y vía objetivos vinculados
  it('TS-13: should sum direct and objective-linked worked time without duplicating', () => {
    return request(application)
      .get('/api/requirements/report')
      .query({ search: '103' })
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.length(1);
        response.body[0].totalMinutes.should.equal(150);
      });
  });
});
