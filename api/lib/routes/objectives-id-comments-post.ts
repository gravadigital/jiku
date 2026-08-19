import { Router, Request, Response } from 'express';
import { ObjectiveActivity } from '@jiku/models';
import { sendCommand } from '../utils/bus/send-command';
import validateBodyFields from '../utils/validate-body-fields';
import joi from 'joi';

const router: Router = Router();

/**
 * La escritura la hace core: la api publica el comentario y devuelve el registro creado,
 * que es lo que ya esperaba la web.
 */
export async function addComment(req: Request, res: Response) {
  const data = await sendCommand<{ id: number }>(res, `tasks.${req.params.id}.comment`, {
    author: req.user.id,
    comment: req.body.comment,
    ...(req.body.visibilityLevel ? { visibilityLevel: req.body.visibilityLevel } : {}),
    ...(req.body.fileIds?.length ? { fileIds: req.body.fileIds } : {}),
  });
  if (!data) {
    return;
  }

  const comment = await ObjectiveActivity.findByPk(data.id);
  return res.status(201).json(comment);
}

/**
 * @name Create comment
 * @description Create a comment related to a objective
 * @route {POST} /api/objectives/:id/comments
 * @queryparam {number} [id] objective identifier
 * @bodyparam {string} [comment] (required) comment text
 * @bodyparam {string} [visibilityLevel] (optional, default: 'internal') visibility level ('public' | 'internal')
 * @response {201} Created
 * @responsebody {object} [comment] created comment resource
 * @response {500} Internal error
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */

router.post(
  '/objectives/:id/comments',
  validateBodyFields(
    joi.object({
      comment: joi.string().required(),
      visibilityLevel: joi.string().valid('public', 'internal').default('internal'),
      // La web siempre lo manda, aunque el array esté vacío.
      // Ids de `files` ya subidos, NO de `attachments` (REQ-001, S-003): el vínculo lo crea core al
      // guardar la entidad. El `max(10)` es el `maxItems` que declara el spec — se valida acá para
      // que un lote de más no cueste un round-trip del bus antes de que core lo rechace igual.
      fileIds: joi.array().items(joi.number().integer().positive()).max(10).optional(),
    })
  ),
  addComment
);

export default router;
