import { Request, Response } from 'express';
import { ErrorCode, NatsError } from 'nats';
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
 * Cuando no hubo reply hay dos: 503 si no hay nadie escuchando, 504 si la respuesta no llegó
 * a tiempo.
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
    // No hubo reply. Sin JetStream no hay cola ni reintento (ADR-002), así que lo único que
    // se puede hacer es decirle al cliente CUÁL de las dos fallas ocurrió, porque implican
    // cosas opuestas: con 503 la operación NO ocurrió y reintentar es seguro; con 504 PUDO
    // haber ocurrido y reintentar a ciegas puede duplicar, porque los comandos no son
    // idempotentes.
    //
    // El log queda igual y ya distingue las dos causas sin una línea más: el `message` de un
    // `NatsError` es su propio código, así que sale `TIMEOUT` o `503`.
    logger.error(`[bus] ${command}: ${error.message}`);

    // La rama se elige por LA SEÑAL del cliente NATS, no por el tiempo transcurrido ni por el
    // texto del mensaje: `no responders` llega en milisegundos —lo contesta el server, no
    // vence el timeout— y un timeout que vence antes de lo esperado sigue siendo un timeout.
    //
    // `isNatsError` no se puede importar de `nats` (no lo re-exporta la superficie pública),
    // así que la forma es `instanceof`, que acá es seguro: hay una sola copia del paquete
    // instalada, hoisteada en la raíz del monorepo.
    if (error instanceof NatsError && error.code === ErrorCode.Timeout) {
      res.status(504).json({
        code: 'gateway_timeout',
        message: 'La operación tardó demasiado',
      });
      return null;
    }

    // Todo lo demás sale 503, y eso INCLUYE `no responders`: devuelve este mismo cuerpo, así
    // que una rama propia sería código muerto. (`ErrorCode.NoResponders` es además el string
    // '503', que colisiona con `JetStreamNotEnabled`: otra razón para discriminar solo por
    // `Timeout`.)
    //
    // Ninguno de estos dos `code` va a STATUS_BY_ERROR_CODE: ese mapa traduce el `errorCode`
    // de un reply de core, y acá no hubo reply — los genera la api.
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
