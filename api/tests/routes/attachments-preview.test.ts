import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import {
  Attachment, File, Objective, Project, Requirement, RequirementActivity,
  User, UserProjectPermission
} from '@jiku/models';
import { fakeBus } from '../mocks/bus';

// Tokens del mock:
// token_01_user          → sub: zitadel-sub-01, rol: user
// token_04_external_user → sub: zitadel-sub-04, rol: external-user

const DOWNLOAD_URL = 'https://s3.example/grava-gestion/f/9c1e.pdf?X-Amz-Signature=abc123';

/** Reply de `files.{fileId}.request-download` tal como lo emite core (S-002). */
function downloadTicket(overrides: Record<string, unknown> = {}) {
  return {
    status: 'success' as const,
    data: {
      downloadUrl: DOWNLOAD_URL,
      expiresIn: 300,
      fileName: 'informe.pdf',
      mimeType: 'application/pdf',
      fileSize: 4194304,
      ...overrides,
    },
  };
}

/**
 * El fixture cambió de forma con S-005: primero la fila de `files`, después el
 * `Attachment` con su `file_id`. Las columnas viejas de `attachments` siguen siendo
 * `allowNull: false` en el modelo compartido, así que hay que poblarlas aunque el código
 * ya no las lea.
 */
async function createFile(overrides: Record<string, any> = {}): Promise<File> {
  return File.create({
    fileName: 'informe.pdf',
    fileSize: 4194304,
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

async function createAttachment(file: File, overrides: Record<string, any> = {}): Promise<Attachment> {
  return Attachment.create({
    entityType: 'objective',
    entityId: 1,
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

describe('GET /api/attachments/:id/preview', () => {
  let application: Application;
  let fileOk: File;
  let attOk: Attachment;
  let attRestricted: Attachment;
  let attInternal: Attachment;
  let attDeleted: Attachment;
  let filePending: File;
  let attPending: Attachment;
  let fileOtherOwner: File;
  let attOtherOwner: Attachment;

  before(async function() {
    this.timeout(30000);
    application = start();

    await User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'u1@mail.com' });
    await User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuser', email: 'ext@mail.com' });

    // Project 1: external-user tiene permiso. Project 2: no.
    await Project.create({
      id: 1, code: 'P1', name: 'Project 1', type: 'comercial',
      status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
    } as any);
    await Project.create({
      id: 2, code: 'P2', name: 'Project 2', type: 'comercial',
      status: 'activo', priority: 2, initDate: new Date(), createdBy: 'zitadel-sub-01'
    } as any);
    await Objective.create({
      id: 1, title: 'Objective 1', state: 'activo', area: 'desarrollo',
      priority: 1, projectId: 1, createdBy: 'zitadel-sub-01'
    } as any);
    await Objective.create({
      id: 2, title: 'Objective 2', state: 'activo', area: 'desarrollo',
      priority: 2, projectId: 2, createdBy: 'zitadel-sub-01'
    } as any);
    // Requisito del proyecto 2 con una actividad `internal`, para el caso CA-5.
    await Requirement.create({
      id: 1, title: 'Requirement 1', description: 'r1', state: 'analisis',
      priority: 'media', projectId: 2, createdBy: 'zitadel-sub-01'
    } as any);
    await RequirementActivity.create({
      id: 1, requirementId: 1, typeOfActivity: 'comment', visibilityLevel: 'internal',
      previousValue: '', newValue: 'un comentario interno', changedBy: 'zitadel-sub-01'
    } as any, { validate: false });

    await UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: 1 } as any);

    fileOk = await createFile();
    attOk = await createAttachment(fileOk);

    // Proyecto 2: external-user sin permiso → 403.
    const fileRestricted = await createFile();
    attRestricted = await createAttachment(fileRestricted, { entityType: 'objective', entityId: 2 });

    // Actividad `internal` de un proyecto sin permiso para el external-user → 403.
    const fileInternal = await createFile();
    attInternal = await createAttachment(fileInternal, { entityType: 'requirement_comment', entityId: 1 });

    const fileDeleted = await createFile();
    attDeleted = await createAttachment(fileDeleted, { deletedAt: new Date(), deletedBy: 'zitadel-sub-01' });

    // El byte nunca llegó: core responde `file_not_available` sin tocar S3.
    filePending = await createFile({ byteStatus: 'pending', fileName: 'pendiente.pdf' });
    attPending = await createAttachment(filePending);

    // Archivo subido por OTRO usuario: la titularidad no aplica a la lectura.
    fileOtherOwner = await createFile({ uploadedBy: 'zitadel-sub-04' });
    attOtherOwner = await createAttachment(fileOtherOwner);
  });

  after(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {}, force: true });
    await RequirementActivity.destroy({ where: {}, force: true });
    await Requirement.destroy({ where: {}, force: true });
    await UserProjectPermission.destroy({ where: {} });
    await Objective.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  // TS-1: el preview responde 302 a la prefirmada de core, sin mover un byte.
  it('responde 302 con Location = downloadUrl y publica el comando con disposition inline', () => {
    fakeBus.reply(`files.${fileOk.id}.request-download`, downloadTicket());

    return request(application)
      .get(`/api/attachments/${attOk.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302)
      .then(res => {
        res.headers['location'].should.equal(DOWNLOAD_URL);
        res.headers['x-content-type-options'].should.equal('nosniff');
        fakeBus.sent.length.should.equal(1);
        (fakeBus.last as any).command.should.equal(`files.${fileOk.id}.request-download`);
        (fakeBus.last as any).payload.should.deepEqual({ disposition: 'inline' });
        // El body va VACÍO: la api no movió un solo byte del archivo (CA-1).
        (res.text ?? '').should.be.empty();
        ((res.body as Buffer)?.length ?? 0).should.equal(0);
      });
  });

  // TS-25: la titularidad NO aplica a la lectura — el payload no lleva `requester`.
  it('permite leer un archivo subido por otro usuario, sin requester en el payload', () => {
    fakeBus.reply(`files.${fileOtherOwner.id}.request-download`, downloadTicket());

    return request(application)
      .get(`/api/attachments/${attOtherOwner.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302)
      .then(() => {
        (fakeBus.last as any).payload.should.deepEqual({ disposition: 'inline' });
        Object.keys((fakeBus.last as any).payload).should.not.containEql('requester');
      });
  });

  // TS-3: los metadatos del reply llegan a los headers, así el HEAD sigue funcionando.
  it('lleva los metadatos del reply en los headers del 302', () => {
    fakeBus.reply(`files.${fileOk.id}.request-download`, downloadTicket());

    return request(application)
      .get(`/api/attachments/${attOk.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302)
      .then(res => {
        res.headers['content-type'].should.containEql('application/pdf');
        res.headers['content-disposition'].should.containEql('inline');
        res.headers['content-disposition'].should.containEql('informe.pdf');
      });
  });

  // TS-3 (CA-10): el HEAD que los frontends usan para resolver nombre y tamaño antes de
  // renderizar embebido sigue funcionando. El `Content-Length` con el tamaño del archivo
  // solo se manda acá: en un GET prometería bytes que un 302 no tiene.
  it('responde al HEAD con nombre, tipo y tamaño del archivo', () => {
    fakeBus.reply(`files.${fileOk.id}.request-download`, downloadTicket());

    return request(application)
      .head(`/api/attachments/${attOk.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .redirects(0)
      .expect(302)
      .then(res => {
        res.headers['content-type'].should.containEql('application/pdf');
        res.headers['content-disposition'].should.containEql('informe.pdf');
        res.headers['content-length'].should.equal('4194304');
        res.headers['location'].should.equal(DOWNLOAD_URL);
      });
  });

  // TS-4: sin permiso sobre el proyecto de la entidad → 403 SIN publicar.
  it('responde 403 sin publicar cuando el usuario no tiene permiso sobre la entidad', () => {
    return request(application)
      .get(`/api/attachments/${attRestricted.id}/preview`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-5: entidad internal + external-user → 403 sin publicar.
  it('responde 403 sin publicar para una entidad internal y un external-user', () => {
    return request(application)
      .get(`/api/attachments/${attInternal.id}/preview`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-6: vínculo inexistente → 404 sin publicar.
  it('responde 404 sin publicar cuando el vínculo no existe', () => {
    return request(application)
      .get('/api/attachments/999999/preview')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-7: vínculo borrado → 404 sin publicar.
  it('responde 404 sin publicar cuando el vínculo fue borrado', () => {
    return request(application)
      .get(`/api/attachments/${attDeleted.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-8: byte ausente → 404 file_not_available, EJECUTANDO CORE de verdad (ADR-013).
  it('responde 404 file_not_available cuando el byte nunca llegó', () => {
    return request(application)
      .get(`/api/attachments/${attPending.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('file_not_available');
        res.body.message.should.equal('El archivo no está disponible');
        (fakeBus.last as any).command.should.equal(`files.${filePending.id}.request-download`);
      });
  });

  // TS-10: bus caído / timeout → 503.
  it('responde 503 cuando el bus no responde', () => {
    fakeBus.failWith(new Error('timeout'));

    return request(application)
      .get(`/api/attachments/${attOk.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(503)
      .then(res => {
        res.body.code.should.equal('service_unavailable');
        res.body.message.should.equal('El servicio no está disponible en este momento');
      });
  });

  // TS-11: id no entero → 400 sin publicar.
  it('responde 400 invalid_id sin publicar cuando el id no es entero', () => {
    return request(application)
      .get('/api/attachments/abc/preview')
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
      .get(`/api/attachments/${attOk.id}/preview`)
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });
});
