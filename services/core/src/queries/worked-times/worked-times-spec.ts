import {
  BaseFieldSpec,
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `worked-times` — un DATO, no código.
 *
 * EL RECURSO DE MAYOR VOLUMEN DEL CONTRATO —una fila por persona, por día, por proyecto— y el que
 * concentra las dos decisiones más finas de la story:
 *
 *   CA-10 · la traducción `taskId` <- `objective_id`, en las DOS direcciones.
 *   CA-11 · `taskId` + `requirementId` juntos devuelven `items: []`, NO un error: el contrato no
 *           reimplementa la regla de dominio, LA REFLEJA.
 *
 * Y es el primero de los tres que declaran SIN ACCESO EXTERNO (CA-9): un caller en modo externo
 * recibe `items: []` sin que se ejecute una sola consulta.
 */

/** El conjunto BASE: nueve campos. El orden es el de la respuesta y el de `errorDetails.allowed`. */
const BASE: Record<string, BaseFieldSpec> = {
  id: { column: 'id' },
  /**
   * `worked_times.date` ES `TIMESTAMP` Y `unworked_times.date` ES `DATE` (inconsistencia 4 del
   * esquema). Dos recursos hermanos, el mismo nombre de campo, DOS TIPOS DISTINTOS.
   *
   * QUÉ SIGNIFICA EN LA PRÁCTICA: el comando de escritura valida `date` con /^\d{4}-\d{2}-\d{2}$/
   * (`commands/times/worked-times.ts`), así que TODO lo que escribe el producto queda a medianoche
   * y un `{"lte": "2026-08-31"}` incluye el día 31. Una fila con hora —dato histórico o carga
   * manual— QUEDA AFUERA de ese mismo rango.
   *
   * EL CONTRATO NO LO PUEDE OCULTAR y no lo intenta con un `transform` inventado: la diferencia es
   * real y `meta.describe` (S-028) tiene que exponer el tipo de cada campo. Acá se declara
   * `kind: 'date'` en el filtro —igual que `projects` y `requirements`— y el comportamiento queda
   * FIJADO por un test que compara las dos tablas lado a lado.
   */
  date: { column: 'date' },
  minutes: { column: 'minutes' },
  projectId: { column: 'project_id' },
  personId: { column: 'person_id' },
  /**
   * LA TRADUCCIÓN QUE CONCENTRA ESTA STORY (CA-10, ADR-004): la columna es `objective_id` y el
   * contrato dice `taskId`.
   *
   * VIVE ACÁ Y EN `FILTERABLE`, y en ningún otro lado: en el plano de consultas la traducción ES LA
   * FICHA. No hay `switch`, no hay helper y no hay `transform` — el mapa nombre -> columna ya está
   * en un solo lugar, que es exactamente lo que la convención `contract-translation` pide.
   *
   * `objectiveId` NO EXISTE en el contrato, en ninguna de las cuatro palancas.
   */
  taskId: { column: 'objective_id' },
  requirementId: { column: 'requirement_id' },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

/**
 * Las CUATRO relaciones 1:1, TODAS `optional: true`.
 *
 * Las cuatro FK son NULL-ables en el esquema, y `objective_id` / `requirement_id` lo son POR DISEÑO
 * —son mutuamente excluyentes—. Con `INNER JOIN`, LA MITAD DE LAS HORAS DESAPARECERÍA de la
 * colección: datos de menos, en silencio.
 *
 * SON UNA SOLA CONSULTA, no cinco: el motor resuelve las relaciones 1:1 con JOIN en la consulta
 * principal. Si apareciera un `for` sobre los items haciendo consultas, la relación se declaró mal.
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
  /** La OTRA cara de la traducción: el campo se llama `task` y la tabla es `objectives`. */
  task: {
    kind: 'relation',
    cardinality: 'one',
    table: 'objectives',
    localKey: 'objective_id',
    targetKey: 'id',
    optional: true,
    fields: { id: 'id', title: 'title', state: 'state' },
  },
  requirement: {
    kind: 'relation',
    cardinality: 'one',
    table: 'requirements',
    localKey: 'requirement_id',
    targetKey: 'id',
    optional: true,
    fields: { id: 'id', title: 'title', state: 'state' },
  },
};

/**
 * Los seis filtros declarados.
 *
 * `taskId` Y `requirementId` ESTÁN LOS DOS, y pedirlos juntos NO ES UN ERROR (CA-11): las claves de
 * primer nivel de `filter` se combinan con AND, ninguna fila cumple las dos, y la respuesta es
 * `items: []`. La exclusión es una regla DE ESCRITURA sin constraint en la base; validarla acá
 * sería duplicarla en un tercer lugar.
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  id: { column: 'id', kind: 'integer' },
  personId: { column: 'person_id', kind: 'integer' },
  projectId: { column: 'project_id', kind: 'integer' },
  // La traducción, en su segunda cara: el nombre del contrato, la columna de la base.
  taskId: { column: 'objective_id', kind: 'integer' },
  requirementId: { column: 'requirement_id', kind: 'integer' },
  date: { column: 'date', kind: 'date' },
};

/**
 * Lo ordenable, y DOS DE LAS TRES COLUMNAS SON NULL-ABLES Y LO DECLARAN.
 *
 * `nullable: true` NO ES DECORATIVO: el predicado keyset de la página siguiente compara contra la
 * última clave devuelta, y una comparación con NULL da NULL —o sea, NINGUNA FILA—. Ordenar por una
 * columna NULL-able con el predicado ingenuo CORTA EL RECORRIDO en la primera fila sin valor, EN
 * SILENCIO: no hay error ni log, la página siguiente viene vacía.
 *
 * EL DBML NO DECLARA `NOT NULL` NI EN `date` NI EN `minutes`. Que en la práctica el comando siempre
 * las escriba no las hace `NOT NULL`: mismo criterio que `projects.priority`, cuyo `default: 0`
 * tampoco lo es.
 *
 * CONSECUENCIA ACEPTADA: con `nullable: true` el motor usa la rama disyuntiva y no la comparación
 * de tuplas, que es la que usa `idx_worked_times_person_date_id` de forma óptima. Se elige igual:
 * una paginación que se corta sola es peor que una que usa el índice a medias.
 *
 * `minutes` NO TIENE ÍNDICE. Es un orden de reporte y el caso real siempre viene con
 * `filter.personId` o `filter.projectId`, que sí lo usa.
 */
const SORTABLE: Record<string, SortableSpec> = {
  date: { column: 'date', nullable: true },
  minutes: { column: 'minutes', nullable: true },
  id: { column: 'id' },
};

/**
 * SIN ACCESO EXTERNO (CA-9): el portal de clientes NO TIENE POR QUÉ SABER cuánto trabajó el equipo.
 *
 * NO ES UN ERROR, y la diferencia es de contrato: un `caller_not_authorized` diría "el recurso
 * existe y te está vedado"; `items: []` dice "no hay nada para vos", que es lo que el contrato
 * quiere decir y lo único que no filtra la existencia del recurso.
 *
 * El motor CORTA ANTES DE CONSULTAR (`deniesAllRows`): cero SQL, cero filas, cero error.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = { kind: 'none' };

export const workedTimesSpec: ResourceSpec = {
  name: 'worked-times',
  table: 'worked_times',

  base: BASE,
  includable: INCLUDABLE,
  filterable: FILTERABLE,
  sortable: SORTABLE,

  baseNames: Object.keys(BASE),
  includableNames: Object.keys(INCLUDABLE),
  fieldNames: [...Object.keys(BASE), ...Object.keys(INCLUDABLE)],
  filterableNames: Object.keys(FILTERABLE),
  sortableNames: Object.keys(SORTABLE),

  defaults: { sort: ['-date'] },
  // Ningún enum: los `state` de `task` y `requirement` viajan como valores de una relación, no
  // como filtros.
  enums: {},

  // Ningún texto sin cota que truncar: la fila son ids, minutos y una fecha.
  truncatable: [],

  externalScope: EXTERNAL_SCOPE,

  // SIN `notFoundCode` NI `notFoundMessage`: `worked-times` no tiene `get`.
};

export default workedTimesSpec;
