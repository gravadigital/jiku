import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleQuery } from '../modules/client';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import { buildPage, PAGE_LIMIT_MAX } from '../modules/docs/query';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateQueryParams from '../utils/validate-query-params';

const router: Router = Router();

const SCHEMA = joi.object({
  limit: joi.number().integer().min(1).max(PAGE_LIMIT_MAX).default(50),
  cursor: joi.string().max(500).optional(),
});

async function listVersions(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  const query = SCHEMA.validate(req.query).value;
  try {
    const data = await moduleQuery(res, 'docs', 'documents.versions.list', {
      filter: { documentId: id },
      sort: ['-version'],
      page: buildPage(query),
    });
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`GET /api/docs/documents/:id/versions listVersions error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name List document versions
 * @description Historial de versiones de un documento (REQ-016, ruta 3): `documents.versions.list`.
 * @route {GET} /api/docs/documents/:id/versions
 * @response {200} OK
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Document not found / module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.get('/docs/documents/:id/versions', requireModule('docs'), hasAnyRole(['admin', 'user']), validateQueryParams(SCHEMA), listVersions);

export default router;
