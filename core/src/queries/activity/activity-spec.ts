import { ENTITY_TABLES, ENTITY_TYPES, EntityType } from '../entity-type';
import {
  BaseSpec,
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  ResourceVariant,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `activity` — un DATO, no código.
 *
 * `activity` ES `comments` SIN EL PREDICADO DE TIPO: la misma tabla, las mismas dos variantes, el
 * mismo recorte — y sin `where`, así que devuelve CAMBIOS DE CAMPO **Y** COMENTARIOS (CA-8).
 *
 * NO SE FACTORIZA CON `comments`, y es deliberado: son DOS CONTRATOS. Las dos leen los nombres del
 * mismo `ENTITY_TABLES` —que es lo que no puede divergir— pero una ficha derivada de la otra haría
 * que un cambio en el contrato de `comments` moviera el de `activity` en silencio.
 *
 * `activity` NO TIENE `get`: no hay pantalla de detalle de una entrada de historial, y por eso no
 * declara `notFoundCode` ni `notFoundMessage`.
 */

/**
 * LOS ENUMS DE `type` SON camelCase Y DISTINTOS POR ENTIDAD.
 *
 * Es la INCONSISTENCIA 7 del esquema (`docs/db-schemas/jiku.md`): el resto de los enums del
 * producto son snake_case y estos dos no. Se copian LITERALES del DBML porque son valores de una
 * columna `ENUM` de PostgreSQL: un valor mal escrito no falla al compilar, falla en la base.
 *
 * VALIDAR CONTRA LA UNIÓN DE LOS DOS SERÍA UN BUG: aceptaría `area` en un requisito —que no existe
 * en `requirement_activity_type`— y la consulta devolvería `items: []` en vez de decir que el
 * valor no es válido para esa entidad (CA-9). Comparten seis valores de nueve, así que el 70% de
 * los tests pasa igual: los que lo atrapan son los dos cruces.
 */
const TASK_ACTIVITY_TYPES = [
  'state',
  'area',
  'comment',
  'title',
  'person',
  'priority',
  'estimatedFinishDate',
  'description',
  // Residuo del concepto de etapa eliminado. Sigue en el enum de la base.
  'stageId',
] as const;

const REQUIREMENT_ACTIVITY_TYPES = [
  'state',
  'comment',
  'type',
  'priority',
  'estimatedFinishDate',
  'tag',
  'resolution',
  'title',
  'description',
] as const;

const ACTIVITY_TYPES: Readonly<Record<EntityType, readonly string[]>> = {
  task: TASK_ACTIVITY_TYPES,
  requirement: REQUIREMENT_ACTIVITY_TYPES,
};

/** Compartido por las dos variantes. `type` lo pisa cada una con SU lista. */
const ENUMS = {
  visibilityLevel: ['public', 'internal'],
} as const;

/**
 * EL PLACEHOLDER DE LOS CAMPOS QUE RESUELVE LA VARIANTE.
 *
 * NO ES `'task'` NI NINGÚN NOMBRE REAL, y la diferencia es la que da nombre a la story: con el
 * nombre de una tabla de verdad, un camino que llegara al motor SIN resolver la variante leería
 * `objective_activity` EN SILENCIO —el bug intermitente que S-025 existe para prevenir—. Con este
 * valor, PostgreSQL responde `relation "…" does not exist` y el error es ruidoso e inmediato.
 *
 * Hoy ese camino no existe —`validateList`/`validateGet` exigen el discriminador y
 * `runList`/`runGet` llaman a `resolveVariant`, que lanza sin valor—, y esto es lo que mantiene
 * que siga sin existir mañana.
 *
 * LOS PLACEHOLDERS SON NECESARIOS y no un descuido: declaran la POSICIÓN de la clave en el mapa,
 * que es el orden de la respuesta y el de `errorDetails.allowed`. Las variantes solo PISAN
 * entradas existentes (`{...base, ...override}` conserva el lugar de lo que pisa).
 */
const UNRESOLVED = '__variante_sin_resolver__';

/** Una variante de `activity`. Los nombres salen de `ENTITY_TABLES`, nunca escritos acá. */
function variantFor(entity: EntityType): ResourceVariant {
  const tables = ENTITY_TABLES[entity];

  return {
    table: tables.activityTable,

    // SIN `where`, Y LA AUSENCIA ES EL CONTRATO: `comments` es ESTA MISMA TABLA con
    // `type_of_activity = 'comment'`. Toda la diferencia entre los dos recursos es esta línea que
    // no está, y por eso `activity` devuelve cambios de campo Y comentarios (CA-8).

    base: {
      entityType: { constant: entity },
      entityId: { column: tables.entityColumn },
    },

    filterable: {
      entityId: { column: tables.entityColumn, kind: 'integer' },
    },

    // EL ENUM CONDICIONADO A LA VARIANTE. Es la primera vez que el contrato lo necesita, y es
    // exactamente lo que el override de `enums` por variante resuelve.
    enums: { type: [...ACTIVITY_TYPES[entity]] },

    // IDÉNTICO AL DE `comments`: proyecto permitido y entidad dueña pública, MÁS la visibilidad de
    // la propia fila (H-8). La regla de visibilidad automática marca `internal` todo lo que no es
    // `state`/`title`/`description`, así que acá la segunda mitad recorta bastante más.
    externalScope: {
      kind: 'exists',
      table: tables.ownerTable,
      foreignKey: 'id',
      localKey: tables.entityColumn,
      projectColumn: 'project_id',
      visibility: { column: 'visibility_level', value: 'public' },
      ownVisibility: { column: 'visibility_level', value: 'public' },
    },
  };
}

/**
 * El conjunto BASE: diez campos.
 *
 * SIN `body`: `activity` NO traduce `new_value` a `body`. Una entrada de historial tiene un valor
 * anterior y uno nuevo, y llamarle "cuerpo" al segundo solo tiene sentido cuando la fila ES un
 * comentario — que es justamente lo que `comments` declara y esta ficha no.
 */
const BASE: Record<string, BaseSpec> = {
  id: { column: 'id' },
  // Placeholders de la variante. Ver `variantFor`.
  entityType: { constant: UNRESOLVED },
  entityId: { column: UNRESOLVED },
  type: { column: 'type_of_activity' },
  previousValue: { column: 'previous_value' },
  newValue: { column: 'new_value' },
  authorId: { column: 'changed_by' },
  visibilityLevel: { column: 'visibility_level' },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

/** Idéntico al de `comments`: dato personal ligero, incluible y sin `email`. */
const INCLUDABLE: Record<string, IncludableSpec> = {
  author: {
    kind: 'relation',
    cardinality: 'one',
    table: 'users',
    localKey: 'changed_by',
    targetKey: 'id',
    optional: false,
    fields: { id: 'id', name: 'name', username: 'username' },
  },
};

/**
 * Los filtros declarados.
 *
 * SIN `q`: la story no lo declara para `activity`. Buscar texto en el historial completo de una
 * entidad no está en el contrato, y agregarlo "por simetría con `comments`" sería inventarlo.
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  // Filtrable del CONTRATO y sin columna: elige la tabla. Ver la ficha de `comments`.
  entityType: {},
  entityId: { column: UNRESOLVED, kind: 'integer' },
  // El enum se resuelve contra `enums.type` de LA VARIANTE, no contra la unión de los dos.
  type: { column: 'type_of_activity', kind: 'enum', enum: 'type' },
  authorId: { column: 'changed_by', kind: 'string' },
  visibilityLevel: { column: 'visibility_level', kind: 'enum', enum: 'visibilityLevel' },
  createdAt: { column: 'created_at', kind: 'date' },
};

/**
 * Lo ordenable: `createdAt` e `id`.
 *
 * `id` SÍ SE DECLARA ACÁ (CA-8), a diferencia de `comments`: por eso el motor NO lo duplica cuando
 * el caller pide `sort: ['id']` —la guarda que S-024 dejó puesta— y la dirección que gana es la
 * suya.
 */
const SORTABLE: Record<string, SortableSpec> = {
  createdAt: { column: 'created_at' },
  id: { column: 'id' },
};

/**
 * Placeholder: el recorte REAL lo declara cada variante, porque la entidad dueña cambia. Ver la
 * nota de `UNRESOLVED` y la ficha de `comments`, que declara el mismo.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = {
  kind: 'exists',
  table: UNRESOLVED,
  foreignKey: 'id',
  localKey: UNRESOLVED,
  projectColumn: 'project_id',
  visibility: { column: 'visibility_level', value: 'public' },
  ownVisibility: { column: 'visibility_level', value: 'public' },
};

export const activitySpec: ResourceSpec = {
  name: 'activity',
  // Placeholder: la tabla la elige la variante. Ver `UNRESOLVED`.
  table: UNRESOLVED,

  discriminator: {
    field: 'entityType',
    values: ENTITY_TYPES,
    variants: {
      task: variantFor('task'),
      requirement: variantFor('requirement'),
    },
  },

  base: BASE,
  includable: INCLUDABLE,
  filterable: FILTERABLE,
  sortable: SORTABLE,

  baseNames: Object.keys(BASE),
  includableNames: Object.keys(INCLUDABLE),
  fieldNames: [...Object.keys(BASE), ...Object.keys(INCLUDABLE)],
  filterableNames: Object.keys(FILTERABLE),
  sortableNames: Object.keys(SORTABLE),

  // ASCENDENTE, igual que `comments`: el historial se lee del cambio más viejo al más nuevo.
  defaults: { sort: ['createdAt'] },
  enums: ENUMS,

  /**
   * DECISIÓN DOCUMENTADA, PARA QUE SE PUEDA VETAR EN UNA LÍNEA.
   *
   * La story no lo pide —CA-7 habla solo de `comments`— pero `previous_value` y `new_value` son
   * LAS MISMAS DOS COLUMNAS `TEXT` SIN COTA. Sin declararlas, una entrada de historial enorme (el
   * `description` completo de un requisito, dos veces) se devuelve entera, y una respuesta que
   * supera el `max_payload` del server NO LLEGA. Es una extensión de RF-14 por analogía, no un
   * requisito escrito.
   */
  truncatable: ['previousValue', 'newValue'],

  externalScope: EXTERNAL_SCOPE,

  // SIN `notFoundCode` NI `notFoundMessage`: `activity` no tiene `get` (Task 1, AC-12).
};

export default activitySpec;
