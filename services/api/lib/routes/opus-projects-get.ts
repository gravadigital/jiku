import { Request, Response, Router, NextFunction } from 'express';
import { Project, UserProjectPermission } from '@jiku/models';
import { Op } from 'sequelize';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';

const router: Router = Router();

function prepareQuery(req: Request, res: Response, next: NextFunction) {
  req.data = {
    query: {status: 'activo'}
  };

  if (!req.decodedTokenRoles.includes('external-user')) {
    return next();
  }

  return UserProjectPermission.findAll({
    where: { userId: req.user.id },
    attributes: ['projectId'],
  })
    .then((permissions) => {
      const projectIds = permissions.map(permission => permission.projectId);
      req.data.query.id = {[Op.in]: projectIds};
      return next();
    })
    .catch((error) => {
      logger.error(`GET /opus/projects prepareQuery error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

function getProjects(req: Request, res: Response, next: NextFunction) {
  return Project.findAll({
    where: req.data.query,
    attributes: ['id', 'name'],
  })
    .then((projects) => {
      res.locals.projects = projects;
      next();
    })
    .catch((error) => {
      logger.error(`GET /opus/projects getProjects error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

function sendResponse(_req: Request, res: Response) {
  return res.status(200).json(res.locals.projects);
}

router.get('/opus/projects',
  hasAnyRole(['user', 'external-user']),
  prepareQuery,
  getProjects,
  sendResponse
);

export default router;
