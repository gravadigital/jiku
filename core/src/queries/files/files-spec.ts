import { ErrorCode } from '@jiku/nats-protocol';
import { ATTACHMENT_ENTITY_OWNERS } from '../entity-type';
import {
  BaseSpec,
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `files` — un DATO, no código.
 *
 * ESTA API NO MINTEA URLS, y es la razón de ser de la ficha (CA-8, RF-27). `files.get` devuelve
 * METADATOS. Descarga y preview siguen siendo el comando `files.{fileId}.request-download`, que es
 * donde vive el efecto de firmar, con su vencimiento y su auditoría. Una consulta es idempotente y
 * sin efectos; mintear una prefirmada ES un efecto, y meterlo acá rompería la propiedad más simple
 * del plano de lectura y duplicaría la lógica de firma en un segundo lugar.
 *
 * LOS TRES CAMPOS DE UBICACIÓN FÍSICA NO ESTÁN, ni como campo ni como filtro (CA-7, RF-26). NO SE
 * EXCLUYEN: NO SE ESCRIBEN. La clave del storage es el campo que más obviamente resuelve "cómo
 * llego al archivo" y está a una línea de distancia — publicarla es publicar la estructura del
 * bucket, y con ella la superficie de un acceso directo que saltea el comando de descarga y su
 * auditoría.
 *
 * NO TIENE `list`, y la ausencia es el contrato (CA-14): los archivos se listan POR SU VÍNCULO, con
 * `attachments.list`. Traer varios por id es `attachments.list` + `filter.fileId: [1,2,3]`.
 */

/**
 * EL PREDICADO FIJO DEL RECURSO: un archivo no retenido NO ES CONSULTABLE.
 *
 * ES DEL RECURSO Y NO DEL FILTRO, y la diferencia es CA-10: un filtro se pisa desde el payload; el
 * ciclo de retención de REQ-001 no es negociable. La fila no matchea y `runGet` responde
 * `file_not_found` — LA MISMA respuesta que un id inexistente y que uno no visible (RF-31).
 */
const WHERE = 't.retention_status = \'active\'';

/** El conjunto BASE: ocho campos. EL ORDEN ES EL DE LA RESPUESTA y el de `errorDetails.allowed`. */
const BASE: Record<string, BaseSpec> = {
  id: { column: 'id' },
  fileName: { column: 'file_name' },
  fileSize: { column: 'file_size' },
  mimeType: { column: 'mime_type' },
  byteStatus: { column: 'byte_status' },
  retentionStatus: { column: 'retention_status' },
  // ES UN ID DE USUARIO, NO UN DATO PERSONAL, y es lo que hace auditable de quién es cada archivo.
  uploadedBy: { column: 'uploaded_by' },
  createdAt: { column: 'created_at' },
};

/**
 * Lo único incluible, y viene con su advertencia (CA-9).
 *
 * `checksum` ES UN DATO INFORMADO, NO UNA GARANTÍA DE INTEGRIDAD: LO DECLARA QUIEN SUBE Y NADIE LO
 * VERIFICA. El nombre sugiere lo contrario, y por eso la advertencia va acá: `meta.describe`
 * (S-028) la va a exponer.
 *
 * ES INCLUIBLE Y NO BASE (RF-17): 64 caracteres por fila que nadie mira salvo que los pida.
 */
const INCLUDABLE: Record<string, IncludableSpec> = {
  checksum: { kind: 'field', column: 'checksum' },
};

/**
 * VACÍOS LOS DOS, Y ES CORRECTO: este recurso no tiene `list`.
 *
 * `ResourceSpec` los exige aunque el recurso solo tenga `get`, y un `get` no usa ninguno —
 * `buildGetSql` pasa `[]` como orden y `validateGet` rechaza `filter`/`sort`/`page`/`count` antes
 * de mirarlos. Declararlos vacíos es lo honesto: `meta.describe` (S-028) va a decir "este recurso
 * no tiene filtros ni orden", que es cierto. Poblarlos "por las dudas" declararía un contrato que
 * ningún endpoint sirve.
 */
const FILTERABLE: Record<string, FilterableSpec> = {};
const SORTABLE: Record<string, SortableSpec> = {};

/**
 * EL RECORTE DEL MODO EXTERNO, EN SUS DOS RAMAS. Es el más complejo del contrato.
 *
 *   (A) el archivo tiene AL MENOS UN VÍNCULO VIVO con una entidad visible          -> CA-12
 *   (B) NO tiene NINGÚN vínculo vivo Y lo subió el propio caller                   -> CA-11
 *
 * LA RAMA (B) NO ES `orSelfColumn`, y confundirlas es un bug de seguridad. `orSelfColumn` entra
 * SIEMPRE; esta entra SOLO si el `EXISTS` de la (A) está vacío. Con la semántica ancha, un archivo
 * con un vínculo vivo a una entidad que el caller NO ve sería visible para quien lo subió, y CA-12
 * dice exactamente lo contrario.
 *
 * LA (B) ES LO QUE HACE COHERENTE AL FLUJO DE SUBIDA: un archivo con 0 vínculos es un estado válido
 * (REQ-001), y sin esta rama un externo sube un archivo y no puede consultarlo hasta vincularlo.
 * El índice `(uploaded_by, byte_status)` —que YA EXISTÍA— es lo que la hace barata.
 *
 * Y ES ACOTADA A PROPÓSITO: un archivo cuyo ÚNICO vínculo fue borrado vuelve a ser visible solo
 * para quien lo subió. Es el comportamiento correcto — el vínculo se borró, el archivo se retuvo.
 *
 * `through` REUSA `ATTACHMENT_ENTITY_OWNERS`: las mismas cinco ramas que `attachments.list`, del
 * mismo mapa (CA-17). Un sexto tipo de entidad se agrega en UN lugar.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = {
  kind: 'bridge',
  table: 'attachments',
  foreignKey: 'file_id',
  localKey: 'id',
  // QUÉ ES UN VÍNCULO "VIVO". Va en LAS DOS subconsultas y tiene que ser LA MISMA condición: si
  // difirieran, existiría un archivo que no pasa la (A) y tampoco la (B). El alias `br_` es del
  // motor y está acoplado a propósito, igual que los alias `r` y `j` de una relación de colección.
  liveWhere: 'br_.deleted_at IS NULL',
  through: {
    kind: 'polymorphic',
    typeColumn: 'entity_type',
    idColumn: 'entity_id',
    branches: ATTACHMENT_ENTITY_OWNERS,
  },
  orOrphanColumn: 'uploaded_by',
};

export const filesSpec: ResourceSpec = {
  name: 'files',
  table: 'files',
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

  // SIN CONSUMIDOR: este recurso no tiene `list`. Se declara la columna que existiría si lo tuviera.
  defaults: { sort: ['createdAt'] },
  enums: {},
  // NINGÚN CAMPO ES TEXTO SIN COTA: el nombre es `varchar(255)` y el checksum `varchar(64)`.
  truncatable: [],

  externalScope: EXTERNAL_SCOPE,

  notFoundCode: ErrorCode.FILE_NOT_FOUND,
  // NO DISTINGUE "no existe" de "no está retenido" de "no lo podés ver" (CA-10, CA-11, CA-12,
  // RF-31): distinguirlas le confirmaría a un caller externo que el archivo existe.
  notFoundMessage: 'No existe un archivo con ese id',
};

export default filesSpec;
