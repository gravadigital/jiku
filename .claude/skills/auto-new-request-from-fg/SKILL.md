---
name: auto-new-request-from-fg
description: Automatically generate a REQ document from a PRD feature group - no user interaction
argument-hint: "[feature-group-number]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep"
---

# Auto New Request from Feature Group

## Purpose

Automatically transform a PRD feature group into a complete REQ document, resolving all ambiguities autonomously with documented assumptions. This is a **mechanical transformation** — no user interaction.

**Flow:**
```
Step 0: Validate input (feature group number required)
  |
Step 1: Load full product context (PRD, requirements, feature groups, stories, requests, flows, ADRs)
  |
Step 2: Extract feature group content
  |
Step 3: Analyze and resolve ambiguities as documented assumptions
  |
Step 4: Define acceptance criteria (happy path + error cases from domain)
  |
Step 5: Draft, save & notify
```

**Result:** REQ-XXX document with status `captured`, ready for `/product-design-request` or `/auto-implement-request`.

**This command does NOT:**
- Ask questions to the user — all ambiguities are resolved as documented assumptions
- Design technical solutions — Use `/product-design-request` after
- Work with free-text input — Use `/product-new-request` for conversational capture

## Role

**Adopt the Analyst Agent role** - Read [Analyst Agent](.claude/agents/analyst.md)

## CRITICAL RULES

1. **NO user interaction** - Do NOT ask questions, wait for confirmation, or present options. Resolve everything autonomously
2. **NO technical decisions** - Do NOT read architectures, APIs, or schemas
3. **Focus on functional requirements** - What, not how
4. **Document ALL assumptions** - Every ambiguity resolved autonomously must be documented in the `## Clarificaciones` section as a `### Supuestos (modo automático)` entry
5. **Use Spanish** for all generated content
   - Translate ALL content including section titles from English templates
6. **Reference locations from Files index** - Do not hardcode paths
7. **Do NOT dump full content in chat** - Save to file, show summary
8. **Avoid duplicate requests** - Check existing REQs and skip if the feature group is already captured

## Execution

### Step 0: Validate Input

**CRITICAL: This command REQUIRES a feature group number as parameter.**

Parse `$ARGUMENTS` as the feature group number:
- Accept: `1`, `2`, `3`, etc.
- This refers to the Nth feature group in the PRD feature groups document

If `$ARGUMENTS` is empty or not provided:

```markdown
Este comando requiere el número de feature group como parámetro.

**Uso:** `/auto-new-request-from-fg 1`
```

**ABORT if no argument provided.**

---

### Step 1: Load Full Product Context

Read [Files index](.claude/utils/index.md) to get all locations, then read:

1. **PRD Goals & Context** from **prd_folder** — product vision and objectives
2. **PRD Requirements** from **prd_folder** (complete document, including Domain Entities)
   - Extract **domain_context**: entity names, attributes, enums, state transitions, business rules
3. **PRD Feature Groups** from **prd_folder** — all feature groups with descriptions
4. **Existing Requests** from **requests_folder** — all REQ files, to avoid duplicates
5. **Existing Stories** from **stories_folder** — browse recent stories for related functionality
6. **System Flows** from **flows_folder** (if exists) — list flow names for context
7. **ADRs** from **adrs_folder** (list titles only) — key technical constraints that may inform acceptance criteria

**If PRD does NOT exist:**

```markdown
No se encontró el PRD del producto.

Este comando requiere documentación de producto existente.

**Ejecutá primero:** `/product-initialize`
```

**ABORT.**

---

### Step 2: Extract Feature Group

1. Locate the feature group matching the provided number in the feature groups document
2. **If not found:**
   ```markdown
   No se encontró el Feature Group {{number}} en el PRD.

   **Feature groups disponibles:** {{count}}
   {{numbered list of titles}}
   ```
   **ABORT.**

3. Extract from the feature group:
   - Title
   - Description
   - Capabilities it implements (C-XX references)
   - Preconditions and postconditions
   - Value delivered

4. **Check for existing coverage:**
   - Compare the feature group title and capabilities against existing REQ files
   - If an existing REQ clearly covers this feature group:
     ```markdown
     El Feature Group {{number}} ("{{title}}") ya tiene cobertura en {{REQ-XXX}}.

     No se creará un request duplicado.
     ```
     **ABORT (not an error).**

5. **Determine next REQ number:**
   - Check existing files in **requests_folder**
   - Find highest REQ-XXX number, increment by 1 (or start at REQ-001)

---

### Step 3: Analyze and Resolve Ambiguities

Using the feature group content as the "client request", run the same analysis as `/product-new-request` Step 3 — but resolve everything autonomously:

**3.1 Implicit Behavior Detection**

Scan the feature group description for behaviors it assumes but never states:
- Persistence and state (retention scope, reversibility)
- Error and edge case handling (failure behavior, invalid input)
- State transitions and UI feedback (loading states, navigation)
- Concurrency and multi-actor scenarios
- Side effects and notifications
- Scope and boundaries (bulk behavior, permissions, backward compatibility)

**3.2 Issue Detection**

Analyze against **domain_context**, feature groups, stories, and flows for:
- Ambiguity issues (scope, flow, actor, preconditions)
- Conflict issues (business rules, existing flows, permissions)
- Missing information (entities, states, side effects)
- Scope and consequences (cascade effects, reversibility, batch behavior)

**3.3 Autonomous Resolution**

For each issue detected, resolve it using the full product context. Document each resolution as:

```markdown
### Supuestos (modo automático)
- **[Issue type / Implicit behavior]:** [descripción del gap detectado] → **Supuesto tomado:** [decisión tomada y justificación basada en documentación]
```

---

### Step 4: Define Acceptance Criteria

**4.1 Draft happy path criteria**

Based on the feature group's capabilities and resolved assumptions, draft acceptance criteria using DADO-CUANDO-ENTONCES format.

Preconditions in DADO must be specific — reference concrete roles, states, or values from **domain_context**.

**4.2 Derive error cases from domain**

Evaluate **domain_context** to derive error cases automatically:
- Invalid state transitions
- Unauthorized access attempts
- Business rule violations
- Side effect verification

---

### Step 5: Draft, Save & Notify

**5.1 Read Template Specification**

Read **Request Template** from Files index for document structure.

**5.2 Draft Complete Request Document**

Generate the full REQ document in Spanish, following the template structure. Key differences from interactive capture:

- **Requerimiento Original**: Use the feature group title and description as the source text, with `**Fuente:** PRD Feature Group {{number}}`
- **Clarificaciones**: Include the `### Supuestos (modo automático)` section with all resolved ambiguities
- **Domain Entity Impact**: Evaluate and include if the feature group introduces or modifies entities

**5.3 Save Document**

Save to **requests_folder** using **Request** filename pattern from Files index.

**5.4 Notify**

```markdown
Request guardado: REQ-{{number}} - {{title}}

Archivo: {{requests_folder}}/REQ-{{number}}.{{title_short}}.md
Status: captured
Origen: PRD Feature Group {{fg_number}} - {{fg_title}}

Incluye:
- {{N}} requerimientos funcionales
- {{M}} criterios de aceptación
- {{K}} supuestos documentados
```

Do NOT wait for confirmation. Do NOT show next steps. The subagent completes here and returns control to the orchestrator.

## Output

File saved to **requests_folder** (see Files index for location)

The document contains:
- Feature group content as original request
- Product context (feature groups/stories/services related)
- Autonomous assumptions (documented)
- Functional requirements
- Acceptance criteria (happy path + error cases derived from domain)
- Domain entity impact (if applicable)
- Status: `captured`
