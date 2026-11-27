import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  COMMAND_SUBJECT_PREFIX as C, DOC_ID, FOLDER2_ID, SESSION_ID, docsAvailable, failure, itRespectsModuleState, success,
  expectedActor,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const ACTOR = { actor: expectedActor('token_01_user') };

const METHOD = `documents.${DOC_ID}.move`;
const URL = `/api/docs/documents/${DOC_ID}/move`;
const BODY = { baseVersion: 3, folderId: FOLDER2_ID, fileName: 'acta-kickoff.md', sessionId: SESSION_ID };
const OK = { id: DOC_ID, version: 4, path: '/clientes/otra/acta-kickoff.md' };

describe('POST /api/docs/documents/:id/move (S-079)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());
  const call = (body: any, token = 'token_01_user', url = URL) =>
    request(application).post(url).set('Authorization', `Bearer ${token}`).send(body);

  it('S-079 · TS-19: mover (sin via)', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success(OK));
    const res = await call(BODY);
    res.status.should.equal(200);
    res.body.should.deepEqual(OK);
    fakeBus.lastModule!.subject.should.equal(C + METHOD);
    fakeBus.lastModule!.payload.should.deepEqual({ ...BODY, ...ACTOR });
    await call({ baseVersion: 3, fileName: 'acta-kickoff.md' });
    fakeBus.lastModule!.payload.should.deepEqual({ baseVersion: 3, fileName: 'acta-kickoff.md', ...ACTOR });
  });

  it('S-079 · TS-20: inválidos', async () => {
    await docsAvailable();
    for (const body of [{ baseVersion: 3 }, { baseVersion: 3, folderId: 'x' }, { baseVersion: 3, fileName: 'a.md', via: 'human' }]) {
      const res = await call(body);
      res.status.should.equal(400);
      res.body.code.should.equal('invalid_fields');
    }
    const res = await call(BODY, 'token_01_user', '/api/docs/documents/abc/move');
    res.status.should.equal(404);
    res.body.code.should.equal('document_not_found');
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-079 · errores de jiku-docs sin traducir', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, failure('already_exists', 'm'));
    (await call(BODY)).status.should.equal(409);
    fakeBus.moduleReply(METHOD, failure('folder_not_found', 'm'));
    (await call(BODY)).status.should.equal(404);
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
