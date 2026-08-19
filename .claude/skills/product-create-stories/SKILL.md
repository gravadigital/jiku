---
name: product-create-stories
description: Create story documents from a designed request - formalizes the story split into S-XXX documents
argument-hint: "[REQ-number] [--auto]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
---

# Create Stories

## Purpose

Create story documents from an already designed request. This is a **formalization command** that transforms a designed request into one or more Story documents, based on the story split proposed during the design phase.

**Flow:**
```
Step 0: Validate input (REQ-XXX required)
  |
Step 1: Initialize (Files index, config, folders)
  |
Step 2: Load & validate request (status: designed)
  |
Step 3: Review story split with user
  |
Step 4: Create story documents (for each approved story)
  |
Step 5: Update technical documentation (APIs, schemas) if needed
  |
Step 6: Update request (status: formalized)
  |
Step 7: Summary with implementation order
```

**Result:** One or more story documents created from designed request, request status updated to `formalized`.

**This command does NOT:**
- Capture or design requirements -- Use `/product-new-request` first
- Propose the story split -- Use `/product-design-request` first (it proposes the split)
- Split stories into tasks -- Use `/service-planify-story` after
- Define implementation tasks -- Use `/service-planify-story` after

## Role

**Adopt the Technical Leader Agent role** - Read [Technical Leader Agent](.claude/agents/technical-leader.md)

## CRITICAL RULES

1. **Use Spanish** for all user interactions and document content
   - Translate ALL content including section titles from English templates
   - Examples: "Goals" -> "Objetivos", "Background" -> "Contexto", "Success Criteria" -> "Criterios de Exito"
2. **Save first, then validate** - Save documents, notify user, wait for confirmation
3. **Reference locations from Files index** - Do not hardcode paths
4. **Do NOT dump full content in chat** - Save to file, show summary, let user review file directly
5. **Single story = no split validation** - If request proposes only 1 story, create it directly without asking user to confirm the split
6. **Multiple stories = validate split first** - If request proposes N stories, present the split and wait for user approval before creating any story
7. **Block if `ux_review: required`** - Requests with `ux_review: required` in the frontmatter MUST complete UX review via `/product-ux-request` before stories can be created. ABORT with a clear message pointing the user to that command.

## Execution

### Step 0: Validate Input

**CRITICAL: This command REQUIRES a request ID as parameter.**

Parse $ARGUMENTS as the REQ number:
- Accept any of these formats: `REQ-003`, `003`, `3` -- all resolve to `REQ-003`
- Extract the numeric part, zero-pad to 3 digits, prefix with `REQ-`

If user did NOT provide $ARGUMENTS:

```markdown
Este comando requiere un request como parametro.

**Uso:** `/product-create-stories REQ-XXX`

**Si aun no tenes un request:**
1. Ejecuta `/product-new-request` para capturar el requerimiento
2. Ejecuta `/product-design-request REQ-XXX` para diseniar la solucion tecnica
3. Luego usa este comando para crear las stories

**No se puede crear stories sin un request diseniado.**
```

**ABORT if no request provided.**

---

### Step 1: Initialize

1. Read [Files index](.claude/utils/index.md) to get all locations
2. Read `.claude/local-config.yaml` if it exists
3. Identify key folders:
   - **requests_folder** - Where to find requests
   - **stories_folder** - Where to save stories
   - **apis_folder** - API definitions (to update if needed)
   - **db_schemas_folder** - Database schemas (to update if needed)
   - **flows_folder** - System flows (to create/update if needed)

---

### Step 2: Load and Validate Request

1. **Load Request** from **requests_folder**

2. **Validate Status**
   - If status is NOT `designed`:
     ```markdown
     El request REQ-XXX no tiene status "designed".

     Status actual: {{status}}

     {{if status == "captured"}}
     Ejecuta `/product-design-request REQ-XXX` primero para diseniar la solucion tecnica.
     {{else if status == "formalized"}}
     Este request ya fue formalizado.
     {{else}}
     Ejecuta `/product-new-request` primero para capturar el requerimiento.
     {{endif}}
     ```
     **ABORT**

3. **Validate `ux_review` flag** from frontmatter:

   - If `ux_review: required`:
     ```markdown
     El request REQ-{{number}} tiene `ux_review: required`. No se pueden crear stories
     hasta que se complete la revision UX.

     **Ejecuta primero:** `/product-ux-request REQ-{{number}}`

     Esto va a:
     - Inferir el impacto en pantallas, overlays y flujos
     - Aplicar los cambios aprobados en la documentacion UX
     - Regenerar los wireframes
     - Marcar el request como `ux_review: done`

     Una vez completada la revision UX, volve a ejecutar este comando.
     ```
     **ABORT.**

   - If `ux_review: done` or `ux_review: not-applicable`: continue.

   - If `ux_review` is missing or any other value:
     ```markdown
     El request REQ-{{number}} no tiene el campo `ux_review` en el frontmatter.

     Probablemente fue diseniado bajo una version previa del flujo. Re-ejecuta
     `/product-design-request REQ-{{number}}` para que el technical-leader determine
     si necesita revision UX.
     ```
     **ABORT.**

4. **Extract from request:**
   - Functional requirements
   - Acceptance criteria
   - Technical design (complete section)
   - Story split proposal (from `## Story Split Propuesto` section)
   - UX review summary (from `## Revisión UX` section, if `ux_review: done`)

5. **Inform user (in Spanish):** "Cargue el request REQ-{{number}}. Tiene {{N}} stories propuestas. Voy a procesar el split."

---

### Step 3: Review Story Split

**3.1 If single story proposed:**

Skip validation. Inform user:

```markdown
El request propone **1 story**. Voy a crearla directamente.
```

Continue to Step 4.

**3.2 If multiple stories proposed:**

Present the proposed split to user:

```markdown
## Story Split Propuesto (del disenio tecnico)

El request REQ-{{number}} propone {{N}} stories:

| # | Titulo | Servicios Afectados | Dependencias |
|---|--------|---------------------|--------------|
| 1 | {{title_1}} | {{services_1}} | - |
| 2 | {{title_2}} | {{services_2}} | Story 1 |
| ... | ... | ... | ... |

**Aprobas este split?**
- **Si** -> Creo las {{N}} stories
- **Modificar** -> Decime que cambiar (agregar, quitar, renombrar, reordenar)
```

**WAIT for user response.**
- If approved: Continue to Step 4
- If changes requested: Apply changes to the split, present again, repeat until approved

---

### Step 4: Create Story Documents

**For each approved story, execute this sequence:**

**4.1 Read Template Specification**

Read **Story Template** from Files index to understand document structure, format, and examples.

**4.2 Generate Story ID**

- Check **stories_folder** for existing S-XXX files
- Find highest number, increment by 1
- Format: `S-001`, `S-002`, etc.
- Each story in the split gets a sequential ID

**4.3 Draft Story Document**

Based on the request content and the specific story scope, create the story document following the template structure.

**Template mapping from request to story:**

| Story Section | Source from Request | Transformation |
|---------------|---------------------|----------------|
| Header | Request metadata | Set status to "Ready", source: REQ-XXX |
| Frontmatter `affects_ui` | REQ frontmatter `ux_review` + this story's services | See "Determining affects_ui" below |
| User Story | Functional requirements (scoped to this story) | Transform to Como/Quiero/Para format |
| Acceptance Criteria | Request acceptance criteria (scoped to this story) | Keep Given-When-Then format, add detail if needed |
| Technical Design | "Disenio Tecnico" section (scoped to this story) | Extract relevant parts for this story |
| Affected Flows | "Flujos Afectados" section (scoped to this story) | Filter flows relevant to this story |
| Dependencies | Technical considerations + other stories in split | Express with S-XXX IDs |
| Source Reference | Request ID | Link to original request |

**Determining `affects_ui` for this story:**

- **Default starting point** = the parent REQ's `ux_review` value:
  - REQ has `ux_review: not-applicable` → `affects_ui: false`
  - REQ has `ux_review: done` (or `required`, edge case) → `affects_ui: true` as a candidate
- **Refine per story** using the story's "Servicios Afectados" — when the REQ touches UI but THIS specific story scopes to backend-only services (e.g. story 1 = backend changes in `user-service`, story 2 = frontend changes in `web-app`):
  - For each service in this story's affected services, read `docs/architectures/{service}/manifest.yaml` and check `type`
  - If ALL services in this story are `type: backend` → set `affects_ui: false` (overrides the REQ-level default)
  - If at least one service is `type: frontend` → keep `affects_ui: true`
- The result is written to the story's frontmatter and drives `/service-planify-story`'s decision to load UX/DS context.

**Important for Technical Design section:**
- For single-story requests: Copy complete technical design from request
- For multi-story requests: Extract ONLY the parts relevant to this specific story
  - Filter affected services to those relevant to this story
  - Filter API changes to those in this story's scope
  - Filter DB changes to those in this story's scope
  - Adapt interaction flow to this story's specific scenario

Generate the complete document in Spanish, following the examples in the template.

**4.4 Save Story**

Save story file in **stories_folder** with pattern: `S-{number}.{title-short}.md`

**4.5 Notify and Wait for Validation**

Present summary to user (in Spanish) - **DO NOT show full content**:

```markdown
Story guardada: S-{{number}} - {{title}}

Archivo: {{stories_folder}}/S-{{number}}.{{title_short}}.md
Origen: REQ-{{req_number}}
{{if multi_story}}Story {{current}} de {{total}}{{endif}}

Incluye:
- Historia de usuario
- {{N}} criterios de aceptacion
- Disenio tecnico ({{services_count}} servicios afectados)
- Dependencias

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**Wait for user response:**
- **If user confirms:** Continue to next story (or Step 5 if last story)
- **If user requests changes:** Apply changes to the file, save again, and repeat 4.5

**Repeat 4.2-4.5 for each story in the split.**

---

### Step 5: Update Technical Documentation

**Skip if no API, DB, or flow changes in any story.**

1. **Update API definitions** in **apis_folder** if any story has API changes
2. **Update database schemas** in **db_schemas_folder** if any story has DB changes
3. **Create/Update flow documents** in **flows_folder** if any story creates or modifies system flows:
   - **New flows:** Create document following **Flow Template** from Files index. Set status to "Draft" and reference the story IDs
   - **Modified flows:** Update existing document with changes from the design. Update `last_updated` date and add story ID to `stories` list

**Notify user:**

```markdown
Documentacion tecnica actualizada

Archivos modificados:
{{for each modified file}}
- `{{path}}` - {{brief description}}
{{endfor}}

**Revisa los archivos y decime si estan correctos o queres cambios.**
```

**Wait for user confirmation.**

---

### Step 6: Update Request

Update request file in **requests_folder**:
- Change status from `designed` to `formalized`
- Add field `targets: [S-XXX, S-YYY, ...]` with all created story IDs

---

### Step 7: Summary

Present final summary (in Spanish):

```markdown
**Stories creadas desde REQ-{{number}}**

Request: REQ-{{number}} - {{title}}
Status: formalized
Stories creadas: {{count}}

| Story | Titulo | Servicios | Dependencias |
|-------|--------|-----------|--------------|
| S-{{n1}} | {{title_1}} | {{services_1}} | - |
| S-{{n2}} | {{title_2}} | {{services_2}} | S-{{n1}} |
| ... | ... | ... | ... |

{{if apis_updated}}APIs actualizadas en **apis_folder**{{endif}}
{{if db_updated}}Schemas de BD actualizados en **db_schemas_folder**{{endif}}

---

**Orden de implementacion sugerido:**
1. S-{{n1}} - {{title_1}} (sin dependencias)
2. S-{{n2}} - {{title_2}} (despues de S-{{n1}})
...

**Siguiente paso:**
Ejecuta `/service-planify-story S-{{first_story}}` para dividir la primera story en tareas implementables.
```

## Output

- `docs/stories/S-{number}.{title-short}.md` - One or more story documents
- Updated `docs/requests/REQ-{number}.{title-short}.md` - Status `formalized`, added `targets: [S-XXX, ...]`
- Updated `docs/apis/{service}.yaml` - If stories have API changes
- Updated `docs/db-schemas/{database}.md` - If stories have DB changes
- Created/Updated `docs/flows/{flow-name}.md` - If stories create or modify system flows

---

## Auto Mode

When `$ARGUMENTS` contains `--auto`, strip the flag before parsing the REQ number and apply these overrides:

### Step 0: Parse `--auto`

- `REQ-001 --auto` → main arg: `REQ-001`, **auto_mode = ON**
- `REQ-001` → main arg: `REQ-001`, **auto_mode = OFF**

### Overrides

- **Step 3.2** (Review story split — multiple stories): Replace the wait block with:
  ```markdown
  [Auto] Split aceptado ({{N}} stories) — creando documentos.
  ```
  Continue directly to Step 4.

- **Step 4.5** (Notify and Wait for Validation — per story): Replace the wait block with:
  ```markdown
  [Auto] Story S-{{number}} aceptada — continuando.
  ```
  Continue to next story (or Step 5 if last story).

- **Step 5** (Update Technical Documentation — notification): Replace the wait block with:
  ```markdown
  [Auto] Documentación técnica aceptada — continuando.
  ```
  Continue directly to Step 6.

- **Step 7** (Summary): Skip entirely — the subagent completes here and returns control to the orchestrator.
