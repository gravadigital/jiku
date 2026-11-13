# {{fill: product name}}

{{fill: what the product is, in two lines}}

This repository uses **grava-workflow**: every change belongs to a Jiku requirement, whose
specification (scope, proposal, acceptance criteria) lives in Jiku; the product definition — what is
built, its rules and why — lives in `_gflow/`. Read this guide before touching code or docs.

## Running

Everything runs with Docker Compose and is driven by `make`. Docker is the only thing to install.

| Command | What it does |
|---|---|
| `make up` / `make down` | Start / stop the whole product |
| `make logs` | Follow the logs |
| `make dev` | Start with hot reload |
| `make test` | Every test; JUnit reports in `reports/junit/` |
| `make test-unit` · `make test-integration` · `make test-e2e` | One test level |
| `make lint` · `make typecheck` · `make fmt` | Static checks and formatting |
| `make check` | `lint` + `typecheck` + `test`: what CI runs, and what must pass before closing any work |
| `make migrate` | Apply the migrations |

`S={service}` limits any command to one service: `make test S=api`.

## Services

{{fill: table Service | Folder | What it is. Each folder has its own AGENTS.md with the stack, the commands and the canonical examples}}

## Where things are

| What | Where |
|---|---|
| Product definition (what is built, rules, decisions) | `_gflow/prd/` — start with `_gflow/prd/index.md` |
| Contracts of each service | `_gflow/apis/` |
| Database schemas | `_gflow/db-schemas/` |
| Flows across services | `_gflow/flows/` |
| The original discovery (history, frozen) | `_gflow/discovery/` |
| Specification of a requirement | In Jiku: `python3 .claude/scripts/grava.py spec show {id}` |
| Documentation for people | `README.md`, `docs/operacion.md`, `docs/integracion.md`, `CHANGELOG.md` |
| Code | `services/{service}/` |
| Test reports | `reports/` (not versioned) |

To load only the part of the definition a task touches:
`python3 .claude/scripts/grava.py load --block {PREFIX}` (or `--id`, `--entity`, `--module`).

## Answering questions about the product

When asked how the product behaves or why, load the relevant part of the definition
(`grava.py load …`) and answer citing its IDs (`CAN-E1`, `DEC-04`). When given a new idea, say which
rules and decisions it touches or contradicts, what it would change, and whether it would be a new
requirement (`/req-specify`) or a small change (`/change`).

## How work is done

- **Every change belongs to a Jiku requirement.** A feature or improvement is specified with
  `/req-specify {id}` and implemented with `/req-implement {id}`. A bug or a small change goes through
  `/change {id}`. `/status` shows what is pending; `/product-release` releases a version.
- **Before starting**, `grava.py git-check`: work starts from an up-to-date, clean `dev`.
- **Branches:** `feat/{id}-{slug}` or `fix/{id}-{slug}`, from `dev`. The MR/PR targets `dev`; `main`
  is production.
- **Tests carry the ID they prove** in brackets: `[CAN-E1] no cancela un turno que ya empezó`. What to
  test comes from the definition: requirement, failure condition, invariant, guarantee.
- **The definition is updated in the same branch** as the code that changes it. On `dev`, what is
  documented is what is built.
- **Language:** documentation for people (`docs/`, `README.md`, `CHANGELOG.md`), what goes to Jiku,
  test names, commit messages and messages to the user are in Spanish; `_gflow/` has Spanish content
  with English identifiers; code, code comments and the `AGENTS.md` files are in English.
- **Commits** follow Conventional Commits and name the requirement: `feat(api): cancelación por
  WhatsApp (#812)`.
- **The guides stay true:** a change to a command, a URL, a service, a background process or a practice
  updates `README.md`, `docs/operacion.md` and `AGENTS.md` in the same branch.
- **Observability is not optional:** every service logs JSON with `trace_id`, exposes health with
  version and dependency checks, and uses OpenTelemetry (see `.claude/specs/engineering.md`).

## Never

- Commit secrets or `.env`.
- Edit a migration already on `dev`: add a new one.
- Change an API contract used by external integrators unless the specification says so.
- Contradict a decision in `_gflow/prd/decisions.md` without reverting it in a requirement.
- Edit the generated indexes by hand (`_gflow/prd/blocks/index.md`, `_gflow/prd/domain/index.md`,
  `_gflow/flows/index.md`): regenerate them with `python3 .claude/scripts/grava.py def-index`.
- Write code-level detail in Jiku: the client may read it.
