import { Request, Response, Router } from 'express';
import { Attachment, File } from '@jiku/models';
import { canUserViewEntity } from '../utils/attachments-access';
import { sendCommand } from '../utils/bus/send-command';
import { DownloadTicket, redirectToPresigned } from '../utils/bus/download-ticket';
import logger from '../logger';
import validateToken from '../utils/middlewares/validate-token';

const router: Router = Router();

/**
 * Igual que el preview, con `disposition: 'attachment'`: el nombre original viaja firmado
 * dentro de la URL prefirmada, así que S3 devuelve el archivo con su nombre sin que la api
 * arme el header ni proxee un byte (REQ-001, S-005).
 *
 * AUTORIZA CON `canUserViewEntity`, igual que el preview y a propósito. El flujo de
 * producto declaraba `canUserAccessEntity`, pero esta ruta nunca lo usó:
 * `canUserAccessEntity` es la función de ADJUNTAR, con reglas más finas sobre objetivos, y
 * aplicarla acá restringiría el acceso de usuarios que hoy descargan sin problema — un
 * cambio observable que ningún criterio de aceptación pidió. S-005 mantiene la
 * autorización, no la endurece.
 */
async function downloadAttachment(req: Request, res: Response) {
  const { id } = req.params;

  const attachmentId = parseInt(id as string);
  if (isNaN(attachmentId)) {
    return res.status(400).json({ code: 'invalid_id', message: 'Attachment ID must be a valid integer' });
  }

  let attachment: Attachment | null;
  try {
    // Una sola consulta: autoriza por la entidad del vínculo y resuelve el `file_id`.
    attachment = await Attachment.scope('active').findByPk(attachmentId, {
      include: [{ model: File, as: 'file' }],
    });
  } catch (error: any) {
    logger.error(`Download failed: id=${id}, error=${error.message}`, { userId: req.user.id });
    return res.status(500).json({ code: 'internal_error', message: 'Failed to download attachment' });
  }

  if (!attachment) {
    logger.warn(`Download denied: attachment not found, id=${attachmentId}, userId=${req.user.id}`);
    return res.status(404).json({ code: 'not_found', message: 'Attachment not found' });
  }

  let hasAccess: boolean;
  try {
    hasAccess = await canUserViewEntity(
      req.user.id,
      req.decodedTokenRoles,
      attachment.entityType,
      attachment.entityId
    );
  } catch (error: any) {
    logger.error(`Download failed: id=${id}, error=${error.message}`, { userId: req.user.id });
    return res.status(500).json({ code: 'internal_error', message: 'Failed to download attachment' });
  }

  if (!hasAccess) {
    logger.warn(`Download denied: access denied, attachmentId=${attachmentId}, userId=${req.user.id}`);
    return res.status(403).json({ code: 'access_denied', message: 'You do not have permission to download this attachment' });
  }

  const data = await sendCommand<DownloadTicket>(
    res,
    `files.${attachment.fileId}.request-download`,
    { disposition: 'attachment' }
  );
  if (!data) return;

  return redirectToPresigned(req, res, data, 'attachment');
}

router.get('/attachments/:id/download', validateToken, downloadAttachment);

export default router;
