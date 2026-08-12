import { Request, Response, Router } from 'express';
const router: Router = Router();

/**
 * PROVISORIO: no hace nada.
 *
 * Esta ruta creaba o actualizaba el usuario en `users` con los datos de Zitadel, en el
 * primer login. Es la única escritura que quedó sin comando en el protocolo, y ahora
 * falla: la api conecta con un usuario de solo lectura.
 *
 * Mientras tanto responde 200 sin tocar nada, que es lo que la web espera —ya trata el
 * error como no fatal ("Failed to present in API, but continuing")—. La consecuencia es
 * que **un usuario nuevo de Zitadel no queda dado de alta**: si no está en `users`, el
 * resto de las rutas responden 401 `user_not_found`.
 *
 * Pendiente: definir si el alta pasa a ser un comando de core, si la resuelve el
 * auth-callout al autenticar, o si esta ruta conserva escritura propia.
 * Ver documentation/known-limitations.md.
 */
function present(_req: Request, res: Response) {
  return res.status(200).json({});
}

/**
 * @name Present a user
 * @description PROVISORIO: no-op. Ver el comentario de arriba.
 * @route {POST} /api/auth/present
 * @response {200} OK
 * @response {401} Unauthorized
 * @responsebody {string} [code] unauthorized
 * @responsebody {string} [message] Unauthorized
 */
router
  .post('/auth/present',
    present,
  );

export default router;
