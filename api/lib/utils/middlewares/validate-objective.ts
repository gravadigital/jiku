import { Request, Response, NextFunction } from 'express';
import { Objective, ObjectiveSubscriptor, Project, User } from '@jiku/models';
import logger from '../../logger';

function validateObjective(req: Request, res: Response, next: NextFunction) {
  const objid = req.params.objid as string;

  if (!objid) {
    return res.status(404).json({
      code: 'id_not_found',
      message: 'Objective ID is required'
    });
  }

  return Objective.findOne({
    where: {
      id: objid
    },
    include: [{
      model: User,
      as: 'creator',
      attributes: ['id', 'name', 'email'],
    }, {
      model: Project,
      as: 'project',
      attributes: ['id', 'name', 'keyValuePairs'],
    }, {
      model: ObjectiveSubscriptor,
      as: 'objectiveSubscriptors',
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email'],
      }],
    }],
  })
    .then((objectiveFound) => {
      if (!objectiveFound) {
        return res.status(404).json({
          code: 'objective_not_found',
          message: 'Objective not found'
        });
      }

      req.objective = objectiveFound;
      req.project = objectiveFound.project;
      return next();
    })
    .catch((error) => {
      logger.error(`[middleware] validateObjective error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal server error'
      });
    });
}

export default validateObjective;
