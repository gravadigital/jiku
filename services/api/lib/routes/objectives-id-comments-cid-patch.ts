import { Router, Request, Response, NextFunction } from 'express';
import { Objective } from '@jiku/models';
import joi from 'joi';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateBodyFields from '../utils/validate-body-fields';
import { runCommand, actorId } from '../utils/bus/send-command';

const router: Router = Router();

const editSchema = joi.object({
  comment: joi.string().required(),
  // Ids de `files` ya subidos, NO de `attachments` (REQ-001, S-003): el vínculo lo crea core al
  // guardar la entidad. El `max(10)` es el `maxItems` que declara el spec — se valida acá para
  // que un lote de más no cueste un round-trip del bus antes de que core lo rechace igual.
  fileIds: joi.array().items(joi.number().integer().positive()).max(10).optional(),
  // `visibilityLevel` NO se declara (CA-4): es inmutable después de creado. `joi.object()`
  // sin `.unknown(true)` ya rechaza cualquier campo no declarado — no hace falta `.forbidden()`.
});

function findObjective(req: Request, res: Response, next: NextFunction) {
  return Objective.findByPk(req.params.id as string)
    .then((objectiveFound) => {
      if (!objectiveFound) {
        return res.status(400).json({
          code: 'objective_not_found',
          message: 'Objective not found'
        });
      }
      return next();
    })
    .catch((error) => {
      logger.error(`PATCH /api/objectives/:id/comment/:cid findObjective error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * La escritura la hace core (REQ-011, S-047): esta ruta escribía antes con
 * `ObjectiveActivity.update(...)` directo, una excepción no declarada a ADR-001. Ahora publica
 * `tasks.{id}.comment.{cid}.edit` y core valida tipo de actividad, autoría (o rol admin) y
 * escribe `newValue`, `editedAt`, `editedBy`. La identidad viaja en el sobre que inyecta
 * `runCommand`; el campo de dominio `editor` es solo para consistencia con las rutas hermanas.
 */
async function updateComment(req: Request, res: Response) {
  const ok = await runCommand(res, `tasks.${req.params.id}.comment.${req.params.cid}.edit`, {
    editor: actorId(req),
    comment: req.body.comment,
    ...(req.body.fileIds !== undefined ? { fileIds: req.body.fileIds } : {}),
  });
  if (!ok) {
    return;
  }

  return res.status(200).json({
    code: 'comment_updated',
    message: 'Comment Updated'
  });
}

/**
 * @name Update comment
 * @description Edita un comentario de una tarea. Publica `tasks.{id}.comment.{cid}.edit`;
 *   valida autoría (o rol admin) en core.
 * @route {PATCH} /api/objectives/:id/comment/:cid
 * @queryparam {number} [id] objective identifier
 * @queryparam {number} [cid] comment identifier
 * @bodyparam {string} [comment] (required) new comment text
 * @bodyparam {number[]} [fileIds] (optional) ids de archivos ya subidos, máx. 10
 * @response {200} OK
 * @responsebody {string} [code] comment_updated
 * @responsebody {string} [message] Comment Updated
 * @response {400} Validación fallida, la tarea o el comentario no existen, o la actividad no es un comentario editable
 * @response {403} No es el autor del comentario ni tiene rol admin, o algún fileId no le pertenece
 * @response {503} Bus caído
 * @response {504} Timeout del bus
 */

router.patch(
  '/objectives/:id/comment/:cid',
  hasAnyRole(['user', 'admin']),
  validateBodyFields(editSchema),
  findObjective,
  updateComment
);

export default router;
