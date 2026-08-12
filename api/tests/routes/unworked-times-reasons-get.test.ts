import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { User } from '@jiku/models';

describe('GET /api/unworked-times/reasons', () => {
  let application: Application;

  before(function() {
    application = start();

    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com',
    });
  });

  after(() => {
    return User.destroy({ where: {} });
  });

  // TS-01: Authenticated user gets list of 9 reasons
  it('should return 200 with 9 reasons when authenticated', () => {
    return request(application)
      .get('/api/unworked-times/reasons')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(9);
        response.body[0].should.have.property('value', 'tramite');
        response.body[0].should.have.property('label', 'Trámite');
        response.body[2].should.have.property('value', 'vacaciones');
        response.body[8].should.have.property('value', 'otro');
      });
  });

  // TS-02: No token → 401
  it('should return 401 without token', () => {
    return request(application)
      .get('/api/unworked-times/reasons')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  // TS-23: "reasons" not confused with :id
  it('should not interpret reasons as :id param', () => {
    return request(application)
      .get('/api/unworked-times/reasons')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.Array();
        response.body.should.have.length(9);
      });
  });
});
