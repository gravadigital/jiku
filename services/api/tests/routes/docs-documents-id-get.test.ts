import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import sinon from 'sinon';
import { Client, Project } from '@jiku/models';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { DOC_ID, FOLDER_ID, SESSION_ID, docsAvailable, failure, itRespectsModuleState, success, expectedActor } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';
import { createDocsFixtures, destroyDocsFixtures } from '../helpers/docs-fixtures';

const DOCUMENT = {
  id: DOC_ID, title: 'Acta de kickoff', path: '/clientes/acme/acta.md', folderId: FOLDER_ID, version: 3,
  visibility: 'internal', content: '# Acta',
  relations: { clients: [], projects: [12], requirements: [], tasks: [] },
  topics: ['kickoff'], lock: null, attachments: [],
};

describe('GET /api/docs/documents/:id (S-078)', () => {
  let application: Application;
  before(async function () { this.timeout(30000); application = start(); await createDocsFixtures(); });
  after(() => destroyDocsFixtures());
  afterEach(() => { sinon.restore(); docsModule.stop(); });

  const get = (url: string, token = 'token_01_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);
  const URL = `/api/docs/documents/${DOC_ID}`;

  it('S-094 · TS-23: una sola consulta, sin folder, con las cuatro refs', async () => {
    await docsAvailable();
    const document = {
      ...DOCUMENT, createdByName: 'Victor Vidal', updatedByName: 'Ana Pérez', prunedVersionsCount: 4,
      clients: [4], projects: [12],
      relations: { clients: [4], projects: [12], requirements: [7, 777], tasks: [9] },
      lock: { sessionId: SESSION_ID, holder: 'zitadel-sub-02', holderName: 'Victor Vidal', via: 'human', expiresAt: '2026-10-26T12:00:00Z' },
    };
    fakeBus.moduleReply('documents.get', success(document));
    const res = await get(URL);
    res.status.should.equal(200);
    fakeBus.moduleSent.length.should.equal(1);
    fakeBus.moduleSent[0].method.should.equal('documents.get');
    (fakeBus.moduleSent[0].payload as any).should.deepEqual({
      id: DOC_ID, include: ['content', 'relations', 'topics', 'lock', 'attachments'], actor: expectedActor('token_01_user'),
    });
    res.body.should.not.have.property('folder');
    res.body.clientRefs.should.deepEqual([{ id: 4, name: 'EXO' }]);
    res.body.projectRefs.should.deepEqual([{ id: 12, name: 'Videoconferencia', code: 'VID', clientId: 4 }]);
    res.body.requirementRefs.should.deepEqual([
      { id: 7, title: 'Login con SSO', projectId: 12 }, { id: 777, title: null, projectId: null },
    ]);
    res.body.taskRefs.should.deepEqual([{ id: 9, title: 'Migrar a Postgres 16', projectId: 12 }]);
    res.body.prunedVersionsCount.should.equal(4);
    res.body.createdByName.should.equal('Victor Vidal');
    res.body.lock.holderName.should.equal('Victor Vidal');
  });

  it('S-094 · TS-24: restricted pasa verbatim (admin)', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success({ ...DOCUMENT, visibility: 'restricted' }));
    const res = await get(URL, 'token_03_admin');
    res.status.should.equal(200);
    res.body.visibility.should.equal('restricted');
  });

  it('S-094 · TS-25: sin relations ni clients, refs vacías y sin consultas', async () => {
    await docsAvailable();
    const { relations, ...bare } = DOCUMENT;
    fakeBus.moduleReply('documents.get', success(bare));
    const clientSpy = sinon.spy(Client, 'findAll');
    const projectSpy = sinon.spy(Project, 'findAll');
    const res = await get(URL);
    res.status.should.equal(200);
    ['clientRefs', 'projectRefs', 'requirementRefs', 'taskRefs'].forEach((k) => res.body[k].should.deepEqual([]));
    clientSpy.callCount.should.equal(0);
    projectSpy.callCount.should.equal(0);
    sinon.restore();
  });

  it('S-094 · TS-26: version_pruned responde 404 con details', async () => {
    await docsAvailable();
    const details = { requestedVersion: 7, previousAvailable: 5, nextAvailable: 9 };
    fakeBus.moduleReply('documents.get', failure('version_pruned', 'La versión 7 fue compactada', details));
    const res = await get(`${URL}?version=7`);
    res.status.should.equal(404);
    res.body.should.deepEqual({ code: 'version_pruned', message: 'La versión 7 fue compactada', details });
    (fakeBus.lastModule!.payload as any).version.should.equal(7);
  });

  it('S-078 · TS-12: versión pedida', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success(DOCUMENT));
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
    const res = await get(URL);
    res.status.should.equal(200);
    res.body.contentUrl.should.equal('https://s3.example/doc?sig=1');
    res.body.should.not.have.property('content');
    res.body.should.not.have.property('folder');
  });

  it('S-078 · TS-14: documento inexistente o no visible', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', failure('document_not_found', 'Documento no encontrado'));
    const res = await get(URL);
    res.status.should.equal(404);
    res.body.should.deepEqual({ code: 'document_not_found', message: 'Documento no encontrado' });
    fakeBus.moduleSent.length.should.equal(1);
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
    (await get(URL, 'token_08_no_roles')).status.should.equal(403);
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_01_user');
});
