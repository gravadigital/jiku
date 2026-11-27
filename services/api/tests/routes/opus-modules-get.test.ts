import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { docsModule } from '../../lib/modules/registry';
import { fakeBus } from '../mocks/bus';

const REC = { module: 'docs', serviceName: 'jiku-docs', protocol: 'v1', registeredAt: '2026-10-24T12:00:00.000Z' };

describe('GET /api/opus/modules (S-077)', () => {
  let application: Application;

  before(() => {
    application = start();
  });

  afterEach(() => {
    docsModule.stop();
    delete process.env.JIKU_PUBLIC_URL;
  });

  const get = (token: string) =>
    request(application).get('/api/opus/modules').set('Authorization', `Bearer ${token}`);

  it('S-077 · TS-56: external-user, sin módulo y available', async () => {
    const a = await get('token_04_external_user');
    a.status.should.equal(200);
    a.body.should.deepEqual([{ module: 'docs', status: 'not_installed' }]);

    process.env.JIKU_PUBLIC_URL = 'http://127.0.0.1:3100';
    await fakeBus.kvPut('docs', REC);
    fakeBus.pingResponds('jiku-docs', true);
    await docsModule.start();
    const b = await get('token_04_external_user');
    b.status.should.equal(200);
    b.body.should.deepEqual([{ module: 'docs', status: 'available', features: { sharing: true } }]);

    const plain = await request(application).get('/api/modules').set('Authorization', 'Bearer token_04_external_user');
    plain.body.should.deepEqual(b.body);
  });

  it('S-077 · TS-57: roles en el portal', async () => {
    (await get('token_01_user')).status.should.equal(200);
    const res = await get('token_08_no_roles');
    res.status.should.equal(403);
    res.body.code.should.equal('access_denied');
  });
});
