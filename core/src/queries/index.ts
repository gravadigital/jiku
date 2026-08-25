import { QueryRegistry } from './registry';
import projectsList from './projects/projects-list';
import projectsGet from './projects/projects-get';
import tasksList from './tasks/tasks-list';
import tasksGet from './tasks/tasks-get';
import commentsList from './comments/comments-list';
import commentsGet from './comments/comments-get';

/**
 * Registro único de consultas, en el orden de la tabla del contrato. Agregar una es sumarla acá.
 *
 * LAS SEIS ESTÁN REGISTRADAS DESDE S-013 y son descubribles con `nats micro info jiku-queries`,
 * con queue group y contadores propios. Lo que cambia es QUÉ contesta cada una:
 *
 *   - `tasks.list` y `tasks.get` responden el CONTRATO desde S-022, sobre el motor de consulta.
 *   - Las otras cuatro siguen en `pendingContract` y contestan `unknown_command`: `projects` llega
 *     con S-024 y `comments` con S-025. Cuando no quede ninguna, `pending.ts` se elimina (S-028).
 */
export const queryRegistry = new QueryRegistry().registerAll([
  projectsList,
  projectsGet,
  tasksList,
  tasksGet,
  commentsList,
  commentsGet,
]);

export default queryRegistry;
