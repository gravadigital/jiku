import {
  ATTACHMENT_DB_TYPES,
  ATTACHMENT_ENTITY_CONTRACT,
  ATTACHMENT_ENTITY_DB,
  ATTACHMENT_ENTITY_OWNERS,
  ATTACHMENT_ENTITY_TYPES,
} from '../entity-type';
import {
  BaseSpec,
  ExternalScopeSpec,
  FilterableSpec,
  FixedJoinSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `attachments` — un DATO, no código.
 *
 * `attachments` ES EL VÍNCULO, NO EL ARCHIVO. Una fila dice "esta entidad tiene este archivo", y el
 * contrato devuelve los datos del archivo APLANADOS sobre el vínculo (CA-2) porque es lo que un
 * consumidor necesita para mostrar la lista de adjuntos de una tarea: nombre, tipo y tamaño, sin
 * una segunda consulta y sin un objeto anidado que después hay que desarmar.
 *
 * `include` ES NINGUNO, y es una decisión. La tentación es agregar `file` como relación y `entity`
 * como relación polimórfica: los datos del archivo YA VIENEN en la base, y la entidad dueña es
 * POLIMÓRFICA SIN FK —una relación polimórfica en el motor sería un JOIN condicional por tipo, que
 * es exactamente el caso especial que el motor no debe tener—. Quien quiera la entidad la pide con
 * su propio recurso.
 *
 * NO TIENE `get`, y la ausencia es el contrato (CA-14): `get` existe solo donde hay pantalla de
 * detalle (RF-2), y no hay pantalla de detalle de UN VÍNCULO. La pantalla de un archivo se llega
 * DESDE su vínculo.
 *
 * ESTA API NO MINTEA URLS (CA-8, RF-27). Descarga y preview siguen siendo el comando
 * `files.{fileId}.request-download`, que es donde vive el efecto de firmar, con su vencimiento y su
 * auditoría. Una consulta es idempotente y sin efectos.
 */

/** Alias del JOIN a la tabla de archivos. Fijo y de la ficha: es el que los campos aplanados nombran. */
const FILES = 'f';

/**
 * EL JOIN FIJO, Y NO UNA RELACIÓN.
 *
 * INNER y no LEFT: `attachments.file_id` es `NOT NULL` en la base desde la `20260819_05` y el
 * backfill de REQ-001 no puede completarse si queda una fila del modelo viejo. Con LEFT, un vínculo
 * roto aparecería con el archivo en NULL en vez de no aparecer, que sería peor.
 *
 * NO ES UNA `OneRelationSpec`: esa proyecta ANIDADO bajo la clave del campo, y CA-2 pide APLANADO.
 */
const JOINS: readonly FixedJoinSpec[] = [
  { table: 'files', alias: FILES, on: `${FILES}.id = t.file_id`, kind: 'INNER' },
];

/**
 * EL PREDICADO FIJO DEL RECURSO: las TRES cosas que no son negociables por payload.
 *
 * 1. `t.deleted_at IS NULL` — el vínculo borrado no vuelve (REQ-001). Desvincular BORRA la fila,
 *    salvo las que el modelo viejo dejó con `deleted_at`.
 * 2. `retention_status = 'active'` sobre el archivo unido — un archivo no retenido no es
 *    consultable, ni siquiera por su vínculo.
 * 3. `t.entity_type IN (…)` — LA LISTA BLANCA. La columna tiene DOCE valores en el modelo y el
 *    contrato declara CINCO. Los otros siete —`stage`, el `comment` LEGADO que dejó la migración
 *    `20260729_01`, y los cinco `*_draft` que REQ-001 dejó sin uso— NO TIENEN TRADUCCIÓN AL
 *    CONTRATO, así que no aparecen. Es deny-by-default (ADR-008) y NO un bug, pero el síntoma
 *    —"un adjunto viejo no aparece"— es indistinguible de uno: por eso está escrito acá.
 *
 * LOS TRES VAN EN LOS TRES SQL (filas, COUNT y get), porque `resource.where` se emite en los tres.
 * Los valores salen del mapa, JAMÁS del payload: la misma regla que gobierna `ManyRelationSpec.where`.
 */
const WHERE =
  't.deleted_at IS NULL' +
  ` AND ${FILES}.retention_status = 'active'` +
  ` AND t.entity_type IN (${ATTACHMENT_DB_TYPES.map((type) => `'${type}'`).join(', ')})`;

/**
 * El conjunto BASE: diez campos, cinco del vínculo y cinco DEL ARCHIVO, todos al mismo nivel.
 *
 * EL ORDEN DE ESTAS CLAVES ES EL DE LA RESPUESTA y el de `errorDetails.allowed`.
 */
const BASE: Record<string, BaseSpec> = {
  id: { column: 'id' },

  /**
   * LA MITAD QUE SE OLVIDA: la traducción DE VUELTA.
   *
   * Traducir el filtro —del `task_comment` del contrato al nombre que la base usa— es evidente y
   * se hace solo; devolver el valor traducido DE VUELTA se olvida, y el síntoma es un consumidor
   * que filtra por `task_comment` y recibe items con el nombre de la base — un valor que después
   * NO PUEDE volver a usar como filtro.
   *
   * El nombre de la base NO SE ESCRIBE ACÁ, ni siquiera en un comentario: el gate de CA-17 es un
   * grep sobre `src/` y tiene que poder ser exacto.
   *
   * El `where` de arriba garantiza que `raw` es uno de los cinco: una fila con un tipo no declarado
   * no llega hasta acá.
   */
  entityType: {
    column: 'entity_type',
    transform: (raw: any) => ATTACHMENT_ENTITY_CONTRACT[raw],
  },
  entityId: { column: 'entity_id' },
  fileId: { column: 'file_id' },

  // LOS CINCO DEL ARCHIVO, APLANADOS (CA-2). `from` es lo que los saca de la tabla unida y no de
  // `t`. NUNCA la clave, el bucket ni la región del storage: no se "excluyen", NO SE ESCRIBEN.
  fileName: { column: 'file_name', from: FILES },
  mimeType: { column: 'mime_type', from: FILES },
  fileSize: { column: 'file_size', from: FILES },
  uploadedBy: { column: 'uploaded_by', from: FILES },
  byteStatus: { column: 'byte_status', from: FILES },

  createdAt: { column: 'created_at' },
};

/**
 * NADA ES INCLUIBLE, y el objeto vacío es el contrato (CA-2).
 *
 * Lo único incluible que el otro recurso declara es del ARCHIVO, no del vínculo, y su lugar es
 * la ficha de ese recurso — acá no se declara ni se nombra.
 */
const INCLUDABLE: Record<string, IncludableSpec> = {};

/**
 * Los cuatro filtros declarados.
 *
 * `entityType` ES LA DIRECCIÓN DE ENTRADA. `enum` valida contra los cinco valores DEL CONTRATO
 * —que es lo que viaja en `errorDetails.allowed` (CA-4)— y `values` los traduce a los de la base
 * ANTES de que el valor llegue al SQL. Los dos mapas salen de `entity-type.ts`.
 *
 * NO ES UN DISCRIMINADOR y es OPCIONAL: la tabla es siempre la misma, y CA-13 pide explícitamente
 * el caso "sin filtro".
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  entityType: {
    column: 'entity_type',
    kind: 'enum',
    enum: 'entityType',
    values: Object.fromEntries(
      ATTACHMENT_ENTITY_TYPES.map((contract) => [contract, [ATTACHMENT_ENTITY_DB[contract]]])
    ),
  },
  entityId: { column: 'entity_id', kind: 'integer' },
  fileId: { column: 'file_id', kind: 'integer' },
  // DEL ARCHIVO, no del vínculo: la tabla del recurso NO TIENE `uploaded_by` (H-1 del plan). Sin
  // `from`, PostgreSQL responde `column t.uploaded_by does not exist` en la primera request.
  uploadedBy: { column: 'uploaded_by', from: FILES, kind: 'string' },
};

/**
 * Lo ordenable: `createdAt` e `id`, y nada más.
 *
 * `id` SE DECLARA a propósito (CA-2), a diferencia de `comments`: el motor lo agrega igual como
 * desempate, pero declararlo lo hace PEDIBLE — y cuando el caller lo pide, GANA SU DIRECCIÓN.
 *
 * NINGÚN CAMPO DEL ARCHIVO ES ORDENABLE, y no es un olvido: ordenar por el nombre del archivo haría
 * que el keyset comparara contra una columna de la tabla unida y dejaría de usar
 * `attachments(entity_type, entity_id)`, que es el índice de esta consulta.
 */
const SORTABLE: Record<string, SortableSpec> = {
  createdAt: { column: 'created_at' },
  id: { column: 'id' },
};

/**
 * EL RECORTE DEL MODO EXTERNO: la entidad dueña del vínculo tiene que ser visible.
 *
 * ES POLIMÓRFICO porque la tabla lo es: contra qué tabla hay que mirar la decide el VALOR de
 * `entity_type`, fila por fila. Las cinco ramas y sus columnas salen de `ATTACHMENT_ENTITY_OWNERS`,
 * o sea del MISMO mapa que la traducción (CA-17): un sexto tipo de entidad se agrega en UN lugar y
 * las dos cosas lo aprenden juntas.
 *
 * UN TIPO FUERA DEL MAPA NO PASA NINGUNA RAMA. Coincide con el `where`, y la redundancia es
 * deliberada: si alguien relajara la lista blanca, el recorte externo seguiría cerrado.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = {
  kind: 'polymorphic',
  typeColumn: 'entity_type',
  idColumn: 'entity_id',
  branches: ATTACHMENT_ENTITY_OWNERS,
};

export const attachmentsSpec: ResourceSpec = {
  name: 'attachments',
  table: 'attachments',
  joins: JOINS,
  where: WHERE,

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
   * ASCENDENTE, como `comments`: una lista de adjuntos SE LEE EN EL ORDEN EN QUE SE ADJUNTARON.
   * El motor agrega `id` como desempate CON LA DIRECCIÓN DEL ÚLTIMO CRITERIO, o sea `id ASC`.
   */
  defaults: { sort: ['createdAt'] },
  enums: { entityType: ATTACHMENT_ENTITY_TYPES },

  // NINGÚN CAMPO ES TEXTO SIN COTA: el nombre del archivo es `varchar(255)`. El presupuesto de
  // bytes no tiene nada que truncar acá, y declarar algo truncable sin serlo mentiría en
  // `meta.describe` (S-028).
  truncatable: [],

  externalScope: EXTERNAL_SCOPE,

  // SIN `notFoundCode` NI `notFoundMessage`: este recurso NO TIENE `get` (CA-14), igual que
  // `activity` y `subscriptions`. Declararlos sugeriría que existe un camino que los usa.
};

export default attachmentsSpec;
