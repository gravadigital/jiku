import { Request, Response, Router, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import path from 'path';
import { Attachment, AttachmentEntityType, Requirement, UserProjectPermission } from '@jiku/models';
import storageService, { STORAGE_KEY_PREFIX } from '../utils/storage-service';
import logger from '../logger';
import upload from '../utils/multer-config';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateObjective from '../utils/middlewares/validate-objective';
import validateProjectPermissions from '../utils/middlewares/validate-project-permission';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from './attachments-post';

const router: Router = Router();

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
];

const ALLOWED_OPUS_ENTITY_TYPES: AttachmentEntityType[] = [
  AttachmentEntityType.CommentDraft,
  AttachmentEntityType.RequirementCommentDraft,
  AttachmentEntityType.Objective,
  AttachmentEntityType.ObjectiveDraft,
  AttachmentEntityType.Requirement,
  AttachmentEntityType.RequirementDraft,
];

function validateEntityType(req: Request, res: Response, next: NextFunction) {
  const { entityType, entityId } = req.body;

  if (!entityType) {
    return res.status(400).json({ code: 'invalid_fields', message: '"entityType" is required' });
  }

  if (!ALLOWED_OPUS_ENTITY_TYPES.includes(entityType as AttachmentEntityType)) {
    return res.status(400).json({ code: 'invalid_entity_type', message: `"entityType" must be one of: ${ALLOWED_OPUS_ENTITY_TYPES.join(', ')}` });
  }

  if (!entityId) {
    return res.status(400).json({ code: 'invalid_fields', message: '"entityId" is required' });
  }

  return next();
}

// For objective_draft and requirement_draft: entityId is projectId — validate project permission directly.
// For requirement: entityId is requirementId — lookup projectId then validate permission.
// For comment_draft and objective: entityId is objectiveId — use validateObjective + validateProjectPermissions.
function validateUploadPermissions(req: Request, res: Response, next: NextFunction) {
  const { entityType, entityId } = req.body;

  const isDraft = entityType === AttachmentEntityType.ObjectiveDraft
    || entityType === AttachmentEntityType.RequirementDraft;

  if (isDraft) {
    if (!req.decodedTokenRoles.includes('external-user')) {
      return next();
    }
    return UserProjectPermission.findOne({
      where: { userId: req.user.id, projectId: Number(entityId) }
    })
      .then((permission) => {
        if (!permission) {
          return res.status(403).json({ code: 'access_denied', message: 'Access denied for this project.' });
        }
        return next();
      })
      .catch((error: Error) => {
        logger.error(`POST /opus/attachments validateUploadPermissions error: ${error.message}`);
        return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
      });
  }

  if (entityType === AttachmentEntityType.Requirement) {
    return Requirement.findByPk(Number(entityId), { attributes: ['projectId'] })
      .then((requirement) => {
        if (!requirement) {
          return res.status(404).json({ code: 'not_found', message: 'Requirement not found' });
        }
        if (!req.decodedTokenRoles.includes('external-user')) {
          return next();
        }
        return UserProjectPermission.findOne({
          where: { userId: req.user.id, projectId: requirement.projectId }
        }).then((permission) => {
          if (!permission) {
            return res.status(403).json({ code: 'access_denied', message: 'Access denied for this project.' });
          }
          return next();
        });
      })
      .catch((error: Error) => {
        logger.error(`POST /opus/attachments validateUploadPermissions (requirement) error: ${error.message}`);
        return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
      });
  }

  if (entityType === AttachmentEntityType.RequirementCommentDraft) {
    return Requirement.findByPk(Number(entityId), { attributes: ['projectId'] })
      .then((requirement) => {
        if (!requirement) {
          return res.status(404).json({ code: 'not_found', message: 'Requirement not found' });
        }
        if (!req.decodedTokenRoles.includes('external-user')) {
          return next();
        }
        return UserProjectPermission.findOne({
          where: { userId: req.user.id, projectId: requirement.projectId }
        }).then((permission) => {
          if (!permission) {
            return res.status(403).json({ code: 'access_denied', message: 'Access denied for this project.' });
          }
          return next();
        });
      })
      .catch((error: Error) => {
        logger.error(`POST /opus/attachments validateUploadPermissions (requirementCommentDraft) error: ${error.message}`);
        return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
      });
  }

  // comment_draft and objective: set objid param and delegate to validateObjective chain
  req.params.objid = String(entityId);
  return next();
}

function multerErrorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ code: 'upload_failed', message: 'File size exceeds maximum of 10MB' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ code: 'upload_failed', message: 'Too many files. Maximum is 10 files per request' });
    }
    return res.status(400).json({ code: 'upload_failed', message: err.message });
  }
  return next(err);
}

// Only run validateObjective when entityType is objective or comment_draft (not drafts or requirement)
function conditionalValidateObjective(req: Request, res: Response, next: NextFunction) {
  const skipTypes = [
    AttachmentEntityType.ObjectiveDraft,
    AttachmentEntityType.RequirementDraft,
    AttachmentEntityType.Requirement,
    AttachmentEntityType.RequirementCommentDraft,
  ];
  if (skipTypes.includes(req.body.entityType as AttachmentEntityType)) {
    return next();
  }
  return validateObjective(req, res, next);
}

// Only run validateProjectPermissions when entityType is objective or comment_draft (not drafts or requirement)
function conditionalValidateProjectPermissions(req: Request, res: Response, next: NextFunction) {
  const skipTypes = [
    AttachmentEntityType.ObjectiveDraft,
    AttachmentEntityType.RequirementDraft,
    AttachmentEntityType.Requirement,
    AttachmentEntityType.RequirementCommentDraft,
  ];
  if (skipTypes.includes(req.body.entityType as AttachmentEntityType)) {
    return next();
  }
  return validateProjectPermissions(req, res, next);
}

async function uploadOpusAttachments(req: Request, res: Response) {
  const { entityType, entityId } = req.body;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ code: 'no_files', message: 'At least one file is required' });
  }

  const parsedEntityId = parseInt(entityId, 10);
  const createdAttachments: Attachment[] = [];
  const uploadedKeys: string[] = [];

  try {
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        throw { code: 'upload_failed', message: `File ${file.originalname} exceeds maximum size of 10MB` };
      }

      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw { code: 'upload_failed', message: `File type "${ext}" is not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}` };
      }

      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw { code: 'upload_failed', message: `MIME type "${file.mimetype}" is not allowed` };
      }

      const uuid = uuidv4();
      const storageKey = `${STORAGE_KEY_PREFIX}/${entityType}/${parsedEntityId}/${uuid}${ext}`;
      const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

      const uploadResult = await storageService.uploadFromBuffer(storageKey, file.buffer, file.mimetype);
      uploadedKeys.push(storageKey);

      const attachment = await Attachment.create({
        entityType,
        entityId: parsedEntityId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storageKey,
        storageBucket: uploadResult.bucket,
        storageRegion: uploadResult.region,
        uploadedBy: req.user.id,
        checksum,
      });

      createdAttachments.push(attachment);
    }

    return res.status(201).json(createdAttachments);

  } catch (error: any) {
    for (const key of uploadedKeys) {
      try {
        await storageService.deleteFile(key);
        logger.warn(`Rolled back uploaded file: ${key}`);
      } catch (rollbackError: any) {
        logger.error(`Failed to rollback file ${key}: ${rollbackError.message}`);
      }
    }

    logger.error(`POST /opus/attachments failed: ${error.message}`, { userId: req.user?.id, entityType, entityId });

    const errorCodes = ['upload_failed', 'no_files', 'invalid_fields', 'invalid_entity_type'];
    const statusCode = errorCodes.includes(error.code) ? 400 : 500;

    return res.status(statusCode).json({
      code: error.code || 'internal_error',
      message: error.message || 'Internal error'
    });
  }
}

router.post('/opus/attachments',
  hasAnyRole(['user', 'external-user']),
  upload.array('files', 10),
  multerErrorHandler,
  validateEntityType,
  validateUploadPermissions,
  conditionalValidateObjective,
  conditionalValidateProjectPermissions,
  uploadOpusAttachments
);

export default router;
