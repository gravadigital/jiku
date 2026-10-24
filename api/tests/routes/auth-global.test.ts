import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { fakeBus } from '../mocks/bus';

/**
 * CA-7 de S-009 se enuncia sobre TODA la superficie HTTP, no sobre el endpoint eliminado:
 * cualquier método y cualquier path, sin token, responde 401. Este archivo lo convierte en un
 * test, porque es el invariante que la story deja como única puerta.
 *
 * La protección NO está en el archivo de cada ruta: `app.ts:29-32` instala `validateToken`
 * globalmente con el regex de `publicPaths(method)`, y desde REQ-002 ese regex no exime ningún
 * path (ver `tests/utils/public-paths.test.ts`, que prueba el mecanismo sin base de datos).
 * ADR-008: leer un archivo de ruta y no ver el middleware NO significa que esté desprotegido.
 *
 * SIN FIXTURES, Y ES PARTE DE LO QUE SE AFIRMA: el 401 ocurre antes de que la petición toque
 * la base, así que los ids que aparecen abajo son arbitrarios y su existencia es irrelevante.
 * Si alguno de estos casos necesitara que la fila exista, el test estaría probando otra cosa.
 *
 * El path del endpoint eliminado NO se agrega acá a propósito: lo cubren TS-1 a TS-7 en
 * `tests/routes/opus-attachments-preview.test.ts`. Duplicarlo repartiría la misma aserción en
 * dos archivos y haría que un cambio futuro actualice uno solo.
 */
describe('Cobertura global de validateToken — ninguna ruta queda exenta', () => {
  let application: Application;

  before(function () {
    this.timeout(30000);
    application = start();
  });

  // TS-8: GET. Ruta declarada en `clients-get.ts:42`.
  it('responde 401 sin publicar en GET /api/clients sin token', () => {
    return request(application)
      .get('/api/clients')
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        res.body.message.should.equal('Unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-9: PATCH. Ruta declarada en `clients-patch.ts:41` (`/clients/:id`).
  it('responde 401 sin publicar en PATCH /api/clients/1 sin token', () => {
    return request(application)
      .patch('/api/clients/1')
      .send({ name: 'Acme' })
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-10: POST. Ruta declarada en `clients-post.ts:40`.
  it('responde 401 sin publicar en POST /api/clients sin token', () => {
    return request(application)
      .post('/api/clients')
      .send({ name: 'Acme' })
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-11: DELETE. Ruta declarada en `attachments-delete.ts:102` (`/attachments/:id`).
  //
  // Esa ruta declara además `validateToken` en su propia cadena, redundante con la instalación
  // global e inofensivo. El test afirma el 401 —que es lo que CA-7 pide— y NO intenta
  // distinguir de cuál de los dos vino: son indistinguibles desde el cliente, y deben serlo.
  it('responde 401 sin publicar en DELETE /api/attachments/1 sin token', () => {
    return request(application)
      .delete('/api/attachments/1')
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-12: PUT. Desde REQ-016 (H-3) `app.ts` instala `validateToken` tambien para `PUT`
  // (`publicPaths('put')`): la asimetria con los otros cuatro metodos se cerro y
  // `week-assigned-times-put.ts` ya no declara `validateToken` en su cadena.
  it('responde 401 en PUT /api/week-assigned-times sin token, por la cobertura global (H-3)', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .send({ weekStart: '2026-08-17', assignments: [] })
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // S-079 · TS-16 (CA-S6): un PUT de docs sin token es 401 aunque el modulo no este instalado.
  it('S-079 · TS-16: responde 401 en PUT /api/docs/documents/:id sin token', () => {
    return request(application)
      .put('/api/docs/documents/01JB2Z3K4M5N6P7Q8R9S0T1V2W')
      .send({ baseVersion: 6, content: 'x' })
      .expect(401)
      .then(res => {
        res.body.should.deepEqual({ code: 'unauthorized', message: 'Unauthorized' });
        fakeBus.moduleSent.length.should.equal(0);
      });
  });
});
