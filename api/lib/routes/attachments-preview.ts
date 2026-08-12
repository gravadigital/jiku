import { Request, Response, Router } from 'express';
import { Attachment } from '@jiku/models';
import storageService from '../utils/storage-service';
import { canUserViewEntity } from '../utils/attachments-access';
import logger from '../logger';
import validateToken from '../utils/middlewares/validate-token';

const router: Router = Router();

const MAX_STREAMING_SIZE = 15 * 1024 * 1024; // 15MB
const PRESIGNED_URL_EXPIRY = 60;             // segundos

async function previewAttachment(req: Request, res: Response) {
  const { id } = req.params;

  const attachmentId = parseInt(id as string);
  if (isNaN(attachmentId)) {
    return res.status(400).json({ code: 'invalid_id', message: 'Attachment ID must be a valid integer' });
  }

  try {
    const attachment = await Attachment.scope('active').findByPk(attachmentId);

    if (!attachment) {
      logger.warn(`Preview denied: attachment not found, attachmentId=${attachmentId}, userId=${req.user.id}`);
      return res.status(404).json({ code: 'not_found', message: 'Attachment not found' });
    }

    const hasAccess = await canUserViewEntity(
      req.user.id,
      req.decodedTokenRoles,
      attachment.entityType,
      attachment.entityId
    );

    if (!hasAccess) {
      logger.warn(`Preview denied: access denied, attachmentId=${attachmentId}, userId=${req.user.id}`);
      return res.status(403).json({ code: 'access_denied', message: 'You do not have permission to preview this attachment' });
    }

    if (attachment.fileSize <= MAX_STREAMING_SIZE) {
      // Streaming directo para archivos ≤15MB
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
          logger.error(`Preview stream error: attachmentId=${attachmentId}, error=${error.message}`, { userId: req.user.id });
          if (!res.headersSent) {
            res.status(500).json({ code: 'internal_error', message: 'Failed to preview attachment' });
          }
          resolve();
        });

        stream.pipe(res);
      });
      return;
    } else {
      // Presigned URL para archivos >15MB
      const presignedUrl = await storageService.getPresignedUrl(attachment.storageKey, PRESIGNED_URL_EXPIRY);

      return res.redirect(302, presignedUrl);
    }

  } catch (error: any) {
    logger.error(`Preview failed: id=${id}, error=${error.message}`, { userId: req.user.id });
    return res.status(500).json({ code: 'internal_error', message: 'Failed to preview attachment' });
  }
}

router.get('/attachments/:id/preview', validateToken, previewAttachment);

export default router;
