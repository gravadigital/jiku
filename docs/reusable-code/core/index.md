# Reusable Code Index — `core`

> Partial catalog. It was seeded by story S-002 with the reusable elements that story created;
> it is **not** a full scan of the service. Run `/service-update-reusable-code core` to complete it.

**Last updated:** 2026-08-24 (S-017)

## Utils

Total: 9

- **authorizeCaller** (`core/src/authorize-caller.ts`) - The authorisation gate of both dispatchers: exempts the api's channel by `sub`, otherwise reads `users.roles` and authorises the caller against a closed deny-by-default map. Never throws and fails closed.
- **rolesAuthorize** (`core/src/authorize-caller.ts`) - Pure predicate behind the gate: does any of the caller's roles authorise this method on this plane? Union semantics, not precedence.
- **matchesPattern** (`core/src/commands/registry.ts`) - Does a method name match a `{param}` pattern? Extracted from `CommandRegistry.resolve()` so the authorisation gate can match without resolving the command.
- **resolveActor** (`core/src/commands/resolve-actor.ts`) - Resolves who the actor of a command is depending on whether the api or an external publisher published it. Shared by seven commands; moved up from `commands/files/` in S-003.
- **linkFiles** (`core/src/commands/link-files.ts`) - Links `fileIds` to an already existing entity: resolves the actor, validates existence, liveness and ownership, marks the bytes uploaded and inserts one `attachments` row per file. Additive mode, for creation commands.
- **syncFileLinks** (`core/src/commands/link-files.ts`) - Same validation as `linkFiles` but with complete-set semantics for edit commands: preserves the rows of the links that stay and hard-deletes the ones no longer declared.
- **readFileSettings** (`core/src/commands/files/settings.ts`) - Reads the five file-policy keys from `system_settings` with code-level defaults, inside the command's transaction.
- **buildStorageKey** (`core/src/commands/files/storage.ts`) - Builds the storage object key `{prefix}/f/{uuid}{ext}`; the uploader never chooses where the file is stored.
- **contentDisposition** (`core/src/commands/files/storage.ts`) - Builds an escaped `Content-Disposition` header value safe to carry a user-supplied file name.

## Services

Total: 7

- **StorageSigner** (`core/src/commands/files/storage.ts`) - Lazily built S3 signer exposing exactly two local (no-network) operations: sign a PutObject and sign a GetObject.
- **BusHost** (`core/src/bus/host.ts`) - Opens ONE NATS connection and registers N micro services on it, in series, with an ordered shutdown. Takes the specs as varargs, so mounting a second service is adding one element. `withEventConsumer()` adds a FLAT subscription (with queue group) on the same connection, drained between the services and the connection.
- **registerService** (`core/src/bus/service.ts`) - Registers a micro service from a `ServiceSpec` on an existing connection: one endpoint per command pattern, own queue group, and a duplicate-subject check that fails startup.
- **readDb** (`core/src/models/read.ts`) - The READ-ONLY Sequelize connection of the query service, built WITHOUT registering the models on purpose: registering them in the same process would reassign the `@jiku/models` classes and break ADR-001 with no symptom. Own pool ceiling and own `statement_timeout`.
- **QueryRegistry** (`core/src/queries/registry.ts`) - Maps a query method to the query that serves it. Exact `Map` matching, not segment matching: query patterns carry no `{param}`. Registering a duplicate pattern throws.
- **QueryDispatcher** (`core/src/queries/dispatcher.ts`) - Translates a bus subject into a query execution WITHOUT opening a transaction, injecting the read-only connection into the context. Never throws: it always resolves to a `Reply`.
- **EventDispatcher** (`core/src/events/dispatcher.ts`) - Translates a bus EVENT into the execution of its handler: guards (`instance`, `type`, `version`, the four required fields) with Joi `.unknown(true)`, then the transaction, and an `outcome` instead of a `reply.status` to decide commit/rollback. Resolves to `void` and never rejects — a rejection would kill the subscription's `for await`.

## Types

Total: 6

- **ServiceSpec** (`core/src/bus/service.ts`) - What a micro service needs to be registered: bus name, description, the command patterns, and a `handle` that never throws.
- **Query** (`core/src/queries/types.ts`) - A read endpoint: a `pattern` without `{param}` and an `execute(payload, ctx)` that resolves to a `Reply`. No `validate()` yet — there is no query contract to validate against.
- **QueryContext** (`core/src/queries/types.ts`) - What a query receives: the `caller` read from the subject and the read-only `db` connection. It has NO `transaction` and NO `params`, and both absences are the contract.
- **EventSpec** (`core/src/bus/host.ts`) - What a flat event consumer needs: the LITERAL subject and a `handle(payload)`. No `queue` (that is read by `start()`), and it is NOT a `ServiceSpec`: an event has nobody to answer.
- **EventContext** (`core/src/events/types.ts`) - What an event handler receives: `transaction` and NOTHING else. No `caller` (the 3-segment subject does not carry one), no `params` (the subject is literal), no `commit`/`rollback` (ADR-003).
- **EventHandler / EventOutcome** (`core/src/events/types.ts`) - An event handler takes the validated payload plus the context and resolves to `'applied'` or `'discarded'` — the discriminant that replaces `reply.status` when there is no reply.

## Constants

Total: 2

- **ROLE_METHODS** (`core/src/authorize-caller.ts`) - The role → method map of the bus: closed, deny-by-default and the complete table of the roles that may connect. Mirrors the 9 subjects of the external connector's callout template.
- **Config accessors** (`core/src/config.ts`) - `loadConfig()` / `getTrustedPublisherId()`: startup validation and access to `CORE_TRUSTED_PUBLISHER_ID`.

## Test Helpers

Total: 6

- **dispatch** (`core/tests/helpers/dispatch.ts`) - Dispatches a command as if it had arrived on the bus, building the full subject. Its default caller is the trusted publisher, since S-017.
- **dispatchQuery** (`core/tests/helpers/dispatch.ts`) - Same for the QUERY plane: `jiku-queries` subject, the real `QueryDispatcher` over `readDb`, no transaction.
- **S3Double** (`core/tests/helpers/s3-double.ts`) - Test double for the S3 signer: records the signing calls and never touches the network.
- **fakeMsg** (`core/tests/helpers/micro-double.ts`) - Test double for a micro `ServiceMsg`: records `respond()` and `respondError()` without transforming the arguments, and `json()` throws on a malformed body just like the real one.
- **fakeConnection** (`core/tests/helpers/micro-double.ts`) - Test double for a `NatsConnection` with `services.add()` and `subscribe()`: records the service configs, groups and endpoints created plus the flat subscriptions opened, and shares one ordering trace with the service and the subscription so shutdown order can be asserted.
- **FakeSubscription** (`core/tests/helpers/micro-double.ts`) - Test double for a flat `Sub<Msg>`: async-iterable with a `push()` that resolves once the consumer has finished with the message, and a `drain()` that ends the iterator and writes `'subscription.drain'` to the shared trace.
