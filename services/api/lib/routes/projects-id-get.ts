import { Request, Response, Router } from 'express';
const router: Router = Router();
import { Client, Project, User } from '@jiku/models';
import logger from '../logger';

function getProjectById(req: Request, res: Response) {
  return Project.findOne({
    where: {
      id: req.params.id
    },
    include: [
      { model: User, as: 'creator', attributes: ['id', 'name', 'email', 'identityType'] },
      { model: Client, as: 'client' }
    ]
  })
    .then((projectFound) => {
      if (!projectFound) {
        return res.status(400).json({
          code: 'project_not_found',
          message: 'Project not found'
        });
      }

      return res.status(200).json(projectFound);
    })
    .catch((error) => {
      logger.error(`GET /api/projects/:id getProjectById error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get project by id
 * @description Get a project by id
 * @route {GET} /api/projects/:id
 * @queryparam {number} [id] project identifier
 * @response {200} OK
 * @responsebody {object} [project] project object
 * @responsebody {string} [project.id] project identifier
 * @responsebody {string} [project.name] project name
 * @responsebody {string} [project.code] project code
 * @responsebody {string} [project.status] project status
 * @responsebody {string} [project.type] project type
 * @responsebody {string} [project.description] project description
 * @responsebody {object} [project.creator] Creator of the project details
 * @responsebody {array<object>} [project.creator] Details of the project Creator
 * @responsebody {array<object>} [project.client] Details of the project Client
 * @response {400} Project not exists
 * @responsebody {string} [code] project_not_found
 * @responsebody {string} [message] Project not found
 * @response {500} Error get project
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */

router
  .get('/projects/:id', getProjectById);

export default router;
