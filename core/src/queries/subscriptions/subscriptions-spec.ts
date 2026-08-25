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
 * LA FICHA DE `subscriptions` — un DATO, no código.
 *
 * La más chica de las tres de S-025, y la que tiene las dos trampas mejor puestas:
 *
 *   1. LOS NOMBRES DE LAS DOS TABLAS NO SON SIMÉTRICOS: la de tareas es PLURAL
 *      (`objectives_subscriptors`) y la de requisitos SINGULAR (`requirement_subscriptors`).
 *      La asimetría es de la base, no del contrato, y por eso el nombre sale de `ENTITY_TABLES` y
 *      no se escribe acá: copiar uno para el otro rompe el SQL en tiempo de ejecución y no antes.
 *
 *   2. SU FILTRO SE LLAMA `userId`, que es uno de los once nombres que la lista de identidad
 *      prohíbe también dentro de `filter`. Los dos no se contradicen: QUIÉN PREGUNTA sale del
 *      segundo token del subject y solo de ahí (RF-19); `filter.userId` dice POR QUIÉN SE FILTRA,
 *      que es un dato del dominio. En modo externo el recorte `user_id = :caller` se aplica ANTES
 *      y con AND, así que pedir las de otro devuelve `items: []` y NO acceso.
 *
 * `subscriptions` NO TIENE `get`: no hay pantalla de detalle de una suscripción.
 */

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

/** Una variante de `subscriptions`. Los dos nombres salen del mapa compartido. */
function variantFor(entity: EntityType): ResourceVariant {
  const tables = ENTITY_TABLES[entity];

  return {
    table: tables.subscriptionTable,
    base: {
      entityType: { constant: entity },
      entityId: { column: tables.entityColumn },
    },
    filterable: {
      entityId: { column: tables.entityColumn, kind: 'integer' },
    },
    // SIN `externalScope` por variante: el recorte es el MISMO para las dos y se declara una sola
    // vez en el recurso. Ver `EXTERNAL_SCOPE`.
  };
}

/** El conjunto BASE: cinco campos. El orden es el de la respuesta y el de `errorDetails.allowed`. */
const BASE: Record<string, BaseSpec> = {
  id: { column: 'id' },
  // Placeholders de la variante. Ver `variantFor`.
  entityType: { constant: UNRESOLVED },
  entityId: { column: UNRESOLVED },
  userId: { column: 'user_id' },
  createdAt: { column: 'created_at' },
};

/** `{id, name, username}`, incluible y sin `email`, igual que el `author` de las otras dos. */
const INCLUDABLE: Record<string, IncludableSpec> = {
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
};

/**
 * Los tres filtros declarados.
 *
 * `userId` ES UN FILTRO DEL DOMINIO Y NO IDENTIDAD (ver la cabecera): que esté acá es lo que
 * levanta la prohibición DENTRO de `filter`, y solo ahí. En las claves de primer nivel del payload
 * la prohibición no se levanta nunca: ahí un `userId` no puede significar otra cosa que "pregunto
 * en nombre de".
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  // Filtrable del CONTRATO y sin columna: elige la tabla. Ver la ficha de `comments`.
  entityType: {},
  entityId: { column: UNRESOLVED, kind: 'integer' },
  userId: { column: 'user_id', kind: 'string' },
};

/**
 * Lo ordenable: `id` Y NADA MÁS (CA-10).
 *
 * `id` ES LA PK y las dos tablas no tienen más índices que ella: el keyset recorre por la PK y no
 * necesita un índice nuevo. Declarar `createdAt` prometería un orden sin índice que lo sostenga.
 */
const SORTABLE: Record<string, SortableSpec> = {
  id: { column: 'id' },
};

/**
 * EL RECORTE DE `subscriptions`: SOLO LAS PROPIAS.
 *
 * NO LLEVA EL PREDICADO DE PROYECTOS PERMITIDOS, y agregarlo "por simetría" con los otros recursos
 * sería un bug: saber a qué se suscribió UNO MISMO no depende de tener permiso sobre el proyecto
 * de la entidad. Con el predicado de proyectos, un caller externo suscripto a algo de un proyecto
 * que ya no ve dejaría de ver SU PROPIA suscripción — datos de menos, en silencio, sin error ni log.
 *
 * Y AL REVÉS: saber QUIÉN MÁS está suscripto a un requisito es información del equipo interno, y
 * por eso el recorte no es "las de los proyectos que veo" sino "las mías".
 *
 * SE DECLARA UNA VEZ EN EL RECURSO y no por variante: la columna es `user_id` en las dos tablas.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = { kind: 'owner', userColumn: 'user_id' };

export const subscriptionsSpec: ResourceSpec = {
  name: 'subscriptions',
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

  defaults: { sort: ['id'] },
  // Ningún enum: los cinco campos son ids, un constante y una fecha.
  enums: {},

  // Ningún texto sin cota que truncar.
  truncatable: [],

  externalScope: EXTERNAL_SCOPE,

  // SIN `notFoundCode` NI `notFoundMessage`: `subscriptions` no tiene `get`.
};

export default subscriptionsSpec;
