# core

The only service that writes the database: it exposes over NATS the micro services `jiku-commands`
(every write, one transaction per command, `_jflow/apis/core.asyncapi.yaml`) and `jiku-queries` (reads
over the bus on a read-only connection, `_jflow/apis/core-queries.asyncapi.yaml`), publishes domain
events to JetStream (`_jflow/apis/core-events.asyncapi.yaml`), sends the notification mails and mirrors
identities from the auth-callout's events. It has no HTTP. Its place in the product is in
`_jflow/prd/architecture/services.md`.

Code, comments, identifiers and test names are in English; the texts and error messages the service
shows its users are in the product language (`language` in `_jflow/project.yaml`; see the root
`AGENTS.md`).

## Stack

| Concern | Choice | Version | Why |
|---|---|---|---|
| Language and runtime | TypeScript (strict, decorators, CommonJS) on Node | TS 5.9.3, Node 24 (`node:24.12-alpine3.23`) | Shared with the api and the packages |
| Transport | `nats` micro services (`nc.services.add`), subjects from `@jiku/nats-protocol` | 2.29.3 | Commands as request/reply without JetStream (DEC-T02); domain events on JetStream `JIKU_EVENTS` (DEC-T04) |
| Bus identity | Machine-user token from `@jiku/zitadel-auth`, permissions minted by the auth-callout from `deploy/nats/auth-callout/` | — | DEC-T10. Only the api's machine user (`CORE_TRUSTED_PUBLISHER_ID`) may send the `actor` envelope |
| Authorization | Role → method map, deny by default (`src/authorize-caller.ts`), per-project gate for external users (`src/entity-project.ts`) | — | DEC-T13 |
| Validation | Joi, one schema per command (`src/commands/validate.ts`), unknown keys rejected | 18 | — |
| Persistence | Sequelize + sequelize-typescript + `pg`, models from `@jiku/models`; a second, model-less read-only connection for queries (`src/models/read.ts`) | 6.37, 2.1.6, 8.x | Every command runs inside the dispatcher's transaction (DEC-T03); models shared with the api (DEC-T08); read/write split (DEC-T01) |
| Storage | `@aws-sdk/client-s3` + `s3-request-presigner`: presigned PUT/GET only, any S3-compatible endpoint | 3.995 | Files never cross the services |
| Mail | nodemailer, from the `notification_outbox` table | 7.0 | Transactional outbox: the row is written in the command's transaction |
| Logging | winston (text, files in production), `QUERY_TIMING` / `LOG_COMMANDS` switches | 3.19 | No OpenTelemetry yet (see `docs/operacion.md`) |
| Tests | mocha + ts-node, should, sinon, ajv (contract checks against `_jflow/apis/`) | 11.7.5 | Against a real PostgreSQL (DEC-T28) |
| Lint | ESLint 9, root `eslint.config.base.js` | 9 | — |

Chosen from the official documentation current when the service was created. Before adding or
upgrading a dependency, check the official documentation for the stable version and its recommended
practices.

## Commands

| Command | Runs |
|---|---|
| `make test S=core` | `test-unit` (no separate level: prints a note), `test-integration`, `test-e2e` |
| `make test-integration S=core` | Starts `postgres-test` (Compose profile `test`), creates database `gestionTestCore`, runs `mocha "tests/**/*.test.ts"` on the schema the migrations of `services/api/db-upgrade` build; JUnit to `reports/junit/core-integration.xml` |
| `make test-e2e S=core` | `mocha "e2e/**/*.e2e.ts"`: a NATS client against the broker of `make up`, authenticated through the auth-callout with tokens of the fake-idp |
| `make lint S=core` | `eslint ./src` |
| `make typecheck S=core` | `tsc --noEmit -p .` |
| `make migrate` | n/a here: the migrations belong to the api (`services/api/db-upgrade/`) |

## Structure

- `src/index.ts` startup and graceful shutdown (`SIGTERM`: finish the notification batch, stop the
  micro services, drain); `src/config.ts` startup asserts.
- `src/bus/` connection and services (`host.ts`, `service.ts`), the command dispatcher (`dispatcher.ts`:
  envelope, identity mirror, authorization, transaction, outbox, events after commit), `actor.ts`,
  `emit-events.ts`.
- `src/commands/{area}/` one file per command group, registered in `src/commands/index.ts`.
- `src/queries/` the read plane: one "resource sheet" per resource (`{area}/{area}-spec.ts`) and the SQL
  engine in `queries/engine/`.
- `src/events/` the auth-event consumer (`events/auth/`) and the domain-event builders (`events/domain/`).
- `src/notifications/` recipients and templates (Spanish), `notifications/dispatch/` the sender loop.
- `tests/{auth,bus,commands,events,models,notifications,queries}/`, `tests/helpers/` (S3, SMTP, event
  publisher and NATS micro doubles), `tests/tools/` manual probes against a real bus (not in the
  suite). `e2e/` end to end against `make up`.

## Canonical examples

The best example of each kind of code: copy its shape when writing a new one.

| Kind | File |
|---|---|
| Command: Joi schema, rules, writes in the dispatcher's transaction, `failure(ErrorCode…)` | `src/commands/times/unworked-times.ts` |
| The transaction and its guarantees (commit, outbox in the same transaction, events after commit) | `src/bus/dispatcher.ts` |
| Background process (chained `setTimeout`, claim with `FOR UPDATE SKIP LOCKED`, backoff) | `src/notifications/dispatch/scheduler.ts`, `run-cycle.ts`, `claim-batch.ts`, `backoff.ts` |
| Query over the bus (resource sheet) | `src/queries/settings/settings-spec.ts` |
| Integration test of commands (dispatcher, real DB, doubles at the boundary) | `tests/commands/times-rules.test.ts` |
| Integration test of the background process | `tests/notifications/dispatch.test.ts` |
| End-to-end test | `e2e/core.e2e.ts` |

## Recurring errors

One line per mistake that showed up twice (in verification, in CI or in review).

- (none yet)
