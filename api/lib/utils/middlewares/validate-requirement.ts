import { Request, Response, NextFunction } from 'express';
import { Project, Requirement, User } from '@jiku/models';
import logger from '../../logger';

function validateRequirement(req: Request, res: Response, next: NextFunction) {
  const reqId = req.params.reqid;

  return Requirement.findOne({
    where: { id: reqId },
    include: [
      { model: Project, as: 'project', attributes: ['id', 'name', 'keyValuePairs'] },
      // Es el `include` que alimenta `req.requirement.creator`, o sea el `pie-autoria` de
      // `opus-web` (S-019 CA-7). Cuatro campos, y `roles` sigue afuera.
      { model: User, as: 'creator', attributes: ['id', 'name', 'email', 'identityType'] },
    ],
  })
    .then((requirement) => {
      if (!requirement) {
        return res.status(404).json({
          code: 'requirement_not_found',
          message: 'Requirement not found',
        });
      }
      req.requirement = requirement;
      req.project = requirement.project;
      return next();
    })
    .catch((error: Error) => {
      logger.error(`[middleware] validateRequirement error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error',
      });
    });
}

export default validateRequirement;
