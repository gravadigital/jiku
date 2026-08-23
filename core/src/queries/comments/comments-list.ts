import { Query } from '../types';
import { pendingContract } from '../pending';

/**
 * Colección paginada de comentarios.
 *
 * TRANSITORIO: sin contrato (RF-10 de REQ-004), este endpoint existe, es descubrible y contesta
 * un `failure` bien formado. El stub desaparece cuando el REQ del contrato de consultas defina
 * filtros, paginación y campos; su insumo es `bus-api-consultas.md`.
 *
 * Cuando eso pase, acá va:
 *   `comments` NO ES UNA TABLA (ADR-004: la traducción vive en core). Son las filas de
 *   `objective_activity` y `requirement_activity` con `type_of_activity = 'comment'`; el texto
 *   del comentario vive en `new_value`, y `visibility_level` (`public` / `internal`) decide qué
 *   se puede exponer.
 *   La lectura usa `ctx.db.query<CommentRow>(sql, { type: QueryTypes.SELECT, replacements })`:
 *   SQL explícito, sin ORM; nombres de tabla/columna/orden desde LISTAS BLANCAS y valores como
 *   parámetros. Las dos tablas de actividad obligan a un UNION, no a un join.
 */
export const commentsList: Query = pendingContract('comments.list');
export default commentsList;
