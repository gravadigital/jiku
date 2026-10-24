import { Request, Response, Router } from 'express';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { isUlid, respondDocsNotFound } from '../modules/docs/ids';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';

const router: Router = Router();

async function revokeShare(req: Request, res: Response) {
  const id = String(req.params.id);
  // El `id` entra al subject (`shares.{id}.revoke`): se valida antes del bus (ADR-002).
  if (!isUlid(id)) return respondDocsNotFound(res, 'share_not_found');

  try {
    // Sin chequeo de `sharing`: revocar un link existente tiene que seguir siendo posible aunque la
    // instalación deje de publicar links (P-7).
    const data = await moduleCommand(res, 'docs', `shares.${id}.revoke`, {});
    if (!data) return;
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`DELETE /api/docs/shares/:id revokeShare error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Revoke document share
 * @description Revoca un link compartido (REQ-016, ruta 20). El path es todo su input.
 * @route {DELETE} /api/docs/shares/:id
 * @response {200} OK - `{ id, revokedAt }`
 * @response {403} Access denied
 * @response {404} Share not found
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.delete('/docs/shares/:id', requireModule('docs'), hasAnyRole(['admin', 'user']), revokeShare);

export default router;
