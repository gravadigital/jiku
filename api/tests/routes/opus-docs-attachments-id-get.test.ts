import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { ATT_ID, docsAvailable, failure, itRespectsModuleState, success } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const METHOD = `attachments.${ATT_ID}.request-download`;
const TICKET = { id: ATT_ID, downloadUrl: 'https://s3.example/att?sig=1', expiresIn: 300 };

describe('GET /api/opus/docs/attachments/:id (S-078)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  const get = (url: string, token = 'token_04_external_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`).redirects(0);
  const URL = `/api/opus/docs/attachments/${ATT_ID}`;

  it('S-078 · TS-42: adjunto del portal', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success(TICKET));
    const res = await get(URL);
    res.status.should.equal(302);
    res.headers.location.should.equal(TICKET.downloadUrl);
    res.headers['x-content-type-options'].should.equal('nosniff');
    (fakeBus.lastModule!.payload as any).should.deepEqual({ actor: { id: 'zitadel-sub-04' } });

    fakeBus.moduleReply(METHOD, failure('attachment_not_found', 'Adjunto no encontrado'));
    const nf = await get(URL);
    nf.status.should.equal(404);
    nf.body.code.should.equal('attachment_not_found');

    fakeBus.reset();
    const bad = await get('/api/opus/docs/attachments/abc');
    bad.status.should.equal(404);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · TS-43: rol rechazado', async () => {
    await docsAvailable();
    const res = await get(URL, 'token_08_no_roles');
    res.status.should.equal(403);
    res.body.code.should.equal('access_denied');
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_04_external_user');
});
