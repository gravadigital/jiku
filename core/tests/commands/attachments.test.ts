import 'mocha';
import 'should';
import sinon from 'sinon';
import {
  Attachment,
  ByteStatus,
  File,
  Project,
  Requirement,
  RetentionStatus,
  User,
} from '@jiku/models';
import { ErrorCode } from '@jiku/nats-protocol';
import logger from '../../src/logger';
import { dispatch } from '../helpers/dispatch';
import { S3Double, installS3Double, uninstallS3Double } from '../helpers/s3-double';

const UPLOADER_A = 'zitadel-user-a';

/**
 * `dispatch()` usa `'api'` por default, que NO coincide con `CORE_TRUSTED_PUBLISHER_ID` de
 * `.env.test` — es deliberado en este codebase. Este comando no resuelve actor, así que los dos
 * callers tienen que dar exactamente el mismo resultado; TS-15 es el que lo prueba.
 */
const EXTERNAL = 'servicio-externo-sub';

describe('attachments', () => {
  let s3: S3Double;
  let p1: Project;
  let r1: Requirement;

  before(async () => {
    // `files.uploaded_by` es FK a `users.id`: el actor tiene que existir antes que el archivo.
    await User.bulkCreate([
      { id: UPLOADER_A, name: 'Usuario A', username: 'usuario-a-att', email: 'a-att@test.local' },
      { id: EXTERNAL, name: 'Externo', username: 'externo-att', email: 'externo-att@test.local' },
    ]);
    p1 = await Project.create({
      name: 'Proyecto Adjuntos', code: 'ATT', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: UPLOADER_A,
    });
    r1 = await Requirement.create({
      title: 'Requisito con adjuntos', description: 'x', projectId: p1.id,
      createdBy: UPLOADER_A,
    });
  });

  beforeEach(() => {
    s3 = installS3Double();
  });

  afterEach(async () => {
    sinon.restore();
    uninstallS3Double();
    // `force: true` obligatorio: el hook `@BeforeDestroy` del modelo lanza sin él.
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {} });
  });

  after(async () => {
    await Requirement.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  /** Un `File` válido y vivo, con el byte ya subido. */
  async function makeFile(overrides: Record<string, unknown> = {}): Promise<File> {
    return File.create({
      fileName: 'informe.pdf',
      fileSize: 4194304,
      mimeType: 'application/pdf',
      storageKey: `grava-gestion/f/${Math.random().toString(36).slice(2)}.pdf`,
      storageBucket: 'test-bucket',
      storageRegion: 'us-east-1',
      uploadedBy: UPLOADER_A,
      byteStatus: ByteStatus.Uploaded,
      retentionStatus: RetentionStatus.Active,
      ...overrides,
    });
  }

  /**
   * Un vínculo. Copia las siete columnas del `File` porque el modelo `Attachment` todavía las
   * declara NOT NULL: la migración 20260819_05 ya las dropeó en producción, pero el esquema de
   * los tests lo construye `sequelize.sync()` desde el modelo (ADR-013). Es la misma razón que
   * el bloque transitorio de `link-files.ts` documenta, y desaparece con él en S-005.
   */
  async function makeLink(file: File, entityType: string, entityId: number): Promise<Attachment> {
    return Attachment.create({
      entityType,
      entityId,
      fileId: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      storageKey: file.storageKey,
      storageBucket: file.storageBucket,
      storageRegion: file.storageRegion,
      uploadedBy: file.uploadedBy,
    });
  }

  describe('attachments.{id}.delete', () => {
    // TS-1
    it('borra el vínculo y responde success sin data', async () => {
      const fA = await makeFile();
      const a1 = await makeLink(fA, 'requirement', r1.id);

      const reply = await dispatch(`attachments.${a1.id}.delete`, {});

      reply.status.should.equal('success');
      (reply.data === undefined).should.be.true();
      ((await Attachment.findByPk(a1.id)) === null).should.be.true();
      (await Attachment.count()).should.equal(0);
    });

    // TS-2
    it('el File sobrevive intacto al borrado del vínculo', async () => {
      const fA = await makeFile({ storageKey: 'grava-gestion/f/aaaa.pdf' });
      const a1 = await makeLink(fA, 'requirement', r1.id);

      const reply = await dispatch(`attachments.${a1.id}.delete`, {});
      reply.status.should.equal('success');

      const after = await File.findByPk(fA.id);
      (after === null).should.be.false();
      after!.retentionStatus.should.equal(RetentionStatus.Active);
      after!.byteStatus.should.equal(ByteStatus.Uploaded);
      after!.storageKey.should.equal('grava-gestion/f/aaaa.pdf');
      (after!.deletedAt === null).should.be.true();
      (after!.deletedBy === null).should.be.true();
    });

    // TS-3
    it('con dos vínculos sobre el mismo archivo, solo cae el pedido', async () => {
      const fA = await makeFile();
      const a1 = await makeLink(fA, 'requirement', r1.id);
      const a2 = await makeLink(fA, 'project', p1.id);

      const reply = await dispatch(`attachments.${a1.id}.delete`, {});
      reply.status.should.equal('success');

      ((await Attachment.findByPk(a1.id)) === null).should.be.true();
      const survivor = await Attachment.findByPk(a2.id);
      (survivor === null).should.be.false();
      survivor!.entityType.should.equal('project');
      survivor!.entityId!.should.equal(p1.id);
      survivor!.fileId!.should.equal(fA.id);
      (await Attachment.count({ where: { fileId: fA.id } })).should.equal(1);
    });

    // TS-4
    it('el borrado es duro: la fila no queda marcada con deletedAt', async () => {
      const fA = await makeFile();
      const a1 = await makeLink(fA, 'requirement', r1.id);

      const reply = await dispatch(`attachments.${a1.id}.delete`, {});
      reply.status.should.equal('success');

      // `paranoid: false` para que el test no pueda pasar con un soft delete disfrazado.
      ((await Attachment.findByPk(a1.id, { paranoid: false })) === null).should.be.true();
      (await Attachment.count({ where: {} })).should.equal(0);
    });

    // TS-5
    it('falla con invalid_fields si el vínculo no existe', async () => {
      const reply = await dispatch('attachments.999999.delete', {});

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      reply.errorMessage!.should.not.match(/999999/);
      reply.errorMessage!.should.equal('El vínculo no existe');
    });

    // TS-6
    it('el segundo borrado del mismo id falla', async () => {
      const fA = await makeFile();
      const a1 = await makeLink(fA, 'requirement', r1.id);

      const first = await dispatch(`attachments.${a1.id}.delete`, {});
      first.status.should.equal('success');

      const second = await dispatch(`attachments.${a1.id}.delete`, {});
      second.status.should.equal('failure');
      second.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);

      (await Attachment.count()).should.equal(0);
    });

    // TS-7
    it('id del subject no numérico responde invalid_fields, no internal_error', async () => {
      const reply = await dispatch('attachments.abc.delete', {});

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      reply.errorCode!.should.not.equal(ErrorCode.INTERNAL_ERROR);
    });

    // TS-8
    it('id del subject cero o negativo responde invalid_fields', async () => {
      const zero = await dispatch('attachments.0.delete', {});
      zero.status.should.equal('failure');
      zero.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      zero.errorCode!.should.not.equal(ErrorCode.INTERNAL_ERROR);

      const negative = await dispatch('attachments.-5.delete', {});
      negative.status.should.equal('failure');
      negative.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      negative.errorCode!.should.not.equal(ErrorCode.INTERNAL_ERROR);
    });

    // TS-9
    it('rechaza un payload con cualquier campo y no borra la fila', async () => {
      const fA = await makeFile();
      const a1 = await makeLink(fA, 'requirement', r1.id);

      const reply = await dispatch(`attachments.${a1.id}.delete`, { deletedBy: UPLOADER_A });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      ((await Attachment.findByPk(a1.id)) === null).should.be.false();
    });

    // TS-10
    it('payload ausente y payload vacío se normalizan igual', async () => {
      const fA = await makeFile();
      const a1 = await makeLink(fA, 'requirement', r1.id);
      const a2 = await makeLink(fA, 'project', p1.id);

      const withoutPayload = await dispatch(`attachments.${a1.id}.delete`, undefined);
      withoutPayload.status.should.equal('success');

      const withEmptyPayload = await dispatch(`attachments.${a2.id}.delete`, {});
      withEmptyPayload.status.should.equal('success');

      (await Attachment.count()).should.equal(0);
    });

    // TS-11
    it('un fallo no deja escritura parcial', async () => {
      const fA = await makeFile();
      await makeLink(fA, 'requirement', r1.id);

      const reply = await dispatch(`attachments.${(await Attachment.findOne())!.id}.delete`, {
        foo: 'bar',
      });

      reply.status.should.equal('failure');
      (await Attachment.count()).should.equal(1);
      (await File.count()).should.equal(1);
    });

    // TS-12
    it('el comando está registrado con el pattern del contrato', async () => {
      const reply = await dispatch('attachments.1.delete', {});

      // Si el registry no resolviera el pattern, el código sería `unknown_command`.
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      reply.errorCode!.should.not.equal(ErrorCode.UNKNOWN_COMMAND);
    });

    // TS-13
    it('un vínculo de otra entidad y otro archivo no se ve afectado', async () => {
      const fA = await makeFile();
      const fB = await makeFile();
      const a1 = await makeLink(fA, 'requirement', r1.id);
      const a3 = await makeLink(fB, 'project', p1.id);

      const reply = await dispatch(`attachments.${a1.id}.delete`, {});
      reply.status.should.equal('success');

      ((await Attachment.findByPk(a3.id)) === null).should.be.false();
      (await File.count()).should.equal(2);
    });

    // TS-14
    it('no toca el firmador de S3', async () => {
      const fA = await makeFile();
      const a1 = await makeLink(fA, 'requirement', r1.id);

      const reply = await dispatch(`attachments.${a1.id}.delete`, {});
      reply.status.should.equal('success');

      s3.calls.length.should.equal(0);
      s3.callsOf('PutObject').length.should.equal(0);
      s3.callsOf('GetObject').length.should.equal(0);
      s3.sendCount.should.equal(0);
    });

    // TS-15
    it('un publicador externo obtiene el mismo comportamiento', async () => {
      const fA = await makeFile();
      const a1 = await makeLink(fA, 'requirement', r1.id);

      // El `warn` es lo que distingue este escenario de TS-1: si alguien cableara
      // `resolveActor` en el comando, la rama del publicador externo lo emitiría. Este comando
      // NO resuelve actor a propósito —la titularidad de la desvinculación es una regla de la
      // api, sobre la ENTIDAD del vínculo—, así que el log tiene que quedar mudo.
      const warn = sinon.spy(logger, 'warn');

      const reply = await dispatch(`attachments.${a1.id}.delete`, {}, EXTERNAL);

      reply.status.should.equal('success');
      (reply.data === undefined).should.be.true();
      ((await Attachment.findByPk(a1.id)) === null).should.be.true();
      warn.called.should.be.false();
    });
  });
});
