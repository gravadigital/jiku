import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleQuery } from '../modules/client';
import { withDocumentRefs } from '../modules/docs/relation-refs';
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

    // REQ-021 / S-094 (revisión de ADR-015): con jiku-docs 1.3.0 la carpeta no decide permisos; la
    // web decide editar/compartir por visibilidad y rol y necesita nombres, no la carpeta. Por eso
    // ya no se compone `folders.get`: los nombres salen de la base en lote.
    return res.status(200).json(await withDocumentRefs(document));
  } catch (error: any) {
    logger.error(`GET /api/docs/documents/:id getDocument error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Get document
 * @description Detalle de un documento con las referencias con nombre (REQ-016, ruta 2; REQ-021 /
 * S-094): `documents.get` y `clientRefs`/`projectRefs`/`requirementRefs`/`taskRefs` desde la base.
 * Sin `folder`.
 * @route {GET} /api/docs/documents/:id
 * @response {200} OK
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Document not found / version_pruned / module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.get('/docs/documents/:id', requireModule('docs'), hasAnyRole(['admin', 'user']), validateQueryParams(SCHEMA), getDocument);

export default router;
