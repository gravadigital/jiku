import { Request, Response, NextFunction, Router } from 'express';
import joi from 'joi';
import { Project, Requirement, RequirementPriority, RequirementType } from '@jiku/models';
import logger from '../logger';
import validateBodyFields from '../utils/validate-body-fields';
import { sendCommand } from '../utils/bus/send-command';

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
 * que acá el creador puede suscribir a otros usuarios de una — ahora viajan en el mismo
 * comando (S-070), no como comandos aparte.
 *
 * No notifica: las notificaciones están fuera del alcance.
 */
async function createRequirement(req: Request, res: Response) {
  const {
    title, description, priority, projectId, type, estimatedFinishDate,
    subscriberUserIds, fileIds,
  } = req.body;

  // El creador queda suscripto siempre, y el set viaja DENTRO del comando: `requirements.new`
  // crea el requisito y sus suscripciones en la misma transacción (S-070). Antes esto eran
  // N+1 comandos —uno por suscriptor, después del alta—, y si uno fallaba el requisito
  // quedaba creado y sin suscriptores. Con un solo comando la atomicidad la da la
  // transacción de core.
  //
  // Va SIN spread condicional, a diferencia de la ruta interna: acá el array NUNCA está
  // vacío, porque el creador siempre está. Y va primero, que es el orden que ya tenía el Set.
  //
  // `[...new Set(...)]`, no `new Set(...)` a secas: un `Set` serializa como `{}` en JSON.
  const subscribers = [...new Set<string>([req.user.id, ...(subscriberUserIds || [])])];

  const data = await sendCommand<{ id: number }>(res, 'requirements.new', {
    creator: req.user.id,
    title,
    description,
    projectId,
    subscriberUserIds: subscribers,
    ...(priority !== undefined ? { priority } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(estimatedFinishDate !== undefined ? { estimatedFinishDate } : {}),
    ...(fileIds !== undefined ? { fileIds } : {}),
  });
  if (!data) {
    return;
  }

  const requirement = await Requirement.findByPk(data.id);
  return res.status(201).json(requirement);
}

router.post('/opus/requirements',
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
  createRequirement
);

export default router;
