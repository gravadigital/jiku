import { Request, Response, NextFunction, Router } from 'express';
import joi from 'joi';
import { Person, Project, RequirementResolution, RequirementState, RequirementType, RequirementVisibilityLevel } from '@jiku/models';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateBodyFields from '../utils/validate-body-fields';
import validateRequirement from '../utils/middlewares/validate-requirement';
import { runCommand } from '../utils/bus/send-command';

const router: Router = Router();

const patchSchema = joi.object({
  title: joi.string().optional(),
  description: joi.string().optional(),
  type: joi.string().valid('funcionalidad', 'mejora', 'incidencia', 'otro').allow(null).optional(),
  priority: joi.string().valid('sin_prioridad', 'baja', 'media', 'alta', 'urgente').optional(),
  estimatedFinishDate: joi.date().optional(),
  tags: joi.array().items(joi.object({ key: joi.string(), value: joi.string() })).allow(null).optional(),
  state: joi.string().valid(...Object.values(RequirementState)).optional(),
  resolutionType: joi.string().valid(...Object.values(RequirementResolution)).allow(null).optional(),
  resolutionConclusion: joi.string().allow(null).optional(),
  resolutionComment: joi.string().allow(null).optional(),
  visibilityLevel: joi.string().valid(...Object.values(RequirementVisibilityLevel)).optional(),
  responsiblePersonIds: joi.array().items(joi.number().integer()).allow(null).optional(),
  scope: joi.string().allow(null).optional(),
  technicalSolution: joi.string().allow(null).optional(),
  acceptanceCriteria: joi.string().allow(null).optional(),
  attachmentIds: joi.array().items(joi.number().integer().positive()).optional(),
});

/**
 * Regla heredada: una incidencia no se resuelve sin tipo y conclusión.
 *
 * Se queda en la api porque combina el estado que llega con el que ya tiene el requisito,
 * y devuelve un código propio que no está en el protocolo.
 */
function validateResolutionRules(req: Request, res: Response, next: NextFunction) {
  const requirement = req.requirement;
  const { resolutionType, resolutionConclusion, state } = req.body;

  if (state === RequirementState.Resuelto && requirement.type === RequirementType.Incidencia) {
    const finalType = resolutionType !== undefined ? resolutionType : requirement.resolutionType;
    const finalConclusion = resolutionConclusion !== undefined
      ? resolutionConclusion
      : requirement.resolutionConclusion;
    if (!finalType || !finalConclusion) {
      return res.status(400).json({
        code: 'resolution_required',
        message: 'Se requiere tipo y conclusión para resolver una incidencia',
      });
    }
  }

  return next();
}

/**
 * La escritura la hace core; la api rearma la respuesta con proyecto y responsables,
 * que es lo que espera la web.
 */
async function patchRequirement(req: Request, res: Response) {
  const requirement = req.requirement;

  const ok = await runCommand(res, `requirements.${requirement.id}.edit`, {
    editor: req.user.id,
    ...req.body,
  });
  if (!ok) {
    return;
  }

  await requirement.reload({
    include: [
      { model: Project, as: 'project', attributes: ['id', 'name'] },
      {
        model: Person,
        as: 'responsiblePeople',
        attributes: ['id', 'firstName', 'lastName'],
        through: { attributes: ['isLeader'] },
      },
    ],
  });

  const json = requirement.toJSON() as any;
  json.responsiblePeople = (json.responsiblePeople || []).map((person: any) => ({
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    isLeader: person.PersonRequirement?.isLeader ?? null,
  }));

  return res.status(200).json(json);
}

router.patch('/requirements/:reqid',
  hasAnyRole(['user', 'admin']),
  validateBodyFields(patchSchema),
  validateRequirement,
  validateResolutionRules,
  patchRequirement
);

export default router;
