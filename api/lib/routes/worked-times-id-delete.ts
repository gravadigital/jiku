import { Request, Response, NextFunction, Router } from 'express';
import hasAnyRole from '../utils/middlewares/has-any-role';
import logger from '../logger';
import { WorkedTime } from '@jiku/models';
import { runCommand } from '../utils/bus/send-command';

const router: Router = Router();

/**
 * SE QUEDA, Y NO ES CÓDIGO MUERTO (H-3 / D-3 del plan de S-031). Dos cosas, y hacen falta las dos:
 *
 *  1. ES EL 404 QUE EL CONTRATO PROMETE. Ninguna otra pieza lo da.
 *  2. CORE, PARA EL MISMO CASO, RESPONDE `worked_time_not_found`, QUE `STATUS_BY_ERROR_CODE` MAPEA
 *     A 400 — NO A 404. Si se borra este middleware «porque core ya lee el registro», el 404 se
 *     convierte en 400 y eso viola CA-12.
 *
 * Remapear esos códigos a 404 en el protocolo y borrar el loader está EVALUADO Y DESCARTADO: el
 * mapa es DEL SERVICIO, no del endpoint, así que el beneficio sería local y el riesgo global.
 *
 * `req.data` queda escrito y ya no se lee EN ESTA RUTA —la titularidad y la ventana se fueron a
 * core—, pero NO se cambia `loadWorkedTime` para que deje de escribirlo: la ruta de ausencias usa
 * la misma forma y ahí sí lo lee `validateDeadline`.
 */
function loadWorkedTime(req: Request, res: Response, next: NextFunction) {
  return WorkedTime.findByPk(req.params.id as string)
    .then((workedTime) => {
      if (!workedTime) {
        return res.status(404).json({
          code: 'worked_time_not_found',
          message: 'Registro no encontrado'
        });
      }
      req.data = workedTime;
      return next();
    })
    .catch((error) => {
      logger.error(`DELETE /api/worked-times/:id loadWorkedTime error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * El borrado lo hace core, Y AHORA TAMBIÉN LO DECIDE (REQ-007, S-031).
 *
 * Hasta esta story el docblock decía que la titularidad y la ventana se quedaban en la api «porque
 * dependen del rol y del calendario, que core no conoce». ESO DEJÓ DE SER CIERTO con el sobre de
 * S-029: core recibe el actor y sus roles, así que las dos reglas viven donde se escribe, y core
 * dejó de «borrar lo que le dicen». Las respuestas son las mismas:
 *
 *   - registro de otra Persona (salvo `admin`) -> `access_denied`      -> 403
 *   - registro fuera de la ventana de carga    -> `invalid_date_range` -> 400
 *
 * EL ORDEN CAMBIÓ, y con él qué error se ve cuando fallan las dos a la vez: la api chequeaba
 * ventana → titularidad; core chequea TITULARIDAD → VENTANA, porque es la que menos revela. Un
 * registro ajeno y vencido sale ahora `access_denied` donde antes salía `invalid_date_range`.
 */
async function deleteWorkedTime(req: Request, res: Response) {
  const ok = await runCommand(res, `worked-times.${req.params.id}.delete`, {});
  if (!ok) {
    return;
  }

  return res.status(200).json({ message: 'Registro eliminado' });
}

/**
 * @name Delete worked time
 * @description Delete a worked time record. Ownership and the submission window are enforced by
 *   core; the api only resolves the 404 of the path entity and translates core's reply.
 * @route {DELETE} /api/worked-times/:id
 * @response {200} OK - Record deleted
 * @response {400} Date out of range - comes from core's reply (invalid_date_range), not from the api
 * @response {403} Access denied - comes from core's reply (access_denied), not from the api
 * @response {404} Not found - the api's own check on the path entity
 * @response {500} Internal error
 */
router.delete('/worked-times/:id',
  hasAnyRole(['user', 'admin']),
  loadWorkedTime,
  deleteWorkedTime
);

export default router;
