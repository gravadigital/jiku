---
name: product-consolidate-services
description: Consolidate analyzed services into complete PRD - detects connections, generates goals, requirements, feature groups
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent"
---

# Consolidate Services

## Purpose

Consolidate all analyzed services into a complete Product Requirements Document (PRD). Detects connections between services, validates architecture with user, and generates all PRD documents.

**Flow:**
```
Step 0: Validate Prerequisites
  |
Step 1: Load All Service Analyses
  |
Step 2: Cross-Service Analysis (detect connections)
  |
Step 3: Generate and Show Architecture Diagram
  |
Step 4: Validate Architecture with User <- CHECKPOINT
  |
Step 5: Generate Goals and Context
  |
Step 6: Generate Requirements
  |
Step 7: Generate Feature Groups
  |
Step 8: Generate Architecture Document
  |
Step 9: Generate ADRs
  |
Step 9.5: Generate System Flows
  |
Step 9.7: Consolidate UX from surveys (if any frontend was surveyed)
  |
Step 10: Create Folder Structure
  |
Step 11: Final Summary
```

**Result:** Complete PRD structure matching `/product-initialize` output, generated from existing code. When frontend services were surveyed, also the complete `docs/ux/` + `docs/design-system/` seeded from the code — matching what `/product-ux-generate` produces in greenfield, but transcribed from the real UI instead of inferred.

**This command does NOT:**
- Analyze individual services (use `/product-analyze-service` first)
- Render wireframes itself — Step 9.7 delegates to `/product-ux-wireframes` (single source of rendering truth)
- Implement any code
- Create stories

## Role

**Adopt the Analyst Agent role** - Read [Analyst Agent](.claude/agents/analyst.md)

## CRITICAL RULES

1. **Use Spanish for generated content** - All user interactions and generated documents in Spanish
   - Translate ALL content including section titles from English templates
   - Examples: "Goals" -> "Objetivos", "Background" -> "Contexto", "Success Criteria" -> "Criterios de Exito"
2. **Save first, then validate** - Save documents, notify user, wait for confirmation
3. **Reference locations from Files index** - Do not hardcode paths
4. **Do NOT dump full content in chat** - Save to file, show summary, let user review
5. **At least one service required** - Must have analyzed at least one service first
6. **User validation required** - Architecture must be validated in Step 4 before generating PRD
7. **Extract from code** - Don't invent, extract actual patterns from service analyses

## Execution

### Step 0: Validate Prerequisites

**0.1 Load Context**

1. Read [Files index](.claude/utils/index.md) to get all locations
2. Read `.claude/local-config.yaml` if it exists
3. Identify key folders:
   - **analysis_folder** - Where service analyses are stored
   - **prd_folder** - Where to save PRD files
   - **adrs_folder** - Where to save ADRs

**0.2 Check Import State**

Check if **analysis_folder**/.import-state.yaml exists:
- If not found: Show error, abort
- If found: Continue

**0.3 Check Analyzed Services**

Check if **analysis_folder**/services/ has at least one file:
- If empty: Show error, abort
- If has files: Continue

**If prerequisites not met:**

```markdown
No se encontraron servicios analizados.

**Este comando requiere que hayas analizado al menos un servicio primero.**

**Ejecuta:**
```
/product-analyze-service {path}
```

**Ejemplos:**
- `/product-analyze-service ../api-backend`
- `/product-analyze-service ../web-app`
- `/product-analyze-service ../notification-service`

Despues de analizar todos tus servicios, volve a ejecutar este comando.
```

**ABORT.**

---

### Step 1: Load All Service Analyses

**1.1 Read Import State**

Read **analysis_folder**/.import-state.yaml to get list of analyzed services.

**1.2 Read All Analyses**

Read all files in **analysis_folder**/services/*.md

**1.3 Extract Key Information**

For each service, extract:
- Name, type (backend/frontend), responsibility
- Tech stack
- Features grouped by domain
- Interfaces exposed (APIs, events, UI)
- Interfaces consumed (databases, external APIs, other services)
- Technical decisions

**1.4 Show Summary**

```markdown
Servicios Encontrados: {N}

{For each service:}
- **{service-name}** ({type}) - {one-line responsibility}

Analizando conexiones entre servicios...
```

---

### Step 2: Cross-Service Analysis

**2.1 Match Exposed/Consumed Interfaces**

For each service that **consumes** something:
- Check if another service **exposes** it
- Match by:
  - API endpoint patterns (e.g., /api/users)
  - Service names in URLs
  - Event names in pub/sub
  - Database names

**Examples:**
- Service A exposes "REST API /api/users"
- Service B consumes "API /api/users"
- -> Connection: B -> A (REST)

- Service A publishes "Redis event: user.created"
- Service B subscribes "Redis event: user.created"
- -> Connection: A -> B (Events via Redis)

**2.2 Identify Shared Resources**

- Multiple services -> same database (shared data)
- Multiple services -> same Redis (cache/events)
- Multiple services -> same external service

**2.3 Detect Communication Patterns**

- **Synchronous:** HTTP REST, GraphQL
- **Asynchronous:** Events (Redis pub/sub, message queues)
- **Shared Data:** Direct DB access

**2.4 Map External Dependencies**

List all external services used:
- Cloud storage (S3, Cloudinary)
- Email services (SendGrid, SES)
- Payment gateways
- Analytics services
- etc.

**2.5 Identify Ambiguities**

Mark connections that need clarification:
- Environment variables that could point to multiple services
- Generic API URLs without clear target
- Events without clear publisher/subscriber

---

### Step 3: Generate and Show Architecture Diagram

**3.1 Generate Mermaid Diagram**

```markdown
## Arquitectura del Sistema Detectada

### Diagrama de Componentes

```mermaid
graph TB
    User[Usuario]

    subgraph "Frontend"
        {List all frontend services}
        {e.g., WebApp[web-app<br/>React App]}
    end

    subgraph "Backend Services"
        {List all backend services}
        {e.g., API[api-backend<br/>REST API]}
    end

    subgraph "Data Layer"
        {List all databases}
        {e.g., PostgreSQL[(PostgreSQL<br/>main-db)]}
    end

    subgraph "External Services"
        {List all external services}
        {e.g., Cloudinary[Cloudinary]}
    end

    {User connections to frontends}
    {Frontend to backend connections with labels}
    {Backend to database connections}
    {Backend to backend connections with event labels}
    {Backend to external connections}

    {Style definitions for visual clarity}
```
```

**Tips for diagram:**
- Use icons for service types (frontend, backend, database, external)
- Label edges with connection types (REST, Events, etc.)
- Use solid lines for synchronous, dashed for asynchronous
- Color-code by service type

**3.2 Generate Services Table**

```markdown
### Servicios Identificados

| Servicio | Tipo | Responsabilidad | Tech Stack | Estado |
|----------|------|-----------------|------------|--------|
{For each service:}
| **{name}** | {type} | {responsibility} | {tech-stack} | Existing |
```

**3.3 List Detected Connections**

```markdown
### Conexiones Detectadas

**Frontend -> Backend:**
{List all frontend to backend connections}
- {frontend-name} -> {backend-name} (HTTP REST)

**Backend -> Backend:**
{List all backend to backend connections}
- {service-a} -> {service-b} (Redis Pub/Sub: evento.name)

**Backend -> Datos:**
{List all database connections}
- {service-name} -> {database} (read/write)

**Backend -> Externos:**
{List all external service connections}
- {service-name} -> {external-service} (purpose)

{If ambiguities:}
---

### Ambiguedades Detectadas

{N}. {service} usa `${ENV_VAR}` que podria apuntar a:
   - {most-likely-target} (asumido por patrones)
   - {other-possibility}
```

---

### Step 4: Validate Architecture with User

**4.1 Request Validation**

```markdown
---

**Esta arquitectura refleja correctamente tu sistema?**

**Opciones:**
1. **Confirmar** - La arquitectura es correcta, continuar con generacion de PRD
2. **Corregir conexiones** - Hay conexiones incorrectas o faltantes
3. **Agregar servicios faltantes** - Faltan servicios por analizar
4. **Modificar descripciones** - Ajustar responsabilidades de servicios

*Responde el numero de la opcion o describe los cambios que queres hacer*
```

**WAIT for user response.**

**4.2 Handle User Response**

**Option 1: Confirmar**

```markdown
Arquitectura confirmada

Guardando arquitectura validada y continuando con generacion del PRD...
```

Save validated architecture in **analysis_folder**/.import-state.yaml and proceed to Step 5.

**Option 2: Corregir conexiones**

```markdown
Que conexiones queres corregir?

**Ejemplos:**
- "Eliminar: web-app -> analytics-service"
- "Agregar: api-backend -> payment-gateway (HTTP REST)"
- "Cambiar: notification-service consume de auth-service, no de api-backend"

Escribi los cambios (uno por linea o todos juntos):
```

Parse user input, update connections graph, return to Step 3 (regenerate diagram).

**Option 3: Agregar servicios faltantes**

```markdown
Detecte que faltan servicios. Tenes dos opciones:

**A) Analizar un repositorio existente:**
   Ejecuta `/product-analyze-service {path}` y volve a ejecutar este comando.

**B) Describir el servicio manualmente:**
   Dame esta informacion y lo agregare al sistema:

   - **Nombre:**
   - **Tipo:** (backend/frontend)
   - **Responsabilidad:** (1 linea)
   - **Tech Stack:**
   - **Expone:** (APIs, UI, eventos - que provee)
   - **Consume:** (que servicios/DBs/externos usa)
```

If manual description:
- Create minimal analysis entry in **analysis_folder**/services/{name}.md
- Update **analysis_folder**/.import-state.yaml
- Return to Step 1 (re-analyze with new service)

**Option 4: Modificar descripciones**

```markdown
Servicios actuales:

{For each service with number:}
{N}. **{name}** ({type}): "{responsibility}"

Cual queres modificar?

**Formato:** "{numero}: Nueva descripcion aqui"
**Ejemplo:** "2: API principal de autenticacion y gestion de usuarios"

Podes modificar varios, uno por linea:
```

Parse changes, update service descriptions, return to Step 3 (regenerate table/diagram).

**4.3 Save Validated Architecture**

Once approved, update **analysis_folder**/.import-state.yaml:

```yaml
import:
  status: architecture_validated
  validated_at: {timestamp}

  services:
    - name: {service-name}
      type: {backend/frontend}
      responsibility: "{validated description}"
      tech_stack: "{tech stack}"
      path: {path}
      status: analyzed

  connections:
    - from: {service-a}
      to: {service-b}
      type: {http_rest / redis_pubsub / shared_database / etc}
      details: "{optional details like events, endpoints}"

  external_dependencies:
    - service: {service-name}
      uses: {external-service}
      purpose: "{why}"

  validated_architecture:
    diagram: |
      {The validated Mermaid diagram}
```

---

### Step 5: Generate Goals and Context

**5.1 Infer Content from Analyses**

From service analyses, infer:

1. **Product Name and Overview**
   - Name from project (or ask user)
   - What the system does (from all features across services)

2. **Problem Statement**
   - What problem it solves (infer from functionality)

3. **Target Users**
   - Who uses it (from UI services and features)
   - User personas if detectable

4. **Business Goals**
   - Why it exists (infer from features and domains)
   - Value proposition

5. **Success Metrics**
   - Suggest metrics based on product type
   - KPIs that make sense

6. **Scope**
   - Services that compose the product (from validated architecture)
   - What's included vs not included

7. **Stakeholders**
   - Development team (detected from git if possible)
   - Users (from features)

**5.2 Save Document**

Save to **prd_folder**/goals-and-context.md

**5.3 Notify User** (do NOT show full content)

```markdown
Documento guardado: `docs/prd/goals-and-context.md`

Incluye:
- Nombre del producto y overview
- Problema que resuelve
- Usuarios objetivo
- Objetivos de negocio
- Metricas de exito sugeridas
- Scope (servicios incluidos)
- Stakeholders

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**If user requests changes:**
- Edit the file with requested changes
- Notify user again
- Repeat until approved

---

### Step 6: Generate Requirements

**6.1 Extract from Analyses**

**Functional Requirements:**

Group features by domain (extracted from all services):

```markdown
### Autenticacion y Autorizacion
- REQ-F-001: El sistema debe permitir registro de usuarios
- REQ-F-002: El sistema debe permitir login con email/password
{...}

### Gestion de Usuarios
- REQ-F-010: Los usuarios deben poder editar su perfil
{...}

### {Other domains}
{...}
```

For each requirement:
- ID (REQ-F-XXX)
- Description (clear, testable)
- Which service(s) implement it

**Non-Functional Requirements:**

- **Performance:** Response times, cache strategies, scalability patterns
- **Security:** Authentication methods, authorization patterns, encryption
- **Reliability:** Error handling, retry mechanisms, monitoring
- **Usability:** UI/UX patterns, accessibility, responsive design
- **Maintainability:** Testing coverage, documentation, code quality
- **Scalability:** Architecture patterns, load balancing, caching layers

**Technical Constraints:**

- Tech stacks in use (list from all services)
- Databases and data stores
- External service dependencies
- Infrastructure requirements
- Browser/platform requirements

**6.2 Save Document**

Save to **prd_folder**/requirements.md

**6.3 Notify User** (do NOT show full content)

```markdown
Documento guardado: `docs/prd/requirements.md`

Incluye:
- Requerimientos funcionales agrupados por dominio (REQ-F-XXX)
- Requerimientos no funcionales (performance, security, reliability, etc.)
- Restricciones tecnicas (stacks, databases, infrastructure)

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**If user requests changes:**
- Edit the file with requested changes
- Notify user again
- Repeat until approved

---

### Step 7: Generate Feature Groups

**7.1 Group Features into Feature Groups**

From features detected, suggest feature groups. Group related features into groups.

**Common feature group patterns:**
- Authentication & Authorization (if auth features)
- User Management (user CRUD, profiles)
- {Domain} Management (posts, products, etc.)
- Notifications & Communication (emails, push)
- Analytics & Reporting (if analytics features)
- Infrastructure & DevOps (deployment, monitoring)
- Admin & Configuration (if admin features)

For each feature group:

```markdown
## Feature Group: {Title}

**Prioridad Sugerida:** {Alta/Media/Baja}
**Esfuerzo Estimado:** {Alto/Medio/Bajo - based on complexity}
**Estado:** Pending Formalization

### Descripcion
{What this feature group encompasses}

### Features Incluidas
{List features from service analyses}

### Servicios Afectados
- {service-name} ({type})
- {service-name} ({type})

### Justificacion
{Why this should be a feature group - from analysis}

### Dependencias
{Other feature groups this depends on, if any}

---
```

**7.2 Save Document**

Save to **prd_folder**/feature-groups.md

**7.3 Notify User** (do NOT show full content)

```markdown
Documento guardado: `docs/prd/feature-groups.md`

Incluye:
- {N} feature groups con prioridad y esfuerzo sugeridos
- Features incluidas en cada grupo
- Servicios afectados por cada grupo
- Dependencias entre grupos

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**If user requests changes:**
- Edit the file with requested changes
- Notify user again
- Repeat until approved

---

### Step 8: Generate Architecture Document

**8.1 Generate Content**

1. **Architecture Overview** (narrative)
   - High-level description of the system
   - Architectural approach (microservices, modular, etc.)
   - Why this architecture was chosen

2. **Architecture Diagram**
   - Use the validated Mermaid diagram from Step 4
   - Include it directly

3. **Services**
   - The validated services table from Step 4
   - Brief description of each service's role

4. **Communication Patterns**
   - Frontend <-> Backend: How they communicate
   - Backend <-> Backend: Sync vs async patterns
   - Data Access: How services access data

5. **Data Architecture**
   - Databases and their purposes
   - Which services own which data
   - Caching layers
   - Critical data flows

6. **External Dependencies**
   - List from validated architecture
   - Purpose of each

7. **Security Architecture**
   - Authentication strategy
   - Authorization approach
   - API security

8. **Infrastructure Requirements**
   - Hosting needs
   - Scalability considerations
   - Deployment architecture

**8.2 Save Document**

Save to **prd_folder**/architecture.md

**8.3 Notify User** (do NOT show full content)

```markdown
Documento guardado: `docs/prd/architecture.md`

Incluye:
- Overview de arquitectura y enfoque
- Diagrama Mermaid validado
- Tabla de servicios
- Patrones de comunicacion
- Arquitectura de datos
- Dependencias externas
- Arquitectura de seguridad
- Requerimientos de infraestructura

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**If user requests changes:**
- Edit the file with requested changes
- Notify user again
- Repeat until approved

---

### Step 9: Generate ADRs

**9.1 Identify Decisions to Document**

From technical decisions detected in services:
- Framework choices (why NestJS, React, etc.)
- Database choices (why PostgreSQL, MongoDB, etc.)
- Architecture patterns (why microservices, event-driven, etc.)
- Authentication strategy (why JWT, OAuth, etc.)
- State management (why Redux, Zustand, etc.)
- Styling approach (why Tailwind, CSS-in-JS, etc.)
- Key technology choices that impact the system

**9.2 Propose ADRs to User**

```markdown
## ADRs a Generar

Basandome en las decisiones tecnicas detectadas, propongo documentar estos ADRs:

1. **ADR-001**: {Decision Title} (detectado desde: {services})
2. **ADR-002**: {Decision Title} (detectado desde: {services})
3. **ADR-003**: {Decision Title} (detectado desde: {services})
{...}

Te parece bien esta lista? Hay alguna decision que quieras agregar o quitar?
```

**WAIT for user confirmation.**

**9.3 Generate ADR Files**

For each approved ADR, use this format:

```markdown
# ADR-{N}: {Decision Title}

**Estado:** Aceptado (implementado)
**Fecha:** {YYYY-MM-DD}
**Detectado desde:** {service-name(s)}

---

## Contexto

{Why this decision was needed - inferred from codebase and domain}

## Decision

{What was decided}

Implementado en:
- {service-name}: {how it uses this}
- {service-name}: {how it uses this}

## Consecuencias

### Positivas
- {Benefits observed in the implementation}
- {Advantages this provides}

### Negativas
- {Trade-offs or limitations}
- {Technical debt or constraints}

## Alternativas Consideradas

{If detectable from code comments, docs, or obvious alternatives}
- **{Alternative 1}**: {Why not chosen}
- **{Alternative 2}**: {Why not chosen}

## Referencias

- Arquitectura: docs/architectures/{service}/
- Implementacion: {file paths if relevant}
```

**9.4 Save All ADRs**

Save each to **adrs_folder**/ADR-{number}-{title}.md

**9.5 Notify User** (do NOT list full content)

```markdown
ADRs guardados ({N} documentos):
- docs/adrs/ADR-001-{title}.md
- docs/adrs/ADR-002-{title}.md
{...}

Cada ADR incluye:
- Contexto de la decision
- La decision tomada y donde esta implementada
- Consecuencias positivas y negativas
- Alternativas consideradas

**Revisa los archivos y decime si estan correctos o queres cambios.**
```

**If user requests changes:**
- Edit specific ADR files with requested changes
- Notify user again
- Repeat until approved

---

### Step 9.5: Generate System Flows

Based on the cross-service analysis (Step 2) and the partial flows detected in each service analysis, consolidate and generate complete flow documents.

**9.5.1 Consolidate Partial Flows**

From each service analysis, read the "Detected Flows" section:
- Match exposed endpoints from service A with consumed endpoints in service B -> these form a flow
- Match published events from service A with subscribed events in service B -> these form a flow
- Group related interactions into complete end-to-end flows

**9.5.2 Read Template**

Read **Flow Template** from Files index to understand document structure.

**9.5.3 Create Flow Documents**

For each identified flow:
1. Create **flows_folder**/{flow-name}.md following the template
2. Set status to "Active" (these flows are already implemented in existing code)
3. Include all steps with exact field names from the OpenAPI YAMLs and DBML schemas
4. Include error handling for each step

**9.5.4 Present Flows for Validation**

```markdown
Flujos del sistema generados: {{N}} flujos

| Flujo | Servicios | Pasos |
|-------|-----------|-------|
| {flow-name} | {services involved} | {step count} |

**Revisa los flujos en **flows_folder** y decime si estan correctos o queres cambios.**
```

**Wait for user confirmation.**

---

### Step 9.7: Consolidate UX from surveys

**Runs only if `/product-analyze-service` surveyed at least one frontend.** This is the brownfield
equivalent of `/product-ux-generate`: same outputs, but **transcribed** from the surveyed code instead
of inferred from the PRD.

**9.7.1 Detect surveys**

```bash
ls -d docs/analysis/ux/*/ 2>/dev/null
```

**If none:** skip this step entirely. The product has no surveyed frontend, so UX follows the
greenfield path — tell the user at Step 11 to run `/product-ux-generate`.

**If some exist:** continue. Read, per surveyed service, `index.md` and every `screens/*.md`.

**9.7.2 Adopt the UX Researcher role for this step**

The rest of this skill runs as the Analyst. This step is UX work, so read
[UX Researcher Agent](.claude/agents/ux-researcher.md) and apply its firm rules — with one addition
specific to brownfield: the fourth traceability source, `[fuente: código-existente]`.

**9.7.3 Map services to surfaces**

One surveyed frontend service = one surface (1:1), the same assumption `/product-ux-request` makes.
Use the service name as the surface name unless the user prefers another.

**9.7.4 Identify audiences — the part the code cannot give**

This is why UX consolidation lives here and not in `analyze-service`: audiences come from the PRD you
just built (Steps 5-7), not from the code. The surveys contain routes and blocks; they contain no
answer to "for whom".

Infer candidate audiences from goals-and-context (U-XX), the capabilities table's Actor column, and
distinct JTBDs — remembering the firm rule that audiences split by JTBD, not by label. Then confirm,
in one block, together with the surfaces and the viewports the surveys detected:

```markdown
## Audiencias, superficies y viewports

Las superficies y los viewports salen del relevamiento del código. Las audiencias no: el código no
dice para quién es cada pantalla, así que las inferí del PRD y necesito que las confirmes.

**Superficies** (del relevamiento):
- **{{surface}}** — {{N}} pantallas relevadas
  - Plataforma: `{{web | mobile-app}}` — {{del stack detectado}}
  - Viewports: `{{lista}}` — {{web: el corte real está en `md` (768px) según el código |
    mobile-app: phone; portrait bloqueado, sin soporte de tablet}}

**Audiencias** (inferidas del PRD, a confirmar):
- **{{audience-slug}}** — {{rol y contexto de uso, 1 línea}}

**Matriz audiencia ↔ superficie:**
- {{audience}} usa: {{surfaces}}

**¿Es correcto?** Podés corregir audiencias, matriz o nombres de superficie. Los viewports salieron
del código: si los cambiás, el responsive documentado va a dejar de coincidir con lo implementado.
```

**WAIT for confirmation.** Iterate until confirmed.

**9.7.5 Produce the UX documentation**

Read the templates from Files index before drafting each artifact. Then, per artifact:

| Artefacto | Cómo se produce |
|---|---|
| `product-overview.md` | Superficies con su **plataforma y viewports del relevamiento** (con la evidencia del código como razón), audiencias confirmadas, matriz, glosario del PRD |
| `audiences/{a}/benchmark.md` | **Investigación normal** — el código no tiene benchmark. Igual que en greenfield: WebSearch de competidores, con fuentes citadas |
| `audiences/{a}/research-context.md` | **Hipótesis normales.** Persona genérica, JTBD, pains y gains inferidos del PRD y del benchmark, con su trazabilidad y su fuerza. `status: hipótesis-preliminar` |
| `surfaces/{s}/product-map.md` | **Rutas reales del relevamiento** como inventario de pantallas, con la columna Viewports. Overlays relevados en su inventario. Cada fila cita `[fuente: código-existente]` más la capability del PRD que cubre, cuando se puede mapear |
| `surfaces/{s}/user-flows.md` | Inferidos de la navegación relevada (entradas/salidas de cada screen survey) cruzada con los flujos del PRD. 3-5 críticos, no todos |
| `surfaces/{s}/screens/{p}.md` | **Transcripción del survey** — ver 9.7.6 |
| `cross-surface-flows.md` | De los flujos cross-service del Step 9.5 que cruzan superficies |

**9.7.6 Transcribe each screen survey into its screen spec**

The survey screen template mirrors the screen template's section order, so this is mostly mechanical.
What changes:

- **Frontmatter**: add `viewports` (from the survey) and
  `fidelity: mid`, and
  **`status: as-is-sin-validar`** — this screen documents what exists, not a validated design.
- **Estructura**: transcribe the block table, keeping the Viewports column. **If the survey came out
  atomised** (a screen with far more than ~15 blocks, or rows that are clearly parts of one component
  — title + id + pills of the same header), regroup into molecules here and fold the atoms into the
  block's Contenido. A wireframe of 36 stacked boxes communicates the component tree, not the screen. Drop the survey's "Origen"
  column into a single line under the table citing the source files, so the trace survives without
  cluttering the spec.
- **Layout por viewport**: transcribe the observed layout. Where the survey said the fractions were
  not derivable, keep that statement — do NOT invent fractions to make the section look complete.
- **Contenido**: transcribe the microcopy verbatim, typos included. A typo is a finding for the gap
  report, not something to fix silently here.
- **Estados**: the survey's *present* states become the applicable states. The survey's *absent*
  states are declared `Aplica: No — no implementado (ver gaps-as-is.md)`, which is truthful and keeps
  the spec honest instead of pretending the state was considered and rejected.
- **Decisiones y descartes**: the screen template requires this section, and the survey has nothing to
  fill it with. Write exactly one entry and nothing more:
  `- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del
  rationale original; las decisiones se van a documentar cuando la pantalla se modifique.`
  **Do not invent reasons.** This is the single most important rule of brownfield UX: a fabricated
  rationale is indistinguishable from a real one once transcribed, and it gets defended as intent.

**9.7.7 Seed the Design System from the surveyed tokens**

Copy the DS scaffold (root index + one per-surface folder), exactly as `/product-ux-generate` Step 8.5
does — same assets, same `{{SURFACE}}` and `{{DATE}}` substitutions. Then **fill** the foundations that
the survey provides, instead of leaving them as placeholders:

- `foundations/grid.md` — **pick the variant for the surface's platform first** (the scaffold ships
  a web one and a `grid.mobile-app.md`; keep the matching one, delete the other), then fill it:
  - `web` / `desktop-app`: the **real breakpoints** from the survey, and the
    "Viewports de UX ↔ breakpoints" table resolved with the actual switch point the survey found.
  - `mobile-app`: the **orientation policy** the code enforces (does it lock portrait?), how safe
    areas are handled today, whether text scaling is respected, and the dp size classes if the app
    supports tablet. A native app has no px breakpoint table — if the survey reported one, it was
    reading a web-shaped config that does not apply.

  Remove the `status: placeholder`. This is the highest-value seeding: it is what makes the
  responsive/adaptive spec agree with the code.
- `foundations/color.md` — the surveyed palette, with the names the code uses. **`color.brand.primary` must be the real accent found in the code**: it is what the wireframe generator reads and what the implementor consumes via `bg.action.primary`. In brownfield this is one of the highest-value seedings, because the product already has a brand color and inventing another one would make every wireframe disagree with the running app.
- `foundations/typography.md` and `foundations/spacing.md` — the surveyed scales.
- `components/` — one spec per surveyed component that is a DS candidate (used more than once), with
  its observed variants. Mark each `status: relevado-desde-código`, and leave the sections the code
  cannot answer (do/don't, accessibility rationale) explicitly empty rather than invented.

Every seeded file notes its origin. A DS whose values silently disagree with the code is worse than an
empty one, because the implementor trusts it.

**9.7.8 Emit the gap report**

Read [UX Gaps Template](.claude/templates/ux-gaps-tmpl.yaml) and aggregate the gap sections of every
survey into **ux_folder**/`gaps-as-is.md`: per surface, per screen, with severity from the template's
rubric and an action *category* (never a proposed design).

This document is the counterweight to marking the as-is as the baseline spec: the current UI is now
the documented spec, **and** here is the list of everything missing from it. Without it, transcribing
the survey would launder the gaps into "the design".

**9.7.9 Delegate wireframe generation**

Do NOT render wireframes here. Use the **Agent tool** with `subagent_type: "general-purpose"`:

```
Ejecutá el skill product-ux-wireframes con los siguientes parámetros:
- Argumento: {{CSV de superficies}} --no-interactive

Los screen.md ya existen: fueron transcriptos desde el relevamiento del código, con su sección
"Layout por viewport" ya definida. NO los infieras de nuevo ni los sobreescribas con otra
estructura: leelos y renderizá el wireframes.html de cada superficie respetando lo que declaran.

Los viewports de cada superficie están en docs/ux/product-overview.md.

No esperes confirmación del usuario: devolvé el resumen de lo generado.
```

Verify each surface's `wireframes.html` exists afterwards. If one fails, report it without
aborting — the user can re-run `/product-ux-wireframes {surface}`.

**9.7.10 Present for validation**

```markdown
Documentación UX generada desde el relevamiento del código.

**Superficies:** {{N}} · **Pantallas:** {{M}} · **Audiencias:** {{K}}
**Viewports:** {{surface}}: `{{mobile}}`, `{{desktop}}` (corte en {{768px}}, del código)

**Design System sembrado:** breakpoints, paleta, tipografía y espaciado reales
({{N}} componentes relevados como candidatos)

**Gaps:** {{N}} en {{M}} pantallas → `docs/ux/gaps-as-is.md`
Los más frecuentes: {{1-2 líneas}}

**Importante sobre el estado de estos documentos:**
- Las pantallas están en `status: as-is-sin-validar`: documentan lo que hay, no un diseño validado.
- Sus "Decisiones y descartes" están vacías a propósito — el código no registra el porqué, y
  inventarlo sería peor que dejarlo en blanco.
- Los research-context son hipótesis preliminares, como en cualquier producto nuevo: el código no
  aporta audiencias ni JTBD.

**Revisá `docs/ux/` y `docs/ux/gaps-as-is.md`, y decime si está correcto o querés cambios.**
```

**Wait for user confirmation.**

---

### Step 10: Create Folder Structure

Create empty folders (if they don't exist):
- **stories_folder**
- **requests_folder**

Confirm folders exist and are ready for workflow.

---

### Step 11: Final Summary

**11.1 Update Import State**

Update **analysis_folder**/.import-state.yaml:

```yaml
import:
  status: completed
  completed_at: {timestamp}

  # ... keep existing data

  prd_generated:
    goals_and_context: docs/prd/goals-and-context.md
    requirements: docs/prd/requirements.md
    feature_groups: docs/prd/feature-groups.md
    architecture: docs/prd/architecture.md

  adrs_generated:
    - docs/adrs/ADR-001-{title}.md
    - docs/adrs/ADR-002-{title}.md
    # ... list all

  folders_created:
    - docs/stories
    - docs/requests
```

**11.2 Show Summary**

```markdown
## Proyecto Importado Exitosamente

### Documentacion Generada

#### PRD Completo
- docs/prd/goals-and-context.md
- docs/prd/requirements.md ({N} requirements)
- docs/prd/feature-groups.md ({N} feature groups)
- docs/prd/architecture.md (con diagrama validado)

#### Analisis de Servicios ({N} servicios)
{For each service:}
- docs/analysis/services/{service-name}.md

#### Arquitecturas Detalladas
{For each service:}
- docs/architectures/{service-name}/ (manifest.yaml + overview.md + index.md + {N} conventions custom)

{If any APIs:}
#### APIs Documentadas ({N} APIs)
{For each API:}
- docs/apis/{service-name}.yaml ({N} endpoints)

{If any DBs:}
#### Schemas de Base de Datos ({N} databases)
{For each DB:}
- docs/db-schemas/{db-name}.md ({N} entidades)

#### Decisiones Arquitectonicas ({N} ADRs)
{For each ADR:}
- docs/adrs/ADR-{N}-{title}.md

{{Si se consolidó UX (Step 9.7):}}
#### Documentacion UX ({N} superficies, {M} pantallas)
- docs/ux/product-overview.md (superficies, audiencias, **viewports del codigo**)
- docs/ux/audiences/{audiencia}/{benchmark,research-context}.md
- docs/ux/surfaces/{superficie}/{product-map,user-flows}.md
- docs/ux/surfaces/{superficie}/screens/*.md ({M} pantallas, status: as-is-sin-validar)
- docs/ux/surfaces/{superficie}/wireframes.html
- docs/ux/gaps-as-is.md ({N} gaps detectados)

#### Design System ({N} superficies)
- docs/design-system/{superficie}/foundations/grid.md (**breakpoints reales del codigo**)
- docs/design-system/{superficie}/foundations/{color,typography,spacing}.md (sembrados)
- docs/design-system/{superficie}/components/ ({N} componentes relevados)

#### Estructura de Carpetas
- docs/stories/ (listo para crear stories)
- docs/requests/ (listo para capturar requests)

---

### Estado del Proyecto

Tu proyecto ahora tiene la **misma estructura** que uno creado con `/product-initialize`,
con la ventaja de que toda la documentacion se genero desde el **codigo existente**.

**Servicios documentados:** {N}
**Requirements identificados:** {N}
**Feature groups sugeridos:** {N}
**ADRs documentados:** {N}

---

### Siguientes Pasos

#### 1. Revisar la Documentacion
- Lee el PRD en `docs/prd/` para validar que refleja tu producto
- Revisa las arquitecturas en `docs/architectures/`
- Verifica las APIs en `docs/apis/`
- Revisa los schemas en `docs/db-schemas/`

{{Si se consolidó UX:}}
- **Revisa `docs/ux/gaps-as-is.md`** — es la lista de lo que falta en la UI actual, con evidencia.
  Es el mejor punto de partida para los primeros requerimientos.
- Revisa `docs/ux/surfaces/*/screens/*.md`: estan en `status: as-is-sin-validar` y sus
  "Decisiones y descartes" estan vacias a proposito (el codigo no registra el porque).
  Se van completando cuando cada pantalla se modifique.
- Verifica los breakpoints en `docs/design-system/*/foundations/grid.md`: salieron del codigo, y
  desde ahora son la fuente contra la que se implementa el responsive.

{{Si NO se consolidó UX porque no habia frontend relevado:}}
- Este producto no tiene documentacion UX. Si tiene o va a tener interfaz, ejecuta
  `/product-ux-generate` para generarla desde el PRD.

#### 2. Configurar Servicios para Desarrollo
En cada repositorio de servicio, ejecuta:
```
/service-setup-repo
```
Esto copiara las herramientas de workflow a cada servicio.

#### 3. Comenzar con el Workflow

**Capturar nuevos requerimientos:**
```
/product-new-request
```

**Disenar y crear stories:**
```
/product-design-request REQ-XXX
/product-create-stories REQ-XXX
```

**Implementar stories:**
```
/service-planify-story S-XXX     (en repo del servicio)
/service-implement-story S-XXX   (en repo del servicio)
```

---

**Tu proyecto esta completamente documentado y listo para usar grava-workflow!**
```

## Output

Files saved to **docs/** (see Files index for locations):

- `docs/prd/goals-and-context.md` - Product goals and context
- `docs/prd/requirements.md` - Functional and non-functional requirements
- `docs/prd/feature-groups.md` - Feature groups for formalization
- `docs/prd/architecture.md` - Architecture with validated diagram
- `docs/adrs/ADR-{N}-{title}.md` - Multiple ADRs (typically 3-8)
- `docs/stories/` - Empty folder ready for stories
- `docs/requests/` - Empty folder ready for requests
- `docs/.import-state.yaml` - Final state (status: completed)
