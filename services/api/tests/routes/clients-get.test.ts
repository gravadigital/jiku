import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Client, User } from '@jiku/models';

describe('GET /api/clients', () => {
  let application : Application;

  before(function() {
    application = start();
    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com'
    })
      .then(() => {
        return Promise.all([
          Client.create({
            id: 1,
            name: 'Adistal',
          }),
          Client.create({
            id: 2,
            name: 'Verifarma',
          }),
          Client.create({
            id: 3,
            name: 'Exo',
          })
        ]);
      });
  });

  after(() => {
    return Client.destroy({where: {}})
      .then(() => {
        return User.destroy({where: {}});
      });
  });

  it('should fail without token', () => {
    return request(application)
      .get('/api/clients')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
        response.body.message.should.equal('Unauthorized');
      });
  });

  it('should get all clients', () => {
    return request(application)
      .get('/api/clients')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedClients = [
          {
            id: 1,
            name: 'Adistal',
          },
          {
            id: 2,
            name: 'Verifarma',
          },
          {
            id: 3,
            name: 'Exo',
          }
        ];
        response.body.should.have.length(3);
        response.body.should.containDeep(expectedClients);
      });
  });
});
