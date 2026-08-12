import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Person, Project, User, WorkedTime } from '@jiku/models';

function getDateStr(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

describe('DELETE /api/worked-times/:id', () => {
  let application: Application;

  const todayStr = getDateStr(0);
  const tenDaysAgoStr = getDateStr(-11);

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
        id: 'zitadel-sub-02',
        name: 'User 02',
        username: 'user02',
        email: 'user02@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-03',
        name: 'Admin 01',
        username: 'admin01',
        email: 'admin01@mail.com'
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
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-02'
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
          // Record for person 1, today (for TS-15: happy path delete)
          WorkedTime.create({
            id: 100,
            date: todayStr,
            minutes: 60,
            projectId: 1,
            personId: 1
          }),
          // Record for person 1, 11 days ago (for TS-16: old date, exceeds 10-day limit)
          WorkedTime.create({
            id: 101,
            date: tenDaysAgoStr,
            minutes: 60,
            projectId: 1,
            personId: 1
          }),
          // Record for person 2, today (for TS-17: user deleting other's, TS-18: admin delete)
          WorkedTime.create({
            id: 102,
            date: todayStr,
            minutes: 60,
            projectId: 1,
            personId: 2
          }),
        ]);
      });
  });

  after(() => {
    return WorkedTime.destroy({where: {}})
      .then(() => Person.destroy({where: {}}))
      .then(() => Project.destroy({where: {}}))
      .then(() => User.destroy({where: {}}));
  });

  // TS-15: Happy path - delete own record
  it('should delete own worked time record', () => {
    return request(application)
      .delete('/api/worked-times/100')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.property('message', 'Registro eliminado');
      });
  });

  // TS-16: Date > 7 days → 400
  it('should fail when record date is older than 7 days', () => {
    return request(application)
      .delete('/api/worked-times/101')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_date_range');
      });
  });

  // TS-17: User deleting other's record → 403
  it('should fail when user tries to delete another person record', () => {
    return request(application)
      .delete('/api/worked-times/102')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-18: Admin deleting other's record → 200
  it('should allow admin to delete another person record', () => {
    return request(application)
      .delete('/api/worked-times/102')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_03_admin')
      .expect(200)
      .then((response) => {
        response.body.should.have.property('message', 'Registro eliminado');
      });
  });

  // TS-19: Non-existent record → 404
  it('should fail when record does not exist', () => {
    return request(application)
      .delete('/api/worked-times/9999')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('worked_time_not_found');
      });
  });

  it('should fail without token', () => {
    return request(application)
      .delete('/api/worked-times/101')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });
});
