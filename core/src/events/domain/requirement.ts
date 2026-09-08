import { DomainEvent, EVENT_TYPES, EventRecipients, RequirementSnapshot, Actor } from '@jiku/nats-protocol';
import { resolveEventActor } from './actor';

/**
 * `src/events/domain/` — el plano de eventos SALIENTES que `core` publica (REQ-014 / S-063).
 *
 * Es un módulo nuevo bajo `src/events/`, deliberadamente (decisión 2 del diseño técnico): sigue
 * el precedente de `src/events/` para el evento ENTRANTE (`src/events/auth/`, `EventDispatcher`),
 * en vez de ser una rama del módulo de comandos. `src/events/` tiene desde esta story DOS planos
 * — `auth/` (entrante) y `domain/` (saliente) — y el nombre solo no los distingue, de ahí esta
 * línea de comentario en cada uno.
 */

export interface RequirementCreatedInput {
  requirement: {
    id: number;
    projectId: number;
  };
  /** El actor YA RESUELTO por `resolveActor` (el string, no el objeto). */
  actorId: string;
  /** El sobre de identidad del comando, si vino (canal de la api). `undefined` en el canal directo. */
  actorEnvelope: Actor | undefined;
  snapshot: RequirementSnapshot;
  recipients: EventRecipients;
}

/**
 * Construye el evento `requirement.created` (REQ-014 §5), FUNCIÓN PURA: no toca la base ni el
 * bus.
 *
 * DEVUELVE EL SOBRE SIN `eventId`, `occurredAt`, `version` NI `correlationId` (TS-43): esas
 * cuatro claves las completa el EMISOR al publicar (`emit-events.ts`), nunca el comando — un
 * constructor puro no puede generar un ULID ni saber la hora exacta en que el emisor va a
 * publicar, y el `correlationId` es una decisión del despachador (D-4), no del comando.
 *
 * EL TIPO DE RETORNO ES `DomainEvent<RequirementSnapshot>` PARA QUE `reply.events = [...]`
 * COMPILE SIN FRICCIÓN (esa es la forma que el `Reply` del paquete declara, S-062), pero el
 * OBJETO EN RUNTIME no lleva esas cuatro claves como propiedades propias — ni con un valor
 * vacío —, y es la propiedad que TS-43 verifica (`'eventId' in result === false`). El `as` de
 * abajo es la forma de declarar la mentira de tipo de forma acotada y explícita, en vez de
 * escribir cuatro strings vacíos que después alguien podría confundir con valores reales.
 *
 * `changes` NO SE INCLUYE (la clave está AUSENTE, no en `undefined`): en un alta todo es nuevo.
 * Es el mismo patrón condicional que `failure()` usa con `errorDetails` — no escribir la clave
 * con valor `undefined`, porque `should.deepEqual` compara claves propias.
 */
export function requirementCreated(
  input: RequirementCreatedInput
): DomainEvent<RequirementSnapshot> {
  return {
    type: EVENT_TYPES.REQUIREMENT_CREATED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'requirement',
      id: input.requirement.id,
      projectId: input.requirement.projectId,
    },
    snapshot: input.snapshot,
    recipients: input.recipients,
    // `changes` NO VA: en un alta todo es nuevo (CA-8, TS-34).
  } as DomainEvent<RequirementSnapshot>;
}

export default requirementCreated;
