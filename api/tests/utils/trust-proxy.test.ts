import 'mocha';
import 'should';
import { parseTrustProxy } from '../../lib/utils/trust-proxy';

describe('S-080 · parseTrustProxy', () => {
  it('S-080 · TS-23: interpreta API_TRUST_PROXY', () => {
    const inputs = [undefined, '', '  ', '1', ' 2 ', 'true', 'false', 'loopback', '10.0.0.0/8, 127.0.0.1'];
    inputs.map((raw) => parseTrustProxy(raw)).should.deepEqual([
      undefined,
      undefined,
      undefined,
      1,
      2,
      true,
      false,
      'loopback',
      '10.0.0.0/8, 127.0.0.1',
    ]);
  });
});
