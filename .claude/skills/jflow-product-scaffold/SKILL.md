---
name: jflow-product-scaffold
description: Specify and build the base product from the closed discovery and the base product requirement - first the technical questions with the user, then, autonomously, the skeleton of every service, tests, CI, observability, the definition of what is built, README, operation guide and AGENTS.md - in its own branch, verified, with the MR text
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, Agent, WebSearch, WebFetch, AskUserQuestion"
argument-hint: "[jiku-requirement-id]"
---

# Bootstrap Product

## Purpose

Turn the closed discovery into a working base product. First **specify** the base product
requirement («0 · Producto base», «0 · Base product» outside Spanish) with the user: its draft comes
from the discovery and a template, and what the template cannot know is asked — how each entry (surface or exposed interface) is tested end to end, with which
identity each role enters and how each external system is replaced, how each surface is built, which non-functional
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

**Result:** Branch `feat/{id}-base-product`, pushed: the skeleton that runs with `make up` and passes
`make check`, the product-level definition in `_jflow/`, `README.md`, the operations guide
(`docs/operacion.md` in Spanish, `docs/operations.md` otherwise), `AGENTS.md` files and `CHANGELOG.md`;
the MR/PR description in the working folder. In Jiku: the base requirement specified (the line
«Specification: ready», «Especificación: lista» in Spanish), in Desarrollo, with a comment carrying the evidence.

**This command does NOT:**

- Ask anything after Step 1 (the specification)
- Build any functional block: each one comes with its requirement of the plan (`/jflow-spec`, then
  `/jflow-build`)
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

!`grep -H "^status:" _jflow/discovery/*.md 2>/dev/null || echo "NO_DISCOVERY"`

### Product Definition Check

!`ls _jflow/prd/ 2>/dev/null || echo "NO_PRD_FOUND"`

## CRITICAL RULES

1. **Language** - Talk to the user in the language they write in (the product language until they write in their own words; with no project yet, the language of the request): the messages quoted below are
   templates, said in that language. What people of the product read (Jiku, README, `docs/`, CHANGELOG,
   texts and errors the product shows) is in the product language (`language` in
   `_jflow/project.yaml`, Spanish when unset). Commits, MR/PR text, branch names and test names always
   English; code, identifiers and `AGENTS.md` English. The definition: structure English, content in
   the product language. See [Language](.claude/specs/language.md)
2. **Ask in Step 1, then never** - The technical questions go in Step 1, grouped, each with your
   recommendation. After it, never ask: if the discovery or the specification has a real gap that
   blocks a piece, stop with a report of what is missing and where, never invent it
3. **Transcribe, don't redraft** - The definition comes from `jflow.py def-base`. You only resolve its
   markers, from what the discovery says
4. **Research, then decide** - Every framework, library, tool and base image is chosen from its
   official documentation and release notes, checked now (WebSearch/WebFetch), never from memory. The
   language of each service is fixed by the discovery
5. **Build no functional block** - The base is the skeleton: health, configuration, logging,
   OpenTelemetry, error shape, graceful shutdown, database access and migrations setup, test harness
   at every level, Docker, Make, CI, one empty page per surface. A block's tables, operations and
   screens come with its requirement
6. **Evidence, not claims** - Done means `make check` passes, every criterion of the base requirement
   has a passing test named with its ID, the evidence is computed by `jflow.py evidence`, and the
   verifier approves
7. **Commit as you go, on the branch** - `feat/{id}-base-product`, from `dev`. One commit per coherent
   step, Conventional Commits in English with `(#{id})`. Never leave `make check` failing at the end.
   Push only at the close, after the verifier approves
8. **Deterministic work through `jflow.py`** - `git-check`, `discovery-check`, `jiku fetch`,
   `spec draft`, `spec check`, `spec push`, `branch`, `jiku state`, `def-base`, `def-index`, `def-check`,
   `coverage`, `evidence`, `mr-text`, `jiku comment`, `out-of-scope`
9. **Do NOT dump content in chat** - Report progress in one line per step

## Execution

### Step 0: Check

`$ARGUMENTS` is the Jiku id of the base product requirement. If missing, stop: it is created by
`/jflow-product-discover` (see the requirements it listed, or `jflow.py jiku list`).

```bash
python3 .claude/scripts/jflow.py git-check --mode base
python3 .claude/scripts/jflow.py jiku fetch {id}
```

| `git-check` | Action |
|---|---|
| `OK` | Continue on `dev` |
| `NO_DEV` | Stop: `/jflow-product-discover` leaves `main` and `dev` ready (`jflow.py branches`); run it, or that command |
| `DEV_HAS_MORE` | Warn with the files it found (`dev` should only have the discovery and jiku flow) and ask how to continue: on top of what is there, or stop |
| `OTHER_BRANCH` | On `feat/{id}-base-product`: a resumed run (below), no question. Elsewhere: warn and ask how to continue — switch to `dev`, or stop |
| `BEHIND`, `DIRTY` | Stop and say what to do (pull `dev`, commit or discard) |
| `NO_REMOTE` | Continue: the branch is not pushed at the close |

**Resume** — if a branch `feat/{id}-base-product` exists, this is a resumed run: switch to it and
find the first step whose result is missing (the description without the ready line → Step 1;
markers left in `_jflow/` → Step 2; no `services/` → Step 4; failing `make check` → Step 5; no verdict →
Step 6), tell the user in one line, and continue.

**Preconditions** (when not resuming):

- Every discovery document is `closed`, and `python3 .claude/scripts/jflow.py discovery-check --final`
  reports nothing. Otherwise stop and suggest `/jflow-product-discover`.
- The requirement is the base of this project, with its criteria (`{id}-AC-NN`). Its state: `en_cola`
  or `planificacion` → continue; anything else → warn and ask.

---

### Step 1: Technical Specification

The draft in Jiku comes from the discovery and the template of the base: it cannot know everything a
product needs to be built and proven. If the requirement's description already says «Specification:
ready» («Especificación: lista»), skip to the branch at the end of this step.

```bash
python3 .claude/scripts/jflow.py spec draft {id}
```

Read the draft and the discovery (`technical-analysis.md`, the surfaces and NFRs of
`functional-analysis.md`), and sweep for what is not fixed:

| Topic | What must be fixed |
|---|---|
| Platform | For each surface, by its `Platform` (`Plataforma`) (`web`, `mobile-app`, `desktop-app`): how it is tested end to end and what CI builds. A criterion the template wrote for another platform (an e2e "in a real browser" for a mobile app) is wrong: replace it |
| End-to-end testing | Per Engineering («How the product is tested»), for each entry — every surface and every interface a service exposes (HTTP, NATS, CLI) — how its end-to-end test enters as the actor; for each role of the discovery, how the tests get its identity (by default a fake issuer in the `test` profile; test identities of the real provider in `.env` only if the product cannot accept another issuer, as a `DEC-T`); for each external integration, how it is replaced (local version, fake server, sandbox with credentials). What the user must provide (test identities, a sandbox) is named now, with its variables |
| Non-functional requirements | The table «Non-functional requirements» of the draft («Requisitos no funcionales» in Spanish; values `test`/`alert`/`review`, `prueba`/`alerta`/`revisión` in Spanish), every row: `test` (a test — `Tested in`: `base`, or the `#id` of the part that builds the operation it names; a volume is a seed, a time is a load with margin, a platform version is a static check plus the build), `alert` (availability, schedules: an alert in the operations guide) or `review` (what no test proves well: a real device, accessibility by eye). Recommend; `spec check` (`S19`) accepts nothing else. Every `test` with `base` becomes a local criterion of this requirement (`{id}-AC-NN`: «Meets NFR-xx: …», in the product language) |
| Tools | Whether what the criteria need exists where it will run: locally, Docker and KVM for the Android emulator and the browsers; in CI, a macOS runner for iOS. What cannot run is a deviation the user accepts now, as a technical decision (`DEC-T`), not a surprise later |
| CI secrets | What the pipelines will need that is secret (the Android signing key for release builds, an external registry): the user creates them following the operations guide, «CI secrets» («Secretos del CI»); until then, the documented fallback (a release APK signed with the debug key, with a warning) |
| Shared infrastructure | What every service shares and the discovery leaves open: the email sender, the broker, the observability backend, credentials of the integrations. A value whoever deploys sets is a configuration variable, with no invented value |

Ask what is missing with `AskUserQuestion`, grouped (up to 4 per call), each with your recommendation
first. Write the answers in the draft — criteria (`{id}-AC-NN`), parameters, technical decisions with
motivo — and confirm the whole: give the draft's absolute path (the one `spec draft` printed) as a
link for the user to read, and ask «Shall we close the base product specification?», listing your
assumptions. If nothing is missing, say so and confirm in one question. Then:

```bash
python3 .claude/scripts/jflow.py spec check {id} --source draft
python3 .claude/scripts/jflow.py spec push {id}
```

No observations allowed. The confirmation above is the approval of what is written in Jiku: the
specification of the base and its ready line. `spec push` refuses if the
specification changed in Jiku since the draft started; then show the user and merge those changes. Then the branch, and the state:

```bash
python3 .claude/scripts/jflow.py branch {id} base-product
python3 .claude/scripts/jflow.py jiku state {id} desarrollo
```

From here on, do not ask anything.

---

### Step 2: Definition of the Base

```bash
python3 .claude/scripts/jflow.py def-base
```

It writes the
product-level definition (structure in English, content copied from the discovery): index (actors, surfaces), glossary, NFRs, out of scope, the decisions and
parameters that belong to no block, services, persistence and communication, the shared part of each
schema, and how each entry is tested (`architecture/testing.md`). Blocks and what they need come with their requirements.

Resolve its `{{fill: …}}` placeholders, only from the discovery — and the columns `Verification` and
`Tested in` of `nfr.md`, from the table of non-functional requirements of the specification you wrote
in Step 1: the `Service` of each surface (the frontend that serves
it, from the technical analysis), parameter variables (`UPPER_SNAKE_CASE`, English, unit as suffix:
`BOOKING_HORIZON_DAYS=30`). Review, without adding definitions, the `Scope` of the NFRs (`product`,
a surface or a service). `architecture/testing.md` (a row per entry; roles and integrations come with
the parts that build them) is filled from the end-to-end testing fixed in Step 1.

```bash
python3 .claude/scripts/jflow.py def-index
python3 .claude/scripts/jflow.py def-check
```

Fix every observation of `_jflow/` (writing errors only); the guides (`H1`, `H2`) are filled in
Step 4. Commit: `docs: base product definition (#{id})`.

---

### Step 3: Stack Research and Decision

For each service in `_jflow/prd/architecture/services.md`:

1. Its language or framework is fixed (column `Language`, from the discovery).
2. **Research** the official documentation and release notes of that framework now: current stable
   major, recommended project setup, testing approach, and the official or most adopted options for
   each concern the skeleton needs (HTTP server or app framework, validation, database access and
   migrations for the chosen engine, logging, OpenTelemetry SDK and instrumentations, test runner with
   JUnit output, end-to-end testing, linting and formatting, container base image). Prefer what is
   fastest to build with and most robust to run; prefer fewer dependencies.
3. **Decide** and write the `Stack` table of `services/{service}/AGENTS.md` (from
   [the service template](.claude/templates/service-AGENTS.md)): concern → choice → version → one-line
   reason citing the source.
4. Respect every technical decision of the discovery (`_jflow/discovery/technical-analysis.md`,
   Technical decisions) and every guarantee mechanism: the stack must make them implementable (for
   example, raw SQL migrations for exclusion constraints and triggers).
5. A choice that deviates from an engineering default, or that discards a real alternative the
   product cares about, is a decision the user did not take: stop and report it (CRITICAL RULE 2).

For several services, research them in parallel with one `Agent` per service (general-purpose), each
returning the Stack table with sources. Decide yourself from their reports.

---

### Step 4: Skeleton

Build what [Engineering](.claude/specs/engineering.md) requires, for every service, with the chosen
stack. Write tests **with** the code, tagged with the criterion they prove (`[{id}-AC-01] …`, English
names).

| Piece | Contents |
|---|---|
| `services/{service}/` | Configuration from validated environment variables (the parameters' variables included); OpenTelemetry (traces with `traceparent`, JSON logs with `trace_id`/`span_id`, metrics; `OTEL_*` variables, nothing exported without an endpoint); health endpoints with status, version, commit and dependency checks; RFC 9457 errors; graceful shutdown on `SIGTERM`; database client and migrations setup (no functional tables: only extensions and shared functions of the schema's shared part); module folders, empty; for a frontend, one minimal page per surface showing the product name and its backend's health |
| Tests | Unit, integration (against the database in Compose) and end-to-end, each writing JUnit XML to `reports/junit/{service}-{level}.xml`. End to end: **one test per entry** of `architecture/testing.md` — every surface (Playwright for web, the emulator for a mobile app) and every exposed interface (an HTTP client with a real token, a client of the broker authenticated as the actor) — against `make up`, entering as the actor does, never by calling the service's code |
| Test identities and external systems | As `architecture/testing.md` says: the fake issuer in the `test` profile of Compose, signing tokens with the claims the services and the broker verify (or the test identities of `.env`); the replacement of each external system; the test data. If the discovery has an identity provider, the base already brings its fake up, even if the roles come with later parts: each part only adds the claims of its role. `make test-e2e` brings the product up when it is not, and needs no one in the loop |
| Contract | `_jflow/apis/{service}.openapi.yaml` (or `.asyncapi.yaml`) with the general operations (tag `system`, `x-origin: '#{id}'`), validated by the integration tests |
| `services/{service}/Dockerfile`, `Makefile` | Multi-stage image, non-root, `HEALTHCHECK` on the health endpoint; the service's targets |
| `docker-compose.yml` | Every service, its database, Mailpit if the product sends email, with healthchecks; a test setup for integration and e2e; an optional `observability` profile with a collector and viewer |
| Root `Makefile` | The targets of Engineering, delegating to each service; `S=` to limit |
| CI | `.gitlab-ci.yml` or `.github/workflows/ci.yml` (from `_jflow/project.yaml`), running `make` targets, the secret scanner and the dependency audit |
| `.env.example` | Every variable, with safe defaults |
| `AGENTS.md` (root) | The template, in English: product, services table, anything specific |
| `services/{service}/AGENTS.md` + `CLAUDE.md` (`@AGENTS.md`) | In English: stack, commands, structure, canonical examples (the files of this skeleton), recurring errors (none) |
| `README.md` | The template of the product language (`.claude/templates/{es,en}/`), in that language: what the product is, how to start it and its URLs, how to use it locally, the main commands, where the docs are |
| Operations guide (`docs/operacion.md`, or `docs/operations.md` outside Spanish) | The template of the product language, in that language: health of each service, configuration variables, the observability profile, recommended alerts from the NFRs |
| `CHANGELOG.md` | Keep a Changelog, in the product language, with an empty `[Unreleased]` section (`[Sin publicar]` in Spanish) |

Commit per service and per piece.

---

### Step 5: Prove It

```bash
make check
python3 .claude/scripts/jflow.py coverage {id}
python3 .claude/scripts/jflow.py evidence {id}
python3 .claude/scripts/jflow.py def-check
```

Repeat until all four pass: a failing test is fixed in the code (never by weakening the test), a
missing tag is a missing test. Then the slow level: `make up`, `make test-e2e` (one test per entry,
passing), `make down`. Before the verifier, `architecture/testing.md` has no marker left and every row
says where its test is.

---

### Step 6: Verify

Launch the [jflow-verifier-agent](.claude/agents/jflow-verifier-agent.md) subagent (`subagent_type: jflow-verifier-agent`) with:

```
Requirement: #{id} — {base title}
Specification: the Jiku copy at {path jiku fetch printed}
Branch: feat/{id}-base-product (base: dev)
Besides the criteria, verify the defaults of .claude/specs/engineering.md that apply to a base
product: Make, Compose, CI, observability, monitoring, guides, .env.example, security.
```

- Every round, approved or not, add its «Out of scope» items to your list, with anything you
  saw yourself, and record the list at close (also when you stop) with
  `jflow.py out-of-scope {id} --skill jflow-product-scaffold`, as the [Jiku spec](.claude/specs/jiku.md)
  says (What Is Seen Out of Scope): one incidencia for all of it, each security risk apart.
- **APPROVED** → save its verdict (the whole message) to
  `$(python3 .claude/scripts/jflow.py workdir)/verdict-{id}.md`, for the MR and the comment.
- **REJECTED** → fix every finding, prove it again, and launch a new verifier with the previous
  findings ("Findings of the previous round: …"). Fix the cause, not the instance: when a finding names one place of a kind (a missing case, a list
  that misses an item), find every place of that kind with the method the verifier used, and fix them all.
  **Stop** when a finding survives three fixes, or after eight rounds: do not comment in Jiku as done;
  report honestly what is still open.

---

### Step 7: Close

Push the branch if there is a remote (report a failed push), and write the MR/PR text:

```bash
git push -u origin feat/{id}-base-product
python3 .claude/scripts/jflow.py mr-text {id} --verdict $(python3 .claude/scripts/jflow.py workdir)/verdict-{id}.md
```

Save the approved verdict to that `verdict-{id}.md` first. Write the Jiku comment in business terms, in the product language —
what exists now, each criterion met by its text, the verification and its round, the branch, and what
was recorded out of scope (`jflow.py out-of-scope {id} --list`) — and send it:

```bash
python3 .claude/scripts/jflow.py jiku comment {id} --file $(python3 .claude/scripts/jflow.py workdir)/jiku-comment-{id}.md
```

Report to the user:

```markdown
## Base product ready — #{id}

Branch `feat/{id}-base-product` {{pushed / no remote}}: {services and stack in one line}; `make up`
brings everything up and `make check` passes.
Criteria: {n}/{n} met and tested. Verification approved (round {r}).

### Next step
1. Open the MR of `feat/{id}-base-product` to `dev` (text: `{path of mr-{id}.md}`), review it and merge it.
2. For each part of the plan, in order: `/jflow-spec {id}` (reviews it against what is already built),
   approve it in Jiku and `/jflow-build {id}`.
```

## Output

- On `feat/{id}-base-product`, pushed: `services/`, `docker-compose.yml`, `Makefile`, CI, `.env.example`, `_jflow/` (definition of
  the base, contracts with the system operations), `README.md`, the operations guide, `AGENTS.md` and
  `CLAUDE.md` files, `CHANGELOG.md`
- `mr-{id}.md` in the working folder — the MR/PR description
- Jiku: the base requirement specified (ready line), in Desarrollo, with an internal comment
