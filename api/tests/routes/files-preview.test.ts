import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { File, User } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

// Tokens del mock:
// token_01_user → sub: zitadel-sub-01, rol: user

const DOWNLOAD_URL = 'https://s3.example/grava-gestion/f/orphan.pdf?X-Amz-Signature=orphan1';

function downloadTicket(overrides: Record<string, unknown> = {}) {
  return {
    status: 'success' as const,
    data: {
      downloadUrl: DOWNLOAD_URL,
      expiresIn: 300,
      fileName: 'recien-subido.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048,
      ...overrides,
    },
  };
}

/**
 * El fixture de este archivo es el más simple de la story: SOLO filas de `files`, sin
 * `attachments`. Es la prueba de que el camino no depende del modelo de vínculos.
 */
async function createFile(overrides: Record<string, any> = {}): Promise<File> {
  return File.create({
    fileName: 'recien-subido.pdf',
    fileSize: 2048,
    mimeType: 'application/pdf',
    storageKey: `grava-gestion/f/${Math.random()}.pdf`,
    storageBucket: 'test-bucket',
    storageRegion: 'sfo2',
    byteStatus: 'uploaded',
    retentionStatus: 'active',
    uploadedBy: 'zitadel-sub-01',
    ...overrides,
  } as any, { validate: false });
}

describe('GET /api/files/:id/preview', () => {
  let application: Application;
  let fileOrphan: File;
  let filePending: File;
  let fileRetired: File;
  let fileOtherOwner: File;

  before(async function() {
    this.timeout(30000);
    application = start();

    await User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01fp', email: 'u1fp@mail.com' } as any);
    await User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'ext04fp', email: 'ext04fp@mail.com' } as any);

    fileOrphan = await createFile();
    filePending = await createFile({ byteStatus: 'pending' });
    fileRetired = await createFile({ retentionStatus: 'scheduled_for_deletion' });
    // Archivo de otro usuario: el endpoint NO valida titularidad, a propósito.
    fileOtherOwner = await createFile({ uploadedBy: 'zitadel-sub-04' });
  });

  after(async () => {
    await File.destroy({ where: {}, force: true });
    await User.destroy({ where: { id: ['zitadel-sub-01', 'zitadel-sub-04'] } });
  });

  // TS-19: un archivo sin ningún vínculo se previsualiza por su fileId.
  it('responde 302 para un archivo sin vínculo, publicando el comando con su fileId', () => {
    fakeBus.reply(`files.${fileOrphan.id}.request-download`, downloadTicket());

    return request(application)
      .get(`/api/files/${fileOrphan.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302)
      .then(res => {
        res.headers['location'].should.equal(DOWNLOAD_URL);
        res.headers['x-content-type-options'].should.equal('nosniff');
        fakeBus.sent.length.should.equal(1);
        (fakeBus.last as any).command.should.equal(`files.${fileOrphan.id}.request-download`);
        (fakeBus.last as any).payload.should.deepEqual({ disposition: 'inline' });
      });
  });

  // El id del path va TAL CUAL al comando: es el id de `files`, no hay traducción.
  it('usa el id del path sin traducirlo', () => {
    fakeBus.replyDefault(downloadTicket());

    return request(application)
      .get('/api/files/424242/preview')
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302)
      .then(() => {
        (fakeBus.last as any).command.should.equal('files.424242.request-download');
      });
  });

  // Variante de TS-3 sobre esta ruta: los metadatos del reply llegan a los headers.
  it('lleva los metadatos del reply en los headers, y el tamaño en el HEAD', () => {
    fakeBus.replyDefault(downloadTicket());

    return request(application)
      .head(`/api/files/${fileOrphan.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302)
      .then(res => {
        res.headers['content-type'].should.containEql('application/pdf');
        res.headers['content-disposition'].should.containEql('inline');
        res.headers['content-disposition'].should.containEql('recien-subido.pdf');
        res.headers['content-length'].should.equal('2048');
      });
  });

  // La titularidad NO se valida: rompería el caso legítimo del archivo compartido.
  it('permite previsualizar un archivo subido por otro usuario', () => {
    fakeBus.replyDefault(downloadTicket());

    return request(application)
      .get(`/api/files/${fileOtherOwner.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302);
  });

  // TS-20: sin JWT → 401 sin publicar.
  it('responde 401 sin publicar cuando no hay token', () => {
    return request(application)
      .get(`/api/files/${fileOrphan.id}/preview`)
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-23: id no entero → 400 sin publicar.
  it('responde 400 invalid_id sin publicar cuando el id no es entero', () => {
    return request(application)
      .get('/api/files/abc/preview')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_id');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-21: archivo inexistente → 404 file_not_found, EJECUTANDO CORE de verdad.
  it('responde 404 file_not_found para un archivo inexistente', () => {
    return request(application)
      .get('/api/files/999999/preview')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('file_not_found');
      });
  });

  // Archivo retirado → 404 file_not_found (retention_status != active).
  it('responde 404 file_not_found para un archivo retirado', () => {
    return request(application)
      .get(`/api/files/${fileRetired.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('file_not_found');
      });
  });

  // TS-22 INVERTIDO (2026-08-20): un byte pendiente se sirve igual, ejecutando core.
  //
  // `byte_status: 'pending'` significaba a la vez "el byte nunca llegó" y "todavía no se
  // vinculó" —el `uploaded` lo escribe el comando de vinculación, al guardar la entidad—, así
  // que bloquearlo hacía imprevisualizable POR CONSTRUCCIÓN a todo archivo recién subido. Es
  // justo el caso que este endpoint existe para cubrir (RF-1, CA-7). Se resigna el 404
  // entendible de CA-15 / RF-21 / D-15: decisión explícita del solicitante.
  it('responde 302 aunque el byte esté pendiente: el archivo sin vínculo se previsualiza', () => {
    return request(application)
      .get(`/api/files/${filePending.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(302)
      .then(res => {
        res.headers.location.should.be.a.String();
        (fakeBus.last as any).command.should.equal(`files.${filePending.id}.request-download`);
      });
  });

  // TS-24: bus caído → 503.
  it('responde 503 cuando el bus no responde', () => {
    fakeBus.failWith(new Error('timeout'));

    return request(application)
      .get(`/api/files/${fileOrphan.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(503)
      .then(res => {
        res.body.code.should.equal('service_unavailable');
      });
  });
});
