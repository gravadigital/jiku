import { Request, Response, Router } from 'express';
const router: Router = Router();
import { Project } from '@jiku/models';
import validateBodyFields from '../utils/validate-body-fields';
import joi from 'joi';
import { sendCommand } from '../utils/bus/send-command';
import { keyValuePairsToProperties } from '../utils/bus/properties';

/**
 * La escritura la hace core.
 *
 * La web sigue mandando `keyValuePairs` (objeto plano) porque su contrato no cambia; el
 * protocolo del bus usa `properties` (lista de `{code, value}`). La traducción vive acá.
 */
async function createProject(req: Request, res: Response) {
  const { keyValuePairs, ...rest } = req.body;

  const data = await sendCommand<{ id: number }>(res, 'projects.new', {
    ...rest,
    creator: req.user.id,
    ...(keyValuePairs ? { properties: keyValuePairsToProperties(keyValuePairs) } : {}),
  });
  if (!data) {
    return;
  }

  const project = await Project.findByPk(data.id);
  return res.status(201).json(project);
}

/**
 * @name Create project
 * @description Create a project
 * @route {POST} /api/projects/
 * @bodyparam {string} [name] project name
 * @bodyparam {string} [code] project code
 * @bodyparam {string} [status] project status
 * @bodyparam {string} [type] project type
 * @bodyparam {string} [description] project description
 * @bodyparam (optional) {number} [clientId] client identifier
 * @bodyparam (optional) {object} [keyValuePairs] Key/value pairs for the project
 * @bodyparam (optional) {string} [keyValuePairs.documentacion] URL for documentation
 * @bodyparam (optional) {string} [keyValuePairs.diseño] URL for design
 * @bodyparam (optional) {string} [keyValuePairs.board_de_tareas] URL for task board
 * @response {200} OK
 * @responsebody {object} [project] project resource
 * @response {500} Error get project
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */

const uriRule = joi.string().uri().allow(null, '');
router
  .post('/projects',
    validateBodyFields(joi.object({
      name: joi.string().required(),
      code: joi.string().required(),
      clientId: joi.number(),
      status: joi.string().required(),
      type: joi.string().required(),
      description: joi.string().required(),
      initDate: joi.date().required(),
      endDate: joi.date(),
      keyValuePairs: joi.object({
        documentacion: uriRule,
        diseño: uriRule,
        board_de_tareas: uriRule,
        mattermost_group_name: joi.string().allow(null, ''),
      }).optional(),
    })),
    createProject
  );

export default router;
