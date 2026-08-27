import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Project, User } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

const VALID_BODY = {
  name: 'Proyecto Nuevo',
  code: 'PN-001',
  status: 'activo',
  type: 'comercial',
  description: 'Una descripción',
  initDate: '2026-01-15',
};

describe('POST /api/projects', () => {
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
    return Project.destroy({ where: {} }).then(() => User.destroy({ where: {} }));
  });

  beforeEach(() => {
    fakeBus.reset();
  });

  afterEach(() => {
    return Project.destroy({ where: {} });
  });

  it('should fail without token', () => {
    return request(application)
      .post('/api/projects')
      .send(VALID_BODY)
      .expect(401)
      .then(() => {
        fakeBus.sent.length.should.equal(0);
      });
  });

  it('should publish projects.new with the authenticated user as creator', () => {
    return Project.create({
      id: 55, ...VALID_BODY, initDate: new Date(VALID_BODY.initDate),
      createdBy: 'zitadel-sub-01',
    })
      .then(() => {
        fakeBus.reply('projects.new', { status: 'success', data: { id: 55 } });

        return request(application)
          .post('/api/projects')
          .set('Authorization', 'Bearer token_01_user')
          .send(VALID_BODY)
          .expect(201);
      })
      .then((response) => {
        fakeBus.last!.command.should.equal('projects.new');
        fakeBus.last!.payload.creator.should.equal('zitadel-sub-01');
        fakeBus.last!.payload.name.should.equal('Proyecto Nuevo');
        fakeBus.last!.payload.code.should.equal('PN-001');

        response.body.id.should.equal(55);
        response.body.name.should.equal('Proyecto Nuevo');
      });
  });

  it('should translate keyValuePairs to properties', () => {
    return Project.create({
      id: 56, ...VALID_BODY, code: 'PN-002', initDate: new Date(VALID_BODY.initDate),
      createdBy: 'zitadel-sub-01',
    })
      .then(() => {
        fakeBus.reply('projects.new', { status: 'success', data: { id: 56 } });

        return request(application)
          .post('/api/projects')
          .set('Authorization', 'Bearer token_01_user')
          .send({
            ...VALID_BODY,
            code: 'PN-002',
            keyValuePairs: {
              documentacion: 'https://docs.grava.io/p',
              mattermost_group_name: 'equipo',
            },
          })
          .expect(201);
      })
      .then(() => {
        // La web manda un objeto; al bus viaja una lista de pares.
        fakeBus.last!.payload.properties.should.deepEqual([
          { code: 'documentacion', value: 'https://docs.grava.io/p' },
          { code: 'mattermost_group_name', value: 'equipo' },
        ]);
        (fakeBus.last!.payload.keyValuePairs === undefined).should.be.true();
      });
  });

  // TS-16 (S-034, CA-9): la api ya no valida el formato URI de `documentacion`/`diseño`/
  // `board_de_tareas` -- ahora lo hace `core` (`propertiesSchema`,
  // `core/src/commands/projects/properties.ts`). El comando SE PUBLICA y el 400 sale del
  // reply de core, no de un `uriRule` de Joi en la api.
  it('should reject an invalid uri in keyValuePairs, via core\'s reply', () => {
    fakeBus.reply('projects.new', {
      status: 'failure',
      errorCode: 'invalid_fields',
      errorMessage: 'Invalid field - documentacion',
    });

    return request(application)
      .post('/api/projects')
      .set('Authorization', 'Bearer token_01_user')
      .send({ ...VALID_BODY, keyValuePairs: { documentacion: 'no-es-una-url' } })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        fakeBus.last!.command.should.equal('projects.new');
      });
  });

  it('should reject an invalid body before publishing', () => {
    return request(application)
      .post('/api/projects')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Sin code' })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        fakeBus.sent.length.should.equal(0);
      });
  });

  it('should translate a failure from core to its HTTP status', () => {
    fakeBus.reply('projects.new', {
      status: 'failure',
      errorCode: 'client_not_found',
      errorMessage: 'Client not found',
    });

    return request(application)
      .post('/api/projects')
      .set('Authorization', 'Bearer token_01_user')
      .send({ ...VALID_BODY, clientId: 999 })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('client_not_found');
      });
  });

  // S-014/CA-10: `no responders` → 503 `service_unavailable`. Y la aserción de que no se
  // escribió nada es justamente lo que obliga a que este caso sea 503 y no 504: con un timeout
  // la escritura PUDO haber ocurrido, así que `count === 0` no sería afirmable.
  it('should respond 503 when there is no subscriber for the subject', () => {
    fakeBus.failWithNoResponders();

    return request(application)
      .post('/api/projects')
      .set('Authorization', 'Bearer token_01_user')
      .send(VALID_BODY)
      .expect(503)
      .then((response) => {
        response.body.code.should.equal('service_unavailable');
        return Project.count().then((count) => count.should.equal(0));
      });
  });
});
