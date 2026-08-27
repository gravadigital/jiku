import { Request, Response, Router } from 'express';
import joi from 'joi';
import { Requirement, RequirementPriority, RequirementState } from '@jiku/models';
import validateBodyFields from '../utils/validate-body-fields';
import validateRequirement from '../utils/middlewares/validate-requirement';
import { runCommand } from '../utils/bus/send-command';

const router: Router = Router();

/**
 * Desde Opus solo se puede cambiar estado y prioridad; el resto de los campos los acota
 * el esquema, no core.
 */
async function updateRequirement(req: Request, res: Response) {
  const ok = await runCommand(res, `requirements.${req.requirement.id}.edit`, {
    editor: req.user.id,
    ...req.body,
  });
  if (!ok) {
    return;
  }

  const requirement = await Requirement.findByPk(req.requirement.id);
  return res.status(200).json(requirement);
}

router.patch('/opus/requirements/:reqid',
  validateRequirement,
  validateBodyFields(joi.object({
    state: joi.string().valid(...Object.values(RequirementState)).optional(),
    priority: joi.string().valid(...Object.values(RequirementPriority)).optional(),
  })),
  updateRequirement
);

export default router;
