---
name: req-specify
description: Specify a Jiku requirement with the user - challenge it against the product definition and the pending requirements, decide scope, proposal, rules, decisions and acceptance criteria, and write the specification to Jiku
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
argument-hint: "[jiku-requirement-id] [lo que querés agregar o cambiar]"
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
Step 6: Check and write to Jiku
```

**Result:** The requirement in Jiku with its scope, proposal (with technical detail) and acceptance
criteria, in the format of the Requirement Spec. A reopened requirement is back in Desarrollo.

**This command does NOT:**

- Touch the repository: no commits, no branches, no edits under `_gflow/` (it only reads it)
- Write code, choose libraries or design endpoints beyond what the user fixes
- Approve or prioritize the requirement (people do, in Jiku)

The implementation is `/req-implement {id}`. A bug or a small change that touches nothing documented
is `/change {id}`.

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

!`ls _gflow/prd/ 2>/dev/null | head -3 || echo "NO_PRD_FOUND"`

## CRITICAL RULES

1. **Use Spanish** with the user and in everything written to Jiku; identifiers in English
2. **The repository is read-only here** - Only `git fetch` and reads. The draft lives in the system's
   temp folder (`grava.py spec draft`)
3. **The user decides every rule** - Never fill a gap, pick an alternative or resolve a conflict
   yourself. Propose, with your recommendation first, and ask with `AskUserQuestion`
4. **What is written is input, not truth** - Scope, proposal and criteria already in the requirement,
   and what the client wrote, are contrasted like any request. Every disagreement is shown as a
   conflict: what it says, what you propose, why. The user decides
5. **No code-level detail** - Functional plus the key technical detail (data, interface, flows,
   architecture). Never files, functions or test names: the client may read it
6. **Save first, then validate** - Write each part to the draft, run `grava.py spec check`, then confirm
   it with the user. Do NOT dump the draft in chat: point to the file and summarize
7. **Deterministic work through `grava.py`** - `jiku fetch`, `spec order`, `spec draft`, `next-id`,
   `load`, `spec check`, `spec push`, `jiku state`. Never pick an ID by hand

## Execution

### Step 0: Check and Load

**0.1 Arguments** — `$ARGUMENTS` = `{id} [texto libre]`. The id is a Jiku requirement number; the rest
is the user's own addition or change to the request. Without an id, ask for it.

**0.2 The requirement**

```bash
python3 .claude/scripts/grava.py jiku fetch {id}
```

Read the copy it prints fully: description, **every comment**, attachments (if one is needed and you
cannot read it, ask the user for its content), and the scope, proposal and criteria if it already has
them. If Jiku does not answer, stop: the specification lives there.

**0.3 State** — from the copy:

| State | Action |
|---|---|
| `planificacion` | Continue |
| `analisis`, `en_cola`, `desarrollo` | Warn what it means (not marked to specify / approved and waiting / being implemented) and ask whether to continue; the user is responsible |
| `revision`, `resuelto` | Warn that it is already merged and will be **reopened**. If the user confirms: `grava.py jiku state {id} desarrollo` and continue |
| `cancelado` | Stop |

If the type is `incidencia` or the request is a small change that touches nothing documented, say so
and suggest `/change {id}`; continue only if the user wants a specification.

**0.3b Order** — if the requirement already has a scope:

```bash
python3 .claude/scripts/grava.py spec order {id}
```

- `PENDING #{x}` → tell the user, without asking: «#{id} depende de #{x}, que todavía no está en `dev`.
  Se puede especificar igual: la especificación se apoya en lo que dice #{x}, y si #{x} cambia puede
  haber que revisarla. Se va a poder implementar recién cuando #{x} esté mergeado.» Continue.
- `CANCELLED #{x}` → a conflict (Rule 4): #{id} builds on something that will not be built. Propose
  removing the dependency or bringing here what is needed, and let the user decide.
- «Dependen de este» → keep the list: Step 6 checks them again against what this specification
  changes.

**0.4 Draft**

```bash
python3 .claude/scripts/grava.py spec draft {id}
```

- "retomo el borrador" → read it and resume at the first part not confirmed (tell the user in one line).
- "borrador nuevo (con lo que ya tiene el requisito en Jiku)" → it starts from what is written; Step 2
  will contrast it. If its criteria end with «Decidido en la implementación: …», those criteria were
  decided by `/req-implement`, not by the user: show them in Step 5 and ask whether to keep each one or
  change it (a change is a `modifica`).
- "borrador nuevo (vacío)" → tell the user: «Empiezo la especificación de #{id} desde el principio. Si
  tenías una sesión anterior sin terminar, su borrador se perdió (por ejemplo, por un reinicio) y hay
  que hacerla de nuevo.»

---

### Step 1: Locate

```bash
python3 .claude/scripts/grava.py git-check --mode read
python3 .claude/scripts/grava.py load --overview
```

If `git-check` reports `BEHIND`, tell the user the local definition may be old and suggest pulling `dev`
first. Then load what the request touches:

```bash
python3 .claude/scripts/grava.py load --block {PRE} [--block …] [--entity …] [--id …]
python3 .claude/scripts/grava.py jiku list planificacion,en_cola,desarrollo
```

- Always read `_gflow/prd/out-of-scope.md`.
- Something not built yet (not in the definition) may be in the discovery (`_gflow/discovery/`) and in
  an open requirement of the plan: find which one (`grava.py jiku fetch {other}` for its criteria).
- For anything that changes what a service exposes, read the operations of `_gflow/apis/` the loader
  lists and `_gflow/prd/architecture/integration.md` (external integrators consume contracts).

---

### Step 2: Analyze

Write down, for yourself, every finding:

| Kind | Example |
|---|---|
| **Contradicts** a requirement, failure condition, invariant or decision | "Cancelar hasta 1 hora después del inicio" vs CAN-E1 and the no-show window |
| **Overlaps** something built, or an **open requirement** that adds it | It is already CAN-02; or #41 (not built yet) adds the block it changes |
| **Out of scope** of the product | "Pagos y señas" is in out-of-scope.md |
| **Breaks a contract** an external integrator uses | Changing an operation listed under an INT |
| **Needs a decision** with a real alternative | A new channel, a provider, sync vs async |
| **Gaps** the request leaves open | Who can do it, what happens on failure, limits |
| **Hidden scope** | A new entity, a new state, a migration of existing data |
| **Disagrees with what is written** in the requirement's own fields | A criterion that cannot be tested, a rule that contradicts the definition |

A change to something an open requirement adds (not built yet) cannot modify the definition: ask
whether to fold it into that requirement (specify that one instead) or wait until it is merged.

Tell the user, briefly, what you found (one line each) before asking.

---

### Step 3: Scope and Proposal

Write **Alcance** (Incluye, No incluye, Depende de) and the summary of **Propuesta** in the draft. Ask
with `AskUserQuestion` about every finding of kind "contradicts", "overlaps", "out of scope", "breaks
a contract", "disagrees" and every scope gap — concrete options, your recommendation first. Update the
draft with each answer.

What the user leaves for later goes to «No incluye» with the requirement that will do it (`#id`;
`S17` checks it). If an open requirement covers it, offer to leave it a comment there; if none does,
offer to create one. Ask before writing, then use `grava.py out-of-scope {id} --skill req-specify`
(`--to N` for the comment, `--type funcionalidad|mejora` for a new one) and cite the `#id` it
prints. A bug or risk you notice in what is built, outside this requirement, is offered the same
way, as an `incidencia` ([Jiku spec](.claude/specs/jiku.md), What Is Seen Out of Scope).

Save, `grava.py spec check {id} --source draft` (ignore observations about parts not written yet), and
confirm the part («¿Cerramos alcance y propuesta?», "Cerrar" / "Quiero cambios"), listing your
assumptions in the question.

---

### Step 4: Rules, Failures, Decisions and Technical Detail

In the draft:

- **Criteria rows for every rule that changes** — `agrega` with a new ID (`grava.py next-id {PRE}
  --requirement {id}`, `next-id {PRE}-E …`), `modifica` with the full new text, `elimina`. A failure
  condition is `condición → resultado`.
- Walk the **failure checklist** of the Discovery spec for every new user-facing behavior, with the
  user: concurrency, limits, time passing, state changed, external failure, permission, dependents,
  what the actor sees on each failure, what resets when a temporary state ends.
- **Sweep for what would stop the implementation.** `/req-implement` decides only small things
  (texts, order, presentation, internal technical values, deployment configuration, requests with no
  effect) and stops at anything large (its Rule 2). So, against the definition as it is now (it
  includes what earlier requirements built), check that the specification fixes, for everything it
  adds or changes: business rules and limits with their values; the effect on what is in progress
  and between operations (what happens to the reservations, loans, deliveries already there);
  security, sessions and permissions; what each stored value means and how it is kept; time (time
  zones, day boundaries, adjacent ranges, clocks); concurrency; the platform (no connection on a
  `mobile-app` surface). Ask what is missing, grouped, each with your recommendation. A requirement
  that comes as a draft from the initial plan goes through this sweep too: it was generated from the
  discovery before anything was built. If nothing is missing, say so in one line inside the part's
  confirmation.
- **Non-functional requirements this requirement proves**: every row of `prd/nfr.md` with
  `Verificación: prueba` and `Prueba en: #{id}` becomes a local criterion (`{id}-AC-NN`: «Cumple
  NFR-xx: {requisito} — {target}», with how it is measured). If the requirement changes what an NFR
  measures, ask whether its target still holds.
- **Parámetros**: rows that change, with value and variable.
- **Decisiones**: every existing decision whose `Afecta` touches the request (`respeta`, with how, or
  `revierte` with motivo — a reversion is always the user's explicit choice), and every new choice with
  a real alternative (`nueva`, with what was discarded and the motivo; `next-id DEC` / `DEC-T`). The
  motivo is the user's words; one you drafted and the user only accepted ends with ` (propuesto)`.
  Contradicting a decision whose motivo is `(propuesto)` or `No lo dio el usuario`, say so: the user
  accepted it but did not argue it.
- **Detalle técnico**: only the subsections that change — Datos (entities, attributes, states),
  Invariantes y garantías (a new invariant needs its guarantee), Esquema (following
  [Database](.claude/specs/database.md)), Interfaz (operations or subjects at the functional level;
  whether it breaks an external integrator), Flujos, Glosario, Arquitectura (modules, integrations,
  credentials). A new entity, module, service or integration: ask, never assume.
- Engineering defaults the scope triggers (for example, rate limiting on a new authentication
  endpoint) enter as parameters and failure conditions without asking: they are grava's rules. Name
  them when you confirm the part. The Input defaults of Engineering (text lengths, trimming, number
  ranges, email case, `validation_failed`, `forbidden`, `not_found`, `invalid_state`) and the outbound address guard
  do not enter the specification: they go to the contract at implementation. Ask only when the
  business needs another bound, which then becomes a restriction with its failure condition.

Save, check, confirm the part as in Step 3.

---

### Step 5: Acceptance Criteria

Review the criteria table: every requirement, failure condition, invariant and guarantee the change
adds or modifies is there; local `{id}-AC-NN` (`grava.py next-id {id}-AC`) only for what is not
product definition. Each one says what must be observable. A criterion that cannot be tested is
rewritten or removed — tell the user.

Save, check, confirm the criteria with the user.

---

### Step 6: Write to Jiku

```bash
python3 .claude/scripts/grava.py spec check {id} --source draft
python3 .claude/scripts/grava.py spec push {id}
```

No observations allowed: `S10` (an ID cited that does not exist, that this specification does not add
and that no dependency adds) means either a missing dependency in «Depende de» or a citation of
something later, which goes out. `S11`/`S12`: write the criterion with the text of its row. `S13` and
`S16` are the user's: ask with `AskUserQuestion` — revert the decision that states the old value (or
modify the row), or keep the parameter; record the decision that brings the item in from out of
scope, with its motivo, or leave it out.

Before pushing, the requirements that depend on this one:

```bash
python3 .claude/scripts/grava.py spec order {id} --source draft
```

If a dependent «cita lo que este cambia o elimina», show it to the user as a conflict: those
requirements were specified on what this one is changing. Ask whether to adjust them now (a
`/req-specify {x}` per dependent after this one, which you list in the final message) or leave them
as they are, knowing that `/req-implement {x}` will stop if they no longer fit.

Before writing, show what will be written in Jiku and get the user's approval (`AskUserQuestion`,
"Escribir" / "Quiero cambios"): the specification of #{id} (scope in one line, criteria by ID,
decisions), the line «Especificación: lista», and each requirement or comment agreed for what is left
out of scope. Then push.

`spec push` first reads Jiku: if the specification changed there since the draft started (someone
edited it), it refuses and names the fields — show the user, bring those changes into the draft, and
push again. Then it writes the three fields (it never changes the state), sets the line «Especificación:
lista ({fecha})» in the requirement's description — a draft from the initial plan said «borrador»;
`/req-implement` does not start without it — and deletes the draft. If the write
fails, report it with the command to retry; the draft stays.

```markdown
## Especificación lista — #{id} {título}

En Jiku: alcance, propuesta y criterios.
- Alcance: {una línea}
- Criterios: {n} ({lista corta de IDs})
- Decisiones: {nuevas / revertidas, o "respeta las existentes"}
- Depende de: {#ids o "nada"}{, de los cuales sin mergear: #x}
- Dependen de este: {#ids, y los que hay que revisar: `/req-specify {x}`; o "ninguno"}
- Registrado fuera del alcance: {#ids con su título, o "nada"}

### Siguiente paso
Cuando esté aprobado en Jiku (En cola) y sus dependencias estén mergeadas en `dev`: `/req-implement {id}`.
```

## Output

- Jiku: the requirement's scope, proposal and acceptance criteria; state Desarrollo if it was reopened
- Nothing in the repository
