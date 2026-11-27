import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { docsAvailable, failure, itRespectsModuleState, success, expectedActor } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';
import { createDocsFixtures, destroyDocsFixtures } from '../helpers/docs-fixtures';

const URL = '/api/docs/suggestions';
const TOPICS = success({ items: [{ topic: 'video', documents: 7 }], page: { limit: 5, returned: 1 } });
const VICTOR = { userId: 'zitadel-sub-02', name: 'Victor Vidal' };

describe('GET /api/docs/suggestions (S-094)', () => {
  let application: Application;
  before(async function () { this.timeout(30000); application = start(); await createDocsFixtures(); });
  after(() => destroyDocsFixtures());
  afterEach(() => docsModule.stop());
  const get = (query: string, token = 'token_01_user') =>
    request(application).get(`${URL}?${query}`).set('Authorization', `Bearer ${token}`);
  const ready = async () => { await docsAvailable(); fakeBus.moduleReply('topics.list', TOPICS); };

  it('S-094 · TS-43: grupos y orden (mine, activos, resto)', async () => {
    await ready();
    const res = await get('q=vid');
    res.status.should.equal(200);
    res.body.should.deepEqual({
      projects: [
        { id: 12, name: 'Videoconferencia', code: 'VID', clientId: 4, clientName: 'EXO', mine: true },
        { id: 40, name: 'Videoteca', code: 'VTK', clientId: 5, clientName: 'Acme', mine: false },
        { id: 31, name: 'Video Wall', code: 'VWL', clientId: 4, clientName: 'EXO', mine: false },
      ],
      clients: [],
      persons: [VICTOR],
      topics: [{ topic: 'video', documents: 7 }],
    });
    fakeBus.lastModule!.method.should.equal('topics.list');
    fakeBus.lastModule!.payload.should.deepEqual({
      filter: { prefix: 'vid' }, page: { limit: 5 }, actor: expectedActor('token_01_user'),
    });
  });

  it('S-094 · TS-44: clientId limita solo proyectos', async () => {
    await ready();
    const res = await get('q=vid&clientId=4');
    res.body.projects.map((p: any) => p.id).should.deepEqual([12, 31]);
    res.body.projects[0].mine.should.equal(true);
    res.body.persons.should.deepEqual([VICTOR]);
    res.body.topics.should.deepEqual([{ topic: 'video', documents: 7 }]);
  });

  it('S-094 · TS-45: tope por grupo en el borde', async () => {
    await ready();
    const res = await get('q=vid&limit=1');
    res.body.projects.map((p: any) => p.id).should.deepEqual([12]);
    res.body.persons.length.should.equal(1);
    (fakeBus.lastModule!.payload as any).page.should.deepEqual({ limit: 1 });
  });

  it('S-094 · TS-46/47: por código sin distinguir mayúsculas; clientes', async () => {
    await ready();
    (await get('q=VT')).body.projects.map((p: any) => p.id).should.deepEqual([40]);
    (await get('q=ex')).body.clients.should.deepEqual([{ id: 4, name: 'EXO' }]);
  });

  it('S-094 · TS-48: personas sin userId o deshabilitadas quedan fuera', async () => {
    await ready();
    (await get('q=vi')).body.persons.should.deepEqual([VICTOR]);
  });

  it('S-094 · TS-49: comodines escapados', async () => {
    await ready();
    for (const q of ['%25', '_']) {
      const res = await get(`q=${q}`);
      res.status.should.equal(200);
      res.body.projects.should.deepEqual([]);
      res.body.clients.should.deepEqual([]);
      res.body.persons.should.deepEqual([]);
    }
  });

  it('S-094 · TS-50: validación, sin bus', async () => {
    await docsAvailable();
    for (const q of ['', 'q=', `q=${'a'.repeat(101)}`, 'q=vid&limit=0', 'q=vid&limit=11', 'q=vid&clientId=abc', 'q=vid&projectId=12']) {
      const res = await get(q);
      res.status.should.equal(400, q.slice(0, 30));
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-094 · TS-51: q de 100 caracteres es válido', async () => {
    await ready();
    (await get(`q=${'a'.repeat(100)}`)).status.should.equal(200);
  });

  it('S-094 · TS-52: falla del módulo', async () => {
    await docsAvailable();
    fakeBus.moduleFailWithTimeout();
    const a = await get('q=vid');
    a.status.should.equal(504);
    a.body.code.should.equal('gateway_timeout');
    fakeBus.reset();
    fakeBus.moduleReply('topics.list', failure('invalid_fields', 'x'));
    const b = await get('q=vid');
    b.status.should.equal(400);
    b.body.should.deepEqual({ code: 'invalid_fields', message: 'x' });
  });

  it('S-094 · TS-56/58: roles rechazados; admin pasa', async () => {
    await ready();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      (await get('q=vid', token)).status.should.equal(403);
    }
    fakeBus.moduleSent.length.should.equal(0);
    const res = await get('q=vid', 'token_03_admin');
    res.status.should.equal(200);
    res.body.projects.every((p: any) => p.mine === false).should.equal(true);
    (fakeBus.lastModule!.payload as any).actor.should.deepEqual(expectedActor('token_03_admin'));
  });

  itRespectsModuleState(() => application, `${URL}?q=vid`, 'token_01_user', 'S-094 · TS-57: respeta el estado del módulo');
});
