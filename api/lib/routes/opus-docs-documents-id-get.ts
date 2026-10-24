import { Request, Response, Router } from 'express';
import logger from '../logger';
import { moduleQuery } from '../modules/client';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';

const router: Router = Router();

async function getPublicDocument(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  try {
    const data = await moduleQuery(res, 'docs', 'documents.get', { id, include: ['content', 'attachments'] });
    if (!data) return;

    // DD-3: el portal solo muestra documentos `public`, para todo rol. Falla cerrado: sin
    // `visibility` también es 404, idéntico al de un id inexistente.
    if (data.visibility !== 'public') return respondDocsNotFound(res, 'document_not_found');

    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`GET /api/opus/docs/documents/:id getPublicDocument error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Get public document
 * @description Un documento `public` para el portal (REQ-016, ruta 22). Sin carpeta: los externos
 * no ven carpetas.
 * @route {GET} /api/opus/docs/documents/:id
 * @response {200} OK
 * @response {403} Access denied
 * @response {404} Document not found / module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 *
 * EXCEPCIÓN ANOTADA a ADR-006 (REQ-016, DD-4): no hay `validateProjectPermissions` porque el
 * proyecto no se conoce antes de pedir el documento. El equivalente es la regla de externos de
 * jiku-docs (`public` + proyecto en sus `project-permissions` + carpeta sin `externalBlocked`),
 * más el recorte de visibilidad de acá (DD-3).
 */
router.get('/opus/docs/documents/:id', requireModule('docs'), hasAnyRole(['external-user', 'admin', 'user']), getPublicDocument);

export default router;
