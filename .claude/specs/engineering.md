# Engineering

The defaults every product follows without the user defining anything: how the repository is laid
out, how things run, how they are tested, how contracts are written, how branches and versions work.
Read this before building, changing or testing code.

## CRITICAL RULES

1. **Fix the what, free the how.** This document fixes outcomes and interfaces: what must exist,
   how it is run, what a test must prove, how a contract looks. How to write the code is the agent's
   decision.
2. **Research before choosing, never from memory.** Before choosing or upgrading a framework,
   library, tool or base image — and before starting a service — check the **official
   documentation and release notes** (WebSearch/WebFetch) for the current stable version and its
   recommended practices. Choose what is fastest to build and most robust to run. Training data is
   stale; the official source is not.
3. **Record what you chose.** Every stack choice goes into the service's `AGENTS.md` (Stack table).
   A choice that discards a real alternative the product cares about (a database engine, a queue, a
   provider) is a technical decision in `prd/decisions.md`, with its motivo. A choice that deviates
   from a default of this document is always a technical decision.
4. **The user's constraints win.** A language, provider or tool fixed in the discovery, in a
   decision, or in the specification's "Technical detail" is not reconsidered.
5. **Evidence over claims.** Nothing is done until a test proves it, the test passes, and the
   evidence is computed from the test reports.
6. **Mechanical checks over prose.** If a rule can be checked by a linter, a type checker, a test or
   a hook, it goes there. A check's error message is the instruction.

## Repository

Every product is a **monorepo**:

```
AGENTS.md  CLAUDE.md         # agents: how to work in this repo (CLAUDE.md imports AGENTS.md)
README.md  CHANGELOG.md      # people
Makefile                     # the single entry point for running anything
docker-compose.yml           # the whole product, locally
.env.example                 # every variable, with safe defaults; .env is never committed
.gitlab-ci.yml | .github/workflows/
services/{service}/          # one folder per service (the "Folder" of services.md)
  AGENTS.md  CLAUDE.md       # the service: stack, commands, canonical examples, gotchas
  Dockerfile  Makefile
docs/                        # people: the operations guide, the integration guide (if there are external integrators)
_jflow/                      # agents: project.yaml and the product definition (see Product Definition)
reports/                     # test reports (git-ignored)
```

## Running: Docker Compose and Make

- **Everything runs with Docker Compose**: every service, its database, its broker, its mail catcher
  (Mailpit for SMTP), its external fakes. `make up` must bring the whole product up from a clean
  clone with only Docker installed.
- **Make is the interface.** Agents and humans never need to remember a stack-specific command.
  Root `Makefile` targets (each delegates to `services/*/Makefile`; `S={service}` limits it to one):

| Target | Does |
|---|---|
| `make up` / `make down` | Start / stop the whole product |
| `make logs` | Follow the logs |
| `make dev` | Run with hot reload |
| `make test` | Every test level, writing JUnit XML to `reports/junit/` |
| `make test-unit` / `make test-integration` / `make test-e2e` | One level (`test-e2e`: every entry of the product against `make up`, as `prd/architecture/testing.md` says) |
| `make test-perf` | The performance tests of the NFRs verified by a test. Not part of `make check` nor of each MR's CI |
| `make lint` / `make typecheck` / `make fmt` | Static checks / formatting |
| `make check` | `lint` + `typecheck` + `test`: what must pass, locally, before a requirement is done. CI runs its fast part (see CI) |
| `make migrate` | Apply database migrations |
| `make build` | Build the images |

- Tests that need infrastructure (database, broker) run it through Compose (a `test` profile or a
  dedicated compose file), never against a developer's local install.
- Configuration comes from environment variables, validated at startup; the service fails fast with
  a clear message when one is missing. Product parameters use the variables in
  `prd/parameters.md`.

## Testing

**What to test comes from the definition, by ID:**

| Element | Test |
|---|---|
| Block requirement with an actor | The case that works, through the service's public interface |
| Rule (requirement without actor) | The rule holds, including its limits |
| Failure condition | The failing case and its exact result (error code, message, state left) |
| Invariant | An attempt to violate it from every path that can, which fails |
| Guarantee | The mechanism under its real condition: concurrency (parallel requests), atomicity (a failure mid-way leaves nothing), delivery (retries), recovery (process after a downtime) |
| Contract operation | Its responses validate against the OpenAPI/AsyncAPI document |
| Entry of the product (a surface, or an interface a service exposes) | An end-to-end test against `make up`, through the real entry and with the real authentication, as `prd/architecture/testing.md` says (below) |
| NFR verified by `test` | A local criterion of the requirement in its «Tested in» (`[{id}-AC-NN][NFR-xx]`): a seeded volume from its target, a load with margin, a static check of a platform setting |

**Naming.** Every test that proves an ID has the ID in brackets in its name:
`[CAN-E1] does not cancel an appointment that already started`. Local criteria: `[812-AC-01] …`. A test may prove several
IDs: `[RES-01][RES-18] …`. `jflow.py coverage` reads these names.

**How:**

- Integration tests run against a **real database** in a container, with migrations applied. Never
  mock the product's own database.
- Time is controlled (an injectable clock); no test waits on the wall clock.
- External systems are faked at the boundary (a fake server or a container: Mailpit for SMTP), never
  by mocking the product's own modules.
- Tests are independent and repeatable: each one creates its data.
- **JUnit XML**: `make test` writes one report per service and level to
  `reports/junit/{service}-{level}.xml`. Every stack in use supports it (Vitest/Jest reporters,
  `gotestsum` for Go, Playwright, `flutter test --machine` + a converter). `jflow.py evidence` reads
  these reports.
- Write the test for a criterion before or together with its code, and see it fail first when it
  proves a fix.

**How the product is tested: `prd/architecture/testing.md`.** Every product says, in its definition, how
each of its entries is tested end to end: a row per surface, per interface a service exposes (`Exposes`
of `services.md`: HTTP, NATS, CLI), per role (how the test gets its identity) and per external
integration (how it is replaced). `jflow.py def-check` requires every row (`T1`–`T3`) and
`jflow.py def-testing` adds the missing ones. Who keeps it: the base requirement builds it, the adoption
completes it, every requirement that adds an entry, a role or an integration adds its row and its test.

- **An end-to-end test enters as the actor does**: the browser or the app for a surface; an HTTP client
  with a real token for an API; a client of the broker, authenticated like the actor, for a bus. Never
  by calling the service's own code (a dispatcher, a handler): that is an integration test.
- **Identity is an external system too, replaced at the boundary.** By default, a fake issuer in the
  `test` profile of Compose signs tokens with the same claims the real provider puts (roles,
  subject, audience), and the services and the broker's authentication are pointed at it in that
  profile. When the product cannot accept another issuer, test identities of the real provider
  (a user or machine user per role) go in `.env`, named in `.env.example` and in the README, with a
  technical decision (`DEC-T`) that says why. Either way, the tests get their identities with no one
  in the loop.
- **Other external systems**: Mailpit for SMTP, a fake server or a container for an API, the local
  version when there is one (S3 → MinIO). A real sandbox only with credentials in `.env` and a
  technical decision.
- **The test data** is created by the tests or by a seed of the `test` profile, never by hand.

**End to end, by platform** (the `Plataforma` of each surface in `prd/index.md`, and the interfaces of
the services):

| Platform | While building | At the close of a requirement (before the verifier, and by the verifier) |
|---|---|---|
| `web` | Unit and component tests | Playwright against `make up`, one project per browser the compatibility NFR names |
| `mobile-app` | `flutter test` (unit and widget), fast, no emulator | `integration_test` on an Android emulator, **locally** (headless, KVM, in the Flutter container, with the system image of the minimum version of the compatibility NFR) against `make up`. No connection is tested with airplane mode (`adb shell cmd connectivity airplane-mode enable`). iOS: a macOS runner, or a technical decision that declares it is not built |
| `desktop-app` | Unit and widget tests | The app built and driven by its framework's end-to-end tool |
| `HTTP` | Unit and integration tests (the service in process, real database) | An HTTP client against `make up`, with a token of each actor the requirement touches; responses validated against the contract |
| `NATS` | Unit and integration tests (the handler in process, real database) | A client connected to the broker of `make up`, authenticated as each actor the requirement touches; messages validated against the AsyncAPI contract |
| `CLI` | Unit tests | The binary built and run against `make up` |

- **Render errors fail the test**: an error of the client while rendering (a Flutter overflow, a
  console error in the browser) is a failure, not a warning.
- **Screenshots**: the end-to-end test of a requirement saves a screenshot of every screen it goes
  through, at two sizes (a small and a large phone, or a narrow and a wide window), to
  `reports/screenshots/{id}/`. They are for the verifier and the MR, not compared pixel by pixel.
  When the requirement has a visual reference, each screen of it is captured in its state and named
  after it, and `jflow.py visual-pairs {id}` sets each one next to its reference.
- **Performance** (`make test-perf`): a load tool in a container (k6 or equivalent) against
  `make up`, seeded with the NFR's volume, asserting its target with a margin. Shared machines make
  these flaky: they run locally, at the close of the requirement that owns them.
- **Where the slow levels run**: locally, never in CI (the runners are small). At the close of a
  requirement, the end-to-end tests of every entry it touches (its blocks' surfaces and its modules'
  services); before every release, the whole suite and
  `make test-perf` as a regression (`/jflow-release`). The evidence they produce goes to the MR.

## Contracts

- HTTP: OpenAPI 3.1 or later. NATS/events: AsyncAPI 3. In `_jflow/apis/`, following the extensions of
  the Product Definition.
- **The contract is verified by tests**: every response in the integration tests is validated
  against the document (a validator middleware in tests, or a contract-test library). An operation
  without a contract entry fails the build.
- Defaults (a product deviates only through a technical decision):

| Concern | Default |
|---|---|
| Errors | RFC 9457 `application/problem+json`, with `code` (stable, English snake_case, derived from the failure condition) and `detail` in the product language for the user |
| Instants | RFC 3339 in UTC (`2026-10-26T13:00:00Z`) |
| Identifiers | UUIDv7 strings; secrets and capability tokens are random ≥128 bits, never UUIDv7 |
| Lists | Cursor pagination: `?limit=&cursor=` → `{ items, nextCursor }` |
| Versioning | Internal APIs: none (the contract and its consumers change in the same MR). APIs consumed by external integrators: major in the path (`/v1`), and a breaking change keeps the previous major until the integrators move |
| Fields | `camelCase`, from the schema's column names |
| Health | `GET /health` (liveness) and `GET /health/ready` (readiness), with the shape of Monitoring, tag `system` |

- A breaking change to an operation that external integrators consume is a decision in the
  specification, never a side effect.

## Input defaults

How every input is bounded and compared when the product definition does not say otherwise. A value
the definition fixes (an attribute's `Restricciones`, a parameter, a failure condition) always wins.
These defaults live in the contract (`maxLength`, `format`, `minimum`, `maximum`) and the schema
(column types, `CHECK`), never in the specification: like the wire format, they are not gaps and need
no failure condition of their own.

| Concern | Default |
|---|---|
| Text length (characters, after trimming) | Email 254; URL 2048; phone in E.164; short text — names, titles, labels — 200; long text — descriptions, notes, comments — 2000; external identifiers and keys (an idempotency key, a reference from another system) 255 |
| Trimming | Leading and trailing whitespace is removed from every text field, except passwords, secrets and tokens, which are never altered |
| Required text | Empty after trimming means missing |
| Numbers | Integers between 0 and 2,147,483,647; money non-negative with two decimals, up to 999,999,999.99; durations and quantities greater than 0. Negative or zero values only when the definition allows them |
| Equality in a uniqueness rule | Emails ignore case (stored lowercase); a URL's scheme and host ignore case; any other text is compared exactly, after trimming |
| Invalid input | A value that breaks its schema (type, format, length, range, a missing required field, an unknown enum value) is rejected before any rule runs: `400`, `code: validation_failed`, with `errors: [{ field, code }]` naming every field that failed. The block's failure conditions are for business rules, not for these |
| Action the current state does not allow | `409`, `code: invalid_state`, with the current state — repairing what is already in repair, removing what is already removed. Unless the definition says the action is ignored |
| Operation the role does not allow | `403`, `code: forbidden`. **Who** may run each operation is the definition's (Roles, `x-roles`); only the answer is a default |
| Missing resource | An operation on an identifier that does not exist, or that the actor's data scope does not reach, answers `404`, `code: not_found` — the same answer in both cases, so it reveals nothing. A reference inside the body to something that does not exist is `422`, `code: reference_not_found`, with the field |

A product that needs a different bound for the business (a 60-character service name, a maximum
price) states it in the discovery as a restriction of the attribute; then it is a rule of the
definition and has a failure condition.

## Security baseline

- Secrets only in environment variables; `.env` is git-ignored; `.env.example` has safe placeholders.
  A secret scanner (gitleaks or equivalent) runs in CI.
- Input is validated at the boundary of every service against an explicit schema.
- Every operation enforces its `security` and `x-roles`; data scope is checked server-side.
- Passwords: Argon2id. Tokens: random ≥128 bits, stored hashed (SHA-256). Sessions follow
  `prd/architecture/auth.md`; browser sessions use httpOnly, Secure, SameSite cookies.
- Errors never leak stack traces or internals. Logs never contain secrets or personal data marked in
  the schema.
- Dependencies: lockfile committed; a dependency audit runs in CI. Every new dependency exists, is
  maintained, and is the official or most adopted option (check before adding it).
- Rate limiting on authentication endpoints: by default 20 attempts per minute per client, keyed by
  an address the client cannot choose. The limit is a parameter of the product definition, and its
  rejection a failure condition of the block.
- **Outbound requests to an address an actor provides** (webhooks, callbacks, imports from a URL):
  - only `https` (and `http` only if the definition allows it);
  - the host is resolved and the request is refused if any resolved address is loopback, private
    (RFC 1918, `fc00::/7`), link-local (including the metadata address `169.254.169.254`),
    unspecified, multicast or reserved. This is checked when the address is registered (a
    `validation_failed` with `code: destination_not_allowed` on the field) and again when
    connecting, on the resolved IP, so DNS rebinding cannot bypass it;
  - redirects are not followed;
  - connect and total timeouts (default 10 s) and a cap on the response body read (default 1 MiB).
  A refused connection at delivery time counts as a failed attempt of the block's own retry rules.
  Tests reach local test servers through an allowlist set by configuration, empty by default. A
  product that must reach internal destinations (integrators on the same network) records it as a
  technical decision.

## Observability

OpenTelemetry, so the product connects to any observability stack later by configuration alone.

- Every service uses the official OpenTelemetry SDK of its language, with the automatic
  instrumentation of HTTP, the database and NATS where the stack has it.
- Configured only with the standard variables: `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`,
  `OTEL_RESOURCE_ATTRIBUTES` (environment, version). Without an endpoint nothing is exported and the
  service works the same.
- **Traces**: one per request, propagated across services with W3C `traceparent` (HTTP headers and
  NATS message headers). Exceptions are recorded on the span.
- **Logs**: structured JSON to stdout with the OpenTelemetry field names (`timestamp`, `severity`,
  `service.name`, `trace_id`, `span_id`, message and attributes). The trace id is the correlation id:
  responses return it in a header. Logs never contain secrets or personal data marked in the schema.
- **Metrics**: the automatic ones (count, errors and duration of every operation; runtime). Business
  metrics only when a requirement asks for them.
- **Locally**: an optional Compose profile with a collector and an all-in-one viewer (for example the
  `grafana/otel-lgtm` image), off by default. In tests the exporter is disabled.

## Monitoring

- **Health**: `GET /health` (liveness) and `GET /health/ready` (readiness), both answering
  `{ "status": "up|down", "version": "…", "commit": "…", "checks": { "<dependency>": "up|down" } }`.
  Compose healthchecks and the image `HEALTHCHECK` use them.
- **Background processes** (schedulers, workers, queue consumers): each run records its duration,
  result and the time of its last success as metrics; a worker that stops working turns readiness
  `down`.
- **Queues and outboxes**: pending messages and the age of the oldest one, as metrics.
- **Graceful shutdown**: on `SIGTERM` a service stops accepting work, finishes what is in progress and
  exits.
- **The operations guide** (`docs/operacion.md` in Spanish, `docs/operations.md` otherwise; people,
  product language, from the template: [es](../templates/es/operacion.md),
  [en](../templates/en/operations.md)): the health
  endpoints of each service, the background processes, the configuration variables and the
  **recommended alerts** (service down, error rate, latency, process that did not run, queue backlog),
  with thresholds from the NFRs of availability and times. No alerting tool is chosen: the guide says
  what to alert on. Every requirement that adds a service, a process or an integration updates it.

## Database

Schema conventions: [Database](database.md). Migrations are versioned files in the service, applied
by `make migrate` and in the test setup. A migration already merged to `dev` is never edited: a new
one fixes it.

## Git

| Item | Default |
|---|---|
| Branches | `dev` = integration; `main` = production. `feat/{id}-{slug}` for a specified requirement (`-2`, `-3`… when it is reopened after a merge), `fix/{id}-{slug}` for a direct change, both from `dev` (`jflow.py branch`). Branch names are English. The base product is built like any requirement, on `feat/{id}-base-product` |
| Before starting | `jflow.py git-check`: on `dev`, up to date with the remote and clean. Behind the remote or with uncommitted changes: stop until pulled or committed. On another branch or without a remote: warn and ask |
| Specifications | In Jiku, never in the repository (see Requirement Spec) |
| Commits | Conventional Commits in English: `feat(api): cancel by WhatsApp (#812)`. One commit per coherent step; never a commit that breaks `make check` at the end of the branch |
| MR/PR | From the requirement's branch to `dev`. The agent pushes the branch and leaves the description (`jflow.py mr-text {id}`); the user opens it, reviews, tests and merges |
| Release | `/jflow-release`: CHANGELOG section from the requirements merged in `dev` that `main` does not have, merge `dev` → `main`, tag `vX.Y.Z` on `main` |

## Versioning

- Semantic versioning per product. MAJOR: a breaking change to a contract consumed by external
  integrators, or to data a user depends on. MINOR: new functionality. PATCH: fixes.
- `CHANGELOG.md` follows Keep a Changelog, in the product language, with an `[Unreleased]` section
  on top (`[Sin publicar]` in Spanish) and each entry citing its requirement (`#812`).
- Each contract has its own `info.version`, bumped by the requirement that changes it.

## CI

From `_jflow/project.yaml` (`git.platform`): `.gitlab-ci.yml` for GitLab, GitHub Actions for GitHub.
CI runs `make` targets, never duplicated commands. What runs depends on the pipeline:

| Pipeline | Runs | Leaves |
|---|---|---|
| MR | lint and typecheck → unit and integration tests (with the Compose services), the secret scanner and the dependency audit | Nothing to download |
| Push to `dev` (after a merge) | The same → build the images and **every client for every platform of its surfaces** (the web bundle, the Android APK, the desktop app) | The latest build of `dev`, at a fixed link (GitLab: `/-/jobs/artifacts/dev/download?job={job}`; GitHub: the artifact of the last run on `dev`) |
| Tag `vX.Y.Z` (created by `/jflow-release`) | The same, in release mode with the tag's version → push the images to the platform's registry | The images, and each client attached to the platform's release of that tag, without expiry |

The end-to-end tests on an emulator and `make test-perf` never run in CI: see Testing.

**CI secrets.** Whatever the pipelines need that is secret (the Android signing key, credentials of
an external registry) is a CI variable of the platform, never a file in the repository:
GitLab, *Settings → CI/CD → Variables* (masked, and protected when only `main` and tags use it);
GitHub, *Settings → Secrets and variables → Actions*. **Every secret is documented in the
operations guide, section «CI secrets» («Secretos del CI» in Spanish)**: its name, what it is, how to
create it (the exact command) and where to set it on each platform. A pipeline that needs a secret that is missing says so
in its log and does what the guide documents (for example, a release APK signed with the debug key,
and a warning), never fails silently. The registry of the platform itself needs no secret: its job
token is enough.

| Android signing (release APK) | Variable | How to create it |
|---|---|---|
| The keystore, in base64 | `ANDROID_KEYSTORE_BASE64` | `keytool -genkeypair -v -keystore release.jks -keyalg RSA -keysize 4096 -validity 10000 -alias {alias}`, then `base64 -w0 release.jks` |
| Its password | `ANDROID_KEYSTORE_PASSWORD` | The one given to `keytool` |
| The key alias | `ANDROID_KEY_ALIAS` | The `{alias}` above |
| The key password | `ANDROID_KEY_PASSWORD` | The one given to `keytool` (the same as the keystore's unless set apart) |

Keep `release.jks` and its passwords out of the repository and somewhere safe: an app signed with a
lost key cannot be updated in the stores.

## AGENTS.md

`AGENTS.md` is how any agent learns to work in the repo. It must always be true: a requirement that
changes a command, a service or a practice updates it in the same branch.

**Root `AGENTS.md`** (from the template):

- What the product is, in two lines, and where its definition lives.
- How to run, test, lint and migrate (the Make targets).
- The workflow: requirements, branches, specifications, evidence, what never to do.
- Where things are: services, docs, reports.

**`services/{service}/AGENTS.md`**:

- **Stack**: `| Concern | Choice | Version | Why |` (HTTP, validation, persistence, tests,
  logging…), with the decision ID when there is one.
- **Commands**: the service's Make targets and what they run.
- **Structure**: where modules, tests and migrations live (one short list).
- **Canonical examples**: paths of the best example of each kind of code (an endpoint with
  validation and error mapping, a transaction with a guarantee, a job, an integration test, an e2e
  test). Filled when the first one exists; kept current.
- **Recurring errors**: one line each, added when the same mistake shows up twice (in the
  verifier, in CI or in review).

Each `AGENTS.md` has a sibling `CLAUDE.md` containing only `@AGENTS.md`, so Claude Code loads it when
working in that folder. `AGENTS.md` files are for agents: they are written in English.

## README.md

Every product has a `README.md` at the root, for people, in the product language (from the
template: [es](../templates/es/README.md), [en](../templates/en/README.md)): what the product is, for
whom and what it solves; how to start it and the URL of each surface, the API and the local tools; what is needed to use it locally
(for example, how to create the first user); the main `make` commands; and where the documentation
is. It must always be true: a change to a command, a URL, a surface or a local setup step updates it
in the same branch. `jflow.py def-check` fails if it is missing or has unfilled markers.

## Documentation for people (`docs/`)

`docs/` is for people and never repeats the definition (that is `_jflow/` and Jiku):

File names depend on the product language ([Language](language.md)): Spanish name for `es`, English
otherwise.

- The operations guide (`docs/operacion.md` | `docs/operations.md`): how to operate the product (see
  Monitoring). Always present.
- The integration guide (`docs/integracion.md` | `docs/integration.md`): only when the product has
  external integrators — how to authenticate, which operations to use, how versions change —
  linking to the contracts in `_jflow/apis/`.
- The adoption report (`docs/adopcion.md` | `docs/adoption.md`): only in an adopted product — the
  report of the adoption (from the template: [es](../templates/es/adopcion.md),
  [en](../templates/en/adoption.md)). A record of that day: nobody keeps it up to date.

The bootstrap and the adoption create them; `/jflow-build` updates them (not the adoption report)
when its change touches what they describe; the verifier checks it.

## Adopting an existing product: the minimum

An adopted product is ready to specify and implement only when it has the minimum below: what the
skills and the verifier run. `/jflow-product-brownfield` brings the repository to it and finishes only when every
row holds: nothing is left pending (what only the user can give, it asks for). Everything else in this document is a
default the adopted product follows from then on, in new work; its current deviations are listed in
the adoption report and become work only if the user decides so.

| # | Minimum | Why the workflow needs it |
|---|---|---|
| M1 | Layout of [Repository](#repository): `services/{service}/` for every service, shared libraries in their own folder, every reference updated (imports, workspaces, Dockerfiles, Compose, CI, scripts, guides) | Skills, guides and the definition use these paths |
| M2 | Root `Makefile` and one per service with every target of the table above. A level with no tests yet exits 0, except `test-e2e` (M9) | The skills and the verifier run `make check`, `make test-e2e`, `make up` |
| M3 | `make test` writes JUnit XML to `reports/junit/{service}-{level}.xml` | `jflow.py coverage` and `evidence` read them |
| M4 | `.env.example` with every variable of every service and safe defaults; `.env` and `reports/` git-ignored | Starting the product from a clone |
| M5 | `docker-compose.yml`: `make up` brings up the whole product from a clean clone — every service, its database with its schema built by the migrations from an empty database, broker, storage, Mailpit. An external dependency with no local version (an identity provider, a third-party API) is configured by `.env` variables that the README explains how to obtain | `/jflow-build` exercises the change with `make up`; the end-to-end tests run against it |
| M6 | `make check` passes, without external services or credentials: integration tests against the database of Compose with the migrations applied, external systems faked at the boundary | The verifier rejects any failure: a red suite blocks every requirement |
| M7 | CI runs the fast part of `make check` through `make` | The same check locally and in CI |
| M8 | Guides (`README.md`, the operations guide, `AGENTS.md` files), contracts in `_jflow/apis/`, the integration branch | What every skill reads |
| M9 | `prd/architecture/testing.md` complete (no `{{fill: …}}` markers), and everything it needs to run: the fake issuer or the test identities of every role, the replacement of every external system, the test data. `make test-e2e` runs, against `make up`, at least one end-to-end test per entry (its main path) and passes | Every requirement proves its entries end to end; without this, `/jflow-build` cannot |

`jflow.py conformance` marks which of its checks belong to the minimum.

## Language

The rules are in [Language](language.md). In short:

| Content | Language |
|---|---|
| What people of the product read: `docs/`, `README.md`, `CHANGELOG.md`; what is written in Jiku; the texts and error messages the product shows its users (the RFC 9457 `detail`) | Product language (`language` in `_jflow/project.yaml`, Spanish when unset) |
| `_jflow/` (its rules are copied word for word from Jiku and named in the tests) | Structure (headings, columns, fixed values) in English; content in the product language; English identifiers |
| Git: commit messages, MR/PR text, branch names; test names | English |
| Documents for agents: `AGENTS.md` (root and per service), `CLAUDE.md`, `project.yaml` | English |
| Code identifiers, tables, columns, enums, API paths and fields, `operationId`s, file names | English |
| Code comments | English, only where the code cannot say it |
