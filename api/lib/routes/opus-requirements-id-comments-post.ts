import { Request, Response, Router } from 'express';
import joi from 'joi';
import { RequirementActivity, VisibilityLevel } from '@jiku/models';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateBodyFields from '../utils/validate-body-fields';
import validateRequirement from '../utils/middlewares/validate-requirement';
import validateProjectPermissions from '../utils/middlewares/validate-project-permission';
import { sendCommand } from '../utils/bus/send-command';

const router: Router = Router();

/**
 * Comentario desde el portal de clientes. Mismo comando que la ruta interna.
 *
 * No notifica: las notificaciones están fuera del alcance.
 */
async function addComment(req: Request, res: Response) {
  const data = await sendCommand<{ id: number }>(
    res,
    `requirements.${req.requirement.id}.comment`,
    {
      author: req.user.id,
      comment: req.body.comment,
      // Todo comentario hecho desde Opus es PÚBLICO, sin importar si lo escribió un
      // usuario interno o externo: el portal es la vista que comparte el cliente. No es
      // configurable, por eso no sale del cuerpo.
      visibilityLevel: VisibilityLevel.Public,
      ...(req.body.attachmentIds !== undefined ? { attachmentIds: req.body.attachmentIds } : {}),
    }
  );
  if (!data) {
    return;
  }

  const activity = await RequirementActivity.findByPk(data.id);
  return res.status(200).json({
    id: activity!.id,
    typeOfActivity: activity!.typeOfActivity,
    previousValue: activity!.previousValue,
    newValue: activity!.newValue,
    visibilityLevel: activity!.visibilityLevel,
    requirementId: activity!.requirementId,
    changedBy: activity!.changedBy,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    },
  });
}

router.post('/opus/requirements/:reqid/comments',
  hasAnyRole(['user', 'external-user']),
  validateRequirement,
  validateProjectPermissions,
  validateBodyFields(joi.object({
    comment: joi.string().required(),
    attachmentIds: joi.array().items(joi.number().integer().min(1)).optional(),
  })),
  addComment
);

export default router;
