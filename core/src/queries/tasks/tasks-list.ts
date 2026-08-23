import { Query } from '../types';
import { pendingContract } from '../pending';

/**
 * Colección paginada de tareas.
 *
 * TRANSITORIO: sin contrato (RF-10 de REQ-004), este endpoint existe, es descubrible y contesta
 * un `failure` bien formado. El stub desaparece cuando el REQ del contrato de consultas defina
 * filtros, paginación y campos; su insumo es `bus-api-consultas.md`.
 *
 * Cuando eso pase, acá va:
 *   `tasks` es la tabla `objectives` (ADR-004: la traducción vive en core, no en el contrato),
 *   y `priority` es un ENTERO en tareas (enum en requisitos).
 *   La lectura usa `ctx.db.query<TaskRow>(sql, { type: QueryTypes.SELECT, replacements })`:
 *   SQL explícito, sin ORM; nombres de tabla/columna/orden desde LISTAS BLANCAS y valores como
 *   parámetros.
 */
export const tasksList: Query = pendingContract('tasks.list');
export default tasksList;
