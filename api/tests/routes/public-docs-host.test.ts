import 'mocha';
import 'should';
import sinon from 'sinon';
import { Application } from 'express';
import request from 'supertest';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { ATT_ID, docsAvailable, failure, success } from '../helpers/docs-module';
import {
  PUBLIC_HOST, PUBLIC_URL, RESOLVED, TOKEN, UA, publicGet, resetPublicRateLimit, shouldHavePublicHeaders,
} from '../helpers/public-docs';
import { docsModule } from '../../lib/modules/registry';
import logger from '../../lib/logger';

const URL = '/p/docs/' + TOKEN;

describe('/p/docs/*: host público, rate limit y log (S-080)', () => {
  let application: Application;
  let savedUrl: string | undefined;
  let savedProxy: string | undefined;
  let notFoundText = '';
  before(async () => {
    savedUrl = process.env.JIKU_PUBLIC_URL;
    savedProxy = process.env.API_TRUST_PROXY;
    process.env.JIKU_PUBLIC_URL = PUBLIC_URL;
    delete process.env.API_TRUST_PROXY;
    application = start();
    await docsAvailable();
    fakeBus.moduleReply('shares.resolve', failure('share_not_found', 'm'));
    notFoundText = (await publicGet(application, URL)).text;
    docsModule.stop();
  });
  after(() => {
    if (savedUrl === undefined) delete process.env.JIKU_PUBLIC_URL; else process.env.JIKU_PUBLIC_URL = savedUrl;
    if (savedProxy === undefined) delete process.env.API_TRUST_PROXY; else process.env.API_TRUST_PROXY = savedProxy;
  });
  beforeEach(async () => {
    process.env.JIKU_PUBLIC_URL = PUBLIC_URL;
    resetPublicRateLimit();
    await docsAvailable();
  });
  afterEach(() => {
    docsModule.stop();
    sinon.restore();
    process.env.JIKU_PUBLIC_URL = PUBLIC_URL;
    resetPublicRateLimit();
  });

  const expect404 = (res: request.Response) => {
    res.status.should.equal(404);
    res.text.should.equal(notFoundText);
    shouldHavePublicHeaders(res);
  };

  it('S-080 · TS-8: sin JIKU_PUBLIC_URL es 404 sin llamar al bus', async () => {
    for (const value of [undefined, '   ']) {
      if (value === undefined) delete process.env.JIKU_PUBLIC_URL; else process.env.JIKU_PUBLIC_URL = value;
      expect404(await publicGet(application, URL));
      expect404(await request(application).get(URL));
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-080 · TS-9: host distinto es 404 sin llamar al bus', async () => {
    expect404(await request(application).get(URL).set('Host', 'localhost:3001'));
    expect404(await request(application).get(URL).set('Host', '127.0.0.1:3101'));
    expect404(await request(application).get(URL).set('Host', 'localhost:3001').set('X-Forwarded-Host', PUBLIC_HOST));
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-080 · TS-10: el host coincide con puerto por defecto y sin distinguir mayúsculas', async () => {
    process.env.JIKU_PUBLIC_URL = 'https://docs.example.com/';
    fakeBus.moduleReply('shares.resolve', success(RESOLVED));
    for (const host of ['docs.example.com', 'DOCS.Example.com']) {
      (await request(application).get(URL).set('Host', host)).status.should.equal(200);
    }
  });

  it('S-080 · TS-11: el pedido 61 en un minuto es 429', async () => {
    fakeBus.moduleReply('shares.resolve', success(RESOLVED));
    for (let i = 0; i < 60; i++) {
      (await publicGet(application, '/p/docs/abc')).status.should.equal(404);
    }
    const res = await publicGet(application, URL);
    res.status.should.equal(429);
    res.text.should.containEql('<title>Demasiados intentos</title>');
    res.text.should.containEql('Esperá un minuto y volvé a intentar.');
    shouldHavePublicHeaders(res);
    res.text.should.not.containEql('Jiku');
    res.text.should.not.containEql('Grava');
    fakeBus.moduleSent.length.should.equal(0);

    resetPublicRateLimit();
    (await publicGet(application, URL)).status.should.equal(200);
  });

  it('S-080 · TS-12: el host equivocado no consume cupo y las dos rutas comparten cupo', async () => {
    for (let i = 0; i < 61; i++) {
      (await request(application).get('/p/docs/abc').set('Host', 'localhost:3001')).status.should.equal(404);
    }
    fakeBus.moduleReply('shares.resolve', success(RESOLVED));
    (await publicGet(application, URL)).status.should.equal(200);

    resetPublicRateLimit();
    for (let i = 0; i < 30; i++) await publicGet(application, '/p/docs/abc');
    for (let i = 0; i < 30; i++) await publicGet(application, '/p/docs/abc/attachments/x');
    (await publicGet(application, URL)).status.should.equal(429);
  });

  it('S-080 · TS-18: el host público no sirve nada que no sea /p/docs/*', async () => {
    const auth = 'Bearer token_01_user';
    const at = (r: request.Test) => r.set('Host', PUBLIC_HOST);
    expect404(await at(request(application).get('/api/modules')).set('Authorization', auth));
    expect404(await at(request(application).get('/api/clients')));
    expect404(await at(request(application).post('/api/clients')).set('Authorization', auth).send({ name: 'X' }));
    expect404(await at(request(application).options('/api/clients')));
    expect404(await at(request(application).get('/')));
    expect404(await at(request(application).get('/p/docs')));
    expect404(await at(request(application).post(URL)));
    expect404(await at(request(application).put(URL)));
    fakeBus.sent.length.should.equal(0);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-080 · TS-26: cualquier otro /p/docs/* es el mismo 404', async () => {
    for (const url of [URL + '/foo', URL + '/attachments', URL + '/attachments/' + ATT_ID + '/x']) {
      expect404(await publicGet(application, url));
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  describe('con API_TRUST_PROXY=1', () => {
    let proxied: Application;
    before(() => {
      process.env.API_TRUST_PROXY = '1';
      proxied = start();
    });
    after(() => { delete process.env.API_TRUST_PROXY; });

    it('S-080 · TS-13: trust proxy separa visitantes y propaga la IP real', async () => {
      const from = (ip: string, url = '/p/docs/abc') => publicGet(proxied, url).set('X-Forwarded-For', ip);
      for (let i = 0; i < 60; i++) await from('203.0.113.7');
      (await from('203.0.113.7')).status.should.equal(429);
      (await from('203.0.113.8')).status.should.not.equal(429);

      fakeBus.moduleReply('shares.resolve', success(RESOLVED));
      (await from('203.0.113.9', URL)).status.should.equal(200);
      (fakeBus.lastModule!.payload as any).client.ip.should.equal('203.0.113.9');
    });

    it('S-080 · TS-9: X-Forwarded-Host no habilita la ruta', async () => {
      const res = await request(proxied).get(URL).set('Host', 'localhost:3001').set('X-Forwarded-Host', PUBLIC_HOST);
      expect404(res);
      fakeBus.moduleSent.length.should.equal(0);
    });
  });

  it('S-080 · TS-22: el token no aparece en ningún log', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((m) => sinon.spy(logger, m));
    fakeBus.moduleReply('shares.resolve', success(RESOLVED));
    fakeBus.moduleReply('shares.attachment', success({ downloadUrl: 'https://s3.example/att?sig=1', expiresIn: 300 }));

    await publicGet(application, URL); // 200
    fakeBus.moduleReply('shares.resolve', failure('share_not_found', 'm'));
    await publicGet(application, URL); // 404
    await publicGet(application, '/p/docs/' + TOKEN + '/attachments/01JB2Z3K4M5N6P7Q8R9S0T1V2Y'); // 302
    fakeBus.moduleFailWithTimeout();
    await publicGet(application, URL); // 503
    for (let i = 0; i < 60; i++) await publicGet(application, '/p/docs/abc');
    await publicGet(application, URL); // 429
    delete process.env.JIKU_PUBLIC_URL;
    await publicGet(application, URL); // host

    await new Promise((resolve) => setImmediate(resolve));
    const logged = JSON.stringify(spies.map((s) => s.args));
    for (const forbidden of [TOKEN, 'sig=', UA, 'Acta de kickoff', '::ffff:127.0.0.1']) {
      logged.should.not.containEql(forbidden);
    }
    const lines = spies.flatMap((s) => s.args.map((a) => String(a[0])));
    lines.some((l) => /^GET \/p\/docs\/jds_… 200 \d+ms$/.test(l)).should.be.true();
    lines.some((l) => /^GET \/p\/docs\/jds_… 404 \d+ms$/.test(l)).should.be.true();
    lines.some((l) => /^GET \/p\/docs\/jds_…\/attachments\/01JB2Z3K4M5N6P7Q8R9S0T1V2Y 302 \d+ms$/.test(l)).should.be.true();
    const level = (re: RegExp) => spies.findIndex((s) => s.args.some((a) => re.test(String(a[0]))));
    (['log', 'info', 'warn', 'error'] as const)[level(/ 404 \d+ms$/)].should.equal('warn');
    (['log', 'info', 'warn', 'error'] as const)[level(/ 503 \d+ms$/)].should.equal('error');
    (['log', 'info', 'warn', 'error'] as const)[level(/ 302 \d+ms$/)].should.equal('info');
    (['log', 'info', 'warn', 'error'] as const)[level(/ 200 \d+ms$/)].should.equal('info');
  });
});
