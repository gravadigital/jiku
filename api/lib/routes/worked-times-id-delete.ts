import { Request, Response, NextFunction, Router } from 'express';
import hasAnyRole from '../utils/middlewares/has-any-role';
import logger from '../logger';
import { Person, WorkedTime } from '@jiku/models';
import { runCommand } from '../utils/bus/send-command';

const router: Router = Router();

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

function validateDeleteDateRange(req: Request, res: Response, next: NextFunction) {
  const workedTime = req.data as WorkedTime;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 10);

  const recordDate = new Date(workedTime.date);
  recordDate.setHours(0, 0, 0, 0);

  if (recordDate < sevenDaysAgo) {
    return res.status(400).json({
      code: 'invalid_date_range',
      message: 'Solo se pueden eliminar registros del día actual y los 10 días previos'
    });
  }
  return next();
}

function validateDeletePermission(req: Request, res: Response, next: NextFunction) {
  const isAdmin = req.decodedTokenRoles.includes('admin');
  if (isAdmin) {
    return next();
  }

  const workedTime = req.data as WorkedTime;

  return Person.findOne({ where: { userId: req.user.id } })
    .then((person) => {
      if (!person || person.id !== workedTime.personId) {
        return res.status(403).json({
          code: 'access_denied',
          message: 'Solo podés eliminar tus propios registros'
        });
      }
      return next();
    })
    .catch((error) => {
      logger.error(`DELETE /api/worked-times/:id validateDeletePermission error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * El borrado lo hace core. Las validaciones de arriba se quedan en la api porque
 * dependen del rol y del calendario, que core no conoce.
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
 * @description Delete a worked time record
 * @route {DELETE} /api/worked-times/:id
 * @response {200} OK - Record deleted
 * @response {400} Date out of range
 * @response {403} Access denied
 * @response {404} Not found
 * @response {500} Internal error
 */
router.delete('/worked-times/:id',
  hasAnyRole(['user', 'admin']),
  loadWorkedTime,
  validateDeleteDateRange,
  validateDeletePermission,
  deleteWorkedTime
);

export default router;
