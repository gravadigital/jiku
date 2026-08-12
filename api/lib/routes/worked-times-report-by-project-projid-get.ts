import { Request, Response, Router } from 'express';
import joi from 'joi';
import { Op, fn, col, literal } from 'sequelize';
import validateQueryParams from '../utils/validate-query-params';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateProject from '../utils/middlewares/validate-project';
import logger from '../logger';
import { WorkedTime } from '@jiku/models';

const router: Router = Router();

const querySchema = joi.object({
  dateFrom: joi.date().iso().required(),
  dateTo: joi.date().iso().min(joi.ref('dateFrom')).required()
});

function getTotalByProject(req: Request, res: Response) {
  const dateFrom = new Date(`${req.query.dateFrom}T00:00:00.000Z`);
  const dateTo = new Date(`${req.query.dateTo}T23:59:59.999Z`);
  const projectId = req.project.id;

  return WorkedTime.findOne({
    attributes: [[fn('COALESCE', fn('SUM', col('minutes')), literal('0')), 'totalMinutes']],
    where: {
      projectId,
      date: { [Op.between]: [dateFrom, dateTo] }
    },
    raw: true
  })
    .then((row) => {
      const totalMinutes = Number((row as unknown as { totalMinutes: string | null })?.totalMinutes ?? 0);
      return res.status(200).json({
        projectId,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        totalMinutes
      });
    })
    .catch((error) => {
      logger.error(`GET /api/worked-times/report/by-project/:projid error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

router.get('/worked-times/report/by-project/:projid',
  hasAnyRole(['user', 'admin']),
  validateProject,
  validateQueryParams(querySchema),
  getTotalByProject
);

export default router;
