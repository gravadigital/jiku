import { Request, Response, Router } from 'express';
import { fn, col, literal } from 'sequelize';
import { Objective, WorkedTime } from '@jiku/models';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateRequirement from '../utils/middlewares/validate-requirement';

const router: Router = Router();

function getWorkedHours(req: Request, res: Response) {
  const requirementId = req.requirement.id;

  // Horas directas: worked_times imputados directamente al requisito.
  const directPromise = WorkedTime.sum('minutes', { where: { requirementId } });

  // Horas de objetivos vinculados: worked_times de objetivos con objectives.requirement_id = R.
  // La regla de exclusión (objective_id ↔ requirement_id) garantiza que no haya doble conteo.
  const objectivesPromise = WorkedTime.findOne({
    attributes: [[fn('COALESCE', fn('SUM', col('WorkedTime.minutes')), literal('0')), 'totalMinutes']],
    include: [{
      model: Objective,
      as: 'objective',
      where: { requirementId },
      attributes: [],
      required: true,
    }],
    raw: true,
  });

  return Promise.all([directPromise, objectivesPromise])
    .then(([directSum, objResult]: [number | null, any]) => {
      const direct = directSum || 0;
      const fromObjectives = objResult ? Number(objResult.totalMinutes) : 0;
      return res.status(200).json({
        requirementId,
        totalMinutes: direct + fromObjectives,
      });
    })
    .catch((error: Error) => {
      logger.error(`GET /requirements/:reqid/worked-hours error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
    });
}

router.get('/requirements/:reqid/worked-hours',
  hasAnyRole(['user', 'admin']),
  validateRequirement,
  getWorkedHours
);

export default router;
