import {
  BaseFieldSpec,
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `people` — un DATO, no código.
 *
 * Trae las dos propiedades que el motor YA SOPORTA y que esta story hace observables:
 *
 *   CA-4 · `user: null` es un ESTADO VÁLIDO, no un error. Lo resuelve `optional: true` en la
 *          relación 1:1, sin una línea de código nueva.
 *   CA-3 · `mustChargeWorkedTime` se FILTRA SIN INCLUIRLO. `filterable` y `fieldNames` son listas
 *          INDEPENDIENTES desde S-022, y este es el caso canónico de RF-8.
 *
 * SIN `email`: es EL ÚNICO DATO PERSONAL DEL CONTRATO y solo viaja desde `users.list`, bajo pedido
 * explícito (RF-17, CA-6).
 *
 * `people` NO TIENE `get`: no hay pantalla de detalle de una persona, y traer varias por id es
 * `list` + `filter.id: [1,2,3]` (RF-2, CA-15).
 */

/** El conjunto BASE: siete campos. El orden es el de la respuesta y el de `errorDetails.allowed`. */
const BASE: Record<string, BaseFieldSpec> = {
  id: { column: 'id' },
  firstName: { column: 'first_name' },
  lastName: { column: 'last_name' },
  enabled: { column: 'enabled' },
  userId: { column: 'user_id' },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

const INCLUDABLE: Record<string, IncludableSpec> = {
  /*
   * LOS TRES CAMPOS QUE LA MAYORÍA DE LAS PANTALLAS NO MIRA (RF-17): el de la carga de horas y los
   * dos de vigencia. Son incluibles y NO base a propósito — `mustChargeWorkedTime` porque su caso
   * de uso real es FILTRAR (CA-3), y las dos fechas porque solo las mira la ficha de la persona.
   */
  mustChargeWorkedTime: { kind: 'field', column: 'must_charge_worked_time' },
  initDate: { kind: 'field', column: 'init_date' },
  endDate: { kind: 'field', column: 'end_date' },

  /**
   * `user: null` ES UN ESTADO VÁLIDO, NO UN ERROR (CA-4).
   *
   * `optional: true` -> LEFT JOIN, y la proyección devuelve `null` cuando todas las columnas de la
   * relación vinieron NULL. Con INNER JOIN, una persona sin usuario —alguien del equipo que nunca
   * se logueó, que es frecuente— DESAPARECERÍA de la colección: datos de menos, en silencio.
   *
   * Y EN EL SENTIDO INVERSO: un `Usuario` con `identityType: "service"` no aparece en `people.list`
   * porque NO TIENE FILA EN `people`. La regla de dominio se cumple por el MODELO, no por un filtro
   * que alguien pueda olvidar — y por eso no hay ningún `where` acá.
   *
   * SIN `email`: es el único dato personal del contrato y solo viaja desde `users.list`, bajo
   * pedido explícito (RF-17, CA-6).
   */
  user: {
    kind: 'relation',
    cardinality: 'one',
    table: 'users',
    localKey: 'user_id',
    targetKey: 'id',
    optional: true,
    fields: { id: 'id', name: 'name', username: 'username' },
  },
};

/**
 * Los seis filtros declarados.
 *
 * `userId` ES UN FILTRO DEL DOMINIO Y NO IDENTIDAD: que esté acá es lo que levanta la prohibición
 * de `IDENTITY_PAYLOAD_FIELDS` DENTRO de `filter`, y solo ahí. En las claves de primer nivel del
 * payload la prohibición no se levanta nunca — QUIÉN PREGUNTA sale del segundo token del subject y
 * solo de ahí (RF-19). Mismo precedente que `subscriptions.userId`.
 *
 * `mustChargeWorkedTime` es filtrable Y NO ES BASE: son dos listas independientes, y así lo usan
 * las pantallas de tiempo (CA-3).
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  id: { column: 'id', kind: 'integer' },
  enabled: { column: 'enabled', kind: 'boolean' },
  mustChargeWorkedTime: { column: 'must_charge_worked_time', kind: 'boolean' },
  userId: { column: 'user_id', kind: 'string' },
  /**
   * EL FILTRO QUE NO VIVE EN LA TABLA DEL RECURSO: una persona no tiene `project_id`, su relación
   * con los proyectos es `projects_persons` (CA-2). `via` lo resuelve con una SUBCONSULTA sobre esa
   * tabla —`t.id IN (…person_id… WHERE project_id IN (:p0))`—, que es el mismo mecanismo que
   * `tasks.responsiblePersonId` ya usa. El SQL lo arma el motor: acá solo se declaran los nombres.
   */
  projectId: {
    kind: 'integer',
    via: { table: 'projects_persons', parentKey: 'person_id', column: 'project_id' },
  },
  q: { search: ['first_name', 'last_name'] },
};

/**
 * Lo ordenable: cuatro nombres, y TRES DE ELLOS SIN ÍNDICE COMPUESTO.
 *
 * La regla del esquema dice que un campo se declara ordenable SOLO si tiene índice terminado en
 * `id` (`docs/db-schemas/jiku.md`, "Los índices del keyset"). `people` NO TIENE
 * `(last_name, first_name, id)` ni `(init_date, id)`, y se declaran igual A PROPÓSITO:
 *
 *   `people` son LAS PERSONAS DEL EQUIPO: decenas de filas, no miles. Un Seq Scan + Sort sobre esa
 *   escala está tres órdenes de magnitud por debajo del statement_timeout de 8000 ms. La regla
 *   existe para `objectives` y `objective_activity`, que tienen millares.
 *
 * DEJA DE ESTAR BIEN si la tabla llegara al orden de las decenas de miles de filas. Ese es el
 * umbral, y entonces la respuesta es un índice, no sacar el campo del contrato.
 *
 * NINGUNA ES `nullable`: las cuatro columnas son `NOT NULL` en el esquema, y `end_date` —la única
 * NULL-able de la tabla— NO se declara ordenable.
 */
const SORTABLE: Record<string, SortableSpec> = {
  lastName: { column: 'last_name' },
  firstName: { column: 'first_name' },
  initDate: { column: 'init_date' },
  id: { column: 'id' },
};

/**
 * EL RECORTE DEL MODO EXTERNO de `people`: LAS ASIGNADAS A PROYECTOS PERMITIDOS.
 *
 * Es un recorte ALCANZABLE y no de columna: una persona NO LLEVA `project_id`, su relación con los
 * proyectos vive en `projects_persons`. Un `IN` sobre una columna del propio recurso —que no
 * existe— es el error que la simetría con `projects` invita a cometer.
 *
 * SIN `visibility`, y la ausencia significa "la tabla alcanzada NO TIENE columna de visibilidad",
 * nunca "no recortes": `projects_persons` no tiene ninguna, y el predicado de proyectos permitidos
 * se emite igual.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = {
  kind: 'exists',
  table: 'projects_persons',
  foreignKey: 'person_id',
  localKey: 'id',
  projectColumn: 'project_id',
};

export const peopleSpec: ResourceSpec = {
  name: 'people',
  // SIN traducción de nombre: el contrato y la tabla dicen `people`.
  table: 'people',

  base: BASE,
  includable: INCLUDABLE,
  filterable: FILTERABLE,
  sortable: SORTABLE,

  baseNames: Object.keys(BASE),
  includableNames: Object.keys(INCLUDABLE),
  fieldNames: [...Object.keys(BASE), ...Object.keys(INCLUDABLE)],
  filterableNames: Object.keys(FILTERABLE),
  sortableNames: Object.keys(SORTABLE),

  defaults: { sort: ['lastName', 'firstName'] },
  // Ningún enum: no hay ninguna columna de dominio cerrado en la ficha.
  enums: {},

  // Ningún texto sin cota que truncar: nombre y apellido son `varchar` cortos.
  truncatable: [],

  externalScope: EXTERNAL_SCOPE,

  // SIN `notFoundCode` NI `notFoundMessage`: `people` no tiene `get`.
};

export default peopleSpec;
