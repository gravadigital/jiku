---
name: service-implement-story
description: Implement all tasks of a planified story - test-first development using Story Plan as single source of truth
model: sonnet
argument-hint: "[S-number] [service] [--auto]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion"
---

# Implement Story

## Purpose

Implement all tasks of a story that was previously planified with `/service-planify-story`. The Story Plan is the single source of truth -- it contains all architectural context, reusable code references, and task details needed for implementation.

**Flow:**
```
Step 0: Validate input (config + story ID)
  |
Step 1: Load configuration & Story Plan
  |
Step 2: Validate & plan execution
  |
Step 3: Setup environment (branch)
  |
Step 4: Implement tasks sequentially
  |
Step 5: Quality verification
  |
Step 5.5: QA review (subagent, clean context)
  |
Step 6: Update reusable code docs (incremental)
  |
Step 6.5: Update API, DB & flow documentation
  |
Step 6.7: Regenerate wireframes (only if UX docs changed during implementation)
  |
Step 7: User review
  |
Step 8: Finalization
```

**Result:** Story tasks implemented, tests passing, committed on a feature branch ready for PR.

**This command does NOT:**
- Create the story document -- Use `/product-create-stories`
- Create the story plan -- Use `/service-planify-story` first
- Push to remote or create PR -- User handles this after approval

## References

The Story Plan is the single source of truth for what to implement. The service's stack,
patterns and conventions are declared in its `manifest.yaml` and the conventions it
references -- read those, do not infer the stack.

## CRITICAL RULES

1. **Use Spanish** for all user interactions
2. **Save first, then validate** - Implement all tasks, then present for user review
3. **Reference locations from Files index** - Do not hardcode paths
   - Read [Files index](.claude/utils/index.md) for story plan locations
4. **Do NOT dump full content in chat** - Show file-level summaries, let user review code directly
5. **Story Plan is the single source of truth** - All architectural context, reusable code, and task details come from the Story Plan. Do NOT re-read architecture docs from product repo, scan the codebase for reusable elements, or read existing source files to "understand patterns". Only read files that the task explicitly requires to modify
6. **MANDATORY architecture compliance** - Follow the Architectural Context section from the Story Plan STRICTLY
7. **MANDATORY reuse** - Follow the Reusable Code references in each task's Architectural Context References. Do NOT create duplicates
8. **Test-first implementation** - Write tests BEFORE implementation code. Tests define "done" -- a task is complete when its tests pass. Never skip tests
9. **Never force push** - Use standard git workflow
10. **Never commit to dev directly** - Always use feature branches
11. **Quality verification after all tasks** - Run build, lint, tests once all tasks are done. Fix ALL errors found, including pre-existing ones — the codebase must be clean after implementation
12. **Single user review at the end** - Present all work together for final approval
13. **Ask before architectural decisions** not defined in tasks or Story Plan
14. **Update product documentation after implementation** -- API specs, DB schemas, and flow docs MUST be updated if the implementation changed endpoints, tables, or cross-service interactions

15. **Wireframes are source of truth for UI** -- For UI stories, the screen.md(s) included in the Story Plan describe blocks, microcopy, variants, states, and transitions. Implement EXACTLY what the wireframe declares. Do not invent UI behavior not in the wireframe.

16. **Auto-update wireframes, flows and DS when user requests UI changes** -- If during implementation the user explicitly asks to change something that affects the UI, update the corresponding UX/DS docs in the **product repo** BEFORE writing/modifying code. Apply WITHOUT confirmation — the user already requested the change. The mapping is:
   - **Microcopy, variant, state, block in/out, in-screen behavior** → `docs/ux/surfaces/{surface}/screens/{screen}.md`
   - **Overlay added/modified/removed** → `docs/ux/surfaces/{surface}/product-map.md` (Inventario de Overlays section) AND the overlay's own `screens/{overlay}.md` (created/modified/deleted)
   - **Transition changed (where a screen leads to)** → BOTH the source screen.md (Entrada/Salida section) AND `docs/ux/surfaces/{surface}/user-flows.md` (the flows that include that transition)
   - **Cross-surface flow changed** → `docs/ux/cross-surface-flows.md`
   - **New variant of existing DS component, new component, modified component behavior, new token** → `docs/design-system/{surface}/components/{name}.md` (DS is per surface — use the surface where the changed screen lives). Also bump the surface's CHANGELOG and version, independent of other surfaces.
   After the run, summarize what UX/DS docs were updated AND regenerate the affected wireframes (see Step 7.5). Do NOT modify any of these docs for changes the user did NOT explicitly request — implement what the wireframe says.

## Execution

### Step 0: Validate Input

**0.0 Resolve Configuration**

Resolve mode and paths following the **Configuration Resolution Convention** in `rules/skill.md`.
**Check the monorepo signal first:**

1. **`docs/prd/` exists at the repo root** → **monorepo**. Take paths from the Files index defaults and
   the service from the resolved `[service]` argument. **Ignore any `local-config.yaml`** (if one exists
   it's stale — warn once that it's unused). Do NOT abort.
2. **No `docs/prd/` but `.claude/local-config.yaml` exists** → **multirepo**. Use its `mode` and keys.
3. **Neither** → ABORT:
   ```markdown
   No encontré configuración de servicio ni documentación de producto en este repo.

   - Si es un producto nuevo: ejecutá `/product-initialize`.
   - Si es un repo de servicio (multirepo): ejecutá `/service-setup-repo` para configurarlo.
   ```
   **ABORT immediately. Do NOT continue with any other step.**

Store the resolved **mode** and paths for the steps below.

**0.1 Validate Story ID**

Parse `$ARGUMENTS` as the story ID.

- Accept formats: `S-001`, `001`, `1` -- all resolve to `S-001`
- Extract the numeric part, zero-pad to 3 digits, prefix with `S-`
- Examples: `1` -> `S-001`, `42` -> `S-042`, `S-003` -> `S-003`

If `$ARGUMENTS` is empty or not provided:

```markdown
Este comando requiere el identificador de la story.

**Uso:** `/service-implement-story S-XXX [servicio] [--auto]`

**Formatos validos:**
- `/service-implement-story S-001`
- `/service-implement-story S-001 service-a`
- `/service-implement-story 1`
```

**ABORT if no story ID provided.**

**0.2 Parse optional `[service]` argument**

A story may affect multiple services; this skill implements ONE service per run (the one whose Story
Plan it consumes). Parse the SECOND positional argument (if present) as the target service name. Store
as **service_arg** (or none). It is resolved in Step 1 following the **Service Selection Convention**
in `rules/skill.md`.

### Step 1: Load Configuration & Story Plan

1. **Resolve paths** (from Step 0.0):
   - **product_stories** - Path to stories (local-config key, or `docs/stories` in assumed monorepo)
   - **story_plans** - Path to story plans (local-config key, or `docs/story-plans`)
   - **product_repo** - Path to product repository (multirepo only; in monorepo it is the repo root)

2. **Resolve target service**

   Read the story file from **product_stories** and get its "Servicios Afectados" / "Affected Services"
   list. Resolve **service_name** following the **Service Selection Convention** in `rules/skill.md`:
   - **service_arg** provided (Step 0.2) → use it (validate it is in the affected services list; if not,
     ABORT listing the valid services).
   - No arg + story affects exactly ONE service → use it.
   - No arg + story affects MORE THAN ONE service → multirepo: `service.name` from local-config; monorepo
     interactive: ask with `AskUserQuestion`; monorepo `--auto`: ABORT (orchestrator always passes it).

3. **Resolve service type and assign role:**
   - **Monorepo** (resolved in Step 0.0): read `docs/architectures/{{service_name}}/manifest.yaml` and
     use its `type:` field. If the manifest is missing or has no `type`, ABORT per the Configuration
     Resolution Convention (point out `/product-create-{backend,frontend}-architecture` /
     `/product-migrate-architecture`).
   - **Multirepo:** use `service_type` from `local-config.yaml`.
   - The type selects which conventions apply; the stack itself comes from `manifest.yaml`.

4. **Search for THIS service's Story Plan** in **story_plans** folder:
   - The plan is service-scoped. Match `S-{{number}}.{{service_name}}.*.md`.
     Do NOT match `S-{{number}}.*.md` blindly — that could pick up another service's plan.
   - **If no Story Plan exists for this service:**
     ```markdown
     No se encontro el Story Plan del servicio `{{service_name}}` para esta story.

     Primero ejecuta `/service-planify-story {{story_id}} {{service_name}}` para crear el plan.
     ```
     **ABORT.**

5. **Read the complete Story Plan** - This is the single source of truth containing:
   - Architectural Context (tech stack, patterns, ADRs, API context, DB context, conventions, reusable code)
   - Acceptance Criteria Coverage
   - Test Scenarios
   - All tasks with dependencies and technical details

### Step 2: Validate & Plan Execution

1. **Validate story status:**
   - Read story file from **product_stories** folder
   - Verify story is still in "Ready" or "In Progress" status
   - Verify **service_name** (resolved in Step 1) is listed in "Affected Services"

2. **Parse all tasks** from Story Plan's "Tasks" section:
   - Task number and title
   - Current status (Pending/In Progress/Completed)
   - Dependencies

3. **Validate task statuses:**
   - If ALL tasks "Completed" -> Inform and abort
   - If some "Completed", some "Pending" -> Inform which will be implemented
   - Note any "In Progress" tasks (may indicate interrupted execution)

4. **Build execution order** based on dependencies

5. **Inform execution plan (DO NOT wait for confirmation)** — the user already requested implementation by running this command. Present the plan and proceed immediately to Step 3:
   ```markdown
   Plan de ejecucion para {{story_id}}:
   
   {{task list with order and dependencies}}
   
   Iniciando implementacion...
   ```
   **Only ABORT if validation errors were found** (wrong status, missing dependencies, all tasks completed). Do NOT ask for confirmation.

### Step 3: Setup Environment

**One feature branch PER STORY (shared across services).** A story may affect multiple services, but
all of them are implemented on the **same** branch — one PR per story. The branch name is therefore
derived from the story only (NOT the service): `feature/{{story_id}}_{{story_title_short}}`.

This is what lets the SECOND service of a multi-service story build on top of the FIRST service's code:
when you implement `service-b` after `service-a`, you continue on the existing story branch where
`service-a`'s changes already live.

1. **Resolve the story branch** — check whether `feature/{{story_id}}_*` already exists:

   - **If a branch for this story already exists** (a previous service of this same story was already
     implemented on it):
     - `git checkout` that branch and continue on it. Do NOT require being on `dev`, and do NOT create
       a new branch — the prior service's code must remain in scope.
     - If MORE than one branch matches `feature/{{story_id}}_*` (shouldn't happen), pick the exact
       `feature/{{story_id}}_{{story_title_short}}` and warn the user about the others.
   - **If NO branch for this story exists** (this is the first service):
     - Validate the current branch is `dev` (or the base branch passed in auto mode — see Auto Mode).
       If NOT on the expected base: inform the user and abort.
     - Create `feature/{{story_id}}_{{story_title_short}}` from it.

2. **Branch naming:**
   - Format: `feature/{{story_id}}_{{story_title_short}}`
   - Example: `feature/S-001_user-registration`
   - Derived from the story only — shared by all of the story's services. Use lowercase and hyphens.

3. **Identify project commands** from README or package.json:
   - Build command
   - Lint command
   - Test command
   - **Frontend-specific:** Dev server command, type check command

### Step 4: Implement Tasks Sequentially

**For each task in execution order:**

#### 4.1 Validate Task Can Be Implemented

- Verify status is "Pending" (skip if "Completed")
- Validate dependencies are met (all blocking tasks "Completed")

#### 4.2 Analyze Task Requirements

- Read complete task section from Story Plan
- Identify files to create/modify **from the task's "Files to Create/Modify" list**
- Review the task's **Architectural Context References** to know:
  - Which ADRs/patterns to follow
  - Which reusable code to leverage
  - Which API/DB structures apply
- **Only read files that need to be modified** -- do NOT read other source files to "understand patterns" or "explore the codebase". All patterns and conventions are already in the Story Plan's Architectural Context

#### 4.3 Implement the Task

1. **Update task status** to "In Progress" in Story Plan file

2. **Implementation guidelines (all services):**
   - **STRICTLY follow the Architectural Context** from the Story Plan
   - **ALWAYS use reusable code** referenced in the task's Architectural Context References
   - Do not hardcode secrets - use environment variables
   - Add inline documentation for complex logic

3. **Backend-specific guidelines:**
   - Validate inputs at system boundaries
   - Handle database transactions properly
   - Follow REST conventions as defined in the Story Plan's API Context

4. **Frontend-specific guidelines:**
   - Use ONLY colors/spacing/typography from theme - no hardcoded values
   - **The accent comes from the design system**, via the semantic token (`bg.action.primary` →
     `color.brand.primary`). If the Story Plan shows a different hex coming from a screen.md
     frontmatter, that is a stale per-screen copy: the design system wins. Never hardcode either.
   - **Implement every viewport the screen declares, from its "Layout por viewport" spec.** The Story Plan carries that section verbatim per screen: it lists, per viewport, the rows and their 12-column fractions. Build ONE component that adapts — never two components, and never a single layout that merely stretches. If the plan declares two viewports, a build that satisfies one of them is incomplete.
   - **How to switch depends on the surface's platform**, declared in the Story Plan:
     - **`web` / `desktop-app`**: switch at the declared **breakpoints** from the grid foundation copied into the plan. Use the project's breakpoint tokens/utilities — never an ad-hoc pixel value invented at implementation time.
     - **`mobile-app` with `phone` + `tablet`**: switch by **size class in dp**, read from the platform API, per the grid foundation. Not px breakpoints.
     - **`mobile-app` with `phone` only**: there is **one layout and nothing to switch**. Do not add breakpoints, media queries or width checks that the spec does not ask for. The adaptive work here is different and mandatory: respect the **safe area** insets for any block anchored to an edge (bottom nav, fixed CTA), and keep the layout usable at the **maximum text scale** the grid foundation declares — which means no fixed heights on blocks containing text.
     - **How** to do any of this is defined by the service's conventions, copied into the Story Plan. For Flutter that is `adaptive-layout` (`SafeArea` and `viewPadding`, `viewInsets` for the keyboard, `textScaler`, `LayoutBuilder` with the size classes, orientation policy, touch targets). The grid foundation gives the values; the convention gives the mechanism. If the service does not declare that convention and the story has UI in scope, say so — the implementation will otherwise improvise the mechanism.
   - **Respect per-viewport block presence**: a block marked `solo desktop` must not render on mobile (and vice versa). Hiding with CSS is acceptable only if the DS pattern says so; otherwise do not mount it.
   - Implement accessibility (ARIA labels, keyboard nav, focus management)
   - Handle loading and error states
   - **Implement EXACTLY what the wireframe declares** — block inventory, microcopy, variants, states, transitions. The screen.md content is in the Story Plan's "Wireframes / Screens" section, and the agreed shape per width is in "UI Preview".
   - **Render using DS components** — for each block in the wireframe, find the matching DS component spec in the Story Plan's "Design System Context" and render it according to its API, variants, and states.
   - **DS Gaps** — the Story Plan splits them in two, and they are handled differently:
     - **Aceptados**: the UX review already decided these do not justify a component. Implement them
       inline using the DS foundations and semantic tokens, and do NOT pause to re-open the decision.
     - **Nuevos**: no decision on record. Pause and decide:
     - If the gap is trivial (e.g., a `section` placeholder), stub locally.
     - If the gap is significant (a real component the wireframe needs but DS doesn't have), notify the user and apply Rule 16: update the DS BEFORE implementing the code.

5. **Write tests FIRST** from task's "Testing Requirements":
   - **Backend:** Unit tests, integration tests for external systems
   - **Frontend:** Component tests, integration tests for user flows
   - Run tests -- they MUST fail (code doesn't exist yet). If they pass, the tests are not testing the right thing
   - If tests fail for the wrong reason (syntax error, missing import), fix the test setup before proceeding

6. **Implement code** until all tests pass:
   - Write the minimum code to make each test pass
   - Run tests after each significant change
   - Once ALL tests pass, the task implementation is complete

#### 4.4 Mark Task as Completed

1. Update task status to "Completed" in Story Plan
2. Update "Progress" section counts
3. Inform user: "Task {{task_num}} implementada"
4. Proceed to next task

#### 4.5 Handling user requests during implementation

**Skip this section entirely if the Story Plan has no "Wireframes / Screens / Flows" section** — that means the story is backend-only and there are no UX docs to update.

If at any point during 4.1–4.4 the user EXPLICITLY asks for a change in scope (microcopy, variant of a block, behavior, new block, transition, new overlay, new component, new DS variant), apply Rule 16:

**4.5.1 Classify the change**

- **In-screen change (microcopy, variant, state, block in/out, in-screen behavior)** → affects the screen.md only. If the change alters WHERE a block sits at a given width, it also affects that viewport's subsection in "Layout por viewport" — update it, since it is the spec the next story will read.
- **Viewport-specific change (a block becomes desktop-only, a row regrouped, a grid changes from 3 to 4 columns)** → affects the screen.md's Estructura (Viewports column) and the corresponding "Layout por viewport" subsection. Leave the other viewport's subsection untouched.
- **Adding or removing a viewport from a surface** → NOT an implementation decision. It lives in `product-overview.md` and forces a layout pass over every screen of the surface. Stop and tell the user to run `/product-ux-agent` (to declare it) and `/product-ux-wireframes {surface}` (to produce the layouts) before continuing. The same applies to the surface's **platform**: if the code turns out to be a native app while the docs say `web` (or vice versa), that is a documentation error to fix at the source, not something to work around in the component.
- **Overlay change (add/modify/remove a drawer, modal, bottom-sheet, popover)** → affects the surface's product-map.md (Inventario de Overlays) AND the overlay's screen.md.
- **Transition change (a screen now leads somewhere different)** → affects BOTH the source screen.md (Entrada/Salida section) AND user-flows.md (the flows that traverse that transition).
- **Cross-surface flow change** → affects cross-surface-flows.md.
- **DS-level change (new variant of an existing component, new component, modified component behavior, new token)** → affects the design system.
- **Combinations**: apply all relevant updates.

Track the **list of affected surfaces** as you make these edits — needed for Step 7.5.

**4.5.2 Update UX docs (if applicable)**

Locate the product repo's UX folder: in monorepo it is the repo root (`docs/ux/`); in multirepo use
`product_ux` from `local-config.yaml`.

**In-screen changes:**

1. Edit `{product_repo}/docs/ux/surfaces/{surface}/screens/{screen}.md`:
   - Microcopy → Contenido section
   - Variant → Variant column in Estructura table + Contenido
   - New block → append to Estructura + Contenido (including visibility rules if state-conditional)
   - State change → Estados section
2. Append a changelog entry to `## Decisiones y descartes`:
   - `- {{YYYY-MM-DD}} (story {{story_id}}): {brief description}`

**Overlay changes:**

1. Edit `{product_repo}/docs/ux/surfaces/{surface}/product-map.md` — Inventario de Overlays section:
   - Add → append row with overlay ID, type (drawer/modal/bottom-sheet/popover), trigger (screen · block), purpose
   - Modify → update the row
   - Remove → delete the row
2. Create/edit/delete the overlay's `{product_repo}/docs/ux/surfaces/{surface}/screens/{overlay-name}.md` with `overlay: true`, `overlay_type`, `triggered_by` in the frontmatter.
3. If the trigger block in the parent screen also changed, update its screen.md accordingly.

**Transition changes:**

1. Edit the source screen's `{product_repo}/docs/ux/surfaces/{surface}/screens/{screen}.md` — Entrada/Salida section.
2. Edit `{product_repo}/docs/ux/surfaces/{surface}/user-flows.md` — every flow that traverses the changed transition.
3. Append a changelog entry to the screen.md's `## Decisiones y descartes`.

**Cross-surface flow changes:**

1. Edit `{product_repo}/docs/ux/cross-surface-flows.md` — the affected flow.

**4.5.3 Update Design System (if applicable)**

The DS is per surface. Identify which surface owns the change — it's the surface where the affected screen lives (or the surface the user explicitly names if the change is foundational and spans more than one). If the change applies to multiple surfaces, repeat the update for each.

1. Identify the affected DS file in the product repo (`{surface}` is the surface of the changed screen):
   - New variant of existing component → `{product_repo}/docs/design-system/{surface}/components/{name}.md`
   - New component → create `{product_repo}/docs/design-system/{surface}/components/{new-name}.md` following the template structure (12 sections)
   - New foundation value → `{product_repo}/docs/design-system/{surface}/foundations/{name}.md`
   - New semantic token → `{product_repo}/docs/design-system/{surface}/tokens/semantic.md`
2. Edit/create the file with the user-requested change.
3. Update `{product_repo}/docs/design-system/{surface}/CHANGELOG.md`:
   - Add new section at top with bumped version (per semver — see Rule 16 for bump policy). Versioning is independent per surface — only this surface's version bumps.
   - Categorize: Agregado / Cambiado / Eliminado / Deprecado / Corregido
4. Update `{product_repo}/docs/design-system/{surface}/README.md` with the new version.
5. Append to per-file `## Historial` section.

If the same change needs to apply to more than one surface (e.g., the user wants the same new component in two surfaces), repeat the steps for each surface — each gets its own CHANGELOG entry and version bump.

**Semver bump policy (DS auto-updates):**
- MAJOR: remove variant, rename component, change API (require user explicit confirmation even though Rule 16 is auto — destructive change)
- MINOR: add component, add variant, add foundation, add token
- PATCH: spec correction, microcopy adjustment

**4.5.4 Implement the code**

After the doc(s) are updated, return to 4.3 and implement the code consistently with the (now-updated) wireframe/DS.

**4.5.5 Track changes for the final summary**

Keep an internal list of all wireframe/DS changes made during this run. They will be listed in Step 7 (final summary).

### Step 5: Quality Verification

**After ALL tasks implemented, execute IN ORDER. Fix issues before proceeding.**

**IMPORTANT:** Fix ALL errors found — including pre-existing ones not caused by this implementation. Do NOT skip or report errors as "pre-existing". The codebase must build, lint, and pass all tests cleanly before proceeding.

1. **Type checking (Frontend only):**
   - Run type check command (e.g., `tsc --noEmit`)
   - Fix all type errors

2. **Build the project:**
   - Run build command
   - Fix all compilation errors

3. **Run linter:**
   - Run lint command
   - Fix all linting issues (review each, don't blindly auto-fix)

4. **Run ALL tests:**
   - Run test command
   - Fix all failing tests
   - Ensure new code doesn't break existing functionality

### Step 5.5: QA Review (forked, clean context)

**After quality verification passes, launch a QA review in a clean context.**

This step verifies implementation correctness without the bias of having written the code.

**5.5.1 Launch QA Review**

Invoke `/service-qa-review` with `$ARGUMENTS` built as:

```
{{story_plan_path}} | {{comma-separated list of files created/modified in Step 4}}
```

The skill runs forked: its own clean context, its own model, and with `Write`/`Edit`
removed so it cannot alter the code it reviews. It carries the verification contract
and returns the report.

It verifies:
1. Every TS-X from the Test Scenarios table has a matching test with the same inputs/outputs
2. Every ADR Implementation Rule from the Architectural Context is respected in the code
3. Every Acceptance Criterion has test coverage
4. Field names in code match API Context and Database Context exactly

**5.5.2 Process QA Results**

- **If no issues found:** Proceed to Step 6
- **If issues found:**
  1. Review each issue reported by the QA review
  2. Fix the issues (write missing tests, correct field names, adjust code to match ADR rules)
  3. Re-run quality verification (Step 5) for the fixes
  4. **Do NOT re-run the QA review** -- fix the specific issues reported and proceed

**5.5.3 Inform User**

```markdown
QA Review completado

- Test Scenarios: {{X}}/{{Y}} cubiertos
- Reglas de ADR: {{X}}/{{Y}} cumplidas
- Criterios de Aceptacion: {{X}}/{{Y}} verificados
{{if issues_fixed}}

**Issues corregidos:** {{count}}
{{list of fixes applied}}
{{endif}}
```

---

### Step 6: Update Reusable Code Documentation (Incremental)

**After QA review passes, update reusable code docs with newly created elements.**

This is an incremental update -- only document new reusable code created during this implementation. Do NOT re-scan the entire codebase (that is what `/service-update-reusable-code` does).

#### 6.1 Identify New Reusable Elements

Review the files **created** during Step 4 and determine which are reusable by other features:
- New components, hooks, composables (Frontend)
- New utils, helpers, formatters, validators
- New middlewares, guards, interceptors, decorators (Backend)
- New services, repositories
- New types, interfaces, DTOs, enums
- New constants

**Criteria for "reusable":** The element is generic enough to be used by future features, not tightly coupled to this story's specific logic.

**If NO new reusable elements were created** -> Skip to Step 7.

#### 6.2 Update Documentation

Resolve **reusable_code_folder** for **service_name** (resolved in Step 1; see Files index):
`docs/reusable-code/` in multirepo, `docs/reusable-code/{{service_name}}/` in monorepo. All paths below
are relative to it.

1. **Check if **reusable_code_folder**`/index.md` exists**

2. **If exists:**
   - Read the current index
   - Add new entries to the appropriate category sections following the existing format
   - Read and update the affected detail files (e.g., **reusable_code_folder**`/utils.md`) adding entries for new items
   - Update totals in each modified category

3. **If NOT exists:**
   - Create **reusable_code_folder** (the per-service subfolder in monorepo)
   - Generate `index.md` with only the new items (following **Reusable Code Index Template** format from [Files index](.claude/utils/index.md))
   - Generate detail files only for categories that have new items (following **Reusable Code Detail Template** format)

4. **For each new reusable item, document in ENGLISH:**
   - **Index entry:** `- **{{Name}}** ({{file_path}}) - {{one-line description}}`
   - **Detail entry:** Name, Location, Description, Signature/Interface, Usage example

#### 6.3 Inform User

```markdown
Documentacion de codigo reutilizable actualizada

**Nuevos elementos documentados:** {{count}}
{{list: name (category)}}

**Archivos actualizados:**
- {{reusable_code_folder}}/index.md
- {{reusable_code_folder}}/{{category}}.md
```

---

### Step 6.5: Update API, DB & Flow Documentation

**After quality verification and reusable code update, check if implementation introduced changes that need to be reflected in product documentation.**

#### 6.5.1 Identify Documentation Changes

Review the implemented tasks and determine:
- Were new endpoints created or existing ones modified?
- Were new tables/columns created or existing ones modified?
- Were flow steps added, modified, or removed?

**If NO documentation changes needed** -> Skip to Step 7.

#### 6.5.2 Update API Documentation

For each API change:
1. Read the current OpenAPI YAML from the product repo's **apis_folder** (in monorepo the repo root's `docs/apis/`; in multirepo the path from local-config.yaml)
2. Update with the implemented changes (new endpoints, modified request/response schemas)
3. Copy exact field names and types from the implementation
4. Save the updated file

#### 6.5.3 Update DB Schema Documentation

For each DB change:
1. Read the current schema doc from the product repo's **db_schemas_folder**
2. Update DBML and/or markdown with implemented changes (new tables, new columns, modified constraints)
3. Save the updated file

#### 6.5.4 Update Flow Documentation

For each flow change:
1. Read the current flow doc from the product repo's **flows_folder**
2. Update steps with implemented changes
3. Ensure field names match the updated API/DB docs exactly
4. Update `last_updated` date and add story ID to `stories` list
5. Change flow status from "Draft" to "Active" if this was a new flow's first implementation
6. Save the updated file

#### 6.5.5 Inform User

```markdown
Documentacion de producto actualizada

Incluye:
{{if apis_updated}}
- APIs: {{list of modified API files with brief change description}}
{{endif}}
{{if db_updated}}
- Schemas de BD: {{list of modified schema files with brief change description}}
{{endif}}
{{if flows_updated}}
- Flujos: {{list of modified flow files with brief change description}}
{{endif}}

**Revisa los archivos y decime si estan correctos o queres cambios.**
```

**CRITICAL RULES for this step:**
- Only update docs that were actually changed by the implementation
- Copy exact field names and types from the code into the docs
- Do NOT update docs speculatively -- only document what was actually implemented

---

### Step 6.7: Regenerate Wireframes (only if UX docs changed)

**Skip this step entirely if no UX docs were modified during Step 4.5.**

When the user requested in-screen / overlay / transition / cross-surface changes during implementation, Step 4.5.2 updated the corresponding `.md` files but did NOT regenerate the `wireframes.html`. This step closes that loop by delegating to `/product-ux-wireframes` for the affected surfaces only.

**6.7.1 Build the surface list**

From the tracking done in Step 4.5.1, collect the unique list of affected surfaces (CSV format, e.g. `app-conductor,dashboard-admin`).

**6.7.2 Delegate to `/product-ux-wireframes`**

This skill operates in the service repo. The wireframes skill operates in the product repo. In monorepo the product repo is the repo root; in multirepo resolve `product_repo` from `.claude/local-config.yaml` (`product_ux` or `product_docs` path).

Use the **Agent tool** with `subagent_type: "general-purpose"` and pass the following prompt verbatim:

```
Ejecutá el skill product-ux-wireframes con los siguientes parámetros:
- Working directory: {{product_repo}}
- Argumento: {{CSV de superficies afectadas}} --no-interactive

El skill debe leer los screen.md ya actualizados y regenerar el screens.json + wireframes.html de cada superficie listada.
El flag --no-interactive hace que devuelva el control sin esperar confirmación del usuario.
```

**6.7.3 Verify and inform**

After the subagent returns, for each affected surface verify that `{product_repo}/docs/ux/surfaces/{surface}/wireframes.html` was modified (timestamp newer than the start of this step). If verification fails for any surface, do NOT abort — log a warning so the user can regenerate manually with `/product-ux-wireframes {{surface}}`.

Inform user (Spanish):

```markdown
Wireframes regenerados para las superficies modificadas durante la implementación: {{lista}}.
{{if any verification failed}}
Algunas superficies no se pudieron regenerar automáticamente. Ejecutá manualmente:
  cd {{product_repo}} && /product-ux-wireframes {{lista de superficies fallidas}}
{{endif}}
```

---

### Step 7: Final Summary and User Review

**Present to user:**

#### 1. Acceptance Criteria Checklist
- Each story-level criterion
- Which task(s) fulfill each
- Confirmation all met

#### 2. Quality Verification Results
- Build: PASS
- Lint: PASS
- Tests: PASS (X tests)
- **Frontend:** Type check: PASS

#### 3. Manual Testing Guide

**Backend-specific:**
- **API endpoints to test:** For each endpoint:
  - HTTP method and URL
  - Example request body
  - Expected response
  - cURL command ready to copy
- **Database verification:** Queries to verify data
- **Error scenarios:** Invalid inputs, edge cases

**Frontend-specific:**
- **Visual verification:**
  - How to start dev server
  - Routes/pages to check
  - Breakpoints to verify
- **Test scenarios:** Step-by-step for each
- **Edge cases:**
  - Empty states
  - Error states
  - Loading states
  - Responsive breakpoints
- **User flows:** Complete journeys to test

#### 4. Reusable Code Updated
- New elements documented (if any)
- Categories updated

#### 5. Architectural Decisions
- Decisions made during implementation
- Deviations from Story Plan (with justification)

#### 6. UX / Design System Updated (if any)

List each UX or DS doc that was modified during this run as a consequence of user-requested changes (Step 4.5). Group by type for clarity:

```markdown
**UX actualizado:**
- Pantallas: `{product_repo}/docs/ux/surfaces/{surface}/screens/{name}.md` — {brief change}
- Overlays: `{product_repo}/docs/ux/surfaces/{surface}/product-map.md` (Inventario) + `screens/{overlay}.md` — {brief change}
- Flujos: `{product_repo}/docs/ux/surfaces/{surface}/user-flows.md` — {brief change}
- Cross-surface flows: `{product_repo}/docs/ux/cross-surface-flows.md` — {brief change}

**Design System actualizado:** (uno por cada surface modificado; versionado independiente)
- `{product_repo}/docs/design-system/{surface}/components/{name}.md` — {brief change}
- Versión del DS de `{surface}`: vX.Y.Z → vX.Y.Z' (bump: {{PATCH|MINOR|MAJOR}})

**Wireframes regenerados (Step 6.7):**
- {{lista de superficies}} — `wireframes.html` actualizado.
{{if any surface failed regeneration:}}
- ⚠ Falló la regeneración de: {{lista}}. Ejecutá manualmente `cd {{product_repo}} && /product-ux-wireframes {{lista}}`.
{{endif}}
```

If no UX or DS docs were updated (no scope changes were requested), omit this section entirely.

#### 7. Request Confirmation

```markdown
**Revision requerida:**
1. Revisa los cambios de codigo
2. Ejecuta los tests manuales indicados arriba
3. {{Frontend con más de un viewport: Verifica el comportamiento visual en cada viewport declarado ({{lista}}) — presencia de bloques por viewport y el arreglo declarado en cada ancho}}
   {{Frontend nativo con un solo viewport: Verifica safe areas (nada interactivo bajo el notch ni el home indicator) y el layout a {{escala máxima}} de tipografía}}

**Aprobas los cambios?** (responder "ok", "aprobado", etc.)
```

**WAIT for explicit approval.** If changes requested, implement and re-verify.

### Step 8: Finalization

**Only after user approval:**

1. **Create commit:**
   - Stage all changes (including Story Plan)
   - **NO Claude/AI references** in commit
   - The scope includes the service, since multiple services of the same story commit to the shared
     story branch — this keeps each service's commit distinguishable.
   - Format:
   ```
   feat(story-{{story_id}}/{{service_name}}): {{brief description}}

   Implemented tasks:
   - Task {{num}}: {{title}}
   - Task {{num}}: {{title}}

   Story: {{story_id}} - {{story_title}} (service: {{service_name}})
   ```

2. **Update story status:**
   - Read story file from **product_stories** folder (same file validated in Step 2)
   - In story's "Affected Services" table, change this service's **Estado** column from "Pending" to "Done"
   - If ALL services now "Done":
     - Update story Status to "Completed"
     - Separate commit: `docs(story-{{story_id}}): mark as completed`
   - If NOT all "Done":
     - Commit: `docs(story-{{story_id}}): mark {{service_name}} as completed`

3. **Inform next steps:**
   - **If services are still pending** for this story: tell the user to implement them on the SAME
     branch — they stay on `feature/{{story_id}}_{{story_title_short}}` (do NOT go back to `dev`), and
     run `/service-implement-story {{story_id}} {{next_service}}`. The skill will detect the existing
     story branch and continue on it, so the next service builds on this service's code.
     If the "Servicios Afectados" table declares an order/dependency between services, follow it.
   - **If all services are now Done** (story Completed): recommend creating ONE PR from
     `feature/{{story_id}}_{{story_title_short}}` — it contains all services' changes for the story.
   - Branch name for reference: `feature/{{story_id}}_{{story_title_short}}`

## Error Handling

**ALL errors must be fixed, regardless of whether they are pre-existing or introduced by this implementation.** Never skip an error by labeling it "pre-existing" — the goal is a clean, working codebase.

- **Build errors:** Analyze, fix code, retry
- **Type errors (Frontend):** Fix typing issues
- **Linter errors:** Fix respecting project config
- **Test failures:** Debug and fix; update tests if intentional changes
- **Styling issues (Frontend):** Ensure design system consistency
- **Dependency issues:** Inform user, suggest reordering
- **Blocking issues:** After reasonable attempts, ask user for guidance. Do NOT proceed with broken code.

## Output

- Updated Story Plan file with task statuses
- Implementation code (new files and modifications)
- Tests for new functionality
- Updated reusable code documentation (if new reusable elements were created)
- Git commit(s) on feature branch

---

## Auto Mode

When `$ARGUMENTS` contains `--auto`, strip the flag before parsing the story ID and apply these overrides:

### Step 0: Parse `--auto`

Strip `--auto` first, then parse the remaining positional args as `S-number [service]`:

- `S-001 service-a --auto` → story `S-001`, **service_arg** = `service-a`, **auto_mode = ON**
- `S-001 --auto` → story `S-001`, **service_arg** = none, **auto_mode = ON**
- `S-001 service-a` → story `S-001`, **service_arg** = `service-a`, **auto_mode = OFF**
- `S-001` → story `S-001`, **service_arg** = none, **auto_mode = OFF**

### Overrides

- **Step 1 — Resolve target service**: In `--auto` the service MUST be resolvable without prompting
  (orchestrator passes it explicitly, or the story has a single affected service). If it cannot be
  resolved, do NOT ask the user — ABORT with a failure report.

- **Step 3** (Setup Environment — branch): The "one branch per story" logic is unchanged in auto mode.
  - If a `feature/{{story_id}}_*` branch already exists (a prior service of this story ran in the same
    orchestration), check it out and continue on it — same as manual.
  - If no story branch exists yet (first service), and the invocation prompt specifies a **base branch**
    (e.g. "Rama base: dev — creá la feature branch desde esta rama"), create
    `feature/{{story_id}}_{{story_title_short}}` from that base instead of validating `dev`.

- **Step 6.5.5** (Update API, DB & Flow Documentation — notification): Replace the wait block with:
  ```markdown
  [Auto] Documentación de producto aceptada — continuando.
  ```
  Continue directly to Step 7.

- **Step 7** (Final Summary and User Review): Replace the explicit approval wait with:
  - **Only proceed automatically if ALL quality checks passed** (build ✓, lint ✓, tests ✓, QA review ✓)
  - If any check failed or QA reported unfixed issues: **STOP and notify the user** — auto mode does not override broken code
  ```markdown
  [Auto] Todos los checks pasaron — implementación aceptada, procediendo al commit.
  ```
  Continue to Step 8.

- **Step 8.3** (Inform next steps): Skip entirely — the subagent completes here and returns control to the orchestrator.
