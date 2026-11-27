import { Request, Response, Router } from 'express';
import logger from '../logger';
import { moduleCommand, moduleQuery } from '../modules/client';
import { ModuleDownloadTicket, redirectToModuleDownload } from '../modules/docs/download';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';

const router: Router = Router();

async function downloadPortalAttachment(req: Request, res: Response) {
  const documentId = String(req.params.documentId);
  const id = String(req.params.id);
  // Los dos ids se validan antes del bus; el del adjunto entra al subject de NATS (ADR-002).
  if (!isUlid(documentId)) return respondDocsNotFound(res, 'document_not_found');
  if (!isUlid(id)) return respondDocsNotFound(res, 'attachment_not_found');

  try {
    const document = await moduleQuery(res, 'docs', 'documents.get', { id: documentId, include: ['attachments'] });
    if (!document) return;

    // DD-3 de REQ-016 aplicado al adjunto (cierra F-13): para todo rol, y sin revelar que existe.
    if (document.visibility !== 'public') return respondDocsNotFound(res, 'document_not_found');

    const belongs = Array.isArray(document.attachments) && document.attachments.some((a: any) => a?.id === id);
    if (!belongs) return respondDocsNotFound(res, 'attachment_not_found');

    const ticket = await moduleCommand<ModuleDownloadTicket>(res, 'docs', `attachments.${id}.request-download`, {});
    if (!ticket) return;
    return redirectToModuleDownload(res, ticket);
  } catch (error: any) {
    logger.error(`GET /api/opus/docs/documents/:documentId/attachments/:id downloadPortalAttachment error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Download portal document attachment
 * @description Redirige (302) a la `downloadUrl` de jiku-docs, solo si el adjunto pertenece a un
 * documento `public`. Cierra F-13 (REQ-017).
 * @route {GET} /api/opus/docs/documents/:documentId/attachments/:id
 * @response {302} Redirect to the download URL
 * @response {403} Access denied
 * @response {404} Document or attachment not found / module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 *
 * EXCEPCIÓN ANOTADA a ADR-006 (DD-4): no hay `validateProjectPermissions` porque el proyecto no se
 * conoce antes de pedir el documento. El equivalente es la regla de externos de jiku-docs
 * (`public` + proyecto en sus `project-permissions` + carpeta sin `externalBlocked`) más el recorte
 * de visibilidad de acá. Un documento que no es `public` responde 404 `document_not_found`,
 * indistinguible de uno inexistente: nunca 403 por visibilidad.
 */
router.get('/opus/docs/documents/:documentId/attachments/:id', requireModule('docs'), hasAnyRole(['external-user', 'admin', 'user']), downloadPortalAttachment);

export default router;
