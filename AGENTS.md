# Jiku

Project management for a services team: projects, requirements, tasks, worked hours and attachments,
used by the internal team (`web`) and, through a separate portal (`opus-web`), by the team's clients.
Reads go through an HTTP `api` with a SELECT-only database role; every write is a NATS command to `core`.

This repository uses **jiku flow**: every change belongs to a Jiku requirement, whose
specification (scope, proposal, acceptance criteria) lives in Jiku; the product definition — what is
built, its rules and why — lives in `_jflow/`. Read this guide before touching code or docs.

## Running

Everything runs with Docker Compose and is driven by `make`. `make up` needs only Docker; the checks
(`make lint`, `make typecheck`, `make test*`, `make check`) run on the host and also need **Node 24**
(`.nvmrc`): `make` runs `npm ci` itself when the lockfile changes.

| Command | What it does |
|---|---|
| `make up` / `make down` | Start / stop the whole product |
| `make logs` | Follow the logs |
| `make dev` | Start with hot reload |
| `make test` | Every test; JUnit reports in `reports/junit/` |
| `make test-unit` · `make test-integration` · `make test-e2e` | One test level |
| `make lint` · `make typecheck` · `make fmt` | Static checks and formatting |
| `make check` | `lint` + `typecheck` + `test`: what must pass before closing any work. CI (`.github/workflows/ci.yml`) runs its fast part: `make lint typecheck` and `make test-unit test-integration` |
| `make migrate` | Apply the migrations (baseline + `services/api/db-upgrade/migrations/`) to the local database |
| `make build` | Build the images |

`S={service}` limits any command to one service: `make test S=api`.

## Services

Each service folder has its own `AGENTS.md` with the stack, the commands and the canonical examples.

| Service | Folder | What it is |
|---|---|---|
| api | `services/api/` | Express HTTP service for both frontends: validates the token, reads PostgreSQL with a SELECT-only role, publishes every write as a NATS command to core. Owns the migrations |
| core | `services/core/` | The only writer: NATS micro services `jiku-commands` (commands, one transaction each) and `jiku-queries` (reads over the bus), the notification outbox sender, the auth-event consumer |
| web | `services/web/` | Internal frontend (Next.js, App Router, Auth.js as a server-side OIDC client) |
| opus-web | `services/opus-web/` | Client portal (Next.js), for `external-user` |
| models | `packages/models/` | Shared Sequelize models of the database (api and core) |
| nats-protocol | `packages/nats-protocol/` | The bus contract in code: subjects, reply envelope, error codes, event types |
| zitadel-auth | `packages/zitadel-auth/` | Obtains and renews the machine-user token api and core use to connect to NATS |

The shared packages are built by the root `postinstall` and consumed from their `dist/`: after
changing one, `npm run build:packages` (or `npm install`) before api/core see it.

## Local stack

`make up` brings up everything with no credential (`docker-compose.yml`; `.env.example` lists the
variables, none is needed):

- **Identity**: `deploy/test/fake-idp` replaces Zitadel with the same endpoints and claims, at
  `http://localhost:9400` (also `http://idp.localhost:9400`, the issuer the browser sees). Users in
  `deploy/test/fake-idp/users.json`: `admin` (Ana Admin, `admin`), `user` (Uriel Usuario, `user`),
  `external` (Elena Externa, `external-user`), plus the machine users of api and core. Its login page
  lets you pick one; `GET /test/token?user={username}` gives an access token for tests.
- **Storage**: MinIO (`http://localhost:9000`, console `:9001`), bucket created by `storage-setup`;
  presigned URLs use `storage.localhost` so the browser and core resolve the same host.
- **Mail**: Mailpit (`http://localhost:8025`) receives every notification.
- **Docs module**: `deploy/test/fake-docs` stands in for the optional jiku-docs module: it connects
  as the `docs` identity, registers in `JIKU_MODULES` and answers empty lists, plus one shared link
  (`jds_e2e-shared-document-00000000000000000000000`, on `http://127.0.0.1:3100/p/docs/…`).
- **Bus**: NATS (`4222`, monitoring `8222`) in operator mode, its identity generated into a volume by
  `nats-identity`, plus the auth-callout image `gravadigital/nats-zitadel-auth-callout:1.1.0` with
  `CALLOUT_ZITADEL_REQUIRE_PROJECT_AUDIENCE=true` (a token without the project in `aud` does not connect).
  The fake-idp's `GET /test/token?user={username}&variant=other-issuer|other-project` gives the tokens
  the api and the bus must refuse.
- **Database**: `migrate` builds the schema from an empty database (`services/api/db-upgrade/baseline.js`,
  then the migrations); the read-only role comes from `deploy/compose/postgres-init.sh`.
- URLs: web `http://localhost:3000`, opus-web `http://localhost:3001`, api `http://localhost:3100`.

Servers use `deploy/docker-compose.yml` + `deploy/.env` (real Zitadel, S3, SMTP): see `deploy/README.md`.

## Tests

- **Integration** (`make test-integration`): the mocha suites of api and core, against the
  `postgres-test` Compose service (profile `test`, port 55433), on the schema the migrations build.
  NATS, S3, SMTP and the identity provider are faked at the boundary; the api suite runs the real
  core dispatcher in-process through its fake bus (`services/api/tests/mocks/bus.ts`).
- **Unit** (`make test-unit`): vitest in web and opus-web, mocha in `packages/nats-protocol`. api and
  core have no separate unit level.
- **End to end** (`make test-e2e`, brings up `make up` if needed): `services/api/e2e` (HTTP with real
  tokens of the fake-idp), `services/core/e2e` (a NATS client through the auth-callout),
  `services/web/e2e` and `services/opus-web/e2e` (Playwright 1.65.1, run in its official Docker
  image on the host network). They do not run in CI.
- Reports: `reports/junit/{service}-{level}.xml`.

## Where things are

| What | Where |
|---|---|
| Product definition (what is built, rules, decisions) | `_jflow/prd/` — start with `_jflow/prd/index.md` |
| Contracts of each service | `_jflow/apis/` |
| Database schemas | `_jflow/db-schemas/` |
| Flows across services | `_jflow/flows/` |
| The original discovery | None: Jiku was adopted, not discovered. The adoption report is `docs/adopcion.md` |
| Specification of a requirement | In Jiku: `python3 .claude/scripts/jflow.py spec show {id}` |
| Documentation for people | `README.md`, `CHANGELOG.md`, `docs/`: the operations guide and, with external integrators, the integration guide (`operacion.md`, `integracion.md` when the product language is Spanish; `operations.md`, `integration.md` otherwise) |
| Code | `services/{service}/`, shared packages in `packages/` |
| Server deployment (composes, NATS identity, auth-callout policy) | `deploy/` |
| Design tokens and UI components (the only reference: there is no design-system document) | `services/web/src/styles/` and `src/shared/components/ui/`; `services/opus-web/src/` |
| Test reports | `reports/` (not versioned) |

To load only the part of the definition a task touches:
`python3 .claude/scripts/jflow.py load --block {PREFIX}` (or `--id`, `--entity`, `--module`).

## Answering questions about the product

When asked how the product behaves or why, load the relevant part of the definition
(`jflow.py load …`) and answer citing its IDs (`CAN-E1`, `DEC-04`). When given a new idea, say which
rules and decisions it touches or contradicts, what it would change, and whether it would be a new
requirement (`/jflow-spec`) or a small change (`/jflow-fix`).

## How work is done

- **Every change belongs to a Jiku requirement.** A feature or improvement is specified with
  `/jflow-spec {id}` and implemented with `/jflow-build {id}`. A bug or a small change goes through
  `/jflow-fix {id}`. `/jflow-status` shows what is pending; `/jflow-release` releases a version.
- **Before starting**, `jflow.py git-check`: work starts from an up-to-date, clean `dev`.
- **Branches:** `feat/{id}-{slug}` or `fix/{id}-{slug}`, from `dev`. The MR/PR targets `dev`; `main`
  is production.
- **Tests carry the ID they prove** in brackets: `[CAN-E1] does not cancel an appointment that already started`. What to
  test comes from the definition: requirement, failure condition, invariant, guarantee.
- **The definition is updated in the same branch** as the code that changes it. On `dev`, what is
  documented is what is built.
- **Language** (`.claude/specs/language.md`): talk to the user in their language. What people of the
  product read — `docs/`, `README.md`, `CHANGELOG.md`, everything in Jiku, the texts and error
  messages the product shows its users — is in the product language (`language` in
  `_jflow/project.yaml`, Spanish when unset). `_jflow/` has its structure (headings, columns, fixed
  values) in English and its content in the product language, never translated. Git (commits, MR/PR
  text, branch names) and test names, code, code comments, identifiers and the `AGENTS.md` files are
  in English.
- **Commits** follow Conventional Commits, in English, and name the requirement: `feat(api): cancel
  by WhatsApp (#812)`.
- **The guides stay true:** a change to a command, a URL, a service, a background process or a practice
  updates `README.md`, the operations guide and `AGENTS.md` in the same branch.
- **Observability** (`.claude/specs/engineering.md`): JSON logs with `trace_id`, health endpoints with
  version and dependency checks, and OpenTelemetry are the default for new work. **The product does
  not follow it yet**: no service has `/health`, logs are winston text (api, core) or `console`
  (frontends), and there is no OpenTelemetry. `docs/operacion.md` describes what exists; closing the
  gap is a requirement of its own, not something to do in passing.

## Never

- Commit secrets or `.env`.
- Edit a migration already on `dev`: add a new one.
- Change an API contract used by external integrators unless the specification says so.
- Contradict a decision in `_jflow/prd/decisions.md` without reverting it in a requirement.
- Edit the generated indexes by hand (`_jflow/prd/blocks/index.md`, `_jflow/prd/domain/index.md`,
  `_jflow/flows/index.md`): regenerate them with `python3 .claude/scripts/jflow.py def-index`.
- Write code-level detail in Jiku: the client may read it.
