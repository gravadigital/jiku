import { Request, Response, Router } from 'express';
import joi from 'joi';
import { RequirementActivity, VisibilityLevel } from '@jiku/models';
import validateBodyFields from '../utils/validate-body-fields';
import validateRequirement from '../utils/middlewares/validate-requirement';
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
      ...(req.body.fileIds !== undefined ? { fileIds: req.body.fileIds } : {}),
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
  validateRequirement,
  validateBodyFields(joi.object({
    comment: joi.string().required(),
    // Ids de `files` ya subidos, NO de `attachments` (REQ-001, S-003): el vínculo lo crea core al
    // guardar la entidad. El `max(10)` es el `maxItems` que declara el spec — se valida acá para
    // que un lote de más no cueste un round-trip del bus antes de que core lo rechace igual.
    fileIds: joi.array().items(joi.number().integer().min(1)).max(10).optional(),
  })),
  addComment
);

export default router;
