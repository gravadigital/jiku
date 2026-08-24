# Reusable Code Index — `packages/nats-protocol`

> Partial catalog. It was seeded by story S-011 with the reusable elements that story created;
> it is **not** a full scan of the package. Run `/service-update-reusable-code packages/nats-protocol`
> to complete it.

**Last updated:** 2026-08-24 (S-020)

The whole package is reusable by definition: it is the single definition of the bus contract, shared
by `api` (which publishes) and `core` (which serves). Everything lives in one file,
`packages/nats-protocol/src/index.ts`. Consumers import it **compiled** (`main` points at `dist/`),
so a change here does not reach them without `npm run build:packages`.

## Constants

Total: 3

- **COMMAND_SERVICE** (`packages/nats-protocol/src/index.ts`) - The `{svc}` token of the commands service: `NATS_COMMAND_SERVICE || 'jiku-commands'`. Read once, at import time.
- **QUERY_SERVICE** (`packages/nats-protocol/src/index.ts`) - The `{svc}` token of the queries service: `NATS_QUERY_SERVICE || 'jiku-queries'`. Read once, at import time.
- **ErrorCode** (`packages/nats-protocol/src/index.ts`) - The catalog of protocol error codes as a frozen object (`as const`), 32 members. Use the constant, never the literal. The catalog is **not closed** and holds codes with no emitter on purpose (ADR-005). Adding a code is **three** changes — this file, the `enum` of `docs/apis/core.yaml` and the map of `api/lib/utils/bus/protocol.ts` — and without the third it falls through to a generic 500. The source of truth for the value is the contract, not this file. REQ-005 added `caller_not_authorized` (403), the first code emitted by **the dispatcher** and not by a command. REQ-006 added the **five** codes of the query plane — `unknown_caller`, `query_timeout`, `invalid_cursor`, `comment_not_found`, `task_not_found` — none of them emitted by a command, and each making only **two** of the three changes on purpose: their HTTP map belongs to the requirement that migrates the `GET` routes.

## Utils

Total: 7

- **querySubject** (`packages/nats-protocol/src/index.ts`) - Builds the subject of an outgoing query: `{instance}.{userId}.jiku-queries.{version}.{method}`. Same signature as `commandSubject`.
- **groupSubject** (`packages/nats-protocol/src/index.ts`) - Prefix of a micro service group: `{instance}.*.{svc}.{version}`, without the trailing `.>`. The service goes in as a parameter so one process can register two groups.
- **authEventSubject** (`packages/nats-protocol/src/index.ts`) - Subject of the authentication event: `{instance}.events.auth`. Three segments, **outside** the command grammar, fire-and-forget with no reply. Takes no parameters and has no wildcard variant, by deny-by-default (ADR-008).
- **endpointName** (`packages/nats-protocol/src/index.ts`) - Micro endpoint name for a command pattern: `tasks.{id}.edit` -> `tasks-edit`. Drops the `{param}` segments and joins with `-`.
- **endpointSubject** (`packages/nats-protocol/src/index.ts`) - Micro endpoint subject for a command pattern: `tasks.{id}.edit` -> `tasks.*.edit`. Replaces every `{param}` with `*`.
- **methodFromSubject** (`packages/nats-protocol/src/index.ts`) - Extracts the method (command **or** query) from a full subject. Rename of `commandFromSubject`, which stays as an alias of the same symbol.
- **failure** (`packages/nats-protocol/src/index.ts`) - Builds a failure `Reply`. Since REQ-006 it takes an optional **third** parameter that lands in `errorDetails`; omitting it leaves the key **out of the object**, not set to `undefined` — which is what keeps the consumers' `deepEqual` assertions green. What goes in there is contract data (field, value, allowed), never stack traces, column names or SQL.

## Types

Total: 1

- **AuthEvent** (`packages/nats-protocol/src/index.ts`) - The payload of the authentication event as the `auth-callout` publishes it: **nine** of the fifteen fields the emitter sends, in `snake_case` verbatim, all required. `identity_type` is `string` and **not** the `IdentityType` enum of `@jiku/models` — the package keeps zero runtime dependencies. `client_ip` and `session` are not declared and never persisted (RF-12).

## Test Helpers

Total: 1

- **reload** (`packages/nats-protocol/tests/helpers/reload.ts`) - Re-imports the package with a controlled environment. Mandatory for any assertion that depends on `INSTANCE`, `PROTOCOL_VERSION`, `COMMAND_SERVICE` or `QUERY_SERVICE`, because those are evaluated **at import time**.

## Deprecated — do not reuse

This one is alive only so `core` did not have to be touched in S-011. It is listed here so nobody
picks it up for new code.

- **commandFromSubject** - Use `methodFromSubject`. Same symbol, kept so `core/src/bus/dispatcher.ts` stays untouched.

> **Note on `commandSubject`.** It is not new, and its signature did not change, but since S-011 the
> `{svc}` token it produces is `jiku-commands` instead of `gestion`. No caller had to change a line.
