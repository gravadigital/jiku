import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { isUlid, joiUlid, respondDocsNotFound } from '../modules/docs/ids';
import { pickDefined } from '../modules/docs/query';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateBodyFields from '../utils/validate-body-fields';

const router: Router = Router();

const MOVE_SCHEMA = joi.object({
  baseVersion: joi.number().integer().min(1).required(),
  folderId: joiUlid(),
  fileName: joi.string(),
  sessionId: joiUlid(),
}).or('folderId', 'fileName').strict();

async function moveDocument(req: Request, res: Response) {
  const id = String(req.params.id);
  // El `id` entra al subject: se valida antes del bus (ADR-002).
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  try {
    const data = await moduleCommand(res, 'docs', `documents.${id}.move`, pickDefined(req.body, ['baseVersion', 'folderId', 'fileName', 'sessionId']));
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`POST /api/docs/documents/:id/move moveDocument error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Move document
 * @description Mueve o renombra un documento (REQ-016, ruta 10). `DocumentsMove` no declara `via`: mandarlo seria `invalid_fields`.
 * @route {POST} /api/docs/documents/:id/move
 * @bodyparam {number} baseVersion
 * @bodyparam {string} [folderId] - ULID de la carpeta destino
 * @bodyparam {string} [fileName] - Nuevo nombre (al menos uno de folderId / fileName)
 * @bodyparam {string} [sessionId]
 * @response {200} OK - data de jiku-docs
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Document or folder not found
 * @response {409} version_conflict / document_locked / already_exists
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.post('/docs/documents/:id/move', requireModule('docs'), hasAnyRole(['admin', 'user']), validateBodyFields(MOVE_SCHEMA), moveDocument);

export default router;
