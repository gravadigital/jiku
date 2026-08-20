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

  // TS-12: PUT, y ES UN CASO DISTINTO DE LOS CUATRO ANTERIORES.
  //
  // El 401 de este endpoint NO sale de la instalación global: sale de su propia cadena
  // (`week-assigned-times-put.ts:120-121`, que declara `validateToken` como primer
  // middleware). La interfaz `PublicPath` de `config/public.ts` declara solo `get`, `patch`,
  // `post` y `delete`, así que `publicPaths('put')` nunca se llama —lanzaría `TypeError`— y
  // `app.ts` no instala nada para `PUT`.
  //
  // La asimetría se deja documentada, no tapada: cerrarla (agregar `put` a `PublicPath`) es
  // otro alcance, afecta a un endpoint ajeno a adjuntos, y mezclarlo escondería el corte que
  // S-009 sí hace. Si mañana aparece un `PUT` nuevo sin `validateToken` en su cadena, este
  // test seguirá verde y el endpoint quedará abierto: la protección de este método hoy
  // depende de que su autor la declare.
  it('responde 401 en PUT /api/week-assigned-times sin token, por su cadena propia', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .send({ weekStart: '2026-08-17', assignments: [] })
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });
});
