import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { docsAvailable, itRespectsModuleState, success } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

describe('GET /api/docs/topics (S-078)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  const get = (url: string, token = 'token_01_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);

  it('S-078 · TS-21: temas', async () => {
    await docsAvailable();
    const data = { items: [{ topic: 'infra', documents: 4 }], page: { limit: 50, returned: 1 } };
    fakeBus.moduleReply('topics.list', success(data));
    const a = await get('/api/docs/topics?prefix=inf');
    a.status.should.equal(200);
    a.body.should.deepEqual(data);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      filter: { prefix: 'inf' }, page: { limit: 50 }, actor: { id: 'zitadel-sub-01' },
    });
    await get('/api/docs/topics');
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      filter: {}, page: { limit: 50 }, actor: { id: 'zitadel-sub-01' },
    });
  });

  it('S-078 · query inválida y rol', async () => {
    await docsAvailable();
    (await get('/api/docs/topics?limit=0')).status.should.equal(400);
    (await get('/api/docs/topics', 'token_08_no_roles')).status.should.equal(403);
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, '/api/docs/topics', 'token_01_user');
});
