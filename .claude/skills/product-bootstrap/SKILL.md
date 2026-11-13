---
name: product-bootstrap
description: Specify and build the base product from the closed discovery and the "Producto base" requirement - first the technical questions with the user, then, autonomously, the skeleton of every service, tests, CI, observability, the definition of what is built, README, operation guide and AGENTS.md - in its own branch, verified, with the MR text
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, Agent, WebSearch, WebFetch, AskUserQuestion"
argument-hint: "[jiku-requirement-id]"
---

# Bootstrap Product

## Purpose

Turn the closed discovery into a working base product. First **specify** the "Producto base"
requirement with the user: its draft comes from the discovery and a template, and what the template
cannot know is asked — how each surface is tested end to end and built, which non-functional
requirements are verified and how, whether the tools that needs exist, the configuration of what all
services share. Then, without asking: research and build the skeleton of every service, write the
definition of what is built, and prove it with tests against the criteria. It works in its own branch,
like any requirement, and ends verified, with evidence, pushed, with the MR text.

**Flow:**

```
Step 0: Check git, the discovery and the requirement
  |
Step 1: Technical specification with the user → written to Jiku, marked ready; branch
  |                                  (the only step that asks)
Step 2: Definition of the base (script + judgment)
  |
Step 3: Stack research and decision, per service
  |
Step 4: Skeleton: services, Compose, Make, tests, CI, observability, monitoring, guides
  |
Step 5: Prove it: make check, coverage, evidence
  |
Step 6: Verify (verifier subagent) → fix until approved
  |
Step 7: Close: push, MR text, Jiku comment, report
```

**Result:** Branch `feat/{id}-producto-base`, pushed: the skeleton that runs with `make up` and passes
`make check`, the product-level definition in `_gflow/`, `README.md`, `docs/operacion.md`, `AGENTS.md`
files and `CHANGELOG.md`; the MR/PR description in the working folder. In Jiku: the base requirement
specified («Especificación: lista»), in Desarrollo, with a comment carrying the evidence.

**This command does NOT:**

- Ask anything after Step 1 (the specification)
- Build any functional block: each one comes with its requirement of the plan (`/req-specify`, then
  `/req-implement`)
- Open, approve or merge the MR/PR (the user does)

## References

**Read [Engineering](.claude/specs/engineering.md)** — everything the skeleton must provide.

**Read [Product Definition](.claude/specs/product-definition.md)** — what the definition of the base
contains.

**Read [Database](.claude/specs/database.md)** — migrations and the schema conventions.

**Read [Requirement Spec](.claude/specs/requirement.md)** — the specification's format and checks.

**Read [Jiku](.claude/specs/jiku.md)** — the specification, the state and the comment.

## Pre-loaded Context

### Discovery State

!`grep -H "^status:" _gflow/discovery/*.md 2>/dev/null || echo "NO_DISCOVERY"`

### Product Definition Check

!`ls _gflow/prd/ 2>/dev/null || echo "NO_PRD_FOUND"`

## CRITICAL RULES

1. **Use Spanish** for the definition, guides for people, test names, commit messages and Jiku;
   English for code, code comments and `AGENTS.md`
2. **Ask in Step 1, then never** - The technical questions go in Step 1, grouped, each with your
   recommendation. After it, never ask: if the discovery or the specification has a real gap that
   blocks a piece, stop with a report of what is missing and where, never invent it
3. **Transcribe, don't redraft** - The definition comes from `grava.py def-base`. You only resolve its
   markers, from what the discovery says
4. **Research, then decide** - Every framework, library, tool and base image is chosen from its
   official documentation and release notes, checked now (WebSearch/WebFetch), never from memory. The
   language of each service is fixed by the discovery
5. **Build no functional block** - The base is the skeleton: health, configuration, logging,
   OpenTelemetry, error shape, graceful shutdown, database access and migrations setup, test harness
   at every level, Docker, Make, CI, one empty page per surface. A block's tables, operations and
   screens come with its requirement
6. **Evidence, not claims** - Done means `make check` passes, every criterion of the base requirement
   has a passing test named with its ID, the evidence is computed by `grava.py evidence`, and the
   verifier approves
7. **Commit as you go, on the branch** - `feat/{id}-producto-base`, from `dev`. One commit per coherent
   step, Conventional Commits in Spanish with `(#{id})`. Never leave `make check` failing at the end.
   Push only at the close, after the verifier approves
8. **Deterministic work through `grava.py`** - `git-check`, `discovery-check`, `jiku fetch`,
   `spec draft`, `spec check`, `spec push`, `branch`, `jiku state`, `def-base`, `def-index`, `def-check`,
   `coverage`, `evidence`, `mr-text`, `jiku comment`, `out-of-scope`
9. **Do NOT dump content in chat** - Report progress in one line per step

## Execution

### Step 0: Check

`$ARGUMENTS` is the Jiku id of the "Producto base" requirement. If missing, stop: it is created by
`/product-define` (see the requirements it listed, or `grava.py jiku list`).

```bash
python3 .claude/scripts/grava.py git-check --mode base
python3 .claude/scripts/grava.py jiku fetch {id}
```

| `git-check` | Action |
|---|---|
| `OK` | Continue on `dev` |
| `NO_DEV` | Stop: `/product-define` leaves `main` and `dev` ready (`grava.py branches`); run it, or that command |
| `DEV_HAS_MORE` | Warn with the files it found (`dev` should only have the discovery and grava-workflow) and ask how to continue: on top of what is there, or stop |
| `OTHER_BRANCH` | On `feat/{id}-producto-base`: a resumed run (below), no question. Elsewhere: warn and ask how to continue — switch to `dev`, or stop |
| `BEHIND`, `DIRTY` | Stop and say what to do (pull `dev`, commit or discard) |
| `NO_REMOTE` | Continue: the branch is not pushed at the close |

**Resume** — if a branch `feat/{id}-producto-base` exists, this is a resumed run: switch to it and
find the first step whose result is missing (the description not «Especificación: lista» → Step 1;
markers left in `_gflow/` → Step 2; no `services/` → Step 4; failing `make check` → Step 5; no verdict →
Step 6), tell the user in one line, and continue.

**Preconditions** (when not resuming):

- Every discovery document is `closed`, and `python3 .claude/scripts/grava.py discovery-check --final`
  reports nothing. Otherwise stop and suggest `/product-define`.
- The requirement is the base of this project, with its criteria (`{id}-AC-NN`). Its state: `en_cola`
  or `planificacion` → continue; anything else → warn and ask.

---

### Step 1: Technical Specification

The draft in Jiku comes from the discovery and the template of the base: it cannot know everything a
product needs to be built and proven. If the requirement's description already says «Especificación:
lista», skip to the branch at the end of this step.

```bash
python3 .claude/scripts/grava.py spec draft {id}
```

Read the draft and the discovery (`technical-analysis.md`, the surfaces and NFRs of
`functional-analysis.md`), and sweep for what is not fixed:

| Topic | What must be fixed |
|---|---|
| Platform | For each surface, by its `Plataforma` (`web`, `mobile-app`, `desktop-app`): how it is tested end to end and what CI builds. A criterion the template wrote for another platform (an e2e "in a real browser" for a mobile app) is wrong: replace it |
| Non-functional requirements | The table «Requisitos no funcionales» of the draft, every row: `prueba` (a test — `Prueba en`: `base`, or the `#id` of the part that builds the operation it names; a volume is a seed, a time is a load with margin, a platform version is a static check plus the build), `alerta` (availability, schedules: an alert in `docs/operacion.md`) or `revisión` (what no test proves well: a real device, accessibility by eye). Recommend; `spec check` (`S19`) accepts nothing else. Every `prueba` with `base` becomes a local criterion of this requirement (`{id}-AC-NN`: «Cumple NFR-xx: …») |
| Tools | Whether what the criteria need exists where it will run: locally, Docker and KVM for the Android emulator and the browsers; in CI, a macOS runner for iOS. What cannot run is a deviation the user accepts now, as a technical decision (`DEC-T`), not a surprise later |
| CI secrets | What the pipelines will need that is secret (the Android signing key for release builds, an external registry): the user creates them following `docs/operacion.md`, «Secretos del CI»; until then, the documented fallback (a release APK signed with the debug key, with a warning) |
| Shared infrastructure | What every service shares and the discovery leaves open: the email sender, the broker, the observability backend, credentials of the integrations. A value whoever deploys sets is a configuration variable, with no invented value |

Ask what is missing with `AskUserQuestion`, grouped (up to 4 per call), each with your recommendation
first. Write the answers in the draft — criteria (`{id}-AC-NN`), parameters, technical decisions with
motivo — and confirm the whole («¿Cerramos la especificación del producto base?», listing your
assumptions). If nothing is missing, say so and confirm in one question. Then:

```bash
python3 .claude/scripts/grava.py spec check {id} --source draft
python3 .claude/scripts/grava.py spec push {id}
```

No observations allowed. The confirmation above is the approval of what is written in Jiku: the
specification of the base and its line «Especificación: lista». `spec push` refuses if the
specification changed in Jiku since the draft started; then show the user and merge those changes. Then the branch, and the state:

```bash
python3 .claude/scripts/grava.py branch {id} producto-base
python3 .claude/scripts/grava.py jiku state {id} desarrollo
```

From here on, do not ask anything.

---

### Step 2: Definition of the Base

```bash
python3 .claude/scripts/grava.py def-base
```

It writes the
product-level definition: index (actors, surfaces), glossary, NFRs, out of scope, the decisions and
parameters that belong to no block, services, persistence and communication, the shared part of each
schema. Blocks and what they need come with their requirements.

Resolve its markers, only from the discovery — and the columns `Verificación` and `Prueba en` of
`nfr.md`, from the table «Requisitos no funcionales» of the specification you wrote in Step 1: the `Servicio` of each surface (the frontend that serves
it, from the technical analysis), parameter variables (`UPPER_SNAKE_CASE`, English, unit as suffix:
`BOOKING_HORIZON_DAYS=30`). Review, without adding definitions, the `Alcance` of the NFRs (`producto`,
a surface or a service).

```bash
python3 .claude/scripts/grava.py def-index
python3 .claude/scripts/grava.py def-check
```

Fix every observation of `_gflow/` (writing errors only); the guides (`H1`, `H2`) are filled in
Step 4. Commit: `docs: definición del producto base (#{id})`.

---

### Step 3: Stack Research and Decision

For each service in `_gflow/prd/architecture/services.md`:

1. Its language or framework is fixed (column `Lenguaje`, from the discovery).
2. **Research** the official documentation and release notes of that framework now: current stable
   major, recommended project setup, testing approach, and the official or most adopted options for
   each concern the skeleton needs (HTTP server or app framework, validation, database access and
   migrations for the chosen engine, logging, OpenTelemetry SDK and instrumentations, test runner with
   JUnit output, end-to-end testing, linting and formatting, container base image). Prefer what is
   fastest to build with and most robust to run; prefer fewer dependencies.
3. **Decide** and write the `Stack` table of `services/{service}/AGENTS.md` (from
   [the service template](.claude/templates/service-AGENTS.md)): concern → choice → version → one-line
   reason citing the source.
4. Respect every technical decision of the discovery (`_gflow/discovery/technical-analysis.md`,
   Decisiones técnicas) and every guarantee mechanism: the stack must make them implementable (for
   example, raw SQL migrations for exclusion constraints and triggers).
5. A choice that deviates from an engineering default, or that discards a real alternative the
   product cares about, is a decision the user did not take: stop and report it (CRITICAL RULE 2).

For several services, research them in parallel with one `Agent` per service (general-purpose), each
returning the Stack table with sources. Decide yourself from their reports.

---

### Step 4: Skeleton

Build what [Engineering](.claude/specs/engineering.md) requires, for every service, with the chosen
stack. Write tests **with** the code, tagged with the criterion they prove (`[{id}-AC-01] …`, Spanish
names).

| Piece | Contents |
|---|---|
| `services/{service}/` | Configuration from validated environment variables (the parameters' variables included); OpenTelemetry (traces with `traceparent`, JSON logs with `trace_id`/`span_id`, metrics; `OTEL_*` variables, nothing exported without an endpoint); health endpoints with status, version, commit and dependency checks; RFC 9457 errors; graceful shutdown on `SIGTERM`; database client and migrations setup (no functional tables: only extensions and shared functions of the schema's shared part); module folders, empty; for a frontend, one minimal page per surface showing the product name and its backend's health |
| Tests | Unit, integration (against the database in Compose) and end-to-end (frontends, Playwright for web), each writing JUnit XML to `reports/junit/{service}-{level}.xml` |
| Contract | `_gflow/apis/{service}.openapi.yaml` (or `.asyncapi.yaml`) with the general operations (tag `system`, `x-origin: '#{id}'`), validated by the integration tests |
| `services/{service}/Dockerfile`, `Makefile` | Multi-stage image, non-root, `HEALTHCHECK` on the health endpoint; the service's targets |
| `docker-compose.yml` | Every service, its database, Mailpit if the product sends email, with healthchecks; a test setup for integration and e2e; an optional `observability` profile with a collector and viewer |
| Root `Makefile` | The targets of Engineering, delegating to each service; `S=` to limit |
| CI | `.gitlab-ci.yml` or `.github/workflows/ci.yml` (from `_gflow/project.yaml`), running `make` targets, the secret scanner and the dependency audit |
| `.env.example` | Every variable, with safe defaults |
| `AGENTS.md` (root) | The template, in English: product, services table, anything specific |
| `services/{service}/AGENTS.md` + `CLAUDE.md` (`@AGENTS.md`) | In English: stack, commands, structure, canonical examples (the files of this skeleton), recurring errors (none) |
| `README.md` | The template, in Spanish: what the product is, how to start it and its URLs, how to use it locally, the main commands, where the docs are |
| `docs/operacion.md` | The template, in Spanish: health of each service, configuration variables, the observability profile, recommended alerts from the NFRs |
| `CHANGELOG.md` | Keep a Changelog, in Spanish, with an empty `[Sin publicar]` section |

Commit per service and per piece.

---

### Step 5: Prove It

```bash
make check
python3 .claude/scripts/grava.py coverage {id}
python3 .claude/scripts/grava.py evidence {id}
python3 .claude/scripts/grava.py def-check
```

Repeat until all four pass: a failing test is fixed in the code (never by weakening the test), a
missing tag is a missing test. Also confirm by hand that `make up` brings everything up healthy and
`make down` stops it.

---

### Step 6: Verify

Launch the [verifier](.claude/agents/verifier.md) subagent (`subagent_type: verifier`) with:

```
Requisito: #{id} — Producto base
Especificación: la copia de Jiku en {ruta que imprimió jiku fetch}
Rama: feat/{id}-producto-base (base: dev)
Además de los criterios, verificá los defaults de .claude/specs/engineering.md que aplican a un
producto base: Make, Compose, CI, observabilidad, monitoreo, guías, .env.example, seguridad.
```

- Every round, approved or not, record its «Fuera de alcance» items with
  `grava.py out-of-scope {id} --skill product-bootstrap`, as the [Jiku spec](.claude/specs/jiku.md)
  says (What Is Seen Out of Scope) — the same for anything you saw yourself, also when you stop.
- **APROBADO** → save its verdict (the whole message) to
  `$(python3 .claude/scripts/grava.py workdir)/verdict-{id}.md`, for the MR and the comment.
- **RECHAZADO** → fix every finding, prove it again, and launch a new verifier with the previous
  findings ("Hallazgos de la ronda anterior: …"). **Stop** when a finding survives a fix twice, or
  after five rounds: do not comment in Jiku as done; report honestly what is still open.

---

### Step 7: Close

Push the branch if there is a remote (report a failed push), and write the MR/PR text:

```bash
git push -u origin feat/{id}-producto-base
python3 .claude/scripts/grava.py mr-text {id} --verdict $(python3 .claude/scripts/grava.py workdir)/verdict-{id}.md
```

Save the approved verdict to that `verdict-{id}.md` first. Write the Jiku comment in business terms —
what exists now, each criterion met by its text, the verification and its round, the branch, and what
was recorded out of scope (`grava.py out-of-scope {id} --list`) — and send it:

```bash
python3 .claude/scripts/grava.py jiku comment {id} --file $(python3 .claude/scripts/grava.py workdir)/jiku-comment-{id}.md
```

Report to the user:

```markdown
## Producto base listo — #{id}

Rama `feat/{id}-producto-base` {{pusheada / sin remoto}}: {servicios y stack en una línea}; `make up`
levanta todo y `make check` pasa.
Criterios: {n}/{n} cumplidos y probados. Verificación aprobada (ronda {r}).

### Siguiente paso
1. Abrí el MR de `feat/{id}-producto-base` a `dev` (texto: `{ruta de mr-{id}.md}`), revisalo y mergealo.
2. Por cada parte del plan, en orden: `/req-specify {id}` (la revisa contra lo ya construido), aprobarla
   en Jiku y `/req-implement {id}`.
```

## Output

- On `feat/{id}-producto-base`, pushed: `services/`, `docker-compose.yml`, `Makefile`, CI, `.env.example`, `_gflow/` (definition of
  the base, contracts with the system operations), `README.md`, `docs/operacion.md`, `AGENTS.md` and
  `CLAUDE.md` files, `CHANGELOG.md`
- `mr-{id}.md` in the working folder — the MR/PR description
- Jiku: the base requirement specified («Especificación: lista»), in Desarrollo, with an internal comment
