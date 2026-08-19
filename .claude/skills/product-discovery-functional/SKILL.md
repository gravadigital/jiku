---
name: product-discovery-functional
description: Discovery phase - produces a decision-complete functional analysis and a DDD-light domain analysis before product initialization
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, WebSearch, WebFetch"
argument-hint: "[brief-doc-path]"
---

# Discovery - Functional & Domain Analysis

## Purpose

Run the Discovery phase as the Analyst: produce a decision-complete **functional analysis** and a DDD-light **domain analysis** from an optional base brief (or from scratch), BEFORE `/product-initialize`. Front-loading these decisions makes initialization linear transcription instead of interactive discovery.

**Flow:**

```
Step 0: Validate & Load Context (read brief if provided)
  |
Step 1: Facilitate Functional Discovery (scope, principles, feature map, transversales)
  |
Step 2: Resolve Ambiguities -> "Decisiones tomadas" (with rationale)
  |
Step 3: Draft & Save analisis-funcional.md  [WAIT approval]
  |
Step 4: Facilitate Domain Discovery (DDD-light: entities, states, invariants, events, bounded contexts)
  |
Step 5: Draft & Save analisis-dominio.md  [WAIT approval]
  |
Step 6: Finalization -> Suggest /product-discovery-technical
```

**Result:** Two decision-complete discovery documents in `docs/discovery/` (`analisis-funcional.md`, `analisis-dominio.md`) that linearize the downstream PRD and technical phases.

**This command does NOT:**

- Define technical stack, services, or communication patterns
- Create the formal PRD (goals, requirements, feature groups)
- Create APIs, DB schemas, ADRs, or flows

These are handled in `/product-discovery-technical`, `/product-initialize`, and `/product-initialize-technical`.

## Role

**Adopt the Analyst Agent role** - Read [Analyst Agent](.claude/agents/analyst.md)

## Pre-loaded Context

### Existing Discovery Check

!`ls docs/discovery/ 2>/dev/null || echo "NO_DISCOVERY_FOUND"`

## CRITICAL RULES

1. **ABORT if discovery already exists** - If the "Existing Discovery Check" above shows files (not "NO_DISCOVERY_FOUND"), this product already has discovery docs. Show the abort message; to redo, the user deletes `docs/discovery/` and re-runs (this skill regenerates both docs from scratch, it does not patch one section)
2. **Use Spanish** for all user interactions and generated documents
   - Translate ALL content including section titles from English templates
   - Examples: "Domain Events" -> "Eventos de Dominio", "Bounded Contexts" -> "Contextos Delimitados", "Decisions Made" -> "Decisiones Tomadas"
3. **Save first, then validate** - Save documents, notify user, wait for confirmation
4. **Reference locations from Files index** - Use folder IDs (discovery_folder, references_folder). Do not hardcode paths
5. **Do NOT dump full content in chat** - Save to file, show summary, let user review file directly
6. **Facilitate, don't generate** - Extract knowledge from the user. When you must assume something, say it explicitly: "Voy a asumir X porque Y. Es correcto?"
7. **Challenge vagueness at the point of impact** - Push back on vague scope, entities, states, invariants, or NFR targets. Test: "Could the Technical Leader build this without asking me a question?"
8. **Every ambiguity lands in "Decisiones Tomadas" with its rationale** - This is the load-bearing artifact. A decision without a "por qué" is incomplete
9. **The domain analysis is a SUPERSET of the PRD Domain Entities section** - Entity names, types and enum values must be reusable verbatim by `/product-initialize`
10. **Every bounded context MUST name the service(s) it becomes** - This is the bridge that linearizes the technical phase
11. **Research external integrations when mentioned** - When the user names a third-party service or integration (payment gateway, auth provider, external API, etc.) that you don't have documentation for, you MAY use `WebSearch`/`WebFetch` to consult its official docs and ask better-informed questions. Always confirm findings with the user — never assume the integration behaves as the web says without validating against what the user actually needs. Save relevant external docs to **references_folder** (do not embed them in the discovery docs)

## Execution

### Step 0: Validate & Load Context

**0.1 Load Context**

1. Read [Files index](.claude/utils/index.md) to get all locations
2. Identify key folders:
   - **discovery_folder** - Where to save discovery documents
   - **references_folder** - Where to save external API/integration docs (if any)

**0.2 Validate Prerequisites**

Check the "Existing Discovery Check" from the pre-loaded context above.

**If discovery docs exist (files listed, not "NO_DISCOVERY_FOUND"), ABORT:**

```markdown
Este producto ya tiene documentos de discovery en docs/discovery/

Para rehacerlo, elimina `docs/discovery/` y volve a ejecutar este comando
(regenera el analisis funcional y el de dominio desde cero).

No puedo continuar para evitar sobrescribir el analisis existente.
```

**0.3 Resolve the Base Brief**

Parse `$ARGUMENTS` as an optional path to a base brief / idea document.

- **If a path was provided and the file exists:** Read it FULLY. Treat it as primary source material (do NOT echo it back; summarize your understanding for confirmation).
- **If a path was provided but not found:** Ask the user to confirm the path or paste the content. **Wait.**
- **If no argument:** Ask (in Spanish):

  ```markdown
  ## Discovery del Producto

  Voy a ayudarte a cerrar el analisis funcional y de dominio antes de inicializar.

  **Tenes un documento base / brief de la idea?**

  Compartilo (path o pega el contenido), o escribi "desde cero" y lo construimos juntos con preguntas.
  ```

  **Wait for user input.** If "desde cero", facilitate fully from scratch.

If the brief references external APIs/integrations, save each to **references_folder** and update **references_folder**/index.md (do not embed them in the discovery docs).

**0.4 Create Discovery Folder**

```bash
mkdir -p docs/discovery
```

---

### Step 1: Facilitate Functional Discovery

Start open, then ask follow-ups ONLY on gaps. React to what the user says -- don't run a rigid questionnaire.

**1.1 Context & Objective**

Capture (or confirm from the brief): what the product is and for whom, the strategic objective (e.g., brand awareness vs revenue), and the guiding principles.

**1.2 Scope**

Push for an explicit in/out table for v1. Ask: "Hay algo que el cliente menciono que explicitamente NO entra en v1?"

**1.3 Constraints**

Legal/regulatory and hard technical constraints (only if relevant).

**1.4 Functional Map (draft)**

Propose the high-level functional map: a tree of feature groups + a "Transversales" branch. Label it as a DRAFT that `/product-initialize` will formalize.

**1.5 Per-Feature-Group Deep-Dive**

For each feature group, extract: objective, configurations (with defaults), step-by-step flow, business rules, edge cases / failure conditions, and states (where applicable). Go DEEP where logic is complex; stay brief on simple CRUD.

**1.6 Transversal Concerns / NFRs**

Privacy, moderation, rate-limiting, accessibility, audio, visual identity, i18n, metrics -- only the ones relevant. Ask for orders of magnitude when exact numbers are unknown ("decenas, cientos, miles?").

Ask in 2-3 rounds max per area. **Wait between rounds.**

---

### Step 2: Resolve Ambiguities -> "Decisiones Tomadas"

This is the load-bearing step. As discovery surfaces ambiguities, resolve each one WITH the user and record it with a rationale.

**2.1** Keep a running list: every decision = theme + chosen resolution + the "por qué". This becomes the "Decisiones Tomadas" table.

**2.2** For each unresolved ambiguity, present it with 2-3 options and a recommendation; let the user decide; record the "por qué". Use AskUserQuestion for crisp choices.

**2.3** Surface deferred items and open questions explicitly -- a deferred decision is still a decision.

---

### Step 3: Draft & Save `analisis-funcional.md`

**3.1 Read Template Specification**

Read **Discovery Functional Template** from Files index.

**3.2 List Assumptions** (in chat, before writing)

If you filled any gaps, show them explicitly:

```markdown
Antes de escribir el documento, necesito confirmar algunas cosas:

- [Item que asumo o que quedo vago]

Es correcto?
```

**Wait for confirmation.** If the user covered everything, skip this.

**3.3 Draft** the document following the template structure, in Spanish, with frontmatter (`created`, `last_updated`, `status: "Análisis funcional cerrado"`, `documento_base`). Content must be traceable to what the user said.

**3.4 Save** directly to **discovery_folder**/analisis-funcional.md

**3.5 Notify** (do NOT show full content):

```markdown
Documento guardado: `docs/discovery/analisis-funcional.md`

Incluye:

- Contexto y alcance (in/out, restricciones)
- Mapa funcional (feature groups draft + transversales)
- Detalle por feature group (flujos, reglas, edge cases)
- Transversales / NFRs
- Tabla de Decisiones Tomadas (con su rationale)
- Fuera de alcance / preguntas abiertas

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**3.6** If the user requests changes: edit, notify again, repeat. **Wait for approval.**

---

### Step 4: Facilitate Domain Discovery (DDD-light)

Now build the bridge document. Reuse everything already learned -- propose, don't re-ask. Sub-steps map to the domain template sections.

**4.1 Ubiquitous Language** - Capture the shared glossary first; it anchors everything.

**4.2 Entities** - Propose entities from the functional analysis. For each, extract key attributes with types, req/opt, enums with ALL values and defaults. THIS must be reusable verbatim as the PRD Domain Entities section -- use the same notation (`campo (tipo, req/opt)`, `estado (enum: a/b/c, default: a)`).

**4.3 Relationships** - belongs_to / has_many / references, with cardinality.

**4.4 Lifecycle / States** - Per stateful entity: states + allowed AND forbidden transitions.

**4.5 Invariants / Business Rules** - Rules that must always hold, tagged by entity/context.

**4.6 Domain Events** - Significant state changes (foreshadow the technical phase; do NOT decide transport here).

**4.7 Bounded Contexts -> Services** - Group entities into bounded contexts and name the service(s) each becomes. THIS IS THE BRIDGE. Challenge any context that can't name a clear service owner.

**Challenge hardest on states and invariants.** Ask in rounds. **Wait between rounds.**

---

### Step 5: Draft & Save `analisis-dominio.md`

**5.1 Read Template Specification**

Read **Discovery Domain Template** from Files index.

**5.2 List Assumptions** - Show any inferred enums/types/cardinalities. **Wait** if there are assumptions.

**5.3 Draft** following the domain template, in Spanish, with frontmatter (`created`, `last_updated`, `status: "Análisis de dominio cerrado"`, `analisis_funcional`). Cross-check entity names against the functional document for consistency.

**5.4 Save** directly to **discovery_folder**/analisis-dominio.md

**5.5 Notify** (do NOT show full content):

```markdown
Documento guardado: `docs/discovery/analisis-dominio.md`

Incluye:

- Lenguaje ubicuo (glosario)
- Entidades con tipos, enums y relaciones
- Ciclos de vida y estados (transiciones permitidas/prohibidas)
- Invariantes y reglas de negocio
- Eventos de dominio
- Contextos delimitados -> servicios (el puente al analisis tecnico)

Estas entidades son el vocabulario que `/product-initialize` y el analisis tecnico
van a consumir verbatim.

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

**5.6** If the user requests changes: edit, notify again, repeat. **Wait for approval.**

---

### Step 6: Finalization

Confirm both documents and present the next step (in Spanish):

```markdown
Fase de Discovery (funcional + dominio) completada.

Documentos creados:

- docs/discovery/analisis-funcional.md
- docs/discovery/analisis-dominio.md

---

## Siguiente paso: Analisis Tecnico

**Ejecuta:** `/product-discovery-technical`

Va a leer estos dos documentos y producir el analisis tecnico (mapa de servicios,
stack por servicio, patrones de comunicacion, flujos clave, y validacion de cobertura).

Queres que ejecute `/product-discovery-technical` ahora?
```

## Output

Files saved to **discovery_folder** (see Files index for location):

- `docs/discovery/analisis-funcional.md` - Decision-complete functional analysis (scope, feature map, transversales, decisions made)
- `docs/discovery/analisis-dominio.md` - DDD-light domain analysis (entities, states, invariants, events, bounded contexts)

Each document contains:

- Frontmatter with metadata
- Content following template structure
- Status indicating the phase is closed
