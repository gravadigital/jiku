import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, File, User } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

// Tokens del mock:
// token_01_user          → sub: zitadel-sub-01, rol: user
// token_03_admin         → sub: zitadel-sub-03, rol: admin (no está en x-roles del spec, pero
//                           desde S-034 el spec ya no es lo que este endpoint verifica)
// token_04_external_user → sub: zitadel-sub-04, rol: external-user, sin permisos de proyecto

/**
 * El endpoint del portal cambia igual que el interno (REQ-001, S-004): JSON, un archivo por
 * request, publica `files.request-upload` y devuelve un `UploadTicket`.
 *
 * PIERDE su validación propia de `entityType`, porque el cuerpo ya no lo declara.
 *
 * Desde S-034 (CA-5) también pierde el `hasAnyRole(['user', 'external-user'])`: `x-roles`
 * sigue declarado en el spec, pero ya es documentación de qué rol autoriza `core` (CA-8), no
 * lo que este endpoint verifica. `files.request-upload` está en `INTERNAL_COMMANDS`
 * (`core/src/authorize-caller.ts`), así que en la práctica CUALQUIER rol autenticado entra
 * ahora (ver el test de `admin` más abajo).
 */
describe('POST /api/opus/attachments', () => {
  let application: Application;

  const validBody = {
    fileName: 'captura.png',
    mimeType: 'image/png',
    fileSize: 2048,
  };

  before(async function() {
    this.timeout(30000);
    application = start();

    await User.create({
      id: 'zitadel-sub-01', name: 'User 01', username: 'user01opus', email: 'u1opus@mail.com'
    } as any);
    await User.create({
      id: 'zitadel-sub-03', name: 'Admin', username: 'admin03opus', email: 'a3opus@mail.com'
    } as any);
    await User.create({
      id: 'zitadel-sub-04', name: 'External', username: 'ext04opus', email: 'e4opus@mail.com'
    } as any);
  });

  afterEach(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {}, force: true });
  });

  after(async () => {
    await User.destroy({ where: {} });
  });

  // TS-18: camino feliz con el rol del portal, con core ejecutándose de verdad.
  it('devuelve 201 con el UploadTicket para un external-user y publica el comando', async () => {
    const res = await request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .send(validBody)
      .expect(201);

    res.body.should.have.property('fileId').which.is.a.Number();
    res.body.should.have.property('uploadUrl').which.is.a.String();
    res.body.should.have.property('expiresIn').which.is.a.Number();

    fakeBus.sent.length.should.equal(1);
    (fakeBus.last as any).command.should.equal('files.request-upload');
    (fakeBus.last as any).payload.uploader.should.equal('zitadel-sub-04');
    (fakeBus.last as any).payload.should.deepEqual({
      uploader: 'zitadel-sub-04',
      fileName: 'captura.png',
      mimeType: 'image/png',
      fileSize: 2048,
      actor: { id: 'zitadel-sub-04', roles: ['external-user'] },
    });
    // TS-11 para el `external-user`: el sobre lleva SUS roles, no los de la api.
    (fakeBus.last as any).payload.uploader.should.equal((fakeBus.last as any).payload.actor.id);

    const file = await File.findByPk(res.body.fileId);
    (file !== null).should.be.true();
    (file as File).uploadedBy.should.equal('zitadel-sub-04');
  });

  // TS-19: el otro rol declarado en `x-roles` también entra.
  it('devuelve 201 para un usuario con rol user', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .send(validBody)
      .expect(201)
      .then(res => {
        res.body.should.have.property('fileId');
        res.body.should.have.property('uploadUrl');
      });
  });

  // TS-20 (S-034, CA-5): `admin` NO está en `x-roles` de este endpoint, pero desde que la api
  // pierde su `hasAnyRole(['user','external-user'])`, el rechazo por rol ya no existe en la
  // api -- lo decide `core`. `files.request-upload` SÍ está en `INTERNAL_COMMANDS`, y `admin`
  // los hereda todos (`ADMIN_COMMANDS`), así que ahora entra: 201, no 403. `x-roles` sigue en
  // el spec como documentación de qué rol autoriza `core` (CA-8), pero ya no es lo que esta
  // ruta verifica.
  it('un token cuyo único rol es admin ahora entra (el hasAnyRole de la api ya no lo bloquea)', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_03_admin')
      .send(validBody)
      .expect(201)
      .then(res => {
        res.body.should.have.property('fileId');
        fakeBus.sent.length.should.equal(1);
        (fakeBus.last as any).command.should.equal('files.request-upload');
      });
  });

  // TS-21: sin token.
  it('devuelve 401 sin token y no publica el comando', () => {
    return request(application)
      .post('/api/opus/attachments')
      .send(validBody)
      .expect(401)
      .then(() => {
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-22 (CA-6): la validación propia del portal se fue con `entityType`. El código
  // `invalid_entity_type` YA NO SE EMITE desde este archivo: un cuerpo con `entityType` cae en
  // el `invalid_fields` genérico de Joi.
  it('rechaza entityType con invalid_fields y nunca con invalid_entity_type', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ fileName: 'a.pdf', mimeType: 'application/pdf', fileSize: 100, entityType: 'objective', entityId: 5 })
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_fields');
        res.body.code.should.not.equal('invalid_entity_type');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-23 (CA-5, CA-6): el external-user del test no tiene ninguna fila en
  // `user_project_permissions` y aun así recibe el ticket. Ya no hay entidad contra la que
  // validar permiso.
  it('acepta a un external-user sin permiso sobre ningún proyecto', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ fileName: 'a.pdf', mimeType: 'application/pdf', fileSize: 100 })
      .expect(201)
      .then(res => {
        res.body.should.have.property('fileId');
      });
  });

  // TS-24: Joi corta antes de publicar, igual que en el interno.
  it('devuelve 400 invalid_fields sin publicar cuando falta fileSize', () => {
    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ fileName: 'a.pdf', mimeType: 'application/pdf' })
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_fields');
        res.body.message.should.startWith('Invalid field - ');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-25 (S-014/CA-10): el timeout del bus sale 504 `gateway_timeout`. El portal muestra el
  // `message` del cuerpo sin cambiar una línea, así que el texto nuevo llega solo.
  it('devuelve 504 cuando la respuesta del bus no llega a tiempo', () => {
    fakeBus.failWithTimeout();

    return request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .send(validBody)
      .expect(504)
      .then(res => {
        res.body.code.should.equal('gateway_timeout');
      });
  });

  // TS-26 (CA-3, CA-6): el portal tampoco puede mandar el byte.
  it('no acepta multipart/form-data con binario: no responde 201 ni escribe attachments', async () => {
    const before = await Attachment.count();

    const res = await request(application)
      .post('/api/opus/attachments')
      .set('Authorization', 'Bearer token_04_external_user')
      .field('entityType', 'objective')
      .attach('files', Buffer.from('x'), 'a.pdf');

    res.status.should.not.equal(201);
    res.status.should.equal(400);
    fakeBus.sent.length.should.equal(0);
    (await Attachment.count()).should.equal(before);
  });
});
