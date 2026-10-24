import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';

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
    fakeBus.sent.length.should.equal(0);
  });

  it('S-079 · un POST fuera de /docs también conserva el límite', async () => {
    const res = await request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_03_admin')
      .send({ name: 'a'.repeat(150 * 1024) });
    res.status.should.equal(413);
  });
});
