import { Request, Response } from 'express';
import logger from '../../logger';
import { bus } from './index';
import { Reply, errorBody, httpStatusFor } from './protocol';

/**
 * Publica un comando y traduce la respuesta de core a HTTP.
 *
 * Devuelve el `data` de la respuesta si salió bien, o `null` si ya se respondió con un
 * error — en ese caso el llamador tiene que cortar.
 *
 *     const data = await sendCommand(res, 'clients.new', payload);
 *     if (!data) return;
 *
 * El status y el cuerpo de error son los que esperan web y opus-web (ver `httpStatusFor`).
 */
export async function sendCommand<T = any>(
  res: Response,
  command: string,
  payload: unknown
): Promise<T | null> {
  let reply: Reply<T>;

  try {
    reply = await bus().request<T>(command, payload);
  } catch (error: any) {
    // Timeout o bus caído. Sin JetStream no hay reintento: la operación no ocurrió.
    logger.error(`[bus] ${command}: ${error.message}`);
    res.status(503).json({
      code: 'service_unavailable',
      message: 'El servicio no está disponible en este momento',
    });
    return null;
  }

  if (reply.status !== 'success') {
    res.status(httpStatusFor(reply.errorCode)).json(errorBody(reply));
    return null;
  }

  return (reply.data ?? null) as T | null;
}

/**
 * Igual que `sendCommand`, para los comandos cuya respuesta no trae datos.
 *
 * Devuelve `true` si salió bien. Un comando exitoso sin `data` haría que `sendCommand`
 * devuelva `null`, que es indistinguible de un error si no se mira `headersSent`.
 */
export async function runCommand(
  res: Response,
  command: string,
  payload: unknown
): Promise<boolean> {
  await sendCommand(res, command, payload);
  return !res.headersSent;
}

/** El id de usuario que va como `creator` / `author` / `editor` en el comando. */
export function actor(req: Request): string {
  return req.user.id;
}
