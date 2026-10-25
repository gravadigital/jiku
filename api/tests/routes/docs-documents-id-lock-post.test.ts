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
const EXP = '2026-10-24T13:04:11.000Z';

const METHOD = `documents.${DOC_ID}.lock`;
const URL = `/api/docs/documents/${DOC_ID}/lock`;
const BODY = { sessionId: SESSION_ID };

describe('POST /api/docs/documents/:id/lock (S-079)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());
  const call = (body: any, token = 'token_01_user') =>
    request(application).post(URL).set('Authorization', `Bearer ${token}`).send(body);

  it('S-079 · TS-25: lock', async () => {
    await docsAvailable();
    const data = { id: DOC_ID, sessionId: SESSION_ID, expiresAt: EXP };
    fakeBus.moduleReply(METHOD, success(data));
    const res = await call(BODY);
    res.status.should.equal(200);
    res.body.should.deepEqual(data);
    fakeBus.lastModule!.subject.should.equal(C + METHOD);
    fakeBus.lastModule!.payload.should.deepEqual({ sessionId: SESSION_ID, via: 'human', ...ACTOR });
  });

  it('S-079 · TS-26 (CA-S8): lock idempotente', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success({ id: DOC_ID, sessionId: SESSION_ID, expiresAt: EXP }));
    (await call(BODY)).status.should.equal(200);
    const later = '2026-10-24T13:06:11.000Z';
    fakeBus.moduleReply(METHOD, success({ id: DOC_ID, sessionId: SESSION_ID, expiresAt: later }));
    const res = await call(BODY);
    res.status.should.equal(200);
    res.body.expiresAt.should.equal(later);
    fakeBus.moduleSent.length.should.equal(2);
    fakeBus.moduleSent[0].payload.should.deepEqual(fakeBus.moduleSent[1].payload);
  });

  it('S-079 · TS-27: TTL e inválidos', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success({ id: DOC_ID, sessionId: SESSION_ID, expiresAt: EXP }));
    (await call({ ...BODY, ttlSeconds: 300 })).status.should.equal(200);
    (fakeBus.lastModule!.payload as any).ttlSeconds.should.equal(300);
    const sent = fakeBus.moduleSent.length;
    for (const body of [{}, { sessionId: 'abc' }, { ...BODY, ttlSeconds: 29 }, { ...BODY, ttlSeconds: 301 }, { ...BODY, via: 'agent' }]) {
      const res = await call(body);
      res.status.should.equal(400);
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(sent);
  });

  it('S-079 · TS-28 (CA-18): lock tomado por otra sesión', async () => {
    await docsAvailable();
    const details = { holder: 'zitadel-sub-03', via: 'human', expiresAt: EXP };
    fakeBus.moduleReply(METHOD, failure('document_locked', 'Otra sesión tiene el lock', details));
    const res = await call(BODY);
    res.status.should.equal(409);
    res.body.details.should.deepEqual(details);
  });

  it('S-079 · id malformado', async () => {
    await docsAvailable();
    const res = await request(application).post('/api/docs/documents/abc/lock')
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
