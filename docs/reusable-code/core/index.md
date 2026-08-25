# Reusable Code Index — `core`

> Partial catalog. It was seeded by story S-002 with the reusable elements that story created;
> it is **not** a full scan of the service. Run `/service-update-reusable-code core` to complete it.

**Last updated:** 2026-08-24 (S-024)

## Utils

Total: 13

- **authorizeCaller** (`core/src/authorize-caller.ts`) - The authorisation gate of both dispatchers: exempts the api's channel by `sub`, otherwise reads `users.roles` and authorises the caller against a closed deny-by-default map. Never throws and fails closed. Since S-023 it is the composition of `readCallerRoles` + `authorizeWithRoles`, with unchanged behaviour.
- **readCallerRoles** (`core/src/authorize-caller.ts`) - The read on its own: `User.findByPk(caller)` plus the `Array.isArray` guard for the unchecked `JSONB`. Extracted so the query plane can feed BOTH gates with a single `SELECT`. Does not catch: the caller decides.
- **authorizeWithRoles** (`core/src/authorize-caller.ts`) - The decision on its own, without touching the database: the `sub` exemption, then `rolesAuthorize()`, and on refusal the single `[auth]` warn plus the shared `caller_not_authorized` failure.
- **resolveCallerClass** (`core/src/queries/caller-class.ts`) - The second gate of the query plane: maps the caller's roles to `connector` / `internal` / `external`, or `null` when none produces a class. The most restrictive wins and the array's order does not decide. Pure, no cache, no state.
- **rolesAuthorize** (`core/src/authorize-caller.ts`) - Pure predicate behind the gate: does any of the caller's roles authorise this method on this plane? Union semantics, not precedence.
- **matchesPattern** (`core/src/commands/registry.ts`) - Does a method name match a `{param}` pattern? Extracted from `CommandRegistry.resolve()` so the authorisation gate can match without resolving the command.
- **resolveActor** (`core/src/commands/resolve-actor.ts`) - Resolves who the actor of a command is depending on whether the api or an external publisher published it. Shared by seven commands; moved up from `commands/files/` in S-003.
- **linkFiles** (`core/src/commands/link-files.ts`) - Links `fileIds` to an already existing entity: resolves the actor, validates existence, liveness and ownership, marks the bytes uploaded and inserts one `attachments` row per file. Additive mode, for creation commands.
- **syncFileLinks** (`core/src/commands/link-files.ts`) - Same validation as `linkFiles` but with complete-set semantics for edit commands: preserves the rows of the links that stay and hard-deletes the ones no longer declared.
- **readFileSettings** (`core/src/commands/files/settings.ts`) - Reads the five file-policy keys from `system_settings` with code-level defaults, inside the command's transaction.
- **buildStorageKey** (`core/src/commands/files/storage.ts`) - Builds the storage object key `{prefix}/f/{uuid}{ext}`; the uploader never chooses where the file is stored.
- **contentDisposition** (`core/src/commands/files/storage.ts`) - Builds an escaped `Content-Disposition` header value safe to carry a user-supplied file name.
- **keyValuePairsToProperties** (`core/src/commands/projects/properties.ts`) - The READ half of the `properties` ↔ `key_value_pairs` translation: turns the column's flat object into the contract's `[{code, value}]` list. An absent or `NULL` column yields `[]`, never `null`, and it does NOT filter by the write-side allow-list. Lives next to its inverse so the two planes share one map.

## Services

Total: 8

- **StorageSigner** (`core/src/commands/files/storage.ts`) - Lazily built S3 signer exposing exactly two local (no-network) operations: sign a PutObject and sign a GetObject.
- **BusHost** (`core/src/bus/host.ts`) - Opens ONE NATS connection and registers N micro services on it, in series, with an ordered shutdown. `maxPayload()` exposes the server's `max_payload` for the query page byte budget. Takes the specs as varargs, so mounting a second service is adding one element. `withEventConsumer()` adds a FLAT subscription (with queue group) on the same connection, drained between the services and the connection.
- **registerService** (`core/src/bus/service.ts`) - Registers a micro service from a `ServiceSpec` on an existing connection: one endpoint per command pattern, own queue group, and a duplicate-subject check that fails startup.
- **readDb** (`core/src/models/read.ts`) - The READ-ONLY Sequelize connection of the query service, built WITHOUT registering the models on purpose: registering them in the same process would reassign the `@jiku/models` classes and break ADR-001 with no symptom. Own pool ceiling and own `statement_timeout`.
- **QueryRegistry** (`core/src/queries/registry.ts`) - Maps a query method to the query that serves it. Exact `Map` matching, not segment matching: query patterns carry no `{param}`. Registering a duplicate pattern throws.
- **QueryDispatcher** (`core/src/queries/dispatcher.ts`) - Translates a bus subject into a query execution WITHOUT opening a transaction, injecting the read-only connection into the context. Runs TWO gates off a SINGLE `SELECT` on `users` — the method gate (`caller_not_authorized`) and the caller class gate (`unknown_caller`) — before resolving the method, then calls `validate()` before `execute` and resolves the page byte budget per request from a lazy provider. Never throws: it always resolves to a `Reply`.
- **The query engine** (`core/src/queries/engine/`) - ONE generic engine that serves any resource with a `ResourceSpec`: grammar validation against the spec, keyset cursor, explicit SQL builder, projection with contract translation, batched `include`, byte budget and the PostgreSQL timeout capture. A new read endpoint is a spec plus two ~5-line files.
- **EventDispatcher** (`core/src/events/dispatcher.ts`) - Translates a bus EVENT into the execution of its handler: guards (`instance`, `type`, `version`, the four required fields) with Joi `.unknown(true)`, then the transaction, and an `outcome` instead of a `reply.status` to decide commit/rollback. Resolves to `void` and never rejects — a rejection would kill the subscription's `for await`.

## Types

Total: 11

- **ServiceSpec** (`core/src/bus/service.ts`) - What a micro service needs to be registered: bus name, description, the command patterns, and a `handle` that never throws.
- **Query** (`core/src/queries/types.ts`) - A read endpoint: a `pattern` without `{param}`, a `validate(payload)` in the same shape as `Command` (never touches the database) and an `execute(payload, ctx)` that resolves to a `Reply`.
- **QueryContext** (`core/src/queries/types.ts`) - What a query receives: the `caller` read from the subject, the mandatory `callerClass` resolved once in the dispatcher, the read-only `db` connection and the optional per-request `budgetBytes`. It has NO `transaction` and NO `params`, and both absences are the contract.
- **CallerClass / ExternalScopeSpec** (`core/src/queries/types.ts`) - What the service clips for a caller, and the resource's declaration of the external-mode clip. Since S-024 `ExternalScopeSpec` is a union discriminated by `kind`: `'column'` when the row CARRIES the project (with optional `visibility`) and `'exists'` when the row is only REACHABLE from a table that carries it. Declaring the clip IS applying it: no variant means "do not clip" and no optional field disables the gate, so the dangerous state stays unrepresentable. All of its names are database columns, not contract fields.
- **ResourceSpec** (`core/src/queries/types.ts`) - A resource as DATA, not code: table translation, base set, includables, filterables, sortables, defaults, enums and the external scope, which the engine applies. The validator reads these very lists, and `meta.describe` (S-028) derives from them without a second copy.
- **IncludableComputedSpec** (`core/src/queries/types.ts`) - The THIRD shape of includable (S-024): neither a column nor a relation but a per-row SQL EXPRESSION, declared by the spec and aliased with the contract's field name. Generates no JOIN and never reaches the COUNT. Its `transform` is not a convenience: `SUM(integer)` comes back from `pg` as a string.
- **FilterableSpec.contains / .searchNumericColumn** (`core/src/queries/types.ts`) - Two filter shapes any spec can declare (S-024): containment over a `jsonb` column with the pair shape the spec names — one predicate per pair, ANDed, rendered as `CAST(:p AS jsonb)` because `::` collides with Sequelize's `:name` parser — and the numeric detour that turns a digits-only free-text search into an equality on the declared column, guarded to nine digits so an int4 column cannot overflow.
- **ValidatedListQuery / ValidatedGetQuery / SqlPlan** (`core/src/queries/engine/types.ts`) - The query after validation — names resolved, values typed, operators decided — and a ready-to-run statement with the string on one side and the values on the other.
- **EventSpec** (`core/src/bus/host.ts`) - What a flat event consumer needs: the LITERAL subject and a `handle(payload)`. No `queue` (that is read by `start()`), and it is NOT a `ServiceSpec`: an event has nobody to answer.
- **EventContext** (`core/src/events/types.ts`) - What an event handler receives: `transaction` and NOTHING else. No `caller` (the 3-segment subject does not carry one), no `params` (the subject is literal), no `commit`/`rollback` (ADR-003).
- **EventHandler / EventOutcome** (`core/src/events/types.ts`) - An event handler takes the validated payload plus the context and resolves to `'applied'` or `'discarded'` — the discriminant that replaces `reply.status` when there is no reply.

## Constants

Total: 4

- **ROLE_METHODS** (`core/src/authorize-caller.ts`) - The role → method map of the bus: closed, deny-by-default and the complete table of the roles that may connect. Mirrors the 9 subjects of the external connector's callout template.
- **CLASS_BY_ROLE** (`core/src/queries/caller-class.ts`) - The role → class map of the query plane plus its precedence (`external` > `internal` > `connector`). Closed and deny-by-default, and deliberately NOT derived from `ROLE_METHODS`: coupling them would let a permissions change silently move a data clip.
- **Config accessors** (`core/src/config.ts`) - `loadConfig()` / `getTrustedPublisherId()`: startup validation and access to `CORE_TRUSTED_PUBLISHER_ID`.
- **Query grammar limits** (`core/src/queries/engine/`, `core/src/queries/dispatcher.ts`) - `DEFAULT_PAGE_LIMIT` (50), `MAX_PAGE_LIMIT` (200, silently capped), `CURSOR_VERSION` (1), `DEFAULT_PAYLOAD_BUDGET_BYTES` (524288) and the closed list of identity field names a payload may not carry.

## Test Helpers

Total: 11

- **dispatch** (`core/tests/helpers/dispatch.ts`) - Dispatches a command as if it had arrived on the bus, building the full subject. Its default caller is the trusted publisher, since S-017.
- **dispatchQuery** (`core/tests/helpers/dispatch.ts`) - Same for the QUERY plane: `jiku-queries` subject, the real `QueryDispatcher` over `readDb`, no transaction.
- **setQueryBudget / resetQueryBudget** (`core/tests/helpers/dispatch.ts`) - Injects the page byte budget `dispatchQuery()` runs with, so the budget-cut and truncation tests do not depend on a real server's `max_payload`.
- **Task query fixtures** (`core/tests/queries/task-fixtures.ts`) - The fixture world of the query-engine tests: projects, requirement, people, tasks with a controlled `created_at`, comments, assignments and subscriptions. Since S-023 `createWorld()` also seeds the trusted publisher with `roles: ['internal-app']`, because the caller class gate exempts nobody. Written through the WRITE connection; read back through `readDb`.
- **createQueryCallers / destroyQueryCallers** (`core/tests/queries/task-fixtures.ts`) - The six query callers with their exact roles, one per class plus the two that the method gate cuts. Teardown removes their project permissions first: the FK points at `users.id`.
- **grantProjects** (`core/tests/queries/task-fixtures.ts`) - Seeds `user_project_permissions` rows, the table that sustains the client portal's isolation and the one the external-mode clip subqueries on every request. Its teardown counterpart is `destroyQueryCallers()`, which has to clear them anyway before deleting the callers.
- **Domain query fixtures** (`core/tests/queries/domain-fixtures.ts`) - The fixture world of the domain core: the four clients (including the one with NO project, which is what makes the indirect external clip observable), the origin, the projects with their `key_value_pairs` and the one without a client, and the eight requirements with tags, 25 comments, responsible people, subscriptors, polymorphic attachments and worked time on BOTH the requirement and one of its tasks. Reuses `task-fixtures.ts` instead of duplicating the world; `created_at` is pinned with raw SQL because Sequelize overwrites timestamps on save.
- **S3Double** (`core/tests/helpers/s3-double.ts`) - Test double for the S3 signer: records the signing calls and never touches the network.
- **fakeMsg** (`core/tests/helpers/micro-double.ts`) - Test double for a micro `ServiceMsg`: records `respond()` and `respondError()` without transforming the arguments, and `json()` throws on a malformed body just like the real one.
- **fakeConnection** (`core/tests/helpers/micro-double.ts`) - Test double for a `NatsConnection` with `services.add()` and `subscribe()`: records the service configs, groups and endpoints created plus the flat subscriptions opened, and shares one ordering trace with the service and the subscription so shutdown order can be asserted.
- **FakeSubscription** (`core/tests/helpers/micro-double.ts`) - Test double for a flat `Sub<Msg>`: async-iterable with a `push()` that resolves once the consumer has finished with the message, and a `drain()` that ends the iterator and writes `'subscription.drain'` to the shared trace.
