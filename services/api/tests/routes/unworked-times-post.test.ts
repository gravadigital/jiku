import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Person, Project, UnworkedTime, User, WorkedTime } from '@jiku/models';
import { HOY, dayOffset } from '../helpers/dates';
import { fakeBus } from '../mocks/bus';

describe('POST /api/unworked-times', () => {
  let application: Application;

  const todayStr = HOY;
  /**
   * Un día PROPIO para el bloque de S-031, y no HOY.
   *
   * Mocha corre los `it` del `describe` padre ANTES que los de sus hijos, y para entonces la
   * Persona 1 ya tiene los 1440 minutos de HOY consumidos por el test del tope exacto. Las
   * AUSENCIAS NO TIENEN VENTANA DE CARGA (H-2), así que una fecha lejana es válida y aísla los
   * escenarios de titularidad del cupo diario, que es otra regla.
   */
  const diaLibre = dayOffset(-30);

  before(function() {
    application = start();

    return Promise.all([
      User.create({
        id: 'zitadel-sub-01',
        name: 'User 01',
        username: 'user01',
        email: 'user01@mail.com',
      }),
      // S-031: la titularidad de las ausencias la aplica core comparando `people.user_id` contra el
      // actor, así que hacen falta las Personas de los otros dos tokens. Los `User` van explícitos
      // aunque el sobre los espeje igual: el fixture explícito hace el test independiente del orden.
      User.create({
        id: 'zitadel-sub-02',
        name: 'User 02',
        username: 'user02',
        email: 'user02@mail.com',
      }),
      User.create({
        id: 'zitadel-sub-03',
        name: 'Admin 01',
        username: 'admin01',
        email: 'admin01@mail.com',
      }),
    ])
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
            firstName: 'Ana',
            lastName: 'García',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-02',
          }),
          Person.create({
            id: 3,
            firstName: 'Carlos',
            lastName: 'López',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-03',
          }),
          Project.create({
            id: 1,
            code: 'ALPHA',
            name: 'Proyecto Alpha',
            type: 'comercial',
            status: 'activo',
            priority: 5,
            initDate: new Date(),
            createdBy: 'zitadel-sub-01',
          }),
        ]);
      })
  });

  after(() => {
    return UnworkedTime.destroy({ where: {} })
      .then(() => WorkedTime.destroy({ where: {} }))
      .then(() => Person.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-03: POST valid → 201 with record
  it('should create unworked time and return 201', () => {
    return request(application)
      .post('/api/unworked-times')
      .send({ date: todayStr, minutes: 480, reason: 'vacaciones', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(201)
      .then((response) => {
        response.body.should.have.property('id');
        response.body.should.have.property('date');
        response.body.should.have.property('minutes', 480);
        response.body.should.have.property('reason', 'vacaciones');
        response.body.should.have.property('personId', 1);
        response.body.should.have.property('createdAt');
      });
  });

  // TS-04: No token → 401
  it('should return 401 without token', () => {
    return request(application)
      .post('/api/unworked-times')
      .send({ date: todayStr, minutes: 60, reason: 'medico', personId: 1 })
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  // TS-05: Invalid reason → 400 invalid_fields
  it('should return 400 with invalid reason', () => {
    return request(application)
      .post('/api/unworked-times')
      .send({ date: todayStr, minutes: 60, reason: 'vacaciones_extra', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-06: Missing date → 400 invalid_fields
  it('should return 400 when date is missing', () => {
    return request(application)
      .post('/api/unworked-times')
      .send({ minutes: 60, reason: 'medico', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-07: minutes=0 → 400 invalid_fields
  it('should return 400 when minutes is 0', () => {
    return request(application)
      .post('/api/unworked-times')
      .send({ date: todayStr, minutes: 0, reason: 'medico', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-08: Exceeds 1440 summing worked_times → 400 daily_limit_exceeded
  it('should return 400 when daily limit exceeded (via worked_times)', () => {
    return WorkedTime.create({
      id: 200,
      date: todayStr,
      minutes: 800,
      projectId: 1,
      personId: 1,
    })
      .then(() => {
        return request(application)
          .post('/api/unworked-times')
          .send({ date: todayStr, minutes: 700, reason: 'tramite', personId: 1 })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer token_01_user')
          .expect(400);
      })
      .then((response) => {
        response.body.code.should.equal('daily_limit_exceeded');
      });
  });

  // TS-09: Exceeds 1440 summing unworked_times → 400 daily_limit_exceeded
  it('should return 400 when daily limit exceeded (via unworked_times)', () => {
    return UnworkedTime.create({
      id: 300,
      date: todayStr,
      minutes: 900,
      reason: 'estudio',
      personId: 1,
    })
      .then(() => {
        return request(application)
          .post('/api/unworked-times')
          .send({ date: todayStr, minutes: 600, reason: 'tramite', personId: 1 })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer token_01_user')
          .expect(400);
      })
      .then((response) => {
        response.body.code.should.equal('daily_limit_exceeded');
      });
  });

  // TS-10: Exactly 1440 minutes → 201 Created
  it('should return 201 when total is exactly 1440 minutes', () => {
    // Clean up previous test data and set exactly 720 already registered
    return UnworkedTime.destroy({ where: {} })
      .then(() => WorkedTime.destroy({ where: {} }))
      .then(() => {
        return WorkedTime.create({
          id: 201,
          date: todayStr,
          minutes: 720,
          projectId: 1,
          personId: 1,
        });
      })
      .then(() => {
        return request(application)
          .post('/api/unworked-times')
          .send({ date: todayStr, minutes: 720, reason: 'vacaciones', personId: 1 })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer token_01_user')
          .expect(201);
      })
      .then((response) => {
        response.body.should.have.property('minutes', 720);
      });
  });
  /**
   * S-031 · LA TITULARIDAD DE LAS AUSENCIAS AHORA LA APLICA `core` (CA-10).
   *
   * ESTA RUTA NO CAMBIÓ NI UNA LÍNEA DE `lib/` (H-1 / D-1), y estos tests son lo que lo hace
   * verificable desde acá: `personId` SIGUE SIENDO OBLIGATORIO en `unworked-times.new`, así que
   * `resolvePersonId` se queda en la api. Lo único que se mudó es quién decide si podés cargar por
   * otra Persona.
   */
  describe('S-031 · la titularidad de las ausencias', () => {
    // TS-28: alta propia (CA-10)
    it('TS-28: crea la ausencia propia', () => {
      return request(application)
        .post('/api/unworked-times')
        .send({ date: diaLibre, minutes: 480, reason: 'vacaciones', personId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(201)
        .then((response) => {
          response.body.should.have.property('id');
          response.body.should.have.property('minutes', 480);
          response.body.should.have.property('reason', 'vacaciones');
          response.body.should.have.property('personId', 1);
          response.body.should.have.property('createdAt');
        });
    });

    // TS-29: CA-10 — un `user` carga la ausencia de otra Persona (CA-12)
    it('TS-29: un `user` que carga por otra Persona recibe 403 `access_denied`', () => {
      return request(application)
        .post('/api/unworked-times')
        .send({ date: diaLibre, minutes: 60, reason: 'medico', personId: 2 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(403)
        .then((response) => {
          response.body.code.should.equal('access_denied');
          response.body.message.should.equal('Solo podés cargar tus propias ausencias');
          // LA MITAD QUE IMPORTA: el rechazo lo decidió CORE, no la api. Si esto fuera 0, la regla
          // habría vuelto al camino HTTP.
          fakeBus.sent.length.should.equal(1);
        });
    });

    // TS-30: un `admin` sí carga por otra Persona (CA-10)
    it('TS-30: un `admin` sí carga la ausencia de otra Persona', () => {
      return request(application)
        .post('/api/unworked-times')
        .send({ date: diaLibre, minutes: 60, reason: 'medico', personId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_03_admin')
        .expect(201)
        .then((response) => {
          response.body.should.have.property('personId', 1);
        });
    });

    // TS-31: H-1 / D-1 — `resolvePersonId` sigue vivo en esta ruta (CA-15)
    it('TS-31: sin `personId`, la api lo resuelve y lo PUBLICA (H-1: core lo exige)', () => {
      return request(application)
        .post('/api/unworked-times')
        .send({ date: diaLibre, minutes: 60, reason: 'tramite' })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(201)
        .then((response) => {
          response.body.should.have.property('personId', 1);
          // ESTA ES LA VERIFICACIÓN DE D-1: `UnworkedTimesNewPayload` mantiene `personId` en
          // `required`, así que el campo TIENE que viajar. Si alguien borrara `resolvePersonId`
          // «para que quede igual que en horas», este test lo delata en el payload y no en un
          // `invalid_fields` opaco.
          (fakeBus.last as any).payload.personId.should.equal(1);
        });
    });

    // TS-33: Joi de la api sigue validando el enum (CA-12, CA-15)
    it('TS-33: el enum de `reason` se sigue validando en el borde, sin publicar', () => {
      return request(application)
        .post('/api/unworked-times')
        .send({ date: diaLibre, minutes: 60, reason: 'vacaciones_extra', personId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
          fakeBus.sent.length.should.equal(0);
        });
    });
  });
});
