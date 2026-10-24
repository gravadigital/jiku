import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { isUlid, joiUlid, respondDocsNotFound } from '../modules/docs/ids';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateBodyFields from '../utils/validate-body-fields';

const router: Router = Router();

// `force` no se expone: exige `manage` y la administración de carpetas está fuera de alcance (REQ-016).
const UNLOCK_SCHEMA = joi.object({ sessionId: joiUlid().required() }).strict();

async function unlockDocument(req: Request, res: Response) {
  const id = String(req.params.id);
  // El `id` entra al subject: se valida antes del bus (ADR-002).
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  try {
    const data = await moduleCommand(res, 'docs', `documents.${id}.unlock`, { sessionId: req.body.sessionId });
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`POST /api/docs/documents/:id/unlock unlockDocument error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Unlock document
 * @description Libera el lock de edición (REQ-016, ruta 14). Es la ruta que llama el BFF con `keepalive` de la web al cerrar la pestaña.
 * @route {POST} /api/docs/documents/:id/unlock
 * @bodyparam {string} sessionId - ULID de la sesión que tomó el lock
 * @response {200} OK - `{ id }`
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Document not found
 * @response {409} lock_not_held
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.post('/docs/documents/:id/unlock', requireModule('docs'), hasAnyRole(['admin', 'user']), validateBodyFields(UNLOCK_SCHEMA), unlockDocument);

export default router;
