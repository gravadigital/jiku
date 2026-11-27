import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Person, Project, User, WeekAssignedTime } from '@jiku/models';

describe('GET /api/week-assigned-times', () => {
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
            firstName: 'Ana',
            lastName: 'García',
            enabled: true,
            mustChargeWorkedTime: false,
            initDate: new Date('2024-01-01')
          }),
          Person.create({
            id: 3,
            firstName: 'Carlos',
            lastName: 'López',
            enabled: false,
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
          Project.create({
            id: 2,
            code: 'BETA',
            name: 'Proyecto Beta',
            type: 'interno',
            status: 'analisis',
            priority: 3,
            initDate: new Date(),
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
            createdBy: 'zitadel-sub-01'
          }),
        ]);
      })
      .then(() => {
        return WeekAssignedTime.create({
          id: 1,
          personId: 1,
          projectId: 1,
          minutes: 900,
          internal: false,
          dateFrom: new Date('2026-02-02'),
          dateTo: new Date('2026-02-06')
        });
      });
  });

  after(() => {
    return WeekAssignedTime.destroy({where: {}})
      .then(() => Person.destroy({where: {}}))
      .then(() => Project.destroy({where: {}}))
      .then(() => User.destroy({where: {}}));
  });

  it('should get week assigned times with data', () => {
    return request(application)
      .get('/api/week-assigned-times')
      .query({weekStart: '2026-02-02'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.property('weekStart', '2026-02-02');
        response.body.should.have.property('weekEnd', '2026-02-06');
        response.body.allocations.should.have.length(1);
        response.body.allocations.should.containDeep([{
          personId: 1,
          projectId: 1,
          minutes: 900,
          internal: false
        }]);
        response.body.persons.should.be.Array();
        response.body.projects.should.be.Array();
      });
  });

  it('should return empty allocations for week without data', () => {
    return request(application)
      .get('/api/week-assigned-times')
      .query({weekStart: '2026-03-02'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.allocations.should.have.length(0);
        response.body.persons.should.be.Array();
        response.body.projects.should.be.Array();
      });
  });

  it('should return only persons with mustChargeWorkedTime and enabled', () => {
    return request(application)
      .get('/api/week-assigned-times')
      .query({weekStart: '2026-02-02'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.persons.should.have.length(1);
        response.body.persons.should.containDeep([{
          id: 1,
          firstName: 'Juan',
          lastName: 'Pérez'
        }]);
      });
  });

  it('should return only active and analisis projects', () => {
    return request(application)
      .get('/api/week-assigned-times')
      .query({weekStart: '2026-02-02'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.projects.should.have.length(2);
        response.body.projects.should.containDeep([
          {id: 1, name: 'Proyecto Alpha', code: 'ALPHA'},
          {id: 2, name: 'Proyecto Beta', code: 'BETA'}
        ]);
      });
  });

  it('should fail without weekStart param', () => {
    return request(application)
      .get('/api/week-assigned-times')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  it('should fail with invalid weekStart format', () => {
    return request(application)
      .get('/api/week-assigned-times')
      .query({weekStart: 'invalid'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  it('should fail with external-user role', () => {
    return request(application)
      .get('/api/week-assigned-times')
      .query({weekStart: '2026-02-02'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  it('should fail without token', () => {
    return request(application)
      .get('/api/week-assigned-times')
      .query({weekStart: '2026-02-02'})
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  it('should get week assigned times with admin role', () => {
    return request(application)
      .get('/api/week-assigned-times')
      .query({weekStart: '2026-02-02'})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_03_admin')
      .expect(200)
      .then((response) => {
        response.body.should.have.property('weekStart', '2026-02-02');
        response.body.should.have.property('weekEnd', '2026-02-06');
        response.body.allocations.should.have.length(1);
        response.body.persons.should.be.Array();
        response.body.projects.should.be.Array();
      });
  });
});
