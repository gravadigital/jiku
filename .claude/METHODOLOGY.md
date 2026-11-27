# jiku flow

Methodology for building products with Claude Code, connected to Jiku (Grava's project and client
management). The user defines; the model implements, tests and proves it.

**Version:** see [`VERSION`](VERSION) · **Update:** `/jflow-framework-update` · **Detailed docs:** the
[`docs/`](https://github.com/gravadigital/jiku-flow/tree/main/docs) folder of the jiku flow repository.

---

## The idea

| Piece | Where | Owner |
|---|---|---|
| **Requirement and its specification** (who asked, priority, state; scope, proposal, acceptance criteria) | Jiku | Jiku |
| **Product definition** (what is built, rules, why) | `_jflow/` of the product repo | the repo, in `dev` |
| **Evidence** (each criterion → its test → result) | the MR/PR and a Jiku comment | the tests |
| **Documentation for people** | `README.md`, `docs/`, `CHANGELOG.md` of the product | the repo |
| **Engineering defaults** (how we always build, test, observe, version) | `.claude/specs/engineering.md` | jiku flow |

Jiku manages, the repository defines, evidence closes. What is still to build lives in the Jiku
requirements; what is built, in the definition. Controlled input (a specification with identified
acceptance criteria), controlled output (evidence verified by a clean-context verifier), free middle.

---

## Skills

| Skill | Mode | What it does |
|---|---|---|
| `/jflow-product-discover` | Interactive, once | Discovery with the user, then the plan: the base requirement and one requirement per part, created in Jiku as drafts to specify before building |
| `/jflow-product-scaffold {id}` | Technical questions first, then autonomous, once | Specifies the base requirement, then builds the base product on its branch `feat/{id}-base-product`: skeleton of every service, tests, CI, observability, the definition of what is built, guides |
| `/jflow-product-brownfield [id]` | Autonomous, once | An existing product: definition surveyed from the code, repository brought to the minimum, ready to specify and implement; security bugs to Jiku, everything else to the adoption report (`docs/adopcion.md` in Spanish, `docs/adoption.md` otherwise) |
| `/jflow-spec {id} [texto]` | Interactive | Specifies (or changes, or reopens) a Jiku requirement, challenging it against the definition; writes to Jiku only |
| `/jflow-build {id}` | Autonomous | Implements a specification (new, resumed or reopened); done only when the verifier approves |
| `/jflow-fix {id} {qué}` | Autonomous | Bug or small change that touches nothing documented, as a Jiku task |
| `/jflow-status` | Read-only | The product's stage and the requirements by next action, crossing Jiku with git |
| `/jflow-release` | One confirmation | CHANGELOG, merge `dev` → `main`, tag, note in Jiku |
| `/jflow-framework-update` | — | Updates jiku flow |

Subagent: `jflow-verifier-agent` — clean context, read-only; invoked by `/jflow-product-scaffold`, `/jflow-product-brownfield`,
`/jflow-build` and `/jflow-fix`.

Every skill that works on a requirement checks git (`jflow.py git-check`) and the requirement's Jiku
state at the start, and warns and asks when they are not the expected ones.

---

## Flows

**New product:** create the project in Jiku → `/jflow-product-discover` (discovery, plan, requirements in
Jiku, as drafts) → `/jflow-product-scaffold {base}` → MR to `dev` → for each part, in order:
`/jflow-spec {id}` → approval (En cola) → `/jflow-build {id}` → MR to `dev`.

**Existing product:** `/jflow-product-brownfield` → MR → same cycle.

**Functionality or improvement:** Jiku (Análisis) → a person moves it to Planificación →
`/jflow-spec {id}` → approval (En cola) → `/jflow-build {id}` (Desarrollo) → the user reviews and
merges the MR → deploy (Revisión) → Resuelto.

**Changing a specification:** `/jflow-spec {id} {qué cambia}` (a merged requirement is reopened) →
`/jflow-build {id}` adapts only the difference.

**Bug or small change:** `/jflow-fix {id} {qué}` → MR.

**Release:** `/jflow-release`.

---

## Resources

| Resource | Location |
|---|---|
| Skills | `.claude/skills/{name}/SKILL.md` |
| Verifier subagent | `.claude/agents/jflow-verifier-agent.md` |
| Specs | `.claude/specs/` — `product-definition`, `requirement`, `engineering`, `database`, `jiku`, `discovery`, `functional-analysis` |
| Templates | `.claude/templates/` — discovery templates, `AGENTS.md`, `service-AGENTS.md`; for people, by language: `es/` and `en/` (`base-requirement.md`, `README.md`, the operations guide, the adoption report) |
| Scripts | `.claude/scripts/jflow.py` (everything deterministic), `check-discovery.py`, `migrate.sh`, `framework-update.sh` |
| Hooks | `.claude/hooks/` (pre-compact + session-resume) |

---

## Product repository

```
AGENTS.md  CLAUDE.md        # agents (English)
README.md  CHANGELOG.md     # people (product language)
Makefile  docker-compose.yml  .env.example  CI
services/{service}/         # code; each with AGENTS.md + CLAUDE.md
docs/                       # people: the operations and integration guides (operacion.md / operations.md…)
_jflow/                     # agents: the workflow's memory
├── project.yaml            # Jiku project and instance, git platform and branches
├── discovery/              # the original analysis (frozen history)
├── prd/                    # product definition of what is built
├── apis/                   # contracts (OpenAPI / AsyncAPI)
├── db-schemas/             # database schemas
├── flows/                  # operations across modules and services
└── references/             # external systems
```

Always a monorepo. Branches: `dev` (integration), `main` (production, tagged), `feat/{id}-{slug}`
(`-2`… when reopened) and `fix/{id}-{slug}` from `dev`. The base product is built on `feat/{id}-base-product`, like any requirement.

---

## Languages

| Content | Language |
|---|---|
| Skills, specs, templates, and the `AGENTS.md` / `CLAUDE.md` of each product (for agents) | English |
| Messages to the user | The user's |
| Documentation for people (`docs/`, `README.md`, `CHANGELOG.md`), Jiku, the discovery | The product language (`language` in `_jflow/project.yaml`, Spanish when unset) |
| Commits, MR/PR text, branch names, test names | English |
| `_jflow/` (except the discovery) | English structure, content in the product language |
| Code, tables, columns, enums, API paths and fields | English |
