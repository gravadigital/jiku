import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateBodyFields from '../utils/validate-body-fields';

const router: Router = Router();

// Sin cuerpo (Express 5 deja `req.body` en undefined) o `{}`; cualquier clave es 400.
const CONFIRM_SCHEMA = joi.object({}).strict();

async function confirmAttachment(req: Request, res: Response) {
  const id = String(req.params.id);
  // El `id` entra al subject: se valida antes del bus (ADR-002).
  if (!isUlid(id)) return respondDocsNotFound(res, 'attachment_not_found');

  try {
    const data = await moduleCommand(res, 'docs', `attachments.${id}.confirm`, {});
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`POST /api/docs/attachments/:id/confirm confirmAttachment error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Confirm attachment upload
 * @description Confirma la subida de un adjunto ya enviado a `uploadUrl` (REQ-016, ruta 16).
 * @route {POST} /api/docs/attachments/:id/confirm
 * @response {200} OK - `{ id, status: 'ready' }`
 * @response {400} Invalid fields / checksum_mismatch / upload_not_found
 * @response {403} Access denied
 * @response {404} Attachment not found
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.post('/docs/attachments/:id/confirm', requireModule('docs'), hasAnyRole(['admin', 'user']), validateBodyFields(CONFIRM_SCHEMA), confirmAttachment);

export default router;
