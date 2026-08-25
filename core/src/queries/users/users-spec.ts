import {
  BaseFieldSpec,
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `users` — un DATO, no código.
 *
 * DOS COLUMNAS DE `users` NO APARECEN EN NINGUNA DE LAS CUATRO LISTAS, Y ES LA DECISIÓN MÁS FÁCIL
 * DE REVERTIR POR ACCIDENTE: las dos existen en la tabla desde S-015 y las dos son candidatos
 * naturales de filtro.
 *
 *   `roles`        -> es EL CONTROL DE ACCESO EFECTIVO de toda la superficie de lectura del bus
 *                     (S-023). Exponerlo publica el modelo de autorización a cualquier caller —
 *                     incluido el externo, que con eso puede enumerar quién es admin.
 *   `identityType` -> distingue persona de servicio. No lo necesita ninguna pantalla y filtra
 *                     estructura interna del espejo de identidad.
 *
 * NO HACE FALTA CÓDIGO PARA EXCLUIRLAS: la ficha es el lugar donde algo se declara o no existe, y
 * "NO ESTÁ DECLARADO" ES LA ÚNICA FORMA DE "NO SE PUEDE PEDIR" (ADR-008). El validador responde
 * `invalid_fields` para cualquier nombre fuera de estas listas, en las cuatro palancas a la vez.
 *
 * LA ÚNICA FORMA DE ROMPER CA-7 ES ESCRIBIRLAS. Mismo precedente que `ticketSlug` en `projects`.
 * Tampoco aparecen como columna de `q`.
 */

/** El conjunto BASE: cinco campos. `id` es el `sub` de Zitadel, no un entero. */
const BASE: Record<string, BaseFieldSpec> = {
  id: { column: 'id' },
  name: { column: 'name' },
  username: { column: 'username' },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

const INCLUDABLE: Record<string, IncludableSpec> = {
  /**
   * `email` ES EL ÚNICO DATO PERSONAL DEL CONTRATO, y por eso es INCLUIBLE Y NO BASE (CA-6, RF-17).
   *
   * Se puede FILTRAR SIN INCLUIRLO —`filterable` y `fieldNames` son listas independientes—, que
   * cubre el caso de uso real (buscar a alguien por email) sin publicar la columna en cada
   * respuesta.
   */
  email: { kind: 'field', column: 'email' },

  /**
   * LA PRIMERA RELACIÓN 1:1 INVERSA DEL CONTRATO: la FK vive en la OTRA tabla.
   *
   * `localKey: 'id'` + `targetKey: 'user_id'` emite
   * `LEFT JOIN people rel_person ON rel_person.user_id = t.id`, que es exactamente lo que hace
   * falta. El tipo ya lo soporta; no hace falta tocar el motor.
   *
   * `optional: true` porque una identidad de servicio NO TIENE persona: devuelve `person: null`.
   *
   * DEUDA DE ESQUEMA QUE HAY QUE CONOCER: `people.user_id` NO TIENE ÍNDICE ÚNICO. Dos filas de
   * `people` con el mismo `user_id` DUPLICARÍAN el usuario en la página, y una página con ids
   * repetidos ROMPE EL KEYSET. El dominio garantiza el 1:1; el esquema no lo enforcea.
   * DESAPARECE el día que `people.user_id` gane un índice único — que es otro alcance.
   */
  person: {
    kind: 'relation',
    cardinality: 'one',
    table: 'people',
    localKey: 'id',
    targetKey: 'user_id',
    optional: true,
    fields: { id: 'id', firstName: 'first_name', lastName: 'last_name' },
  },
};

/**
 * Los cuatro filtros declarados.
 *
 * `id` DECLARA `kind: 'string'` Y NO `integer`: es el `sub` de Zitadel, que es `varchar(100)`. Un
 * `integer` acá rechazaría todos los ids reales.
 *
 * `email` es filtrable Y NO ES BASE (CA-6): son dos listas independientes.
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  id: { column: 'id', kind: 'string' },
  username: { column: 'username', kind: 'string' },
  email: { column: 'email', kind: 'string' },
  q: { search: ['name', 'username', 'email'] },
};

/**
 * Lo ordenable: dos nombres, LOS DOS SIN ÍNDICE.
 *
 * `docs/db-schemas/jiku.md` dice de `users` *"sin índices: los dos accesos son por PK"*, y se
 * declaran igual A PROPÓSITO: es una tabla de DECENAS DE FILAS, poblada a mano. Un Seq Scan + Sort
 * sobre esa escala está tres órdenes de magnitud por debajo del statement_timeout de 8000 ms. La
 * regla del keyset existe para `objectives` y `objective_activity`, que tienen millares.
 *
 * DEJA DE ESTAR BIEN si la tabla llegara al orden de las decenas de miles de filas.
 *
 * NINGUNA ES `nullable`: `name` y `username` son `NOT NULL`.
 *
 * `id` NO SE DECLARA ORDENABLE: el motor lo agrega como desempate igual, con la dirección del
 * último criterio pedido.
 */
const SORTABLE: Record<string, SortableSpec> = {
  name: { column: 'name' },
  username: { column: 'username' },
};

/**
 * EL RECORTE DEL MODO EXTERNO de `users`: LOS DE MIS PROYECTOS, MÁS YO MISMO (CA-13, CA-14).
 *
 * La primera mitad es el `EXISTS` de manual: usuarios con permiso sobre algún proyecto que el
 * caller también vea.
 *
 * `orSelfColumn: 'id'` ES CA-14, y no es un adorno: sin esa mitad un caller externo SIN NINGÚN
 * permiso de proyecto —el estado de un cliente recién dado de alta— no podría ni resolver su
 * propio nombre. El motor la emite PARENTIZADA contra el resto del `WHERE`.
 *
 * SIN `visibility`: `user_project_permissions` no tiene columna de visibilidad, y la ausencia
 * nunca significa "no recortes".
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = {
  kind: 'exists',
  table: 'user_project_permissions',
  foreignKey: 'user_id',
  localKey: 'id',
  projectColumn: 'project_id',
  orSelfColumn: 'id',
};

export const usersSpec: ResourceSpec = {
  name: 'users',
  // SIN traducción de nombre: el contrato y la tabla dicen `users`.
  table: 'users',

  base: BASE,
  includable: INCLUDABLE,
  filterable: FILTERABLE,
  sortable: SORTABLE,

  baseNames: Object.keys(BASE),
  includableNames: Object.keys(INCLUDABLE),
  fieldNames: [...Object.keys(BASE), ...Object.keys(INCLUDABLE)],
  filterableNames: Object.keys(FILTERABLE),
  sortableNames: Object.keys(SORTABLE),

  defaults: { sort: ['name'] },
  // Ningún enum: el único de la tabla es `identity_type`, que NO se declara (CA-7).
  enums: {},

  // Ningún texto sin cota que truncar.
  truncatable: [],

  externalScope: EXTERNAL_SCOPE,

  // SIN `notFoundCode` NI `notFoundMessage`: `users` no tiene `get`.
};

export default usersSpec;
