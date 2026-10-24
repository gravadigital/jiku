import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { DOC_ID, docsAvailable, failure, itRespectsModuleState, success } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

describe('GET /api/docs/documents/:id/versions (S-078)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  const get = (url: string, token = 'token_01_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);
  const URL = `/api/docs/documents/${DOC_ID}/versions`;

  it('S-078 · TS-17: versiones', async () => {
    await docsAvailable();
    const data = {
      items: [{
        version: 3, checksum: 'sha256:' + 'a'.repeat(64), sizeBytes: 120, author: 'zitadel-sub-01', via: 'human',
        sessionId: null, message: null, createdAt: '2026-10-24T13:02:11.123Z',
      }],
      page: { limit: 50, returned: 1 },
    };
    fakeBus.moduleReply('documents.versions.list', success(data));
    const res = await get(`${URL}?cursor=c1`);
    res.status.should.equal(200);
    res.body.should.deepEqual(data);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      filter: { documentId: DOC_ID }, sort: ['-version'], page: { limit: 50, cursor: 'c1' },
      actor: { id: 'zitadel-sub-01' },
    });
  });

  it('S-078 · TS-18: documento no visible', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.versions.list', failure('document_not_found', 'Documento no encontrado'));
    const res = await get(URL);
    res.status.should.equal(404);
    res.body.code.should.equal('document_not_found');
  });

  it('S-078 · TS-16: id malformado', async () => {
    await docsAvailable();
    const res = await get('/api/docs/documents/abc/versions');
    res.status.should.equal(404);
    res.body.should.deepEqual({ code: 'document_not_found', message: 'Documento no encontrado' });
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · query inválida y rol', async () => {
    await docsAvailable();
    (await get(`${URL}?limit=0`)).status.should.equal(400);
    (await get(URL, 'token_08_no_roles')).status.should.equal(403);
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_01_user');
});
