import 'mocha';
import 'should';
import express from 'express';
import request from 'supertest';
import { docsModule } from '../../lib/modules/registry';
import requireModule from '../../lib/utils/middlewares/require-module';
import { fakeBus } from '../mocks/bus';

const REC = { module: 'docs', serviceName: 'jiku-docs', protocol: 'v1', registeredAt: '2026-10-24T12:00:00.000Z' };
const NOT_INSTALLED = { code: 'module_not_installed', message: 'El módulo docs no está instalado' };
const UNAVAILABLE = { code: 'module_unavailable', message: 'El módulo docs no está disponible en este momento' };

function app() {
  const a = express();
  a.get('/probe', requireModule('docs'), (_req, res) => res.status(200).json({ ok: true }));
  return a;
}

describe('S-077 · requireModule', () => {
  afterEach(() => docsModule.stop());

  it('S-077 · TS-43: not_installed → 404', async () => {
    const res = await request(app()).get('/probe');
    res.status.should.equal(404);
    res.body.should.deepEqual(NOT_INSTALLED);
  });

  it('S-077 · TS-44: incompatible → 404', async () => {
    await fakeBus.kvPut('docs', { ...REC, protocol: 'v2' });
    await docsModule.start();
    const res = await request(app()).get('/probe');
    res.status.should.equal(404);
    res.body.should.deepEqual(NOT_INSTALLED);
  });

  it('S-077 · TS-45: unavailable → 503', async () => {
    await fakeBus.kvPut('docs', REC);
    await docsModule.start();
    const res = await request(app()).get('/probe');
    res.status.should.equal(503);
    res.body.should.deepEqual(UNAVAILABLE);
  });

  it('S-077 · TS-46: available → next()', async () => {
    await fakeBus.kvPut('docs', REC);
    fakeBus.pingResponds('jiku-docs', true);
    await docsModule.start();
    const res = await request(app()).get('/probe');
    res.status.should.equal(200);
    res.body.should.deepEqual({ ok: true });
  });

  it('S-077 · TS-47: sigue al registro en caliente', async () => {
    await fakeBus.kvPut('docs', REC);
    fakeBus.pingResponds('jiku-docs', true);
    await docsModule.start();
    (await request(app()).get('/probe')).status.should.equal(200);
    await fakeBus.kvDelete('docs');
    const res = await request(app()).get('/probe');
    res.status.should.equal(404);
    res.body.should.deepEqual(NOT_INSTALLED);
  });
});
