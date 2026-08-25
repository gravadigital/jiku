import { Query } from '../types';
import { runGet } from '../engine/run';
import { ValidatedGetQuery } from '../engine/types';
import { validateGet } from '../engine/validate-query';
import { tasksSpec } from './tasks-spec';

/**
 * Una tarea.
 *
 * El id viaja EN EL PAYLOAD y no en el subject: el patrón no lleva `{id}` y no puede llevarlo
 * —el cache de subjects de 1024 entradas del server es la razón—.
 *
 * `data` ES EL RECURSO, sin envoltorio de colección: un `get` no tiene `items` ni `page`. Y las
 * cuatro palancas de `list` (`filter`, `sort`, `page`, `count`) son un ERROR acá, no un extra que
 * se ignora: aceptarlas en silencio dejaría creer que recortaron algo.
 *
 * Un id inexistente responde `task_not_found`, mientras que el mismo filtro por `tasks.list`
 * respondería `items: []`. La asimetría es intencional y está explicada en `engine/run.ts`.
 */
/**
 * El payload de `tasks.get` DESPUÉS de validar. Alias del tipo del motor por la misma razón que
 * `TasksListPayload`: la forma de un `get` es idéntica para los 18 recursos.
 */
export type TasksGetPayload = ValidatedGetQuery;

export const tasksGet: Query<TasksGetPayload> = {
  pattern: 'tasks.get',

  validate: (payload: unknown) => validateGet(tasksSpec, payload),

  execute: (payload, ctx) => runGet(tasksSpec, payload, ctx),
};

export default tasksGet;
