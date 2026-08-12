import { Request, Response, Router } from 'express';
import hasAnyRole from '../utils/middlewares/has-any-role';
import logger from '../logger';
import { SystemSetting } from '@jiku/models';

const router: Router = Router();

function getHoursPerDay(_req: Request, res: Response) {
  return SystemSetting.findOne({ where: { key: 'hours_per_day' } })
    .then((setting) => {
      return res.status(200).json({
        hoursPerDay: Number(setting!.value)
      });
    })
    .catch((error) => {
      logger.error(`GET /api/settings/hours-per-day error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get hours per day
 * @description Get the configured hours per day value
 * @route {GET} /api/settings/hours-per-day
 * @response {200} OK
 * @response {403} Access denied
 * @response {500} Internal error
 */
router.get('/settings/hours-per-day', hasAnyRole(['admin', 'user']), getHoursPerDay);

export default router;
