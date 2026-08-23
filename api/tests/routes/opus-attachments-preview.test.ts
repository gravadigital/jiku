import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import {
  Attachment, File, Objective, ObjectiveActivity, Project, Requirement,
  User, UserProjectPermission
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

  // TS-10 (variante opus, S-014/CA-10): no hay ningún suscriptor → 503 `service_unavailable`,
  // con la señal explícita de `no responders`. El timeout es el otro caso y sale 504.
  it('responde 503 cuando no hay ningún suscriptor del subject', () => {
    fakeBus.failWithNoResponders();

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
 * `GET /api/opus/attachments/:id/public` — ELIMINADO por REQ-002 / S-009.
 *
 * Este bloque reemplaza al que probaba que el endpoint servía el archivo sin sesión. Los
 * mismos casos, invertidos: ahora prueban que la vía anónima NO existe. Es lo que convierte
 * el borrado en algo verificable e impide que alguien reponga el endpoint sin que nada falle.
 *
 * Las dos razones por las que la respuesta cambia, y que son distintas entre sí:
 *  - SIN TOKEN es 401 y ocurre ANTES DEL ROUTER: `config/public.ts` quedó con las cuatro
 *    listas vacías, así que `publicPaths('get')` matchea todo path y `validateToken` —que
 *    `app.ts:29-32` instala arriba del montaje de rutas— corta sin tocar la base. De ahí que
 *    un id inexistente dé 401 y no 404: el endpoint deja de ser un oráculo de qué ids existen.
 *  - CON TOKEN VÁLIDO es 404 porque la ruta ya no está montada.
 *
 * En ninguno de los siete casos se publica un comando en el bus: RF-5 —"ninguna petición sin
 * autenticar puede originar un `files.{fileId}.request-download`"— se afirma caso por caso.
 */
describe('GET /api/opus/attachments/:id/public — ELIMINADO (S-009)', () => {
  let application: Application;

  const publicProjectId = 6400;

  let attPub: Attachment;      // vínculo a un requisito `public`: el ÚNICO caso que el endpoint autorizaba
  let attInt: Attachment;      // vínculo a un requisito `internal`: el caso que antes daba 403
  let fileOrphan: File;        // archivo SIN vínculo en `attachments`

  before(async function () {
    this.timeout(30000);
    application = start();

    // Los dos usuarios del token tienen que existir en `users`: un token válido cuyo `sub` no
    // está en la tabla recibe 401 `user_not_found` y nunca llegaría al 404 que TS-6/TS-7 afirman.
    await User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01pub', email: 'user01pub@mail.com' } as any);
    await User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'ext04pub', email: 'ext04pub@mail.com' } as any);

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

    attPub = await createAttachment(await createFile(), { entityType: 'requirement', entityId: reqPublic.id });
    attInt = await createAttachment(await createFile(), { entityType: 'requirement', entityId: reqInternal.id });
    fileOrphan = await createFile();

    // Las fixtures son muchas menos que las del bloque que este reemplaza: no hace falta
    // reponer la colisión de ids entre RequirementActivity y ObjectiveActivity, porque probaba
    // la resolución de visibilidad por `entityType` y esa lógica se fue con el handler.
  });

  after(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {}, force: true });
    await Requirement.destroy({ where: { projectId: publicProjectId } });
    await Project.destroy({ where: { id: publicProjectId } });
    await User.destroy({ where: { id: ['zitadel-sub-01', 'zitadel-sub-04'] } });
  });

  // TS-1: el caso que el endpoint autorizaba —entidad `public`, vínculo existente— ahora es 401.
  // La visibilidad de la entidad dejó de habilitar acceso anónimo a un archivo (CA-8).
  it('responde 401 sin publicar cuando no hay token y la entidad es public', () => {
    return request(application)
      .get(`/api/opus/attachments/${attPub.id}/public`)
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        res.body.message.should.equal('Unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-2: un id de vínculo inexistente da 401 y NO 404. Es el cierre de la enumerabilidad
  // (D-19): sin token la petición no llega a la base, así que la respuesta no revela nada.
  it('responde 401 y no 404 cuando el id de vínculo no existe', () => {
    return request(application)
      .get('/api/opus/attachments/999999/public')
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-3: el caso que antes daba 403 ahora da 401, y no queda rastro del mensaje de
  // visibilidad: ya no hay validación de visibilidad porque no hay endpoint que la haga.
  // La fixture `internal` existe justamente para que este escenario sea distinguible de TS-2.
  it('responde 401 y no 403 cuando la entidad es internal', () => {
    return request(application)
      .get(`/api/opus/attachments/${attInt.id}/public`)
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        JSON.stringify(res.body).should.not.containEql('Attachment is not publicly accessible');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-4: un archivo sin ningún vínculo sigue inalcanzable, ahora por dos razones y no una:
  // no tiene fila en `attachments` Y no hay vía anónima. El 401 sale antes de consultar, así
  // que acá lo que importa es que ni siquiera se llega a comprobar la ausencia del vínculo.
  it('responde 401 cuando el id corresponde a un archivo sin vínculo', () => {
    return request(application)
      .get(`/api/opus/attachments/${fileOrphan.id}/public`)
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-5: un id no entero también da 401. Sin cambio observable respecto de antes, pero por
  // otra razón: antes lo rechazaba el `parseInt` del handler con 400, ahora corta el token.
  it('responde 401 cuando el id no es un entero', () => {
    return request(application)
      .get('/api/opus/attachments/abc/public')
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-6 y TS-7: con token válido la ruta no existe → 404.
  //
  // SE AFIRMA SOLO EL STATUS, A PROPÓSITO: el body de este 404 es HTML del `finalhandler` de
  // Express, no el JSON `{ code, message }` de los handlers. El segundo middleware final de
  // `app.ts:44` declara UN SOLO parámetro, así que Express no lo trata como error handler y lo
  // saltea cuando le llega el error del middleware anterior. Agregar
  // `res.body.code.should.equal('not_found')` rompe el test, y por una razón ajena a S-009:
  // arreglar esos dos handlers cambia los 404 de TODA la api y no es alcance de esta story.
  it('responde 404 con token válido de rol user: la ruta ya no está montada', () => {
    return request(application)
      .get(`/api/opus/attachments/${attPub.id}/public`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(() => {
        fakeBus.sent.length.should.equal(0);
      });
  });

  // El rol es irrelevante: no hay ruta que pueda autorizar, así que `external-user` —el rol
  // del portal, que sí puede usar el camino autenticado— recibe el mismo 404.
  it('responde 404 con token válido de rol external-user', () => {
    return request(application)
      .get(`/api/opus/attachments/${attPub.id}/public`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(404)
      .then(() => {
        fakeBus.sent.length.should.equal(0);
      });
  });
});
