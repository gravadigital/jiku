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
