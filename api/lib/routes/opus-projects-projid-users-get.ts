import { Request, Response, Router } from 'express';
import logger from '../logger';
import validateProjectPermissions from '../utils/middlewares/validate-project-permission';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateProject from '../utils/middlewares/validate-project';
import { User, UserProjectPermission } from '@jiku/models';

const router: Router = Router();

function getProjectUsers(req: Request, res: Response) {
  const project = req.project;

  return UserProjectPermission.findAll({
    where: { projectId: project.id },
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'name', 'email']
    }],
    order: [[{ model: User, as: 'user' }, 'name', 'ASC']]
  })
    .then((permissions) => {
      const users = permissions.map((permission) => permission.user);
      return res.status(200).json(users);
    })
    .catch((error) => {
      logger.error(`[GET /opus/projects/:projid/users] getProjectUsers error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal server error',
      });
    });
}

/**
 * @name Get project external users
 * @description Get all external users that have permission to access a specific project
 * @route {GET} /opus/projects/:projid/users
 * @routeparam {number} projid Project identifier
 * @response {200} OK
 * @responsebody {string} [id] User id
 * @responsebody {string} [name] User name
 * @responsebody {string} [email] User email
 * @response {404} Not Found
 * @responsebody {string} [code] project_not_found
 * @responsebody {string} [message] Project not found
 * @response {403} Forbidden
 * @responsebody {string} [code] access_denied
 * @responsebody {string} [message] Access denied
 * @response {500} Internal error
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal server error
 */
router.get('/opus/projects/:projid/users',
  validateProject,
  hasAnyRole(['user', 'external-user']),
  validateProjectPermissions,
  getProjectUsers
);

export default router;
