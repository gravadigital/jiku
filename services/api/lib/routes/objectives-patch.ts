import { Request, Response, Router } from 'express';
const router: Router = Router();
import validateBodyFields from '../utils/validate-body-fields';
import joi from 'joi';
import { runCommand } from '../utils/bus/send-command';
import { priorityToName } from '../utils/bus/priority';

/**
 * La escritura la hace core.
 *
 * Traducciones al bus (el contrato con la web no cambia):
 *   personIds -> responsiblePersonIds
 *   priority numérica -> enum
 *
 * La web espera que `estimatedFinishDate` y `description` se vacíen cuando no viajan en
 * el cuerpo, y core deja como está lo ausente: por eso se manda el null explícito.
 */
async function updateObjective(req: Request, res: Response) {
  const {
    title, description, estimatedFinishDate, state, area, priority,
    personIds, visibilityLevel, requirementId, stageId,
  } = req.body;

  const payload: Record<string, unknown> = {
    editor: req.user.id,
    ...(title !== undefined ? { title } : {}),
    ...(state !== undefined ? { state } : {}),
    ...(area !== undefined ? { area } : {}),
    ...(priority !== undefined ? { priority: priorityToName(priority), priorityValue: priority } : {}),
    ...(personIds !== undefined ? { responsiblePersonIds: personIds } : {}),
    ...(visibilityLevel !== undefined ? { visibilityLevel } : {}),
    ...(requirementId !== undefined ? { requirementId } : {}),
    ...(stageId !== undefined ? { stageId } : {}),
  };

  // Comportamiento heredado: lo que no viene se vacía.
  payload.description = description ?? null;
  payload.estimatedFinishDate = estimatedFinishDate ?? null;

  const ok = await runCommand(res, `tasks.${req.params.id}.edit`, payload);
  if (!ok) {
    return;
  }

  return res.status(200).json({
    code: 'objective_updated',
    message: 'Objective Updated'
  });
}

/**
 * @name Update objective
 * @description Update an objective by id
 * @route {PATCH} /api/objectives/:id
 * @queryparam {number} id objective identifier
 * @bodyparam {string} [title] objective title
 * @bodyparam {date|null} [estimatedFinishDate] objective estimated finish date
 * @bodyparam {string} [state] objective state
 * @bodyparam {string} [state] objective area
 * @bodyparam {number} [priority] objective priority
 * @bodyparam {number} [projectId] project identifier
 * @response {200} OK
 * @responsebody {object} [objective] get an objective by id
 * @response {400} Objective not exists
 * @responsebody {string} [code] objective_not_found
 * @responsebody {string} [message] Objective not found
 * @response {400} Person not exists
 * @responsebody {string} [code] person_not_found
 * @responsebody {string} [message] Person not found
 * @response {500} Error update objective
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */

router.patch(
  '/objectives/:id',
  validateBodyFields(
    joi.object({
      title: joi.string().min(1).required(),
      description: joi.string(),
      estimatedFinishDate: joi.date(),
      state: joi.string().valid('backlog', 'activo', 'finalizado', 'cancelado', 'en_revision').required(),
      area: joi.string().valid('diseño', 'desarrollo', 'gestion', 'investigacion').required(),
      priority: joi.number().min(0).max(5).required(),
      personIds: joi.array().items(joi.number().min(1)).required(),
      visibilityLevel: joi.string().valid('public', 'internal'),
      stageId: joi.number().allow(null).optional(),
      requirementId: joi.number().integer().allow(null).optional(),
    })
  ),
  updateObjective
);

export default router;
