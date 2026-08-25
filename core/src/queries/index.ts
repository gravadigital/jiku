import { QueryRegistry } from './registry';
import clientsList from './clients/clients-list';
import clientsGet from './clients/clients-get';
import projectsList from './projects/projects-list';
import projectsGet from './projects/projects-get';
import requirementsList from './requirements/requirements-list';
import requirementsGet from './requirements/requirements-get';
import tasksList from './tasks/tasks-list';
import tasksGet from './tasks/tasks-get';
import commentsList from './comments/comments-list';
import commentsGet from './comments/comments-get';

/**
 * Registro único de consultas, en el orden de la tabla del contrato. Agregar una es sumarla acá.
 *
 * TODAS son descubribles con `nats micro info jiku-queries`, con queue group y contadores propios:
 * `registerService` crea un endpoint por patrón desde `queryRegistry.patterns()`, así que sumar
 * una línea acá alcanza y no hay que tocar `bus/`. Lo que cambia es QUÉ contesta cada una:
 *
 *   - `tasks.list` y `tasks.get` responden el CONTRATO desde S-022, sobre el motor de consulta.
 *   - `clients`, `projects` y `requirements` lo responden desde S-024, cada uno con SU FICHA y sin
 *     una línea de SQL en el archivo del recurso.
 *   - `comments.list` y `comments.get` siguen en `pendingContract` y contestan `unknown_command`:
 *     llegan con S-025. Cuando no quede ninguna, `pending.ts` se elimina (S-028).
 */
export const queryRegistry = new QueryRegistry().registerAll([
  clientsList,
  clientsGet,
  projectsList,
  projectsGet,
  requirementsList,
  requirementsGet,
  tasksList,
  tasksGet,
  commentsList,
  commentsGet,
]);

export default queryRegistry;
