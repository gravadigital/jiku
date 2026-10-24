import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { DOC_ID, docsAvailable, failure, itRespectsModuleState, success } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

describe('GET /api/opus/docs/documents/:id (S-078)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  const get = (url: string, token = 'token_04_external_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);
  const URL = `/api/opus/docs/documents/${DOC_ID}`;
  const NOT_FOUND = { code: 'document_not_found', message: 'Documento no encontrado' };

  it('S-078 · TS-38: documento público', async () => {
    await docsAvailable();
    const data = { id: DOC_ID, title: 'Manual de uso', visibility: 'public', content: '# Manual', attachments: [] };
    fakeBus.moduleReply('documents.get', success(data));
    const res = await get(URL);
    res.status.should.equal(200);
    res.body.should.deepEqual(data);
    fakeBus.moduleSent.length.should.equal(1);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      id: DOC_ID, include: ['content', 'attachments'], actor: { id: 'zitadel-sub-04' },
    });
  });

  it('S-078 · TS-39: documento interno', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success({ id: DOC_ID, visibility: 'internal', content: '# Secreto' }));
    const res = await get(URL, 'token_01_user');
    res.status.should.equal(404);
    res.body.should.deepEqual(NOT_FOUND);
    res.text.should.not.containEql('Secreto');
  });

  it('S-087 · TS-19: documento interno con usuario admin', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success({ id: DOC_ID, visibility: 'internal', content: '# Secreto' }));
    const res = await get(URL, 'token_03_admin');
    res.status.should.equal(404);
    res.body.should.deepEqual(NOT_FOUND);
    res.text.should.not.containEql('Secreto');
  });

  it('S-078 · TS-40: documento sin visibility falla cerrado', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success({ id: DOC_ID, content: '# x' }));
    const res = await get(URL);
    res.status.should.equal(404);
    res.body.should.deepEqual(NOT_FOUND);
  });

  it('S-078 · TS-41: inexistente o id malformado', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', failure('document_not_found', 'Documento no encontrado'));
    (await get(URL)).body.should.deepEqual(NOT_FOUND);

    fakeBus.reset();
    const res = await get('/api/opus/docs/documents/abc');
    res.status.should.equal(404);
    res.body.should.deepEqual(NOT_FOUND);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · TS-43: rol rechazado', async () => {
    await docsAvailable();
    const res = await get(URL, 'token_08_no_roles');
    res.status.should.equal(403);
    res.body.code.should.equal('access_denied');
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_04_external_user');
});
