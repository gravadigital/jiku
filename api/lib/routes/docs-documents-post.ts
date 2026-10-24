import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { generateUlid } from '@jiku/nats-protocol';
import { contentChecksum } from '../modules/docs/checksum';
import { joiUlid } from '../modules/docs/ids';
import { pickDefined } from '../modules/docs/query';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateBodyFields from '../utils/validate-body-fields';

const router: Router = Router();

// Forma, no dominio (P-3): el patrón de `fileName`, el tamaño de `content` y demás reglas las valida
// jiku-docs para que su código llegue sin traducir. Sin `.unknown()`: `via`, `checksum` y
// `contentUploadId` no se aceptan (los fija la api o están fuera de alcance).
const CREATE_SCHEMA = joi.object({
  id: joiUlid(),
  folderId: joiUlid().required(),
  fileName: joi.string().required(),
  content: joi.string().allow('').required(),
  message: joi.string(),
}).strict();

async function createDocument(req: Request, res: Response) {
  const body = req.body;
  try {
    // DD-8: la api genera el ULID si el cliente no lo manda y calcula el checksum del texto.
    // DD-9: `via` lo fija la api; toda escritura por HTTP es una persona en la web.
    const data = await moduleCommand(res, 'docs', 'documents.new', {
      id: body.id ?? generateUlid(),
      ...pickDefined(body, ['folderId', 'fileName', 'content', 'message']),
      checksum: contentChecksum(body.content),
      via: 'human',
    });
    if (!data) return;
    return res.status(201).json(data);
  } catch (error: any) {
    // Nunca se loguea `content` ni el payload.
    logger.error(`POST /api/docs/documents createDocument error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Create document
 * @description Crea un documento en jiku-docs en nombre de la persona (REQ-016, ruta 8, CA-S7).
 * @route {POST} /api/docs/documents
 * @bodyparam {string} [id] - ULID de alta; si falta lo genera la api (hace idempotente el reintento)
 * @bodyparam {string} folderId - ULID de la carpeta
 * @bodyparam {string} fileName - Nombre del archivo (`.md`)
 * @bodyparam {string} content - Markdown (hasta 256 KiB)
 * @bodyparam {string} [message] - Mensaje de la versión
 * @response {201} Created - `{ id, version, path, warnings? }`
 * @response {400} Invalid fields / regla de dominio de jiku-docs
 * @response {403} Access denied
 * @response {404} Folder not found / module not installed
 * @response {409} already_exists
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.post('/docs/documents', requireModule('docs'), hasAnyRole(['admin', 'user']), validateBodyFields(CREATE_SCHEMA), createDocument);

export default router;
