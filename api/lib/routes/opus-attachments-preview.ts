import { Request, Response, Router } from 'express';
import { Attachment, AttachmentEntityType, Objective, ObjectiveActivity, Requirement, RequirementActivity } from '@jiku/models';
import storageService from '../utils/storage-service';
import { canUserViewEntity } from '../utils/attachments-access';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';

const router: Router = Router();

const MAX_STREAMING_SIZE = 15 * 1024 * 1024;
const PRESIGNED_URL_EXPIRY = 60;

async function previewOpusAttachment(req: Request, res: Response) {
  const { id } = req.params;

  const attachmentId = parseInt(id as string);
  if (isNaN(attachmentId)) {
    return res.status(400).json({ code: 'invalid_id', message: 'Attachment ID must be a valid integer' });
  }

  try {
    const attachment = await Attachment.scope('active').findByPk(attachmentId);

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

    if (attachment.fileSize <= MAX_STREAMING_SIZE) {
      const stream = await storageService.getFileStream(attachment.storageKey);

      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.fileName)}"`);
      res.setHeader('Content-Length', attachment.fileSize);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', 'sandbox; default-src \'none\';');

      await new Promise<void>((resolve) => {
        stream.on('end', () => {
          resolve();
        });

        stream.on('error', (error: Error) => {
          logger.error(`Opus preview stream error: attachmentId=${attachmentId}, error=${error.message}`, { userId: req.user.id });
          if (!res.headersSent) {
            res.status(500).json({ code: 'internal_error', message: 'Failed to preview attachment' });
          }
          resolve();
        });

        stream.pipe(res);
      });
      return;
    } else {
      const presignedUrl = await storageService.getPresignedUrl(attachment.storageKey, PRESIGNED_URL_EXPIRY);
      return res.redirect(302, presignedUrl);
    }

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
    const attachment = await Attachment.scope('active').findByPk(attachmentId);

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

    if (attachment.fileSize <= MAX_STREAMING_SIZE) {
      const stream = await storageService.getFileStream(attachment.storageKey);

      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.fileName)}"`);
      res.setHeader('Content-Length', attachment.fileSize);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', 'sandbox; default-src \'none\';');

      await new Promise<void>((resolve) => {
        stream.on('end', () => { resolve(); });
        stream.on('error', (error: Error) => {
          logger.error(`Opus public preview stream error: attachmentId=${attachmentId}, error=${error.message}`);
          if (!res.headersSent) {
            res.status(500).json({ code: 'internal_error', message: 'Failed to preview attachment' });
          }
          resolve();
        });
        stream.pipe(res);
      });
      return;
    } else {
      const presignedUrl = await storageService.getPresignedUrl(attachment.storageKey, PRESIGNED_URL_EXPIRY);
      return res.redirect(302, presignedUrl);
    }

  } catch (error: any) {
    logger.error(`Opus public preview failed: id=${id}, error=${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Failed to preview attachment' });
  }
}

router.get('/opus/attachments/:id/preview', hasAnyRole(['user', 'external-user']), previewOpusAttachment);
router.get('/opus/attachments/:id/public', publicPreviewOpusAttachment);

export default router;
