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
 * error como no fatal ("Failed to present in API, but continuing")—.
 *
 * Desde S-034 (D-6, H-5) esta ruta YA NO TIENE del 401 `user_not_found` del que eximirse:
 * `validateToken` arma `req.user` del claim ya verificado, sin consultar `users`, así que
 * ninguna ruta —esta incluida— corta por falta de fila. La fila se crea sola con el primer
 * comando que la persona publica (S-029); mientras tanto, opera igual desde la primera
 * pantalla.
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
