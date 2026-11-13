---
name: req-implement
description: Implement a Jiku requirement from its specification end to end - plan, code, tests, definition and contracts updated - and finish only when a clean-context verifier approves the evidence
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, Agent, WebSearch, WebFetch, AskUserQuestion"
argument-hint: "[jiku-requirement-id]"
---

# Implement Requirement

## Purpose

Implement one specified requirement in its own branch, with full freedom on **how** and no freedom on
**what**: the specification in Jiku fixes the outcome, the acceptance criteria fix how we know it is
done, and a verifier in a clean context decides whether it is. The product definition is updated in
the same branch, so code and documentation reach `dev` together. It also resumes an open branch, and
adapts a reopened requirement to its changed specification.

**Flow:**

```
Step 0: Check git and the requirement's state (the only questions it may ask)
  |
Step 1: Read the specification from Jiku and check it
  |
Step 2: Branch (new, resumed or reopened) and what is left to do
  |
Step 3: Plan (yours) and sweep for gaps before writing code
  |
Step 4: Build, test-first per criterion; apply the specification to the definition
  |
Step 5: Prove it: make check, coverage, evidence, def-check
  |
Step 6: Verify (verifier subagent) → fix until approved
  |
Step 7: Close: push, MR/PR text, Jiku comment
```

**Result:** Branch `feat/{id}-{slug}` (or `-2`, `-3` when reopened) with the code, the tests, the
updated definition, contracts and guides, pushed; the MR/PR description with the evidence and the
verdict; an internal comment in Jiku.

**This command does NOT:**

- Decide anything the specification leaves to the user: a conflict or a large gap stops the run (only
  the closed list of small ones is decided, and listed)
- Change behavior beyond the specification
- Open, approve or merge the MR/PR (the user does)

Specifying is `/req-specify {id}`. Small changes without a specification are `/change {id}`.

## References

**Read [Requirement Spec](.claude/specs/requirement.md)** — the specification's format, criteria and
evidence.

**Read [Product Definition](.claude/specs/product-definition.md)** — how the specification becomes
rows of the definition, and the contract extensions.

**Read [Engineering](.claude/specs/engineering.md)** — the defaults every change meets: testing,
contracts, security, observability, monitoring, Make, git, guides.

**Read [Jiku](.claude/specs/jiku.md)** — what you may write there.

## Pre-loaded Context

### Working Tree

!`git status --porcelain 2>/dev/null | head -5; git rev-parse --abbrev-ref HEAD 2>/dev/null`

## CRITICAL RULES

1. **Use Spanish** for documents, test names, commit messages, Jiku and messages to the user; English
   for code, code comments and `AGENTS.md`
2. **The specification is the contract** - Build exactly its scope. Anything it does not decide and
   that changes behavior visible to a user or an integrator is a gap: stop and report it, never decide
   it. The wire format is not a gap when it follows the engineering defaults: paths, field names,
   status codes, headers (`Authorization: Bearer`, `Retry-After`), the error `code` derived from its
   failure condition, the contract version bump — you choose it and the contract records it. Neither
   are the Input defaults of Engineering (text lengths, trimming, number ranges, email case,
   `validation_failed`, `forbidden`, `not_found`, `reference_not_found`, `invalid_state`) nor the outbound address guard of its
   Security baseline: apply them, in the contract and the schema, unless the definition fixes another
   value. Everything else (design, structure, libraries, internal names) is yours. What is left, the
   specification does not fix and a user or an integrator can observe, splits in two closed lists:
   - **Small — decide it, record it:** a text the definition does not fix (labels, titles, interface
     messages); the order of a list and the presentation format of a value; an internal technical
     value (a timeout, a number of retries); a value whoever deploys configures (an environment
     variable documented in `docs/operacion.md`, with no invented value); a request with no effect
     (an edit with no fields, an item repeated in a list).
   - **Large — always stop:** a business rule or limit; an effect on what is in progress or between
     operations; security, sessions or permissions; what a stored value means or how it is stored;
     time (time zones, day boundaries, clocks); concurrency; anything that contradicts the
     definition. A failure with no failure condition behind it is large unless an engineering
     default gives it.
   - **On neither list → stop.** When in doubt, stop.

   A small decision goes to `$(grava.py workdir)/decided-{id}.md`, one line each:
   `- {ID}: {qué y por qué}` when it adds something the definition documents (a failure condition, a
   limit: its row, `Origen: #{id}`, and its test), or `- (presentación): {qué}` when it only changes
   presentation. Never decide silently: what is not listed was not allowed
3. **Autonomous after Step 0** - The only questions are the git and state checks of Step 0. After
   that, never ask: stop with a report instead
4. **Research before choosing** - A new dependency, an upgrade, or an unfamiliar API: check the
   official documentation now (WebSearch/WebFetch). Record stack choices in the service's `AGENTS.md`;
   a choice with a real alternative the product cares about is a new technical decision, which needs
   the user: stop and report it
5. **Test-first per criterion** - Every criterion gets a test tagged `[ID]` that fails before the code
   and passes after. Tests exercise the public interface; invariants and guarantees are tested under
   their real conditions (parallel requests, a failure mid-way)
6. **The definition is updated in this branch** - Apply the specification exactly, with `Origen:
   #{id}`. Behavior an engineering default adds on the way (a rate limit the verifier asked for)
   enters the definition too, and you report it. Nothing else in the definition changes
7. **Done means verified** - `make check` green, every criterion with a passing tagged test, evidence
   computed by `grava.py evidence`, `def-check` clean, and the verifier's APROBADO. Never weaken a test
   to pass
8. **Deterministic work through `grava.py`** - `git-check`, `jiku fetch`, `spec order`, `spec check`, `spec diff`, `spec amend`,
   `branch`, `jiku state`, `load`, `def-index`, `def-check`, `coverage`, `evidence`, `mr-text`,
   `jiku comment`, `out-of-scope`
9. **What you see out of scope goes to Jiku, never into the branch** - A bug in what is built, an
   intermittent test (even one that also fails on `dev`), a security risk, something postponed, the
   definition or tests out of date where this requirement does not touch: record each with
   `grava.py out-of-scope {id}` as the [Jiku spec](.claude/specs/jiku.md) says (What Is Seen Out of
   Scope), also when you stop. Problems of grava-workflow or the environment, and opinions, go only
   to your report. Subagents you launch report theirs to you

## Execution

### Step 0: Check

`$ARGUMENTS` is the Jiku id. Without it, ask.

```bash
python3 .claude/scripts/grava.py git-check --mode implement
python3 .claude/scripts/grava.py jiku fetch {id}
python3 .claude/scripts/grava.py spec order {id}
```

`spec order` comes first and has no confirmation: if the last line is `orden: PENDING` or
`orden: CANCELLED`, stop before asking anything else. The specification builds on what its
dependencies add, so it cannot be built without them.

```markdown
## #{id} todavía no se puede implementar

Depende de requisitos que no están mergeados en `dev`:

- #{x} {título} — {estado en Jiku}

{PENDING: Implementalos primero, en orden (`/req-implement {x}`), y volvé a correr `/req-implement {id}`.}
{CANCELLED: #{x} se canceló: la especificación de #{id} se apoya en algo que no se va a construir.
Actualizala con `/req-specify {id}` (sacar la dependencia o traer acá lo que hace falta).}
```

| `git-check` | Action |
|---|---|
| `OK` | Continue |
| `BEHIND`, `DIRTY`, `NO_DEV` | Stop and tell the user what to do (pull `dev`, commit or discard) |
| `OTHER_BRANCH` | Warn and ask whether to continue on that branch. If it is this requirement's open branch (`feat/{id}-…`), say it looks like a resumption |
| `NO_REMOTE` | Warn that it cannot check `dev` is up to date; ask whether to continue |

| Jiku state | Action |
|---|---|
| `en_cola` | Continue |
| `desarrollo` | Warn (it may be a resumption, or a reopened requirement) and ask whether to continue |
| `analisis`, `planificacion`, `revision`, `resuelto` | Warn what it means and ask whether to continue; the user is responsible |
| `cancelado` | Stop |

From here on, do not ask anything.

---

### Step 1: Specification

Read the copy of the requirement fully: scope, proposal (with its technical detail), criteria, and the
comments added since it was specified (they may matter).

```bash
python3 .claude/scripts/grava.py spec check {id} --implement
```

- `S18` (the description does not say «Especificación: lista») → stop: it is a draft — for example a
  part of the initial plan not specified yet: "#{id} es un borrador: especificalo con `/req-specify {id}`".
- `S2` (a criterion that cannot be read) → stop: someone broke the table in Jiku; show the rows.
- `S9` (a dependency not merged, or a respected decision that was reverted) → stop: "Depende de #{x},
  que no está mergeado en dev", or "la especificación respeta {DEC}, que fue revertida: hay que
  actualizarla con `/req-specify {id}`".
- `S4` / `S5` (an ID that no longer fits the definition, or that another requirement took) → stop: the
  product changed since it was specified; `/req-specify {id}` must update it.
- `S10` (it cites an ID that does not exist and that neither it nor a dependency adds) → stop: the
  definition it would leave in `dev` would document what is not built; `/req-specify {id}` must fix it.
- `S11`–`S16` (a criterion that differs from its row, a parameter whose old value a decision still
  states, `respeta` or `revierte` on something that is not a decision, an item brought in from out of
  scope without its decision…) → stop: building would leave the definition contradicting itself; `/req-specify {id}`
  must fix it.
- Not a reason to stop: a cross-cutting rule (authentication, a request limit, an ownership check)
  whose operations arrive with later requirements. Build it and prove it through an operation that
  exists only in the tests; each later requirement adds its own tests for its operations.

The requirement moves to Desarrollo only when Step 4 starts, so a stop in Steps 0-3 leaves Jiku as it
was. If you stop after that, leave it in Desarrollo: the branch has work.
- Empty fields → stop: "#{id} no tiene especificación: corré `/req-specify {id}`".

```markdown
## #{id} no se puede implementar tal como está especificado

{qué encontró el chequeo, y qué parte de la especificación afecta}

Hay que actualizar la especificación con `/req-specify {id}` antes de implementar.
```

---

### Step 2: Branch and What Is Left

With a short English slug of the title:

```bash
python3 .claude/scripts/grava.py branch {id} {slug}
python3 .claude/scripts/grava.py spec diff {id}
```

- `nueva` → a fresh branch; `spec diff` lists every criterion as pending.
- `retomada` → read the branch's commits; `spec diff` lists what is still missing (rows, tests,
  decisions, parameters). Continue from there.
- `nueva (reapertura N)` → the requirement was merged before and its specification changed:
  `spec diff` lists only the difference with what `dev` has — new, changed and removed criteria
  (removed ones take their code and tests with them). Do only that.

```bash
python3 .claude/scripts/grava.py load --requirement {id}
```

Read the loaded definition, `AGENTS.md` and the `AGENTS.md` of each service you will touch (its
canonical examples are the shape to follow). Open the schema and contracts of those services when the
work touches tables or operations.

---

### Step 3: Plan

Make your own plan: which services and modules, in which order, which criteria each piece satisfies,
which tests at which level, which migrations, which contract changes. For a large requirement you may
split the work across subagents (one per service or module, with clear boundaries and the criteria
each one owns); you remain responsible for the whole. Ask each one to end its report with what it decided under Rule 2 (the small
ones, for `decided-{id}.md`; a large one is a stop it reports to you) and what it saw out of scope
(Rule 9).

Wait for every subagent you launch before you end your turn, and do not schedule wake-ups to wait for
one: launch it in the foreground, or keep working and collect its report before you finish. A
subagent that stops without a report (an interruption, a denied permission) did not finish its part:
check what it left in the working tree and finish it yourself or launch it again. Your turn ends only
with the requirement closed (Step 7) or stopped with a report.

Before writing code, list every behavior the plan gives the product that a user or an integrator can
observe — each message, limit, expiry, each way an operation can fail (every error response or
command failure needs a failure condition), and the effect of one operation on another — and check
that the specification or the definition fixes it; the wire format, the input defaults and the
outbound address guard of Engineering do not count (Rule 2). Sort what is not fixed with Rule 2's
lists: the small ones you decide while building (and list them); if any is large or on neither list,
stop now and report them all at once, with your proposal for each, so `/req-specify {id}` can settle
them in one pass:

```markdown
## #{id}: la especificación deja comportamientos sin decidir

1. {comportamiento} — propuesta: {…}
2. …

Resolvelos con `/req-specify {id}` y volvé a correr `/req-implement {id}`.
```

Leave the branch without commits (delete it if it has none: `git switch dev && git branch -D {branch}`).

---

### Step 4: Build

The plan has no gaps: now the work starts.

```bash
python3 .claude/scripts/grava.py jiku state {id} desarrollo     # if it was not already there
```

For each piece of the plan:

1. Write the test for its criterion, tagged `[ID]` with a Spanish name; run it; see it fail for the
   right reason.
2. Write the code; run the test; see it pass. Keep `make lint` and `make typecheck` clean as you go.
3. Commit: `feat({servicio}): {qué} (#{id})`.

Apply the specification to the definition as soon as the corresponding code exists:

- **Criteria** → rows of their block, exactly as written, with `Origen: #{id}`: `agrega` adds the row
  (a failure condition `condición → resultado` splits into its two columns), `modifica` replaces its
  text, `elimina` removes it. A new block (Detalle técnico → Bloques) is created whole with its
  frontmatter; update `last_requirement` / `last_failure`.
- **Datos, Invariantes y garantías, Glosario, Arquitectura** → the entity files, `invariants.md`,
  `guarantees.md`, `glossary.md`, `services.md` (modules, interactions), `integration.md`, `auth.md`.
- **Decisiones** → `nueva` to `decisions.md` with its motivo; `revierte` moves the old one to
  `Revertidas`.
- **Parámetros** → `parameters.md`, their variables in `.env.example` and the configuration validation.
- **Esquema** → the schema document and a new migration, together. Never edit a migration already in
  `dev`.
- **Interfaz** → the contract (`_gflow/apis/`): every operation added or changed, with
  `x-requirements`, `x-origin: '#{id}'`, `x-failure` on each error, `security` and `x-roles`; bump
  `info.version` (major if it breaks an external integrator, which the specification must say).
- **Flujos** → the flow, naming the real operation, message or table on each step.
- **Guides**: `AGENTS.md` (English) for new commands, stack changes or a better canonical example;
  `README.md` for a new surface, URL, command or local setup step; `docs/operacion.md` for a new
  service, background process, integration or alert; `docs/integracion.md` for an operation external
  integrators use.

```bash
python3 .claude/scripts/grava.py def-index
python3 .claude/scripts/grava.py def-check
```

---

### Step 5: Prove It

```bash
make check
python3 .claude/scripts/grava.py coverage {id}
python3 .claude/scripts/grava.py evidence {id}
python3 .claude/scripts/grava.py spec diff {id}
python3 .claude/scripts/grava.py def-check
```

While building, iterate with the fast levels (unit, component or widget tests). Before the verifier,
run the slow ones that close the requirement, as [Engineering](.claude/specs/engineering.md) says
(End to end, by platform): `make test-e2e` — browsers, or the Android emulator for a mobile app — with
a screenshot of every screen the requirement touches at two sizes in `reports/screenshots/{id}/`, and
`make test-perf` if a criterion proves an NFR by load.

Repeat Steps 4–5 until all pass and `spec diff` reports nothing pending. A failing test is fixed in the
code; a test that turns out to be wrong is fixed only if the specification proves it wrong. Run the
product (`make up`) and exercise the main path once by hand (curl, or the browser through Playwright)
to catch what tests miss.

---

### Step 6: Verify

Launch the [verifier](.claude/agents/verifier.md) subagent (`subagent_type: verifier`) with:

```
Requisito: #{id} — {título}
Especificación: la copia de Jiku en {ruta que imprimió jiku fetch}
Rama: {branch} (base: dev)
{si es una reapertura: "Reapertura: verificá solo la diferencia que lista `grava.py spec diff {id}`, y que lo anterior siga en pie"}
```

- Every round, approved or not, record its «Fuera de alcance» items (Rule 9) before going on: a
  rejected round's report is not kept.
- **APROBADO** → save its verdict (the whole message) to `$(python3 .claude/scripts/grava.py workdir)/verdict-{id}.md` and
  continue.
- **RECHAZADO** → fix every finding, prove it again, and launch a new verifier, passing it the
  previous findings ("Hallazgos de la ronda anterior: …") so it confirms each one is fixed before
  looking for new ones. New findings in a later round are normal.
  **Stop** when a finding survives a fix twice, or after five rounds in total: do not push and do not
  comment in Jiku as done. Leave the branch local and report honestly what is still open and why.

---

### Step 7: Close

Check that everything seen out of scope is recorded (Rule 9): `grava.py out-of-scope {id} --list`.
If `decided-{id}.md` lists definition IDs, add them to the specification in Jiku, marked as decided
in the implementation (only those rows; nothing else of the specification changes):

```bash
python3 .claude/scripts/grava.py spec amend {id}
```

`mr-text` adds both lists to the MR.

```bash
git push -u origin {branch}     # if there is a remote; report a failed push
python3 .claude/scripts/grava.py mr-text {id} --verdict $(python3 .claude/scripts/grava.py workdir)/verdict-{id}.md
```

Write the Jiku comment in business terms — what the product does now, each criterion met (by its
text, never by test names), that it was verified and in which round, and the branch — to a file in the
working folder, and send it:

```bash
python3 .claude/scripts/grava.py jiku comment {id} --file $(python3 .claude/scripts/grava.py workdir)/jiku-comment-{id}.md
```

```markdown
## #{id} implementado — {título}

Rama: `{branch}` {{pusheada / sin remoto}}
Criterios: {n}/{n} cumplidos y probados. Verificación aprobada (ronda {r}).
Qué hace ahora el producto: {2-4 líneas}
{{Si agregó algo por un default de ingeniería: "Además: {qué}, por {regla}."}}
{{Si decidió algo chico: "Decidido en la implementación (revisalo): {lista corta}."}}
{{Si registró algo fuera del alcance: "Fuera de alcance, registrado: #{n} {título}; …"}}

### Siguiente paso
Abrir el MR de `{branch}` a `dev` (texto: `{ruta de mr-{id}.md}`), revisarlo, probarlo y mergearlo.
```

## Output

- Code, tests, definition, contracts and guides on `feat/{id}-{slug}`, pushed
- The MR/PR description in the working folder (`mr-{id}.md`), with evidence and verdict
- Jiku: state Desarrollo, an internal comment
