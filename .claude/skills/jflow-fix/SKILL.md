---
name: jflow-fix
description: Apply a bug fix or a small change directly, as a task of an existing Jiku requirement - only if it touches nothing documented; plans, implements, tests and verifies it in its own branch
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, Agent, WebSearch, WebFetch, AskUserQuestion"
argument-hint: "[jiku-requirement-id] [what to change]"
---

# Direct Change

## Purpose

The fast path for what does not need a specification: a bug (the product does not do what the
definition says) or a small improvement that adds no behavior and changes nothing documented. The
user says what to change; the agent checks that it really is small, then plans, implements, tests and
verifies it, as a task of the Jiku requirement it belongs to.

**Flow:**

```
Step 0: Check git and the requirement's state
  |
Step 1: Is it small? (mechanical rule) → if not, point to /jflow-spec
  |
Step 2: Start: branch fix/{id}-{slug} + Jiku task
  |
Step 3: Reproduce (bug) or specify the test (improvement) → fix → prove
  |
Step 4: Verify (verifier subagent) → fix until approved
  |
Step 5: Close: push, MR/PR text, Jiku comment
```

**Result:** Branch `fix/{id}-{slug}` with the change and its tests, verified and pushed; a Jiku task
under the requirement and an internal comment; the MR/PR text.

**This command does NOT:**

- Change the product definition, a contract, the schema or a decision — that needs a specification
- Add functionality
- Open, approve or merge the MR/PR

Anything bigger is `/jflow-spec {id}` + `/jflow-build {id}`.

## References

**Read [Engineering](.claude/specs/engineering.md)** — testing, git and the defaults the change meets.

**Read [Product Definition](.claude/specs/product-definition.md)** — what counts as documented.

**Read [Jiku](.claude/specs/jiku.md)** — the task, the state and the comment.

## Pre-loaded Context

### Working Tree

!`git status --porcelain 2>/dev/null | head -5; git rev-parse --abbrev-ref HEAD 2>/dev/null`

## CRITICAL RULES

1. **Language** - Talk to the user in the language they write in (the product language until they write in their own words; with no project yet, the language of the request). Everything written to Jiku (the
   task, the comment, the incidencia) in the product language (`language` in `_jflow/project.yaml`,
   Spanish when unset). Commits, the MR/PR text, branch names and test names always in English; code,
   identifiers and `AGENTS.md` in English. See [Language](.claude/specs/language.md)
2. **Small means it changes nothing documented** - It does NOT add or modify any requirement, failure
   condition, invariant, guarantee, decision, parameter, NFR, entity attribute or state, table or
   column, contract operation (path, fields, codes, permissions) or flow. A bug fix makes the code
   match the definition and is small. A bug the definition does not cover adds a rule: it is not small.
   When in doubt, ask — never decide it is small to avoid a specification
3. **A bug is reproduced before it is fixed** - First a test that fails because of the bug, then the fix
4. **Tag tests with what they prove** - The definition ID whose behavior the change restores
   (`[CAN-E1] …`); when no ID applies, a local tag from `jflow.py next-id {id}-AC`
5. **Done means verified** - `make check` green, the change's tests passing, the end-to-end tests of
   the entries it touches passing against `make up`, `def-check` clean, the verifier's APPROVED
6. **Never touch `_jflow/`** - If the change needs it, it is not small
7. **Deterministic work through `jflow.py`** - `git-check`, `jiku fetch`, `jiku state`, `branch`,
   `jiku task`, `next-id`, `evidence`, `jiku comment`

## Execution

### Step 0: Check

`$ARGUMENTS` = `{id} {what to change}`. Without the id, ask which Jiku requirement the change belongs to
(an incidencia, or the functionality it improves). Without the description, ask for it.

```bash
python3 .claude/scripts/jflow.py git-check --mode implement
python3 .claude/scripts/jflow.py jiku fetch {id}
```

`git-check`: `OK` continue; `BEHIND`, `DIRTY`, `NO_DEV` stop and say what to do; `OTHER_BRANCH`,
`NO_REMOTE` warn and ask whether to continue.

State of the requirement: `desarrollo` continue; `cancelado` stop; any other — suggest moving it to
Desarrollo and, if the user confirms, `jflow.py jiku state {id} desarrollo` (the change will be done
now). If the user does not want to move it, continue without moving it.

Read the copy and find what the change touches: search the code, and load the definition around it:

```bash
python3 .claude/scripts/jflow.py load --id {related ID}   # or --block / --entity / --module
```

---

### Step 1: Is It Small?

Apply CRITICAL RULE 2 against what you loaded. Decide one of:

- **Bug**: the definition says X, the product does Y. Small.
- **Small improvement**: no documented element changes (internal refactor, performance, a log line,
  wording the definition does not fix, a dependency upgrade). Small.
- **Not small**: it changes a documented element, or adds one — say exactly which.
- **Unsure**: ask with `AskUserQuestion`, explaining the doubt.

If not small, tell the user, in their language:

```markdown
This change is not small: it {modifies / adds} {element, with its ID}. It needs a specification so
the decision is recorded.

Next step: `/jflow-spec {id}` (or a new requirement in Jiku if it does not belong to #{id}).
```

Stop. Never create the new requirement yourself: the change is the user's request, and its scope is
theirs to decide. (What you see out of scope while working — below — is different: you record it.)

---

### Step 2: Start

With a short English slug for the change, and the task's title and description in the product
language:

```bash
python3 .claude/scripts/jflow.py branch {id} {slug} --kind fix
python3 .claude/scripts/jflow.py jiku task {id} --title "{task title}" --description "{what changes}"
```

---

### Step 3: Implement

- **Bug:** write a test that reproduces it, tagged with the definition ID it violates, and see it
  fail. Fix the code. See it pass.
- **Improvement:** write or adjust the test that proves the change (local tag if no ID applies), then
  the code.

Keep the change minimal. Follow the service's `AGENTS.md` and its canonical examples. Something else
already built that is wrong according to the definition is a **correction on the way** when all four
conditions of `/jflow-build` Rule 2 hold (in what this change already touches, brings the product to
the definition with no new behavior and no decision, no other service and no stored data, small) and
it does not need `_jflow/` (Rule 6): fix it with its test and list it in
`$(jflow.py workdir)/corrected-{id}.md` (`- {ID}: {what was wrong and what was fixed}`, in English), for the MR,
the comment and the verifier. Anything else you see that the product must not lose — the same bug in
another operation, another service — is out of scope: collect it and record it at close (also when
you stop) as the [Jiku spec](.claude/specs/jiku.md) says (What Is Seen Out of Scope): one incidencia
for all of it, in the product language (`jflow.py out-of-scope {id} --skill jflow-fix --type incidencia
--title "{Seen in #{id}: summary}" --file {list}`), each security risk apart. If you learn
something an agent should not repeat, add one line to the service's "Recurring errors".

```bash
make check
python3 .claude/scripts/jflow.py evidence --ids {IDs proven, comma-separated}
python3 .claude/scripts/jflow.py def-check
```

Then end to end, as `_jflow/prd/architecture/testing.md` says, for the entries the change touches (the
surfaces and interfaces of the services you changed): `make up`, `make test-e2e S={service}`,
`make down`. A bug that only shows through the real entry (the broker's authentication, a browser) is
reproduced by an end-to-end test. If a touched entry's end-to-end test cannot run, stop and report it:
never close the change without it.

Commit: `fix({service}): {what} (#{id})`.

---

### Step 4: Verify

Launch the [jflow-verifier-agent](.claude/agents/jflow-verifier-agent.md) subagent (`subagent_type: jflow-verifier-agent`) with:

```
Requirement: #{id} — direct change: {description}
No specification. IDs the change must prove: {IDs}
Branch: fix/{id}-{slug} (base: dev)
Also verify that the change modifies nothing documented.
```

- Every round, approved or not, add its «Out of scope» items to the list you record at close.
- **REJECTED** → fix every finding, prove it again, and launch a new verifier with the previous
  findings. Fix the cause, not the instance: when a finding names one place of a kind (a missing case, a list
  that misses an item), find every place of that kind with the method the verifier used, and fix them all.
  **Stop** when a finding survives three fixes, or after eight rounds: do not push nor comment
  as done; report honestly what is still open.

---

### Step 5: Close

Push the branch if there is a remote. Write the MR/PR description, in English, to `mr-{id}-{slug}.md`
in the working folder (`jflow.py workdir`): what changed and why (the bug, with its ID), the evidence table from
Step 3, what was corrected on the way (`corrected-{id}.md`), the verifier's verdict, and what was
recorded out of scope (`jflow.py out-of-scope {id} --list`). Write the Jiku comment in the product language (business terms: what was
wrong, what the product does now) and send it:

```bash
python3 .claude/scripts/jflow.py jiku comment {id} --file $(python3 .claude/scripts/jflow.py workdir)/jiku-comment-{id}.md
```

The final message, in the user's language:

```markdown
## Change ready — #{id}: {description}

Branch: `fix/{id}-{slug}` {{pushed / no remote}}
Tested and verified.
{{If it recorded something out of scope: "Out of scope, recorded: #{n} {title}; …"}}
{{If it is an incidencia: "When closing it in Jiku, the suggested resolution type is {error_interno |
error_externo | …}: {why}."}}
```

## Output

- Code and tests on `fix/{id}-{slug}`, pushed
- `mr-{id}-{slug}.md` in the working folder — the MR/PR description
- Jiku: a task under requirement `{id}`, and an internal comment
