import { Request, Response, Router } from 'express';
import { Attachment } from '@jiku/models';
import storageService from '../utils/storage-service';
import { canUserViewEntity } from '../utils/attachments-access';
import logger from '../logger';
import validateToken from '../utils/middlewares/validate-token';

const router: Router = Router();

function downloadAttachment(req: Request, res: Response) {
  const attachmentId = parseInt(req.params.id as string);
  if (isNaN(attachmentId)) {
    res.status(400).json({ code: 'invalid_id', message: 'Attachment ID must be a valid integer' });
    return;
  }

  Attachment.scope('active').findByPk(attachmentId)
    .then((attachment) => {
      if (!attachment) {
        logger.warn(`Download denied: attachment not found, id=${attachmentId}, userId=${req.user.id}`);
        res.status(404).json({ code: 'not_found', message: 'Attachment not found' });
        return;
      }

      canUserViewEntity(req.user.id, req.decodedTokenRoles, attachment.entityType, attachment.entityId)
        .then((hasAccess) => {
          if (!hasAccess) {
            logger.warn(`Download denied: access denied, attachmentId=${attachmentId}, userId=${req.user.id}`);
            res.status(403).json({ code: 'access_denied', message: 'You do not have permission to download this attachment' });
            return;
          }

          storageService.getFileStream(attachment.storageKey)
            .then((stream) => {
              res.setHeader('Content-Type', attachment.mimeType);
              res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
              res.setHeader('Content-Length', attachment.fileSize);

              stream.on('end', () => {});
              stream.on('error', (error: Error) => {
                logger.error(`Download stream error: attachmentId=${attachmentId}, error=${error.message}`, { userId: req.user.id });
                if (!res.headersSent) {
                  res.status(500).json({ code: 'stream_error', message: 'Failed to download file' });
                }
              });
              stream.pipe(res);
            })
            .catch((error: any) => {
              logger.error(`Download failed: id=${attachmentId}, error=${error.message}`, { userId: req.user.id });
              res.status(500).json({ code: 'internal_error', message: 'Failed to download attachment' });
            });
        })
        .catch((error: any) => {
          logger.error(`Download failed: id=${attachmentId}, error=${error.message}`, { userId: req.user.id });
          res.status(500).json({ code: 'internal_error', message: 'Failed to download attachment' });
        });
    })
    .catch((error: any) => {
      logger.error(`Download failed: id=${attachmentId}, error=${error.message}`, { userId: req.user.id });
      res.status(500).json({ code: 'internal_error', message: 'Failed to download attachment' });
    });
}

router.get('/attachments/:id/download', validateToken, downloadAttachment);
export default router;
