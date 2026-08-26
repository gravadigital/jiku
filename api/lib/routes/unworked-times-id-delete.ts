import { Request, Response, NextFunction, Router } from 'express';
import validateToken from '../utils/middlewares/validate-token';
import logger from '../logger';
import { runCommand } from '../utils/bus/send-command';
import { UnworkedTime } from '@jiku/models';

const router: Router = Router();

/**
 * SE QUEDA (H-3 del plan de S-031), y por dos razones independientes:
 *
 *  1. ES EL 404 DEL PATH que el contrato promete. Core, para el mismo caso, responde
 *     `unworked_time_not_found`, que `STATUS_BY_ERROR_CODE` mapea a 400 — no a 404.
 *  2. `validateDeadline` NECESITA `req.data`. Sin este middleware no hay regla que aplicar.
 */
function loadUnworkedTime(req: Request, res: Response, next: NextFunction) {
  return UnworkedTime.findByPk(Number(req.params.id))
    .then((unworkedTime) => {
      if (!unworkedTime) {
        return res.status(404).json({
          code: 'unworked_time_not_found',
          message: 'Registro de tiempo no trabajado no encontrado',
        });
      }
      req.data = unworkedTime;
      return next();
    })
    .catch((error) => {
      logger.error(`DELETE /api/unworked-times/:id loadUnworkedTime error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
    });
}

/**
 * EL DEADLINE DE LAS AUSENCIAS **NO SE MUDÓ A CORE, Y NO ES UN OLVIDO** (REQ-007, S-031).
 *
 * Es la ÚNICA regla de negocio que sobrevive en las cuatro rutas de tiempos, y sobrevive porque
 * NO ES LA VENTANA DE CARGA con otro nombre:
 *
 *   - compara **`created_at`**, no `date`
 *   - responde **`deadline_exceeded`**, un código que EMITE LA API y que por eso NO ESTÁ en
 *     `STATUS_BY_ERROR_CODE`: nunca llega por reply de core
 *   - `docs/apis/core.yaml` lo confirma del otro lado: `invalid_date_range` lo emite SOLO
 *     `worked-times.{id}.delete`, NO `unworked-times.{id}.delete`
 *
 * Mudarla exigiría un código nuevo en el protocolo del bus, y core decidió explícitamente no
 * tomarla. QUEDA COMO DEUDA DECLARADA, no como descuido: si la próxima story la muda «por
 * consistencia» con las horas, rompe el contrato con los frontends.
 */
function validateDeadline(req: Request, res: Response, next: NextFunction) {
  const unworkedTime = req.data as UnworkedTime;
  // Se llamaba `sevenDaysAgo` y restaba 10 días: el nombre mentía desde antes de esta story. Se
  // corrige acá porque el `grep` de cierre de S-031 busca los nombres de las reglas que se fueron,
  // y un falso positivo con el nombre viejo hace que la próxima lectura dude de si ésta se quedó.
  const limiteDelDeadline = new Date();
  limiteDelDeadline.setDate(limiteDelDeadline.getDate() - 10);

  if (unworkedTime.createdAt < limiteDelDeadline) {
    return res.status(400).json({
      code: 'deadline_exceeded',
      message: 'Solo se pueden eliminar registros creados en los últimos 10 días',
    });
  }
  return next();
}

/**
 * El borrado lo hace core, Y LA TITULARIDAD TAMBIÉN LA DECIDE ÉL (REQ-007, S-031).
 *
 * Este docblock decía que LAS validaciones se quedaban en la api «porque dependen del rol y del
 * calendario». Con el sobre de S-029 core conoce el actor y sus roles, así que `validateDeletePermission`
 * se eliminó: un registro de otra Persona vuelve ahora como `access_denied` en el reply, con el
 * mismo 403 y el mismo mensaje que respondía la api (CA-10, CA-12).
 *
 * LO QUE SE QUEDA ES EL DEADLINE, y arriba está escrito por qué. Como corre ANTES de publicar y la
 * titularidad corre DESPUÉS, LA PRECEDENCIA SE INVIRTIÓ: una ausencia ajena Y vencida sale ahora
 * `deadline_exceeded` (400) donde antes salía `access_denied` (403).
 */
async function deleteUnworkedTime(req: Request, res: Response) {
  const ok = await runCommand(res, `unworked-times.${req.params.id}.delete`, {});
  if (!ok) {
    return;
  }

  return res.status(200).json({ message: 'Deleted' });
}

/**
 * @name Delete unworked time
 * @description Delete an unworked time record. The api enforces only its own deadline (10 days
 *   from created_at); ownership is enforced by core and arrives as access_denied in the reply.
 * @route {DELETE} /api/unworked-times/:id
 * @response {200} OK - Deleted
 * @response {400} Deadline exceeded - the api's own rule, on created_at
 * @response {401} Unauthorized
 * @response {403} Access denied - comes from core's reply (access_denied), not from the api
 * @response {404} Not found - the api's own check on the path entity
 * @response {500} Internal error
 */
router.delete('/unworked-times/:id',
  validateToken,
  loadUnworkedTime,
  validateDeadline,
  deleteUnworkedTime
);

export default router;
