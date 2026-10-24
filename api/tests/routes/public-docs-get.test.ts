import 'mocha';
import 'should';
import nock from 'nock';
import sinon from 'sinon';
import { Application } from 'express';
import request from 'supertest';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  QUERY_SUBJECT_PREFIX as Q, docsAvailable, docsNotInstalled, docsUnavailable, failure, success,
} from '../helpers/docs-module';
import {
  PUBLIC_HOST, PUBLIC_URL, RESOLVED, TOKEN, UA, publicGet, resetPublicRateLimit, shouldHavePublicHeaders,
} from '../helpers/public-docs';
import { docsModule } from '../../lib/modules/registry';
import logger from '../../lib/logger';

const URL = '/p/docs/' + TOKEN;
const DOWN = 'El documento no está disponible en este momento';

describe('GET /p/docs/:token (S-080)', () => {
  let application: Application;
  let saved: string | undefined;
  let notFoundText = '';
  before(() => { application = start(); });
  beforeEach(async () => {
    saved = process.env.JIKU_PUBLIC_URL;
    process.env.JIKU_PUBLIC_URL = PUBLIC_URL;
    resetPublicRateLimit();
    await docsAvailable();
  });
  afterEach(() => {
    docsModule.stop();
    nock.cleanAll();
    sinon.restore();
    if (saved === undefined) delete process.env.JIKU_PUBLIC_URL; else process.env.JIKU_PUBLIC_URL = saved;
  });

  async function reference404() {
    fakeBus.moduleReply('shares.resolve', failure('share_not_found', 'Link no encontrado'));
    const res = await publicGet(application, URL);
    notFoundText = res.text;
    return res;
  }

  it('S-080 · TS-1: lectura anónima (camino feliz)', async () => {
    fakeBus.moduleReply('shares.resolve', success(RESOLVED));
    const res = await publicGet(application, URL);
    res.status.should.equal(200);
    res.headers['content-type'].should.startWith('text/html');
    res.headers['content-type'].should.containEql('charset=utf-8');
    shouldHavePublicHeaders(res);
    res.text.should.containEql(RESOLVED.html);
    res.text.should.containEql('<title>Acta de kickoff</title>');
    res.text.should.containEql('<meta name="robots" content="noindex">');
    res.text.should.containEql('<html lang="es">');
    res.text.should.not.containEql('<script');
    fakeBus.lastModule!.should.deepEqual({
      kind: 'query', method: 'shares.resolve', subject: Q + 'shares.resolve',
      payload: { token: TOKEN, client: { ip: '::ffff:127.0.0.1', userAgent: UA } },
    });
    fakeBus.sent.length.should.equal(0);
  });

  it('S-080 · TS-2: título escapado, html sin re-sanitizar', async () => {
    fakeBus.moduleReply('shares.resolve', success({
      ...RESOLVED, title: '</title><script>alert(1)</script> & "Acme"', html: '<p onclick="x">hola</p>',
    }));
    const res = await publicGet(application, URL);
    res.status.should.equal(200);
    res.text.should.containEql('<title>&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Acme&quot;</title>');
    res.text.should.not.containEql('<script>alert(1)</script>');
    res.text.should.containEql('<p onclick="x">hola</p>');
  });

  it('S-080 · TS-3: htmlUrl se descarga e incrusta; html gana si vienen los dos', async () => {
    const scope = nock('https://s3.example').get('/share.html').query({ sig: '1' })
      .reply(200, '<p>contenido grande</p>', { 'Content-Type': 'text/html' });
    fakeBus.moduleReply('shares.resolve', success({ ...RESOLVED, html: undefined, htmlUrl: 'https://s3.example/share.html?sig=1' }));
    const res = await publicGet(application, URL);
    res.status.should.equal(200);
    res.text.should.containEql('<p>contenido grande</p>');
    res.text.should.containEql('<title>Acta de kickoff</title>');
    scope.isDone().should.be.true();
    shouldHavePublicHeaders(res);

    nock.cleanAll();
    const unused = nock('https://s3.example').get('/share.html').query(true).reply(200, 'x');
    fakeBus.moduleReply('shares.resolve', success({ ...RESOLVED, htmlUrl: 'https://s3.example/share.html?sig=1' }));
    const both = await publicGet(application, URL);
    both.text.should.containEql(RESOLVED.html);
    unused.isDone().should.be.false();
  });

  it('S-080 · TS-4: falla de la descarga de htmlUrl, o reply sin cuerpo, es 503 sin filtrar la URL', async () => {
    const errorSpy = sinon.spy(logger, 'error');
    const withUrl = (url: string) =>
      fakeBus.moduleReply('shares.resolve', success({ ...RESOLVED, html: undefined, htmlUrl: url }));
    const url = 'https://s3.example/share.html?sig=1';
    const host = () => nock('https://s3.example').get('/share.html').query({ sig: '1' });

    const cases: Array<() => void> = [
      () => { withUrl(url); host().reply(403); },
      () => { withUrl(url); host().reply(200, 'x'.repeat(5 * 1024 * 1024 + 1)); },
      () => { withUrl(url); host().replyWithError(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })); },
      () => withUrl('ftp://x/y'),
      () => fakeBus.moduleReply('shares.resolve', success({ ...RESOLVED, html: undefined })),
    ];
    for (const setup of cases) {
      nock.cleanAll();
      resetPublicRateLimit();
      setup();
      const res = await publicGet(application, URL);
      res.status.should.equal(503);
      res.text.should.containEql(DOWN);
      res.text.should.containEql('Probá de nuevo en unos minutos.');
      shouldHavePublicHeaders(res);
    }
    errorSpy.args.some((a) => JSON.stringify(a).includes('s3.example') || JSON.stringify(a).includes('sig=')).should.be.false();
  });

  it('S-080 · TS-5: sin cookies ni marca en la página ni en las de excepción', async () => {
    fakeBus.moduleReply('shares.resolve', success(RESOLVED));
    const ok = await publicGet(application, URL);
    (ok.headers['set-cookie'] === undefined).should.be.true();
    const pages = [ok.text];
    pages.push((await reference404()).text);
    docsModule.stop();
    await docsUnavailable();
    pages.push((await publicGet(application, URL)).text);
    for (const text of pages) {
      text.should.not.containEql('Jiku');
      text.should.not.containEql('Grava');
    }
  });

  it('S-080 · TS-6: token inexistente, vencido o revocado: 404 genérico', async () => {
    const errorSpy = sinon.spy(logger, 'error');
    const res = await reference404();
    res.status.should.equal(404);
    res.text.should.containEql('<title>Este link no está disponible</title>');
    res.text.should.containEql('Puede que haya vencido o que lo hayan revocado. Pedile un link nuevo a quien te lo compartió.');
    res.text.should.not.containEql('share_not_found');
    res.text.should.not.containEql('Link no encontrado');
    shouldHavePublicHeaders(res);
    errorSpy.called.should.be.false();
  });

  it('S-080 · TS-7: el 404 es idéntico para toda causa', async () => {
    await reference404();
    const errorSpy = sinon.spy(logger, 'error');
    for (const code of ['caller_not_authorized', 'invalid_fields', 'upstream_unavailable', 'codigo_nuevo']) {
      errorSpy.resetHistory();
      fakeBus.moduleReply('shares.resolve', failure(code, 'mensaje-secreto'));
      const res = await publicGet(application, URL);
      res.status.should.equal(404);
      res.text.should.equal(notFoundText);
      shouldHavePublicHeaders(res);
      const logged = JSON.stringify(errorSpy.args);
      logged.should.containEql(code);
      logged.should.not.containEql(TOKEN);
      logged.should.not.containEql('mensaje-secreto');
    }

    fakeBus.moduleSent.length = 0;
    for (const bad of ['abc', 'jds_corto', 'jds_' + 'A'.repeat(42) + '*', 'jds_' + 'A'.repeat(44)]) {
      const res = await publicGet(application, '/p/docs/' + encodeURIComponent(bad));
      res.status.should.equal(404);
      res.text.should.equal(notFoundText);
      shouldHavePublicHeaders(res);
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-080 · TS-16: módulo no instalado es 404; caído es 503; sin llamar al bus', async () => {
    await reference404();
    docsModule.stop();
    await fakeBus.kvDelete('docs');
    await docsNotInstalled();
    fakeBus.moduleSent.length = 0;
    const a = await publicGet(application, URL);
    a.status.should.equal(404);
    a.text.should.equal(notFoundText);
    shouldHavePublicHeaders(a);

    docsModule.stop();
    await docsUnavailable();
    const b = await publicGet(application, URL);
    b.status.should.equal(503);
    b.text.should.containEql(DOWN);
    shouldHavePublicHeaders(b);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-080 · TS-17: bus sin respuesta es 503', async () => {
    fakeBus.moduleFailWithTimeout();
    const a = await publicGet(application, URL);
    a.status.should.equal(503);
    a.text.should.containEql(DOWN);
    shouldHavePublicHeaders(a);

    fakeBus.pingResponds('jiku-docs', false);
    fakeBus.moduleFailWithNoResponders();
    const b = await publicGet(application, URL);
    b.status.should.equal(503);
    b.text.should.containEql(DOWN);
    docsModule.status().should.equal('unavailable');
  });

  it('S-080 · TS-21: la exención funciona en la app', async () => {
    fakeBus.moduleReply('shares.resolve', success(RESOLVED));
    (await publicGet(application, URL)).status.should.equal(200);

    const res = await request(application).post(URL);
    res.status.should.equal(401);
    res.body.should.deepEqual({ code: 'unauthorized', message: 'Unauthorized' });
  });

  it('S-080 · TS-19: el host de la aplicación no cambia', async () => {
    const api = await request(application).get('/api/modules').set('Authorization', 'Bearer token_01_user');
    api.status.should.equal(200);
    (await request(application).get('/api/clients')).status.should.equal(401);
    await reference404();
    const res = await request(application).get(URL);
    res.status.should.equal(404);
    res.text.should.equal(notFoundText);
    PUBLIC_HOST.should.not.equal('');
  });
});
