---
name: service-planify-story
description: Split a story into comprehensive tasks with test scenarios documented in a Story Plan - single source of truth for implementation
argument-hint: "[S-number] [service] [--auto]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
---

# Planify Story

## Purpose

Split an existing story into comprehensive, self-contained, and actionable tasks documented in a single Story Plan file. Each task should be ready for immediate implementation by a developer or AI agent.

**Flow:**
```
Step 0: Validate input (story ID required)
  |
Step 1: Load & validate story (status: Ready)
  |
Step 2: Analyze scope for this service
  |
Step 3: Load technical context (architecture, APIs, schemas, ADRs, reusable code)
  |
Step 4: Propose tasks & test scenarios (wait approval)
  |
Step 5: Create Story Plan document
  |
Step 6: Summary
```

**Result:** Story Plan document with tasks, test scenarios, and architectural context, ready for `/service-implement-story`.

**This command does NOT:**
- Create the story document -- Use `/product-create-stories`
- Implement the tasks -- Use `/service-implement-story` after this command
- Design the technical solution -- Story must already have a design from `/product-design-request`

**IMPORTANT:** A story may affect multiple services, but this command generates tasks for the **current service only** (the repository where this command is executed).

## References

**Read [Technical Standards](.claude/specs/technical-standards.md)** and apply it.

## CRITICAL RULES

1. **Use Spanish** for all user interactions and document content
   - Translate ALL content including section titles from English templates
   - Examples: "Goals" -> "Objetivos", "Background" -> "Contexto", "Success Criteria" -> "Criterios de Exito"
2. **Save first, then validate** - Save complete document, notify user, wait for confirmation
3. **Reference locations from Files index** - Do not hardcode paths
4. **Do NOT dump full content in chat** - Save to file, show summary, let user review file directly
5. **Do NOT invent or infer technical details** - Only use what exists in documentation
6. **Honor the Design System review recorded in the request** - When the story comes from a REQ whose `## Revisión UX` resolved a gap as "Crear componente", that component must exist before planning: step 2.h.4b **aborts** otherwise, because a story specified against a non-existent component gets improvised during implementation. Gaps resolved as "Dejar anotado" are carried to the Story Plan **labeled as accepted decisions**, not as findings. Never re-open a resolution — if it looks wrong, say so and let the user change it in the REQ
   - Only include API endpoints that exist in loaded API specs
   - Only reference database tables/fields that exist in loaded schemas
   - Only mention services/components that exist in loaded architectures
   - If something is needed but NOT documented:
     - Flag it explicitly as `NOT DOCUMENTED - needs verification`
     - Ask user to confirm or provide the correct reference
   - NEVER assume an endpoint/table/service exists just because it "makes sense"

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

**CRITICAL: This command REQUIRES a story ID as parameter.**

Parse `$ARGUMENTS` as the story ID. Accept these formats:
- `S-001` -> use as-is
- `001` -> prefix with `S-` -> `S-001`
- `1` -> zero-pad to 3 digits and prefix with `S-` -> `S-001`

Extract the numeric part, zero-pad to 3 digits, and prefix with `S-`.

If `$ARGUMENTS` is empty or not provided:

```markdown
Este comando requiere una story como parametro.

**Uso:** `/service-planify-story S-XXX [servicio] [--auto]`

**Para ver las stories disponibles:**
Revisa la carpeta de stories del producto (`docs/stories/` en monorepo, o **product_stories** de `.claude/local-config.yaml` en multirepo)
```

**ABORT if no story provided.**

**0.2 Parse optional `[service]` argument**

A story may affect multiple services; this skill plans ONE service per run. Parse the SECOND
positional argument (if present) as the target service name. Store as **service_arg** (or none).

- `S-001 service-a` → story `S-001`, **service_arg** = `service-a`
- `S-001` → story `S-001`, **service_arg** = none (resolved in Step 2)

The actual service is resolved in Step 2 following the **Service Selection Convention** in
`rules/skill.md`. Do not resolve it here.

### Step 1: Load and Validate Story

1. Read [Files index](.claude/utils/index.md) to get locations:
   - **stories_folder** - Where to find the story (product repo)
   - **story_plans_folder** - Where to save the plan. Resolve against the **mode** detected in Step 0:
     - **monorepo:** `docs/story-plans/` at the **repo root** — all services share this single folder;
       the mandatory `{{service_name}}` segment in the filename prevents collisions between services of
       the same story. Do NOT nest it under `services/{{service_name}}/`.
     - **multirepo:** `docs/story-plans/` inside the **service repo**.

2. **Load Story** from **stories_folder** (product repo)

3. **Validate Status**
   - If status is NOT `Ready`:
     ```markdown
     La story {{story_id}} no tiene status "Ready".

     Status actual: {{status}}

     **La story debe estar en status "Ready" para ser planificada.**
     ```
     **ABORT**

4. **Resolve target service**

   Read the story's "Servicios Afectados" / "Affected Services" table to get the list of affected
   services. Resolve **service_name** following the **Service Selection Convention** in `rules/skill.md`:

   1. If **service_arg** was provided (Step 0.2) → use it. If it is NOT in the affected services list:
      ```markdown
      El servicio `{{service_arg}}` no figura en los servicios afectados de la story {{story_id}}.

      **Servicios afectados:** {{list}}
      ```
      **ABORT.**
   2. If no **service_arg** and the story affects exactly ONE service → use it.
   3. If no **service_arg** and the story affects MORE THAN ONE service:
      - `mode: multirepo` → use `service.name` from `.claude/local-config.yaml`.
      - `mode: monorepo` → ask the user with `AskUserQuestion` which service to plan, offering the
        affected services as options. Use the chosen service as **service_name**.
        (In `--auto` the orchestrator always passes the service explicitly, so this branch is not reached.
        If it somehow is, ABORT — see Auto Mode.)

   Store the result as **service_name**. It drives the Story Plan filename and the `Service:` field.

5. **Check if already planified** (for THIS service)
   - The Story Plan filename is service-scoped: `S-{{number}}.{{service_name}}.{{story_title_short}}.md`.
   - Check **story_plans_folder** for a file matching `S-{{number}}.{{service_name}}.*.md`.
     Do NOT match `S-{{number}}.*.md` blindly — a plan for a DIFFERENT service of the same story is
     expected to coexist and must not be treated as "already planified".
   - If a plan for THIS service exists:
     ```markdown
     La story {{story_id}} ya tiene un plan para el servicio `{{service_name}}`.

     **Queres re-planificar? (sobrescribira el plan actual de este servicio)**
     ```
     Wait for user decision.

6. **Validate dependencies**
   - Check if blocking stories are completed
   - If not:
     ```markdown
     La story {{story_id}} tiene dependencias no completadas:

     {{list of blocking stories}}

     **Queres continuar de todas formas?**
     ```
     Wait for user decision.

### Step 2: Analyze Scope for the Resolved Service

The target **service_name** was already resolved and validated in Step 1.4. Here we extract its scope.

1. **Check the service is involved (not `not-required`):**
   - If the story's "Servicios Afectados" table marks **service_name** as `not-required`:
     ```markdown
     La story {{story_id}} no requiere cambios en el servicio `{{service_name}}`.

     **Servicios afectados:** {{list}}

     No hay tareas que planificar para este servicio.
     ```
     **ABORT**

2. **Extract relevant scope** for **service_name**:
   - Which acceptance criteria apply to this service
   - What API changes are needed
   - What DB changes are needed

**Inform user (in Spanish):**
```markdown
La story {{story_id}} aplica al servicio `{{service_name}}`.

**Servicio:** {{service_name}}
**Cambios requeridos:** {{brief summary}}

Procediendo a cargar contexto tecnico...
```

### Step 3: Load Technical Context

1. Read [Files index](.claude/utils/index.md) to get locations:
   - **architectures_folder** - Service architectures
   - **apis_folder** - API definitions
   - **db_schemas_folder** - Database schemas
   - **adrs_folder** - Architectural Decision Records

2. **Read technical documentation (MANDATORY):**

   **CRITICAL: You MUST read ALL documents listed below COMPLETELY before proceeding.**

   a. **Service Architecture** - For the current service from **architectures_folder/[service-name]/**:

      - Read `manifest.yaml` (declares language, type, conventions, modules)
      - Read `overview.md` (service purpose, modules)
      - **Resolve active conventions:**
        - Start with `_base.md` of the declared `language` from `.claude/conventions/{language}/_base.md` (custom `_base` is also supported: if `docs/architectures/[service-name]/conventions/_base.md` exists, it wins)
        - For each convention listed in `conventions`, resolve the file in this order:
          1. `docs/architectures/[service-name]/conventions/{id}.md` (custom, per-service)
          2. `.claude/conventions/{language}/{id}.md` (catalog)
          3. If neither exists, fail with a clear error citing the missing id
        - Apply transitive closure: read frontmatter of each active convention; if its `required_by` contains an already-active convention id, add it (custom and catalog participate equally in the closure)
      - **Read selectively based on story scope:**
        - Always read `_base` (full)
        - Read conventions relevant to the story (e.g., a persistence-only story may skip `auth-jwt`)
        - When in doubt, read it — completeness beats brevity for the Story Plan
      - Understand the technical context: the active conventions define how to write code in this service

      **If `manifest.yaml` does not exist:**
      - Abort and tell the user:
        ```
        Este servicio no tiene manifest.yaml. Ejecutá /product-migrate-architecture para migrarlo al formato actual antes de planificar stories.
        ```

   b. **API Definitions** - Read relevant API specs from **apis_folder**
      - OpenAPI YAML files for the current service
      - Understand existing endpoints, request/response formats
      - Identify which endpoints need changes or if new ones are needed

   c. **Database Schemas** - Read relevant DB schemas from **db_schemas_folder**
      - DBML and markdown schema files for the current service
      - Understand existing entities, relationships, fields
      - Identify which tables/entities need changes or if new ones are needed

   d. **ADRs** - Check for relevant Architectural Decision Records if applicable
      - Read any ADRs that affect the current service
      - Understand technical decisions and constraints already documented

   e. **System Flows** - Read flow documents referenced in the story's "Flujos Afectados" section
      - Read from **product_flows** path (from local-config.yaml)
      - Extract the complete flow with all steps relevant to this service
      - Copy relevant flow data into the Story Plan's Architectural Context (Flow Context section)
      - This ensures the implementor knows exactly how the system works today and what needs to change
      - **If no flows are referenced in the story:** Skip this sub-step

   f. **Reference Documents** (if applicable)
      - Read `product_references` path from `.claude/local-config.yaml`
      - Check if **references_folder** exists and contains `index.md`
      - **If exists:**
        - Read `index.md` to see all available references with descriptions and reading hints
        - Identify references relevant to THIS story by matching:
          - Reference `Servicios` against current service name
          - Reference descriptions against story scope (APIs mentioned, entities affected, external services)
        - **Read ONLY relevant references** following the reading hints in the index
      - **If NOT exists or none relevant:** Skip silently

   g. **Reusable Code Documentation**
      - Resolve **reusable_code_folder** for the resolved **service_name** (see Files index):
        `docs/reusable-code/` in multirepo, `docs/reusable-code/{{service_name}}/` in monorepo.
      - Check if **reusable_code_folder**`/index.md` exists
      - **If exists**:
        - Read **reusable_code_folder**`/index.md` (compact index)
        - Identify which categories are relevant for this story based on scope
        - Based on story needs, selectively read detailed files (from **reusable_code_folder**):
          - Frontend story touching UI -> read `components.md`, `hooks.md`, `styles.md`
          - Backend story touching API -> read `middlewares.md`, `services.md`, `validators.md`
          - Any story -> read `utils.md`, `types.md`, `constants.md` if relevant
        - **Only read the category files that are relevant, not all of them**
      - **If NOT exists**:
        - Warn user (in Spanish):
          ```markdown
          No se encontro `{{reusable_code_folder}}/index.md` para el servicio {{service_name}}.

          Te recomendamos crear este documento ejecutando:
          `/service-update-reusable-code` (en monorepo, para el servicio {{service_name}})

          Esto facilitara identificar codigo reutilizable para esta y futuras stories.

          Continuando sin codigo reutilizable documentado...
          ```

   **UX/DS gate — decide whether to load UX and Design System context**

   Before steps h and i, decide if this story touches UI. The decision is recorded as **ui_in_scope** and used to skip both steps h and i for backend-only stories (saves significant tokens — UX/DS context is large).

   1. **Read `affects_ui` from the story frontmatter** (set by `/product-create-stories` based on the parent REQ's `ux_review` and the story's service types):
      - If `affects_ui: false` → **ui_in_scope = false**. Skip steps h and i entirely. Inform user (Spanish): "Story puramente backend — no leo contexto UX ni Design System."
      - If `affects_ui: true` → **ui_in_scope = true**. Continue to step h.
   2. **If the field is missing** (story created under an older flow):
      - Fall back: for each service in the story's "Servicios Afectados", read `docs/architectures/{service}/manifest.yaml` and check `type`.
      - If ALL services are `type: backend` → **ui_in_scope = false**, skip h and i.
      - Otherwise → **ui_in_scope = true**, continue.
   3. **If manifest.yaml is also missing** (degenerate case): fall back to a keyword scan of the story body for "pantalla", "screen", "UI", "componente", "wireframe". Match → ui_in_scope = true. No match → ui_in_scope = false (conservative).

   Steps h and i below only execute when **ui_in_scope = true**.

   h. **UX context — for stories that touch UI** (only if ui_in_scope = true)

      - Read product_ux path from `.claude/local-config.yaml` (typically `docs/ux/`).
      - Identify which surface(s) the story affects (from the story's "Pantallas Afectadas" or "Superficies" section, or by matching the scope to known surfaces).
      - For each affected surface, identify which screens are involved.

      **h.1 Read screen.md files for affected screens**

      Read the corresponding `docs/ux/surfaces/{surface}/screens/{screen}.md` files COMPLETELY. Each screen.md is the source of truth for that screen:
      - `viewports` (frontmatter) — which widths the screen exists in. A screen.md still using the deprecated `device` field predates responsive support: treat it as a single viewport and flag it in the plan
      - Block inventory (Estructura section) with types, variants and the **Viewports** column (which blocks exist at which width)
      - **Layout por viewport** — the arrangement per viewport (rows and 12-column fractions). This is what makes the story implementable responsively; without it the implementor guesses
      - Real microcopy (Contenido section)
      - Applicable states with real user-facing messages
      - Transitions in/out
      - Annotations describing block-level behavior
      - Decisions & discards (the WHY)

      **If a screen.md is missing** for a screen mentioned in the story:
      - Warn the user (Spanish):
        ```markdown
        No se encontro `docs/ux/surfaces/{{surface}}/screens/{{screen}}.md` para una pantalla mencionada en la story.

        Ejecutá `/product-ux-wireframes` en el repo de producto para generarla, o agregala manualmente. Sin este documento, el desarrollador no tiene fuente de verdad para implementar la UI.

        Continuando sin esta pantalla...
        ```

      **h.2 Read user-flows.md (filtered) for affected surfaces**

      For each affected surface, read `docs/ux/surfaces/{surface}/user-flows.md` but extract ONLY the flows that mention any of the affected screens. Do not copy unrelated flows — the goal is to give the implementor the cross-screen context for what they're building, not the entire surface's flows.

      **h.3 Read product-map.md (Navigation + Overlays sections only)**

      For each affected surface, read `docs/ux/surfaces/{surface}/product-map.md` but extract ONLY:
      - The affected surface's **platform and viewports**, from `product-overview.md` → "Inventario de Superficies". These bound the whole UI scope of the story:
        - `web` with `mobile` + `desktop` → every screen task has to satisfy two layouts, switching at the breakpoints
        - `mobile-app` with `phone` only → **one layout**. There is no breakpoint switching to implement; the adaptive work is respecting safe areas and surviving text scaling, both declared in the grid foundation
        - `mobile-app` with `phone` + `tablet` → two layouts, switching by size class in dp, not by px breakpoint
      - "Estructura de Navegación" section (navigation principal + secundaria) — needed so the implementor knows global navigation patterns (hamburger menus, drawers, tabs) and where the screen sits within them
      - "Inventario de Overlays" section, filtered to overlays that are triggered from any of the affected screens

      Do NOT read the full screen inventory or IA sections — those are not needed for implementation.

      **h.4 Read cross-surface-flows.md (filtered)**

      Read `docs/ux/cross-surface-flows.md` if it exists. Extract ONLY the flows that mention any of the affected surfaces or screens. Skip otherwise.

      **If product_ux is not configured** or no screens apply, skip h.1-h.4 silently.

   i. **Design System — for stories that touch UI** (only if ui_in_scope = true)

      The DS is **per surface** under `docs/design-system/{surface}/`. For each surface affected by this story (the same surfaces identified in step h), load that surface's DS.

      - **If `docs/design-system/` does NOT exist at all**:
        - Warn the user (Spanish):
          ```markdown
          No se encontro `docs/design-system/` en el repo de producto.

          El Design System se inicializa automaticamente al ejecutar `/product-ux-generate`.
          Si todavia no esta inicializado, los componentes se implementaran sin guia de design system.

          Continuando sin design system...
          ```
        - Skip the rest of this sub-step.

      - **For each affected surface**, check `docs/design-system/{surface}/`:
        - If the surface's DS folder does NOT exist, warn the user (Spanish):
          ```markdown
          No se encontro `docs/design-system/{{surface}}/` para este surface.

          Verificá que el surface haya sido bootstrappeado por `/product-ux-generate`,
          o que su nombre coincida con los de `docs/ux/surfaces/`. Los componentes
          se implementaran sin guia del DS de este surface.
          ```
          Skip this surface and continue with the next.

      - **If the surface's DS exists**, read selectively from `docs/design-system/{surface}/`:
        - `README.md` — current DS version of this surface.
        - `foundations/*.md` — read foundations relevant to the story scope:
          - `color.md` and `typography.md` ALWAYS (every UI story touches these).
          - `spacing.md` and `grid.md` for layout work.
          - `iconography.md` if the story uses icons.
          - Other foundations only if specifically relevant.
        - `tokens/semantic.md` ALWAYS — components consume these.
        - `components/*.md` — read ONLY the components used by the affected screens of THIS surface. Cross-reference the screen.md's Estructura (block types) with this surface's components catalog:
          - For each block type in the screen.md (button, text-input, card, modal, etc.), find the matching DS component in this surface's `components/` and read its full spec.
          - If a block type used in the screen has NO matching DS component, flag this as a gap. Apply the canonical matching rule from [`/product-ux-wireframes`](.claude/skills/product-ux-wireframes/SKILL.md) → "Block type → DS component" — layout containers are not gaps, and matching is by role rather than by component name. Cross-check against the request's recorded review (h.4b) before treating a gap as new: it may already have a decision.
        - `patterns/*.md` — read patterns that compose the story's screens (forms, empty-states, navigation, etc.) if applicable.
        - `guidelines/accessibility.md` — ALWAYS for UI stories.
        - `guidelines/content.md` and `i18n.md` — only if microcopy or i18n is in scope.

      **h.4b Read the Design System review already recorded in the request**

      The story's frontmatter carries `source: REQ-XXX`. If it is a REQ (not `direct`), read that
      request's `## Revisión UX` → `### Design System` table from **requests_folder**. It holds the
      decision already taken per gap, so this skill does not re-litigate it:

      - `Reemplazar` → already applied to the screen.md. Nothing to do; the block type is covered.
      - `Dejar anotado` → a conscious decision to improvise. Carry it to the Story Plan's DS Gaps
        **labeled as accepted**, so the implementor knows it is not an oversight.
      - `pendiente-DS` (resolution was "Crear componente") → **verify the component now exists** in
        `docs/design-system/{surface}/components/`. If it does, the gap is closed: drop it. If it does
        not, **ABORT** (see below).

      **ABORT if a `pendiente-DS` component is still missing:**

      ```markdown
      No puedo planificar esta story: falta un componente de Design System que el REQ pidió crear.

      **Componentes pendientes en `{{surface}}`:**
      | Componente | Para |
      |---|---|
      | {{Chart}} | {{pantallas que lo usan}} |

      La revisión UX de {{REQ-XXX}} resolvió crear estos componentes. Si planifico igual, la story
      queda especificada contra algo que no existe y el desarrollador termina improvisándolo en
      implementación.

      **Para desbloquear, una de dos:**
      1. Ejecutá `/product-design-system-update` en el repo de producto y creá los componentes.
      2. Si decidiste no crearlos, editá la tabla `### Design System` de la sección `## Revisión UX`
         de {{REQ-XXX}} y cambiá la resolución a "Dejar anotado". Es una decisión válida — el
         desarrollador lo resuelve inline — pero tiene que quedar registrada.
      ```

      **ABORT.**

      Do NOT abort for gaps resolved as `Dejar anotado`, and do NOT abort when the story's `source` is
      `direct` (no REQ, so no review to honor).

      - **Track gaps per surface**: list any wireframe block types that don't have a DS component yet in their surface's catalog. These will appear as a "DS Gaps" section in the Story Plan, scoped per surface, so the implementor knows where they'll need to improvise or trigger a DS update.

3. **Confirm context loaded:**

   Inform user that documentation has been loaded (in Spanish):
   ```markdown
   Contexto tecnico cargado

   Arquitectura del servicio: {{service_name}}
   APIs: {{list or "Ninguna"}}
   Schemas de BD: {{list or "Ninguno"}}
   ADRs: {{count or "Ninguno"}}
   Referencias externas: {{list relevant or "Ninguna"}}

   Extrayendo informacion relevante para el Story Plan...
   ```

4. **Extract and prepare Architectural Context:**

   Based on the story scope and loaded documentation, extract relevant information that will be included in the Story Plan's "Architectural Context" section:

   a. **Tech Stack** - Extract versions and key technologies used
   b. **Service Architecture** - Extract folder structure, patterns, conventions, error handling, logging
   c. **Relevant ADRs** - Identify which ADRs apply to this story and extract:
      - ADR number and title
      - The decision made
      - **Implementation Rules** (copy the COMPLETE list of rules verbatim -- these are the enforceable constraints)
      - Code examples if available
   d. **API Context** - Extract/copy:
      - Relevant endpoint structures from OpenAPI spec
      - Authentication/authorization mechanisms
      - Request/response patterns
      - Error handling patterns
   e. **Flow Context** - Copy relevant system flows:
      - Complete flow steps from **flows_folder** that this story modifies or interacts with
      - Which steps this story modifies, adds, or removes
      - Exact field names and types from each step (these are authoritative for cross-service contracts)

   f. **Database Context** - Extract/copy:
      - Relevant table/entity definitions (DBML or descriptions)
      - Relationships and constraints
      - Migration patterns
   g. **Integration Points** - Extract:
      - External services/APIs — **from reference documents loaded in step 2.f**:
        - COPY relevant content into the Story Plan (endpoints, auth, error codes, rate limits, webhooks)
        - Include enough detail that the implementor can code against it without consulting external documentation
        - The Story Plan must be self-contained
      - Message queue patterns (how to publish/consume)
      - Internal service communication patterns
   h. **Code Conventions** - Extract naming and organization conventions
   i. **Reusable Code** - Extract reusable code information:
      - **If reusable code documentation exists**:
        - From the index read in step 2.e, you identified relevant categories
        - From the detailed files read in step 2.e, extract relevant pieces for this story
        - Only include reusable code that could be useful for this specific story
      - **If NOT exists**: This subsection will be omitted or minimal in the Story Plan

      Categories to extract (from the detailed files that were read):
      - **Components** (Frontend): UI components, layouts, HOCs with props/usage
      - **Utils/Helpers**: Utility functions, formatters, validators, transformers
      - **Middlewares**: Auth, error handling, validation, logging middlewares
      - **Services/Repositories**: Existing service classes, repositories, data access
      - **Styles** (Frontend): CSS/SCSS variables, mixins, utility classes, theme config
      - **Hooks** (Frontend): Custom React hooks, state management hooks
      - **Types/Interfaces**: Common types, DTOs, enums
      - **Validators**: Validation schemas (Joi, Yup, class-validator)
      - **Constants**: Config constants, enums, API routes

      For each, copy: location, description, usage, example

   j. **Wireframes / Screens / Flows** (only if ui_in_scope = true) - Extract/copy from the UX docs loaded in step 2.h:

      **j.1 Per-screen content** (from each screen.md loaded in h.1)
      - Pantalla name + route + audience + **viewports**
      - Block inventory (full Estructura table) with types, variants, levels, states and the Viewports column
      - **The complete "Layout por viewport" section, verbatim** — one subsection per viewport, with its rows and column fractions. Do NOT summarize it to "responsive": the fractions ARE the spec
      - Real microcopy per block (from Contenido section)
      - All applicable states with their real user-facing messages and bloque changes
      - Interactions (events, validations, feedback)
      - Decisions and discards relevant to this story scope

      **j.2 Surface navigation context** (from product-map.md, loaded in h.3)
      - Copy the "Estructura de Navegación" section verbatim so the implementor knows global navigation patterns (hamburger menu, drawers, tabs) and how the screen integrates with them.
      - Copy filtered "Inventario de Overlays" (overlays triggered from affected screens) — needed when the story modifies a screen that opens a drawer/modal/sheet.

      **j.3 Relevant user flows** (from user-flows.md, loaded in h.2)
      - Copy only the flows that mention any of the affected screens. For each flow, copy: JTBD, audience, trigger, happy path, alternative paths, errors and recovery, final state.
      - This gives the implementor end-to-end context: where the user comes from, what they expect after the action, what error paths must work.

      **j.4 Cross-surface flows** (from cross-surface-flows.md, loaded in h.4)
      - Copy only the flows that mention any affected surface/screen. Include sync method (real-time / polling / batch) and intermediate states.
      - Skip this subsection if no cross-surface flows apply.

      - **IMPORTANT**: copy the relevant sections verbatim. The Story Plan must be self-contained so the implementor doesn't need to open the product repo.
      - **Track which screens this story touches** — listed at the start of the section so the implementor knows the surfaces affected.

   k. **Design System Context** (only if ui_in_scope = true) - Extract/copy from DS files loaded in step 2.i.

      The DS is per surface. The Story Plan organizes the DS Context by surface (one subsection per affected surface). For EACH affected surface:

      - DS version pinned for this story (from `docs/design-system/{surface}/README.md`)
      - **Accent color de la superficie** — `color.brand.primary` de `foundations/color.md`. Es la ÚNICA
        fuente: si un screen.md todavía trae `accent_color` en su frontmatter, es una copia
        desactualizada de un valor de superficie y se ignora. Declararlo una vez para la superficie, no
        por pantalla; si los dos discrepan, dejarlo anotado para que se limpien los docs de UX.
      - Foundations relevant: copy color palette tables, typography scale, spacing scale, grid breakpoints, iconography rules — only the parts that apply.
      - Semantic tokens (the full table from `tokens/semantic.md`) — copy verbatim.
      - Component specs for components used in this story: copy the FULL spec for each (anatomy, variants, sizes, states, accessibility, content, do/don't, API). The implementor reads these to know how to render each block.
      - Patterns relevant (forms, empty-states, etc.) — copy if applicable.
      - Accessibility guidelines — always copy `guidelines/accessibility.md` for UI stories.
      - Content guidelines — copy if the story has significant microcopy.
      - **DS Gaps for this surface** — list any block types from the screen wireframes that have NO matching DS component spec yet in THIS surface's catalog, **separated in two groups**:
        - *Aceptados* — el REQ los resolvió como "Dejar anotado". Decisión consciente: el implementador
          los resuelve inline. Incluir la razón registrada en el REQ.
        - *Nuevos* — no estaban en la revisión UX (típico de una story sin REQ, o de un bloque que
          apareció al planificar). Acá sí hay que decidir: improvisar o disparar
          `/product-design-system-update`.
        La distinción importa: un gap aceptado no es un hallazgo, y presentarlo como tal hace que el
        implementador desconfíe de una decisión que ya se tomó.

      If the story only affects one surface, the subsection structure collapses to a single block — but always tag it with the surface name so it's explicit.

   **IMPORTANT:** Copy actual content, not references. The Story Plan must be self-contained.

   Inform user:
   ```markdown
   Contexto arquitectonico extraido

   Analizando alcance y proponiendo tareas...
   ```

### Step 4: Propose Tasks and Test Scenarios

**4.1 Analyze and Plan**

Based on story scope and extracted architectural context:

**Tasks:**
- Identify logical units of work
- Consider dependencies between tasks
- Size for AI agent execution (1-2 hours of focused work)
- Follow sequence: setup -> data -> logic -> API -> integration -> testing
- **For each task, identify which parts of the Architectural Context apply:**
  - ADRs to follow
  - Patterns/conventions to use
  - API/DB structures affected
  - Integration points needed
  - **Reusable code that can be leveraged** (components, utils, middlewares, styles, types, validators, constants)

**Test Scenarios (CRITICAL):**
- **Identify ALL possible test scenarios** - these will be used to validate the implementation is complete
- **Adaptive coverage (UI stories only)** — what to cover depends on the surface's platform:

  **`web`, or `mobile-app` with more than one viewport** — for each screen, cover every viewport whose layout differs, with two distinct kinds of scenario:
  1. **Presence** — a block that exists in only one viewport renders there and is absent in the other (a `sidebar` on desktop, a bottom `nav-bar` on mobile). Cheap, and catches the most common regression.
  2. **Arrangement** — the declared grid holds at the target width (cards 3-per-row at 1200px, stacked at 400px). Assert against the breakpoint (web) or size class (native tablet) declared in the Design System, never an arbitrary pixel value.

  **`mobile-app` with a single `phone` viewport** — there is no second layout to test, so do NOT invent viewport scenarios. Cover instead the two constraints the single layout must satisfy, from the grid foundation:
  1. **Safe areas** — a block anchored to an edge (bottom nav, fixed CTA) stays clear of the system insets. This is the regression that ships broken to notched devices.
  2. **Text scaling** — the screen survives the maximum declared scale (typically 200%) without truncating text or clipping blocks.

  In every case, do NOT duplicate viewport-independent scenarios (validation messages, API calls, error states): they are declared once in the screen.md and one scenario covers them. Duplicating per viewport doubles the suite for no coverage.
- Include:
  - **Happy path**: Normal flow with valid inputs
  - **Edge cases**: Boundary conditions, empty inputs, maximum values, etc.
  - **Error cases**: Invalid inputs, missing data, conflicts, authorization failures, etc.
  - **Integration scenarios**: How this service interacts with others
- Map each scenario to acceptance criteria
- Be exhaustive - missing scenarios mean incomplete validation

**Test Scenario Precision Rules:**
- **Input MUST use exact contract details** from the Architectural Context:
  - REST API: exact HTTP method + exact endpoint from API Context + example body with exact field names from API/DB Context
  - Worker/Job: exact message format with exact field names
  - Internal service: exact function signature with exact parameter types
- **Output MUST specify exact expected results:**
  - REST API: exact HTTP status code + response body structure with exact field names
  - Worker/Job: exact processing result or side effect
  - Internal service: exact return value or state change
- **NEVER paraphrase field names** -- copy verbatim from API Context and Database Context in the Architectural Context section
- **Include concrete example values** in every input/output (not "valid data" but `{ name: "Test User", email: "test@example.com" }`)
- The developer agent will translate these scenarios directly into test code -- ambiguity here becomes bugs in tests

**4.2 UI Preview (Frontend Only)**

**IMPORTANT:** This step ONLY applies when the resolved service is `frontend`. Determine the service
type from `docs/architectures/{{service_name}}/manifest.yaml` (`type:` field) — in multirepo you may use
`service.type` from `local-config.yaml`. If backend, skip to step 4.3.

**One preview per viewport.** The affected surface declares its platform and viewports in
`docs/ux/product-overview.md` ("Inventario de Superficies"), and each `screen.md` carries the
arrangement for each of them in its "Layout por viewport" section. Draw **one ASCII preview per
viewport the screen exists in** — a single preview cannot express a layout that differs by width, and
that ambiguity is what produces desktop UIs that are stretched mobile ones.

A screen on a single-viewport surface (typically a `mobile-app` with only `phone`) gets **one**
preview, and that is correct — do not draw a second one for a width the product does not have.

Use a frame proportional to the viewport so the preview reads correctly: narrow for `mobile`, wide for
`desktop`. Transcribe the rows and column fractions from the screen's layout section; do not invent an
arrangement that the screen.md does not declare. If the story only changes one viewport, still show
both and mark the untouched one as `sin cambios`.

For each UI change in the story, create an ASCII art preview showing structure and layout:

**For NEW screens or components:**
```
+-----------------------------------------+
| Screen/Component Name                   |
+-----------------------------------------+
|                                         |
|  +-------------------------------+      |
|  | [Element Name]                |      |
|  | Element description           |      |
|  +-------------------------------+      |
|                                         |
|  +----------+  +----------+             |
|  | Button A |  | Button B |             |
|  +----------+  +----------+             |
|                                         |
+-----------------------------------------+
```

**For CHANGES to existing screens/components:**
Show existing structure with new/modified elements highlighted:
```
+-----------------------------------------+
| Existing Screen                         |
+-----------------------------------------+
|                                         |
|  [Existing Header]                      |
|                                         |
|  +-------------------------------+      |
|  | [Existing Element]            |      |
|  +-------------------------------+      |
|                                         |
|  +===============================+      |  <- NUEVO
|  | [New Element Name]            |      |
|  | New element description       |      |
|  +===============================+      |
|                                         |
|  +----------+  +============+           |
|  | Existing |  | + New      |  <- NUEVO |
|  +----------+  +============+           |
|                                         |
+-----------------------------------------+

Leyenda:
+-+ = Elemento existente (sin cambios)
+=+ = Elemento NUEVO a agregar
[Modificado] = Elemento con cambios (describir que cambia)
```

**Example — same screen, two viewports:**
```
### mobile · 400px
+---------------------------+
| Listado de pedidos        |
+---------------------------+
|  [Buscador]               |
|  +=====================+  |  <- NUEVO
|  | Filtro por estado   |  |
|  +=====================+  |
|  +---------------------+  |
|  | Card pedido         |  |
|  +---------------------+  |
|  [nav-bar inferior]       |
+---------------------------+

### desktop · 1200px
+----------------------------------------------------------+
| Listado de pedidos                                       |
+----------------------------------------------------------+
| +----------+  +-------------------------------------+     |
| | sidebar  |  | [Buscador 8/12]  +===============+  |     |
| | - Pedidos|  |                  | Filtro  4/12  |  | <- NUEVO
| | - Clientes  |                  +===============+  |     |
| |  3/12    |  | +--------+ +--------+ +--------+   |     |
| |          |  | | Card   | | Card   | | Card   |   |     |
| |          |  | |  4/12  | |  4/12  | |  4/12  |   |     |
| +----------+  +-------------------------------------+     |
+----------------------------------------------------------+
```

**Guidelines for ASCII Preview:**
- Draw one preview per viewport, labeled `### {viewport} · {ancho}px`
- Annotate column fractions (`4/12`) so the implementor knows the intended grid, not just the shape
- Use single-line box characters (+ - + | + +) for existing elements
- Use double-line box characters (+ = + | + +) for NEW elements
- Add arrows (<-) with labels (NUEVO, MODIFICADO) to highlight changes
- Show relative positioning (where new elements go relative to existing ones)
- Include element names and brief descriptions
- For lists/grids, show 2-3 representative items
- For forms, show field names and types

**Persist the previews in the Story Plan.** They are not a chat artifact: write them verbatim into the
Story Plan's "UI Preview" section (see the story-plan template) when the plan is saved in step 5. A
preview that only ever existed in the conversation is lost to the implementor, which is the whole
point of the Story Plan being self-contained.

**4.3 Draft Proposal**

Present proposed tasks, UI preview (if frontend), and test scenarios to user (in Spanish):

```markdown
## Propuesta para {{story_id}}

**Servicio:** {{service_name}}

### Tareas Propuestas

#### Tarea 1: {{Task Title}}
**Categoria:** {{Setup/Data/Logic/API/Integration/Testing}}
**Descripcion:** {{brief description}}
**Usa del contexto:** {{brief mention of which ADRs/patterns/contexts apply}}
**Dependencias:** {{dependencies or "Ninguna"}}

#### Tarea 2: {{Task Title}}
...

**Total:** {{count}} tareas

---

{{IF_FRONTEND: Include this section only when service.type is 'frontend'}}
### UI Preview

{{Si la surface tiene más de un viewport: aclarar cuáles y que se muestra uno por cada uno}}

**Referencia visual de los cambios de interfaz:**

#### {{Screen/Component Name}}
{{ASCII art preview following format from 4.2}}

#### {{Another Screen/Component if applicable}}
{{ASCII art preview}}

**Leyenda:**
- `+-+` Elemento existente (sin cambios)
- `+=+` Elemento NUEVO
- `<- NUEVO` / `<- MODIFICADO` indica cambios

---
{{END_IF_FRONTEND}}

### Test Scenarios (Casos de Prueba End-to-End)

**IMPORTANTE:** Estos test scenarios seran usados para validar que la implementacion esta completa. El agente developer los traducira directamente a codigo de test. Por eso cada escenario usa los endpoints, campos y valores exactos de la documentacion tecnica.

| ID | Escenario | Input | Output Esperado | AC |
|----|-----------|-------|-----------------|-----|
| TS-1 | {{scenario}} | {{exact method + endpoint + body with field names}} | {{exact status + response with field names}} | AC-X |
| TS-2 | {{scenario}} | {{exact method + endpoint + body with field names}} | {{exact status + response with field names}} | AC-Y |
...

**Total:** {{count}} test scenarios

---

**Aprobas esta division y los test scenarios?**
{{IF_FRONTEND}}**El UI Preview refleja correctamente los cambios?** Falta algun elemento o la ubicacion no es correcta?{{END_IF_FRONTEND}}
**IMPORTANTE:** Falta algun caso de prueba? Pensa en edge cases, errores, y situaciones especiales.
```

**4.4 Wait for Approval and Refinement**

Wait for user confirmation. Iterate if:
- User wants to add/remove/modify tasks
- **User identifies missing test scenarios** (this is critical)
- User wants to adjust input/output expectations
- **(Frontend) User wants to adjust the UI Preview** - layout, positioning, elements

Emphasize that test scenarios are comprehensive before proceeding.

### Step 5: Create Story Plan Document

**5.1 Read Template Specification**

Read **Story Plan Template** from Files index to understand document structure.

**5.2 Create Complete Document**

Generate the complete Story Plan document with all sections:

- Document title
- Status section (initial status: `Ready`)
- Story Reference section
- Architectural Context section (with all extracted technical information - self-contained, no external references)
- **UI Preview section (frontend stories only)** — the ASCII previews from step 4.2, one per viewport, copied verbatim with their legend. Omit the section entirely for backend-only stories. Do not let the previews die in the chat: the Story Plan is the only thing the implementor reads
- Acceptance Criteria Coverage (table mapping ACs to tasks)
- Test Scenarios (table with all end-to-end test cases)
- All task sections (each with Status `Pending`, Description, Acceptance Criteria, Technical Details with Architectural Context References, Testing Requirements, Task Dependencies)

Set the `Service:` field of the Story Plan to the resolved **service_name**.

**Build the filename** — it is service-scoped:
```
{{story_filename}} = S-{{number}}.{{service_name}}.{{story_title_short}}
```
The `{{service_name}}` segment is mandatory (see Files index — Story Plans pattern). This is what lets
two services of the same story coexist in one `docs/story-plans/` folder (monorepo).

**5.3 Save and Request Validation**

1. Save complete document to file in **story_plans_folder** (resolved in Step 1 against the Step 0 mode):
   `{{story_plans_folder}}/{{story_filename}}.md`. In monorepo this is `docs/story-plans/` at the repo
   root — never a service-nested path.

   **Before notifying the user, verify (cheap checks that catch the whole error class):**
   - The file landed in the SAME folder as the existing Story Plans — list **story_plans_folder** and
     confirm the new plan sits next to its neighbors (e.g. other `S-*.{{service_name}}.*.md`).
   - No new folder tree was created to host the plan (e.g. no `services/{{service_name}}/docs/...`).
   - The Story Reference link to the story resolves (the target file exists).

2. Notify user:
   ```markdown
   Story Plan creado

   Archivo: docs/story-plans/{{story_filename}}.md
   Tareas: {{count}}

   **Revisa el archivo completo y decime si esta correcto o queres cambios.**
   ```

3. Wait for user validation:
   - **If user confirms:** Proceed to Step 6 (Summary)
   - **If user requests changes:** Apply changes, save again, and repeat step 5.3

### Step 6: Summary

Present final summary (in Spanish):

```markdown
## Story Plan Creado

**Story:** {{story_id}}
**Servicio:** {{service_name}}
**Archivo:** docs/story-plans/{{story_filename}}.md
**Status:** Ready

### Tareas Creadas

| # | Titulo | Categoria | Dependencias |
|---|--------|-----------|--------------|
| 1 | {{title}} | {{category}} | {{deps}} |
| 2 | {{title}} | {{category}} | {{deps}} |

### Test Scenarios

**Total:** {{count}} test scenarios documentados
- Happy path: {{count}}
- Error cases: {{count}}
- Edge cases: {{count}}

**Estos test scenarios seran usados para validar la implementacion completa.**

---

**Siguiente paso:**
-> Ejecuta `/service-implement-story {{story_id}} {{service_name}}` para implementar las tareas.
```

## Output

- `docs/story-plans/S-{number}.{service_name}.{title-short}.md` - Story Plan document with all tasks,
  scoped to one service. One file per affected service (multi-service stories produce multiple plans).

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

- **Step 1.4** (Resolve target service): In `--auto` the service MUST be resolvable without prompting.
  The orchestrator always passes `[service]` explicitly, so branch 1 (explicit arg) or branch 2 (single
  affected service) applies. If the service cannot be resolved (monorepo, multi-service, no arg), do NOT
  ask the user — ABORT with a failure report.

- **Step 1.5** (Check if already planified — for this service): Replace the wait block with:
  ```markdown
  [Auto] Re-planificando el servicio {{service_name}} — el plan existente será sobrescrito.
  ```
  Continue (overwrite).

- **Step 1.6** (Validate dependencies — unmet): Replace the wait block with:
  ```markdown
  [Auto] Continuando de todas formas (modo automático).
  ```
  Continue.

- **Step 4.3** (Draft Proposal): Skip presenting the proposal to the user. Proceed directly to Step 4.4.

- **Step 4.4** (Wait for Approval and Refinement): Replace the wait block with:
  ```markdown
  [Auto] Tareas y test scenarios aceptados — creando Story Plan.
  ```
  Continue directly to Step 5.

- **Step 5.3** (Save and Request Validation): Replace the wait block with:
  ```markdown
  [Auto] Story Plan aceptado — listo para implementación.
  ```
  Continue directly to Step 6.

- **Step 6** (Summary): Skip entirely — the subagent completes here and returns control to the orchestrator.
