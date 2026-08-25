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
import attachmentsList from './attachments/attachments-list';
import filesGet from './files/files-get';
import peopleList from './people/people-list';
import usersList from './users/users-list';
import workedTimesList from './worked-times/worked-times-list';
import unworkedTimesList from './unworked-times/unworked-times-list';
import weekAssignedTimesList from './week-assigned-times/week-assigned-times-list';
import projectPermissionsList from './project-permissions/project-permissions-list';
import requirementsTags from './requirements/requirements-tags';
import settingsList from './settings/settings-list';
import metaDescribe from './meta/meta-describe';

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
 *   - `attachments` (`list`) y `files` (`get`) lo responden desde S-027: los archivos en lectura,
 *     con la traducción de `entityType` en LAS DOS DIRECCIONES sobre el mismo mapa que `comments`,
 *     las dos exclusiones permanentes —el vínculo borrado y el archivo no retenido—, y CERO URLS
 *     MINTEADAS: descargar sigue siendo el comando `files.{fileId}.request-download`, que es donde
 *     vive el efecto de firmar.
 *
 *   - `people`, `users`, `worked-times`, `unworked-times`, `week-assigned-times` y
 *     `project-permissions` lo responden desde S-026: la mitad operativa del producto —el equipo,
 *     la carga de horas y la asignación semanal— resuelta por el bus.
 *
 * `attachments` NO TIENE `get` y `files` NO TIENE `list`, y las dos ausencias son el contrato
 * (CA-14 de S-027): no hay pantalla de detalle de un vínculo, y los archivos se listan POR SU
 * VÍNCULO. Publicar cualquiera de los dos responde `unknown_command` SIN CÓDIGO PROPIO: el patrón
 * simplemente no está en este registro, y el despachador ya sabe qué contestar.
 *
 * NINGUNO de los seis de S-026 tiene `get`, ni `activity` ni `subscriptions` tampoco, y la ausencia
 * es el contrato: `get` existe solo donde hay pantalla de detalle (RF-2). Traer varios por id es
 * `list` + `filter.id: [1,2,3]`.
 *
 * TRES DE LOS SEIS DE S-026 —los de tiempo— NO TIENEN ACCESO EXTERNO EN ABSOLUTO: un caller en modo
 * externo recibe `items: []` sin que se ejecute una sola consulta. No es un error, y la diferencia
 * es de contrato.
 *
 *   - `requirements.tags`, `settings.list` y `meta.describe` lo responden desde S-028, y son LOS
 *     TRES CON FORMA PROPIA: ninguno encaja del todo en el molde `list`/`get` del resto. El primero
 *     es el ÚNICO AGREGADO del contrato —una excepción declarada y acotada a "las agregaciones
 *     quedan fuera de la v1"—, el segundo sirve una LISTA BLANCA CERRADA de claves y no la tabla, y
 *     el tercero devuelve EL CONTRATO EN DATOS, derivado de las mismas fichas que validan.
 *
 * EL CONTRATO ESTÁ CERRADO: los 23 patrones de este registro son los 23 endpoints del REQ-006, y
 * TODOS TIENEN FICHA. `core/src/queries/pending.ts` —el stub que respondía `unknown_command`
 * "todavía no tiene contrato definido"— ESTÁ ELIMINADO desde S-028: mientras quedara un endpoint sin
 * contrato el stub tenía que existir, y en cuanto no quedó ninguno tenía que dejar de existir.
 *
 * `docs/apis/core-queries.yaml` ES LA FUENTE DE VERDAD de este contrato, con el mismo criterio que
 * `core.yaml` para los comandos: ante discrepancia con el código, manda el documento.
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
  // LOS DOS DE S-027, donde el contrato los pone respecto de lo que ya está (11 y 12 de la tabla
  // del REQ). Los seis de S-026 NO SE REORDENAN acá: `CONTRACT_PATTERNS` sigue al código.
  attachmentsList,
  filesGet,
  peopleList,
  usersList,
  workedTimesList,
  unworkedTimesList,
  weekAssignedTimesList,
  projectPermissionsList,
  // LOS TRES DE S-028, AL FINAL Y EN EL ORDEN EN QUE EL REQ LOS ENUMERA. `requirements.tags` NO se
  // intercala junto a `requirements.get` aunque parezca más prolijo: el criterio ya establecido es
  // que `CONTRACT_PATTERNS` sigue al código, y reordenar rompería el listado congelado sin ganancia.
  requirementsTags,
  settingsList,
  metaDescribe,
]);

export default queryRegistry;
