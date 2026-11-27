import { Request, Response, Router } from 'express';
import joi from 'joi';
import validateBodyFields from '../utils/validate-body-fields';
import { sendCommand, actorId } from '../utils/bus/send-command';
import { UploadTicketReply, toUploadTicket } from '../utils/bus/upload-ticket';

const router: Router = Router();

/**
 * El MISMO esquema que el endpoint interno, campo por campo. La convención `validation` manda
 * el esquema junto a la ruta y solo habilita compartirlo cuando dos rutas usan literalmente el
 * mismo — que es este caso —; se duplica igual porque son cuatro líneas y este servicio es
 * fuertemente "todo junto en el archivo de la ruta". LO QUE NO PUEDE PASAR ES QUE DIVERJAN: si
 * uno cambia, el otro cambia en el mismo commit.
 *
 * Sin `.unknown(true)`: un cuerpo con `entityType` cae en 400 `invalid_fields`.
 */
const uploadTicketSchema = joi.object({
  fileName: joi.string().max(255).required(),
  mimeType: joi.string().max(100).required(),
  fileSize: joi.number().integer().min(1).required(),
  checksum: joi.string().allow(null).optional(),
})
  // `.required()` SOBRE EL OBJETO, y es lo que hace que un `multipart/form-data` salga 400 y no
  // 500: `express.json()` no parsea multipart, así que `req.body` llega `undefined`, y un
  // esquema de objeto sin `.required()` da POR VÁLIDO el `undefined` —Joi valida la forma de un
  // valor que no existe—. Sin esto la cadena seguiría hasta el handler y el destructuring
  // reventaría con un TypeError. Es CA-3 verificado desde afuera (TS-11).
  .required();

/**
 * El portal pide permiso de subida. Idéntico al endpoint interno en cuerpo y respuesta
 * (REQ-001, S-004).
 *
 * LO QUE ESTE ARCHIVO PERDIÓ, Y POR QUÉ: toda la validación de entidad propia del portal
 * —`ALLOWED_OPUS_ENTITY_TYPES`, `validateEntityType`, `validateUploadPermissions`,
 * `conditionalValidateObjective`, `conditionalValidateProjectPermissions`—, unas 140 líneas
 * cuya única razón de existir era resolver el proyecto a partir del `entityType` que este
 * endpoint YA NO RECIBE (D-12). Mantenerlas significaría validar permisos sobre una entidad
 * que el cuerpo no declara. Con ellas se fue el código `invalid_entity_type`.
 *
 * ⚠ LA CADENA QUEDA CON DOS CAPAS Y NO TRES, Y ES CORRECTO. La convención `authorization` dice
 * que todo endpoint de `/api/opus/*` lleva las tres capas (rol, forma, permiso por entidad).
 * Acá la tercera NO TIENE SOBRE QUÉ OPERAR: no hay entidad en el cuerpo. El control se corre
 * al momento de vincular, donde la entidad existe (CA-5, D-12). Sin este comentario la próxima
 * revisión lo va a leer como un permiso que se olvidaron de migrar.
 */
async function requestUpload(req: Request, res: Response) {
  const { fileName, mimeType, fileSize, checksum } = req.body;

  const data = await sendCommand<UploadTicketReply>(res, 'files.request-upload', {
    // Del token, nunca del cuerpo: es lo que hace que el `external-user` pueda vincular
    // después lo que subió.
    uploader: actorId(req),
    fileName,
    mimeType,
    fileSize,
    ...(checksum !== undefined ? { checksum } : {}),
  });
  if (!data) return;

  return res.status(201).json(toUploadTicket(data));
}

router.post('/opus/attachments',
  // Desde S-034 (CA-5): ya no valida rol acá. `x-roles: [user, external-user]` sigue declarado
  // en el spec como documentación de qué rol autoriza `core` (CA-8) — no es más lo que esta
  // ruta verifica.
  validateBodyFields(uploadTicketSchema),
  requestUpload
);

export default router;
