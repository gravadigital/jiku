import { Request, Response, NextFunction, Router } from 'express';
import joi from 'joi';
import validateToken from '../utils/middlewares/validate-token';
import validateBodyFields from '../utils/validate-body-fields';
import logger from '../logger';
import { sendCommand } from '../utils/bus/send-command';
import { Person, UnworkedTime } from '@jiku/models';

const router: Router = Router();

const bodySchema = joi.object({
  date: joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  minutes: joi.number().integer().min(1).required(),
  reason: joi.string().valid(
    'tramite', 'corte_servicios', 'vacaciones', 'dia_no_laborable',
    'personal', 'medico', 'estudio', 'enfermedad', 'otro'
  ).required(),
  personId: joi.number().integer().min(1).optional(),
});

function resolvePersonId(req: Request, res: Response, next: NextFunction) {
  if (req.body.personId) {
    return next();
  }

  return Person.findOne({ where: { userId: req.user.id } })
    .then((person) => {
      if (!person) {
        return res.status(400).json({
          code: 'person_not_found',
          message: 'No se encontró una persona vinculada al usuario autenticado',
        });
      }
      req.body.personId = person.id;
      return next();
    })
    .catch((error) => {
      logger.error(`POST /api/unworked-times resolvePersonId error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
    });
}

/**
 * Publica el comando y arma la respuesta.
 *
 * El tope diario de 24 horas lo valida core (suma trabajadas + no trabajadas), así que
 * ya no se chequea acá: llega como `daily_limit_exceeded`, que se traduce al mismo 400
 * con el mismo mensaje que antes.
 */
async function createUnworkedTime(req: Request, res: Response) {
  const { date, minutes, reason, personId } = req.body;

  const data = await sendCommand<{ id: number }>(res, 'unworked-times.new', {
    date, minutes, reason, personId,
  });
  if (!data) {
    return;
  }

  const unworkedTime = await UnworkedTime.findByPk(data.id);
  return res.status(201).json({
    id: unworkedTime!.id,
    date: unworkedTime!.date,
    minutes: unworkedTime!.minutes,
    reason: unworkedTime!.reason,
    personId: unworkedTime!.personId,
    createdAt: unworkedTime!.createdAt,
  });
}

/**
 * @name Create unworked time
 * @description Register an unworked time record with daily limit validation
 * @route {POST} /api/unworked-times
 * @bodyparam {string} date - Date in YYYY-MM-DD format
 * @bodyparam {number} minutes - Minutes unworked (min: 1)
 * @bodyparam {string} reason - Reason from enum
 * @bodyparam {number} [personId] - Person ID (optional, defaults to authenticated user's person)
 * @response {201} Created
 * @response {400} Validation error or daily limit exceeded
 * @response {401} Unauthorized
 * @response {500} Internal error
 */
router.post('/unworked-times',
  validateToken,
  validateBodyFields(bodySchema),
  resolvePersonId,
  createUnworkedTime
);

export default router;
