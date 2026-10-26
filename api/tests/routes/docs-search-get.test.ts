import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { DOC_ID, docsAvailable, itRespectsModuleState, success, expectedActor } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';
import { createDocsFixtures, destroyDocsFixtures } from '../helpers/docs-fixtures';

describe('GET /api/docs/search (S-078)', () => {
  let application: Application;
  before(async function () { this.timeout(30000); application = start(); await createDocsFixtures(); });
  after(() => destroyDocsFixtures());
  afterEach(() => docsModule.stop());

  const get = (url: string, token = 'token_01_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);

  it('S-078 · TS-19: búsqueda', async () => {
    await docsAvailable();
    const data = {
      items: [{
        documentId: DOC_ID, version: 3, title: 'Acta de kickoff', path: '/clientes/acme/acta.md',
        headingPath: ['Acta'], snippet: 'kickoff con acme', score: 0.8,
        updatedAt: '2026-10-24T13:02:11.123Z', updatedBy: 'zitadel-sub-01',
      }],
    };
    fakeBus.moduleReply('documents.search', success(data));
    const res = await get('/api/docs/search?q=kickoff%20acme&projectId=12');
    res.status.should.equal(200);
    res.body.should.deepEqual({ items: [{ ...data.items[0], clientRefs: [], projectRefs: [] }] });
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      query: 'kickoff acme', mode: 'text', filter: { projectId: [12] }, limit: 20, actor: expectedActor('token_01_user'),
    });
  });

  it('S-078 · TS-20: búsqueda inválida', async () => {
    await docsAvailable();
    for (const q of ['', '?q=a', '?q=ab&limit=51', '?q=ab&mode=semantic', '?q=ab&folderId=' + DOC_ID]) {
      const url = q.startsWith('?') ? `/api/docs/search${q}` : '/api/docs/search';
      const res = await get(url);
      res.status.should.equal(400, url);
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(0);

    fakeBus.moduleReply('documents.search', success({ items: [] }));
    (await get('/api/docs/search?q=ab&limit=50')).status.should.equal(200);
    (fakeBus.lastModule!.payload as any).limit.should.equal(50);
  });

  it('S-078 · rol rechazado', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      (await get('/api/docs/search?q=ab', token)).status.should.equal(403);
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, '/api/docs/search?q=ab', 'token_01_user');

  it('S-094 · TS-20: filtros nuevos traducidos como en el listado', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.search', success({ items: [] }));
    const res = await get(
      '/api/docs/search?q=acta&projectId=12&projectId=31&clientId=4&hasTopic=false&person=zitadel-sub-01&visibility=public&limit=50'
    );
    res.status.should.equal(200);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      query: 'acta', mode: 'text',
      filter: {
        projectId: [12, 31], clientId: [4], hasTopic: false, visibility: 'public',
        or: [{ createdBy: ['zitadel-sub-01'] }, { updatedBy: ['zitadel-sub-01'] }],
      },
      limit: 50, actor: expectedActor('token_01_user'),
    });
  });

  it('S-094 · TS-21: hit con campos 1.3.0 verbatim y refs', async () => {
    await docsAvailable();
    const hit = {
      documentId: DOC_ID, version: 3, title: 'Acta', path: '/clientes/exo/videoconferencia/acta.md',
      headingPath: ['Acta'], snippet: '…acta…', score: 0.9, updatedAt: '2026-10-20T10:00:00Z',
      updatedBy: 'zitadel-sub-01', updatedByName: 'Ana Pérez', createdBy: 'zitadel-sub-02',
      createdByName: 'Victor Vidal', visibility: 'internal', clients: [4], projects: [12], projectMatch: 'indirect',
    };
    fakeBus.moduleReply('documents.search', success({ items: [hit] }));
    const res = await get('/api/docs/search?q=acta');
    res.status.should.equal(200);
    res.body.items[0].should.deepEqual({
      ...hit,
      clientRefs: [{ id: 4, name: 'EXO' }],
      projectRefs: [{ id: 12, name: 'Videoconferencia', code: 'VID', clientId: 4 }],
    });
  });

  it('S-094 · TS-22: límites y claves no declaradas', async () => {
    await docsAvailable();
    for (const q of ['q=acta&limit=51', 'q=acta&cursor=x', 'q=a', 'q=acta&myActiveProjects=true', 'q=acta&count=true']) {
      const res = await get(`/api/docs/search?${q}`);
      res.status.should.equal(400, q);
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(0);
  });
});
