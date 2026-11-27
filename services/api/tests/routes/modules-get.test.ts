import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { docsModule } from '../../lib/modules/registry';
import { fakeBus } from '../mocks/bus';

const REC = { module: 'docs', serviceName: 'jiku-docs', protocol: 'v1', registeredAt: '2026-10-24T12:00:00.000Z' };

describe('GET /api/modules (S-077)', () => {
  let application: Application;

  before(() => {
    application = start();
  });

  afterEach(() => {
    docsModule.stop();
    delete process.env.JIKU_PUBLIC_URL;
  });

  const get = (token = 'token_01_user') =>
    request(application).get('/api/modules').set('Authorization', `Bearer ${token}`);

  async function makeAvailable() {
    await fakeBus.kvPut('docs', REC);
    fakeBus.pingResponds('jiku-docs', true);
    await docsModule.start();
  }

  it('S-077 · TS-48: sin módulo', async () => {
    const res = await get();
    res.status.should.equal(200);
    res.body.should.deepEqual([{ module: 'docs', status: 'not_installed' }]);
  });

  it('S-077 · TS-49: available con links públicos', async () => {
    process.env.JIKU_PUBLIC_URL = 'http://127.0.0.1:3100';
    await makeAvailable();
    const res = await get();
    res.status.should.equal(200);
    res.body.should.deepEqual([{ module: 'docs', status: 'available', features: { sharing: true } }]);
  });

  it('S-077 · TS-50: sharing false sin JIKU_PUBLIC_URL', async () => {
    delete process.env.JIKU_PUBLIC_URL;
    await makeAvailable();
    (await get()).body.should.deepEqual([{ module: 'docs', status: 'available', features: { sharing: false } }]);
  });

  it('S-077 · TS-50: sharing false con JIKU_PUBLIC_URL en blanco', async () => {
    process.env.JIKU_PUBLIC_URL = '   ';
    await makeAvailable();
    (await get()).body.should.deepEqual([{ module: 'docs', status: 'available', features: { sharing: false } }]);
  });

  it('S-077 · TS-51: unavailable hacia afuera', async () => {
    await fakeBus.kvPut('docs', REC);
    await docsModule.start();
    const res = await get();
    res.status.should.equal(200);
    res.body.should.deepEqual([{ module: 'docs', status: 'unavailable', features: { sharing: false } }]);
  });

  it('S-077 · TS-52: incompatible se informa como not_installed', async () => {
    await fakeBus.kvPut('docs', { ...REC, protocol: 'v2' });
    await docsModule.start();
    (await get()).body.should.deepEqual([{ module: 'docs', status: 'not_installed' }]);
  });

  it('S-077 · TS-53: borrado en caliente, de punta a punta', async () => {
    await makeAvailable();
    (await get()).body[0].status.should.equal('available');
    await fakeBus.kvDelete('docs');
    (await get()).body.should.deepEqual([{ module: 'docs', status: 'not_installed' }]);
  });

  it('S-077 · TS-54: roles', async () => {
    (await get('token_03_admin')).status.should.equal(200);
    (await get('token_04_external_user')).status.should.equal(200);
    const res = await get('token_08_no_roles');
    res.status.should.equal(403);
    res.body.should.deepEqual({ code: 'access_denied', message: 'Access denied' });
  });

  it('S-077 · TS-55: sin token', async () => {
    const res = await request(application).get('/api/modules');
    res.status.should.equal(401);
    res.body.code.should.equal('unauthorized');
  });
});
