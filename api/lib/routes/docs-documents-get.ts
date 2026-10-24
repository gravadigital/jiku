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

const positiveInt = () => joi.number().integer().positive();

const LIST_SCHEMA = joi.object({
  projectId: positiveInt(),
  requirementId: positiveInt(),
  taskId: positiveInt(),
  clientId: positiveInt(),
  folderId: joiUlid(),
  pathPrefix: joi.string().min(1).max(500),
  topic: joi.string().min(1).max(500),
  sort: joi.string()
    .valid('updatedAt', '-updatedAt', 'createdAt', '-createdAt', 'title', '-title', 'path', '-path')
    .default('-updatedAt'),
  limit: joi.number().integer().min(1).max(PAGE_LIMIT_MAX).default(50),
  cursor: joi.string().max(500).optional(),
});

const FILTER_KEYS = ['projectId', 'requirementId', 'taskId', 'clientId', 'folderId', 'pathPrefix', 'topic'];

async function listDocuments(req: Request, res: Response) {
  // `validateQueryParams` valida pero no convierte: el valor tipado sale de acá.
  const query = LIST_SCHEMA.validate(req.query).value;
  try {
    const data = await moduleQuery(res, 'docs', 'documents.list', {
      filter: pickDefined(query, FILTER_KEYS),
      sort: [query.sort],
      page: buildPage(query),
      include: ['lock'],
    });
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`GET /api/docs/documents listDocuments error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name List documents
 * @description Lista los documentos que la persona puede leer (REQ-016, ruta 1). Llama a
 * `documents.list` de jiku-docs en nombre de la persona y responde su `data` sin transformar.
 * @route {GET} /api/docs/documents
 * @response {200} OK
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 *
 * `requireModule` va antes que el rol (S-077). La api no autoriza el dominio (DD-2): el ACL
 * lo resuelve jiku-docs con el `actor`.
 */
router.get('/docs/documents', requireModule('docs'), hasAnyRole(['admin', 'user']), validateQueryParams(LIST_SCHEMA), listDocuments);

export default router;
