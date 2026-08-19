---
name: product-discovery-technical
description: Discovery phase - produces a decision-complete technical analysis (service map, stack, communication, key flows) from the functional and domain analyses
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, WebSearch, WebFetch"
---

# Discovery - Technical Analysis

## Purpose

Run the technical Discovery as the Technical Leader: read the functional + domain analyses and produce a decision-complete **technical analysis** (service map, stack per service, communication patterns, key flows, and a requirement coverage table). Front-loading these decisions makes `/product-initialize-technical` linear transcription instead of discovery.

**Flow:**

```
Step 0: Validate prerequisites & Load (read analisis-funcional + analisis-dominio) [ABORT if missing]
  |
Step 1: Derive Service Map from bounded contexts
  |
Step 2: Decide Tech per Service (stack + rationale)
  |
Step 3: Define Communication Patterns (sync/async, subjects, auth)
  |
Step 4: Design Key Flows (end-to-end, per major feature)
  |
Step 5: Build Coverage-Validation Table (every requirement -> how covered, "N/M")
  |
Step 6: Draft & Save analisis-tecnico.md  [WAIT approval]
  |
Step 7: Finalization -> Suggest /product-initialize
```

**Result:** `docs/discovery/analisis-tecnico.md` - decision-complete technical discovery that linearizes `/product-initialize-technical`.

**This command does NOT:**

- Produce the functional or domain analysis
- Create the formal PRD, architecture.md, ADRs, APIs, DB schemas, or flows
- Define project structure, CI/CD, testing, observability, or hosting (deferred)

These are handled in `/product-discovery-functional`, `/product-initialize`, and `/product-initialize-technical`.

## Role

**Adopt the Technical Leader Agent role** - Read [Technical Leader Agent](.claude/agents/technical-leader.md)

## Pre-loaded Context

### Discovery Input Check

!`ls docs/discovery/analisis-funcional.md docs/discovery/analisis-dominio.md 2>/dev/null || echo "NO_DISCOVERY_FOUND"`

### Existing Technical Analysis Check

!`ls docs/discovery/analisis-tecnico.md 2>/dev/null || echo "NO_TECHNICAL_ANALYSIS"`

## CRITICAL RULES

1. **ABORT if discovery analyses are missing** - If the "Discovery Input Check" above shows "NO_DISCOVERY_FOUND" (or is missing a file), run `/product-discovery-functional` first
2. **Confirm before overwriting an existing technical analysis** - If the "Existing Technical Analysis Check" above shows the file (not "NO_TECHNICAL_ANALYSIS"), `analisis-tecnico.md` already exists. Ask the user before regenerating it — do NOT silently overwrite (mirrors how `/product-discovery-functional` protects its own docs)
3. **Use Spanish** for all user interactions and generated documents
   - Translate ALL content including section titles from English templates
4. **Save first, then validate** - Save documents, notify user, wait for confirmation
5. **Reference locations from Files index** - Use folder IDs (discovery_folder, references_folder). Do not hardcode paths
6. **Read ALL discovery input before deciding** - The domain bounded contexts are the authoritative basis for the service map
7. **Explain the "why"** - Every technology choice carries a rationale ("Razón" column). Present options with pros/cons when several are valid
8. **Bounded contexts drive services** - The service map MUST trace to the domain doc's bounded-context -> service mapping. Flag any service with no bounded context and any bounded context with no service
9. **Validate coverage explicitly** - Every functional requirement from `analisis-funcional.md` appears in the coverage table mapped to how it is covered, with an explicit "N/M" count and named gaps. A deferred item is a named row, never a silent omission
10. **Do NOT dump full content in chat** - Save to file, show summary, let user review file directly
11. **Scope limit** - Technologies, services, communication, key flows and coverage ONLY. Defer CI/CD, testing, observability, project structure and hosting. State this scope explicitly in the document
12. **Research technologies and integrations when deciding** - When evaluating a stack choice or an external integration you don't have documentation for, you MAY use `WebSearch`/`WebFetch` to consult current trade-offs and official docs. Keep it secondary: the functional + domain analyses and the user's constraints are the primary basis. Cite the source in the "Razón" column when a decision leans on external research, and confirm with the user

## Execution

### Step 0: Validate & Load Context

**0.1 Validate Prerequisites**

Check the "Discovery Input Check" from the pre-loaded context above.

**If discovery input does NOT exist ("NO_DISCOVERY_FOUND" or a missing file), ABORT:**

```markdown
No encontre el analisis de discovery.

Necesitas ejecutar `/product-discovery-functional` primero para crear:
- docs/discovery/analisis-funcional.md
- docs/discovery/analisis-dominio.md

Despues podes volver a ejecutar este comando.
```

**If a technical analysis already exists** ("Existing Technical Analysis Check" shows the file, not "NO_TECHNICAL_ANALYSIS"), ask before regenerating:

```markdown
Ya existe un analisis tecnico en `docs/discovery/analisis-tecnico.md`.

**Queres regenerarlo desde cero?** (sobrescribira el analisis actual)

Si solo necesitas ajustar algo puntual, es mejor editar el archivo directamente
o usar `/product-change-technical-definition` una vez inicializado el producto.
```

**Wait for user decision.** If the user declines, ABORT without changes.

**0.2 Load Context**

1. Read [Files index](.claude/utils/index.md) to get all locations
2. Identify key folders:
   - **discovery_folder** - To read the discovery input and save the technical analysis
   - **references_folder** - To read external API/integration docs (if any)

**0.3 Read ALL Discovery Input**

1. Read `docs/discovery/analisis-funcional.md` and `docs/discovery/analisis-dominio.md` FULLY
2. Read any relevant external reference docs from **references_folder** (if the functional analysis pointed at integrations)
3. Build an internal list of every functional requirement/feature (for the Step 5 coverage table)

---

### Step 1: Derive Service Map

Propose a service map DRIVEN by the domain bounded contexts.

**1.1** Present a services table + an ASCII diagram. Map each bounded context -> service.

**1.2** Note services eliminated/merged from naive proposals and WHY (valuable decision record).

**1.3** Present shared infrastructure (bus, DB, storage, CDN) as a separate table.

```markdown
## Mapa de Servicios

[diagrama ASCII]

| # | Servicio | Responsabilidad | Contexto(s) de dominio |
|---|---|---|---|
| S1 | {{service}} | {{responsibility}} | {{bounded contexts}} |

**Te parece bien este mapa de servicios? Algo que agregar, quitar o fusionar?**
```

**Wait for confirmation.** Iterate if changes requested.

---

### Step 2: Decide Tech per Service

For EACH service, facilitate the stack decisions with a rationale for each choice.

```markdown
## {{service}}

| Pieza | Tecnologia | Razon |
|---|---|---|
| Runtime | {{tech}} | {{why}} |
| Framework | {{tech}} | {{why}} |
```

Extract from the user / references where available; propose with rationale where not; mark assumptions explicitly. Include a "componentes compartidos" table. **Wait / iterate.**

---

### Step 3: Define Communication Patterns

**3.1 Connections** - De -> A table (protocolo, direccion, naturaleza).

**3.2 Patterns** - Narrative: sync request/response, async fan-out, job queues, etc.

**3.3 Messaging / subjects** (only if a bus exists) - subjects, publisher, subscriber, auth; accounts/permissions.

**3.4 Tokens & auth** - Auth philosophy and per-context token model.

**Wait / iterate.**

---

### Step 4: Design Key Flows

For each major feature/journey in the functional analysis, design an end-to-end flow as a numbered/ASCII sequence with concrete endpoints, fields and the services involved.

**CRITICAL:** Field names must be internally consistent -- they become authoritative cross-service contracts (`docs/flows/`) downstream.

**Edge case:** Single-service product -> note "monolito / un solo servicio" instead of inventing inter-service hops. **Wait / iterate.**

---

### Step 5: Build Coverage-Validation Table

Walk the full list of functional requirements built in Step 0.3. One row per requirement.

```markdown
## Validacion de Cobertura

**Cobertura: {{N}}/{{M}} requerimientos funcionales.**

| Categoria | Requerimiento | Cubierto por |
|---|---|---|
| {{cat}} | {{requirement}} | {{service/mechanism}} |
| {{cat}} | {{requirement}} | ❌ Diferido — {{razon}} |
```

If coverage is < 100%, list the deferred items in an "out of scope (operational)" section -- never hide a gap.

---

### Step 6: Draft & Save `analisis-tecnico.md`

**6.1 Read Template Specification**

Read **Discovery Technical Template** from Files index.

**6.2 Draft** following the template, in Spanish, with frontmatter (`created`, `last_updated`, `status: "Análisis técnico cerrado"`, `analisis_funcional`, `analisis_dominio`, `alcance`). Include the explicit scope-limit line.

**6.3 Save** directly to **discovery_folder**/analisis-tecnico.md

**6.4 Notify** (do NOT show full content):

```markdown
Documento guardado: `docs/discovery/analisis-tecnico.md`

Incluye:

- Mapa de servicios (derivado de los contextos de dominio)
- Tecnologias por servicio (con su razon)
- Comunicacion entre servicios (conexiones, patrones, subjects, auth)
- Flujos clave end-to-end
- Tabla de validacion de cobertura ({{N}}/{{M}} requerimientos)
- Decisiones operativas fuera de alcance
- Resumen de decisiones tecnicas

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**6.5** If the user requests changes: edit, notify again, repeat. **Wait for approval.**

---

### Step 7: Finalization

Present the next step (in Spanish):

```markdown
Analisis tecnico cerrado ({{N}}/{{M}} requerimientos cubiertos).

Documento: docs/discovery/analisis-tecnico.md

---

## Siguiente paso: Inicializacion del Producto

Con los tres analisis de discovery listos, `/product-initialize` y luego
`/product-initialize-technical` van a transcribir el analisis en vez de
descubrirlo (casi sin preguntas).

**Ejecuta:** `/product-initialize`

Queres que lo ejecute ahora?
```

## Output

Files saved to **discovery_folder** (see Files index for location):

- `docs/discovery/analisis-tecnico.md` - Decision-complete technical analysis (service map, stack, communication, key flows, coverage validation)

Each document contains:

- Frontmatter with metadata and the explicit scope limit
- Content following template structure
- Status indicating the phase is closed
