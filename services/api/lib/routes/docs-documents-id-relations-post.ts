import { Request, Response, Router } from 'express';
import joi from 'joi';
import logger from '../logger';
import { moduleCommand } from '../modules/client';
import { isUlid, joiUlid, respondDocsNotFound } from '../modules/docs/ids';
import { pickDefined } from '../modules/docs/query';
import hasAnyRole from '../utils/middlewares/has-any-role';
import requireModule from '../utils/middlewares/require-module';
import validateBodyFields from '../utils/validate-body-fields';

const router: Router = Router();

const RELATION_IDS = () => joi.array().items(joi.number().integer().min(1)).max(100);
const RELATION_SET = joi.object({
  clients: RELATION_IDS(),
  projects: RELATION_IDS(),
  requirements: RELATION_IDS(),
  tasks: RELATION_IDS(),
});

// Forma, no dominio (P-3): "un id en add y remove a la vez" o "al menos un id" los valida
// jiku-docs (`invalid_fields`). Sin `via` ni `checksum`: `RelationsUpdate` no los declara y el
// origen se deriva de la clase del caller; mandarlos sería `invalid_fields`.
const RELATIONS_SCHEMA = joi.object({
  baseVersion: joi.number().integer().min(1).required(),
  add: RELATION_SET,
  remove: RELATION_SET,
  sessionId: joiUlid(),
}).or('add', 'remove').strict();

async function updateRelations(req: Request, res: Response) {
  const id = String(req.params.id);
  // El `id` entra al subject (`documents.{id}.relations.update`): se valida antes del bus (ADR-002).
  if (!isUlid(id)) return respondDocsNotFound(res, 'document_not_found');

  try {
    const data = await moduleCommand(
      res, 'docs', `documents.${id}.relations.update`,
      pickDefined(req.body, ['baseVersion', 'add', 'remove', 'sessionId'])
    );
    if (!data) return; // el embudo ya respondió (409 version_conflict / document_locked incluidos)
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error(`POST /api/docs/documents/:id/relations updateRelations error: ${error.message}`);
    return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
  }
}

/**
 * @name Update document relations
 * @description Agrega o quita relaciones (clientes, proyectos, requisitos, tareas) de un documento
 * con versión base (REQ-021 / S-094). Reescribe solo el bloque `jiku:` del frontmatter; jiku-docs
 * agrega el cliente de cada proyecto asignado. Requiere jiku-docs >= 1.3.0.
 * @route {POST} /api/docs/documents/:id/relations
 * @bodyparam {number} baseVersion - Versión sobre la que se edita
 * @bodyparam {object} [add] - `{ clients?, projects?, requirements?, tasks? }` (ids enteros, hasta 100)
 * @bodyparam {object} [remove] - Ídem; al menos uno de `add` o `remove`
 * @bodyparam {string} [sessionId] - ULID de la sesión que tiene el lock
 * @response {200} OK - `{ id, version, relations, warnings? }`
 * @response {400} Invalid fields / invalid_relation / frontmatter_invalid
 * @response {401} Unauthorized
 * @response {403} Access denied / permission_denied
 * @response {404} Document not found / module not installed
 * @response {409} version_conflict (details.currentVersion) / document_locked (details.holder, holderName, via, expiresAt)
 * @response {413} Payload too large
 * @response {503} Module unavailable / upstream_unavailable
 * @response {504} Gateway timeout
 */
router.post('/docs/documents/:id/relations', requireModule('docs'), hasAnyRole(['admin', 'user']), validateBodyFields(RELATIONS_SCHEMA), updateRelations);

export default router;
