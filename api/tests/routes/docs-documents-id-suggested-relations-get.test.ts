import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import sinon from 'sinon';
import { Client, Project } from '@jiku/models';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { DOC_ID, docsAvailable, failure, itRespectsModuleState, success, expectedActor } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';
import { createDocsFixtures, destroyDocsFixtures } from '../helpers/docs-fixtures';

const URL = `/api/docs/documents/${DOC_ID}/suggested-relations`;

describe('GET /api/docs/documents/:id/suggested-relations (S-094)', () => {
  let application: Application;
  before(async function () { this.timeout(30000); application = start(); await createDocsFixtures(); });
  after(() => destroyDocsFixtures());
  afterEach(() => { sinon.restore(); docsModule.stop(); });
  const get = (url = URL, token = 'token_01_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);

  it('S-094 · TS-40: nombres resueltos desde la base', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.suggest-relations', success({
      items: [
        { projectId: 12, clientId: 4, score: 0.82, reason: 'El título menciona «Videoconferencia»' },
        { projectId: null, clientId: 5, score: 0.4, reason: 'El contenido menciona «Acme»' },
        { projectId: 998, clientId: null, score: 0.3, reason: 'x' },
      ],
    }));
    const res = await get();
    res.status.should.equal(200);
    res.body.should.deepEqual({
      items: [
        { projectId: 12, clientId: 4, score: 0.82, reason: 'El título menciona «Videoconferencia»', projectName: 'Videoconferencia', projectCode: 'VID', clientName: 'EXO' },
        { projectId: null, clientId: 5, score: 0.4, reason: 'El contenido menciona «Acme»', projectName: null, projectCode: null, clientName: 'Acme' },
        { projectId: 998, clientId: null, score: 0.3, reason: 'x', projectName: null, projectCode: null, clientName: null },
      ],
    });
    fakeBus.lastModule!.method.should.equal('documents.suggest-relations');
    fakeBus.lastModule!.payload.should.deepEqual({ id: DOC_ID, actor: expectedActor('token_01_user') });
  });

  it('S-094 · TS-41: vacío, sin consultas a la base', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.suggest-relations', success({ items: [] }));
    const clientSpy = sinon.spy(Client, 'findAll');
    const projectSpy = sinon.spy(Project, 'findAll');
    const res = await get();
    res.body.should.deepEqual({ items: [] });
    clientSpy.callCount.should.equal(0);
    projectSpy.callCount.should.equal(0);
  });

  it('S-094 · TS-42: errores', async () => {
    await docsAvailable();
    const bad = await get('/api/docs/documents/not-a-ulid/suggested-relations');
    bad.status.should.equal(404);
    bad.body.code.should.equal('document_not_found');
    fakeBus.moduleSent.length.should.equal(0);
    for (const [code, status] of [['permission_denied', 403], ['document_not_found', 404]] as const) {
      fakeBus.moduleReply('documents.suggest-relations', failure(code, 'x'));
      (await get()).status.should.equal(status);
    }
    fakeBus.moduleFailWithTimeout();
    const res = await get();
    res.status.should.equal(504);
    res.body.code.should.equal('gateway_timeout');
  });

  it('S-094 · TS-56: roles rechazados y query desconocida', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      (await get(URL, token)).status.should.equal(403);
    }
    (await get(`${URL}?foo=1`)).status.should.equal(400);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-094 · TS-58: admin pasa', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.suggest-relations', success({ items: [] }));
    (await get(URL, 'token_03_admin')).status.should.equal(200);
    (fakeBus.lastModule!.payload as any).actor.should.deepEqual(expectedActor('token_03_admin'));
  });

  itRespectsModuleState(() => application, URL, 'token_01_user', 'S-094 · TS-57: respeta el estado del módulo');
});
