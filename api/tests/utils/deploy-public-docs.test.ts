import 'mocha';
import 'should';
import { readFileSync } from 'fs';
import * as path from 'path';
import { assertPublicUrlConfig, publicDocsHost } from '../../lib/modules/docs/public-url';
import { parseTrustProxy } from '../../lib/utils/trust-proxy';

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(path.join(REPO_ROOT, 'deploy', file), 'utf8');

/** Líneas (trim) del servicio `name`: desde `  name:` hasta el siguiente servicio o sección. */
function serviceLines(file: string, name: string): string[] {
  const lines = read(file).split('\n');
  const start = lines.findIndex((l) => l === `  ${name}:`);
  if (start < 0) throw new Error(`${file}: no existe el servicio ${name}`);
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^  [a-z][\w-]*:\s*$/.test(lines[i]) || /^[a-z]/.test(lines[i])) break;
    out.push(lines[i].trim());
  }
  return out;
}
const envLine = (lines: string[], variable: string) => lines.find((l) => l.startsWith(`- ${variable}=`));
const valueOf = (line: string | undefined) => (line || '').split('=').slice(1).join('=');

const PROD = 'docker-compose.yml';
const LOCAL = 'docker-compose.local.yml';
const DEV = 'docker-compose.dev.yml';

describe('S-080 · deploy: host público y trust proxy', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.JIKU_PUBLIC_URL;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.JIKU_PUBLIC_URL;
    else process.env.JIKU_PUBLIC_URL = saved;
  });

  it('S-080 · TS-1: .env.dist declara DOCS_PUBLIC_DOMAIN vacía', () => {
    read('.env.dist').split('\n').filter((l) => l === 'DOCS_PUBLIC_DOMAIN=').should.have.length(1);
  });

  it('S-080 · TS-2: .env.dist declara API_TRUST_PROXY vacía', () => {
    read('.env.dist').split('\n').filter((l) => l === 'API_TRUST_PROXY=').should.have.length(1);
  });

  it('S-080 · TS-3: .env.dist no declara JIKU_PUBLIC_URL', () => {
    read('.env.dist').split('\n').some((l) => l.startsWith('JIKU_PUBLIC_URL=')).should.be.false();
  });

  it('S-080 · TS-4: prod suma el host público a VIRTUAL_HOST y LETSENCRYPT_HOST con guarda', () => {
    const api = serviceLines(PROD, 'api');
    envLine(api, 'VIRTUAL_HOST')!.should.equal(
      '- VIRTUAL_HOST=api.${DOMAIN}${DOCS_PUBLIC_DOMAIN:+,${DOCS_PUBLIC_DOMAIN}}',
    );
    envLine(api, 'LETSENCRYPT_HOST')!.should.equal(
      '- LETSENCRYPT_HOST=api.${DOMAIN}${DOCS_PUBLIC_DOMAIN:+,${DOCS_PUBLIC_DOMAIN}}',
    );
    api.should.containEql('- VIRTUAL_PORT=3000');
  });

  it('S-080 · TS-5: prod arma JIKU_PUBLIC_URL con guarda', () => {
    envLine(serviceLines(PROD, 'api'), 'JIKU_PUBLIC_URL')!.should.equal(
      '- JIKU_PUBLIC_URL=${DOCS_PUBLIC_DOMAIN:+https://${DOCS_PUBLIC_DOMAIN}}',
    );
  });

  it('S-080 · TS-6: prod con API_TRUST_PROXY por defecto 1', () => {
    envLine(serviceLines(PROD, 'api'), 'API_TRUST_PROXY')!.should.equal('- API_TRUST_PROXY=${API_TRUST_PROXY:-1}');
  });

  it('S-080 · TS-7: local con JIKU_PUBLIC_URL fija y sin proxy', () => {
    const api = serviceLines(LOCAL, 'api');
    envLine(api, 'JIKU_PUBLIC_URL')!.should.equal('- JIKU_PUBLIC_URL=http://127.0.0.1:3100');
    api.should.containEql('- "3100:3000"');
    envLine(api, 'API_TRUST_PROXY')!.should.equal('- API_TRUST_PROXY=${API_TRUST_PROXY:-}');
  });

  it('S-080 · TS-8: dev con JIKU_PUBLIC_URL fija y sin proxy', () => {
    const api = serviceLines(DEV, 'api');
    envLine(api, 'JIKU_PUBLIC_URL')!.should.equal('- JIKU_PUBLIC_URL=http://127.0.0.1:3000');
    api.should.containEql('- "3000:3000"');
    envLine(api, 'API_TRUST_PROXY')!.should.equal('- API_TRUST_PROXY=${API_TRUST_PROXY:-}');
  });

  it('S-080 · TS-9: las variables llegan solo a la api, una vez', () => {
    for (const file of [PROD, LOCAL, DEV]) {
      const all = read(file).split('\n').map((l) => l.trim());
      const api = serviceLines(file, 'api');
      for (const v of ['JIKU_PUBLIC_URL', 'API_TRUST_PROXY']) {
        all.filter((l) => l.startsWith(`- ${v}=`)).should.have.length(1);
        api.filter((l) => l.startsWith(`- ${v}=`)).should.have.length(1);
      }
    }
    const lineMatches = (file: string) =>
      read(file).split('\n').filter((l) => !l.trim().startsWith('#') && l.includes('DOCS_PUBLIC_DOMAIN'));
    lineMatches(LOCAL).should.have.length(0);
    lineMatches(DEV).should.have.length(0);
    const prodAll = lineMatches(PROD);
    const prodApi = serviceLines(PROD, 'api').filter((l) => !l.startsWith('#') && l.includes('DOCS_PUBLIC_DOMAIN'));
    prodAll.should.have.length(3);
    prodApi.should.have.length(3);
  });

  it('S-080 · TS-10: los fronts no se publican en el host público', () => {
    const web = serviceLines(PROD, 'web');
    web.should.containEql('- VIRTUAL_HOST=${DOMAIN}');
    web.should.containEql('- LETSENCRYPT_HOST=${DOMAIN}');
    const opus = serviceLines(PROD, 'opus-web');
    opus.should.containEql('- VIRTUAL_HOST=${OPUS_DOMAIN}');
    opus.should.containEql('- LETSENCRYPT_HOST=${OPUS_DOMAIN}');
  });

  it('S-080 · TS-11: los valores fijos de local/dev son válidos y su host difiere de localhost', () => {
    const cases: Array<[string, string, string]> = [
      [LOCAL, '127.0.0.1:3100', 'localhost:3100'],
      [DEV, '127.0.0.1:3000', 'localhost:3000'],
    ];
    for (const [file, host, app] of cases) {
      process.env.JIKU_PUBLIC_URL = valueOf(envLine(serviceLines(file, 'api'), 'JIKU_PUBLIC_URL'));
      (() => assertPublicUrlConfig()).should.not.throw();
      publicDocsHost()!.should.equal(host);
      publicDocsHost()!.should.not.equal(app);
    }
  });

  it('S-080 · TS-12: los valores de producción son válidos y https:// pelado no', () => {
    process.env.JIKU_PUBLIC_URL = '';
    (() => assertPublicUrlConfig()).should.not.throw();
    (publicDocsHost() === null).should.be.true();
    process.env.JIKU_PUBLIC_URL = 'https://docs.example.com';
    (() => assertPublicUrlConfig()).should.not.throw();
    publicDocsHost()!.should.equal('docs.example.com');
    process.env.JIKU_PUBLIC_URL = 'https://';
    (() => assertPublicUrlConfig()).should.throw(/JIKU_PUBLIC_URL/);
    parseTrustProxy('1')!.should.equal(1);
  });
});
