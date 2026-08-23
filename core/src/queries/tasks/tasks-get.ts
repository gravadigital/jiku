import { Query } from '../types';
import { pendingContract } from '../pending';

/**
 * Una tarea.
 *
 * TRANSITORIO: sin contrato (RF-10 de REQ-004), este endpoint existe, es descubrible y contesta
 * un `failure` bien formado. El stub desaparece cuando el REQ del contrato de consultas defina
 * el payload y los campos del recurso; su insumo es `bus-api-consultas.md`.
 *
 * Cuando eso pase, acá va:
 *   `tasks` es la tabla `objectives` (ADR-004), y `priority` es un ENTERO en tareas (enum en
 *   requisitos). El id de la tarea viaja EN EL PAYLOAD, no en el subject: el patrón no lleva
 *   `{id}` y no puede llevarlo (el cache de subjects del server es la razón).
 *   La lectura usa `ctx.db.query<TaskRow>(sql, { type: QueryTypes.SELECT, replacements })`:
 *   SQL explícito, sin ORM; nombres desde LISTAS BLANCAS y valores como parámetros.
 */
export const tasksGet: Query = pendingContract('tasks.get');
export default tasksGet;
