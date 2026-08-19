---
name: service-dev
description: Interactive developer mode - loads full service context and assists with code changes, questions, and implementation
argument-hint: "[service]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
---

# Dev Mode

## Purpose

Enter an interactive developer session with full technical context loaded. The developer agent is available to assist with whatever the user needs: answering questions, exploring code, implementing changes, fixing bugs, refactoring, etc.

**Flow:**
```
Step 0: Validate config
  |
Step 1: Load full technical context
  |
Step 2: Inform user that context is ready
  |
Loop: Attend user requests
  |
  If implementation was done:
    - Run tests (new + existing)
    - Quality verification (build, lint, tests)
    - Present changes for approval
    - User approves or requests adjustments
    |
  Ask: more changes or commit?
    - More changes -> back to loop
    - Commit -> create commit
```

**Result:** Developer agent ready with full context, assisting interactively.

**This command does NOT:**
- Create stories or plans
- Follow a predefined task list
- Create feature branches (works on current branch)
- Update product documentation (APIs, schemas, flows)
- Run QA subagent review

For structured implementation from a story plan, use `/service-implement-story`.

## Role

**Auto-detect the service type** (resolved in Step 0): **monorepo** → from
`docs/architectures/{{service}}/manifest.yaml` (`type:`); **multirepo** → from `.claude/local-config.yaml`
(`service_type`):
- If type is `backend` -> Read [Backend Developer Agent](.claude/agents/backend-developer.md)
- If type is `frontend` -> Read [Frontend Developer Agent](.claude/agents/frontend-developer.md)

## CRITICAL RULES

1. **Use Spanish** for all user interactions
2. **Reference locations from Files index** - Do not hardcode paths
3. **MANDATORY architecture compliance** - Follow the loaded architectural context (ADRs, patterns, conventions)
4. **MANDATORY reuse** - Use existing reusable code when applicable. Do NOT create duplicates
5. **Test-first when implementing** - If the user requests a code change, write/update tests FIRST, then implement. Tests define "done"
6. **Quality verification after every implementation** - After any code change, run build, lint, and tests. Fix issues before presenting to user
7. **Never commit without approval** - Always present changes and wait for explicit user approval before committing
8. **Stay in context** - All architectural context, conventions, and patterns come from the loaded documentation. Follow them strictly

## Execution

### Step 0: Resolve Configuration & Service

Resolve mode and paths following the **Configuration Resolution Convention** in `rules/skill.md`.
**Check the monorepo signal first:**

1. **`docs/prd/` exists at the repo root** → **monorepo**. Paths from the Files index defaults; product
   repo is the root. **Ignore any `local-config.yaml`** (stale — warn once). Do NOT abort. Continue to
   step 1b to pick the service.
2. **No `docs/prd/` but `.claude/local-config.yaml` exists** → **multirepo**. Use it (`service_type`,
   `service_name`, `product_repo`, `paths`). Skip to step 2 (role).
3. **Neither** → ABORT:
   ```markdown
   No encontré configuración de servicio ni documentación de producto en este repo.

   - Si es un producto nuevo: ejecutá `/product-initialize`.
   - Si es un repo de servicio (multirepo): ejecutá `/service-setup-repo` para configurarlo.
   ```
   **ABORT immediately.**

1b. **Pick the service** (monorepo only — `service-dev` is interactive and has no story to infer it from):
   - If `[service]` was passed as argument → use it.
   - Else, list the services under `docs/architectures/*/` and:
     - exactly one → use it;
     - more than one → ask the user which one with `AskUserQuestion`.
   Store as **service_name**.

2. **Resolve service type and assign role:**
   - **Monorepo:** read `docs/architectures/{{service_name}}/manifest.yaml` `type:` field. If missing/no
     type, ABORT pointing to `/product-create-{backend,frontend}-architecture` / `/product-migrate-architecture`.
   - **Multirepo:** use `service_type` from `local-config.yaml`.
   - If type is `backend` -> Backend Developer Agent
   - If type is `frontend` -> Frontend Developer Agent

### Step 1: Load Full Technical Context

Read [Files index](.claude/utils/index.md) to get all locations, then load:

**1.1 Service Architecture (MANDATORY)**

Read from **architectures_folder/[service-name]/**:
- First, read `index.md` to discover all architecture documents
- Then, read ALL documents linked in the index (overview.md, structure.md, apis.md, database.md, testing.md, deployment.md, etc.)

**1.2 API Definitions**

Read ALL API specs from **apis_folder** for the current service:
- OpenAPI YAML files
- Understand existing endpoints, request/response formats

**1.3 Database Schemas**

Read relevant DB schemas from **db_schemas_folder**:
- DBML and markdown schema files for the current service
- Understand existing entities, relationships, fields

**1.4 ADRs**

Read ALL ADRs from **adrs_folder**:
- Understand all technical decisions and constraints
- Pay special attention to Implementation Rules (enforceable constraints)

**1.5 System Flows**

Read ALL flow documents from **flows_folder**:
- Understand all cross-service interactions involving this service
- Note exact field names and types (authoritative for cross-service contracts)

**1.6 Reference Documents**

Read `product_references` path from `.claude/local-config.yaml`.
Check if **references_folder** exists and contains `index.md`:

**If exists:**
- Read `index.md` to see all available references
- Identify references relevant to this service (match `Servicios` field against current service name)
- Read relevant references following the reading hints in the index

**If NOT exists:** Skip silently.

**1.7 Reusable Code Documentation**

Resolve **reusable_code_folder** for the service picked in Step 0 (**service_name**; see Files index):
`docs/reusable-code/` in multirepo, `docs/reusable-code/{{service_name}}/` in monorepo. Check if
**reusable_code_folder**`/index.md` exists:

**If exists:**
- Read **reusable_code_folder**`/index.md` (compact index)
- Read ALL detail files for the current service type (from **reusable_code_folder**):
  - Frontend: `components.md`, `hooks.md`, `styles.md`, `utils.md`, `types.md`, `constants.md`
  - Backend: `middlewares.md`, `services.md`, `validators.md`, `utils.md`, `types.md`, `constants.md`

**If NOT exists:**
- Note it but do not block — inform user in Step 2

**1.8 Identify Project Commands**

From README or package.json, identify:
- Build command
- Lint command
- Test command
- Frontend-specific: Dev server command, type check command

### Step 2: Context Ready

Inform user (in Spanish):

```markdown
Dev mode activo para **{{service_name}}** ({{service_type}})

**Contexto cargado:**
- Arquitectura: {{section_count}} secciones
- APIs: {{list or "Ninguna"}}
- Schemas de BD: {{list or "Ninguno"}}
- ADRs: {{count}} decisiones
- Flujos: {{count or "Ninguno"}}
- Referencias externas: {{list relevant or "Ninguna"}}
- Codigo reutilizable: {{status — "cargado" or "no disponible, ejecuta /service-update-reusable-code"}}

Estoy listo. Decime que necesitas.
```

**Do NOT ask a specific question. Let the user drive the interaction.**

### Loop: Attend User Requests

From this point, respond to whatever the user needs. This includes but is not limited to:
- Answering questions about the codebase or architecture
- Explaining how something works
- Exploring code
- Implementing a change (bugfix, feature, refactor, config change)
- Reviewing code
- Any other developer task

**When the user requests a code change (implementation):**

Follow this sub-flow:

#### A. Implement with test-first

1. Understand the change requested
2. Identify files to create/modify
3. Write/update tests FIRST based on expected behavior
4. Implement the change until tests pass
5. Follow loaded architectural context strictly (ADRs, patterns, conventions, reusable code)

#### B. Quality verification

Run IN ORDER, fix issues before proceeding:

1. **Type checking (Frontend only):** Run type check command
2. **Build:** Run build command
3. **Lint:** Run lint command
4. **Tests:** Run ALL tests (not just new ones)

#### C. Present changes for approval

```markdown
Cambios realizados:

**Archivos modificados:**
- `{{path}}` - {{brief description}}
- `{{path}}` - {{brief description}}

**Archivos creados:**
- `{{path}}` - {{brief description}}

**Tests:**
- {{count}} tests nuevos/modificados
- Todos los tests pasan

**Revisa los cambios y decime si los aprobas o queres ajustes.**
```

**Wait for user response:**
- **If user requests adjustments:** Apply them, re-run quality verification, present again
- **If user approves:** Ask next question

#### D. Ask what's next

```markdown
Cambios aprobados.

**Queres:**
1. Hacer mas cambios
2. Commitear los cambios actuales
```

**If more changes:** Return to loop, attend next request.

**If commit:**

1. Stage all changed files
2. Ask user for commit message or suggest one based on changes:
   ```markdown
   Sugerencia de mensaje de commit:
   `{{type}}({{scope}}): {{description}}`

   Queres usar este mensaje o escribir otro?
   ```
3. Create commit with user's chosen message
4. Inform user:
   ```markdown
   Commit creado: `{{short_hash}}` - {{message}}

   Queres seguir trabajando o terminamos?
   ```
5. If user wants to continue -> return to loop
6. If user wants to finish -> end session

## Output

- Code changes implemented and tested
- Git commit(s) on current branch (only after user approval)
