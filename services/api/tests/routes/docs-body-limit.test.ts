import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { DOC_ID, SESSION_ID, docsAvailable, docsNotInstalled } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const BIG = 'a'.repeat(800 * 1024);
const PAYLOAD_TOO_LARGE = { code: 'payload_too_large', message: 'El cuerpo de la solicitud supera el límite permitido' };

/**
 * Decisión del dueño del producto sobre el punto abierto 1 del plan de S-079: el límite de
 * `express.json()` sube SOLO para las escrituras de /api/docs; el resto de la api conserva los
 * 100 kb por defecto de body-parser.
 */
describe('Límite de body JSON (S-079)', () => {
  let application: Application;
  before(() => { application = start(); });

  it('S-079 · una ruta fuera de /docs sigue rechazando con 413 un body de 150 kb', async () => {
    const res = await request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({ weekStart: '2026-08-17', allocations: [], pad: 'a'.repeat(150 * 1024) });
    res.status.should.equal(413);
    res.body.should.deepEqual(PAYLOAD_TOO_LARGE);
    fakeBus.sent.length.should.equal(0);
  });

  it('S-079 · un POST fuera de /docs también conserva el límite', async () => {
    const res = await request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_03_admin')
      .send({ name: 'a'.repeat(150 * 1024) });
    res.status.should.equal(413);
    res.body.should.deepEqual(PAYLOAD_TOO_LARGE);
    fakeBus.sent.length.should.equal(0);
  });
});

describe('413 en JSON (S-088)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  it('S-088 · TS-1 (CA-2): PUT de docs mayor a 768 KiB responde 413 JSON sin llegar al módulo', async () => {
    await docsAvailable();
    const res = await request(application)
      .put(`/api/docs/documents/${DOC_ID}`)
      .set('Authorization', 'Bearer token_01_user')
      .send({ baseVersion: 6, content: BIG, sessionId: SESSION_ID });
    res.status.should.equal(413);
    res.headers['content-type'].should.match(/application\/json/);
    res.body.should.deepEqual(PAYLOAD_TOO_LARGE);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-088 · TS-2 (CA-2): POST de docs mayor a 768 KiB responde 413 JSON sin llegar al módulo', async () => {
    await docsAvailable();
    const res = await request(application)
      .post('/api/docs/documents')
      .set('Authorization', 'Bearer token_01_user')
      .send({ folderId: DOC_ID, fileName: 'acta.md', content: BIG });
    res.status.should.equal(413);
    res.body.should.deepEqual(PAYLOAD_TOO_LARGE);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-094 · TS-39: POST de relations mayor a 768 KiB responde 413 sin llegar al módulo', async () => {
    await docsAvailable();
    const res = await request(application)
      .post(`/api/docs/documents/${DOC_ID}/relations`)
      .set('Authorization', 'Bearer token_01_user')
      .send({ baseVersion: 3, add: { projects: [12] }, pad: BIG });
    res.status.should.equal(413);
    res.body.should.deepEqual(PAYLOAD_TOO_LARGE);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-088 · TS-3 (CA-2): el 413 corta antes que el estado del módulo', async () => {
    await docsNotInstalled();
    const res = await request(application)
      .put(`/api/docs/documents/${DOC_ID}`)
      .set('Authorization', 'Bearer token_01_user')
      .send({ baseVersion: 6, content: BIG });
    res.status.should.equal(413);
    res.body.should.deepEqual(PAYLOAD_TOO_LARGE);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-088 · TS-6 (CA-3): una ruta inexistente sigue en el finalhandler', async () => {
    const res = await request(application)
      .get('/api/ruta-que-no-existe')
      .set('Authorization', 'Bearer token_03_admin');
    res.status.should.equal(404);
    res.headers['content-type'].should.match(/text\/html/);
    (res.body.code === undefined).should.be.true();
    res.text.should.not.match(/payload_too_large/);
  });

  it('S-088 · TS-7 (CA-3): un JSON malformado sigue en el finalhandler', async () => {
    const res = await request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_03_admin')
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    res.status.should.equal(400);
    res.headers['content-type'].should.match(/text\/html/);
    res.text.should.not.match(/payload_too_large/);
    fakeBus.sent.length.should.equal(0);
  });
});
