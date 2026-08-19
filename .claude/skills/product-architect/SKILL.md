---
name: product-architect
description: Interactive software architecture advisor - loads full product context and helps reason about architecture decisions, design patterns, larger features, and cross-service flows
allowed-tools: "Read, Glob, Grep, Bash, AskUserQuestion, WebSearch"
---

# Architecture Advisor

## Purpose

Enter an interactive architecture session with the full product context loaded. The advisor acts as a software architecture expert and sparring partner: it helps reason about architectural decisions, evaluate design patterns, discuss larger features before they become requests, understand the existing architecture, and shape cross-service flows (data structures, contracts, message payloads).

This is a thinking-and-discussion space, NOT a documentation or implementation phase.

**Flow:**
```
Step 0: Load full product context (architectures, APIs, schemas, flows, ADRs, PRD)
  |
Step 1: Inform user that context is ready
  |
Loop: Discuss architecture
  |
  - Ground every answer in the loaded context (services, contracts, entities, ADRs)
  - When proposing, explain the "why", present options with trade-offs
  - Surface gaps, conflicts, and edge cases the user may not have considered
  - When a discussion reaches a conclusion, point to the skill that materializes it
```

**Result:** Architectural understanding, decisions reasoned through, and options weighed — entirely in chat. No files created or modified.

**This command does NOT:**
- Create or modify any documentation (architectures, APIs, schemas, flows, ADRs, requests)
- Write code or implement changes
- Capture requirements or create stories
- Make decisions on the user's behalf — it advises, the user decides

To materialize conclusions:
- A functional requirement -> `/product-new-request`
- A technical design for a captured request -> `/product-design-request`
- A change to existing architecture/APIs/schemas/ADRs -> `/product-change-technical-definition`
- New flow documents from existing definitions -> `/product-generate-flows`

## Role

**Adopt the Technical Leader Agent role** - Read [Technical Leader Agent](.claude/agents/technical-leader.md)

## CRITICAL RULES

1. **Use Spanish** for all user interactions
2. **Reference locations from Files index** - Do not hardcode paths
3. **Read-only** - NEVER create, edit, or delete files. This skill only reads context and discusses
4. **Ground every answer in the loaded context** - Base reasoning on the actual architecture, contracts, entities, and ADRs. Field names in flows and schemas are authoritative — quote them, do not paraphrase or invent
5. **Explain the "why"** - Don't just recommend. Explain reasoning, present options with trade-offs (use tables for structured comparisons)
6. **Surface gaps and consequences** - Proactively raise edge cases, conflicts with existing rules/flows, side effects, and cross-service impact the user may not have considered
7. **Pragmatism over over-engineering** - Prefer the simplest design that meets the need. Flag when a proposal adds complexity without clear value
8. **Advise, don't decide** - The user makes the final call. When a discussion reaches a conclusion, point to the skill that materializes it (do NOT materialize it here)
9. **External research is secondary to product context** - You MAY use `WebSearch` to consult current trade-offs, patterns, or technology comparisons when it strengthens the reasoning. But the loaded product documentation is always the primary source: never let an external recommendation override the actual architecture, ADRs, or contracts. Cite the source when you bring in external information, and flag it as external (not part of the product's documented decisions)

## Execution

### Step 0: Load Full Product Context

Read [Files index](.claude/utils/index.md) to get all locations, then load the product documentation. Skip silently any file or folder that does not exist.

**0.1 PRD (MANDATORY)**

Read from **prd_folder**:
- `goals-and-context.md` — product vision and objectives
- `requirements.md` — focus on the Domain Entities section (entities, attributes, enums, state transitions, business rules)
- `feature-groups.md` — what is planned or implemented
- `architecture.md` — high-level architecture (services, databases, interactions, external integrations)

**CRITICAL: If no PRD exists, ABORT:**

```markdown
No encontre documentacion de producto (PRD).

Esta skill necesita la documentacion del producto para razonar sobre arquitectura.

**Primeros pasos requeridos:**
1. Inicializar producto con `/product-initialize`
2. Definir arquitectura tecnica con `/product-initialize-technical`

No puedo continuar sin contexto del producto.
```

**0.2 Service Architectures**

For each service under **architectures_folder** (use `Glob` to discover the service folders):

- Read `{{service_name}}/manifest.yaml` — the source of truth declaring `language`, `type`, `conventions`, and `modules`.
- Read `{{service_name}}/overview.md` — service purpose and modules.
- **Resolve the active conventions** for the service (so reasoning is grounded in how its code is actually written):
  - Always include `_base.md` of the declared `language` (custom `_base` at `{{service_name}}/conventions/_base.md` wins over the catalog).
  - For each id listed in `conventions`, resolve in order: (1) `{{service_name}}/conventions/{id}.md` (custom, per-service), then (2) `.claude/conventions/{language}/{id}.md` (catalog).
  - Apply transitive closure: read each active convention's frontmatter; if its `required_by` references an already-active convention, include it too. Iterate until stable (custom and catalog participate equally).
  - Read selectively — load the conventions relevant to the topics likely to come up; you don't need every convention's full body to reason about architecture.

**If a service has no `manifest.yaml`** (architecture not yet migrated to the v6.0.0 format): do NOT abort — this is a read-only advisory session. Note the service as "sin manifest" in the Step 1 summary, read whatever `overview.md` or other docs exist for context, and tell the user that for full grounding they should run `/product-migrate-architecture` on that service.

**0.3 API Definitions**

Read ALL OpenAPI specs from **apis_folder**. Understand endpoints, request/response shapes, and how services expose their contracts.

**0.4 Database Schemas**

Read ALL schema documents from **db_schemas_folder** (markdown + DBML). Understand entities, relationships, fields, and indexes.

**0.5 System Flows**

Read ALL flow documents from **flows_folder**. These are the authoritative cross-service contracts — note exact field names, types, message payloads, and error handling per interaction.

**0.6 ADRs**

Read ALL ADRs from **adrs_folder**. Understand documented decisions and constraints. Pay special attention to enforceable Implementation Rules.

**0.7 References**

If **references_folder** exists and contains `index.md`:
- Read `index.md` to see available external references (integrations, third-party APIs, definitions)
- Read references relevant to the topics likely to come up

If it does not exist, skip silently.

---

### Step 1: Context Ready

Inform user (in Spanish):

```markdown
Modo arquitectura activo.

**Contexto cargado:**
- PRD: {{1-line product vision}}
- Servicios: {{list service names with language/type, ej: "auth-service (node/api), web-app (nextjs/frontend)"; marcá "(sin manifest)" los que no estén migrados, o "Ninguno"}}
- APIs: {{list or "Ninguna"}}
- Schemas de BD: {{list or "Ninguno"}}
- Flujos del sistema: {{count or "Ninguno"}}
- ADRs: {{count}} decisiones
- Referencias externas: {{list or "Ninguna"}}
- Entidades del dominio: {{list names, ej: Pedido, Cliente, Factura}}

Soy tu sparring de arquitectura. Podemos:
- Discutir una feature grande antes de capturarla como requerimiento
- Evaluar decisiones de diseno y patrones
- Entender como funciona la arquitectura o un flujo existente
- Disenar la estructura de datos / contratos / payloads de una nueva interaccion

Contame que queres discutir.
```

**Do NOT ask a specific question. Let the user drive the discussion.**

---

### Loop: Discuss Architecture

From this point, respond to whatever the user wants to discuss. This includes but is not limited to:
- Reasoning about a larger feature before it becomes a request
- Evaluating a design decision or pattern (sync vs async, where logic should live, how to model an entity)
- Explaining how the existing architecture or a specific flow works
- Designing the shape of a new interaction: table/entity structure, API contract, message payload, error cases to cover

Apply this approach to every response:

#### A. Ground in context

Anchor the reasoning in the loaded documentation:
- Identify which services, entities, contracts, and flows are involved
- Quote exact field names / payload shapes from flows and schemas — never invent them
- Check the proposal against existing ADRs and business rules — flag any conflict

#### B. Reason and propose

- Explain the "why" behind any recommendation
- When multiple valid approaches exist, present them with trade-offs in a table (complexity, coupling, performance, maintainability)
- Proactively surface what the user may not have considered: edge/error cases, side effects, cross-service impact, reversibility, cascade effects, consistency with existing flows
- When it adds value (e.g. comparing technologies, validating a pattern against current best practices), you MAY use `WebSearch` to bring in external trade-offs — cite the source and keep it secondary to the product's own context and ADRs (see Critical Rule 9)
- Prefer the simplest design that fits. Call out over-engineering

#### C. Converge and point forward

When a topic reaches a conclusion, summarize what was decided and point to the skill that materializes it (do NOT materialize it here):

```markdown
**Resumen de lo que definimos:**
- {{decision/conclusion 1}}
- {{decision/conclusion 2}}

**Para materializarlo:**
{{relevant pointer, e.g.}}
- Capturar como requerimiento funcional: `/product-new-request`
- Disenar la solucion tecnica de un request existente: `/product-design-request REQ-XXX`
- Cambiar arquitectura / APIs / schemas / ADRs existentes: `/product-change-technical-definition`

Seguimos discutiendo algo mas o cerramos aca?
```

Stay in the loop until the user ends the session.

## Output

Text output only. No files created or modified.

The session produces:
- Architectural reasoning grounded in the existing product context
- Options and trade-offs for the decisions discussed
- Edge cases, conflicts, and cross-service impacts surfaced
- Pointers to the skills that materialize the conclusions
