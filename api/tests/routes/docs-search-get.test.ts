import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { DOC_ID, docsAvailable, itRespectsModuleState, success } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

describe('GET /api/docs/search (S-078)', () => {
  let application: Application;
  before(() => { application = start(); });
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
    res.body.should.deepEqual(data);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      query: 'kickoff acme', mode: 'text', filter: { projectId: 12 }, limit: 20, actor: { id: 'zitadel-sub-01' },
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
    (await get('/api/docs/search?q=ab', 'token_04_external_user')).status.should.equal(403);
  });

  itRespectsModuleState(() => application, '/api/docs/search?q=ab', 'token_01_user');
});
