import {
  BaseFieldSpec,
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `project-permissions` — un DATO, no código.
 *
 * ES LA TABLA QUE SOSTIENE EL AISLAMIENTO DEL PORTAL DE CLIENTES, y hasta acá solo aparecía como
 * SUBCONSULTA del recorte de todos los demás recursos. Exponerla como recurso propio no cambia ese
 * rol ni agrega costo: el índice `(user_id)` ya existía para el recorte.
 *
 * `updatedAt` NO SE DECLARA aunque la columna existe (CA-12): un permiso se otorga y se revoca, no
 * se edita. La fecha de modificación no significa nada para ningún consumidor, y la ficha es el
 * lugar donde algo se declara o no existe.
 *
 * QUÉ VE UN EXTERNO: las filas de SUS proyectos, o sea QUIÉN MÁS accede a lo que él ve — no el mapa
 * completo de accesos del producto. Es la lectura correcta de "solo filas de proyectos permitidos"
 * (CA-12, CA-13) y conviene tenerla explícita: el instinto de "solo las mías" sería otro recurso.
 */

/** El conjunto BASE: cuatro campos. SIN `updatedAt`, y la ausencia es del contrato. */
const BASE: Record<string, BaseFieldSpec> = {
  id: { column: 'id' },
  userId: { column: 'user_id' },
  projectId: { column: 'project_id' },
  createdAt: { column: 'created_at' },
};

const INCLUDABLE: Record<string, IncludableSpec> = {
  /** `{id, name, username}` y SIN `email`: el único dato personal solo viaja desde `users.list`. */
  user: {
    kind: 'relation',
    cardinality: 'one',
    table: 'users',
    localKey: 'user_id',
    targetKey: 'id',
    // INNER JOIN: `user_id` es `NOT NULL` con FK a `users.id`.
    optional: false,
    fields: { id: 'id', name: 'name', username: 'username' },
  },
  project: {
    kind: 'relation',
    cardinality: 'one',
    table: 'projects',
    localKey: 'project_id',
    targetKey: 'id',
    // `project_id` NO declara `NOT NULL` en el esquema.
    optional: true,
    fields: { id: 'id', name: 'name', code: 'code' },
  },
};

/**
 * Los dos filtros declarados.
 *
 * `userId` ENTRA POR LA EXCEPCIÓN ANGOSTA de `IDENTITY_PAYLOAD_FIELDS` dentro de `filter`, igual
 * que `subscriptions.userId` y `people.userId`: la ficha no está diciendo QUIÉN PREGUNTA —eso sale
 * del segundo token del subject y solo de ahí (RF-19)— está diciendo POR QUIÉN SE FILTRA.
 *
 * EL RECORTE SE APLICA ANTES Y CON AND, así que pedir las de otro devuelve `items: []` y NO acceso.
 *
 * `kind: 'string'`: es el `sub` de Zitadel, `varchar(100)`.
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  projectId: { column: 'project_id', kind: 'integer' },
  userId: { column: 'user_id', kind: 'string' },
};

/**
 * Lo ordenable: `id` Y NADA MÁS (CA-12).
 *
 * `id` ES LA PK y la tabla no tiene más índices que ella y `(user_id)`: el keyset recorre por la PK
 * y no necesita un índice nuevo. Declarar `createdAt` prometería un orden sin índice que lo
 * sostenga, y sobre una tabla que además no tiene ningún caso de uso que lo pida.
 */
const SORTABLE: Record<string, SortableSpec> = {
  id: { column: 'id' },
};

/**
 * EL RECORTE DEL MODO EXTERNO: SOLO FILAS DE PROYECTOS PERMITIDOS.
 *
 * La fila LLEVA el proyecto en una columna propia, así que es un recorte de columna y no un
 * `EXISTS`.
 *
 * SIN `visibility`, y la ausencia significa "este recurso NO TIENE columna de visibilidad", nunca
 * "no recortes": un permiso no tiene `visibility_level`. Mismo precedente que `projects`.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = {
  kind: 'column',
  projectColumn: 'project_id',
};

export const projectPermissionsSpec: ResourceSpec = {
  name: 'project-permissions',
  /*
   * LA ÚNICA FICHA DE ESTA STORY CON TRADUCCIÓN DE NOMBRE DE RECURSO (ADR-004): el contrato dice
   * `project-permissions` y la tabla se llama `user_project_permissions`. Mismo caso que
   * `tasks` / `objectives`: el nombre nuevo es del contrato, no del almacenamiento, y la base no
   * se toca por vocabulario.
   */
  table: 'user_project_permissions',

  base: BASE,
  includable: INCLUDABLE,
  filterable: FILTERABLE,
  sortable: SORTABLE,

  baseNames: Object.keys(BASE),
  includableNames: Object.keys(INCLUDABLE),
  fieldNames: [...Object.keys(BASE), ...Object.keys(INCLUDABLE)],
  filterableNames: Object.keys(FILTERABLE),
  sortableNames: Object.keys(SORTABLE),

  defaults: { sort: ['id'] },
  enums: {},

  truncatable: [],

  externalScope: EXTERNAL_SCOPE,

  // SIN `notFoundCode` NI `notFoundMessage`: `project-permissions` no tiene `get`.
};

export default projectPermissionsSpec;
