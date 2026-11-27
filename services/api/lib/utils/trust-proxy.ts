/**
 * Valor de `app.set('trust proxy', …)` desde `API_TRUST_PROXY` (DD-11).
 *   ausente / en blanco -> undefined (no se setea: default de Express, sin proxy)
 *   '1', '2'…           -> número de saltos (Number). El string '1' Express lo leería como IP.
 *   'true' | 'false'    -> booleano
 *   otro                -> string tal cual (lista de IP/subredes, 'loopback', 'uniquelocal'…)
 */
export function parseTrustProxy(raw: string | undefined): boolean | number | string | undefined {
  const value = (raw ?? '').trim();
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}
