import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Client, User } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

describe('PATCH /api/clients/:id', () => {
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

  // El bus de tests ejecuta los comandos contra core con la misma base, así que el
  // cliente tiene que existir de verdad para que la edición no falle.
  beforeEach(() => {
    fakeBus.reset();
    return Client.destroy({ where: {} })
      .then(() => Client.create({ id: 7, name: 'Original', description: 'Descripción' }));
  });

  it('should fail without token', () => {
    return request(application)
      .patch('/api/clients/1')
      .send({ name: 'Nuevo' })
      .expect(401)
      .then(() => {
        fakeBus.sent.length.should.equal(0);
      });
  });

  it('should publish clients.{id}.edit with the body as payload', () => {
    return request(application)
      .patch('/api/clients/7')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Editado', description: 'Nueva descripción' })
      .expect(200)
      .then((response) => {
        fakeBus.last!.command.should.equal('clients.7.edit');
        fakeBus.last!.payload.should.deepEqual({
          name: 'Editado',
          description: 'Nueva descripción',
          actor: { id: 'zitadel-sub-01', roles: ['user'] },
        });

        response.body.code.should.equal('client_updated');
        response.body.message.should.equal('Client Updated');
      });
  });

  it('should publish only the fields that were sent', () => {
    return request(application)
      .patch('/api/clients/7')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Solo el nombre' })
      .expect(200)
      .then(() => {
        fakeBus.last!.payload.should.deepEqual({
          name: 'Solo el nombre',
          actor: { id: 'zitadel-sub-01', roles: ['user'] },
        });
      });
  });

  it('should respond 400 when core says the client does not exist', () => {
    fakeBus.reply('clients.999.edit', {
      status: 'failure',
      errorCode: 'client_not_found',
      errorMessage: 'Client not found',
    });

    return request(application)
      .patch('/api/clients/999')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Fantasma' })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('client_not_found');
        response.body.message.should.equal('Client not found');
      });
  });

  it('should reject an invalid body before publishing', () => {
    return request(application)
      .patch('/api/clients/7')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 42 })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // S-014/CA-10: `no responders` → 503 `service_unavailable`, con la señal explícita.
  it('should respond 503 when there is no subscriber for the subject', () => {
    fakeBus.failWithNoResponders();

    return request(application)
      .patch('/api/clients/7')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Editado' })
      .expect(503)
      .then((response) => {
        response.body.code.should.equal('service_unavailable');
      });
  });
});
