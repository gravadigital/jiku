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

Since S-022 it also has **`validate()`**, in the **same shape as `Command`** (`validation`
convention): it returns `{ value }` or `{ error: Reply<never> }`, never throws, and **never touches
the database**. The dispatcher calls it before `execute`, for the same reason it runs before opening
the transaction on the command plane: an invalid payload must not cost a connection from the pool.

**Interface:**
```ts
interface Query<TPayload = any, TData = unknown> {
  /** Method pattern, WITHOUT `{param}`: `projects.list`, `tasks.get`. */
  readonly pattern: string;
  validate(payload: unknown): { value: TPayload } | { error: Reply<never> };
  execute(payload: TPayload, ctx: QueryContext): Promise<Reply<TData>>;
}
```

**Usage:** a resource with a contract is almost entirely declarative — the spec says *what* can be
asked for, the engine knows *how* to serve it:
```ts
export const tasksGet: Query<ValidatedGetQuery> = {
  pattern: 'tasks.get',
  validate: (payload: unknown) => validateGet(tasksSpec, payload),
  execute: (payload, ctx) => runGet(tasksSpec, payload, ctx),
};
```

## QueryContext

**Location:** `core/src/queries/types.ts`

**Description:** What a query receives besides its payload. **The two absences are the contract:**

- **No `transaction`.** The query dispatcher opens none (RF-9). A read does not need atomicity, and a
  transaction per request would take and hold a snapshot for every query. A query that needs
  consistency across several reads opens an explicit `READ ONLY` transaction inside itself.
- **No `params`.** Query patterns carry no `{param}`, so a `params` here would always be empty and
  would suggest that an `{id}` can be added to a pattern. It cannot.

`db` is the read-only connection, **injected** rather than imported: that is what keeps `queries/`
free of any reference to the ORM or to `models/read`, and what lets the tests run the dispatcher
against another connection.

`budgetBytes` (S-022) is the **page byte budget**, resolved **per request** from
`nc.info.max_payload`. It is **optional on purpose**: a `QueryDispatcher` built without a budget
provider — the shape S-013 shipped — produces exactly the context it always did, and the engine
resolves the absence with `DEFAULT_PAYLOAD_BUDGET_BYTES`.

`callerClass` (S-023) is **mandatory**, and the mandate is the point: a context without a class
would be a context without a clip, i.e. the open failure the external-mode clip exists to prevent.
It is resolved **once per request** in the dispatcher from `users.roles`, so **no resource spec ever
queries `users` again** to find out what to clip.

**Interface:**
```ts
type CallerClass = 'connector' | 'internal' | 'external';

interface QueryContext {
  /** Service that published the message, read from the subject. */
  caller: string;
  /** What the service clips for this caller. Resolved ONCE, in the dispatcher. */
  callerClass: CallerClass;
  /** READ-ONLY connection. Injected so the module never imports `models/read`. */
  db: Sequelize;
  /** Page byte budget, resolved per request. Absent when no provider was wired. */
  budgetBytes?: number;
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

## ResourceSpec

**Location:** `core/src/queries/types.ts`

**Description:** The shape of a **resource spec** — the data structure that describes everything the
query engine needs to know about one resource. It is the central design decision of REQ-006: the
spec is **data, not imperative code**, so the 17 remaining resources are specs that get *written*,
not engines that get *reimplemented*, and `meta.describe` (S-028) can be derived from the very same
allow-lists that validate the queries. If the spec were code, that guarantee would not be verifiable.

It declares: `table` (the contract ↔ database translation, ADR-004), `base`, `includable` (each entry
with `kind: 'field' | 'relation'`, and collections with their cap and truncation flag), `filterable`,
`sortable`, `defaults`, `enums`, `truncatable`, `externalScope` and `notFoundCode`.

Each allow-list exists **twice**: the map (`filterable`) to resolve a name, and the name array
(`filterableNames`) to answer it in `errorDetails.allowed`. The array is **derived from the map with
`Object.keys`**, not written by hand — so it is *the same list*, and the validator can return it by
reference instead of a copy that drifts.

**Interface (abridged):**
```ts
interface ResourceSpec {
  readonly name: string;        // `tasks` — the contract name
  readonly table: string;       // `objectives` — the real table
  readonly base: Record<string, BaseFieldSpec>;
  readonly includable: Record<string, IncludableSpec>;   // field | one-relation | many-relation
  readonly filterable: Record<string, FilterableSpec>;   // column | via (subquery) | search
  readonly sortable: Record<string, SortableSpec>;
  readonly baseNames / includableNames / fieldNames / filterableNames / sortableNames: string[];
  readonly defaults: { sort: readonly string[] };
  readonly enums: Record<string, readonly string[]>;
  readonly truncatable: readonly string[];               // unbounded text the budget may cut
  readonly externalScope: ExternalScopeSpec;             // declaring it IS applying it (S-023)
  readonly notFoundCode: string;
  readonly notFoundMessage: string;
}
```

**Usage:** adding a resource is writing one of these — see `core/src/queries/tasks/tasks-spec.ts`.

## CallerClass / ExternalScopeSpec

**Location:** `core/src/queries/types.ts`

**Description:** The two types the external-mode clip is made of.

`CallerClass` says **what the service clips** for a caller: `connector` clips nothing (the caller
authorises on its own, which is what the api does with `validateProjectPermissions` before reading),
`internal` clips nothing at row level (an explicit v1 decision, RF-23), and `external` clips whatever
the resource's spec declares. It is resolved from `users.roles` by `resolveCallerClass`.

`ExternalScopeSpec` is that declaration, and **declaring the clip is applying it**: there is no
boolean. Until S-023 the spec carried an `applied` flag the engine never read, and that shape has a
problem that is not stylistic — while it exists, a resource can declare its clip and switch it off
with a forgotten `false`, and the 17 resources that follow copy the shape from `tasks`. Removing the
field makes the dangerous state **unrepresentable**.

All of its names are **database columns**, not contract fields: only names the spec declares as
columns may reach the SQL (ADR-004), so the engine never has to resolve `visibilityLevel` against
`base`/`filterable` at build time — a lookup that could only fail in production.

**Since S-024 it is a union discriminated by `kind`**, because one shape could not express the three
clips the flow declares:

- **`'column'`** — the row **carries** the project in one of its columns. `visibility` is
  **optional**, and its absence means *"this resource has no visibility column"*, never *"do not
  clip"*: the permitted-projects predicate is emitted either way. `requirements` and `tasks` use it
  with visibility; `projects` uses it without, clipping by its **own `id`**.
- **`'exists'`** — the row does **not** carry the project and is only **reachable** from a table that
  does. `clients` is the case, and it is the clip that is easiest to forget: an actor has no
  `project_id`, its visibility depends on **having at least one permitted project**, so the SQL is an
  `EXISTS` over `projects` crossed with `user_project_permissions` — **not** an `IN` over a column of
  the actor itself, which does not exist.

The union preserves the property the flag removal bought: **no variant means "do not clip"** and no
optional field disables the gate. The third variant the flow needs — resources with **no external
access**, which resolve to `items: []` without running SQL — is deliberately **not** invented yet:
those specs arrive with S-026 and S-028, and guessing another story's contract is the debt this note
exists to avoid.

**Interface:**
```ts
type CallerClass = 'connector' | 'internal' | 'external';

interface ColumnExternalScope {
  readonly kind: 'column';
  /** Resource column that must be among the caller's permitted projects. */
  readonly projectColumn: string;
  /** Visibility column and the ONLY value an external caller may see. Optional. */
  readonly visibility?: { readonly column: string; readonly value: string };
}

interface ExistsExternalScope {
  readonly kind: 'exists';
  /** Table that DOES carry the project (`projects`, for an actor). */
  readonly table: string;
  /** Column of `table` pointing at the resource (`client_id`). */
  readonly foreignKey: string;
  /** Column of the resource that `foreignKey` points at (`id`). */
  readonly localKey: string;
  /** Column of `table` that must be among the permitted projects (`id`). */
  readonly projectColumn: string;
}

type ExternalScopeSpec = ColumnExternalScope | ExistsExternalScope;
```

**Usage:**
```ts
// requirements / tasks — the row carries the project, and has a visibility column
const REQUIREMENTS_SCOPE: ExternalScopeSpec = {
  kind: 'column',
  projectColumn: 'project_id',
  visibility: { column: 'visibility_level', value: 'public' },
};

// projects — the row IS the project, and there is no visibility column
const PROJECTS_SCOPE: ExternalScopeSpec = { kind: 'column', projectColumn: 'id' };

// clients — indirect: visible if at least one of its projects is permitted
const CLIENTS_SCOPE: ExternalScopeSpec = {
  kind: 'exists',
  table: 'projects',
  foreignKey: 'client_id',
  localKey: 'id',
  projectColumn: 'id',
};
```

## ValidatedListQuery / ValidatedGetQuery / SqlPlan

**Location:** `core/src/queries/engine/types.ts`

**Description:** The query **after validation**: names resolved against the spec, values typed,
operators decided. It is the only thing the SQL builder receives, and it is the structural reason a
name from the payload **cannot** reach the SQL — by this point it has already been rejected.

`ValidatedListQuery` carries the parsed `filter` (AND conditions plus one level of `or` groups), the
`sort` (in order, always ending in `id`), the **effective** `limit`, the returned field set, the
relations to resolve, `count`, and the `scope` that the cursor hash is computed over.

`SqlPlan` is a ready-to-run statement: **the string on one side, the values on the other. Always.**

**Interface:**
```ts
interface SqlPlan {
  readonly sql: string;
  readonly replacements: Record<string, unknown>;
}
```

## IncludableComputedSpec

**Location:** `core/src/queries/types.ts`

**Description:** The **third** shape of includable, added by S-024. An includable used to be either
one more column (`kind: 'field'`) or a relation (`kind: 'relation'`); a computed one is neither — it
is a per-row **SQL expression** that the spec declares as data and the engine puts in the `SELECT`
under the contract's field name.

`expr` is written with the resource table's `t` alias and **comes from the spec, never from the
payload** — the same rule that already governs `ManyRelationSpec.where`, and what lets it reach the
SQL unescaped. It generates **no JOIN**, never enters `query.relations` (so the batch loader ignores
it) and never reaches the `COUNT`, which projects no fields.

`transform` is not a convenience: `SUM(integer)` in PostgreSQL returns `bigint`, and the `pg` driver
hands it over as a **string**. Without it a minutes total travels as `"180"` instead of `180`.

Declaring it includable does **not** make it filterable or sortable: those are independent lists, and
a sortable computed field would force evaluating the expression over the whole universe rather than
the page.

**Interface:**
```ts
export interface IncludableComputedSpec {
  readonly kind: 'computed';
  /** SQL expression using the `t` alias. From the spec, NEVER from the payload. */
  readonly expr: string;
  readonly transform?: (raw: any) => unknown;
}
export type IncludableSpec = IncludableFieldSpec | IncludableComputedSpec | RelationSpec;
```

**Usage:**
```ts
// core/src/queries/requirements/requirements-spec.ts
totalMinutes: { kind: 'computed', expr: TOTAL_MINUTES_EXPR, transform: Number },
```

## FilterableSpec.contains / FilterableSpec.searchNumericColumn

**Location:** `core/src/queries/types.ts`

**Description:** Two filter shapes any spec can declare, both added by S-024 and both generic.

**`contains`** — containment over a `jsonb` column, with the pair shape the spec names. The payload
accepts one object or a **list** of objects, and the list is combined with **`AND`** (RF-7): *"the
ones that have THIS pair AND THAT one"*, not *"either of them"*. The validator requires every key of
`shape`, no key outside it, and a string value for each, and normalises the object **in `shape`
order** — containment does not care about key order, but the parameter value is a string, so a
request with the keys reversed would otherwise produce different text.

Two SQL details that are contract, not style: the value is `JSON.stringify([pair])` — an **array** of
one element, because the column stores an array and `tags @> '{"key":"m"}'` never matches — and the
cast is written **`CAST(:p AS jsonb)` and never `:p::jsonb`**, because Sequelize parses `:name` as a
replacement and `:p0::jsonb` is ambiguous to its regex.

**`searchNumericColumn`** — the column the free-text search **diverts to** when the text is digits
only. Without it, searching `"8140"` runs `ILIKE '%8140%'` over the text columns and does **not**
find record 8140, which is the most frequent use of a search box. The guard is `/^\d{1,9}$/`: an
`INTEGER` column is int4, nine digits always fit, and longer text falls back to the `ILIKE` — which
is also the correct reading (*"that is not an id"*). A spec that does not declare it behaves exactly
as before it existed.

**Interface:**
```ts
readonly contains?: { readonly column: string; readonly shape: readonly string[] };
readonly searchNumericColumn?: string;
```

**Usage:**
```ts
// core/src/queries/requirements/requirements-spec.ts
tag: { contains: { column: 'tags', shape: ['key', 'value'] } },
q: { kind: 'string', search: ['title', 'description'], searchNumericColumn: 'id' },
```
