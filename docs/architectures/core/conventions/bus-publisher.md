---
id: bus-publisher
display_name: Publicación de eventos de dominio (NATS/JetStream)
language: node
description: Post-commit domain event emission over NATS/JetStream, fire-and-forget, best-effort
applies_to: [worker]
required_by: []
package: nats
---

# Publicación de eventos de dominio (core, NATS/JetStream)

> **Convención nueva**, sin equivalente en el catálogo. No reemplaza a
> [`bus-consumer`](./bus-consumer.md): esa documenta la **entrada** del servicio (comandos y
> consultas, request/reply, sin JetStream); esta documenta la **salida** (eventos de dominio,
> fire-and-forget, con JetStream). Existe desde REQ-014 / S-063.

## Cuándo aplica

Cualquier comando que declare eventos en `Reply.events`, y el despachador que los emite. Hoy son
los doce comandos de `requirements` y `tasks` que escriben algo relevante para un conector externo.

## Paquete

```
nats                    # 2.29, cliente. Su API de JetStream (`connection.jetstream()`)
@jiku/nats-protocol     # eventSubject(), EVENTS_VERSION, DomainEvent, EVENT_TYPES
```

No suma una dependencia nueva: usa el mismo cliente `nats` que ya conecta el servicio, sobre su API
de JetStream.

## El publicador

`EventPublisher` es una **interfaz**, no la conexión de NATS (`core/src/bus/event-publisher.ts`):

```ts
export interface EventPublisher {
  publish(subject: string, payload: unknown): Promise<void>;
}
```

Exponer la `NatsConnection` desde `BusHost` rompería el encapsulamiento que `maxPayload()`
preserva a propósito (`connection` es `private`). El `Dispatcher` recibe esta interfaz por
constructor, igual que recibe `registry`, y lo único que le pide es publicar — no necesita saber si
hay JetStream, un doble de test, o cualquier otra cosa detrás.

`JetStreamEventPublisher` es la implementación real:

```ts
export class JetStreamEventPublisher implements EventPublisher {
  private codec = JSONCodec();
  constructor(private connection: NatsConnection) {}

  async publish(subject: string, payload: unknown): Promise<void> {
    const js = this.connection.jetstream();
    await js.publish(subject, this.codec.encode(payload));
  }
}
```

**El cliente JetStream se resuelve de forma perezosa**, no al construirse: el `Dispatcher` —y con
él, el publicador— se construye antes de que `BusHost.start()` abra la conexión. `core/src/index.ts`
resuelve esto con un objeto intermedio cuyo `publish()` recién llama a `host.eventPublisher()` en el
primer uso:

```ts
const eventPublisher: EventPublisher = {
  publish: (subject, payload) => host.eventPublisher().publish(subject, payload),
};
const dispatcher = new Dispatcher(registry, eventPublisher);
```

`host.eventPublisher()` **lanza** si se llama antes de `start()` — a propósito: es una dependencia
obligatoria del despachador, y construirla sin conexión sería un bug de orden de arranque que
conviene que falle ruidosamente.

## La emisión post-commit

`core/src/bus/dispatcher.ts:396-415`, entre el `commit()` de la transacción y el `return reply`:

```ts
try {
  if (reply.status === 'success' && reply.events?.length) {
    await emitEvents(reply.events, correlationId, this.publisher);
  }
} catch (error: any) {
  logger.error(`[events] emisión no manejada en ${name}: ${error.message}`);
}
```

- **Después del `commit()`**, nunca antes: publicar antes emitiría eventos de escrituras que
  después rollean.
- **Solo si el reply es `success` y la lista tiene elementos** (`reply.events?.length`, no
  `!== undefined`): un `events: []` no tiene nada que publicar.
- **En su propio `try`/`catch`**, que no deja escapar nada. El `catch` general del despachador hace
  `rollback()` sobre la transacción, y para este punto ya está **commiteada** — un rechazo que
  escapara de acá haría un rollback sobre una transacción terminada, ese segundo rechazo taparía el
  error original, y un comando que escribió bien saldría `failure internal_error`. Ver
  [ADR-003](../../../adrs/ADR-003-transaccion-del-despachador.md) por la regla completa y
  [ADR-014](../../../adrs/ADR-014-jetstream-para-eventos-de-dominio.md) por el plano de eventos.
- **Un comando NUNCA publica directamente.** Declara eventos en `Reply.events`; es el despachador
  quien decide si emitirlos y quien los emite. Si un comando publicara por su cuenta, publicaría
  **dentro** de la transacción y emitiría eventos de escrituras que después pueden rollear.

## La forma del sobre

El constructor puro de cada evento (`core/src/events/domain/`) no llena cuatro de los ocho campos
`required` del sobre. Los completa el emisor, `core/src/bus/emit-events.ts`:

| Campo | Lo llena |
|---|---|
| `eventId` | `generateUlid()` — ver [`_base`](./_base.md) o el módulo `events` del manifest |
| `occurredAt` | `new Date().toISOString()` |
| `version` | `EVENTS_VERSION` de `@jiku/nats-protocol` — **nunca** un literal `'v1'` |
| `correlationId` | el mismo para todos los eventos de un `dispatch()`, generado una vez por invocación |

El subject se arma **solo** con `eventSubject(type)` de `@jiku/nats-protocol` —el único lugar donde
el subject y `DomainEvent.type` están garantizados de no divergir— y nunca a mano ni concatenando
segmentos.

**El emisor nunca rechaza ni lanza.** Publica con `Promise.allSettled` (nunca `Promise.all`, que
descartaría el resultado de los otros eventos ante el primer rechazo) y envuelve cada `publish()`
en `Promise.resolve().then(...)` para atrapar también un throw sincrónico. Es la garantía que hace
seguro el `await` del despachador — y el `try`/`catch` propio del despachador va **igual**, porque
esa garantía tiene que ser local y visible en cada archivo, no una propiedad que alguien pueda
romper editando otro (en producción, un `unhandled rejection` del publicador **mata el proceso**:
el logger corre con `exitOnError: true` en `NODE_ENV=production`).

## El doble en los tests

`core/tests/helpers/event-publisher.ts`:

```ts
export interface PublishedEvent {
  subject: string;
  payload: unknown;
}

export class FakeEventPublisher implements EventPublisher {
  published: PublishedEvent[] = [];

  async publish(subject: string, payload: unknown): Promise<void> {
    this.published.push({ subject, payload });
  }

  reset(): void {
    this.published = [];
  }
}
```

**No es un mock de `sinon` a propósito:** un objeto propio con un array es más útil para asertar
`subject` y `payload` — un test hace `deepEqual` directo sobre `published[i]`, sin desarmar los
argumentos de una llamada. `publish` sigue siendo un método de clase común, así que un test que
necesite simular un fallo de publicación puede stubbearlo con `sinon`
(`sinon.stub(publisher, 'publish').rejects(...)` o `.throws(...)` para el throw sincrónico).

**Hay una instancia singleton**, `fakePublisher` en `core/tests/helpers/dispatch.ts`, inyectada en
el `Dispatcher` que usa `dispatch()`. Todo archivo que la use hace `fakePublisher.reset()` en su
`beforeEach`, porque la instancia es compartida.

**`api/tests/mocks/bus.ts` importa este mismo archivo por ruta relativa, no una copia** — el mismo
doble en los dos servicios, no una versión paralela que pueda desalinearse ([ADR-013](../../../adrs/ADR-013-tests-contra-base-real.md)).

Patrón de aserción real:

```ts
function ev(type: string): DomainEvent<RequirementSnapshot> {
  const found = fakePublisher.published.find((p) => (p.payload as { type: string }).type === type);
  if (!found) throw new Error(`No se publicó ningún evento de tipo "${type}"`);
  return found.payload as DomainEvent<RequirementSnapshot>;
}
```

## El formato del log del fallo

Nivel `error`, prefijo `[events]`, verbatim:

```
[events] publish failed eventId=<id> type=<type> entity=<type>:<id> project=<projectId> reason=<causa>
```

**Nunca lleva el payload**: el evento transporta títulos, descripciones y datos de personas
(`recipients`, `snapshot`). El log lleva únicamente los cinco identificadores del formato acordado.
Tampoco puede llevar el subject completo de un comando (que sí llevaría el user id) — no es este el
caso, pero la restricción es la misma que rige en el resto del logging de `core`.

**Va a `stdout` y no a los transports de archivo**, y no es un detalle menor: `LOGGER_INFO_PATH` /
`LOGGER_ERROR_PATH` no están definidos en el compose (NFR-R06) y esos transports quedan con
`filename: undefined` en producción — un log enviado ahí no llega a ninguna parte. `stdout` es el
único rastro real de un evento perdido, y esa razón hay que conservarla: el próximo que "ordene" los
logs mandando este a un transport de archivo elimina, sin darse cuenta, el único rastro que existe.

## Cómo se usa

Un comando no llama a nada de este módulo. Solo declara sus eventos en `Reply.events` con los
constructores puros del módulo `events` (ver `manifest.yaml`). El despachador hace el resto:
completa el sobre, arma el subject y publica, todo después del commit.

## Reglas

- El subject de un evento se arma **solo** con `eventSubject(type)`. No se construye a mano ni se
  concatenan segmentos en otro lugar.
- Un comando **declara** eventos en `Reply.events` y **nunca** publica directamente. Publicar es
  responsabilidad exclusiva del despachador.
- El emisor (`emit-events.ts`) **nunca** rechaza ni lanza. Cualquier fallo de `publish()` —rechazo
  o throw sincrónico— se atrapa y se loguea ahí mismo.
- La emisión ocurre **después** del `commit()`, en su **propio** `try`/`catch` que no propaga su
  error ni hace `rollback()`.
- `version` sale de `EVENTS_VERSION`. Nunca es un literal `'v1'` escrito a mano.
- El log del fallo lleva exactamente `eventId`, `type`, `entity.type:id`, `projectId` y la causa —
  nunca el payload, nunca el subject completo.
- Un evento perdido no se repone. Sin outbox, sin reintento, sin tabla de reconciliación
  ([ADR-014](../../../adrs/ADR-014-jetstream-para-eventos-de-dominio.md)).
- Los tests que verifican eventos publicados usan `fakePublisher.published` (o su propia instancia
  de `FakeEventPublisher`), nunca `sinon.spy()` sobre el publicador real.

## Integración con otras convenciones

- **[`commands`](./commands.md)**: el comando declara eventos en `Reply.events`; nunca los publica.
- **[`bus-consumer`](./bus-consumer.md)**: la contraparte de entrada. Comparten conexión, no
  gramática de subjects.
- **[`error-handling`](./error-handling.md)**: por qué la emisión nunca puede convertir un `success`
  en un `failure`.
- **[`logging`](./logging.md)**: el prefijo `[events]` entre corchetes y la razón de ir a `stdout`.
- **[`testing`](./testing.md)**: el doble `FakeEventPublisher` y cómo se asertan los eventos
  publicados.
