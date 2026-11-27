import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, File, Objective, Project, User, UserProjectPermission } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

// Tokens del mock:
// token_01_user          → sub: zitadel-sub-01, rol: user (interno: accede a toda entidad)
// token_04_external_user → sub: zitadel-sub-04, rol: external-user, con permiso SOLO en el proyecto 301

/**
 * El DELETE ya no borra nada: AUTORIZA sobre la entidad del vínculo y PUBLICA
 * `attachments.{id}.delete` (REQ-001, S-004). Era la tercera escritura implícita de la api.
 *
 * El fixture central son DOS vínculos sobre EL MISMO `File`. Es lo que hace verificables los
 * tres criterios que dan sentido a la story: que el archivo se retiene, que el otro vínculo
 * sobrevive y que el vínculo borrado deja de dar acceso.
 */
describe('DELETE /api/attachments/:id', () => {
  let application: Application;
  let sharedFile: File;
  let link1: Attachment;
  let link2: Attachment;
  let linkRestricted: Attachment;

  async function createFile(overrides: Record<string, any> = {}): Promise<File> {
    return File.create({
      fileName: 'compartido.pdf',
      fileSize: 1024,
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

  // Las columnas viejas de `attachments` siguen siendo `allowNull: false` en el modelo
  // compartido (la migración 20260819_05 las dropeó de la base, pero `sync()` las recrea en el
  // esquema de tests), así que hay que poblarlas aunque el código ya no las lea.
  async function createLink(file: File, overrides: Record<string, any> = {}): Promise<Attachment> {
    return Attachment.create({
      entityType: 'objective',
      entityId: 301,
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

  before(async function() {
    this.timeout(30000);
    application = start();

    await User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'u01del', email: 'u01del@mail.com' } as any);
    await User.create({ id: 'zitadel-sub-04', name: 'External', username: 'e04del', email: 'e04del@mail.com' } as any);

    // Proyecto 301: el external-user tiene permiso. Proyecto 302: no.
    await Project.create({
      id: 301, code: 'DEL1', name: 'Del Project 1', type: 'comercial',
      status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
    } as any);
    await Project.create({
      id: 302, code: 'DEL2', name: 'Del Project 2', type: 'comercial',
      status: 'activo', priority: 2, initDate: new Date(), createdBy: 'zitadel-sub-01'
    } as any);
    await Objective.create({
      id: 301, title: 'Del Objective 1', state: 'activo', area: 'desarrollo',
      priority: 1, projectId: 301, createdBy: 'zitadel-sub-01'
    } as any);
    await Objective.create({
      id: 302, title: 'Del Objective 2', state: 'activo', area: 'desarrollo',
      priority: 2, projectId: 302, createdBy: 'zitadel-sub-01'
    } as any);

    await UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: 301 } as any);
  });

  beforeEach(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {}, force: true });

    // UN archivo, DOS vínculos.
    sharedFile = await createFile();
    link1 = await createLink(sharedFile);
    link2 = await createLink(sharedFile);

    // Un vínculo sobre una entidad del proyecto 302, donde el external-user NO tiene permiso.
    const restrictedFile = await createFile();
    linkRestricted = await createLink(restrictedFile, { entityId: 302 });
  });

  after(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {}, force: true });
    await UserProjectPermission.destroy({ where: {} });
    await Objective.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  // TS-27 (CA-8, CA-9): publica el comando con el id DEL VÍNCULO.
  it('devuelve 200 y publica attachments.{id}.delete con el id del vínculo', () => {
    fakeBus.reply(`attachments.${link1.id}.delete`, { status: 'success' });

    return request(application)
      .delete(`/api/attachments/${link1.id}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.code.should.equal('attachment_unlinked');
        res.body.should.have.property('message');
        fakeBus.sent.length.should.equal(1);
        (fakeBus.last as any).command.should.equal(`attachments.${link1.id}.delete`);
        (fakeBus.last as any).payload.should.deepEqual({
          actor: { id: 'zitadel-sub-01', roles: ['user'] },
        });
      });
  });

  // TS-28 (CA-9): EL TEST MÁS IMPORTANTE DE LA TAREA, y la prueba DIRECTA de que la api no
  // escribe. Con `replyDefault` core NO ejecuta el borrado, así que si la fila desapareciera
  // habría sido la api quien la borró.
  it('no borra la fila por su cuenta: con core mockeado el vínculo sigue existiendo', async () => {
    fakeBus.replyDefault({ status: 'success' });

    await request(application)
      .delete(`/api/attachments/${link1.id}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200);

    // `scope('active')` y no `findByPk` a secas: un `softDelete()` de la api dejaría la fila
    // presente pero fuera del scope, y este test tiene que detectar TAMBIÉN esa variante.
    const stillThere = await Attachment.scope('active').findByPk(link1.id);
    (stillThere !== null).should.be.true();
  });

  // TS-29 (CA-8, CA-9): no toca `files` ni el bucket. La api ya no importa ningún cliente de
  // storage, así que lo verificable desde acá es que el archivo se conserva intacto.
  it('no toca la fila de files ni su estado de retención', async () => {
    await request(application)
      .delete(`/api/attachments/${link1.id}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200);

    const file = await File.findByPk(sharedFile.id);
    (file !== null).should.be.true();
    (file as any).retentionStatus.should.equal('active');
  });

  // TS-30 (CA-8): con la ejecución REAL del comando de core, el otro vínculo sobrevive. Es lo
  // que D-04 protege: con 0..N vínculos, borrar el objeto rompería los demás.
  it('deja intacto el otro vínculo del mismo archivo', async () => {
    await request(application)
      .delete(`/api/attachments/${link1.id}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200);

    // El comando de core lo ejecutó el FakeBus de verdad: la fila 1 se fue.
    ((await Attachment.findByPk(link1.id)) === null).should.be.true();
    ((await Attachment.findByPk(link2.id)) !== null).should.be.true();

    await request(application)
      .get(`/api/attachments/${link2.id}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.fileId.should.equal(sharedFile.id);
      });
  });

  // TS-31 (CA-10): el vínculo eliminado deja de dar acceso, AUNQUE el archivo siga existiendo
  // por el otro vínculo.
  it('deja de dar acceso por el vínculo eliminado aunque el archivo siga existiendo', async () => {
    await request(application)
      .delete(`/api/attachments/${link1.id}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200);

    await request(application)
      .get(`/api/attachments/${link1.id}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
      });

    // El archivo sigue vivo: lo sostiene el otro vínculo.
    ((await File.findByPk(sharedFile.id)) !== null).should.be.true();
  });

  // TS-32 (CA-9): AUTORIZA ANTES DE PUBLICAR. El `commands.length === 0` es la mitad que
  // importa: sin él, un handler que publique primero y autorice después pasaría igual.
  it('devuelve 403 sin publicar cuando el usuario no tiene permiso sobre la entidad', () => {
    return request(application)
      .delete(`/api/attachments/${linkRestricted.id}`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-33: vínculo inexistente, resuelto antes de publicar.
  it('devuelve 404 sin publicar cuando el vínculo no existe', () => {
    return request(application)
      .delete('/api/attachments/999999')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-34: id no numérico.
  it('devuelve 400 invalid_id sin publicar cuando el id no es numérico', () => {
    return request(application)
      .delete('/api/attachments/abc')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_id');
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-35: sin token.
  it('devuelve 401 sin token y no publica', () => {
    return request(application)
      .delete(`/api/attachments/${link1.id}`)
      .expect(401)
      .then(() => {
        fakeBus.sent.length.should.equal(0);
      });
  });

  // TS-36 (CA-7): el `invalid_fields` de core sale 400, no 500.
  it('traduce invalid_fields de core a 400', () => {
    fakeBus.reply(`attachments.${link1.id}.delete`, {
      status: 'failure',
      errorCode: 'invalid_fields',
      errorMessage: 'El vínculo no existe',
    });

    return request(application)
      .delete(`/api/attachments/${link1.id}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_fields');
      });
  });

  // TS-37 (S-014/CA-10): timeout del bus → 504 `gateway_timeout`. El desvínculo PUDO haber
  // ocurrido: sin JetStream no hay acuse, así que reintentar a ciegas no es inocuo.
  it('devuelve 504 cuando la respuesta del bus no llega a tiempo', () => {
    fakeBus.failWithTimeout();

    return request(application)
      .delete(`/api/attachments/${link1.id}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(504)
      .then(res => {
        res.body.code.should.equal('gateway_timeout');
      });
  });
});
