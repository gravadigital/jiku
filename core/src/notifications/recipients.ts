import { Op } from 'sequelize';
import { Requirement, RequirementActivity, RequirementVisibilityLevel, UserProjectPermission, VisibilityLevel } from '@jiku/models';
import { NotificationDeclaration } from '@jiku/nats-protocol';
import { resolveNotificationRecipients } from './registry';
import { NotificationCandidate, NotificationContext } from './types';

/**
 * Las cuatro reglas de filtrado que se aplican AL ENCOLAR (D-10 · CA-4 a CA-9), en este orden —
 * el más barato primero, y el que pone la barrera de seguridad (R-2) lo más temprano posible:
 *
 *   1. Visibilidad — corta ANTES de resolver ningún destinatario.
 *   2. Destinatarios del tipo — delega en `registry.ts` (Task 2), sin conocer ningún tipo.
 *   3. Excluir actor · deduplicar · saltear sin email — UN SOLO recorrido.
 *   4. Permiso de proyecto — UNA consulta en lote sobre los sobrevivientes de la 3.
 *
 * ESTE MÓDULO NO NOMBRA NINGÚN TIPO DE NOTIFICACIÓN CONCRETO (TS-33): los tipos viven solo en
 * `registry.ts`. Lo único que decide si hay que mirar la visibilidad de un COMENTARIO en vez de
 * (o además de) la del requisito es la FORMA de la declaración —¿trae `data.commentId`?—, nunca
 * una comparación contra la CLAVE del tipo. El precedente es el motor de consultas, que no nombra
 * ningún recurso concreto y tiene su propio test estructural.
 */

/**
 * Regla 1: visibilidad. `requirement.visibilityLevel === 'public'` siempre; para una declaración
 * de COMENTARIO —la que trae `data.commentId`— exige ADEMÁS que el comentario sea `public`.
 *
 * LA CONDICIÓN DEL COMENTARIO ES LA LÍNEA MÁS FÁCIL DE ESCRIBIR MAL DE TODA LA STORY (CA-5). Los
 * dos enums (`RequirementVisibilityLevel` y `VisibilityLevel`) tienen los mismos miembros pero
 * viven en archivos distintos y sus DEFAULTS VAN EN DIRECCIONES OPUESTAS: el del requisito es
 * `public`, el del comentario —el default de `RequirementActivity.visibilityLevel`— es
 * `internal`. Si esta condición leyera `requirement.visibilityLevel` para decidir sobre un
 * comentario, un comentario `internal` saldría por mail y el camino feliz de un test superficial
 * pasaría igual. Precedente EXACTO en `requirements-comment.ts:108-110`: "El de la RAÍZ es el del
 * COMENTARIO (`activity.visibilityLevel`), no `snapshot.visibilityLevel` (el del requisito)".
 *
 * CORTA ANTES DE CONSULTAR NINGÚN DESTINATARIO (CA-4): un `false` acá significa que la regla 2
 * (que sí toca `RequirementSubscriptor`/`User`) nunca se ejecuta para esta declaración.
 */
async function passesVisibility(
  declaration: NotificationDeclaration,
  ctx: NotificationContext
): Promise<boolean> {
  const requirement = await Requirement.findByPk(declaration.entity.id, { transaction: ctx.transaction });
  if (!requirement || requirement.visibilityLevel !== RequirementVisibilityLevel.Public) {
    return false;
  }

  // La forma de la declaración —no su `type`— es lo que decide si hay una visibilidad de
  // comentario que además chequear. `data?.commentId` es el único dato que un tipo "de
  // comentario" necesita declarar para activar esta mitad de la regla.
  const commentId = declaration.data?.commentId;
  if (commentId === undefined) {
    return true;
  }

  const activity = await RequirementActivity.findByPk(commentId as number, { transaction: ctx.transaction });
  // Sin fila, o `internal` (el default del comentario): no encola. El chequeo lee
  // `activity.visibilityLevel` —LA DEL COMENTARIO— y nunca la del requisito, que ya se validó
  // arriba y es una condición DISTINTA e independiente (CA-5, D-1: un comentario `internal`
  // sobre un requisito `public` es válido como dato, pero no notificable).
  return activity !== null && activity.visibilityLevel === VisibilityLevel.Public;
}

/**
 * Regla 3: excluir al actor, deduplicar por `userId`, saltear sin correo — EN UN SOLO PASO
 * (CA-7). Un `Map<userId, candidato>` deduplica por clave a medida que se recorre una vez la
 * lista; el actor y los `email === null` se saltean EN LA MISMA PASADA. Tres `filter`
 * encadenados producirían el mismo resultado en tres recorridos, y ninguno de los tres
 * deduplicaría de verdad — `requirement_subscriptors` no tiene unique compuesto (Database
 * Context), así que la deduplicación es enteramente de esta función, en memoria.
 *
 * `actorId === undefined` ES UN ESTADO VÁLIDO (canal exento, `resolveActor()` sin sobre y sin
 * publicador de confianza declarando actor): la exclusión simplemente no excluye a nadie, porque
 * no hay a quién excluir. No se inventa un actor sintético para que la regla "tenga a quién
 * excluir" — es la misma decisión que S-030/S-031 tomaron para la clase `connector`.
 */
function excludeActorDedupAndRequireEmail(
  candidates: NotificationCandidate[],
  actorId: string | undefined
): NotificationCandidate[] {
  const byUserId = new Map<string, NotificationCandidate>();

  for (const candidate of candidates) {
    if (candidate.userId === actorId) {
      continue;
    }
    if (candidate.email === null) {
      continue;
    }
    // Sobrescribe si ya estaba: mismo resultado, y evita una segunda estructura para chequear
    // presencia antes de insertar.
    byUserId.set(candidate.userId, candidate);
  }

  return [...byUserId.values()];
}

/**
 * Regla 4: permiso de proyecto, en UNA sola consulta en lote (CA-8) —
 * `WHERE project_id = :p AND user_id IN (:ids)` sobre TODOS los sobrevivientes de la regla 3—, no
 * un `findOne` por destinatario dentro de un `for` (que con diez suscriptores serían diez
 * consultas dentro de una transacción ya abierta).
 */
async function filterByProjectPermission(
  candidates: NotificationCandidate[],
  projectId: number,
  transaction: NotificationContext['transaction']
): Promise<NotificationCandidate[]> {
  if (candidates.length === 0) {
    return [];
  }

  const permissions = await UserProjectPermission.findAll({
    where: {
      projectId,
      userId: { [Op.in]: candidates.map((candidate) => candidate.userId) },
    },
    transaction,
  });
  const permitted = new Set(permissions.map((permission) => permission.userId));

  return candidates.filter((candidate) => permitted.has(candidate.userId));
}

/**
 * Aplica las cuatro reglas, en orden, a una declaración. Devuelve la lista final de candidatos a
 * escribir — puede ser vacía (CA-9), y en ese caso el escritor (Task 4) no llama a `bulkCreate`
 * para esta declaración.
 *
 * TODAS LAS LECTURAS PASAN `{ transaction: ctx.transaction }` (regla de `orm`, ADR-003): nada de
 * esta función toca la base fuera de la transacción del comando.
 */
export async function resolveFilteredRecipients(
  declaration: NotificationDeclaration,
  ctx: NotificationContext
): Promise<NotificationCandidate[]> {
  // Regla 1 — corta antes de cualquier consulta de destinatarios.
  if (!(await passesVisibility(declaration, ctx))) {
    return [];
  }

  // Regla 2 — delegada por completo en el registro del tipo (Task 2). Este módulo no sabe cómo
  // se resuelven los candidatos, solo que hay que pedírselos al tipo.
  const candidates = await resolveNotificationRecipients(declaration, ctx);
  if (candidates.length === 0) {
    return [];
  }

  // Regla 3 — un solo recorrido.
  const survivors = excludeActorDedupAndRequireEmail(candidates, ctx.actorId);
  if (survivors.length === 0) {
    return [];
  }

  // Regla 4 — una sola consulta en lote sobre los sobrevivientes de la 3.
  return filterByProjectPermission(survivors, declaration.entity.projectId, ctx.transaction);
}

export default resolveFilteredRecipients;
