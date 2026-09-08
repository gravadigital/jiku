import { Actor, DomainEvent, EVENT_TYPES, EventComment, TaskSnapshot } from '@jiku/nats-protocol';
import { resolveEventActor } from './actor';

/**
 * `src/events/domain/task.ts` — los 6 constructores de evento de tarea (REQ-014 / S-065/S-066).
 *
 * El molde es `requirement.ts`: funciones puras, que NO completan `eventId`/`occurredAt`/
 * `version`/`correlationId` (esas cuatro claves las completa el EMISOR al publicar,
 * `emit-events.ts`), con `changes` AUSENTE (no `undefined`) cuando el evento no lo declara, y
 * con el mismo `as DomainEvent<TaskSnapshot>` comentado por la misma razón de solapamiento
 * estructural (TS2352).
 *
 * DOS DIFERENCIAS DE FONDO CON `requirement.ts`:
 *  1. NINGÚN TIPO DE INPUT DECLARA `recipients` (D-4, CA-3): ningún evento de tarea lo lleva —
 *     `objectives_subscriptors` existe pero ninguna interfaz del producto crea suscripciones a
 *     tareas hoy. Un campo que no existe en el tipo no se puede pasar por accidente el día que
 *     alguien copie un constructor de requisito — ESE DÍA LLEGÓ CON `taskAssigned` (S-066) Y EL
 *     MECANISMO FUNCIONÓ: `TaskAssignedInput` no declara `recipients`, así que el compilador
 *     rechaza cualquier intento de colarlo copiando `requirementAssigned`.
 *  2. LOS SEIS LLEVAN `actor.name` SIN EXCEPCIONES (a diferencia de los dos eventos de
 *     suscriptor de requisito, que lo prohíben): los seis resuelven su `actor` con
 *     `resolveEventActor(actorId, actorEnvelope)`, sin la rama `{ id }` inline que S-064
 *     necesitó para su D-2.
 */

/** Los campos que TODOS los constructores de esta story comparten. */
interface BaseEventInput {
  task: {
    id: number;
    projectId: number;
  };
  /** El actor YA RESUELTO por `resolveActor` (el string, no el objeto). */
  actorId: string;
  /** El sobre de identidad del comando, si vino (canal de la api). `undefined` en el canal directo. */
  actorEnvelope: Actor | undefined;
  snapshot: TaskSnapshot;
}

export type TaskCreatedInput = BaseEventInput;

/**
 * Construye el evento `task.created` (REQ-014 §5), FUNCIÓN PURA: no toca la base ni el bus.
 *
 * `changes` NO SE INCLUYE (la clave está AUSENTE, no en `undefined`): en un alta todo es nuevo.
 * SIN `recipients` (D-4): el tipo de entrada no lo declara.
 */
export function taskCreated(input: TaskCreatedInput): DomainEvent<TaskSnapshot> {
  return {
    type: EVENT_TYPES.TASK_CREATED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'task',
      id: input.task.id,
      projectId: input.task.projectId,
    },
    snapshot: input.snapshot,
    // `changes` NO VA: en un alta todo es nuevo (mismo patrón que `requirementCreated`).
  } as DomainEvent<TaskSnapshot>;
}

export interface TaskStateChangedInput extends BaseEventInput {
  from: string;
  to: string;
}

/**
 * Construye `task.state.changed` (REQ-014 §5, CA-1, CA-4). FUNCIÓN PURA.
 *
 * NO VALIDA NI ASUME PROGRESIÓN: cualquier transición es válida, incluidos retrocesos y saltos
 * — el constructor solo traduce `from`/`to` a la forma del contrato. El diff que alimenta
 * `from`/`to` lo calcula EL COMANDO (CA-4, D-2), no este constructor.
 */
export function taskStateChanged(input: TaskStateChangedInput): DomainEvent<TaskSnapshot> {
  // Tipado explícito a `Record<string, unknown>`: un objeto literal más estrecho hace fallar el
  // `as DomainEvent<...>` de abajo en compilación (TS2352) por insuficiente solapamiento
  // estructural.
  const changes: Record<string, unknown> = { state: { from: input.from, to: input.to } };

  return {
    type: EVENT_TYPES.TASK_STATE_CHANGED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'task',
      id: input.task.id,
      projectId: input.task.projectId,
    },
    snapshot: input.snapshot,
    changes,
  } as DomainEvent<TaskSnapshot>;
}

export interface TaskUpdatedInput extends BaseEventInput {
  title?: { from: string; to: string };
  /** `description` admite `null` en las dos puntas: la columna es nullable (a diferencia de
   * `title`, que es `NOT NULL`), y limpiarla (D-2) tiene que poder viajar como `to: null`. */
  description?: { from: string | null; to: string | null };
}

/**
 * Construye `task.updated` (REQ-014 §5, CA-1, CA-4). FUNCIÓN PURA.
 *
 * `changes` SE ARMA CONDICIONALMENTE, no con claves en `undefined`: `should.deepEqual` compara
 * claves propias, y una clave con valor `undefined` falla el test y no coincide con lo que dice
 * el contrato (solo los campos que cambiaron). Cubre `title` y `description` únicamente —aunque
 * el historial de tareas rastrea seis campos—, y el comando (Task 4) es quien decide, antes de
 * llamar acá, cuáles de los dos cambiaron de verdad.
 */
export function taskUpdated(input: TaskUpdatedInput): DomainEvent<TaskSnapshot> {
  const changes: Record<string, unknown> = {};
  if (input.title) {
    changes.title = input.title;
  }
  if (input.description) {
    changes.description = input.description;
  }

  return {
    type: EVENT_TYPES.TASK_UPDATED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'task',
      id: input.task.id,
      projectId: input.task.projectId,
    },
    snapshot: input.snapshot,
    changes,
  } as DomainEvent<TaskSnapshot>;
}

export interface TaskCommentCreatedInput extends BaseEventInput {
  comment: EventComment;
  /** El `visibilityLevel` DEL COMENTARIO (no el de la tarea, que ya viaja en `snapshot`). */
  visibilityLevel: string;
}

/**
 * Construye `task.comment.created` (REQ-014 §5, CA-5). FUNCIÓN PURA.
 *
 * `comment` va FUERA de `changes` (es la entidad del evento, igual que `snapshot` lo es para la
 * tarea) y este evento NO LLEVA `changes`: en un alta todo es nuevo, mismo patrón que
 * `taskCreated`.
 */
export function taskCommentCreated(
  input: TaskCommentCreatedInput
): DomainEvent<TaskSnapshot> {
  return {
    type: EVENT_TYPES.TASK_COMMENT_CREATED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'task',
      id: input.task.id,
      projectId: input.task.projectId,
    },
    snapshot: input.snapshot,
    comment: input.comment,
    visibilityLevel: input.visibilityLevel,
    // `changes` NO VA: en un alta todo es nuevo (mismo patrón que `taskCreated`).
  } as DomainEvent<TaskSnapshot>;
}

export interface TaskCommentEditedInput extends BaseEventInput {
  comment: EventComment;
  /** El `visibilityLevel` DEL COMENTARIO. Inmutable: nunca aparece en `changes`. */
  visibilityLevel: string;
  /** ISO 8601, leído de la fila ya actualizada (`activity.editedAt`), no recalculado. */
  editedAt: string;
  editedBy: string;
}

/**
 * Construye `task.comment.edited` (REQ-014 §5, CA-5). FUNCIÓN PURA.
 *
 * `changes` LLEVA EXACTAMENTE `editedAt`/`editedBy`, SIN `from`/`to` Y SIN `visibilityLevel`: el
 * texto previo del comentario NO EXISTE en la base (`objective_activity.previous_value` no es el
 * texto previo en una fila de comentario), así que no hay `from` que declarar.
 */
export function taskCommentEdited(
  input: TaskCommentEditedInput
): DomainEvent<TaskSnapshot> {
  const changes: Record<string, unknown> = {
    editedAt: input.editedAt,
    editedBy: input.editedBy,
  };

  return {
    type: EVENT_TYPES.TASK_COMMENT_EDITED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'task',
      id: input.task.id,
      projectId: input.task.projectId,
    },
    snapshot: input.snapshot,
    comment: input.comment,
    visibilityLevel: input.visibilityLevel,
    changes,
  } as DomainEvent<TaskSnapshot>;
}

export interface TaskAssignedInput extends BaseEventInput {
  /** La lista ANTERIOR (líder primero, resto por id asc — la devuelve
   * `readTaskResponsiblePersonIds`). */
  from: number[];
  /** La lista NUEVA, en el orden del payload. */
  to: number[];
  added: number[];
  removed: number[];
  /** `null` si la lista nueva quedó vacía. */
  leaderId: number | null;
}

/**
 * Construye `task.assigned` (REQ-014 §5 / S-066). FUNCIÓN PURA.
 *
 * MISMA FORMA que `requirementAssigned` (el REQ define este evento por referencia: "misma forma
 * que sus equivalentes de requisito"), con dos diferencias: `entity.type: 'task'` y la AUSENCIA
 * de `recipients` — `TaskAssignedInput` extiende el `BaseEventInput` de este archivo, que no
 * declara esa clave (D-4), así que no hay forma de pasarla por accidente.
 */
export function taskAssigned(input: TaskAssignedInput): DomainEvent<TaskSnapshot> {
  const changes: Record<string, unknown> = {
    responsiblePersonIds: { from: input.from, to: input.to },
    added: input.added,
    removed: input.removed,
    leaderId: input.leaderId,
  };

  return {
    type: EVENT_TYPES.TASK_ASSIGNED,
    actor: resolveEventActor(input.actorId, input.actorEnvelope),
    entity: {
      type: 'task',
      id: input.task.id,
      projectId: input.task.projectId,
    },
    snapshot: input.snapshot,
    changes,
  } as DomainEvent<TaskSnapshot>;
}

export default taskCreated;
