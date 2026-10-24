import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateQueryParams from '../utils/validate-query-params';

const router: Router = Router();

// Query: `validateQueryParams` valida pero no convierte, y `req.query` es de solo lectura en
// Express 5; el valor tipado sale de `DELETE_SCHEMA.validate(req.query).value`.
const DELETE_SCHEMA = joi.object({
  baseVersion: joi.number().integer().min(1).required(),
});

async function deleteDocument(req: Request, res: Response) {
  const id = String(req.params.id);
  // El `id` entra al subject (`documents.{id}.delete`): se valida antes del bus (ADR-002).
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  const { baseVersion } = DELETE_SCHEMA.validate(req.query).value;
  try {
    const data = await moduleCommand(res, 'docs', `documents.${id}.delete`, { baseVersion });
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`DELETE /api/docs/documents/:id deleteDocument error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Delete document
 * @description Borra un documento con versión base (REQ-016, ruta 11).
 * @route {DELETE} /api/docs/documents/:id
 * @queryparam {number} baseVersion - Versión sobre la que se borra
 * @response {200} OK - `{ id }`
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Document not found
 * @response {409} version_conflict / document_locked
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.delete('/docs/documents/:id', requireModule('docs'), hasAnyRole(['admin', 'user']), validateQueryParams(DELETE_SCHEMA), deleteDocument);

export default router;
