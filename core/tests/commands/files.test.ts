import 'mocha';
import 'should';
import sinon from 'sinon';
import { File, SystemSetting, User, ByteStatus, RetentionStatus } from '@jiku/models';
import { ErrorCode } from '@jiku/nats-protocol';
import logger from '../../src/logger';
import { registry } from '../../src/commands';
import { loadConfig, resetConfig } from '../../src/config';
import {
  DEFAULT_ALLOWED_EXTENSIONS,
  DEFAULT_ALLOWED_MIME_TYPES,
  SETTING_KEYS,
} from '../../src/commands/files/settings';
import { dispatch } from '../helpers/dispatch';
import { S3Double, installS3Double, uninstallS3Double } from '../helpers/s3-double';

/**
 * `CORE_TRUSTED_PUBLISHER_ID` de `.env.test`. Es el `caller` que ejercita la rama de la api;
 * el default de `dispatch()` (`'api'`) NO coincide con él a propósito, así que la rama
 * confiable siempre se pide explícitamente.
 */
const TRUSTED = 'api-service-user-sub';
const EXTERNAL = 'servicio-externo-sub';

const UPLOADER_A = 'zitadel-user-a';

interface UploadTicket {
  id: number;
  uploadUrl: string;
  expiresIn: number;
}

interface DownloadTicket {
  downloadUrl: string;
  expiresIn: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/** Payload de subida válido, con los campos que cada test quiera pisar. */
function uploadPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uploader: UPLOADER_A,
    fileName: 'informe.pdf',
    mimeType: 'application/pdf',
    fileSize: 4194304,
    ...overrides,
  };
}

/** Las cinco claves con sus valores sembrados, para restaurar después de cada test. */
const SEEDED_SETTINGS: [string, string][] = [
  [SETTING_KEYS.uploadUrlTtlSeconds, '300'],
  [SETTING_KEYS.downloadUrlTtlSeconds, '300'],
  [SETTING_KEYS.maxSizeBytes, '10485760'],
  [SETTING_KEYS.allowedExtensions, DEFAULT_ALLOWED_EXTENSIONS.join(',')],
  [SETTING_KEYS.allowedMimeTypes, DEFAULT_ALLOWED_MIME_TYPES.join(',')],
];

/**
 * Resiembra las cinco claves. Los tests de configuración son los más frágiles de la suite: un
 * `destroy` sin restaurar rompe todo lo que viene después.
 */
async function reseedSettings(): Promise<void> {
  await SystemSetting.destroy({ where: {} });
  for (const [key, value] of SEEDED_SETTINGS) {
    await SystemSetting.create({ key, value });
  }
}

async function setSetting(key: string, value: string): Promise<void> {
  await SystemSetting.destroy({ where: { key } });
  await SystemSetting.create({ key, value });
}

describe('files', () => {
  let s3: S3Double;

  before(async () => {
    // `files.uploaded_by` es FK a `users.id`: los actores tienen que existir.
    await User.bulkCreate([
      { id: UPLOADER_A, name: 'Usuario A', username: 'usuario-a', email: 'a@test.local' },
      { id: EXTERNAL, name: 'Externo', username: 'externo', email: 'externo@test.local' },
      { id: TRUSTED, name: 'Api', username: 'api-su', email: 'api@test.local' },
    ]);
  });

  after(async () => {
    await File.destroy({ where: {} });
    await User.destroy({ where: {} });
    await SystemSetting.destroy({ where: {} });
  });

  beforeEach(async () => {
    s3 = installS3Double();
    await reseedSettings();
  });

  afterEach(async () => {
    sinon.restore();
    uninstallS3Double();
    await File.destroy({ where: {} });
  });

  describe('registro de los comandos', () => {
    it('TS-59: los dos comandos están registrados y el de descarga extrae el fileId', () => {
      const upload = registry.resolve('files.request-upload');
      (upload === null).should.be.false();
      upload!.command.pattern.should.equal('files.request-upload');

      const download = registry.resolve('files.1234.request-download');
      (download === null).should.be.false();
      download!.command.pattern.should.equal('files.{fileId}.request-download');
      download!.params.fileId.should.equal('1234');
    });

    it('TS-60: el pattern de descarga no colisiona con el de subida', () => {
      const upload = registry.resolve('files.request-upload');
      upload!.command.pattern.should.equal('files.request-upload');
      Object.keys(upload!.params).should.have.length(0);
    });

    it('TS-50: los cinco códigos de error nuevos existen en el catálogo', () => {
      ErrorCode.FILE_TYPE_NOT_ALLOWED.should.equal('file_type_not_allowed');
      ErrorCode.FILE_TOO_LARGE.should.equal('file_too_large');
      ErrorCode.FILE_NOT_OWNED.should.equal('file_not_owned');
      ErrorCode.FILE_NOT_FOUND.should.equal('file_not_found');
      ErrorCode.FILE_NOT_AVAILABLE.should.equal('file_not_available');
    });
  });

  describe('files.request-upload', () => {
    it('TS-1: devuelve el ticket completo, con esas tres claves y solo esas', async () => {
      const reply = await dispatch<UploadTicket>('files.request-upload', uploadPayload(), TRUSTED);

      reply.status.should.equal('success');
      reply.data!.id.should.be.a.Number();
      reply.data!.uploadUrl.should.be.a.String();
      reply.data!.expiresIn.should.equal(300);
      Object.keys(reply.data!).sort().should.eql(['expiresIn', 'id', 'uploadUrl']);
    });

    it('TS-2: la fila de files queda con el byte sin verificar', async () => {
      const reply = await dispatch<UploadTicket>('files.request-upload', uploadPayload(), TRUSTED);

      const file = await File.findByPk(reply.data!.id);
      file!.byteStatus.should.equal('pending');
      file!.retentionStatus.should.equal('active');
      file!.fileName.should.equal('informe.pdf');
      file!.mimeType.should.equal('application/pdf');
      file!.fileSize.should.equal(4194304);
      file!.uploadedBy.should.equal(UPLOADER_A);
      file!.storageBucket.should.not.be.empty();
      file!.storageRegion.should.not.be.empty();
    });

    it('TS-3: la uploadUrl firma un PutObject sobre la storage_key de esa fila', async () => {
      const reply = await dispatch<UploadTicket>('files.request-upload', uploadPayload(), TRUSTED);
      const file = await File.findByPk(reply.data!.id);

      s3.callsOf('PutObject').should.have.length(1);
      s3.callsOf('GetObject').should.have.length(0);
      s3.calls[0].key.should.equal(file!.storageKey);
      s3.calls[0].expiresIn.should.equal(300);
    });

    it('TS-4: la clave tiene la forma {prefix}/f/{uuid}{ext} y conserva la extensión', async () => {
      const reply = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        TRUSTED
      );

      const file = await File.findByPk(reply.data!.id);
      file!.storageKey.should.match(/^grava-gestion\/f\/[0-9a-f-]{36}\.pdf$/);
    });

    it('TS-5: la clave no lleva entityType ni entityId', async () => {
      const reply = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        TRUSTED
      );

      const file = await File.findByPk(reply.data!.id);
      for (const fragment of ['requirement', 'objective', 'project', 'draft', '/comment']) {
        file!.storageKey.should.not.containEql(fragment);
      }
    });

    it('TS-6: quien sube no elige dónde se guarda — un fileName con path se neutraliza', async () => {
      const reply = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileName: '../../etc/passwd.pdf', fileSize: 1024 }),
        TRUSTED
      );

      // Las dos salidas son aceptables; lo que NO se acepta es que el path llegue a la clave.
      if (reply.status === 'success') {
        const file = await File.findByPk(reply.data!.id);
        file!.storageKey.should.match(/^grava-gestion\/f\/[0-9a-f-]{36}\.pdf$/);
        file!.storageKey.should.not.containEql('..');
        file!.storageKey.should.not.containEql('/etc/');
        file!.fileName.should.equal('../../etc/passwd.pdf');
      } else {
        reply.errorCode!.should.equal('invalid_fields');
      }
    });

    it('TS-7: dos pedidos del mismo archivo dan dos claves y dos filas distintas', async () => {
      const first = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        TRUSTED
      );
      const second = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        TRUSTED
      );

      first.status.should.equal('success');
      second.status.should.equal('success');
      first.data!.id.should.not.equal(second.data!.id);

      const fileA = await File.findByPk(first.data!.id);
      const fileB = await File.findByPk(second.data!.id);
      fileA!.storageKey.should.not.equal(fileB!.storageKey);
    });

    it('TS-8: rechaza una extensión fuera de la allowlist', async () => {
      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ fileName: 'malware.exe', fileSize: 1024 }),
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('file_type_not_allowed');
    });

    it('TS-9: el rechazo por extensión no deja fila', async () => {
      const before = await File.count();
      await dispatch(
        'files.request-upload',
        uploadPayload({ fileName: 'malware.exe', fileSize: 1024 }),
        TRUSTED
      );

      (await File.count()).should.equal(before);
    });

    it('TS-10: rechaza por MIME aunque la extensión esté permitida — las dos listas', async () => {
      const before = await File.count();
      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ mimeType: 'application/x-msdownload', fileSize: 1024 }),
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('file_type_not_allowed');
      (await File.count()).should.equal(before);
    });

    it('TS-11: rechaza por MIME cuando el .exe viene renombrado a .pdf', async () => {
      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ mimeType: 'application/octet-stream', fileSize: 1024 }),
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('file_type_not_allowed');
    });

    it('TS-12: la comparación de extensión es case-insensitive', async () => {
      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ fileName: 'FOTO.PNG', mimeType: 'image/png', fileSize: 1024 }),
        TRUSTED
      );

      reply.status.should.equal('success');
    });

    it('TS-13: rechaza por tamaño contra el valor vigente', async () => {
      await setSetting(SETTING_KEYS.maxSizeBytes, '1024');
      const before = await File.count();

      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ fileSize: 2048 }),
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('file_too_large');
      (await File.count()).should.equal(before);
    });

    it('TS-14: el límite es inclusivo — fileSize igual al máximo se acepta', async () => {
      await setSetting(SETTING_KEYS.maxSizeBytes, '1024');

      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        TRUSTED
      );

      reply.status.should.equal('success');
    });

    it('TS-15: la configuración se lee en caliente, sin reinicio ni caché', async () => {
      await setSetting(SETTING_KEYS.maxSizeBytes, '1024');

      const rejected = await dispatch(
        'files.request-upload',
        uploadPayload({ fileSize: 2048 }),
        TRUSTED
      );
      rejected.errorCode!.should.equal('file_too_large');

      // Sin reiniciar NADA, se cambia el valor y se repite el mismo dispatch.
      await SystemSetting.update(
        { value: '10485760' },
        { where: { key: SETTING_KEYS.maxSizeBytes } }
      );

      const accepted = await dispatch(
        'files.request-upload',
        uploadPayload({ fileSize: 2048 }),
        TRUSTED
      );
      accepted.status.should.equal('success');
    });

    it('TS-16: el TTL de subida también se lee en caliente', async () => {
      await setSetting(SETTING_KEYS.uploadUrlTtlSeconds, '900');

      const reply = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        TRUSTED
      );

      reply.data!.expiresIn.should.equal(900);
      s3.callsOf('PutObject')[0].expiresIn.should.equal(900);
    });

    it('TS-17: sin fila de file-max-size-bytes, cae al default de código', async () => {
      await SystemSetting.destroy({ where: { key: SETTING_KEYS.maxSizeBytes } });

      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ fileSize: 10485761 }),
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('file_too_large');
    });

    it('TS-18: sin ninguna de las cinco claves, el comando funciona igual', async () => {
      await SystemSetting.destroy({ where: {} });

      const reply = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        TRUSTED
      );

      reply.status.should.equal('success');
      reply.data!.id.should.be.a.Number();
      reply.data!.uploadUrl.should.be.a.String();
      reply.data!.expiresIn.should.equal(300);
    });

    it('TS-19: sin file-allowed-extensions, el default sigue rechazando lo no permitido', async () => {
      await SystemSetting.destroy({ where: { key: SETTING_KEYS.allowedExtensions } });

      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ fileName: 'malware.exe', fileSize: 1024 }),
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('file_type_not_allowed');
    });

    it('TS-20: un valor de configuración corrupto no tumba el comando', async () => {
      await setSetting(SETTING_KEYS.maxSizeBytes, 'no-es-un-numero');

      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        TRUSTED
      );

      // Cae al default de código; NO responde internal_error, que sería el síntoma de un NaN
      // propagándose a la comparación.
      reply.status.should.equal('success');
    });

    it('TS-21: la lista completa de MIME entra en system_settings.value sin truncar', async () => {
      const full = DEFAULT_ALLOWED_MIME_TYPES.join(',');
      full.length.should.be.above(255);

      await setSetting(SETTING_KEYS.allowedMimeTypes, full);

      const row = await SystemSetting.findOne({
        where: { key: SETTING_KEYS.allowedMimeTypes },
      });
      row!.value.length.should.equal(full.length);

      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({
          fileName: 'hoja.xlsx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileSize: 1024,
        }),
        TRUSTED
      );
      reply.status.should.equal('success');
    });

    it('TS-22: resolveActor rama api — toma el uploader del cuerpo', async () => {
      const reply = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        TRUSTED
      );

      const file = await File.findByPk(reply.data!.id);
      file!.uploadedBy.should.equal(UPLOADER_A);
      file!.uploadedBy.should.not.equal(TRUSTED);
    });

    it('TS-23: resolveActor rama externa — usa el caller del subject', async () => {
      const reply = await dispatch<UploadTicket>(
        'files.request-upload',
        { fileName: 'informe.pdf', mimeType: 'application/pdf', fileSize: 1024 },
        EXTERNAL
      );

      reply.status.should.equal('success');
      const file = await File.findByPk(reply.data!.id);
      file!.uploadedBy.should.equal(EXTERNAL);
    });

    it('TS-24: resolveActor rama externa — ignora el uploader declarado', async () => {
      const reply = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        EXTERNAL
      );

      const file = await File.findByPk(reply.data!.id);
      file!.uploadedBy.should.equal(EXTERNAL);
      file!.uploadedBy.should.not.equal(UPLOADER_A);
    });

    it('TS-25: el canal externo puede omitir uploader sin que Joi lo rechace', async () => {
      const reply = await dispatch(
        'files.request-upload',
        { fileName: 'informe.pdf', mimeType: 'application/pdf', fileSize: 1024 },
        EXTERNAL
      );

      reply.status.should.equal('success');
    });

    it('TS-26: la rama externa emite un log warn', async () => {
      const warn = sinon.spy(logger, 'warn');

      await dispatch(
        'files.request-upload',
        { fileName: 'informe.pdf', mimeType: 'application/pdf', fileSize: 1024 },
        EXTERNAL
      );

      warn.callCount.should.equal(1);
      const message = String(warn.firstCall.args[0]);
      message.should.containEql('[files.request-upload]');
      message.should.containEql(EXTERNAL);
    });

    it('TS-27: la rama de la api no emite ese warn', async () => {
      const warn = sinon.spy(logger, 'warn');

      await dispatch('files.request-upload', uploadPayload({ fileSize: 1024 }), TRUSTED);

      warn.called.should.be.false();
    });

    it('TS-28: el arranque falla sin CORE_TRUSTED_PUBLISHER_ID', () => {
      const original = process.env.CORE_TRUSTED_PUBLISHER_ID;
      delete process.env.CORE_TRUSTED_PUBLISHER_ID;

      try {
        loadConfig.should.throw(/CORE_TRUSTED_PUBLISHER_ID/);
      } finally {
        process.env.CORE_TRUSTED_PUBLISHER_ID = original;
        resetConfig();
        loadConfig();
      }
    });

    it('TS-29: el arranque falla con CORE_TRUSTED_PUBLISHER_ID vacío', () => {
      const original = process.env.CORE_TRUSTED_PUBLISHER_ID;
      process.env.CORE_TRUSTED_PUBLISHER_ID = '';

      try {
        loadConfig.should.throw(/CORE_TRUSTED_PUBLISHER_ID/);
      } finally {
        process.env.CORE_TRUSTED_PUBLISHER_ID = original;
        resetConfig();
        loadConfig();
      }
    });

    it('TS-47: la firma de subida no hace red — send() nunca se invoca', async () => {
      const reply = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        TRUSTED
      );

      reply.status.should.equal('success');
      reply.data!.uploadUrl.should.be.a.String();
      s3.sendCount.should.equal(0);
    });

    it('TS-51: falta un campo requerido', async () => {
      const before = await File.count();
      const reply = await dispatch(
        'files.request-upload',
        { uploader: UPLOADER_A, mimeType: 'application/pdf', fileSize: 1024 },
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
      (await File.count()).should.equal(before);
    });

    it('TS-52: rechaza un campo desconocido — entityType desapareció del contrato', async () => {
      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ fileName: 'a.pdf', fileSize: 1024, entityType: 'requirement' }),
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('TS-53: fileSize cero se rechaza por forma', async () => {
      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ fileName: 'a.pdf', fileSize: 0 }),
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('TS-54: un fileName de más de 255 se rechaza por forma', async () => {
      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ fileName: `${'a'.repeat(300)}.pdf`, fileSize: 1024 }),
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('TS-55: el checksum se guarda tal cual y nadie lo verifica', async () => {
      const reply = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileName: 'a.pdf', fileSize: 1024, checksum: 'deadbeef' }),
        TRUSTED
      );

      reply.status.should.equal('success');
      const file = await File.findByPk(reply.data!.id);
      file!.checksum!.should.equal('deadbeef');
      s3.sendCount.should.equal(0);
    });

    it('TS-56: checksum null es válido', async () => {
      const reply = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileName: 'a.pdf', fileSize: 1024, checksum: null }),
        TRUSTED
      );

      reply.status.should.equal('success');
      const file = await File.findByPk(reply.data!.id);
      (file!.checksum === null).should.be.true();
    });

    it('TS-57: checksum ausente es válido', async () => {
      const reply = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileName: 'a.pdf', fileSize: 1024 }),
        TRUSTED
      );

      reply.status.should.equal('success');
      const file = await File.findByPk(reply.data!.id);
      (file!.checksum === null).should.be.true();
    });

    it('TS-58: si la firma falla, no queda fila — rollback del despachador', async () => {
      const before = await File.count();
      s3.failWith = new Error('firma rota');

      const reply = await dispatch(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('internal_error');
      (await File.count()).should.equal(before);
    });
  });

  describe('files.{fileId}.request-download', () => {
    let uploadedId: number;
    let pendingId: number;
    let deletedId: number;
    let scheduledId: number;

    /** Los fixtures se crean con el modelo directamente: así se construyen estados que el
     * comando de subida no produce, y estos tests no dependen del otro comando. */
    beforeEach(async () => {
      const uploaded = await File.create({
        fileName: 'informe.pdf',
        fileSize: 4194304,
        mimeType: 'application/pdf',
        storageKey: 'grava-gestion/f/11111111-1111-1111-1111-111111111111.pdf',
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        byteStatus: ByteStatus.Uploaded,
        uploadedBy: UPLOADER_A,
        retentionStatus: RetentionStatus.Active,
      });
      uploadedId = uploaded.id;

      const pending = await File.create({
        fileName: 'pendiente.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageKey: 'grava-gestion/f/22222222-2222-2222-2222-222222222222.pdf',
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        byteStatus: ByteStatus.Pending,
        uploadedBy: UPLOADER_A,
        retentionStatus: RetentionStatus.Active,
      });
      pendingId = pending.id;

      const deleted = await File.create({
        fileName: 'borrado.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageKey: 'grava-gestion/f/33333333-3333-3333-3333-333333333333.pdf',
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        byteStatus: ByteStatus.Uploaded,
        uploadedBy: UPLOADER_A,
        retentionStatus: RetentionStatus.Deleted,
      });
      deletedId = deleted.id;

      const scheduled = await File.create({
        fileName: 'programado.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageKey: 'grava-gestion/f/44444444-4444-4444-4444-444444444444.pdf',
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        byteStatus: ByteStatus.Uploaded,
        uploadedBy: UPLOADER_A,
        retentionStatus: RetentionStatus.ScheduledForDeletion,
      });
      scheduledId = scheduled.id;

      // El doble acumula las firmas del fixture-setup si algo firmara: se limpia para que los
      // asserts de "cero llamadas" midan solo el dispatch del test.
      s3.reset();
    });

    it('TS-30: camino feliz — URL más los tres metadatos, las cinco claves', async () => {
      const reply = await dispatch<DownloadTicket>(
        `files.${uploadedId}.request-download`,
        { disposition: 'inline' },
        TRUSTED
      );

      reply.status.should.equal('success');
      reply.data!.downloadUrl.should.be.a.String();
      reply.data!.expiresIn.should.equal(300);
      reply.data!.fileName.should.equal('informe.pdf');
      reply.data!.mimeType.should.equal('application/pdf');
      reply.data!.fileSize.should.equal(4194304);
      Object.keys(reply.data!).sort().should.eql([
        'downloadUrl', 'expiresIn', 'fileName', 'fileSize', 'mimeType',
      ]);
    });

    it('TS-31: la downloadUrl firma un GetObject sobre la storage_key del archivo', async () => {
      await dispatch(`files.${uploadedId}.request-download`, {}, TRUSTED);

      s3.callsOf('GetObject').should.have.length(1);
      s3.callsOf('PutObject').should.have.length(0);
      s3.calls[0].key.should.equal(
        'grava-gestion/f/11111111-1111-1111-1111-111111111111.pdf'
      );
    });

    it('TS-32: disposition attachment viaja firmado con el nombre original', async () => {
      await dispatch(
        `files.${uploadedId}.request-download`,
        { disposition: 'attachment' },
        TRUSTED
      );

      const header = s3.callsOf('GetObject')[0].responseContentDisposition!;
      header.startsWith('attachment').should.be.true();
      header.should.containEql('informe.pdf');
    });

    it('TS-33: disposition ausente cae a inline por el default del esquema', async () => {
      const reply = await dispatch(`files.${uploadedId}.request-download`, {}, TRUSTED);

      reply.status.should.equal('success');
      const header = s3.callsOf('GetObject')[0].responseContentDisposition!;
      header.startsWith('inline').should.be.true();
    });

    it('TS-34: disposition fuera del enum se rechaza', async () => {
      const reply = await dispatch(
        `files.${uploadedId}.request-download`,
        { disposition: 'popup' },
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('TS-35: un fileName con comillas no rompe el header firmado', async () => {
      const quoted = await File.create({
        fileName: 'in"forme.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageKey: 'grava-gestion/f/55555555-5555-5555-5555-555555555555.pdf',
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        byteStatus: ByteStatus.Uploaded,
        uploadedBy: UPLOADER_A,
        retentionStatus: RetentionStatus.Active,
      });

      const reply = await dispatch(
        `files.${quoted.id}.request-download`,
        { disposition: 'attachment' },
        TRUSTED
      );

      reply.status.should.equal('success');
      const header = s3.callsOf('GetObject')[0].responseContentDisposition!;
      // La comilla del nombre viaja escapada, así que el `filename="..."` queda balanceado.
      header.should.containEql('in\\"forme.pdf');
      const unescapedQuotes = (header.match(/(^|[^\\])"/g) || []).length;
      unescapedQuotes.should.equal(2);
    });

    it('TS-36: byte ausente da file_not_available, sin tocar S3', async () => {
      const reply = await dispatch(`files.${pendingId}.request-download`, {}, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('file_not_available');
      s3.calls.should.have.length(0);
      s3.sendCount.should.equal(0);
    });

    it('TS-37: un fileId inexistente da file_not_found', async () => {
      const reply = await dispatch('files.999999.request-download', {}, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('file_not_found');
      s3.calls.should.have.length(0);
    });

    it('TS-38: retention_status deleted da file_not_found', async () => {
      const reply = await dispatch(`files.${deletedId}.request-download`, {}, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('file_not_found');
    });

    it('TS-39: retention_status scheduled_for_deletion da file_not_found — solo active firma', async () => {
      const reply = await dispatch(`files.${scheduledId}.request-download`, {}, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('file_not_found');
    });

    it('TS-40: un fileId no numérico no rompe el comando — nunca internal_error', async () => {
      const reply = await dispatch('files.abc.request-download', {}, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.not.equal('internal_error');
      ['file_not_found', 'invalid_fields'].should.containEql(reply.errorCode!);
    });

    it('TS-41: firma aunque el archivo sea de otro usuario — la titularidad NO aplica a la lectura (RF-12 habla de vincular)', async () => {
      // El fixture lo subió `zitadel-user-a` y el payload no lleva ningún campo de requester:
      // un requisito con adjuntos de varias personas tiene que ser legible por todo el equipo.
      const reply = await dispatch<DownloadTicket>(
        `files.${uploadedId}.request-download`,
        {},
        TRUSTED
      );

      reply.status.should.equal('success');
      reply.data!.downloadUrl.should.be.a.String();
    });

    it('TS-42: la descarga por el canal externo también firma', async () => {
      const reply = await dispatch(`files.${uploadedId}.request-download`, {}, EXTERNAL);

      reply.status.should.equal('success');
    });

    it('TS-43: un campo requester de más se rechaza — el payload no lo declara', async () => {
      const reply = await dispatch(
        `files.${uploadedId}.request-download`,
        { requester: 'zitadel-user-b' },
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('TS-44: el TTL de descarga sale de la configuración', async () => {
      await setSetting(SETTING_KEYS.downloadUrlTtlSeconds, '60');

      const reply = await dispatch<DownloadTicket>(
        `files.${uploadedId}.request-download`,
        {},
        TRUSTED
      );

      reply.data!.expiresIn.should.equal(60);
      s3.callsOf('GetObject')[0].expiresIn.should.equal(60);
    });

    it('TS-45: sin download-url-ttl-seconds, cae al default de código', async () => {
      await SystemSetting.destroy({ where: { key: SETTING_KEYS.downloadUrlTtlSeconds } });

      const reply = await dispatch<DownloadTicket>(
        `files.${uploadedId}.request-download`,
        {},
        TRUSTED
      );

      reply.data!.expiresIn.should.equal(300);
    });

    it('TS-46: los dos TTL son independientes', async () => {
      await setSetting(SETTING_KEYS.uploadUrlTtlSeconds, '900');
      await setSetting(SETTING_KEYS.downloadUrlTtlSeconds, '60');

      const upload = await dispatch<UploadTicket>(
        'files.request-upload',
        uploadPayload({ fileSize: 1024 }),
        TRUSTED
      );
      const download = await dispatch<DownloadTicket>(
        `files.${uploadedId}.request-download`,
        {},
        TRUSTED
      );

      upload.data!.expiresIn.should.equal(900);
      download.data!.expiresIn.should.equal(60);
    });

    it('TS-48: la firma de descarga no hace red', async () => {
      const reply = await dispatch<DownloadTicket>(
        `files.${uploadedId}.request-download`,
        {},
        TRUSTED
      );

      reply.status.should.equal('success');
      reply.data!.downloadUrl.should.be.a.String();
      s3.sendCount.should.equal(0);
    });

    it('la URL prefirmada NUNCA llega al log, ni siquiera bajo LOG_COMMANDS', async () => {
      // Riesgo 7 del plan: una prefirmada da acceso al contenido sin ninguna credencial
      // durante todo su TTL, así que no puede quedar en un archivo de log. `LOG_COMMANDS` es
      // una traza de diagnóstico, no una excepción a esa regla.
      const original = process.env.LOG_COMMANDS;
      process.env.LOG_COMMANDS = 'true';
      const info = sinon.spy(logger, 'info');

      try {
        const download = await dispatch<DownloadTicket>(
          `files.${uploadedId}.request-download`,
          {},
          TRUSTED
        );
        const upload = await dispatch<UploadTicket>(
          'files.request-upload',
          uploadPayload({ fileSize: 1024 }),
          TRUSTED
        );

        // Las URLs sí viajan en el reply: lo que se redacta es el log, no la respuesta.
        download.data!.downloadUrl.should.be.a.String();
        upload.data!.uploadUrl.should.be.a.String();

        const logged = info.getCalls().map((call) => String(call.args[0])).join('\n');
        logged.should.containEql('[cmd]');
        logged.should.containEql('[redacted]');
        logged.should.not.containEql(download.data!.downloadUrl);
        logged.should.not.containEql(upload.data!.uploadUrl);
        logged.should.not.containEql('X-Amz-Expires');
      } finally {
        if (original === undefined) {
          delete process.env.LOG_COMMANDS;
        } else {
          process.env.LOG_COMMANDS = original;
        }
      }
    });

    it('TS-49: ningún comando de files llama a headObject — el byte no se verifica (D-13)', async () => {
      await dispatch('files.request-upload', uploadPayload({ fileSize: 1024 }), TRUSTED);
      await dispatch(`files.${uploadedId}.request-download`, {}, TRUSTED);

      // El doble solo conoce PutObject y GetObject: cualquier otra operación habría tenido que
      // pasar por `send()`, que cuenta y lanza.
      s3.sendCount.should.equal(0);
      s3.calls.every((call) =>
        call.operation === 'PutObject' || call.operation === 'GetObject'
      ).should.be.true();
    });
  });
});
