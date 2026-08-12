import { Request, Response, Router } from 'express';
import { Attachment, AttachmentEntityType, User } from '@jiku/models';
import { canUserViewEntity } from '../utils/attachments-access';
import logger from '../logger';
import validateToken from '../utils/middlewares/validate-token';

const router: Router = Router();

async function listAttachments(req: Request, res: Response) {
  const { entityType, entityId } = req.query;

  if (!entityType || !entityId) {
    return res.status(400).json({ code: 'invalid_query', message: 'entityType and entityId are required' });
  }

  if (!Object.values(AttachmentEntityType).includes(entityType as AttachmentEntityType)) {
    return res.status(400).json({
      code: 'invalid_entity_type',
      message: `entityType must be one of: ${Object.values(AttachmentEntityType).join(', ')}`
    });
  }

  const entityIdNum = parseInt(entityId as string);
  if (isNaN(entityIdNum)) {
    return res.status(400).json({ code: 'invalid_entity_id', message: 'entityId must be a valid integer' });
  }

  try {
    const hasAccess = await canUserViewEntity(req.user.id, req.decodedTokenRoles, entityType as string, entityIdNum);
    if (!hasAccess) {
      return res.status(403).json({ code: 'access_denied', message: 'You do not have permission to view attachments of this entity' });
    }

    const attachments = await Attachment.scope('active').findAll({
      where: { entityType: entityType as AttachmentEntityType, entityId: entityIdNum },
      attributes: { exclude: ['checksum'] },
      include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json(attachments);

  } catch (error: any) {
    logger.error(`List attachments failed: ${error.message}`, { entityType, entityId, userId: req.user.id });
    return res.status(500).json({ code: 'internal_error', message: 'Failed to list attachments' });
  }
}

async function getAttachmentById(req: Request, res: Response) {
  const { id } = req.params;

  const attachmentId = parseInt(id as string);
  if (isNaN(attachmentId)) {
    return res.status(400).json({ code: 'invalid_id', message: 'Attachment ID must be a valid integer' });
  }

  try {
    const attachment = await Attachment.scope('active').findByPk(attachmentId, {
      attributes: { exclude: ['checksum'] },
      include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }]
    });

    if (!attachment) {
      return res.status(404).json({ code: 'not_found', message: 'Attachment not found' });
    }

    const hasAccess = await canUserViewEntity(
      req.user.id,
      req.decodedTokenRoles,
      attachment.entityType,
      attachment.entityId
    );

    if (!hasAccess) {
      return res.status(403).json({ code: 'access_denied', message: 'You do not have permission to view this attachment' });
    }

    return res.status(200).json(attachment);

  } catch (error: any) {
    logger.error(`Get attachment failed: id=${id}, error=${error.message}`, { userId: req.user.id });
    return res.status(500).json({ code: 'internal_error', message: 'Failed to get attachment' });
  }
}

router.get('/attachments', validateToken, listAttachments);
router.get('/attachments/:id', validateToken, getAttachmentById);

export default router;
