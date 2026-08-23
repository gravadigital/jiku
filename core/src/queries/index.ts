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
 * Las seis están registradas y SIN CONTRATO (RF-10 de REQ-004): existen, aparecen en
 * `nats micro info jiku-queries` con queue group y contadores propios, y contestan un `failure`
 * bien formado. Qué contesta cada una lo define el REQ del contrato de consultas.
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
