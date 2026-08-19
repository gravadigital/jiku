import { Request, Response, NextFunction, Router } from 'express';
import joi from 'joi';
import { Project, Requirement, RequirementPriority, RequirementType } from '@jiku/models';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateBodyFields from '../utils/validate-body-fields';
import validateProjectPermissions from '../utils/middlewares/validate-project-permission';
import { runCommand, sendCommand } from '../utils/bus/send-command';

const router: Router = Router();

/** El proyecto viene en el cuerpo, no en el path: por eso no sirve el middleware común. */
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
      logger.error(`POST /opus/requirements validateProject error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal server error' });
    });
}

/**
 * Alta de requisito desde el portal de clientes.
 *
 * Usa el mismo comando que la ruta interna; lo que cambia es el rol que lo habilita y
 * que acá el creador puede suscribir a otros usuarios de una.
 *
 * No notifica: las notificaciones están fuera del alcance.
 */
async function createRequirement(req: Request, res: Response) {
  const {
    title, description, priority, projectId, type, estimatedFinishDate,
    subscriberUserIds, fileIds,
  } = req.body;

  const data = await sendCommand<{ id: number }>(res, 'requirements.new', {
    creator: req.user.id,
    title,
    description,
    projectId,
    ...(priority !== undefined ? { priority } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(estimatedFinishDate !== undefined ? { estimatedFinishDate } : {}),
    ...(fileIds !== undefined ? { fileIds } : {}),
  });
  if (!data) {
    return;
  }

  // Las suscripciones son comandos aparte. El creador queda suscripto siempre.
  const subscribers = new Set<string>([req.user.id, ...(subscriberUserIds || [])]);
  for (const userId of subscribers) {
    const ok = await runCommand(res, `requirements.${data.id}.subscriptors.new`, { userId });
    if (!ok) {
      return;
    }
  }

  const requirement = await Requirement.findByPk(data.id);
  return res.status(201).json(requirement);
}

router.post('/opus/requirements',
  hasAnyRole(['user', 'external-user']),
  validateBodyFields(joi.object({
    title: joi.string().required(),
    description: joi.string().required(),
    priority: joi.string().valid(...Object.values(RequirementPriority)).optional(),
    projectId: joi.number().required(),
    type: joi.string().valid(...Object.values(RequirementType)).optional(),
    estimatedFinishDate: joi.date().optional(),
    subscriberUserIds: joi.array().items(joi.string()).optional(),
    // Ids de `files` ya subidos, NO de `attachments` (REQ-001, S-003): el vínculo lo crea core al
    // guardar la entidad. El `max(10)` es el `maxItems` que declara el spec — se valida acá para
    // que un lote de más no cueste un round-trip del bus antes de que core lo rechace igual.
    fileIds: joi.array().items(joi.number().integer().positive()).max(10).optional(),
  })),
  validateProject,
  validateProjectPermissions,
  createRequirement
);

export default router;
