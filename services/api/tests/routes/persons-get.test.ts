import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Person, User } from '@jiku/models';

describe('GET /api/persons', () => {
  let application : Application;

  before(function() {
    application = start();
    return Promise.all([
      User.create({
        id: 'zitadel-sub-01',
        name: 'User 01',
        username: 'user01',
        email: 'user01@mail.com'
      }),
      Person.create({
        id: 1,
        firstName: 'john',
        lastName: 'doe',
        enabled: true,
        initDate: new Date()
      }),
      Person.create({
        id: 2,
        firstName: 'jane',
        lastName: 'doe',
        enabled: false,
        initDate: new Date()
      }),
      Person.create({
        id: 3,
        firstName: 'Jone',
        lastName: 'doe',
        enabled: true,
        initDate: new Date()
      })
    ]);
  });

  after(() => {
    return Person.destroy({where: {}})
      .then(() => {
        return User.destroy({where: {}});
      });
  });

  it('should fail without token', () => {
    return request(application)
      .get('/api/persons/')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
        response.body.message.should.equal('Unauthorized');
      });
  });

  it('should get all active persons', () => {
    return request(application)
      .get('/api/persons')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedPersons = [
          {
            id: 1,
            firstName: 'john',
            lastName: 'doe',
            enabled: true,
          },
          {
            id: 3,
            firstName: 'Jone',
            lastName: 'doe',
            enabled: true,
          }
        ];
        response.body.should.have.length(2);
        response.body.should.containDeep(expectedPersons);
      });
  });
});
