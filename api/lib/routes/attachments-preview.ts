import { Request, Response, Router } from 'express';
import { Attachment, File } from '@jiku/models';
import { canUserViewEntity } from '../utils/attachments-access';
import { sendCommand } from '../utils/bus/send-command';
import { DownloadTicket, redirectToPresigned } from '../utils/bus/download-ticket';
import logger from '../logger';
import validateToken from '../utils/middlewares/validate-token';

const router: Router = Router();

/**
 * La api ya no sirve el byte: autoriza, resuelve el `file_id` del vínculo, le pide la URL
 * prefirmada a core y redirige (REQ-001, S-005).
 *
 * EL ORDEN ES EL CRITERIO DE ACEPTACIÓN, no un detalle de estilo: el 404 y el 403 tienen
 * que ocurrir ANTES de publicar. Un handler que publique primero y autorice después
 * pasaría los tests de status igual, pero le habría pedido a core una URL firmada para un
 * archivo que el usuario no puede ver.
 */
async function previewAttachment(req: Request, res: Response) {
  const { id } = req.params;

  const attachmentId = parseInt(id as string);
  if (isNaN(attachmentId)) {
    return res.status(400).json({ code: 'invalid_id', message: 'Attachment ID must be a valid integer' });
  }

  let attachment: Attachment | null;
  try {
    // Una sola consulta que sirve para las dos cosas: autorizar (necesita la entidad del
    // vínculo) y resolver el `file_id`. La traducción vínculo → archivo no cuesta nada.
    attachment = await Attachment.scope('active').findByPk(attachmentId, {
      include: [{ model: File, as: 'file' }],
    });
  } catch (error: any) {
    logger.error(`Preview failed: id=${id}, error=${error.message}`, { userId: req.user.id });
    return res.status(500).json({ code: 'internal_error', message: 'Failed to preview attachment' });
  }

  if (!attachment) {
    logger.warn(`Preview denied: attachment not found, attachmentId=${attachmentId}, userId=${req.user.id}`);
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
    logger.error(`Preview failed: id=${id}, error=${error.message}`, { userId: req.user.id });
    return res.status(500).json({ code: 'internal_error', message: 'Failed to preview attachment' });
  }

  if (!hasAccess) {
    logger.warn(`Preview denied: access denied, attachmentId=${attachmentId}, userId=${req.user.id}`);
    return res.status(403).json({ code: 'access_denied', message: 'You do not have permission to preview this attachment' });
  }

  // El subject lleva el id del ARCHIVO, no el del vínculo. El payload NO lleva `requester`:
  // la titularidad no aplica a la lectura (RF-12 habla de vincular, no de leer).
  const data = await sendCommand<DownloadTicket>(
    res,
    `files.${attachment.fileId}.request-download`,
    { disposition: 'inline' }
  );
  if (!data) return;

  return redirectToPresigned(req, res, data, 'inline');
}

router.get('/attachments/:id/preview', validateToken, previewAttachment);

export default router;
