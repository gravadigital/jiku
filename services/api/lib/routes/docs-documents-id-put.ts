import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { contentChecksum } from '../modules/docs/checksum';
import { isUlid, joiUlid, respondDocsNotFound } from '../modules/docs/ids';
import { pickDefined } from '../modules/docs/query';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateBodyFields from '../utils/validate-body-fields';

const router: Router = Router();

const UPDATE_SCHEMA = joi.object({
  baseVersion: joi.number().integer().min(1).required(),
  content: joi.string().allow('').required(),
  sessionId: joiUlid(),
  message: joi.string(),
}).strict();

async function updateDocument(req: Request, res: Response) {
  const id = String(req.params.id);
  // El `id` entra al subject (`documents.{id}.update`): se valida antes del bus (ADR-002).
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  const { content } = req.body;
  try {
    const data = await moduleCommand(res, 'docs', `documents.${id}.update`, {
      ...pickDefined(req.body, ['baseVersion', 'content', 'sessionId', 'message']),
      checksum: contentChecksum(content), // DD-8
      via: 'human',                       // DD-9
    });
    if (!data) return; // el embudo ya respondió el error (409 version_conflict / document_locked incluidos)
    return res.status(200).json(data);
  } catch (error: any) {
    // Nunca se loguea `content` ni el payload.
    logger.error(`PUT /api/docs/documents/:id updateDocument error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Update document
 * @description Edita un documento con versión base (REQ-016, ruta 9, CA-17, CA-18).
 * La autenticación es la global de `app.ts` (H-3, ADR-008): esta ruta no declara `validateToken`.
 * @route {PUT} /api/docs/documents/:id
 * @bodyparam {number} baseVersion - Versión sobre la que se edita
 * @bodyparam {string} content - Markdown
 * @bodyparam {string} [sessionId] - ULID de la sesión que tiene el lock
 * @bodyparam {string} [message] - Mensaje de la versión
 * @response {200} OK - `{ id, version, path?, warnings? }`
 * @response {400} Invalid fields / regla de dominio de jiku-docs
 * @response {401} Unauthorized
 * @response {403} Access denied
 * @response {404} Document not found / module not installed
 * @response {409} version_conflict (details.currentVersion) / document_locked (details.holder, via, expiresAt)
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.put('/docs/documents/:id', requireModule('docs'), hasAnyRole(['admin', 'user']), validateBodyFields(UPDATE_SCHEMA), updateDocument);

export default router;
