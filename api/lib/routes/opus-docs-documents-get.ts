import { NextFunction, Request, Response, Router } from 'express';
import joi from 'joi';
import { Project, Requirement } from '@jiku/models';
import logger from '../logger';
import { moduleQuery } from '../modules/client';
import { buildPage, PAGE_LIMIT_MAX } from '../modules/docs/query';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateProjectPermissions from '../utils/middlewares/validate-project-permission';
import validateRequirementIsPublic from '../utils/middlewares/validate-requirement-is-public';
import validateQueryParams from '../utils/validate-query-params';

const router: Router = Router();

const positiveInt = () => joi.number().integer().positive();

// Sin `visibility`: la fuerza el handler y la query no la puede pisar (claves desconocidas -> 400).
const SCHEMA = joi.object({
  projectId: positiveInt(),
  requirementId: positiveInt(),
  limit: joi.number().integer().min(1).max(PAGE_LIMIT_MAX).default(50),
  cursor: joi.string().max(500).optional(),
}).xor('projectId', 'requirementId');

/**
 * Carga el proyecto o el requisito desde la QUERY. Duplica la carga de `validateProject` /
 * `validateRequirement` porque esos leen `req.params.projid` / `reqid` y acá el id no viene en
 * el path (la razón válida para duplicar según la convención http-server).
 */
async function loadDocsScope(req: Request, res: Response, next: NextFunction) {
  const query = SCHEMA.validate(req.query).value;
  try {
    if (query.requirementId !== undefined) {
      const requirement = await Requirement.findOne({
        where: { id: query.requirementId },
        attributes: ['id', 'projectId', 'visibilityLevel'],
        include: [{ model: Project, as: 'project', attributes: ['id'] }],
      });
      if (!requirement) {
        return res.status(404).json({ code: 'requirement_not_found', message: 'Requirement not found' });
      }
      req.requirement = requirement;
      req.project = (requirement as any).project;
      return next();
    }

    const project = await Project.findOne({ where: { id: query.projectId }, attributes: ['id'] });
    if (!project) {
      return res.status(404).json({ code: 'project_not_found', message: 'Project not found' });
    }
    req.project = project;
    return next();
  } catch (error: any) {
    logger.error(`[middleware] loadDocsScope error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/** La visibilidad del requisito solo se exige si el listado filtra por requisito. */
function requirePublicRequirementIfAny(req: Request, res: Response, next: NextFunction) {
  if (!req.requirement) return next();
  return validateRequirementIsPublic(req, res, next);
}

async function listPublicDocuments(req: Request, res: Response) {
  const query = SCHEMA.validate(req.query).value;
  try {
    const scope = query.requirementId !== undefined
      ? { requirementId: query.requirementId }
      : { projectId: query.projectId };
    const data = await moduleQuery(res, 'docs', 'documents.list', {
      // `visibility: 'public'` lo pone el handler (DD-3): no sale de la query.
      filter: { ...scope, visibility: 'public' },
      sort: ['-updatedAt'],
      page: buildPage(query),
    });
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`GET /api/opus/docs/documents listPublicDocuments error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name List public documents
 * @description Documentos `public` de un proyecto o de un requisito para el portal (REQ-016,
 * ruta 21). Exige `projectId` o `requirementId` (uno solo).
 * @route {GET} /api/opus/docs/documents
 * @response {200} OK
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Project / requirement not found, or module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 *
 * DD-3 (fuerza `visibility: public`) y DD-4 (permiso de proyecto, requisito público). Orden:
 * rol -> forma -> entidad -> permiso -> visibilidad -> handler.
 */
router.get(
  '/opus/docs/documents',
  requireModule('docs'),
  hasAnyRole(['external-user', 'admin', 'user']),
  validateQueryParams(SCHEMA),
  loadDocsScope,
  validateProjectPermissions,
  requirePublicRequirementIfAny,
  listPublicDocuments
);

export default router;
