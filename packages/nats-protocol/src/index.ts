/**
 * El contrato del bus, en código.
 *
 * La fuente de verdad es `docs/nats-protocol.md`: ante cualquier
 * discrepancia, manda el documento. Este paquete es la única definición de subjects y
 * formatos, compartida por la api (que publica) y core (que atiende).
 */
import { createHash } from 'node:crypto';

/**
 * Gramática de subjects: `{instance}.{user-id}.{svc}.{version}.{comando}`
 *
 *   instance  despliegue (dev / prod)
 *   user-id   QUIÉN llama: el `sub` del token de Zitadel, crudo. Vale igual para
 *             personas y para service users, porque ambos son usuarios de Zitadel.
 *   svc       a quién le habla: `gestion` (core)
 *   version   versión del protocolo
 *   comando   clients.new, requirements.{id}.edit, ...
 *
 * Ejemplo: `dev.323332022539911171.gestion.v1.clients.new`
 *
 * El user id va crudo a propósito: es lo que permite que core sepa quién lo llamó
 * leyendo el subject —avalado por el callout— en vez del cuerpo del mensaje. El inbox,
 * en cambio, usa un hash del user id (ver `inboxPrefix`).
 */
export const SERVICE_NAME = process.env.NATS_SERVICE_NAME || 'gestion';
export const PROTOCOL_VERSION = process.env.NATS_PROTOCOL_VERSION || 'v1';
export const INSTANCE = process.env.NATS_INSTANCE || 'dev';

/** Arma el subject de un comando saliente. `userId` es el `sub` de quien publica. */
export function commandSubject(command: string, userId: string): string {
  return `${INSTANCE}.${userId}.${SERVICE_NAME}.${PROTOCOL_VERSION}.${command}`;
}

/** Subject con wildcard que atiende core: cubre a cualquier caller. */
export function subscriptionSubject(): string {
  return `${INSTANCE}.*.${SERVICE_NAME}.${PROTOCOL_VERSION}.>`;
}

/**
 * Extrae el nombre del comando de un subject completo.
 *
 * `dev.api.gestion.v1.clients.new` -> `clients.new`
 * `dev.api.gestion.v1.clients.7.edit` -> `clients.7.edit`
 */
export function commandFromSubject(subject: string): string {
  return subject.split('.').slice(4).join('.');
}

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
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
