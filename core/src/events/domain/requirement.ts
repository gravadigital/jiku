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

/** Los campos que TODOS los constructores de esta story comparten (S-064). */
interface BaseEventInput {
  requirement: {
    id: number;
    projectId: number;
  };
  /** El actor YA RESUELTO por `resolveActor` (el string, no el objeto). */
  actorId: string;
  /** El sobre de identidad del comando, si vino. `undefined` en el canal directo. */
  actorEnvelope: Actor | undefined;
  snapshot: RequirementSnapshot;
  recipients: EventRecipients;
}

export interface RequirementStateChangedInput extends BaseEventInput {
  from: string;
  to: string;
}

/**
 * Construye `requirement.state.changed` (REQ-014 §5, CA-1, CA-15). FUNCIÓN PURA.
 *
 * NO VALIDA NI ASUME PROGRESIÓN (CA-15, REQ-012): cualquier transición es válida, incluidos
 * retrocesos y saltos. El constructor solo traduce `from`/`to` a la forma del contrato.
 */
export function requirementStateChanged(
  input: RequirementStateChangedInput
): DomainEvent<RequirementSnapshot> {
  // Tipado explícito a `Record<string, unknown>` (igual que `DomainEvent.changes`): un objeto
  // literal más estrecho hace que el `as DomainEvent<...>` de abajo falle en compilación
  // (TS2352, "may be a mistake") por insuficiente solapamiento estructural.
  const changes: Record<string, unknown> = { state: { from: input.from, to: input.to } };

  return {
    type: EVENT_TYPES.REQUIREMENT_STATE_CHANGED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'requirement',
      id: input.requirement.id,
      projectId: input.requirement.projectId,
    },
    snapshot: input.snapshot,
    recipients: input.recipients,
    changes,
  } as DomainEvent<RequirementSnapshot>;
}

export interface RequirementUpdatedInput extends BaseEventInput {
  /** Al menos uno de los dos tiene que venir: si los dos vienen ausentes, el comando no
   * debería haber llamado a este constructor (CA-2). */
  title?: { from: string; to: string };
  description?: { from: string; to: string };
}

/**
 * Construye `requirement.updated` (REQ-014 §5, CA-2). FUNCIÓN PURA.
 *
 * `changes` SE ARMA CONDICIONALMENTE, no con claves en `undefined`: `should.deepEqual` compara
 * claves propias, y una clave con valor `undefined` falla el test y no coincide con lo que dice
 * el contrato (solo los campos que cambiaron).
 */
export function requirementUpdated(
  input: RequirementUpdatedInput
): DomainEvent<RequirementSnapshot> {
  const changes: Record<string, unknown> = {};
  if (input.title) {
    changes.title = input.title;
  }
  if (input.description) {
    changes.description = input.description;
  }

  return {
    type: EVENT_TYPES.REQUIREMENT_UPDATED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'requirement',
      id: input.requirement.id,
      projectId: input.requirement.projectId,
    },
    snapshot: input.snapshot,
    recipients: input.recipients,
    changes,
  } as DomainEvent<RequirementSnapshot>;
}

export interface RequirementResolvedInput extends BaseEventInput {
  from: string;
  /** Los tres campos de resolución, LEÍDOS DE LA FILA YA ACTUALIZADA (no del payload): el
   * payload puede no traerlos y la fila tiene el valor efectivo. Admiten `null` y viajan
   * igual (CA-14) — nunca se omiten. */
  resolutionType: string | null;
  resolutionConclusion: string | null;
  resolutionComment: string | null;
  /** ISO 8601, ya serializado por quien llama: el hook `@BeforeUpdate` acaba de escribirlo. */
  finishedAt: string;
}

/**
 * Construye `requirement.resolved` (REQ-014 §5, CA-3, CA-14). FUNCIÓN PURA.
 *
 * `finishedAt` VIAJA EN `changes`, NO EN LA RAÍZ (D-7 de la planificación): `DomainEvent` no
 * declara esa clave, y `changes` es `additionalProperties: true`. `snapshot.finishedAt` lleva
 * el mismo valor, así que el dato no se pierde — solo viaja por el canal legal del contrato.
 */
export function requirementResolved(
  input: RequirementResolvedInput
): DomainEvent<RequirementSnapshot> {
  const changes: Record<string, unknown> = {
    state: { from: input.from, to: 'resuelto' },
    resolutionType: input.resolutionType,
    resolutionConclusion: input.resolutionConclusion,
    resolutionComment: input.resolutionComment,
    finishedAt: input.finishedAt,
  };

  return {
    type: EVENT_TYPES.REQUIREMENT_RESOLVED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'requirement',
      id: input.requirement.id,
      projectId: input.requirement.projectId,
    },
    snapshot: input.snapshot,
    recipients: input.recipients,
    changes,
  } as DomainEvent<RequirementSnapshot>;
}

export interface RequirementReopenedInput extends BaseEventInput {
  from: string;
  to: string;
}

/**
 * Construye `requirement.reopened` (REQ-014 §5, CA-4). FUNCIÓN PURA.
 *
 * Se emite ADEMÁS de `state.changed` (D-6), igual que `resolved`: el payload lleva
 * `changes.state` para que un conector pueda tratar los dos casos de "salida/entrada a
 * resuelto" de forma simétrica.
 */
export function requirementReopened(
  input: RequirementReopenedInput
): DomainEvent<RequirementSnapshot> {
  const changes: Record<string, unknown> = {
    state: { from: input.from, to: input.to },
    resolutionCleared: true,
  };

  return {
    type: EVENT_TYPES.REQUIREMENT_REOPENED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'requirement',
      id: input.requirement.id,
      projectId: input.requirement.projectId,
    },
    snapshot: input.snapshot,
    recipients: input.recipients,
    changes,
  } as DomainEvent<RequirementSnapshot>;
}

export interface RequirementCommentCreatedInput extends BaseEventInput {
  comment: {
    id: number;
    body: string;
    fileIds: number[];
  };
  /** El `visibilityLevel` DEL COMENTARIO (no el del requisito, que ya viaja en `snapshot`). */
  visibilityLevel: string;
}

/**
 * Construye `requirement.comment.created` (REQ-014 §5, CA-5). FUNCIÓN PURA.
 *
 * `comment` va FUERA de `changes` (es la entidad del evento, igual que `snapshot` lo es para el
 * requisito) y este evento NO LLEVA `changes`: en un alta todo es nuevo, mismo patrón que
 * `requirementCreated`.
 */
export function requirementCommentCreated(
  input: RequirementCommentCreatedInput
): DomainEvent<RequirementSnapshot> {
  return {
    type: EVENT_TYPES.REQUIREMENT_COMMENT_CREATED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'requirement',
      id: input.requirement.id,
      projectId: input.requirement.projectId,
    },
    snapshot: input.snapshot,
    recipients: input.recipients,
    comment: input.comment,
    visibilityLevel: input.visibilityLevel,
    // `changes` NO VA: en un alta todo es nuevo (mismo patrón que `requirementCreated`).
  } as DomainEvent<RequirementSnapshot>;
}

export interface RequirementCommentEditedInput extends BaseEventInput {
  comment: {
    id: number;
    /** El texto ACTUAL, completo. NO hay `from`: el comando no conserva el valor anterior. */
    body: string;
    fileIds: number[];
  };
  /** El `visibilityLevel` DEL COMENTARIO. Inmutable: nunca aparece en `changes` (CA-7). */
  visibilityLevel: string;
  /** ISO 8601, leído de la fila ya actualizada (`activity.editedAt`), no recalculado. */
  editedAt: string;
  editedBy: string;
}

/**
 * Construye `requirement.comment.edited` (REQ-014 §5, CA-6, CA-7). FUNCIÓN PURA.
 *
 * `changes` LLEVA EXACTAMENTE `editedAt`/`editedBy`, SIN `from`/`to` Y SIN `visibilityLevel`: es
 * el único caso del contrato donde `changes` no seguiría la forma `{ field: { from, to } }`,
 * porque el texto previo del comentario NO EXISTE en la base.
 */
export function requirementCommentEdited(
  input: RequirementCommentEditedInput
): DomainEvent<RequirementSnapshot> {
  const changes: Record<string, unknown> = {
    editedAt: input.editedAt,
    editedBy: input.editedBy,
  };

  return {
    type: EVENT_TYPES.REQUIREMENT_COMMENT_EDITED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'requirement',
      id: input.requirement.id,
      projectId: input.requirement.projectId,
    },
    snapshot: input.snapshot,
    recipients: input.recipients,
    comment: input.comment,
    visibilityLevel: input.visibilityLevel,
    changes,
  } as DomainEvent<RequirementSnapshot>;
}

/** Los dos eventos de suscriptor comparten forma: sin `actorEnvelope` (D-2) y con `userId`. */
interface SubscriptorEventInput {
  requirement: {
    id: number;
    projectId: number;
  };
  /** El actor YA RESUELTO (`resolveActor(...) ?? ctx.caller`, D-3). SIN sobre: estos dos
   * eventos NUNCA llevan `actor.name` (D-2), así que no hay fallback que resolver. */
  actorId: string;
  userId: string;
  snapshot: RequirementSnapshot;
  recipients: EventRecipients;
}

export type RequirementSubscriptorAddedInput = SubscriptorEventInput;

/**
 * Construye `requirement.subscriptor.added` (REQ-014 §5, CA-8, CA-9). FUNCIÓN PURA.
 *
 * `actor: { id }` SE ARMA INLINE, SIN `resolveEventActor` (D-2): ese resolver SIEMPRE devuelve
 * `name`, y el catálogo declara "NO" para este evento — usarlo violaría el contrato. El valor
 * puede no ser una persona (D-3: `?? ctx.caller` en el canal exento), y eso es exactamente lo
 * que la ausencia de `name` comunica.
 *
 * `recipients` YA INCLUYE al suscriptor nuevo: quien llama lo resuelve DESPUÉS del `create`,
 * dentro de la misma transacción (ADR-003) — leer antes no vería la fila recién insertada.
 */
export function requirementSubscriptorAdded(
  input: RequirementSubscriptorAddedInput
): DomainEvent<RequirementSnapshot> {
  const changes: Record<string, unknown> = { userId: input.userId };

  return {
    type: EVENT_TYPES.REQUIREMENT_SUBSCRIPTOR_ADDED,
    actor: { id: input.actorId },
    entity: {
      type: 'requirement',
      id: input.requirement.id,
      projectId: input.requirement.projectId,
    },
    snapshot: input.snapshot,
    recipients: input.recipients,
    changes,
  } as DomainEvent<RequirementSnapshot>;
}

export type RequirementSubscriptorRemovedInput = SubscriptorEventInput;

/**
 * Construye `requirement.subscriptor.removed` (REQ-014 §5, CA-8, CA-9). FUNCIÓN PURA.
 *
 * Simétrico a `requirementSubscriptorAdded`: mismo `actor` inline sin `name` (D-2), y
 * `recipients` YA SIN el suscriptor que salió — quien llama lo resuelve DESPUÉS del `destroy`.
 */
export function requirementSubscriptorRemoved(
  input: RequirementSubscriptorRemovedInput
): DomainEvent<RequirementSnapshot> {
  const changes: Record<string, unknown> = { userId: input.userId };

  return {
    type: EVENT_TYPES.REQUIREMENT_SUBSCRIPTOR_REMOVED,
    actor: { id: input.actorId },
    entity: {
      type: 'requirement',
      id: input.requirement.id,
      projectId: input.requirement.projectId,
    },
    snapshot: input.snapshot,
    recipients: input.recipients,
    changes,
  } as DomainEvent<RequirementSnapshot>;
}

export default requirementCreated;
