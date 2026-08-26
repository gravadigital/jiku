import { Request, Response, Router } from 'express';
import joi from 'joi';
import validateBodyFields from '../utils/validate-body-fields';
import hasAnyRole from '../utils/middlewares/has-any-role';
import { Objective, Project, Requirement, WorkedTime } from '@jiku/models';
import { sendCommand } from '../utils/bus/send-command';

const router: Router = Router();

/**
 * SOLO LA FORMA DEL INPUT. El `.oxor('objectiveId', 'requirementId')` que había acá SE ELIMINÓ con
 * REQ-007 (S-031): la exclusión tarea/requisito (C-42) ahora tiene UNA SOLA definición, la de
 * `core/src/commands/times/worked-times.ts`. Dos esquemas para la misma regla es lo que las deja
 * divergir en silencio, y el código que ve el frontend no cambia: core también responde
 * `invalid_fields`.
 *
 * `personId` SIGUE SIENDO OPCIONAL EN EL CONTRATO HTTP y no se toca: es como un `admin` imputa
 * horas a un tercero. Lo que cambió es quién decide si puede (core, C-41) y quién resuelve el
 * default cuando no viene (core, desde el actor del sobre).
 */
const bodySchema = joi.object({
  date: joi.date().iso().required(),
  minutes: joi.number().integer().min(1).required(),
  projectId: joi.number().integer().required(),
  objectiveId: joi.number().integer().allow(null).optional(),
  requirementId: joi.number().integer().allow(null).optional(),
  personId: joi.number().integer().optional(),
});

/**
 * Publica el comando y arma la respuesta.
 *
 * ESTE ENDPOINT YA NO TIENE REGLAS DE NEGOCIO, y no es un olvido (REQ-007, S-031). Las cuatro que
 * vivían acá se fueron a `core`, que es el único servicio que escribe, para que la misma operación
 * dé el mismo resultado por HTTP y por el bus (RF-6):
 *
 *   - la ventana de carga (C-40)                 -> `invalid_date_range`
 *   - solo `admin` imputa a terceros (C-41)      -> `access_denied`
 *   - el default de `personId` desde el usuario  -> `person_not_found`
 *   - la exclusión tarea/requisito (C-42)        -> `invalid_fields`
 *
 * PUDIERON IRSE PORQUE EL SOBRE DE S-029 LE DA A CORE EL ROL Y EL USUARIO FINAL. Hasta entonces no
 * podía aplicarlas —de ahí la nota derogada «core no conoce al usuario final»— y por eso vivían
 * acá. `sendCommand` inyecta el sobre en el embudo: esta ruta no hace nada para que viaje.
 *
 * LO ÚNICO QUE LA API CONSERVA DE ESTE ENDPOINT, además de autenticar y validar la forma del
 * input, es la TRADUCCIÓN `objectiveId` → `taskId` (CA-13): es traducción de contrato, no una
 * regla de negocio, y por eso no se muda.
 *
 * La relectura sigue igual: core devuelve solo el id, pero el contrato con la web es el registro
 * completo con sus relaciones (ADR-001).
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
    // SPREAD CONDICIONAL Y NO `personId,` A SECAS: sin el cuerpo, ese valor es `undefined`, y
    // `JSON.stringify` (bus real) borraría la clave mientras que el `FakeBus` de los tests la
    // dejaría presente. Son dos mensajes distintos para la misma request; la convención
    // `bus-commands` ya manda esta forma. Cuando la clave no está, core resuelve la Persona
    // desde el actor.
    ...(personId !== undefined ? { personId } : {}),
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
 * @description Create a worked time record. Business rules (submission window, imputing to a third
 *   party, the personId default, and the task/requirement exclusion) are enforced by core; the api
 *   only authenticates, validates the input shape and translates objectiveId to taskId.
 * @route {POST} /api/worked-times
 * @bodyparam {string} date - Date in YYYY-MM-DD format
 * @bodyparam {number} minutes - Minutes worked (min: 1)
 * @bodyparam {number} projectId - Project ID
 * @bodyparam {number} [objectiveId] - Objective ID (optional, mutually exclusive with requirementId — enforced by core)
 * @bodyparam {number} [requirementId] - Requirement ID (optional, mutually exclusive with objectiveId — enforced by core)
 * @bodyparam {number} [personId] - Person ID (optional; core resolves it from the actor when absent, and only an admin may send another person's)
 * @response {201} Created
 * @response {400} Validation error (from the api's schema, or from core's reply)
 * @response {403} Access denied
 * @response {500} Internal error
 */
router.post('/worked-times',
  validateBodyFields(bodySchema),
  hasAnyRole(['user', 'admin']),
  createWorkedTime
);

export default router;
