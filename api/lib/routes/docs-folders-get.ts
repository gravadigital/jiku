import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleQuery } from '../modules/client';
import { joiUlid } from '../modules/docs/ids';
import { buildPage, pickDefined, PAGE_LIMIT_MAX } from '../modules/docs/query';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateQueryParams from '../utils/validate-query-params';

const router: Router = Router();

const SCHEMA = joi.object({
  parentId: joiUlid(),
  pathPrefix: joi.string().min(1).max(500),
  limit: joi.number().integer().min(1).max(PAGE_LIMIT_MAX).default(50),
  cursor: joi.string().max(500).optional(),
});

async function listFolders(req: Request, res: Response) {
  const query = SCHEMA.validate(req.query).value;
  try {
    const data = await moduleQuery(res, 'docs', 'folders.list', {
      filter: pickDefined(query, ['parentId', 'pathPrefix']),
      sort: ['name'],
      page: buildPage(query),
      include: ['effectivePermission'],
    });
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`GET /api/docs/folders listFolders error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name List folders
 * @description Carpetas visibles para la persona, con su permiso efectivo (REQ-016, ruta 6):
 * `folders.list`.
 * @route {GET} /api/docs/folders
 * @response {200} OK
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.get('/docs/folders', requireModule('docs'), hasAnyRole(['admin', 'user']), validateQueryParams(SCHEMA), listFolders);

export default router;
