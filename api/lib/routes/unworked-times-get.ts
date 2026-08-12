import { Request, Response, Router } from 'express';
import joi from 'joi';
import validateToken from '../utils/middlewares/validate-token';
import validateQueryParams from '../utils/validate-query-params';
import logger from '../logger';
import { UnworkedTime } from '@jiku/models';

const router: Router = Router();

const querySchema = joi.object({
  date: joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  personId: joi.number().integer().min(1).required(),
});

function getUnworkedTimes(req: Request, res: Response) {
  const date = req.query.date as string;
  const personId = Number(req.query.personId);

  return UnworkedTime.findAll({
    where: { personId, date },
    order: [['createdAt', 'DESC']],
  })
    .then((items) => {
      const response = items.map((item) => ({
        id: item.id,
        date: item.date,
        minutes: item.minutes,
        reason: item.reason,
        personId: item.personId,
        createdAt: item.createdAt,
      }));
      return res.status(200).json(response);
    })
    .catch((error) => {
      logger.error(`GET /api/unworked-times error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
    });
}

/**
 * @name Get unworked times
 * @description Get unworked time records for a person and date
 * @route {GET} /api/unworked-times
 * @queryparam {string} date Date in YYYY-MM-DD format
 * @queryparam {number} personId Person ID
 * @response {200} OK
 * @response {400} Invalid fields
 * @response {401} Unauthorized
 * @response {500} Internal error
 */
router.get('/unworked-times', validateToken, validateQueryParams(querySchema), getUnworkedTimes);

export default router;
