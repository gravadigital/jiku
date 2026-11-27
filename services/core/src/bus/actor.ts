import { Actor, ErrorCode, Reply, failure } from '@jiku/nats-protocol';
import { getTrustedPublisherId } from '../config';

/**
 * La clave reservada `actor`: quién actúa detrás del comando.
 *
 * VIVE EN `src/bus/` Y NO EN `src/`, y es la diferencia deliberada con `authorize-caller.ts` y
 * `resolve-actor.ts`: EL SOBRE ES DEL PLANO DE COMANDOS Y DE NADIE MÁS. El plano de consultas no
 * tiene sobre —su identidad sale del subject y ya (REQ-006 §19)— y el de eventos no tiene caller.
 * Un solo consumidor, un solo módulo, adentro de `bus/`. Si algún día las consultas necesitaran un
 * sobre, ahí sí sube un nivel.
 *
 * POR QUÉ LO EXTRAE EL DESPACHADOR Y NO CADA ESQUEMA JOI. Los 20 esquemas rechazan claves
 * desconocidas (`.unknown(true)` está prohibido por la convención `validation`), así que si el
 * sobre llegara a `command.validate()` LOS 20 RESPONDERÍAN `invalid_fields`. Declararlo en los 20
 * habría sido tocar los 20 comandos y perder la propiedad de S-017 CA-15 —la que permite saber si
 * un bug es de la compuerta o del comando—. El sobre es del TRANSPORTE, no del dominio.
 *
 * ACÁ NO SE TOCA LA BASE. La escritura de la fila de `users` es del espejo, en el despachador, y
 * pasa DESPUÉS: esta función es pura y su único insumo externo es `getTrustedPublisherId()`.
 *
 * EL SOBRE NO SE VALIDA CON JOI, y es deliberado: la convención `validation` pone el esquema en el
 * archivo del comando y esto no es un comando; un mensaje de Joi no da el `errorDetails` con
 * nombres ELEGIDOS que CA-2 exige (`'actor.id'`, `'string[]'`), y sacarlos del texto con un regex
 * es la deuda que `daily_limit_exceeded` ya arrastra; y son dos campos y tres condiciones, donde un
 * esquema es más código, no menos.
 */

/**
 * Los cuatro campos de AUTORÍA DE DOMINIO con los que el sobre puede chocar.
 *
 * LISTA CERRADA, y sale de leer los 20 comandos, no de suponer:
 *
 *     creator   -> projects.new, tasks.new, requirements.new
 *     editor    -> tasks.{id}.edit, requirements.{id}.edit, requirements.{id}.resolve
 *     author    -> tasks.{id}.comment, requirements.{id}.comment
 *     uploader  -> files.request-upload (el único `.optional()`)
 *
 * Los otros 11 comandos —`clients.*`, `projects.{id}.edit`, `attachments.{id}.delete`,
 * `files.{fileId}.request-download`, los 4 de tiempos y los 2 de suscriptores— no llevan ninguno,
 * y por eso el sobre no puede chocar con nada ahí.
 *
 * ES EL GEMELO DE ESCRITURA DE `IDENTITY_PAYLOAD_FIELDS` (`src/queries/engine/validate-query.ts`),
 * que hace lo mismo del lado de la LECTURA. Si algún comando nuevo declara un campo de autoría,
 * VA ACÁ: la lista que se olvida de crecer es la que deja escribir a nombre de otro.
 *
 * ESTOS CAMPOS NO SE ELIMINAN NI SE VUELVEN OPCIONALES (CA-7). Son datos de dominio —van a
 * `requirements.created_by`, al autor de la Actividad, a `files.uploaded_by`— y lo único que
 * cambia con el sobre es QUIÉN MANDA.
 */
const DOMAIN_ACTOR_FIELDS = ['creator', 'author', 'editor', 'uploader'] as const;

/**
 * El resultado de mirar el cuerpo crudo: o el payload listo para el comando —con el sobre ya
 * separado, si vino—, o el `Reply` de falla ya armado.
 *
 * Es la misma forma que `validateWith()` devuelve (`{ value } | { error }`), por la misma razón:
 * el llamador decide con un `'error' in x` y no con un booleano más un canal aparte.
 */
export type ActorExtraction =
  | { actor?: Actor; payload: unknown }
  | { error: Reply<never> };

/** Un objeto plano: ni `null`, ni un array, ni un escalar. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Separa el sobre del payload de dominio, y lo rechaza si no corresponde.
 *
 * EL ORDEN ES GUARDA -> FORMA -> CHOQUE, y no es arbitrario (D-P2). Importa en un solo caso —un
 * caller no confiable que manda un sobre MALFORMADO— y ahí la respuesta correcta es la de la
 * guarda: A QUIEN NO PUEDE MANDAR UN SOBRE NO SE LE EXPLICA QUÉ TENÍA MAL EL SOBRE QUE NO PODÍA
 * MANDAR. Es el mismo criterio con que `authorizeWithRoles` usa un solo mensaje para "sin fila" y
 * "sin permiso": no regalar oráculos.
 *
 * LOS TRES RECHAZOS SON `invalid_fields`, y se reusa a propósito: REQ-006 §19 ya fijó ese código
 * para "un campo de identidad en el payload" del plano de lectura, y darle uno propio sugeriría que
 * son cosas distintas. Ya mapea a 400 en la api, así que su mapa no se toca.
 *
 * NINGÚN MENSAJE NI `errorDetails` LLEVA EL SUBJECT NI EL PAYLOAD COMPLETO: el subject transporta
 * el user id (CA-32 del REQ). Lo que sí llevan los detalles del choque son las DOS IDENTIDADES EN
 * CONFLICTO, que es exactamente el diagnóstico que el campo existe para dar.
 *
 * @param caller el segundo token del subject, ya resuelto por el despachador
 * @param raw    el cuerpo del mensaje, tal como llegó del bus
 */
export function extractActor(caller: string, raw: unknown): ActorExtraction {
  // LA PRESENCIA SE DECIDE POR `hasOwnProperty`, NO POR VERDAD (D-P3). `actor: null` y `actor: 0`
  // SON SOBRES PRESENTES y caen en la guarda y en la validación de forma. Un `if (raw.actor)`
  // dejaría pasar `actor: null` de un caller no confiable SIN RECHAZARLO, que es precisamente la
  // superficie que CA-3 cierra. Es la misma semántica que `pickPresent` ya usa en este servicio.
  //
  // Y antes del `hasOwnProperty`, el objeto plano: `raw` puede ser `null`, un número, un string o
  // un array —los cinco cuerpos que son JSON válido y no un objeto— y
  // `hasOwnProperty.call(null, …)` lanza. Si no es un objeto plano NO HAY SOBRE y el payload sigue
  // su camino a Joi como hoy. Mismo criterio que el `?.` de `events/dispatcher.ts`.
  if (!isPlainObject(raw) || !Object.prototype.hasOwnProperty.call(raw, 'actor')) {
    return { payload: raw };
  }

  // ── GUARDA DEL PUBLICADOR (CA-3) ────────────────────────────────────────────────────────────
  // Deny-by-default de ADR-008 en su forma más simple: no hay una lista de publicadores
  // confiables, hay UNO. Para todos los demás la identidad ES el segundo token del subject, que el
  // auth-callout hace infalsificable, y un sobre en el cuerpo es un intento de escribir a nombre de
  // otro. El detalle nombra el campo y nada más: quién no puede mandarlo no necesita saber por qué.
  if (caller !== getTrustedPublisherId()) {
    return {
      error: failure(
        ErrorCode.INVALID_FIELDS,
        'El campo `actor` solo lo puede declarar el publicador de confianza',
        { field: 'actor' }
      ),
    };
  }

  // Un sobre que no es un objeto se trata como un objeto vacío y cae en la validación de forma con
  // `actor.id` ausente. Es lo que hace que `actor: null` y `actor: 0` den el mismo rechazo que
  // `actor: {}`: los tres son un sobre presente al que le falta el `id`.
  const envelope = isPlainObject(raw.actor) ? raw.actor : {};

  // ── FORMA (CA-2) ────────────────────────────────────────────────────────────────────────────
  // `id` y `roles` son la ENTRADA DE LA AUTORIZACIÓN y sin ellos no hay decisión que tomar (D-7).
  // El resto del sobre es perfil y no rechaza nada.
  //
  // `value: null` Y NO `undefined` PARA UN CAMPO AUSENTE: `JSON.stringify` BORRA las claves con
  // valor `undefined`, así que `{ field, value: undefined, expected }` llegaría al caller como
  // `{ field, expected }` y tendría que adivinar. `null` viaja.
  const id = envelope.id;
  if (typeof id !== 'string' || id === '') {
    return {
      error: failure(
        ErrorCode.INVALID_FIELDS,
        'El sobre `actor` tiene que declarar un `id` no vacío',
        { field: 'actor.id', value: id ?? null, expected: 'string' }
      ),
    };
  }

  const roles = envelope.roles;
  if (!Array.isArray(roles)) {
    return {
      error: failure(
        ErrorCode.INVALID_FIELDS,
        'El sobre `actor` tiene que declarar `roles` como lista',
        { field: 'actor.roles', value: roles ?? null, expected: 'string[]' }
      ),
    };
  }

  // El CONTENIDO de `roles` NO se valida contra ningún catálogo, a propósito: un rol inventado no
  // autoriza nada (ADR-008), y el catálogo vive en el mapa de core y en `rules.yaml`, no acá.
  const actor: Actor = { id, roles: roles as string[] };

  // Los tres de perfil se copian SOLO SI VINIERON, y la ausencia se propaga como ausencia: el
  // espejo distingue "no lo mandaron" de "lo mandaron vacío" por `hasOwnProperty`, y de eso depende
  // que un sobre sin `name` no borre el nombre que la fila ya tenía (CA-11).
  //
  // Un campo de perfil que vino con un tipo que no es string se trata como AUSENTE en vez de
  // rechazar: rechazar una escritura por un campo de perfil es exactamente lo que D-7 prohíbe.
  if (typeof envelope.name === 'string') {
    actor.name = envelope.name;
  }
  if (typeof envelope.username === 'string') {
    actor.username = envelope.username;
  }
  if (typeof envelope.email === 'string') {
    actor.email = envelope.email;
  }

  // ── CHOQUE CON EL CAMPO DE DOMINIO (CA-6) ───────────────────────────────────────────────────
  // Dos identidades distintas en un mismo comando son un ERROR DEL PUBLICADOR, y resolverlo en
  // silencio es cómo se escribe a nombre de otro. Por eso no se elige "el más probable".
  //
  // Y es lo que cierra CA-16 SIN TOCAR UN SOLO COMANDO: los comandos siguen leyendo
  // `payload.creator` / `.editor` / `.author` para la Actividad, y esa lectura YA ES la persona del
  // sobre, por construcción — o el comando fue rechazado acá. No hay un tercer estado.
  //
  // LA COMPARACIÓN ES POR IDENTIDAD ESTRICTA SOBRE EL VALOR TAL COMO VINO: no normaliza, no hace
  // `trim`, no compara case-insensitive. Dos `sub` de Zitadel que difieren en un carácter SON DOS
  // IDENTIDADES DISTINTAS, y "arreglar" la comparación es cómo se escribe a nombre de otro.
  for (const field of DOMAIN_ACTOR_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(raw, field)) {
      continue;
    }

    const declared = raw[field];
    if (declared !== id) {
      return {
        error: failure(
          ErrorCode.INVALID_FIELDS,
          `El campo \`${field}\` no coincide con el actor declarado en el sobre`,
          { field, value: declared ?? null, expected: id }
        ),
      };
    }
  }

  // EL PAYLOAD QUE SALE ES UN OBJETO NUEVO: el `raw` que recibió el despachador no se muta. Mutarlo
  // dejaría al llamador con un objeto distinto del que pasó, y la traza de `LOG_COMMANDS` imprime
  // este —el de dominio, sin el sobre— justamente porque el sobre lleva `name`, `username` y
  // `email` de una persona.
  const payload: Record<string, unknown> = { ...raw };
  delete payload.actor;

  return { actor, payload };
}

export default extractActor;
