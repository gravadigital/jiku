import { Request, Response, NextFunction, Router } from 'express';
import joi from 'joi';
import { Person, Project, Requirement, RequirementPriority, RequirementState, RequirementType, RequirementVisibilityLevel } from '@jiku/models';
import logger from '../logger';
import validateBodyFields from '../utils/validate-body-fields';
import { sendCommand } from '../utils/bus/send-command';

const router: Router = Router();

const createSchema = joi.object({
  title: joi.string().required(),
  description: joi.string().required(),
  type: joi.string().valid(...Object.values(RequirementType)).allow(null).optional(),
  priority: joi.string().valid(...Object.values(RequirementPriority)).optional(),
  state: joi.string().valid(...Object.values(RequirementState)).optional(),
  visibilityLevel: joi.string().valid(...Object.values(RequirementVisibilityLevel)).optional(),
  responsiblePersonIds: joi.array().items(joi.number().integer()).allow(null).optional(),
  estimatedFinishDate: joi.date().allow(null).optional(),
  projectId: joi.number().integer().required(),
  // Ids de `files` ya subidos, NO de `attachments` (REQ-001, S-003): el vínculo lo crea core al
  // guardar la entidad. El `max(10)` es el `maxItems` que declara el spec — se valida acá para
  // que un lote de más no cueste un round-trip del bus antes de que core lo rechace igual.
  fileIds: joi.array().items(joi.number().integer().positive()).max(10).optional(),
  tags: joi.array().items(joi.object({ key: joi.string(), value: joi.string() })).optional(),
  scope: joi.string().optional(),
  technicalSolution: joi.string().optional(),
  acceptanceCriteria: joi.string().optional(),
});

/**
 * El proyecto se valida acá porque esta ruta responde 404, mientras que core devuelve
 * `project_not_found` con 400 (es una validación de entrada para el resto de los comandos).
 */
function validateProject(req: Request, res: Response, next: NextFunction) {
  return Project.findByPk(req.body.projectId)
    .then((project) => {
      if (!project) {
        return res.status(404).json({ code: 'project_not_found', message: 'Project not found' });
      }
      req.project = project;
      return next();
    })
    .catch((error: Error) => {
      logger.error(`[POST /requirements] validateProject error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal server error' });
    });
}

/**
 * La escritura la hace core.
 *
 * Core solo devuelve el id, pero el contrato con la web es el requisito completo con su
 * proyecto y sus responsables, así que se rearma leyendo la base.
 */
async function createRequirement(req: Request, res: Response) {
  const {
    title, description, type, priority, state, visibilityLevel, responsiblePersonIds,
    estimatedFinishDate, projectId, tags, fileIds, scope, technicalSolution,
    acceptanceCriteria,
  } = req.body;

  const data = await sendCommand<{ id: number }>(res, 'requirements.new', {
    creator: req.user.id,
    title,
    description,
    projectId,
    ...(type !== undefined ? { type } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(state !== undefined ? { state } : {}),
    ...(visibilityLevel !== undefined ? { visibilityLevel } : {}),
    ...(responsiblePersonIds !== undefined ? { responsiblePersonIds } : {}),
    ...(estimatedFinishDate !== undefined ? { estimatedFinishDate } : {}),
    ...(tags !== undefined ? { tags } : {}),
    ...(fileIds !== undefined ? { fileIds } : {}),
    ...(scope !== undefined ? { scope } : {}),
    ...(technicalSolution !== undefined ? { technicalSolution } : {}),
    ...(acceptanceCriteria !== undefined ? { acceptanceCriteria } : {}),
  });
  if (!data) {
    return;
  }

  const full = await Requirement.findOne({
    where: { id: data.id },
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

  const json = full!.toJSON() as any;
  json.responsiblePeople = (json.responsiblePeople || []).map((person: any) => ({
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    isLeader: person.PersonRequirement?.isLeader ?? null,
  }));

  return res.status(201).json(json);
}

router.post('/requirements',
  validateBodyFields(createSchema),
  validateProject,
  createRequirement
);

export default router;
