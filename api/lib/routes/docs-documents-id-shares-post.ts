import { Request, Response, Router } from 'express';
import joi from 'joi';
import { generateUlid } from '@jiku/nats-protocol';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { docsFeatures } from '../modules/docs/features';
import { isUlid, joiUlid, respondDocsNotFound } from '../modules/docs/ids';
import { pickDefined } from '../modules/docs/query';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateBodyFields from '../utils/validate-body-fields';

const router: Router = Router();

// Forma, no dominio (P-3): `version` con `pinned` y el rango de `expiresAt` los valida jiku-docs.
const CREATE_SHARE_SCHEMA = joi.object({
  id: joiUlid(),
  mode: joi.string().valid('latest', 'pinned').required(),
  version: joi.number().integer().min(1),
  expiresAt: joi.string().isoDate().required(),
  includeAttachments: joi.boolean(),
  note: joi.string(),
  acknowledgeSecretWarning: joi.boolean(),
}).strict();

async function createShare(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  // DD-14: crear un link que la api después no sirve (/p/docs/*) sería entregar un link roto.
  // Se reusa `docsFeatures()` para no divergir de `features.sharing` de GET /modules (DD-13).
  if (!docsFeatures().sharing) {
    return res.status(404).json({ code: 'sharing_not_configured', message: 'Los links compartidos no están configurados' });
  }

  try {
    const data = await moduleCommand(res, 'docs', 'shares.new', {
      id: req.body.id ?? generateUlid(), // DD-8
      documentId: id,
      ...pickDefined(req.body, ['mode', 'version', 'expiresAt', 'includeAttachments', 'note', 'acknowledgeSecretWarning']),
    });
    if (!data) return;
    return res.status(201).json(data);
  } catch (error: any) {
    // `token` y `url` aparecen solo en esta respuesta y nunca se loguean.
    logger.error(`POST /api/docs/documents/:id/shares createShare error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Create document share
 * @description Crea un link compartido; el `token` y la `url` solo se devuelven acá (REQ-016, ruta 19, CA-S9).
 * @route {POST} /api/docs/documents/:id/shares
 * @bodyparam {string} [id] - ULID de alta; si falta lo genera la api
 * @bodyparam {string} mode - latest | pinned
 * @bodyparam {number} [version] - Obligatoria con `pinned` (la valida jiku-docs)
 * @bodyparam {string} expiresAt - ISO 8601, futuro y como máximo 180 días
 * @bodyparam {boolean} [includeAttachments]
 * @bodyparam {string} [note]
 * @bodyparam {boolean} [acknowledgeSecretWarning]
 * @response {201} Created - `{ id, token, url, expiresAt }`
 * @response {400} Invalid fields / share_expiry_invalid / secret_warning_not_acknowledged
 * @response {403} Access denied / sharing_blocked
 * @response {404} Document not found / sharing_not_configured
 * @response {409} already_exists
 * @response {503} Module unavailable
 * @response {504} Gateway timeout
 */
router.post('/docs/documents/:id/shares', requireModule('docs'), hasAnyRole(['admin', 'user']), validateBodyFields(CREATE_SHARE_SCHEMA), createShare);

export default router;
