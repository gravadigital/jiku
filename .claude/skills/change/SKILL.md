---
name: change
description: Apply a bug fix or a small change directly, as a task of an existing Jiku requirement - only if it touches nothing documented; plans, implements, tests and verifies it in its own branch
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, Agent, WebSearch, WebFetch, AskUserQuestion"
argument-hint: "[jiku-requirement-id] [qué cambiar]"
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
Step 1: Is it small? (mechanical rule) → if not, point to /req-specify
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

Anything bigger is `/req-specify {id}` + `/req-implement {id}`.

## References

**Read [Engineering](.claude/specs/engineering.md)** — testing, git and the defaults the change meets.

**Read [Product Definition](.claude/specs/product-definition.md)** — what counts as documented.

**Read [Jiku](.claude/specs/jiku.md)** — the task, the state and the comment.

## Pre-loaded Context

### Working Tree

!`git status --porcelain 2>/dev/null | head -5; git rev-parse --abbrev-ref HEAD 2>/dev/null`

## CRITICAL RULES

1. **Use Spanish** for messages, test names, commits and Jiku; English for code and `AGENTS.md`
2. **Small means it changes nothing documented** - It does NOT add or modify any requirement, failure
   condition, invariant, guarantee, decision, parameter, NFR, entity attribute or state, table or
   column, contract operation (path, fields, codes, permissions) or flow. A bug fix makes the code
   match the definition and is small. A bug the definition does not cover adds a rule: it is not small.
   When in doubt, ask — never decide it is small to avoid a specification
3. **A bug is reproduced before it is fixed** - First a test that fails because of the bug, then the fix
4. **Tag tests with what they prove** - The definition ID whose behavior the change restores
   (`[CAN-E1] …`); when no ID applies, a local tag from `grava.py next-id {id}-AC`
5. **Done means verified** - `make check` green, the change's tests passing, `def-check` clean, the
   verifier's APROBADO
6. **Never touch `_gflow/`** - If the change needs it, it is not small
7. **Deterministic work through `grava.py`** - `git-check`, `jiku fetch`, `jiku state`, `branch`,
   `jiku task`, `next-id`, `evidence`, `jiku comment`

## Execution

### Step 0: Check

`$ARGUMENTS` = `{id} {qué cambiar}`. Without the id, ask which Jiku requirement the change belongs to
(an incidencia, or the functionality it improves). Without the description, ask for it.

```bash
python3 .claude/scripts/grava.py git-check --mode implement
python3 .claude/scripts/grava.py jiku fetch {id}
```

`git-check`: `OK` continue; `BEHIND`, `DIRTY`, `NO_DEV` stop and say what to do; `OTHER_BRANCH`,
`NO_REMOTE` warn and ask whether to continue.

State of the requirement: `desarrollo` continue; `cancelado` stop; any other — suggest moving it to
Desarrollo and, if the user confirms, `grava.py jiku state {id} desarrollo` (the change will be done
now). If the user does not want to move it, continue without moving it.

Read the copy and find what the change touches: search the code, and load the definition around it:

```bash
python3 .claude/scripts/grava.py load --id {ID relacionado}   # or --block / --entity / --module
```

---

### Step 1: Is It Small?

Apply CRITICAL RULE 2 against what you loaded. Decide one of:

- **Bug**: the definition says X, the product does Y. Small.
- **Small improvement**: no documented element changes (internal refactor, performance, a log line,
  wording the definition does not fix, a dependency upgrade). Small.
- **Not small**: it changes a documented element, or adds one — say exactly which.
- **Unsure**: ask with `AskUserQuestion`, explaining the doubt.

If not small:

```markdown
Este cambio no es chico: {modifica / agrega} {elemento, con su ID}. Necesita una especificación para
que la decisión quede registrada.

Siguiente paso: `/req-specify {id}` (o un requisito nuevo en Jiku si no pertenece a #{id}).
```

Stop. Never create the new requirement yourself: the change is the user's request, and its scope is
theirs to decide. (What you see out of scope while working — below — is different: you record it.)

---

### Step 2: Start

With a short English slug for the change:

```bash
python3 .claude/scripts/grava.py branch {id} {slug} --kind fix
python3 .claude/scripts/grava.py jiku task {id} --title "{título de la tarea}" --description "{qué se cambia}"
```

---

### Step 3: Implement

- **Bug:** write a test that reproduces it, tagged with the definition ID it violates, and see it
  fail. Fix the code. See it pass.
- **Improvement:** write or adjust the test that proves the change (local tag if no ID applies), then
  the code.

Keep the change minimal. Follow the service's `AGENTS.md` and its canonical examples. The same bug
elsewhere (sibling messages, another operation with the same mistake) is out of scope unless the
user asked for it: record it with `grava.py out-of-scope {id} --skill change` as the
[Jiku spec](.claude/specs/jiku.md) says (What Is Seen Out of Scope), like anything else you see that
the product must not lose, also when you stop. If you learn
something an agent should not repeat, add one line to the service's "Recurring errors".

```bash
make check
python3 .claude/scripts/grava.py evidence --ids {IDs probados, separados por coma}
python3 .claude/scripts/grava.py def-check
```

Commit: `fix({servicio}): {qué} (#{id})`.

---

### Step 4: Verify

Launch the [verifier](.claude/agents/verifier.md) subagent (`subagent_type: verifier`) with:

```
Requisito: #{id} — cambio directo: {descripción}
Sin especificación. IDs que el cambio tiene que probar: {IDs}
Rama: fix/{id}-{slug} (base: dev)
Verificá además que el cambio no modifica nada documentado.
```

- Every round, approved or not, record its «Fuera de alcance» items (`grava.py out-of-scope`).
- **RECHAZADO** → fix every finding, prove it again, and launch a new verifier with the previous
  findings. **Stop** when a finding survives a fix twice, or after five rounds: do not push nor comment
  as done; report honestly what is still open.

---

### Step 5: Close

Push the branch if there is a remote. Write the MR/PR description to `mr-{id}-{slug}.md` in the working
folder (`grava.py workdir`): what changed and why (the bug, with its ID), the evidence table from
Step 3, the verifier's verdict, and what was recorded out of scope (`grava.py out-of-scope {id} --list`). Write the Jiku comment (business terms: what was wrong, what the
product does now) and send it:

```bash
python3 .claude/scripts/grava.py jiku comment {id} --file $(python3 .claude/scripts/grava.py workdir)/jiku-comment-{id}.md
```

```markdown
## Cambio listo — #{id}: {descripción}

Rama: `fix/{id}-{slug}` {{pusheada / sin remoto}}
Probado y verificado.
{{Si registró algo fuera del alcance: "Fuera de alcance, registrado: #{n} {título}; …"}}
{{Si es una incidencia: "Al cerrarla en Jiku, el tipo de resolución sugerido es {error_interno |
error_externo | …}: {por qué}."}}
```

## Output

- Code and tests on `fix/{id}-{slug}`, pushed
- `mr-{id}-{slug}.md` in the working folder — the MR/PR description
- Jiku: a task under requirement `{id}`, and an internal comment
