# Types — `core`

## ServiceSpec

**Location:** `core/src/bus/service.ts`

**Description:** Everything a micro service needs in order to be registered on the bus. Four
members and nothing else, which is what makes `registerService()` reusable across services rather
than tailored to the command one.

`handle` **never throws**: it always resolves to a `Reply`. That is a contract, not a precaution —
if an exception escaped to micro, micro would answer `Empty` with error headers and **the body
would be lost**, and the body is the envelope the api parses.

`patterns` are the command patterns as the registry writes them (`tasks.{id}.edit`), not endpoint
names or subjects: the derivation belongs to `registerService()`.

**Interface:**
```ts
interface ServiceSpec {
  /** Bus name, queue group, and the `{svc}` token of the subject. */
  name: string;
  description: string;
  /** Method patterns: `tasks.{id}.edit`, `clients.new`, … They come from the registry. */
  patterns: string[];
  /** Resolves the request. Never throws: always returns a `Reply`. */
  handle: (subject: string, payload: unknown) => Promise<Reply>;
}
```

**Usage:**
```ts
const commandsSpec: ServiceSpec = {
  name: COMMAND_SERVICE,
  description: 'Comandos de dominio de Jiku: la única vía de escritura a la base',
  patterns: registry.patterns(),
  handle: (subject, payload) => dispatcher.dispatch(subject, payload),
};
```

**The spec is built in `src/index.ts`**, not in a file of its own: that is already the place where
the process is wired, so adding a second service is adding a second object literal to the same
call.

## Query

**Location:** `core/src/queries/types.ts`

**Description:** A read endpoint: a pattern and an `execute`. Two members, mirroring `Command`
without the parts that only make sense for a write.

`pattern` **never carries `{param}`** — `projects.list`, `tasks.get`. The resource id travels in the
payload, not in the subject: the server matches with a trie plus a 1024-entry subject cache, read
traffic is the higher-volume one, and a new subject per id consulted would make that cache useless.
Because of that, `endpointSubject(pattern) === pattern` for every query, and no query subject
contains a `*`.

There is **no `validate()` yet**, and the absence is deliberate: without a query contract
(RF-10 of REQ-004) a Joi schema would invent exactly what the requirement left out of scope. The
requirement that defines the contract adds it, in the same shape as `Command`.

**Interface:**
```ts
interface Query<TData = unknown> {
  /** Method pattern, WITHOUT `{param}`: `projects.list`, `tasks.get`. */
  readonly pattern: string;
  execute(payload: unknown, ctx: QueryContext): Promise<Reply<TData>>;
}
```

**Usage:**
```ts
export const tasksGet: Query<TaskDetail> = {
  pattern: 'tasks.get',
  execute: async (payload, ctx) => {
    const rows = await ctx.db.query<TaskRow>(sql, { type: QueryTypes.SELECT, replacements });
    return success(toDetail(rows));
  },
};
```

## QueryContext

**Location:** `core/src/queries/types.ts`

**Description:** What a query receives besides its payload. **Two members, and the two absences are
the contract:**

- **No `transaction`.** The query dispatcher opens none (RF-9). A read does not need atomicity, and a
  transaction per request would take and hold a snapshot for every query. A query that needs
  consistency across several reads opens an explicit `READ ONLY` transaction inside itself.
- **No `params`.** Query patterns carry no `{param}`, so a `params` here would always be empty and
  would suggest that an `{id}` can be added to a pattern. It cannot.

`db` is the read-only connection, **injected** rather than imported: that is what keeps `queries/`
free of any reference to the ORM or to `models/read`, and what lets the tests run the dispatcher
against another connection.

**Interface:**
```ts
interface QueryContext {
  /** Service that published the message, read from the subject. */
  caller: string;
  /** READ-ONLY connection. Injected so the module never imports `models/read`. */
  db: Sequelize;
}
```

**Usage:** queries read with explicit SQL, never through the ORM — **allow-lists for names,
parameters for values**:
```ts
const rows = await ctx.db.query<ProjectRow>(
  `SELECT id, name FROM projects WHERE client_id = :clientId ORDER BY ${ORDER[order]} LIMIT :limit`,
  { type: QueryTypes.SELECT, replacements: { clientId, limit } }
);
```

## EventSpec

**Location:** `core/src/bus/host.ts`

**Description:** What a **flat event consumer** needs to be mounted on the host's connection. It is
**not** a `ServiceSpec` and cannot be one: micro is request/reply and requires every endpoint to
answer, and `respond()` on a message with **no `reply` subject is a silent no-op** that also
pollutes the `$SRV` counters. An event has nobody to answer.

**Two members, and one absence is the contract:**

- `subject` travels here because it is **contract**: it comes from the protocol package's helper,
  the same symbol the callout's permission template documents. It is the **literal** subject, never
  a wildcard — a wildcard would compile, receive the same thing today, and leave the code asking
  for more permission than the template grants (ADR-008).
- **No `queue`.** The queue group is consumer infrastructure and `start()` reads it from
  `NATS_EVENTS_QUEUE`, where it already reads `NATS_URL` and the rest. Defaults live where the
  variable is read.

**Interface:**
```ts
interface EventSpec {
  /** LITERAL subject. Not a wildcard: the callout's permission is literal. */
  subject: string;
  /** Processes the already decoded payload. If it rejects, the loop's try/catch absorbs it. */
  handle: (payload: unknown) => Promise<void>;
}
```

**Usage:** declared with the fluent `withEventConsumer()`, which **throws if the host already
started** — registering a consumer after `start()` would open no subscription and the symptom would
be "no event ever arrives":
```ts
const host = new BusHost(commandsSpec, queriesSpec).withEventConsumer({
  subject: authEventSubject(),
  handle: (payload) => events.dispatch(payload),
});
```

## EventContext

**Location:** `core/src/events/types.ts`

**Description:** What an event handler receives besides its payload. **One member, and the three
absences are the contract:**

- **No `caller`.** The event's subject has three segments and carries none: the identity travels in
  the payload, because the event is **about** an identity rather than published **by** one on its
  behalf.
- **No `params`.** The subject is literal; there is no `{param}` to extract.
- **No `commit` / `rollback`.** The same structural impossibility as ADR-003: the transaction
  belongs to the dispatcher, so a handler cannot leave a half-written change by forgetting a
  rollback.

**Interface:**
```ts
interface EventContext {
  transaction: Transaction;
}
```

## EventHandler / EventOutcome

**Location:** `core/src/events/types.ts`

**Description:** An event handler takes the **already validated** payload plus the context and
resolves to an `EventOutcome`. That outcome is **the discriminant that replaces `reply.status`**:
ADR-003 says "commit if the reply is success, roll back in any other case", and here there is no
reply — an event is not answered. The guarantee is the same, the discriminant is not.

A handler **never throws to signal an expected case** — it returns `'discarded'`, the same way a
command signals failure with a `Reply` rather than an exception. A database exception does travel
up: the dispatcher catches it and rolls back.

**Interface:**
```ts
type EventOutcome = 'applied' | 'discarded';

type EventHandler<TPayload> = (
  payload: TPayload,
  ctx: EventContext
) => Promise<EventOutcome>;
```

**Usage:**
```ts
export async function syncUser(event: AuthEvent, ctx: EventContext): Promise<EventOutcome> {
  const existing = await User.findByPk(event.id, { transaction: ctx.transaction });
  // ... create or update, always with { transaction: ctx.transaction }
  return 'applied';
}
```
