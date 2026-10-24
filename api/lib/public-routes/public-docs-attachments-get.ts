import { Request, Response, Router } from 'express';
import logger from '../logger';
import { redirectToModuleDownload } from '../modules/docs/download';
import { isUlid } from '../modules/docs/ids';
import { sendPublicNotice } from '../modules/docs/public-page';
import { queryShare, ShareAttachmentTicket, SHARE_TOKEN_PATTERN } from '../modules/docs/public-share';

const router = Router();

/**
 * @name Shared attachment (public)
 * @description Redirige (302) a la URL prefirmada de un adjunto de un link compartido (REQ-016 / S-080).
 * El `Referrer-Policy: no-referrer` del 302 impide que el token viaje como `Referer` al storage; la
 * `downloadUrl` nunca se loguea. Mismo control de acceso y mismo 404 único que la lectura.
 * @route {GET} /p/docs/:token/attachments/:id
 * @response {302} Location: URL prefirmada
 * @response {404} text/html Link o adjunto no disponible
 * @response {429} text/html Demasiados pedidos
 * @response {503} text/html Módulo no disponible
 */
async function downloadSharedAttachment(req: Request, res: Response) {
  const token = String(req.params.token);
  const id = String(req.params.id);
  // El `attachmentId` va en el payload, no en el subject; se valida igual: ahorra un viaje al bus.
  if (!SHARE_TOKEN_PATTERN.test(token) || !isUlid(id)) return sendPublicNotice(res, 404);
  try {
    const result = await queryShare<ShareAttachmentTicket>('shares.attachment', req, { token, attachmentId: id });
    if (!result.ok) return sendPublicNotice(res, result.status);
    return redirectToModuleDownload(res, result.data);
  } catch (error: any) {
    logger.error(
      `GET /p/docs/:token/attachments/:id downloadSharedAttachment error: ${error.code || 'unexpected'}`
    );
    return sendPublicNotice(res, 503);
  }
}

router.get('/p/docs/:token/attachments/:id', downloadSharedAttachment);

export default router;
