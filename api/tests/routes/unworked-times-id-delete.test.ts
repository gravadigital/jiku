import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Person, UnworkedTime, User } from '@jiku/models';
import { HOY, HOY_M11, dayOffset } from '../helpers/dates';
import { fakeBus } from '../mocks/bus';

describe('DELETE /api/unworked-times/:id', () => {
  let application: Application;

  const todayStr = HOY;
  // `created_at` es un TIMESTAMP, no un día: `validateDeadline` compara contra un `Date` completo,
  // así que acá hace falta el instante y no el `YYYY-MM-DD` del helper. Se deriva del MISMO offset
  // (hoy − 11, el primer día fuera del deadline) para que las dos referencias no puedan divergir.
  const creadoHace11Dias = new Date(`${dayOffset(-11)}T00:00:00.000Z`);

  before(function() {
    application = start();

    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com',
    })
      .then(() => {
        return User.create({
          id: 'zitadel-sub-02',
          name: 'User 02',
          username: 'user02',
          email: 'user02@mail.com',
        });
      })
      .then(() => {
        return Promise.all([
          Person.create({
            id: 1,
            firstName: 'Juan',
            lastName: 'Pérez',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-01',
          }),
          Person.create({
            id: 2,
            firstName: 'Maria',
            lastName: 'Lopez',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-02',
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          // Record 1: own record, created today (within 7 days) → deletable
          UnworkedTime.create({
            id: 1,
            date: todayStr,
            minutes: 60,
            reason: 'medico',
            personId: 1,
          }),
          // Record 2: belongs to person 2 (different user) → 403
          UnworkedTime.create({
            id: 2,
            date: todayStr,
            minutes: 60,
            reason: 'tramite',
            personId: 2,
          }),
          // Record 3: own record, created 11 days ago → 400 deadline exceeded (exceeds 10-day limit)
          UnworkedTime.create({
            id: 3,
            date: todayStr,
            minutes: 60,
            reason: 'estudio',
            personId: 1,
            createdAt: creadoHace11Dias,
            updatedAt: creadoHace11Dias,
          }),
          // TS-37 (H-2): `date` FUERA de la ventana de horas pero CREADA HOY. Se borra igual: las
          // ausencias no tienen ventana de carga, solo deadline sobre `created_at`.
          UnworkedTime.create({
            id: 4,
            date: HOY_M11,
            minutes: 60,
            reason: 'personal',
            personId: 1,
          }),
          // TS-39 (H-4): AJENA y VENCIDA a la vez. Fija cuál de las dos reglas gana ahora que una
          // vive en la api y la otra en core.
          UnworkedTime.create({
            id: 5,
            date: todayStr,
            minutes: 60,
            reason: 'otro',
            personId: 2,
            createdAt: creadoHace11Dias,
            updatedAt: creadoHace11Dias,
          }),
        ]);
      });
  });

  after(() => {
    return UnworkedTime.destroy({ where: {} })
      .then(() => Person.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-16: Record belonging to another person → 403
  it('should return 403 when deleting another person record', () => {
    return request(application)
      .delete('/api/unworked-times/2')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-17: Record created more than 7 days ago → 400
  it('should return 400 when record is older than 7 days', () => {
    return request(application)
      .delete('/api/unworked-times/3')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('deadline_exceeded');
      });
  });

  // TS-18: Non-existent record → 404
  it('should return 404 when record does not exist', () => {
    return request(application)
      .delete('/api/unworked-times/9999')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('unworked_time_not_found');
      });
  });

  // TS-15: Own record, within 7 days → 200 Deleted (run last since it deletes record)
  it('should return 200 when deleting own record within 7 days', () => {
    return request(application)
      .delete('/api/unworked-times/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.property('message', 'Deleted');
      });
  });

  it('should return 401 without token', () => {
    return request(application)
      .delete('/api/unworked-times/9999')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });
  /**
   * S-031 · LA TITULARIDAD SE FUE A `core`, EL DEADLINE SE QUEDA (CA-10, H-2 / D-2).
   *
   * De los tres middlewares de esta ruta se eliminó EXACTAMENTE UNO. `loadUnworkedTime` da el 404
   * del path y alimenta a `validateDeadline`; `validateDeadline` compara `created_at` contra hoy −
   * 10 y responde `deadline_exceeded`, un código que emite LA API y que ni siquiera está en
   * `STATUS_BY_ERROR_CODE`. Es OTRA regla que la ventana de horas, y esta story no la muda.
   */
  describe('S-031 · la titularidad se fue a core, el deadline se quedó', () => {
    // TS-35: CA-10 — el rechazo por titularidad ahora lo decide core (CA-12)
    it('TS-35: el registro ajeno lo rechaza CORE, con el mismo código y el mismo mensaje', () => {
      return UnworkedTime.create({ id: 6, date: todayStr, minutes: 60, reason: 'otro', personId: 2 })
        .then(() => {
          return request(application)
            .delete('/api/unworked-times/6')
            .set('Accept', 'application/json')
            .set('Authorization', 'Bearer token_01_user')
            .expect(403);
        })
        .then((response) => {
          response.body.code.should.equal('access_denied');
          response.body.message.should.equal('Solo podés eliminar tus propios registros');
          // El comando SE PUBLICÓ: la decisión es de core. Si esto fuera 0, la regla seguiría acá.
          fakeBus.sent.length.should.equal(1);
        });
    });

    // TS-36: H-2 / D-2 — `deadline_exceeded` sigue siendo de la api (CA-12, CA-15)
    it('TS-36: el `deadline_exceeded` lo sigue emitiendo la api, SIN publicar', () => {
      return request(application)
        .delete('/api/unworked-times/3')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('deadline_exceeded');
          response.body.message.should.equal(
            'Solo se pueden eliminar registros creados en los últimos 10 días'
          );
          // La api corta ANTES de publicar. Es lo que hace que este código no necesite entrada en
          // `STATUS_BY_ERROR_CODE`: nunca llega por reply.
          fakeBus.sent.length.should.equal(0);
        });
    });

    // TS-37: H-2 — no hay ventana de carga en ausencias (CA-10)
    it('TS-37: una ausencia con `date` viejo pero creada hoy SÍ se borra (no hay ventana)', () => {
      return request(application)
        .delete('/api/unworked-times/4')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          // NO `invalid_date_range`: agregar la ventana de horas acá sería AMPLIAR una regla, no
          // migrarla. Core lo dejó anotado y este test lo fija del lado HTTP.
          response.body.should.have.property('message', 'Deleted');
        });
    });

    // TS-38: H-3 — el 404 del path lo sigue dando la api (CA-12)
    it('TS-38: el 404 del path lo da la api y NO se publica nada (H-3)', () => {
      return request(application)
        .delete('/api/unworked-times/9999')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(404)
        .then((response) => {
          response.body.code.should.equal('unworked_time_not_found');
          fakeBus.sent.length.should.equal(0);
        });
    });

    // TS-39: H-4 — ajena Y vencida: ahora gana el deadline (CA-10, CA-12)
    it('TS-39: ajena Y vencida responde `deadline_exceeded`, no `access_denied` (H-4)', () => {
      // PRECEDENCIA INVERTIDA respecto de hoy, y es inevitable: `validateDeadline` se queda en la
      // api y corre ANTES de publicar; la titularidad se fue a core, que corre después.
      return request(application)
        .delete('/api/unworked-times/5')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('deadline_exceeded');
        });
    });
  });
});
