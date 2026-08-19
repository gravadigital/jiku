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

  // Los dos códigos de `files.{fileId}.request-download` son 404 y NO 400 porque describen
  // el ESTADO DEL RECURSO PEDIDO, no un problema con la entrada: el id llegó bien formado y
  // la api ya autorizó. `file_not_found` es el archivo borrado (retention_status != active);
  // `file_not_available`, el byte que nunca llegó al storage (byte_status = 'pending'), que
  // es el caso probable del PUT que falló en silencio. Sin estas dos entradas caerían en el
  // `|| 500` de abajo y el usuario vería un error genérico donde el contrato promete un 404
  // entendible (REQ-001, S-005).
  file_not_found: 404,
  file_not_available: 404,

  // Los dos rechazos de la política de subida (`files.request-upload`, core S-002) son 400
  // porque describen una ENTRADA rechazada: el nombre o el MIME están fuera de la allowlist,
  // o el tamaño supera el máximo. La política vive en `system_settings` y core la lee en
  // caliente, así que la api no puede anticiparlos: llegan como reply y se traducen acá
  // (REQ-001, S-004).
  file_type_not_allowed: 400,
  file_too_large: 400,

  // `file_not_owned` es 403 y NO 400, y ES LA ENTRADA MÁS FÁCIL DE MAPEAR MAL. Describe un
  // PERMISO —el archivo existe y está bien formado, pero lo subió otra persona (RF-12)—, no
  // una entrada inválida. Reusar `invalid_attachment_id`, que ya está mapeado a 400, haría
  // INDISTINGUIBLE "el archivo no existe" de "el archivo no es tuyo", y la segunda es
  // justamente la regla nueva que RF-12 introduce.
  //
  // No lo emite ningún comando que esta story publique: lo emiten los seis comandos de
  // dominio al vincular (S-003). Se mapea igual porque el mapa es DEL SERVICIO, no del
  // endpoint, y sin la entrada ese 403 saldría 500.
  file_not_owned: 403,

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
