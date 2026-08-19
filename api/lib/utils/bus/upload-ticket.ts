/**
 * El `data` del reply de `files.request-upload` (core, S-002).
 *
 * `id` es el id de `files` — el ARCHIVO, no el vínculo. El vínculo todavía no existe: subir
 * ya no menciona la entidad (D-12), y el `Attachment` se crea recién al guardar la entidad
 * con `fileIds` (S-003).
 */
export interface UploadTicketReply {
  id: number;
  uploadUrl: string;
  expiresIn: number;
}

/**
 * El `UploadTicket` del contrato HTTP (`docs/apis/api.yaml`).
 *
 * `uploadUrl` es una prefirmada de **PUT**, de un solo objeto y TTL corto (D-10): el
 * navegador la usa directo contra el storage. Ni la api ni el bus ven el byte.
 */
export interface UploadTicket {
  fileId: number;
  uploadUrl: string;
  expiresIn: number;
}

/**
 * `id` en el bus, `fileId` en HTTP. NO ES UN DESCUIDO NI ALGO A "UNIFICAR": en el bus `id` es
 * la convención de todas las creaciones, y en HTTP `fileId` dice DE QUÉ id se trata, que acá
 * importa porque el contrato HTTP de adjuntos maneja DOS espacios de ids —el del vínculo
 * (`/attachments/{id}`) y el del archivo (`fileId`, el que viaja en `fileIds` al guardar la
 * entidad)—. Confundirlos es el error que este nombre existe para prevenir.
 *
 * Vive en `lib/utils/bus/` y no en el handler porque la convención `bus-commands` reserva esta
 * carpeta para las traducciones de contrato, y porque LOS DOS endpoints de subida (el interno
 * y el de opus) la comparten: duplicarla garantizaría que diverjan.
 */
export function toUploadTicket(data: UploadTicketReply): UploadTicket {
  return {
    fileId: data.id,
    uploadUrl: data.uploadUrl,
    expiresIn: data.expiresIn,
  };
}
