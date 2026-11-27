import 'mocha';
import 'should';
import sinon from 'sinon';
import { Application } from 'express';
import request from 'supertest';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { DOC_ID, docsAvailable, failure, success } from '../helpers/docs-module';
import {
  PUBLIC_HOST, PUBLIC_URL, RESOLVED, TOKEN, UA, publicGet, resetPublicRateLimit, shouldHavePublicHeaders,
} from '../helpers/public-docs';
import { docsModule } from '../../lib/modules/registry';

const ORIGIN = 'https://otro.example';
const URL = '/p/docs/' + TOKEN;
const METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE';

function shouldHaveNoCors(res: request.Response) {
  (res.headers['access-control-allow-origin'] === undefined).should.be.true();
  (res.headers['access-control-allow-methods'] === undefined).should.be.true();
  (res.headers['access-control-allow-headers'] === undefined).should.be.true();
}

describe('CORS (S-091)', () => {
  let application: Application;
  let saved: string | undefined;
  before(() => { application = start(); });
  beforeEach(() => {
    saved = process.env.JIKU_PUBLIC_URL;
    resetPublicRateLimit();
  });
  afterEach(() => {
    docsModule.stop();
    sinon.restore();
    if (saved === undefined) delete process.env.JIKU_PUBLIC_URL; else process.env.JIKU_PUBLIC_URL = saved;
  });

  describe('/p/docs/* sin CORS', () => {
    beforeEach(() => { process.env.JIKU_PUBLIC_URL = PUBLIC_URL; });

    it('S-091 · TS-1: GET del link desde otro origen', async () => {
      await docsAvailable();
      fakeBus.moduleReply('shares.resolve', success(RESOLVED));
      const res = await publicGet(application, URL).set('Origin', ORIGIN);
      res.status.should.equal(200);
      res.headers['content-type'].should.startWith('text/html');
      shouldHaveNoCors(res);
      shouldHavePublicHeaders(res);
      res.text.should.containEql(RESOLVED.html);
    });

    it('S-091 · TS-2: HEAD del link desde otro origen', async () => {
      await docsAvailable();
      fakeBus.moduleReply('shares.resolve', success(RESOLVED));
      const res = await request(application).head(URL).set('Host', PUBLIC_HOST).set('User-Agent', UA)
        .set('Origin', ORIGIN);
      res.status.should.equal(200);
      shouldHaveNoCors(res);
    });

    it('S-091 · TS-3: link inválido desde otro origen', async () => {
      await docsAvailable();
      fakeBus.moduleReply('shares.resolve', failure('share_not_found', 'Link no encontrado'));
      const res = await publicGet(application, URL).set('Origin', ORIGIN);
      res.status.should.equal(404);
      shouldHaveNoCors(res);
      shouldHavePublicHeaders(res);
    });

    it('S-091 · TS-4: preflight en el host público', async () => {
      const res = await request(application).options(URL).set('Host', PUBLIC_HOST).set('Origin', ORIGIN)
        .set('Access-Control-Request-Method', 'GET');
      res.status.should.equal(404);
      shouldHaveNoCors(res);
      fakeBus.moduleSent.length.should.equal(0);
    });

    it('S-091 · TS-5: preflight fuera del host público', async () => {
      const res = await request(application).options(URL).set('Origin', ORIGIN)
        .set('Access-Control-Request-Method', 'GET').set('Access-Control-Request-Headers', 'content-type');
      res.status.should.equal(404);
      shouldHaveNoCors(res);
      shouldHavePublicHeaders(res);
      fakeBus.moduleSent.length.should.equal(0);
    });

    it('S-091 · TS-10: /api en el host público sigue siendo 404 sin CORS', async () => {
      const res = await request(application).get('/api/modules').set('Host', PUBLIC_HOST)
        .set('Authorization', 'Bearer token_01_user').set('Origin', ORIGIN);
      res.status.should.equal(404);
      shouldHavePublicHeaders(res);
      shouldHaveNoCors(res);
    });
  });

  describe('/api con CORS', () => {
    beforeEach(() => { delete process.env.JIKU_PUBLIC_URL; });

    it('S-091 · TS-6: GET autenticado con Origin', async () => {
      const res = await request(application).get('/api/modules')
        .set('Authorization', 'Bearer token_01_user').set('Origin', ORIGIN);
      res.status.should.equal(200);
      res.headers['access-control-allow-origin'].should.equal('*');
      res.body.should.deepEqual([{ module: 'docs', status: 'not_installed' }]);
    });

    it('S-091 · TS-7: preflight', async () => {
      const res = await request(application).options('/api/modules').set('Origin', ORIGIN)
        .set('Access-Control-Request-Method', 'GET').set('Access-Control-Request-Headers', 'authorization');
      res.status.should.equal(204);
      res.headers['access-control-allow-origin'].should.equal('*');
      res.headers['access-control-allow-methods'].should.equal(METHODS);
      res.headers['access-control-allow-headers'].should.equal('authorization');
    });

    it('S-091 · TS-8: el 401 lleva CORS', async () => {
      const res = await request(application).get('/api/modules').set('Origin', ORIGIN);
      res.status.should.equal(401);
      res.body.should.deepEqual({ code: 'unauthorized', message: 'Unauthorized' });
      res.headers['access-control-allow-origin'].should.equal('*');
    });

    it('S-091 · TS-9: preflight de escritura de docs', async () => {
      const res = await request(application).options('/api/docs/documents/' + DOC_ID).set('Origin', ORIGIN)
        .set('Access-Control-Request-Method', 'PUT')
        .set('Access-Control-Request-Headers', 'authorization,content-type');
      res.status.should.equal(204);
      res.headers['access-control-allow-origin'].should.equal('*');
      res.headers['access-control-allow-methods'].should.equal(METHODS);
      res.headers['access-control-allow-headers'].should.equal('authorization,content-type');
      fakeBus.moduleSent.length.should.equal(0);
    });
  });
});
