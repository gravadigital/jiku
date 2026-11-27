import joi from 'joi';

/**
 * Arma el `filter` de jiku-docs solo con las claves que vinieron: ni `undefined` ni `null`
 * (el contrato tiene `additionalProperties: false` y un `null` no es un valor válido).
 * `rename` permite que el nombre del query param difiera del de la clave del filtro.
 */
export function pickDefined(
  source: Record<string, any>,
  keys: string[],
  rename: Record<string, string> = {}
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) {
      out[rename[key] ?? key] = source[key];
    }
  }
  return out;
}

/** `page` de jiku-docs: `cursor` solo si vino. */
export function buildPage(query: { limit: number; cursor?: string }): { limit: number; cursor?: string } {
  return query.cursor === undefined ? { limit: query.limit } : { limit: query.limit, cursor: query.cursor };
}

/** Parámetros de paginación comunes (Joi). `limit` máximo efectivo 200 en jiku-docs. */
export const PAGE_LIMIT_MAX = 200;

/** Tope de ids/valores en las listas de `projectId`, `clientId` y `topic` de la query. */
export const DOCS_FILTER_LIST_MAX = 20;
/** Tope de personas en el filtro `person`. */
export const DOCS_PERSON_MAX = 10;
/** `maxItems` de `IntOrList` en jiku-docs: tope de "mis proyectos activos". */
export const MY_ACTIVE_PROJECTS_MAX = 200;

/**
 * Campos del portal (REQ-021, decisión 12): sin `path`, `folderId` ni `fileName`. `visibility`
 * TIENE que estar: sin ella el chequeo DD-3 falla cerrado y todo responde 404.
 */
export const PORTAL_DOC_FIELDS = ['id', 'title', 'version', 'visibility', 'createdAt', 'updatedAt'];

/** Entero positivo, o lista de enteros (parámetro repetido). `.single()` normaliza siempre a array. */
export const joiIntList = (max: number = DOCS_FILTER_LIST_MAX) =>
  joi.array().items(joi.number().integer().positive()).single().max(max);

/** String (1..500) o lista de strings. */
export const joiStrList = (max: number = DOCS_FILTER_LIST_MAX) =>
  joi.array().items(joi.string().min(1).max(500)).single().max(max);

const SIMPLE_FILTER_KEYS = [
  'projectId', 'requirementId', 'taskId', 'clientId', 'folderId', 'pathPrefix', 'topic',
  'hasProject', 'hasClient', 'hasTopic', 'visibility',
];

/**
 * Traduce los query params ya validados al `DocumentsFilter` de jiku-docs (listado y búsqueda se
 * traducen igual). Solo las claves presentes. `person` se arma como `or` de `createdBy` /
 * `updatedBy` con el mismo array: "creado por o último editor" (el contrato no filtra por autor
 * de cualquier versión).
 */
export function buildDocumentsFilter(query: Record<string, any>): Record<string, unknown> {
  const filter = pickDefined(query, SIMPLE_FILTER_KEYS);
  if (Array.isArray(query.person) && query.person.length > 0) {
    filter.or = [{ createdBy: query.person }, { updatedBy: query.person }];
  }
  return filter;
}
