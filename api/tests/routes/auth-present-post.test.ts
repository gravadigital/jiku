import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { User } from '@jiku/models';
import nock from 'nock';
const {IDENTITY_URL = ''} = process.env;

describe('POST /api/auth/present', () => {
  let application: Application;

  before(function () {
    application = start();
  });

  beforeEach(() => {
    nock(IDENTITY_URL, {
      reqheaders: {
        Authorization: 'Bearer token_01_user',
      },
    })
      .get('/oidc/v1/userinfo')
      .reply(200, {
        email: 'user01@mail.com',
        email_verified: true,
        family_name: 'User',
        given_name: 'Modified 01',
        locale: 'es',
        name: 'User modified 01',
        preferred_username: 'user01',
        sub: 'zitadel-sub-01',
        updated_at: 1720795700,
        'urn:zitadel:iam:org:project:275672248377933829:roles': {
          admin: {
            '275648673470218245': 'grava.id.grava.io'
          }
        },
        'urn:zitadel:iam:org:project:roles': {
          admin: {
            '275648673470218245': 'grava.id.grava.io'
          }
        }
      });
    nock(IDENTITY_URL, {
      reqheaders: {
        Authorization: 'Bearer token_02_user',
      },
    })
      .get('/oidc/v1/userinfo')
      .reply(200, {
        email: 'user02@mail.com',
        email_verified: true,
        family_name: 'User',
        given_name: 'Test 02',
        locale: 'es',
        name: 'User Test 02',
        preferred_username: 'user02',
        sub: 'zitadel-sub-02',
        updated_at: 1720795700,
        'urn:zitadel:iam:org:project:275672248377933829:roles': {
          admin: {
            '275648673470218245': 'grava.id.grava.io'
          }
        },
        'urn:zitadel:iam:org:project:roles': {
          admin: {
            '275648673470218245': 'grava.id.grava.io'
          }
        }
      });
    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com'
    });
  });

  afterEach(() => {
    nock.cleanAll();
    return User.destroy({where: {}});
  });

  it('should fail without token', () => {
    return request(application)
      .post('/api/auth/present')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
        response.body.message.should.equal('Unauthorized');
      });
  });

  // PROVISORIO: la ruta es un no-op. Escribía el usuario en `users` con los datos de
  // Zitadel, y ahora no puede: la api conecta con un usuario de solo lectura.
  // Estos tests verifican ese comportamiento actual; cuando se defina dónde vive el alta
  // (comando de core, auth-callout, o excepción) hay que volver a escribirlos.
  it('should respond 200 without touching the database', () => {
    return User.count()
      .then((before) => {
        return request(application)
          .post('/api/auth/present')
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer token_01_user')
          .expect(200)
          .then(() => User.count())
          .then((after) => after.should.equal(before));
      });
  });

  it('should not create the user of a token that is not in the database', () => {
    return request(application)
      .post('/api/auth/present')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_02_user')
      .expect(200)
      .then(() => User.findAll({ where: { id: 'zitadel-sub-02' } }))
      .then((users) => users.length.should.equal(0));
  });
});
