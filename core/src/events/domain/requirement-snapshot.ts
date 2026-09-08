import { Transaction } from 'sequelize';
import { Attachment, AttachmentEntityType, PersonRequirement, Requirement, RequirementSubscriptor, User } from '@jiku/models';
import { EventRecipients, RequirementSnapshot } from '@jiku/nats-protocol';

/**
 * Proyecta un `Requirement` (ya commiteado) al `RequirementSnapshot` del contrato de eventos
 * (REQ-014 / S-063, Task 3).
 *
 * FUNCIÓN PURA RESPECTO DEL BUS: no publica, no conoce el publicador. Recibe la fila y devuelve el
 * objeto — el emisor (`emit-events.ts`) es quien la usa dentro de `DomainEvent.snapshot`.
 *
 * LOS 15 CAMPOS SON LOS DEL CONTRATO, NI UNO MÁS (`docs/apis/core-events.yaml#/RequirementSnapshot`).
 * Deliberadamente afuera: `scope`, `technicalSolution`, `acceptanceCriteria` (texto largo interno,
 * sin uso para un conector), `resolutionType`/`resolutionConclusion`/`resolutionComment` (van en
 * `changes` de `requirement.resolved`, S-066), y `scheduledAt`/`inProgressAt`/`inReviewAt` (marcas
 * de transición — `finishedAt` es la única que un conector usa).
 *
 * LA DISCREPANCIA DE `tags`, RESUELTA CONTRA EL CONTRATO Y NO ADIVINADA. `RequirementSnapshot.tags`
 * está tipado `string[]` en `@jiku/nats-protocol`, y `docs/apis/core-events.yaml` (la fuente de
 * verdad) declara la propiedad como `type: array, items: { type: string }` — confirmado leyendo el
 * YAML antes de escribir esta función, como pide la Task 3. La columna del modelo, en cambio, es
 * `Array<{ key: string; value: string }> | null`. El contrato manda, así que la traducción proyecta
 * cada par a un string `"key:value"`: preserva las dos partes sin inventar una tercera forma, y es
 * reversible por un conector que necesite separar la clave del valor (`split(':')`, con el cuidado
 * de que el VALOR puede contener ':' — por eso solo se parte en el primer ':' si algún consumidor
 * lo necesitara; esta función no lo hace, solo arma el string).
 *
 * `estimatedFinishDate` ES LA TRAMPA DE FECHAS DE ESTE ARCHIVO: la columna es DATEONLY, así que
 * Sequelize la devuelve YA COMO STRING `'2026-12-31'`. Nunca se le aplica `.toISOString()` —no es
 * un `Date`, y `new Date(x).toISOString()` la convertiría en `'2026-12-31T00:00:00.000Z'`, que
 * el contrato NO declara (su formato es `date`, no `date-time`). Pasa tal cual.
 *
 * `createdAt`/`updatedAt` SÍ son `Date` y se serializan con `.toISOString()`. `finishedAt` también
 * es `Date | null`: se serializa solo si no es `null`.
 *
 * `responsiblePersonIds` SE RECIBE POR PARÁMETRO, no se lee de una relación de la fila: la fuente
 * más fiel al ORDEN SEMÁNTICO (el primero es el líder) es el payload con el que se creó el
 * requisito, no un `SELECT` sobre `person_requirements` (que no garantiza orden sin un `ORDER BY`
 * explícito, y cuyo `is_leader` marca al líder pero no ordena al resto). Para el alta, quien llama
 * a esta función pasa `payload.responsiblePersonIds` tal cual. Para los eventos de EDICIÓN
 * (S-064), la lectura ordenada de la tabla la resuelve `readResponsiblePersonIds`, más abajo en
 * este mismo archivo — el comando que no trae la lista en el payload llama a ese helper primero
 * y pasa el resultado acá.
 */
export function requirementToSnapshot(
  requirement: Requirement,
  responsiblePersonIds: number[]
): RequirementSnapshot {
  return {
    id: requirement.id,
    title: requirement.title,
    // COMPLETA, NUNCA TRUNCADA (a diferencia de `jiku-queries`, que la declara `truncatable`).
    description: requirement.description,
    type: requirement.type ?? null,
    priority: requirement.priority,
    state: requirement.state,
    // DATEONLY: ya es string 'YYYY-MM-DD'. NO tocar con .toISOString().
    estimatedFinishDate: requirement.estimatedFinishDate ?? null,
    tags: (requirement.tags ?? []).map((tag) => `${tag.key}:${tag.value}`),
    responsiblePersonIds,
    projectId: requirement.projectId,
    createdBy: requirement.createdBy,
    visibilityLevel: requirement.visibilityLevel,
    createdAt: requirement.createdAt.toISOString(),
    updatedAt: requirement.updatedAt.toISOString(),
    finishedAt: requirement.finishedAt ? requirement.finishedAt.toISOString() : null,
  };
}

/**
 * Resuelve `EventRecipients` para un requisito: los suscriptores resueltos contra `users` y los
 * ids de responsables, tal como el contrato de eventos los declara.
 *
 * LEE DENTRO DE LA TRANSACCIÓN QUE RECIBE, sin abrir ninguna propia (REQ-014 R-8, costo asumido):
 * el join `requirement_subscriptors × users` cuesta un `SELECT` extra, y es lo que evita N
 * consultas del lado del conector. No se optimiza leyendo fuera de la transacción del comando:
 * eso leería un estado distinto del que el evento declara.
 *
 * `email: null` SE CONSERVA, no se filtra la entrada ni se reemplaza por `''`: es la asimetría
 * deliberada de `EventSubscriptor.email` — un `null` significa "es una identidad de servicio", y
 * un conector tiene que poder distinguir eso de "no lo sé".
 */
export async function resolveRecipients(
  requirementId: number,
  responsiblePersonIds: number[],
  transaction: Transaction
): Promise<EventRecipients> {
  const subscriptions = await RequirementSubscriptor.findAll({
    where: { requirementId },
    transaction,
  });

  if (subscriptions.length === 0) {
    return { subscriptors: [], responsiblePersonIds };
  }

  // DOS CONSULTAS EXPLÍCITAS y no un `include`: no hay precedente de `include` sobre esta
  // relación en el resto del servicio, y un `findAll` con `where: { id: [...] }` es la misma
  // forma que el resto de `core` ya usa para resolver ids en lote (ver `requirements-new.ts`,
  // el `Person.count({ where: { id: personIds } })`).
  const userIds = subscriptions.map((subscription) => subscription.userId);
  const users = await User.findAll({ where: { id: userIds }, transaction });
  const userById = new Map(users.map((user) => [user.id, user]));

  return {
    // Si un `userId` no resuelve a una fila de `users` (no debería pasar: hay FK), se descarta en
    // vez de mandar un suscriptor a medias — un suscriptor sin `name` violaría el contrato, que
    // lo declara `NOT NULL`.
    subscriptors: subscriptions.flatMap((subscription) => {
      const user = userById.get(subscription.userId);
      return user ? [{ userId: user.id, name: user.name, email: user.email }] : [];
    }),
    responsiblePersonIds,
  };
}

/**
 * El orden de `responsiblePersonIds` para los comandos que NO traen la lista en el payload
 * (S-064, D-4): el alta la recibe tal cual del `payload.responsiblePersonIds` porque es la única
 * fuente fiel al orden semántico, pero `edit`, `resolve`, `comment`, `comment.edit` y los dos de
 * suscriptor no la tienen y necesitan reconstruirla desde `people_requirements`.
 *
 * EL LÍDER PRIMERO, EL RESTO POR `personId` ASCENDENTE, ORDENADO EN JAVASCRIPT Y NO CON UN
 * `ORDER BY` SQL: `is_leader` es `boolean | null` —el resto de las filas guarda `NULL`, nunca
 * `false`— y en PostgreSQL un `ORDER BY is_leader DESC` implica `NULLS FIRST`, así que el líder
 * saldría ÚLTIMO. Un `'DESC NULLS LAST'` lo arreglaría, pero dejaría el comportamiento correcto
 * dependiendo de un detalle del dialecto escrito en un string; un `sort()` sobre un puñado de
 * filas no tiene esa arista.
 *
 * LIMITACIÓN DOCUMENTADA: para un requisito cuyos responsables no vinieron en ESTE comando, el
 * orden de los NO LÍDERES es `personId` ascendente y no el orden con el que fueron asignados —
 * la tabla no tiene PK ni columna de orden, y `created_at` es el mismo instante para todas las
 * filas de un mismo comando (se crean en un `Promise.all`). El líder, que es la única parte del
 * orden que el contrato declara semántica ("the FIRST is the lead"), sale correcto siempre.
 *
 * LEE DENTRO DE LA TRANSACCIÓN QUE RECIBE, sin abrir ninguna propia (ADR-003): no loguea y no
 * captura errores — un fallo de base es inesperado y lo maneja el despachador.
 */
export async function readResponsiblePersonIds(
  requirementId: number,
  transaction: Transaction
): Promise<number[]> {
  const rows = await PersonRequirement.findAll({ where: { requirementId }, transaction });

  // `isLeader === true` por IDENTIDAD, no por truthy: `null` es falsy igual que `false`, pero
  // comparar así deja explícito que el tercer estado (`NULL`) existe y no es un error de datos.
  const leaders = rows.filter((row) => row.isLeader === true).map((row) => row.personId);
  const rest = rows
    .filter((row) => row.isLeader !== true)
    .map((row) => row.personId)
    .sort((a, b) => a - b);

  return [...leaders, ...rest];
}

/**
 * El conjunto VIVO de `fileId` vinculados a un comentario (S-064, D-5): `linkFiles`/
 * `syncFileLinks` no devuelven el conjunto resultante, y `payload.fileIds` no sirve como fuente
 * — en `comment.{cid}.edit` el campo AUSENTE significa "no toques nada", así que el payload no
 * dice cuáles quedaron vinculados.
 *
 * `deletedAt: null` EN EL WHERE (`IS NULL`): el vínculo es de borrado lógico (ver
 * `attachments-delete.ts`) y una fila con fecha NO CUENTA. Ordenado por `fileId` ASCENDENTE para
 * que el payload sea determinista y un `deepEqual` de test no dependa del orden que devuelva
 * Postgres.
 *
 * Se usa en LOS DOS eventos de comentario, también en `.created` (donde `payload.fileIds` daría
 * lo mismo): una sola fuente para el mismo campo del contrato evita que las dos ramas diverjan
 * cuando alguien toque una.
 *
 * LEE DENTRO DE LA TRANSACCIÓN QUE RECIBE, sin abrir ninguna propia (ADR-003): no loguea y no
 * captura errores — un fallo de base es inesperado y lo maneja el despachador.
 */
export async function readCommentFileIds(
  commentId: number,
  transaction: Transaction
): Promise<number[]> {
  const attachments = await Attachment.findAll({
    where: {
      entityType: AttachmentEntityType.RequirementComment,
      entityId: commentId,
      deletedAt: null,
    },
    transaction,
  });

  return attachments
    .map((attachment) => attachment.fileId)
    .filter((fileId): fileId is number => fileId !== null)
    .sort((a, b) => a - b);
}
