import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleQuery } from '../modules/client';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import { loadClientNames, loadProjects } from '../modules/docs/relation-refs';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateQueryParams from '../utils/validate-query-params';

const router: Router = Router();

// Sin query params: una clave desconocida es 400.
const SCHEMA = joi.object({});

async function suggestRelations(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  try {
    const data = await moduleQuery(res, 'docs', 'documents.suggest-relations', { id });
    if (!data) return;

    const items: any[] = data.items ?? [];
    const projectIds = Array.from(new Set(items.map((i) => i.projectId).filter((v) => typeof v === 'number')));
    const clientIds = Array.from(new Set(items.map((i) => i.clientId).filter((v) => typeof v === 'number')));
    const [projects, clients] = await Promise.all([loadProjects(projectIds), loadClientNames(clientIds)]);

    // Orden y `score` de jiku-docs; solo se agregan nombres (null si el id es null o desconocido).
    return res.status(200).json({
      items: items.map((item) => ({
        projectId: item.projectId,
        clientId: item.clientId,
        score: item.score,
        reason: item.reason,
        projectName: projects.get(item.projectId)?.name ?? null,
        projectCode: projects.get(item.projectId)?.code ?? null,
        // El contrato ya informa el cliente del candidato: no es el del proyecto.
        clientName: clients.get(item.clientId) ?? null,
      })),
    });
  } catch (error: any) {
    logger.error(`GET /api/docs/documents/:id/suggested-relations suggestRelations error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Suggested relations
 * @description Candidatos de proyecto/cliente para un documento (REQ-021 / S-094):
 * `documents.suggest-relations` más `projectName`, `projectCode` y `clientName` desde la base.
 * Requiere jiku-docs >= 1.3.0.
 * @route {GET} /api/docs/documents/:id/suggested-relations
 * @response {200} OK - `{ items: [{ projectId, clientId, score, reason, projectName, projectCode, clientName }] }`
 * @response {400} Invalid fields
 * @response {403} Access denied / permission_denied
 * @response {404} Document not found / module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.get('/docs/documents/:id/suggested-relations', requireModule('docs'), hasAnyRole(['admin', 'user']), validateQueryParams(SCHEMA), suggestRelations);

export default router;
