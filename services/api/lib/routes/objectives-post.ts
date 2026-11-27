import { Request, Response, Router } from 'express';
const router: Router = Router();
import { Objective } from '@jiku/models';
import validateBodyFields from '../utils/validate-body-fields';
import joi from 'joi';
import { sendCommand } from '../utils/bus/send-command';
import { priorityToName } from '../utils/bus/priority';

/**
 * La escritura la hace core.
 *
 * Traducciones al bus, porque el contrato con la web no cambia:
 *   personIds -> responsiblePersonIds
 *   priority numérica -> enum
 *   objectives -> tasks
 *
 * `stageId` se sigue pasando: el concepto de etapa se elimina del producto, pero la web
 * todavía lo usa y los fronts no se tocan.
 */
async function createObjective(req: Request, res: Response) {
  const {
    title, description, estimatedFinishDate, state, area, priority,
    projectId, personIds, visibilityLevel, requirementId, stageId,
  } = req.body;

  const data = await sendCommand<{ id: number }>(res, 'tasks.new', {
    creator: req.user.id,
    title,
    ...(description !== undefined ? { description } : {}),
    ...(estimatedFinishDate !== undefined ? { estimatedFinishDate } : {}),
    state,
    area,
    priority: priorityToName(priority),
    // Escape transitorio: la web habla en números y el enum no los cubre todos.
    priorityValue: priority,
    projectId,
    responsiblePersonIds: personIds,
    ...(visibilityLevel !== undefined ? { visibilityLevel } : {}),
    ...(requirementId !== undefined ? { requirementId } : {}),
    ...(stageId !== undefined ? { stageId } : {}),
  });
  if (!data) {
    return;
  }

  const objective = await Objective.findByPk(data.id);
  return res.status(201).json({
    ...objective!.toJSON(),
    personIds,
  });
}

/**
 * @name Create objective
 * @description Create an objective
 * @route {POST} /api/objectives/
 * @bodyparam {string} [title] objective title
 * @bodyparam {string} [description] objective description
 * @bodyparam {date|null} [estimatedFinishDate] objective estimated finish date
 * @bodyparam {string} [state] objective state
 * @bodyparam {string} [area] objective area
 * @bodyparam {number} [priority] objective priority
 * @bodyparam {number} [projectId] project identifier
 * @bodyparam {array<number>} [personIds] persons related to the objective
 * @response {200} OK
 * @responsebody {object} [objective] objective resource
 * @response {400} Project not exists
 * @responsebody {string} [code] project_not_found
 * @response {400} Person not exists
 * @responsebody {string} [code] person_not_found
 * @response {500} Error create objective
 */

router
  .post('/objectives',
    validateBodyFields(joi.object({
      title: joi.string().required(),
      description: joi.string(),
      estimatedFinishDate: joi.date(),
      state: joi.string().valid('backlog', 'activo', 'finalizado', 'cancelado', 'en_revision').required(),
      area: joi.string().valid('diseño', 'desarrollo', 'gestion', 'investigacion').required(),
      priority: joi.number().required(),
      projectId: joi.number().required(),
      stageId: joi.number().allow(null).optional(),
      personIds: joi.array().items(joi.number()).required(),
      visibilityLevel: joi.string().valid('public', 'internal'),
      requirementId: joi.number().integer().allow(null).optional(),
    })),
    createObjective
  );

export default router;
