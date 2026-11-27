import { Request, Response, Router } from 'express';
import joi from 'joi';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateRequirement from '../utils/middlewares/validate-requirement';
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

/**
 * Edita un comentario de un requisito. La escritura la hace core (REQ-011, S-047): cierra la
 * asimetría con la ruta de tareas, que hasta esta story era la única que podía editar.
 *
 * No hay relectura post-comando: es una edición, y el comando responde `Acknowledgement` sin
 * `data` (ADR-002).
 */
async function updateComment(req: Request, res: Response) {
  const ok = await runCommand(
    res,
    `requirements.${req.requirement.id}.comment.${req.params.cid}.edit`,
    {
      editor: actorId(req),
      comment: req.body.comment,
      ...(req.body.fileIds !== undefined ? { fileIds: req.body.fileIds } : {}),
    }
  );
  if (!ok) {
    return;
  }

  return res.status(200).json({
    code: 'comment_updated',
    message: 'Comment Updated',
  });
}

router.patch('/requirements/:reqid/comments/:cid',
  hasAnyRole(['user', 'admin']),
  validateBodyFields(editSchema),
  validateRequirement,
  updateComment
);

export default router;
