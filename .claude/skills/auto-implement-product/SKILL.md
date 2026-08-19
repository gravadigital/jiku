---
name: auto-implement-product
description: Automatically implement all (or selected) feature groups from the PRD end-to-end without user interaction
argument-hint: "[\"feature group description or filter\"]"
allowed-tools: "Read, Bash, Glob, Grep, Agent"
---

# Auto Implement Product

## Purpose

Orchestrate the complete implementation of all feature groups defined in the PRD — or a specific subset — end-to-end without user interaction. For each feature group, it captures the request, designs the solution, creates stories, planifies and implements them.

**Flow:**
```
Step 0: Validate environment
  |
Step 1: Read PRD and identify feature groups to process
  |
Step 2: Filter already-covered feature groups
  |
Step 3: For each selected feature group (in order):
  Step 3a: Capture request  →  product-new-request "{feature}" --auto
  Step 3b: Implement request  →  auto-implement-request REQ-XXX
  |
Step 4: Final summary
```

**Result:** All selected feature groups implemented and committed on the current branch.

**This command does NOT:**
- Initialize the product or create technical architecture — Use `/product-initialize` and `/product-initialize-technical` first
- Work on multirepo setups — Only supported in monorepo mode
- Modify or review the PRD — Feature groups must already be defined

## Role

**Adopt the Orchestrator Agent role** - Read [Orchestrator Agent](.claude/agents/orchestrator.md)

## CRITICAL RULES

1. **Monorepo only** - The repo must be a monorepo (detected by `docs/prd/` at the root, per the
   Configuration Resolution Convention). ABORT if it's a multirepo (see Step 0.1)
2. **PRD must exist** - ABORT if PRD feature groups are not found
3. **Sequential execution** - One feature group at a time, wait for full completion before starting the next
4. **Never make technical or product decisions** - All work is delegated to subagents
5. **Read filesystem to verify state** - After each subagent, verify the expected files/statuses exist
6. **Fail loudly** - On any failure, report exactly what was completed, what wasn't, and how to resume manually
7. **Never pause between steps** - After each subagent completes and verification passes, proceed immediately to the next step without waiting for user input. The only valid stops are ABORT on error or the final summary
8. **Use Spanish** for all user interactions

## Execution

### Step 0: Validate Environment

**0.1 Validate configuration (monorepo required)**

Monorepo-only. Determine the mode following the **Configuration Resolution Convention** in
`rules/skill.md` — **check the monorepo signal first:**

1. **`docs/prd/` exists at the repo root** → **monorepo**. Paths from the Files index defaults. Continue.
   Ignore any `local-config.yaml` (stale in a monorepo). The config file is no longer required.
2. **No `docs/prd/` but `.claude/local-config.yaml` exists** → **multirepo**. Does not run:
   ```markdown
   Este comando solo funciona en modo **monorepo**.

   El repositorio actual está configurado como `multirepo`.
   ```
   **ABORT.**
3. **Neither** → ABORT:
   ```markdown
   No encontré configuración ni documentación de producto en este repo.
   Si es un producto nuevo: ejecutá `/product-initialize`.
   ```
   **ABORT.**

**0.2 Read current branch**

Run `git branch --show-current` and store as **base_branch**.

---

### Step 1: Read PRD and Identify Feature Groups

1. Read [Files index](.claude/utils/index.md) to get **prd_folder**, **requests_folder**, **stories_folder**

2. Read **PRD Feature Groups** from **prd_folder**
   - If not found:
     ```markdown
     No se encontró el archivo de feature groups del PRD.

     Este comando requiere que el PRD esté inicializado con feature groups definidos.

     **Ejecutá primero:**
     - `/product-initialize` para crear el PRD
     - `/product-initialize-technical` para crear la arquitectura técnica
     ```
     **ABORT.**

3. Extract the full list of feature groups with their numbers, titles and descriptions. Store as **all_feature_groups** (each entry includes: number, title, description).

**0.3 Interpret $ARGUMENTS**

Check if `$ARGUMENTS` was provided:

- **No arguments** → process all feature groups (after filtering covered ones in Step 2)
- **Text provided** → interpret the text as a natural language filter against **all_feature_groups**:
  - Read the feature group titles and descriptions
  - Select the ones that match the intent of the argument text
  - Example: `"feature groups 1 y 2"` → select first two feature groups
  - Example: `"módulo de autenticación"` → select feature groups related to authentication
  - Example: `"gestión de usuarios y pagos"` → select feature groups matching those topics
  - If no feature groups match the filter text:
    ```markdown
    No se encontraron feature groups que coincidan con: "{{arguments}}"

    **Feature groups disponibles:**
    {{numbered list of all feature groups}}

    Ejecutá el comando nuevamente con un filtro más preciso o sin argumentos para procesar todos.
    ```
    **ABORT.**

Store the selected list as **selected_feature_groups**.

Inform user (do NOT wait for response — continue immediately):
```markdown
**Feature groups seleccionados:** {{count}}
{{numbered list of selected feature groups with titles}}

Rama actual: **{{base_branch}}**
```

---

### Step 2: Filter Already-Covered Feature Groups

For each feature group in **selected_feature_groups**, determine if it already has coverage:

1. Read all files in **requests_folder** (REQ-XXX files) — extract titles and descriptions
2. Read all files in **stories_folder** (S-XXX files) — extract titles and descriptions

**Coverage heuristic:** A feature group is considered covered if there is at least one REQ or Story whose title/description clearly maps to that feature group.

- **Covered** → skip, log as already implemented
- **Not covered** → include in **pending_feature_groups**

If ALL selected feature groups are already covered:
```markdown
Todos los feature groups seleccionados ya tienen cobertura en requests o stories existentes.

No hay nada que procesar.
```
**Stop (not an error).**

Inform user (do NOT wait for response — continue immediately):
```markdown
**Resumen de cobertura:**
{{for each feature group}}
- {{title}}: {{✓ Ya cubierto (REQ-XXX / S-XXX) | → Pendiente}}
{{endfor}}

**A implementar:** {{count}} feature groups pendientes.
Iniciando...
```

---

### Step 3: Implement Each Feature Group

**For each feature group in **pending_feature_groups** (in order):**

#### 3a. Capture request

**[Feature {{current}}/{{total}}]** Capturando request para: "{{feature_group_title}}"...

Use the **Agent tool** to launch a subagent with a clean context. The subagent must NOT inherit any context from this conversation. Pass `allowed_tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]` to grant full permissions.

**CRITICAL: Pass ONLY the following prompt verbatim — do NOT add extra instructions or context:**
```
Ejecutá el skill auto-new-request-from-fg con los siguientes parámetros:
- Argumento: {{feature_group_number}}

El skill debe generar un REQ-XXX completo basándose en toda la documentación del producto disponible, resolviendo ambigüedades con supuestos documentados. No debe hacer preguntas al usuario.
```

After subagent completes, verify:
- Find the newly created REQ file in **requests_folder** (it will be the most recently created one or match the feature group title)
- Check its status is `captured`
- If not found or wrong status: **ABORT** with failure report

Store the new REQ number as **current_req**.

Inform user (do NOT wait for response — continue immediately): **[Feature {{current}}/{{total}}]** ✓ Request capturado: {{current_req}}

#### 3b. Implement request

**[Feature {{current}}/{{total}}]** Implementando {{current_req}}...

Use the **Agent tool** to launch a subagent with a clean context. The subagent must NOT inherit any context from this conversation. Pass `allowed_tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"]` to grant full permissions.

**CRITICAL: Pass ONLY the following prompt verbatim — do NOT add extra instructions, context, or state about what was already done. The subagent reads the filesystem and determines its own starting point:**
```
Ejecutá el skill auto-implement-request con los siguientes parámetros:
- Argumento: {{current_req}}
- La rama base actual es "{{base_branch}}" — todos los merges de feature branches deben hacerse sobre esta rama

El skill debe completar todo su flujo sin interrupciones: diseño técnico, stories, planificación e implementación.
```

After subagent completes, verify:
- Read the REQ file — status should be `formalized`
- Read the stories referenced in `targets` — all should have status `Done` (or at least `In Progress` for multi-service)
- If REQ is not `formalized`: **ABORT** with failure report

Inform user (do NOT wait for response — continue immediately): **[Feature {{current}}/{{total}}]** ✓ {{current_req}} implementado completamente.

**Continue to next feature group.**

---

### Step 4: Final Summary

```markdown
## Auto-implementación de producto completada

**Rama:** {{base_branch}}

### Feature groups implementados

| # | Feature Group | Request | Stories |
|---|---------------|---------|---------|
| 1 | {{title_1}} | {{req_1}} | {{stories_1}} |
| 2 | {{title_2}} | {{req_2}} | {{stories_2}} |
{{if skipped_count > 0}}

### Feature groups omitidos (ya tenían cobertura)

{{for each skipped}}
- {{title}} — cubierto por {{existing_req_or_story}}
{{endfor}}
{{endif}}

### Commits realizados

Todos los commits están en la rama `{{base_branch}}`.
Ejecutá `git log --oneline` para revisarlos.
```

## Output

- REQ documents created in **requests_folder** (one per feature group)
- Story documents created in **stories_folder**
- Story plan documents created in `docs/story-plans/`
- Implementation code committed on **base_branch**
- All story statuses updated to `Done`
