import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Person, UnworkedTime, User } from '@jiku/models';

describe('DELETE /api/unworked-times/:id', () => {
  let application: Application;

  const todayStr = new Date().toISOString().split('T')[0];
  const eightDaysAgo = new Date(Date.now() - 11 * 24 * 60 * 60 * 1000);

  before(function() {
    application = start();

    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com',
    })
      .then(() => {
        return User.create({
          id: 'zitadel-sub-02',
          name: 'User 02',
          username: 'user02',
          email: 'user02@mail.com',
        });
      })
      .then(() => {
        return Promise.all([
          Person.create({
            id: 1,
            firstName: 'Juan',
            lastName: 'Pérez',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-01',
          }),
          Person.create({
            id: 2,
            firstName: 'Maria',
            lastName: 'Lopez',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-02',
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          // Record 1: own record, created today (within 7 days) → deletable
          UnworkedTime.create({
            id: 1,
            date: todayStr,
            minutes: 60,
            reason: 'medico',
            personId: 1,
          }),
          // Record 2: belongs to person 2 (different user) → 403
          UnworkedTime.create({
            id: 2,
            date: todayStr,
            minutes: 60,
            reason: 'tramite',
            personId: 2,
          }),
          // Record 3: own record, created 11 days ago → 400 deadline exceeded (exceeds 10-day limit)
          UnworkedTime.create({
            id: 3,
            date: todayStr,
            minutes: 60,
            reason: 'estudio',
            personId: 1,
            createdAt: eightDaysAgo,
            updatedAt: eightDaysAgo,
          }),
        ]);
      });
  });

  after(() => {
    return UnworkedTime.destroy({ where: {} })
      .then(() => Person.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-16: Record belonging to another person → 403
  it('should return 403 when deleting another person record', () => {
    return request(application)
      .delete('/api/unworked-times/2')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-17: Record created more than 7 days ago → 400
  it('should return 400 when record is older than 7 days', () => {
    return request(application)
      .delete('/api/unworked-times/3')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('deadline_exceeded');
      });
  });

  // TS-18: Non-existent record → 404
  it('should return 404 when record does not exist', () => {
    return request(application)
      .delete('/api/unworked-times/9999')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('unworked_time_not_found');
      });
  });

  // TS-15: Own record, within 7 days → 200 Deleted (run last since it deletes record)
  it('should return 200 when deleting own record within 7 days', () => {
    return request(application)
      .delete('/api/unworked-times/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.property('message', 'Deleted');
      });
  });

  it('should return 401 without token', () => {
    return request(application)
      .delete('/api/unworked-times/9999')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });
});
