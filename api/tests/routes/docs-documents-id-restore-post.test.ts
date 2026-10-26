import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  COMMAND_SUBJECT_PREFIX as C, DOC_ID, docsAvailable, failure, itRespectsModuleState, success,
  expectedActor,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const ACTOR = { actor: expectedActor('token_01_user') };
const EXP = '2026-10-24T13:04:11.000Z';

const METHOD = `documents.${DOC_ID}.restore`;
const URL = `/api/docs/documents/${DOC_ID}/restore`;
const BODY = { fromVersion: 3, baseVersion: 7 };

describe('POST /api/docs/documents/:id/restore (S-079)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());
  const call = (body: any, token = 'token_01_user') =>
    request(application).post(URL).set('Authorization', `Bearer ${token}`).send(body);

  it('S-079 · TS-23: restaurar', async () => {
    await docsAvailable();
    const data = { id: DOC_ID, version: 8, path: '/clientes/acme/acta.md' };
    fakeBus.moduleReply(METHOD, success(data));
    const res = await call(BODY);
    res.status.should.equal(200);
    res.body.should.deepEqual(data);
    fakeBus.lastModule!.subject.should.equal(C + METHOD);
    fakeBus.lastModule!.payload.should.deepEqual({ ...BODY, ...ACTOR });
  });

  it('S-094 · TS-27: version_pruned responde 404 con details', async () => {
    await docsAvailable();
    const details = { requestedVersion: 7, previousAvailable: 5, nextAvailable: 9 };
    fakeBus.moduleReply(METHOD, failure('version_pruned', 'x', details));
    const res = await call({ fromVersion: 7, baseVersion: 10 });
    res.status.should.equal(404);
    res.body.should.deepEqual({ code: 'version_pruned', message: 'x', details });
  });

  it('S-079 · TS-24: inválido y bloqueado', async () => {
    await docsAvailable();
    for (const body of [{ baseVersion: 7 }, { fromVersion: 0, baseVersion: 7 }]) {
      const res = await call(body);
      res.status.should.equal(400);
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(0);
    const details = { holder: 'zitadel-sub-03', via: 'agent', expiresAt: EXP };
    fakeBus.moduleReply(METHOD, failure('document_locked', 'm', details));
    const res = await call(BODY);
    res.status.should.equal(409);
    res.body.should.deepEqual({ code: 'document_locked', message: 'm', details });
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
