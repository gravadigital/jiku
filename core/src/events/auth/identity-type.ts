import { IdentityType } from '@jiku/models';

/**
 * De qué rol gana la regla del callout a qué clase de identidad es (v2 del evento de auth).
 *
 * POR QUÉ EXISTE: la v2 del evento **elimina `identity_type` del payload**. Hasta la v1 el campo
 * venía del `type:` de la regla de `rules.yaml`, o sea describía **lo que el YAML decía**; el
 * CHANGELOG del callout lo deroga con un argumento que conviene no perder: `matched_role` es un
 * HECHO leído del token —el rol que efectivamente decidió los permisos—, así que derivar de ahí es
 * MÁS fiable que el campo que reemplaza, no menos.
 *
 * LA COLUMNA SIGUE: `users.identity_type` no se va, y sigue separando a una persona de un service
 * user. Lo único que cambia es de dónde sale el valor.
 *
 * VIVE EN `events/auth/` Y NO EN `src/`, a diferencia de `user-mirror.ts` o `authorize-caller.ts`:
 * esto es del CONTRATO DEL EVENTO DE AUTENTICACIÓN y de nadie más. El plano de comandos escribe
 * `'person'` como literal (la api autentica un JWT de usuario final y nunca un machine user) y el
 * de consultas solo lee la columna. Un solo consumidor, un solo módulo, adentro de su carpeta —
 * el mismo criterio con el que `bus/actor.ts` se quedó en `bus/`.
 */

/**
 * Los roles de `rules.yaml` que identifican un SERVICIO y no una persona.
 *
 * SALE DE `deploy/nats/auth-callout/rules.yaml`, leyendo sus cinco reglas: `internal-app` (el
 * conector) y `core` son de servicio; `admin`, `user` y `external-user` son de producto. Es la
 * MISMA partición que `rules.yaml` expresaba con el `type:` que la v2 eliminó — no se inventa una
 * clasificación nueva, se lee la que ya estaba.
 *
 * EXPORTADO PARA EL TEST QUE LO CUENTA: si alguien agrega un rol de servicio a `rules.yaml` y se
 * olvida de esta lista, el rol nuevo se espejaría como `person`. El test es lo que lo recuerda,
 * igual que el gate de paridad de `ROLE_METHODS` contra `x-roles`.
 *
 * `as const` para que el tipo sea la unión de los dos literales y no `string[]`.
 */
export const SERVICE_ROLES = ['internal-app', 'core'] as const;

/** Lookup O(1) y, sobre todo, sin la trampa de `Array.includes` sobre un `as const`. */
const SERVICE_ROLE_SET: ReadonlySet<string> = new Set(SERVICE_ROLES);

/**
 * Clasifica la identidad del evento a partir del rol que ganó la regla.
 *
 * FALLA DEL LADO SEGURO: todo lo que no esté en `SERVICE_ROLES` es `person`, que es EXACTAMENTE el
 * default que el esquema Joi tenía en la v1 (`.default(IdentityType.Person)`). Un rol nuevo que
 * nadie agregue acá se comporta como se comportaba ayer.
 *
 * LA COMPARACIÓN ES EXACTA: sin `trim`, sin `toLowerCase`, sin prefijos. `Core` no es `core` y
 * `internal-app-2` no es `internal-app`. "Arreglar" la comparación es cómo un rol nuevo termina
 * clasificado mal sin que nada lo diga — el mismo criterio con el que `extractActor` compara las
 * dos identidades del sobre por identidad estricta.
 *
 * NO LANZA Y ACEPTA `undefined`: `matched_role` es uno de los campos que el esquema deja pasar por
 * `.unknown(true)` y que un emisor podría no mandar. Su ausencia no puede descartar un evento —
 * eso dejaría al producto sin espejo de identidad por un campo de clasificación.
 *
 * @param matchedRole el `matched_role` del evento: el `match` de la regla que ganó, o `'*'`
 */
export function identityTypeFromMatchedRole(matchedRole: string | undefined): IdentityType {
  if (!matchedRole) {
    return IdentityType.Person;
  }

  return SERVICE_ROLE_SET.has(matchedRole) ? IdentityType.Service : IdentityType.Person;
}

export default identityTypeFromMatchedRole;
