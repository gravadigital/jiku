# nats-protocol

`@jiku/nats-protocol`: the grammar of the bus shared by `api` and `core` — subject builders for
commands, queries, domain events and optional modules, the hashed inbox prefix, the `Reply`
envelope (`success`/`failure`), the error-code catalogue, the `Actor` envelope, the domain event
types and ULID generation. It does not list the methods (those live in core's registries). The
contracts it implements are in `_gflow/apis/`. Its place in the product is in
`_gflow/prd/architecture/services.md`.

## Stack

| Concern | Choice | Version | Why |
|---|---|---|---|
| Language | TypeScript (commonjs), a single source file `src/index.ts`, no runtime dependencies (only `node:crypto`) | ^5.9.3 | Usable from any TypeScript service |
| Configuration | `NATS_INSTANCE`, `NATS_PROTOCOL_VERSION`, `NATS_COMMAND_SERVICE`, `NATS_QUERY_SERVICE`, `NATS_EVENTS_VERSION`, read once at import | — | — |
| Tests | Mocha + should, `ts-node/register` (timeout 10 s) | mocha 11.7.5 | Includes text checks of the contracts in `_gflow/apis/` and `deploy/.env.dist` |
| Lint | ESLint 9 + typescript-eslint (root `eslint.config.base.js`) | ^9.39.2 | — |

Chosen before the package adopted grava-workflow. Before adding or upgrading a dependency, check the
official documentation for the stable version and its recommended practices.

## Commands

Today these are the workspace's npm scripts (run from the root with `-w @jiku/nats-protocol`).
The alignment requirement adds the `make` targets (`make test S=nats-protocol`,
`make lint S=nats-protocol`, `make typecheck S=nats-protocol`).

| Command | Runs |
|---|---|
| `npm test -w @jiku/nats-protocol` | `mocha "tests/**/*.test.ts"` (no database) |
| `npm run lint -w @jiku/nats-protocol` | `eslint ./src ./tests` |
| `npm run build -w @jiku/nats-protocol` | `tsc` → `dist/` (also the type check; `npm install` runs it through `postinstall`) |
| Migrations | n/a |

## Structure

- `src/index.ts` — everything the package exports.
- `tests/*.test.ts` — one file per area (subjects, endpoints, inbox and error catalogue, actor, events, modules, ULID) plus the contract checks (`core-events-contract.test.ts`, `jiku-modules-contract.test.ts`).
- `tests/helpers/reload.ts` — re-imports the module with the environment variables reset.

## Canonical examples

The best example of each kind of code: copy its shape when writing a new one.

| Kind | File |
|---|---|
| Subject builders, `Reply`, error codes, event types | `packages/nats-protocol/src/index.ts` |
| Unit test that reloads the module with a given environment | `packages/nats-protocol/tests/protocol.test.ts` (with `tests/helpers/reload.ts`) |
| Contract parity test against `_gflow/apis/` | `packages/nats-protocol/tests/jiku-modules-contract.test.ts` |

## Recurring errors

One line per mistake that showed up twice (in verification, in CI or in review).

- (none yet)
