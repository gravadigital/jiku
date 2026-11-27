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

// `ttlSeconds` 30..300 es del contrato (DocumentsLock). `sessionId` lo genera la web (DD-8).
const LOCK_SCHEMA = joi.object({
  sessionId: joiUlid().required(),
  ttlSeconds: joi.number().integer().min(30).max(300),
}).strict();

async function lockDocument(req: Request, res: Response) {
  const id = String(req.params.id);
  // El `id` entra al subject: se valida antes del bus (ADR-002).
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  try {
    const data = await moduleCommand(res, 'docs', `documents.${id}.lock`, { ...pickDefined(req.body, ['sessionId', 'ttlSeconds']), via: 'human' });
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`POST /api/docs/documents/:id/lock lockDocument error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Lock document
 * @description Toma o renueva el lock de edición (REQ-016, ruta 13, CA-S8). La api no guarda estado: repetir con el mismo `sessionId` publica el mismo payload y jiku-docs lo renueva (§5, idempotencia). `via` lo fija la api (DD-9).
 * @route {POST} /api/docs/documents/:id/lock
 * @bodyparam {string} sessionId - ULID generado por la web
 * @bodyparam {number} [ttlSeconds] - 30..300
 * @response {200} OK - `{ id, sessionId, expiresAt }`
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Document not found
 * @response {409} document_locked (details.holder, via, expiresAt)
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.post('/docs/documents/:id/lock', requireModule('docs'), hasAnyRole(['admin', 'user']), validateBodyFields(LOCK_SCHEMA), lockDocument);

export default router;
