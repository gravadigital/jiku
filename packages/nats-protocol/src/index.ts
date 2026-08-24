/**
 * El contrato del bus, en código.
 *
 * La fuente de verdad es `docs/apis/core.yaml`: ante cualquier
 * discrepancia, manda el documento. Este paquete es la única definición de subjects y
 * formatos, compartida por la api (que publica) y core (que atiende).
 */
import { createHash } from 'node:crypto';

/**
 * Gramática de subjects: `{instance}.{user-id}.{svc}.{version}.{método}`
 *
 *   instance  despliegue (dev / prod)                     NATS_INSTANCE
 *   user-id   QUIÉN llama: el `sub` del token de Zitadel, crudo. Vale igual para
 *             personas y para service users, porque ambos son usuarios de Zitadel.
 *   svc       `jiku-commands`                             NATS_COMMAND_SERVICE
 *             `jiku-queries`                              NATS_QUERY_SERVICE
 *   version   versión del protocolo                       NATS_PROTOCOL_VERSION
 *   método    clients.new, requirements.{id}.edit, tasks.list, ...
 *
 * Ejemplo: `dev.323332022539911171.jiku-commands.v1.clients.new`
 *
 * LA GRAMÁTICA NO CAMBIÓ: el conjunto de valores del token `{svc}` pasó de uno a dos.
 *
 * POR QUÉ LA SEPARACIÓN VIVE EN `{svc}` Y NO ANIDADA BAJO EL SERVICIO DE COMANDOS. La
 * suscripción de comandos termina en `>`, y ese `>` se comería también las consultas si
 * compartieran el token `{svc}`. Dos queue groups sobre subjects solapados entregan el
 * mensaje a LAS DOS suscripciones y llegan DOS respuestas al mismo inbox; un `request()`
 * pelado devuelve la primera y DESCARTA LA SEGUNDA EN SILENCIO. Compartir el proceso no lo
 * evita: el solapamiento está en el subject. Con un `{svc}` distinto el problema no puede
 * pasar, porque los tokens de subject se comparan enteros.
 *
 * El user id va crudo a propósito: es lo que permite que core sepa quién lo llamó
 * leyendo el subject —avalado por el callout— en vez del cuerpo del mensaje. El inbox,
 * en cambio, usa un hash del user id (ver `inboxPrefix`).
 *
 * EL SUBJECT DE EVENTOS NO SIGUE ESTA GRAMÁTICA, Y ESTÁ BIEN ASÍ (REQ-005).
 *
 *   {instance}.events.auth                          3 segmentos, fire-and-forget, sin reply
 *   {instance}.{user-id}.{svc}.{version}.{método}    5+ segmentos, request/reply
 *
 * NO LO "ARREGLES" metiéndolo en la gramática de arriba. Es otra forma porque es otro patrón:
 *   - No hay reply. El emisor (el auth-callout, con la credencial `callout-events`) no espera
 *     nada, y no hay nada que ackear: CALLOUT_EVENTS_STREAM está deliberadamente sin definir,
 *     así que el mensaje es core NATS puro, no JetStream.
 *   - No hay caller en el subject. La identidad viaja en el payload (`id` = el `sub` de
 *     Zitadel), porque el evento es SOBRE una identidad y no lo publica ella en su nombre.
 *   - No es un endpoint micro. Micro es request/reply y todo endpoint tiene que responder;
 *     `respond()` sobre un mensaje sin `reply` subject es un no-op silencioso que además
 *     ensucia los contadores de $SRV. Core lo consume con una suscripción PLANA más queue
 *     group, y `registerService()` queda sin tocar.
 *
 * EL PERMISO DE SUSCRIPCIÓN ES EL SUBJECT LITERAL en `templates/core.yaml` `sub.allow`, nunca
 * `{{instance}}.events.>`. El deny-by-default también vale en el bus (ADR-008): un evento
 * futuro TIENE que costar una línea nueva ahí. Sin esa línea core arranca, atiende los 20
 * comandos, loguea que se suscribió, y no recibe nada — la violación de permisos es asíncrona
 * y aparece en el log del SERVIDOR NATS, nunca como un fallo de `subscribe()`.
 */
export const COMMAND_SERVICE = process.env.NATS_COMMAND_SERVICE || 'jiku-commands';
export const QUERY_SERVICE = process.env.NATS_QUERY_SERVICE || 'jiku-queries';
export const PROTOCOL_VERSION = process.env.NATS_PROTOCOL_VERSION || 'v1';
export const INSTANCE = process.env.NATS_INSTANCE || 'dev';

/** Arma el subject de un comando saliente. `userId` es el `sub` de quien publica. */
export function commandSubject(command: string, userId: string): string {
  return `${INSTANCE}.${userId}.${COMMAND_SERVICE}.${PROTOCOL_VERSION}.${command}`;
}

/**
 * Arma el subject de una consulta saliente.
 *
 * Misma gramática que un comando y distinto token `{svc}`, y eso último no es cosmético: la
 * suscripción de comandos termina en `>` y se comería las consultas si compartieran el token.
 * Dos queue groups sobre subjects solapados entregan el mensaje a LAS DOS suscripciones, llegan
 * dos respuestas al mismo inbox, y `request()` devuelve la primera y descarta la segunda EN
 * SILENCIO. Con `{svc}` distinto no puede pasar: los tokens se comparan enteros.
 *
 * El orden de los parámetros es el mismo que en `commandSubject`, a propósito: las dos toman
 * dos strings, así que invertirlo sería un bug que el compilador no atrapa.
 */
export function querySubject(query: string, userId: string): string {
  return `${INSTANCE}.${userId}.${QUERY_SERVICE}.${PROTOCOL_VERSION}.${query}`;
}

/**
 * Prefijo del grupo de un servicio micro: `{instance}.*.{svc}.{version}`.
 *
 * El `*` en el user id cubre a cualquier caller. Va SIN el `.>` final a propósito: micro recibe
 * el grupo y arma el subject de cada endpoint por su cuenta.
 *
 * El servicio va por parámetro y no de una constante porque hacen falta DOS grupos, uno por
 * servicio, desde el mismo proceso.
 */
export function groupSubject(service: string): string {
  return `${INSTANCE}.*.${service}.${PROTOCOL_VERSION}`;
}

/**
 * Subject del evento de autenticación: `{instance}.events.auth`.
 *
 * TRES SEGMENTOS, NO CINCO: no sigue la gramática de comandos y consultas, y el bloque de arriba
 * explica por qué. Fire-and-forget, sin reply y sin ack.
 *
 * No toma parámetros porque no hay nada que parametrizar: hay UN evento. Y no existe un
 * `eventsGroupSubject()` a propósito — el permiso de `templates/core.yaml` es el subject LITERAL,
 * así que un evento futuro tiene que costar un helper nuevo acá y una línea nueva allá (ADR-008).
 *
 * El emisor es el auth-callout, con su credencial `callout-events`, que solo puede publicar este
 * subject y no puede suscribirse a nada. El consumidor es core, con una suscripción plana.
 */
export function authEventSubject(): string {
  return `${INSTANCE}.events.auth`;
}

/** Un segmento del patrón que es un parámetro: `{id}`, `{userId}`, `{fileId}`. */
function isParam(segment: string): boolean {
  return segment.startsWith('{') && segment.endsWith('}');
}

/**
 * Nombre del endpoint micro que atiende un patrón: `tasks.{id}.edit` -> `tasks-edit`.
 *
 * Sin puntos porque micro valida el nombre contra /^[-\w]+$/ (ADR-32 de NATS). Y el `{param}` se
 * ELIMINA en vez de reemplazarse: el despachador extrae los params del subject completo con el
 * registry por segmentos, así que no los necesita del nombre.
 */
export function endpointName(pattern: string): string {
  return pattern
    .split('.')
    .filter((segment) => !isParam(segment))
    .join('-');
}

/**
 * Subject del endpoint micro que atiende un patrón: `tasks.{id}.edit` -> `tasks.*.edit`.
 *
 * Un token de subject no puede llevar llaves. El `*` matchea un token cualquiera, que es
 * exactamente el rol del param.
 */
export function endpointSubject(pattern: string): string {
  return pattern
    .split('.')
    .map((segment) => (isParam(segment) ? '*' : segment))
    .join('.');
}

/**
 * Extrae el nombre del método de un subject completo.
 *
 * `dev.api.jiku-commands.v1.clients.new` -> `clients.new`
 * `dev.api.jiku-commands.v1.clients.7.edit` -> `clients.7.edit`
 * `dev.api.jiku-queries.v1.tasks.list` -> `tasks.list`
 *
 * El `slice(4)` vale para los dos servicios porque `jiku-commands` y `jiku-queries` llevan
 * guion, no punto: son UN solo token del subject.
 */
export function methodFromSubject(subject: string): string {
  return subject.split('.').slice(4).join('.');
}

/**
 * @deprecated Usá `methodFromSubject`: con dos servicios en el bus, el quinto segmento es un
 * método (comando o consulta), no siempre un comando. Es el MISMO símbolo, no una copia: se
 * mantiene para no tocar `core/src/bus/dispatcher.ts`. Se elimina cuando su caller se repunte.
 */
export const commandFromSubject = methodFromSubject;

/**
 * Quién publicó el mensaje, leído del subject: el user id de Zitadel del caller.
 *
 * Es un dato confiable: el permiso de publicación lo fija el auth-callout, así que un
 * cliente no puede publicar bajo el user id de otro.
 *
 * Identifica al SERVICE USER que conectó (hoy el de la api), no a la persona que originó
 * la acción: la api usa un único service_user para todos sus usuarios, así que el usuario
 * final viaja en el cuerpo, en `creator` / `author`.
 */
export function callerFromSubject(subject: string): string {
  return subject.split('.')[1] || '';
}

/**
 * Prefijo de inbox que le corresponde a un user id: `_INBOX.<hash(user-id)>`.
 *
 * A diferencia del subject de comandos, el inbox usa el user id HASHEADO. El cliente
 * DEBE fijar este prefijo al conectar (`inboxPrefix` en nats.js): por defecto la librería
 * genera un `_INBOX.<aleatorio>` que ningún permiso acotado autoriza, y las respuestas
 * nunca llegan.
 *
 * Tiene que dar exactamente lo mismo que el callout, que es quien mintea el permiso.
 * La referencia es `cmd/session` en el repo de auth-callout: sha256 del user id, base32
 * sin padding, en minúscula, los primeros 16 caracteres.
 */
export function inboxPrefix(userId: string): string {
  return `_INBOX.${hashUserId(userId)}`;
}

/**
 * Hash del user id usado en el inbox. No es un secreto: el user id ya viaja crudo en los
 * subjects. Existe porque el inbox necesita un token opaco y de largo fijo.
 */
export function hashUserId(userId: string): string {
  const digest = createHash('sha256').update(userId).digest();
  return base32(digest).slice(0, USER_ID_HASH_LEN).toLowerCase();
}

/** 16 caracteres base32 son 80 bits de sha256: sin colisiones y corto para leer en logs. */
const USER_ID_HASH_LEN = 16;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** base32 RFC 4648 sin padding, para que el hash sea un token válido de subject NATS. */
function base32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export type ReplyStatus = 'success' | 'failure';

/** Formato de respuesta, igual para todos los comandos. */
export interface Reply<T = unknown> {
  status: ReplyStatus;
  errorCode?: string;
  errorMessage?: string;
  data?: T;
}

export function success<T>(data?: T): Reply<T> {
  return data === undefined ? { status: 'success' } : { status: 'success', data };
}

export function failure(errorCode: string, errorMessage: string): Reply<never> {
  return { status: 'failure', errorCode, errorMessage };
}

/**
 * Códigos de error del protocolo.
 *
 * El catálogo definitivo está pendiente (ver el documento). Estos son los códigos que la
 * api traduce a HTTP para web y opus-web.
 */
export const ErrorCode = {
  INVALID_FIELDS: 'invalid_fields',
  INTERNAL_ERROR: 'internal_error',
  UNKNOWN_COMMAND: 'unknown_command',
  // REQ-005 agrega UN código, y es el primero que emite EL DESPACHADOR y no un comando: los dos
  // despachadores autorizan al caller del subject contra los roles persistidos ANTES de resolver
  // el método y ANTES de abrir la transacción. Por eso es el CUARTO de la familia de arriba —los
  // que no vienen de un comando— y por eso NO figura en el `x-error-codes` de ninguno de los 20
  // mensajes de `docs/apis/core.yaml`: esa lista enumera lo que devuelve un `execute()`.
  //
  // UN SOLO CÓDIGO PARA DOS SITUACIONES, A PROPÓSITO: "no hay fila para el caller" y "hay fila
  // pero ningún rol autoriza este método" responden LO MISMO. Distinguirlas le diría a un caller
  // no autorizado si una identidad existe en la base, que es un oráculo gratis.
  //
  // Y POR ESO `USER_NOT_FOUND` NO SE REUSA — además de que ya está mapeado a 404, que es el
  // status equivocado para un rechazo de permisos.
  //
  // MAPEA A 403 en `api/lib/utils/bus/protocol.ts`, junto a `file_not_owned` y con su mismo
  // argumento: describe un PERMISO, no una entrada inválida. En la práctica la api NUNCA lo
  // recibe —su canal está exento de la compuerta—, y se mapea igual porque el mapa es DEL
  // SERVICIO, no del endpoint.
  //
  // Los tres lugares de la convención: este archivo, el `enum` de `docs/apis/core.yaml` (ya
  // escrito, y la fuente de verdad del valor) y ese mapa. Faltando el tercero, el código cae en
  // el `|| 500` de `httpStatusFor()` y el usuario ve un 500 genérico.
  CALLER_NOT_AUTHORIZED: 'caller_not_authorized',

  CLIENT_NOT_FOUND: 'client_not_found',
  PROJECT_NOT_FOUND: 'project_not_found',
  OBJECTIVE_NOT_FOUND: 'objective_not_found',
  REQUIREMENT_NOT_FOUND: 'requirement_not_found',
  USER_NOT_FOUND: 'user_not_found',
  PERSON_NOT_FOUND: 'person_not_found',

  INVALID_RESPONSIBLE_PERSON: 'invalid_responsible_person',
  INVALID_ATTACHMENT_ID: 'invalid_attachment_id',
  REQUIREMENT_PROJECT_MISMATCH: 'requirement_project_mismatch',
  DAILY_LIMIT_EXCEEDED: 'daily_limit_exceeded',
  INVALID_DATE_RANGE: 'invalid_date_range',
  ALREADY_SUBSCRIBED: 'already_subscribed',
  SUBSCRIPTION_NOT_FOUND: 'subscription_not_found',
  INVALID_STATE_TRANSITION: 'invalid_state_transition',
  STAGE_NOT_FOUND: 'stage_not_found',
  RESOLUTION_REQUIRED: 'resolution_required',
  WORKED_TIME_NOT_FOUND: 'worked_time_not_found',
  UNWORKED_TIME_NOT_FOUND: 'unworked_time_not_found',

  // Los cinco de archivos (REQ-001). El enum de `docs/apis/core.yaml` ya los declara: esto
  // alinea el paquete con el contrato, que es la fuente de verdad.
  //
  // FILE_NOT_OWNED lo emite S-003 al vincular, no los comandos de storage de S-002. Se declara
  // igual porque un código declarado y no usado no rompe nada, mientras que uno usado y no
  // declarado obliga al literal a mano — la deuda que este catálogo ya arrastra tres veces
  // (`resolution_required`, `worked_time_not_found`, `unworked_time_not_found`).
  //
  // FILE_NOT_OWNED mapea a 403, NO a 400: reusar `invalid_attachment_id` haría indistinguible
  // "el archivo no existe" de "el archivo no es tuyo", y el segundo es la regla nueva del REQ.
  // El mapeo a HTTP en `api/lib/utils/bus/protocol.ts` es de S-004/S-005.
  FILE_TYPE_NOT_ALLOWED: 'file_type_not_allowed',
  FILE_TOO_LARGE: 'file_too_large',
  FILE_NOT_OWNED: 'file_not_owned',
  FILE_NOT_FOUND: 'file_not_found',
  FILE_NOT_AVAILABLE: 'file_not_available',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * El payload del evento de autenticación, tal como el auth-callout lo publica.
 *
 * SON LOS NUEVE CAMPOS QUE CORE LEE, de los quince que el emisor manda. Los otros seis
 * —`authenticated_at`, `expires_at`, `client_ip`, `session`, `matched_role`, `template`— NO SE
 * DECLARAN, y tampoco cualquiera nuevo que el emisor agregue: su schema vive en otro repo y puede
 * crecer, así que el consumidor valida con `.unknown(true)` y un campo nuevo no puede tirarlo.
 * `client_ip` y `session` además NO SE PERSISTEN NUNCA: es minimización de datos personales, no
 * solo alcance (RF-12).
 *
 * LOS NOMBRES VAN EN snake_case, VERBATIM DEL EMISOR. Este paquete es el LECTOR del contrato, no
 * su autor: `identity_type` se llama así porque así llega. La traducción a `identityType` es de
 * core, en el handler, que es donde ADR-004 la quiere.
 *
 * DESCRIBE EL PAYLOAD VALIDADO. Los nueve son requeridos porque el esquema Joi de core aplica
 * defaults a `roles` (lista vacía) y a `identity_type` (`person`) antes de que el handler lo vea.
 *
 * `type` y `version` van como `string` y `number` Y NO como los literales 'authenticated' y 1: en
 * el cable un `version: 2` es un valor legítimo que core descarta, y congelarlos haría el tipo
 * mentir sobre el contrato.
 *
 * `identity_type` es `string` y NO el enum `IdentityType` de `@jiku/models`: este paquete no
 * depende de nada, y un valor fuera del enum es un evento INVÁLIDO —que core descarta— no un tipo
 * imposible.
 */
export interface AuthEvent {
  /** Guarda: core solo procesa `'authenticated'`. No se persiste. */
  type: string;
  /** Guarda: core solo procesa la versión `1`. No se persiste. */
  version: number;
  /** Guarda: tiene que coincidir con el `INSTANCE` del consumidor. No se persiste. */
  instance: string;
  /** El `sub` de Zitadel. Es la PK de `users`: no hace falta ninguna correlación. */
  id: string;
  name: string;
  username: string;
  email: string;
  /** Tal cual vienen, sin filtrar ni validar contra ningún catálogo. */
  roles: string[];
  /** Sale del `type` de la regla de `rules.yaml` que matcheó, no de una heurística. */
  identity_type: string;
}
