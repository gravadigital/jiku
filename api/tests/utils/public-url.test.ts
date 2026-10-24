import 'mocha';
import 'should';
import {
  assertPublicUrlConfig,
  isPublicHostRequest,
  maskPublicDocsUrl,
  publicDocsHost,
  PUBLIC_DOCS_PATH,
} from '../../lib/modules/docs/public-url';
import { docsFeatures } from '../../lib/modules/docs/features';

describe('S-080 · JIKU_PUBLIC_URL y host público', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.JIKU_PUBLIC_URL;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.JIKU_PUBLIC_URL;
    else process.env.JIKU_PUBLIC_URL = saved;
  });

  const set = (value: string | undefined) => {
    if (value === undefined) delete process.env.JIKU_PUBLIC_URL;
    else process.env.JIKU_PUBLIC_URL = value;
  };

  it('S-080 · TS-24: publicDocsHost y assertPublicUrlConfig', () => {
    const valid: Array<[string | undefined, string | null]> = [
      [undefined, null],
      ['', null],
      ['  ', null],
      ['http://127.0.0.1:3100', '127.0.0.1:3100'],
      ['https://Docs.Example.com/', 'docs.example.com'],
      ['https://docs.example.com:443', 'docs.example.com'],
    ];
    for (const [value, host] of valid) {
      set(value);
      (publicDocsHost() === host).should.be.true(`host de ${value}`);
      (() => assertPublicUrlConfig()).should.not.throw();
    }

    for (const value of ['notaurl', 'ftp://x.com', 'https://x.com/docs', 'https://x.com/?a=1', 'https://x.com/#f']) {
      set(value);
      (() => assertPublicUrlConfig()).should.throw(/JIKU_PUBLIC_URL/);
    }
  });

  it('S-080 · TS-27: publicDocsHost y docsFeatures no divergen', () => {
    for (const value of ['', '   ', 'http://127.0.0.1:3100']) {
      set(value);
      (publicDocsHost() !== null).should.equal(docsFeatures().sharing);
    }
  });

  it('isPublicHostRequest compara contra el Host crudo, sin distinguir mayúsculas', () => {
    set('https://docs.example.com/');
    isPublicHostRequest({ headers: { host: 'DOCS.Example.com' } } as any).should.be.true();
    isPublicHostRequest({ headers: { host: 'otro.com' } } as any).should.be.false();
    isPublicHostRequest({ headers: { host: 'otro.com', 'x-forwarded-host': 'docs.example.com' } } as any).should.be.false();
    set(undefined);
    isPublicHostRequest({ headers: { host: 'docs.example.com' } } as any).should.be.false();
  });

  it('maskPublicDocsUrl oculta el token y descarta la query', () => {
    maskPublicDocsUrl('/p/docs/jds_abc?x=1').should.equal('/p/docs/jds_…');
    maskPublicDocsUrl('/p/docs/jds_abc/attachments/01JB2Z3K4M5N6P7Q8R9S0T1V2Y?y').should.equal(
      '/p/docs/jds_…/attachments/01JB2Z3K4M5N6P7Q8R9S0T1V2Y'
    );
  });

  it('PUBLIC_DOCS_PATH exige al menos un carácter después de /p/docs/', () => {
    PUBLIC_DOCS_PATH.test('/p/docs/x').should.be.true();
    PUBLIC_DOCS_PATH.test('/P/DOCS/x').should.be.true();
    PUBLIC_DOCS_PATH.test('/p/docs/').should.be.false();
    PUBLIC_DOCS_PATH.test('/api/p/docs/x').should.be.false();
  });
});
