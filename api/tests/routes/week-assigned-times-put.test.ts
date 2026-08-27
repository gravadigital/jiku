import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Person, Project, User, WeekAssignedTime } from '@jiku/models';
import { dayOffset } from '../helpers/dates';
import { fakeBus } from '../mocks/bus';

/**
 * S-032 (api) · `PUT /api/week-assigned-times` pasa a comando + relectura.
 *
 * La escritura la hace `core` (`week-assigned-times.replace`, el comando 21); la api publica
 * y relee. C-36 (semana pasada) y C-38 (solo `admin`) se verifican dejando correr `core` REAL
 * a través del `FakeBus` (comportamiento por default) — NO se simulan con `fakeBus.reply()`,
 * porque lo que hay que probar es que la traducción a HTTP de la decisión de `core` es la que
 * el frontend ya conocía (paridad, CA-14).
 */
describe('PUT /api/week-assigned-times', () => {
  let application: Application;

  // El lunes futuro se calcula desde una fecha relativa a hoy, nunca literal (convención
  // `testing`, ver `dayOffset`). `+21` alcanza para caer siempre en una semana futura sin
  // colisionar con `HOY_M11` (semana pasada).
  function nextMonday(daysAhead: number): string {
    const base = new Date(dayOffset(daysAhead));
    const day = base.getUTCDay();
    const diff = day === 0 ? 1 : (8 - day) % 7 || 7;
    base.setUTCDate(base.getUTCDate() + diff);
    return base.toISOString().split('T')[0];
  }

  /** El lunes de la semana pasada, `YYYY-MM-DD` en UTC — dentro del contrato (es lunes),
   * fuera de la ventana de C-36 (`dateFrom < mondayOfWeekUTC(hoy)`). */
  function pastMonday(): string {
    const today = new Date(dayOffset(0));
    const day = today.getUTCDay();
    const diffToThisMonday = day === 0 ? -6 : 1 - day;
    today.setUTCDate(today.getUTCDate() + diffToThisMonday - 7);
    return today.toISOString().split('T')[0];
  }

  before(function () {
    application = start();

    return Promise.all([
      User.create({
        id: 'zitadel-sub-01',
        name: 'User 01',
        username: 'user01',
        email: 'user01@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-03',
        name: 'Admin User',
        username: 'admin01',
        email: 'admin@mail.com'
      })
    ]).then(() => {
      return Promise.all([
        Person.create({
          id: 1,
          firstName: 'John',
          lastName: 'Doe',
          enabled: true,
          initDate: new Date(),
          mustChargeWorkedTime: true
        }),
        Project.create({
          id: 3,
          code: 'INT',
          name: 'Internal Project',
          type: 'interno',
          status: 'activo',
          initDate: new Date(),
          priority: 1,
          createdBy: 'zitadel-sub-01'
        }),
        Project.create({
          id: 7,
          code: 'COM',
          name: 'Commercial Project',
          type: 'comercial',
          status: 'activo',
          initDate: new Date(),
          priority: 1,
          createdBy: 'zitadel-sub-01'
        })
      ]);
    });
  });

  after(() => {
    return WeekAssignedTime.destroy({ where: {} })
      .then(() => Project.destroy({ where: {} }))
      .then(() => Person.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-1: camino feliz — admin reemplaza una semana futura
  it('TS-1: admin reemplaza una semana futura y deriva `internal` desde `projects.type`', () => {
    const weekStart = nextMonday(7);

    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart,
        allocations: [
          { personId: 1, projectId: 3, minutes: 900 },
          { personId: 1, projectId: 7, minutes: 900 }
        ]
      })
      .expect(200)
      .then((response) => {
        response.body.should.have.property('weekStart', weekStart);
        response.body.should.have.property('weekEnd');
        response.body.allocations.should.have.length(2);

        const internalAlloc = response.body.allocations.find((a: any) => a.projectId === 3);
        internalAlloc.internal.should.be.true();

        const commercialAlloc = response.body.allocations.find((a: any) => a.projectId === 7);
        commercialAlloc.internal.should.be.false();
      });
  });

  // TS-2: reemplazo total — la segunda escritura borra la primera
  it('TS-2: un segundo PUT reemplaza totalmente la semana (borra + recrea)', () => {
    const weekStart = nextMonday(14);

    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart,
        allocations: [
          { personId: 1, projectId: 3, minutes: 900 },
          { personId: 1, projectId: 7, minutes: 900 }
        ]
      })
      .expect(200)
      .then(() => {
        return request(application)
          .put('/api/week-assigned-times')
          .set('Authorization', 'Bearer token_03_admin')
          .send({
            weekStart,
            allocations: [{ personId: 1, projectId: 3, minutes: 1800 }]
          })
          .expect(200);
      })
      .then((response) => {
        response.body.allocations.should.have.length(1);
        response.body.allocations[0].projectId.should.equal(3);
        response.body.allocations[0].minutes.should.equal(1800);
      });
  });

  // TS-3: minutes: 0 se descarta
  it('TS-3: las asignaciones con `minutes: 0` se descartan', () => {
    const weekStart = nextMonday(21);

    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart,
        allocations: [
          { personId: 1, projectId: 3, minutes: 900 },
          { personId: 1, projectId: 7, minutes: 0 }
        ]
      })
      .expect(200)
      .then((response) => {
        response.body.allocations.should.have.length(1);
        response.body.allocations[0].projectId.should.equal(3);
      });
  });

  // TS-4: rol `user` es rechazado — ahora por `core` (`caller_not_authorized`, C-38), no por
  // `hasAnyRole` de la api (que ya no está en esta ruta).
  it('TS-4: un `user` recibe 403 `caller_not_authorized` (rechazado por el mapa de `core`, no por `hasAnyRole`)', () => {
    const weekStart = nextMonday(28);

    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        weekStart,
        allocations: [{ personId: 1, projectId: 3, minutes: 900 }]
      })
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('caller_not_authorized');
        fakeBus.last!.command.should.equal('week-assigned-times.replace');
      });
  });

  // TS-5: semana pasada es rechazada — ahora por `core` (C-36, `invalid_date_range`)
  it('TS-5: una semana pasada recibe 400 `invalid_date_range` (antes `invalid_week`)', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: pastMonday(),
        allocations: [{ personId: 1, projectId: 3, minutes: 900 }]
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_date_range');
        response.body.message.should.equal('No se pueden modificar semanas pasadas');
      });
  });

  // TS-6: sin token
  it('TS-6: sin token responde 401 `unauthorized`', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .send({ weekStart: nextMonday(7), allocations: [] })
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  // TS-7: weekStart con formato inválido — lo rechaza el Joi de la api, antes de publicar
  it('TS-7: `weekStart` con formato inválido responde 400 `invalid_fields` sin publicar el comando', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({ weekStart: 'no-es-fecha', allocations: [] })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-8: allocations con personId faltante — Joi de la api
  it('TS-8: `allocations` con `personId` faltante responde 400 `invalid_fields` sin publicar el comando', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: nextMonday(7),
        allocations: [{ projectId: 3, minutes: 900 }]
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-9 (H-3): personId inexistente — mejora de contrato: hoy 500, después 400
  it('TS-9 (H-3): una `personId` inexistente responde 400 `person_not_found` (antes: 500 por FK sin capturar)', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: nextMonday(35),
        allocations: [{ personId: 999999, projectId: 3, minutes: 900 }]
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('person_not_found');
      });
  });

  // TS-10 (H-4): projectId inexistente — mejora de contrato: hoy 500, después 400
  it('TS-10 (H-4): una `projectId` inexistente responde 400 `project_not_found` (antes: 500 por `throw`)', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: nextMonday(42),
        allocations: [{ personId: 1, projectId: 999999, minutes: 900 }]
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('project_not_found');
      });
  });

  // TS-11: bus caído — la operación NO ocurrió (ADR-002)
  it('TS-11: sin suscriptores responde 503 `service_unavailable`', () => {
    fakeBus.failWithNoResponders();

    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: nextMonday(7),
        allocations: [{ personId: 1, projectId: 3, minutes: 900 }]
      })
      .expect(503)
      .then((response) => {
        response.body.code.should.equal('service_unavailable');
      });
  });

  // TS-12: timeout del bus — la operación PUDO ocurrir (ADR-002)
  it('TS-12: un timeout responde 504 `gateway_timeout`', () => {
    fakeBus.failWithTimeout();

    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: nextMonday(7),
        allocations: [{ personId: 1, projectId: 3, minutes: 900 }]
      })
      .expect(504)
      .then((response) => {
        response.body.code.should.equal('gateway_timeout');
      });
  });

  // TS-13 (H-2): el comando se publica con los nombres traducidos, NO con los nombres HTTP
  it('TS-13 (H-2): publica `week-assigned-times.replace` con `dateFrom`/`assignments`, no `weekStart`/`allocations`', () => {
    const weekStart = nextMonday(49);

    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart,
        allocations: [{ personId: 1, projectId: 3, minutes: 600 }]
      })
      .expect(200)
      .then(() => {
        fakeBus.last!.command.should.equal('week-assigned-times.replace');
        const payload = fakeBus.last!.payload;
        payload.dateFrom.should.equal(weekStart);
        payload.assignments.should.deepEqual([{ personId: 1, projectId: 3, minutes: 600 }]);
        ('weekStart' in payload).should.be.false();
        ('allocations' in payload).should.be.false();
      });
  });

  // TS-14: lista vacía de allocations vacía la semana
  it('TS-14: una lista vacía de `allocations` vacía la semana', () => {
    const weekStart = nextMonday(56);

    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart,
        allocations: [{ personId: 1, projectId: 3, minutes: 900 }]
      })
      .expect(200)
      .then(() => {
        return request(application)
          .put('/api/week-assigned-times')
          .set('Authorization', 'Bearer token_03_admin')
          .send({ weekStart, allocations: [] })
          .expect(200);
      })
      .then((response) => {
        response.body.allocations.should.have.length(0);
      });
  });

  // TS-15: weekEnd se deriva correctamente (lunes + 4 días = viernes)
  it('TS-15: `weekEnd` se deriva como `weekStart` + 4 días (viernes)', () => {
    const weekStart = nextMonday(63);
    const expectedWeekEnd = (() => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 4);
      return d.toISOString().split('T')[0];
    })();

    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart,
        allocations: [{ personId: 1, projectId: 3, minutes: 900 }]
      })
      .expect(200)
      .then((response) => {
        response.body.weekEnd.should.equal(expectedWeekEnd);
      });
  });
});
