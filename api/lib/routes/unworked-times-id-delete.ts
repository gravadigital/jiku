import { Request, Response, NextFunction, Router } from 'express';
import validateToken from '../utils/middlewares/validate-token';
import logger from '../logger';
import { runCommand } from '../utils/bus/send-command';
import { Person, UnworkedTime } from '@jiku/models';

const router: Router = Router();

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

function validateDeletePermission(req: Request, res: Response, next: NextFunction) {
  const isAdmin = req.decodedTokenRoles.includes('admin');
  if (isAdmin) {
    return next();
  }

  const unworkedTime = req.data as UnworkedTime;

  return Person.findOne({ where: { userId: req.user.id } })
    .then((person) => {
      if (!person || person.id !== unworkedTime.personId) {
        return res.status(403).json({
          code: 'access_denied',
          message: 'Solo podés eliminar tus propios registros',
        });
      }
      return next();
    })
    .catch((error) => {
      logger.error(`DELETE /api/unworked-times/:id validateDeletePermission error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
    });
}

function validateDeadline(req: Request, res: Response, next: NextFunction) {
  const unworkedTime = req.data as UnworkedTime;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 10);

  if (unworkedTime.createdAt < sevenDaysAgo) {
    return res.status(400).json({
      code: 'deadline_exceeded',
      message: 'Solo se pueden eliminar registros creados en los últimos 10 días',
    });
  }
  return next();
}

/**
 * El borrado lo hace core. Las validaciones de arriba se quedan en la api: dependen del
 * rol y del calendario.
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
 * @description Delete an unworked time record (own record, within 7 days of creation)
 * @route {DELETE} /api/unworked-times/:id
 * @response {200} OK - Deleted
 * @response {400} Deadline exceeded
 * @response {401} Unauthorized
 * @response {403} Access denied
 * @response {404} Not found
 * @response {500} Internal error
 */
router.delete('/unworked-times/:id',
  validateToken,
  loadUnworkedTime,
  validateDeletePermission,
  validateDeadline,
  deleteUnworkedTime
);

export default router;
