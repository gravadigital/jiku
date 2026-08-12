import { Request, Response, Router } from 'express';
import { Attachment } from '@jiku/models';
import logger from '../logger';
import validateToken from '../utils/middlewares/validate-token';

const router: Router = Router();
const GRACE_PERIOD_DAYS = 7;

function deleteAttachment(req: Request, res: Response) {
  const attachmentId = parseInt(req.params.id as string);
  if (isNaN(attachmentId)) {
    res.status(400).json({ code: 'invalid_id', message: 'Attachment ID must be a valid integer' });
    return;
  }

  Attachment.scope('active').findByPk(attachmentId)
    .then((attachment) => {
      if (!attachment) {
        logger.warn(`Delete denied: attachment not found, id=${attachmentId}, userId=${req.user.id}`);
        res.status(404).json({ code: 'not_found', message: 'Attachment not found' });
        return;
      }

      const isAdmin = req.decodedTokenRoles?.includes('admin');
      const isUploader = attachment.uploadedBy === req.user.id;

      if (!isAdmin && !isUploader) {
        logger.warn(`Delete denied: not authorized, attachmentId=${attachmentId}, userId=${req.user.id}, uploadedBy=${attachment.uploadedBy}`);
        res.status(403).json({ code: 'access_denied', message: 'Only the uploader or admin can delete this attachment' });
        return;
      }

      const permanentDeletionDate = new Date();
      permanentDeletionDate.setDate(permanentDeletionDate.getDate() + GRACE_PERIOD_DAYS);

      attachment.softDelete(req.user.id)
        .then(() => {
          res.status(200).json({
            message: 'Attachment marked for deletion',
            attachmentId: attachment.id,
            deletedBy: req.user.id,
            deletedAt: attachment.deletedAt,
            scheduledPermanentDeletion: permanentDeletionDate.toISOString(),
          });
        })
        .catch((error: any) => {
          logger.error(`Delete failed: id=${attachmentId}, error=${error.message}`, { userId: req.user.id });
          res.status(500).json({ code: 'internal_error', message: 'Failed to delete attachment' });
        });
    })
    .catch((error: any) => {
      logger.error(`Delete failed: id=${attachmentId}, error=${error.message}`, { userId: req.user.id });
      res.status(500).json({ code: 'internal_error', message: 'Failed to delete attachment' });
    });
}

router.delete('/attachments/:id', validateToken, deleteAttachment);
export default router;
