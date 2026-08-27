import { Request, Response, Router } from 'express';
import joi from 'joi';
import { RequirementActivity } from '@jiku/models';
import validateBodyFields from '../utils/validate-body-fields';
import validateRequirement from '../utils/middlewares/validate-requirement';
import { sendCommand } from '../utils/bus/send-command';

const router: Router = Router();

const activitySchema = joi.object({
  comment: joi.string().required(),
  visibilityLevel: joi.string().valid('public', 'internal').default('internal'),
  // Ids de `files` ya subidos, NO de `attachments` (REQ-001, S-003): el vínculo lo crea core al
  // guardar la entidad. El `max(10)` es el `maxItems` que declara el spec — se valida acá para
  // que un lote de más no cueste un round-trip del bus antes de que core lo rechace igual.
  fileIds: joi.array().items(joi.number().integer().positive()).max(10).optional(),
});

/**
 * La escritura la hace core.
 *
 * No notifica: las notificaciones están fuera del alcance.
 */
async function addActivity(req: Request, res: Response) {
  const data = await sendCommand<{ id: number }>(
    res,
    `requirements.${req.requirement.id}.comment`,
    {
      author: req.user.id,
      comment: req.body.comment,
      ...(req.body.visibilityLevel ? { visibilityLevel: req.body.visibilityLevel } : {}),
      ...(req.body.fileIds !== undefined ? { fileIds: req.body.fileIds } : {}),
    }
  );
  if (!data) {
    return;
  }

  const activity = await RequirementActivity.findByPk(data.id);
  return res.status(201).json(activity);
}

router.post('/requirements/:reqid/comments',
  validateBodyFields(activitySchema),
  validateRequirement,
  addActivity
);

export default router;
