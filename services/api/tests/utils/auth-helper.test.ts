import 'mocha';
import 'should';
import nock from 'nock';
import {getKey, getKeys, synchronizeIdentityKeys} from '../../lib/utils/auth-helper';
const {IDENTITY_URL = ''} = process.env;

describe('Utils auth-helper', () => {
  before(() => {
    nock(IDENTITY_URL)
      .get('/oauth/v2/keys')
      .reply(200, {
        'keys': [
          {
            'use': 'sig',
            'kty': 'RSA',
            'kid': '264479401285013507',
            'alg': 'RS256',
            'n': '2oTnjyYY5_c9K0LakdT_jkynJYZIbjxpuJZrdq36NMujuaVu8eufMd28NQltDGCG-JTt8M2CmhIQJH7K3CKp0OqeYeolowVWtcXBzyWVJbntaPtqKx8xOXb-pknrMbCkGsxFk_Bqx6jlqHAN8kS2iZtVdp9Fcc-y_lA3CwBTQUyqZckXRmbJZKlSkP7HZlBs-1eFvqGhFXrkkqLl3LibefKbztGV63csjBTrv7i6rL7vEHOH0xwntVlmVvBQNxmDjDv1MxQQvDTUsyw-hWUpIWVBCqszcfiYdDWWxW2uWMuYaOb0mhs0OIm0YbOM_r2TEMMXwESNF0hSBwXUGuckpQ',
            'e': 'AQAB'
          }
        ]
      });
    nock(IDENTITY_URL)
      .get('/oauth/v2/keys')
      .reply(200, {
        'keys': [
          {
            'use': 'sig',
            'kty': 'RSA',
            'kid': '264479401285013507',
            'alg': 'RS256',
            'n': '2oTnjyYY5_c9K0LakdT_jkynJYZIbjxpuJZrdq36NMujuaVu8eufMd28NQltDGCG-JTt8M2CmhIQJH7K3CKp0OqeYeolowVWtcXBzyWVJbntaPtqKx8xOXb-pknrMbCkGsxFk_Bqx6jlqHAN8kS2iZtVdp9Fcc-y_lA3CwBTQUyqZckXRmbJZKlSkP7HZlBs-1eFvqGhFXrkkqLl3LibefKbztGV63csjBTrv7i6rL7vEHOH0xwntVlmVvBQNxmDjDv1MxQQvDTUsyw-hWUpIWVBCqszcfiYdDWWxW2uWMuYaOb0mhs0OIm0YbOM_r2TEMMXwESNF0hSBwXUGuckpQ',
            'e': 'AQAB'
          }
        ]
      });
    nock(IDENTITY_URL)
      .get('/oauth/v2/keys')
      .reply(200, {
        'keys': [
          {
            'use': 'sig',
            'kty': 'RSA',
            'kid': '264479401285013507',
            'alg': 'RS256',
            'n': '2oTnjyYY5_c9K0LakdT_jkynJYZIbjxpuJZrdq36NMujuaVu8eufMd28NQltDGCG-JTt8M2CmhIQJH7K3CKp0OqeYeolowVWtcXBzyWVJbntaPtqKx8xOXb-pknrMbCkGsxFk_Bqx6jlqHAN8kS2iZtVdp9Fcc-y_lA3CwBTQUyqZckXRmbJZKlSkP7HZlBs-1eFvqGhFXrkkqLl3LibefKbztGV63csjBTrv7i6rL7vEHOH0xwntVlmVvBQNxmDjDv1MxQQvDTUsyw-hWUpIWVBCqszcfiYdDWWxW2uWMuYaOb0mhs0OIm0YbOM_r2TEMMXwESNF0hSBwXUGuckpQ',
            'e': 'AQAB'
          }
        ]
      });
    nock(IDENTITY_URL)
      .get('/oauth/v2/keys')
      .reply(200, {
        'keys': [
          {
            'use': 'sig',
            'kty': 'RSA',
            'kid': '264479401285013507',
            'alg': 'RS256',
            'n': '2oTnjyYY5_c9K0LakdT_jkynJYZIbjxpuJZrdq36NMujuaVu8eufMd28NQltDGCG-JTt8M2CmhIQJH7K3CKp0OqeYeolowVWtcXBzyWVJbntaPtqKx8xOXb-pknrMbCkGsxFk_Bqx6jlqHAN8kS2iZtVdp9Fcc-y_lA3CwBTQUyqZckXRmbJZKlSkP7HZlBs-1eFvqGhFXrkkqLl3LibefKbztGV63csjBTrv7i6rL7vEHOH0xwntVlmVvBQNxmDjDv1MxQQvDTUsyw-hWUpIWVBCqszcfiYdDWWxW2uWMuYaOb0mhs0OIm0YbOM_r2TEMMXwESNF0hSBwXUGuckpQ',
            'e': 'AQAB'
          }
        ]
      });
    nock(IDENTITY_URL)
      .get('/oauth/v2/keys')
      .reply(200, {
        'keys': [
          {
            'use': 'sig',
            'kty': 'RSA',
            'kid': '264479401285013507',
            'alg': 'RS256',
            'n': '2oTnjyYY5_c9K0LakdT_jkynJYZIbjxpuJZrdq36NMujuaVu8eufMd28NQltDGCG-JTt8M2CmhIQJH7K3CKp0OqeYeolowVWtcXBzyWVJbntaPtqKx8xOXb-pknrMbCkGsxFk_Bqx6jlqHAN8kS2iZtVdp9Fcc-y_lA3CwBTQUyqZckXRmbJZKlSkP7HZlBs-1eFvqGhFXrkkqLl3LibefKbztGV63csjBTrv7i6rL7vEHOH0xwntVlmVvBQNxmDjDv1MxQQvDTUsyw-hWUpIWVBCqszcfiYdDWWxW2uWMuYaOb0mhs0OIm0YbOM_r2TEMMXwESNF0hSBwXUGuckpQ',
            'e': 'AQAB'
          }
        ]
      });
  });

  after(() => {
    nock.cleanAll();
  });

  it('should pass - request identity keys and setting keys', () => {
    return synchronizeIdentityKeys()
      .then(() => {
        const keys = getKeys();
        keys.should.be.containDeep([
          {
            'use': 'sig',
            'kty': 'RSA',
            'kid': '264479401285013507',
            'alg': 'RS256',
            'n': '2oTnjyYY5_c9K0LakdT_jkynJYZIbjxpuJZrdq36NMujuaVu8eufMd28NQltDGCG-JTt8M2CmhIQJH7K3CKp0OqeYeolowVWtcXBzyWVJbntaPtqKx8xOXb-pknrMbCkGsxFk_Bqx6jlqHAN8kS2iZtVdp9Fcc-y_lA3CwBTQUyqZckXRmbJZKlSkP7HZlBs-1eFvqGhFXrkkqLl3LibefKbztGV63csjBTrv7i6rL7vEHOH0xwntVlmVvBQNxmDjDv1MxQQvDTUsyw-hWUpIWVBCqszcfiYdDWWxW2uWMuYaOb0mhs0OIm0YbOM_r2TEMMXwESNF0hSBwXUGuckpQ',
            'e': 'AQAB'
          }
        ]);
      });
  });

  it('should pass - create public key with verifying key', () => {
    return synchronizeIdentityKeys()
      .then(() => {
        return getKey({alg: 'RS256', kid: '264479401285013507', typ: 'JWT'}, (_, publicKey) => {
          publicKey?.should.type('object');
        });
      });
  });

  it('should fail - failed creation public key', () => {
    return getKey({alg: 'RS256', kid: '264479401285013505', typ: 'JWT'}, (error, _) => {
      error?.message.should.be.equal('Error to synchronize keys :(');
    });
  });
});
