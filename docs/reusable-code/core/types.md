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

**Since S-024 it is a union discriminated by `kind`**, because one shape could not express the
clips the flow declares — and S-025 added a third variant plus two optional fields:

- **`'column'`** — the row **carries** the project in one of its columns. `visibility` is
  **optional**, and its absence means *"this resource has no visibility column"*, never *"do not
  clip"*: the permitted-projects predicate is emitted either way. `requirements` and `tasks` use it
  with visibility; `projects` uses it without, clipping by its **own `id`**.
- **`'exists'`** — the row does **not** carry the project and is only **reachable** from a table that
  does. `clients` is the case, and it is the clip that is easiest to forget: an actor has no
  `project_id`, its visibility depends on **having at least one permitted project**, so the SQL is an
  `EXISTS` over `projects` crossed with `user_project_permissions` — **not** an `IN` over a column of
  the actor itself, which does not exist.

  **S-025 gave it two optional visibilities**, and `comments` and `activity` require **both**:
  `visibility` goes **inside** the `EXISTS` (the owning entity has to be `public`) and
  `ownVisibility` **outside** it (the row itself has to be `public`). The second half is not
  decoration: `objective_activity.visibility_level` exists exactly for this — a comment is the only
  activity type whose visibility the **user chooses** — and its default is `internal`. Without it,
  an internal comment on a public task is visible from the client portal and the column serves no
  purpose. Both are optional with the same rule as `ColumnExternalScope.visibility`: absence means
  *"this table has no visibility column"*, never *"do not clip"*.
- **`'owner'`** (S-025) — **the row belongs to the caller**: `user_id = :caller`, and nothing else.
  `subscriptions` is the case, and it carries **no project predicate on purpose**: knowing what
  *you* subscribed to does not depend on holding permission over the entity's project. Adding it
  "for symmetry" would **hide the caller's own data** — an external caller subscribed to something
  in a project they no longer see would stop seeing their own subscription, with no error and no
  log. And the other way round: knowing **who else** is subscribed to a requirement is internal-team
  information, which is why the clip is "mine" and not "the ones in projects I can see".
- **`'none'`** (S-026) — **no external access at all**, and the only variant that is **not a
  predicate**: the other three **narrow** the set and this one **empties** it. The engine therefore
  **cuts before querying** (`deniesAllRows`) instead of building SQL that cannot return anything, so
  the answer costs **zero SQL**. `worked-times`, `unworked-times` and `week-assigned-times` are the
  first three cases and `settings` (S-028) the fourth. **It is not an error, and the difference is
  contractual**: a `caller_not_authorized` would say *"the resource exists and is barred to you"* and
  an `unknown_caller` *"you do not exist"*; `items: []` says *"there is nothing for you"* — the only
  one that does not leak the resource's existence, and the one that spares the consumer branching by
  caller class to tell "empty" from "forbidden". It **carries no field**, and not carrying one is the
  property: an `enabled` or an `except` would make a "no access" that does grant access
  representable. `externalScopeSql` still emits `FALSE` for it as **defence in depth** — not the
  mechanism, but what keeps a future path that skips the cut from publishing the whole table.

**S-026 also gave `ExistsExternalScope` an `orSelfColumn`**: *"the row whose column is the caller
always enters, even when the `EXISTS` does not reach it"*. `users` is its only consumer and it is
CA-14 of that story — without it an external caller holding no project permission, which is the state
of a client just created, could not even resolve **their own name**. It is a **named clause and not
an open composition of clips** because `OR` is a **widening** operator: an `any: [scopeA, scopeB]`
would make a clip that *broadens* access representable, and the property S-023 established is that
the dangerous state stays unrepresentable. **The engine emits the group parenthesised**: the clip is
joined to the rest of the `WHERE` with `AND`, and a top-level `OR` is swallowed by precedence —
`A OR B AND C` reads `A OR (B AND C)` and the clip stops clipping. It does not show in the case
without an extra filter, which is the one tried first; it appears with a filter on top.

The union preserves the property the flag removal bought: **no variant means "do not clip"** and no
optional field disables the gate.

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
  /** Visibility on the REACHED table. Optional. */
  readonly visibility?: { readonly column: string; readonly value: string };
  /** Visibility on the resource's OWN row, required on top of the owner's. Optional. */
  readonly ownVisibility?: { readonly column: string; readonly value: string };
  /** S-026: the caller's own row always enters. Emitted PARENTHESISED. */
  readonly orSelfColumn?: string;
}

interface OwnerExternalScope {
  readonly kind: 'owner';
  /** Resource column holding the id of the row's owning user. */
  readonly userColumn: string;
}

/** S-026: no external access. Carries no field, and that is the property. */
interface NoneExternalScope {
  readonly kind: 'none';
}

type ExternalScopeSpec =
  | ColumnExternalScope
  | ExistsExternalScope
  | OwnerExternalScope
  | NoneExternalScope;
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

// users (S-026) — the ones in projects I can see, PLUS MYSELF
const USERS_SCOPE: ExternalScopeSpec = {
  kind: 'exists',
  table: 'user_project_permissions',
  foreignKey: 'user_id',
  localKey: 'id',
  projectColumn: 'project_id',
  orSelfColumn: 'id',
};

// worked-times / unworked-times / week-assigned-times (S-026) — no external access at all
const WORKED_TIMES_SCOPE: ExternalScopeSpec = { kind: 'none' };

// attachments (S-027) — POLYMORPHIC: which table to look at is decided by a column's VALUE
const ATTACHMENTS_SCOPE: ExternalScopeSpec = {
  kind: 'polymorphic',
  typeColumn: 'entity_type',
  idColumn: 'entity_id',
  branches: ATTACHMENT_ENTITY_OWNERS,
};

// files (S-027) — BRIDGE: visible through its live links, or, with none, only to whoever uploaded it
const FILES_SCOPE: ExternalScopeSpec = {
  kind: 'bridge',
  table: 'attachments',
  foreignKey: 'file_id',
  localKey: 'id',
  liveWhere: 'br_.deleted_at IS NULL',
  through: ATTACHMENTS_SCOPE,
  orOrphanColumn: 'uploaded_by',
};
```

### PolymorphicExternalScope / BridgeExternalScope / AttachmentOwner (S-027)

The fifth and sixth shapes of the clip, and both are **generic**: `engine/` names no resource.

**`polymorphic`** — the row points at an entity **whose type decides which table to look at**.
`ExistsExternalScope` carries ONE `table`; a polymorphic FK-less table needs one per value. It is
**not** a discriminator: a `DiscriminatorSpec` picks the RESOURCE's table and is mandatory in the
payload, while here the resource's table never changes and the type is a **column whose value
varies per row**. The engine emits it as **one branch per entry of `branches`, the whole group
PARENTHESISED**: the clip is prepended to the `WHERE` and joined with AND, so `A OR B AND C` reads
`A OR (B AND C)` and **the clip stops clipping**. A type absent from `branches` passes no branch, so
the row is not seen — deny-by-default with no line excluding it.

**`bridge`** — the row is visible through its **bridge rows**, and, when it has **no live one**, by
being its own. **The orphan branch is NOT `orSelfColumn`, and the difference is a security one:**
`orSelfColumn` enters ALWAYS, this one only when the positive `EXISTS` is empty. With the wide
semantics, a file with a live link to an entity the caller cannot see would be visible to whoever
uploaded it. `liveWhere` comes from the spec and appears in **both** subqueries, taken from the same
variable: if they differed, a row would pass neither branch.

**`AttachmentOwner`** is declared in `core/src/queries/entity-type.ts` — it is **data** of the query
plane, and that file imports nothing from the engine — and re-exported from `types.ts` so the engine
consumes it as a type of the plane and not as a resource's data.

**Interface:**
```ts
export interface PolymorphicExternalScope {
  readonly kind: 'polymorphic';
  readonly typeColumn: string;
  readonly idColumn: string;
  readonly branches: Readonly<Record<string, AttachmentOwner>>;
}

export interface BridgeExternalScope {
  readonly kind: 'bridge';
  readonly table: string;
  readonly foreignKey: string;
  readonly localKey: string;
  readonly liveWhere?: string;
  readonly through: PolymorphicExternalScope;
  readonly orOrphanColumn?: string;
}
```

The engine's fixed aliases are `t`, `rel_*`, `r`, `j`, `scope_`, plus `scope_owner_` (the jump to
the owner inside a branch) and `br_` (the bridge row). None comes from a spec or a payload.

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


## DiscriminatorSpec / ResourceVariant

**Location:** `core/src/queries/types.ts`

**Description:** A resource that resolves against **more than one table**, chosen by a mandatory
contract field. Added by S-025 for `comments`, `activity` and `subscriptions`, and reused by S-027
(`attachments.list`) and S-028 (`meta.describe`, which has to describe the variants).

**It is NOT a filter with a default, and the difference is not stylistic.** The ids of
`objective_activity` and `requirement_activity` **overlap**: 1234 exists in both and they are
different rows. A default would make `comments.get {id: 1234}` return "some" comment, and the bug
would be **silent and intermittent** — it works until both tables grow enough. That is why the type
has **no `default` field**: the dangerous state is not representable.

**A variant may override only what depends on the TABLE** — `table`, `where`, `base`, `includable`,
`filterable`, `enums`, `externalScope`. `name`, `defaults`, `sortable`, `truncatable` and the two
not-found fields are **deliberately absent**: if two variants could declare different contracts,
`meta.describe` would have to describe two resources and the caller would need to know which one
applies **before asking**.

In a `list` the discriminator travels inside `filter`; in a `get`, as a **top-level key** of the
payload. Its absence is `invalid_fields` in both, and the `get`'s allowed-keys list is **derived**
from the spec so `errorDetails.allowed` says so.

**Interface:**
```ts
export interface ResourceVariant {
  readonly table: string;
  readonly where?: string;
  readonly base?: Readonly<Record<string, BaseSpec>>;
  readonly includable?: Readonly<Record<string, IncludableSpec>>;
  readonly filterable?: Readonly<Record<string, FilterableSpec>>;
  readonly enums?: Readonly<Record<string, readonly string[]>>;
  readonly externalScope?: ExternalScopeSpec;
}

export interface DiscriminatorSpec {
  readonly field: string;
  readonly values: readonly string[];
  readonly variants: Readonly<Record<string, ResourceVariant>>;
}
```

**Usage:**
```ts
// core/src/queries/comments/comments-spec.ts
discriminator: {
  field: 'entityType',
  values: ENTITY_TYPES,
  variants: { task: variantFor('task'), requirement: variantFor('requirement') },
},
```

## BaseSpec / BaseConstantSpec / ResourceSpec.where

**Location:** `core/src/queries/types.ts`

**Description:** The three capabilities S-025 added to the base set and to the resource, all of them
**generic** — no line of `src/queries/engine/` names a resource.

**`ResourceSpec.where` — the resource's FIXED predicate.** `comments` is `objective_activity` with
`type_of_activity = 'comment'`; `activity` is **that same table without it**, and the whole
difference between the two resources is this one field. **It cannot be solved with a filter:** a
filter can be overwritten from the payload and the resource's predicate is not negotiable. It is
emitted in **all three** statements — rows, COUNT and get: forgetting it in the COUNT would make the
total count rows the collection does not return, and forgetting it in the `get` would let
`comments.get` resolve a `state` row. It comes from the spec, **never** from the payload, which is
why it reaches the SQL unescaped — the same rule that already governs `ManyRelationSpec.where`.

**`BaseConstantSpec` — a base field whose value the spec fixes.** `entityType` is the case: the
value is decided by the **variant** and no column carries it. It is resolved **in the projection**
and not in the SELECT on purpose: putting the literal in the SQL would work, but it would place a
spec value inside the query string for no reason, and the module's rule is that only **names** reach
the SQL. Declaring it does not make it filterable or sortable — those are independent lists.

**A relation in the base set.** `comments.attachments` is the declared exception to RF-17: the
attachments ship **in the base**, not in `include`, because a comment with an attachment and no
reference renders wrong. Four places used to assume a `base` entry had `.column` — `selectParts`,
`projectRow`, `attachCollections` and `parseProjection` — and now all four resolve the name through
`specFor()`.

**Interface:**
```ts
export interface BaseConstantSpec { readonly constant: unknown; }
export type BaseSpec = BaseFieldSpec | BaseConstantSpec | RelationSpec;
```

**Usage:**
```ts
// core/src/queries/comments/comments-spec.ts (inside the variant)
where: 't.type_of_activity = \'comment\'',
base: {
  entityType: { constant: entity },
  entityId: { column: tables.entityColumn },
  attachments: { kind: 'relation', cardinality: 'many', table: 'attachments', … },
},
```

## ResourceSpec.joins / FixedJoinSpec / BaseFieldSpec.from

**Location:** `core/src/queries/types.ts`

**Description:** A **fixed JOIN declared by the spec**, plus the `from` that qualifies a column with
its alias (S-027). It exists because the resource's table does **not carry every field of the
contract**: `attachments` is the link — `entity_type`, `entity_id`, `file_id` — and the contract
also asks for the file's name, size, type, uploader and byte status, **flattened onto the link**.

None of the three `BaseSpec` shapes could produce that. `BaseFieldSpec` always emitted against `t`,
and a 1:1 `RelationSpec` projects **nested** under the field's key, which is a different contract.

**It is not a relation and it is not projected:** it appears in neither `base` nor `includable`, has
no fields of its own and produces no key in the item. It is only one more table in the `FROM`, so
the fields that name it with `from` can come out of it.

**`on` and `alias` come from the spec, never from the payload** — the same rule that already governs
`ManyRelationSpec.where` and `IncludableComputedSpec.expr`.

**It goes in ALL THREE statements** — rows, COUNT and `get`. Forgetting the COUNT is the real
failure mode: `resource.where` may name the alias, and a COUNT without the JOIN fails with
`missing FROM-clause entry`. Since the default is `count: false`, that bug would not surface until
somebody asked for the total.

**`SortableSpec` deliberately has no `from`:** ordering by a joined table's column would make the
keyset compare against it, and the walk would stop using the resource's own index.

**Interface:**
```ts
export interface FixedJoinSpec {
  readonly table: string;
  readonly alias: string;
  readonly on: string;
  readonly kind: 'INNER' | 'LEFT';
}

// BaseFieldSpec (and, through it, IncludableFieldSpec) and FilterableSpec both gain:
readonly from?: string;   // absent means "the resource's table", never "I don't know"
```

**Usage:**
```ts
// core/src/queries/attachments/attachments-spec.ts
const JOINS = [{ table: 'files', alias: 'f', on: 'f.id = t.file_id', kind: 'INNER' }];
const BASE = { fileName: { column: 'file_name', from: 'f' }, … };
const FILTERABLE = { uploadedBy: { column: 'uploaded_by', from: 'f', kind: 'string' } };
```

A spec **without** `joins` produces exactly the same SQL as before, character for character.

## EnumEntry / EnumSpec

**Location:** `core/src/queries/types.ts`

**Description:** An enum entry of a resource spec: a plain string, or `{ value, label }`.

**The two shapes coexist on purpose.** A spec that declares only values — the shape every spec had
from S-022 to S-027 — stays valid and does not change a character; the one that needs a label
declares `{ value, label }` **in the same position**, so the order of the values, which is part of
the contract's response, is untouched.

**The label lives next to the value and not in a separate map**, and that is the central decision of
S-028. An `ENUM_LABELS` map on the side is exactly the parallel structure the story's main risk
describes: it desyncs in silence and `meta.describe` — which is DERIVED from this very structure —
starts lying. With the label in the spec there are no two copies to keep in sync.

`errorDetails.allowed` **is still a list of strings**: the validator projects to `value` at the point
where it builds the detail (`enumValues()`), so the error catalog does not change shape.

Without a label, `meta.describe` **falls back to the raw value**. A `label: undefined` in the
response would be worse than the value: it would force every consumer to handle the case.

**Interface:**
```ts
type EnumEntry = string | { readonly value: string; readonly label: string };
type EnumSpec = readonly EnumEntry[];

// in ResourceSpec and ResourceVariant
readonly enums: Readonly<Record<string, EnumSpec>>;
```

**Usage:**
```ts
// core/src/queries/unworked-times/unworked-times-spec.ts — the only spec with declared labels
const ENUMS = {
  reason: [
    { value: 'tramite', label: 'Trámite' },
    { value: 'corte_servicios', label: 'Cortes de servicios' },
    // …
  ],
} as const;

// core/src/queries/tasks/tasks-spec.ts — values only, unchanged
const ENUMS = { state: ['backlog', 'activo', 'en_revision', 'finalizado', 'cancelado'] } as const;
```

## FieldDescription / FilterDescription / ResourceDescription

**Location:** `core/src/queries/meta/describe-spec.ts`

**Description:** The shape of **the contract as data**: what `meta.describe` returns per resource.

A resource with a discriminator is described **per variant** (`discriminator` + `variants`), because
its spec is not complete until the variant is resolved: `activity.enums.type` is overridden whole per
variant and `filterable.entityId` points at a different column in each. `sortable` and `defaults` sit
at the **resource** level, because `ResourceVariant` cannot override them — publishing them per
variant would suggest a freedom the spec does not have.

**Interface:**
```ts
interface FieldDescription {
  kind: 'field' | 'constant' | 'computed' | 'relation';
  cardinality?: 'one' | 'many';
  fields?: readonly string[];       // the NAMES of the relation's fields
  optional?: boolean;
  cap?: number;                     // only if the spec declares one
  truncatedFlag?: string;
  scalar?: string;
}

interface FilterDescription {
  kind: string;                     // the spec's `kind`, defaulting to 'string'
  enum?: string;                    // the name of the enum in `enums`
  search?: boolean;                 // WHAT it does; never WHERE it searches
  searchNumeric?: boolean;          // free text that is all digits searches BY ID
  contains?: { shape: readonly string[] };
}

interface ResourceDescription extends Partial<VariantDescription> {
  sortable: readonly string[];
  defaults: { sort: readonly string[]; limit: number; maxLimit: number };
  discriminator?: { field: string; values: readonly string[] };
  variants?: Readonly<Record<string, VariantDescription>>;
}
```

**Usage:**
```jsonc
// meta.describe { "resources": ["tasks"] }
{ "base": { "id": { "kind": "field" }, … },
  "includable": { "comments": { "kind": "relation", "cardinality": "many",
                                "cap": 10, "truncatedFlag": "commentsTruncated" } },
  "filterable": { "state": { "kind": "enum", "enum": "state" } },
  "sortable": ["title", "state", "priority", "finishedAt", "createdAt", "updatedAt"],
  "defaults": { "sort": ["-createdAt"], "limit": 50, "maxLimit": 200 },
  "enums": { "state": [{ "value": "backlog", "label": "backlog" }, …] } }
```
