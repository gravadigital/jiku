import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleQuery } from '../modules/client';
import { buildDocumentsFilter, DOCS_PERSON_MAX, joiIntList, joiStrList } from '../modules/docs/query';
import { withListRefs } from '../modules/docs/relation-refs';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateQueryParams from '../utils/validate-query-params';

const router: Router = Router();

const positiveInt = () => joi.number().integer().positive();

// `mode` no se expone: en la v1 `semantic`/`hybrid` responden `semantic_search_not_configured`.
const SCHEMA = joi.object({
  q: joi.string().min(2).max(1000).required(),
  projectId: joiIntList(),
  clientId: joiIntList(),
  requirementId: positiveInt(),
  taskId: positiveInt(),
  pathPrefix: joi.string().min(1).max(500),
  topic: joiStrList(),
  hasProject: joi.boolean(),
  hasClient: joi.boolean(),
  hasTopic: joi.boolean(),
  person: joi.array().items(joi.string().min(1).max(200)).single().max(DOCS_PERSON_MAX),
  visibility: joi.string().valid('internal', 'public', 'restricted'),
  limit: joi.number().integer().min(1).max(50).default(20),
});

async function searchDocuments(req: Request, res: Response) {
  const query = SCHEMA.validate(req.query).value;
  try {
    const data = await moduleQuery(res, 'docs', 'documents.search', {
      query: query.q,
      mode: 'text',
      filter: buildDocumentsFilter(query),
      // `documents.search` no tiene `page`: el límite va en la raíz.
      limit: query.limit,
    });
    if (!data) return;
    return res.status(200).json({ ...data, items: await withListRefs(data.items ?? []) });
  } catch (error: any) {
    logger.error(`GET /api/docs/search searchDocuments error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Search documents
 * @description Búsqueda de texto en los documentos legibles (REQ-016, ruta 4; REQ-021 / S-094): `documents.search` con los
 * mismos filtros que el listado; cada hit gana `clientRefs`/`projectRefs`.
 * @route {GET} /api/docs/search
 * @response {200} OK
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.get('/docs/search', requireModule('docs'), hasAnyRole(['admin', 'user']), validateQueryParams(SCHEMA), searchDocuments);

export default router;
