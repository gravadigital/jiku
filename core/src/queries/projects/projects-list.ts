import { Query } from '../types';
import { pendingContract } from '../pending';

/**
 * Colección paginada de proyectos.
 *
 * TRANSITORIO: sin contrato (RF-10 de REQ-004), este endpoint existe, es descubrible y contesta
 * un `failure` bien formado. El stub desaparece cuando el REQ del contrato de consultas defina
 * filtros, paginación y campos; su insumo es `bus-api-consultas.md`.
 *
 * Cuando eso pase, acá va:
 *   `projects` es la tabla `projects` —sin traducción de nombre—, pero `properties` del contrato
 *   es `key_value_pairs` en la base (ADR-004: la traducción vive en core, no en el contrato).
 *   La lectura usa `ctx.db.query<ProjectRow>(sql, { type: QueryTypes.SELECT, replacements })`:
 *   SQL explícito, sin ORM; nombres de tabla/columna/orden desde LISTAS BLANCAS y valores como
 *   parámetros.
 */
export const projectsList: Query = pendingContract('projects.list');
export default projectsList;
