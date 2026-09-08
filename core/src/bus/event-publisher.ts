import { JSONCodec, NatsConnection } from 'nats';

/**
 * El publicador de eventos de dominio (REQ-014 / S-063).
 *
 * ES UNA INTERFAZ, NO LA CONEXIÓN DE NATS. La decisión 1 del diseño técnico de la story: exponer
 * la conexión desde `BusHost` rompería el encapsulamiento que hoy sostiene `maxPayload()`
 * (`this.connection` es `private` a propósito). El `Dispatcher` recibe ESTO por constructor, y lo
 * único que le pide es publicar — no necesita saber si hay JetStream, un mock, o cualquier otra
 * cosa detrás.
 *
 * `payload` es `unknown` y no `DomainEvent`: la interfaz vive en `bus/`, que es TRANSPORTE, y no
 * conoce el contrato de dominio de `@jiku/nats-protocol`. Quien arma el `DomainEvent` completo es
 * `emit-events.ts` (Task 2); esta interfaz solo lo transporta.
 */
export interface EventPublisher {
  publish(subject: string, payload: unknown): Promise<void>;
}

/**
 * La implementación real, sobre JetStream.
 *
 * RESUELVE EL CLIENTE JETSTREAM DE FORMA PEREZOSA (D-3), no al construirse: `Dispatcher` —y con
 * él, esta clase— se construye ANTES de que `BusHost.start()` abra la conexión (ver el nudo de
 * `src/index.ts`). Guardar la `NatsConnection` ya conectada y llamar a `.jetstream()` recién en el
 * primer `publish()` es el mismo patrón que el proveedor perezoso del presupuesto de bytes
 * (`() => budgetFrom(host.maxPayload())`): una closure evaluada por invocación, no un valor
 * capturado al construir.
 *
 * LA SERIALIZACIÓN VA ACÁ, no en el emisor (Task 2): la interfaz recibe el `payload` como objeto
 * y esta implementación lo codifica a JSON antes de publicar. Así el doble de test (`FakeEventPublisher`)
 * puede acumular el objeto tal cual y un test hace `deepEqual` sin deserializar nada.
 *
 * `js.publish()` ESPERA EL ACK DE JETSTREAM (el `PubAck`), y ese intercambio va por `$JS.API.*`
 * — de ahí que el `pub.allow` de `core.yaml` (Task 6) tenga que ganar esa línea. Un `nc.publish()`
 * pelado no lo requeriría, pero tampoco persistiría el mensaje en el stream: no se cambia por eso.
 */
export class JetStreamEventPublisher implements EventPublisher {
  private codec = JSONCodec();

  constructor(private connection: NatsConnection) {}

  async publish(subject: string, payload: unknown): Promise<void> {
    const js = this.connection.jetstream();
    await js.publish(subject, this.codec.encode(payload));
  }
}
