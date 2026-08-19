import { Request, Response, Router } from 'express';
import { Attachment } from '@jiku/models';
import { canUserAccessEntity } from '../utils/attachments-access';
import { runCommand } from '../utils/bus/send-command';
import logger from '../logger';
import validateToken from '../utils/middlewares/validate-token';

const router: Router = Router();

/**
 * Desvincula un archivo de una entidad. AUTORIZA Y PUBLICA; NO ESCRIBE (REQ-001, S-004).
 *
 * DOS CAMBIOS DE COMPORTAMIENTO OBSERVABLES, los dos deliberados:
 *
 * 1. QUÉ SE BORRA. Antes marcaba la fila y —según el contrato viejo— también borraba el objeto
 *    del bucket. Ahora borra SOLO EL VÍNCULO; el archivo se retiene (D-04). Un `File` tiene
 *    0..N vínculos: borrar el objeto al desvincular rompería los otros.
 *
 * 2. QUIÉN AUTORIZA Y CÓMO. Antes: `isAdmin || uploadedBy === req.user.id`, o sea titularidad
 *    sobre el ADJUNTO. Ahora: `canUserAccessEntity` sobre la ENTIDAD del vínculo.
 *    EL CRITERIO VIEJO YA ESTABA ROTO, no se degrada nada: la migración `20260819_05` dropeó
 *    `attachments.uploaded_by`, así que contra producción ese `attachment.uploadedBy` es
 *    `undefined` y solo "funcionaba" en los tests, donde `sync()` recrea la columna desde el
 *    modelo compartido. Si alguna vez se quiere reponer la titularidad como control adicional,
 *    la fuente correcta es `file.uploadedBy` (vía el `include`), no la del vínculo — pero
 *    ningún CA lo pide y agregarlo haría que un caso legítimo (alguien del proyecto desvincula
 *    un archivo que subió otro) empiece a dar 403 sin ningún test que lo declare esperado.
 *
 * ES UN COMANDO Y NO UNA ESCRITURA DIRECTA porque era la TERCERA escritura implícita de la api
 * (`softDelete()` es un `UPDATE` con el ORM). Dejarla afuera reabriría por otra puerta la
 * excepción 2 de ADR-001 que esta story cierra.
 */
async function deleteAttachment(req: Request, res: Response) {
  const attachmentId = parseInt(req.params.id as string);
  if (isNaN(attachmentId)) {
    return res.status(400).json({ code: 'invalid_id', message: 'Attachment ID must be a valid integer' });
  }

  // Se resuelve el vínculo para AUTORIZAR sobre su entidad. EL ORDEN ES EL CRITERIO DE
  // ACEPTACIÓN, no un detalle de estilo: el 404 y el 403 tienen que salir ANTES de publicar. Un
  // handler que publique primero y autorice después pasaría los tests de status igual, pero le
  // habría pedido a core que borre algo que el usuario no puede tocar.
  let attachment: Attachment | null;
  try {
    attachment = await Attachment.scope('active').findByPk(attachmentId);
  } catch (error: any) {
    logger.error(`Delete failed: id=${attachmentId}, error=${error.message}`, { userId: req.user.id });
    return res.status(500).json({ code: 'internal_error', message: 'Failed to delete attachment' });
  }

  if (!attachment) {
    logger.warn(`Delete denied: attachment not found, id=${attachmentId}, userId=${req.user.id}`);
    return res.status(404).json({ code: 'not_found', message: 'Attachment not found' });
  }

  // `entityId` es NOT NULL en la base desde S-001 (D-01: no hay drafts, todo vínculo tiene su
  // entidad), pero el MODELO COMPARTIDO todavía lo declara `number | null` — `@jiku/models` es
  // de core también (ADR-005) y esta story no lo toca. El guard existe para no autorizar contra
  // un `entityId` ausente: sin él, un `canUserAccessEntity(..., null)` decidiría el permiso
  // sobre una entidad que no existe, que es exactamente el agujero que no queremos abrir al
  // desvincular. Si la fila apareciera igual, es un dato imposible: 404, no acceso.
  if (attachment.entityId === null) {
    logger.error(`Delete denied: vínculo sin entityId, id=${attachmentId}`, { userId: req.user.id });
    return res.status(404).json({ code: 'not_found', message: 'Attachment not found' });
  }

  let hasAccess: boolean;
  try {
    hasAccess = await canUserAccessEntity(
      req.user.id,
      req.decodedTokenRoles,
      attachment.entityType,
      attachment.entityId
    );
  } catch (error: any) {
    logger.error(`Delete failed: id=${attachmentId}, error=${error.message}`, { userId: req.user.id });
    return res.status(500).json({ code: 'internal_error', message: 'Failed to delete attachment' });
  }

  if (!hasAccess) {
    logger.warn(`Delete denied: access denied, attachmentId=${attachmentId}, userId=${req.user.id}`);
    return res.status(403).json({ code: 'access_denied', message: 'No tenés permiso para desvincular este archivo' });
  }

  // `runCommand` y no `sendCommand`: el reply de un borrado no trae `data`, y un `sendCommand`
  // exitoso sin `data` devuelve `null`, indistinguible de un error.
  //
  // El `{id}` del subject es el del VÍNCULO, al revés que `files.{fileId}.request-download`.
  // El nombre del comando lo dice a propósito. El payload va vacío: el id viaja en el subject.
  const ok = await runCommand(res, `attachments.${attachmentId}.delete`, {});
  if (!ok) return;

  // `Acknowledgement` (`{ code, message }`), que es lo que declara el spec. DESAPARECIERON
  // `deletedAt` y `scheduledPermanentDeletion`: describían un borrado diferido con período de
  // gracia que ya no ocurre —core borra la fila—, y prometer una fecha de borrado permanente
  // que nadie va a ejecutar es peor que no devolverla.
  return res.status(200).json({ code: 'attachment_unlinked', message: 'Archivo desvinculado' });
}

// El `validateToken` explícito es redundante con el global que instala `app.ts`, y se conserva:
// quitarlo es un cambio ortogonal a esta story y sin ningún test que lo respalde.
router.delete('/attachments/:id', validateToken, deleteAttachment);

export default router;
