import { Query } from '../types';
import { pendingContract } from '../pending';

/**
 * Un comentario.
 *
 * TRANSITORIO: sin contrato (RF-10 de REQ-004), este endpoint existe, es descubrible y contesta
 * un `failure` bien formado. El stub desaparece cuando el REQ del contrato de consultas defina
 * el payload y los campos del recurso; su insumo es `bus-api-consultas.md`.
 *
 * Cuando eso pase, acá va:
 *   `comments` NO ES UNA TABLA (ADR-004). Son las filas de `objective_activity` y
 *   `requirement_activity` con `type_of_activity = 'comment'`; el texto vive en `new_value` y
 *   `visibility_level` (`public` / `internal`) decide qué se puede exponer.
 *
 *   Y un detalle que el REQ del contrato tiene que decidir PRIMERO: un comentario NO TIENE PK
 *   PROPIA. Se identifica por la tabla de actividad MÁS su `id`, así que el payload necesita las
 *   dos cosas. Descubrirlo entonces cuesta más que leerlo ahora.
 *
 *   La lectura usa `ctx.db.query<CommentRow>(sql, { type: QueryTypes.SELECT, replacements })`:
 *   SQL explícito, sin ORM; nombres desde LISTAS BLANCAS y valores como parámetros.
 */
export const commentsGet: Query = pendingContract('comments.get');
export default commentsGet;
