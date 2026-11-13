# api

The HTTP service for the two frontends (Gestión interna and Portal de clientes): authenticates the
Zitadel JWT, authorises by role, **reads PostgreSQL with a read-only role**, and turns every write
into a NATS command to `core`. It also proxies the optional documentation module (jiku-docs) over
the bus, serves the public documentation links under `/p/docs/*`, and runs the database migrations
at startup. It exposes 92 operations under `/api` (contract: `_gflow/apis/api.openapi.yaml`). Its
place in the product is in `_gflow/prd/architecture/services.md`.

## Stack

| Concern | Choice | Version | Why |
|---|---|---|---|
| Language and runtime | TypeScript (`strict`, commonjs, experimental decorators) on Node.js | TypeScript ^5.9.3; Node 24 (`node:24.12-alpine3.23`) | Shared with the rest of the monorepo |
| HTTP | Express | ^5.2.1 | — |
| Validation | Joi (`lib/utils/validate-body-fields.ts`, `validate-query-params.ts`) | ^18.0.2 | — |
| Persistence | Sequelize + sequelize-typescript on PostgreSQL (`pg`), models from `@jiku/models` | ^6.37.7 / ^2.1.6 / pg ^8.16.3; PostgreSQL 15.4 | Read-only connection; the read/write split is enforced by database permissions |
| Migrations | sequelize-cli (`db-upgrade/config.js`, table `sequelize_meta`) | ^6.6.3 | Run by the api at startup with the owner role |
| Bus | `nats` (request/reply to core and jiku-docs; JetStream KV read/watch of `JIKU_MODULES`), `@jiku/nats-protocol` | ^2.29.3 | — |
| Auth | `jsonwebtoken` + Zitadel JWKS fetched with `axios`; `@jiku/zitadel-auth` for the service-user token on the bus | ^9.0.3 / ^1.13.2 | Jiku does not manage users |
| Rate limit | express-rate-limit (only `/p/docs/*`) | ^8.7.1 | — |
| Logging | winston + express-winston, plain text | ^3.19.0 / 4.2.0 | No OpenTelemetry yet |
| Tests | Mocha + should + supertest + sinon + mockery + nock + mockdate, `ts-node/register`; nyc for coverage | mocha 11.7.5, supertest ^7.1.4 | Integration tests run against a real PostgreSQL and the real `core` behind `FakeBus` |
| Lint | ESLint 9 + typescript-eslint (root `eslint.config.base.js`) | ^9.39.2 | — |

Chosen before the service adopted grava-workflow. Before adding or upgrading a dependency, check the
official documentation for the stable version and its recommended practices.

## Commands

Today these are the workspace's npm scripts (run from the root with `-w @jiku/api`, or inside
`api/`). The alignment requirement adds the `make` targets (`make test S=api`, `make lint S=api`,
`make typecheck S=api`, `make migrate`).

| Command | Runs |
|---|---|
| `npm test -w @jiku/api` | `mocha "tests/**/*.test.ts"`: every test; starts an ephemeral PostgreSQL 15.4 in Docker unless `CI=true` (`KEEP_DB=true` keeps it) |
| `npm run test:unit -w @jiku/api` | `tests/utils/**` only, no database |
| `npm run test:integration -w @jiku/api` | `tests/00-configurations/**` and `tests/routes/**` |
| `npm run test:coverage -w @jiku/api` | nyc + mocha |
| `npx mocha tests/routes/clients-get.test.ts` (inside `api/`) | One file |
| `npm run lint -w @jiku/api` | `eslint ./lib` |
| `npm run build -w @jiku/api` | `tsc` (also the type check) |
| `npm run upgrade-db -w @jiku/api` | Apply the migrations with sequelize-cli |
| `npm run dev -w @jiku/api` | tsc-watch + nodemon |
| `npm start -w @jiku/api` | Migrations, then `ts-node ./bin` (`built-start` does the same on `dist/`, it is the image's `CMD`) |

## Structure

- `bin/index.ts` — entry point: config asserts, database, bus, module registry, JWKS, `listen`.
- `app.ts` — Express setup, global `validateToken` (deny-by-default; exemptions in `config/public.ts`), route mounting under `/api`.
- `lib/routes/` — one file per operation (`{resource}-{verb}.ts`), mounted from `lib/routes/index.ts`; `lib/public-routes/` — `/p/docs/*`.
- `lib/utils/middlewares/` — token, role, project-permission and visibility guards; `lib/utils/bus/` — the bus client (`send-command.ts`, `protocol.ts` maps core's error codes to HTTP).
- `lib/modules/` — optional modules: the `JIKU_MODULES` registry watcher and the jiku-docs client.
- `lib/models/index.ts` — the read-only Sequelize connection.
- `db-upgrade/migrations/` — sequelize-cli migrations (they alter an existing schema; they do not create it from scratch).
- `tests/` — `00-configurations/` (models and migrations), `routes/` (one integration file per route), `utils/` (unit), `mocks/` (`FakeBus`, app, JWT mock), `helpers/`.

## Canonical examples

The best example of each kind of code: copy its shape when writing a new one.

| Kind | File |
|---|---|
| Write endpoint: Joi body validation, command to core, core error → HTTP mapping, re-read for the response | `api/lib/routes/worked-times-post.ts` (with `api/lib/utils/validate-body-fields.ts`, `api/lib/utils/bus/send-command.ts`, `api/lib/utils/bus/protocol.ts`) |
| Read endpoint with query params and filters | `api/lib/routes/requirements-get.ts` |
| Background process (watch + 30 s ping) | `api/lib/modules/registry.ts` |
| Migration | `api/db-upgrade/migrations/20260923_02_tasks_search_trgm.js` |
| Integration test against real PostgreSQL (supertest, real core behind `FakeBus`) | `api/tests/routes/worked-times-post.test.ts` |
| Migration test | `api/tests/00-configurations/notification-outbox-migration.test.ts` |
| Unit test | `api/tests/utils/protocol.test.ts` |

## Recurring errors

One line per mistake that showed up twice (in verification, in CI or in review).

- (none yet)
