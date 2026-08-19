---
name: auto-implement-request
description: Automatically design, create stories, planify and implement a captured request end-to-end without user interaction
argument-hint: "[REQ-number]"
allowed-tools: "Read, Bash, Glob, Grep, Agent"
---

# Auto Implement Request

## Purpose

Orchestrate the complete implementation of a captured request end-to-end, from technical design through to committed code — without user interaction at intermediate steps.

**Flow:**
```
Step 0: Validate input and environment
  |
Step 1: Design request (skipped if already designed)
  |
Step 1.5: UX review (only if request has ux_review: required)
  |
Step 2: Create stories
  |
Step 3: For each story (in dependency order):
  For each affected service (planify + implement on the shared story branch):
    Step 3a: Planify story for the service
      |
    Step 3b: Implement service on feature/S-XXX_title (1st service creates it, rest continue on it)
  Step 3c: Once all services Done — merge feature/S-XXX_title → base branch, delete branch
  |
Step 4: Final summary
```

**Result:** All stories from the request implemented and committed on the current branch.

**This command does NOT:**
- Capture or modify the request — Use `/product-new-request` first
- Push to remote or create a PR — User handles this after reviewing the results
- Work on multirepo setups — Only supported in monorepo mode

## Role

**Adopt the Orchestrator Agent role** - Read [Orchestrator Agent](.claude/agents/orchestrator.md)

## CRITICAL RULES

1. **Monorepo only** - The repo must be a monorepo (detected by `docs/prd/` at the root, per the
   Configuration Resolution Convention). ABORT if it's a multirepo (see Step 0.2)
2. **Sequential subagents** - Launch one subagent at a time, wait for completion, verify filesystem state before continuing
3. **Never make technical decisions** - All technical work is delegated to subagents. If a subagent fails, stop and report — do not attempt to fix the issue
4. **Read filesystem to verify state** - After each subagent, read the relevant file to confirm the expected status change occurred
5. **Branch safety** - Record the current branch before starting. One feature branch per story (shared by all its services); merge and delete it **once, after all of the story's services are Done**, before moving to the next story. Never merge between services of the same story.
6. **Fail loudly** - On any failure, report exactly what was completed, what wasn't, and how to resume manually
7. **Never pause between steps** - After each subagent completes and verification passes, proceed immediately to the next step without waiting for user input. The only valid stops are ABORT on error or the final summary
8. **Use Spanish** for all user interactions

## Execution

### Step 0: Validate Input and Environment

**0.1 Parse REQ number**

Parse `$ARGUMENTS` as the REQ number:
- Accept: `REQ-003`, `003`, `3` — all resolve to `REQ-003`
- Extract the numeric part, zero-pad to 3 digits, prefix with `REQ-`

If no argument provided:
```markdown
Este comando requiere un request como parámetro.

**Uso:** `/auto-implement-request REQ-XXX`
```
**ABORT.**

**0.2 Validate configuration (monorepo required)**

This command is monorepo-only. Determine the mode following the **Configuration Resolution Convention**
in `rules/skill.md` — **check the monorepo signal first:**

1. **`docs/prd/` exists at the repo root** → **monorepo**. Paths from the Files index defaults. Continue.
   Ignore any `local-config.yaml` (stale in a monorepo). This is the expected setup — the file is no
   longer required.

2. **No `docs/prd/` but `.claude/local-config.yaml` exists** → **multirepo**. This command does not run:
   ```markdown
   Este comando solo funciona en modo **monorepo**.

   El repositorio actual está configurado como `multirepo`.
   La implementación automática en múltiples repos no está soportada.
   ```
   **ABORT.**

3. **Neither** → ABORT:
   ```markdown
   No encontré configuración ni documentación de producto en este repo.
   Si es un producto nuevo: ejecutá `/product-initialize`.
   ```
   **ABORT.**

**0.3 Read current branch**

Run `git branch --show-current` and store as **base_branch**.

Inform user (do NOT wait for response — continue immediately):
```markdown
Rama actual: **{{base_branch}}**
Cada story usa una rama (compartida por sus servicios), creada desde esta rama y mergeada de vuelta cuando todos sus servicios terminan.
```

**0.4 Load request and determine starting point**

1. Read [Files index](.claude/utils/index.md) to get **requests_folder**
2. Find the request file matching `REQ-{{number}}` in **requests_folder**
3. If not found:
   ```markdown
   No se encontró el request REQ-{{number}} en **requests_folder**.
   ```
   **ABORT.**

4. Read the request file and check `status`:
   - `captured` → will run design + (maybe UX review) + create stories + planify + implement
   - `designed` → will skip design; if `ux_review: required`, run UX review; then create stories + planify + implement
   - `formalized` → read `targets` field to get existing stories, skip to planify + implement
   - Any other status → **ABORT** with message explaining valid starting statuses

   If status is `designed`, also read the `ux_review` field from the frontmatter — store as **ux_review_value** for Step 1.5. (If `captured`, the field is set during Step 1 and read after.)

5. Inform user of detected starting point (do NOT wait for response — continue immediately):
   ```markdown
   Request: REQ-{{number}} - {{title}}
   Status actual: {{status}}
   {{if status == designed}}Revisión UX: {{ux_review_value}}{{end}}

   **Plan de ejecución:**
   {{if captured}}
   1. Diseñar request (determina si necesita revisión UX)
   2. (Si aplica) Procesar impacto UX
   3. Crear stories
   4. Planificar e implementar cada story
   {{else if designed && ux_review_value == required}}
   1. ~~Diseñar request~~ (ya diseñado)
   2. Procesar impacto UX (pendiente)
   3. Crear stories
   4. Planificar e implementar cada story
   {{else if designed}}
   1. ~~Diseñar request~~ (ya diseñado)
   2. ~~Revisión UX~~ ({{ux_review_value}})
   3. Crear stories
   4. Planificar e implementar cada story
   {{else if formalized}}
   1. ~~Diseñar request~~ (ya diseñado)
   2. ~~Revisión UX~~ (cerrada al formalizar)
   3. ~~Crear stories~~ (ya creadas: {{targets}})
   4. Planificar e implementar cada story
   {{end}}

   Iniciando...
   ```

---

### Step 1: Design Request

**Skip this step if request status is `designed` or `formalized`.**

**[Step 1/4]** Diseñando request REQ-{{number}}...

Use the **Agent tool** to launch a subagent with a clean context. The subagent must NOT inherit any context from this conversation. Pass `allowed_tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"]` to grant full permissions.

**CRITICAL: Pass ONLY the following prompt verbatim — do NOT add extra instructions or context:**
```
Ejecutá el skill product-design-request con los siguientes parámetros:
- Argumento: REQ-{{number}} --auto
- Modo: automático — no esperes confirmación del usuario en ningún paso

El skill debe completar todo su flujo sin interrupciones.
```

After subagent completes, verify:
- Read the request file from **requests_folder**
- Check that status is now `designed`
- If NOT `designed`: **ABORT** with failure report
- Read the `ux_review` field from the frontmatter — store as **ux_review_value** for Step 1.5

Inform user: **[Step 1/4]** ✓ Request diseñado. Revisión UX: {{ux_review_value}}.

---

### Step 1.5: UX Review

**Skip this step if `ux_review_value` is `not-applicable` or `done`.**

**Skip this step if the request was already `formalized` at Step 0** (the UX review window is closed by then).

**[Step 1.5/4]** Procesando impacto UX de REQ-{{number}}...

Use the **Agent tool** to launch a subagent with a clean context. The subagent must NOT inherit any context from this conversation. Pass `allowed_tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"]` to grant full permissions.

**CRITICAL: Pass ONLY the following prompt verbatim — do NOT add extra instructions or context:**
```
Ejecutá el skill product-ux-request con los siguientes parámetros:
- Argumento: REQ-{{number}} --auto
- Modo: automático — no esperes confirmación del usuario en ningún paso

El skill debe completar todo su flujo sin interrupciones (aplica el delta UX inferido directamente,
regenera los wireframes de las superficies afectadas, y marca ux_review: done).
```

After subagent completes, verify:
- Read the request file from **requests_folder**
- Check that `ux_review` is now `done`
- If NOT `done`: **ABORT** with failure report

Inform user: **[Step 1.5/4]** ✓ Revisión UX completada.

---

### Step 2: Create Stories

**Skip this step if request status was `formalized` at Step 0.**

**[Step 2/4]** Creando stories desde REQ-{{number}}...

Use the **Agent tool** to launch a subagent with a clean context. The subagent must NOT inherit any context from this conversation. Pass `allowed_tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"]` to grant full permissions.

**CRITICAL: Pass ONLY the following prompt verbatim — do NOT add extra instructions or context:**
```
Ejecutá el skill product-create-stories con los siguientes parámetros:
- Argumento: REQ-{{number}} --auto
- Modo: automático — no esperes confirmación del usuario en ningún paso

El skill debe completar todo su flujo sin interrupciones.
```

After subagent completes, verify:
- Read the request file from **requests_folder**
- Check that status is now `formalized`
- Read the `targets` field to get the list of created story IDs (e.g. `[S-001, S-002]`)
- If status is NOT `formalized` or `targets` is empty: **ABORT** with failure report

Store the list of story IDs as **story_ids**.

Inform user: **[Step 2/4]** ✓ Stories creadas: {{story_ids}}.

---

### Step 3: Planify and Implement Each Story (per affected service)

A story may affect **multiple services**. Planning is per `(story, service)` — each affected service
gets its own Story Plan and its own `Done` status. But the git branch is **one per story, shared by all
its services**: every service of a story commits to the same `feature/S-{{number}}_{{title_short}}`
branch, so later services build on earlier ones, and the story produces **one PR**. The branch is merged
to base **once, after all the story's services are Done** — NOT between services.

This step iterates over **stories** (in dependency order) and, within each story, over its
**affected services** (planify + implement each), then merges the story branch once at the end.

**Determine story execution order:**

For each story in **story_ids**, read the story file from **stories_folder** and extract its `dependencies` field. Build an ordered list that respects dependencies (stories with no dependencies first, then those that depend on completed ones).

Inform user (do NOT wait for response — continue immediately):
```markdown
**[Step 3/4]** Implementando {{count}} stories en orden:
{{ordered list with dependencies noted}}
```

**For each story in execution order:**

**Read the story's "Servicios Afectados" / "Affected Services" table.** Build the list of services with
status pending (skip any already `Done` and any marked `not-required`). If the table declares
dependencies between services, order them accordingly; otherwise use table order. Store as
**affected_services**.

Inform user (do NOT wait): **[Step 3/4 — S-{{number}}]** Servicios a implementar: {{affected_services}}.

**For each service in {{affected_services}}:**

#### 3a. Planify story for this service

**[Step 3/4 — S-{{number}} / {{service}} ({{current}}/{{total}})]** Planificando S-{{number}} ({{service}})...

Use the **Agent tool** to launch a subagent with a clean context. The subagent must NOT inherit any context from this conversation. Pass `allowed_tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"]` to grant full permissions.

**CRITICAL: Pass ONLY the following prompt verbatim — do NOT add extra instructions or context:**
```
Ejecutá el skill service-planify-story con los siguientes parámetros:
- Argumento: S-{{number}} {{service}} --auto
- Modo: automático — no esperes confirmación del usuario en ningún paso

El skill debe completar todo su flujo sin interrupciones.
```

After subagent completes, verify:
- Check that `docs/story-plans/S-{{number}}.{{service}}.*.md` exists (service-scoped filename)
- If NOT found: **ABORT** with failure report

Inform user: **[Step 3/4 — S-{{number}} / {{service}}]** ✓ Planificada.

#### 3b. Implement story for this service

**[Step 3/4 — S-{{number}} / {{service}} ({{current}}/{{total}})]** Implementando S-{{number}} ({{service}})...

Use the **Agent tool** to launch a subagent with a clean context. The subagent must NOT inherit any context from this conversation. Pass `allowed_tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"]` to grant full permissions.

**CRITICAL: Pass ONLY the following prompt verbatim — do NOT add extra instructions or context:**
```
Ejecutá el skill service-implement-story con los siguientes parámetros:
- Argumento: S-{{number}} {{service}} --auto
- Rama base: {{base_branch}} — para el PRIMER servicio de la story, creá la feature branch
  feature/S-{{number}}_{{title_short}} desde esta rama (NO valides que estés en "dev"). Para los
  servicios siguientes, la rama de la story ya existe: continuá sobre ella, NO crees una nueva ni
  vuelvas a la base.
- Modo: automático — no esperes confirmación del usuario en ningún paso

El skill debe completar todo su flujo sin interrupciones y commitear en la feature branch de la story.
```

After subagent completes, verify:
- Read the story file from **stories_folder**
- Check that **this service's** status in the "Servicios Afectados" table is `Done`
- If NOT `Done`: **ABORT** with failure report

Inform user: **[Step 3/4 — S-{{number}} / {{service}}]** ✓ Implementada (en `feature/S-{{number}}_{{title_short}}`).

**Continue to the next service of this story (same branch). Only once ALL the story's services are
`Done`, proceed to 3c (merge the story branch once).**

#### 3c. Merge and cleanup (once per story, after all services Done)

**This step is executed by the orchestrator directly using Bash — NOT delegated to a subagent.**
**Run it ONCE per story, after every affected service is `Done` — never between services.**

**[Step 3/4 — S-{{number}}]** Mergeando la rama de la story...

1. The story branch is `feature/S-{{number}}_{{title_short}}` (run `git branch` to confirm the exact name).
2. Run `git checkout {{base_branch}}`
3. Run `git merge feature/S-{{number}}_{{title_short}} --no-ff`
   - If merge conflict: **ABORT** with failure report. Do NOT force the merge.
4. Run `git branch -d feature/S-{{number}}_{{title_short}}`

Inform user (do NOT wait for response — continue immediately): **[Step 3/4 — S-{{number}}]** ✓ Story mergeada en `{{base_branch}}` (todos los servicios) y rama eliminada.

**Continue to the next story.**

---

### Step 4: Final Summary

Present final summary in Spanish:

```markdown
## Auto-implementación completada

**Request:** REQ-{{number}} - {{title}}
**Rama:** {{base_branch}}

### Stories implementadas

| Story | Título | Estado |
|-------|--------|--------|
| S-{{n1}} | {{title_1}} | ✓ Completada |
| S-{{n2}} | {{title_2}} | ✓ Completada |

### Commits realizados

Todos los commits están en la rama `{{base_branch}}`.
Ejecutá `git log --oneline` para revisarlos.

### Próximos pasos sugeridos

- Revisá los cambios con `git log --oneline` y `git diff {{base_branch}}~{{total_commits}}`
- Ejecutá los tests manualmente si querés verificar el comportamiento
- Si encontrás algún problema o querés hacer ajustes, ejecutá `/service-dev` para corregirlo sobre la rama actual con el contexto técnico completo cargado
- Cuando estés listo, creá un PR desde `{{base_branch}}`
```

## Output

- Request status updated to `formalized`
- Story documents created in **stories_folder**
- Story plan documents created in `docs/story-plans/`, one per affected service
  (`S-{number}.{service}.{title-short}.md`)
- Implementation code committed on **base_branch** (one feature branch per **story** —
  `feature/S-XXX_title`, shared by all its services — merged once per story)
- Each affected service's status updated to `Done` in the story's "Servicios Afectados" table
