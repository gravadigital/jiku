import path from 'path';
import joi from 'joi';
import { File, ByteStatus, RetentionStatus } from '@jiku/models';
import { Reply, success, failure, ErrorCode } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { readFileSettings } from './settings';
import { resolveActor } from '../resolve-actor';
import { buildStorageKey, getStorageSigner } from './storage';

const COMPONENT = 'files.request-upload';

export interface FilesRequestUploadPayload {
  uploader?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum?: string | null;
}

const schema = joi.object({
  // `uploader` VA `.optional()` AUNQUE EL YAML LO DECLARE EN `required`, y no es una
  // discrepancia con el contrato: el `required` del YAML describe el canal de la api, que
  // siempre lo manda. El canal del bus directo (RF-11) lo OMITE a propósito, porque un
  // publicador externo no tiene una persona detrás y su identidad es la del subject.
  //
  // Si acá dijera `.required()`, ese canal sería imposible y CA-9 no se podría cumplir. NO LO
  // "ARREGLES" comparando el código con el YAML: la resolución correcta la fija
  // `resolveActor`, no el esquema.
  uploader: joi.string().optional(),
  fileName: joi.string().max(255).required(),
  mimeType: joi.string().max(100).required(),
  fileSize: joi.number().integer().min(1).required(),
  // El contrato lo declara `type: [string, 'null']`. Ausente y `null` tienen que dar los dos
  // `checksum === null` en la fila; el modelo lo declara `allowNull: true`.
  checksum: joi.string().allow(null).optional(),
});

export const filesRequestUpload: Command<
  FilesRequestUploadPayload,
  { id: number; uploadUrl: string; expiresIn: number }
> = {
  pattern: 'files.request-upload',

  validate(payload: unknown) {
    return validateWith<FilesRequestUploadPayload>(schema, payload);
  },

  async execute(
    payload,
    ctx: CommandContext
  ): Promise<Reply<{ id: number; uploadUrl: string; expiresIn: number }>> {
    // La política se lee POR COMANDO, sin caché: CA-6 exige que un cambio por SQL aplique en
    // el comando siguiente. Va dentro de la transacción que abrió el despachador.
    const settings = await readFileSettings(ctx.transaction);

    // LAS TRES VALIDACIONES VAN ANTES DEL INSERT. El rollback del despachador las cubriría
    // igual (ADR-003), pero validar tarde consume un id de la secuencia por cada rechazo y
    // ninguna de las tres necesita el id.

    // El límite es INCLUSIVO: un archivo de exactamente el máximo se acepta.
    if (payload.fileSize > settings.maxSizeBytes) {
      // El mensaje NO nombra el límite vigente: es configurable en caliente y un mensaje con
      // el número se desactualiza en cuanto el operador lo cambia.
      return failure(ErrorCode.FILE_TOO_LARGE, 'El archivo supera el tamaño máximo permitido');
    }

    // LA DOBLE LISTA BLANCA: extensión Y MIME, no una sola (RF-17, D-18). Un `.exe` renombrado
    // a `.pdf` se rechaza porque el MIME declarado no coincide. Lo que se valida es lo
    // DECLARADO, y eso nunca fue una garantía sobre el byte real (D-25).
    const extension = path.extname(payload.fileName).toLowerCase();
    const allowedExtensions = settings.allowedExtensions.map((item) => item.toLowerCase());
    if (!allowedExtensions.includes(extension)) {
      return failure(ErrorCode.FILE_TYPE_NOT_ALLOWED, 'Tipo de archivo no permitido');
    }

    // La comparación de MIME es EXACTA, no por prefijo: `image/png` no habilita
    // `image/png-evil`.
    if (!settings.allowedMimeTypes.includes(payload.mimeType)) {
      return failure(ErrorCode.FILE_TYPE_NOT_ALLOWED, 'Tipo de archivo no permitido');
    }

    const actor = resolveActor(ctx, payload.uploader, COMPONENT);
    if (!actor) {
      // Solo llega acá si publicó la api sin `uploader`, que el contrato prohíbe. Responder
      // `invalid_fields` es mucho más legible que dejar que el INSERT falle por NOT NULL y el
      // despachador lo traduzca a un `internal_error` opaco.
      return failure(ErrorCode.INVALID_FIELDS, 'Falta el uploader del archivo');
    }

    const signer = getStorageSigner();
    const storageKey = buildStorageKey(payload.fileName, signer.keyPrefix);

    const file = await File.create(
      {
        fileName: payload.fileName,
        fileSize: payload.fileSize,
        mimeType: payload.mimeType,
        storageKey,
        storageBucket: signer.bucket,
        storageRegion: signer.region,
        checksum: payload.checksum ?? null,
        // EL BYTE NO SE VERIFICA Y ES DELIBERADO (D-13): un `headObject` acá sería una llamada
        // de red dentro de la transacción del despachador, y arriesgaría el timeout de 5 s de
        // ADR-002. La fila nace declarando que el byte todavía no llegó; la falla aparece al
        // descargar, como `file_not_available`, en vez de como una fila corrupta.
        byteStatus: ByteStatus.Pending,
        uploadedBy: actor,
        retentionStatus: RetentionStatus.Active,
      },
      { transaction: ctx.transaction }
    );

    // Firma LOCAL, sin red. Si lanzara, el despachador hace rollback y no queda fila.
    const uploadUrl = await signer.signUpload(
      storageKey,
      payload.mimeType,
      settings.uploadUrlTtlSeconds
    );

    // EXCEPCIÓN DECLARADA A ADR-002 ("las creaciones devuelven solo el id"), documentada en
    // `ReplyWithUploadTicket` de `docs/apis/core.yaml`. No hay alternativa: la URL la genera
    // `core`, es de un solo uso y de vida corta, y la api no puede reconstruirla releyendo la
    // base sin duplicar la política de la clave y montar su propio firmador de escritura —
    // que es justo lo que D-08 centraliza. Es una excepción, no un patrón nuevo: NO agregues
    // una cuarta clave.
    return success({ id: file.id, uploadUrl, expiresIn: settings.uploadUrlTtlSeconds });
  },
};

export default filesRequestUpload;
