import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, File, User } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

// Tokens del mock:
// token_01_user → sub: zitadel-sub-01, rol: user (sin filas en user_project_permissions)

/**
 * El endpoint YA NO RECIBE EL BINARIO NI ESCRIBE LA BASE (REQ-001, S-004): pide permiso de
 * subida publicando `files.request-upload` y traduce el ticket a 201.
 *
 * Los tests del camino feliz NO usan `fakeBus.reply()`: dejan que el doble ejecute `core` de
 * verdad contra la misma base (ADR-013). Es lo único que hace verificables TS-1 y TS-17 —que
 * la fila aparece en `files` y NO aparece en `attachments`—, o sea la prueba directa de que la
 * excepción 2 de ADR-001 quedó cerrada.
 */
describe('POST /api/attachments', () => {
  let application: Application;

  const validBody = {
    fileName: 'informe.pdf',
    mimeType: 'application/pdf',
    fileSize: 4194304,
    checksum: '9c1e5a',
  };

  before(async function() {
    this.timeout(30000);
    application = start();

    await User.create({
      id: 'zitadel-sub-01', name: 'User 01', username: 'user01post', email: 'u1post@mail.com'
    } as any);
  });

  afterEach(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {}, force: true });
  });

  after(async () => {
    await User.destroy({ where: {} });
  });

  // TS-1: el camino feliz completo, con core ejecutándose de verdad.
  it('devuelve 201 con el UploadTicket y publica files.request-upload con el payload del contrato', async () => {
    const res = await request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .set('Content-Type', 'application/json')
      .send(validBody)
      .expect(201);

    res.body.should.have.property('fileId').which.is.a.Number();
    res.body.should.have.property('uploadUrl').which.is.a.String();
    res.body.should.have.property('expiresIn').which.is.a.Number();

    fakeBus.sent.length.should.equal(1);
    (fakeBus.last as any).command.should.equal('files.request-upload');
    (fakeBus.last as any).payload.should.deepEqual({
      uploader: 'zitadel-sub-01',
      fileName: 'informe.pdf',
      mimeType: 'application/pdf',
      fileSize: 4194304,
      checksum: '9c1e5a',
    });

    // La fila la escribió CORE, no la api. `byte_status = 'pending'`: el byte todavía no subió.
    const file = await File.findByPk(res.body.fileId);
    (file !== null).should.be.true();
    (file as File).fileName.should.equal('informe.pdf');
    (file as File).byteStatus.should.equal('pending');
  });

  // TS-2: la traducción `id` → `fileId`. Es el punto del helper `toUploadTicket`.
  it('traduce el id del reply a fileId y no deja la clave id en la respuesta', () => {
    fakeBus.reply('files.request-upload', {
      status: 'success',
      data: { id: 777, uploadUrl: 'https://s3/x?sig', expiresIn: 300 },
    });

    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .send(validBody)
      .expect(201)
      .then(res => {
        res.body.should.deepEqual({ fileId: 777, uploadUrl: 'https://s3/x?sig', expiresIn: 300 });
        Object.keys(res.body).should.not.containEql('id');
      });
  });

  // TS-3: el spread condicional. Un `checksum: undefined` explícito en el payload no es lo
  // mismo que la ausencia de la clave: el esquema de core lo declara `.optional()`, y mandar
  // la clave con `undefined` la haría viajar como `null` tras el JSON.
  it('no incluye la clave checksum en el payload cuando el cuerpo no la trae', () => {
    fakeBus.reply('files.request-upload', {
      status: 'success',
      data: { id: 1, uploadUrl: 'https://s3/x', expiresIn: 300 },
    });

    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .send({ fileName: 'a.txt', mimeType: 'text/plain', fileSize: 12 })
      .expect(201)
      .then(() => {
        Object.prototype.hasOwnProperty.call((fakeBus.last as any).payload, 'checksum')
          .should.be.false();
      });
  });

  // TS-4: `null` explícito SÍ viaja — es distinto de ausente y el contrato lo permite.
  it('reenvía checksum null cuando el cuerpo lo declara explícitamente', () => {
    fakeBus.reply('files.request-upload', {
      status: 'success',
      data: { id: 1, uploadUrl: 'https://s3/x', expiresIn: 300 },
    });

    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .send({ fileName: 'a.txt', mimeType: 'text/plain', fileSize: 12, checksum: null })
      .expect(201)
      .then(() => {
        ((fakeBus.last as any).payload.checksum === null).should.be.true();
      });
  });

  // TS-5: sin token no se publica nada. El JWT es la ÚNICA autorización que queda.
  it('devuelve 401 sin token y no publica el comando', () => {
    return request(application)
      .post('/api/attachments')
      .send(validBody)
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-6 a TS-10: Joi corta ANTES de publicar. No es un detalle: publicar un comando que core
  // va a rechazar consume un round-trip del bus y un id de la secuencia por cada rechazo.
  const invalidBodies: Array<[string, Record<string, unknown>]> = [
    ['falta fileName', { mimeType: 'application/pdf', fileSize: 100 }],
    ['falta mimeType', { fileName: 'a.pdf', fileSize: 100 }],
    ['falta fileSize', { fileName: 'a.pdf', mimeType: 'application/pdf' }],
    ['fileSize no es positivo', { fileName: 'a.pdf', mimeType: 'application/pdf', fileSize: 0 }],
    ['fileName supera 255', { fileName: 'a'.repeat(256), mimeType: 'application/pdf', fileSize: 100 }],
  ];

  invalidBodies.forEach(([description, body]) => {
    it(`devuelve 400 invalid_fields sin publicar cuando ${description}`, () => {
      return request(application)
        .post('/api/attachments')
        .set('Authorization', 'Bearer token_01_user')
        .send(body)
        .expect(400)
        .then(res => {
          res.body.code.should.equal('invalid_fields');
          res.body.message.should.startWith('Invalid field - ');
          fakeBus.sent.length.should.equal(0);
        });
    });
  });

  // TS-11: CA-3 verificado desde afuera. Un multipart con un binario adjunto ya no produce
  // NADA: ni comando, ni fila, ni 201.
  it('no acepta multipart/form-data con binario: no responde 201 ni escribe attachments', async () => {
    const before = await Attachment.count();

    const res = await request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .field('entityType', 'requirement')
      .attach('files', Buffer.from('x'), 'a.pdf');

    res.status.should.not.equal(201);
    res.status.should.equal(400);
    fakeBus.sent.length.should.equal(0);
    (await Attachment.count()).should.equal(before);
  });

  // TS-12: Joi es estricto por default y así tiene que quedar. `entityType` desapareció del
  // contrato de subida (D-12): aceptarlo en silencio dejaría a los frontends creyendo que
  // todavía se usa.
  it('rechaza entityType y entityId en el cuerpo con 400 invalid_fields, sin publicar', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        fileName: 'a.pdf', mimeType: 'application/pdf', fileSize: 100,
        entityType: 'requirement', entityId: 1,
      })
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_fields');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-13 (CA-5): el usuario del test NO tiene ninguna fila en `user_project_permissions` y
  // aun así recibe el ticket. Es correcto: no hay entidad contra la que validar, y el control
  // por entidad se corre al momento de vincular.
  it('acepta la solicitud de un usuario sin permiso sobre ningún proyecto', () => {
    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .send({ fileName: 'a.pdf', mimeType: 'application/pdf', fileSize: 100 })
      .expect(201)
      .then(res => {
        res.body.should.have.property('fileId');
        res.body.should.have.property('uploadUrl');
      });
  });

  // TS-14 / TS-15 (CA-7): los rechazos de la política de core llegan con su propio status. Si
  // salieran 500, el usuario vería un error genérico donde el contrato promete uno accionable.
  it('traduce file_type_not_allowed a 400 y no a 500', () => {
    fakeBus.reply('files.request-upload', {
      status: 'failure',
      errorCode: 'file_type_not_allowed',
      errorMessage: 'File type is not allowed',
    });

    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .send(validBody)
      .expect(400)
      .then(res => {
        res.body.code.should.equal('file_type_not_allowed');
        res.body.message.should.equal('File type is not allowed');
      });
  });

  it('traduce file_too_large a 400 y no a 500', () => {
    fakeBus.reply('files.request-upload', {
      status: 'failure',
      errorCode: 'file_too_large',
      errorMessage: 'File exceeds the configured maximum size',
    });

    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .send(validBody)
      .expect(400)
      .then(res => {
        res.body.code.should.equal('file_too_large');
      });
  });

  // TS-16 (CA-13): el timeout de 5000 ms de ADR-002 sale 503, no 500. La operación no ocurrió.
  it('devuelve 503 cuando el bus no responde', () => {
    fakeBus.failWith(new Error('timeout'));

    return request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .send(validBody)
      .expect(503)
      .then(res => {
        res.body.code.should.equal('service_unavailable');
      });
  });

  // TS-17 (CA-2): LA PRUEBA DIRECTA DE QUE LA EXCEPCIÓN 2 DE ADR-001 QUEDÓ CERRADA. La api no
  // escribe `attachments`; la fila que sí aparece es la de `files`, y la escribió core.
  it('no escribe ninguna fila en attachments al pedir el ticket', async () => {
    const attachmentsBefore = await Attachment.count();

    const res = await request(application)
      .post('/api/attachments')
      .set('Authorization', 'Bearer token_01_user')
      .send(validBody)
      .expect(201);

    (await Attachment.count()).should.equal(attachmentsBefore);
    (await File.count({ where: { id: res.body.fileId } })).should.equal(1);
  });
});
