# core

The only service that writes to the database. It has no HTTP: it serves the NATS micro services
`jiku-commands` (23 commands) and `jiku-queries` (23 queries), publishes domain events to the
JetStream stream `JIKU_EVENTS`, mirrors identities from `{instance}.events.auth` into `users`, and
sends the email notifications of `notification_outbox`. Contracts: `_gflow/apis/core.asyncapi.yaml`,
`core-queries.asyncapi.yaml`, `core-events.asyncapi.yaml`. Its place in the product is in
`_gflow/prd/architecture/services.md`.

## Stack

| Concern | Choice | Version | Why |
|---|---|---|---|
| Language and runtime | TypeScript (`strict`, commonjs, experimental decorators) on Node.js | TypeScript ^5.9.3; Node 24 (`node:24.12-alpine3.23`) | Shared with the rest of the monorepo |
| Transport | `nats`: micro services (request/reply), JetStream publish, flat subscription; `@jiku/nats-protocol` | ^2.29.3 | Commands are request/reply without JetStream; events go through JetStream |
| Validation | Joi for commands and the auth event; an explicit validator for queries (`src/queries/engine/validate-query.ts`) | ^18.0.2 | Unknown keys are rejected |
| Persistence | Sequelize + sequelize-typescript (owner connection, models from `@jiku/models`) and a second read-only connection with explicit SQL for queries (`src/models/read.ts`) | ^6.37.7 / ^2.1.6 / pg ^8.16.3; PostgreSQL 15.4 | One transaction per command, opened by the dispatcher |
| Storage | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (presigned PUT/GET) | ^3.995.0 | core is the only service with bucket credentials |
| Mail | nodemailer (SMTP) | ^7.0.13 | — |
| Identity | `@jiku/zitadel-auth` (service-user JWT for the bus) | workspace | — |
| Logging | winston, plain text; own timing via `Jiku-Trace-Id`/`Jiku-Timing` headers (`src/timing.ts`) | ^3.19.0 | No OpenTelemetry yet |
| Tests | Mocha + should + sinon, `ts-node/register`; Ajv + ajv-formats + js-yaml to validate events against the AsyncAPI; nyc | mocha 11.7.5, ajv ^8.20.0 | Real PostgreSQL, own doubles for S3, SMTP and NATS micro |
| Lint | ESLint 9 + typescript-eslint (root `eslint.config.base.js`) | ^9.39.2 | — |

Chosen before the service adopted grava-workflow. Before adding or upgrading a dependency, check the
official documentation for the stable version and its recommended practices.

## Commands

Today these are the workspace's npm scripts (run from the root with `-w @jiku/core`, or inside
`core/`). The alignment requirement adds the `make` targets (`make test S=core`, `make lint S=core`,
`make typecheck S=core`).

| Command | Runs |
|---|---|
| `npm test -w @jiku/core` | `mocha "tests/**/*.test.ts"`; starts an ephemeral PostgreSQL 15.4 in Docker (with the read-only role) unless `CI=true`; `KEEP_DB=true` keeps it |
| `npx mocha tests/commands/times-rules.test.ts` (inside `core/`) | One file |
| `npm run test:coverage -w @jiku/core` | nyc + mocha |
| `npm run lint -w @jiku/core` | `eslint ./src` |
| `npm run build -w @jiku/core` | `tsc` (also the type check) |
| `npm run dev -w @jiku/core` | `ts-node ./src/index.ts` |
| `npm start -w @jiku/core` | `node ./dist/src/index.js` |
| Migrations | n/a: the schema is migrated by the api (`npm run upgrade-db -w @jiku/api`) |

## Structure

- `src/index.ts` — process start, the two micro services, the auth-event subscription, the notification loop, `SIGTERM` shutdown.
- `src/bus/` — connection (`host.ts`), micro registration (`service.ts`), command dispatcher with the transaction (`dispatcher.ts`), `actor` envelope, post-commit event emission.
- `src/authorize-caller.ts`, `src/caller-class.ts`, `src/entity-project.ts` — the authorisation gates (role → method, caller class, entity permission).
- `src/commands/{module}/` — one file per command (validation, rules, writes); registry in `src/commands/index.ts`.
- `src/queries/{resource}/` — a `*-spec.ts` per resource plus `list`/`get`; the generic SQL engine in `src/queries/engine/`.
- `src/events/domain/` — domain event builders; `src/events/auth/` — the incoming auth event.
- `src/notifications/` — recipients, templates and the outbox loop in `dispatch/`.
- `src/models/` — owner connection (`index.ts`) and read-only connection (`read.ts`).
- `tests/{auth,bus,commands,events,models,notifications,queries}/`, doubles in `tests/helpers/`, diagnostic tools in `tests/tools/`.

## Canonical examples

The best example of each kind of code: copy its shape when writing a new one.

| Kind | File |
|---|---|
| Command with its rules (window, daily limit, ownership) inside the dispatcher's transaction | `core/src/commands/times/worked-times.ts` (transaction in `core/src/bus/dispatcher.ts`) |
| Query on the read-only connection (spec + list) | `core/src/queries/tasks/tasks-spec.ts`, `core/src/queries/tasks/tasks-list.ts` |
| Domain event builder | `core/src/events/domain/requirement.ts` |
| Scheduled job (outbox loop) | `core/src/notifications/dispatch/scheduler.ts`, `core/src/notifications/dispatch/run-cycle.ts` |
| Integration test of a command against real PostgreSQL | `core/tests/commands/times-rules.test.ts` |
| Integration test of a query | `core/tests/queries/tasks.test.ts` |
| Contract test (events validated with Ajv against the AsyncAPI) | `core/tests/events/catalog-contract.test.ts` |
| Test of the scheduled job with an SMTP double | `core/tests/notifications/dispatch.test.ts` |

## Recurring errors

One line per mistake that showed up twice (in verification, in CI or in review).

- (none yet)
