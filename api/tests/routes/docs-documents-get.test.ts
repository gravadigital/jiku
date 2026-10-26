import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  DOC_ID, FOLDER_ID, QUERY_SUBJECT_PREFIX as Q, docsAvailable, failure, itRespectsModuleState, success,
  expectedActor,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';
import sinon from 'sinon';
import { Client, Project } from '@jiku/models';
import { createDocsFixtures, destroyDocsFixtures } from '../helpers/docs-fixtures';

const DOC_PAGE = {
  items: [{
    id: DOC_ID, title: 'Acta de kickoff', path: '/clientes/acme/acta.md', folderId: FOLDER_ID, version: 3,
    visibility: 'internal', updatedAt: '2026-10-24T13:02:11.123Z', updatedBy: 'zitadel-sub-01', lock: null,
  }],
  page: { limit: 50, returned: 1 },
};

describe('GET /api/docs/documents (S-078)', () => {
  let application: Application;
  before(async function () { this.timeout(30000); application = start(); await createDocsFixtures(); });
  after(() => destroyDocsFixtures());
  afterEach(() => { sinon.restore(); docsModule.stop(); });

  const get = (url: string, token = 'token_01_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);

  it('S-078 · TS-1: listado de un proyecto', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success(DOC_PAGE));
    const res = await get('/api/docs/documents?projectId=12');
    res.status.should.equal(200);
    res.body.should.deepEqual({ ...DOC_PAGE, items: [{ ...DOC_PAGE.items[0], clientRefs: [], projectRefs: [] }] });
    fakeBus.moduleSent.length.should.equal(1);
    fakeBus.lastModule!.should.deepEqual({
      kind: 'query',
      method: 'documents.list',
      subject: Q + 'documents.list',
      payload: {
        filter: { projectId: [12] }, sort: ['-updatedAt'], page: { limit: 50 }, include: ['lock', 'topics'],
        actor: expectedActor('token_01_user'),
      },
    });
  });

  it('S-078 · TS-2: todos los filtros, orden y paginación', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success(DOC_PAGE));
    const res = await get(
      `/api/docs/documents?projectId=12&requirementId=34&taskId=56&clientId=7&folderId=${FOLDER_ID}` +
      '&pathPrefix=/clientes/&topic=kickoff&sort=title&limit=20&cursor=abc'
    );
    res.status.should.equal(200);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      filter: {
        projectId: [12], requirementId: 34, taskId: 56, clientId: [7], folderId: FOLDER_ID,
        pathPrefix: '/clientes/', topic: ['kickoff'],
      },
      sort: ['title'], page: { limit: 20, cursor: 'abc' }, include: ['lock', 'topics'], actor: expectedActor('token_01_user'),
    });
  });

  it('S-078 · TS-3: sin filtros, admin', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success(DOC_PAGE));
    const res = await get('/api/docs/documents', 'token_03_admin');
    res.status.should.equal(200);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      filter: {}, sort: ['-updatedAt'], page: { limit: 50 }, include: ['lock', 'topics'], actor: expectedActor('token_03_admin'),
    });
  });

  it('S-089 · TS-13: actor con perfil de punta a punta', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success(DOC_PAGE));
    const res = await get('/api/docs/documents?projectId=12', 'token_05_user_profile');
    res.status.should.equal(200);
    (fakeBus.lastModule!.payload as any).actor.should.deepEqual(expectedActor('token_05_user_profile'));
    (fakeBus.lastModule!.payload as any).actor.should.deepEqual({
      id: 'zitadel-sub-05', roles: ['user'], name: 'Ana Pérez', username: 'ana@grava.digital', email: 'ana@grava.digital',
    });
  });

  it('S-078 · TS-4: rol rechazado en la superficie interna', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      const res = await get('/api/docs/documents?projectId=12', token);
      res.status.should.equal(403);
      res.body.should.deepEqual({ code: 'access_denied', message: 'Access denied' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · TS-5: query inválida', async () => {
    await docsAvailable();
    for (const q of ['projectId=abc', 'limit=0', 'limit=201', 'folderId=no-es-ulid', 'sort=size', 'visibility=secret', 'foo=1']) {
      const res = await get(`/api/docs/documents?${q}`);
      res.status.should.equal(400, q);
      res.body.code.should.equal('invalid_fields');
      res.body.message.should.startWith('Invalid field - ');
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · TS-6: limit=200 es el máximo válido', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success(DOC_PAGE));
    const res = await get('/api/docs/documents?limit=200');
    res.status.should.equal(200);
    (fakeBus.lastModule!.payload as any).page.should.deepEqual({ limit: 200 });
  });

  it('S-078 · TS-44: requireModule va antes del rol', async () => {
    await docsModule.start();
    const res = await get('/api/docs/documents', 'token_04_external_user');
    res.status.should.equal(404);
    res.body.code.should.equal('module_not_installed');
  });

  itRespectsModuleState(() => application, '/api/docs/documents', 'token_01_user');

  it('S-078 · TS-9: errores de jiku-docs traducidos', async () => {
    await docsAvailable();
    const cases: Array<[any, number, any]> = [
      [failure('upstream_unavailable', 'core no responde'), 503, { code: 'upstream_unavailable', message: 'core no responde' }],
      [failure('invalid_cursor', 'Cursor inválido', { cursor: 'abc' }), 400,
        { code: 'invalid_cursor', message: 'Cursor inválido', details: { cursor: 'abc' } }],
      [failure('query_timeout', 'lento'), 504, { code: 'query_timeout', message: 'lento' }],
      [failure('brand_new_code', 'x'), 500, { code: 'brand_new_code', message: 'x' }],
    ];
    for (const [reply, status, body] of cases) {
      fakeBus.moduleReply('documents.list', reply);
      const res = await get('/api/docs/documents');
      res.status.should.equal(status);
      res.body.should.deepEqual(body);
    }
  });

  it('S-078 · TS-10: sin reply', async () => {
    await docsAvailable();
    fakeBus.moduleFailWithTimeout();
    const a = await get('/api/docs/documents');
    a.status.should.equal(504);
    a.body.should.deepEqual({ code: 'gateway_timeout', message: 'La operación tardó demasiado' });

    fakeBus.pingResponds('jiku-docs', false);
    fakeBus.moduleFailWithNoResponders();
    const b = await get('/api/docs/documents');
    b.status.should.equal(503);
    b.body.code.should.equal('module_unavailable');
    docsModule.status().should.equal('unavailable');
  });

  // ---- S-094: filtros 1.3.0, count, myActiveProjects y refs ----
  const payload = () => fakeBus.lastModule!.payload as any;
  const EMPTY_PAGE = success({ items: [], page: { limit: 50, returned: 0 } });

  it('S-094 · TS-1: sin parámetros, payload por defecto y sin consultas de refs', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', EMPTY_PAGE);
    const clientSpy = sinon.spy(Client, 'findAll');
    const projectSpy = sinon.spy(Project, 'findAll');
    const res = await get('/api/docs/documents');
    res.status.should.equal(200);
    res.body.should.deepEqual({ items: [], page: { limit: 50, returned: 0 } });
    payload().should.deepEqual({
      filter: {}, sort: ['-updatedAt'], page: { limit: 50 }, include: ['lock', 'topics'],
      actor: expectedActor('token_01_user'),
    });
    payload().should.not.have.property('count');
    clientSpy.callCount.should.equal(0);
    projectSpy.callCount.should.equal(0);
  });

  it('S-094 · TS-2/3: listas repetidas y valor único normalizado', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', EMPTY_PAGE);
    await get('/api/docs/documents?projectId=12&projectId=31&clientId=4&topic=video&topic=acta');
    payload().filter.should.deepEqual({ projectId: [12, 31], clientId: [4], topic: ['video', 'acta'] });
    await get('/api/docs/documents?projectId=12&topic=video');
    payload().filter.should.deepEqual({ projectId: [12], topic: ['video'] });
  });

  it('S-094 · TS-4: booleanos has*', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', EMPTY_PAGE);
    await get('/api/docs/documents?hasProject=false&hasClient=false&hasTopic=true');
    payload().filter.should.deepEqual({ hasProject: false, hasClient: false, hasTopic: true });
  });

  it('S-094 · TS-5: person -> filter.or', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', EMPTY_PAGE);
    await get('/api/docs/documents?person=zitadel-sub-01&person=zitadel-sub-02&clientId=4');
    payload().filter.should.deepEqual({
      clientId: [4],
      or: [{ createdBy: ['zitadel-sub-01', 'zitadel-sub-02'] }, { updatedBy: ['zitadel-sub-01', 'zitadel-sub-02'] }],
    });
  });

  it('S-094 · TS-6: visibility válida pasa, inválida 400 sin bus', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', EMPTY_PAGE);
    (await get('/api/docs/documents?visibility=restricted')).status.should.equal(200);
    payload().filter.should.deepEqual({ visibility: 'restricted' });
    fakeBus.reset();
    const res = await get('/api/docs/documents?visibility=secret');
    res.status.should.equal(400);
    res.body.code.should.equal('invalid_fields');
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-094 · TS-7/8: count=true manda la clave y devuelve page.total; count=false no', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success({ items: [], page: { limit: 20, returned: 0, total: 37 } }));
    const res = await get('/api/docs/documents?count=true&limit=20');
    res.status.should.equal(200);
    res.body.page.total.should.equal(37);
    payload().count.should.equal(true);
    payload().page.should.deepEqual({ limit: 20 });
    await get('/api/docs/documents?count=false');
    payload().should.not.have.property('count');
  });

  it('S-094 · TS-9: límites de listas en el borde', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', EMPTY_PAGE);
    const rep = (key: string, n: number) => Array.from({ length: n }, (_, i) => `${key}=${key === 'projectId' ? i + 1 : 'v' + i}`).join('&');
    const a = await get('/api/docs/documents?' + rep('projectId', 20));
    a.status.should.equal(200);
    payload().filter.projectId.length.should.equal(20);
    fakeBus.reset();
    (await get('/api/docs/documents?' + rep('projectId', 21))).status.should.equal(400);
    (await get('/api/docs/documents?' + rep('person', 11))).status.should.equal(400);
    (await get('/api/docs/documents?' + rep('topic', 21))).status.should.equal(400);
    fakeBus.moduleSent.length.should.equal(0);
    fakeBus.moduleReply('documents.list', EMPTY_PAGE);
    (await get('/api/docs/documents?' + rep('person', 10))).status.should.equal(200);
  });

  it('S-094 · TS-10: entero inválido en lista', async () => {
    await docsAvailable();
    for (const q of ['projectId=12&projectId=abc', 'clientId=0']) {
      const res = await get(`/api/docs/documents?${q}`);
      res.status.should.equal(400, q);
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-094 · TS-11: refs con nombre, desconocidos en null y orden de jiku-docs', async () => {
    await docsAvailable();
    const item = {
      id: DOC_ID, title: 'Acta', version: 3, visibility: 'internal', updatedByName: 'Ana Pérez', clients: [5, 4, 999],
      projects: [12, 998], projectMatch: 'direct', topics: ['acta'], lock: null,
    };
    fakeBus.moduleReply('documents.list', success({ items: [item], page: { limit: 50, returned: 1 } }));
    const res = await get('/api/docs/documents');
    res.status.should.equal(200);
    res.body.items[0].clientRefs.should.deepEqual([
      { id: 5, name: 'Acme' }, { id: 4, name: 'EXO' }, { id: 999, name: null },
    ]);
    res.body.items[0].projectRefs.should.deepEqual([
      { id: 12, name: 'Videoconferencia', code: 'VID', clientId: 4 },
      { id: 998, name: null, code: null, clientId: null },
    ]);
    const { clientRefs, projectRefs, ...rest } = res.body.items[0];
    rest.should.deepEqual(item);
  });

  it('S-094 · TS-12/13: una consulta por tipo; sin ids ninguna', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success({
      items: [
        { id: DOC_ID, clients: [4], projects: [12] },
        { id: DOC_ID, clients: [5], projects: [40] },
        { id: DOC_ID, clients: [4], projects: [12, 40] },
      ],
      page: { limit: 50, returned: 3 },
    }));
    const clientSpy = sinon.spy(Client, 'findAll');
    const projectSpy = sinon.spy(Project, 'findAll');
    const res = await get('/api/docs/documents');
    res.status.should.equal(200);
    clientSpy.callCount.should.equal(1);
    projectSpy.callCount.should.equal(1);
    res.body.items[1].projectRefs[0].name.should.equal('Videoteca');
    clientSpy.resetHistory();
    projectSpy.resetHistory();
    fakeBus.moduleReply('documents.list', success({
      items: [{ id: DOC_ID, clients: [], projects: [] }, { id: DOC_ID }], page: { limit: 50, returned: 2 },
    }));
    const empty = await get('/api/docs/documents');
    empty.body.items.forEach((i: any) => { i.clientRefs.should.deepEqual([]); i.projectRefs.should.deepEqual([]); });
    clientSpy.callCount.should.equal(0);
    projectSpy.callCount.should.equal(0);
  });

  it('S-094 · TS-14: myActiveProjects con proyectos activos de la persona', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', EMPTY_PAGE);
    const res = await get('/api/docs/documents?myActiveProjects=true');
    res.status.should.equal(200);
    payload().filter.projectId.should.deepEqual([12, 50]);
    payload().actor.should.deepEqual(expectedActor('token_01_user'));
  });

  it('S-094 · TS-15/16: myActiveProjects sin proyectos responde sin bus', async () => {
    await docsAvailable();
    const a = await get('/api/docs/documents?myActiveProjects=true&limit=20', 'token_02_user');
    a.status.should.equal(200);
    a.body.should.deepEqual({ items: [], page: { limit: 20, returned: 0 } });
    const b = await get('/api/docs/documents?myActiveProjects=true', 'token_03_admin');
    b.body.should.deepEqual({ items: [], page: { limit: 50, returned: 0 } });
    const c = await get('/api/docs/documents?myActiveProjects=true&count=true', 'token_02_user');
    c.body.should.deepEqual({ items: [], page: { limit: 50, returned: 0, total: 0 } });
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-094 · TS-17: myActiveProjects con projectId es 400', async () => {
    await docsAvailable();
    const res = await get('/api/docs/documents?myActiveProjects=true&projectId=12');
    res.status.should.equal(400);
    res.body.code.should.equal('invalid_fields');
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-094 · TS-18/19: myActiveProjects=false no filtra; combina con otros filtros', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', EMPTY_PAGE);
    await get('/api/docs/documents?myActiveProjects=false');
    payload().filter.should.deepEqual({});
    await get('/api/docs/documents?myActiveProjects=true&hasTopic=false');
    payload().filter.should.deepEqual({ projectId: [12, 50], hasTopic: false });
  });

  it('S-094 · TS-56: rol rechazado en el listado (externo y sin roles)', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      (await get('/api/docs/documents?myActiveProjects=true', token)).status.should.equal(403);
    }
    fakeBus.moduleSent.length.should.equal(0);
  });
});
