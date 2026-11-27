import { Request, Response, Router } from 'express';
import { Op } from 'sequelize';
import joi from 'joi';
import validateQueryParams from '../utils/validate-query-params';
import hasAnyRole from '../utils/middlewares/has-any-role';
import logger from '../logger';
import { Objective, Person, Project } from '@jiku/models';

const router: Router = Router();

const querySchema = joi.object({
  personId: joi.number().integer().required()
});

function getPersonObjectives(req: Request, res: Response) {
  const personId = Number(req.query.personId);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return Objective.findAll({
    attributes: ['id', 'title', 'state', 'projectId', 'requirementId'],
    where: {
      [Op.or]: [
        { state: 'activo' },
        {
          state: 'finalizado',
          finishedAt: { [Op.gt]: sevenDaysAgo }
        }
      ]
    },
    include: [
      {
        model: Person,
        as: 'persons',
        where: { id: personId },
        attributes: [],
        through: { attributes: [] },
        required: true
      },
      {
        model: Project,
        as: 'project',
        attributes: ['id', 'name']
      }
    ]
  })
    .then((objectives) => {
      const response = objectives.map((obj) => ({
        id: obj.id,
        title: obj.title,
        state: obj.state,
        projectId: obj.projectId,
        requirementId: obj.requirementId,
        projectName: obj.project?.name || null
      }));
      return res.status(200).json(response);
    })
    .catch((error) => {
      logger.error(`GET /api/worked-times/person-objectives error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get person objectives for worked times
 * @description Get objectives assigned to a person eligible for time tracking
 * @route {GET} /api/worked-times/person-objectives
 * @queryparam {number} personId Person ID
 * @response {200} OK
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {500} Internal error
 */
router.get('/worked-times/person-objectives',
  hasAnyRole(['user', 'admin']),
  validateQueryParams(querySchema),
  getPersonObjectives
);

export default router;
