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
import activityList from './activity/activity-list';
import subscriptionsList from './subscriptions/subscriptions-list';
import peopleList from './people/people-list';
import usersList from './users/users-list';
import workedTimesList from './worked-times/worked-times-list';
import unworkedTimesList from './unworked-times/unworked-times-list';
import weekAssignedTimesList from './week-assigned-times/week-assigned-times-list';
import projectPermissionsList from './project-permissions/project-permissions-list';

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
 *   - `comments`, `activity` y `subscriptions` lo responden desde S-025, con `entityType`
 *     OBLIGATORIO: son la familia de las dos tablas cuyos ids se pisan, y el discriminador es lo
 *     que hace que un id tenga significado.
 *
 *   - `people`, `users`, `worked-times`, `unworked-times`, `week-assigned-times` y
 *     `project-permissions` lo responden desde S-026: la mitad operativa del producto —el equipo,
 *     la carga de horas y la asignación semanal— resuelta por el bus.
 *
 * NINGUNO de los seis de S-026 tiene `get`, ni `activity` ni `subscriptions` tampoco, y la ausencia
 * es el contrato: `get` existe solo donde hay pantalla de detalle (RF-2). Traer varios por id es
 * `list` + `filter.id: [1,2,3]`.
 *
 * TRES DE LOS SEIS DE S-026 —los de tiempo— NO TIENEN ACCESO EXTERNO EN ABSOLUTO: un caller en modo
 * externo recibe `items: []` sin que se ejecute una sola consulta. No es un error, y la diferencia
 * es de contrato.
 *
 * NINGÚN ENDPOINT REGISTRADO USA YA `pendingContract`. El archivo `pending.ts` sobrevive igual
 * hasta S-028, que es la story que cierra el contrato y lo elimina.
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
  activityList,
  subscriptionsList,
  peopleList,
  usersList,
  workedTimesList,
  unworkedTimesList,
  weekAssignedTimesList,
  projectPermissionsList,
]);

export default queryRegistry;
