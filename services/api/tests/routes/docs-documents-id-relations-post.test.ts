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

const METHOD = `documents.${DOC_ID}.relations.update`;
const URL = `/api/docs/documents/${DOC_ID}/relations`;
const RELATIONS = { clients: [4], projects: [12], requirements: [], tasks: [] };

describe('POST /api/docs/documents/:id/relations (S-094)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());
  const call = (body: any, token = 'token_01_user', url = URL) =>
    request(application).post(url).set('Authorization', `Bearer ${token}`).send(body);

  it('S-094 · TS-33: asignar proyecto (sin via ni checksum)', async () => {
    await docsAvailable();
    const data = { id: DOC_ID, version: 4, relations: RELATIONS };
    fakeBus.moduleReply(METHOD, success(data));
    const res = await call({ baseVersion: 3, add: { projects: [12] } });
    res.status.should.equal(200);
    res.body.should.deepEqual(data);
    fakeBus.lastModule!.kind.should.equal('command');
    fakeBus.lastModule!.method.should.equal(METHOD);
    fakeBus.lastModule!.subject.should.equal(C + METHOD);
    fakeBus.lastModule!.payload.should.deepEqual({
      baseVersion: 3, add: { projects: [12] }, actor: expectedActor('token_01_user'),
    });
  });

  it('S-094 · TS-34: remove, add, sessionId y warnings', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success({ id: DOC_ID, version: 5, relations: RELATIONS, warnings: ['x'] }));
    const res = await call({
      baseVersion: 4, remove: { projects: [31] }, add: { tasks: [9] }, sessionId: SESSION_ID,
    });
    res.status.should.equal(200);
    res.body.warnings.should.deepEqual(['x']);
    fakeBus.lastModule!.payload.should.deepEqual({
      baseVersion: 4, remove: { projects: [31] }, add: { tasks: [9] }, sessionId: SESSION_ID,
      actor: expectedActor('token_01_user'),
    });
  });

  it('S-094 · TS-35: forma inválida, sin bus', async () => {
    await docsAvailable();
    const bad: any[] = [
      { baseVersion: 3 },
      { baseVersion: 0, add: { projects: [12] } },
      { add: { projects: [12] } },
      { baseVersion: 3, add: { projects: ['12'] } },
      { baseVersion: 3, add: { folders: [1] } },
      { baseVersion: 3, add: { projects: [12] }, via: 'human' },
      { baseVersion: 3, add: { projects: Array.from({ length: 101 }, (_, i) => i + 1) } },
      { baseVersion: 3, add: { projects: [0] } },
      { baseVersion: 3, add: { projects: [12] }, sessionId: 'abc' },
    ];
    for (const body of bad) {
      const res = await call(body);
      res.status.should.equal(400, JSON.stringify(body).slice(0, 80));
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-094 · TS-36: 100 ids es el borde válido', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success({ id: DOC_ID, version: 4, relations: RELATIONS }));
    const projects = Array.from({ length: 100 }, (_, i) => i + 1);
    (await call({ baseVersion: 3, add: { projects } })).status.should.equal(200);
    (fakeBus.lastModule!.payload as any).add.projects.length.should.equal(100);
  });

  it('S-094 · TS-37: id de path malformado, sin bus', async () => {
    await docsAvailable();
    const res = await call({ baseVersion: 3, add: { projects: [12] } }, 'token_01_user', '/api/docs/documents/not-a-ulid/relations');
    res.status.should.equal(404);
    res.body.should.deepEqual({ code: 'document_not_found', message: 'Documento no encontrado' });
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-094 · TS-38: mapa de errores', async () => {
    await docsAvailable();
    const locked = { holder: 'zitadel-sub-02', holderName: 'Victor Vidal', via: 'human', expiresAt: '2026-10-26T12:00:00Z' };
    const cases: Array<[string, number, Record<string, unknown>?]> = [
      ['version_conflict', 409, { currentVersion: 5 }], ['document_locked', 409, locked], ['invalid_relation', 400],
      ['invalid_fields', 400], ['frontmatter_invalid', 400], ['permission_denied', 403],
      ['document_not_found', 404], ['upstream_unavailable', 503],
    ];
    for (const [code, status, details] of cases) {
      fakeBus.moduleReply(METHOD, failure(code, 'm', details));
      const res = await call({ baseVersion: 3, add: { projects: [12] } });
      res.status.should.equal(status, code);
      res.body.should.deepEqual(details ? { code, message: 'm', details } : { code, message: 'm' });
    }
  });

  it('S-094 · TS-56: roles rechazados', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      (await call({ baseVersion: 3, add: { projects: [12] } }, token)).status.should.equal(403);
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-094 · TS-58: admin pasa con su actor', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success({ id: DOC_ID, version: 4, relations: RELATIONS }));
    (await call({ baseVersion: 3, add: { projects: [12] } }, 'token_03_admin')).status.should.equal(200);
    (fakeBus.lastModule!.payload as any).actor.should.deepEqual(expectedActor('token_03_admin'));
  });

  itRespectsModuleState(() => application, URL, 'token_01_user', 'S-094 · TS-57: respeta el estado del módulo',
    { method: 'post', body: { baseVersion: 3, add: { projects: [12] } } });
});
