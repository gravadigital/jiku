# Files Index

## Resources

### Specs

Shared specifications that skills read. They carry formats, contracts and criteria —
not roles.

- [Technical Standards](../specs/technical-standards.md) — API/DB/ADR/flow formats and reading order
- [Functional Analysis](../specs/functional-analysis.md) — extraction, assumptions, complexity scale
- [UX Methodology](../specs/ux-methodology.md) — seven firm rules, vocabulary, generation order
- [Orchestration](../specs/orchestration.md) — sequencing, progress format, subagent prompt pattern

### Agents

Executable subagents, addressed by `subagent_type`, for **parametric fan-out**: N parallel
invocations with different arguments. A single, known invocation does not need one — use a
skill with `context: fork` instead (see `/service-qa-review`).

- `ux-researcher` ([definition](../agents/ux-researcher.md)) — parallel fan-out for UX artifacts

### Skills

#### Product Skills (execute in product repository)

**Discovery (optional, before initialization):**
- [Discovery Functional](../skills/product-discovery-functional/SKILL.md) - Decision-complete functional + DDD-light domain analysis
- [Discovery Technical](../skills/product-discovery-technical/SKILL.md) - Decision-complete technical analysis from the functional + domain analyses

**New Products:**
- [Initialize Product](../skills/product-initialize/SKILL.md) - Bootstrap new product from scratch
- [Initialize Technical](../skills/product-initialize-technical/SKILL.md) - Create technical architecture documentation

**Requests:**
- [New Request](../skills/product-new-request/SKILL.md) - Capture new request (functional requirements)
- [Design Request](../skills/product-design-request/SKILL.md) - Design technical solution for captured request; sets `ux_review` flag based on UI impact
- [UX Request](../skills/product-ux-request/SKILL.md) - Process the UX impact of a designed request — propose and apply UX deltas (screens, overlays, flows) and regenerate the affected wireframes. Required when `ux_review: required`

**Formalization:**
- [Create Stories](../skills/product-create-stories/SKILL.md) - Create stories from designed request

**Architecture:**
- [Architecture Advisor](../skills/product-architect/SKILL.md) - Interactive architecture advisor (discuss decisions, patterns, larger features, cross-service flows)
- [Create Backend Architecture](../skills/product-create-backend-architecture/SKILL.md) - Define backend service architecture
- [Create Frontend Architecture](../skills/product-create-frontend-architecture/SKILL.md) - Define frontend service architecture

**Existing Projects (Import):**
- [Analyze Service](../skills/product-analyze-service/SKILL.md) - Analyze existing service repository
- [Consolidate Services](../skills/product-consolidate-services/SKILL.md) - Consolidate analyses into complete PRD

**Maintenance:**
- [Change Technical Definition](../skills/product-change-technical-definition/SKILL.md) - Modify technical definitions
- [Migrate Architecture](../skills/product-migrate-architecture/SKILL.md) - Migrate legacy architecture docs to manifest.yaml + custom conventions
- [Generate Flows](../skills/product-generate-flows/SKILL.md) - Detect and generate system flow documents

**UX:**
- [UX Generate](../skills/product-ux-generate/SKILL.md) - Bootstrap complete UX docs (overview, benchmarks, research-contexts, product-maps, user-flows, cross-surface-flows) from PRD **and** generate mid-fidelity HTML wireframes for every surface — single end-to-end command
- [UX Wireframes (mid-fi)](../skills/product-ux-wireframes/SKILL.md) - Iterate on mid-fidelity wireframes — regenerate or update the HTML wireframe book and per-screen docs after `/product-ux-generate` has bootstrapped the product
- [UX Add Surface](../skills/product-ux-add-surface/SKILL.md) - Add one surface to a product already bootstrapped: product-map, user-flows, screens, wireframes and its own Design System scaffold, without touching the existing surfaces
- [UX Audit](../skills/product-ux-audit/SKILL.md) - Read-only consistency check of the UX set: broken references, viewport/platform mismatches, design system wiring, stale wireframes
- [UX Agent](../skills/product-ux-agent/SKILL.md) - Interactive UX researcher mode - loads full UX context and assists with edits, questions, and refinements

**Design System:**
> **Brownfield:** UX no se genera con `/product-ux-generate` sino con el pipeline de importación —
> `/product-analyze-service` releva la UI existente (Step 6.5) y `/product-consolidate-services`
> la consolida en `docs/ux/` + siembra el DS (Step 9.7).

- [Design System Update](../skills/product-design-system-update/SKILL.md) - Interactive mode to update the design system (add/modify/remove components, foundations, tokens, patterns, guidelines) with automatic semver bumping and CHANGELOG entries. The DS scaffold itself is bootstrapped by `/product-ux-generate` (no separate init command).

#### Service Skills (execute in service repository)

**Setup:**
- [Setup Service Repository](../skills/service-setup-repo/SKILL.md) - Configure service repo to use workflow

**Documentation:**
- [Update Reusable Code](../skills/service-update-reusable-code/SKILL.md) - Create/update catalog of reusable code

**Planning:**
- [Planify Story](../skills/service-planify-story/SKILL.md) - Split story into tasks

**Implementation:**
- [Implement Story](../skills/service-implement-story/SKILL.md) - Implement all tasks of a story

**Development:**
- [Service Dev](../skills/service-dev/SKILL.md) - Interactive developer mode

#### Automation Skills

- [Auto New Request from Feature Group](../skills/auto-new-request-from-fg/SKILL.md) - Generate REQ document from a PRD feature group automatically
- [Auto Implement Request](../skills/auto-implement-request/SKILL.md) - Orchestrate full implementation of a request end-to-end
- [Auto Implement Product](../skills/auto-implement-product/SKILL.md) - Orchestrate full implementation of all (or selected) PRD feature groups

#### Shared Skills

- [Update Tools](../skills/update-tools/SKILL.md) - Update workflow to latest version
- [Status](../skills/status/SKILL.md) - Show project or service status

### Templates

Templates are YAML reference specs (not executable). Skills read them and produce Markdown documents.

#### Discovery / Analysis
- [Discovery Functional Template](../templates/discovery-functional-tmpl.yaml)
- [Discovery Domain Template](../templates/discovery-domain-tmpl.yaml)
- [Discovery Technical Template](../templates/discovery-technical-tmpl.yaml)

#### Product Documentation
- [PRD Goals and Context Template](../templates/prd-goals-context-tmpl.yaml)
- [PRD Requirements Template](../templates/prd-requirements-tmpl.yaml)
- [PRD Feature Groups Template](../templates/prd-feature-groups-tmpl.yaml)
- [PRD Architecture Template](../templates/prd-architecture-tmpl.yaml)
- [ADR Template](../templates/adr-tmpl.yaml)

#### UX Documentation
- [UX Overview Template](../templates/ux-overview-tmpl.yaml)
- [UX Benchmark Template](../templates/ux-benchmark-tmpl.yaml)
- [UX Research Context Template](../templates/ux-research-context-tmpl.yaml)
- [UX Product Map Template](../templates/ux-product-map-tmpl.yaml)
- [UX User Flows Template](../templates/ux-user-flows-tmpl.yaml)
- [UX Cross-Surface Flows Template](../templates/ux-cross-surface-flows-tmpl.yaml)
- [Screen Definition Template](../templates/screen-tmpl.yaml) - Per-screen spec consumed by the wireframe generator. Single template; fidelity is a field (`fidelity: {visuals, content, interactivity}`), not a separate file
- [UX Survey Index Template](../templates/ux-survey-index-tmpl.yaml) - Brownfield: per-service survey of the current UI (stack, breakpoints, viewports in use, tokens, routes, components, gaps)
- [UX Survey Screen Template](../templates/ux-survey-screen-tmpl.yaml) - Brownfield: per-screen as-is survey read from the code
- [UX Gaps Template](../templates/ux-gaps-tmpl.yaml) - Brownfield: consolidated report of what the shipped UI is missing

#### Design System
- [DS Foundation Template](../templates/ds-foundation-tmpl.yaml) - Structure for foundation docs (color, typography, spacing, etc.)
- [DS Component Template](../templates/ds-component-tmpl.yaml) - 12 canonical sections for component specs

#### Service Architecture
- [API REST Interface Template](../templates/api-rest-interface-tmpl.yaml)
- [Database Schema Template](../templates/db-schema-tmpl.yaml)

#### Conventions Catalog
- [Conventions Index](../conventions/index.md) - Catalog of development conventions by language
- [Manifest Schema](../conventions/manifest-schema.md) - Format and resolution rules for `manifest.yaml`
- [Convention Template](../templates/convention-tmpl.yaml) - Structure spec for convention documents (catalog and custom)

#### Service Documentation
- [Reusable Code Index Template](../templates/reusable-code-index-tmpl.yaml)
- [Reusable Code Detail Template](../templates/reusable-code-detail-tmpl.yaml)

#### Planning
- [Request Template](../templates/request-tmpl.yaml)
- [Story Template](../templates/story-tmpl.yaml)
- [Story Plan Template](../templates/story-plan-tmpl.yaml)

#### System Flows
- [Flow Template](../templates/flow-tmpl.yaml)

## Locations

### Product Repository

#### Base Folders
| ID | Name | Path | Description |
|----|------|------|-------------|
| `discovery_folder` | Discovery | `docs/discovery/` | Functional/domain/technical analysis (input to initialization) |
| `prd_folder` | PRD | `docs/prd/` | Product Requirements Documents |
| `architectures_folder` | Architectures | `docs/architectures/` | Service architectures: one folder per service with `manifest.yaml` + `overview.md` + `index.md` + `conventions/` custom |
| `adrs_folder` | ADRs | `docs/adrs/` | Architectural Decision Records |
| `apis_folder` | API Definitions | `docs/apis/` | OpenAPI specifications |
| `db_schemas_folder` | Database Schemas | `docs/db-schemas/` | Database schema documents |
| `stories_folder` | Stories | `docs/stories/` | Formalized stories |
| `requests_folder` | Requests | `docs/requests/` | Captured requests |
| `analysis_folder` | Analysis | `docs/analysis/` | Temporary analysis for the import workflow: per-service analyses and, for frontends, the UX survey consumed by consolidation |
| `flows_folder` | Flows | `docs/flows/` | System flow documentation (cross-service interactions) |
| `references_folder` | References | `docs/references/` | External reference documentation (APIs, integrations, definitions) |
| `ux_folder` | UX | `docs/ux/` | UX documentation root (overview + audiences + surfaces + cross-surface flows) |
| `ux_audiences_folder` | UX Audiences | `docs/ux/audiences/` | Per-audience UX artifacts (research-context, benchmark) |
| `ux_surfaces_folder` | UX Surfaces | `docs/ux/surfaces/` | Per-surface UX artifacts (product-map, user-flows) |
| `ds_folder` | Design System | `docs/design-system/` | Design System root — contains a root README.md (index) and one folder per surface |
| `ds_surface_folder` | DS Surface | `docs/design-system/{{surface}}/` | DS root for a single surface (independent versioning) |
| `ds_foundations_folder` | DS Foundations | `docs/design-system/{{surface}}/foundations/` | Visual primitives (color, typography, spacing, grid, iconography, motion, elevation, voice-tone) per surface |
| `ds_tokens_folder` | DS Tokens | `docs/design-system/{{surface}}/tokens/` | Token tiers (reference, semantic, component) per surface |
| `ds_components_folder` | DS Components | `docs/design-system/{{surface}}/components/` | Component specs per surface (one .md per component) |
| `ds_patterns_folder` | DS Patterns | `docs/design-system/{{surface}}/patterns/` | Pattern specs per surface (forms, empty-states, navigation, feedback) |
| `ds_guidelines_folder` | DS Guidelines | `docs/design-system/{{surface}}/guidelines/` | Transversal guidelines per surface (accessibility, i18n, content) |
| `changelog_folder` | Changelog | `docs/changelog/` | Technical change records |

#### File Patterns
| Resource | Folder ID | Filename Pattern |
|----------|-----------|------------------|
| Discovery Functional Analysis | `discovery_folder` | `analisis-funcional.md` |
| Discovery Domain Analysis | `discovery_folder` | `analisis-dominio.md` |
| Discovery Technical Analysis | `discovery_folder` | `analisis-tecnico.md` |
| PRD Goals & Context | `prd_folder` | `goals-and-context.md` |
| PRD Requirements | `prd_folder` | `requirements.md` |
| PRD Feature Groups | `prd_folder` | `feature-groups.md` |
| PRD Architecture | `prd_folder` | `architecture.md` |
| Service Manifest | `architectures_folder` | `{{service_name}}/manifest.yaml` |
| Service Architecture Overview | `architectures_folder` | `{{service_name}}/overview.md` |
| Service Architecture (index, auto-generated) | `architectures_folder` | `{{service_name}}/index.md` |
| Service Custom Convention | `architectures_folder` | `{{service_name}}/conventions/{{convention-id}}.md` |
| Service Architecture (legacy section) | `architectures_folder` | `{{service_name}}/{{section}}.md` |
| ADR | `adrs_folder` | `ADR-{{number}}-{{title_short}}.md` |
| API Definition | `apis_folder` | `{{service_name}}.yaml` (OpenAPI 3.0) |
| Database Schema | `db_schemas_folder` | `{{db_name}}.md` |
| Story | `stories_folder` | `S-{{number}}.{{story_title_short}}.md` |
| Request | `requests_folder` | `REQ-{{number}}.{{title_short}}.md` |
| Service Analysis (import) | `analysis_folder` | `services/{{service_name}}.md` |
| UX Survey Index (import, frontend) | `analysis_folder` | `ux/{{service_name}}/index.md` |
| UX Survey Screen (import, frontend) | `analysis_folder` | `ux/{{service_name}}/screens/{{screen_name}}.md` |
| Import State (import) | `analysis_folder` | `.import-state.yaml` |
| Flow | `flows_folder` | `{{flow-name}}.md` |
| Reference Index | `references_folder` | `index.md` |
| Reference | `references_folder` | `{{reference-name}}.*` (any format) |
| UX Overview | `ux_folder` | `product-overview.md` |
| UX Cross-Surface Flows | `ux_folder` | `cross-surface-flows.md` |
| UX Gaps (as-is, brownfield) | `ux_folder` | `gaps-as-is.md` |
| UX Audience Benchmark | `ux_audiences_folder` | `{{audience-name}}/benchmark.md` |
| UX Audience Research Context | `ux_audiences_folder` | `{{audience-name}}/research-context.md` |
| UX Surface Product Map | `ux_surfaces_folder` | `{{surface-name}}/product-map.md` |
| UX Surface User Flows | `ux_surfaces_folder` | `{{surface-name}}/user-flows.md` |
| UX Surface Screen Definition | `ux_surfaces_folder` | `{{surface-name}}/screens/{{screen-name}}.md` |
| UX Surface Screens IR (canonical) | `ux_surfaces_folder` | `{{surface-name}}/screens.json` |
| UX Surface Wireframes (mid-fidelity) | `ux_surfaces_folder` | `{{surface-name}}/wireframes.html` |
| DS Root Index | `ds_folder` | `README.md` (root index linking each surface's DS) |
| DS Surface README | `ds_surface_folder` | `README.md` (per surface: version + inventory) |
| DS Changelog | `ds_surface_folder` | `CHANGELOG.md` (one per surface; independent semver) |
| DS Governance | `ds_surface_folder` | `governance.md` (per surface) |
| DS Foundation | `ds_foundations_folder` | `{{foundation-name}}.md` (color, typography, spacing, grid, iconography, motion, elevation, voice-tone) |
| DS Token Reference | `ds_tokens_folder` | `reference.md` |
| DS Token Semantic | `ds_tokens_folder` | `semantic.md` |
| DS Token Component | `ds_tokens_folder` | `component.md` |
| DS Component | `ds_components_folder` | `{{component-name}}.md` |
| DS Pattern | `ds_patterns_folder` | `{{pattern-name}}.md` |
| DS Guideline | `ds_guidelines_folder` | `{{guideline-name}}.md` (accessibility, i18n, content) |
| Changelog Entry | `changelog_folder` | `{{YYYY-MM-DD}}-{{short_description}}.md` |

### Service Repository

#### Service Documentation (service-specific)

**`reusable_code_folder` is mode-dependent** (reusable code is per service):
- **Multirepo:** `docs/reusable-code/` (one service per repo — no extra nesting).
- **Monorepo:** `docs/reusable-code/{{service_name}}/` (one subfolder per service, so multiple services
  in the same repo don't overwrite each other's catalogs). The `{{service_name}}` is the service this
  catalog documents.

All reusable-code files below live under **reusable_code_folder**.

| Resource | Path | Description |
|----------|------|-------------|
| Reusable Code Index | `{{reusable_code_folder}}/index.md` | Compact index of all reusable code |
| Reusable Code - Components | `{{reusable_code_folder}}/components.md` | Detailed component documentation (Frontend) |
| Reusable Code - Utils | `{{reusable_code_folder}}/utils.md` | Detailed utils/helpers documentation |
| Reusable Code - Middlewares | `{{reusable_code_folder}}/middlewares.md` | Detailed middlewares documentation |
| Reusable Code - Services | `{{reusable_code_folder}}/services.md` | Detailed services/repositories documentation |
| Reusable Code - Styles | `{{reusable_code_folder}}/styles.md` | Detailed styles documentation (Frontend) |
| Reusable Code - Hooks | `{{reusable_code_folder}}/hooks.md` | Detailed hooks documentation (Frontend) |
| Reusable Code - Types | `{{reusable_code_folder}}/types.md` | Detailed types/interfaces documentation |
| Reusable Code - Validators | `{{reusable_code_folder}}/validators.md` | Detailed validators documentation |
| Reusable Code - Constants | `{{reusable_code_folder}}/constants.md` | Detailed constants documentation |
| Reusable Code - Providers | `{{reusable_code_folder}}/providers.md` | Detailed providers documentation (Flutter + Riverpod) |
| Reusable Code - Stores | `{{reusable_code_folder}}/stores.md` | Detailed stores documentation (Redux/Zustand/Pinia) |
| Reusable Code - Guards | `{{reusable_code_folder}}/guards.md` | Detailed guards documentation (NestJS) |
| Reusable Code - Interceptors | `{{reusable_code_folder}}/interceptors.md` | Detailed interceptors documentation (NestJS) |
| Reusable Code - Decorators | `{{reusable_code_folder}}/decorators.md` | Detailed decorators documentation (NestJS) |
| Reusable Code - Composables | `{{reusable_code_folder}}/composables.md` | Detailed composables documentation (Vue) |
| Reusable Code - Extensions | `{{reusable_code_folder}}/extensions.md` | Detailed extensions documentation (Kotlin/Swift/Dart) |
| Reusable Code - Mixins | `{{reusable_code_folder}}/mixins.md` | Detailed mixins documentation (Vue/Sass) |

**Note:** Additional category files (Providers, Stores, Guards, etc.) are generated dynamically based on detected tech stack patterns.

#### Implementation Planning (service-specific)
| Resource | Path | Description |
|----------|------|-------------|
| Story Plans | `docs/story-plans/S-{{number}}.{{service_name}}.{{story_title_short}}.md` | Task breakdown for a story, scoped to one service. The `{{service_name}}` segment is mandatory so a multi-service story produces one plan file per service without collisions (critical in monorepo where all services share one `docs/story-plans/`) |

### Service Configuration (Committed)
| File | Path | Description |
|------|------|-------------|
| Local Config | `.claude/local-config.yaml` | Service configuration with relative paths (shared with team). **Required in multirepo** (records the product repo path); **must NOT exist in monorepo** — skills auto-detect monorepo from `docs/prd/` at the root and ignore/expect-absent this file (see Configuration Resolution Convention in `rules/skill.md`). Migration `009` removes a stale one. |
