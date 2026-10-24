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
