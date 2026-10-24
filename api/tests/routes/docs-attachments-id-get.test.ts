import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  ATT_ID, COMMAND_SUBJECT_PREFIX as C, docsAvailable, failure, itRespectsModuleState, success,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const METHOD = `attachments.${ATT_ID}.request-download`;
const TICKET = { id: ATT_ID, downloadUrl: 'https://s3.example/att?sig=1', expiresIn: 300 };

describe('GET /api/docs/attachments/:id (S-078)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  const get = (url: string, token = 'token_01_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`).redirects(0);
  const URL = `/api/docs/attachments/${ATT_ID}`;

  it('S-078 · TS-25: redirección', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success(TICKET));
    const res = await get(URL);
    res.status.should.equal(302);
    res.headers.location.should.equal(TICKET.downloadUrl);
    res.headers['x-content-type-options'].should.equal('nosniff');
    res.headers.should.not.have.property('content-disposition');
    res.text.should.equal('');
    fakeBus.lastModule!.should.deepEqual({
      kind: 'command', method: METHOD, subject: C + METHOD, payload: { actor: { id: 'zitadel-sub-01' } },
    });
  });

  it('S-078 · TS-26: adjunto no legible', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, failure('attachment_not_found', 'Adjunto no encontrado'));
    const res = await get(URL);
    res.status.should.equal(404);
    res.body.should.deepEqual({ code: 'attachment_not_found', message: 'Adjunto no encontrado' });
  });

  it('S-078 · TS-27: inyección en el subject', async () => {
    await docsAvailable();
    for (const id of [`${ATT_ID}.%3E`, '%2A', 'abc']) {
      const res = await get(`/api/docs/attachments/${id}`);
      res.status.should.equal(404);
      res.body.should.deepEqual({ code: 'attachment_not_found', message: 'Adjunto no encontrado' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · TS-28: HEAD del adjunto', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success(TICKET));
    const res = await request(application).head(URL).set('Authorization', 'Bearer token_01_user').redirects(0);
    res.status.should.equal(302);
    res.headers.location.should.equal(TICKET.downloadUrl);
  });

  it('S-078 · rol rechazado', async () => {
    await docsAvailable();
    (await get(URL, 'token_04_external_user')).status.should.equal(403);
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_01_user');
});
