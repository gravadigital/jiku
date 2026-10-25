import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { FOLDER_ID, docsAvailable, itRespectsModuleState, success, expectedActor } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

describe('GET /api/docs/folders (S-078)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  const get = (url: string, token = 'token_01_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);

  it('S-078 · TS-22: carpetas', async () => {
    await docsAvailable();
    const data = {
      items: [{ id: FOLDER_ID, name: 'acme', path: '/clientes/acme/', parentId: null, effectivePermission: 'read' }],
      page: { limit: 50, returned: 1 },
    };
    fakeBus.moduleReply('folders.list', success(data));
    const res = await get(`/api/docs/folders?parentId=${FOLDER_ID}&pathPrefix=/clientes/`);
    res.status.should.equal(200);
    res.body.should.deepEqual(data);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      filter: { parentId: FOLDER_ID, pathPrefix: '/clientes/' }, sort: ['name'], page: { limit: 50 },
      include: ['effectivePermission'], actor: expectedActor('token_01_user'),
    });

    fakeBus.reset();
    (await get('/api/docs/folders?parentId=x')).status.should.equal(400);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · rol rechazado', async () => {
    await docsAvailable();
    (await get('/api/docs/folders', 'token_04_external_user')).status.should.equal(403);
  });

  itRespectsModuleState(() => application, '/api/docs/folders', 'token_01_user');
});
