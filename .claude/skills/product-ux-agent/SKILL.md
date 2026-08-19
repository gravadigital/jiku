---
name: product-ux-agent
description: Interactive UX researcher mode - loads full UX context and assists with edits, questions, and refinements
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, WebSearch"
---

# UX Agent Mode

## Purpose

Enter an interactive session with the UX Researcher Agent, with the full UX context loaded. The agent assists with whatever the user needs over existing UX documentation: answer questions, edit artifacts, add new audiences/surfaces, refine hypotheses with new information, validate consistency between artifacts.

**Flow:**
```
Step 0: Validate prerequisites
  |
Step 1: Load full UX context (PRD + ux/ tree + references)
  |
Step 2: Confirm context loaded
  |
Loop: Attend user requests
  |
  Per request:
    - Answer / propose / edit / create
    - If edits: notify file changed and flag dependent artifacts
    - User approves or requests adjustments
  |
End: User exits or says "listo"
```

**Result:** UX Researcher available with full context, assisting interactively. All edits and creations follow the same templates and firm rules used by `/product-ux-generate`.

**This command does NOT:**

- Generate the full UX set from scratch (use `/product-ux-generate` for that)
- Add a new surface (use `/product-ux-add-surface` — it also scaffolds the surface's Design System and generates its wireframes)
- Bypass templates or firm rules — every edit/creation respects them
- Create artifacts outside the methodology (no wireframes, no design specs)
- Modify the PRD (use `/product-change-technical-definition` for technical changes; PRD changes go through analyst skills)

## Role

**Adopt the UX Researcher Agent role** - Read [UX Researcher Agent](.claude/agents/ux-researcher.md)

In particular: read the **Interactive Mode** section of the agent file. It defines bootstrap, allowed actions, and notification patterns specific to this skill.

## CRITICAL RULES

1. **ABORT if PRD does not exist** - Same prerequisite as `/product-ux-generate`: requires `goals-and-context.md` and `requirements.md` in **prd_folder**
2. **ABORT if `ux_folder` does not exist** - This skill works on EXISTING UX docs. If `docs/ux/` is missing, suggest `/product-ux-generate` first
3. **Use Spanish for all user interactions**
4. **Reference locations from Files Index** - Use folder IDs, do not hardcode paths
5. **Respect the firm rules of the methodology** at all times (see agent file): traceability, functional vocabulary, no padding, audiences by JTBD, persona genérica, sin versionado de archivos, and Rule 4 scope — this skill runs in the **research tier only**: no wireframes, no Design System (redirect to `/product-ux-wireframes` and `/product-design-system-update`)
6. **Respect the templates** - Every edit or new artifact MUST follow the corresponding template structure. Read the template before generating new content
7. **Validate consistency** - When modifying one artifact, check the dependency chain (research depends on benchmark; product-map depends on research; user-flows depends on product-map; cross-surface depends on product-maps and user-flows). Flag inconsistencies to the user, do not silently fix

7b. **Viewports live in `product-overview.md`** - The "Inventario de Superficies" is the single source of truth for which viewports each surface has. You may edit it here, but adding a viewport to a surface means **every screen of that surface needs a new layout** — which is wireframe work this skill does not do. When the user asks for that, update the overview, state clearly which screens are now missing a layout, and tell them to run `/product-ux-wireframes {surface}` to produce them. Removing a viewport is the same in reverse.
8. **Allowed actions:**
   - Edit any existing UX artifact
   - Create new artifacts that follow templates (new audience, new surface, new flow)
   - Answer questions about the product, audiences, surfaces, methodology
9. **NOT allowed:**
   - Create artifacts outside the methodology (wireframes, visual specs, marketing copy)
   - Skip traceability rules when creating new content
   - Change the file structure (don't move audiences/surfaces, don't rename folders)
   - Promote a hypothesis to `validada` without explicit user confirmation that interviews/research were done
10. **Never bulk-overwrite** - When editing, edit the specific section. Don't rewrite the whole file unless the user explicitly asks

## Execution

### Step 0: Validate Prerequisites

**0.1 Load Files Index**

Read [Files index](.claude/utils/index.md). Identify folder IDs:
- **prd_folder**, **ux_folder**, **ux_audiences_folder**, **ux_surfaces_folder**, **references_folder**

**0.2 Validate PRD**

```bash
ls docs/prd/goals-and-context.md docs/prd/requirements.md 2>/dev/null
```

**If missing, ABORT:**

```markdown
No encuentro el PRD del producto.

Faltan archivos en **prd_folder**:
- goals-and-context.md
- requirements.md

Este skill carga contexto del producto. Sin PRD no puedo trabajar.

**Ejecutá** `/product-initialize` para crear el PRD.
```

**0.3 Validate UX folder**

```bash
ls -d docs/ux 2>/dev/null
ls docs/ux/product-overview.md 2>/dev/null
```

**If `docs/ux/` is missing or empty, ABORT:**

```markdown
No encuentro documentación UX para cargar.

Falta: `docs/ux/` con al menos `product-overview.md`.

Este skill es para iterar sobre documentación UX **existente**. Para generarla desde cero:

**Ejecutá** `/product-ux-generate`

Una vez generada, podés volver acá para iterar.
```

---

### Step 1: Load Full UX Context

Read everything. The agent needs the full picture to give consistent advice.

**1.1 Read PRD**

From **prd_folder**:
- `goals-and-context.md`
- `requirements.md`
- `feature-groups.md` (if exists)

**1.2 Read external references**

```bash
ls docs/references/ 2>/dev/null
```

If exists, read `index.md` and any files relevant to UX.

**1.3 Read full UX tree**

Read recursively from **ux_folder**:
- `product-overview.md`
- All `audiences/{*}/benchmark.md` and `audiences/{*}/research-context.md`
- All `surfaces/{*}/product-map.md` and `surfaces/{*}/user-flows.md`
- `cross-surface-flows.md`

Use `Glob` to discover audiences and surfaces dynamically:

```
docs/ux/audiences/*/research-context.md
docs/ux/surfaces/*/product-map.md
```

---

### Step 2: Confirm Context Loaded

Notify user with a tight summary.

```markdown
## UX Researcher cargado

**Producto:** {{nombre extraído de product-overview.md o PRD}}

**Audiencias** ({{N}}):
- {{audience-1}} ({{status del research-context}})
- {{audience-2}} ({{status})
- ...

**Superficies** ({{M}}):
- {{surface-1}}
- {{surface-2}}
- ...

**Cross-surface flows:** {{cantidad}} (o "no aplica - producto de una sola superficie")

Tengo todo el contexto cargado. Puedo:

- **Responder preguntas** sobre el producto, audiencias, superficies, decisiones tomadas
- **Editar** cualquier artefacto existente
- **Crear** nuevos artefactos siguiendo los templates (nueva audiencia, nueva superficie, nuevo flow)
- **Validar consistencia** entre artefactos dependientes
- **Refinar hipótesis** con información nueva (entrevistas, decisiones del cliente, etc.)

¿En qué te ayudo?
```

**WAIT for user request.**

---

### Loop: Attend User Requests

From this point, respond to whatever the user needs. The loop continues until the user explicitly exits ("listo", "gracias", "salir") or stops asking.

**When the user asks a question:**

#### A. Answer with grounding

1. Use the loaded context to answer
2. Cite the specific artifact(s) that support your answer
3. If the answer requires reading something not yet loaded (rare), do it before answering
4. Keep answers tight — bullets and citations, not essays

**When the user requests an edit:**

#### B. Edit existing artifact

1. Identify the target artifact and section
2. Read the corresponding template (from Files Index) if the edit is non-trivial — to ensure structure compliance
3. Apply the edit using `Edit` tool (not `Write` — never rewrite full file unless explicitly asked)
4. Verify firm rules are still met (traceability, vocabulary, etc.)
5. Notify the user:

```markdown
Documento actualizado: `{{path}}`

Cambios:
- {{descripción concisa del cambio}}

{{Si el cambio puede afectar otros artefactos:}}
**Atención:** Este cambio puede afectar:
- {{dependent-artifact-1}} — {{razón}}
- {{dependent-artifact-2}} — {{razón}}

¿Querés que revise/actualice esos también?
```

6. Wait for user response (continue editing, approve, or skip dependent updates)

**When the user requests creating a new artifact:**

#### C. Create new artifact (new audience / new flow / etc.)

> **A whole new surface is NOT created here.** Adding a surface needs its Design System scaffold and
> its wireframes, which are production-tier work this skill does not do (Rule 9) — and a surface left
> without a DS folder is a dead end: `/product-design-system-update` used to be unable to see it.
> Redirect the user:
>
> ```markdown
> Para agregar una superficie nueva usá `/product-ux-add-surface {{nombre}}`.
>
> Además de product-map y user-flows, crea el scaffold del Design System de la superficie y genera
> sus wireframes — cosas que este modo no hace. Cuando termine, volvé acá para iterar su contenido.
> ```


1. Identify the type of artifact (which template applies)
2. Read the template from Files Index
3. Read the dependency chain inputs:
   - For a new research-context: read PRD + product-overview + the audience's benchmark
   - For a new benchmark: read PRD + product-overview
   - For a new product-map: read PRD + product-overview + research-contexts of audiences using this surface
   - For a new user-flows: read product-map of the surface + research-contexts
   - For a new audience entry in product-overview: also update the matrix
4. If creating a new audience: confirm with user the slug and 1-line description before proceeding
5. Generate the artifact following the template strictly
6. Save to the correct path (per Files Index pattern)
7. Update `product-overview.md` if the new artifact is an audience (matrix + inventory)
7b. **If it is a new audience, also update the surfaces it uses**: each `product-map.md` has an
   "Audiencias en esta Superficie" section listing them with a link to their research-context. An
   audience added only to the overview is invisible to the surface documentation the wireframes and
   `/service-planify-story` actually read.
8. Notify the user with the same notification pattern as edits

**When the user wants to promote a hypothesis to validated:**

#### D. Refinement after research

1. Confirm the user has actual research evidence (interviews, observation, etc.)
2. If yes:
   - Edit the specific hypothesis line in the research-context
   - Change `[estado: hipótesis | ...]` to `[estado: validada | ...]`
   - Update frontmatter `status` to `refinado-parcial` (if mixed) or `validado` (if all hypotheses validated)
   - Add a brief note at the bottom of the section indicating when and how it was validated
3. If no concrete evidence: refuse politely and explain that promotion requires real data

**When the user wants to add information from a client conversation:**

#### E. Incorporate client input

1. Identify which artifact(s) need updating
2. Add new items with `[fuente: input-cliente]` tag
3. If new content invalidates existing items, mark them as `[estado: refutada]` rather than deleting
4. Notify user

**When the user is unclear on what to do:**

#### F. Suggest next steps

Look at the loaded context and suggest based on state:
- If many hypotheses are `por-analogía` → suggest scheduling user interviews focused on those
- If a research-context has empty "Lo que NO sabemos" → suggest filling it
- If a surface has many open questions → suggest resolving the highest-impact ones first
- If audiences and surfaces don't match the current PRD → flag the divergence

**When the user is done:**

End the loop with a brief recap of changes made during the session.

```markdown
Sesión cerrada.

**Cambios realizados:**
- {{archivo X: qué cambió}}
- {{archivo Y: qué cambió}}

{{Si hubo creación de nuevos artefactos:}}
**Nuevos artefactos creados:**
- {{path}}

{{Si hay inconsistencias pendientes:}}
**Pendientes detectados:**
- {{inconsistencia o sugerencia}}

Cuando vuelvas, ejecutá `/product-ux-agent` para retomar.
```

## Output

This is an interactive skill. Output is:

- Edits and creations on existing UX documentation under **ux_folder**
- Conversational answers about the product and methodology
- No new file types beyond the 6 defined in the methodology
- All changes saved as they happen, no batched commits
