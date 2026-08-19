import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import {
  Attachment, File, Objective, ObjectiveActivity, Project, Requirement,
  RequirementActivity, User, UserProjectPermission
} from '@jiku/models';
import { fakeBus } from '../mocks/bus';

// Tokens del mock:
// token_01_user          → sub: zitadel-sub-01, rol: user
// token_03_admin         → sub: zitadel-sub-03, rol: admin (NO habilitado en estas rutas)
// token_04_external_user → sub: zitadel-sub-04, rol: external-user

const DOWNLOAD_URL = 'https://s3.example/grava-gestion/f/opus.jpg?X-Amz-Signature=opus1';

function downloadTicket(overrides: Record<string, unknown> = {}) {
  return {
    status: 'success' as const,
    data: {
      downloadUrl: DOWNLOAD_URL,
      expiresIn: 300,
      fileName: 'imagen.jpg',
      mimeType: 'image/jpeg',
      fileSize: 17,
      ...overrides,
    },
  };
}

async function createFile(overrides: Record<string, any> = {}): Promise<File> {
  return File.create({
    fileName: 'imagen.jpg',
    fileSize: 17,
    mimeType: 'image/jpeg',
    storageKey: `grava-gestion/f/${Math.random()}.jpg`,
    storageBucket: 'test-bucket',
    storageRegion: 'sfo2',
    byteStatus: 'uploaded',
    retentionStatus: 'active',
    uploadedBy: 'zitadel-sub-01',
    ...overrides,
  } as any, { validate: false });
}

async function createAttachment(file: File, overrides: Record<string, any>): Promise<Attachment> {
  return Attachment.create({
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

describe('GET /api/opus/attachments/:id/preview', () => {
  let application: Application;

  const projectId = 6300;
  const projectNoPermId = 6301;
  let objectiveId: number;
  let objectiveNoPermId: number;

  let fileComment: File;
  let attComment: Attachment;
  let attNoPerm: Attachment;

  before(async function() {
    this.timeout(30000);
    application = start();

    await User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01prev', email: 'user01prev@mail.com' } as any);
    await User.create({ id: 'zitadel-sub-03', name: 'Admin 03', username: 'admin03prev', email: 'admin03prev@mail.com' } as any);
    await User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'ext04prev', email: 'ext04prev@mail.com' } as any);

    await Project.create({
      id: projectId, code: 'PR1', name: 'Preview Project 1', type: 'comercial',
      status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
    } as any);
    await Project.create({
      id: projectNoPermId, code: 'PR2', name: 'Preview Project 2', type: 'comercial',
      status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
    } as any);

    const obj = await Objective.create({
      title: 'Preview Objective 1', state: 'activo', area: 'desarrollo',
      priority: 1, projectId, createdBy: 'zitadel-sub-01'
    } as any);
    objectiveId = obj.id;

    const objNoPerm = await Objective.create({
      title: 'Preview Objective NoPerm', state: 'activo', area: 'desarrollo',
      priority: 1, projectId: projectNoPermId, createdBy: 'zitadel-sub-01'
    } as any);
    objectiveNoPermId = objNoPerm.id;

    const activity = await ObjectiveActivity.create({
      typeOfActivity: 'comment', previousValue: '', newValue: 'Test comment',
      objectiveId, changedBy: 'zitadel-sub-01', visibilityLevel: 'public',
    } as any);

    fileComment = await createFile();
    attComment = await createAttachment(fileComment, { entityType: 'comment', entityId: activity.id });

    const fileNoPerm = await createFile();
    attNoPerm = await createAttachment(fileNoPerm, { entityType: 'objective', entityId: objectiveNoPermId });

    await UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId } as any);
  });

  after(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {}, force: true });
    await ObjectiveActivity.destroy({ where: {} });
    await UserProjectPermission.destroy({ where: { userId: 'zitadel-sub-04' } });
    await Objective.destroy({ where: { projectId: [projectId, projectNoPermId] } });
    await Project.destroy({ where: { id: [projectId, projectNoPermId] } });
    await User.destroy({ where: { id: ['zitadel-sub-01', 'zitadel-sub-03', 'zitadel-sub-04'] } });
  });

  // TS-13: el preview de opus responde 302 con disposition inline.
  it('responde 302 publicando el comando con disposition inline', () => {
    fakeBus.reply(`files.${fileComment.id}.request-download`, downloadTicket());

    return request(application)
      .get(`/api/opus/attachments/${attComment.id}/preview`)
      .set('Authorization', 'Bearer token_04_external_user')
      .redirects(0)
      .expect(302)
      .then(res => {
        res.headers['location'].should.equal(DOWNLOAD_URL);
        res.headers['x-content-type-options'].should.equal('nosniff');
        (fakeBus.last as any).command.should.equal(`files.${fileComment.id}.request-download`);
        (fakeBus.last as any).payload.should.deepEqual({ disposition: 'inline' });
      });
  });

  // TS-14: un rol no habilitado → 403 sin publicar (hasAnyRole se mantiene).
  it('responde 403 sin publicar cuando el rol no está habilitado', () => {
    return request(application)
      .get(`/api/opus/attachments/${attComment.id}/preview`)
      .set('Authorization', 'Bearer token_03_admin')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // CA-4: sin permiso de proyecto → 403 sin publicar (canUserViewEntity se mantiene).
  it('responde 403 sin publicar cuando el external-user no tiene permiso sobre el proyecto', () => {
    return request(application)
      .get(`/api/opus/attachments/${attNoPerm.id}/preview`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
        fakeBus.sent.length.should.equal(0);
      });
  });

  it('responde 404 sin publicar cuando el vínculo no existe', () => {
    return request(application)
      .get('/api/opus/attachments/999999/preview')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
        fakeBus.sent.length.should.equal(0);
      });
  });

  it('responde 401 sin publicar cuando no hay token', () => {
    return request(application)
      .get(`/api/opus/attachments/${attComment.id}/preview`)
      .expect(401)
      .then(() => {
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-10 (variante opus): bus caído → 503.
  it('responde 503 cuando el bus no responde', () => {
    fakeBus.failWith(new Error('timeout'));

    return request(application)
      .get(`/api/opus/attachments/${attComment.id}/preview`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(503)
      .then(res => {
        res.body.code.should.equal('service_unavailable');
      });
  });
});

/**
 * El endpoint público es el único exento de autenticación de todo el producto, y su bloque
 * de validación de `visibilityLevel` por `entityType` es lo único que lo protege: los ids
 * son secuenciales y el endpoint es enumerable. Cada rama se prueba en su caso `public` y
 * en su caso `internal`, más el `else` final que deniega por default.
 */
describe('GET /api/opus/attachments/:id/public (S-095, S-005)', () => {
  let application: Application;

  const publicProjectId = 6400;
  const collisionId = 9600;

  let filePub: File;
  let attReqCommentPublic: Attachment;
  let attReqCommentInternal: Attachment;
  let attObjCommentPublic: Attachment;
  let attObjCommentInternal: Attachment;
  let attLegacyCommentPublic: Attachment;
  let attLegacyCommentInternal: Attachment;
  let attObjectivePublic: Attachment;
  let attObjectiveInternal: Attachment;
  let attRequirementPublic: Attachment;
  let attRequirementInternal: Attachment;
  let attUncoveredType: Attachment;

  before(async function () {
    this.timeout(30000);
    application = start();

    await User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01pub', email: 'user01pub@mail.com' } as any);
    await Project.create({
      id: publicProjectId, code: 'PUB1', name: 'Public Preview Project', type: 'comercial',
      status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01',
    } as any);

    const reqPublic = await Requirement.create({
      id: publicProjectId, title: 'Requisito publico', description: 'Desc',
      priority: 'sin_prioridad', state: 'analisis', projectId: publicProjectId,
      createdBy: 'zitadel-sub-01', visibilityLevel: 'public',
    } as any);
    const reqInternal = await Requirement.create({
      id: publicProjectId + 1, title: 'Requisito interno', description: 'Desc',
      priority: 'sin_prioridad', state: 'analisis', projectId: publicProjectId,
      createdBy: 'zitadel-sub-01', visibilityLevel: 'internal',
    } as any);
    const objPublic = await Objective.create({
      id: publicProjectId, title: 'Objetivo publico', state: 'activo', area: 'desarrollo',
      priority: 1, projectId: publicProjectId, createdBy: 'zitadel-sub-01', visibilityLevel: 'public',
    } as any);
    const objInternal = await Objective.create({
      id: publicProjectId + 1, title: 'Objetivo interno', state: 'activo', area: 'desarrollo',
      priority: 1, projectId: publicProjectId, createdBy: 'zitadel-sub-01', visibilityLevel: 'internal',
    } as any);

    // Colisión deliberada de id entre RequirementActivity y ObjectiveActivity, con
    // visibilidades distintas: es lo que prueba que cada rama consulta la tabla correcta.
    const reqActPublic = await RequirementActivity.create({
      id: collisionId, typeOfActivity: 'comment', previousValue: '', newValue: 'Comentario publico de requisito',
      visibilityLevel: 'public', requirementId: reqPublic.id, changedBy: 'zitadel-sub-01',
    } as any);
    const objActInternal = await ObjectiveActivity.create({
      id: collisionId, typeOfActivity: 'comment', previousValue: '', newValue: 'Comentario interno de objetivo',
      visibilityLevel: 'internal', objectiveId: objPublic.id, changedBy: 'zitadel-sub-01',
    } as any);
    const reqActInternal = await RequirementActivity.create({
      id: collisionId + 1, typeOfActivity: 'comment', previousValue: '', newValue: 'Comentario interno de requisito',
      visibilityLevel: 'internal', requirementId: reqPublic.id, changedBy: 'zitadel-sub-01',
    } as any);
    const objActPublic = await ObjectiveActivity.create({
      id: collisionId + 2, typeOfActivity: 'comment', previousValue: '', newValue: 'Comentario publico de objetivo',
      visibilityLevel: 'public', objectiveId: objPublic.id, changedBy: 'zitadel-sub-01',
    } as any);

    filePub = await createFile();

    attReqCommentPublic = await createAttachment(filePub, { entityType: 'requirement_comment', entityId: reqActPublic.id });
    attReqCommentInternal = await createAttachment(await createFile(), { entityType: 'requirement_comment', entityId: reqActInternal.id });
    attObjCommentPublic = await createAttachment(await createFile(), { entityType: 'objective_comment', entityId: objActPublic.id });
    attObjCommentInternal = await createAttachment(await createFile(), { entityType: 'objective_comment', entityId: objActInternal.id });
    // Legado `comment`: resuelve primero contra ObjectiveActivity y cae a RequirementActivity.
    attLegacyCommentPublic = await createAttachment(await createFile(), { entityType: 'comment', entityId: objActPublic.id });
    attLegacyCommentInternal = await createAttachment(await createFile(), { entityType: 'comment', entityId: objActInternal.id });
    attObjectivePublic = await createAttachment(await createFile(), { entityType: 'objective', entityId: objPublic.id });
    attObjectiveInternal = await createAttachment(await createFile(), { entityType: 'objective', entityId: objInternal.id });
    attRequirementPublic = await createAttachment(await createFile(), { entityType: 'requirement', entityId: reqPublic.id });
    attRequirementInternal = await createAttachment(await createFile(), { entityType: 'requirement', entityId: reqInternal.id });
    // `project` no está entre los tipos contemplados → cae en el else final.
    attUncoveredType = await createAttachment(await createFile(), { entityType: 'project', entityId: publicProjectId });
  });

  after(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {}, force: true });
    await RequirementActivity.destroy({ where: {} });
    await ObjectiveActivity.destroy({ where: {} });
    await Requirement.destroy({ where: { projectId: publicProjectId } });
    await Objective.destroy({ where: { projectId: publicProjectId } });
    await Project.destroy({ where: { id: publicProjectId } });
    await User.destroy({ where: { id: 'zitadel-sub-01' } });
  });

  // TS-15: entidad public → 302 SIN sesión, con nosniff y la CSP de sandbox.
  it('responde 302 sin sesión, con nosniff y CSP de sandbox, publicando disposition attachment', () => {
    fakeBus.reply(`files.${filePub.id}.request-download`, downloadTicket());

    return request(application)
      .get(`/api/opus/attachments/${attReqCommentPublic.id}/public`)
      .redirects(0)
      .expect(302)
      .then(res => {
        res.headers['location'].should.equal(DOWNLOAD_URL);
        res.headers['x-content-type-options'].should.equal('nosniff');
        res.headers['content-security-policy'].should.containEql('sandbox');
        (fakeBus.last as any).command.should.equal(`files.${filePub.id}.request-download`);
        (fakeBus.last as any).payload.should.deepEqual({ disposition: 'attachment' });
      });
  });

  // TS-4 (S-095): la colisión de ids no confunde las ramas.
  it('resuelve requirement_comment contra RequirementActivity, no contra la ObjectiveActivity que colisiona', () => {
    fakeBus.replyDefault(downloadTicket());

    return request(application)
      .get(`/api/opus/attachments/${attReqCommentPublic.id}/public`)
      .redirects(0)
      .expect(302);
  });

  // Una rama por entityType, en su caso `public`. Son las que sostienen la seguridad del
  // único endpoint sin auth: no se pierden al reescribir.
  const publicCases: Array<[string, () => Attachment]> = [
    ['requirement_comment', () => attReqCommentPublic],
    ['objective_comment', () => attObjCommentPublic],
    ['comment (legado)', () => attLegacyCommentPublic],
    ['objective', () => attObjectivePublic],
    ['requirement', () => attRequirementPublic],
  ];

  publicCases.forEach(([label, get]) => {
    it(`responde 302 para un ${label} de entidad public`, () => {
      fakeBus.replyDefault(downloadTicket());

      return request(application)
        .get(`/api/opus/attachments/${get().id}/public`)
        .redirects(0)
        .expect(302);
    });
  });

  // TS-16: cada rama en su caso `internal` → 403 sin publicar.
  const internalCases: Array<[string, () => Attachment]> = [
    ['requirement_comment', () => attReqCommentInternal],
    ['objective_comment', () => attObjCommentInternal],
    ['comment (legado)', () => attLegacyCommentInternal],
    ['objective', () => attObjectiveInternal],
    ['requirement', () => attRequirementInternal],
  ];

  internalCases.forEach(([label, get]) => {
    it(`responde 403 sin publicar para un ${label} de entidad internal`, () => {
      return request(application)
        .get(`/api/opus/attachments/${get().id}/public`)
        .expect(403)
        .then(res => {
          res.body.code.should.equal('access_denied');
          res.body.message.should.equal('Attachment is not publicly accessible');
          fakeBus.sent.length.should.equal(0);
        });
    });
  });

  // TS-17: un entityType no contemplado cae en el else final → 403 por default (ADR-008).
  it('responde 403 por default para un entityType no contemplado', () => {
    return request(application)
      .get(`/api/opus/attachments/${attUncoveredType.id}/public`)
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-18: un archivo sin vínculo es inalcanzable por esta vía. Es ESTRUCTURAL: la vía
  // pública entra por `attachments.id` y un archivo sin vínculo no tiene fila (CA-14).
  it('responde 404 sin publicar para un id sin vínculo', () => {
    return request(application)
      .get('/api/opus/attachments/999999/public')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // La exención de autenticación de `config/public.ts` cubre solo `.../\d+/public`, así que
  // un id no numérico ni siquiera llega al handler: lo corta la autenticación global con un
  // 401. Es el deny-by-default de ADR-008 sobre la única puerta sin auth del producto, y
  // S-005 lo deja exactamente como estaba.
  it('responde 401 sin publicar cuando el id no es entero (no matchea la exención)', () => {
    return request(application)
      .get('/api/opus/attachments/abc/public')
      .expect(401)
      .then(() => {
        fakeBus.sent.length.should.equal(0);
      });
  });

  // CA-15: con core caído el link público no abre.
  it('responde 503 cuando el bus no responde', () => {
    fakeBus.failWith(new Error('timeout'));

    return request(application)
      .get(`/api/opus/attachments/${attReqCommentPublic.id}/public`)
      .expect(503)
      .then(res => {
        res.body.code.should.equal('service_unavailable');
      });
  });
});
