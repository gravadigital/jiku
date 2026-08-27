import { Request, Response, Router } from 'express';
import joi from 'joi';
import { Person, Project, RequirementResolution, RequirementState, RequirementVisibilityLevel } from '@jiku/models';
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
  // Ids de `files` ya subidos, NO de `attachments` (REQ-001, S-003): el vínculo lo crea core al
  // guardar la entidad. El `max(10)` es el `maxItems` que declara el spec — se valida acá para
  // que un lote de más no cueste un round-trip del bus antes de que core lo rechace igual.
  fileIds: joi.array().items(joi.number().integer().positive()).max(10).optional(),
});

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
  validateBodyFields(patchSchema),
  validateRequirement,
  patchRequirement
);

export default router;
