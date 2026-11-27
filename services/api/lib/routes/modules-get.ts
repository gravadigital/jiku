import { Request, Response, Router } from 'express';
import hasAnyRole from '../utils/middlewares/has-any-role';
import { listModules } from '../modules/registry';

const router: Router = Router();

function getModules(_req: Request, res: Response) {
  return res.status(200).json(listModules());
}

/**
 * @name Get modules
 * @description Status of the optional modules (REQ-016). `incompatible` is reported as
 * `not_installed`; `features` is omitted when not installed.
 * @route {GET} /api/modules
 * @response {200} OK
 * @response {401} Unauthorized
 * @response {403} Access denied
 *
 * Sin `validateProjectPermissions`: el estado de un módulo no pertenece a ningún proyecto
 * (excepción anotada a ADR-008, igual que `GET /opus/projects`). `hasAnyRole` con los tres
 * roles porque "cualquiera autenticado" no es "cualquier token": deny-by-default. No va en
 * `config/public.ts`.
 */
router.get('/modules', hasAnyRole(['admin', 'user', 'external-user']), getModules);

export default router;
