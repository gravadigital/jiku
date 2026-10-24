import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  COMMAND_SUBJECT_PREFIX as C, DOC_ID, SESSION_ID, docsAvailable, failure, itRespectsModuleState, success,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const ACTOR = { actor: { id: 'zitadel-sub-01' } };
const METHOD = `documents.${DOC_ID}.update`;
const URL = `/api/docs/documents/${DOC_ID}`;
const SUM = 'sha256:1071fceb411ffa95f20a102482770ef3f419ea029e4296f3ac3aae7aa362d2ee';
const BODY = { baseVersion: 6, content: '# Acta v2\n', sessionId: SESSION_ID };
const EXP = '2026-10-24T13:04:11.000Z';

describe('PUT /api/docs/documents/:id (S-079)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  const put = (body: any, url = URL, token = 'token_01_user') =>
    request(application).put(url).set('Authorization', `Bearer ${token}`).send(body);

  it('S-079 · TS-9: guardar', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success({ id: DOC_ID, version: 7 }));
    const res = await put(BODY);
    res.status.should.equal(200);
    res.body.should.deepEqual({ id: DOC_ID, version: 7 });
    fakeBus.lastModule!.should.deepEqual({
      kind: 'command', method: METHOD, subject: C + METHOD,
      payload: { baseVersion: 6, content: '# Acta v2\n', checksum: SUM, sessionId: SESSION_ID, via: 'human', ...ACTOR },
    });
  });

  it('S-079 · TS-10 (CA-17): conflicto de versión', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, failure('version_conflict', 'El documento cambió', { currentVersion: 7 }));
    const res = await put(BODY);
    res.status.should.equal(409);
    res.body.should.deepEqual({ code: 'version_conflict', message: 'El documento cambió', details: { currentVersion: 7 } });
  });

  it('S-079 · TS-11 (CA-18): documento bloqueado', async () => {
    await docsAvailable();
    const details = { holder: 'zitadel-sub-03', via: 'human', expiresAt: EXP };
    fakeBus.moduleReply(METHOD, failure('document_locked', 'Otra sesión tiene el lock', details));
    const res = await put(BODY);
    res.status.should.equal(409);
    res.body.should.deepEqual({ code: 'document_locked', message: 'Otra sesión tiene el lock', details });
  });

  it('S-079 · TS-12: sin sessionId, con message', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success({ id: DOC_ID, version: 7 }));
    const res = await put({ baseVersion: 6, content: '# Acta v2\n', message: 'Corrige fecha' });
    res.status.should.equal(200);
    fakeBus.lastModule!.payload.should.deepEqual({
      baseVersion: 6, content: '# Acta v2\n', checksum: SUM, via: 'human', message: 'Corrige fecha', ...ACTOR,
    });
  });

  it('S-079 · TS-13: body inválido', async () => {
    await docsAvailable();
    const bad: any[] = [
      { content: 'x' }, { ...BODY, baseVersion: 0 }, { ...BODY, baseVersion: '6' }, { ...BODY, baseVersion: 6.5 },
      { baseVersion: 6 }, { ...BODY, sessionId: 'abc' }, { ...BODY, checksum: SUM }, { ...BODY, via: 'human' },
      { ...BODY, contentUploadId: DOC_ID },
    ];
    for (const body of bad) {
      const res = await put(body);
      res.status.should.equal(400);
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-079 · TS-14: id malformado', async () => {
    await docsAvailable();
    for (const id of ['abc', `${DOC_ID}.%3E`]) {
      const res = await put(BODY, `/api/docs/documents/${id}`);
      res.status.should.equal(404);
      res.body.should.deepEqual({ code: 'document_not_found', message: 'Documento no encontrado' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-079 · TS-15: lock_not_held y permiso', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, failure('lock_not_held', 'La sesión no tiene el lock'));
    (await put(BODY)).status.should.equal(409);
    fakeBus.moduleReply(METHOD, failure('permission_denied', 'Sin permiso'));
    const res = await put(BODY);
    res.status.should.equal(403);
    res.body.should.deepEqual({ code: 'permission_denied', message: 'Sin permiso' });
  });

  it('S-079 · TS-16: sin token es 401 aunque el módulo no esté instalado', async () => {
    const a = await request(application).put(URL).send({ baseVersion: 6, content: 'x' });
    a.status.should.equal(401);
    a.body.should.deepEqual({ code: 'unauthorized', message: 'Unauthorized' });
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-079 · TS-8: rol rechazado', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      const res = await put(BODY, URL, token);
      res.status.should.equal(403);
      res.body.should.deepEqual({ code: 'access_denied', message: 'Access denied' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-079 · TS-45: sin reply en una escritura', async () => {
    await docsAvailable();
    fakeBus.moduleFailWithTimeout();
    const a = await put(BODY);
    a.status.should.equal(504);
    a.body.should.deepEqual({ code: 'gateway_timeout', message: 'La operación tardó demasiado' });
    fakeBus.pingResponds('jiku-docs', false);
    fakeBus.moduleFailWithNoResponders();
    const b = await put(BODY);
    b.status.should.equal(503);
    b.body.code.should.equal('module_unavailable');
    docsModule.status().should.equal('unavailable');
  });

  it('S-079 · límite de body: admite contenido de 256 KiB', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success({ id: DOC_ID, version: 7 }));
    const res = await put({ ...BODY, content: 'a'.repeat(262144) });
    res.status.should.equal(200);
  });

  itRespectsModuleState(() => application, URL, 'token_01_user', 'S-079 · TS-46: respeta el estado del módulo', { method: 'put', body: BODY });
});
