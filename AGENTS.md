# Jiku

Project management for a services team: clients, projects, requirements, tasks and worked hours,
with an internal surface for the team and a separate portal for clients. A read-only HTTP `api`,
a `core` that owns every write over NATS, two Next.js frontends and shared packages, in one npm
workspace. Its definition lives in `_gflow/prd/index.md`.

This repository uses **grava-workflow**: every change belongs to a Jiku requirement, whose
specification (scope, proposal, acceptance criteria) lives in Jiku; the product definition — what is
built, its rules and why — lives in `_gflow/`. Read this guide before touching code or docs.

The repository was adopted, not bootstrapped, and still deviates from several grava-workflow
defaults (no Makefile, no root Compose, no OpenTelemetry, no health endpoints, services at the
root instead of `services/`). The list and the planned changes are recorded in Jiku as the
alignment requirement. Until it lands, use the commands below; do not invent `make` targets.

## Running

Today everything is driven by npm scripts from the root and by `deploy/local.sh`. The alignment
requirement adds the root `Makefile` (`make up`, `make test`, `make check`, `make migrate`…) and a
self-contained root `docker-compose.yml`; until then:

| Command | What it does |
|---|---|
| `npm install` | Installs the seven workspaces; its `postinstall` builds `packages/*` |
| `npm run build` | Builds `packages/*`, `@jiku/api` and `@jiku/core` (not the frontends) |
| `npm test` | Tests of `@jiku/nats-protocol`, `@jiku/api`, `@jiku/core`, `@jiku/web` and `@jiku/opus-web`. api and core start an ephemeral PostgreSQL 15.4 in Docker unless `CI=true`; `KEEP_DB=true` keeps it |
| `npm run test -w @jiku/api` (or any workspace) | One workspace's tests |
| `npm run test:unit -w @jiku/api` / `npm run test:integration -w @jiku/api` | api unit / integration level |
| `npm run lint` | ESLint in every workspace |
| `npm run format` / `npm run format:check` | Prettier at the root |
| `npm run upgrade-db -w @jiku/api` | Apply the migrations (the api also applies them at startup) |
| `cd deploy && ./local.sh up` / `down` / `logs [svc]` | Start / stop (deleting data) / follow the whole product locally. Needs a filled `deploy/.env`, a real Zitadel, the NATS creds from `deploy/nats/bootstrap.sh`, `nsc` and a schema dump (`DUMP_FILE`); see `README.md` |
| `scripts/set-version.sh --check` | Verify every package carries the same version (CI runs it) |

There is no typecheck script: `npm run build` (`tsc`) is the type check for packages, api and core;
the frontends are only type-checked by `next build` inside their Docker build. There are no e2e
tests and no JUnit reports yet.

What CI runs (`.github/workflows/ci.yml`): `npm ci`, `scripts/set-version.sh --check`,
`npm run build`, `npm run lint`, `npm test`, against a PostgreSQL 15.4 service. Run the same before
closing any work.

## Services

| Service | Folder | What it is |
|---|---|---|
| api | `api/` | HTTP service (Express 5) for the two frontends: reads PostgreSQL with a read-only role, turns every write into a NATS command to core, proxies the optional documentation module, runs the migrations at startup |
| core | `core/` | The only service that writes. No HTTP: NATS micro services `jiku-commands` and `jiku-queries`, domain events on JetStream, identity mirror, notification outbox |
| web | `web/` | "Gestión interna": the internal frontend (Next.js 16, App Router) for admins and team members |
| opus-web | `opus-web/` | "Portal de clientes": the client portal (Next.js 16) |
| models | `packages/models/` | `@jiku/models`: shared Sequelize models used by api and core |
| nats-protocol | `packages/nats-protocol/` | `@jiku/nats-protocol`: the bus grammar — subjects, inbox hash, reply envelope, error codes, event types, ULID |
| zitadel-auth | `packages/zitadel-auth/` | `@jiku/zitadel-auth`: obtains and renews the Zitadel service-user JWT that api and core use to connect to NATS |

Each folder has its own `AGENTS.md` with the stack, the commands and the canonical examples.
Infrastructure (Composes, NATS, auth-callout policy) lives in `deploy/`.

## Where things are

| What | Where |
|---|---|
| Product definition (what is built, rules, decisions) | `_gflow/prd/` — start with `_gflow/prd/index.md` |
| Contracts of each service | `_gflow/apis/`: `api.openapi.yaml` (HTTP), `core.asyncapi.yaml` (commands), `core-queries.asyncapi.yaml`, `core-events.asyncapi.yaml`, `jiku-modules.asyncapi.yaml` |
| Database schemas | `_gflow/db-schemas/` |
| Flows across services | `_gflow/flows/` |
| The original discovery | None: the product was adopted from existing code. The previous internal docs (ADRs, flows, stories) are in `old_docs/`, historical and not maintained |
| Specification of a requirement | In Jiku: `python3 .claude/scripts/grava.py spec show {id}` |
| Documentation for people | `README.md`, `docs/operacion.md`, `docs/integracion.md`, `CHANGELOG.md`; the public English docs in `documentation/` |
| Code | `api/`, `core/`, `web/`, `opus-web/`, `packages/*` (at the root, not under `services/`) |
| Migrations | `api/db-upgrade/migrations/` (sequelize-cli) |
| Deployment and bus policy | `deploy/` (Composes, `.env.dist`, `nats/`, `nats/auth-callout/`) |
| Test reports | `reports/` (not versioned; nothing writes there yet) |

To load only the part of the definition a task touches:
`python3 .claude/scripts/grava.py load --block {PREFIX}` (or `--id`, `--entity`, `--module`).

## Answering questions about the product

When asked how the product behaves or why, load the relevant part of the definition
(`grava.py load …`) and answer citing its IDs (`CAN-E1`, `DEC-04`). When given a new idea, say which
rules and decisions it touches or contradicts, what it would change, and whether it would be a new
requirement (`/req-specify`) or a small change (`/change`).

## How work is done

- **Every change belongs to a Jiku requirement.** A feature or improvement is specified with
  `/req-specify {id}` and implemented with `/req-implement {id}`. A bug or a small change goes through
  `/change {id}`. `/status` shows what is pending; `/product-release` releases a version.
- **Before starting**, `grava.py git-check`: work starts from an up-to-date, clean `dev`.
- **Branches:** `feat/{id}-{slug}` or `fix/{id}-{slug}`, from `dev`. The MR/PR targets `dev`; `main`
  is production.
- **Tests carry the ID they prove** in brackets: `[CAN-E1] no cancela un turno que ya empezó`. What to
  test comes from the definition: requirement, failure condition, invariant, guarantee. Existing
  tests still use their old prefixes (`TS-15 ·`, `S-0NN`, `CA-n`); rename them as they are touched.
- **The definition is updated in the same branch** as the code that changes it. On `dev`, what is
  documented is what is built.
- **Language:** documentation for people (`docs/`, `README.md`, `CHANGELOG.md`), what goes to Jiku,
  test names, commit messages and messages to the user are in Spanish; `_gflow/` has Spanish content
  with English identifiers; code, code comments and the `AGENTS.md` files are in English. The
  existing English sections of `README.md` and `documentation/` are public and stay in English.
- **Commits** follow Conventional Commits and name the requirement: `feat(api): cancelación por
  WhatsApp (#812)`.
- **The guides stay true:** a change to a command, a URL, a service, a background process or a practice
  updates `README.md`, `docs/operacion.md` and `AGENTS.md` in the same branch.
- **Observability:** today there is no OpenTelemetry, no health endpoint and logs are plain winston
  text. New code should not make that worse; the alignment requirement brings the defaults of
  `.claude/specs/engineering.md`.
- **One version for the whole monorepo**, set by `scripts/set-version.sh X.Y.Z`. Pushing a `v*.*.*`
  tag publishes the Docker images to Docker Hub: never push a tag; that is the user's action.

## Never

- Commit secrets or `.env` (`deploy/.env`, `deploy/nats/creds/`, `local/` are git-ignored on purpose).
- Edit a migration already on `dev`: add a new one.
- Write to the database from `api`: every write is a command to `core`.
- Change an API contract used by external integrators unless the specification says so.
- Contradict a decision in `_gflow/prd/decisions.md` without reverting it in a requirement.
- Edit the generated indexes by hand (`_gflow/prd/blocks/index.md`, `_gflow/prd/domain/index.md`,
  `_gflow/flows/index.md`): regenerate them with `python3 .claude/scripts/grava.py def-index`.
- Write code-level detail in Jiku: the client may read it.
