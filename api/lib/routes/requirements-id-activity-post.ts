import { Request, Response, Router } from 'express';
import joi from 'joi';
import { RequirementActivity } from '@jiku/models';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateBodyFields from '../utils/validate-body-fields';
import validateRequirement from '../utils/middlewares/validate-requirement';
import { sendCommand } from '../utils/bus/send-command';

const router: Router = Router();

const activitySchema = joi.object({
  comment: joi.string().required(),
  visibilityLevel: joi.string().valid('public', 'internal').default('internal'),
  attachmentIds: joi.array().items(joi.number().integer().positive()).optional(),
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
      ...(req.body.attachmentIds !== undefined ? { attachmentIds: req.body.attachmentIds } : {}),
    }
  );
  if (!data) {
    return;
  }

  const activity = await RequirementActivity.findByPk(data.id);
  return res.status(201).json(activity);
}

router.post('/requirements/:reqid/comments',
  hasAnyRole(['user', 'admin']),
  validateBodyFields(activitySchema),
  validateRequirement,
  addActivity
);

export default router;
