import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, File, Objective, Project, User, UserProjectPermission } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

// Tokens del mock:
// token_01_user          → sub: zitadel-sub-01, rol: user
// token_04_external_user → sub: zitadel-sub-04, rol: external-user

const DOWNLOAD_URL = 'https://s3.example/grava-gestion/f/aa11.txt?X-Amz-Signature=dl123';

function downloadTicket(overrides: Record<string, unknown> = {}) {
  return {
    status: 'success' as const,
    data: {
      downloadUrl: DOWNLOAD_URL,
      expiresIn: 300,
      fileName: 'test-file.txt',
      mimeType: 'text/plain',
      fileSize: 17,
      ...overrides,
    },
  };
}

async function createFile(overrides: Record<string, any> = {}): Promise<File> {
  return File.create({
    fileName: 'test-file.txt',
    fileSize: 17,
    mimeType: 'text/plain',
    storageKey: `grava-gestion/f/${Math.random()}.txt`,
    storageBucket: 'test-bucket',
    storageRegion: 'sfo2',
    byteStatus: 'uploaded',
    retentionStatus: 'active',
    uploadedBy: 'zitadel-sub-01',
    ...overrides,
  } as any, { validate: false });
}

async function createAttachment(file: File, overrides: Record<string, any> = {}): Promise<Attachment> {
  return Attachment.create({
    entityType: 'objective',
    entityId: 101,
    fileId: file.id,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    storageKey: file.storageKey,
    storageBucket: file.storageBucket,
    storageRegion: file.storageRegion,
    uploadedBy: file.uploadedBy,
    ...overrides,
  } as any, { validate: false });
}

describe('GET /api/attachments/:id/download', () => {
  let application: Application;
  let fileOk: File;
  let attOk: Attachment;
  let attDeleted: Attachment;
  let attRestricted: Attachment;
  let attExternalOk: Attachment;
  let fileRetired: File;
  let attRetired: Attachment;

  before(async function() {
    this.timeout(30000);
    application = start();

    await User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01dl', email: 'u1dl@mail.com' });
    await User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuserdl', email: 'extdl@mail.com' });
    await Project.create({
      id: 101, code: 'DL1', name: 'DL Project 1', type: 'comercial',
      status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
    } as any);
    await Project.create({
      id: 102, code: 'DL2', name: 'DL Project 2', type: 'comercial',
      status: 'activo', priority: 2, initDate: new Date(), createdBy: 'zitadel-sub-01'
    } as any);
    await Objective.create({
      id: 101, title: 'DL Objective 1', state: 'activo', area: 'desarrollo',
      priority: 1, projectId: 101, createdBy: 'zitadel-sub-01'
    } as any);
    await Objective.create({
      id: 102, title: 'DL Objective 2', state: 'activo', area: 'desarrollo',
      priority: 2, projectId: 102, createdBy: 'zitadel-sub-01'
    } as any);
    await UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: 101 } as any);

    fileOk = await createFile();
    attOk = await createAttachment(fileOk);

    const fileDeleted = await createFile();
    attDeleted = await createAttachment(fileDeleted, { deletedAt: new Date(), deletedBy: 'zitadel-sub-01' });

    const fileRestricted = await createFile();
    attRestricted = await createAttachment(fileRestricted, { entityId: 102 });

    const fileExternalOk = await createFile();
    attExternalOk = await createAttachment(fileExternalOk);

    // Archivo retirado: core responde `file_not_found` (retention_status != active).
    fileRetired = await createFile({ retentionStatus: 'scheduled_for_deletion' });
    attRetired = await createAttachment(fileRetired);
  });

  after(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {}, force: true });
    await UserProjectPermission.destroy({ where: {} });
    await Objective.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  // TS-2: la descarga responde 302 publicando con disposition attachment.
  it('responde 302 con Location = downloadUrl y publica el comando con disposition attachment', () => {
    fakeBus.reply(`files.${fileOk.id}.request-download`, downloadTicket());

    return request(application)
      .get(`/api/attachments/${attOk.id}/download`)
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302)
      .then(res => {
        res.headers['location'].should.equal(DOWNLOAD_URL);
        res.headers['x-content-type-options'].should.equal('nosniff');
        fakeBus.sent.length.should.equal(1);
        (fakeBus.last as any).command.should.equal(`files.${fileOk.id}.request-download`);
        (fakeBus.last as any).payload.should.deepEqual({
          disposition: 'attachment',
          actor: { id: 'zitadel-sub-01', roles: ['user'] },
        });
      });
  });

  // TS-3 (variante download): los metadatos del reply llegan a los headers.
  it('lleva los metadatos del reply en los headers del 302', () => {
    fakeBus.reply(`files.${fileOk.id}.request-download`, downloadTicket());

    return request(application)
      .get(`/api/attachments/${attOk.id}/download`)
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302)
      .then(res => {
        res.headers['content-type'].should.containEql('text/plain');
        res.headers['content-disposition'].should.containEql('attachment');
        res.headers['content-disposition'].should.containEql('test-file.txt');
      });
  });

  // CA-10: el HEAD sigue trayendo el tamaño del archivo.
  it('responde al HEAD con el tamaño del archivo en Content-Length', () => {
    fakeBus.reply(`files.${fileOk.id}.request-download`, downloadTicket());

    return request(application)
      .head(`/api/attachments/${attOk.id}/download`)
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302)
      .then(res => {
        res.headers['content-length'].should.equal('17');
        res.headers['location'].should.equal(DOWNLOAD_URL);
      });
  });

  // TS-4: sin permiso sobre la entidad → 403 sin publicar.
  it('responde 403 sin publicar cuando el usuario no tiene permiso sobre la entidad', () => {
    return request(application)
      .get(`/api/attachments/${attRestricted.id}/download`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
        fakeBus.sent.length.should.equal(0);
      });
  });

  it('permite descargar a un external-user con permiso sobre el proyecto', () => {
    fakeBus.replyDefault(downloadTicket());

    return request(application)
      .get(`/api/attachments/${attExternalOk.id}/download`)
      .set('Authorization', 'Bearer token_04_external_user')
      .redirects(0)
      .expect(302);
  });

  // TS-7: vínculo borrado → 404 sin publicar.
  it('responde 404 sin publicar cuando el vínculo fue borrado', () => {
    return request(application)
      .get(`/api/attachments/${attDeleted.id}/download`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-6: vínculo inexistente → 404 sin publicar.
  it('responde 404 sin publicar cuando el vínculo no existe', () => {
    return request(application)
      .get('/api/attachments/999999/download')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-9: archivo retirado → 404 file_not_found, EJECUTANDO CORE de verdad (ADR-013).
  it('responde 404 file_not_found cuando el archivo fue retirado', () => {
    return request(application)
      .get(`/api/attachments/${attRetired.id}/download`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('file_not_found');
        (fakeBus.last as any).command.should.equal(`files.${fileRetired.id}.request-download`);
      });
  });

  // TS-10 (S-014/CA-10): no hay ningún suscriptor → 503 `service_unavailable`, con la señal
  // explícita de `no responders`. El timeout es el otro caso y sale 504.
  it('responde 503 cuando no hay ningún suscriptor del subject', () => {
    fakeBus.failWithNoResponders();

    return request(application)
      .get(`/api/attachments/${attOk.id}/download`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(503)
      .then(res => {
        res.body.code.should.equal('service_unavailable');
      });
  });

  // TS-11: id no entero → 400 sin publicar.
  it('responde 400 invalid_id sin publicar cuando el id no es entero', () => {
    return request(application)
      .get('/api/attachments/abc/download')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_id');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-12: sin token → 401 sin publicar.
  it('responde 401 sin publicar cuando no hay token', () => {
    return request(application)
      .get(`/api/attachments/${attOk.id}/download`)
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });
});
