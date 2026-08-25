import joi from 'joi';
import { ErrorCode, Reply, failure } from '@jiku/nats-protocol';
import { FilterableSpec, ResourceSpec } from '../types';
import {
  FilterCondition,
  FilterGroup,
  ParsedFilter,
  RANGE_KEYS,
  RangeKey,
  SortCriterion,
  ValidatedGetQuery,
  ValidatedListQuery,
} from './types';

/**
 * El validador de la gramática CONTRA LA FICHA.
 *
 * Es la compuerta que hace que UN NOMBRE NO DECLARADO NO LLEGUE NUNCA AL SQL: la mitigación de
 * inyección de este motor es estructural (CA-29), y esta es su mitad. La otra mitad es que los
 * valores viajan siempre como `replacements`.
 *
 * NUNCA SE IGNORA EN SILENCIO un nombre desconocido, y no es cosmético: un filtro ignorado
 * devuelve DATOS DE MÁS, que es el peor modo de falla de un contrato de lectura.
 *
 * NO TOCA LA BASE (convención `validation`): solo forma y listas blancas.
 */

/** Default de `page.limit` cuando no viene o viene en `0`. */
export const DEFAULT_PAGE_LIMIT = 50;
/** Tope de `page.limit`. Un pedido mayor SE RECORTA SIN AVISAR: es `success`, no un `failure`. */
export const MAX_PAGE_LIMIT = 200;

/** Las palancas que acepta un `list`. Cualquier otra clave de primer nivel se rechaza. */
const LIST_KEYS = ['filter', 'sort', 'page', 'fields', 'include', 'count'];
/** Las palancas que acepta un `get`. `filter`, `sort`, `page` y `count` NO aplican (RF-3). */
const GET_KEYS = ['id', 'fields', 'include'];
/** Las cuatro palancas de `list` que en un `get` son un error, no un extra ignorable. */
const GET_FORBIDDEN_KEYS = ['filter', 'sort', 'page', 'count'];

/**
 * Nombres de identidad que el payload NO PUEDE llevar.
 *
 * LISTA CERRADA Y EXPLÍCITA. La identidad sale del SEGUNDO TOKEN DEL SUBJECT y solo de ahí
 * (RF-19): el auth-callout solo autoriza a publicar bajo el id propio, así que ese token es
 * infalsificable y el cuerpo no lo es. Un campo de identidad IGNORADO sería peor que rechazado:
 * sugeriría que el caller puede preguntar en nombre de otro y que el servicio simplemente no lo
 * escuchó esta vez.
 */
const IDENTITY_PAYLOAD_FIELDS = [
  'userId',
  'user_id',
  'user',
  'caller',
  'callerId',
  'caller_id',
  'sub',
  'identity',
  'actor',
  'principal',
  'onBehalfOf',
];

/** Las claves de operador que acepta un objeto de filtro. */
const OPERATOR_KEYS: readonly string[] = ['not', ...RANGE_KEYS];

type Invalid = { error: Reply<never> };
type Valid<T> = { value: T };

function invalid(message: string, details: Record<string, unknown>): Invalid {
  return { error: failure(ErrorCode.INVALID_FIELDS, message, details) };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** La forma EXTERIOR de un `list`. Joi decide tipos; los nombres los decide la ficha. */
const listShape = joi.object({
  filter: joi.object().optional(),
  sort: joi.array().items(joi.string()).optional(),
  page: joi.object().optional(),
  fields: joi.array().items(joi.string()).optional(),
  include: joi.array().items(joi.string()).optional(),
  // `count` se valida a mano: sus tres valores tienen tipos distintos y el rechazo necesita
  // decir cuál era el valor ofensor, que el mensaje por defecto de Joi no da.
  count: joi.any().optional(),
});

/** La forma EXTERIOR de un `get`. */
const getShape = joi.object({
  id: joi.any().optional(),
  fields: joi.array().items(joi.string()).optional(),
  include: joi.array().items(joi.string()).optional(),
});

/**
 * Rechaza las claves de identidad y las claves que el método no declara.
 *
 * Va ANTES de Joi: Joi rechazaría `userId` como clave desconocida, pero con un mensaje que no
 * distingue "inventaste un nombre" de "quisiste decir quién sos", y son dos cosas distintas.
 */
function checkTopLevelKeys(payload: Record<string, unknown>, allowed: string[]): Invalid | null {
  for (const key of Object.keys(payload)) {
    if (IDENTITY_PAYLOAD_FIELDS.includes(key)) {
      return invalid(
        `El campo "${key}" no se acepta: quién pregunta sale del subject, no del cuerpo`,
        { field: 'payload', value: key }
      );
    }
  }
  for (const key of Object.keys(payload)) {
    if (!allowed.includes(key)) {
      return invalid(`El campo "${key}" no existe en esta consulta`, {
        field: 'payload',
        value: key,
        allowed,
      });
    }
  }
  return null;
}

/** Traduce un error de forma de Joi a `invalid_fields`. La forma exterior no necesita detalle. */
function checkShape(schema: joi.Schema, payload: unknown): Invalid | null {
  const result = schema.validate(payload, { convert: true, abortEarly: true });
  if (result.error) {
    return invalid(`La forma de la consulta no es válida: ${result.error.message}`, {
      field: 'payload',
    });
  }
  return null;
}

/* ---------------------------------------------------------------------------------------------
 * Valores
 * ------------------------------------------------------------------------------------------- */

/**
 * Valida UN valor escalar contra el tipo que declara la ficha y lo traduce a valor de base.
 *
 * Devuelve una LISTA porque una traducción puede expandir: `priority: 'urgente'` matchea el 4 Y
 * el 5, porque los dos se LEEN `urgente`. Sin la expansión, el filtro mentiría respecto de lo que
 * la proyección muestra.
 */
function coerceValue(
  spec: FilterableSpec,
  field: string,
  raw: unknown,
  enums: ResourceSpec['enums']
): { values: unknown[] } | Invalid {
  if (raw === null || raw === undefined) {
    return invalid(`El filtro "${field}" no acepta un valor vacío en esta posición`, {
      field: `filter.${field}`,
      value: raw,
    });
  }

  if (spec.enum) {
    const allowed = enums[spec.enum] ?? [];
    if (typeof raw !== 'string' || !allowed.includes(raw)) {
      return invalid(`El filtro "${field}" no acepta ese valor`, {
        field: `filter.${field}`,
        value: raw,
        allowed,
      });
    }
    const mapped = spec.values ? spec.values[raw] : undefined;
    return { values: mapped ? [...mapped] : [raw] };
  }

  switch (spec.kind) {
  case 'integer': {
    const numeric = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
    if (typeof numeric !== 'number' || !Number.isInteger(numeric)) {
      return invalid(`El filtro "${field}" espera un número entero`, {
        field: `filter.${field}`,
        value: raw,
      });
    }
    return { values: [numeric] };
  }
  case 'date': {
    // Se deja pasar el string tal cual: PostgreSQL lo castea contra la columna, y convertirlo a
    // `Date` acá perdería la precisión que el caller escribió.
    if (typeof raw !== 'string' && typeof raw !== 'number' && !(raw instanceof Date)) {
      return invalid(`El filtro "${field}" espera una fecha`, {
        field: `filter.${field}`,
        value: raw,
      });
    }
    if (Number.isNaN(new Date(raw as any).getTime())) {
      return invalid(`El filtro "${field}" espera una fecha válida`, {
        field: `filter.${field}`,
        value: raw,
      });
    }
    return { values: [raw] };
  }
  case 'boolean': {
    if (typeof raw !== 'boolean') {
      return invalid(`El filtro "${field}" espera un booleano`, {
        field: `filter.${field}`,
        value: raw,
      });
    }
    return { values: [raw] };
  }
  default: {
    if (typeof raw !== 'string' && typeof raw !== 'number') {
      return invalid(`El filtro "${field}" espera un valor simple`, {
        field: `filter.${field}`,
        value: raw,
      });
    }
    return { values: [raw] };
  }
  }
}

function coerceList(
  spec: FilterableSpec,
  field: string,
  raw: readonly unknown[],
  enums: ResourceSpec['enums']
): { values: unknown[] } | Invalid {
  const values: unknown[] = [];
  for (const item of raw) {
    const coerced = coerceValue(spec, field, item, enums);
    if ('error' in coerced) {
      return coerced;
    }
    values.push(...coerced.values);
  }
  return { values };
}

/* ---------------------------------------------------------------------------------------------
 * Filtro
 * ------------------------------------------------------------------------------------------- */

/** Decide el operador POR LA FORMA DEL VALOR, que es la gramática del contrato. */
function parseCondition(
  resource: ResourceSpec,
  field: string,
  raw: unknown
): { condition: FilterCondition } | Invalid {
  const spec = resource.filterable[field];

  // Búsqueda libre: la única forma que acepta es un string.
  if (spec.search) {
    if (typeof raw !== 'string') {
      return invalid(`El filtro "${field}" espera un texto`, {
        field: `filter.${field}`,
        value: raw,
      });
    }
    return { condition: { field, spec, operator: { op: 'search', text: raw } } };
  }

  if (raw === null) {
    return { condition: { field, spec, operator: { op: 'isNull' } } };
  }

  if (Array.isArray(raw)) {
    const coerced = coerceList(spec, field, raw, resource.enums);
    if ('error' in coerced) {
      return coerced;
    }
    return { condition: { field, spec, operator: { op: 'eq', values: coerced.values } } };
  }

  if (isPlainObject(raw)) {
    const keys = Object.keys(raw);
    for (const key of keys) {
      if (!OPERATOR_KEYS.includes(key)) {
        return invalid(`El filtro "${field}" no conoce el operador "${key}"`, {
          field: `filter.${field}`,
          value: key,
          allowed: OPERATOR_KEYS,
        });
      }
    }
    if (keys.length === 0) {
      return invalid(`El filtro "${field}" está vacío`, { field: `filter.${field}`, value: raw });
    }

    if (keys.includes('not')) {
      // `not` no se combina con los comparadores de rango: no hay una lectura obvia de
      // `{not: 5, gte: 3}`, y adivinarla sería inventar gramática.
      if (keys.length > 1) {
        return invalid(`El filtro "${field}" no combina "not" con un rango`, {
          field: `filter.${field}`,
          value: keys,
          allowed: OPERATOR_KEYS,
        });
      }
      const rawNot = (raw as Record<string, unknown>).not;
      const coerced = Array.isArray(rawNot)
        ? coerceList(spec, field, rawNot, resource.enums)
        : coerceValue(spec, field, rawNot, resource.enums);
      if ('error' in coerced) {
        return coerced;
      }
      return { condition: { field, spec, operator: { op: 'not', values: coerced.values } } };
    }

    // Rango: los cuatro comparadores son COMBINABLES ENTRE SÍ (`{gt, lt}` es un intervalo).
    const bounds: Partial<Record<RangeKey, unknown>> = {};
    for (const key of keys as RangeKey[]) {
      const coerced = coerceValue(spec, field, (raw as Record<string, unknown>)[key], resource.enums);
      if ('error' in coerced) {
        return coerced;
      }
      if (coerced.values.length !== 1) {
        return invalid(`El filtro "${field}" no acepta varios valores en un rango`, {
          field: `filter.${field}`,
          value: key,
        });
      }
      bounds[key] = coerced.values[0];
    }
    return { condition: { field, spec, operator: { op: 'range', bounds } } };
  }

  const coerced = coerceValue(spec, field, raw, resource.enums);
  if ('error' in coerced) {
    return coerced;
  }
  return { condition: { field, spec, operator: { op: 'eq', values: coerced.values } } };
}

/** Un grupo de condiciones unidas con AND. `allowOr: false` es lo que corta el anidamiento. */
function parseGroup(
  resource: ResourceSpec,
  raw: Record<string, unknown>,
  allowOr: boolean
): { group: FilterGroup; or?: FilterGroup[] } | Invalid {
  const conditions: FilterCondition[] = [];
  let or: FilterGroup[] | undefined;

  for (const key of Object.keys(raw)) {
    if (key === 'or') {
      if (!allowOr) {
        // UN SOLO NIVEL (CA-4): un `or` adentro de un `or` no se traduce a un SQL que el keyset
        // pueda paginar sin sorpresas, y el contrato lo declara fuera de alcance.
        return invalid('El filtro "or" admite un solo nivel: no se puede anidar', {
          field: 'filter.or',
          value: 'or',
        });
      }
      const branches = raw.or;
      if (!Array.isArray(branches) || branches.length === 0) {
        return invalid('El filtro "or" espera una lista de condiciones', {
          field: 'filter.or',
          value: branches,
        });
      }
      or = [];
      for (const branch of branches) {
        if (!isPlainObject(branch)) {
          return invalid('Cada rama de "or" es un objeto de condiciones', {
            field: 'filter.or',
            value: branch,
          });
        }
        const parsed = parseGroup(resource, branch, false);
        if ('error' in parsed) {
          return parsed;
        }
        or.push(parsed.group);
      }
      continue;
    }

    if (IDENTITY_PAYLOAD_FIELDS.includes(key)) {
      return invalid(
        `El campo "${key}" no se acepta: quién pregunta sale del subject, no del cuerpo`,
        { field: 'filter', value: key }
      );
    }

    if (!Object.prototype.hasOwnProperty.call(resource.filterable, key)) {
      return invalid(`El filtro "${key}" no existe en este recurso`, {
        field: 'filter',
        value: key,
        // POR REFERENCIA: es LA MISMA lista que se acaba de consultar, no una copia.
        allowed: resource.filterableNames,
      });
    }

    const parsed = parseCondition(resource, key, raw[key]);
    if ('error' in parsed) {
      return parsed;
    }
    conditions.push(parsed.condition);
  }

  return { group: { conditions }, or };
}

function parseFilter(resource: ResourceSpec, raw: unknown): Valid<ParsedFilter> | Invalid {
  if (raw === undefined || raw === null) {
    return { value: { conditions: [] } };
  }
  if (!isPlainObject(raw)) {
    return invalid('El filtro espera un objeto', { field: 'filter', value: raw });
  }
  const parsed = parseGroup(resource, raw, true);
  if ('error' in parsed) {
    return parsed;
  }
  return { value: { conditions: parsed.group.conditions, or: parsed.or } };
}

/* ---------------------------------------------------------------------------------------------
 * Orden
 * ------------------------------------------------------------------------------------------- */

function parseSort(
  resource: ResourceSpec,
  raw: unknown
): { sort: SortCriterion[]; tokens: string[] } | Invalid {
  const tokens = Array.isArray(raw) && raw.length > 0 ? (raw as string[]) : [...resource.defaults.sort];
  const sort: SortCriterion[] = [];

  for (const token of tokens) {
    const dir: 'ASC' | 'DESC' = token.startsWith('-') ? 'DESC' : 'ASC';
    const field = token.startsWith('-') ? token.slice(1) : token;
    const spec = resource.sortable[field];
    if (!spec) {
      return invalid(`El campo "${field}" no es ordenable en este recurso`, {
        field: 'sort',
        value: field,
        // POR REFERENCIA, igual que en el filtro: `sortable` y `filterable` son listas
        // INDEPENDIENTES (`estimatedFinishDate` está en una y no en la otra).
        allowed: resource.sortableNames,
      });
    }
    if (sort.some((criterion) => criterion.field === field)) {
      return invalid(`El campo "${field}" aparece dos veces en el orden`, {
        field: 'sort',
        value: field,
      });
    }
    sort.push({ field, column: spec.column, dir, nullable: spec.nullable === true });
  }

  // EL DESEMPATE POR `id`, SE PIDA O NO (CA-5). Sin él, dos filas con el mismo `createdAt` pueden
  // salir en distinto orden entre dos ejecuciones, y el keyset se saltea o repite filas.
  //
  // LA DIRECCIÓN ES LA DEL ÚLTIMO CRITERIO, y no siempre ASC: los índices compuestos de S-021
  // llevan `(…, created_at DESC, id DESC)`, y un `id ASC` detrás de un `created_at DESC` NO usa
  // el índice — degrada a Sort, que es exactamente lo que el keyset existe para evitar.
  const lastDir = sort.length > 0 ? sort[sort.length - 1].dir : 'DESC';
  // `id` es la PK: nunca es NULL, y por eso el desempate siempre cierra la recursión.
  sort.push({ field: 'id', column: 'id', dir: lastDir, nullable: false });

  // Los tokens EFECTIVOS —ya con el default resuelto y el desempate agregado— son los que se
  // hashean en el cursor: dos requests con el mismo ORDER BY comparten cursor aunque una lo haya
  // escrito y la otra lo haya dejado en el default.
  const effective = sort.map((criterion) =>
    criterion.dir === 'DESC' ? `-${criterion.field}` : criterion.field
  );
  return { sort, tokens: effective };
}

/* ---------------------------------------------------------------------------------------------
 * Página, conjunto devuelto y count
 * ------------------------------------------------------------------------------------------- */

function parsePage(raw: unknown): { limit: number; cursor?: string } | Invalid {
  if (raw === undefined || raw === null) {
    return { limit: DEFAULT_PAGE_LIMIT };
  }
  if (!isPlainObject(raw)) {
    return invalid('La página espera un objeto', { field: 'page', value: raw });
  }
  for (const key of Object.keys(raw)) {
    if (key !== 'limit' && key !== 'cursor') {
      return invalid(`La página no acepta "${key}"`, {
        field: 'page',
        value: key,
        allowed: ['limit', 'cursor'],
      });
    }
  }

  let limit = DEFAULT_PAGE_LIMIT;
  const rawLimit = raw.limit;
  if (rawLimit !== undefined && rawLimit !== null) {
    const numeric =
      typeof rawLimit === 'string' && rawLimit.trim() !== '' ? Number(rawLimit) : rawLimit;
    if (typeof numeric !== 'number' || !Number.isInteger(numeric)) {
      return invalid('El límite de página espera un número entero', {
        field: 'page.limit',
        value: rawLimit,
      });
    }
    if (numeric < 0) {
      return invalid('El límite de página no puede ser negativo', {
        field: 'page.limit',
        value: numeric,
      });
    }
    // `0` SIGNIFICA "usá el default", no "no me traigas nada": una página vacía a pedido no le
    // sirve a nadie y la ausencia de `limit` ya cubre ese caso.
    // Un pedido MAYOR AL TOPE SE RECORTA SIN AVISAR: es `success`, y el valor efectivo viaja en
    // `page.limit` de la respuesta, que es donde el caller lo ve.
    limit = numeric === 0 ? DEFAULT_PAGE_LIMIT : Math.min(numeric, MAX_PAGE_LIMIT);
  }

  const rawCursor = raw.cursor;
  if (rawCursor === undefined || rawCursor === null) {
    return { limit };
  }
  if (typeof rawCursor !== 'string' || rawCursor === '') {
    return invalid('El cursor espera el texto que devolvió la página anterior', {
      field: 'page.cursor',
      value: rawCursor,
    });
  }
  return { limit, cursor: rawCursor };
}

/**
 * `conjunto devuelto = ( fields ?? base ) ∪ include ∪ { id }`.
 *
 * `id` SIEMPRE, aunque no se lo pida (RF-15): sin él la respuesta no se puede correlacionar con
 * nada, y el cursor de la página siguiente lo necesita igual.
 */
function parseProjection(
  resource: ResourceSpec,
  rawFields: unknown,
  rawInclude: unknown
): { fields: string[]; relations: string[] } | Invalid {
  const selected: string[] = [];

  if (Array.isArray(rawFields) && rawFields.length > 0) {
    for (const name of rawFields as string[]) {
      if (!resource.fieldNames.includes(name)) {
        return invalid(`El campo "${name}" no existe en este recurso`, {
          field: 'fields',
          value: name,
          allowed: resource.fieldNames,
        });
      }
      if (!selected.includes(name)) {
        selected.push(name);
      }
    }
  } else {
    selected.push(...resource.baseNames);
  }

  if (Array.isArray(rawInclude)) {
    for (const name of rawInclude as string[]) {
      if (!Object.prototype.hasOwnProperty.call(resource.includable, name)) {
        return invalid(`El campo "${name}" no se puede incluir en este recurso`, {
          field: 'include',
          value: name,
          allowed: resource.includableNames,
        });
      }
      if (!selected.includes(name)) {
        selected.push(name);
      }
    }
  }

  if (!selected.includes('id')) {
    selected.unshift('id');
  }

  const relations = selected.filter((name) => {
    const includable = resource.includable[name];
    return includable !== undefined && includable.kind === 'relation';
  });

  return { fields: selected, relations };
}

function parseCount(raw: unknown): { count: boolean | 'only' } | Invalid {
  if (raw === undefined || raw === null || raw === false) {
    return { count: false };
  }
  if (raw === true || raw === 'only') {
    return { count: raw };
  }
  return invalid('El conteo acepta false, true u "only"', {
    field: 'count',
    value: raw,
    allowed: [false, true, 'only'],
  });
}

/* ---------------------------------------------------------------------------------------------
 * Las dos formas
 * ------------------------------------------------------------------------------------------- */

export function validateList(
  resource: ResourceSpec,
  payload: unknown
): Valid<ValidatedListQuery> | Invalid {
  // Cuerpo vacío = `{}`: es lo que decodifica `bus/service.ts`, y un `list` sin palancas es una
  // consulta legítima.
  const raw = payload === undefined || payload === null ? {} : payload;
  if (!isPlainObject(raw)) {
    return invalid('La consulta espera un objeto', { field: 'payload', value: raw });
  }

  const keysError = checkTopLevelKeys(raw, LIST_KEYS);
  if (keysError) {
    return keysError;
  }
  const shapeError = checkShape(listShape, raw);
  if (shapeError) {
    return shapeError;
  }

  const filter = parseFilter(resource, raw.filter);
  if ('error' in filter) {
    return filter;
  }
  const sort = parseSort(resource, raw.sort);
  if ('error' in sort) {
    return sort;
  }
  const page = parsePage(raw.page);
  if ('error' in page) {
    return page;
  }
  const projection = parseProjection(resource, raw.fields, raw.include);
  if ('error' in projection) {
    return projection;
  }
  const count = parseCount(raw.count);
  if ('error' in count) {
    return count;
  }

  return {
    value: {
      kind: 'list',
      filter: filter.value,
      sort: sort.sort,
      limit: page.limit,
      ...(page.cursor ? { cursor: page.cursor } : {}),
      fields: projection.fields,
      relations: projection.relations,
      count: count.count,
      // El `filter` CRUDO —no el parseado— es lo que se hashea, normalizado. Es lo que hace que
      // reordenar las claves del mismo filtro no invalide el cursor (CA-17).
      scope: { filter: raw.filter ?? {}, sort: sort.tokens },
    },
  };
}

export function validateGet(
  resource: ResourceSpec,
  payload: unknown
): Valid<ValidatedGetQuery> | Invalid {
  const raw = payload === undefined || payload === null ? {} : payload;
  if (!isPlainObject(raw)) {
    return invalid('La consulta espera un objeto', { field: 'payload', value: raw });
  }

  for (const key of Object.keys(raw)) {
    if (IDENTITY_PAYLOAD_FIELDS.includes(key)) {
      return invalid(
        `El campo "${key}" no se acepta: quién pregunta sale del subject, no del cuerpo`,
        { field: 'payload', value: key }
      );
    }
  }

  // LAS CUATRO PALANCAS DE `list` SON UN ERROR EN UN `get`, no un extra que se ignora (RF-3): un
  // `get` pregunta por UN recurso identificado, y aceptar `filter` en silencio dejaría creer que
  // recortó algo.
  for (const key of GET_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      return invalid(`El campo "${key}" no aplica a una consulta por id`, {
        field: 'payload',
        value: key,
        allowed: GET_KEYS,
      });
    }
  }

  const keysError = checkTopLevelKeys(raw, GET_KEYS);
  if (keysError) {
    return keysError;
  }
  const shapeError = checkShape(getShape, raw);
  if (shapeError) {
    return shapeError;
  }

  const rawId = raw.id;
  const numericId = typeof rawId === 'string' && rawId.trim() !== '' ? Number(rawId) : rawId;
  if (typeof numericId !== 'number' || !Number.isInteger(numericId)) {
    return invalid('La consulta por id necesita un id entero', { field: 'id', value: rawId });
  }

  const projection = parseProjection(resource, raw.fields, raw.include);
  if ('error' in projection) {
    return projection;
  }

  return {
    value: {
      kind: 'get',
      id: numericId,
      fields: projection.fields,
      relations: projection.relations,
    },
  };
}
