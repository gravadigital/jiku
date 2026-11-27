---
name: jflow-spec
description: Specify a Jiku requirement with the user - challenge it against the product definition and the pending requirements, decide scope, proposal, rules, decisions and acceptance criteria, and write the specification to Jiku
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
argument-hint: "[jiku-requirement-id] [what you want to add or change]"
---

# Specify Requirement

## Purpose

Turn a Jiku requirement — often written by the client, often incomplete, sometimes already specified
and now changing — into a specification the model can implement without asking. The agent is a
critical partner, not a scribe: it contrasts the request, and whatever the requirement already says,
with the product definition and the other open requirements, and makes the user decide every
conflict consciously. The specification is written to Jiku; the repository is not touched.

**Flow:**

```
Step 0: Check the requirement (state) and load it (Jiku + the user's text); draft new or resumed
  |
Step 1: Locate it in the product (definition, discovery, open requirements)
  |
Step 2: Analyze → conflicts, overlaps, impacts, disagreements with what is already written
  |
Step 3: Decide with the user: scope and proposal
  |
Step 4: Decide with the user: rules, failures, decisions, technical detail
  |
Step 5: Acceptance criteria
  |
Step 6: Check, the user reviews the whole draft once, write to Jiku
```

**Result:** The requirement in Jiku with its scope, proposal (with technical detail) and acceptance
criteria, in the format of the Requirement Spec. A reopened requirement is back in Desarrollo.

**This command does NOT:**

- Touch the repository: no commits, no branches, no edits under `_jflow/` (it only reads it)
- Write code, choose libraries or design endpoints beyond what the user fixes
- Approve or prioritize the requirement (people do, in Jiku)

The implementation is `/jflow-build {id}`. A bug or a small change that touches nothing documented
is `/jflow-fix {id}`.

## References

**Read [Requirement Spec](.claude/specs/requirement.md)** — the format of the three fields, IDs, states
and checks.

**Read [Product Definition](.claude/specs/product-definition.md)** — what the request is contrasted
with, and how its pieces are cited.

**Read [Jiku](.claude/specs/jiku.md)** — states and what the agent may write.

**Read [Discovery](.claude/specs/discovery.md)** (only its failure checklist) — the questions every new
user-facing behavior goes through.

## Pre-loaded Context

### Product Definition

!`ls _jflow/prd/ 2>/dev/null | head -3 || echo "NO_PRD_FOUND"`

## CRITICAL RULES

1. **Language** - Talk to the user in the language they write in (the product language until they write in their own words; with no project yet, the language of the request). Everything written to Jiku (the
   specification, comments) in the product language (`language` in `_jflow/project.yaml`, Spanish when
   unset); the specification's structure is the one `spec draft` writes (Spanish for Spanish, English
   otherwise). Identifiers in English. See [Language](.claude/specs/language.md)
2. **The repository is read-only here** - Only `git fetch` and reads. The draft lives in the system's
   temp folder (`jflow.py spec draft`)
3. **The user decides every rule** - Never fill a gap, pick an alternative or resolve a conflict
   yourself. Propose, with your recommendation first, and ask with `AskUserQuestion`
4. **What is written is input, not truth** - Scope, proposal and criteria already in the requirement,
   and what the client wrote, are contrasted like any request. Every disagreement is shown as a
   conflict: what it says, what you propose, why. The user decides
5. **No code-level detail** - Functional plus the key technical detail (data, interface, flows,
   architecture). Never files, functions or test names: the client may read it
6. **Save as you go, confirm once** - Write every answer to the draft and run `jflow.py spec check`
   as you go. Do NOT ask to confirm each part: the user reviews the whole draft once, in Step 6, and
   that review is the approval to write to Jiku. Whenever you ask for a review, give the draft's
   **absolute path** (the one `spec draft` prints) as a link. Do NOT dump the draft in chat: point to
   the file and summarize
7. **Deterministic work through `jflow.py`** - `jiku fetch`, `spec order`, `spec draft`, `next-id`,
   `load`, `spec check`, `spec push`, `jiku state`. Never pick an ID by hand

## Execution

### Step 0: Check and Load

**0.1 Arguments** — `$ARGUMENTS` = `{id} [free text]`. The id is a Jiku requirement number; the rest
is the user's own addition or change to the request. Without an id, ask for it.

**0.2 The requirement**

```bash
python3 .claude/scripts/jflow.py jiku fetch {id}
```

Read the copy it prints fully: description, **every comment**, attachments (if one is needed and you
cannot read it, ask the user for its content), and the scope, proposal and criteria if it already has
them. If Jiku does not answer, stop: the specification lives there.

**0.3 State** — from the copy:

| State | Action |
|---|---|
| `planificacion` | Continue |
| `analisis`, `en_cola`, `desarrollo` | Warn what it means (not marked to specify / approved and waiting / being implemented) and ask whether to continue; the user is responsible |
| `revision`, `resuelto` | Warn that it is already merged and will be **reopened**. If the user confirms: `jflow.py jiku state {id} desarrollo` and continue |
| `cancelado` | Stop |

If the type is `incidencia` or the request is a small change that touches nothing documented, say so
and suggest `/jflow-fix {id}`; continue only if the user wants a specification.

**0.3b Order** — if the requirement already has a scope:

```bash
python3 .claude/scripts/jflow.py spec order {id}
```

- `PENDING #{x}` → tell the user, without asking: «#{id} depends on #{x}, which is not in `dev` yet.
  It can be specified anyway: the specification builds on what #{x} says, and if #{x} changes it may
  need a review. It can be implemented only once #{x} is merged.» Continue.
- `CANCELLED #{x}` → a conflict (Rule 4): #{id} builds on something that will not be built. Propose
  removing the dependency or bringing here what is needed, and let the user decide.
- «Depended on by» → keep the list: Step 6 checks them again against what this specification
  changes.

**0.4 Draft**

```bash
python3 .claude/scripts/jflow.py spec draft {id}
```

Keep the path it prints: Step 6 sends the user to that file.

- "resuming the draft" → read it and resume at the first part still empty or incomplete (tell the
  user in one line, with the path).
- "new draft (with what the requirement already has in Jiku)" → it starts from what is written; Step
  2 will contrast it. If its criteria end with «Decided in the implementation: …» («Decidido en la
  implementación: …»), those criteria were decided by `/jflow-build`, not by the user: show them in
  Step 5 and ask whether to keep each one or change it (a change is a `modify`).
- "new draft (empty)" → tell the user: «I am starting the specification of #{id} from the beginning.
  If you had an earlier unfinished session, its draft was lost (for example, by a restart) and it has
  to be done again.»

---

### Step 1: Locate

```bash
python3 .claude/scripts/jflow.py git-check --mode read
python3 .claude/scripts/jflow.py load --overview
```

If `git-check` reports `BEHIND`, tell the user the local definition may be old and suggest pulling `dev`
first. Then load what the request touches:

```bash
python3 .claude/scripts/jflow.py load --block {PRE} [--block …] [--entity …] [--id …]
python3 .claude/scripts/jflow.py jiku list planificacion,en_cola,desarrollo
```

- Always read `_jflow/prd/out-of-scope.md`.
- Something not built yet (not in the definition) may be in the discovery (`_jflow/discovery/`) and in
  an open requirement of the plan: find which one (`jflow.py jiku fetch {other}` for its criteria).
- For anything that changes what a service exposes, read the operations of `_jflow/apis/` the loader
  lists and `_jflow/prd/architecture/integration.md` (external integrators consume contracts).

---

### Step 2: Analyze

Write down, for yourself, every finding:

| Kind | Example |
|---|---|
| **Contradicts** a requirement, failure condition, invariant or decision | "Cancel up to 1 hour after the start" vs CAN-E1 and the no-show window |
| **Overlaps** something built, or an **open requirement** that adds it | It is already CAN-02; or #41 (not built yet) adds the block it changes |
| **Out of scope** of the product | "Payments and deposits" is in out-of-scope.md |
| **Breaks a contract** an external integrator uses | Changing an operation listed under an INT |
| **Needs a decision** with a real alternative | A new channel, a provider, sync vs async |
| **Gaps** the request leaves open | Who can do it, what happens on failure, limits |
| **Hidden scope** | A new entity, a new state, a migration of existing data |
| **Disagrees with what is written** in the requirement's own fields | A criterion that cannot be tested, a rule that contradicts the definition |
| **Drops something that exists** — what the product shows or does today, on the screens or entries the request changes, that the request (or its design) no longer has | The design has no color picker and a black band where each event shows its cover color today; a field the new form does not have |

For the last kind, look at the product as it is, not only at the definition. With a visual
reference, go screen by screen through its table: open the code of the route (the page and the
components it renders, in each state of the row) and list every datum, control, action, help text
and behavior on interaction (what a click opens, where it navigates) that the reference does not
show. Without one, do the same for each screen or entry the request changes. Every item is a
question of Step 3; none is assumed kept or dropped.

A change to something an open requirement adds (not built yet) cannot modify the definition: ask
whether to fold it into that requirement (specify that one instead) or wait until it is merged.

Tell the user, briefly, what you found (one line each) before asking.

---

### Step 3: Scope and Proposal

Write **Scope** (Includes, Excludes, Depends on) and the summary of **Proposal** in the draft (with
the structure names the draft uses: «Alcance», «Incluye»… in Spanish). Ask
with `AskUserQuestion` about every finding of kind "contradicts", "overlaps", "out of scope", "breaks
a contract", "disagrees", "drops something that exists" and every scope gap — concrete options, your
recommendation first. What is kept despite the design becomes a row of «Decided difference» («Diferencia decidida»); what
is dropped goes to the scope, with its criterion. Update the
draft with each answer.

What the user leaves for later goes to «Excludes» («No incluye») with the requirement that will do it (`#id`;
`S17` checks it). If an open requirement covers it, offer to leave it a comment there; if none does,
offer to create one. Ask before writing, then use `jflow.py out-of-scope {id} --skill jflow-spec`
(`--to N` for the comment, `--type funcionalidad|mejora` for a new one) and cite the `#id` it
prints. A bug or risk you notice in what is built, outside this requirement, is offered the same
way, as an `incidencia` ([Jiku spec](.claude/specs/jiku.md), What Is Seen Out of Scope).

Save and run `jflow.py spec check {id} --source draft` (ignore observations about parts not written
yet). Do not ask to confirm the part: go on to Step 4. Note every assumption you made (something the
user did not answer explicitly): they are listed in the Step 6 review.

---

### Step 4: Rules, Failures, Decisions and Technical Detail

In the draft:

- **Criteria rows for every rule that changes** — `add` with a new ID (`jflow.py next-id {PRE}
  --requirement {id}`, `next-id {PRE}-E …`), `modify` with the full new text, `remove` (`agrega`,
  `modifica`, `elimina` in a Spanish specification). A failure condition is `condition → result`.
- Walk the **failure checklist** of the Discovery spec for every new user-facing behavior, with the
  user: concurrency, limits, time passing, state changed, external failure, permission, dependents,
  what the actor sees on each failure, what resets when a temporary state ends.
- **Sweep for what would stop the implementation.** `/jflow-build` decides only small things
  (texts, order, presentation, internal technical values, deployment configuration, requests with no
  effect) and stops at anything large (its Rule 2). So, against the definition as it is now (it
  includes what earlier requirements built), check that the specification fixes, for everything it
  adds or changes: business rules and limits with their values; the effect on what is in progress
  and between operations (what happens to the reservations, loans, deliveries already there);
  security, sessions and permissions; what each stored value means and how it is kept; time (time
  zones, day boundaries, adjacent ranges, clocks); concurrency; the platform (no connection on a
  `mobile-app` surface). Ask what is missing, grouped, each with your recommendation. A requirement
  that comes as a draft from the initial plan goes through this sweep too: it was generated from the
  discovery before anything was built. If nothing is missing, say so in one line in the Step 6 summary.
- **Non-functional requirements this requirement proves**: every row of `prd/nfr.md` with
  `Verification: test` and `Tested in: #{id}` becomes a local criterion (`{id}-AC-NN`: «Meets
  NFR-xx: {requirement} — {target}», written in the product language, with how it is measured). If the requirement changes what an NFR
  measures, ask whether its target still holds.
- **Parameters**: rows that change, with value and variable.
- **Decisions**: every existing decision whose `Affects` touches the request (`keeps`, with how, or
  `reverts` with its reason — a reversion is always the user's explicit choice), and every new choice
  with a real alternative (`new`, with what was rejected and the reason; `next-id DEC` / `DEC-T`). The
  reason is the user's words; one you drafted and the user only accepted ends with ` (proposed)` (`(propuesto)` in Spanish).
  Contradicting a decision whose reason is `(proposed)` or `Not given by the user` (`No lo dio el usuario`), say so: the user
  accepted it but did not argue it.
- **Technical detail**: only the subsections that change — Data (entities, attributes, states),
  Invariants and guarantees (a new invariant needs its guarantee), Schema (following
  [Database](.claude/specs/database.md)), Interface (operations or subjects at the functional level;
  whether it breaks an external integrator), Flows, Glossary, Architecture (modules, integrations,
  credentials). A new entity, module, service or integration: ask, never assume.
- Engineering defaults the scope triggers (for example, rate limiting on a new authentication
  endpoint) enter as parameters and failure conditions without asking: they are jiku flow's rules. Name
  them in the Step 6 summary. The Input defaults of Engineering (text lengths, trimming, number
  ranges, email case, `validation_failed`, `forbidden`, `not_found`, `invalid_state`) and the outbound address guard
  do not enter the specification: they go to the contract at implementation. Ask only when the
  business needs another bound, which then becomes a restriction with its failure condition.

- **Visual reference** («Referencia visual») — when the request comes with a design the product must look like (a
  design package, screens, a prototype), as the Requirement Spec says: the path of the package in the
  repo (ask where it is if it is not there), one row per screen of the reference with its route and
  state, and the closed list of «Decided difference» rows (every answer of Step 3 that departs from the
  reference, every rule of the definition the design contradicts). Then the local criterion of
  fidelity. Look at every screen of the reference yourself while you write it: what the design shows
  is the scope; a vague «follows the structure» is not a criterion.

Save and check as in Step 3, without asking to confirm the part.

---

### Step 5: Acceptance Criteria

Review the criteria table: every requirement, failure condition, invariant and guarantee the change
adds or modifies is there; local `{id}-AC-NN` (`jflow.py next-id {id}-AC`) only for what is not
product definition. Each one says what must be observable. A criterion that cannot be tested is
rewritten or removed — tell the user.

Save and check, without asking to confirm the part.

---

### Step 6: Review and Write to Jiku

```bash
python3 .claude/scripts/jflow.py spec check {id} --source draft
python3 .claude/scripts/jflow.py spec push {id}
```

No observations allowed: `S10` (an ID cited that does not exist, that this specification does not add
and that no dependency adds) means either a missing dependency in «Depends on» or a citation of
something later, which goes out. `S11`/`S12`: write the criterion with the text of its row. `S13` and
`S16` are the user's: ask with `AskUserQuestion` — revert the decision that states the old value (or
modify the row), or keep the parameter; record the decision that brings the item in from out of
scope, with its reason, or leave it out.

Before pushing, the requirements that depend on this one:

```bash
python3 .claude/scripts/jflow.py spec order {id} --source draft
```

If a dependent «cites what this one changes or removes», show it to the user as a conflict: those
requirements were specified on what this one is changing. Ask whether to adjust them now (a
`/jflow-spec {x}` per dependent after this one, which you list in the final message) or leave them
as they are, knowing that `/jflow-build {x}` will stop if they no longer fit.

**The review — the only confirmation of the specification.** With the check clean and the dependents
seen, send the user to the draft and summarize in chat, in the user's language, what will be
written in Jiku:

```markdown
Read the draft of the specification of #{id}: [{absolute path}]({absolute path})

- Scope and proposal: {one line}
- Rules and decisions: {criteria it adds / modifies / removes, by ID; new or reverted decisions}
- Acceptance criteria: {n} ({IDs})
- Assumptions: {each assumption in one line, or "none"}
- Engineering defaults that came in: {which, or "none"}
- Out of scope, to record in Jiku: {agreed requirements or comments, or "nothing"}
- Depended on by, to review: {#ids, or "none"}

When it is written, the requirement's description says «Specification: ready».
```

Then ask with `AskUserQuestion`, in the user's language: «Review the draft: scope and proposal, rules
and decisions, criteria. Shall I write it to Jiku?», options "Write" / "I want changes" (the user says
what and in which part). On changes: edit the draft, run the check again, and repeat the review with the parts
that changed. Then push.

`spec push` first reads Jiku: if the specification changed there since the draft started (someone
edited it), it refuses and names the fields — show the user, bring those changes into the draft, and
push again. Then it writes the three fields (it never changes the state), sets the line «Specification: ready
({date})» («Especificación: lista») in the requirement's description, in the product language — a
draft from the initial plan said «draft» («borrador»);
`/jflow-build` does not start without it — and deletes the draft. If the write
fails, report it with the command to retry; the draft stays.

The final message, in the user's language:

```markdown
## Specification ready — #{id} {title}

In Jiku: scope, proposal and criteria.
- Scope: {one line}
- Criteria: {n} ({short list of IDs})
- Decisions: {new / reverted, or "keeps the existing ones"}
- Depends on: {#ids or "nothing"}{, of which not merged: #x}
- Depended on by: {#ids, and the ones to review: `/jflow-spec {x}`; or "none"}
- Recorded out of scope: {#ids with their title, or "nothing"}

### Next step
Once approved in Jiku (En cola) and its dependencies are merged in `dev`: `/jflow-build {id}`.
```

## Output

- Jiku: the requirement's scope, proposal and acceptance criteria; state Desarrollo if it was reopened
- Nothing in the repository
