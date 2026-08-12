import { Request, Response, Router } from 'express';
import joi from 'joi';
import { Op } from 'sequelize';
import validateToken from '../utils/middlewares/validate-token';
import validateQueryParams from '../utils/validate-query-params';
import logger from '../logger';
import { UnworkedTime } from '@jiku/models';

const router: Router = Router();

const querySchema = joi.object({
  dateFrom: joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  dateTo: joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  personId: joi.number().integer().min(1).required(),
});

function getUnworkedTimesReport(req: Request, res: Response) {
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;
  const personId = Number(req.query.personId);

  return UnworkedTime.findAll({
    where: {
      personId,
      date: { [Op.between]: [dateFrom, dateTo] },
    },
    order: [['date', 'ASC']],
  })
    .then((records) => {
      const grouped = records.reduce((acc, record) => {
        const dateStr = record.date;
        if (!acc[dateStr]) {
          acc[dateStr] = { date: dateStr, totalMinutes: 0, entries: [] };
        }
        acc[dateStr].totalMinutes += record.minutes;
        acc[dateStr].entries.push({ id: record.id, minutes: record.minutes, reason: record.reason });
        return acc;
      }, {} as Record<string, { date: string; totalMinutes: number; entries: { id: number; minutes: number; reason: string }[] }>);

      return res.status(200).json(Object.values(grouped));
    })
    .catch((error) => {
      logger.error(`GET /api/unworked-times/report error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
    });
}

/**
 * @name Get unworked times report
 * @description Get unworked time records for a person within a date range, grouped by date
 * @route {GET} /api/unworked-times/report
 * @queryparam {string} dateFrom Start date in YYYY-MM-DD format
 * @queryparam {string} dateTo End date in YYYY-MM-DD format
 * @queryparam {number} personId Person ID
 * @response {200} OK - Array grouped by date with totalMinutes and entries
 * @response {400} Invalid fields
 * @response {401} Unauthorized
 * @response {500} Internal error
 */
router.get('/unworked-times/report',
  validateToken,
  validateQueryParams(querySchema),
  getUnworkedTimesReport
);

export default router;
