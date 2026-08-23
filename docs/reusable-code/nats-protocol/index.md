# Reusable Code Index — `packages/nats-protocol`

> Partial catalog. It was seeded by story S-011 with the reusable elements that story created;
> it is **not** a full scan of the package. Run `/service-update-reusable-code packages/nats-protocol`
> to complete it.

**Last updated:** 2026-08-23 (S-012)

The whole package is reusable by definition: it is the single definition of the bus contract, shared
by `api` (which publishes) and `core` (which serves). Everything lives in one file,
`packages/nats-protocol/src/index.ts`. Consumers import it **compiled** (`main` points at `dist/`),
so a change here does not reach them without `npm run build:packages`.

## Constants

Total: 2

- **COMMAND_SERVICE** (`packages/nats-protocol/src/index.ts`) - The `{svc}` token of the commands service: `NATS_COMMAND_SERVICE || 'jiku-commands'`. Read once, at import time.
- **QUERY_SERVICE** (`packages/nats-protocol/src/index.ts`) - The `{svc}` token of the queries service: `NATS_QUERY_SERVICE || 'jiku-queries'`. Read once, at import time.

## Utils

Total: 5

- **querySubject** (`packages/nats-protocol/src/index.ts`) - Builds the subject of an outgoing query: `{instance}.{userId}.jiku-queries.{version}.{method}`. Same signature as `commandSubject`.
- **groupSubject** (`packages/nats-protocol/src/index.ts`) - Prefix of a micro service group: `{instance}.*.{svc}.{version}`, without the trailing `.>`. The service goes in as a parameter so one process can register two groups.
- **endpointName** (`packages/nats-protocol/src/index.ts`) - Micro endpoint name for a command pattern: `tasks.{id}.edit` -> `tasks-edit`. Drops the `{param}` segments and joins with `-`.
- **endpointSubject** (`packages/nats-protocol/src/index.ts`) - Micro endpoint subject for a command pattern: `tasks.{id}.edit` -> `tasks.*.edit`. Replaces every `{param}` with `*`.
- **methodFromSubject** (`packages/nats-protocol/src/index.ts`) - Extracts the method (command **or** query) from a full subject. Rename of `commandFromSubject`, which stays as an alias of the same symbol.

## Test Helpers

Total: 1

- **reload** (`packages/nats-protocol/tests/helpers/reload.ts`) - Re-imports the package with a controlled environment. Mandatory for any assertion that depends on `INSTANCE`, `PROTOCOL_VERSION`, `COMMAND_SERVICE` or `QUERY_SERVICE`, because those are evaluated **at import time**.

## Deprecated — do not reuse

This one is alive only so `core` did not have to be touched in S-011. It is listed here so nobody
picks it up for new code.

- **commandFromSubject** - Use `methodFromSubject`. Same symbol, kept so `core/src/bus/dispatcher.ts` stays untouched.

> **Note on `commandSubject`.** It is not new, and its signature did not change, but since S-011 the
> `{svc}` token it produces is `jiku-commands` instead of `gestion`. No caller had to change a line.
