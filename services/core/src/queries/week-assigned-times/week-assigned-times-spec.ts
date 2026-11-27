import {
  BaseFieldSpec,
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `week-assigned-times` — un DATO, no código.
 *
 * La asignación semanal: cuántos minutos de qué semana se le asignaron a una persona en un
 * proyecto. `dateFrom` es el LUNES y `dateTo` el VIERNES.
 *
 * `internal` es un DERIVADO de `projects.type === 'interno'` que la escritura congela en la fila.
 * El contrato lo expone como columna porque eso es lo que es: un dato de la fila, no un join.
 */

/** El conjunto BASE: nueve campos. */
const BASE: Record<string, BaseFieldSpec> = {
  id: { column: 'id' },
  dateFrom: { column: 'date_from' },
  dateTo: { column: 'date_to' },
  internal: { column: 'internal' },
  minutes: { column: 'minutes' },
  projectId: { column: 'project_id' },
  personId: { column: 'person_id' },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

/**
 * Los dos incluibles, LOS DOS `optional: true`: ni `person_id` ni `project_id` declaran `NOT NULL`
 * en el esquema. Con `INNER JOIN`, una fila con la FK en NULL desaparecería de la colección.
 */
const INCLUDABLE: Record<string, IncludableSpec> = {
  person: {
    kind: 'relation',
    cardinality: 'one',
    table: 'people',
    localKey: 'person_id',
    targetKey: 'id',
    optional: true,
    fields: { id: 'id', firstName: 'first_name', lastName: 'last_name' },
  },
  project: {
    kind: 'relation',
    cardinality: 'one',
    table: 'projects',
    localKey: 'project_id',
    targetKey: 'id',
    optional: true,
    fields: { id: 'id', name: 'name', code: 'code' },
  },
};

/**
 * Los cuatro filtros declarados.
 *
 * `filter.id` NO ESTÁ, y es la única de las seis fichas de esta story sin él (CA-8).
 *
 * NO ES UN OLVIDO: una asignación semanal no se busca por id. Se la busca por PERSONA y por SEMANA,
 * que es lo que la pantalla hace, y traer varias por id no tiene caso de uso — la fila no significa
 * nada fuera de su (persona, semana).
 *
 * La ficha es el lugar donde algo se declara o no existe: agregarlo "por simetría" con los otros
 * cinco recursos publicaría una palanca que nadie pidió.
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  personId: { column: 'person_id', kind: 'integer' },
  projectId: { column: 'project_id', kind: 'integer' },
  internal: { column: 'internal', kind: 'boolean' },
  dateFrom: { column: 'date_from', kind: 'date' },
};

/**
 * Lo ordenable: dos nombres, LOS DOS `nullable`.
 *
 * `nullable: true` NO ES DECORATIVO: el DBML no declara `NOT NULL` ni en `date_from` ni en
 * `person_id`, y el predicado keyset ingenuo CORTA EL RECORRIDO en la primera fila con NULL, EN
 * SILENCIO —la página siguiente viene vacía y la colección parece haber terminado—.
 *
 * `id` NO SE DECLARA ordenable: el motor lo agrega como desempate igual, y
 * `idx_week_assigned_times_person_datefrom_id` termina en `id` justamente por eso.
 *
 * `minutes` no se declara: no hay caso de uso ni índice.
 */
const SORTABLE: Record<string, SortableSpec> = {
  dateFrom: { column: 'date_from', nullable: true },
  personId: { column: 'person_id', nullable: true },
};

/**
 * SIN ACCESO EXTERNO (CA-9): la asignación semanal del equipo no es información del portal de
 * clientes. El motor CORTA ANTES DE CONSULTAR: cero SQL, cero filas, cero error.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = { kind: 'none' };

export const weekAssignedTimesSpec: ResourceSpec = {
  name: 'week-assigned-times',
  table: 'week_assigned_times',

  base: BASE,
  includable: INCLUDABLE,
  filterable: FILTERABLE,
  sortable: SORTABLE,

  baseNames: Object.keys(BASE),
  includableNames: Object.keys(INCLUDABLE),
  fieldNames: [...Object.keys(BASE), ...Object.keys(INCLUDABLE)],
  filterableNames: Object.keys(FILTERABLE),
  sortableNames: Object.keys(SORTABLE),

  defaults: { sort: ['dateFrom'] },
  // Ningún enum: `internal` es booleano.
  enums: {},

  truncatable: [],

  externalScope: EXTERNAL_SCOPE,

  // SIN `notFoundCode` NI `notFoundMessage`: `week-assigned-times` no tiene `get`.
};

export default weekAssignedTimesSpec;
