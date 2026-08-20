import joi from 'joi';
import { File, RetentionStatus } from '@jiku/models';
import { Reply, success, failure, ErrorCode } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { readFileSettings } from './settings';
import { Disposition, getStorageSigner } from './storage';

export interface FilesRequestDownloadPayload {
  disposition: Disposition;
}

const schema = joi.object({
  // El default va en el ESQUEMA, no en el `execute` (convención `validation`).
  disposition: joi.string().valid('inline', 'attachment').default('inline'),
});

interface DownloadTicket {
  downloadUrl: string;
  expiresIn: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export const filesRequestDownload: Command<FilesRequestDownloadPayload, DownloadTicket> = {
  pattern: 'files.{fileId}.request-download',

  validate(payload: unknown) {
    return validateWith<FilesRequestDownloadPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<DownloadTicket>> {
    // `ctx.params.fileId` llega SIEMPRE como string: el registry extrae segmentos del subject.
    // Se valida que sea entero ANTES de consultar porque un valor no numérico haría que
    // PostgreSQL lance por tipo inválido en vez de devolver `null`, y el despachador lo
    // traduciría a `internal_error` — que es justo lo que este comando no debe responder ante
    // un id mal formado.
    const fileId = Number(ctx.params.fileId);
    if (!Number.isInteger(fileId) || fileId <= 0) {
      return failure(ErrorCode.FILE_NOT_FOUND, 'Archivo no encontrado');
    }

    const file = await File.findByPk(fileId, { transaction: ctx.transaction });

    // EL ORDEN IMPORTA Y ES EL DEL FLUJO: existencia y retención primero, byte después. Al
    // revés, un archivo borrado con el byte pendiente daría el código equivocado.
    //
    // Los tres estados no-activos por igual: SOLO `active` se firma.
    if (!file || file.retentionStatus !== RetentionStatus.Active) {
      return failure(ErrorCode.FILE_NOT_FOUND, 'Archivo no encontrado');
    }

    // NO SE VERIFICA `byte_status`, Y ES UNA DECISIÓN TOMADA (2026-08-20), no un olvido.
    //
    // El REQ-001 pedía responder `file_not_available` cuando el byte estuviera `pending`
    // (CA-15, RF-21, D-15). Era irrealizable junto con RF-1 / CA-7: `pending` significaba dos
    // cosas a la vez —"el byte nunca llegó" y "todavía no se vinculó"— porque el `uploaded` lo
    // escribe `link-files.ts` AL GUARDAR la entidad. Un archivo recién subido y aún sin
    // vincular quedaba imprevisualizable POR CONSTRUCCIÓN, y previsualizar antes de guardar es
    // exactamente lo que RF-1 / CA-7 declaran válido y los dos frontends ejercen.
    //
    // LO QUE SE RESIGNA: un archivo cuyo PUT falló en silencio ya no da un 404 entendible. Se
    // firma la URL, el navegador sigue la redirección y S3 responde un `NoSuchKey` opaco. El
    // byte sigue sin verificarse al subir (D-13), así que ese caso existe; simplemente vuelve a
    // manifestarse como antes del REQ, al final de la redirección.
    //
    // Si algún día se quiere recuperar el 404, la vía NO es reponer este `if` —volvería a
    // romper el preview— sino distinguir los dos significados de `pending`: confirmar el PUT al
    // subir, o firmar igual cuando el actor resuelto sea el `uploaded_by` del archivo.

    // ESTE COMANDO NO VALIDA TITULARIDAD, y es correcto: un archivo se lee por el permiso
    // sobre la entidad del vínculo, no por quién lo subió. RF-12 habla de VINCULAR, no de
    // leer, y un requisito con adjuntos de varias personas tiene que ser legible por todo el
    // equipo. Confundir las dos reglas rompería el producto.
    //
    // Tampoco valida el permiso sobre la entidad: eso es de la api, que ya autorizó antes de
    // publicar. `core` es dueño DEL STORAGE; la api es dueña DE LA AUTORIZACIÓN.

    const settings = await readFileSettings(ctx.transaction);

    // La `storage_key` se pasa OPACA al firmador. Nadie parsea su formato: no hay rama, ni
    // `if`, ni fallback entre archivos migrados y nuevos.
    const downloadUrl = await getStorageSigner().signDownload(
      file.storageKey,
      file.fileName,
      payload.disposition,
      settings.downloadUrlTtlSeconds
    );

    // Este comando NO ESCRIBE NADA. El `UPDATE byte_status = 'uploaded'` es de S-003, al
    // vincular.
    //
    // Los tres metadatos van en el reply A PROPÓSITO: la api los necesita para armar los
    // headers de su respuesta (o del 302) sin volver a consultar la base, y el HEAD al preview
    // que los frontends ya usan sigue funcionando. No los saques por parecer redundantes.
    return success({
      downloadUrl,
      expiresIn: settings.downloadUrlTtlSeconds,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
    });
  },
};

export default filesRequestDownload;
