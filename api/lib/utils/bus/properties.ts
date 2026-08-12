/**
 * `keyValuePairs` (contrato HTTP) -> `properties` (contrato del bus).
 *
 * La web manda un objeto plano, porque su contrato no cambia:
 *
 *   { documentacion: 'https://...' }
 *
 * y el protocolo del bus define una lista de pares:
 *
 *   [{ code: 'documentacion', value: 'https://...' }]
 *
 * Core hace la conversión inversa al escribir, porque la columna sigue llamándose
 * `key_value_pairs`. Es el precio de renombrar en el bus sin tocar ni la base ni los
 * fronts.
 */

export interface Property {
  code: string;
  value: string | null;
}

export function keyValuePairsToProperties(
  pairs: Record<string, string | null> | undefined | null
): Property[] | undefined {
  if (!pairs) {
    return undefined;
  }
  return Object.entries(pairs).map(([code, value]) => ({ code, value: value ?? null }));
}
