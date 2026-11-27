import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  COMMAND_SUBJECT_PREFIX as C, SHARE_ID, docsAvailable, failure, itRespectsModuleState, success,
  expectedActor,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const ACTOR = { actor: expectedActor('token_01_user') };

const METHOD = `shares.${SHARE_ID}.revoke`;
const URL = `/api/docs/shares/${SHARE_ID}`;

describe('DELETE /api/docs/shares/:id (S-079)', () => {
  let application: Application;
  let saved: string | undefined;
  before(() => { application = start(); });
  beforeEach(() => { saved = process.env.JIKU_PUBLIC_URL; });
  afterEach(() => {
    docsModule.stop();
    if (saved === undefined) delete process.env.JIKU_PUBLIC_URL; else process.env.JIKU_PUBLIC_URL = saved;
  });
  const call = (url: string = URL, token = 'token_01_user') =>
    request(application).delete(url).set('Authorization', `Bearer ${token}`);

  it('S-079 · TS-38: revocar, también sin JIKU_PUBLIC_URL', async () => {
    delete process.env.JIKU_PUBLIC_URL;
    await docsAvailable();
    const data = { id: SHARE_ID, revokedAt: '2026-10-24T15:00:00.000Z' };
    fakeBus.moduleReply(METHOD, success(data));
    const res = await call();
    res.status.should.equal(200);
    res.body.should.deepEqual(data);
    fakeBus.lastModule!.subject.should.equal(C + METHOD);
    fakeBus.lastModule!.payload.should.deepEqual(ACTOR);
    fakeBus.moduleReply(METHOD, failure('share_not_found', 'm'));
    const nf = await call();
    nf.status.should.equal(404);
    nf.body.should.deepEqual({ code: 'share_not_found', message: 'm' });
    const sent = fakeBus.moduleSent.length;
    const bad = await call('/api/docs/shares/abc');
    bad.status.should.equal(404);
    bad.body.should.deepEqual({ code: 'share_not_found', message: 'Link compartido no encontrado' });
    fakeBus.moduleSent.length.should.equal(sent);
  });

  it('S-079 · TS-8: rol rechazado', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      const res = await call(URL, token);
      res.status.should.equal(403);
      res.body.should.deepEqual({ code: 'access_denied', message: 'Access denied' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_01_user', 'S-079 · TS-46: respeta el estado del módulo', { method: 'delete' });
});
