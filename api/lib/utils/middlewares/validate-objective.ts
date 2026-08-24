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
      // Este archivo NO TIENE IMPORTADORES en todo el repo (verificado con grep sobre .ts/.js
      // fuera de node_modules y dist). `detalle-tarea` se alimenta de `objectives-id-get.ts`,
      // no de aca. Se acota igual para que no sea una trampa el dia que alguien lo revive.
      attributes: ['id', 'name', 'email', 'identityType'],
    }, {
      model: Project,
      as: 'project',
      attributes: ['id', 'name', 'keyValuePairs'],
    }, {
      model: ObjectiveSubscriptor,
      as: 'objectiveSubscriptors',
      // El `user` de `objectiveSubscriptors` NO lleva `identityType`: es un selector de
      // suscriptores, no una autoria (S-019 CA-1). Un service user no tiene por que estar
      // suscripto, y la marca no tiene donde ir en una lista de destinatarios.
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
