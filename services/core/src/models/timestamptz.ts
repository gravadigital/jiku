import { Sequelize } from 'sequelize-typescript';

/**
 * `timestamptz` → string ISO, SIN pasar por `Date`, para la conexión de LECTURA.
 *
 * POR QUÉ: Sequelize convierte cada `timestamptz` en un `Date` (`new Date(texto)`), y la respuesta
 * del bus lo vuelve a string con `toJSON()` —dos veces, porque `paginate` mide cada item
 * serializándolo—. Crear y serializar objetos `Date` es la parte más cara del parseo de filas en
 * las páginas grandes: medido en local con las sentencias reales, 7,17 → 5,41 ms en la página de 200
 * tasks, 3,58 → 2,08 ms en la de 200 horas.
 *
 * LA SALIDA ES LA MISMA, BYTE A BYTE: el string que devuelve es exactamente el que produce
 * `Date#toJSON()` —`YYYY-MM-DDTHH:mm:ss.sssZ`, milisegundos TRUNCADOS como hace V8 con los
 * microsegundos de PostgreSQL—. El cursor (`engine/cursor.ts`) ya normalizaba un `Date` a ese
 * mismo ISO, así que sus claves tampoco cambian.
 *
 * DEPENDE DE QUE LA SESIÓN ESTÉ EN UTC, que es el default de Sequelize (`timezone: '+00:00'`,
 * que emite `SET TIME ZONE` en cada conexión): el texto llega como `2026-08-07 12:50:50.66+00`.
 * Cualquier otra forma (otro offset, año de más de cuatro dígitos, BC) cae al camino de siempre,
 * `new Date(texto).toJSON()`, así que un formato inesperado cuesta lo de antes y nunca cambia la
 * salida.
 *
 * `infinity` / `-infinity` se devuelven como los devolvía Sequelize (`Infinity` / `-Infinity`), que
 * es lo que el JSON ya serializaba (`null`).
 */

const UTC_TEXT = /^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?\+00(?::00)?$/;

export function timestamptzToIso(text: string): string | number {
  if (text === 'infinity') {
    return Infinity;
  }
  if (text === '-infinity') {
    return -Infinity;
  }
  const match = UTC_TEXT.exec(text);
  if (!match) {
    return new Date(text).toJSON();
  }
  const millis = ((match[3] ?? '') + '000').slice(0, 3);
  return `${match[1]}T${match[2]}.${millis}Z`;
}

/** OID de `timestamptz` en PostgreSQL. Fijo desde siempre: es un tipo del catálogo base. */
const TIMESTAMPTZ_OID = 1184;

/**
 * Instala el parser en UNA instancia de Sequelize, sin tocar las demás.
 *
 * USA API INTERNA DE SEQUELIZE (v6): el connection manager de postgres guarda los parsers por OID
 * en `oidParserMap` y lo repuebla con `_refreshTypeParser` —en el constructor y cada vez que
 * refresca los OIDs dinámicos al conectar—. Se envuelve ese método para que el parser propio quede
 * siempre encima. Si una versión futura cambia esos nombres, esta función LANZA al arrancar en vez
 * de degradar en silencio al parseo con `Date` (que seguiría siendo correcto, solo más lento): el
 * test de `timestamptz.test.ts` lo cubre contra la base real.
 */
export function installIsoTimestamptzParser(db: Sequelize): void {
  const manager = (db as unknown as { connectionManager: Record<string, any> }).connectionManager;
  if (!(manager.oidParserMap instanceof Map) || typeof manager._refreshTypeParser !== 'function') {
    throw new Error(
      '[db] installIsoTimestamptzParser: la API interna de Sequelize cambió (oidParserMap / ' +
        '_refreshTypeParser)'
    );
  }
  const apply = (): void => {
    manager.oidParserMap.set(TIMESTAMPTZ_OID, timestamptzToIso);
  };
  const refresh = manager._refreshTypeParser.bind(manager);
  manager._refreshTypeParser = (dataType: unknown) => {
    refresh(dataType);
    apply();
  };
  apply();
}
