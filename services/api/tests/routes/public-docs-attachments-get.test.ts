import 'mocha';
import 'should';
import { Application } from 'express';
import request from 'supertest';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  ATT_ID, QUERY_SUBJECT_PREFIX as Q, docsAvailable, docsNotInstalled, docsUnavailable, failure, success,
} from '../helpers/docs-module';
import {
  PUBLIC_URL, TOKEN, UA, publicGet, resetPublicRateLimit, shouldHavePublicHeaders,
} from '../helpers/public-docs';
import { docsModule } from '../../lib/modules/registry';

const URL = '/p/docs/' + TOKEN + '/attachments/' + ATT_ID;
const TICKET = { downloadUrl: 'https://s3.example/att?sig=1', expiresIn: 300 };

describe('GET /p/docs/:token/attachments/:id (S-080)', () => {
  let application: Application;
  let saved: string | undefined;
  let notFoundText = '';
  before(() => { application = start(); });
  beforeEach(async () => {
    saved = process.env.JIKU_PUBLIC_URL;
    process.env.JIKU_PUBLIC_URL = PUBLIC_URL;
    resetPublicRateLimit();
    await docsAvailable();
    fakeBus.moduleReply('shares.resolve', failure('share_not_found', 'm'));
    notFoundText = (await publicGet(application, '/p/docs/abc')).text;
  });
  afterEach(() => {
    docsModule.stop();
    if (saved === undefined) delete process.env.JIKU_PUBLIC_URL; else process.env.JIKU_PUBLIC_URL = saved;
  });

  it('S-080 · TS-14: adjunto, 302 sin cuerpo y sin actor', async () => {
    fakeBus.moduleReply('shares.attachment', success(TICKET));
    const res = await publicGet(application, URL);
    res.status.should.equal(302);
    res.headers.location.should.equal(TICKET.downloadUrl);
    res.text.should.equal('');
    shouldHavePublicHeaders(res);
    fakeBus.lastModule!.should.deepEqual({
      kind: 'query', method: 'shares.attachment', subject: Q + 'shares.attachment',
      payload: { token: TOKEN, attachmentId: ATT_ID, client: { ip: '::ffff:127.0.0.1', userAgent: UA } },
    });
  });

  it('S-080 · TS-15: adjunto inválido es el mismo 404', async () => {
    for (const code of ['share_not_found', 'caller_not_authorized']) {
      fakeBus.moduleReply('shares.attachment', failure(code, 'm'));
      const res = await publicGet(application, URL);
      res.status.should.equal(404);
      res.text.should.equal(notFoundText);
      shouldHavePublicHeaders(res);
    }

    fakeBus.moduleSent.length = 0;
    const bad = [
      '/p/docs/' + TOKEN + '/attachments/abc',
      '/p/docs/' + TOKEN + '/attachments/' + ATT_ID + '.%3E',
      '/p/docs/jds_corto/attachments/' + ATT_ID,
    ];
    for (const url of bad) {
      const res = await publicGet(application, url);
      res.status.should.equal(404);
      res.text.should.equal(notFoundText);
      shouldHavePublicHeaders(res);
    }
    const other = await request(application).get(URL).set('Host', 'localhost:3001');
    other.status.should.equal(404);
    other.text.should.equal(notFoundText);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-080 · TS-16: módulo no instalado es 404 y caído es 503 (ruta 25)', async () => {
    docsModule.stop();
    await fakeBus.kvDelete('docs');
    await docsNotInstalled();
    fakeBus.moduleSent.length = 0;
    const a = await publicGet(application, URL);
    a.status.should.equal(404);
    a.text.should.equal(notFoundText);

    docsModule.stop();
    await docsUnavailable();
    const b = await publicGet(application, URL);
    b.status.should.equal(503);
    b.text.should.containEql('El documento no está disponible en este momento');
    shouldHavePublicHeaders(b);
    fakeBus.moduleSent.length.should.equal(0);
  });
});
