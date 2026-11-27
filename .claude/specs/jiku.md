# Jiku

How the workflow reads and writes Jiku, Grava's project and client management system. Jiku owns the
requirement and its specification: who asked, priority, state, visibility to the client, hours, and
the three fields that specify it (see [Requirement Spec](requirement.md)). The repository owns the
product. Read this before any step that touches a Jiku requirement.

## CRITICAL RULES

1. **Only through `jflow.py`.** Never call the `jiku` CLI directly from a skill: the script picks the
   instance's configuration, builds the payloads, sets `JIKU_VIA=agent`, honors dry-run and records
   what it sent.
2. **The person's identity.** The CLI runs with the token of the person at the keyboard (`jiku login`).
   Everything the agent writes is written in their name, marked as done by an agent.
3. **The agent records facts, never judgments.** It moves a requirement to Desarrollo when it creates
   its branch (or when the user confirms reopening it). Approval, priority, merge, deploy and
   "estable" are people's: the agent never sets En cola, Revisión, Resuelto or Cancelado.
4. **No development detail in Jiku.** What the agent writes is functional plus the key technical
   detail (data, interface, flows, architecture), never code: no files, functions or test names. The
   client may read it, so it is written in the product language ([Language](language.md)); its
   structural words (labels, headings, fixed values) in Spanish when the product language is Spanish
   and in English otherwise.
5. **Comments are internal.** Every comment the agent writes is `internal`.
6. **If Jiku is unreachable, say so.** Reads that a step needs (the specification, the reserved IDs)
   stop the step. A failed write is reported with the exact command to retry, never retried in a loop.

## Configuration

`_jflow/project.yaml`, committed in the repo:

```yaml
language: es              # product language (Language spec); Spanish when unset
jiku:
  project_id: 59          # the Jiku project of this repository
  instance: prod          # dev | prod
  writes: true            # false = dry-run: print what would be sent, send nothing
git:
  platform: gitlab        # gitlab | github
  integration_branch: dev
  production_branch: main
```

- `instance` selects the CLI configuration file `~/.config/jiku/config.{instance}.yaml`, always passed
  explicitly with `--config`. The CLI flag `--instance` alone keeps the default servers and
  credentials, so it could reach another deployment: the script never relies on it, and stops when the
  instance's file does not exist.
- `JFLOW_JIKU_DRY_RUN=1` forces dry-run for one run, whatever the file says.
- In Jiku, the project stores the repository URL in its properties (`repositorio`); a person sets it.
- Creating the project in Jiku is a person's decision (client, team, hours). The workflow links to an
  existing project.

## Requirement ↔ repository

| Jiku | Repository |
|---|---|
| Requirement `812` | Branch `feat/812-{slug}` (`-2`, `-3`… when reopened) or `fix/812-{slug}`; `Origin: #812` in the definition; commits with `(#812)`; local criteria `[812-AC-01]` in tests |
| Its scope, proposal and criteria | The specification. Nothing about it is stored in the repository |
| Type `funcionalidad` / `mejora` | Specified with `/jflow-spec`, implemented with `/jflow-build` |
| Type `incidencia`, or a small `mejora` | `/jflow-fix`, as a task of the requirement |
| Task | One `/jflow-fix` |

## States

`analisis`, `planificacion`, `en_cola`, `desarrollo`, `revision`, `resuelto`, `cancelado`.

| State | Meaning in the workflow | Who moves it |
|---|---|---|
| Análisis | The request arrived | People |
| Planificación | To specify, or specified and waiting for approval | People; the plan's requirements are born here |
| En cola | Approved; waiting for priority | People |
| Desarrollo | Implementation, verification, MR/PR **and human review**, until the merge | The agent, when it creates the branch or reopens a requirement with the user's confirmation |
| Revisión | In production; making sure it works and is stable | People |
| Resuelto / Cancelado | Closed | People |

Each skill checks the state it expects at start and **warns and asks** in any other (the user is
responsible): `/jflow-spec` expects Planificación, `/jflow-build` En cola, `/jflow-fix` Desarrollo
(it offers to move it). A Cancelado requirement aborts.

## Commands

| When | Command | What it sends |
|---|---|---|
| Start of every skill that works on a requirement | `jflow.py jiku fetch {id}` | Reads the requirement with description, every comment, attachments, project and the specification fields; writes a copy to the working folder for the agent to read |
| `/jflow-spec`, `/jflow-product-scaffold` | `jflow.py spec draft {id}` / `spec push {id}` | The draft starts from what Jiku has; `push` sends `requirements.{id}.edit` with `scope`, `technicalSolution`, `acceptanceCriteria`, and then the description with its line «Specification: ready ({date})» (replacing «draft»). It never changes the state |
| End of `/jflow-build`, when it decided small things | `jflow.py spec amend {id}` | `requirements.{id}.edit` with `acceptanceCriteria` only: the criteria it decided appended, and the line «Decided in the implementation: …». Nothing else of the specification changes |
| Reserving IDs | `jflow.py next-id {KIND} --requirement {id}` | Reads the open requirements of the project (`requirements.list` with the three fields) |
| `/jflow-spec` reopening a requirement | `jflow.py jiku state {id} desarrollo` | `requirements.{id}.edit`: `state` |
| `/jflow-build` and `/jflow-fix` creating the branch | `jflow.py jiku state {id} desarrollo` | `requirements.{id}.edit`: `state` |
| End of `/jflow-build`, `/jflow-fix`, `/jflow-product-scaffold`, `/jflow-product-brownfield` | `jflow.py jiku comment {id} --file …` | `requirements.{id}.comment`, `internal`: what the product does now, the criteria met in business terms, the verification |
| Start of `/jflow-fix` | `jflow.py jiku task {id} --title …` | `tasks.new` with `requirementId`, `projectId`, area `desarrollo`, state `activo`, the person of the token as responsible |
| End of `/jflow-product-discover` | `jflow.py plan-push --product …` | `requirements.new` per part of the plan (and the base, «0 · Producto base» in Spanish, «0 · Base product» otherwise): type `funcionalidad`, state `planificacion`, visibility `public`, with the three fields as a draft and «Specification: draft» at the end of the description |
| `/jflow-product-brownfield` | `jflow.py jiku new --type … --state desarrollo` (the adoption requirement), `--state analisis` (security issues) | The adoption requirement (if none was given) and one `incidencia` per **security** bug; visibility `internal`. Every other bug, behavior to confirm or improvement goes to the adoption report (`docs/adopcion.md` in Spanish, `docs/adoption.md` otherwise), not to Jiku |
| What is seen out of scope (`/jflow-build`, `/jflow-fix`, `/jflow-product-scaffold`, `/jflow-spec`) | `jflow.py out-of-scope {id} --title … --description …` (or `--to N`) | `requirements.new`, state `analisis`, visibility `internal`, `Origin: #{id}` in the description; or `requirements.{N}.comment` |
| `/jflow-release` | `jflow.py jiku comment {id}` | That it is included in version X, in the product language, on each requirement released |

Everything written to Jiku is in the product language; the labels the scripts add (the
«Specification: …» line, `Origin: #N`) use its structure language. Every write prints the method and payload it sent (or would send, in dry-run) and appends it to the
log in the working folder.

## Before Writing

- **Read first.** Every write looks at what Jiku has before: `plan-push` matches the plan's parts with
  the open requirements by title and never creates one twice; `spec push` refuses if the specification
  changed in Jiku since its draft started (it keeps a fingerprint of what it read); the
  «Specification: …» line replaces only itself; what is seen out of scope is searched among the open
  requirements before creating; a state change checks the current state.
- **Interactive skills show and ask.** `/jflow-product-discover`, `/jflow-spec` and the specification step of
  `/jflow-product-scaffold` show what they are about to write (titles and actions: `plan-push --preview`;
  the specification and what is created out of scope) and write only on the user's approval.
- **Autonomous skills do not ask.** `/jflow-build`, `/jflow-fix` and the rest of `/jflow-product-scaffold`
  work on requirements that already exist: they read before writing and report everything they wrote
  at the end.

## Draft or Ready

The last line of a requirement's description says whether its specification can be built:
«Specification: draft» (written by `plan-push`: generated from the discovery, not reviewed against
what is built) or «Specification: ready ({date})» (written by `spec push`); in Spanish, «Especificación:
borrador» and «Especificación: lista ({fecha})» — the scripts read both. `/jflow-build` stops
on anything but «ready» (`spec check --implement`, `S18`); `/jflow-status` lists drafts apart. A requirement
created by hand has no line until it is specified.

## What Is Seen Out of Scope

While specifying, implementing, changing or verifying, an agent sees things that are not the
requirement's scope. What the product must not lose goes to Jiku, through
`jflow.py out-of-scope {id} …`, which creates it with visibility `internal`, state `analisis` and
`Origin: #{id} ({skill})` (`Origen:` in Spanish) in the description, and lists it for the MR and the Jiku comment
(`out-of-scope {id} --list`). Never fix it in the branch: that is scope creep. The one exception is
a **correction on the way** of `/jflow-build` and `/jflow-fix`: something already built that is wrong
according to the definition, in what the work already changes, small, with no new behavior, no
decision, no other service and no stored data. It is fixed with its test and listed in the MR and the
comment as fixed on the way, and the verifier checks each one.

| Kind | Example | Goes to Jiku as |
|---|---|---|
| 1. A bug in what is built: the product does not do what the definition says | Simultaneous bookings answer 500 in 5 of 15 runs; sibling messages with the same error a `/jflow-fix` fixed | `incidencia` |
| 2. An intermittent test | An e2e that times out now and then | `incidencia`: it is a bug or a bad test, and either one blocks CI some day |
| 3. A security risk | A destination an actor provides that can reach the internal network | `incidencia` |
| 4. Something postponed on purpose: agreed to be done in another requirement | Warning when deactivating an account with open loans; a test that moves to a later part | A comment on the requirement that will do it (`--to N`); if none does, a requirement (`--type funcionalidad` or `mejora`) |
| 5. The definition or the tests out of date, in something this requirement does not touch | A `covers` that no longer matches; an error case with no test; an interaction missing from `services.md` | `incidencia` (`--type otro` when nothing behaves wrong) |
| 6. A problem of jiku flow or the environment | A script that fails; a port in use | **Not to Jiku**: the final report, marked as such |
| 7. An opinion: a refactor, an idea, "it would be nice if" | — | **Not to Jiku**: the final report, if worth it; the user decides |

- **Before creating, search** the open requirements (`jflow.py jiku list`): if one already covers it,
  comment there (`--to N`) instead.
- **Each description says** what was seen, how to reproduce it when known, where (`archivo:línea`),
  and why it was not fixed here (out of scope). No code.
- **One incidencia per run.** `/jflow-build`, `/jflow-fix` and `/jflow-product-scaffold` collect what they
  see and, at close (also when they stop), record kinds 1, 2 and 5 as **one** incidencia,
  «Seen in #{id}: {summary}» (in the product language), with one line per item; each security risk (kind 3) apart; kind 4 as a
  comment on the requirement that will do it. An item an open requirement already covers goes there
  as a comment. **`/jflow-spec`**, with the user present, asks before creating. The verifier never
  writes to Jiku: it reports what is out of scope and the skill that launched it records them, even
  from a rejected round.
- `/jflow-status` shows open incidencias apart, with their origin; `/jflow-release` lists them before
  tagging.

## Failure

| Situation | Action |
|---|---|
| `jiku` not installed, not logged in, or the instance's config missing | Tell the user (`jiku --config ~/.config/jiku/config.{instance}.yaml login`, `jiku doctor`). Steps that need to read the specification stop |
| Requirement not found or not visible | Stop: the id is wrong or the person has no access |
| The requirement belongs to another project | Stop: it does not belong to this repository |
| A write is refused | Report the error and the command to retry; continue |
