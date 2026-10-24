import { Request, Response, Router } from 'express';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { ModuleDownloadTicket, redirectToModuleDownload } from '../modules/docs/download';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';

const router: Router = Router();

async function downloadPublicAttachment(req: Request, res: Response) {
  const id = String(req.params.id);
  // El `id` entra al subject de NATS: se valida la forma antes del bus (ADR-002).
  if (!isUlid(id)) return respondDocsNotFound(res, 'attachment_not_found');

  try {
    const data = await moduleCommand<ModuleDownloadTicket>(res, 'docs', `attachments.${id}.request-download`, {});
    if (!data) return;
    return redirectToModuleDownload(res, data);
  } catch (error: any) {
    logger.error(`GET /api/opus/docs/attachments/:id downloadPublicAttachment error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Download public document attachment
 * @description Redirige (302) a la `downloadUrl` de jiku-docs desde el portal (REQ-016, ruta 23).
 * @route {GET} /api/opus/docs/attachments/:id
 * @response {302} Redirect to the download URL
 * @response {403} Access denied
 * @response {404} Attachment not found / module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 *
 * Misma excepción de ADR-006 que la ruta 22 (DD-4). LIMITACIÓN CONOCIDA: el reply de
 * `request-download` no trae la visibilidad del documento, así que para un usuario INTERNO que use
 * el portal la api no puede recortar el adjunto de un documento `internal`; el recorte es el de
 * jiku-docs para `person-external`. El REQ no define más defensa: no se inventa acá.
 */
router.get('/opus/docs/attachments/:id', requireModule('docs'), hasAnyRole(['external-user', 'admin', 'user']), downloadPublicAttachment);

export default router;
