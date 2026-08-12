import { Request, Response, Router } from 'express';
import validateToken from '../utils/middlewares/validate-token';

const router: Router = Router();

const UNWORKED_REASONS = [
  { value: 'tramite', label: 'Trámite' },
  { value: 'corte_servicios', label: 'Cortes de servicios' },
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'dia_no_laborable', label: 'Día no laborable' },
  { value: 'personal', label: 'Personal' },
  { value: 'medico', label: 'Médico' },
  { value: 'estudio', label: 'Estudio' },
  { value: 'enfermedad', label: 'Enfermedad' },
  { value: 'otro', label: 'Otro' },
];

function getUnworkedReasons(_req: Request, res: Response) {
  return res.status(200).json(UNWORKED_REASONS);
}

/**
 * @name Get unworked time reasons
 * @description Returns the list of valid unworked time reasons
 * @route {GET} /api/unworked-times/reasons
 * @response {200} OK - Array of 9 reason objects {value, label}
 * @response {401} Unauthorized
 */
router.get('/unworked-times/reasons', validateToken, getUnworkedReasons);

export default router;
