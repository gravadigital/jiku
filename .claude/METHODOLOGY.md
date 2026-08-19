# Grava Workflow

Methodology for product, architecture, UX and code development on top of Claude Code.

**Version:** see [`VERSION`](VERSION)
**Update:** `/update-tools`
**Detailed docs (Spanish):** see the [`docs/`](../docs/) folder of the product repository.

---

## Usage contexts

This methodology is used in two repository roles:

| Role | Description | Typical `docs/` folders |
|------|-------------|-------------------------|
| **Product** | Centralizes all product and architecture documentation | `prd/`, `architectures/`, `requests/`, `stories/`, `apis/`, `db-schemas/`, `adrs/`, `flows/`, `ux/`, `design-system/{surface}/`, `references/` |
| **Service** | Holds the code of one specific service | `story-plans/`, `reusable-code/` (+ `.claude/local-config.yaml` in multirepo) |

In **monorepo** mode both roles coexist in a single repository. There, `.claude/local-config.yaml` is
**not used** (and must not exist): service skills detect the monorepo from the repo structure (`docs/prd/`
at the root) and resolve paths from defaults and service architecture manifests.
In **multirepo** mode each service points to a separate product repository via relative paths in
`.claude/local-config.yaml`, which is therefore **required**.

---

## Skill catalogue (30 skills)

> All skills use the flat format `/<skill-name>` (no namespaces or colons).

### Product — discovery (optional, pre-initialization)
- `/product-discovery-functional` — Decision-complete functional analysis + DDD-light domain analysis (`docs/discovery/analisis-funcional.md`, `analisis-dominio.md`).
- `/product-discovery-technical` — Decision-complete technical analysis (`docs/discovery/analisis-tecnico.md`).

### Product — initialization
- `/product-initialize` — PRD: goals, requirements, feature groups. Transcribes from `docs/discovery/` when present.
- `/product-initialize-technical` — Technical architecture, ADRs, APIs, schemas, initial flows. Transcribes from `docs/discovery/` when present.
- `/product-create-backend-architecture <service>` — Backend manifest + conventions + overview.
- `/product-create-frontend-architecture <service>` — Frontend manifest + conventions + overview.

### Product — adopt existing project
- `/product-analyze-service <path>` — Analyze an existing service repository.
- `/product-consolidate-services` — Consolidate analyses into a complete PRD + ADRs + flows.

### Product — requests
- `/product-new-request` — Capture and clarify a functional requirement.
- `/product-design-request REQ-XXX [--auto]` — Technical design and story split. Sets `ux_review` flag based on UI impact.
- `/product-ux-request REQ-XXX [--auto]` — Infer + apply UX delta (screens, overlays, flows) when `ux_review: required`. Regenerates affected wireframes.
- `/product-create-stories REQ-XXX [--auto]` — Formalize stories from the design (blocked while `ux_review: required`).
- `/auto-new-request-from-fg <N>` — Auto-generate a REQ from a feature group.

### Product — automation
- `/auto-implement-request REQ-XXX` — Design → stories → planify → implement, end to end.
- `/auto-implement-product ["filter"]` — Iterate the PRD feature groups end to end.

### Product — UX & design system
- `/product-ux-generate` — Generate complete UX docs + mid-fidelity HTML wireframes + DS scaffold (per surface).
- `/product-ux-wireframes [surface1,surface2,...]` — Iterate on mid-fidelity wireframes and per-screen specs. Optional CSV scopes the run to specific surfaces.
- `/product-ux-agent` — Interactive UX assistant with full UX context loaded.
- `/product-design-system-update` — Interactive DS update with semver bump and CHANGELOG. The DS is per-surface, so the skill asks which surface to iterate.

### Product — administration
- `/product-generate-flows` — Detect and generate cross-service flows.
- `/product-change-technical-definition` — Modify technical definitions with impact analysis.
- `/product-migrate-architecture [service]` — Migrate legacy architecture docs to `manifest.yaml` + conventions.

### Product — advisory
- `/product-architect` — Interactive, read-only architecture advisor. Loads full product context and reasons about decisions, patterns, large features and cross-service flows. Creates/modifies nothing; points to the skill that materializes each conclusion.

### Service
- `/service-setup-repo` — Configure repo. Creates `.claude/local-config.yaml` in **multirepo only**; in monorepo it is auto-detected (no config file).
- `/service-update-reusable-code [service]` — Build/refresh the reusable code catalogue (per service in monorepo).
- `/service-planify-story S-XXX [service] [--auto]` — Story Plan with tasks and test scenarios.
- `/service-implement-story S-XXX [service] [--auto]` — Test-first implementation.
- `/service-dev [service]` — Interactive developer mode with full service context.

### Cross-cutting utilities
- `/status` — Dashboard of requests, stories and next suggested action.
- `/update-tools` — Pull the latest version of Grava Workflow.

---

## Typical workflows

### New product
0. *(optional)* `/product-discovery-functional` + `/product-discovery-technical` — front-loads the analysis so initialization becomes transcription.
1. `/product-initialize`
2. `/product-initialize-technical`
3. `/product-create-backend-architecture <svc>` and/or `/product-create-frontend-architecture <svc>`
4. *(optional)* `/product-ux-generate`
5. `/service-setup-repo` (in each service)

### Existing product (import)
1. `/product-analyze-service <path>` (once per service)
2. `/product-consolidate-services`
3. `/service-setup-repo` + `/service-update-reusable-code` (in each service)

### Day-to-day cycle
1. `/product-new-request`
2. `/product-design-request REQ-XXX` — sets `ux_review: required | not-applicable`
3. `/product-ux-request REQ-XXX` — only when `ux_review: required`
4. `/product-create-stories REQ-XXX`
5. `/service-planify-story S-XXX`
6. `/service-implement-story S-XXX`

Steps 2–6 can be collapsed with `/auto-implement-request REQ-XXX` (monorepo only).

---

## Resources

| Resource | Location |
|----------|----------|
| Skills | `.claude/skills/<name>/SKILL.md` |
| Agents | `.claude/agents/*.md` (8 agents) |
| Templates | `.claude/templates/*.yaml` |
| Conventions catalogue | `.claude/conventions/` (`index.md`, `manifest-schema.md`, per-language folders) |
| Hooks | `.claude/hooks/` (pre-compact + session-resume) |
| Migrations | `.claude/migrations/` |
| Scripts | `.claude/scripts/` (`migrate.sh`, `update-tools.sh`) |
| Files index | `.claude/utils/index.md` |

---

## Folder structure

### Product repository
```
docs/
├── discovery/             # functional/domain/technical analysis (optional, input to initialization)
├── prd/                   # goals-and-context, requirements, feature-groups, architecture
├── requests/              # REQ-XXX functional requests
├── stories/               # S-XXX implementation stories
├── flows/                 # cross-service interactions
├── apis/                  # OpenAPI specs (English)
├── db-schemas/            # DB schemas (English)
├── adrs/                  # Architectural Decision Records
├── architectures/         # per-service architecture (manifest.yaml + conventions + overview)
├── ux/                    # UX docs (overview, audiences/, surfaces/, cross-surface-flows)
├── design-system/         # DS per surface — README.md (index) + {surface}/{foundations,tokens,components,patterns,guidelines}
├── references/            # external references (third-party APIs, integrations)
├── analysis/              # temporary analyses (import workflow)
└── changelog/             # technical change records
```

### Service repository
```
docs/
├── story-plans/           # task breakdowns for stories
└── reusable-code/         # reusable code catalogue (English)

.claude/
└── local-config.yaml      # paths to product and service docs (committed)
```

---

## Languages

| Document | Language |
|----------|----------|
| PRD, requests, stories, story plans, ADRs, flows, UX, DS | Spanish |
| APIs (OpenAPI), DB schemas, reusable code, field/table names | English |
