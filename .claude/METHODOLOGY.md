# Grava Workflow

Methodology for building products with Claude Code, connected to Jiku (Grava's project and client
management). The user defines; the model implements, tests and proves it.

**Version:** see [`VERSION`](VERSION) · **Update:** `/update-tools` · **Detailed docs (Spanish):** the
[`docs/`](../docs/) folder of the grava-workflow repository.

---

## The idea

| Piece | Where | Owner |
|---|---|---|
| **Requirement and its specification** (who asked, priority, state; scope, proposal, acceptance criteria) | Jiku | Jiku |
| **Product definition** (what is built, rules, why) | `_gflow/` of the product repo | the repo, in `dev` |
| **Evidence** (each criterion → its test → result) | the MR/PR and a Jiku comment | the tests |
| **Documentation for people** | `README.md`, `docs/`, `CHANGELOG.md` of the product | the repo |
| **Engineering defaults** (how we always build, test, observe, version) | `.claude/specs/engineering.md` | grava-workflow |

Jiku manages, the repository defines, evidence closes. What is still to build lives in the Jiku
requirements; what is built, in the definition. Controlled input (a specification with identified
acceptance criteria), controlled output (evidence verified by a clean-context verifier), free middle.

---

## Skills

| Skill | Mode | What it does |
|---|---|---|
| `/product-define` | Interactive, once | Discovery with the user, then the plan: the base requirement and one specified requirement per part, created in Jiku |
| `/product-bootstrap {id}` | Autonomous, once | The base product on `dev`: skeleton of every service, tests, CI, observability, the definition of what is built, guides |
| `/product-adopt [id]` | Autonomous, once | An existing product: definition surveyed from the code, deviations from the defaults, alignment work and suspected bugs in Jiku |
| `/req-specify {id} [texto]` | Interactive | Specifies (or changes, or reopens) a Jiku requirement, challenging it against the definition; writes to Jiku only |
| `/req-implement {id}` | Autonomous | Implements a specification (new, resumed or reopened); done only when the verifier approves |
| `/change {id} {qué}` | Autonomous | Bug or small change that touches nothing documented, as a Jiku task |
| `/status` | Read-only | The product's stage and the requirements by next action, crossing Jiku with git |
| `/product-release` | One confirmation | CHANGELOG, merge `dev` → `main`, tag, note in Jiku |
| `/update-tools` | — | Updates grava-workflow |

Subagent: `verifier` — clean context, read-only; invoked by `/product-bootstrap`, `/product-adopt`,
`/req-implement` and `/change`.

Every skill that works on a requirement checks git (`grava.py git-check`) and the requirement's Jiku
state at the start, and warns and asks when they are not the expected ones.

---

## Flows

**New product:** create the project in Jiku → `/product-define` (discovery, plan, requirements in
Jiku) → `/product-bootstrap {base}` on `dev` → for each part, when approved: `/req-implement {id}` →
MR to `dev`.

**Existing product:** `/product-adopt` → MR → same cycle.

**Functionality or improvement:** Jiku (Análisis) → a person moves it to Planificación →
`/req-specify {id}` → approval (En cola) → `/req-implement {id}` (Desarrollo) → the user reviews and
merges the MR → deploy (Revisión) → Resuelto.

**Changing a specification:** `/req-specify {id} {qué cambia}` (a merged requirement is reopened) →
`/req-implement {id}` adapts only the difference.

**Bug or small change:** `/change {id} {qué}` → MR.

**Release:** `/product-release`.

---

## Resources

| Resource | Location |
|---|---|
| Skills | `.claude/skills/{name}/SKILL.md` |
| Verifier subagent | `.claude/agents/verifier.md` |
| Specs | `.claude/specs/` — `product-definition`, `requirement`, `engineering`, `database`, `jiku`, `discovery`, `functional-analysis` |
| Templates | `.claude/templates/` — discovery templates, `base-requirement.md`, `AGENTS.md`, `service-AGENTS.md`, `README.md`, `operacion.md` |
| Scripts | `.claude/scripts/grava.py` (everything deterministic), `check-discovery.py`, `migrate.sh`, `update-tools.sh` |
| Hooks | `.claude/hooks/` (pre-compact + session-resume) |

---

## Product repository

```
AGENTS.md  CLAUDE.md        # agents (English)
README.md  CHANGELOG.md     # people (Spanish)
Makefile  docker-compose.yml  .env.example  CI
services/{service}/         # code; each with AGENTS.md + CLAUDE.md
docs/                       # people: operacion.md, integracion.md
_gflow/                     # agents: the workflow's memory
├── project.yaml            # Jiku project and instance, git platform and branches
├── discovery/              # the original analysis (frozen history)
├── prd/                    # product definition of what is built
├── apis/                   # contracts (OpenAPI / AsyncAPI)
├── db-schemas/             # database schemas
├── flows/                  # operations across modules and services
└── references/             # external systems
```

Always a monorepo. Branches: `dev` (integration), `main` (production, tagged), `feat/{id}-{slug}`
(`-2`… when reopened) and `fix/{id}-{slug}` from `dev`. The base product is built on `dev`.

---

## Languages

| Content | Language |
|---|---|
| Skills, specs, templates, and the `AGENTS.md` / `CLAUDE.md` of each product (for agents) | English |
| Documentation for people (`docs/`, `README.md`, `CHANGELOG.md`), Jiku, messages, commits, test names | Spanish |
| `_gflow/` | Spanish content, English identifiers |
| Code, tables, columns, enums, API paths and fields | English |
