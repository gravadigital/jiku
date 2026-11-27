import { Request, Response, Router } from 'express';
const router: Router = Router();
import { Client, Project, User } from '@jiku/models';
import logger from '../logger';
import validateQueryParams from '../utils/validate-query-params';
import joi from 'joi';
import parseGetParams from '../utils/parse-query-params';
import { Op } from 'sequelize';

function getAllProjects(req: Request, res: Response) {
  const { sort, limit, search, state, type, page } = req.parsedParams || {};
  const offset = (page - 1) * limit;

  const whereClause =
  [
    type && {type},
    search && {name: {
      [Op.iLike]: '%' + search + '%'}
    },
    state && {status: {
      [Op.or]: state.split(',').map(s => s.trim())
    }},
  ]
    .reduce((acc, condition) => (condition ? { ...acc, ...condition } : acc), {});

  return Project.findAll({
    order: sort,
    limit: limit,
    offset: offset,
    where: whereClause,
    include: [
      { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      // Solo id y name (S-100): es lo que la web usa para relacionar Cliente y Proyecto. El
      // listado no debe traer la fila completa del cliente; el detalle (projects-id-get) sí.
      { model: Client, as: 'client', attributes: ['id', 'name'] },
    ],
  })
    .then((projects) => {
      const projectsWithEmptyStrings = projects.map((project) => {
        const projectData = project.toJSON();
        if (projectData.keyValuePairs) {
          Object.entries(projectData.keyValuePairs).forEach(([key, value]) => {
            if (value === null) {
              projectData.keyValuePairs[key] = '';
            }
          });
        }
        return projectData;
      });

      return res.status(200).json(projectsWithEmptyStrings);
    })
    .catch((error) => {
      logger.error(`GET /api/projects getAllProjects error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get projects
 * @description Get all projects, including creator and client
 * @route {GET} /api/projects
 * @queryparam (optional) {string} [sort] Sorting criteria
 * @queryparam (optional) {number} [limit] Limit of projects to retrieve
 * @queryparam (optional) {string} [search] Search term for projects name
 * @queryparam (optional) {string} [state] Filter by project state (allow multiple states separated by comma)
 * @queryparam (optional) {number} [page] Page number for pagination
 * @response {200} OK
 * @responsebody {array<object>} [projects] get all projects
 * @responsebody {string} [projects[].id] project identifier
 * @responsebody {string} [projects[].name] project name
 * @responsebody {string} [projects[].code] project code
 * @responsebody {string} [projects[].status] project status
 * @responsebody {string} [projects[].type] project type
 * @responsebody {string} [projects[].description] project description
 * @responsebody {object} [projects[].creator] Creator of the project details
 * @responsebody {object|null} [projects[].client] Client of the project (id, name), null without client
 * @response {500} Error search projects
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */

router
  .get('/projects',
    validateQueryParams(
      joi.object({
        sort: joi.string(),
        page: joi.number().default(1).min(1),
        limit: joi.number().default(200).min(1).max(30),
        search: joi.string(),
        type: joi.string().valid('interno', 'comercial', 'investigacion', 'propuesta'),
        state: joi.string()
      })
    ),
    parseGetParams(),
    getAllProjects);

export default router;
