---
name: product-initialize-technical
description: Create technical architecture documentation - APIs, DB schemas, ADRs, and system flows
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
---

# Initialize Technical Architecture

## Purpose

Create comprehensive technical documentation for a product:
- Product architecture (single document with services overview)
- Initial ADRs (Architectural Decision Records)
- API specifications (OpenAPI format)
- Database schemas (draft entities + DBML)

**Flow:**
```
Step 0: Validate & Load Context
  |
Step 1: Identify Services
  |
Step 2: Gather Technical Decisions
  |
Step 3: Create Architecture Document
  |
Step 4: Create ADRs
  |
Step 5: Create API Specifications
  |
Step 6: Create Database Schemas
  |
Step 7: Create Initial System Flows
  |
Step 8: Finalization
```

**Result:** Complete technical documentation ready for development.

**This command does NOT:**
- Create product definition (goals, requirements, feature groups)
- Capture or design functional requirements
- Create stories

These are handled in `/product-initialize` and `/product-new-request`.

## Role

**Adopt the Technical Leader Agent role** - Read [Technical Leader Agent](.claude/agents/technical-leader.md)

## Pre-loaded Context

### Existing PRD Check

!`ls docs/prd/goals-and-context.md 2>/dev/null || echo "NO_PRD_FOUND"`

### Discovery Docs Check

!`ls docs/discovery/analisis-tecnico.md 2>/dev/null || echo "NO_DISCOVERY_FOUND"`

## CRITICAL RULES

1. **ABORT if PRD doesn't exist** - If the "Existing PRD Check" above shows "NO_PRD_FOUND", run `/product-initialize` first
2. **Use Spanish** for all user interactions and generated documents
   - Translate ALL content including section titles from English templates
   - Examples: "Goals" -> "Objetivos", "Background" -> "Contexto", "Success Criteria" -> "Criterios de Exito"
3. **Save first, then validate** - Save documents, notify user, wait for confirmation
4. **Reference locations from Files index** - Do not hardcode paths
5. **Read ALL product documentation** before making decisions
6. **Do NOT dump full content in chat** - Save to file, show summary, let user review file directly
7. **OpenAPI format for all APIs** - Even if only /health endpoint
8. **Draft entities in DB schemas** - When no complete spec available
9. **Transcription mode when discovery exists** - If the "Discovery Docs Check" shows
   `analisis-tecnico.md` (not "NO_DISCOVERY_FOUND"), follow the `## Discovery Mode` section
   overrides: transcribe the service map, stack, communication and auth from the technical
   analysis and ask only about genuine gaps. ABORT on a service/integration that cannot be
   turned into a concrete artifact

## Execution

### Step 0: Validate & Load Context

**0.1 Validate Prerequisites**

Check the "Existing PRD Check" from the pre-loaded context above.

**If PRD does NOT exist ("NO_PRD_FOUND"), ABORT:**

```markdown
No encontre documentacion de producto.

Necesitas ejecutar `/product-initialize` primero para crear:
- docs/prd/goals-and-context.md
- docs/prd/requirements.md
- docs/prd/feature-groups.md

Despues podes volver a ejecutar este comando.
```

**0.2 Load Context**

1. Read [Files index](.claude/utils/index.md) to get all locations
2. Identify key folders:
   - **prd_folder** - To read PRD and save architecture doc
   - **apis_folder** - To save API specs
   - **db_schemas_folder** - To save DB schemas
   - **adrs_folder** - To save ADRs
   - **references_folder** - To check/save external reference docs
3. **Read ALL PRD files:**
   - `docs/prd/goals-and-context.md`
   - `docs/prd/requirements.md`
   - `docs/prd/feature-groups.md`
4. Review user-provided technical documentation (if any)

**0.2.b Detect Discovery Mode**

Check the "Discovery Docs Check" from the pre-loaded context above:

- Output is `NO_DISCOVERY_FOUND` -> **discovery_mode = OFF**. Run the full interactive flow below, unchanged.
- Output lists `analisis-tecnico.md` -> **discovery_mode = ON**. Follow the `## Discovery Mode` section overrides (after `## Output`). When ON, also read `docs/discovery/analisis-tecnico.md` (and `analisis-funcional.md`, `analisis-dominio.md` for cross-reference) as part of this step.
- Partial (`analisis-tecnico.md` present but a companion `analisis-funcional.md`/`analisis-dominio.md` is missing) -> ON, but log which docs were found, read only the ones that exist, and fall back to the interactive flow for anything the missing doc would have provided.

The ABORT-if-no-PRD check (0.1) always runs first and is unaffected by discovery mode.

---

### Step 1: Identify Services

Based on PRD and requirements, propose service architecture.

Ask user (in Spanish):

```markdown
## Arquitectura de Servicios

Basandome en los requerimientos del producto, te propongo la siguiente arquitectura:

### Servicios Identificados

| Servicio | Tecnologia Sugerida | Responsabilidad | Tiene API HTTP? | Base de Datos |
|----------|---------------------|-----------------|-----------------|---------------|
| {{service_1}} | {{tech_1}} | {{responsibility_1}} | Si/No | {{db_1 or "-"}} |
| {{service_2}} | {{tech_2}} | {{responsibility_2}} | Si/No | {{db_2 or "-"}} |
| {{service_3}} | {{tech_3}} | {{responsibility_3}} | Si/No | {{db_3 or "-"}} |

### Patrones de Integracion

- **{{service_1}} <-> {{service_2}}:** {{integration_pattern_1}}
- **{{service_2}} -> {{service_3}}:** {{integration_pattern_2}}

### Justificacion

{{explain_architecture_choices}}

**Te parece bien esta arquitectura? Hay algun servicio que quieras agregar, quitar o modificar?**
```

Wait for user confirmation.

Iterate if changes requested.

---

### Step 2: Gather Technical Decisions

For each key architectural decision, ask user:

```markdown
## Decisiones Arquitectonicas

Necesito que me ayudes a definir algunas decisiones tecnicas clave:

### 1. Stack Tecnologico

{{for each service}}
**{{service_name}}:**
- Que lenguaje/framework queres usar?
- Por que elegiste esa tecnologia?

{{if user has docs, extract from there; otherwise ask}}

### 2. Base de Datos

{{for each database}}
**{{database_name}}:**
- Que tipo de BD? (PostgreSQL, MySQL, MongoDB, etc.)
- Por que esa eleccion?

### 3. Comunicacion entre Servicios

- Sync (REST/gRPC) o Async (Events/Message Bus)?
- Si async, que tecnologia? (RabbitMQ, Kafka, etc.)

### 4. Deployment

- Donde se va a deployar? (Cloud provider, on-premise, etc.)
- Containerizacion? (Docker, Kubernetes, etc.)

### 5. Autenticacion

- Que estrategia de auth? (JWT, OAuth, Session-based, etc.)
```

Gather responses iteratively.

---

### Step 3: Create Product Architecture Document

**3.1 Read Template Specification**

Read **PRD Architecture Template** from Files index to understand document structure and sections.

**3.2 Draft Architecture Document**

Based on services identified in Step 1 and technical decisions from Step 2, create a single architecture document following the template structure.

Use the **PRD Architecture Template** format with all sections:
- Services (table with technology, responsibilities, databases, external APIs)
- Databases (table with type, used by, purpose)
- Service Interactions (internal communications + external integrations)
- Technical Requirements (infrastructure, cross-cutting, security, performance)
- Deployment Strategy

Generate the complete document in Spanish, following the examples in the template.

**3.2.1 Save External Integration References**

If the architecture document lists external integrations (in "Service Interactions" or "External APIs" column), ask user:

```markdown
La arquitectura menciona integraciones externas:
{{list of external integrations from architecture document}}

Tenes documentacion de alguna de estas integraciones? (especificaciones de API, contratos, guias de integracion)

Si la tenes, compartila y la guardo en `docs/references/` para que se use automaticamente al disenar y planificar.

**Comparti la documentacion o escribi "continuar" para seguir.**
```

**If user provides documentation:**
- Save each reference to **references_folder**/{integration-name}.{ext}
- Create or update **references_folder**/index.md with entries following this format:
  ```markdown
  # Referencias

  - **{filename}** — {brief description}
    Servicios: {internal services that use this integration}
    Lectura: {how to consume: "leer completo", "buscar por seccion", "grep por endpoint", etc.}
  ```

**If user says "continuar":** Skip silently.

**3.3 Save Document Directly**

Save to `docs/prd/architecture.md`

**3.4 Notify User** (do NOT show full content)

```markdown
Documento guardado: `docs/prd/architecture.md`

Incluye:
- Tabla de servicios con tecnologias y responsabilidades
- Bases de datos y su proposito
- Patrones de integracion entre servicios
- Requerimientos tecnicos y estrategia de deployment

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**3.5 If User Requests Changes**

- Edit the file with requested changes
- Notify user again
- Repeat until approved

---

### Step 4: Create Initial ADRs

**4.1 Read Template Specification**

Read **ADR Template** from Files index to understand structure, format, and examples.

**4.2 Identify Key Decisions**

For each key architectural decision, create an ADR.

**Common ADRs for initialization:**
1. ADR-001: Backend Technology Stack
2. ADR-002: Database Choice
3. ADR-003: Authentication Strategy
4. ADR-004: Service Communication Pattern
5. ADR-005: Deployment Strategy

**4.3 Draft ADRs**

For each decision, create an ADR following the **ADR Template** structure.

Use the template format with all sections:
- Header (with status, date, deciders, tags)
- Context
- Decision
- **Implementation Rules** (concrete, verifiable rules with exact values -- these get copied verbatim into Story Plans)
- Consequences (Positive, Negative, Risks)
- Alternatives Considered
- References

Generate each ADR in Spanish, following the examples in the template.

**4.4 Save All ADRs Directly**

Save each ADR to `docs/adrs/ADR-{{number}}-{{slug}}.md`

**4.5 Notify User** (do NOT show full content)

```markdown
ADRs guardados:
{{for each ADR}}
- docs/adrs/ADR-{{number}}-{{title}}.md

Cada ADR documenta:
- Contexto de la decision
- La decision tomada
- **Reglas de implementacion** (concretas y verificables)
- Consecuencias (positivas, negativas, riesgos)
- Alternativas consideradas

**Revisa los archivos y decime si estan correctos o queres cambios.**
```

**4.6 If User Requests Changes**

- Edit the specific ADR files with requested changes
- Notify user again
- Repeat until approved

---

### Step 5: Create API Specifications

**For EACH service that has HTTP API:**

**5.1 Read Template Specification**

Read **API REST Interface Template** from Files index to understand OpenAPI 3.0 structure, format, and best practices.

**5.2 Determine API Completeness**

Ask user:

```markdown
### API para {{service_name}}

Tenes especificacion de endpoints para este servicio?

**Opciones:**
1. **Tengo spec completa** - Compartila y la convierto a OpenAPI
2. **Tengo algunos endpoints definidos** - Comparti lo que tengas
3. **No tengo nada** - Creo estructura minima con solo /health
```

**5.3 Draft OpenAPI Spec**

**If user has complete/partial spec:**

Convert to OpenAPI 3.0 format following the **API REST Interface Template** structure, adding missing sections.

**If user has NO spec:**

Create minimal OpenAPI following the template format. Use the minimal example structure from the template:
- Basic metadata (info, servers)
- `/health` endpoint only
- Error schema and security schemes in components
- Comment indicating endpoints will be added later

Generate the complete OpenAPI YAML file following the template examples.

**5.4 Save OpenAPI Spec Directly**

Save to `docs/apis/{{service_name}}.yaml`

**5.5 Notify User** (do NOT show full content)

```markdown
API spec guardado: `docs/apis/{{service_name}}.yaml`

Incluye:
- Metadata del servicio (info, servers)
- Endpoints {{if minimal}}(solo /health por ahora){{else}}({{endpoint_count}} endpoints){{endif}}
- Schemas y componentes
- Security schemes

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**5.6 If User Requests Changes**

- Edit the OpenAPI file with requested changes
- Notify user again
- Repeat until approved

**5.7 Repeat for All Services with HTTP API**

---

### Step 6: Create Database Schemas

**For EACH database:**

**6.1 Read Template Specification**

Read **Database Schema Template** from Files index to understand document structure, draft entities format, and DBML format.

**6.2 Determine Schema Completeness**

Ask user:

```markdown
### Esquema de BD: {{database_name}}

Tenes definicion de tablas/entities para esta base de datos?

**Opciones:**
1. **Tengo schema completo** - Compartilo (SQL, DBML, o descripcion)
2. **Tengo algunas entities definidas** - Comparti lo que tengas
3. **No tengo nada** - Creo draft entities basandome en requerimientos
```

**6.3 Draft Database Schema Document**

**If user has complete schema:**

Convert to DBML format in the "DBML Schema" section, following the **Database Schema Template** structure.

**If user has partial or NO schema:**

Create draft entities + DBML placeholder following the template format. Use the structure from the template with:
- Database Overview (metadata, type, purpose, used by)
- Draft Entities with:
  - Table name
  - Description (what is stored in this table)
  - Relationships (with cardinality, e.g., "User has many Sessions")
  - **IMPORTANT: DO NOT include attributes/fields unless user explicitly provided them**
- DBML Schema (placeholder with comment indicating it will be populated later)
- Migrations Strategy
- Additional sections as needed

Generate the complete document following the template examples.

**6.4 Save Schema Document Directly**

Save to `docs/db-schemas/{{database_name}}.md`

**6.5 Notify User** (do NOT show full content)

```markdown
Esquema de BD guardado: `docs/db-schemas/{{database_name}}.md`

Incluye:
- Overview de la base de datos (tipo, proposito, usado por)
- {{if complete}}Esquema DBML completo con {{entity_count}} entities{{else}}Draft entities con tablas y relaciones (sin campos detallados){{endif}}
- Estrategia de migraciones

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**IMPORTANT:** Wait for user approval before proceeding to next database (step 6.7).

**6.6 If User Requests Changes**

- Edit the schema file with requested changes
- Notify user again
- Repeat until user approves to continue

**6.7 Repeat for All Databases**

---

### Step 7: Create Initial System Flows

Based on the feature groups from PRD and the APIs/schemas just created, identify and create initial system flows.

**7.1 Identify Flows**

Analyze the feature groups and API specs to identify:
- **Feature flows:** One per feature group that involves multiple services (e.g., "create-order", "user-registration")
- **Event flows:** One per system event identified in the APIs (e.g., "order-status-change", "payment-received")

**Skip if:** Only one service exists (no cross-service flows needed yet).

**7.2 Read Template**

Read **Flow Template** from Files index to understand document structure.

**7.3 Create Flow Documents**

For each identified flow:
1. Create **flows_folder**/{flow-name}.md following the template
2. Set status to "Draft" (will become "Active" once implemented)
3. Include all steps with exact field names from the OpenAPI YAMLs and DBML schemas created in previous steps
4. Include error handling for each step

**7.4 Notify User**

```markdown
Flujos del sistema creados: {{N}} flujos

Archivos:
{{list all created flow files}}

**Revisa los flujos y decime si estan correctos o queres cambios.**
```

**Wait for user confirmation.**

---

### Step 8: Finalization

Present complete summary:

```markdown
Producto inicializado exitosamente

## Estructura de documentacion creada:

### Producto
- docs/prd/goals-and-context.md
- docs/prd/requirements.md
- docs/prd/feature-groups.md
- docs/prd/architecture.md

### APIs
{{list all created API files}}

### Base de Datos
{{list all created DB schema files}}

### ADRs
{{list all created ADR files}}

### Flujos del Sistema
{{list all created flow files or "Ninguno (sistema de un solo servicio)"}}

### Referencias Externas
{{list all created reference files or "Ninguna (se agregan manualmente segun necesidad)"}}

---

## Proximos pasos

Tu producto esta listo para empezar a desarrollar.

**Para cada feature group en docs/prd/feature-groups.md:**

1. **Ejecuta:** `/product-new-request`
   - Captura el requerimiento funcional

2. **Ejecuta:** `/product-design-request REQ-XXX`
   - Disenia la solucion tecnica y propone story split

3. **Ejecuta:** `/product-create-stories REQ-XXX`
   - Crea las stories implementables

---

**Recomendacion:** Empeza por el Feature Group #1 (generalmente es el setup de infraestructura base).

Queres que te ayude a ejecutar `/product-new-request` para el primer feature group?
```

## Output

Files saved to respective folders (see Files index for locations):

- `docs/prd/architecture.md` - Product architecture overview
- `docs/adrs/ADR-{number}-{title}.md` - Initial ADRs (one per key decision)
- `docs/apis/{service}.yaml` - OpenAPI specs (complete or minimal)
- `docs/db-schemas/{database}.md` - DB schemas (complete or draft entities)
- `docs/flows/{flow-name}.md` - Initial system flows (if multi-service)

Each document contains:
- Frontmatter with metadata
- Content following template structure
- Status indicating current phase

---

## Discovery Mode

When the "Discovery Docs Check" lists `analisis-tecnico.md` (**discovery_mode = ON**, set in Step 0.2.b), switch to **transcription mode**: read the technical analysis in full, PROPOSE the architecture artifacts derived from it, and ask the user ONLY about genuine gaps. The save-then-validate flow and per-document review loops are PRESERVED.

### Overrides

- **Step 1** (Identify Services): Transcribe the service map (service, suggested tech, responsibility, HTTP-API yes/no, DB) directly from `analisis-tecnico.md` into the Step 1 table and PRESENT it for confirmation. This is transcription, not auto-accept — the user still confirms.

- **Step 2** (Gather Technical Decisions): Replace the questionnaire (stack, DB, communication, deployment, auth) with transcription from `analisis-tecnico.md`. Ask ONLY for decisions the analysis leaves open. NOTE: the technical analysis is scope-limited (it defers CI/CD, testing, observability, project structure, hosting), so deployment/structure are frequently genuine gaps the user must answer.

- **Step 3** (Architecture Document): Built from the transcribed Step 1/2 content. Mechanics unchanged.

- **Step 4** (ADRs): Each decision already taken in `analisis-tecnico.md` (see "Resumen de Decisiones Técnicas") becomes an ADR, using its stated rationale as Context/Decision. Ask only when a needed decision is missing.

- **Step 5 + Step 6** (API specs / DB schemas): Keep the existing "tengo spec completa / parcial / nada" prompts (the analysis is scope-limited and won't carry full OpenAPI/DBML), but PRE-FILL the options from any endpoint/entity info in the analysis docs before asking.

- **Step 3.2.1** (external integration references): Pre-populate the integrations list from `analisis-tecnico.md`, then still ask the user for the reference docs.

- **Step 7** (Flows): Unchanged (skip if single service).

- **GAP/ABORT rule:** if `analisis-tecnico.md` names a service/integration that can't be turned into a concrete artifact (a service with no responsibility, a DB with no owner), STOP and ask a targeted question naming the exact gap.

- **Step 8** (Finalization): Unchanged.

### Traceability & Promotion

So the discovery reasoning stays in the axis, in transcription mode you MUST also:

1. **Back-link** — add a reference note right under the title of `architecture.md` (relative path from `docs/prd/` to `docs/discovery/`):

   ```markdown
   > Derivado del discovery: [análisis técnico](../discovery/analisis-tecnico.md)
   ```

2. **Promote decisions into ADRs** — each ADR created from `analisis-tecnico.md` (Step 4) cites it in its **References** section (`docs/discovery/analisis-tecnico.md`). ADRs are the canonical, living home of "decision + rationale" that all downstream skills already read; discovery stays as the frozen, linked origin.
