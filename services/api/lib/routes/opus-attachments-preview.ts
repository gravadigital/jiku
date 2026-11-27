import { Request, Response, Router } from 'express';
import { Attachment, File } from '@jiku/models';
import { canUserViewEntity } from '../utils/attachments-access';
import { sendCommand } from '../utils/bus/send-command';
import { DownloadTicket, redirectToPresigned } from '../utils/bus/download-ticket';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';

const router: Router = Router();

async function previewOpusAttachment(req: Request, res: Response) {
  const { id } = req.params;

  const attachmentId = parseInt(id as string);
  if (isNaN(attachmentId)) {
    return res.status(400).json({ code: 'invalid_id', message: 'Attachment ID must be a valid integer' });
  }

  try {
    // Una sola consulta: autoriza por la entidad del vínculo y resuelve el `file_id`.
    const attachment = await Attachment.scope('active').findByPk(attachmentId, {
      include: [{ model: File, as: 'file' }],
    });

    if (!attachment) {
      logger.warn(`Opus preview denied: attachment not found, attachmentId=${attachmentId}, userId=${req.user.id}`);
      return res.status(404).json({ code: 'not_found', message: 'Attachment not found' });
    }

    const hasAccess = await canUserViewEntity(
      req.user.id,
      req.decodedTokenRoles,
      attachment.entityType,
      attachment.entityId
    );

    if (!hasAccess) {
      logger.warn(`Opus preview denied: access denied, attachmentId=${attachmentId}, userId=${req.user.id}`);
      return res.status(403).json({ code: 'access_denied', message: 'You do not have permission to preview this attachment' });
    }

    // El subject lleva el id del ARCHIVO. Sin `requester`: la titularidad no aplica a la
    // lectura. El 302 es el ÚNICO camino, para todos los tamaños: la rama por tamaño de
    // archivo desapareció con S-005.
    const data = await sendCommand<DownloadTicket>(
      res,
      `files.${attachment.fileId}.request-download`,
      { disposition: 'inline' }
    );
    if (!data) return;

    return redirectToPresigned(req, res, data, 'inline');

  } catch (error: any) {
    logger.error(`Opus preview failed: id=${id}, error=${error.message}`, { userId: req.user.id });
    return res.status(500).json({ code: 'internal_error', message: 'Failed to preview attachment' });
  }
}

router.get('/opus/attachments/:id/preview', hasAnyRole(['user', 'external-user']), previewOpusAttachment);

export default router;
