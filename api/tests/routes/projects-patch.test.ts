import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Project, User } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

/**
 * La escritura la hace core: estos tests verifican qué comando publica la api y qué
 * responde por HTTP. Lo que efectivamente se guarda está cubierto por los tests de core
 * (`projects.{id}.edit`).
 */
const VALID_BODY = {
  name: 'Project1 editado',
  code: 'code1',
  status: 'activo',
  type: 'comercial',
  description: 'Project test 1',
  initDate: '2026-01-15',
};

describe('PATCH /api/projects/:id', () => {
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

  // El bus de tests ejecuta los comandos contra core con la misma base: el proyecto
  // tiene que existir para que la edición no falle.
  beforeEach(() => {
    fakeBus.reset();
    return Project.destroy({ where: {} }).then(() => Project.create({
      id: 1, name: 'Project1', code: 'code1', status: 'activo', type: 'comercial',
      description: 'Project test 1', initDate: new Date('2026-01-15'),
      createdBy: 'zitadel-sub-01',
    }));
  });

  it('should fail without token', () => {
    return request(application)
      .patch('/api/projects/1')
      .send(VALID_BODY)
      .expect(401)
      .then(() => {
        fakeBus.sent.length.should.equal(0);
      });
  });

  it('should publish projects.{id}.edit', () => {
    return request(application)
      .patch('/api/projects/1')
      .set('Authorization', 'Bearer token_01_user')
      .send(VALID_BODY)
      .expect(200)
      .then((response) => {
        fakeBus.last!.command.should.equal('projects.1.edit');
        fakeBus.last!.payload.name.should.equal('Project1 editado');

        response.body.code.should.equal('project_updated');
        response.body.message.should.equal('Project Updated');
      });
  });

  it('should respond 400 when core says the project does not exist', () => {
    fakeBus.reply('projects.999.edit', {
      status: 'failure',
      errorCode: 'project_not_found',
      errorMessage: 'Project not found',
    });

    return request(application)
      .patch('/api/projects/999')
      .set('Authorization', 'Bearer token_01_user')
      .send(VALID_BODY)
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('project_not_found');
      });
  });

  it('should send endDate as null when the body does not carry it', () => {
    return request(application)
      .patch('/api/projects/1')
      .set('Authorization', 'Bearer token_01_user')
      .send(VALID_BODY)
      .expect(200)
      .then(() => {
        // La web espera que endDate se vacíe cuando no viaja en el cuerpo, y core deja
        // como está lo ausente: por eso la api manda el null explícito.
        (fakeBus.last!.payload.endDate === null).should.be.true();
      });
  });

  it('should keep endDate when the body carries it', () => {
    return request(application)
      .patch('/api/projects/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({ ...VALID_BODY, endDate: '2026-12-31' })
      .expect(200)
      .then(() => {
        (fakeBus.last!.payload.endDate === null).should.be.false();
      });
  });

  it('should translate keyValuePairs to properties', () => {
    return request(application)
      .patch('/api/projects/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        ...VALID_BODY,
        keyValuePairs: { documentacion: 'https://docs.grava.io/x' },
      })
      .expect(200)
      .then(() => {
        fakeBus.last!.payload.properties.should.deepEqual([
          { code: 'documentacion', value: 'https://docs.grava.io/x' },
        ]);
      });
  });

  it('should translate a null keyValuePair to a null value', () => {
    return request(application)
      .patch('/api/projects/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        ...VALID_BODY,
        keyValuePairs: { documentacion: null, diseño: 'https://figma.com/x' },
      })
      .expect(200)
      .then(() => {
        fakeBus.last!.payload.properties.should.deepEqual([
          { code: 'documentacion', value: null },
          { code: 'diseño', value: 'https://figma.com/x' },
        ]);
      });
  });

  it('should reject an invalid body before publishing', () => {
    return request(application)
      .patch('/api/projects/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: '' })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
        fakeBus.sent.length.should.equal(0);
      });
  });

  it('should reject an invalid uri in keyValuePairs', () => {
    return request(application)
      .patch('/api/projects/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({ ...VALID_BODY, keyValuePairs: { documentacion: 'no-es-una-url' } })
      .expect(400)
      .then(() => {
        fakeBus.sent.length.should.equal(0);
      });
  });

  it('should respond 503 when the bus is unreachable', () => {
    fakeBus.failWith(new Error('TIMEOUT'));

    return request(application)
      .patch('/api/projects/1')
      .set('Authorization', 'Bearer token_01_user')
      .send(VALID_BODY)
      .expect(503)
      .then((response) => {
        response.body.code.should.equal('service_unavailable');
      });
  });
});
