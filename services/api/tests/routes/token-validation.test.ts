import 'mocha';
import 'should';
import { generateKeyPairSync, KeyObject } from 'crypto';
import request from 'supertest';
import nock from 'nock';
import sinon from 'sinon';
import jwt from 'jsonwebtoken';
import { Application } from 'express';
import { start } from '../mocks/app';
import logger from '../../lib/logger';
import { SystemSetting } from '@jiku/models';
import { synchronizeIdentityKeys } from '../../lib/utils/auth-helper';

const { IDENTITY_URL = '', IDENTITY_ISSUER = '', ZITADEL_PROJECT_ID = '' } = process.env;

/**
 * #626: what the api accepts as a token. Any operation with a role check works as the probe:
 * 401 means the token was refused, 403 means it was accepted with roles that do not reach the
 * operation, 200 means it was accepted with roles that do.
 */
const ROLE_CHECKED = '/api/settings/hours-per-day'; // admin or user

const ROLE = { '275648673470218245': 'grava.id.grava.io' };

function rsaKey(kid: string) {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...(pair.publicKey as KeyObject).export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };
  return { kid, privateKey: pair.privateKey, jwk };
}

function signed(key: ReturnType<typeof rsaKey>, claims: Record<string, unknown>) {
  return (jwt as any).sign(claims, key.privateKey, { algorithm: 'RS256', keyid: key.kid, expiresIn: 600 });
}

function personClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: IDENTITY_ISSUER,
    sub: 'zitadel-sub-626-real',
    aud: ['clientidfake', ZITADEL_PROJECT_ID],
    'urn:zitadel:iam:org:project:roles': { user: ROLE },
    [`urn:zitadel:iam:org:project:${ZITADEL_PROJECT_ID}:roles`]: { user: ROLE },
    ...overrides,
  };
}

function get(application: Application, token: string) {
  return request(application).get(ROLE_CHECKED).set('Authorization', `Bearer ${token}`);
}

describe('token validation (#626)', () => {
  let application: Application;
  let warn: sinon.SinonSpy;
  let createdSetting = false;

  before(() => {
    application = start();
    // The probe answers 200 only with the setting in place.
    return SystemSetting.findOrCreate({ where: { key: 'hours_per_day' }, defaults: { key: 'hours_per_day', value: '8' } as any })
      .then(([, created]) => {
        createdSetting = created;
      });
  });

  after(() => {
    // Leave the table as it was: other suites create this setting themselves.
    return createdSetting ? SystemSetting.destroy({ where: { key: 'hours_per_day' } }) : undefined;
  });

  beforeEach(() => {
    warn = sinon.spy(logger, 'warn');
  });

  afterEach(() => {
    warn.restore();
    nock.cleanAll();
  });

  function loggedReason(pattern: RegExp) {
    const lines = warn.getCalls().map((call) => call.args.map(String).join(' '));
    lines.some((line) => pattern.test(line)).should.be.true(`no log line matches ${pattern}: ${JSON.stringify(lines)}`);
  }

  describe('claims of a token whose signature verifies', () => {
    it('[ACC-E1] [626-AC-01] refuses a token of another issuer with 401 unauthorized and logs why', () => {
      return get(application, 'token_foreign_issuer_admin')
        .expect(401)
        .then((response) => {
          response.body.should.eql({ code: 'unauthorized', message: 'Unauthorized' });
          loggedReason(/issuer/i);
        });
    });

    it('[ACC-E1] [626-AC-01] refuses an admin of another project of the instance with 401 and logs why', () => {
      return get(application, 'token_foreign_project_admin')
        .expect(401)
        .then((response) => {
          response.body.should.eql({ code: 'unauthorized', message: 'Unauthorized' });
          loggedReason(/audience/i);
        });
    });

    it('[ACC-16] [ACC-E1] refuses a machine token without the project audience: no exception for machines', () => {
      return get(application, 'token_machine_without_audience')
        .expect(401)
        .then((response) => response.body.should.eql({ code: 'unauthorized', message: 'Unauthorized' }));
    });

    it('[ACC-16] takes the roles only from the project claim: the generic claim alone gives no roles', () => {
      return get(application, 'token_generic_roles_only_admin')
        .expect(403)
        .then((response) => response.body.code.should.equal('access_denied'));
    });

    it('[ACC-16] [626-AC-02] accepts a machine token with the project audience (aud as one string), with its roles', () => {
      return get(application, 'token_machine_internal_app')
        .expect(403)
        .then((response) => response.body.code.should.equal('access_denied'));
    });

    it('[ACC-16] [626-AC-02] accepts a person token of the product with the same roles as before', () => {
      return get(application, 'token_01_user').expect(200);
    });
  });

  describe('signature against the provider keys', () => {
    const published = rsaKey('626-published');
    const rotated = rsaKey('626-rotated');
    const unknown = rsaKey('626-never-published');

    beforeEach(() => {
      nock(IDENTITY_URL).get('/oauth/v2/keys').reply(200, { keys: [published.jwk] });
      return synchronizeIdentityKeys();
    });

    it('[ACC-16] accepts a real token signed with a published key, of the issuer and with the audience', () => {
      return get(application, signed(published, personClaims())).expect(200);
    });

    it('[ACC-16] refetches the keys on an unknown key before refusing, and accepts the rotated key', () => {
      const refetch = nock(IDENTITY_URL).get('/oauth/v2/keys').reply(200, { keys: [published.jwk, rotated.jwk] });
      return get(application, signed(rotated, personClaims()))
        .expect(200)
        .then(() => refetch.isDone().should.be.true());
    });

    it('[ACC-E1] refuses a token signed with a key the provider does not publish', () => {
      nock(IDENTITY_URL).get('/oauth/v2/keys').times(5).reply(200, { keys: [published.jwk] });
      return get(application, signed(unknown, personClaims()))
        .expect(401)
        .then((response) => response.body.should.eql({ code: 'unauthorized', message: 'Unauthorized' }));
    });

    it('[ACC-E1] refuses a real, well-signed token of another issuer', () => {
      return get(application, signed(published, personClaims({ iss: 'https://other-instance.example.com' })))
        .expect(401);
    });

    it('[ACC-E1] [626-AC-01] refuses a real, well-signed token of another project', () => {
      const other = '999999999999999999';
      return get(application, signed(published, personClaims({
        aud: ['clientidfake', other],
        [`urn:zitadel:iam:org:project:${ZITADEL_PROJECT_ID}:roles`]: undefined,
        [`urn:zitadel:iam:org:project:${other}:roles`]: { admin: ROLE },
        'urn:zitadel:iam:org:project:roles': { admin: ROLE },
      })))
        .expect(401);
    });

    it('[ACC-E1] refuses an expired token', () => {
      const expired = (jwt as any).sign(
        { ...personClaims(), exp: Math.floor(Date.now() / 1000) - 60 },
        published.privateKey,
        { algorithm: 'RS256', keyid: published.kid }
      );
      return get(application, expired).expect(401);
    });
  });
});
