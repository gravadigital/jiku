import { Actor, EventActor } from '@jiku/nats-protocol';

/**
 * Resuelve el `EventActor` de un evento de dominio a partir del contexto de identidad del
 * comando (REQ-014 / S-063, Task 4).
 *
 * EN ARCHIVO PROPIO porque S-064/S-065 lo van a compartir: los 16 eventos del catálogo necesitan
 * el mismo fallback.
 *
 * EL FALLBACK ES `name` -> `email` -> `id` (D-5, ya decidido en la planificación), y las fuentes
 * disponibles son, en orden:
 *
 *   1. `ctx.actor.name` — el sobre de identidad, canal de la api.
 *   2. `ctx.actor.email` — idem.
 *   3. El `id` YA RESUELTO por `resolveActor` (el `sub` de Zitadel, o el `caller` del canal
 *      externo/exento).
 *
 * SIN `SELECT` EXTRA CUANDO EL CANAL ES DIRECTO (sin sobre): el contrato ya declara que
 * `EventActor.name` "PUEDE SER UN ID — el conector no debe asumir que es un nombre humano", y el
 * REQ marca esta asimetría (R-5) como ASUMIDA y a declarar en el contrato, no como algo a igualar
 * con una consulta. Un `SELECT` por evento para un dato opcional y best-effort no se paga.
 *
 * ESTE RESOLVER NO CAMBIÓ EN S-068, PERO SU ENTRADA SÍ, y conviene saberlo antes de leer un
 * `actor.name` en producción. El access token de Zitadel NO TRAE los claims de perfil, así que el
 * sobre que arma la api llegaba siempre con `id` y `roles` y nada más, y la rama `envelope.name`
 * de acá era, en la práctica, código muerto en el canal de la api: todo evento salía con el `sub`.
 *
 * LA CORRECCIÓN VIVE EN `bus/dispatcher.ts`, NO ACÁ: el despachador COMPLETA el sobre con el
 * `name` de la fila de `users` —que `mirrorActor` ya leyó, sin una consulta nueva— antes de armar
 * el contexto del comando. Por eso este resolver sigue siendo puro y sigue sin tocar la base; lo
 * que recibe es un sobre que puede venir ya enriquecido. La precedencia efectiva es:
 *
 *     name del sobre  ->  email del sobre  ->  name de la fila  ->  id
 *
 * y los dos primeros escalones son los de esta función, intactos: la fila se inserta ANTES de
 * llegar acá y solo cuando el sobre no trae ninguno de los dos claims.
 *
 * `actor.email` NUNCA VIAJA (contrato: `EventActor` no declara esa clave). Este resolver no la
 * copia ni siquiera internamente más allá de leerla para el fallback.
 */
export function resolveEventActor(actorId: string, envelope: Actor | undefined): EventActor {
  if (envelope) {
    return { id: actorId, name: envelope.name ?? envelope.email ?? actorId };
  }
  return { id: actorId, name: actorId };
}

export default resolveEventActor;
