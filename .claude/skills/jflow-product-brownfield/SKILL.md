---
name: jflow-product-brownfield
description: Adopt an existing product into the workflow - survey its code into the definition of what is built, bring the repository to the jiku flow minimum (layout, Make, Compose, tests, CI) so it is ready to specify and implement, and write the adoption report; it finishes only with the product ready, and only security bugs go to Jiku
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion"
argument-hint: "[jiku-requirement-id]"
---

# Adopt Product

## Purpose

Bring a product that already has code into the workflow, and leave it ready to specify and implement
new work. The definition is surveyed from the code exactly as it is today. The repository is brought to
the minimum of jiku flow (services in `services/`, Make, Compose, tests with JUnit, CI, and
everything needed to test every entry of the product end to end) without changing what the product
does, and without breaking anything that worked before. It ends only with the product ready: nothing
of the minimum is left pending. Everything else seen — bugs, behaviors to confirm, defaults not
followed, improvements — goes to a report the user decides on.

**Flow:**

```
Step 0: Check git, link the Jiku project, the adoption requirement (questions)
  |
Step 1: Survey (one subagent per service) and baseline (the repo's own commands, before touching anything)
  |
Step 2: Questions: external values, how to test, behaviors to confirm
  |
Step 3: Bring the repository to the minimum, with no regression, ready to test end to end
  |
Step 4: Write the definition of what exists, and the contracts
  |
Step 5: Guides and the adoption report
  |
Step 6: Verify (verifier subagent), fixing until it approves
  |
Step 7: Close: push, MR/PR text, Jiku (security incidencias, comment)
```

**Result:** Branch `feat/{id}-adoption`, pushed: services in `services/`, Make, Compose, `.env.example`,
tests with JUnit, one end-to-end test per entry passing against `make up`, CI through `make`, `_jflow/`
(project link, definition with how each entry is tested, contracts, schema, flows),
`README.md`, the operations guide and the adoption report (`docs/operacion.md` and `docs/adopcion.md`
in Spanish, `docs/operations.md` and `docs/adoption.md` otherwise) and the `AGENTS.md` files, approved
by the verifier. In Jiku: one `incidencia` per security bug and a comment on the adoption requirement.

**This command does NOT:**

- Change what the product does: handlers, rules, queries, UI, migrations of data, publish or deploy
  jobs. The one exception: an existing test that fails is fixed in the code (Rule 7)
- Fix bugs no test states, or bring the product to the defaults outside the minimum (error format,
  observability, identifiers...): they are listed in the report
- Leave anything of the minimum pending
- Load in Jiku anything but the security bugs
- Invent requirements the code does not implement, or decisions nobody took
- Rename existing tests (they get their IDs as later work touches them)

New work afterwards goes through `/jflow-spec` and `/jflow-build`, or `/jflow-fix`.

## References

**Read [Product Definition](.claude/specs/product-definition.md)** — the documents you write.

**Read [Engineering](.claude/specs/engineering.md)** — the minimum the repository must reach
(«Adopting an existing product: the minimum»), the defaults it is compared with, and what the guides
must provide.

**Read [Database](.claude/specs/database.md)** — the schema document format (conventions are
described, not imposed on an existing schema).

**Read [Jiku](.claude/specs/jiku.md)** — what may be written in Jiku.

## Pre-loaded Context

### Product Definition Check

!`ls _jflow/prd/ 2>/dev/null || echo "NO_PRD_FOUND"`

### Project Link

!`cat _jflow/project.yaml 2>/dev/null || echo "NO_PROJECT_LINK"`

## CRITICAL RULES

1. **Language** - Talk to the user in the language they write in (the product language until they write in their own words; with no project yet, the language of the request): the messages and questions quoted
   below are templates, said in that language. What people of the product read (Jiku, README, `docs/`
   with the adoption report, CHANGELOG, texts and errors the product shows) is in the product language
   (`language` in `_jflow/project.yaml`, Spanish when unset). Commits, MR/PR text, branch names and new
   test names always English; code and `AGENTS.md` English, identifiers as they are in the code. The
   definition: structure English, content in the product language. See
   [Language](.claude/specs/language.md)
2. **Questions in Step 0 and Step 2; later, only what blocks the product being ready** - After Step 2,
   ask only what you cannot resolve and the product needs to be ready (Blocking Questions). Never ask
   about the process: whether to verify again, to fix, to close, to load the incidencias, to comment
3. **What is, not what should be** - The definition documents the current behavior, including
   guarantees, auth and credentials (the mechanism that exists). Behavior that looks like a bug is
   documented as it is; never corrected in the definition or in the code (the only exception, Rule 7).
   Two contradictory behaviors are documented both, and listed in the report
4. **No false decisions** - A row of `decisions.md` only with evidence of intent: a code comment, an
   ADR or doc, a commit message, an alternative visible in the code or the history, or the user's answer
   in Step 2. A behavior that may be accidental is never a decision: it is a rule of its block, and,
   unconfirmed, a behavior to confirm of the report. `Rejected` only with a visible alternative,
   otherwise `—`; `Reason` from the evidence or the user, otherwise `—`
5. **Extract, don't invent** - Every requirement, failure condition and rule comes from the code; cite
   `archivo:línea` in your notes while you survey (not in the definition). What the code does not show
   is not written
6. **Everything is built, origin `initial`** - Every row `Origin: initial`
7. **Product logic untouched** - The adoption changes layout, tooling, test infrastructure (including
   the fake issuer and the end-to-end tests), configuration, CI checks, and the baseline migration that
   builds today's schema from empty. Making a hardcoded value configurable (the identity issuer, an
   external URL) with an environment variable whose default keeps today's behavior is configuration.
   Never what the product does, with one exception: an existing test that fails (in the baseline or
   after a change of the adoption) is evidence of what the product must do, so the code is fixed until
   it passes — unless the test contradicts other evidence (another test, a doc, the user's answer, a
   commit that changed the behavior on purpose): then ask (Blocking Questions). Each such fix is a
   correction of the report, and the definition describes the fixed behavior
8. **Nothing broken, nothing pending at the end** - Everything that worked in the baseline works at the
   end; every moved path is updated everywhere; every command of the minimum is run and passes. What you
   cannot make work after trying is a blocking question, never left pending
9. **Secrets never in the chat or the repo** - Ask the user to write credentials in `.env` (git-ignored);
   never ask to paste them, never commit them
10. **Jiku gets only two things** - One incidencia per security bug and the comment. Everything else
    goes to the adoption report
11. **ABORT if the definition exists** - The product is already adopted or bootstrapped; except when
    resuming an adoption on its own branch (Step 0)
12. **Deterministic work through `jflow.py`** - `git-check`, `init-project`, `jiku`, `branch`,
    `workdir`, `conformance`, `def-index`, `def-testing`, `def-check`, `coverage`

## Execution

### Blocking Questions

After Step 2, these are the only questions, asked when they turn up, one by one; everything else you
resolve:

| What blocks | Question |
|---|---|
| A value or an access only the user has (`.env`) | The variables, what each one is and how to obtain it (in `.env.example` and the README): «Will you fill them in `.env`?» — "Done" / "Stop the adoption until I have them" |
| An existing test that contradicts other evidence (Rule 7) | What the test states, what the other evidence says, and which one you would follow: "Fix the code (the test holds)" / "Fix the test ({the other evidence} holds)" |
| A behavior that blocks the minimum and no test states (fixing it would change product logic) | What happens and what you would do: "Fix it" / "Leave it as it is" (only when the minimum can still be met another way) |
| A finding of the verifier, or a command of the minimum, that survives three fixes | What fails, what you tried, and the options you see |

The answer goes to `answers.md`. «Stop the adoption» ends the run: commit what is done, write in the
comment on the adoption requirement what is missing, and tell the user to run `/jflow-product-brownfield {id}`
again when they have it (it resumes on the branch). Never leave it as pending.

---

### Step 0: Check and Link

**Resume.** With an id whose branch `feat/{id}-adoption` exists, the adoption stopped before (a
blocking question answered «Stop the adoption»): check it out, read `answers.md` and the comment on
the requirement for what was missing, ask for it again, and continue from the first step whose commit
(`git log dev..`) is not there.

Otherwise, stop if "Product Definition Check" lists files.

```bash
python3 .claude/scripts/jflow.py git-check --mode implement
```

`OK` continue; `BEHIND` stop (pull `dev` first); `DIRTY` stop; `OTHER_BRANCH` warn and ask whether to
continue on that branch; `NO_REMOTE` warn and ask; `NO_DEV` create `dev` from the current branch.

If "Project Link" shows `NO_PROJECT_LINK`, ask for the Jiku project id, the instance and the product
language (Spanish, `es`, by default; any language code is valid: `en`, `pt`…), and:

```bash
python3 .claude/scripts/jflow.py init-project --project-id {project} --instance {prod|dev} --platform {gitlab|github, from the repo's CI} --language {code}
```

`$ARGUMENTS` is the id of the adoption requirement. Without it, create it, with its title and
description in the product language («Adopción de jiku flow» in Spanish):

```bash
python3 .claude/scripts/jflow.py jiku new --title "jiku flow adoption" --description "Bring the existing product into jiku flow: survey the definition of what is built and leave the repository ready to specify and implement." --type mejora --state desarrollo
```

With an id: `jflow.py jiku fetch {id}`; if it is not in Desarrollo, move it (`jflow.py jiku state {id}
desarrollo`). Then:

```bash
python3 .claude/scripts/jflow.py branch {id} adoption
python3 .claude/scripts/jflow.py workdir
```

---

### Step 1: Survey and Baseline

**1.1 Survey.** Identify the services (folders with their own build: `package.json`, `go.mod`,
`pubspec.yaml`, Dockerfiles, compose services) and the shared libraries. For each service, launch one
`Agent` (general-purpose), all in parallel, with this brief (adapt the paths):

```
Survey the service in {folder} (read-only) and return, in English and citing file:line (quote texts
the product shows as they are):
1. Stack: language, framework, main libraries and versions.
2. Modules or areas of the code, and which data each one owns.
3. Entities: attributes (type, required, constraints), states and transitions, removal.
4. Schema: tables, columns, constraints, indexes, triggers (from the migrations or the ORM). Whether the
   migrations build the schema from an empty database or start from a dump or an existing schema.
5. Operations it exposes (HTTP: method, route, permissions, errors; NATS: subjects; UI: routes and
   screens), and what each one does, including its error cases.
6. Automatic processes (jobs, queues, schedulers).
7. External integrations and authentication (credentials, sessions, roles).
8. Rules that always hold and how (constraints, locks, transactions).
9. Tests: what they cover, where they are, with which framework, what infrastructure they need
   (database, broker, external services, credentials) and how they run today. If there are end-to-end
   tests: against what they run and where they enter (browser, HTTP client, broker client).
9b. Identity in tests: how each service and the broker validate tokens or sessions (issuer, JWKS,
   introspection, a generic OIDC mode) and whether the issuer can be changed by configuration or is
   tied to the provider; which claims it uses (roles, sub, audience). Which external systems have a
   local version or a possible replacement for tests.
10. Configuration: environment variables and defaults, Compose, CI/CD and deployment. Which ones need
    a value only the user has (an identity provider, a third-party API).
11. How it is installed, built and started today, with which commands.
12. Everything outside the folder that points to it by path: workspaces, tsconfig, relative imports,
    Dockerfiles and build contexts, Compose, CI, scripts, lint configurations, docs.
13. Observability and operation: logs (format, correlation ids), health, metrics, traces, shutdown.
14. How it meets the jiku flow defaults, and where it deviates: RFC 9457 errors, input validation at
    the edge, configuration validated at startup, passwords and tokens, rate limit on authentication,
    integration tests against a real database, contract validated by tests.
15. Whatever looks like a bug, each one marked as: security (access to data or operations without
    permission, injection, exposure of tokens, credentials or personal data, authentication or session
    failures, SSRF), functional or robustness. For each one, whether it could be on purpose and what
    evidence there is (comment, doc, commit).
Do not invent: what is not in the code does not exist.
```

**1.2 Baseline**, while the subagents work. Before changing anything, run the commands the repository
already has (its `package.json` scripts, Makefiles, CI jobs, README instructions): install, build,
lint, typecheck and tests, service by service, the way its CI does. Infrastructure the tests need is
started the way the repository documents. Write `baseline.md` to the working folder: each command, its
result, the failing tests by name, and what could not run and why. Fix nothing yet.

---

### Step 2: Questions

From the surveys and the baseline, gather the only questions of the rest of the run, in one round:

**2.1 External values.** For each value `make up` needs that only the user has (an identity provider,
a third-party API, a definition such as which environment to point at): write the variables to
`.env.example` with a comment of what each one is, and ask the user to fill them in `.env`. Never ask
to paste a secret in the chat.

```
AskUserQuestion: "To bring the product up with `make up` it needs {list: variable — what it is}. They
are already in `.env.example`. Will you fill them in `.env`?"
Options: "Done, they are in .env" / "I don't have them yet"
```

With «I don't have them yet», go on with everything that does not need them, and ask again (Blocking
Questions) when they are needed. `make check` never depends on them (minimum M6): tests fake external
systems at the boundary.

**2.1b How to test end to end (M9).** Decide from the surveys (point 9b) how each role gets its
identity and how each external system is replaced in the end-to-end tests, as Engineering says («How
the product is tested»). A fake issuer that the services and the broker can be pointed at by
configuration, and a local replacement for each external system, are technical and need no question.
Ask only what is the user's:

- A role or an external system that cannot be faked (the product only accepts its real provider):
  propose test identities (a user or machine user per role) or a sandbox, with the variables already in
  `.env.example` and the steps to create them in the README draft.

```
AskUserQuestion: "To test {entry} end to end, {role or system} cannot be replaced by a fake one: {why,
in one sentence}. It needs {list: variable — what it is}; the steps are in the README. Will you create
them and fill them in `.env`?"
Options: "Done, they are in .env" / "I don't have them yet"
```

Each such choice becomes a technical decision (`DEC-T`) in Step 4, with the user's answer as motivo.

**2.2 Behaviors to confirm.** Each behavior that may be on purpose or a mistake (point 15 without
evidence either way, an odd rule, an asymmetry). Up to four per `AskUserQuestion`, one after another:

```
AskUserQuestion: "{current behavior, in one business sentence}. Is it on purpose?"
Options:
- "On purpose" — it stays as a decision; the reason, in the note if you want
- "It is a mistake" — it goes to the report as a bug (to Jiku, if it is a security one)
- "I don't know" — it goes to the report as a behavior to confirm
```

A behavior marked as security in the surveys (point 15) that may still be on purpose is asked with its
risk and its own options, never mixed with the others:

```
AskUserQuestion: "{current behavior, in one business sentence}. It is a security risk: {what it exposes
or allows, in one sentence}. Is it on purpose?"
Options:
- "On purpose" — it stays as a decision, with the risk in its reason; it does not go to Jiku
- "It is a mistake" — it is recorded in Jiku as an incidencia
- "I don't know" — it is recorded in Jiku as an incidencia, to confirm whether it is on purpose
```

A security bug with no possible intent (an injection, a token in the logs) is not asked: it goes to
Jiku.

Write the answers to `answers.md` in the working folder. With nothing to ask, skip the step. From
here on, ask only the Blocking Questions.

---

### Step 3: Bring the Repository to the Minimum

```bash
python3 .claude/scripts/jflow.py conformance
```

Every row of level `minimum` must end ✅, and the rows that need judgment (M5 and M6 can only be proved
by running them) must work. Do it in this order, running what you build as you go:

**3.1 Layout (M1).** Move each service to `services/{service}/` with `git mv` (history kept). Shared
libraries stay in their dedicated folder (`packages/`, `libs/`) or move to `packages/` if they sit at
the root. Move an existing contract to `_jflow/apis/`. Update every reference of point 12 of the
surveys; then search the old paths: no hit may remain outside historical text (`CHANGELOG.md`, old
docs). Install and build every service: they must work as in the baseline. Commit:
`refactor: move services to services/ (#{id})`.

**3.2 Make (M2).** The root `Makefile` and one per service with every target of Engineering, each one
delegating to the tool the service uses today. A level with no tests yet exits 0 with a message, except
`test-e2e` (3.5b).
Dependencies are installed by the targets (or in the containers), never assumed on the machine.

**3.3 Configuration and Compose (M4, M5).** `.env.example` with every variable of every service and
safe defaults; `.env` and `reports/` in `.gitignore`. `docker-compose.yml` with every service, its
database, broker, storage and Mailpit. The database schema is built by the migrations from an empty
database: if the migrations start from a dump or an existing schema, write a baseline migration that
creates today's schema and, on a database that already has it, is recorded as applied without changes.
Compose files of production stay as they are, with the paths updated.

**3.4 Tests (M3, M6).** Integration tests against the database of Compose with the migrations applied;
JUnit reporters writing `reports/junit/{service}-{level}.xml`. A test that fails in the baseline is
fixed: in the environment when that is the cause (a path, configuration, a missing dependency, a file
that was deleted); otherwise in the code (Rule 7), or asked when the test contradicts other evidence.
Never deleted, skipped or weakened to make it pass.

**3.5 CI (M7).** The check jobs call `make` (lint, typecheck, unit and integration tests). Build,
publish and deploy jobs only get the moved paths.

**3.5b End to end (M9).** Make every entry of the product testable end to end, as decided in 2.1b:

- The identities: the fake issuer in the `test` profile of Compose, signing tokens with the claims the
  real provider puts, and the services and the broker's authentication pointed at it in that profile
  (configuration only, Rule 7); or the test identities of `.env`.
- The replacement of each external system, and the test data (created by the tests, or a seed of the
  `test` profile).
- **One end-to-end test per entry**, its main path, against `make up`, with the tool of Engineering
  («End to end, by platform»): each surface (Playwright, the emulator…) and each interface a service
  exposes (an HTTP client with a real token, a client of the broker authenticated as the actor). It
  enters the way the actor does, never by calling the service's own code. Name it with the ID of the
  requirement it proves, when it proves one.
- `make test-e2e` of each service runs them and writes JUnit; the root one brings the product up when
  it is not.

**3.6 Prove it.** Run `make check`; `make up`, reach each service once (its port, health or main page),
`make test-e2e`, `make down`; `conformance`. Compare with `baseline.md`: everything that passed passes,
and every test that failed passes too. What still does not work after three attempts is a blocking
question. Write every correction (minimum, what was done, the command that proves it) to
`corrections.md`. Commit: `chore: jiku flow minimum (#{id})`.

---

### Step 4: Write the Definition

From the surveys and the answers of Step 2, write every file of
[Product Definition](.claude/specs/product-definition.md) under `_jflow/` (structure in English, content in the product language), with the paths
after Step 3:

- `prd/index.md`: actors (from roles and anonymous access), surfaces (from the frontends' routes).
- Blocks: group the behavior by what the product does for whoever uses it (not by module). Each
  operation's behavior becomes requirements; each error case a failure condition. What has no actor of
  its own (health, logs, error format, configuration validation) is not a block: it goes to
  architecture, guarantees and NFRs.
- Domain, glossary (terms the code uses with a precise meaning), invariants (rules enforced across
  records), guarantees (the mechanism that exists).
- Architecture: services (their `Folder` in `services/`), modules, interactions, persistence,
  communication, integrations, auth.
- Decisions (Rule 4): the product and technical choices with evidence of intent, including CI/CD,
  deployment, infrastructure (what is absent counts: no broker, no cache) and how parameters are
  configured, plus what the user answered «On purpose».
- `db-schemas/{service}.md` from the migrations; `apis/` from the existing spec (adding the extensions,
  `x-failure` also on every shared response), otherwise from the routes. `flows/` for operations that
  cross modules or services.
- `parameters.md`: business values found in configuration.

- `prd/architecture/testing.md`: once the rest is written, `jflow.py def-testing` adds a row per
  surface, exposed interface, role and external integration; fill each one with what Step 3.5b built
  (how it is tested, where its test is, how each role gets its identity, how each system is replaced,
  how it runs). Every row works: no `{{fill}}` placeholder and nothing pending.

```bash
python3 .claude/scripts/jflow.py def-index
python3 .claude/scripts/jflow.py def-testing
python3 .claude/scripts/jflow.py def-check
```

Fix every observation of `_jflow/`. Commit: `docs: definition of the existing product (#{id})`.

---

### Step 5: Guides and Report

**5.1 Guides.**

- `README.md`, in the product language (`init-project` copies the template of that language when
  there is none). If the product
  already has one, keep its content and add what is missing (intro, how to start it and its URLs,
  local setup — the `.env` values of Step 2 and how to obtain them —, the `make` commands, where the
  docs are).
- The operations guide (`docs/operacion.md`, or `docs/operations.md` outside Spanish), in the product
  language, from the template of that language (`.claude/templates/{es,en}/`): what exists today (health, processes,
  configuration). What does not exist is marked as such, not invented.
- In English: root `AGENTS.md` (from the template) and `services/{service}/AGENTS.md` + `CLAUDE.md`
  with the real stack, the `make` targets, structure and canonical examples.

**5.2 Report.** `docs/adopcion.md` from [the Spanish template](.claude/templates/es/adopcion.md), or
`docs/adoption.md` from [the English one](.claude/templates/en/adoption.md) for any other language,
written in the product language, filled from `baseline.md`, `corrections.md`, `answers.md` and the
surveys (section names as in the English template; the Spanish one in parentheses):

- **Suspected bugs** (Bugs sospechados): every suspected bug that is not a security bug, and every
  «It is a mistake», with its suggested severity.
- **Behaviours to confirm** (Comportamientos a confirmar): the «I don't know» answers that are not
  security (those go to «Recorded in Jiku»).
- **jiku flow defaults the product does not follow** (Defaults de jiku flow que el producto no sigue):
  every deviation from Engineering outside the minimum (the `default` rows of `conformance` and point
  14 of the surveys), with the change and its effort.
- **Other suggested improvements** (Otras mejoras sugeridas): technical debt, missing tests, refactors
  worth considering.
- **Recorded in Jiku** (Cargado en Jiku): the security bugs, with their ids still empty (Step 7 fills
  them).

```bash
python3 .claude/scripts/jflow.py def-check
```

Commit: `docs: adoption guides and report (#{id})`.

---

### Step 6: Verify

Launch the [jflow-verifier-agent](.claude/agents/jflow-verifier-agent.md) subagent (`subagent_type: jflow-verifier-agent`) with:

```
Adoption: #{id}. No specification or criteria.
Branch: feat/{id}-adoption (base: dev)
Baseline (before the adoption): {path of baseline.md}
Corrections: {path of corrections.md}
User answers: {path of answers.md}
Report: {docs/adopcion.md | docs/adoption.md}
Verify: that the definition in _jflow/ describes the code as it is, both ways; that the repository
meets the whole adoption minimum (Engineering), running the commands (also `make up` and
`make test-e2e`: one end-to-end test per entry, entering as the actor); that nothing that worked in the
baseline stopped working and that the tests that failed pass; that the code changed only in
structure, tooling, tests, configuration, CI and the baseline migration, without changing product
logic except to make an existing test pass (each case in the corrections); that no decision lacks
evidence of intent; and that the report is correct and complete, with the security bugs apart.
```

**REJECTED** → fix every finding and launch a new verifier with the previous findings ("Findings of
the previous round: …"), until it approves: the adoption has no round limit, it ends ready. Fix the
cause, not the instance: a finding that names one place of a kind means searching every place of that
kind with the verifier's method. A finding that survives three fixes is a blocking question; with the
answer, go on. Never ask whether to verify again. What the verifier reports «Out of scope» goes to
the report, and to Jiku in Step 7 only if it is a security bug.

**APPROVED** → go on to Step 7 without asking.

---

### Step 7: Close

```bash
python3 .claude/scripts/jflow.py coverage --all
```

Everything here runs without asking. In Jiku (search the open requirements first with
`jflow.py jiku list`: never create one twice), one **security incidencia** per security bug, in Análisis, in the product language:
`jflow.py jiku new --type incidencia --title "{title}" --description "{current behavior and why it is a
risk, without code}. Seen in the adoption (#{id})."`; for an «I don't know», add «To confirm whether it
is on purpose: the adoption could not tell.» to the description.

Fill the Jiku ids in the adoption report, commit (`docs: Jiku requirements in the report (#{id})`)
and push:

```bash
git push -u origin feat/{id}-adoption        # if there is a remote
```

**Comment** on the adoption requirement, in the product language:

```markdown
## Product adopted — #{id}

Branch: `feat/{id}-adoption`. Definition: {n} blocks, {m} entities, {k} operations.
Ready to specify and implement: Yes (verified in round {n}).
Corrections made in the adoption: {n} (services in `services/`, Make, Compose, tests, CI…).
Security bugs recorded as incidencias: #{…}.
In {the adoption report}: {n} bugs, {n} behaviors to confirm, {n} suggested defaults, {n} improvements.
Coverage by ID: {x}/{y} (the earlier tests carry no IDs).
```

Write the MR/PR description to `mr-{id}.md` in the working folder: the corrections (the code fixed for
an existing test, each one), the security incidencias, a pointer to the adoption report, coverage and
the verification. Report the same to the user, with the path.

## Output

- On `feat/{id}-adoption`, pushed: services in `services/`, `Makefile`s, `docker-compose.yml`,
  `.env.example`, tests with JUnit, one end-to-end test per entry, CI through `make`; `_jflow/` (project link, definition, contracts,
  schema, flows); `README.md`, the operations guide, the adoption report, `AGENTS.md` and `CLAUDE.md` files
- The MR/PR description in the working folder
- Jiku: one incidencia per security bug and the comment on the adoption requirement
