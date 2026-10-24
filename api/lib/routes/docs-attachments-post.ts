import { Request, Response, Router } from 'express';
import joi from 'joi';
import { generateUlid } from '@jiku/nats-protocol';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { joiUlid } from '../modules/docs/ids';
import { pickDefined } from '../modules/docs/query';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateBodyFields from '../utils/validate-body-fields';

const router: Router = Router();

// `checksum` es el `Checksum` del contrato (`sha256:` + 64 hex en minúscula).
const REQUEST_UPLOAD_SCHEMA = joi.object({
  id: joiUlid(),
  documentId: joiUlid().required(),
  fileName: joi.string().required(),
  mimeType: joi.string().required(),
  fileSize: joi.number().integer().min(1).required(),
  checksum: joi.string().pattern(/^sha256:[0-9a-f]{64}$/).required(),
}).strict();

async function requestAttachmentUpload(req: Request, res: Response) {
  try {
    // DD-8: el checksum del binario solo lo puede calcular quien tiene el archivo (el navegador:
    // el byte va del navegador a S3, REQ-001), así que se manda tal cual. El ULID, si falta, es de la api.
    const data = await moduleCommand(res, 'docs', 'attachments.request-upload', {
      id: req.body.id ?? generateUlid(),
      ...pickDefined(req.body, ['documentId', 'fileName', 'mimeType', 'fileSize', 'checksum']),
    });
    if (!data) return;
    return res.status(201).json(data);
  } catch (error: any) {
    // Nunca se loguea la `uploadUrl`.
    logger.error(`POST /api/docs/attachments requestAttachmentUpload error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Request attachment upload
 * @description Pide la URL prefirmada para subir un adjunto de un documento (REQ-016, ruta 15, CA-19).
 * @route {POST} /api/docs/attachments
 * @bodyparam {string} [id] - ULID de alta; si falta lo genera la api
 * @bodyparam {string} documentId - ULID del documento
 * @bodyparam {string} fileName
 * @bodyparam {string} mimeType
 * @bodyparam {number} fileSize - Bytes
 * @bodyparam {string} checksum - `sha256:` + hex del binario, calculado por el cliente
 * @response {201} Created - `{ id, uploadUrl, expiresIn, link }`
 * @response {400} Invalid fields / attachment_type_not_allowed / attachment_too_large
 * @response {403} Access denied
 * @response {404} Document not found
 * @response {409} already_exists
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.post('/docs/attachments', requireModule('docs'), hasAnyRole(['admin', 'user']), validateBodyFields(REQUEST_UPLOAD_SCHEMA), requestAttachmentUpload);

export default router;
