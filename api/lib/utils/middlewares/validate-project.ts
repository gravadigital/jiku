import { Request, Response, NextFunction } from 'express';
import { Project, User } from '@jiku/models';
import logger from '../../logger';
function validateProject(req: Request, res: Response, next: NextFunction){
  const projid = req.params.projid as string;

  if (!projid) {
    return res.status(404).json({
      code: 'not_found',
      message: 'Project not Found'
    });
  }

  return Project.findOne({
    where: {
      id: projid
    },
    include: [{
      model: User,
      as: 'creator',
      // `identityType` se declara por consistencia con los otros seis `include` de autoria
      // (S-019 CA-1), no porque llegue a una respuesta: hoy NINGUN handler devuelve
      // `req.project` -- sus seis consumidores solo leen `req.project.id` o setean su propio
      // `req.project`. Si algun dia una ruta lo serializa, el campo ya esta y no hay que
      // acordarse. Lo que NO se puede hacer es quitar el `attributes`: seria filtrar `roles`.
      attributes: ['id', 'name', 'email', 'identityType'],
    }],
  })
    .then((projectFound) =>{
      if (!projectFound) {
        return res.status(404).json({
          code: 'project_not_found',
          message: 'Project not found'
        });
      }

      req.project = projectFound;
      return next();
    })
    .catch((error) => {
      logger.error(`[middleware] validateProject error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal server error'
      });
    });

}

export default validateProject;
