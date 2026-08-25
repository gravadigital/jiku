import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Client, User } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

/**
 * La api ya no escribe: publica `clients.new` y arma la respuesta leyendo la base.
 *
 * Cada test verifica las dos mitades del contrato:
 *   - qué comando y qué payload se publicaron al bus
 *   - que el status y el cuerpo HTTP son los mismos que antes del split
 */
describe('POST /api/clients', () => {
  let application: Application;

  before(() => {
    application = start();
    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com',
    });
  });

  after(() => {
    return Client.destroy({ where: {} }).then(() => User.destroy({ where: {} }));
  });

  beforeEach(() => {
    fakeBus.reset();
  });

  afterEach(() => {
    return Client.destroy({ where: {} });
  });

  it('should fail without token', () => {
    return request(application)
      .post('/api/clients')
      .send({ name: 'Adistal' })
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
        // Sin token no se llega a publicar nada.
        fakeBus.sent.length.should.equal(0);
      });
  });

  it('should publish clients.new and respond with the created client', () => {
    return Client.create({ id: 42, name: 'Adistal', description: 'Un cliente' })
      .then(() => {
        fakeBus.reply('clients.new', { status: 'success', data: { id: 42 } });

        return request(application)
          .post('/api/clients')
          .set('Authorization', 'Bearer token_01_user')
          .send({ name: 'Adistal', description: 'Un cliente' })
          .expect(201);
      })
      .then((response) => {
        fakeBus.last!.command.should.equal('clients.new');
        fakeBus.last!.payload.should.deepEqual({
          name: 'Adistal',
          description: 'Un cliente',
          actor: { id: 'zitadel-sub-01', roles: ['user'] },
        });

        response.body.id.should.equal(42);
        response.body.name.should.equal('Adistal');
        response.body.description.should.equal('Un cliente');
      });
  });

  it('should publish without description when it is not sent', () => {
    return Client.create({ id: 43, name: 'Verifarma' })
      .then(() => {
        fakeBus.reply('clients.new', { status: 'success', data: { id: 43 } });

        return request(application)
          .post('/api/clients')
          .set('Authorization', 'Bearer token_01_user')
          .send({ name: 'Verifarma' })
          .expect(201);
      })
      .then(() => {
        (fakeBus.last!.payload.description === undefined).should.be.true();
      });
  });

  it('should reject an invalid body before publishing', () => {
    return request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_01_user')
      .send({ description: 'sin nombre' })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        // La validación de forma sigue en la api: no se publica nada.
        fakeBus.sent.length.should.equal(0);
      });
  });

  it('should translate a failure from core to its HTTP status', () => {
    fakeBus.reply('clients.new', {
      status: 'failure',
      errorCode: 'invalid_fields',
      errorMessage: '"name" is required',
    });

    return request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Adistal' })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        response.body.message.should.equal('"name" is required');
      });
  });

  // S-014/CA-10: `no responders` → 503 `service_unavailable`. La aserción de que no se escribió
  // nada es lo que obliga a que este caso sea 503: con un timeout la escritura PUDO ocurrir.
  it('should respond 503 when there is no subscriber for the subject', () => {
    fakeBus.failWithNoResponders();

    return request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Adistal' })
      .expect(503)
      .then((response) => {
        response.body.code.should.equal('service_unavailable');
        // No se escribió nada: sin JetStream, un comando perdido no se reintenta.
        return Client.count().then((count) => count.should.equal(0));
      });
  });
});
