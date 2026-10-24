import 'should';

import { reload } from './helpers/reload';

const { generateUlid } = reload({});

describe('nats-protocol · generateUlid (movido desde core, REQ-016 / S-077)', () => {
  it('TS-199: generateUlid está exportado', () => {
    (typeof reload({}).generateUlid).should.equal('function');
  });

  it('TS-200: prefijos de tiempo fijos (misma implementación que core)', () => {
    generateUlid(0).slice(0, 10).should.equal('0000000000');
    generateUlid(1_700_000_000_000).slice(0, 10).should.equal('01HF7YAT00');
    generateUlid(1_800_000_000_000).slice(0, 10).should.equal('01MCC5RM00');
    generateUlid(281_474_976_710_655).slice(0, 10).should.equal('7ZZZZZZZZZ');
  });

  it('TS-201: 26 caracteres del alfabeto Crockford base32', () => {
    const id = generateUlid();
    id.length.should.equal(26);
    id.should.match(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('TS-202: 1000 generaciones son únicas y ordenables en el tiempo', () => {
    const ids: string[] = [];
    for (let i = 0; i < 1000; i++) ids.push(generateUlid());
    new Set(ids).size.should.equal(1000);
    for (let i = 1; i < ids.length; i++) {
      (ids[i].slice(0, 10) >= ids[i - 1].slice(0, 10)).should.equal(true);
    }
  });

  it('TS-203: dos ULIDs del mismo milisegundo son distintos', () => {
    const now = Date.now();
    const a = generateUlid(now);
    const b = generateUlid(now);
    a.should.not.equal(b);
    a.slice(0, 10).should.equal(b.slice(0, 10));
  });

  it('TS-204: el prefijo crece con el timestamp', () => {
    const early = generateUlid(1_700_000_000_000);
    const late = generateUlid(1_800_000_000_000);
    (late.slice(0, 10) > early.slice(0, 10)).should.equal(true);
  });
});
