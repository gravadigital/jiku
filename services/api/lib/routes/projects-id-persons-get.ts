import { Request, Response, Router } from 'express';
import logger from '../logger';
import { Person, Project } from '@jiku/models';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateProject from '../utils/middlewares/validate-project';

const router: Router = Router();

function getProjectPersons(req: Request, res: Response) {
  const projectId = req.project.id;

  return Person.findAll({
    include: [{
      model: Project,
      where: { id: projectId },
      through: { attributes: [] },
      attributes: [],
    }],
    attributes: ['id', 'firstName', 'lastName'],
  })
    .then((persons) => {
      return res.status(200).json(persons.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
      })));
    })
    .catch((error) => {
      logger.error(`[GET /projects/:projid/persons] error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error',
      });
    });
}

router.get('/projects/:projid/persons', hasAnyRole(['user', 'admin']), validateProject, getProjectPersons);

export default router;
