import { Request, Response, Router } from 'express';
const router: Router = Router();
import validateBodyFields from '../utils/validate-body-fields';
import joi from 'joi';
import { runCommand } from '../utils/bus/send-command';
import { keyValuePairsToProperties } from '../utils/bus/properties';

/**
 * La escritura la hace core.
 *
 * Detalle heredado: la api vaciaba `endDate` cuando no venía en el cuerpo. Core, en
 * cambio, deja como estaba lo que no llega (semántica de edición parcial del protocolo).
 * Para no cambiarle el comportamiento a la web, la api sigue mandando `endDate: null`
 * explícito cuando el cuerpo no lo trae.
 */
async function updateProject(req: Request, res: Response) {
  const { keyValuePairs, ...rest } = req.body;

  // Sin `editor`: projects no registra actividad, así que el comando no lo acepta.
  const payload: Record<string, unknown> = {
    ...rest,
    ...(keyValuePairs ? { properties: keyValuePairsToProperties(keyValuePairs) } : {}),
  };

  if (!Object.prototype.hasOwnProperty.call(req.body, 'endDate')) {
    payload.endDate = null;
  }

  const ok = await runCommand(res, `projects.${req.params.id}.edit`, payload);
  if (!ok) {
    return;
  }

  return res.status(200).json({
    code: 'project_updated',
    message: 'Project Updated',
  });
}

/**
 * @name Update project
 * @description Update a project
 * @route {PATCH} /api/projects/:id
 * @queryparam {number} [id] project identifier
 * @bodyparam {string} [name] (optional) project name
 * @bodyparam {string} [code] (optional) project code
 * @bodyparam {string} [status] (optional) project status
 * @bodyparam {string} [type] (optional) project type
 * @bodyparam {string} [description] (optional) project description
 * @bodyparam (optional) {number} [clientId] client identifier
 * @bodyparam (optional) {object} [keyValuePairs] Key/value pairs for the project
 * @response {200} OK
 * @responsebody {object} [product] get a project by id
 * @response {400} Project not exists
 * @responsebody {string} [code] project_not_found
 * @responsebody {string} [message] Project not found
 * @response {500} Error get project
 */

router
  .patch('/projects/:id',
    validateBodyFields(joi.object({
      name: joi.string().min(1).required(),
      code: joi.string().required(),
      clientId: joi.number(),
      status: joi.string().required(),
      type: joi.string().required(),
      description: joi.string().required(),
      initDate: joi.date().required(),
      endDate: joi.date(),
      // Desde S-034 (CA-9): `documentacion`, `diseño` y `board_de_tareas` ya no validan
      // formato de URI acá — `core/src/commands/projects/properties.ts` ya lo hace
      // (`docs/apis/core.yaml` lo documenta). La api solo valida que sean string.
      keyValuePairs: joi.object({
        documentacion: joi.string().allow(null, ''),
        diseño: joi.string().allow(null, ''),
        board_de_tareas: joi.string().allow(null, ''),
        mattermost_group_name: joi.string().allow(null, ''),
      }).unknown(true).optional(),
    })),
    updateProject
  );

export default router;
