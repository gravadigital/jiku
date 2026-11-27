import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Person, UnworkedTime, User } from '@jiku/models';

describe('GET /api/unworked-times', () => {
  let application: Application;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  before(function() {
    application = start();

    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com',
    })
      .then(() => {
        return Person.create({
          id: 1,
          firstName: 'Juan',
          lastName: 'Pérez',
          enabled: true,
          mustChargeWorkedTime: true,
          initDate: new Date('2024-01-01'),
          userId: 'zitadel-sub-01',
        });
      })
      .then(() => {
        return Promise.all([
          UnworkedTime.create({
            id: 100,
            date: todayStr,
            minutes: 120,
            reason: 'vacaciones',
            personId: 1,
          }),
          UnworkedTime.create({
            id: 101,
            date: todayStr,
            minutes: 60,
            reason: 'medico',
            personId: 1,
          }),
        ]);
      });
  });

  after(() => {
    return UnworkedTime.destroy({ where: {} })
      .then(() => Person.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-11: GET with valid date and personId → 200 array
  it('should return 200 with unworked times for person and date', () => {
    return request(application)
      .get('/api/unworked-times')
      .query({ date: todayStr, personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(2);
        response.body[0].should.have.property('id');
        response.body[0].should.have.property('date');
        response.body[0].should.have.property('minutes');
        response.body[0].should.have.property('reason');
        response.body[0].should.have.property('personId', 1);
        response.body[0].should.have.property('createdAt');
      });
  });

  // TS-12: GET with no data for that date → 200 []
  it('should return empty array when no records for date', () => {
    return request(application)
      .get('/api/unworked-times')
      .query({ date: '2020-01-01', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(0);
      });
  });

  // TS-13: GET without date → 400
  it('should return 400 when date is missing', () => {
    return request(application)
      .get('/api/unworked-times')
      .query({ personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-14: GET without personId → 400
  it('should return 400 when personId is missing', () => {
    return request(application)
      .get('/api/unworked-times')
      .query({ date: todayStr })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  it('should return 401 without token', () => {
    return request(application)
      .get('/api/unworked-times')
      .query({ date: todayStr, personId: 1 })
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });
});
