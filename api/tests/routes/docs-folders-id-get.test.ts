import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { FOLDER_ID, docsAvailable, failure, itRespectsModuleState, success } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

describe('GET /api/docs/folders/:id (S-078)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  const get = (url: string, token = 'token_01_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);
  const URL = `/api/docs/folders/${FOLDER_ID}`;

  it('S-078 · TS-23: carpeta por id, sin acl', async () => {
    await docsAvailable();
    const data = { id: FOLDER_ID, path: '/clientes/acme/', effectivePermission: 'manage', sharingBlocked: false };
    fakeBus.moduleReply('folders.get', success(data));
    const res = await get(URL);
    res.status.should.equal(200);
    res.body.should.deepEqual(data);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      id: FOLDER_ID, include: ['effectivePermission'], actor: { id: 'zitadel-sub-01' },
    });
  });

  it('S-078 · TS-24: inexistente o id malformado', async () => {
    await docsAvailable();
    fakeBus.moduleReply('folders.get', failure('folder_not_found', 'Carpeta no encontrada'));
    const a = await get(URL);
    a.status.should.equal(404);
    a.body.should.deepEqual({ code: 'folder_not_found', message: 'Carpeta no encontrada' });

    fakeBus.reset();
    const b = await get('/api/docs/folders/abc');
    b.status.should.equal(404);
    b.body.should.deepEqual({ code: 'folder_not_found', message: 'Carpeta no encontrada' });
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · rol rechazado', async () => {
    await docsAvailable();
    (await get(URL, 'token_08_no_roles')).status.should.equal(403);
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_01_user');
});
