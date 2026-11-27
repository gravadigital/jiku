import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateBodyFields from '../utils/validate-body-fields';

const router: Router = Router();

const RESTORE_SCHEMA = joi.object({
  fromVersion: joi.number().integer().min(1).required(),
  baseVersion: joi.number().integer().min(1).required(),
}).strict();

async function restoreDocument(req: Request, res: Response) {
  const id = String(req.params.id);
  // El `id` entra al subject: se valida antes del bus (ADR-002).
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  try {
    const data = await moduleCommand(res, 'docs', `documents.${id}.restore`, { fromVersion: req.body.fromVersion, baseVersion: req.body.baseVersion });
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`POST /api/docs/documents/:id/restore restoreDocument error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Restore document version
 * @description Restaura una versión anterior como versión nueva (REQ-016, ruta 12).
 * @route {POST} /api/docs/documents/:id/restore
 * @bodyparam {number} fromVersion - Versión a restaurar
 * @bodyparam {number} baseVersion - Versión vigente sobre la que se restaura
 * @response {200} OK - data de jiku-docs
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Document not found
 * @response {409} version_conflict / document_locked
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.post('/docs/documents/:id/restore', requireModule('docs'), hasAnyRole(['admin', 'user']), validateBodyFields(RESTORE_SCHEMA), restoreDocument);

export default router;
