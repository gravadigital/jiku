import { Request, Response, Router } from 'express';
import joi from 'joi';
import validateToken from '../utils/middlewares/validate-token';
import validateBodyFields from '../utils/validate-body-fields';
import { runCommand } from '../utils/bus/send-command';
import logger from '../logger';
import { WeekAssignedTime } from '@jiku/models';

const router: Router = Router();

// Schema de validación Joi para el body del PUT — forma HTTP, sin cambios (S-032).
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

/**
 * Handler para PUT /api/week-assigned-times — comando + relectura (S-032).
 *
 * La escritura la hace `core`: la api publica `week-assigned-times.replace` y arma la
 * respuesta releyendo la base. `core` responde `ReplyEmpty` (CA-8), así que se usa
 * `runCommand` y no `sendCommand` (que devolvería `null` incluso en éxito).
 *
 * TRADUCCIÓN DE NOMBRES (H-2): el contrato HTTP usa `weekStart`/`allocations`; el
 * contrato del bus usa `dateFrom`/`assignments`. NO son alias — son dos contratos
 * correctos que dicen cosas distintas, y la traducción va acá.
 *
 * `hasAnyRole(['admin'])`, `validateWeekNotPast`, `startTransaction`/`commitTransaction`
 * y la escritura con el ORM (`destroy`+`bulkCreate`) se ELIMINAN de esta ruta (CA-10):
 * C-38 y C-36 las resuelve `core` (el mapa rol → comando y el comando, respectivamente),
 * y la transacción es la del despachador de `core` (ADR-003).
 */
async function putWeekAssignedTimes(req: Request, res: Response) {
  const { weekStart, allocations } = req.body;

  const ok = await runCommand(res, 'week-assigned-times.replace', {
    dateFrom: weekStart,
    assignments: allocations,
  });
  if (!ok) {
    return;
  }

  // Calcular weekEnd (viernes, +4 días) — transporte HTTP, no regla de dominio.
  const weekStartDate = new Date(weekStart);
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekStartDate.getDate() + 4);
  const weekEnd = weekEndDate.toISOString().split('T')[0];

  try {
    const allocationsResult = await WeekAssignedTime.findAll({
      where: { dateFrom: weekStart, dateTo: weekEnd },
      attributes: ['id', 'personId', 'projectId', 'minutes', 'internal', 'dateFrom', 'dateTo']
    });

    return res.status(200).json({
      weekStart,
      weekEnd,
      allocations: allocationsResult
    });
  } catch (error: any) {
    logger.error(`PUT /api/week-assigned-times error: ${error.message}`);
    return res.status(500).json({
      code: 'internal_error',
      message: 'Internal error'
    });
  }
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
 * @response {503} Service unavailable - Bus caído (ADR-002)
 * @response {504} Gateway timeout - El bus no respondió a tiempo (ADR-002)
 */
router.put('/week-assigned-times',
  validateToken,
  validateBodyFields(putWeekAssignedTimesSchema),
  putWeekAssignedTimes
);

export default router;
