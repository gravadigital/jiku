import { NatsConnection, Service, ServiceMsg } from 'nats';
import {
  ErrorCode,
  INSTANCE,
  PROTOCOL_VERSION,
  Reply,
  endpointName,
  endpointSubject,
  failure,
  groupSubject,
} from '@jiku/nats-protocol';
import logger from '../logger';

/**
 * Versión que el servicio anuncia en el bus. Micro la valida como SemVer ESTRICTO y rechaza el
 * registro con cualquier otra cosa: un `latest` acá no degrada, tira el arranque. Es deliberado
 * —falla ruidosa al arrancar antes que un servicio invisible— y por eso el valor se pasa TAL
 * CUAL, sin sanear.
 */
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';

const encode = (reply: Reply): Uint8Array => new TextEncoder().encode(JSON.stringify(reply));

export interface ServiceSpec {
  /** Nombre en el bus, queue group, y token `{svc}` del subject. */
  name: string;
  description: string;
  /** Patrones de método: `tasks.{id}.edit`, `clients.new`, … Salen del registry. */
  patterns: string[];
  /** Resuelve la request. Nunca lanza: siempre devuelve un `Reply`. */
  handle: (subject: string, payload: unknown) => Promise<Reply>;
}

/**
 * El envelope viaja SIEMPRE en el cuerpo, también en los errores: es el contrato (ADR-002) y la
 * api lo parsea siempre. En un `failure` se agregan además los headers de micro
 * (`Nats-Service-Error` con el `errorCode`, `Nats-Service-Error-Code` con el 500 del TRANSPORTE
 * micro, que NO es el status HTTP: ese lo decide `httpStatusFor` de la api sobre el `errorCode`
 * del cuerpo). Los headers son un agregado, nunca un reemplazo del cuerpo.
 */
function respond(msg: ServiceMsg, reply: Reply): void {
  if (reply.status === 'success') {
    msg.respond(encode(reply));
    return;
  }
  msg.respondError(500, reply.errorCode ?? 'error', encode(reply));
}

/**
 * Atiende un mensaje. NUNCA LANZA, y no es una precaución: es el contrato.
 *
 * Si una excepción escapara hasta micro, micro responde `Empty` con headers de error y EL CUERPO
 * SE PIERDE — o sea el envelope, que es lo único que la api parsea. A cambio se ganaría un
 * `num_errors` distinto de cero. Cambiar el contrato por una métrica es un mal negocio, así que
 * el try/catch vive acá y la consecuencia asumida es que `num_errors` QUEDA EN 0:
 * `respondError()` no lo incrementa. Las fallas se miden por logs y por `errorCode`; no armes
 * alertas sobre esa métrica.
 */
async function handle(spec: ServiceSpec, msg: ServiceMsg): Promise<void> {
  let payload: unknown;
  try {
    // Un cuerpo vacío es `{}`, no un error: los comandos de borrado no llevan payload.
    payload = msg.data.length ? msg.json() : {};
  } catch {
    logger.warn(`[bus] payload inválido en ${msg.subject}`);
    respond(msg, failure(ErrorCode.INVALID_FIELDS, 'Malformed JSON payload'));
    return;
  }

  try {
    respond(msg, await spec.handle(msg.subject, payload));
  } catch (error: any) {
    // El despachador ya captura sus errores; esto es la última red, la que el `.catch()` del
    // consumer tenía antes de que este servicio lo reemplazara.
    logger.error(`[bus] ${msg.subject}: ${error.message}`);
    respond(msg, failure(ErrorCode.INTERNAL_ERROR, 'Internal error'));
  }
}

/**
 * Registra un servicio micro sobre una conexión existente.
 *
 * Micro no ata un servicio a un proceso: `nc.services.add()` crea uno nuevo en cada llamada, con
 * su propio id, sus endpoints y sus contadores. Dos llamadas sobre la MISMA conexión dan dos
 * servicios que se anuncian por separado en `$SRV`. Es lo que hace posible un proceso con dos.
 */
export async function registerService(nc: NatsConnection, spec: ServiceSpec): Promise<Service> {
  const service = await nc.services.add({
    name: spec.name,
    version: SERVICE_VERSION,
    description: spec.description,
    // Queue group propio, y en la config del SERVICIO: el grupo y los endpoints lo heredan en
    // cascada. Sin esta línea quedaría el default `q` de micro, el balanceo entre réplicas
    // pasaría a compartirse con cualquier otro servicio, y nada lo delataría.
    queue: spec.name,
    metadata: { instance: INSTANCE, protocol: PROTOCOL_VERSION },
  });

  // El `*` del user id cubre a cualquier caller. Micro lo acepta en el medio del prefijo: su
  // validación de grupo rechaza vacío, espacios y `>` interno, no `*`.
  const group = service.addGroup(groupSubject(spec.name));

  const subjects = new Set<string>();
  for (const pattern of spec.patterns) {
    const subject = endpointSubject(pattern);

    // Dos endpoints que matcheen el mismo subject entregan el mensaje a las DOS suscripciones y
    // ponen dos respuestas en el mismo inbox: el caller devuelve la primera y DESCARTA LA OTRA
    // EN SILENCIO. Respuestas correctas la mitad de las veces, sin un solo error en el log. Se
    // falla al arrancar. Los 20 de hoy no se solapan, pero verificarlo a mano no protege del
    // comando 21.
    if (subjects.has(subject)) {
      throw new Error(`[bus] ${spec.name}: subject de endpoint duplicado: ${subject}`);
    }
    subjects.add(subject);

    group.addEndpoint(endpointName(pattern), {
      subject,
      handler: (err, msg) => {
        if (err) {
          logger.error(`[bus] ${spec.name} ${subject}: ${err.message}`);
          return;
        }
        // Sin await: un mensaje no bloquea la llegada del siguiente. La concurrencia real la
        // acota el pool de Sequelize, igual que en el consumer que esto reemplaza.
        void handle(spec, msg);
      },
    });
  }

  logger.info(`[bus] ${spec.name} v${SERVICE_VERSION}: ${subjects.size} endpoints`);
  return service;
}
