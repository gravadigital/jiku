import { createHash } from 'crypto';
import { Sequelize } from 'sequelize-typescript';

/**
 * Sentencias preparadas CON NOMBRE para las consultas parametrizadas de una conexión.
 *
 * POR QUÉ: `pg` manda una consulta parametrizada como sentencia SIN nombre, que PostgreSQL
 * planifica en cada ejecución. Con nombre, la sentencia queda preparada en la sesión y PostgreSQL
 * puede reusar su plan (con `plan_cache_mode = auto`, el default: pasa a un plan genérico solo si no
 * es peor que los que viene armando). Medido en local, dentro de core: worked-times.list por persona
 * con sus relaciones 4,43 → 1,78 ms; tasks.list por proyecto 0,92 → 0,65 ms.
 *
 * SE ENGANCHA EN `afterConnect`, envolviendo el `query` del cliente `pg` de CADA conexión nueva de
 * esta instancia: es el punto donde Sequelize (`Query.run`) llama a `connection.query(sql, valores,
 * callback)`. Todo lo de arriba —`db.query`, sus hooks, los stubs de los tests— queda igual.
 *
 * - Solo lo parametrizado (con valores): el resto no tiene plan que reusar entre requests.
 * - El nombre es un hash del texto: el mismo texto es la misma sentencia en cualquier conexión.
 * - Tope por conexión (`MAX_PER_CONNECTION`): pasado, las sentencias nuevas van sin nombre. Las
 *   combinaciones de filtro y orden son finitas, pero el tope evita que la memoria de la sesión
 *   crezca sin cota.
 * - Si PostgreSQL invalida una sentencia preparada (`0A000`, "cached plan must not change result
 *   type", tras un cambio de esquema; o `26000`, la sesión la perdió), se reintenta UNA vez sin
 *   nombre y se olvida el nombre en esa conexión. El caller no ve el error. EXCEPTO dentro de una
 *   transacción: ahí el fallo ya la abortó y el reintento falla igual. El plano de consultas no
 *   abre transacciones (RF-9), y este módulo solo se instala en su conexión.
 */

const MAX_PER_CONNECTION = 500;
const RETRY_CODES = new Set(['0A000', '26000']);

type Callback = (error: any, result?: any) => void;

function statementName(text: string): string {
  return 'jq_' + createHash('sha1').update(text).digest('base64url').slice(0, 24);
}

export function installNamedStatements(db: Sequelize): void {
  db.addHook('afterConnect', (connection: any) => {
    const original = connection.query.bind(connection);
    const named = new Set<string>();

    connection.query = (config: unknown, values?: unknown, callback?: unknown): unknown => {
      const parameterized =
        typeof config === 'string' &&
        Array.isArray(values) &&
        values.length > 0 &&
        typeof callback === 'function';
      if (!parameterized) {
        return original(config, values, callback);
      }
      const text = config as string;
      const done = callback as Callback;
      const name = statementName(text);
      if (!named.has(name) && named.size >= MAX_PER_CONNECTION) {
        return original(text, values, done);
      }
      named.add(name);
      return original({ name, text, values }, (error: any, result: any) => {
        if (error && RETRY_CODES.has(error.code)) {
          named.delete(name);
          // `pg` recuerda qué nombres ya parseó en esta conexión: sin olvidarlo, el reintento con
          // el mismo nombre no volvería a preparar la sentencia.
          if (connection.connection?.parsedStatements) {
            delete connection.connection.parsedStatements[name];
          }
          original(`DEALLOCATE ${name}`, () => original(text, values, done));
          return;
        }
        done(error, result);
      });
    };
  });
}
