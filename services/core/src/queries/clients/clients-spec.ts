import { ErrorCode } from '@jiku/nats-protocol';
import {
  BaseFieldSpec,
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `clients` — un DATO, no código.
 *
 * EN EL CONTRATO EL RECURSO SE LLAMA `clients` Y LA TABLA TAMBIÉN. La UI dice "Actor", pero esa
 * traducción es DE LA UI y no de core (convención `contract-translation`): acá no hay ninguna
 * traducción de nombre, a diferencia de `tasks` -> `objectives`.
 *
 * LOS PROYECTOS DE UN ACTOR NO SON UN `include`, y es una decisión del contrato (CA-3): se piden
 * con `projects.list` + `filter.clientId`. Una colección sin cota anidada en cada item de una
 * página de 200 actores es una respuesta sin techo, y el recurso que la sirve ya existe.
 */

/**
 * El conjunto BASE: cuatro campos, lo que devuelve un `get` o un `list` sin pedir nada.
 *
 * `description` NO está acá y es incluible: es TEXTO SIN COTA (RF-17). Un actor tiene pocos
 * campos, así que la lista base es casi la tabla entera — y la excepción es justamente la única
 * columna de texto libre.
 */
const BASE: Record<string, BaseFieldSpec> = {
  id: { column: 'id' },
  name: { column: 'name' },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

/** Lo único que se pide de más. El orden de estas claves viaja en `errorDetails.allowed`. */
const INCLUDABLE: Record<string, IncludableSpec> = {
  description: { kind: 'field', column: 'description' },
};

/**
 * Los filtros declarados.
 *
 * `q` busca en `name` Y en `description`: qué se busca es parte del contrato y tiene que poder
 * leerse de la ficha, no adivinarse. NO declara `searchNumericColumn`: un actor no se busca por
 * id pegado en el buscador —eso es de `requirements`, donde el número de requisito es moneda
 * corriente en la conversación del equipo—.
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  id: { column: 'id', kind: 'integer' },
  name: { column: 'name', kind: 'string' },
  createdAt: { column: 'created_at', kind: 'date' },
  q: { kind: 'string', search: ['name', 'description'] },
};

/**
 * Lo ordenable.
 *
 * NINGUNA lleva `nullable: true`: `clients.name` es `NOT NULL` y las dos de timestamp las escribe
 * Sequelize en cada alta. Poner el flag "por las dudas" no es inocuo — obliga al keyset a la rama
 * disyuntiva, que es más larga y no usa el índice compuesto.
 */
const SORTABLE: Record<string, SortableSpec> = {
  name: { column: 'name' },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

/**
 * EL RECORTE DEL MODO EXTERNO de `clients`, y es el más fácil de olvidar de los tres.
 *
 * UN ACTOR NO TIENE `project_id`: su visibilidad es INDIRECTA y depende de TENER AL MENOS UN
 * PROYECTO PERMITIDO. Por eso la forma es un EXISTS sobre `projects` cruzado con
 * `user_project_permissions`, y NO un `IN` sobre una columna del propio actor — que es el error
 * que la simetría con `tasks` y `requirements` invita a cometer.
 *
 * DECLARARLO ES APLICARLO (S-023): el motor lo antepone al WHERE de los tres SQL —filas, COUNT y
 * get— y no hay ningún interruptor en la ficha para desactivarlo.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = {
  kind: 'exists',
  table: 'projects',
  foreignKey: 'client_id',   // la columna de `projects` que apunta al actor
  localKey: 'id',            // la columna del actor a la que apunta
  projectColumn: 'id',       // la columna de `projects` que tiene que estar entre las permitidas
};

export const clientsSpec: ResourceSpec = {
  name: 'clients',
  // SIN TRADUCCIÓN: el contrato y la base dicen lo mismo. La que traduce es la UI.
  table: 'clients',

  base: BASE,
  includable: INCLUDABLE,
  filterable: FILTERABLE,
  sortable: SORTABLE,

  // DERIVADAS con `Object.keys`, nunca escritas a mano: son LA MISMA lista que el validador
  // consulta, y por eso puede devolverlas por referencia en `errorDetails.allowed`.
  baseNames: Object.keys(BASE),
  includableNames: Object.keys(INCLUDABLE),
  fieldNames: [...Object.keys(BASE), ...Object.keys(INCLUDABLE)],
  filterableNames: Object.keys(FILTERABLE),
  sortableNames: Object.keys(SORTABLE),

  // ASCENDENTE POR NOMBRE, y no `-createdAt` como los otros dos recursos: un listado de actores se
  // lee alfabéticamente, no por antigüedad. El default de orden es parte del contrato de CADA
  // recurso, no una convención del motor.
  defaults: { sort: ['name'] },
  enums: {},

  truncatable: ['description'],

  externalScope: EXTERNAL_SCOPE,

  // LA CONSTANTE, nunca el literal (convención `error-handling`).
  notFoundCode: ErrorCode.CLIENT_NOT_FOUND,
  notFoundMessage: 'No existe un actor con ese id',
};

export default clientsSpec;
