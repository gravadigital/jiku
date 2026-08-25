import { createHash } from 'node:crypto';
import { ErrorCode, Reply, failure } from '@jiku/nats-protocol';
import { CursorScope } from './types';

/**
 * El cursor keyset: opaco, atado a SU consulta, y sin ninguna autoridad.
 *
 * Forma: `base64url({ "v": 1, "k": [<claves de orden…>, <id>], "h": <hash(filter+sort)> })`.
 *
 * NO TRANSPORTA IDENTIDAD ni un conjunto de resultados congelado (CA-18): identidad y filtros se
 * REAPLICAN en cada página. Un cursor robado no da acceso a nada que el caller no pudiera pedir
 * igual, y una fila que dejó de matchear el filtro entre página y página no aparece.
 */

/** Versión del formato. Un cursor de otra `v` se rechaza: su `k` puede significar otra cosa. */
export const CURSOR_VERSION = 1;

/** Largo del hash en hex. Es un DETECTOR DE CAMBIO, no un secreto: no hay nada que proteger. */
const FINGERPRINT_LENGTH = 16;

interface CursorBody {
  v: number;
  k: unknown[];
  h: string;
}

/**
 * Normaliza un valor para que el hash dependa del SIGNIFICADO del filtro y no de cómo se escribió.
 *
 * Sin esto, un caller que reordene las claves del mismo filtro recibiría `invalid_cursor` sin
 * haber cambiado nada (CA-17). Claves de objeto en orden alfabético en TODOS los niveles, listas
 * ordenadas de forma estable —`state: ['a','b']` y `state: ['b','a']` son el mismo `IN`—, y
 * `undefined` omitido.
 */
export function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Se ordena por la serialización de cada elemento: es estable, no depende del tipo, y no
    // necesita comparar mezclas de números con strings.
    return value
      .map((item) => normalizeForHash(item))
      .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] !== undefined) {
        out[key] = normalizeForHash(source[key]);
      }
    }
    return out;
  }
  return value;
}

/**
 * La huella de la consulta a la que pertenece el cursor.
 *
 * EL `limit` NO ENTRA, Y ES UN REQUISITO, NO UN OLVIDO (CA-17): cambiar solo el tamaño de página
 * entre páginas es válido y frecuente. Si alguien lo "arregla" agregándolo, TS-31 se pone en rojo.
 *
 * El `sort` NO se reordena —su orden ES el criterio—, a diferencia de las listas del filtro.
 */
export function fingerprint(scope: CursorScope): string {
  const payload = JSON.stringify({
    filter: normalizeForHash(scope.filter ?? {}),
    sort: scope.sort,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, FINGERPRINT_LENGTH);
}

/** Los `Date` viajan como ISO para que el JSON del cursor sea determinístico. */
function serializeKey(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

export function encodeCursor(keys: readonly unknown[], scope: CursorScope): string {
  const body: CursorBody = {
    v: CURSOR_VERSION,
    k: keys.map(serializeKey),
    h: fingerprint(scope),
  };
  return Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
}

/** El error del decodificador. Nunca lleva el cursor recibido: es dato del caller, no del error. */
function invalidCursor(): { error: Reply<never> } {
  return {
    error: failure(
      ErrorCode.INVALID_CURSOR,
      'El cursor no es válido para esta consulta: se obtiene de la respuesta anterior y hay que ' +
        'reusarlo con el mismo filtro y el mismo orden'
    ),
  };
}

/**
 * Decodifica y VERIFICA que el cursor corresponde a ESTA consulta.
 *
 * Devuelve un resultado tipado y NUNCA LANZA: es la misma forma que `validate()` y por la misma
 * razón —un cursor basura es una entrada inválida del caller, no una falla del servicio, y tiene
 * que responder `invalid_cursor` y no `internal_error`.
 *
 * `expectedKeys` es la cantidad de criterios del `ORDER BY`: un `k` de otro largo no puede
 * alimentar el predicado keyset.
 */
export function decodeCursor(
  cursor: string,
  scope: CursorScope,
  expectedKeys: number
): { keys: unknown[] } | { error: Reply<never> } {
  let body: CursorBody;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    body = JSON.parse(json) as CursorBody;
  } catch {
    return invalidCursor();
  }

  if (!body || typeof body !== 'object') {
    return invalidCursor();
  }
  if (body.v !== CURSOR_VERSION) {
    return invalidCursor();
  }
  if (!Array.isArray(body.k) || body.k.length !== expectedKeys) {
    return invalidCursor();
  }
  if (typeof body.h !== 'string' || body.h !== fingerprint(scope)) {
    return invalidCursor();
  }

  return { keys: body.k };
}
