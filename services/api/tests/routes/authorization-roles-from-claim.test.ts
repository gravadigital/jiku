import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { User } from '@jiku/models';

/**
 * CA-16 de S-017: el plano HTTP no cambia ni gana una consulta.
 *
 * Desde S-015 la tabla `users` tiene una columna `roles`, y desde S-016 está poblada con roles
 * reales. S-017 la volvió la fuente de autorización DEL PLANO DEL BUS —la compuerta de los dos
 * despachadores de core la lee— y CA-16 fija que EL PLANO HTTP NO LA USA: la autorización sale
 * del claim de Zitadel, como siempre.
 *
 * QUÉ ROMPERÍA ESTOS DOS TESTS: escribir `req.decodedTokenRoles = user.roles` (o cualquier
 * variante) en `lib/utils/middlewares/validate-token.ts`, que ya tiene el objeto `User` en la
 * mano después de su `User.findByPk(sub)`. Es un cambio de una línea que PARECE una mejora
 * —"autoricemos con lo que está en nuestra base"— y que introduce dos fuentes de autorización
 * para lo mismo, con la peor de las dos decidiendo. Si un test de acá se pone rojo, la pregunta
 * no es cómo arreglarlo: es si ese cambio era intencional.
 *
 * Las dos filas tienen `roles` que CONTRADICEN su claim a propósito. Es la única forma de
 * distinguir "autoriza por el claim" de "autoriza por la base" desde afuera.
 *
 * El endpoint sonda es `GET /api/week-assigned-times` porque declara `hasAnyRole(['admin',
 * 'user'])` ANTES de `validateQueryParams`, así que las dos direcciones se prueban sin sembrar
 * ninguna otra entidad. No usa el bus: los dos escenarios cortan en `hasAnyRole`, antes de
 * publicar nada.
 */
describe('CA-16: la autorización HTTP sale del claim, no de users.roles', () => {
  let application: Application;

  before(function () {
    application = start();

    return Promise.all([
      // Claim: `user` (token_01_user). Base: `external-user`, que NO está en
      // hasAnyRole(['admin', 'user']).
      User.create({
        id: 'zitadel-sub-01',
        name: 'User 01',
        username: 'user01',
        email: 'user01@mail.com',
        roles: ['external-user'],
      }),
      // Claim: `external-user` (token_04_external_user). Base: `admin`, el rol más alto.
      User.create({
        id: 'zitadel-sub-04',
        name: 'External User 01',
        username: 'external01',
        email: 'external01@mail.com',
        roles: ['admin'],
      }),
    ]);
  });

  after(() => {
    return User.destroy({ where: {} });
  });

  // TS-15 — la columna no puede DEGRADAR. Si la api leyera la base, `external-user` no está en
  // ['admin','user'] y esto saldría 403.
  it('TS-15 (S-017): un claim `user` entra aunque la base diga external-user', () => {
    return request(application)
      .get('/api/week-assigned-times')
      .query({ weekStart: '2026-02-02' })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.property('weekStart', '2026-02-02');
        // La tabla de Test Scenarios declara `allocations: []`: el test no siembra ninguna
        // asignación, así que el array tiene que salir vacío. Aserta el contenido, no solo el
        // tipo: un `[]` es lo que prueba que el 200 pasó por el handler y no por otra rama.
        response.body.allocations.should.be.an.Array().and.have.length(0);
      });
  });

  // TS-16 — la columna no puede ELEVAR, y es la dirección que importa para seguridad: un rol
  // persistido no gana privilegios en el plano HTTP. Si la api leyera la base, esto saldría 200.
  it('TS-16 (S-017): un claim external-user es rechazado aunque la base diga admin', () => {
    return request(application)
      .get('/api/week-assigned-times')
      .query({ weekStart: '2026-02-02' })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.should.have.property('code', 'access_denied');
        response.body.should.have.property('message', 'Access denied');
      });
  });
});
