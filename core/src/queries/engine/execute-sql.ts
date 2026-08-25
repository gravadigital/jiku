import { QueryTypes } from 'sequelize';
import { ErrorCode, Reply, failure } from '@jiku/nats-protocol';
import logger from '../../logger';
import { QueryContext } from '../types';
import { SqlPlan } from './types';

/**
 * La capa fina que ejecuta el SQL y traduce los errores de PostgreSQL al catálogo del contrato.
 *
 * Lo que importa es una sola cosa: cuando la base corta por `statement_timeout` (8000 ms), el
 * motor responde `query_timeout` —no un `internal_error` genérico y, sobre todo, no un timeout
 * mudo del bus—. La invariante que lo sostiene es
 * `POSTGRESQL_STATEMENT_TIMEOUT_MS (8000) < NATS_QUERY_TIMEOUT_MS (10000)`: la base corta
 * primero, el motor lo cuenta, y el caller recibe una respuesta que explica qué pasó.
 *
 * NO SE INVENTA UN TIMEOUT PROPIO EN JAVASCRIPT: un tercer timeout complicaría la invariante sin
 * agregar nada, y sería el que más fácil se desalinea de los otros dos.
 *
 * NO IMPORTA `readDb` NI `@jiku/models`: la conexión llega por el contexto, que es lo que permite
 * testear el módulo con otra conexión y lo que mantiene a `queries/` sin referencia al ORM.
 */

/**
 * `query_canceled` de PostgreSQL. Es el código que emite `statement_timeout`.
 *
 * LA DETECCIÓN ES POR CÓDIGO, NUNCA POR EL TEXTO DEL MENSAJE: el texto cambia con la versión y
 * con el locale del server, y un `includes('timeout')` fallaría en silencio en el peor momento.
 */
const PG_QUERY_CANCELED = '57014';

/**
 * Sequelize envuelve el error del driver, y NO SIEMPRE EN LA MISMA PROPIEDAD: según el tipo de
 * error expone `parent`, `original`, o las dos apuntando al mismo objeto. Se chequean las dos
 * porque quedarse con una deja el `query_timeout` sin emisor en la mitad de los casos.
 */
function isStatementTimeout(error: any): boolean {
  const code = error?.parent?.code ?? error?.original?.code;
  return String(code) === PG_QUERY_CANCELED;
}

/**
 * Ejecuta un SELECT sobre la conexión del contexto y devuelve las filas tipadas.
 *
 * Devuelve `{ rows }` o `{ error }`: un timeout de base es un valor de retorno, no una excepción
 * (convención `error-handling`). Cualquier OTRO error de base se propaga al `catch` del
 * despachador, que responde `internal_error` — no se traga acá lo que no se sabe traducir.
 */
export async function selectRows<Row extends object>(
  ctx: QueryContext,
  plan: SqlPlan,
  label: string
): Promise<{ rows: Row[] } | { error: Reply<never> }> {
  try {
    const rows = await ctx.db.query<Row>(plan.sql, {
      type: QueryTypes.SELECT,
      replacements: plan.replacements,
    });
    return { rows };
  } catch (error: any) {
    if (isStatementTimeout(error)) {
      // EL DETALLE VA AL LOG y el mensaje que cruza el bus es genérico: `error.message` de
      // Sequelize trae el SQL completo, que lleva nombres de columna de la base.
      logger.error(`[query] ${label}: statement_timeout de PostgreSQL`);
      return {
        error: failure(
          ErrorCode.QUERY_TIMEOUT,
          'La consulta tardó demasiado y la base la canceló. Acotá el filtro o pedí menos items ' +
            'por página'
        ),
      };
    }
    throw error;
  }
}
