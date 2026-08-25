import {
  BaseFieldSpec,
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `settings` — UNA LISTA BLANCA DE CLAVES, NO LA TABLA.
 *
 * ES DENY-BY-DEFAULT (ADR-008) APLICADO A DATOS DE CONFIGURACIÓN. `system_settings` es una tabla de
 * configuración operativa del producto: una clave nueva agregada por SQL para un experimento NO
 * DEBE aparecer en un contrato público por el solo hecho de existir. La lista blanca es CERRADA y
 * está en el contrato (`docs/apis/core-queries.yaml`); una clave que exista en la tabla y no esté
 * declarada NO EXISTE PARA ESTA API, y pedirla explícitamente devuelve `items: []`, no un error.
 *
 * `items: []` Y NO UN ERROR, y la diferencia es de contrato: un `invalid_fields` diría "esa clave es
 * un nombre inválido"; la colección vacía dice "no hay nada con ese nombre acá". La segunda es la
 * verdad, y es la misma mecánica con la que opera un recorte.
 *
 * SIN ACCESO EXTERNO: la configuración operativa del producto no es información del portal de
 * clientes. El motor corta ANTES de consultar — cero SQL, cero filas, cero error.
 *
 * ESTA STORY NO VUELVE ADMINISTRABLE A `system_settings`: la escritura sigue siendo solo por SQL.
 * Lo único que agrega es LECTURA, y solo de lo declarado.
 */

/**
 * LAS SEIS CLAVES DE LA LISTA BLANCA, EN NOMBRES DE LA BASE.
 *
 * ⚠️ `hours_per_day` VA CON GUIONES BAJOS y las otras cinco con guiones medios. No es un descuido de
 * esta ficha: es lo que hay en la base. La clave vieja la creó `20260206_01_system_settings.js` con
 * guiones bajos y la lee así `api/lib/routes/settings-get.ts`; las cinco de archivos las creó
 * `20260819_05_harden_attachments_schema.js` con guiones medios. La disidente es la de febrero.
 *
 * EL CONTRATO PUBLICA `hours-per-day`, con guiones medios, y `core` TRADUCE — que es literalmente
 * ADR-004: "el vocabulario del producto vive en el contrato, la base no se toca". Publicar
 * `hours_per_day` crudo dejaría al contrato de consultas hablando en nombres de columna, que es lo
 * que ese ADR prohíbe; y escribir la lista blanca con el nombre del contrato SIN traducir haría que
 * `settings.list` devolviera CINCO claves y `hours-per-day` no apareciera nunca — un bug silencioso,
 * porque `items: []` para esa clave es indistinguible de "no está declarada".
 */
const WHITELIST_DB_KEYS = [
  'hours_per_day',
  'upload-url-ttl-seconds',
  'download-url-ttl-seconds',
  'file-max-size-bytes',
  'file-allowed-extensions',
  'file-allowed-mime-types',
] as const;

/**
 * LA TRADUCCIÓN, EN LAS DOS DIRECCIONES. Solo tiene una entrada, y así tiene que ser: las otras
 * cinco claves se llaman igual en las dos puntas.
 *
 * NO SE IMPORTA `SETTING_KEYS` DE `commands/files/settings.ts`. Vive en el plano de COMANDOS y es la
 * política de ESCRITURA; el plano de consultas no depende del de comandos. Que coincidan en cinco de
 * seis entradas es correcto, no duplicación a eliminar: son dos contratos distintos que hoy nombran
 * lo mismo, y el día que uno cambie el otro no tiene por qué seguirlo.
 */
const KEY_TO_CONTRACT: Readonly<Record<string, string>> = { hours_per_day: 'hours-per-day' };
const KEY_TO_DB: Readonly<Record<string, readonly string[]>> = {
  'hours-per-day': ['hours_per_day'],
};

/**
 * EL PREDICADO FIJO DEL RECURSO: la lista blanca.
 *
 * VA EN `where` Y NO EN UN FILTRO, y la diferencia no es de estilo: un filtro se pisa desde el
 * payload y el predicado del recurso no es negociable. `where` se emite en LOS TRES SQL —filas,
 * COUNT y get—, así que el `count` cuenta exactamente lo que la colección devuelve y el filtro del
 * payload se combina con AND contra la lista blanca. Eso es lo que hace que CA-9 salga sin una línea
 * de código propia: `filter.key` fuera de la lista da la intersección vacía.
 *
 * LOS LITERALES SALEN DE LA FICHA, NO DEL PAYLOAD, así que llegan al SQL sin escaparse — la misma
 * regla que ya gobierna `ManyRelationSpec.where` e `IncludableComputedSpec.expr`. `resource.where`
 * no admite `replacements`, y hacerlo admitir sería un cambio del motor que esta story no necesita.
 */
const WHITELIST_PREDICATE = `t.key IN (${WHITELIST_DB_KEYS.map((key) => `'${key}'`).join(', ')})`;

/**
 * El conjunto BASE: tres campos.
 *
 * `value` VIAJA SIEMPRE COMO STRING. La columna es `TEXT` y el driver la devuelve como string; NO se
 * agrega un `transform` que parsee números. `file-allowed-mime-types` es una lista separada por
 * comas y `hours-per-day` es un `'6'`: darle tipo a uno obligaría a decidir el tipo de cada clave, o
 * sea a mantener un esquema por clave que el contrato no promete.
 */
const BASE: Record<string, BaseFieldSpec> = {
  id: { column: 'id' },
  // LA TRADUCCIÓN DE SALIDA, en la ficha y no en el archivo del recurso: es lo que hace que
  // `meta.describe` la proyecte y que CA-12 siga siendo verificable para este recurso.
  key: { column: 'key', transform: (raw: string) => KEY_TO_CONTRACT[raw] ?? raw },
  value: { column: 'value' },
};

/**
 * NINGÚN INCLUIBLE, y la ausencia es el contrato (CA-7: "include · ninguno"). Una clave de
 * configuración no tiene relaciones que traer.
 */
const INCLUDABLE: Record<string, IncludableSpec> = {};

/**
 * EL ÚNICO FILTRO: `key`.
 *
 * `values` ES LA TRADUCCIÓN DE ENTRADA —contrato -> base—, la dirección inversa del `transform` de
 * `base.key`. Un valor del mapa se traduce; uno que NO está en el mapa viaja tal cual y se combina
 * con la lista blanca, que es exactamente lo que CA-9 pide: `items: []`, no un error.
 *
 * `key` NO SE DECLARA `kind: 'enum'` aunque los valores válidos sean seis y estén cerrados. Un enum
 * responde `invalid_fields` a un valor fuera de la lista, y el contrato de esta lista blanca es la
 * colección VACÍA: la clave no es inválida, simplemente no existe para esta API.
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  key: { column: 'key', kind: 'string', values: KEY_TO_DB },
};

/**
 * Lo ordenable: `key` e `id`.
 *
 * `id` ESTÁ DECLARADO A PROPÓSITO: el motor lo agrega como último criterio de desempate del keyset,
 * y una ficha que no lo declare lo ve agregado igual. Declararlo es lo que hace que el desempate no
 * se duplique — el mismo criterio con que lo resolvió `requirements-spec.ts`.
 *
 * `value` NO ES ORDENABLE: ordenar configuración por su contenido no tiene ningún caso de uso, y
 * declararlo prometería un orden sobre un `TEXT` que puede ser una lista de MIME types.
 */
const SORTABLE: Record<string, SortableSpec> = {
  key: { column: 'key' },
  id: { column: 'id' },
};

/**
 * SIN ACCESO EXTERNO (CA-7). El portal de clientes no tiene por qué conocer la configuración
 * operativa del producto —cuántas horas tiene un día de trabajo, qué extensiones se aceptan, cuánto
 * dura una URL firmada—, y ninguna de esas cosas es información de sus proyectos.
 *
 * `deniesAllRows` corta en `runList` ANTES de armar nada: cero SQL. Un `WHERE FALSE` daría el mismo
 * resultado y pagaría un round-trip por cada request de un portal que no tiene por qué leer nada.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = { kind: 'none' };

export const settingsSpec: ResourceSpec = {
  name: 'settings',
  table: 'system_settings',

  where: WHITELIST_PREDICATE,

  base: BASE,
  includable: INCLUDABLE,
  filterable: FILTERABLE,
  sortable: SORTABLE,

  baseNames: Object.keys(BASE),
  includableNames: Object.keys(INCLUDABLE),
  fieldNames: [...Object.keys(BASE), ...Object.keys(INCLUDABLE)],
  filterableNames: Object.keys(FILTERABLE),
  sortableNames: Object.keys(SORTABLE),

  // ASCENDENTE POR CLAVE: una lista de configuración se lee alfabéticamente, no por antigüedad.
  defaults: { sort: ['key'] },
  enums: {},

  // `value` PUEDE SER LARGO —`file-allowed-mime-types` supera los 255 caracteres—, pero son SEIS
  // FILAS y el presupuesto de bytes no está en juego. Declararlo truncable prometería un
  // `valueTruncated` que ningún caso necesita.
  truncatable: [],

  externalScope: EXTERNAL_SCOPE,

  // SIN `notFoundCode` NI `notFoundMessage`: `settings` no tiene `get` (CA-20). Publicar
  // `settings.get` responde `unknown_command` porque el patrón no está en el registro.
};

/** Las seis claves del contrato, en el orden de la lista blanca. Lo usa el test y la documentación. */
export const SETTINGS_WHITELIST = WHITELIST_DB_KEYS.map((key) => KEY_TO_CONTRACT[key] ?? key);

export default settingsSpec;
