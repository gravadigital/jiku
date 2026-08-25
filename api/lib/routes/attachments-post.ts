import { Request, Response, Router } from 'express';
import joi from 'joi';
import validateBodyFields from '../utils/validate-body-fields';
import { sendCommand, actorId } from '../utils/bus/send-command';
import { UploadTicketReply, toUploadTicket } from '../utils/bus/upload-ticket';

const router: Router = Router();

/**
 * El cuerpo de la solicitud de permiso de subida. SIN `.unknown(true)` a propósito: Joi
 * rechaza claves desconocidas por default, y eso es lo que hace que un cuerpo con
 * `entityType` / `entityId` / `description` / `files` —los cuatro campos que el contrato
 * eliminó— salga 400 en vez de aceptarse en silencio (D-12).
 *
 * LO QUE ESTE ESQUEMA NO VALIDA, Y NO ES UN OLVIDO: ni la extensión, ni el MIME, ni el tamaño
 * máximo. La política vive en `system_settings` y la aplica `core` EN CALIENTE (D-08). Un
 * duplicado acá se desactualizaría en cuanto un operador ajuste una fila por SQL, y la api
 * empezaría a rechazar archivos que la política ya permite.
 */
const uploadTicketSchema = joi.object({
  fileName: joi.string().max(255).required(),
  mimeType: joi.string().max(100).required(),
  fileSize: joi.number().integer().min(1).required(),
  // `null` explícito y ausente son DOS COSAS DISTINTAS acá: ver el spread condicional abajo.
  checksum: joi.string().allow(null).optional(),
})
  // `.required()` SOBRE EL OBJETO, y es lo que hace que un `multipart/form-data` salga 400 y no
  // 500: `express.json()` no parsea multipart, así que `req.body` llega `undefined`, y un
  // esquema de objeto sin `.required()` da POR VÁLIDO el `undefined` —Joi valida la forma de un
  // valor que no existe—. Sin esto la cadena seguiría hasta el handler y el destructuring
  // reventaría con un TypeError. Es CA-3 verificado desde afuera (TS-11).
  .required();

/**
 * Pide permiso de subida. NO RECIBE EL BINARIO Y NO ESCRIBE LA BASE (REQ-001, S-004).
 *
 * Con este handler desaparece `Attachment.create()` del módulo de adjuntos y SE CIERRA LA
 * EXCEPCIÓN 2 DE ADR-001: la api vuelve a ser solo lectura sobre la base.
 *
 * TAMBIÉN DESAPARECE `multer`. El proceso dejaba de tener un pico de 10 MB × 10 archivos en
 * memoria por subida: el byte ahora va del navegador directo al storage con la prefirmada que
 * firma core, sin pasar por la api ni por el bus (D-09).
 *
 * AUTORIZACIÓN: SOLO EL JWT, y es deliberado. `canUserAccessEntity` no tiene sobre qué operar
 * —el cuerpo ya no declara entidad (D-12)— y el control por entidad se corre al momento de
 * vincular, donde la entidad sí existe. Lo que un usuario gana con esto es poder crear un
 * `File` sin vínculo, que es exactamente RF-1; su costo es acumulación de basura, no acceso
 * indebido.
 *
 * UN ARCHIVO POR REQUEST (D-07). Tres archivos son tres requests independientes: el fallo de
 * uno no arrastra a los otros dos, que es justo lo que el lote multipart no podía dar.
 */
async function requestUpload(req: Request, res: Response) {
  const { fileName, mimeType, fileSize, checksum } = req.body;

  const data = await sendCommand<UploadTicketReply>(res, 'files.request-upload', {
    // `uploader` SALE DEL TOKEN, NUNCA DEL CUERPO. Si se omitiera, `resolveActor` de core
    // caería en la rama del canal externo, `uploaded_by` quedaría siendo el service user de la
    // api y NINGÚN usuario podría vincular después lo que subió — con `file_not_owned` como
    // único síntoma, muy lejos de su causa.
    uploader: actorId(req),
    fileName,
    mimeType,
    fileSize,
    // Spread condicional: ausente en el cuerpo ⇒ ausente en el payload. Poner la clave con
    // `undefined` la haría viajar como `null` al serializar, que es un valor distinto.
    ...(checksum !== undefined ? { checksum } : {}),
  });
  if (!data) return;

  // NO SE RELEE LA BASE, y es una EXCEPCIÓN DECLARADA a la regla de ADR-001, no un descuido.
  // La regla existe porque core devuelve solo `{ id }` y el contrato con los frontends es el
  // recurso completo; acá el dato que falta es la URL prefirmada, que NO ESTÁ EN LA BASE y no
  // es reconstruible desde afuera de core. Releer no la produciría: solo sumaría una query.
  // Está registrada en `docs/apis/core.yaml` (`ReplyWithUploadTicket`).
  return res.status(201).json(toUploadTicket(data));
}

router.post('/attachments', validateBodyFields(uploadTicketSchema), requestUpload);

export default router;
