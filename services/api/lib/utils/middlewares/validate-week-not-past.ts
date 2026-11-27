import { Request, Response, NextFunction } from 'express';
import logger from '../../logger';

function validateWeekNotPast(req: Request, res: Response, next: NextFunction) {
  const weekStart = new Date(req.body.weekStart);

  // Calcular lunes de la semana actual
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=domingo, 1=lunes, etc.
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Ajustar para que lunes sea día 0
  const mondayOfCurrentWeek = new Date(today);
  mondayOfCurrentWeek.setDate(today.getDate() + diff);
  mondayOfCurrentWeek.setHours(0, 0, 0, 0);

  // Normalizar weekStart para comparación
  weekStart.setHours(0, 0, 0, 0);

  // Comparar
  if (weekStart < mondayOfCurrentWeek) {
    logger.warn(`Attempt to modify past week: ${req.body.weekStart}`);
    return res.status(400).json({
      code: 'invalid_week',
      message: 'No se pueden modificar semanas pasadas'
    });
  }

  return next();
}

export default validateWeekNotPast;
