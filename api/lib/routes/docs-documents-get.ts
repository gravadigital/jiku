import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleQuery } from '../modules/client';
import { joiUlid } from '../modules/docs/ids';
import { activeProjectIdsOf } from '../modules/docs/active-projects';
import {
  buildDocumentsFilter, buildPage, DOCS_PERSON_MAX, joiIntList, joiStrList, PAGE_LIMIT_MAX,
} from '../modules/docs/query';
import { withListRefs } from '../modules/docs/relation-refs';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateQueryParams from '../utils/validate-query-params';

const router: Router = Router();

const positiveInt = () => joi.number().integer().positive();

// Un tipo repetido es O, tipos distintos son Y (contrato de jiku-docs). `.single()` normaliza a
// array: `projectId=12` llega como `[12]` (equivale a `IntOrList`).
const LIST_SCHEMA = joi.object({
  projectId: joiIntList(),
  requirementId: positiveInt(),
  taskId: positiveInt(),
  clientId: joiIntList(),
  folderId: joiUlid(),
  pathPrefix: joi.string().min(1).max(500),
  topic: joiStrList(),
  hasProject: joi.boolean(),
  hasClient: joi.boolean(),
  hasTopic: joi.boolean(),
  person: joi.array().items(joi.string().min(1).max(200)).single().max(DOCS_PERSON_MAX),
  visibility: joi.string().valid('internal', 'public', 'restricted'),
  myActiveProjects: joi.boolean(),
  count: joi.boolean(),
  sort: joi.string()
    .valid('updatedAt', '-updatedAt', 'createdAt', '-createdAt', 'title', '-title', 'path', '-path')
    .default('-updatedAt'),
  limit: joi.number().integer().min(1).max(PAGE_LIMIT_MAX).default(50),
  cursor: joi.string().max(500).optional(),
}).oxor('projectId', 'myActiveProjects');

async function listDocuments(req: Request, res: Response) {
  // `validateQueryParams` valida pero no convierte: el valor tipado sale de acá.
  const query = LIST_SCHEMA.validate(req.query).value;
  try {
    const filter: Record<string, unknown> = buildDocumentsFilter(query);

    if (query.myActiveProjects === true) {
      // Fail-closed como el embudo: sin identidad verificada no se consulta ni la base ni el bus.
      const sub = req.decodedToken?.sub;
      if (!sub) return res.status(401).json({ code: 'unauthorized', message: 'Unauthorized' });
      const projectIds = await activeProjectIdsOf(sub);
      if (projectIds.length === 0) {
        // Sin proyectos no hay nada que pedir: `projectId: []` sería un filtro inválido.
        const page: Record<string, number> = { limit: query.limit, returned: 0 };
        if (query.count === true) page.total = 0; // mismo significado que `PageInfo.total`
        return res.status(200).json({ items: [], page });
      }
      filter.projectId = projectIds;
    }

    const data = await moduleQuery(res, 'docs', 'documents.list', {
      filter,
      sort: [query.sort],
      page: buildPage(query),
      include: ['lock', 'topics'],
      // La clave solo existe si es `true`: `count: false` no se manda.
      ...(query.count === true ? { count: true } : {}),
    });
    if (!data) return;
    // Los nombres salen de la base en lote (una consulta por tipo); `page` pasa verbatim.
    return res.status(200).json({ ...data, items: await withListRefs(data.items ?? []) });
  } catch (error: any) {
    logger.error(`GET /api/docs/documents listDocuments error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name List documents
 * @description Lista los documentos que la persona puede leer (REQ-016, ruta 1; REQ-021 / S-094).
 * Llama a `documents.list` de jiku-docs (>= 1.3.0) con `include: ['lock','topics']` y filtros:
 * listas de `projectId`/`clientId`/`topic`, `hasProject`/`hasClient`/`hasTopic`, `person`
 * (creado por o último editor), `visibility`, `myActiveProjects` (excluyente con `projectId`,
 * se resuelve desde la base) y `count` (`page.total`). Responde el `data` de jiku-docs y agrega
 * `clientRefs`/`projectRefs` a cada ítem.
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
