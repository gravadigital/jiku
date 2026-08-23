import { Query } from '../types';
import { pendingContract } from '../pending';

/**
 * Un proyecto.
 *
 * TRANSITORIO: sin contrato (RF-10 de REQ-004), este endpoint existe, es descubrible y contesta
 * un `failure` bien formado. El stub desaparece cuando el REQ del contrato de consultas defina
 * el payload y los campos del recurso; su insumo es `bus-api-consultas.md`.
 *
 * Cuando eso pase, acá va:
 *   el id del proyecto viaja EN EL PAYLOAD, no en el subject: el patrón no lleva `{id}` y no
 *   puede llevarlo (el cache de subjects de 1024 entradas del server es la razón).
 *   `properties` del contrato es `key_value_pairs` en la base (ADR-004).
 *   La lectura usa `ctx.db.query<ProjectRow>(sql, { type: QueryTypes.SELECT, replacements })`:
 *   SQL explícito, sin ORM; nombres desde LISTAS BLANCAS y valores como parámetros.
 */
export const projectsGet: Query = pendingContract('projects.get');
export default projectsGet;
