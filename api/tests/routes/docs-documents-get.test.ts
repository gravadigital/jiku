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

const DOC_PAGE = {
  items: [{
    id: DOC_ID, title: 'Acta de kickoff', path: '/clientes/acme/acta.md', folderId: FOLDER_ID, version: 3,
    visibility: 'internal', updatedAt: '2026-10-24T13:02:11.123Z', updatedBy: 'zitadel-sub-01', lock: null,
  }],
  page: { limit: 50, returned: 1 },
};

describe('GET /api/docs/documents (S-078)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  const get = (url: string, token = 'token_01_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);

  it('S-078 · TS-1: listado de un proyecto', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success(DOC_PAGE));
    const res = await get('/api/docs/documents?projectId=12');
    res.status.should.equal(200);
    res.body.should.deepEqual(DOC_PAGE);
    fakeBus.moduleSent.length.should.equal(1);
    fakeBus.lastModule!.should.deepEqual({
      kind: 'query',
      method: 'documents.list',
      subject: Q + 'documents.list',
      payload: {
        filter: { projectId: 12 }, sort: ['-updatedAt'], page: { limit: 50 }, include: ['lock'],
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
        projectId: 12, requirementId: 34, taskId: 56, clientId: 7, folderId: FOLDER_ID,
        pathPrefix: '/clientes/', topic: 'kickoff',
      },
      sort: ['title'], page: { limit: 20, cursor: 'abc' }, include: ['lock'], actor: expectedActor('token_01_user'),
    });
  });

  it('S-078 · TS-3: sin filtros, admin', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success(DOC_PAGE));
    const res = await get('/api/docs/documents', 'token_03_admin');
    res.status.should.equal(200);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      filter: {}, sort: ['-updatedAt'], page: { limit: 50 }, include: ['lock'], actor: expectedActor('token_03_admin'),
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
    for (const q of ['projectId=abc', 'limit=0', 'limit=201', 'folderId=no-es-ulid', 'sort=size', 'visibility=public', 'foo=1']) {
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
});
