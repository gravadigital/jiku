---
name: jflow-build
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
Step 0: Check git and the requirement's state
  |
Step 1: Read the specification from Jiku and check it
  |
Step 2: Branch (new, resumed or reopened) and what is left to do
  |
Step 3: Plan (yours) and sweep for gaps before writing code (ask the large ones, all at once)
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

- Decide anything the specification leaves to the user: a large gap is asked, and the answer goes
  to the specification in Jiku before building it (only the small ones are decided, and listed)
- Change behavior beyond the specification, except the corrections of Rule 2 (listed)
- Open, approve or merge the MR/PR (the user does)

Specifying is `/jflow-spec {id}`. Small changes without a specification are `/jflow-fix {id}`.

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

1. **Language** - Talk to the user in the language they write in (the product language until they write in their own words; with no project yet, the language of the request). Everything written to Jiku and the
   documents for people (`README.md`, `docs/`, `CHANGELOG.md`) in the product language (`language` in
   `_jflow/project.yaml`, Spanish when unset); the definition with its structure in English and its
   content in the product language. Commits, the MR/PR text, branch names and test names always in
   English; code, code comments, identifiers and `AGENTS.md` in English. See
   [Language](.claude/specs/language.md)
2. **The specification is the contract** - Build exactly its scope. Anything it does not decide and
   that changes behavior visible to a user or an integrator is a gap: stop and report it, never decide
   it. The wire format is not a gap when it follows the engineering defaults: paths, field names,
   status codes, headers (`Authorization: Bearer`, `Retry-After`), the error `code` derived from its
   failure condition, the contract version bump — you choose it and the contract records it. Neither
   are the Input defaults of Engineering (text lengths, trimming, number ranges, email case,
   `validation_failed`, `forbidden`, `not_found`, `reference_not_found`, `invalid_state`) nor the outbound address guard of its
   Security baseline: apply them, in the contract and the schema, unless the definition fixes another
   value. Everything else (design, structure, libraries, internal names) is yours. What is left — the
   specification does not fix it and a user or an integrator can observe it — falls in one of four
   closed categories:
   - **1. Small — decide it, record it:** a text the definition does not fix (labels, titles,
     interface messages); the order of a list and the presentation format of a value; an internal
     technical value (a timeout, a number of retries); a value whoever deploys configures (an
     environment variable documented in the operations guide, with no invented value); a request with
     no effect (an edit with no fields, an item repeated in a list). It goes to
     `$(jflow.py workdir)/decided-{id}.md` (it goes into the MR text: English), one line each:
     `- {ID}: {what and why}` when it adds something the definition documents (a failure condition, a
     limit: its row, `Origin: #{id}`, and its test), or `- (presentation): {what}` when it only
     changes presentation.
   - **2. Correction on the way — fix it, record it:** something already built that is wrong
     according to the definition (or its NFRs and decisions), when **all four** hold: it is in what
     this requirement already changes (the same screen, module or file); the fix only brings it to
     what the definition says, with no new behavior and no decision; it touches no other service and
     no stored data; it is small (a text, a label, a missing case of an existing rule, a definition
     row that no longer describes what the code does). Fix it with its test (tagged with the ID it
     restores) and add one line to `$(jflow.py workdir)/corrected-{id}.md`: `- {ID}: {what was wrong
     and what was fixed}` (English: it goes into the MR text). If one of the four does not hold, it is category 4.
   - **3. Large — ask the user, then write it to the specification:** a business rule or limit; an
     effect on what is in progress or between operations; security, sessions or permissions; what a
     stored value means or how it is stored; time (time zones, day boundaries, clocks); concurrency;
     anything that contradicts the definition or the visual reference; something that exists today
     and would stop being seen or working. A failure with no failure condition behind it is large
     unless an engineering default gives it. Anything on no list, or in doubt, is large. How to ask
     and record it: Step 3 («Large gaps»).
   - **4. Out of scope — to Jiku, not into the branch:** Rule 9.

   Never decide or fix silently: what is not listed was not allowed
3. **Questions: Step 0, and the large gaps** - Besides the checks of Step 0, ask only the decisions of
   category 3, with options and your recommendation, all you know of at once. Never ask about the
   process (whether to go on, to verify again, to fix a finding, to record what you saw)
4. **Research before choosing** - A new dependency, an upgrade, or an unfamiliar API: check the
   official documentation now (WebSearch/WebFetch). Record stack choices in the service's `AGENTS.md`;
   a choice with a real alternative the product cares about is a new technical decision, which needs
   the user: stop and report it
5. **Test-first per criterion** - Every criterion gets a test tagged `[ID]` that fails before the code
   and passes after. Tests exercise the public interface; invariants and guarantees are tested under
   their real conditions (parallel requests, a failure mid-way)
6. **The definition is updated in this branch** - Apply the specification exactly, with `Origin:
   #{id}`. Behavior an engineering default adds on the way (a rate limit the verifier asked for)
   enters the definition too, and you report it, and so does a correction of category 2 (Rule 2).
   Nothing else in the definition changes
7. **Done means verified** - `make check` green, every criterion with a passing tagged test, the
   end-to-end tests of every entry it touches passing against `make up`, evidence
   computed by `jflow.py evidence`, `def-check` clean, and the verifier's APPROVED. Never weaken a test
   to pass
8. **Deterministic work through `jflow.py`** - `git-check`, `jiku fetch`, `spec order`, `spec check`, `spec diff`, `spec amend`,
   `branch`, `jiku state`, `load`, `def-index`, `def-testing`, `def-check`, `coverage`, `evidence`, `mr-text`,
   `jiku comment`, `out-of-scope`
9. **What you see out of scope goes to Jiku, never into the branch** - A bug in what is built that is
   not a correction of category 2, an intermittent test (even one that also fails on `dev`), a
   security risk, something postponed, the definition or tests out of date where this requirement
   does not touch: collect them as you go and record them at close (also when you stop) as the
   [Jiku spec](.claude/specs/jiku.md) says (What Is Seen Out of Scope): **one** incidencia for all of
   them, one per security risk, and a comment on the requirement that already covers one. Problems of
   jiku flow or the environment, and opinions, go only to your report. Subagents you launch
   report theirs to you

## Execution

### Step 0: Check

`$ARGUMENTS` is the Jiku id. Without it, ask.

```bash
python3 .claude/scripts/jflow.py git-check --mode implement
python3 .claude/scripts/jflow.py jiku fetch {id}
python3 .claude/scripts/jflow.py spec order {id}
```

`spec order` comes first and has no confirmation: if the last line is `order: PENDING` or
`order: CANCELLED`, stop before asking anything else. The specification builds on what its
dependencies add, so it cannot be built without them. Tell the user (in their language):

```markdown
## #{id} cannot be implemented yet

It depends on requirements that are not merged in `dev`:

- #{x} {title} — {state in Jiku}

{PENDING: Implement them first, in order (`/jflow-build {x}`), and run `/jflow-build {id}` again.}
{CANCELLED: #{x} was cancelled: the specification of #{id} builds on something that will not be built.
Update it with `/jflow-spec {id}` (remove the dependency or bring here what is needed).}
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

**End to end.** Read `_jflow/prd/architecture/testing.md` and find the entries this requirement
touches: the surfaces of its blocks and the services of its modules (from the specification's scope
and Architecture («Arquitectura»)), and the entries it adds.

| What you find | Action |
|---|---|
| No `testing.md` | Stop: the product lacks how it is tested (minimum M9 of Engineering); report it, it is completed before implementing |
| A touched entry needs values in `.env` that are missing or empty (the test identities or a sandbox `testing.md` names) | Ask the user to fill them in `.env` now (never in the chat), naming each variable and where the README says to get it |
| A touched entry has no working end-to-end test (its row says it is pending) | Warn and ask: continue without proving that entry end to end (it goes to the MR and the Jiku comment as a risk) or stop |

From here on, do not ask anything.

---

### Step 1: Specification

Read the copy of the requirement fully: scope, proposal (with its technical detail), criteria, and the
comments added since it was specified (they may matter).

```bash
python3 .claude/scripts/jflow.py spec check {id} --implement
```

- `S18` (the description does not say «Specification: ready» («Especificación: lista»)) → stop: it is
  a draft — for example a part of the initial plan not specified yet: "#{id} is a draft: specify it
  with `/jflow-spec {id}`".
- `S2` (a criterion that cannot be read) → stop: someone broke the table in Jiku; show the rows.
- `S9` (a dependency not merged, or a respected decision that was reverted) → stop: "It depends on #{x},
  which is not merged in dev", or "the specification keeps {DEC}, which was reverted: update it with
  `/jflow-spec {id}`".
- `S4` / `S5` (an ID that no longer fits the definition, or that another requirement took) → stop: the
  product changed since it was specified; `/jflow-spec {id}` must update it.
- `S10` (it cites an ID that does not exist and that neither it nor a dependency adds) → stop: the
  definition it would leave in `dev` would document what is not built; `/jflow-spec {id}` must fix it.
- `S11`–`S16` (a criterion that differs from its row, a parameter whose old value a decision still
  states, `keeps` or `reverts` on something that is not a decision, an item brought in from out of
  scope without its decision…) → stop: building would leave the definition contradicting itself; `/jflow-spec {id}`
  must fix it.
- Not a reason to stop: a cross-cutting rule (authentication, a request limit, an ownership check)
  whose operations arrive with later requirements. Build it and prove it through an operation that
  exists only in the tests; each later requirement adds its own tests for its operations.

The requirement moves to Desarrollo only when Step 4 starts, so a stop in Steps 0-3 leaves Jiku as it
was. If you stop after that, leave it in Desarrollo: the branch has work.
- Empty fields → stop: "#{id} has no specification: run `/jflow-spec {id}`".

The stop messages are said in the user's language:

```markdown
## #{id} cannot be implemented as specified

{what the check found, and which part of the specification it affects}

Update the specification with `/jflow-spec {id}` before implementing.
```

---

### Step 2: Branch and What Is Left

With a short English slug of the title:

```bash
python3 .claude/scripts/jflow.py branch {id} {slug}
python3 .claude/scripts/jflow.py spec diff {id}
```

- `new` → a fresh branch; `spec diff` lists every criterion as pending.
- `resumed` → read the branch's commits; `spec diff` lists what is still missing (rows, tests,
  decisions, parameters). Continue from there.
- `new (reopened N)` → the requirement was merged before and its specification changed:
  `spec diff` lists only the difference with what `dev` has — new, changed and removed criteria
  (removed ones take their code and tests with them). Do only that.

```bash
python3 .claude/scripts/jflow.py load --requirement {id}
```

Read the loaded definition, `AGENTS.md` and the `AGENTS.md` of each service you will touch (its
canonical examples are the shape to follow). Open the schema and contracts of those services when the
work touches tables or operations.

---

### Step 3: Plan

Make your own plan: which services and modules, in which order, which criteria each piece satisfies,
which tests at which level, which migrations, which contract changes. For a large requirement you may
split the work across subagents (one per service or module, with clear boundaries and the criteria
each one owns); you remain responsible for the whole. Ask each one to end its report with what it
decided or corrected under Rule 2 (for `decided-{id}.md` and `corrected-{id}.md`; a large one it does
not decide: it reports it to you, and you ask the user) and what it saw out of scope (Rule 9).

What must outlive the run — your notes of what was decided, corrected and seen out of scope, the copy
of the specification, the lists of screens — lives in the working folder (`jflow.py workdir`), never
in the session's scratchpad: a restart erases the scratchpad. Scripts you need to run more than once
(to capture, to compare) are tests or `make` targets of the repo.

Wait for every subagent you launch before you end your turn, and do not schedule wake-ups to wait for
one: launch it in the foreground, or keep working and collect its report before you finish. A
subagent that stops without a report (an interruption, a denied permission) did not finish its part:
check what it left in the working tree and finish it yourself or launch it again. Your turn ends only
with the requirement closed (Step 7) or stopped with a report.

Before writing code, list every behavior the plan gives the product that a user or an integrator can
observe — each message, limit, expiry, each way an operation can fail (every error response or
command failure needs a failure condition), and the effect of one operation on another — and check
that the specification or the definition fixes it; the wire format, the input defaults and the
outbound address guard of Engineering do not count (Rule 2). When the requirement changes screens
or behavior that already exist, also look at how each one works today and list what exists and the
specification (or its visual reference) would drop. With a visual reference, do it on the images:
capture every screen of its table as the product is now (the capture harness is an end-to-end test
of the repo, not a script of yours), run `jflow.py visual-pairs {id}`, and go through every pair and
zone listing each datum, control and function the product has today and the reference does not.
This sweep is yours and comes **before** you split the work: subagents build, they do not discover
what the specification left open. Sort everything with Rule 2's categories: the small ones you decide
while building, the corrections you fix (both listed).

**Large gaps** — ask them now, in one round, before building (up to four per `AskUserQuestion`, one
after another), so the user answers once and the rest of the run needs nobody:

```
AskUserQuestion (in the user's language): "{what the specification does not fix, in one business
sentence}: {why it matters}."
Options:
- "{your proposal} (Recommended)" — {what is written in the specification}
- "{alternative}" — {…}
- "Stop and re-specify" — I stop without building; it is resolved with `/jflow-spec {id}`
```

Write each answer to the specification in Jiku before building it: `jflow.py spec draft {id}`, add it
to the draft where it belongs — a decision (`new`, its reason from the user's words, in the
product language), a criterion with its ID, or a row of «Decided difference» («Diferencia decidida»)
of the visual reference — then `spec check {id} --source
draft` and `spec push {id}`, and `jiku fetch {id}` to read it back. A large gap found later, while
building or after the verifier, is asked and written the same way, and the work goes on.

Offer to stop (and stop, when chosen) only when the answer would make the requirement much larger: a
new entity, service or integration, a migration of stored data, a change of another requirement's
scope. Then leave the branch as it is (without commits: delete it, `git switch dev && git branch -D
{branch}`) and report what is pending for `/jflow-spec {id}`.

---

### Step 4: Build

The plan has no gaps: now the work starts.

```bash
python3 .claude/scripts/jflow.py jiku state {id} desarrollo     # if it was not already there
```

For each piece of the plan:

1. Write the test for its criterion, tagged `[ID]` with an English name; run it; see it fail for the
   right reason.
2. Write the code; run the test; see it pass. Keep `make lint` and `make typecheck` clean as you go.
3. Commit: `feat({service}): {what} (#{id})`.

Apply the specification to the definition as soon as the corresponding code exists:

- **Criteria** → rows of their block, exactly as written (the content stays in the product language;
  the structure of the definition is English), with `Origin: #{id}`: `add` adds the row (a failure
  condition `condition → result` splits into its two columns), `modify` replaces its text, `remove`
  removes it. A new block (Technical detail → Blocks) is created whole with its frontmatter; update
  `last_requirement` / `last_failure`.
- **Data, Invariants and guarantees, Glossary, Architecture** → the entity files, `invariants.md`,
  `guarantees.md`, `glossary.md`, `services.md` (modules, interactions), `integration.md`, `auth.md`.
- **Decisions** → `new` to `decisions.md` with its reason; `reverts` moves the old one to
  `Reverted`.
- **Parameters** → `parameters.md`, their variables in `.env.example` and the configuration validation.
- **Schema** → the schema document and a new migration, together. Never edit a migration already in
  `dev`.
- **Interface** → the contract (`_jflow/apis/`): every operation added or changed, with
  `x-requirements`, `x-origin: '#{id}'`, `x-failure` on each error, `security` and `x-roles`; bump
  `info.version` (major if it breaks an external integrator, which the specification must say).
- **Flows** → the flow, naming the real operation, message or table on each step.
- **How it is tested** → when the requirement adds an entry (a surface, an interface a service exposes),
  a role or an external integration: `jflow.py def-testing --origin '#{id}'` adds its rows; fill them
  and build what they need (the role's claims in the fake issuer, the replacement of the integration,
  the test client of the new interface). A row of `testing.md` that no longer describes how its entry
  is tested is corrected.
- **Guides**: `AGENTS.md` (English) for new commands, stack changes or a better canonical example;
  `README.md` for a new surface, URL, command or local setup step; the operations guide (`docs/operacion.md`
  in Spanish, `docs/operations.md` otherwise) for a new service, background process, integration or
  alert; the integration guide (`docs/integracion.md` / `docs/integration.md`) for an operation
  external integrators use. All of them except `AGENTS.md` in the product language.

```bash
python3 .claude/scripts/jflow.py def-index
python3 .claude/scripts/jflow.py def-check
```

---

### Step 5: Prove It

```bash
make check
python3 .claude/scripts/jflow.py coverage {id}
python3 .claude/scripts/jflow.py evidence {id}
python3 .claude/scripts/jflow.py spec diff {id}
python3 .claude/scripts/jflow.py def-check
```

While building, iterate with the fast levels (unit, component or widget tests). Before the verifier,
the slow ones that close the requirement, as [Engineering](.claude/specs/engineering.md) and
`architecture/testing.md` say:

- **End to end, per entry it touches.** For each entry found in Step 0 (and each one it adds), a test
  against `make up` that enters as the actor does — the browser or the app, an HTTP client with a token
  of the role, a client of the broker authenticated as the actor —, never by calling the service's own
  code. It proves the criteria of each actor that uses that entry: the case that works, and the
  refusal when the criterion is a permission or a failure the actor can cause. Tagged with the IDs it
  proves. What you would try by hand is one of these tests.
- `make up`, `make test-e2e`, with a screenshot of every screen the requirement touches at two sizes
  in `reports/screenshots/{id}/`; `make test-perf` if a criterion proves an NFR by load; `make down`.
- **Visual reference** («Referencia visual», when the specification has one). Every screen of its
  table is captured in its state, named after its `Screen` («Pantalla»), the large size at the width of the reference. Then:

  ```bash
  python3 .claude/scripts/jflow.py visual-pairs {id}
  ```

  A `MISSING` line is a capture still to make. Open every pair and every zone
  (`reports/screenshots/{id}/pairs/{screen}-z{n}.png`), not a sample, and list for each zone
  what differs: colors, sizes, weights, shapes, borders, spacing, components and their variants,
  hierarchy, what is missing or added. Only the «Decided difference» rows and the data may differ.
  When the reference brings HTML, CSS or tokens, read the exact values there instead of estimating
  them from the image. Fix the cause: a difference in a shared component is fixed in the component,
  and every screen that uses it is captured again. Repeat capture → pairs → compare until no zone
  shows a difference that is not decided. A difference you cannot remove without a decision the
  specification does not take is a large decision (Rule 2).

Repeat Steps 4–5 until all pass and `spec diff` reports nothing pending. A failing test is fixed in the
code; a test that turns out to be wrong is fixed only if the specification proves it wrong. An entry
whose end-to-end test cannot run (the product does not come up, an identity fails) is never skipped in
silence: fix it if it is this requirement's, otherwise stop and report it.

---

### Step 6: Verify

Launch the [jflow-verifier-agent](.claude/agents/jflow-verifier-agent.md) subagent (`subagent_type: jflow-verifier-agent`) with:

```
Requirement: #{id} — {title}
Specification: the Jiku copy at {path printed by jiku fetch}
Branch: {branch} (base: dev)
{if it is a reopening: "Reopening: verify only the difference `jflow.py spec diff {id}` lists, and that what was there still holds"}
```

- Every round, approved or not, add its «Out of scope» items to your list (Rule 9) before going
  on: a rejected round's report is not kept.
- **APPROVED** → save its verdict (the whole message) to `$(python3 .claude/scripts/jflow.py workdir)/verdict-{id}.md` and
  continue.
- **REJECTED** → fix every finding, prove it again, and launch a new verifier, passing it the
  previous findings ("Findings of the previous round: …") so it confirms each one is fixed before
  looking for new ones. New findings in a later round are normal. Fix the cause, not the instance:
  when a finding names one place of a kind (a missing case, a list that misses an item), find every
  place of that kind with the method the verifier used, and fix them all.
  **Stop** when a finding survives three fixes, or after eight rounds in total: do not push and do not
  comment in Jiku as done. Leave the branch local and report honestly what is still open and why.

---

### Step 7: Close

Record what you saw out of scope (Rule 9), as one incidencia, in the product language: `jflow.py
out-of-scope {id} --skill jflow-build --type incidencia --title "{Seen in #{id}: short summary}" --file
{list}`, one line per item (what, where, why it was not done here); each security risk apart; an item an open requirement
covers, as a comment there (`--to N`). Check: `jflow.py out-of-scope {id} --list`.
If `decided-{id}.md` lists definition IDs, add them to the specification in Jiku, marked as decided
in the implementation (only those rows; nothing else of the specification changes):

```bash
python3 .claude/scripts/jflow.py spec amend {id}
```

`mr-text` adds both lists to the MR.

```bash
git push -u origin {branch}     # if there is a remote; report a failed push
python3 .claude/scripts/jflow.py mr-text {id} --verdict $(python3 .claude/scripts/jflow.py workdir)/verdict-{id}.md
```

Write the Jiku comment in the product language, in business terms — what the product does now, each criterion met (by its
text, never by test names), that it was verified and in which round, and the branch — to a file in the
working folder, and send it:

```bash
python3 .claude/scripts/jflow.py jiku comment {id} --file $(python3 .claude/scripts/jflow.py workdir)/jiku-comment-{id}.md
```

The final message to the user, in their language:

```markdown
## #{id} implemented — {title}

Branch: `{branch}` {{pushed / no remote}}
Criteria: {n}/{n} met and tested. Verification approved (round {r}).
What the product does now: {2-4 lines}
{{If an engineering default added something: "Also: {what}, by {rule}."}}
{{If it decided something small: "Decided in the implementation (review it): {short list}."}}
{{If it fixed something on the way: "Fixed along the way: {short list}."}}
{{If it asked something and wrote it to the specification: "Added to the specification while implementing: {short list}."}}
{{If it recorded something out of scope: "Out of scope, recorded: #{n} {title}; …"}}

### Next step
Open the MR from `{branch}` to `dev` (text: `{path of mr-{id}.md}`), review it, try it and merge it.
```

## Output

- Code, tests, definition, contracts and guides on `feat/{id}-{slug}`, pushed
- The MR/PR description in the working folder (`mr-{id}.md`), with evidence and verdict
- Jiku: state Desarrollo, an internal comment
