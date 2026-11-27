import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Person, UnworkedTime, User } from '@jiku/models';

describe('GET /api/unworked-times/report', () => {
  let application: Application;

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
          // TS-22: Two entries on same day to test grouping
          UnworkedTime.create({
            id: 1,
            date: '2026-03-10',
            minutes: 240,
            reason: 'medico',
            personId: 1,
          }),
          UnworkedTime.create({
            id: 2,
            date: '2026-03-10',
            minutes: 120,
            reason: 'tramite',
            personId: 1,
          }),
          // TS-19: Entry on a different day
          UnworkedTime.create({
            id: 3,
            date: '2026-03-15',
            minutes: 480,
            reason: 'vacaciones',
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

  // TS-19: GET report with data in range → 200 grouped array
  it('should return 200 with grouped report data', () => {
    return request(application)
      .get('/api/unworked-times/report')
      .query({ dateFrom: '2026-03-01', dateTo: '2026-03-20', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.length.should.be.greaterThan(0);
        response.body[0].should.have.property('date');
        response.body[0].should.have.property('totalMinutes');
        response.body[0].should.have.property('entries');
        response.body[0].entries.should.be.Array();
        response.body[0].entries[0].should.have.property('id');
        response.body[0].entries[0].should.have.property('minutes');
        response.body[0].entries[0].should.have.property('reason');
      });
  });

  // TS-20: GET report with no data in range → 200 []
  it('should return empty array when no records in date range', () => {
    return request(application)
      .get('/api/unworked-times/report')
      .query({ dateFrom: '2020-01-01', dateTo: '2020-01-31', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(0);
      });
  });

  // TS-21: GET report without dateFrom → 400
  it('should return 400 when dateFrom is missing', () => {
    return request(application)
      .get('/api/unworked-times/report')
      .query({ dateTo: '2026-03-20', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  it('should return 400 when dateTo is missing', () => {
    return request(application)
      .get('/api/unworked-times/report')
      .query({ dateFrom: '2026-03-01', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  it('should return 400 when personId is missing', () => {
    return request(application)
      .get('/api/unworked-times/report')
      .query({ dateFrom: '2026-03-01', dateTo: '2026-03-20' })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-22: Multiple entries on same day → correctly grouped with summed totalMinutes
  it('should group multiple entries on the same day correctly', () => {
    return request(application)
      .get('/api/unworked-times/report')
      .query({ dateFrom: '2026-03-10', dateTo: '2026-03-10', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(1);
        response.body[0].should.have.property('date', '2026-03-10');
        response.body[0].should.have.property('totalMinutes', 360);
        response.body[0].entries.should.have.length(2);
      });
  });

  it('should return 401 without token', () => {
    return request(application)
      .get('/api/unworked-times/report')
      .query({ dateFrom: '2026-03-01', dateTo: '2026-03-20', personId: 1 })
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });
});
