# Reusable Code Index — `packages/nats-protocol`

> Partial catalog. It was seeded by story S-011 with the reusable elements that story created;
> it is **not** a full scan of the package. Run `/service-update-reusable-code packages/nats-protocol`
> to complete it.

**Last updated:** 2026-09-08 (S-062)

The whole package is reusable by definition: it is the single definition of the bus contract, shared
by `api` (which publishes) and `core` (which serves). Everything lives in one file,
`packages/nats-protocol/src/index.ts`. Consumers import it **compiled** (`main` points at `dist/`),
so a change here does not reach them without `npm run build:packages`.

## Constants

Total: 4

- **COMMAND_SERVICE** (`packages/nats-protocol/src/index.ts`) - The `{svc}` token of the commands service: `NATS_COMMAND_SERVICE || 'jiku-commands'`. Read once, at import time.
- **QUERY_SERVICE** (`packages/nats-protocol/src/index.ts`) - The `{svc}` token of the queries service: `NATS_QUERY_SERVICE || 'jiku-queries'`. Read once, at import time.
- **ErrorCode** (`packages/nats-protocol/src/index.ts`) - The catalog of protocol error codes as a frozen object (`as const`), 33 members. Use the constant, never the literal. The catalog is **not closed** and holds codes with no emitter on purpose (ADR-005). Adding a code is **three** changes — this file, the `enum` of `docs/apis/core.yaml` and the map of `api/lib/utils/bus/protocol.ts` — and without the third it falls through to a generic 500. The source of truth for the value is the contract, not this file. REQ-005 added `caller_not_authorized` (403), the first code emitted by **the dispatcher** and not by a command. REQ-006 added the **five** codes of the query plane — `unknown_caller`, `query_timeout`, `invalid_cursor`, `comment_not_found`, `task_not_found` — none of them emitted by a command, and each making only **two** of the three changes on purpose: their HTTP map belongs to the requirement that migrates the `GET` routes. REQ-007 added `access_denied` (403), the first code where **all three** changes land in the same requirement — it answers _"can you touch THIS entity?"_ with the `user_project_permissions` row in front of it, only in external mode, and it is not `caller_not_authorized`, which answers _"does your role enable this method?"_. Its emitter is core's write gate (S-030).
- **EVENTS_VERSION** (`packages/nats-protocol/src/index.ts`) - `process.env.NATS_EVENTS_VERSION || 'v1'` — the `{version}` segment of a domain event's subject (REQ-014). **Independent of `PROTOCOL_VERSION`**: they are two different environment variables on purpose, so a `v2` of the events contract never drags the 23 commands along, and vice versa. Same `||` (not `??`) rule as the other four env constants: an empty string must still fall back to `'v1'`, or the subject would carry an empty token that NATS rejects.
- **EVENT_TYPES** (`packages/nats-protocol/src/index.ts`) - The catalog of the **16** domain events `core` publishes, as a frozen object (`as const`), source-derived from `docs/apis/core-events.yaml` — the contract is the source of truth, not this constant. Ordered by entity (the 10 `requirement` events, then the 6 `task` events), same criterion as `ErrorCode`. Does **not** include the 6 batch-3 events (`project.*`, `client.*`, `attachment.*`): REQ-014 declares them "when a connector asks for them", and they are not part of the shipped contract.

## Utils

Total: 9

- **querySubject** (`packages/nats-protocol/src/index.ts`) - Builds the subject of an outgoing query: `{instance}.{userId}.jiku-queries.{version}.{method}`. Same signature as `commandSubject`.
- **groupSubject** (`packages/nats-protocol/src/index.ts`) - Prefix of a micro service group: `{instance}.*.{svc}.{version}`, without the trailing `.>`. The service goes in as a parameter so one process can register two groups.
- **authEventSubject** (`packages/nats-protocol/src/index.ts`) - Subject of the authentication event: `{instance}.events.auth`. Three segments, **outside** the command grammar, fire-and-forget with no reply. Takes no parameters and has no wildcard variant, by deny-by-default (ADR-008).
- **endpointName** (`packages/nats-protocol/src/index.ts`) - Micro endpoint name for a command pattern: `tasks.{id}.edit` -> `tasks-edit`. Drops the `{param}` segments and joins with `-`.
- **endpointSubject** (`packages/nats-protocol/src/index.ts`) - Micro endpoint subject for a command pattern: `tasks.{id}.edit` -> `tasks.*.edit`. Replaces every `{param}` with `*`.
- **methodFromSubject** (`packages/nats-protocol/src/index.ts`) - Extracts the method (command **or** query) from a full subject. Rename of `commandFromSubject`, which stays as an alias of the same symbol.
- **failure** (`packages/nats-protocol/src/index.ts`) - Builds a failure `Reply`. Since REQ-006 it takes an optional **third** parameter that lands in `errorDetails`; omitting it leaves the key **out of the object**, not set to `undefined` — which is what keeps the consumers' `deepEqual` assertions green. What goes in there is contract data (field, value, allowed), never stack traces, column names or SQL. Since REQ-014, `Reply<T>` also carries an optional `events?: DomainEvent[]` — same key-absent-by-default rule; `success()`/`failure()` did **not** change signature and nobody fills the field yet (the post-commit emitter is S-063).
- **eventSubject** (`packages/nats-protocol/src/index.ts`) - Subject of a domain event: `{instance}.events.{version}.{type}` (REQ-014). Takes the event's `type` — the segments after the version — because `type` **is** the tail of the subject: the payload's `type` and the subject cannot diverge, since this function is the one place that concatenates them. `{version}` sits before the entity so a `pub.allow`/`filter_subject` can cover a whole version without enumerating events.
- **eventsStreamSubject** (`packages/nats-protocol/src/index.ts`) - Wildcard of the domain-events stream and its publish permission: `{instance}.events.{version}.>`. **The wildcard MUST carry the version** — `{instance}.events.>` would also swallow `{instance}.events.auth`, silently turning core-NATS-only auth traffic into JetStream traffic with no test going red. One helper, so the stream config and the `pub.allow` are always written from the same value (ADR-008).

## Types

Total: 7

- **AuthEvent** (`packages/nats-protocol/src/index.ts`) - The payload of the authentication event as the `auth-callout` publishes it: **nine** of the fifteen fields the emitter sends, in `snake_case` verbatim, all required. `identity_type` is `string` and **not** the `IdentityType` enum of `@jiku/models` — the package keeps zero runtime dependencies. `client_ip` and `session` are not declared and never persisted (RF-12).
- **Actor** (`packages/nats-protocol/src/index.ts`) - The identity envelope: **who acts** behind a command, as a reserved top-level key of the message (`{ actor?: Actor, ...domain payload }`). **Five** fields, `camelCase` — this product owns this contract. Only the trusted publisher (`CORE_TRUSTED_PUBLISHER_ID`) may send it; any other caller that does is rejected with `invalid_fields`. `id` and `roles` are **required** (they are the input of the authorization decision); `name`, `username` and `email` are optional. `email` is `string | undefined` and **not** `string | null` like `AuthEvent.email` — that asymmetry is the single parameterized difference of the mirror handler both share, and homogenizing them breaks it. `roles` is an **open** `string[]` (ADR-008), and there is no `identity_type`: the command mirror writes `'person'` as a literal. The package neither validates nor extracts it — that is `core`'s dispatcher.
- **DomainEvent** (`packages/nats-protocol/src/index.ts`) - The envelope of every domain event `core` publishes (REQ-014). Molded on `AuthEvent`, but with two decisions reversed: `type` is tightly typed to `EventType` (not `string`, because **this product is the emitter** and an out-of-catalog type is an emitter bug that must fail to compile), and field names are `camelCase` verbatim of this product's own contract (not `snake_case`, because `AuthEvent` reads someone else's contract and this one writes its own — same rule as `Actor`). Generic over `snapshot` (`DomainEvent<S = RequirementSnapshot | TaskSnapshot>`) so an emitter can narrow it while a generic consumer still gets the union. `eventId` is a ULID that **this package never generates** (zero runtime dependencies, ADR-005) — `core`'s emitter (S-063) generates it.
- **EventActor** (`packages/nats-protocol/src/index.ts`) - Who acted behind an event: `{ id, name? }`. **Deliberately has no `email`** — data minimization fixed at the type level, not just by convention: the actor's email has no use for a connector (`name` is enough), and the only place an email belongs is as a notification address for a *recipient*, in `EventRecipients`.
- **EventEntityRef** (`packages/nats-protocol/src/index.ts`) - Which entity an event is about: `{ type: 'requirement' | 'task', id, projectId }`. `type` uses the product's vocabulary (ADR-004) — `task`, never `objective`.
- **EventRecipients** (`packages/nats-protocol/src/index.ts`) - Who to notify of a requirement event: `subscriptors` (with `email: string | null`) plus `responsiblePersonIds`. **`email` is nullable, like `AuthEvent.email`, and NOT optional like `Actor.email`** — the asymmetry is deliberate: `null` means "a service identity with no email" and a connector must tolerate it and skip that recipient; an optional `email?` would make "I don't know" indistinguishable from "this is a service user with none". Task events never carry this block.
- **EventComment** (`packages/nats-protocol/src/index.ts`) - The comment entity of a comment event: `{ id, body, fileIds }`, outside of `changes`. `body` is the **current, complete** text — there is no `from` of a previous value, because the edit command does not keep it.

## Test Helpers

Total: 1

- **reload** (`packages/nats-protocol/tests/helpers/reload.ts`) - Re-imports the package with a controlled environment. Mandatory for any assertion that depends on `INSTANCE`, `PROTOCOL_VERSION`, `COMMAND_SERVICE`, `QUERY_SERVICE` or, since REQ-014, `EVENTS_VERSION` — resets **five** environment variables, because all five are evaluated **at import time**.

## Deprecated — do not reuse

This one is alive only so `core` did not have to be touched in S-011. It is listed here so nobody
picks it up for new code.

- **commandFromSubject** - Use `methodFromSubject`. Same symbol, kept so `core/src/bus/dispatcher.ts` stays untouched.

> **Note on `commandSubject`.** It is not new, and its signature did not change, but since S-011 the
> `{svc}` token it produces is `jiku-commands` instead of `gestion`. No caller had to change a line.
