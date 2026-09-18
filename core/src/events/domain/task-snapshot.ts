import { Transaction } from 'sequelize';
import { Objective, PersonObjective } from '@jiku/models';
import { TaskSnapshot } from '@jiku/nats-protocol';
import { priorityFromNumber } from '../../commands/tasks/priority';

/**
 * Proyecta un `Objective` (ya commiteado) al `TaskSnapshot` del contrato de eventos
 * (REQ-014 / S-065, Task 1). El molde es `requirementToSnapshot`
 * (`requirement-snapshot.ts`): función pura respecto del bus, no publica, no conoce el
 * publicador.
 *
 * LOS 16 CAMPOS SON LOS DEL CONTRATO, NI UNO MÁS
 * (`docs/apis/core-events.yaml#/components/schemas/TaskSnapshot`, `additionalProperties: false`).
 * Deliberadamente afuera: `project`, `requirement` y `responsiblePersons` (objetos de relación —
 * van los ids), `comments`/`attachments` (colecciones), `subscriptors` (nunca: no hay
 * `recipients`, CA-3) y `totalMinutes` (calculado, dos subconsultas sobre `worked_times`).
 *
 * LAS DOS FORMAS DE LA PRIORIDAD SALEN DE LA MISMA COLUMNA (D-1). `objectives.priority` es un
 * INTEGER NOT NULL, y el contrato pide las dos formas a propósito: `priority` (el nombre, vía
 * `priorityFromNumber`, que YA EXISTE y ya hace exactamente esta traducción) y `priorityValue`
 * (el entero CRUDO de la columna, sin pasar por ninguna tabla). El ida y vuelta entre el nombre
 * (5 valores) y la columna (0-5) colapsaría el 5 en 4, y `priorityValue` es el escape que evita
 * perder esa distinción. NO SE USA `resolvePriority`: esa función es la traducción de ESCRITURA
 * (nombre -> entero) y lee del PAYLOAD, que en un `edit` puede no traer prioridad — el `snapshot`
 * describe LA FILA, no el payload. Este escape CONTRADICE A ADR-004 A PROPÓSITO (R-D de
 * REQ-014) y desaparece cuando la web hable en nombres de prioridad — su baja es
 * responsabilidad de `/product-change-technical-definition`, no de esta función.
 *
 * `estimatedFinishDate` ES LA TRAMPA DE FECHAS DE ESTE ARCHIVO, Y NO ES LA MISMA QUE LA DE
 * REQUISITO (D-5). La columna es `DataType.STRING` — el tipo del MODELO dice `Date`, pero eso es
 * mentira de tipo: nunca fue una fecha para Sequelize, es un `VARCHAR` que los dos comandos de
 * escritura (`tasks-new`, `tasks-edit`) ya normalizan a `'YYYY-MM-DD'` con un `.custom()` de Joi.
 * En runtime el valor YA ES un string. Un `.toISOString()` acá produciría un `date-time`, formato
 * que el contrato NO declara para este campo (`format: date`), y sobre un string reventaría. Pasa
 * tal cual, con un cast acotado que reconcilia la mentira de tipo del modelo.
 *
 * `finishedAt` ES EL CASO OPUESTO: es `DataType.DATE` de verdad, lo escribe el hook
 * `@BeforeUpdate` de `Objective` (`setFinishedAt`) — seteado al entrar a `finalizado`, `null` al
 * salir —, y SÍ se serializa con `.toISOString()`, solo cuando no es `null`. El `snapshot` se
 * arma DESPUÉS del `await task.update(...)` sobre la misma instancia: el hook ya corrió y
 * `task.finishedAt` tiene el valor nuevo. No hay que releer la fila ni derivar el valor del
 * estado.
 *
 * `state`, `area` y `visibilityLevel` SE PASAN TAL CUAL desde la fila, sin revalidar contra el
 * enum del contrato (D-7): son `ENUM` de PostgreSQL y la base ya lo garantiza. Revalidar acá es
 * un chequeo que nunca falla y un camino de error que nadie prueba.
 *
 * `responsiblePersonIds` SE RECIBE POR PARÁMETRO, igual que en requisito: para el alta, la
 * fuente más fiel al orden semántico es `payload.responsiblePersonIds`; para los eventos que no
 * traen la lista en el payload, `readTaskResponsiblePersonIds` (más abajo) resuelve la lectura
 * ordenada.
 */
export function taskToSnapshot(
  task: Objective,
  responsiblePersonIds: number[]
): TaskSnapshot {
  return {
    id: task.id,
    title: task.title,
    // COMPLETA, NUNCA TRUNCADA. Nullable a diferencia del requisito (`tasks.new` no la exige).
    description: task.description ?? null,
    state: task.state,
    area: task.area,
    priority: priorityFromNumber(task.priority),
    priorityValue: task.priority,
    // La columna es VARCHAR y el valor YA ES un string 'YYYY-MM-DD' —lo normaliza el `.custom()`
    // de Joi de `tasks-new`/`tasks-edit`—, aunque el modelo lo declare `Date`. El cast reconcilia
    // esa mentira de tipo; un `.toISOString()` acá produciría un `date-time`, formato que el
    // contrato NO declara para este campo (`format: date`), y sobre un string reventaría.
    estimatedFinishDate: (task.estimatedFinishDate as unknown as string | null) ?? null,
    finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
    responsiblePersonIds,
    visibilityLevel: task.visibilityLevel,
    projectId: task.projectId,
    requirementId: task.requirementId ?? null,
    createdBy: task.createdBy,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

/**
 * El orden de `responsiblePersonIds` para los comandos que NO traen la lista en el payload
 * (S-065, D-3/D-8): `tasks.new` la recibe tal cual del payload, pero `tasks.{id}.edit` (cuando no
 * la manda), `tasks.{id}.comment` y `tasks.{id}.comment.{cid}.edit` necesitan reconstruirla desde
 * `people_objectives`.
 *
 * NO SE PARAMETRIZA JUNTO A `readResponsiblePersonIds` (requisito): esta función lee un MODELO
 * DISTINTO (`PersonObjective` sobre `people_objectives`, no `PersonRequirement`). Parametrizar el
 * modelo Sequelize y el nombre de la FK convertiría dos funciones de seis líneas en una genérica
 * con parámetros de tipo — más difícil de leer y de tipar que las dos versiones por separado
 * (D-3).
 *
 * EL LÍDER PRIMERO (`isLeader === true`), EL RESTO POR `personId` ASCENDENTE, ORDENADO EN
 * JAVASCRIPT Y NO CON UN `ORDER BY` SQL. Acá el `false` es el habitual, al revés que en
 * requisito: los dos comandos de tarea escriben `isLeader: index === 0` (o sea `false` para los
 * no líderes), pero el `NULL` IGUAL EXISTE — las filas que escribió la api antes de que `core` se
 * hiciera cargo de la escritura lo dejaron sin valor. `isLeader === true` POR IDENTIDAD (no
 * truthy) cubre los tres estados de una sola forma: `false` y `NULL` son ambos "no es el líder".
 * NADA DE `ORDER BY is_leader DESC`: en PostgreSQL `DESC` implica `NULLS FIRST`, así que las
 * filas heredadas con `NULL` saldrían ANTES que el líder. Un `sort()` en JS sobre un puñado de
 * filas no tiene esa arista (D-8).
 *
 * NO FILTRA POR `active` (D-8): `people_objectives` tiene una columna `active BOOLEAN` que
 * ningún comando escribe — queda `NULL` en todas las filas que escribió `core`. Un
 * `where: { active: true }` "por simetría con lo que el nombre sugiere" devuelve CERO FILAS
 * SIEMPRE, y el `snapshot` saldría con `responsiblePersonIds: []` en todos los eventos de
 * tarea — un bug silencioso, porque `[]` es un valor perfectamente válido del contrato.
 *
 * LIMITACIÓN DOCUMENTADA: para una tarea cuyos responsables no vinieron en ESTE comando, el
 * orden de los NO LÍDERES es `personId` ascendente y no el orden de asignación — la tabla no
 * tiene PK ni columna de orden. Y acá hay un motivo extra respecto de requisito:
 * `tasks.{id}.edit` usa `upsert`, que PRESERVA el `created_at` de las asignaciones que se
 * mantienen, así que ni siquiera ese campo describiría el orden de la última edición.
 *
 * LEE DENTRO DE LA TRANSACCIÓN QUE RECIBE, sin abrir ninguna propia (ADR-003): no loguea y no
 * captura errores — un fallo de base es inesperado y lo maneja el despachador.
 */
export async function readTaskResponsiblePersonIds(
  taskId: number,
  transaction: Transaction
): Promise<number[]> {
  const rows = await PersonObjective.findAll({ where: { objectiveId: taskId }, transaction });

  const leaders = rows.filter((row) => row.isLeader === true).map((row) => row.personId);
  const rest = rows
    .filter((row) => row.isLeader !== true)
    .map((row) => row.personId)
    .sort((a, b) => a - b);

  return [...leaders, ...rest];
}
