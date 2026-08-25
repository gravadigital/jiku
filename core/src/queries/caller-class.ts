import { CallerClass } from './types';

/**
 * LA CLASE DEL CALLER: "¿qué le recorto?".
 *
 * ES LA SEGUNDA COMPUERTA DEL PLANO DE CONSULTAS, y está separada de `ROLE_METHODS` a propósito.
 * Ese mapa responde "¿puede ejecutar este método?" y devuelve un permiso; este responde "¿qué le
 * recorto?" y devuelve una CLASE. Son dos preguntas, y fusionarlas —o derivar esta tabla de
 * aquella— haría que un cambio de permisos moviera en silencio un recorte de datos.
 *
 * POR QUÉ LA PRECEDENCIA ES ESTA. Un caller puede traer varios roles y las clases NO se suman:
 * hay que elegir una, y la elección correcta es la MÁS RESTRICTIVA (CA-3). Alguien con
 * `['user','external-user']` es una persona externa a la que además se le dio un rol interno; si
 * ganara `internal`, el rol de menor privilegio serviría para AMPLIAR el acceso, que es
 * exactamente al revés de cómo tiene que fallar una compuerta.
 *
 * `admin` Y `user` SON LA MISMA CLASE, y no es un olvido: en la v1 el modo interno no recorta
 * NADA a nivel de fila (RF-23, CA-15). La autorización fina por rol —qué puede ver un `user` que
 * no puede ver otro— sigue siendo de la api sobre HTTP, que es donde viven las reglas de negocio.
 * Distinguirlos acá sería mover esas reglas a core sin traer las reglas.
 *
 * `core` Y `bus-observer` NO ESTÁN EN LA TABLA, y el instinto va a ser "completarla". No tienen
 * clase porque NO CONSULTAN (`queries: []` en `ROLE_METHODS`), y dejarlos afuera es la forma de
 * decirlo: agregarlos con una clase les daría un recorte a callers que nunca llegan hasta acá, y
 * el día que alguno consultara heredaría el acceso sin decisión. (`external-publisher` estaba en
 * esta misma lista y ya no: el rol se eliminó del producto.)
 *
 * LA COMPUERTA 1 YA NO ENSOMBRECE A ESTA PARA LOS CONECTORES, y ese día llegó: `internal-app`
 * pasó a tener `queries: ALL`, así que una identidad con ese rol atraviesa la compuerta 1 y
 * ATERRIZA ACÁ, en la clase `connector` — la que NO RECORTA NINGUNA FILA. Es la consecuencia
 * central de haberlo convertido en el único rol de conector: cualquier identidad `internal-app`
 * lee los 16 recursos completos, sin el recorte del modo externo.
 *
 * Los roles con `queries: ALL` son ahora CUATRO —`internal-app`, `admin`, `user` y
 * `external-user`— y los cuatro TIENEN clase. Cualquier otro rol —y la lista vacía, y un rol
 * inventado— sigue cortado antes por `authorizeWithRoles` con `caller_not_authorized`, así que
 * `resolveCallerClass` nunca llega a devolverles `null`. Los caminos que producen
 * `unknown_caller` son dos: el `CORE_TRUSTED_PUBLISHER_ID` que pasa la compuerta 1 por exención y
 * llega sin roles utilizables (CA-8: la api perdió su fila), y una identidad `internal-app` cuya
 * fila todavía no existe.
 *
 * SIN CACHE Y SIN ESTADO (CA-17): es una función pura sobre una tabla congelada, y hay un gate en
 * los tests que lo verifica leyendo este archivo.
 */

/**
 * EL ORDEN ES LA PRECEDENCIA: gana la PRIMERA clase que alguno de los roles produzca.
 *
 * Se recorre ESTA lista y no los `roles` del caller, y esa inversión es literalmente CA-3: el
 * orden en que Zitadel devuelva el array no puede decidir cuánto ve una persona.
 */
const PRECEDENCE: readonly CallerClass[] = ['external', 'internal', 'connector'];

/** El mapa rol → clase. CERRADO (ADR-008): un rol ausente no produce clase. */
export const CLASS_BY_ROLE: Readonly<Record<string, CallerClass>> = {
  'external-user': 'external',
  user: 'internal',
  admin: 'internal',
  'internal-app': 'connector',
};

/**
 * La clase del caller a partir de sus roles, o `null` si ninguno produce clase.
 *
 * `null` y NO una clase por defecto: sin clase no hay consulta, y el despachador responde
 * `unknown_caller`. Devolver `'external'` como "el más seguro" sería peor —le daría acceso a los
 * proyectos permitidos de una identidad que no se pudo resolver— y devolver `'internal'` sería un
 * fallo abierto.
 */
export function resolveCallerClass(roles: readonly string[]): CallerClass | null {
  const classes = new Set(roles.map((role) => CLASS_BY_ROLE[role]).filter(Boolean));
  return PRECEDENCE.find((candidate) => classes.has(candidate)) ?? null;
}

export default resolveCallerClass;
