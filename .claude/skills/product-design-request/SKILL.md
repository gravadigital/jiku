---
name: product-design-request
description: Design technical solution for a captured request - analyzes impact on APIs, schemas, and proposes story split
argument-hint: "[REQ-number] [--auto]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
---

# Design Request

## Purpose

Design the technical solution for a captured request based on existing documentation.
Every technical decision must cite a specific document.

**Flow:**
```
Step 0: Validate input (REQ-XXX required)
  |
Step 1: Initialize (Files index, config, folders)
  |
Step 2: Load & validate request (status: captured)
  |
Step 3: Read technical documentation (architectures, APIs, schemas, ADRs, flows)
  |
Step 4: Analyze impact (detailed analysis)
  |
Step 5: Propose story split
  |
Step 6: Draft, save & validate technical design
  |
Step 7: Show next steps
```

**Result:** Request file updated with technical design, status changed to `designed`, and `ux_review` flag set to either `required` (UI impact detected) or `not-applicable` (purely backend / infrastructure changes).

**This command does NOT:**
- Create story documents -- Use `/product-create-stories` after this command
- Update API definition or schema files -- Handled during story creation
- Define implementation tasks -- Use `/service-planify-story`
- Apply UX changes (new screens, modified flows) -- Use `/product-ux-request` after this command when `ux_review: required`

## Role

**Adopt the Technical Leader Agent role** - Read [Technical Leader Agent](.claude/agents/technical-leader.md)

## CRITICAL RULES

1. **MUST read technical documentation** - Architectures, APIs, schemas are MANDATORY
2. **Every decision must cite documentation** - No "inventing" solutions
3. **Save first, then validate** - Save documents, notify user, wait for confirmation
4. **Use Spanish** for all user interactions and document content
   - Translate ALL content including section titles from English templates
   - Examples: "Goals" -> "Objetivos", "Background" -> "Contexto", "Success Criteria" -> "Criterios de Exito"
5. **Reference locations from Files index** - Do not hardcode paths
6. **Do NOT dump full content in chat** - Save to file, show summary, let user review file directly
7. **Always do detailed analysis** - The level of detail adjusts naturally to the request complexity (simple requests have fewer services/endpoints to analyze)
8. **Determine UX impact and set `ux_review`** - As part of impact analysis (Step 4), evaluate whether the request affects any UI surface. Set the frontmatter field `ux_review: required` if any service of type `frontend` is in "Servicios Afectados", any backend change surfaces user-visible data, navigation changes, or new flows touch existing screens. Set `ux_review: not-applicable` only for purely backend changes with NO downstream effect on what users see (internal refactors, infrastructure, observability, async pipelines that don't change UI behavior). When in doubt, lean toward `required`.

## Execution

### Step 0: Validate Input

**CRITICAL: This command REQUIRES a request ID as parameter.**

Parse $ARGUMENTS as the REQ number:
- Accept any of these formats: `REQ-003`, `003`, `3` -- all resolve to `REQ-003`
- Extract the numeric part, zero-pad to 3 digits, prefix with `REQ-`

If user did NOT provide $ARGUMENTS:

```markdown
Este comando requiere un request como parametro.

**Uso:** `/product-design-request REQ-XXX`

**Si aun no tenes un request:**
Ejecuta `/product-new-request` primero para capturar el requerimiento.
```

**ABORT if no request provided.**

### Step 1: Initialize

1. Read [Files index](.claude/utils/index.md) to get all locations
2. Read `.claude/local-config.yaml` if it exists
3. Identify key folders:
   - **requests_folder** - Where to find the request
   - **architectures_folder** - Service architectures
   - **apis_folder** - API definitions
   - **db_schemas_folder** - Database schemas
   - **adrs_folder** - Architectural decisions
   - **flows_folder** - System flow documentation

### Step 2: Load and Validate Request

1. **Load Request** from **requests_folder**

2. **Validate Status**
   - If status is NOT `captured`:
     ```markdown
     El request REQ-XXX no tiene status "captured".

     Status actual: {{status}}

     {{if status == "designed"}}
     Este request ya fue diseniado. Podes crear las stories con:
     - `/product-create-stories REQ-XXX`
     {{else}}
     Ejecuta `/product-new-request` primero para capturar el requerimiento.
     {{endif}}
     ```
     **ABORT**

3. **Extract from request:**
   - Functional requirements
   - Acceptance criteria
   - Complexity (baja/media/alta)

4. **Check for Domain Entity impact:**

   If the request contains a `## Impacto en Domain Entities` section:

   - Read the current `docs/prd/requirements.md` Domain Entities section
   - For each **new entity** proposed: validate it makes sense given technical architecture (does it need its own table? which service owns it?), then add it to the Domain Entities section with full detail (attributes, types, relationships, business rules)
   - For each **modification to existing entity**: validate the change is consistent with current schema and architecture, then apply it to the Domain Entities section
   - Save `docs/prd/requirements.md` after all changes
   - Notify user:

   ```markdown
   Domain Entities actualizado en `docs/prd/requirements.md`:
   - [Entidad nueva / Modificacion aplicada]
   ```

   If the request does NOT contain `## Impacto en Domain Entities`, skip this step.

5. **Inform user (in Spanish):** "Cargue el request REQ-{{number}}. Complejidad: {{complexity}}. Voy a analizar el impacto tecnico."

### Step 3: Read Technical Documentation (MANDATORY)

**CRITICAL: This step is NOT optional. ABORT if documentation doesn't exist.**

**Must read ALL of these from their respective folders (see Files index):**

1. **Architectures** - All files in **architectures_folder**
   - List all architecture documents found
   - If NONE exist -> ABORT with message:
     ```markdown
     No hay documentos de arquitectura.

     Este comando requiere documentacion tecnica existente para diseniar la solucion.

     **Ejecuta primero:**
     - `/product-create-backend-architecture` para servicios backend
     - `/product-create-frontend-architecture` para servicios frontend
     ```

2. **API Definitions** - All files in **apis_folder**
   - List all API documents found
   - Note which services have API documentation

3. **Database Schemas** - All files in **db_schemas_folder**
   - List all schema documents found
   - Note which databases are documented

4. **ADRs** - All files in **adrs_folder**
   - List relevant architectural decisions

5. **System Flows** - All files in **flows_folder**
   - List all flow documents found
   - Identify which flows relate to the request being designed
   - Note which flows will be MODIFIED by this request
   - Note if NEW flows need to be created

6. **Reference Documents** - Read `index.md` from **references_folder** (if folder exists)
   - Read the index to see all available references with their descriptions and services
   - Identify which references are RELEVANT to the request being designed (by description and services match)
   - **Read ONLY the relevant reference files** following the reading hints in the index
   - If no references exist or none are relevant, skip silently

**Inform user (in Spanish) what was found:**

```markdown
Lei la documentacion tecnica:

**Arquitecturas:**
- [x] [architecture file 1]
- [x] [architecture file 2]

**APIs:**
- [x] [api file 1]
- [ ] [service name] - NO EXISTE

**Schemas de BD:**
- [x] [schema file 1]

**ADRs relevantes:**
- [x] [adr file 1]

**Flujos del sistema:**
- [x] [flow file 1]
- [x] [flow file 2]
- [ ] No existen flujos documentados

**Referencias externas:**
- [x] [reference file 1] - [resumen relevante]
- [ ] No existen / No son relevantes

Voy a analizar el impacto tecnico basandome en estos documentos.
```

**Continue automatically to Step 4. Do NOT wait for user confirmation.**

### Step 4: Analyze Impact

Perform detailed technical analysis. The level of detail adjusts naturally to request complexity (simple requests have fewer services/endpoints to analyze).

**4.1 Identify Affected Services**

For each service:
- Read its architecture document completely
- Identify specific components that need changes
- Note file paths and patterns from architecture

**4.2 Analyze API Changes**

**CRITICAL: When referencing EXISTING endpoints, copy the exact field names and types from the OpenAPI YAML. Do NOT paraphrase or rename fields.**

For modifications to existing endpoints:
- Copy the current request/response structure verbatim from the API spec
- Mark additions with `+ NUEVO`
- Mark modifications with `-> MODIFICADO`
- Mark removals with `- ELIMINADO`

For each affected service with API:
- Read the API documentation
- Find existing endpoints that relate to the requirement
- Identify:
  - Endpoints to MODIFY (cite line numbers, copy current structure)
  - New endpoints NEEDED
  - Endpoints that can be REUSED as-is

**4.3 Analyze Database Changes**

For each database:
- Read the schema documentation
- Find existing tables/collections that relate
- Identify:
  - Tables to MODIFY (cite specific fields)
  - New tables NEEDED
  - Existing tables that can be REUSED as-is

**4.4 Draft Interaction Flow**

Based on acceptance criteria and technical analysis, design the end-to-end service interaction flow:

- Start from the trigger (user action, event, scheduled job, etc.)
- Map the complete journey through all services
- Include specific endpoints to be called
- Note events published/consumed (if event-driven)
- Identify data transformations between services
- Mark critical decision points and error paths
- Show the final outcome (response to user, side effects, etc.)

**Format:**
```
[Trigger] -> Service A -> Service B -> ... -> [Outcome]
```

For each step, specify:
- What endpoint/method is called (e.g., `POST /api/users`)
- What data is sent/received
- What events are published (if any)
- Error scenarios and fallbacks

**Edge cases:**
- **Single service:** Show internal component flow if relevant, or skip if trivial
- **Multiple flows:** Create separate diagrams for each acceptance criterion if they differ significantly
- **Refactors:** Show "before" and "after" flows if architecture changes

**4.5 Analyze Flow Impact**

For each existing flow affected by this request:
- Read the complete flow document from **flows_folder**
- Identify which steps change, are added, or are removed
- Note new cross-service interactions not covered by existing flows

For new features with cross-service interactions:
- Draft complete flows following the **Flow Template** from Files index
- Ensure all field names match the OpenAPI YAML specs and DBML schemas

**CRITICAL:** When referencing endpoints or DB fields in the flow analysis,
copy the exact field names and types from **apis_folder** and **db_schemas_folder**.
Do NOT paraphrase or rename fields.

**4.6 External Integration Considerations**

For each relevant reference document identified in Step 3.6:
- Note constraints that affect the design (rate limits, auth requirements, webhook formats, error codes, etc.)
- Ensure API changes and interaction flows account for external API contracts
- Cite the reference document when making design decisions based on external constraints

**4.7 Evaluate UX Impact**

Determine whether the request affects any UI surface. Output a single value: `required` or `not-applicable`. This drives the `ux_review` frontmatter field.

**Set `ux_review: required` if ANY of these is true:**
- One or more services in "Servicios Afectados" has `type: frontend` (per `architectures/{service}/manifest.yaml`)
- A backend change exposes new or modified user-visible data (new endpoint that the frontend will call, modified response that changes what the user sees)
- The "Flujo de Interacción" includes user actions (clicks, form submits, navigation)
- "Flujos Afectados" mentions changes to flows that include UI steps
- A new domain entity will appear in lists, detail screens, or forms
- New navigation between screens is needed

**Set `ux_review: not-applicable` ONLY if ALL of these hold:**
- No frontend service is affected
- The change is purely internal (refactor, infrastructure, observability, async pipeline that doesn't surface to UI)
- No user-visible behavior changes
- No new domain entity that users will see

**When in doubt, default to `required`.** A misclassification toward `required` only costs an extra step (the user can confirm "no impact" in `/product-ux-request`); a misclassification toward `not-applicable` skips UX review entirely.

Store the decision as **ux_review_value** — used in Step 6.3.

---

### Step 5: Propose Story Split

Based on the technical analysis, propose how to split the work into stories.

**5.1 Determine Split**

- **Simple requests** (1 service, low complexity): Propose 1 story
- **Medium requests** (2 services, medium complexity): Propose 2-3 stories
- **Complex requests** (3+ services, high complexity): Propose 4+ stories

For each proposed story:
- Title (descriptive, action-oriented)
- Brief description (1-2 sentences)
- Services affected
- Dependencies on other stories in the split (if any)

**5.2 Include in Technical Design**

The story split will be saved as a new section `## Story Split Propuesto` in the request document (see Step 6).

Format:

```markdown
## Story Split Propuesto

| # | Titulo | Descripcion | Servicios | Dependencias |
|---|--------|-------------|-----------|--------------|
| 1 | {{title}} | {{brief description}} | {{services}} | - |
| 2 | {{title}} | {{brief description}} | {{services}} | Story 1 |

**Orden de implementacion sugerido:**
1. {{title_1}} - {{razon por la que va primero}}
2. {{title_2}} - {{razon}}
```

---

### Step 6: Present Technical Design

**6.1 Read Template Specification**

Read **Request Template** from Files index to understand the design phase structure, format, and examples.

**6.2 Draft Technical Design**

Following the template structure, draft the complete technical design (in Spanish). Always use detailed format with specific endpoints, fields, and validations:

```markdown
## Disenio Tecnico

### Contexto Tecnico

Documentos consultados:
- [x] [architecture file] - [resumen relevante]
- [x] [api file] - [resumen relevante]
- [x] [schema file] - [resumen relevante]

### Servicios Afectados

| Servicio | Impacto | Referencia | Cambios Necesarios |
|----------|---------|------------|-------------------|
| service-a | Alto | [architecture file] | Nuevo endpoint, modificar tabla X |
| service-b | Medio | [architecture file] | Consumir nuevo endpoint |

### Cambios de API

#### Endpoints Existentes a Modificar

**`GET /api/users/:id`** (ref: [api file]:linea)
- **Cambio:** Agregar campo `preferences` en response
- **Justificacion:** Requerimiento funcional #2 necesita mostrar preferencias

#### Nuevos Endpoints Necesarios

**`POST /api/users/:id/preferences`**
- **Servicio:** user-service
- **Descripcion:** Actualizar preferencias del usuario
- **Request/Response:** [estructura basica]
- **Justificacion:** Requerimiento funcional #3

### Cambios de Base de Datos

#### Tablas Existentes a Modificar

**`users`** (ref: [schema file]:linea)
- **Agregar campo:** `preferences JSONB DEFAULT '{}'`
- **Indice:** No necesario (acceso por PK)
- **Migracion:** Agregar columna con default, sin downtime

#### Nuevas Tablas

Ninguna necesaria.

### Flujo de Interaccion

#### Escenario: [Nombre del criterio de aceptacion principal]

**Trigger:** [Accion del usuario o evento que inicia el flujo]

**Flujo:**

1. **[Frontend/Cliente]**
   - Accion: `POST /api/users/:id/preferences`
   - Payload: `{ "theme": "dark", "language": "es" }`
   - -> Envia request a **user-service**

2. **[user-service]**
   - Endpoint: `POST /api/users/:id/preferences`
   - Accion: Valida payload y actualiza BD
   - DB: `UPDATE users SET preferences = $1 WHERE id = $2`
   - Response: `200 OK { "preferences": {...} }`
   - -> Devuelve confirmacion al cliente

**Outcome:** Usuario recibe confirmacion inmediata en UI

**Manejo de errores:**
- Si validacion falla -> 400 Bad Request con detalles
- Si usuario no existe -> 404 Not Found

### Consideraciones Tecnicas

#### Riesgos
- [riesgo 1 y mitigacion]

#### Dependencias
- [dependencias entre servicios]

#### Performance
- [consideraciones si aplica]

#### Seguridad
- [consideraciones si aplica]

### Flujos Afectados

#### Flujos Existentes Modificados
- **{flow-name}** (ref: **flows_folder**/{flow-name}.md)
  - Paso {N}: {descripcion del cambio}

#### Nuevos Flujos
- **{flow-name}**: {descripcion breve}
  - Trigger: {que lo dispara}
  - Servicios: {servicios involucrados}

### Referencias Externas Consultadas

| Referencia | Relevancia | Restricciones Clave |
|------------|-----------|---------------------|
| {reference_file} | {por que es relevante para este request} | {rate limits, auth, error codes, formatos, etc.} |

_(Omitir esta seccion si no se consultaron referencias externas)_

## Story Split Propuesto

| # | Titulo | Descripcion | Servicios | Dependencias |
|---|--------|-------------|-----------|--------------|
| 1 | {{title}} | {{brief description}} | {{services}} | - |

**Orden de implementacion sugerido:**
1. {{title_1}} - {{razon}}
```

**6.3 Save Design**

1. Add the technical design sections AND story split to the request file
2. Update status from `captured` to `designed`
3. Add `ux_review: {{ux_review_value}}` to the frontmatter (the value determined in Step 4.7)
4. Save the file to **requests_folder**

**6.4 Notify and Wait for Validation**

Present summary to user (in Spanish) - **DO NOT show full content**:

```markdown
Disenio tecnico guardado

Archivo: {{requests_folder}}/REQ-{{number}}.{{title_short}}.md
Status: designed
Revision UX: {{ux_review_value}}

**Secciones agregadas:**
- Contexto Tecnico
- Servicios Afectados
- Cambios de API
- Cambios de Base de Datos
- Flujo de Interaccion
- Consideraciones Tecnicas
- Flujos Afectados
- Story Split Propuesto ({{N}} stories)

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**Wait for user response:**
- **If user confirms:** Continue to Step 7
- **If user requests changes:** Apply changes to the file, save again, and repeat 6.4

---

### Step 7: Show Next Steps

Present next steps to user (in Spanish). The suggested next command depends on `ux_review_value`:

**If `ux_review_value == "required"`:**

```markdown
**Disenio tecnico completado**

Request: REQ-{{number}} - {{title}}
Archivo: {{requests_folder}}/REQ-{{number}}.{{title_short}}.md
Status: designed
Revision UX: required
Stories propuestas: {{N}}

---

**Siguiente paso (obligatorio antes de crear stories):**
Ejecuta `/product-ux-request REQ-{{number}}` para procesar el impacto UX

Esto va a:
- Leer el contexto UX completo
- Inferir cambios en pantallas, overlays y flujos
- Proponertelos en bloque para que apruebes o ajustes
- Aplicar los cambios aprobados en product-map / user-flows / screens
- Regenerar los wireframes de las superficies afectadas
- Anotar el delta en este request y marcar `ux_review: done`

Una vez completada la revision UX, ejecuta `/product-create-stories REQ-{{number}}` para crear las stories.
```

**If `ux_review_value == "not-applicable"`:**

```markdown
**Disenio tecnico completado**

Request: REQ-{{number}} - {{title}}
Archivo: {{requests_folder}}/REQ-{{number}}.{{title_short}}.md
Status: designed
Revision UX: not-applicable (cambio puramente backend / infraestructura)
Stories propuestas: {{N}}

---

**Siguiente paso:**
Ejecuta `/product-create-stories REQ-{{number}}` para crear las stories

Esto va a:
- Validar el split propuesto con vos (si son multiples stories)
- Crear {{N}} documento(s) S-XXX en {{stories_folder}}
- Actualizar APIs/schemas si corresponde
- Marcar el request como "formalized"
```

## Output

Request file updated in **requests_folder** with:
- Technical design sections added
- Status changed to `designed`

---

## Auto Mode

When `$ARGUMENTS` contains `--auto`, strip the flag before parsing the REQ number and apply these overrides:

### Step 0: Parse `--auto`

- `REQ-001 --auto` → main arg: `REQ-001`, **auto_mode = ON**
- `REQ-001` → main arg: `REQ-001`, **auto_mode = OFF**

### Overrides

- **Step 6.4** (Notify and Wait for Validation): Replace the wait block with:
  ```markdown
  [Auto] Diseño técnico aceptado — continuando automáticamente.
  ```
  Continue directly to Step 7.

- **Step 7** (Show Next Steps): Skip entirely — the subagent completes here and returns control to the orchestrator.
