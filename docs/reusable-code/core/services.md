# Services — `core`

## StorageSigner

**Location:** `core/src/commands/files/storage.ts`

**Description:** The S3 signer of `core`: exactly two operations, sign a PutObject and sign a
GetObject. It never performs network I/O — the SDK signs locally with the credentials — which is
what lets it run inside the dispatcher's transaction without risking the 5 s timeout of ADR-002.

It is built **lazily**, at first use, and can be replaced through `setStorageSigner()`. This differs
deliberately from `api/lib/utils/storage-service.ts`, which instantiates at import time and throws
when configuration is missing: copying that pattern would break the whole `core` test suite, since
the test environment has no real credentials.

**Interface:**
```ts
interface StorageSigner {
  readonly bucket: string;
  readonly region: string;
  readonly keyPrefix: string;
  signUpload(key: string, mimeType: string, expiresIn: number): Promise<string>;
  signDownload(
    key: string, fileName: string,
    disposition: 'inline' | 'attachment', expiresIn: number
  ): Promise<string>;
}

function getStorageSigner(): StorageSigner;
function setStorageSigner(replacement: StorageSigner | null): void;
```

**Usage:**
```ts
const signer = getStorageSigner();
const key = buildStorageKey(payload.fileName, signer.keyPrefix);
const uploadUrl = await signer.signUpload(key, payload.mimeType, settings.uploadUrlTtlSeconds);
```

**Do not add** `uploadFromBuffer`, `getFileStream`, `deleteFile`, `listByPrefix` or `headObject`:
`core` signs, it does not move bytes.


## BusHost

**Location:** `core/src/bus/host.ts`

**Description:** One NATS connection, N micro services. It replaced `bus/consumer.ts` in S-012.

`nc.services.add()` has **no singleton**: every call creates a service with its own id, endpoints
and counters, so several services can share a single connection. That is why the constructor takes
the specs as **varargs from day one** even when only one is passed — mounting a second service is
adding one element, not refactoring the host.

Three properties are load-bearing and are not stylistic choices:

- **`inboxPrefix` is always set**, in both paths (with and without a Zitadel service user). Without
  it the library generates an `_INBOX.<random>` that no scoped permission authorizes, and the
  symptom is a **timeout**, not a permission error.
- **Registration is serial and the error propagates.** No `Promise.all`: it would leave the process
  up with one service registered and another one down. The first failure aborts startup entirely.
- **`stop()` has an order, and the order is the guarantee:** cancel the token auto-refresh → stop
  the services (they stop accepting new requests) → `drain()` → `close()`. Reversed, a new request
  could arrive during the drain. `Promise.all` **is** correct for stopping services: it is
  idempotent and has no ordering between them.

**Interface:**
```ts
class BusHost {
  constructor(...specs: ServiceSpec[]);
  start(): Promise<void>;
  stop(): Promise<void>;
  protected openConnection(options: ConnectionOptions): Promise<NatsConnection>;
}
```

**Usage:**
```ts
const host = new BusHost({
  name: COMMAND_SERVICE,
  description: 'Comandos de dominio de Jiku: la única vía de escritura a la base',
  patterns: registry.patterns(),
  handle: (subject, payload) => dispatcher.dispatch(subject, payload),
});
await host.start();
```

**`openConnection()` is a declared test seam, not an accident.** `connect` is exported from `nats`
through a non-configurable getter (`node_modules/nats/lib/src/mod.js`:55), so sinon cannot stub it
(*"Descriptor for property connect is non-configurable and non-writable"*). Without the seam
`host.ts` could only be tested against a real bus. Override it in a subclass to capture the
connection options and return a double.

**Known limitation (S-012, verified):** in-flight requests can go unanswered on shutdown. The
handler runs as `void handle(...)` — no `await`, which is what keeps one message from blocking the
next — so `service.stop()` drains the subscriptions but nobody awaits the pending `handle()`
promises, and `drain()`/`close()` may run before the dispatcher finishes writing and calls
`msg.respond()`. **This is pre-existing behavior**, verified identical in the `consumer.ts` this
replaced. Closing the gap means tracking the in-flight promises and awaiting them before the drain.

## registerService

**Location:** `core/src/bus/service.ts`

**Description:** Registers one micro service on an existing connection from a `ServiceSpec`, and
derives **one endpoint per command pattern** — there is no hand-written endpoint list anywhere in
`src/`. Adding a command to the registry registers its endpoint without touching this file.

The derivation uses `endpointName()` and `endpointSubject()` from `@jiku/nats-protocol`:
`tasks.{id}.edit` becomes the endpoint `tasks-edit` on subject `tasks.*.edit`, under the group
`groupSubject(name)` (`dev.*.jiku-commands.v1`).

Two details that look like details and are not:

- **`queue: spec.name` goes in the SERVICE config**, not on each endpoint: the queue group cascades
  to the group and to every endpoint. Without that line micro's default `q` would remain, load
  balancing would be shared with any other service, and nothing would report it.
- **The `Set` of subjects that fails startup is not optional.** Two endpoints matching the same
  subject deliver the message to both subscriptions and put two replies in the same inbox; the
  caller returns the first and **silently discards the other**. Correct answers half the time, with
  no error in any log. Checking today's patterns by hand does not protect against the next command.

Nothing is caught or wrapped: if `services.add()` rejects — invalid SemVer in `SERVICE_VERSION`,
invalid name, connection down — the rejection propagates as is, and startup fails.

**Signature:**
```ts
function registerService(nc: NatsConnection, spec: ServiceSpec): Promise<Service>;
```

**Usage:**
```ts
const service = await registerService(connection, {
  name: COMMAND_SERVICE,
  description: 'Comandos de dominio de Jiku: la única vía de escritura a la base',
  patterns: registry.patterns(),
  handle: (subject, payload) => dispatcher.dispatch(subject, payload),
});
```

**The reply envelope always travels in the body**, in both outcomes: `msg.respond()` on success and
`msg.respondError(500, errorCode, body)` on failure. The `500` is the **micro transport** status,
not HTTP — the HTTP status is decided by the api's `httpStatusFor` over the `errorCode` **in the
body**. The `Nats-Service-Error` / `Nats-Service-Error-Code` headers are an addition, never a
replacement for the body.

**Metrics caveat:** `num_errors` stays at **0**, because `respondError()` does not increment it and
the handler never throws (if it did, micro would answer `Empty` with headers and lose the envelope).
`processing_time` is per endpoint but measures enqueueing, not the command. Measure failures by logs
and `errorCode`; do not build alerts on those metrics.
