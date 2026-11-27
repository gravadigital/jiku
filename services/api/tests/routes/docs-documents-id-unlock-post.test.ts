import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  COMMAND_SUBJECT_PREFIX as C, DOC_ID, SESSION_ID, docsAvailable, failure, itRespectsModuleState, success,
  expectedActor,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const ACTOR = { actor: expectedActor('token_01_user') };

const METHOD = `documents.${DOC_ID}.unlock`;
const URL = `/api/docs/documents/${DOC_ID}/unlock`;
const BODY = { sessionId: SESSION_ID };

describe('POST /api/docs/documents/:id/unlock (S-079)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());
  const call = (body: any, token = 'token_01_user') =>
    request(application).post(URL).set('Authorization', `Bearer ${token}`).send(body);

  it('S-079 · TS-29: unlock (sin via ni force)', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success({ id: DOC_ID }));
    const res = await call(BODY);
    res.status.should.equal(200);
    res.body.should.deepEqual({ id: DOC_ID });
    fakeBus.lastModule!.subject.should.equal(C + METHOD);
    fakeBus.lastModule!.payload.should.deepEqual({ sessionId: SESSION_ID, ...ACTOR });
  });

  it('S-079 · TS-30: force no se expone; sesión sin lock', async () => {
    await docsAvailable();
    for (const body of [{ ...BODY, force: true }, {}]) {
      const res = await call(body);
      res.status.should.equal(400);
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(0);
    fakeBus.moduleReply(METHOD, failure('lock_not_held', 'La sesión no tiene el lock'));
    const res = await call(BODY);
    res.status.should.equal(409);
    res.body.should.deepEqual({ code: 'lock_not_held', message: 'La sesión no tiene el lock' });
  });

  it('S-079 · id malformado', async () => {
    await docsAvailable();
    const res = await request(application).post('/api/docs/documents/abc/unlock')
      .set('Authorization', 'Bearer token_01_user').send(BODY);
    res.status.should.equal(404);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-079 · TS-8: rol rechazado', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      const res = await call(BODY, token);
      res.status.should.equal(403);
      res.body.should.deepEqual({ code: 'access_denied', message: 'Access denied' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_01_user', 'S-079 · TS-46: respeta el estado del módulo', { method: 'post', body: BODY });
});
