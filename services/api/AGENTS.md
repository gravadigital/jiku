# api

The HTTP service both frontends call: it validates the bearer token, reads PostgreSQL with a
SELECT-only role and publishes every write as a NATS command to core; it exposes the 92 routes of
`_jflow/apis/api.openapi.yaml` (`/api/*`, plus the public `/p/docs/*`) and owns the database
migrations. Its place in the product is in `_jflow/prd/architecture/services.md`.

Code, comments, identifiers and test names are in English; the texts and error messages the service
shows its users are in the product language (`language` in `_jflow/project.yaml`; see the root
`AGENTS.md`).

## Stack

| Concern | Choice | Version | Why |
|---|---|---|---|
| Language and runtime | TypeScript (strict, CommonJS) on Node | TS 5.9.3, Node 24 (`node:24.12-alpine3.23`) | Shared with core and the packages |
| HTTP | Express | 5.2.1 | — |
| Validation | Joi, one schema per route (`lib/utils/validate-body-fields.ts`, `validate-query-params.ts`) | 18 | — |
| Persistence | Sequelize + sequelize-typescript + `pg`, models from `@jiku/models` | 6.37, 2.1.6, 8.x | Models shared with core (ADR-005). Read-only DB role: the read/write split is enforced by the database (ADR-001) |
| Migrations | sequelize-cli, run at startup (`npm run upgrade-db`: `db-upgrade/baseline.js` + `db-upgrade/migrations/`) | 6.6 | The api owns the schema; it migrates with `POSTGRESQL_MIGRATION_USER` |
| Authentication | `jsonwebtoken` + JWKS fetched from `${IDENTITY_URL}/oauth/v2/keys`; deny by default (`config/public.ts`) | 9.0.3 | Zitadel tokens (ADR-007); authorization deny-by-default (ADR-008) |
| Bus | `nats` request/reply, subjects from `@jiku/nats-protocol`, machine-user token from `@jiku/zitadel-auth` | 2.29.3 | Commands are NATS request/reply, without JetStream (ADR-002); optional modules discovered in KV `JIKU_MODULES` (ADR-015) |
| Rate limit | express-rate-limit, only on `/p/docs/*` | 8.7 | — |
| Logging | winston + express-winston (text, files in production) | 3.19, 4.2.0 | No OpenTelemetry yet (see `docs/operacion.md`) |
| Tests | mocha + ts-node, should, supertest, sinon, nock, mockery | 11.7.5 | Against a real PostgreSQL (ADR-013) |
| Lint | ESLint 9, root `eslint.config.base.js` | 9 | — |

Chosen from the official documentation current when the service was created. Before adding or
upgrading a dependency, check the official documentation for the stable version and its recommended
practices.

## Commands

| Command | Runs |
|---|---|
| `make test S=api` | `test-unit` (no separate level: prints a note), `test-integration`, `test-e2e` |
| `make test-integration S=api` | Starts `postgres-test` (Compose profile `test`), creates database `gestionTestApi`, runs `mocha "tests/**/*.test.ts"`: the global setup builds the schema with the migrations; JUnit to `reports/junit/api-integration.xml` |
| `make test-e2e S=api` | `mocha "e2e/**/*.e2e.ts"` against `make up` (`API_URL`, default `http://localhost:3100`; `IDP_URL`, default `http://localhost:9400`) |
| `make lint S=api` | `eslint ./lib` |
| `make typecheck S=api` | `tsc --noEmit -p .` |
| `make migrate` | `docker compose run --rm migrate`: `npm run upgrade-db` (baseline + migrations) against the local database |

One file: `npx mocha tests/routes/{file}.test.ts` from `services/api`, with the database variables of
the Makefile's `TEST_DB_ENV` (or let `tests/setup-env.ts` start its own container).

## Structure

- `bin/index.ts` startup (config asserts, DB, bus, JWKS, listen); `app.ts` Express wiring;
  `config/public.ts` the routes exempt from authentication.
- `lib/routes/` one file per route (`{resource}-{verb}.ts`, `opus-*` for the portal, `docs-*` for the
  docs module), mounted by `lib/routes/index.ts`; `lib/public-routes/` the public `/p/docs/*`.
- `lib/utils/bus/` the bus client: `send-command.ts` (identity envelope, timeouts) and `protocol.ts`
  (`STATUS_BY_ERROR_CODE`: core error code → HTTP status). `lib/utils/middlewares/` auth, roles,
  project permission. `lib/modules/` optional modules (registry, docs proxy).
- `db-upgrade/` `baseline.js` (the schema on an empty database), `migrations/` (never edit one already
  on `dev`: add a new one), `config.js`.
- `tests/` `routes/` (HTTP through supertest on the real app), `utils/`, `00-configurations/`
  (connection, models, migration tests), `mocks/` (`bus.ts`: fake bus running core's real dispatcher
  in-process; `jsonwebtoken-mock.ts`: the test tokens). `e2e/` end to end against `make up`.

## Canonical examples

The best example of each kind of code: copy its shape when writing a new one.

| Kind | File |
|---|---|
| Write endpoint: Joi validation, command to core, bus errors mapped to HTTP | `lib/routes/unworked-times-post.ts` (with `lib/utils/bus/send-command.ts` and `lib/utils/bus/protocol.ts`) |
| Read endpoint with parameterized raw SQL | `lib/routes/requirements-tags-suggestions-get.ts` |
| Portal route with project permission and visibility checks | `lib/routes/opus-requirements-id-get.ts` |
| Migration | `db-upgrade/migrations/20260923_02_tasks_search_trgm.js` |
| Integration test (HTTP, real DB, real core in-process) | `tests/routes/unworked-times-post.test.ts` |
| End-to-end test | `e2e/api.e2e.ts` |

## Recurring errors

One line per mistake that showed up twice (in verification, in CI or in review).

- (none yet)
