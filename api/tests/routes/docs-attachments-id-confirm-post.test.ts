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

const ACTOR = { actor: { id: 'zitadel-sub-01' } };

const METHOD = `attachments.${ATT_ID}.confirm`;
const URL = `/api/docs/attachments/${ATT_ID}/confirm`;

describe('POST /api/docs/attachments/:id/confirm (S-079)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());
  const call = (token = 'token_01_user', url = URL) =>
    request(application).post(url).set('Authorization', `Bearer ${token}`);

  it('S-079 · TS-34: confirmar sin cuerpo y con {}', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success({ id: ATT_ID, status: 'ready' }));
    const res = await call();
    res.status.should.equal(200);
    res.body.should.deepEqual({ id: ATT_ID, status: 'ready' });
    fakeBus.lastModule!.should.deepEqual({ kind: 'command', method: METHOD, subject: C + METHOD, payload: ACTOR });
    (await call().send({})).status.should.equal(200);
    fakeBus.lastModule!.payload.should.deepEqual(ACTOR);
  });

  it('S-079 · TS-35: inválidos y errores', async () => {
    await docsAvailable();
    (await call().send({ foo: 1 })).status.should.equal(400);
    for (const id of ['abc', `${ATT_ID}.%3E`]) {
      const res = await call('token_01_user', `/api/docs/attachments/${id}/confirm`);
      res.status.should.equal(404);
      res.body.should.deepEqual({ code: 'attachment_not_found', message: 'Adjunto no encontrado' });
    }
    fakeBus.moduleSent.length.should.equal(0);
    fakeBus.moduleReply(METHOD, failure('checksum_mismatch', 'El archivo no coincide'));
    const a = await call();
    a.status.should.equal(400);
    a.body.should.deepEqual({ code: 'checksum_mismatch', message: 'El archivo no coincide' });
    fakeBus.moduleReply(METHOD, failure('upload_not_found', 'm'));
    (await call()).status.should.equal(400);
  });

  it('S-079 · TS-8: rol rechazado', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      const res = await call(token);
      res.status.should.equal(403);
      res.body.should.deepEqual({ code: 'access_denied', message: 'Access denied' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_01_user', 'S-079 · TS-46: respeta el estado del módulo', { method: 'post' });
});
