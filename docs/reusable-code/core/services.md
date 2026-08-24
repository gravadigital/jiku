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

## readDb

**Location:** `core/src/models/read.ts`

**Description:** The **read-only** Sequelize connection used by the query service. It is created
**without registering any model, and that is the most important line of the module.**

`@jiku/models` exports classes that get registered on **one** Sequelize instance (ADR-005). That
worked while `api` and `core` were separate processes. Two instances in the **same** process fight
over the classes: whichever registers the package's model index **second reassigns** them, and
`Objective.findAll()` starts going out through the wrong connection. In the bad direction — queries
going out through the owner user — **ADR-001 stops holding with no symptom at all.** That is why
nothing is registered here and queries use explicit SQL (`ctx.db.query(...)`) instead of the ORM.

Two settings are its own, and neither is shared with the write connection:

- **`pool.max`** from `POSTGRESQL_READ_POOL_MAX`, default `10`. The write connection declares no
  pool, so it runs on Sequelize's implicit `max: 5`. The asymmetry is deliberate: a read holds a
  connection for one statement, a write holds it for a whole transaction. **Total per replica: 15**
  — check it against the installation's `max_connections` before raising it.
- **`dialectOptions.statement_timeout`** from `POSTGRESQL_STATEMENT_TIMEOUT_MS`, default `8000`.
  **Invariant: strictly lower than `NATS_QUERY_TIMEOUT_MS`** (10000, read by the api). The database
  has to cut first, or the caller gets a bus timeout that explains nothing.

It is built **at import time**, like `models/index.ts`, so the environment variables have to be set
before (dotenv in `src/index.ts`, `tests/setup-env.ts` in the tests). It does **not** connect on
import — Sequelize opens the socket on the first query — and there is no startup `authenticate()`
or retry: a misconfigured credential should fail loudly at first use.

**Interface:**
```ts
export const readDb: Sequelize; // Object.keys(readDb.models).length === 0, always
```

**Usage:** inject it, do not import it from inside `queries/`:
```ts
const queries = new QueryDispatcher(queryRegistry, readDb);
```

**Do not add `models` to this constructor.** `tests/models/read.test.ts` asserts that
`Objective.sequelize === sequelize` (the owner connection) precisely so that a future refactor
adding it fails there instead of in production.

## QueryRegistry

**Location:** `core/src/queries/registry.ts`

**Description:** Resolves a query method name to the query that serves it.

It deliberately does **not** reuse `CommandRegistry`: that registry's segment matching exists to
extract `{param}` from subjects with embedded ids, and **query patterns have no params** — the
resource id travels in the payload, because the server matches with a 1024-entry subject cache and a
new subject per id consulted would make the cache useless. A `Map` lookup is exact, shorter, and does
not suggest that a query pattern could carry `{id}`.

`register()` **throws on a duplicate pattern**, naming it. With a `Map`, silent overwrite is the
default and one of the two queries would be unreachable with no error anywhere — the same reasoning
behind the duplicate-subject check in `registerService`.

**Interface:**
```ts
class QueryRegistry {
  register(query: Query): this;      // throws on a duplicate pattern
  registerAll(queries: Query[]): this;
  resolve(method: string): Query | null;  // exact match
  patterns(): string[];                   // in registration order
}
```

**Usage:**
```ts
export const queryRegistry = new QueryRegistry().registerAll([
  projectsList, projectsGet, tasksList, tasksGet, commentsList, commentsGet,
]);
```

`patterns()` feeds the `ServiceSpec` of the query service, so a new query becomes a new micro
endpoint without touching `bus/service.ts` or `src/index.ts`.

## QueryDispatcher

**Location:** `core/src/queries/dispatcher.ts`

**Description:** Translates a bus message into the execution of a query. It is a separate object
from the command `Dispatcher`, not a branch of it: four of ADR-003's six rules are about the
transaction, and none has a counterpart here — an `if (isQuery)` inside the command dispatcher is
exactly what that ADR warns against.

Three properties are load-bearing:

- **It opens no transaction.** A read does not need atomicity, and a transaction per request would
  take and hold a snapshot for every query. A query needing consistency across several reads opens
  an explicit `READ ONLY` transaction inside itself.
- **It never throws.** An unknown method answers `unknown_command`; a query that rejects is logged
  and answered `internal_error` with a generic message — the stack never crosses the bus. The
  service's `handle()` is the last net, but the detail is logged here, where *which query* failed is
  known and not just which subject.
- **The connection is injected, not imported.** That is what keeps `queries/` free of any reference
  to the ORM or to `models/read`, lets the tests run against another connection, and makes the
  import of `read.ts` (whose Sequelize reads `process.env` at import time) happen **after** dotenv.

It uses `methodFromSubject()`, not the deprecated `commandFromSubject()`: with two services on the
bus the fifth segment is a method, not always a command.

**Interface:**
```ts
class QueryDispatcher {
  constructor(registry: QueryRegistry, db: Sequelize);
  dispatch(subject: string, raw: unknown): Promise<Reply>; // never rejects
}
```

**Usage:**
```ts
const queries = new QueryDispatcher(queryRegistry, readDb);
const host = new BusHost(commandsSpec, {
  name: QUERY_SERVICE,
  description: 'Consultas de lectura de Jiku: proyectos, tareas y comentarios',
  patterns: queryRegistry.patterns(),
  handle: (subject, payload) => queries.dispatch(subject, payload),
});
```

## EventDispatcher

**Location:** `core/src/events/dispatcher.ts`

**Description:** Translates a bus **event** into the execution of its handler. It is a third,
separate object — not a branch of the command `Dispatcher` nor of the `QueryDispatcher`. An event
differs from a command in **four** ways: there is no `Reply`, there is no `caller` in the subject,
the update semantics are **full replacement** instead of a partial edit, and **`status` does not
exist** to decide the transaction. Four `if`s inside one dispatcher are a different dispatcher.

Four properties are load-bearing:

- **The `instance` guard runs first, before the schema.** Its `warn` prints **both values** — the
  event's and the consumer's. Three different causes give the same symptom ("no event ever
  arrives"): the missing `sub.allow` line, a misaligned subject, and a payload for another
  instance. That one log line is the only thing that separates them.
- **The Joi schema carries `.unknown(true)` on purpose.** It breaks the `validation` convention's
  rule, and it has to: the emitter's schema lives in **another repo** and can grow, so a new field
  cannot take the consumer down. The nine declared fields are the ones core reads; the six ignored
  ones pass through and **`client_ip` and `session` are never persisted**.
- **The transaction opens after all the guards**, so an invalid payload never takes a pool
  connection — the same criterion by which a command's validation runs before the transaction.
- **It never rejects.** `'applied'` commits; anything else, including an exception, rolls back and
  is logged. Opening the transaction has its own `try`, and the rollback of the catch cannot be the
  source of a rejection either. That is not a precaution: a rejection escaping here would kill the
  subscription's `for await` and **core would stop receiving events forever**, with a single error
  in the log and no healthcheck noticing.

**The log never prints the payload** — only the identity's `id` and the outcome. The payload
carries `email`, `client_ip` and a session id.

**Interface:**
```ts
class EventDispatcher {
  constructor(handler: EventHandler<AuthEvent>);
  dispatch(raw: unknown): Promise<void>; // never rejects
}
```

**Usage:**
```ts
const events = new EventDispatcher(syncUser);
const host = new BusHost(commandsSpec, queriesSpec).withEventConsumer({
  subject: authEventSubject(),
  handle: (payload) => events.dispatch(payload),
});
```
