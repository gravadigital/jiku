import { ErrorCode } from '@jiku/nats-protocol';
import { keyValuePairsToProperties } from '../../commands/projects/properties';
import {
  BaseFieldSpec,
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `projects` — un DATO, no código.
 *
 * EL IMPORT CRUZA DE `queries/` A `commands/`, Y ES A PROPÓSITO: es el mismo precedente que
 * `tasks-spec.ts` con `commands/tasks/priority`. La traducción `properties` <-> `key_value_pairs`
 * vive en el helper del módulo de dominio y los DOS planos la consumen; duplicarla acá crearía la
 * divergencia que la convención `contract-translation` existe para prevenir.
 */

/**
 * `ticketSlug` NO APARECE en ninguna de las cuatro listas, y es la decisión más fácil de revertir
 * por accidente: la columna existe, tiene `unique`, y es un candidato natural de filtro.
 *
 * FG-6 la marcó para eliminarse y EL CONTRATO NACE SIN ELLA (RF-26): incluirla obligaría al
 * saneamiento a romper un contrato recién publicado. La ficha es el lugar donde algo se declara o
 * no existe, y "NO ESTÁ DECLARADO" ES LA ÚNICA FORMA DE "NO SE PUEDE PEDIR": el validador responde
 * `invalid_fields` para cualquier nombre fuera de estas listas, sin una línea de código propia.
 */

/** Los enums de la base, con los valores EXACTOS del DBML. */
const ENUMS = {
  type: ['interno', 'comercial', 'investigacion', 'propuesta'],
  status: ['analisis', 'activo', 'inactivo', 'finalizado', 'cancelado'],
} as const;

/**
 * El conjunto BASE: los diez campos que devuelve un `get` o un `list` sin pedir nada.
 *
 * `description` y `properties` NO están acá: el primero es texto sin cota y el segundo puede
 * llevar datos operativos del proyecto (RF-17). `initDate`, `endDate` y `priority` tampoco: son
 * los campos de planificación, que la mayoría de las pantallas no mira.
 */
const BASE: Record<string, BaseFieldSpec> = {
  id: { column: 'id' },
  code: { column: 'code' },
  name: { column: 'name' },
  type: { column: 'type' },
  status: { column: 'status' },
  clientId: { column: 'client_id' },
  originId: { column: 'origin_id' },
  createdBy: { column: 'created_by' },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

const INCLUDABLE: Record<string, IncludableSpec> = {
  description: { kind: 'field', column: 'description' },

  /**
   * LA TRADUCCIÓN QUE DA NOMBRE A ESTA STORY: la columna es `key_value_pairs` y guarda un OBJETO
   * plano; el contrato dice `properties` y es una LISTA de `{code, value}`.
   *
   * INCLUIBLE Y NO FILTRABLE, y la razón es de la columna y no de estilo: `key_value_pairs` es
   * `JSON` y NO `JSONB` (inconsistencia 3 del esquema), así que NO ADMITE el contains indexado
   * que sí usa `requirements.tags`. Declararla filtrable produciría o un `Seq Scan` con cast por
   * fila, o un filtro en memoria: las dos formas ROMPEN EL KEYSET. La simetría con `tags` la
   * sugiere, y es la trampa mejor puesta del recurso.
   */
  properties: { kind: 'field', column: 'key_value_pairs', transform: keyValuePairsToProperties },

  initDate: { kind: 'field', column: 'init_date' },
  endDate: { kind: 'field', column: 'end_date' },
  priority: { kind: 'field', column: 'priority' },

  client: {
    kind: 'relation',
    cardinality: 'one',
    table: 'clients',
    localKey: 'client_id',
    targetKey: 'id',
    // LEFT JOIN: `client_id` es NULL-able. Con INNER JOIN, un proyecto sin actor DESAPARECERÍA de
    // la colección — datos de menos, en silencio.
    optional: true,
    fields: { id: 'id', name: 'name' },
  },

  origin: {
    kind: 'relation',
    cardinality: 'one',
    table: 'origins',
    localKey: 'origin_id',
    targetKey: 'id',
    // NULL-able y ADEMÁS sin FK declarada en la base: con INNER JOIN pasaría lo mismo que arriba.
    optional: true,
    fields: { id: 'id', name: 'name' },
  },
};

/**
 * Los filtros declarados.
 *
 * `properties` NO ESTÁ (ver el comentario de su incluible) y `ticketSlug` tampoco (ver el de
 * arriba). Los dos son ausencias deliberadas, no olvidos.
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  id: { column: 'id', kind: 'integer' },
  code: { column: 'code', kind: 'string' },
  name: { column: 'name', kind: 'string' },
  type: { column: 'type', kind: 'enum', enum: 'type' },
  status: { column: 'status', kind: 'enum', enum: 'status' },
  clientId: { column: 'client_id', kind: 'integer' },
  originId: { column: 'origin_id', kind: 'integer' },
  // ENTERO CRUDO y no enum: en `projects` la columna es `INTEGER`, sin nombres. Es la asimetría
  // con `requirements`, donde la misma palabra es un `ENUM` de nombres.
  priority: { column: 'priority', kind: 'integer' },
  createdBy: { column: 'created_by', kind: 'string' },
  initDate: { column: 'init_date', kind: 'date' },
  endDate: { column: 'end_date', kind: 'date' },
  createdAt: { column: 'created_at', kind: 'date' },
  updatedAt: { column: 'updated_at', kind: 'date' },
  q: { kind: 'string', search: ['name', 'code', 'description'] },
};

/**
 * Lo ordenable.
 *
 * CUATRO COLUMNAS SON NULL-ABLES Y LO DECLARAN. `nullable: true` NO ES DECORATIVO: sin él, el
 * predicado keyset compara contra NULL, da NULL —o sea NINGUNA FILA— y CORTA EL RECORRIDO en el
 * primer proyecto sin ese valor, en silencio. No hay error ni log: la página siguiente viene
 * vacía.
 */
const SORTABLE: Record<string, SortableSpec> = {
  // El DBML no declara `NOT NULL` en ninguna de las dos.
  name: { column: 'name', nullable: true },
  code: { column: 'code', nullable: true },
  status: { column: 'status' },
  // `default: 0` NO ES `NOT NULL`: la columna admite NULL y las filas viejas pueden tenerlo.
  priority: { column: 'priority', nullable: true },
  initDate: { column: 'init_date' },              // NOT NULL
  endDate: { column: 'end_date', nullable: true },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

/**
 * EL RECORTE DEL MODO EXTERNO de `projects`: SU PROPIA `id` entre los proyectos permitidos.
 *
 * SIN `visibility`, y la ausencia significa "este recurso NO TIENE columna de visibilidad", nunca
 * "no recortes": un proyecto no tiene `visibility_level`. El predicado de proyectos permitidos se
 * emite igual, y no hay interruptor en la ficha para desactivarlo.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = {
  kind: 'column',
  projectColumn: 'id',
};

export const projectsSpec: ResourceSpec = {
  name: 'projects',
  // SIN traducción de nombre: el contrato y la tabla dicen `projects`. Lo que sí se traduce es un
  // CAMPO (`properties`), y esa traducción vive en el helper del módulo.
  table: 'projects',

  base: BASE,
  includable: INCLUDABLE,
  filterable: FILTERABLE,
  sortable: SORTABLE,

  baseNames: Object.keys(BASE),
  includableNames: Object.keys(INCLUDABLE),
  fieldNames: [...Object.keys(BASE), ...Object.keys(INCLUDABLE)],
  filterableNames: Object.keys(FILTERABLE),
  sortableNames: Object.keys(SORTABLE),

  defaults: { sort: ['-createdAt'] },
  enums: ENUMS,

  truncatable: ['description'],

  externalScope: EXTERNAL_SCOPE,

  notFoundCode: ErrorCode.PROJECT_NOT_FOUND,
  notFoundMessage: 'No existe un proyecto con ese id',
};

export default projectsSpec;
