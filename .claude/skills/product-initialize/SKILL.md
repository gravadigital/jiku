---
name: product-initialize
description: Bootstrap new product - creates PRD goals, requirements, and feature groups from scratch
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
---

# Initialize Product

## Purpose

Bootstrap a new product from scratch. Creates foundational product documentation:

- PRD - Goals and Context
- PRD - Requirements
- Feature Groups

**Flow:**

```
Step 0: Validate & Setup
  |
Step 1-2: Goals and Context (with IDs: G-XX, U-XX)
  |
Step 3: Domain Entities (shared vocabulary for agents)
  |
Step 4-5: Requirements (capabilities table with C-XX IDs)
  |
Step 6-7: Feature Groups (with pre/postconditions)
  |
Step 8: Finalization -> Suggest /product-initialize-technical
```

**Result:** Product definition ready for technical architecture phase.

**This command does NOT:**

- Create technical architecture documentation
- Define APIs or database schemas
- Create ADRs

These are handled in `/product-initialize-technical`.

## Role

**Adopt the Analyst Agent role** - Read [Analyst Agent](.claude/agents/analyst.md)

## Pre-loaded Context

### Existing PRD Check

!`ls docs/prd/ 2>/dev/null || echo "NO_PRD_FOUND"`

### Discovery Docs Check

!`ls docs/discovery/ 2>/dev/null || echo "NO_DISCOVERY_FOUND"`

## CRITICAL RULES

1. **ABORT if PRD already exists** - If the "Existing PRD Check" above shows files (not "NO_PRD_FOUND"), this product was already initialized. Show abort message with alternatives
2. **Use Spanish** for all user interactions and generated documents
   - Translate ALL content including section titles from English templates
   - Examples: "Goals" -> "Objetivos", "Background" -> "Contexto", "Success Criteria" -> "Criterios de Exito"
3. **Save first, then validate** - Save documents, notify user, wait for confirmation
4. **Reference locations from Files Index** - Use folder IDs (prd_folder, etc.) from the pre-loaded Files Index above. Do not hardcode paths
5. **Ask questions iteratively** - Don't overwhelm the user
6. **Do NOT dump full content in chat** - Save to file, show summary, let user review file directly
7. **Facilitate, don't generate** - Extract information from the user. Don't invent business rules,
   default values, or constraints from training data. When you need to assume something, say it
   explicitly: "Voy a asumir X porque Y. Es correcto?"
8. **Challenge vagueness on high-impact items** - If the user says something vague about domain
   entities, business rules, state transitions, or NFR targets, push back with specific questions.
   Don't challenge descriptions or context -- those are fine as prose
9. **Transcription mode when discovery exists** - If the "Discovery Docs Check" shows discovery
   docs (not "NO_DISCOVERY_FOUND"), follow the `## Discovery Mode` section overrides: transcribe
   from the analysis docs and ask only about genuine gaps/contradictions. ABORT on a gap a
   requirement needs (do not invent it)

## Execution

### Step 0: Validate & Setup

**0.1 Load Context**

1. Read [Files index](.claude/utils/index.md) to get all locations
2. Identify key folders:
   - **prd_folder** - Where to save PRD files
**0.2 Validate Prerequisites**

Check the "Existing PRD Check" from the pre-loaded context above.

**If PRD exists (files listed, not "NO_PRD_FOUND"), ABORT:**

```markdown
Este producto ya ha sido inicializado.

Encontre documentacion existente en docs/prd/

**Si queres:**

- **Agregar un requerimiento:** Ejecuta `/product-new-request`
- **Reiniciar desde cero:** Elimina la carpeta docs/ manualmente y volve a ejecutar este comando

No puedo continuar para evitar sobrescribir documentacion existente.
```

**0.2.b Detect Discovery Mode**

Check the "Discovery Docs Check" from the pre-loaded context above:

- Output is `NO_DISCOVERY_FOUND` (or empty) -> **discovery_mode = OFF**. Run the full interactive flow below, unchanged.
- Output lists `analisis-funcional.md`, `analisis-dominio.md` (and optionally `analisis-tecnico.md`) -> **discovery_mode = ON**. Follow the `## Discovery Mode` section overrides (after `## Output`).
- Output is partial (some docs present, some missing) -> **discovery_mode = ON**, but each step whose source doc is missing falls back to its interactive behavior. Log which docs were found.

The ABORT-if-PRD-exists check (0.2) always runs first and is unaffected by discovery mode.

**0.3 Collect User Documentation**

Ask user (in Spanish):

```markdown
## Inicializacion de Producto

Voy a ayudarte a crear toda la documentacion base para tu producto.

**Tenes documentacion existente del producto?** (opcional)

Podes compartir cualquiera de estos:

- Documentos de requerimientos
- Wireframes o mockups
- Diagramas de arquitectura
- Especificaciones de API
- Esquemas de base de datos
- Documentacion de APIs externas o integraciones (Stripe, Google OAuth, etc.)
- Cualquier otro documento relevante

Si no tenes nada, no hay problema. Te voy a hacer preguntas para construir todo desde cero.

**Comparti los documentos o escribi "continuar" para empezar.**
```

**Wait for user input.**

Store all provided documentation for later reference.

**If the user provides documentation about external APIs or integrations** (e.g., Stripe API docs, OAuth specs, third-party service contracts):
- Save each external reference to `docs/references/{integration-name}.md` (or original format)
- Create or update `docs/references/index.md` with an entry for each reference following this format:
  ```markdown
  # Referencias

  - **{filename}** — {brief description of content}
    Servicios: {which internal services use this, or "por definir"}
    Lectura: {how to consume the file: "leer completo", "buscar por seccion", etc.}
  ```

**0.4 Create Base Folder Structure**

Create empty folders:

```bash
mkdir -p docs/prd
mkdir -p docs/stories
mkdir -p docs/requests
mkdir -p docs/apis
mkdir -p docs/db-schemas
mkdir -p docs/adrs
mkdir -p docs/references
```

---

### Step 1: Gather Goals and Context

Start with an open question to let the user explain the product in their own terms.
React to what they say -- don't follow a rigid questionnaire.

**1.1 Initial Capture**

```markdown
## Contame sobre el producto

**Que producto vamos a construir y para quien?**

Contame con el nivel de detalle que tengas: que hace, quienes lo usan,
que problema resuelve. Si ya tenes decisiones tomadas (tecnologia, integraciones,
restricciones del cliente), mencionalo tambien.
```

Wait for response.

**1.2 Follow-up based on what the user said**

From the user's response, identify what you already know and what's missing.
Ask follow-ups ONLY for what's missing. Typical gaps:

- **Users unclear:** "Mencionaste que lo usan operadores y supervisores. Tienen permisos diferentes? Ven la misma informacion?"
- **Goals vague:** "Como sabria el cliente que el producto es exitoso? Hay metricas que le importen?"
- **Scope unclear:** "Hay algo que el cliente menciono que explicitamente NO entra en esta primera version?"
- **Context missing:** "Hay sistemas existentes con los que se integra? Hay decisiones de tecnologia ya tomadas?"
- **Constraints missing:** "Hay restricciones de tiempo, presupuesto o tecnologia que deba saber?"

Do NOT ask all of these -- only the ones the user didn't already cover.
If the user gave comprehensive information, move to drafting.

Wait for response. Iterate if needed (max 2-3 rounds of questions).

---

### Step 2: Draft Goals and Context Document

1. **Read template specification**:
   - Read **PRD Goals and Context Template** from Files Index

2. **Before drafting, list your assumptions** (in chat):

   If you need to fill any gaps the user didn't cover, show them explicitly:

   ```markdown
   Antes de escribir el documento, necesito confirmar algunas cosas:

   - [Item I'm assuming or that was vague]
   - [Item I'm assuming or that was vague]

   Es correcto? Cambiarias algo?
   ```

   Wait for confirmation. If the user covered everything, skip this step.

3. **Draft complete document** following template structure:
   - Use the format specified in each section
   - Generate frontmatter with current date and status "Draft - In Definition"
   - Include sections: Product Overview (with U-XX IDs), Goals (with G-XX IDs), Context (only if relevant), Scope
   - **Skip sections that don't apply** -- if there are no existing systems, don't include "Existing Systems"
   - Content must come from what the user said, not from examples in the template

4. **Save document directly** to `docs/prd/goals-and-context.md`

5. **Notify user** (do NOT show full content):

   ```markdown
   Documento guardado: `docs/prd/goals-and-context.md`

   Incluye:

   - Informacion general del producto (usuarios: U-01 a U-XX)
   - Objetivos con IDs (G-01 a G-XX) y metricas de exito
   - Contexto (sistemas existentes, decisiones tomadas)
   - Alcance (in/out scope, restricciones)

   **Revisa el archivo y decime si esta correcto o queres cambios.**
   ```

6. **If user requests changes**:
   - Edit the file with requested changes
   - Notify user again
   - Repeat until approved

7. **Once approved**: Continue to next step

---

### Step 3: Define Domain Entities

**THIS IS THE HIGHEST-VALUE STEP.** Domain entities are the shared vocabulary for
the entire PRD. If entities are wrong or incomplete, everything downstream fails.
Invest the most facilitation effort here.

**3.1 Extract entities from what the user already said**

Don't ask "what are the entities?" -- the user already described the product.
Propose entities based on what they told you, and ask what's missing:

```markdown
## Entidades del Dominio

Basandome en lo que me contaste, identifico estas entidades principales:

- **[Entity 1]**: [what you understood from the user's description]
- **[Entity 2]**: [what you understood]
- **[Entity N]**: [what you understood]

**Falta alguna? Alguna esta de mas o mal nombrada?**
```

Wait for response.

**3.2 Deep-dive per entity**

For each confirmed entity, extract specifics. THIS is where you push back on
vagueness -- types, enums, and business rules matter enormously downstream.

Ask about 2-3 entities at a time (not all at once):

```markdown
Vamos a definir los detalles de cada entidad. Arranco con las mas importantes:

**[Entity 1]:**

- Que atributos tiene? (nombre, estado, fecha, etc.)
- Si tiene estados: cuales son? hay transiciones permitidas/prohibidas?
- Quien puede crear/editar/eliminar? Todos o solo ciertos roles?

**[Entity 2]:**

- [Same type of questions adapted to this entity]
```

Wait for response. Repeat for remaining entities.

**Challenge rules:**

- If the user says "tiene un estado" -> ask "cuales son los estados posibles? cualquier transicion vale?"
- If the user says "puede tener permisos" -> ask "que permisos? a nivel de que? quien los asigna?"
- If the user mentions an attribute without type -> ask "es texto libre o tiene opciones fijas?"
- If you detect an implicit entity ("el usuario tiene diferentes roles en diferentes proyectos") -> propose it: "Eso suena como una entidad Miembro separada de Usuario. Es asi?"

**3.3 Draft and save**

Draft the Domain Entities section in `docs/prd/requirements.md`:

- Follow the format from the PRD Requirements Template (domain-entities section)
- Include key attributes with types (string, text, enum, date, etc.)
- Mark required (req) vs optional (opt) fields
- Define enum values explicitly -- ALL values, not examples
- Document relationships (belongs_to, has_many)
- Note business rules per entity

**Save and notify:**

```markdown
Entidades del dominio definidas en `docs/prd/requirements.md`

Entidades identificadas:

- [Entity 1]: [key attributes summary]
- [Entity 2]: [key attributes summary]
- [Entity N]: [key attributes summary]

Estas entidades son el vocabulario compartido en todo el PRD.
Los requerimientos van a referenciar estas entidades por nombre exacto.

**Revisa el archivo y decime si esta correcto o queres cambios.**
```

---

### Step 4: Gather Functional Requirements

**4.1 Extract features from what the user already described**

By now you have goals, scope, and domain entities. You probably already know most
of the features. Propose them and ask what's missing:

```markdown
## Requerimientos Funcionales

Basandome en lo que definimos, las features principales serian:

1. **[Feature name]**: [brief description based on what user already said]
2. **[Feature name]**: [brief description]
3. **[Feature name]**: [brief description]

**Falta algo? Hay alguna feature que cambiarias o sacarias?**
```

Wait for response.

**4.2 Deep-dive per feature (only where needed)**

For features that are straightforward CRUD on a well-defined entity, you already
have enough from Step 3 (Domain Entities). Don't re-ask.

For features that involve **complex logic**, ask specifically:

- Multi-step flows: "Como funciona el proceso de [X] paso a paso?"
- Conditional rules: "Que pasa cuando [edge case]?"
- Integrations: "Que datos se envian/reciben? Hay documentacion de la API externa?"
- Permissions: "Quien puede hacer esto? Solo ciertos roles?"

**4.3 NFRs -- ask only what the user can answer**

Don't ask the user to invent performance numbers. Instead:

```markdown
## Requerimientos No Funcionales

Necesito saber algunos targets tecnicos. Si no tenes un numero exacto, decime
el orden de magnitud:

- **Usuarios concurrentes esperados:** decenas, cientos, miles?
- **Volumen de datos:** cuantos [main entity] esperas en el primer anio?
- **Requisitos de seguridad:** Hay compliance especifico? (HIPAA, GDPR, SOC2, etc.)
- **Disponibilidad:** Es critico 24/7 o tolera downtime en horarios no laborales?
```

Wait for response. For targets the user can't answer, propose reasonable defaults
and mark them as assumed.

---

### Step 5: Draft Requirements Document

1. **Read template specification**:
   - Read **PRD Requirements Template** from Files Index

2. **Draft complete document** following template structure:
   - Use the format specified in each section
   - Follow the examples for tone and level of detail
   - Generate frontmatter with current date and status "Draft - In Definition"
   - **Domain Entities section** should already be in the file from Step 3
   - Include all sections:
     - Domain Entities (already saved, verify consistency)
     - Core Features with **capabilities table** (ID, Actor, Entity, Operation, Key Fields, Business Rules)
     - Acceptance Criteria with **concrete example values** (not generic placeholders)
     - Non-Functional Requirements in **table format** with measurable targets
     - Assumptions
     - Open Questions

   **DUAL-AUDIENCE RULES:**
   - Capabilities table MUST reference entities from the Domain Entities section by exact name
   - Actor column MUST reference Target Users (U-XX) from goals-and-context.md or entity roles
   - Key Fields MUST include type (string, text, enum, date, bool, int) and req/opt
   - Enum fields MUST list all valid values
   - Business Rules MUST be specific enough to implement without interpretation

3. **Save document directly** to `docs/prd/requirements.md`

4. **Notify user** (do NOT show full content):

   ```markdown
   Documento guardado: `docs/prd/requirements.md`

   Incluye:

   - Entidades del Dominio (vocabulario compartido)
   - Core Features con tabla de capabilities (entity, operation, fields, rules)
   - Acceptance Criteria con valores concretos
   - Requerimientos No Funcionales con targets medibles
   - Assumptions
   - Preguntas abiertas

   **Revisa el archivo y decime si esta correcto o queres cambios.**
   ```

5. **If user requests changes**:
   - Edit the file with requested changes
   - Notify user again
   - Repeat until approved

6. **Once approved**: Continue to next step

**IMPORTANT**: Follow the template structure exactly, but adapt content based on user's responses.

---

### Step 6: Propose Feature Groups

Based on goals, scope, and requirements, propose feature groups.

**Feature Group Sizing Rules (CRITICAL):**

- **Target: 3-8 stories per feature group** (completable in 2-6 weeks by a single team)
- If a group would produce 10+ stories, split it into smaller groups
- If a group would produce 1-2 stories, merge it with another group or reconsider if it justifies being a group
- Prefer smaller, focused groups over fewer large ones -- smaller batches reduce risk and accelerate feedback (Lean/DORA evidence)

**Feature Group Sequencing Rules (CRITICAL):**

- Feature Group 1 is the **walking skeleton**: foundational infrastructure (repos, CI/CD, deployment) + the minimum functionality to prove the system is alive (e.g., health check, a trivial endpoint). It does NOT include real business features -- those go in Feature Group 2+
- Each feature group (from FG2 onwards) delivers end-to-end value perceivable by the user (not a technical slice)
- Feature groups are sequential and build upon each other
- Cross-cutting concerns (logging, monitoring) flow through groups from the start

**Present to user:**

```markdown
## Feature Groups Propuestos

Basandome en los requerimientos, propongo dividir el producto en estos feature groups:

### Feature Group 1: {{title}}

**Descripcion:** {{high_level_description}}

**Por que es importante?:** {{business_value}}

**Capabilities que implementa:**

- C-XX: {{capability_name}} (from F-XX)
- C-XX: {{capability_name}} (from F-XX)

**Precondiciones:** {{what_must_exist_before_starting}}

**Postcondiciones:** {{what_exists_after_completion}}

**Valor entregado:** {{what_user_can_do_after_this_feature_group}}

---

### Feature Group 2: {{title}}

[Repeat structure]

---

Te parece bien esta division? Queres agregar, quitar o modificar algun feature group?
```

Wait for user confirmation.

Iterate if user requests changes.

---

### Step 7: Draft Feature Groups Document

1. **Read template specification**:
   - Read **PRD Feature Groups Template** from Files Index

2. **Draft complete document** following template structure:
   - Use the format specified in each section
   - Follow the examples for tone and level of detail
   - Generate frontmatter with current date and status "Pending Formalization"
   - Include:
     - Overview section (explains what feature groups are)
     - Each feature group with all required fields:
       - Capabilities que implementa (referencing C-XX IDs from requirements.md)
       - Precondiciones (what must exist before starting)
       - Postcondiciones (what exists after completion)
       - Valor entregado
     - Optional: Sequencing Notes explaining dependencies

3. **Save document directly** to `docs/prd/feature-groups.md`

4. **Notify user** (do NOT show full content):

   ```markdown
   Documento guardado: `docs/prd/feature-groups.md`

   Incluye:

   - Feature groups propuestos con secuenciamiento
   - Descripcion, valor de negocio, y requerimientos que aborda cada grupo
   - Notas sobre dependencias (si aplica)

   **Recorda:** Feature Group 1 debe ser foundational (infraestructura + funcionalidad inicial deployable)

   **Revisa el archivo y decime si esta correcto o queres cambios.**
   ```

5. **If user requests changes**:
   - Edit the file with requested changes
   - Notify user again
   - Repeat until approved

6. **Once approved**: Continue to next step

**CRITICAL**: Feature Group 1 MUST be infrastructure + foundational feature. Follow sequencing rules from template.

---

### Step 8: Finalization

**After user has reviewed and approved all 3 documents:**

Confirm to user:

```markdown
Fase 1 completada - Definicion del Producto

Documentos creados:

- docs/prd/goals-and-context.md
- docs/prd/requirements.md
- docs/prd/feature-groups.md

---

## Siguiente paso: Arquitectura Tecnica

Ahora necesitas definir la arquitectura tecnica del producto.

**Ejecuta:** `/product-initialize-technical`

El comando va a:

- Definir los servicios necesarios
- Crear documentacion de arquitectura
- Definir APIs iniciales (OpenAPI)
- Definir esquemas de base de datos (draft entities)
- Documentar decisiones arquitectonicas (ADRs)

---

Queres que te ayude a ejecutar `/product-initialize-technical` ahora?
```

## Output

Files saved to **prd_folder** (see Files Index for location):

- `docs/prd/goals-and-context.md` - Product goals, context, scope
- `docs/prd/requirements.md` - Functional and non-functional requirements
- `docs/prd/feature-groups.md` - Feature groups ready to be formalized

Each document contains:

- Frontmatter with metadata
- Content following template structure
- Status indicating current phase

---

## Discovery Mode

When the "Discovery Docs Check" lists discovery documents (**discovery_mode = ON**, set in Step 0.2.b), switch to **transcription mode**: read the analysis docs in full, PROPOSE the PRD artifacts derived from them, and ask the user ONLY about genuine gaps or contradictions. The save-then-validate flow and the per-document review loops are PRESERVED — transcription reduces questions, it does not skip review.

### Read discovery docs (runtime, before Step 1)

Read in full from **discovery_folder**: `analisis-funcional.md`, `analisis-dominio.md`, and `analisis-tecnico.md` if present (the technical one is for scope/context only — its real consumer is `/product-initialize-technical`). Build an internal map of goals, users, scope, entities, features and NFR signals. Do NOT pre-inject these (they are large); read them here at runtime.

### Overrides

- **Step 0.3** (Collect User Documentation): Skip the open "comparti documentacion" prompt. Instead, state that the discovery docs were found and will be the source of truth.

- **Step 1 + Step 1.2** (Gather Goals and Context / Follow-ups): Replace the open "Contame sobre el producto" capture with deriving goals, users and scope from `analisis-funcional.md` and PROPOSING them. Ask follow-ups ONLY where the analysis genuinely doesn't cover an item or where two docs contradict each other.

- **Step 2, assumptions sub-step** (the "Before drafting, list your assumptions" block): Replace "list your assumptions" with a "gaps/contradictions found" prompt — surface only real conflicts between the docs and what the PRD needs.

- **Step 3** (Define Domain Entities): Replace 3.1 (extract entities) and 3.2 (per-entity deep-dive) with TRANSCRIBING entities, attributes (+types), enum values, relationships and business rules directly from `analisis-dominio.md` (the domain template is a verbatim superset of this section). Do NOT re-interrogate per entity. Keep 3.3 (draft + save + notify) and its review loop. **GAP/ABORT rule:** if a feature in `analisis-funcional.md` references an entity/attribute/enum that `analisis-dominio.md` does NOT define, STOP and ask a targeted question naming the exact gap — do not invent it.

- **Step 4 + 4.2 + 4.3** (Functional Requirements / per-feature deep-dive / NFRs): Transcribe features from `analisis-funcional.md` into the capabilities structure instead of eliciting them. Take NFR targets from the analysis (Transversales) where present; only ask for values the analysis genuinely lacks. Never invent numbers.

- **Steps 2, 5, 6, 7** (draft/save/validate of each document, Feature Groups proposal): Mechanics UNCHANGED (draft → save → notify → review loop). Only the SOURCE of content changes. The Feature Groups proposal is still presented and confirmed; sizing/sequencing rules unchanged (the functional map in `analisis-funcional.md` is a draft, not a substitute for the sizing rules).

- **Step 8** (Finalization): Unchanged.

### Traceability & Promotion

So the discovery reasoning stays in the axis (not orphaned), in transcription mode you MUST also:

1. **Back-link from each generated PRD doc** — add a reference note right under the title of `goals-and-context.md`, `requirements.md` and `feature-groups.md` (relative path from `docs/prd/` to `docs/discovery/`):

   ```markdown
   > Derivado del discovery: [análisis funcional](../discovery/analisis-funcional.md) · [análisis de dominio](../discovery/analisis-dominio.md)
   ```

2. **Promote the decision log** — transcribe the key product decisions from the "Decisiones Tomadas" table of `analisis-funcional.md` into the **Context -> Key Decisions** section of `goals-and-context.md` (or whichever Context variant the document actually has — "Context" or "Background and Context" per the goals template; if neither was emitted, add a short "Decisiones clave" note under Context), keeping the rationale (the "por qué"). Add a line pointing to the full log in `docs/discovery/analisis-funcional.md`.

The PRD stays the single living source of truth; discovery is a frozen snapshot, linked one hop away. Do NOT make downstream skills read `docs/discovery/` — the decisions and entities live in the canonical PRD/ADRs they already read.

