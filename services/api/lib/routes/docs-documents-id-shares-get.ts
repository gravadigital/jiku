import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleQuery } from '../modules/client';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import { buildPage, PAGE_LIMIT_MAX, pickDefined } from '../modules/docs/query';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateQueryParams from '../utils/validate-query-params';

const router: Router = Router();

const LIST_SCHEMA = joi.object({
  status: joi.string().valid('active', 'revoked', 'expired'),
  limit: joi.number().integer().min(1).max(PAGE_LIMIT_MAX).default(50),
  cursor: joi.string().max(500),
});

async function listShares(req: Request, res: Response) {
  const id = String(req.params.id);
  // El id va en el payload, no en el subject: se valida igual (coherencia y ahorro de un viaje al bus).
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  const query = LIST_SCHEMA.validate(req.query).value;
  try {
    // Es una consulta al bus, no a la base (excepción de ADR-001 / DD-17). `sort` es fijo.
    // La lista nunca incluye el token (CA-31).
    const data = await moduleQuery(res, 'docs', 'shares.list', {
      filter: { documentId: id, ...pickDefined(query, ['status']) },
      sort: ['-createdAt'],
      page: buildPage(query),
    });
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`GET /api/docs/documents/:id/shares listShares error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name List document shares
 * @description Lista los links compartidos de un documento, sin token (REQ-016, ruta 18).
 * @route {GET} /api/docs/documents/:id/shares
 * @queryparam {string} [status] - active | revoked | expired
 * @queryparam {number} [limit] - 1..200 (default 50)
 * @queryparam {string} [cursor]
 * @response {200} OK - `{ items, page }`
 * @response {400} Invalid fields / invalid_cursor
 * @response {403} Access denied
 * @response {404} Document not found
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.get('/docs/documents/:id/shares', requireModule('docs'), hasAnyRole(['admin', 'user']), validateQueryParams(LIST_SCHEMA), listShares);

export default router;
