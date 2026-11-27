import { Request, Response, Router } from 'express';
import joi from 'joi';
import validateQueryParams from '../utils/validate-query-params';
import hasAnyRole from '../utils/middlewares/has-any-role';
import logger from '../logger';
import { Objective, Project, Requirement, WorkedTime } from '@jiku/models';

const router: Router = Router();

const querySchema = joi.object({
  date: joi.date().iso().required(),
  personId: joi.number().integer().required()
});

function getWorkedTimes(req: Request, res: Response) {
  const date = new Date(`${req.query.date}T00:00:00.000Z`);
  const personId = Number(req.query.personId);

  return WorkedTime.findAll({
    where: { personId, date },
    order: [['createdAt', 'DESC']],
    include: [
      {
        model: Project,
        as: 'projects',
        attributes: ['id', 'name', 'code']
      },
      {
        model: Objective,
        as: 'objective',
        attributes: ['id', 'title']
      },
      {
        model: Requirement,
        as: 'requirement',
        attributes: ['id', 'title']
      }
    ]
  })
    .then((workedTimes) => {
      const response = workedTimes.map((wt) => ({
        id: wt.id,
        date: wt.date,
        minutes: wt.minutes,
        projectId: wt.projectId,
        project: wt.projects ? {
          id: wt.projects.id,
          name: wt.projects.name,
          code: wt.projects.code
        } : null,
        objectiveId: wt.objectiveId,
        objective: wt.objective ? {
          id: wt.objective.id,
          title: wt.objective.title
        } : null,
        requirementId: wt.requirementId,
        requirement: wt.requirement ? {
          id: wt.requirement.id,
          title: wt.requirement.title
        } : null,
        personId: wt.personId,
        createdAt: wt.createdAt
      }));
      return res.status(200).json(response);
    })
    .catch((error) => {
      logger.error(`GET /api/worked-times error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get worked times
 * @description Get worked time records for a person and date
 * @route {GET} /api/worked-times
 * @queryparam {string} date Date in YYYY-MM-DD format
 * @queryparam {number} personId Person ID
 * @response {200} OK
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {500} Internal error
 */
router.get('/worked-times',
  hasAnyRole(['user', 'admin']),
  validateQueryParams(querySchema),
  getWorkedTimes
);

export default router;
