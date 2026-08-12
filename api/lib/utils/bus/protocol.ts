/**
 * Lo que la api agrega al contrato del bus.
 *
 * Los subjects, el formato de respuesta y los códigos de error viven en
 * `@jiku/nats-protocol`, compartidos con core. Acá queda lo que solo le importa a la
 * api: su identidad en el bus y cómo traduce un error a HTTP.
 */
import { Reply } from '@jiku/nats-protocol';

export * from '@jiku/nats-protocol';

/**
 * User id de fallback, solo para tests y para arrancar sin service user configurado.
 *
 * En un deploy real este valor NO se usa: el user id sale de la key del service user
 * (`serviceUser.userId`), porque tiene que coincidir con el `sub` que el callout lee del
 * token para autorizar el subject.
 */
export const USER_ID = process.env.NATS_USER_ID || 'api';

/**
 * Traduce el error de core al status HTTP que espera cada front.
 *
 * Es lo que sostiene el contrato con web y opus-web: cada código de error sale con el
 * status que esas pantallas manejan.
 *
 * El catálogo definitivo de errores está pendiente (ver el protocolo); mientras tanto,
 * estos son los códigos que las rutas usan hoy.
 */
const STATUS_BY_ERROR_CODE: Record<string, number> = {
  invalid_fields: 400,
  client_not_found: 400,
  project_not_found: 400,
  objective_not_found: 400,
  person_not_found: 400,
  invalid_responsible_person: 400,
  requirement_project_mismatch: 400,
  daily_limit_exceeded: 400,
  invalid_date_range: 400,
  invalid_attachment_id: 400,
  resolution_required: 400,
  already_subscribed: 400,
  invalid_state_transition: 400,
  stage_not_found: 400,
  worked_time_not_found: 400,
  unworked_time_not_found: 400,

  // Ojo: `requirement_not_found` sale 400 porque las rutas que lo reciben lo usan como
  // validación de entrada (worked-times). La única que responde 404 —PATCH
  // /requirements/:reqid, cuando no existe el requisito del path— lo resuelve por su
  // cuenta antes de publicar.
  requirement_not_found: 400,
  user_not_found: 404,
  subscription_not_found: 404,

  unknown_command: 500,
  internal_error: 500,
};

export function httpStatusFor(errorCode: string | undefined): number {
  return (errorCode && STATUS_BY_ERROR_CODE[errorCode]) || 500;
}

/**
 * El cuerpo de error que ya esperaban los fronts: `{ code, message }`.
 *
 * `daily_limit_exceeded` llevaba además `remainingMinutes`. El formato de respuesta del
 * protocolo no tiene dónde poner datos extra de un error (solo `errorCode` y
 * `errorMessage`), así que el número se recupera del mensaje para no cambiarle el
 * contrato a la web.
 *
 * Es una solución de transición: cuando se defina el catálogo de errores conviene que
 * los datos extra viajen estructurados. Ver documentation/known-limitations.md.
 */
export function errorBody(reply: Reply): Record<string, unknown> {
  const body: Record<string, unknown> = {
    code: reply.errorCode || 'internal_error',
    message: reply.errorMessage || 'Internal error',
  };

  if (reply.errorCode === 'daily_limit_exceeded') {
    const match = /Minutos disponibles: (-?\d+)/.exec(reply.errorMessage || '');
    if (match) {
      body.remainingMinutes = Number(match[1]);
    }
  }

  return body;
}
