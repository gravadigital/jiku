import { ErrorCode } from '@jiku/nats-protocol';
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
 * LA FICHA DE `comments` — un DATO, no código.
 *
 * `comments` NO ES UNA TABLA. Un comentario es una fila de `objective_activity` O de
 * `requirement_activity` con `type_of_activity = 'comment'`, y LOS IDS DE LAS DOS TABLAS SE PISAN:
 * el 1234 existe en las dos y son cosas distintas. Por eso `entityType` es el DISCRIMINADOR y es
 * obligatorio en `list` y en `get` — no es una comodidad de filtro, es lo que hace que el id tenga
 * significado.
 *
 * TRES TRADUCCIONES DE LECTURA, todas acá y ninguna en `@jiku/models` (ADR-004):
 *   `body`       <- `new_value`     (la columna se llama así porque la tabla es de ACTIVIDAD)
 *   `authorId`   <- `changed_by`
 *   `entityType` <-> `objective` / `requirement`, en las DOS direcciones y desde `ENTITY_TABLES`
 *
 * `activity` es ESTA MISMA ficha sin el `where`, y por eso las dos leen los nombres del mismo
 * mapa compartido en vez de factorizar una en la otra: son DOS CONTRATOS, y acoplarlos haría que
 * un cambio en uno moviera el otro en silencio.
 */

/** Los dos valores de `visibility_level`. El único enum de esta ficha. */
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

/**
 * UNA VARIANTE DE `comments`.
 *
 * TODO lo que cambia entre las dos sale de `ENTITY_TABLES`: ni un nombre de tabla ni de columna se
 * escribe acá. Es lo que permite que S-027 use el MISMO mapa para `attachments.list` sin que las
 * dos traducciones puedan divergir.
 */
function variantFor(entity: EntityType): ResourceVariant {
  const tables = ENTITY_TABLES[entity];

  return {
    table: tables.activityTable,

    // EL PREDICADO DEL RECURSO, no un filtro: un filtro se pisa desde el payload. `activity` es
    // ESTA MISMA tabla sin esta línea, y esa es toda la diferencia entre los dos recursos.
    where: 't.type_of_activity = \'comment\'',

    base: {
      // El valor lo decide LA VARIANTE y ninguna columna lo lleva: se pega en la proyección.
      entityType: { constant: entity },
      entityId: { column: tables.entityColumn },

      /**
       * LOS ADJUNTOS VIENEN EN EL CONJUNTO BASE, no en `include` (CA-6).
       *
       * Es la excepción justificada a "un campo nace incluible si es texto sin cota o dato
       * calculado": un comentario con adjunto SIN la referencia se muestra mal, y el costo de no
       * traerlo es una pantalla rota.
       *
       * SIN `cap` NI `truncatedFlag`: los adjuntos de UN comentario son pocos, y acotarlos
       * escondería uno sin decirlo. El presupuesto de bytes es la red.
       */
      attachments: {
        kind: 'relation',
        cardinality: 'many',
        table: 'attachments',
        parentKey: 'entity_id',
        join: { table: 'files', on: 'j.id = r.file_id' },
        // LAS TRES CONDICIONES SON DE SEGURIDAD, NO DE PROLIJIDAD:
        //  - `entity_type`: `attachments` es POLIMÓRFICA y no tiene FK. Sin esto, un comentario
        //    traería los adjuntos de la ENTIDAD con el mismo `entity_id`.
        //  - `deleted_at IS NULL`: el vínculo borrado no vuelve.
        //  - `retention_status = 'active'`: el archivo no retenido tampoco.
        // Las dos últimas son PERMANENTES Y NO CONFIGURABLES (RF-26).
        where:
          `r.entity_type = '${tables.commentAttachmentType}'` +
          ' AND r.deleted_at IS NULL' +
          ' AND j.retention_status = \'active\'',
        order: [{ expr: 'r.id', dir: 'ASC' }],
        // NUNCA `storage_key`, `storage_bucket`, `storage_region` ni `checksum`, y NO SE MINTEA
        // NINGUNA URL (RF-26, RF-27): descargar sigue siendo `files.{fileId}.request-download`.
        fields: {
          id: 'r.id',
          fileId: 'r.file_id',
          fileName: 'j.file_name',
          mimeType: 'j.mime_type',
          fileSize: 'j.file_size',
        },
      },
    },

    filterable: {
      entityId: { column: tables.entityColumn, kind: 'integer' },
    },

    /**
     * EL RECORTE DEL MODO EXTERNO: la entidad dueña tiene que estar en un proyecto permitido Y ser
     * pública, Y el comentario también tiene que ser público.
     *
     * LA FILA DE ACTIVIDAD NO LLEVA EL PROYECTO —lo lleva la entidad dueña—, así que es un EXISTS
     * y no un `IN` sobre una columna del propio recurso, que no existe.
     *
     * LAS DOS VISIBILIDADES SE EXIGEN, y es una decisión (H-8 del plan de S-025):
     * `objective_activity.visibility_level` existe exactamente para esto —el comentario es el
     * único tipo de actividad cuya visibilidad ELIGE EL USUARIO— y su default es `internal`. Sin
     * `ownVisibility`, un comentario interno sobre una tarea pública se ve desde el portal de
     * clientes y la columna no serviría para nada.
     */
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
 * El conjunto BASE: nueve campos.
 *
 * EL ORDEN DE ESTAS CLAVES ES EL DE LA RESPUESTA y el de `errorDetails.allowed`. Los tres que la
 * variante pisa —`entityType`, `entityId`, `attachments`— se declaran acá con su placeholder para
 * que conserven su posición: `{...base, ...override}` mantiene el lugar de lo que pisa.
 */
const BASE: Record<string, BaseSpec> = {
  id: { column: 'id' },
  // Placeholders de la variante. Ver `variantFor`.
  entityType: { constant: UNRESOLVED },
  entityId: { column: UNRESOLVED },
  // LA TRADUCCIÓN QUE DA NOMBRE A LA COLUMNA: `new_value` ES el cuerpo del comentario.
  body: { column: 'new_value' },
  authorId: { column: 'changed_by' },
  visibilityLevel: { column: 'visibility_level' },
  // Placeholder de la variante: declara la POSICIÓN de `attachments` en el conjunto base. La
  // relación real —con la traducción del `entity_type` y las dos exclusiones— la pone `variantFor`.
  attachments: {
    kind: 'relation',
    cardinality: 'many',
    table: UNRESOLVED,
    parentKey: 'entity_id',
    order: [{ expr: 'r.id', dir: 'ASC' }],
    fields: { id: 'r.id' },
  },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

/**
 * Lo único que se pide de más.
 *
 * `author` ES INCLUIBLE Y NO BASE: `{id, name, username}` es dato personal ligero (RF-17) y
 * `authorId` alcanza para la mayoría de los usos. NUNCA `email`.
 */
const INCLUDABLE: Record<string, IncludableSpec> = {
  author: {
    kind: 'relation',
    cardinality: 'one',
    table: 'users',
    localKey: 'changed_by',
    targetKey: 'id',
    // INNER JOIN: `changed_by` es `NOT NULL` con FK a `users.id`. No hay comentario sin autor.
    optional: false,
    fields: { id: 'id', name: 'name', username: 'username' },
  },
};

/**
 * Los filtros declarados.
 *
 * `entityType` ESTÁ ACÁ Y NO TIENE COLUMNA, y las dos cosas son deliberadas: es un filtro del
 * CONTRATO —`meta.describe` (S-028) lo va a proyectar como tal— y no una columna, porque lo que
 * hace es ELEGIR LA TABLA. El motor lo consume antes de armar el filtro y nunca produce condición.
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  entityType: {},
  // Placeholder de la variante: la columna real es `objective_id` o `requirement_id`.
  entityId: { column: UNRESOLVED, kind: 'integer' },
  authorId: { column: 'changed_by', kind: 'string' },
  visibilityLevel: { column: 'visibility_level', kind: 'enum', enum: 'visibilityLevel' },
  createdAt: { column: 'created_at', kind: 'date' },
  /**
   * `q` BUSCA EN `body` Y NADA MÁS, y NO declara `searchNumericColumn`: en un comentario un texto
   * de dígitos ES TEXTO, no un id. Es la diferencia con `requirements`, donde pegar un número de
   * requisito en el buscador es el caso más frecuente.
   */
  q: { kind: 'string', search: ['new_value'] },
};

/**
 * Lo ordenable: `createdAt` y `updatedAt`, y nada más.
 *
 * `id` NO SE DECLARA: el motor lo agrega como desempate con la dirección del último criterio, o
 * sea `id ASC`, que es exactamente el orden del índice de S-021
 * `(objective_id, type_of_activity, created_at, id)`.
 */
const SORTABLE: Record<string, SortableSpec> = {
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

/**
 * Placeholder: el recorte REAL lo declara cada variante, porque la entidad dueña cambia
 * (`objectives` o `requirements`). Apunta a `UNRESOLVED` por la misma razón que la tabla: un
 * recorte que se emitiera sin resolver la variante tiene que fallar, no recortar contra la tabla
 * equivocada.
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

export const commentsSpec: ResourceSpec = {
  name: 'comments',
  // Placeholder: la tabla la elige la variante. Nadie lee esta propiedad sin pasar por
  // `resolveVariant`, que la reemplaza siempre — y si alguien lo hiciera, el SQL falla ruidoso.
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

  /**
   * EL DEFAULT ES ASCENDENTE, y es el único del contrato que lo es.
   *
   * Un hilo de comentarios SE LEE DEL MÁS VIEJO AL MÁS NUEVO. Con el `['-createdAt']` del resto
   * del contrato, la primera página del hilo sería la ÚLTIMA del hilo, que a simple vista "también
   * ordena" — por eso el test compara contra el comentario más viejo y no contra "está ordenado".
   *
   * El motor agrega `id` como desempate CON LA DIRECCIÓN DEL ÚLTIMO CRITERIO, o sea `id ASC`.
   */
  defaults: { sort: ['createdAt'] },
  enums: ENUMS,

  // `body` es TEXTO SIN COTA y viene en la BASE: es el recurso donde el presupuesto de bytes se
  // ejercita de verdad. Declararlo acá es todo lo que `bodyTruncated` necesita (CA-7).
  truncatable: ['body'],

  externalScope: EXTERNAL_SCOPE,

  notFoundCode: ErrorCode.COMMENT_NOT_FOUND,
  // NO DISTINGUE "no existe" de "no lo podés ver" (CA-13, RF-31): distinguirlos le confirmaría a
  // un caller externo que el comentario existe.
  notFoundMessage: 'No existe un comentario con ese id',
};

export default commentsSpec;
