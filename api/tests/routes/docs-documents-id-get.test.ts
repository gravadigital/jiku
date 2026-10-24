import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { DOC_ID, FOLDER_ID, docsAvailable, failure, itRespectsModuleState, success } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const DOCUMENT = {
  id: DOC_ID, title: 'Acta de kickoff', path: '/clientes/acme/acta.md', folderId: FOLDER_ID, version: 3,
  visibility: 'internal', content: '# Acta',
  relations: { clients: [], projects: [12], requirements: [], tasks: [] },
  topics: ['kickoff'], lock: null, attachments: [],
};
const FOLDER = {
  id: FOLDER_ID, name: 'acme', path: '/clientes/acme/', parentId: null, effectivePermission: 'write',
  sharingBlocked: false, externalBlocked: false, createdBy: 'zitadel-sub-03',
};

describe('GET /api/docs/documents/:id (S-078)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  const get = (url: string, token = 'token_01_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);
  const URL = `/api/docs/documents/${DOC_ID}`;

  it('S-078 · TS-11: detalle compuesto', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success(DOCUMENT));
    fakeBus.moduleReply('folders.get', success(FOLDER));
    const res = await get(URL);
    res.status.should.equal(200);
    res.body.should.deepEqual({
      ...DOCUMENT,
      folder: { id: FOLDER_ID, path: '/clientes/acme/', effectivePermission: 'write', sharingBlocked: false },
    });
    Object.keys(res.body.folder).length.should.equal(4);
    fakeBus.moduleSent.map((c) => c.method).should.deepEqual(['documents.get', 'folders.get']);
    (fakeBus.moduleSent[0].payload as any).should.deepEqual({
      id: DOC_ID, include: ['content', 'relations', 'topics', 'lock', 'attachments'], actor: { id: 'zitadel-sub-01' },
    });
    (fakeBus.moduleSent[1].payload as any).should.deepEqual({
      id: FOLDER_ID, include: ['effectivePermission'], actor: { id: 'zitadel-sub-01' },
    });
  });

  it('S-078 · TS-12: versión pedida', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success(DOCUMENT));
    fakeBus.moduleReply('folders.get', success(FOLDER));
    (await get(`${URL}?version=2`)).status.should.equal(200);
    (fakeBus.moduleSent[0].payload as any).version.should.equal(2);

    fakeBus.reset();
    for (const q of ['version=0', 'version=x']) {
      const res = await get(`${URL}?${q}`);
      res.status.should.equal(400);
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · TS-13: documento grande con contentUrl', async () => {
    await docsAvailable();
    const { content, ...rest } = DOCUMENT;
    fakeBus.moduleReply('documents.get', success({ ...rest, contentUrl: 'https://s3.example/doc?sig=1' }));
    fakeBus.moduleReply('folders.get', success(FOLDER));
    const res = await get(URL);
    res.status.should.equal(200);
    res.body.contentUrl.should.equal('https://s3.example/doc?sig=1');
    res.body.should.not.have.property('content');
    res.body.should.have.property('folder');
  });

  it('S-078 · TS-14: documento inexistente o no visible', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', failure('document_not_found', 'Documento no encontrado'));
    const res = await get(URL);
    res.status.should.equal(404);
    res.body.should.deepEqual({ code: 'document_not_found', message: 'Documento no encontrado' });
    fakeBus.moduleSent.length.should.equal(1);
  });

  it('S-078 · TS-15: falla la carpeta', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success(DOCUMENT));
    fakeBus.moduleReply('folders.get', failure('permission_denied', 'Sin permiso'));
    const res = await get(URL);
    res.status.should.equal(403);
    res.body.should.deepEqual({ code: 'permission_denied', message: 'Sin permiso' });
  });

  it('S-078 · TS-16: id malformado', async () => {
    await docsAvailable();
    for (const id of ['abc', DOC_ID.slice(0, 25) + 'w']) {
      const res = await get(`/api/docs/documents/${id}`);
      res.status.should.equal(404);
      res.body.should.deepEqual({ code: 'document_not_found', message: 'Documento no encontrado' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · rol rechazado', async () => {
    await docsAvailable();
    (await get(URL, 'token_04_external_user')).status.should.equal(403);
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_01_user');
});
