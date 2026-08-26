import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Person, Project, User, WorkedTime } from '@jiku/models';
import { HOY, HOY_M10, HOY_M11 } from '../helpers/dates';
import { fakeBus } from '../mocks/bus';

describe('DELETE /api/worked-times/:id', () => {
  let application: Application;

  const todayStr = HOY;

  before(function() {
    application = start();

    return Promise.all([
      User.create({
        id: 'zitadel-sub-01',
        name: 'User 01',
        username: 'user01',
        email: 'user01@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-02',
        name: 'User 02',
        username: 'user02',
        email: 'user02@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-03',
        name: 'Admin 01',
        username: 'admin01',
        email: 'admin01@mail.com'
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
            userId: 'zitadel-sub-01'
          }),
          Person.create({
            id: 2,
            firstName: 'Ana',
            lastName: 'García',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-02'
          }),
          Project.create({
            id: 1,
            code: 'ALPHA',
            name: 'Proyecto Alpha',
            type: 'comercial',
            status: 'activo',
            priority: 5,
            initDate: new Date(),
            createdBy: 'zitadel-sub-01'
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          // Record for person 1, today (for TS-15: happy path delete)
          WorkedTime.create({
            id: 100,
            date: todayStr,
            minutes: 60,
            projectId: 1,
            personId: 1
          }),
          // Record for person 1, 11 days ago (for TS-16: old date, exceeds 10-day limit)
          WorkedTime.create({
            id: 101,
            date: HOY_M11,
            minutes: 60,
            projectId: 1,
            personId: 1
          }),
          // Record for person 2, today (for TS-17: user deleting other's, TS-18: admin delete)
          WorkedTime.create({
            id: 102,
            date: todayStr,
            minutes: 60,
            projectId: 1,
            personId: 2
          }),
          // TS-22: propio, en el BORDE INFERIOR EXACTO de la ventana (hoy − 10) → se puede borrar.
          WorkedTime.create({
            id: 103,
            date: HOY_M10,
            minutes: 60,
            projectId: 1,
            personId: 1
          }),
          // TS-26 (H-4): AJENO y FUERA DE LA VENTANA a la vez. Las dos reglas fallan; el test fija
          // cuál gana ahora que las dos las evalúa core.
          WorkedTime.create({
            id: 104,
            date: HOY_M11,
            minutes: 60,
            projectId: 1,
            personId: 2
          }),
        ]);
      });
  });

  after(() => {
    return WorkedTime.destroy({where: {}})
      .then(() => Person.destroy({where: {}}))
      .then(() => Project.destroy({where: {}}))
      .then(() => User.destroy({where: {}}));
  });

  // TS-15: Happy path - delete own record
  it('should delete own worked time record', () => {
    return request(application)
      .delete('/api/worked-times/100')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.have.property('message', 'Registro eliminado');
      });
  });

  // TS-16: Date > 7 days → 400
  it('should fail when record date is older than 7 days', () => {
    return request(application)
      .delete('/api/worked-times/101')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_date_range');
      });
  });

  // TS-17: User deleting other's record → 403
  it('should fail when user tries to delete another person record', () => {
    return request(application)
      .delete('/api/worked-times/102')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-18: Admin deleting other's record → 200
  it('should allow admin to delete another person record', () => {
    return request(application)
      .delete('/api/worked-times/102')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_03_admin')
      .expect(200)
      .then((response) => {
        response.body.should.have.property('message', 'Registro eliminado');
      });
  });

  // TS-19: Non-existent record → 404
  it('should fail when record does not exist', () => {
    return request(application)
      .delete('/api/worked-times/9999')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('worked_time_not_found');
      });
  });

  it('should fail without token', () => {
    return request(application)
      .delete('/api/worked-times/101')
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });
  /**
   * S-031 · LA TITULARIDAD Y LA VENTANA SE FUERON A `core` (CA-8, CA-9).
   *
   * El `FakeBus` ejecuta core real, así que estos tests verifican la cadena entera: la api publica
   * el borrado con el sobre, core decide, y la api traduce. Los status y los códigos son los
   * mismos de antes (CA-12) — lo único que cambió es quién decide, y en qué orden (H-4).
   */
  describe('S-031 · las reglas mudadas a core', () => {
    // TS-20: borrado propio dentro de la ventana, y QUÉ se publicó (CA-8)
    it('TS-20: borra el registro propio y publica el comando con el sobre', () => {
      return WorkedTime.create({ id: 105, date: todayStr, minutes: 60, projectId: 1, personId: 1 })
        .then(() => {
          return request(application)
            .delete('/api/worked-times/105')
            .set('Accept', 'application/json')
            .set('Authorization', 'Bearer token_01_user')
            .expect(200);
        })
        .then((response) => {
          response.body.should.have.property('message', 'Registro eliminado');
          (fakeBus.last as any).command.should.equal('worked-times.105.delete');
          const payload = (fakeBus.last as any).payload;
          // El cuerpo del borrado NO LLEVA DATOS DE DOMINIO: el id va en el nombre del comando y
          // la identidad en el sobre. Si alguna vez apareciera un `personId` acá sería una regla
          // volviendo a la api por la puerta de atrás.
          Object.keys(payload).should.deepEqual(['actor']);
          payload.actor.id.should.equal('zitadel-sub-01');
        });
    });

    // TS-22: el borde inferior exacto de la ventana SÍ se puede borrar (CA-9)
    it('TS-22: puede borrar un registro de hoy − 10 (borde dentro de la ventana)', () => {
      return request(application)
        .delete('/api/worked-times/103')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.should.have.property('message', 'Registro eliminado');
        });
    });

    // TS-21: fuera de la ventana, y el mensaje tampoco cambia (CA-9, CA-12)
    it('TS-21: rechaza el borrado fuera de la ventana con el mismo mensaje de siempre', () => {
      return request(application)
        .delete('/api/worked-times/101')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_date_range');
          response.body.message.should.equal(
            'Solo se pueden eliminar registros del día actual y los 10 días previos'
          );
        });
    });

    // TS-23: registro ajeno, y el mensaje tampoco cambia (CA-8, CA-12)
    it('TS-23: rechaza el borrado de un registro ajeno con el mismo mensaje de siempre', () => {
      return WorkedTime.create({ id: 106, date: todayStr, minutes: 60, projectId: 1, personId: 2 })
        .then(() => {
          return request(application)
            .delete('/api/worked-times/106')
            .set('Accept', 'application/json')
            .set('Authorization', 'Bearer token_01_user')
            .expect(403);
        })
        .then((response) => {
          response.body.code.should.equal('access_denied');
          response.body.message.should.equal('Solo podés eliminar tus propios registros');
        });
    });

    // TS-25: H-3 — el 404 del path lo sigue dando la api (CA-12)
    it('TS-25: el 404 del path lo da la api y NO se publica nada (H-3)', () => {
      return request(application)
        .delete('/api/worked-times/9999')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(404)
        .then((response) => {
          response.body.code.should.equal('worked_time_not_found');
          // SI ESTO FUERA > 0, el 404 vendría de traducir el reply de core — y core mapea
          // `worked_time_not_found` a 400, no a 404. El test pasaría por la razón equivocada.
          fakeBus.sent.length.should.equal(0);
        });
    });

    // TS-26: H-4 — ajeno Y fuera de ventana: gana la titularidad (CA-8, CA-9)
    it('TS-26: ajeno Y fuera de ventana responde `access_denied`, no `invalid_date_range` (H-4)', () => {
      // CAMBIO DE PRECEDENCIA DELIBERADO: la api chequeaba ventana → titularidad; core chequea
      // titularidad → ventana, «porque es la que menos revela». Queda fijado acá para que el día
      // que alguien reporte «antes me decía otra cosa», la respuesta esté escrita.
      return request(application)
        .delete('/api/worked-times/104')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(403)
        .then((response) => {
          response.body.code.should.equal('access_denied');
        });
    });
  });
});
