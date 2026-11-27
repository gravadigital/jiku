import { NextFunction, Request, Response } from 'express';
import { UserProjectPermission } from '@jiku/models';
import logger from '../../logger';

export default function validateProjectPermissions(req: Request, res: Response, next: NextFunction) {
  if (!req.decodedTokenRoles.includes('external-user')) {
    return next();
  }

  return UserProjectPermission.findOne({
    where: {
      userId : req.user.id,
      projectId : req.project.id
    }
  })
    .then((permission) => {
      if (!permission) {
        return res.status(403).json({
          code: 'access_denied',
          message: 'Access denied for this project.'

        });
      }
      return next();
    })
    .catch((error) => {
      logger.error(`[middleware] validateProjectPermissions error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}
