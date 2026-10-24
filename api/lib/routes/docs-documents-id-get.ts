import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleQuery } from '../modules/client';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateQueryParams from '../utils/validate-query-params';

const router: Router = Router();

const SCHEMA = joi.object({
  version: joi.number().integer().min(1),
});

async function getDocument(req: Request, res: Response) {
  const id = String(req.params.id);
  // Forma antes que bus: un id mal escrito responde igual que uno inexistente.
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  const query = SCHEMA.validate(req.query).value;
  try {
    const document = await moduleQuery(res, 'docs', 'documents.get', {
      id,
      ...(query.version !== undefined ? { version: query.version } : {}),
      include: ['content', 'relations', 'topics', 'lock', 'attachments'],
    });
    if (!document) return;

    // Única composición de la api (CA-S3): la web necesita saber en UN pedido si puede editar
    // (`write`) o compartir (`manage`). En serie: la carpeta sale de `document.folderId`.
    const folder = await moduleQuery(res, 'docs', 'folders.get', {
      id: document.folderId,
      include: ['effectivePermission'],
    });
    if (!folder) return;

    return res.status(200).json({
      ...document,
      folder: {
        id: folder.id,
        path: folder.path,
        effectivePermission: folder.effectivePermission,
        sharingBlocked: folder.sharingBlocked,
      },
    });
  } catch (error: any) {
    logger.error(`GET /api/docs/documents/:id getDocument error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Get document
 * @description Detalle de un documento con la carpeta resuelta (REQ-016, ruta 2): `documents.get`
 * y luego `folders.get`.
 * @route {GET} /api/docs/documents/:id
 * @response {200} OK
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Document not found / module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.get('/docs/documents/:id', requireModule('docs'), hasAnyRole(['admin', 'user']), validateQueryParams(SCHEMA), getDocument);

export default router;
