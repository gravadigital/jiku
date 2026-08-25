import { ResourceSpec } from './types';
import { activitySpec } from './activity/activity-spec';
import { attachmentsSpec } from './attachments/attachments-spec';
import { clientsSpec } from './clients/clients-spec';
import { commentsSpec } from './comments/comments-spec';
import { filesSpec } from './files/files-spec';
import { peopleSpec } from './people/people-spec';
import { projectPermissionsSpec } from './project-permissions/project-permissions-spec';
import { projectsSpec } from './projects/projects-spec';
import { requirementsSpec } from './requirements/requirements-spec';
import { settingsSpec } from './settings/settings-spec';
import { subscriptionsSpec } from './subscriptions/subscriptions-spec';
import { tasksSpec } from './tasks/tasks-spec';
import { unworkedTimesSpec } from './unworked-times/unworked-times-spec';
import { usersSpec } from './users/users-spec';
import { weekAssignedTimesSpec } from './week-assigned-times/week-assigned-times-spec';
import { workedTimesSpec } from './worked-times/worked-times-spec';

/**
 * EL REGISTRO DE FICHAS: los DIECISÉIS recursos del contrato, en el orden de la tabla del REQ.
 *
 * ES LA PIEZA QUE FALTABA PARA QUE `meta.describe` SEA DERIVADO. Hasta S-028 no había ningún lugar
 * que listara las fichas: `index.ts` lista las CONSULTAS, y una consulta no expone su ficha —el
 * motor la recibe por parámetro y nadie la publica—. Sin este archivo, `meta.describe` habría tenido
 * que escribir su propia lista de recursos, que es EXACTAMENTE la estructura paralela que la story
 * existe para evitar: se desincroniza en el primer recurso nuevo y la descripción pasa a mentir.
 *
 * SON DIECISÉIS Y NO DIECIOCHO. El "18 recursos" que arrastra la documentación viene de contar las
 * secciones del capítulo "Recursos" de `bus-api-consultas-ref.md`, que incluyen `requirements.tags`
 * y `meta.describe` COMO SI FUERAN RECURSOS. No lo son: `requirements.tags` es una OPERACIÓN del
 * recurso `requirements` —no tiene conjunto base, ni incluibles, ni ordenables propios— y
 * `meta.describe` es el describidor. El conteo de ENDPOINTS sí cierra exacto en 23; el de recursos
 * es 16, y `docs/apis/core-queries.yaml` lo corrige.
 *
 * NO SE INVENTAN ENTRADAS PARA LLEGAR A 18. Una entrada de `requirements.tags` en la descripción
 * quedaría con `base`, `filterable` y `sortable` vacíos, y CA-12 —"cada nombre declarado en
 * `sortable` funciona"— no tendría nada que recorrer: sería una fila de relleno en la única
 * respuesta del contrato que existe para que no haga falta creerle a nadie.
 *
 * ESTE ARCHIVO VIVE EN `src/queries/`, NO EN `src/queries/engine/`. El gate de genericidad prohíbe
 * que EL MOTOR nombre recursos; el registro de recursos es exactamente el archivo cuyo trabajo es
 * nombrarlos, igual que `index.ts`.
 */
export const RESOURCE_SPECS: readonly ResourceSpec[] = [
  clientsSpec,
  projectsSpec,
  requirementsSpec,
  tasksSpec,
  commentsSpec,
  activitySpec,
  subscriptionsSpec,
  attachmentsSpec,
  filesSpec,
  peopleSpec,
  usersSpec,
  workedTimesSpec,
  unworkedTimesSpec,
  weekAssignedTimesSpec,
  projectPermissionsSpec,
  // El recurso 16, y el único que S-028 agrega.
  settingsSpec,
];

/**
 * `nombre del contrato -> ficha`, derivado de la lista y no escrito a mano.
 *
 * `Map` y no un objeto literal: las claves llevan guiones (`worked-times`) y un objeto literal
 * invitaría a escribirlas dos veces —la clave y el `name` de la ficha— con la posibilidad de que
 * difieran. Acá la clave SALE del `name`, así que no pueden.
 */
export const RESOURCES_BY_NAME: ReadonlyMap<string, ResourceSpec> = new Map(
  RESOURCE_SPECS.map((spec) => [spec.name, spec])
);

/** Los nombres de los 16, EN EL ORDEN del contrato. Es lo que viaja en `errorDetails.allowed`. */
export const RESOURCE_NAMES: readonly string[] = RESOURCE_SPECS.map((spec) => spec.name);

export default RESOURCE_SPECS;
