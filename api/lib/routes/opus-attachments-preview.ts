import { Request, Response, Router } from 'express';
import { Attachment, AttachmentEntityType, File, Objective, ObjectiveActivity, Requirement, RequirementActivity } from '@jiku/models';
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

async function publicPreviewOpusAttachment(req: Request, res: Response) {
  const { id } = req.params;

  const attachmentId = parseInt(id as string);
  if (isNaN(attachmentId)) {
    return res.status(400).json({ code: 'invalid_id', message: 'Attachment ID must be a valid integer' });
  }

  try {
    // Igual que el resto: una consulta para autorizar y resolver el `file_id`. Un id sin
    // fila en `attachments` da 404, que es lo que hace ESTRUCTURALMENTE inalcanzable a un
    // archivo sin vínculo por esta vía (CA-14).
    const attachment = await Attachment.scope('active').findByPk(attachmentId, {
      include: [{ model: File, as: 'file' }],
    });

    if (!attachment) {
      return res.status(404).json({ code: 'not_found', message: 'Attachment not found' });
    }

    // Estos tipos siempre tienen una entidad confirmada (entity_id no nulo);
    // los drafts anclados al usuario caen en el else final → 403.
    const confirmedEntityId = attachment.entityId as number;

    if (attachment.entityType === AttachmentEntityType.RequirementComment) {
      const reqActivity = await RequirementActivity.findByPk(confirmedEntityId, { attributes: ['visibilityLevel'] });
      if (!reqActivity || reqActivity.visibilityLevel !== 'public') {
        return res.status(403).json({ code: 'access_denied', message: 'Attachment is not publicly accessible' });
      }
    } else if (attachment.entityType === AttachmentEntityType.ObjectiveComment) {
      const objActivity = await ObjectiveActivity.findByPk(confirmedEntityId, { attributes: ['visibilityLevel'] });
      if (!objActivity || objActivity.visibilityLevel !== 'public') {
        return res.status(403).json({ code: 'access_denied', message: 'Attachment is not publicly accessible' });
      }
    } else if (attachment.entityType === AttachmentEntityType.Comment) {
      // Legado — solo filas no migradas. Remover cuando S-096 confirme que no
      // quedan attachments con entity_type='comment' en producción.
      const objActivity = await ObjectiveActivity.findByPk(confirmedEntityId, { attributes: ['visibilityLevel'] });
      if (objActivity) {
        if (objActivity.visibilityLevel !== 'public') {
          return res.status(403).json({ code: 'access_denied', message: 'Attachment is not publicly accessible' });
        }
      } else {
        const reqActivity = await RequirementActivity.findByPk(confirmedEntityId, { attributes: ['visibilityLevel'] });
        if (!reqActivity || reqActivity.visibilityLevel !== 'public') {
          return res.status(403).json({ code: 'access_denied', message: 'Attachment is not publicly accessible' });
        }
      }
    } else if (attachment.entityType === AttachmentEntityType.Objective) {
      const objective = await Objective.findByPk(confirmedEntityId, { attributes: ['visibilityLevel'] });
      if (!objective || objective.visibilityLevel !== 'public') {
        return res.status(403).json({ code: 'access_denied', message: 'Attachment is not publicly accessible' });
      }
    } else if (attachment.entityType === AttachmentEntityType.Requirement) {
      const requirement = await Requirement.findByPk(confirmedEntityId, { attributes: ['visibilityLevel'] });
      if (!requirement || requirement.visibilityLevel !== 'public') {
        return res.status(403).json({ code: 'access_denied', message: 'Attachment is not publicly accessible' });
      }
    } else {
      return res.status(403).json({ code: 'access_denied', message: 'Attachment is not publicly accessible' });
    }

    // NINGUNA EXCEPCIÓN AL CONTROL DEL STORAGE: el endpoint público también le pide la URL
    // a core. La api no firma nada por su cuenta en ningún camino.
    //
    // CAMBIO DE COMPORTAMIENTO DELIBERADO (S-005): antes servía `inline`, ahora publica con
    // `attachment`. Una URL pública que abre un descargable dentro del navegador es peor que
    // una que lo baja, y el nombre original viaja firmado dentro de la prefirmada.
    const data = await sendCommand<DownloadTicket>(
      res,
      `files.${attachment.fileId}.request-download`,
      { disposition: 'attachment' }
    );
    if (!data) return;

    // La CSP de sandbox es de este endpoint: es el único sin autenticación del producto.
    res.setHeader('Content-Security-Policy', 'sandbox; default-src \'none\';');
    return redirectToPresigned(req, res, data, 'attachment');

  } catch (error: any) {
    logger.error(`Opus public preview failed: id=${id}, error=${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Failed to preview attachment' });
  }
}

router.get('/opus/attachments/:id/preview', hasAnyRole(['user', 'external-user']), previewOpusAttachment);
router.get('/opus/attachments/:id/public', publicPreviewOpusAttachment);

export default router;
