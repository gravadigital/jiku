---
name: product-new-request
description: Capture and clarify a client requirement from a functional perspective into a REQ document
argument-hint: "[REQ-number]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
---

# New Request

## Purpose

Capture and clarify a client requirement from a purely functional perspective.
This command focuses on understanding WHAT the user wants, not HOW to implement it.

**Flow:**
```
Step 0: Initialize (Files index, config, next REQ number)
  |
Step 1: Gather product context (PRD, feature groups, stories, services)
  |
Step 2: Receive client request (verbatim)
  |
Step 3: Functional clarification (batched questions)
  |
Step 4: Define acceptance criteria (DADO-CUANDO-ENTONCES + error cases from domain)
  |
Step 5: Draft & save request document
  |
Step 6: Notify & show next steps
```

**Result:** Request file (REQ-XXX) with status `captured`, ready for technical design with `/product-design-request`

**This command does NOT:**
- Read technical documentation (architectures, APIs, schemas) -- Use `/product-design-request`
- Make technical decisions or define implementation approach
- Propose API or database changes

## Role

**Adopt the Analyst Agent role** - Read [Analyst Agent](.claude/agents/analyst.md)

## CRITICAL RULES

1. **NO technical decisions** - Do NOT read architectures, APIs, or schemas
2. **Focus on functional requirements** - What, not how
3. **Save first, then notify** - Save documents, notify user, show next steps (no confirmation needed -- user already validated acceptance criteria)
4. **Use Spanish** for all user interactions and document content
   - Translate ALL content including section titles from English templates
   - Examples: "Goals" -> "Objetivos", "Background" -> "Contexto", "Success Criteria" -> "Criterios de Exito"
5. **Reference locations from Files index** - Do not hardcode paths
6. **Gather product context first** - Read existing product documentation before asking questions
7. **Do NOT dump full content in chat** - Save to file, show summary, let user review file directly

## Execution

### Step 0: Initialize

1. Read [Files index](.claude/utils/index.md) to get locations
2. Read `.claude/local-config.yaml` if it exists
3. Create **requests_folder** if it doesn't exist
4. Determine REQ number:
   - If the user passed $ARGUMENTS, parse it as the REQ number:
     - Accept any of these formats: `REQ-003`, `003`, `3` -- all resolve to `REQ-003`
     - Extract the numeric part, zero-pad to 3 digits, prefix with `REQ-`
     - **If a file with that REQ number already exists, ABORT:**
       ```markdown
       Ya existe el archivo para REQ-{{number}}.

       Si queres modificarlo, edita directamente el archivo en **requests_folder**.
       Si queres crear uno nuevo, ejecuta `/product-new-request` sin argumentos.
       ```
   - If no $ARGUMENTS provided, auto-calculate:
     - Check existing files in **requests_folder**
     - Find highest REQ-XXX number
     - Increment by 1 (or start at REQ-001)

### Step 1: Gather Product Context

**Read existing product documentation to understand current state (skip if file doesn't exist):**

1. **PRD Index** from **prd_folder**
   - Understand product vision and objectives
   - Note key features already defined

2. **PRD Requirements** from **prd_folder** -- Domain Entities section only (skip if file doesn't exist)
   - Extract: entity names, key attributes, enums with all values, state transitions, business rules
   - Store this as **domain_context** -- used in Step 3 to anchor clarification questions
   - Do NOT read the full requirements document -- just the Domain Entities section

3. **PRD Feature Groups** from **prd_folder**
   - List all existing feature groups
   - Understand what's already planned or implemented
   - This will help understand if the request fits in an existing feature group

4. **Service Map** (if exists)
   - Identify existing services and their roles
   - Understand current system architecture at high level

5. **Existing Stories** from **stories_folder**
   - Browse recent stories (last 10-15)
   - Identify potential duplicates or related functionality

6. **System Flows** from **flows_folder** (if exists)
   - List existing flow names (do NOT read full content -- this is functional capture, not technical)
   - Note which flows might relate to the incoming request
   - This helps reference related flows in the "Contexto del Producto" section

**Inform user (in Spanish) what context was found using this format:**

```
Lei la documentacion del producto. Encontre:
- PRD con vision del producto: [breve resumen en 1 linea]
- [X] feature groups existentes: [listar solo los titulos]
- [Y] stories recientes
- [Z] servicios en el sistema
- [W] flujos del sistema documentados
- Entidades del dominio: [listar nombres, ej: Pedido, Cliente, Factura]

Esto me ayudara a hacer mejores preguntas y evitar duplicados.
```

**DO NOT add extra text before or after this message. Show the context and immediately proceed to Step 2.**

**CRITICAL: If PRD does NOT exist, ABORT:**

```markdown
No encontre el PRD del producto.

Este workflow requiere que exista documentacion del producto antes de capturar requerimientos.

**Primeros pasos requeridos:**
1. Inicializar producto con `/product-initialize`
2. Luego podes volver a ejecutar `/product-new-request`

No puedo continuar sin el PRD.
```

**DO NOT PROCEED if PRD doesn't exist. Stop execution here.**

### Step 2: Receive Client Request

Ask the user directly using this EXACT text (in Spanish):

```
Por favor, comparti el requerimiento del cliente. Puede ser en cualquier formato:
- Email o mensaje del cliente
- Notas de una reunion
- Descripcion verbal
- Ticket o issue

Copia el texto tal cual lo recibiste.
```

**DO NOT rephrase or paraphrase this message. Use it exactly as written.**

**Wait for the user's response and store the original text verbatim** - Do not modify or clean it up.

### Step 3: Functional Clarification

**This step is analysis-driven, not questionnaire-driven.**

Do NOT run a fixed list of questions. Instead:
1. Analyze the request against everything in context (domain_context, feature groups, stories, flows)
2. Detect issues -- gaps, ambiguities, conflicts, missing information
3. Ask ONLY about what you found -- nothing else

If no issues are found of a certain type, skip it entirely. If the request is clear and the domain resolves everything, this step may produce very few questions or none at all.

---

**3.1 Issue Detection**

Run this analysis internally before asking anything. For each issue type, determine if it applies to this request:

**Ambiguity issues:**
- **Ambiguous scope**: The request could imply a large set of operations (create, edit, delete, history...) but doesn't specify which subset is wanted
- **Ambiguous flow**: The request describes an outcome but not the steps to get there, and there are multiple plausible interpretations
- **Actor not specified**: The request describes an action but doesn't say who performs it -- and the domain has multiple roles with different permissions
- **Precondition not clear**: The action only makes sense in a certain context, but the request doesn't specify what must exist or be true before it executes

**Conflict issues:**
- **Conflicts with existing business rule**: The request asks for something that contradicts a rule documented in domain_context -- is this intentional?
- **Conflicts with existing flow**: There's a documented flow that covers this functionality partially or fully -- does the request extend it, replace it, or is it something different?
- **Permission exception**: The request asks someone to do something they currently can't according to domain rules -- is this a deliberate permission change?
- **Internal contradiction**: The request describes two behaviors that contradict each other

**Missing information issues:**
- **Entity not in domain**: The request mentions something that doesn't exist in domain_context -- is it a new entity, or part of an existing one?
- **State/transition not specified**: The request affects an entity that has states, but doesn't specify which states the action applies to or whether transitions change
- **Side effects not addressed**: The domain documents side effects (notifications, cascading changes) for this entity/operation -- are they expected to apply here too?
- **Impact on external systems**: Existing flows document integrations with external systems that could be affected -- the request doesn't address this

**Scope and consequences issues:**
- **Implicit cascade effect**: The action modifies an entity that other entities depend on -- what happens to the dependents?
- **Reversibility not addressed**: The request implies a destructive or irreversible action -- is this intentional? Is there a need for confirmation or soft delete?
- **Batch vs. individual ambiguity**: The request implies an operation that could be applied to one record or many -- is the expected behavior the same in both cases?

**Quality issues:**
- **Non-verifiable success criterion**: The request describes a result that can't be objectively measured or tested ("easier", "better", "faster")
- **Partial duplicate**: An existing story or feature group already covers part of what's being asked -- are they complementary or overlapping?

---

**3.2 Ask about detected issues**

For each issue detected, formulate a specific question that cites the evidence:
- Quote the relevant part of the request that triggered the issue
- Cite the domain rule, flow, or story that creates the conflict or gap
- Offer concrete options when the answer space is bounded

Group related issues into batches of 2-4 questions. Use `AskUserQuestion` for each batch.
Wait for the user's response before asking the next batch.

**How to use AskUserQuestion:**
```javascript
AskUserQuestion({
  questions: [
    {
      question: "El request menciona '[quote]'. Un/a [Entidad] tiene estados: [A/B/C]. Esta accion aplica en todos los estados o solo en algunos?",
      header: "[Issue type]",
      multiSelect: false,
      options: [
        { label: "Todos los estados", description: "La accion es valida sin importar el estado actual" },
        { label: "Solo en [estado X]", description: "Solo cuando la entidad esta en ese estado" },
        { label: "Otro", description: "Especifica cuales" }
      ]
    }
  ]
})
```

**If no issues are detected:** skip this step entirely and proceed to Step 4. Do NOT ask generic questions just to fill the step.

### Step 4: Define Acceptance Criteria

**4.1 Draft happy path criteria**

Based on clarifications, draft acceptance criteria for the main flow using DADO-CUANDO-ENTONCES format.

Preconditions in DADO must be specific -- reference concrete roles, states, or values from **domain_context**:

```
1. DADO [contexto especifico: rol, estado de entidad, datos concretos]
   CUANDO [accion del usuario con valores concretos]
   ENTONCES [resultado esperado con valores concretos]
```

**Present to user (in Spanish):**

> "Estos son los criterios de aceptacion para el flujo principal:
>
> [lista de criterios]
>
> Estan completos? Modificarias o agregarias algo?"

**Wait for user approval or changes. Iterate until approved.**

**4.2 Derive error cases from domain (no user interaction needed)**

Once happy path is approved, evaluate **domain_context** to derive error cases automatically.
Do NOT ask the user -- add them directly to the criteria list.

Check each of the following against the entities involved in this request:

- **State transitions:** If the entity has defined transitions, add a criterion for an invalid transition
  - e.g. entity has states `A/B/C` and only `A->B` and `B->C` are valid -> add criterion for attempting `A->C`
- **Permission rules:** If the entity has role-based restrictions, add a criterion for unauthorized access
  - e.g. only `owner` can delete -> add criterion where a `member` attempts deletion
- **Business rules:** If domain_context has explicit rules for this entity (max values, required relationships, immutability conditions), add a criterion that violates each relevant rule
- **Side effects:** If the action triggers side effects documented in business rules (notifications, cascading state changes), add a criterion that verifies the side effect occurred

**Only ask the user if a case is genuinely ambiguous** -- i.e. the domain doesn't have enough information to determine the expected behavior.

After adding error cases, the full criteria list (happy path + error cases) goes into the REQ-XXX document.

### Step 5: Draft Complete Request Document

**5.1 Read Template Specification**

Read **Request Template** from Files index to understand document structure, format, and examples for the capture phase.

**5.2 Draft Complete Request Document**

Before drafting, evaluate domain entity impact:
- Does the request introduce any entity NOT present in **domain_context**? -> Document as new entity
- Does the request modify an enum, state, transition, or business rule of an existing entity? -> Document as modification
- If no impact -> omit the `## Impacto en Domain Entities` section entirely

Following the template structure, draft the full captured request (in Spanish):

```markdown
---
id: REQ-{{number}}
title: "{{title}}"
status: captured
created: {{YYYY-MM-DD}}
---

# REQ-{{number}}: {{title}}

## Requerimiento Original

> [texto original del cliente, verbatim]

**Fuente:** [email/mensaje/reunion/ticket]

## Contexto del Producto

[Only include if product documentation was found]

**Feature groups relacionados:**
- {{title}} - [relacion]

**Stories relacionadas:**
- Story {{id}}: {{title}} - [relacion]

**Servicios involucrados:**
- [lista de servicios mencionados]

## Clarificaciones

### Funcionales
- **P:** [pregunta]
- **R:** [respuesta]

### Alcance
- **P:** [pregunta]
- **R:** [respuesta]

### Negocio
- **P:** [pregunta]
- **R:** [respuesta]

## Requerimientos Funcionales

1. [requerimiento 1]
2. [requerimiento 2]
3. [requerimiento 3]

## Criterios de Aceptacion

1. DADO [contexto]
   CUANDO [accion]
   ENTONCES [resultado]

2. ...

## Clasificacion

- **Prioridad:** {{alta|media|baja}}

## Impacto en Domain Entities

[Only include this section if the request introduces new entities or modifies existing ones.
Omit entirely if domain entities are unaffected.]

**Entidades nuevas:**
- **[NombreEntidad]**: [descripcion funcional, atributos clave identificados, relaciones con entidades existentes]

**Modificaciones a entidades existentes:**
- **[NombreEntidad]**: [que cambia -- nuevo estado en enum, nueva regla de negocio, nuevo atributo, etc.]
```

**5.3 Save Document**

Save document to **requests_folder** using **Request** filename pattern from Files index.

### Step 6: Notify and Next Steps

Present summary and next steps to user (in Spanish) - **DO NOT show full content, DO NOT wait for confirmation** (the user already validated acceptance criteria in Step 4, the document only consolidates what was discussed):

```markdown
**Requerimiento capturado**

Request: REQ-{{number}} - {{title}}
Archivo: {{requests_folder}}/REQ-{{number}}.{{title_short}}.md
Status: captured

---

**Siguiente paso:**
Ejecuta `/product-design-request REQ-{{number}}` para diseniar la solucion tecnica.

Esto va a:
- Leer toda la documentacion tecnica (arquitecturas, APIs, schemas)
- Analizar el impacto tecnico
- Diseniar la solucion y proponer el story split
- Actualizar el request a status "designed"
```

## Output

File saved to **requests_folder** (see Files index for location)

The document contains:
- Original request (verbatim)
- Product context (feature groups/stories/services related)
- Clarification Q&A
- Functional requirements
- Acceptance criteria (happy path + error cases derived from domain)
- Domain entity impact (if applicable)
- Status: `captured`
