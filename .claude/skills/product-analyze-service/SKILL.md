---
name: product-analyze-service
description: Analyze existing service repository and generate complete documentation - architecture, API specs, DB schemas
argument-hint: "[service-repo-path]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
---

# Analyze Service

## Purpose

Analyze an existing service repository in depth and generate complete documentation including architecture, API specifications, and database schemas.

The architecture is produced in the **current format** — `manifest.yaml` + `overview.md` + `index.md` + custom conventions — which is the only one the rest of the workflow consumes: `/service-planify-story` aborts on a service without a manifest. The analysis maps the observed code onto the conventions catalog, declaring a catalog convention when the code follows it and writing a custom one when it does not.

**Flow:**
```
Step 0: Validate Input & Detect Service
  |
Step 1: Deep Analysis of Service
  |
Step 2: Show Analysis Summary (user approval)
  |
Step 3: Generate Temporary Analysis Document
  |
Step 4: Generate Architecture Documentation
  |
Step 5: Generate API Specification (backend only)
  |
Step 6: Generate Database Schema (backend with DB only)
  |
Step 6.5: Generate UX Survey (frontend only)
  |
Step 7: Update Import State
  |
Step 8: Summary
```

**Result:** Complete documentation for one service, ready for consolidation with `/product-consolidate-services`. For frontend services this includes a **UX survey** of the current UI (routes, screens, blocks, microcopy, breakpoints, design tokens, gaps) — a relevamiento of what the code does today, which consolidation turns into the real UX documentation once audiences are known.

**This command does NOT:**
- Generate PRD (goals, requirements, feature groups)
- Consolidate multiple services into a single architecture
- Create the product repository structure
- Produce UX documentation — the frontend survey is **relevamiento**, not `docs/ux/`. It has no audiences, no JTBD and no rationale, because the code does not carry them

These are handled in `/product-consolidate-services`.

## References

**Read [Technical Standards](.claude/specs/technical-standards.md)** and apply it.

## CRITICAL RULES

1. **Path required** - Service repository path must be provided as argument
2. **One architecture format, no choice** - Always produce `manifest.yaml` + `overview.md` + `index.md` (+ custom conventions). The multi-section format (`tech-stack.md`, `api-standards.md`, `data-layer.md`, …) is **gone**: its templates were deleted and downstream skills no longer read it. Never ask the user which format to use, and never emit the legacy one — a service documented that way cannot be planned against without running `/product-migrate-architecture` on documentation that was just generated.
3. **Use Spanish** for all user interactions and generated documents
   - Translate ALL content including section titles from English templates
   - Examples: "Goals" -> "Objetivos", "Background" -> "Contexto", "Success Criteria" -> "Criterios de Exito"
4. **Save first, then validate** - Save documents, notify user, wait for confirmation
5. **Reference locations from Files index** - Do not hardcode paths
6. **Extract from code** - Don't invent, extract actual patterns and decisions from codebase
7. **Do NOT dump full content in chat** - Save to file, show summary, let user review file directly

## Execution

### Step 0: Validate Input and Detect Service Type

**0.1 Validate Path**

Parse `$ARGUMENTS` as the service repository path.

If `$ARGUMENTS` is empty or no path was provided:

```markdown
Este comando requiere el path al repositorio del servicio.

**Uso:** `/product-analyze-service {path}`

**Ejemplos:**
- `/product-analyze-service ../api-backend`
- `/product-analyze-service /home/user/projects/web-app`
- `/product-analyze-service ../services/notification-service`

**Tip:** Usa paths relativos desde el repositorio de producto.
```

**ABORT if no path provided.**

**0.2 Validate Path Exists**

Check if directory exists:
- If not found: Error with clear message, abort
- If found but not a repository: Warn and ask for confirmation

**0.3 Load Context**

1. Read [Files index](.claude/utils/index.md) to get all locations
2. Identify key folders for output

**0.4 Quick Detection**

Read repository to detect basic information:

1. **Service name:**
   - From package.json "name" field
   - Or from folder name as fallback

2. **Service type:**
   - **Backend** if: NestJS, Express, Fastify, Python Flask/Django, Go, etc.
   - **Frontend** if: React, Vue, Angular, Next.js, Nuxt, etc.
   - Check package.json dependencies and project structure

3. **Tech stack (preliminary):**
   - Framework (React, NestJS, etc.)
   - Language (TypeScript, JavaScript, Python, etc.)
   - Database if backend (PostgreSQL, MongoDB, etc.)

**0.5 Confirm with User**

```markdown
Servicio detectado: **{service-name}**

- **Tipo:** {Backend / Frontend}
- **Path:** {relative-path}
- **Framework:** {framework}
- **Lenguaje:** {language}

Es correcto? Queres continuar con el analisis?

(Escribi "si", "ok", o "continuar" para proceder)
```

**WAIT for user confirmation.**

---

### Step 1: Deep Analysis of Service

**Explore the service repository thoroughly.**

#### If Backend:

1. **Tech Stack (detailed):**
   - Framework and version
   - Language and version
   - Database type and ORM
   - Testing framework
   - Other key libraries (validation, auth, etc.)

2. **Project Structure:**
   - Main folders and their purposes
   - Module/layer organization
   - How code is structured (MVC, Clean Architecture, etc.)

3. **API Endpoints:**
   - List all routes/endpoints
   - HTTP methods
   - Controllers and their responsibilities
   - Group by domain/module

4. **Database:**
   - Extract models/entities from ORM
   - Field types and constraints
   - Relationships between entities
   - Identify primary database name

5. **Authentication & Authorization:**
   - Strategy (JWT, OAuth, sessions)
   - How it's implemented
   - Protected routes patterns

6. **Middlewares & Patterns:**
   - Custom middlewares
   - Error handling patterns
   - Validation approach
   - Logging/monitoring

7. **External Dependencies:**
   - Third-party APIs consumed
   - External services (email, storage, etc.)
   - SDKs used

8. **Testing:**
   - Unit tests structure
   - Integration tests
   - E2E tests if any

9. **Configuration:**
   - Environment variables patterns
   - Configuration structure

#### If Frontend:

1. **Tech Stack (detailed):**
   - Framework and version
   - Language and version
   - State management library
   - Styling approach
   - Build tool
   - Testing framework

2. **Project Structure:**
   - Components organization
   - Pages/routes structure
   - Hooks/composables
   - Services/utils

3. **Routing:**
   - All routes defined
   - Route structure
   - Navigation patterns
   - **Per-route component tree** — for each route, which component renders it and which
     components it composes. This is the input to the UX survey in Step 6.5: the block inventory,
     the microcopy and the per-viewport layout of every screen are read from these files. Note the
     entry file per route; the survey step reads them in depth.

4. **State Management:**
   - How state is organized
   - Stores/context structure
   - Global vs local state patterns

5. **API Integration:**
   - How backend is consumed
   - API client setup
   - Endpoints called
   - Error handling

6. **Component Patterns:**
   - UI components (buttons, inputs, modals, etc.)
   - Layout components
   - Reusable patterns
   - Props patterns

7. **Styling:**
   - Approach (Tailwind, CSS Modules, Styled Components, etc.)
   - Theme/design tokens if any
   - Color palette, spacing scale, typography scale
   - **Breakpoints — literal values.** Read them from where they actually live: `screens` in
     `tailwind.config.*`, `breakpoints.values` in an MUI/Chakra theme, SCSS/CSS variables, or the
     `@media` queries themselves. Record the value AND its origin (`file:line`). These become the
     Design System's grid foundation during consolidation, and from there the responsive spec the
     implementor builds against — a wrong value here contradicts the code everywhere downstream.
   - **Responsive usage — which breakpoints are actually USED**, not just declared. Count
     occurrences of each responsive mechanism (`md:` / `lg:` utility prefixes, `useMediaQuery`,
     `@media` blocks) with example locations. A config declaring five breakpoints while the code
     only ever uses one means a single-viewport surface: usage decides, not the config.

8. **Testing:**
   - Component test patterns
   - Integration test approach

9. **Configuration:**
   - Environment variables
   - Build configuration

#### Both (Backend & Frontend):

10. **Features Detected:**
    - Group by domain/module
    - What functionality each provides
    - User-facing features

11. **Interfaces:**
    - **Exposes:** What this service provides (API, UI, events)
    - **Consumes:** What it depends on (APIs, DBs, services)

12. **Detected Flows (Partial):**
    - Identify cross-service interactions by detecting:
      - HTTP client calls to other services (fetch, axios, HttpService, etc.)
      - Event publishers (emit, publish, dispatch patterns)
      - Event consumers/subscribers (on, subscribe, listen patterns)
      - Webhook endpoints or callers
    - For each detected interaction, note:
      - Source service (this one)
      - Target service or event name
      - Endpoint or event being called/published
      - Data shape if identifiable from code

13. **Technical Decisions:**
    - Why this framework was chosen (infer from codebase)
    - Why this database/state management
    - Architecture patterns chosen
    - Key technical choices

---

### Step 2: Show Analysis Summary

Present comprehensive analysis to user:

```markdown
## Analisis Completo: {service-name}

### Stack Tecnico Detectado
{Detailed tech stack with versions}

### Estructura del Proyecto
{Description of folder organization and architecture pattern}

### Features Principales

#### {Domain 1}
- {Feature 1}
- {Feature 2}

#### {Domain 2}
- {Feature 1}
- {Feature 2}

{Continue for all domains}

### Interfaces

**Expone:**
- {What it provides - API with N endpoints, Web UI, Events published, etc.}

**Consume:**
- {What it depends on - databases, external APIs, other services}

### Decisiones Tecnicas Identificadas

1. **{Framework}**: {Why chosen - inferred from patterns}
2. **{Database/State}**: {Why chosen}
3. **{Other key decisions}**

### Estadisticas
- **Endpoints/Rutas:** {N}
- **Modelos/Entidades:** {N} {if backend}
- **Componentes:** {N} {if frontend}
- **Tests:** {N tests found}

---

**Voy a generar la documentacion completa basandome en este analisis:**

**Arquitectura Detallada**
   - docs/architectures/{service-name}/ ({10+} secciones)

{If backend:}
**API Specification**
   - docs/apis/{service-name}.yaml (OpenAPI con {N} endpoints)

{If backend with database:}
**Database Schema**
   - docs/db-schemas/{db-name}.md ({N} entidades)

**Analisis Temporal**
   - docs/analysis/services/{service-name}.md (para consolidacion)

**Continuar con la generacion de documentacion?**
```

**WAIT for user approval.**

---

### Step 3: Generate Temporary Analysis Document

**3.1 Create document**

Create `docs/analysis/services/{service-name}.md` with:
- Identification (name, type, purpose, tech stack, responsibility)
- Main features (grouped by domain)
- Technical decisions (with "why" inferred)
- Interfaces (exposes/consumes)
- Information for PRD consolidation
- Detected flows (partial cross-service interactions found in code)
- References to generated documentation

**3.2 Notify user** (do NOT show full content)

```markdown
Documento guardado: `docs/analysis/services/{service-name}.md`

Incluye:
- Identificacion del servicio (proposito, tech stack, responsabilidad)
- Features principales agrupadas por dominio
- Decisiones tecnicas identificadas
- Interfaces (expone/consume)

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**If user requests changes:**
- Edit the file with requested changes
- Notify user again
- Repeat until approved

---

### Step 4: Generate Architecture Documentation

Produce the architecture in the **current format**: `manifest.yaml` + `overview.md` + `index.md`, plus
custom conventions where the code deviates from the catalog. This is the same shape
`/product-create-backend-architecture` and `/product-create-frontend-architecture` produce, and the
only one the rest of the workflow consumes — `/service-planify-story` **aborts** on a service without
`manifest.yaml`. There is no legacy multi-section format and no choice to offer.

**4.1 Read the references**

1. [Manifest Schema](.claude/conventions/manifest-schema.md) — the exact `manifest.yaml` format and the
   resolution rules (custom wins over catalog; `required_by` transitive closure).
2. [Conventions Index](.claude/conventions/index.md) — how the catalog is organized.
3. The catalog for the detected language: `.claude/conventions/{language}/`. Read the conventions that
   plausibly apply to this service type, since Step 4.2 compares the code against them.
4. [Convention Template](.claude/templates/convention-tmpl.yaml) — only if custom conventions are needed.

**Languages in the catalog:** `node`, `nextjs`, `golang`, `flutter`.

**If the detected language has no catalog folder** (a Django, Rails or Spring service), the service
still gets a manifest — `language` records the real language even though there is no catalog behind it —
and **every** convention it needs becomes custom, written from the observed patterns. Say so explicitly
in 4.3: the service works, but it does not benefit from the shared catalog, and future services in that
language would justify creating one.

**4.2 Map the code onto conventions**

For each concern the catalog covers for this language, compare what the code actually does against the
catalog convention, and decide one of three:

| Decisión | Cuándo | Qué se escribe |
|---|---|---|
| **Declarar la del catálogo** | El código la sigue en lo sustancial (mismo paquete, misma forma de usarlo, mismas reglas) | El id en `conventions:` del manifest |
| **Custom** | El código resuelve la misma preocupación de otra forma, y un developer siguiendo el catálogo escribiría algo inconsistente con el repo | Un archivo en `docs/architectures/{service}/conventions/{id}.md` + el id en `conventions:` |
| **No aplica** | La preocupación no existe en este servicio (sin cola, sin cache, sin auth propia) | Nada |

**Ante la duda, custom.** El riesgo es asimétrico: declarar mal una convención del catálogo hace que
`/service-planify-story` genere planes contra reglas que el repositorio no sigue, y el developer termina
escribiendo código inconsistente con su propio codebase. Una custom de más es un archivo que documenta lo
que el código hace: redundante, inofensivo.

**No crear una custom por una diferencia trivial** (un nombre de helper distinto, el orden de los
parámetros). El criterio es concreto: *¿un developer que siga la convención del catálogo escribiría algo
que desentona con este repositorio?* Si la respuesta es no, declarás la del catálogo.

Cada custom cita de dónde salió el patrón (`archivo:línea`), igual que el resto del análisis, y sigue la
estructura del convention template.

**Mapeo de referencia** — dónde vive ahora lo que antes eran secciones sueltas:

| Lo analizado | Dónde va |
|---|---|
| Stack, versiones, tipo de servicio | `manifest.yaml` (`language`, `type`) + `overview.md` |
| Estructura de carpetas, módulos del dominio | `manifest.yaml` (`modules`) + `overview.md` |
| Convenciones de código, naming | `_base` (catálogo o custom) |
| API standards, validación, manejo de errores | `http-server`, `validation`, `error-handling` |
| Capa de datos, ORM | `orm` |
| Autenticación | `auth-jwt` (backend) · `auth` (nextjs) |
| Testing | `testing` · `testing-unit` / `testing-e2e` |
| Variables de entorno | `env-config` |
| Deployment | `dockerfile`, `ci-gitlab` |
| Estado, data fetching, forms, estilos (frontend) | `state-management`, `data-fetching`, `forms`, `styling` |

**4.3 Generate the files**

In `docs/architectures/{service-name}/`:

1. **`manifest.yaml`** — following the manifest schema: `service`, `type`, `language`, `conventions` (the
   ids decided in 4.2), `modules` (from the analyzed structure, one entry per domain module with its
   responsibility). Do NOT list conventions that `required_by` pulls in automatically; the closure is
   resolved at read time.
2. **`overview.md`** — purpose of the service, service type, domain modules, and anything relevant that
   is not a convention (integrations, particularities of this codebase).
3. **`index.md`** — links to the manifest and to each active convention, marking which are custom.
4. **`conventions/{id}.md`** — one per custom decided in 4.2.

**4.4 Notify user** (do NOT show full content)

```markdown
Arquitectura generada: `docs/architectures/{{service-name}}/`

- `manifest.yaml` — {{language}} · {{type}} · {{N}} conventions · {{M}} módulos
- `overview.md`
- `index.md`

**Conventions declaradas** ({{N}}):
| Convención | Origen | Por qué |
|---|---|---|
| `{{error-handling}}` | catálogo | el código usa el mismo patrón (`{{archivo:línea}}`) |
| `{{orm}}` | **custom** | usa {{X}} en vez de {{Y}}: un developer siguiendo el catálogo escribiría queries que no encajan (`{{archivo:línea}}`) |

**No aplican:** {{lista de preocupaciones del catálogo que este servicio no tiene}}

{{Si el lenguaje no está en el catálogo:}}
**Atención:** `{{language}}` no tiene catálogo de convenciones. Todas las convenciones de este servicio
son custom, escritas desde los patrones observados. El servicio funciona igual, pero no se beneficia del
catálogo compartido.

**Revisá el manifest y las conventions.** Si alguna quedó declarada del catálogo pero el código en
realidad difiere, avisame: eso hace que `/service-planify-story` planifique contra reglas equivocadas.
```

**If user requests changes:**
- Adjust the manifest or the conventions
- Notify again, repeat until approved

---

### Step 5: Generate API Specification (Backend only)

**Skip this step if frontend.**

**5.1 Extract from code**

Create `docs/apis/{service-name}.yaml` with OpenAPI 3.0 spec:

- All paths with HTTP methods (from routes/controllers)
- Request parameters (query, path, body)
- Request body schemas (from DTOs/validators)
- Response schemas (from return types)
- Authentication schemes (from guards/middleware)
- Tags by domain/module
- Error responses

**5.2 Notify user** (do NOT show full content)

```markdown
API spec guardado: `docs/apis/{service-name}.yaml`

Incluye:
- {N} endpoints con metodos HTTP
- Request parameters y body schemas
- Response schemas
- Authentication schemes
- Tags por dominio/modulo

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**If user requests changes:**
- Edit the OpenAPI file with requested changes
- Notify user again
- Repeat until approved

---

### Step 6: Generate Database Schema (Backend with DB only)

**Skip this step if frontend or no database.**

**6.1 Extract from ORM**

Create `docs/db-schemas/{database-name}.md` with:

- Database overview (type, purpose)
- Entity definitions (all fields from ORM models)
- Mermaid ER diagram showing relationships
- DBML representation
- Migrations strategy (if migration files found)

Extract from: Prisma schema, TypeORM entities, Sequelize models, Mongoose schemas, etc.

**6.2 Notify user** (do NOT show full content)

```markdown
Database schema guardado: `docs/db-schemas/{database-name}.md`

Incluye:
- Database overview (tipo, proposito)
- {N} entidades con campos documentados
- Mermaid ER diagram
- DBML representation
- Migrations strategy

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**If user requests changes:**
- Edit the schema file with requested changes
- Notify user again
- Repeat until approved

---

### Step 6.5: Generate UX Survey (Frontend only)

**Skip entirely for backend services.** This is the frontend counterpart of Steps 5-6: where a backend
yields an API spec and a DB schema, a frontend yields a survey of its user interface.

**What this step is:** a *relevamiento* of the UI as it exists in the code. Routes, blocks, real
microcopy, states implemented, breakpoints, design tokens, and what is missing.

**What this step is NOT:** UX documentation. It has no audiences, no JTBD, no rationale — the code does
not carry intent, and `/product-consolidate-services` is where those get relevados with the user.
Writing them here would mean inventing them.

**Why it exists:** in a brownfield product the code already holds the facts UX would otherwise invent —
the breakpoints, the routes, the palette, the components. Generating UX documentation without reading
them produces a second source of truth that contradicts what is deployed, and the first UI story then
has two specs. See the two rules below; they are the whole point of this step.

**6.5.1 Read the templates**

1. [UX Survey Index Template](.claude/templates/ux-survey-index-tmpl.yaml)
2. [UX Survey Screen Template](.claude/templates/ux-survey-screen-tmpl.yaml)
3. `.claude/skills/product-ux-wireframes/SKILL.md` — the **block dictionary** (36 types) and the
   **8 fixed UI states**. Every surveyed block must map to a dictionary type and every state check
   must use that list, so consolidation can transcribe the survey without re-mapping anything.

**6.5.2 Two hard rules**

1. **Cite the origin of every fact** — `file:line` for blocks, states, microcopy, breakpoints and
   tokens. A fact without an origin is a guess; drop it or mark it "no determinable desde el código".

2. **Never fabricate rationale.** The survey screen template has NO "Decisiones y descartes" section
   by design. Report what the code does, never why. An invented reason becomes indistinguishable from
   a real one once it is transcribed into the UX docs, and it will then be defended as intent.

**6.5.3 Determine the surface's platform first**

Everything else in the survey depends on it, because a native app and a web app do not vary along the
same axis.

- **`web`** — Next.js, React, Vue, Angular served in a browser. Axis: viewport width → breakpoints.
- **`mobile-app`** — Flutter, React Native, native iOS/Android. Axis: **not width**. A phone app has
  one layout; what varies is safe-area insets and text scaling.
- **`desktop-app`** — Electron, Tauri. Axis: window width.

Read it from `package.json` / `pubspec.yaml` / the project structure. Then adapt what you extract:

| | `web` | `mobile-app` |
|---|---|---|
| Breakpoints | literal px values from the config | **N/A** — do not report a px breakpoint table |
| Viewports | `mobile` / `desktop`, from real usage of responsive utilities | `phone`, plus `tablet` only if the app actually supports it |
| Instead of breakpoints | — | **orientation policy** (does the app lock portrait?), **safe-area handling** (does it use the platform's safe-area API or hardcoded paddings?), **text scaling** (does it respect the system scale?), and **dp size classes** if tablet is supported |
| Landscape | not a concept | which screens (if any) rotate, and how the code allows it |

A native app that reports "breakpoints: sm 640, md 768…" means the survey read a web-shaped config
that does not apply — or read nothing and filled in defaults. Neither is acceptable: say
"no aplica — app nativa" instead.

**6.5.4 Build the survey index**

Write `docs/analysis/ux/{{service-name}}/index.md` following the index template, from the analysis
already done in Step 1: UI stack, breakpoints (with origin), viewports actually in use (with
occurrence counts as evidence), design tokens, route inventory, component inventory with usage counts,
and the gap list.

**Deciding the viewports** — this is the highest-leverage judgement in the step:
- Count real usage of each responsive mechanism, not declarations.
- If a breakpoint prefix appears meaningfully (layout-affecting utilities, not just a font size), the
  surface has that viewport.
- Map to the canonical pair: below the main layout switch → `mobile`; at or above it → `desktop`.
- No responsive usage at all → a single viewport. Say so explicitly; do not default to two.
- Record which breakpoint is the **real** switch (often `md`, not `lg`) — consolidation needs it for
  the grid foundation.

**6.5.5 Build one survey per screen**

For each route in the inventory, read its component tree in depth and write
`docs/analysis/ux/{{service-name}}/screens/{{screen-name}}.md` following the screen template.

Per screen, extract:

- **Blocks** in render order, each mapped to a dictionary type, with the real component name and its
  origin. When a component maps to no dictionary type, use `section` and flag it.

  **Granularity: molecule or organism, never atom.** This is the same rule the wireframe skill
  applies, and it does not relax just because you are reading a component tree. Do NOT map the JSX
  1:1 — a page header holding a title, an id and three status pills is **one** block, not five; a
  comment box with an editor, an attach button and a send button is **one** block. The atoms are
  described inside that block's `Contenido` entry, not promoted to blocks of their own.

  Why it matters concretely: a 1:1 mapping produced screens with 36 blocks in a real product, which
  renders as 36 stacked boxes. That communicates the React tree, not the structure of the screen — and
  the structure is the whole point of a wireframe. As a sanity check, a screen usually lands under ~15
  blocks; if you are past that, you are transcribing components instead of reading the page.
- **Viewport condition per block** — from the responsive utilities actually applied:
  `hidden md:block` → solo desktop; `md:hidden` → solo mobile; neither → ambos.
- **Observed layout per viewport**, in the same notation the screen template uses (bullets, and rows
  with 12-column fractions), derived from the layout classes: `md:grid-cols-3` → a row of three 4/12
  columns; `md:w-1/4` + `md:w-3/4` → 3/12 + 9/12. When the mechanism does not map to fractions
  (absolute positioning, CSS grid areas), describe it in prose and say the fractions are not derivable
  — do not force a number that is not in the code.
- **Microcopy verbatim**, typos included. From i18n, cite the key and the resolved default string.
  Dynamic text from the API is recorded as dynamic, not sampled.
- **States implemented**, with their real message and the branch that triggers them.
- **States absent** — check all 8 fixed states and record what happens today instead. This is the
  highest-signal output of the survey.
- **Interactions**: events, validation rules with their real thresholds and messages, feedback.
- **Accessibility observed**: alt text, accessible labels, focus management — presence and absence.
- **Observaciones**: what could not be read, ambiguities, dead code, anything to confirm later.

**6.5.6 Notify user** (do NOT show full content)

```markdown
Relevamiento UX guardado: `docs/analysis/ux/{{service-name}}/`

- **Plataforma:** {{web | mobile-app | desktop-app}} — {{de package.json / pubspec.yaml}}
{{Si web:}}
- **Breakpoints:** {{lista con valores}} — origen `{{archivo}}`
- **Viewports en uso:** {{mobile, desktop}} — el corte real está en `{{md}}` ({{768px}})
{{Si mobile-app:}}
- **Viewports:** {{phone}} {{· tablet si aplica}} — {{evidencia}}
- **Orientación:** {{portrait bloqueado en X / soporta ambas}} — origen `{{archivo}}`
- **Safe areas:** {{usa la API de la plataforma / paddings hardcodeados en N pantallas}}
- **Escalado de texto:** {{respetado / hay alturas fijas en N bloques con texto}}
- **Pantallas relevadas:** {{N}} ({{lista corta}})
- **Overlays:** {{N}}
- **Componentes:** {{N}} ({{M}} candidatos a design system)
- **Gaps detectados:** {{N}} — {{el más frecuente en 1 línea}}

{{Si algo no se pudo determinar:}}
**No determinable desde el código:** {{lista corta}}

Esto es **relevamiento**, no documentación UX: no tiene audiencias ni JTBD porque el código no los
declara. `/product-consolidate-services` los releva con vos y arma `docs/ux/` sobre esta base.

**Revisá el relevamiento y decime si refleja lo que hay o falta algo.**
```

**If user requests changes:**
- Edit the survey files
- Notify again, repeat until approved

---

### Step 7: Update Import State

Create or update `docs/.import-state.yaml`:

```yaml
import:
  status: analyzing
  last_updated: {timestamp}

  services:
    - name: {service-name}
      type: {backend/frontend}
      responsibility: "{one-line description from analysis}"
      tech_stack: "{main stack}"
      path: {relative-path}
      status: analyzed
      analyzed_at: {timestamp}

      interfaces:
        exposes:
          - type: {rest_api / web_ui / events}
            details: "{description}"
        consumes:
          - type: {api / database / external_service}
            target: "{name or URL pattern}"
            details: "{description}"
```

---

### Step 8: Summary

Present final summary:

```markdown
## Servicio Analizado: {service-name}

### Documentacion Generada

**Analisis Temporal:**
- docs/analysis/services/{service-name}.md

**Arquitectura Completa:**
- docs/architectures/{service-name}/ ({N} secciones)

{If backend:}
**API Specification:**
- docs/apis/{service-name}.yaml ({N} endpoints)

{If backend with DB:}
**Database Schema:**
- docs/db-schemas/{db-name}.md ({N} entidades)

**Estado de Importacion:**
- docs/.import-state.yaml (actualizado)

---

### Siguientes Pasos

**Opcion 1: Analizar mas servicios**
Si tenes mas servicios, ejecuta:
```
/product-analyze-service {path-to-next-service}
```

**Opcion 2: Consolidar cuando estes listo**
Cuando hayas analizado todos los servicios, ejecuta:
```
/product-consolidate-services
```
Esto generara el PRD completo consolidando toda la informacion.

---

**Servicios analizados hasta ahora:** {N} (segun import-state.yaml)
```

## Output

Files saved to respective folders (see Files index for locations):

- `docs/analysis/services/{service-name}.md` - Temporary analysis for consolidation
- `docs/analysis/ux/{service-name}/index.md` - UX survey: stack, breakpoints, viewports in use, tokens, routes, components, gaps (frontend only)
- `docs/analysis/ux/{service-name}/screens/{screen}.md` - Per-screen as-is survey: blocks, observed layout per viewport, verbatim microcopy, states present and absent (frontend only)
- `docs/architectures/{service-name}/manifest.yaml` - Language, type, declared conventions, domain modules
- `docs/architectures/{service-name}/overview.md` - Purpose, service type, modules
- `docs/architectures/{service-name}/index.md` - Links to the manifest and each active convention
- `docs/architectures/{service-name}/conventions/{id}.md` - One per convention where the code deviates from the catalog
- `docs/apis/{service-name}.yaml` - OpenAPI spec (backend only)
- `docs/db-schemas/{database}.md` - DB schema (backend with DB only)
- `docs/.import-state.yaml` - Updated import state
