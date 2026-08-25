import { Query } from '../types';
import { runList } from '../engine/run';
import { ValidatedListQuery } from '../engine/types';
import { validateList } from '../engine/validate-query';
import { tasksSpec } from './tasks-spec';

/**
 * Colección paginada de tareas.
 *
 * El recurso se llama `tasks` en el subject, en el payload y en la respuesta; la tabla es
 * `objectives` y la traducción vive en la ficha (ADR-004), no acá y no en `@jiku/models`.
 *
 * ESTE ARCHIVO ES DELIBERADAMENTE DECLARATIVO, y su longitud es la medida de si el motor quedó
 * bien factorizado: la ficha dice QUÉ se puede pedir, el motor sabe CÓMO servirlo, y las 17
 * fichas que vienen después no vuelven a escribir ninguna de las dos cosas. Si alguna vez hace
 * falta armar SQL acá, el arreglo va en el motor o en la ficha.
 *
 * Toda la gramática —los seis operadores del filtro, el `or` de un nivel, `sort` con desempate
 * por `id`, `fields`/`include`, `page` con cursor keyset y presupuesto de bytes, y los tres
 * valores de `count`— la valida `validateList` contra la ficha y la sirve `runList`.
 */
/**
 * El payload de `tasks.list` DESPUÉS de validar, que es lo que recibe `execute`.
 *
 * Es un ALIAS del tipo genérico del motor, no una interfaz escrita a mano, y la desviación
 * respecto de la convención `_base` es deliberada: la gramática de `list` es LA MISMA para los 18
 * recursos —lo que cambia entre ellos es la ficha, no la forma del payload—, así que una copia por
 * recurso sería exactamente la divergencia que la ficha-como-dato existe para evitar. El alias
 * conserva el nombre que la convención pide y no duplica nada.
 */
export type TasksListPayload = ValidatedListQuery;

export const tasksList: Query<TasksListPayload> = {
  pattern: 'tasks.list',

  validate: (payload: unknown) => validateList(tasksSpec, payload),

  execute: (payload, ctx) => runList(tasksSpec, payload, ctx),
};

export default tasksList;
