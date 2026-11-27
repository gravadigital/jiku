import { Request, Response, Router } from 'express';
import { Op } from 'sequelize';
import joi from 'joi';
import validateQueryParams from '../utils/validate-query-params';
import hasAnyRole from '../utils/middlewares/has-any-role';
import logger from '../logger';
import { Person, Project, WeekAssignedTime } from '@jiku/models';

const router: Router = Router();

const querySchema = joi.object({
  weekStart: joi.date().iso().required()
});

function getWeekAssignedTimes(req: Request, res: Response) {
  const weekStart = new Date(req.query.weekStart as string);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);

  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  return Promise.all([
    WeekAssignedTime.findAll({
      where: { dateFrom: weekStart, dateTo: weekEnd },
      attributes: ['id', 'personId', 'projectId', 'minutes', 'internal', 'dateFrom', 'dateTo']
    }),
    Person.findAll({
      where: { enabled: true, mustChargeWorkedTime: true },
      attributes: ['id', 'firstName', 'lastName']
    }),
    Project.findAll({
      where: { status: { [Op.in]: ['activo', 'analisis'] } },
      attributes: ['id', 'name', 'code']
    })
  ])
    .then(([allocations, persons, projects]) => {
      return res.status(200).json({
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        allocations,
        persons,
        projects
      });
    })
    .catch((error) => {
      logger.error(`GET /api/week-assigned-times error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get week assigned times
 * @description Get time allocations for a specific week with eligible persons and projects
 * @route {GET} /api/week-assigned-times
 * @queryparam {string} weekStart Week start date (YYYY-MM-DD, Monday)
 * @response {200} OK
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {500} Internal error
 */
router.get('/week-assigned-times',
  hasAnyRole(['admin', 'user']),
  validateQueryParams(querySchema),
  getWeekAssignedTimes
);

export default router;
