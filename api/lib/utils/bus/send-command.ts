import { Request, Response } from 'express';
import { ErrorCode, NatsError } from 'nats';
import logger from '../../logger';
import { buildActor } from './actor';
import { bus } from './index';
import { Reply, errorBody, httpStatusFor } from './protocol';

/** Un objeto plano: ni `null`, ni un array, ni un escalar. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Agrega el sobre de identidad al cuerpo del comando.
 *
 * VA ACÁ, EN EL EMBUDO, Y NO EN LAS 27 LLAMADAS DE LAS 26 RUTAS. Tres razones:
 *
 *  1. SIMETRÍA CON CORE. Del otro lado el sobre lo EXTRAE el despachador, no los 20 esquemas Joi,
 *     porque "el sobre es del transporte, no del dominio" (`core/src/bus/actor.ts`). Inyectarlo en
 *     el cliente del bus es exactamente el mismo criterio del lado emisor.
 *  2. LA CONVENCIÓN LO PIDE: las traducciones de contrato viven en `lib/utils/bus/`, no dispersas
 *     en los handlers (`bus-commands`).
 *  3. Y LA QUE DECIDE: UNA RUTA NUEVA NACE CON SOBRE. Es el mismo argumento de ADR-008 para
 *     instalar `validateToken` global — el modo de fallo por omisión desaparece. Una lista de 27
 *     call sites que hay que acordarse de hacer crecer es la lista que un día deja publicar un
 *     comando sin identidad.
 *
 * EL SOBRE VA DESPUÉS DEL SPREAD, y es deliberado: si un payload trajera su propia clave `actor`,
 * GANA EL DEL TOKEN. Al revés sería exactamente el agujero que CA-3 cierra del lado de core —
 * identidad declarada por el cuerpo en vez de por el token.
 *
 * NO TOCA `bus().query()`: el plano de consultas resuelve la identidad POR EL SUBJECT y sólo por
 * ahí (REQ-006 §19), y un campo de identidad en el payload de una consulta se RECHAZA.
 */
function withActor(res: Response, command: string, payload: unknown): unknown {
  const actor = buildActor(res.req);

  if (!actor) {
    // Hoy inalcanzable: las cuatro listas de `config/public.ts` están vacías, así que no hay ruta
    // sin `validateToken`. El `warn` existe para que, si alguna vez la hay, se vea — omitir el
    // sobre deja el comportamiento de HOY (core resuelve por `creator`/`author`/`editor`), no uno
    // más amplio. Sólo el nombre del comando: ningún dato de usuario (convención `logging`).
    logger.warn(`[bus] ${command}: sin token verificado, el comando se publica sin sobre de identidad`);
    return payload;
  }

  if (!isPlainObject(payload)) {
    // Hoy las 27 llamadas pasan objetos literales. La guarda existe para que un futuro `null` o un
    // array no se rompa contra el spread, no porque el caso ocurra.
    logger.warn(`[bus] ${command}: el payload no es un objeto, el comando se publica sin sobre`);
    return payload;
  }

  return { ...payload, actor };
}

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
    reply = await bus().request<T>(command, withActor(res, command, payload));
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

/**
 * El id de usuario que va como `creator` / `author` / `editor` / `uploader` en el comando.
 *
 * SE LLAMA `actorId` Y NO `actor` DESDE S-029: `actor` es ahora la clave reservada del mensaje —un
 * objeto de cinco campos— y dos cosas distintas con el mismo nombre en el mismo archivo es cómo se
 * escribe el bug. Éste sigue siendo un campo DE DOMINIO, y por eso no desaparece (CA-7).
 */
export function actorId(req: Request): string {
  return req.user.id;
}
