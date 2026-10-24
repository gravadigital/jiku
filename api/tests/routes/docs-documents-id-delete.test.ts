import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  COMMAND_SUBJECT_PREFIX as C, DOC_ID, docsAvailable, failure, itRespectsModuleState, success,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const ACTOR = { actor: { id: 'zitadel-sub-01' } };

const METHOD = `documents.${DOC_ID}.delete`;
const URL = `/api/docs/documents/${DOC_ID}?baseVersion=7`;

describe('DELETE /api/docs/documents/:id (S-079)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());
  const call = (url: string = URL, token = 'token_01_user') =>
    request(application).delete(url).set('Authorization', `Bearer ${token}`);

  it('S-079 · TS-21: borrar', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success({ id: DOC_ID }));
    const res = await call();
    res.status.should.equal(200);
    res.body.should.deepEqual({ id: DOC_ID });
    fakeBus.lastModule!.subject.should.equal(C + METHOD);
    fakeBus.lastModule!.payload.should.deepEqual({ baseVersion: 7, ...ACTOR });
  });

  it('S-079 · TS-22: inválidos y conflicto', async () => {
    await docsAvailable();
    for (const q of ['', '?baseVersion=0', '?baseVersion=x', '?baseVersion=7&force=true']) {
      const res = await call(`/api/docs/documents/${DOC_ID}${q}`);
      res.status.should.equal(400);
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(0);
    fakeBus.moduleReply(METHOD, failure('version_conflict', 'm', { currentVersion: 8 }));
    const res = await call();
    res.status.should.equal(409);
    res.body.should.deepEqual({ code: 'version_conflict', message: 'm', details: { currentVersion: 8 } });
  });

  it('S-079 · id malformado', async () => {
    await docsAvailable();
    const res = await call('/api/docs/documents/abc?baseVersion=7');
    res.status.should.equal(404);
    res.body.should.deepEqual({ code: 'document_not_found', message: 'Documento no encontrado' });
    fakeBus.moduleSent.length.should.equal(0);
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
