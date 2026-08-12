import { Request, Response, NextFunction, Router } from 'express';
import joi from 'joi';
import validateToken from '../utils/middlewares/validate-token';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateBodyFields from '../utils/validate-body-fields';
import validateWeekNotPast from '../utils/middlewares/validate-week-not-past';
import startTransaction from '../utils/transaction-start';
import commitTransaction from '../utils/transaction-commit';
import logger from '../logger';
import { Project, WeekAssignedTime } from '@jiku/models';

const router: Router = Router();

// Schema de validación Joi para el body del PUT
const putWeekAssignedTimesSchema = joi.object({
  weekStart: joi.date().iso().required(),
  allocations: joi.array().items(
    joi.object({
      personId: joi.number().integer().required(),
      projectId: joi.number().integer().required(),
      minutes: joi.number().integer().min(0).required()
    })
  ).required()
});

// Handler para PUT /api/week-assigned-times
async function putWeekAssignedTimes(req: Request, res: Response, next: NextFunction) {
  const { weekStart, allocations } = req.body;
  const transaction = req.transaction;

  try {
    // Calcular weekEnd (viernes, +4 días)
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekStartDate.getDate() + 4);
    const weekEnd = weekEndDate.toISOString().split('T')[0];

    // 1. Eliminar asignaciones existentes de la semana
    await WeekAssignedTime.destroy({
      where: {
        dateFrom: weekStart,
        dateTo: weekEnd
      },
      transaction
    });

    // 2. Preparar nuevas asignaciones
    const allocationsToCreate = [];

    for (const alloc of allocations) {
      // Filtrar minutes = 0
      if (alloc.minutes === 0) {
        continue;
      }

      // Consultar tipo de proyecto
      const project = await Project.findByPk(alloc.projectId, { transaction });
      if (!project) {
        throw new Error(`Project ${alloc.projectId} not found`);
      }

      // Derivar internal
      const internal = project.type === 'interno';

      allocationsToCreate.push({
        personId: alloc.personId,
        projectId: alloc.projectId,
        minutes: alloc.minutes,
        internal: internal,
        dateFrom: weekStart,
        dateTo: weekEnd
      });
    }

    // 3. Crear asignaciones
    const createdAllocations = await WeekAssignedTime.bulkCreate(
      allocationsToCreate,
      { transaction }
    );

    // 4. Preparar respuesta
    res.locals.responseObject = {
      weekStart,
      weekEnd,
      allocations: createdAllocations
    };

    return next();

  } catch (error: any) {
    logger.error(`PUT /api/week-assigned-times error: ${error.message}`);

    // Rollback
    await transaction.rollback();

    return res.status(500).json({
      code: 'internal_error',
      message: 'Internal error'
    });
  }
}

// Middleware de respuesta final
function sendResponse(_req: Request, res: Response) {
  return res.status(200).json(res.locals.responseObject);
}

/**
 * @name Put week assigned times
 * @description Create or update week assigned times (full replace)
 * @route {PUT} /api/week-assigned-times
 * @bodyparam {string} weekStart - Week start date (YYYY-MM-DD)
 * @bodyparam {array} allocations - Array of allocations
 * @response {200} OK - Allocations saved
 * @response {400} Bad request - Validation error or past week
 * @response {401} Unauthorized - No token or invalid token
 * @response {403} Forbidden - Not admin
 * @response {500} Internal error
 */
router.put('/week-assigned-times',
  validateToken,
  hasAnyRole(['admin']),
  validateBodyFields(putWeekAssignedTimesSchema),
  validateWeekNotPast,
  startTransaction,
  putWeekAssignedTimes,
  commitTransaction,
  sendResponse
);

export default router;
