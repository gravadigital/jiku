import { Request, Response, NextFunction, Router } from 'express';
import joi from 'joi';
import validateBodyFields from '../utils/validate-body-fields';
import hasAnyRole from '../utils/middlewares/has-any-role';
import logger from '../logger';
import { Objective, Person, Project, Requirement, WorkedTime } from '@jiku/models';
import { sendCommand } from '../utils/bus/send-command';

const router: Router = Router();

const bodySchema = joi.object({
  date: joi.date().iso().required(),
  minutes: joi.number().integer().min(1).required(),
  projectId: joi.number().integer().required(),
  objectiveId: joi.number().integer().allow(null).optional(),
  requirementId: joi.number().integer().allow(null).optional(),
  personId: joi.number().integer().optional(),
}).oxor('objectiveId', 'requirementId');

/**
 * Resuelve el default de `personId`: la persona del usuario autenticado.
 *
 * Queda en la api porque core no conoce al usuario final — solo recibe el `personId` ya
 * resuelto.
 */
function resolvePersonId(req: Request, res: Response, next: NextFunction) {
  if (req.body.personId) {
    return next();
  }

  return Person.findOne({ where: { userId: req.user.id } })
    .then((person) => {
      if (!person) {
        return res.status(400).json({
          code: 'person_not_found',
          message: 'No se encontró una persona vinculada al usuario autenticado'
        });
      }
      req.body.personId = person.id;
      return next();
    })
    .catch((error) => {
      logger.error(`POST /api/worked-times resolvePersonId error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * Solo un admin puede imputar horas a otra persona.
 *
 * Es una validación de rol, así que vive en la api: core no recibe los roles.
 */
function validatePersonPermission(req: Request, res: Response, next: NextFunction) {
  const isAdmin = req.decodedTokenRoles.includes('admin');
  if (isAdmin) {
    return next();
  }

  return Person.findOne({ where: { userId: req.user.id } })
    .then((person) => {
      if (!person || person.id !== req.body.personId) {
        return res.status(403).json({
          code: 'access_denied',
          message: 'Solo podés cargar tus propias horas'
        });
      }
      return next();
    })
    .catch((error) => {
      logger.error(`POST /api/worked-times validatePersonPermission error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * Ventana de carga: el día actual y los 10 previos.
 *
 * Se queda en la api porque no está en el protocolo y depende del calendario, no de los
 * datos. Ver documentation/known-limitations.md.
 */
function validateDateRange(req: Request, res: Response, next: NextFunction) {
  const date = new Date(req.body.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 10);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly < sevenDaysAgo || dateOnly >= tomorrow) {
    return res.status(400).json({
      code: 'invalid_date_range',
      message: 'Solo se pueden cargar horas del día actual y los 10 días previos'
    });
  }
  return next();
}

/**
 * Publica el comando y arma la respuesta.
 *
 * Core devuelve solo el id, pero el contrato con la web es el registro completo con sus
 * relaciones, así que hay que leerlo de la base.
 */
async function createWorkedTime(req: Request, res: Response) {
  const { date, minutes, projectId, objectiveId, requirementId, personId } = req.body;

  // `objectiveId` pasa a llamarse `taskId` en el bus; la columna sigue siendo la misma.
  const data = await sendCommand<{ id: number }>(res, 'worked-times.new', {
    date: new Date(date).toISOString().split('T')[0],
    minutes,
    projectId,
    ...(objectiveId ? { taskId: objectiveId } : {}),
    ...(requirementId ? { requirementId } : {}),
    personId,
  });
  if (!data) {
    return;
  }

  const workedTime = await WorkedTime.findByPk(data.id, {
    include: [
      { model: Project, as: 'projects', attributes: ['id', 'name', 'code'] },
      { model: Objective, as: 'objective', attributes: ['id', 'title'] },
      { model: Requirement, as: 'requirement', attributes: ['id', 'title'] }
    ],
  });

  const wt = workedTime!;
  return res.status(201).json({
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
  });
}

/**
 * @name Create worked time
 * @description Create a worked time record with business validations
 * @route {POST} /api/worked-times
 * @bodyparam {string} date - Date in YYYY-MM-DD format
 * @bodyparam {number} minutes - Minutes worked (min: 1)
 * @bodyparam {number} projectId - Project ID
 * @bodyparam {number} [objectiveId] - Objective ID (optional, mutually exclusive with requirementId)
 * @bodyparam {number} [requirementId] - Requirement ID (optional, mutually exclusive with objectiveId)
 * @bodyparam {number} [personId] - Person ID (optional, defaults to authenticated user's person)
 * @response {201} Created
 * @response {400} Validation error
 * @response {403} Access denied
 * @response {500} Internal error
 */
router.post('/worked-times',
  validateBodyFields(bodySchema),
  hasAnyRole(['user', 'admin']),
  resolvePersonId,
  validatePersonPermission,
  validateDateRange,
  createWorkedTime
);

export default router;
