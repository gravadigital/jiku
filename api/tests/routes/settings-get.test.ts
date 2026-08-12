import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { SystemSetting, User } from '@jiku/models';

describe('GET /api/settings/hours-per-day', () => {
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
        return SystemSetting.create({
          key: 'hours_per_day',
          value: '6'
        });
      });
  });

  after(() => {
    return SystemSetting.destroy({where: {}})
      .then(() => User.destroy({where: {}}));
  });

  it('should get hours per day with user role', () => {
    return request(application)
      .get('/api/settings/hours-per-day')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.property('hoursPerDay', 6);
      });
  });

  it('should get hours per day with admin role', () => {
    return request(application)
      .get('/api/settings/hours-per-day')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_03_admin')
      .expect(200)
      .then((response) => {
        response.body.should.have.property('hoursPerDay', 6);
      });
  });

  it('should fail without token', () => {
    return request(application)
      .get('/api/settings/hours-per-day')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  it('should fail with external-user role', () => {
    return request(application)
      .get('/api/settings/hours-per-day')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });
});
