# Jiku

How the workflow reads and writes Jiku, Grava's project and client management system. Jiku owns the
requirement and its specification: who asked, priority, state, visibility to the client, hours, and
the three fields that specify it (see [Requirement Spec](requirement.md)). The repository owns the
product. Read this before any step that touches a Jiku requirement.

## CRITICAL RULES

1. **Only through `grava.py`.** Never call the `jiku` CLI directly from a skill: the script picks the
   instance's configuration, builds the payloads, sets `JIKU_VIA=agent`, honors dry-run and records
   what it sent.
2. **The person's identity.** The CLI runs with the token of the person at the keyboard (`jiku login`).
   Everything the agent writes is written in their name, marked as done by an agent.
3. **The agent records facts, never judgments.** It moves a requirement to Desarrollo when it creates
   its branch (or when the user confirms reopening it). Approval, priority, merge, deploy and
   "estable" are people's: the agent never sets En cola, Revisión, Resuelto or Cancelado.
4. **No development detail in Jiku.** What the agent writes is functional plus the key technical
   detail (data, interface, flows, architecture), never code: no files, functions or test names. The
   client may read it.
5. **Comments are internal.** Every comment the agent writes is `internal`.
6. **If Jiku is unreachable, say so.** Reads that a step needs (the specification, the reserved IDs)
   stop the step. A failed write is reported with the exact command to retry, never retried in a loop.

## Configuration

`_gflow/project.yaml`, committed in the repo:

```yaml
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
- `GRAVA_JIKU_DRY_RUN=1` forces dry-run for one run, whatever the file says.
- In Jiku, the project stores the repository URL in its properties (`repositorio`); a person sets it.
- Creating the project in Jiku is a person's decision (client, team, hours). The workflow links to an
  existing project.

## Requirement ↔ repository

| Jiku | Repository |
|---|---|
| Requirement `812` | Branch `feat/812-{slug}` (`-2`, `-3`… when reopened) or `fix/812-{slug}`; `Origen: #812` in the definition; commits with `(#812)`; local criteria `[812-AC-01]` in tests |
| Its scope, proposal and criteria | The specification. Nothing about it is stored in the repository |
| Type `funcionalidad` / `mejora` | Specified with `/req-specify`, implemented with `/req-implement` |
| Type `incidencia`, or a small `mejora` | `/change`, as a task of the requirement |
| Task | One `/change` |

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
responsible): `/req-specify` expects Planificación, `/req-implement` En cola, `/change` Desarrollo
(it offers to move it). A Cancelado requirement aborts.

## Commands

| When | Command | What it sends |
|---|---|---|
| Start of every skill that works on a requirement | `grava.py jiku fetch {id}` | Reads the requirement with description, every comment, attachments, project and the specification fields; writes a copy to the working folder for the agent to read |
| `/req-specify`, `/product-bootstrap` | `grava.py spec draft {id}` / `spec push {id}` | The draft starts from what Jiku has; `push` sends `requirements.{id}.edit` with `scope`, `technicalSolution`, `acceptanceCriteria`, and then the description with its line «Especificación: lista ({fecha})» (replacing «borrador»). It never changes the state |
| End of `/req-implement`, when it decided small things | `grava.py spec amend {id}` | `requirements.{id}.edit` with `acceptanceCriteria` only: the criteria it decided appended, and the line «Decidido en la implementación: …». Nothing else of the specification changes |
| Reserving IDs | `grava.py next-id {KIND} --requirement {id}` | Reads the open requirements of the project (`requirements.list` with the three fields) |
| `/req-specify` reopening a requirement | `grava.py jiku state {id} desarrollo` | `requirements.{id}.edit`: `state` |
| `/req-implement` and `/change` creating the branch | `grava.py jiku state {id} desarrollo` | `requirements.{id}.edit`: `state` |
| End of `/req-implement`, `/change`, `/product-bootstrap`, `/product-adopt` | `grava.py jiku comment {id} --file …` | `requirements.{id}.comment`, `internal`: what the product does now, the criteria met in business terms, the verification |
| Start of `/change` | `grava.py jiku task {id} --title …` | `tasks.new` with `requirementId`, `projectId`, area `desarrollo`, state `activo`, the person of the token as responsible |
| End of `/product-define` | `grava.py plan-push --product …` | `requirements.new` per part of the plan (and the base): type `funcionalidad`, state `planificacion`, visibility `public`, with the three fields as a draft and «Especificación: borrador» at the end of the description |
| `/product-adopt` | `grava.py jiku new --type … --state analisis` | The adoption requirement (if none was given), "Alinear con los defaults de grava-workflow", and one `incidencia` per suspected bug; visibility `internal` |
| What is seen out of scope (`/req-implement`, `/change`, `/product-bootstrap`, `/req-specify`) | `grava.py out-of-scope {id} --title … --description …` (or `--to N`) | `requirements.new`, state `analisis`, visibility `internal`, `Origen: #{id}` in the description; or `requirements.{N}.comment` |
| `/product-release` | `grava.py jiku comment {id}` | "Incluido en la versión X" on each requirement released |

Every write prints the method and payload it sent (or would send, in dry-run) and appends it to the
log in the working folder.

## Before Writing

- **Read first.** Every write looks at what Jiku has before: `plan-push` matches the plan's parts with
  the open requirements by title and never creates one twice; `spec push` refuses if the specification
  changed in Jiku since its draft started (it keeps a fingerprint of what it read); the
  «Especificación: …» line replaces only itself; what is seen out of scope is searched among the open
  requirements before creating; a state change checks the current state.
- **Interactive skills show and ask.** `/product-define`, `/req-specify` and the specification step of
  `/product-bootstrap` show what they are about to write (titles and actions: `plan-push --preview`;
  the specification and what is created out of scope) and write only on the user's approval.
- **Autonomous skills do not ask.** `/req-implement`, `/change` and the rest of `/product-bootstrap`
  work on requirements that already exist: they read before writing and report everything they wrote
  at the end.

## Draft or Ready

The last line of a requirement's description says whether its specification can be built:
«Especificación: borrador» (written by `plan-push`: generated from the discovery, not reviewed against
what is built) or «Especificación: lista ({fecha})» (written by `spec push`). `/req-implement` stops
on anything but «lista» (`spec check --implement`, `S18`); `/status` lists drafts apart. A requirement
created by hand has no line until it is specified.

## What Is Seen Out of Scope

While specifying, implementing, changing or verifying, an agent sees things that are not the
requirement's scope. What the product must not lose goes to Jiku, through
`grava.py out-of-scope {id} …`, which creates it with visibility `internal`, state `analisis` and
`Origen: #{id} ({skill})` in the description, and lists it for the MR and the Jiku comment
(`out-of-scope {id} --list`). Never fix it in the branch: that is scope creep.

| Kind | Example | Goes to Jiku as |
|---|---|---|
| 1. A bug in what is built: the product does not do what the definition says | Simultaneous bookings answer 500 in 5 of 15 runs; sibling messages with the same error a `/change` fixed | `incidencia` |
| 2. An intermittent test | An e2e that times out now and then | `incidencia`: it is a bug or a bad test, and either one blocks CI some day |
| 3. A security risk | A destination an actor provides that can reach the internal network | `incidencia` |
| 4. Something postponed on purpose: agreed to be done in another requirement | Warning when deactivating an account with open loans; a test that moves to a later part | A comment on the requirement that will do it (`--to N`); if none does, a requirement (`--type funcionalidad` or `mejora`) |
| 5. The definition or the tests out of date, in something this requirement does not touch | A `covers` that no longer matches; an error case with no test; an interaction missing from `services.md` | `incidencia` (`--type otro` when nothing behaves wrong) |
| 6. A problem of grava-workflow or the environment | A script that fails; a port in use | **Not to Jiku**: the final report, marked as such |
| 7. An opinion: a refactor, an idea, "it would be nice if" | — | **Not to Jiku**: the final report, if worth it; the user decides |

- **Before creating, search** the open requirements (`grava.py jiku list`): if one already covers it,
  comment there (`--to N`) instead.
- **Each description says** what was seen, how to reproduce it when known, where (`archivo:línea`),
  and why it was not fixed here (out of scope). No code.
- **Autonomous skills** (`/req-implement`, `/change`, `/product-bootstrap`) record at close, and also
  when they stop. **`/req-specify`**, with the user present, asks before creating. The verifier never
  writes to Jiku: it reports «Fuera de alcance» and the skill that launched it records them, even
  from a rejected round.
- `/status` shows open incidencias apart, with their origin; `/product-release` lists them before
  tagging.

## Failure

| Situation | Action |
|---|---|
| `jiku` not installed, not logged in, or the instance's config missing | Tell the user (`jiku --config ~/.config/jiku/config.{instance}.yaml login`, `jiku doctor`). Steps that need to read the specification stop |
| Requirement not found or not visible | Stop: the id is wrong or the person has no access |
| The requirement belongs to another project | Stop: it does not belong to this repository |
| A write is refused | Report the error and the command to retry; continue |
