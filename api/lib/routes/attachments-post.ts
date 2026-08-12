import { Request, Response, Router, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import path from 'path';
import { Attachment, AttachmentEntityType } from '@jiku/models';
import { canUserAccessEntity } from '../utils/attachments-access';
import storageService, { STORAGE_KEY_PREFIX } from '../utils/storage-service';
import logger from '../logger';
import upload from '../utils/multer-config';

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

export const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function uploadAttachments(req: Request, res: Response) {
  const { entityType, entityId, description } = req.body;
  const files = req.files as Express.Multer.File[];

  if (!entityType) {
    return res.status(400).json({ code: 'invalid_fields', message: '"entityType" is required' });
  }

  if (!Object.values(AttachmentEntityType).includes(entityType as AttachmentEntityType)) {
    return res.status(400).json({ code: 'invalid_entity_type', message: `"entityType" must be one of: ${Object.values(AttachmentEntityType).join(', ')}` });
  }

  // requirement_draft puede subirse sin entidad: el requisito aún no existe y el
  // draft se ancla al usuario autenticado (uploaded_by). Para el resto de tipos
  // entityId sigue siendo obligatorio.
  const isUserAnchoredDraft = entityType === AttachmentEntityType.RequirementDraft;

  if (!entityId && !isUserAnchoredDraft) {
    return res.status(400).json({ code: 'invalid_fields', message: '"entityId" is required' });
  }

  if (!files || files.length === 0) {
    return res.status(400).json({ code: 'no_files', message: 'At least one file is required' });
  }

  const parsedEntityId = entityId ? parseInt(entityId, 10) : null;

  // El acceso por entidad sólo aplica cuando hay una entidad concreta. Para un
  // draft anclado al usuario, el JWT ya garantiza la pertenencia.
  if (parsedEntityId !== null) {
    const hasAccess = await canUserAccessEntity(req.user.id, req.decodedTokenRoles, entityType, parsedEntityId);
    if (!hasAccess) {
      return res.status(403).json({
        code: 'access_denied',
        message: 'You do not have permission to attach files to this entity'
      });
    }
  }

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
      const storageKey = `${STORAGE_KEY_PREFIX}/${entityType}/${parsedEntityId ?? 'draft'}/${uuid}${ext}`;

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
        description: description || null,
        checksum
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

    logger.error(`Upload attachments failed: ${error.message}`, { userId: req.user?.id, entityType, entityId });

    const errorCodes = ['upload_failed', 'no_files', 'invalid_fields', 'invalid_entity_type'];
    const statusCode = errorCodes.includes(error.code) ? 400 : 500;

    return res.status(statusCode).json({
      code: error.code || 'internal_error',
      message: error.message || 'Internal error'
    });
  }
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

router.post('/attachments', upload.array('files', 10), uploadAttachments);
router.use(multerErrorHandler);

export default router;
