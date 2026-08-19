import { Request, Response, Router } from 'express';
import { Attachment, AttachmentEntityType, File, User } from '@jiku/models';
import { canUserViewEntity } from '../utils/attachments-access';
import logger from '../logger';
import validateToken from '../utils/middlewares/validate-token';

const router: Router = Router();

/**
 * El `include` que resuelve los campos del archivo (REQ-001, S-005).
 *
 * Las columnas homónimas de `attachments` siguen existiendo por compatibilidad, pero después
 * del backfill son un espejo que puede divergir del `File` real —y `byte_status` ni siquiera
 * existe en `attachments`, aunque el contrato lo declare—. La verdad está en `files`.
 */
const FILE_INCLUDE = [
  {
    model: File,
    as: 'file',
    // El `uploader` cuelga del ARCHIVO, no del vínculo. Resolverlo desde
    // `attachments.uploaded_by` haría que `uploadedBy` (que sale de `files`) y `uploader`
    // pudieran describir a DOS PERSONAS DISTINTAS en cuanto las columnas divergieran: hoy
    // coinciden solo porque el backfill copió el valor, y esa igualdad no está garantizada
    // hacia adelante.
    include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }],
  },
];

/**
 * La respuesta se mantiene APLANADA a propósito, y no es negociable: los tipos de web y
 * opus-web están escritos a mano y NO fallan en compilación si divergen. Anidar el archivo
 * obligaría a tocar todos los consumidores por un beneficio de forma, y el modo de fallo
 * sería en runtime, sin nada que lo delate.
 *
 * `checksum` sigue fuera de la respuesta, como con el `attributes: { exclude }` de antes.
 * `retentionStatus` y `deletedAt` del archivo NO se exponen: el spec no los declara y el
 * estado de retención por el listado es superficie que nadie pidió.
 */
function flattenAttachment(attachment: any) {
  const file = attachment.file;
  return {
    id: attachment.id,
    entityType: attachment.entityType,
    entityId: attachment.entityId,
    fileId: attachment.fileId,
    fileName: file?.fileName,
    fileSize: file?.fileSize,
    mimeType: file?.mimeType,
    storageKey: file?.storageKey,
    storageBucket: file?.storageBucket,
    storageRegion: file?.storageRegion,
    // `uploadedBy` sale del ARCHIVO, no del vínculo: son la misma persona hoy solo porque
    // el backfill copió el valor, y esa igualdad no está garantizada hacia adelante.
    uploadedBy: file?.uploadedBy,
    byteStatus: file?.byteStatus,
    uploader: file?.uploader,
    // Campos PROPIOS DEL VÍNCULO que ya salían en la respuesta y se conservan tal cual. No
    // son del archivo: `retentionStatus` acá es el del vínculo, no el de `files` —el estado
    // de retención del archivo NO se expone, el spec no lo declara—. Se mantienen porque los
    // tipos de web (`description`) y opus-web (`retentionStatus`, `updatedAt`) los declaran
    // NO opcionales, y esos tipos están escritos a mano: sacarlos no rompería la compilación
    // de nadie y aparecería en runtime, que es el modo de fallo específico de este servicio.
    description: attachment.description,
    retentionStatus: attachment.retentionStatus,
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
  };
}

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

    // El WHERE sigue siendo sobre `attachments`: el vínculo es lo que se filtra por entidad.
    // Los campos del archivo salen del `include`.
    const attachments = await Attachment.scope('active').findAll({
      where: { entityType: entityType as AttachmentEntityType, entityId: entityIdNum },
      include: FILE_INCLUDE,
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json(attachments.map(flattenAttachment));

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
    // Sigue recibiendo el id DEL VÍNCULO (D-16); el archivo sale del `include`.
    const attachment = await Attachment.scope('active').findByPk(attachmentId, {
      include: FILE_INCLUDE
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

    return res.status(200).json(flattenAttachment(attachment));

  } catch (error: any) {
    logger.error(`Get attachment failed: id=${id}, error=${error.message}`, { userId: req.user.id });
    return res.status(500).json({ code: 'internal_error', message: 'Failed to get attachment' });
  }
}

router.get('/attachments', validateToken, listAttachments);
router.get('/attachments/:id', validateToken, getAttachmentById);

export default router;
