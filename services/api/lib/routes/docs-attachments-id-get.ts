import { Request, Response, Router } from 'express';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { ModuleDownloadTicket, redirectToModuleDownload } from '../modules/docs/download';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';

const router: Router = Router();

async function downloadAttachment(req: Request, res: Response) {
  const id = String(req.params.id);
  // El `id` ENTRA AL SUBJECT de NATS (`attachments.{id}.request-download`): Express lo entrega
  // decodificado, así que un `.`, `*` o `>` inyectaría tokens. Se valida la forma aunque
  // jiku-docs también lo haría (ADR-002).
  if (!isUlid(id)) return respondDocsNotFound(res, 'attachment_not_found');

  try {
    const data = await moduleCommand<ModuleDownloadTicket>(res, 'docs', `attachments.${id}.request-download`, {});
    if (!data) return;
    return redirectToModuleDownload(res, data);
  } catch (error: any) {
    // Nunca se loguea la `downloadUrl`.
    logger.error(`GET /api/docs/attachments/:id downloadAttachment error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Download document attachment
 * @description Redirige (302) a la `downloadUrl` prefirmada de jiku-docs (REQ-016, ruta 17, CA-19).
 * @route {GET} /api/docs/attachments/:id
 * @response {302} Redirect to the download URL
 * @response {403} Access denied
 * @response {404} Attachment not found / module not installed
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.get('/docs/attachments/:id', requireModule('docs'), hasAnyRole(['admin', 'user']), downloadAttachment);

export default router;
