import { DomainEvent, EVENTS_VERSION, eventSubject } from '@jiku/nats-protocol';
import logger from '../logger';
import { generateUlid } from '../ulid';
import { EventPublisher } from './event-publisher';

/**
 * Emite un lote de eventos ya declarados por un comando (REQ-014 / S-063), completando lo que el
 * constructor puro de cada evento no puede saber por sí solo: `eventId`, `occurredAt` y `version`.
 *
 * SEPARADA DEL DESPACHADOR A PROPÓSITO (Task 2 de la story): así el comportamiento de R-A/R-B
 * —"nunca rechaza, nunca lanza"— es testeable sin base de datos y sin transacción, y el cambio en
 * `dispatcher.ts` (Task 5) queda chico: ese archivo solo decide CUÁNDO llamar a esta función,
 * nunca CÓMO se completa o se publica un evento.
 *
 * NUNCA RECHAZA Y NUNCA LANZA (CA-3, CA-5, R-A, R-B). Es la garantía completa de esta función, y
 * hay dos modos de fallo distintos que cubrir, no uno:
 *
 *   1. UN RECHAZO DE `publisher.publish()` — se resuelve con `Promise.allSettled`, NUNCA
 *      `Promise.all`: el primero descarta la información de los otros eventos del lote apenas el
 *      primero rechaza, y un publish fallido no puede impedir que los demás salgan (CA-3, R-B:
 *      "con varios eventos, cada resultado se inspecciona individualmente").
 *   2. UN THROW SINCRÓNICO de `publisher.publish()` — un publicador que lanza ANTES de devolver
 *      una promesa no produce un rechazo: produce una excepción, y esa excepción escaparía del
 *      `.map()` que alimenta `allSettled` si se llamara a `publish()` directo ahí adentro. Por
 *      eso cada llamada va envuelta en `Promise.resolve().then(() => publisher.publish(...))`:
 *      cualquier throw sincrónico queda atrapado por la promesa antes de que `allSettled` lo vea.
 *
 * NO ESPERA EN SERIE (`for await`): la story lo marca en Performance — la emisión alarga el
 * tiempo hasta el `Reply` contra el timeout de 5000ms de la api, así que con varios eventos hay
 * que publicarlos EN PARALELO. `allSettled` ya lo hace.
 *
 * EL LOG DEL FALLO LLEVA LA CAUSA, NUNCA EL PAYLOAD: el evento transporta títulos, descripciones y
 * datos de personas (`recipients`, `snapshot`). El log lleva únicamente los cinco identificadores
 * del formato acordado (REQ-014 §3), verbatim:
 *
 *     [events] publish failed eventId=<id> type=<type> entity=<type>:<id> project=<projectId> reason=<causa>
 *
 * A `stdout`, vía el logger de Winston (su transport de consola SÍ funciona en producción; los de
 * archivo están con `filename: undefined`, deuda conocida de NFR-R06 que este REQ declara fuera
 * de alcance — el log del fallo no depende de que se arregle).
 *
 * UN EVENTO PERDIDO NO SE REPONE (R-6, asumido y cerrado en el REQ): no hay outbox ni reintento.
 * Esta función es el límite exacto de esa decisión.
 */
export async function emitEvents(
  events: DomainEvent[],
  correlationId: string,
  publisher: EventPublisher
): Promise<void> {
  const results = await Promise.allSettled(
    events.map((event) => Promise.resolve().then(() => publishOne(event, correlationId, publisher)))
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      // INALCANZABLE HOY: `publishOne` ya atrapa cualquier error y nunca rechaza. Este `if` es
      // una segunda red, para que un futuro cambio en `publishOne` que rompa esa garantía no
      // vuelva a un `unhandledRejection` en silencio — se loguea igual, sin los cinco campos del
      // formato porque en este punto ya no hay evento identificable (el catch de `publishOne` es
      // el que los tiene).
      logger.error(`[events] emisión no manejada: ${String(result.reason)}`);
    }
  }
}

/** Completa un evento y lo publica. Nunca rechaza: cualquier fallo se atrapa y se loguea acá mismo. */
async function publishOne(
  event: DomainEvent,
  correlationId: string,
  publisher: EventPublisher
): Promise<void> {
  const complete: DomainEvent = {
    ...event,
    eventId: generateUlid(),
    // ISO 8601 UTC con milisegundos, el formato que `Date.prototype.toISOString()` produce.
    occurredAt: new Date().toISOString(),
    // Del paquete, NUNCA un literal `'v1'`: `EVENTS_VERSION` sale de `NATS_EVENTS_VERSION` y
    // puede convivir con un futuro `'v2'` sin que este archivo cambie.
    version: EVENTS_VERSION,
    correlationId,
  };

  try {
    // EL SUBJECT SE ARMA SOLO CON `eventSubject()` (API Context): es el único lugar donde el
    // subject y `type` están garantizados de no divergir.
    await publisher.publish(eventSubject(complete.type), complete);
  } catch (error: any) {
    // `entity=<type>:<id>` y `project=<projectId>` salen del sobre, garantizados por el contrato
    // (`EventEntityRef` siempre trae los tres). El formato es LITERAL, del REQ §3: no cambiarlo
    // es lo que hace que un `grep` en el log de producción encuentre el patrón siempre igual.
    logger.error(
      `[events] publish failed eventId=${complete.eventId} type=${complete.type} ` +
        `entity=${complete.entity.type}:${complete.entity.id} project=${complete.entity.projectId} ` +
        `reason=${error?.message ?? String(error)}`
    );
  }
}

export default emitEvents;
