---
name: product-ux-request
description: Process the UX impact of a designed request - propose and apply UX deltas (screens, overlays, flows) to product-map / user-flows / screens, then regenerate the affected wireframes
argument-hint: "[REQ-number] [--auto]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent"
---

# UX Request

## Purpose

Process the UX impact of a designed request. Reads the request's technical design, infers which UX artifacts must change (product-map, user-flows, screens, overlays, cross-surface flows), presents the delta to the user, applies the approved changes, and regenerates the affected wireframes by delegating to `/product-ux-wireframes`.

**Flow:**
```
Step 0: Validate input (REQ-XXX required)
  |
Step 1: Initialize (Files index, config, folders)
  |
Step 2: Load & validate request (status: designed, ux_review: required)
  |
Step 3: Load full UX context (overview, product-maps, user-flows, screens, design system)
  |
Step 4: Infer UX delta from technical design
  |
Step 4.5: Cross-check the delta against the Design System catalog
  |
Step 5: Propose delta to user (single block, approve or adjust)
  |
Step 6: Apply approved changes
  |
Step 7: Regenerate wireframes for affected surfaces (delegate to /product-ux-wireframes)
  |
Step 8: Record the UX review in the request and update flags
  |
Step 9: Show next steps
```

**Result:** UX documentation updated (product-map, user-flows, screens, cross-surface-flows), wireframes regenerated for affected surfaces, request file gains a `## Revisión UX` section — including the Design System check and what was decided about each gap — and `ux_review` flag set to `done`.

**This command does NOT:**
- Capture or design requirements — Use `/product-new-request` and `/product-design-request` first
- Create Design System components — it detects the gaps and records the decision; `/product-design-system-update` creates them (it owns semver and CHANGELOG)
- Create story documents — Use `/product-create-stories` after this command
- Generate UX from scratch — Use `/product-ux-generate`
- Render the wireframes directly — delegates to `/product-ux-wireframes`

## References

**Read [UX Methodology](.claude/specs/ux-methodology.md)** and apply it.

## CRITICAL RULES

1. **ABORT if request status is not `designed`** — The skill only operates on designed requests. If status is `captured`, run `/product-design-request` first. If `formalized`, the UX review window already closed.

2. **ABORT if `ux_review` is not `required`** — If `not-applicable`, there is nothing to review. If `done`, the review already happened. If missing, the request was designed under an older flow — instruct the user to re-run `/product-design-request` to populate the field.

3. **ABORT if UX docs do not exist** — Requires `docs/ux/product-overview.md` and at least one surface with `product-map.md` + `user-flows.md`. If missing, instruct the user to run `/product-ux-generate` first.

4. **Use Spanish for generated content** — All `.md` content, user prompts, and notifications in Spanish. The skill file itself stays in English.

5. **Reference locations from Files Index** — Use folder IDs (`requests_folder`, `ux_folder`, `ux_audiences_folder`, `ux_surfaces_folder`). Do not hardcode paths.

6. **Infer from the technical design, do not start from scratch** — The "Análisis de Impacto", "Servicios Afectados", "Cambios de API", "Flujo de Interacción", and "Flujos Afectados" sections of the REQ are the primary input. The skill maps endpoints/entities/flows to surfaces and screens.

7. **Single proposal block** — Present the complete UX delta as one block. The user either approves it whole or asks for specific adjustments. Do not ask one question per change.

8. **Respect the firm rules of the methodology** — Same as `/product-ux-generate`: persona genérica, audiencias por JTBD, sin versionado de archivos, trazabilidad obligatoria, vocabulario funcional, no rellenar. Every new/modified screen must trace to a capability, requirement, or input-cliente from the REQ.

9. **Apply only what the user approved** — Do not silently widen scope. If the user removes a proposed change, drop it; if the user adds one, include it.

10. **Regenerate wireframes via `/product-ux-wireframes`** — Do NOT invoke `build_book.py` directly. After applying doc changes, delegate to the wireframes skill (passing `--no-interactive`) so the rendering logic stays in one place.

11. **Record the review in the REQ** — After applying changes, write a `## Revisión UX` section in the request document with the delta summary (screens, overlays, flows, files modified). This is the audit trail.

12. **Set `ux_review: done` after a successful run** — This unblocks `/product-create-stories`. Only set it after wireframes regeneration is verified.

13. **Do NOT dump full content in chat** — Show summaries; let the user open the files in their editor.

14. **Cross-check the delta against the Design System, and record the outcome** — Every block type the delta introduces is checked against the affected surface's component catalog (Step 4.5), using the canonical rule in `/product-ux-wireframes` → "Block type → DS component". Do not restate that rule here. Each gap gets one of three resolutions, and the decision is written into the REQ's `## Revisión UX` so `/service-planify-story` does not re-discover it. **Never create a DS component from this skill** — `/product-design-system-update` owns component specs, semver and CHANGELOG.

---

## Execution

### Step 0: Validate Input

Parse `$ARGUMENTS` as the REQ number:
- Accept any of these formats: `REQ-003`, `003`, `3` — all resolve to `REQ-003`
- Extract the numeric part, zero-pad to 3 digits, prefix with `REQ-`

If user did NOT provide `$ARGUMENTS`:

```markdown
Este comando requiere un request como parámetro.

**Uso:** `/product-ux-request REQ-XXX`

**Si todavía no diseñaste el request:**
1. Ejecutá `/product-new-request` para capturarlo
2. Ejecutá `/product-design-request REQ-XXX` para diseñar la solución técnica
3. Luego usá este comando para procesar el impacto UX
```

**ABORT if no request provided.**

---

### Step 1: Initialize

1. Read [Files index](.claude/utils/index.md) to get locations
2. Read `.claude/local-config.yaml` if it exists
3. Identify key folders:
   - **requests_folder** — Where to find the request
   - **ux_folder** — Root UX docs
   - **ux_surfaces_folder** — Per-surface artifacts
   - **ux_audiences_folder** — Per-audience artifacts
   - **ds_folder** — Design System root (read-only here)
4. Read the screen template (`.claude/templates/screen-tmpl.yaml`) — needed when creating or modifying screen.md files

---

### Step 2: Load and Validate Request

**2.1 Load request** from **requests_folder** matching `REQ-{{number}}`.

If not found:

```markdown
No se encontró el request REQ-{{number}} en **requests_folder**.
```

**ABORT.**

**2.2 Validate `status`** from frontmatter.

- If `status` is `captured`:

  ```markdown
  El request REQ-{{number}} todavía no fue diseñado.

  Status actual: captured

  Ejecutá `/product-design-request REQ-{{number}}` primero para diseñar la solución técnica.
  Este comando se ejecuta después del diseño técnico, cuando el technical-leader marca que se necesita revisión UX.
  ```

  **ABORT.**

- If `status` is `formalized`:

  ```markdown
  El request REQ-{{number}} ya fue formalizado en stories.

  La ventana de revisión UX se cierra cuando el request pasa a `formalized`. Si tenés que ajustar UX
  sobre stories ya creadas, hacelo manualmente con `/product-ux-agent` y avisame para regenerar
  los wireframes con `/product-ux-wireframes`.
  ```

  **ABORT.**

- If `status` is anything other than `designed`: **ABORT** with a generic message explaining the valid status is `designed`.

**2.3 Validate `ux_review` flag** from frontmatter.

- If `ux_review: not-applicable`:

  ```markdown
  El request REQ-{{number}} no requiere revisión UX.

  El technical-leader determinó que este request no tiene impacto en superficies UX
  (es puramente backend / infraestructura / refactor interno).

  Podés continuar directamente con `/product-create-stories REQ-{{number}}`.
  ```

  **ABORT.**

- If `ux_review: done`:

  ```markdown
  El request REQ-{{number}} ya tiene la revisión UX completada.

  Si necesitás ajustar algo más, hacelo manualmente con `/product-ux-agent` y luego
  regenerá los wireframes con `/product-ux-wireframes`.

  Para crear las stories: `/product-create-stories REQ-{{number}}`.
  ```

  **ABORT.**

- If `ux_review` is missing or any other value:

  ```markdown
  El request REQ-{{number}} no tiene el campo `ux_review` en el frontmatter.

  Probablemente fue diseñado bajo una versión previa del flujo. Re-ejecutá
  `/product-design-request REQ-{{number}}` para que el technical-leader determine
  si necesita revisión UX.
  ```

  **ABORT.**

**2.4 Extract from the request:**

- Title, original requirement, functional requirements, acceptance criteria
- The complete "Diseño Técnico" section, especially:
  - **Servicios Afectados** (which services are touched)
  - **Cambios de API** (endpoints added/modified — these surface in screens that consume them)
  - **Cambios de Base de Datos** (entities added/modified)
  - **Flujo de Interacción** (the end-to-end behavior to support)
  - **Flujos Afectados** (existing flows modified, new flows created)

**2.5 Inform user (in Spanish):**

```markdown
Cargué REQ-{{number}} — {{title}}.
Status: designed · ux_review: required

Voy a leer el contexto UX completo, inferir el delta y proponerte los cambios.
```

---

### Step 3: Load Full UX Context

Required reading:

1. **ux_folder**/`product-overview.md` — Surface inventory (**including the viewports declared per surface** — needed to know how many layouts a new screen requires), audiences, audience↔surface matrix
2. For each surface under **ux_surfaces_folder**:
   - `product-map.md` (screen inventory, overlays inventory, navigation)
   - `user-flows.md` (existing flows)
   - `screens/*.md` (current screen definitions)
3. **ux_folder**/`cross-surface-flows.md` (if exists)
4. For each audience under **ux_audiences_folder**:
   - `research-context.md` (JTBDs and constraints — needed to evaluate whether a new screen is justified)
5. **ds_folder**/`{{surface}}/components/*.md` — **not optional**: the full component catalog of every affected surface. Needed to cross-check the delta against the design system in Step 4.5. Also read `{{surface}}/README.md` for the DS version, so the review records which version the check was made against

**Quick scan of services-to-surfaces mapping:**

For each service mentioned in "Servicios Afectados" of the request, determine which surface(s) consume it. Heuristics:
- If a service is a frontend (per `architectures/{service}/manifest.yaml` `type: frontend`), it IS the surface or maps 1:1
- If a service is a backend, follow the data: which frontend service consumes its endpoints? That frontend's surface is the one impacted
- If unclear, ask the user once which surface(s) are affected before continuing (Step 4)

**Inform user (in Spanish):**

```markdown
Contexto UX cargado:
- {{N}} superficies: {{lista}}
- {{M}} audiencias: {{lista}}
- {{K}} screens definidos

Inferiendo delta UX desde el diseño técnico…
```

---

### Step 4: Infer UX Delta

Map the technical design to UX artifacts. Produce a structured delta with this shape:

```yaml
affected_surfaces:
  - name: {{surface-name}}
    viewports: [{{mobile}}, {{desktop}}]   # los declarados por la surface en product-overview.md
    screens_to_add:
      - name: {{kebab-case}}
        displayName: "{{P-XX Nombre}}"
        purpose: "{{1 línea}}"
        audience: {{audience-name}}
        traceability: "{{REQ-XXX: requirement / capability cited}}"
        viewports: [{{mobile}}, {{desktop}}]   # subconjunto; omitir si existe en todos
        blocks_outline: [{{block-type-1}}, {{block-type-2}}, ...]  # rough sketch
        layout_outline:                         # cómo se acomoda en cada viewport
          mobile: "{{stack vertical / 1 línea}}"
          desktop: "{{row shell: sidebar 3/12 + main 9/12 / 1 línea}}"
    screens_to_modify:
      - name: {{existing-screen-name}}
        changes:
          - "{{1 línea por cambio}}"
        affected_states: [{{state-name}}, ...]
        affected_viewports: [{{viewport}}, ...]   # en qué viewports cambia el arreglo
    screens_to_remove:
      - name: {{existing-screen-name}}
        reason: "{{por qué se elimina}}"
    overlays_to_add:
      - name: {{kebab-case}}
        overlay_type: drawer | bottom-sheet | modal | popover
        triggered_by: {{parent-screen-name}}
        trigger_block: {{block-name in parent}}
        purpose: "{{1 línea}}"
    overlays_to_modify:
      - name: {{existing-overlay-name}}
        changes: [...]
    overlays_to_remove:
      - name: {{existing-overlay-name}}
        reason: "..."
    user_flows_changes:
      - flow: "{{flow name}}"
        change: "{{nuevo paso / paso modificado / flujo nuevo / flujo eliminado}}"
    transitions_changes:
      - "{{srcScreen}} → {{dstScreen}} ({{trigger}})"

cross_surface_changes:
  - "{{descripción}}"

reasoning:
  # short bullet list mapping each delta entry to the REQ section that justifies it
  - "{{delta entry}} ← {{REQ section that justifies it}}"
```

**Inference rules:**

- **New endpoint that returns user-visible data** → the screen consuming it either exists (modify) or needs to be created
- **New domain entity** → check if it shows in any list/detail screen; modify or add accordingly
- **New flow in "Flujos Afectados / Nuevos Flujos"** → check if the user-flows.md of the surface already covers it; add a new flow if not
- **Modified flow** → update the corresponding user-flow + revisit each screen mentioned in the flow
- **New cross-service interaction** that touches multiple surfaces → propose entry in `cross-surface-flows.md`
- **Backend-only change** that does NOT affect any user-visible behavior → empty delta (this shouldn't happen if `ux_review: required` was set correctly; flag it and ask the user to reconsider)

**Viewport rules for the delta:**
- Read the affected surface's viewports from `product-overview.md`. A new screen needs a layout for **each** of them; a modified screen needs its layouts revisited only in the viewports where the arrangement actually changes.
- A change in microcopy, states, validations or traceability is **viewport-independent** — it is declared once and applies everywhere. Do not duplicate it per viewport.
- A change is viewport-specific when it is about arrangement or presence: a new block that only fits on desktop, a filter that becomes a bottom-sheet on mobile, a column that collapses.
- If a new screen only makes sense in one viewport, say which and why — that is a product decision that belongs in the proposal, not an implementation detail.
- Never add or remove a viewport from a surface here. That lives in `product-overview.md` and forces a layout pass over every screen of the surface; if the REQ implies it, raise it in the proposal and let the user decide.

**If the request's impact is genuinely empty on UX** (which would be a misclassification by the technical-leader), inform the user:

```markdown
No detecté impacto UX concreto en este request. El diseño técnico cambia:
{{lista de cambios técnicos}}

…pero ninguno parece afectar pantallas, overlays, flujos ni navegación.

¿Confirmás que no hay impacto UX y querés marcar la revisión como completada sin cambios?
- **Si** → seteo `ux_review: done` sin tocar nada más y cierro
- **No** → decime qué pantallas / flujos podrían verse afectados que no detecté
```

If the user confirms no impact: skip to Step 8 with empty delta. Otherwise, the user clarifies and we rebuild the delta.

---

### Step 4.5: Cross-check the delta against the Design System

The delta introduces block types. If the surface's design system has no component for one of them, the
implementor will have to improvise or stop mid-cycle to create it. Detecting it **here** is the whole
point: this is the moment the user is already making UX decisions, three steps before someone is
writing code.

**4.5.1 Apply the canonical matching rule**

Use the rule in [`/product-ux-wireframes`](.claude/skills/product-ux-wireframes/SKILL.md) →
"Block type → DS component". Do not restate or reinvent it. For every block type in
`screens_to_add[].blocks_outline` and in any block added by `screens_to_modify` / `overlays_to_add`,
determine whether the affected surface's catalog covers it.

Gaps are per surface: the same type can be covered in one and missing in another.

**4.5.2 Classify each gap and propose a resolution**

Three outcomes, and the third is the one nobody offers today:

| Salida | Cuándo | Qué implica |
|---|---|---|
| **Crear componente** | El bloque es necesario y va a reaparecer en otras pantallas | Hay que correr `/product-design-system-update` ANTES de planificar. `/service-planify-story` **aborta** si esta resolución queda sin cumplir |
| **Reemplazar bloque** | El DS ya tiene algo que resuelve el mismo trabajo | Se cambia el delta: el bloque pasa a ser el tipo que sí existe. A menudo es la mejor respuesta y evita inflar el DS |
| **Dejar anotado** | Caso puntual que no justifica un componente | Viaja al Story Plan como gap conocido, con la traza de que fue una decisión y no un olvido. El implementador improvisa a conciencia |

Propose one per gap, with a one-line reason. Default to **reemplazar** when the catalog plausibly
covers the job: adding a component is a commitment to maintain it in that surface forever.

---

### Step 5: Propose Delta to User

Present the full delta in a single block, formatted as tables for readability:

```markdown
## Propuesta de cambios UX para REQ-{{number}}

**Superficies afectadas:** {{surface-1}}, {{surface-2}}

### Pantallas

**Nuevas:**
| ID | Pantalla | Audiencia | Viewports | Trazabilidad | Propósito |
|----|----------|-----------|-----------|--------------|-----------|
| {{P-XX}} | {{Nombre}} | {{audience}} | {{ambos / solo X}} | {{REQ ref}} | {{1 línea}} |

**Modificadas:**
| Pantalla | Cambio | Estados afectados | Viewports afectados |
|----------|--------|-------------------|---------------------|
| {{existing}} | {{descripción}} | {{lista}} | {{ambos / solo X}} |

**Eliminadas:**
| Pantalla | Razón |
|----------|-------|
| {{existing}} | {{por qué}} |

### Overlays

**Nuevos:**
| ID | Overlay | Tipo | Trigger | Propósito |
|----|---------|------|---------|-----------|
| {{O-XX}} | {{Nombre}} | drawer / bottom-sheet / modal | {{pantalla}} · {{bloque}} | {{1 línea}} |

**Modificados / Eliminados:** …

### Flujos

**user-flows.md** ({{surface}}):
- {{flujo afectado}}: {{descripción del cambio}}

**cross-surface-flows.md:**
- {{cambio}} (si aplica)

### Design System (`{{surface}}` v{{X.Y.Z}})

{{Si hay gaps:}}
| Bloque | Tipo | Estado en el DS | Propuesta |
|--------|------|-----------------|-----------|
| {{nombre}} | {{date-picker}} | sin componente | **Reemplazar** por `text-input` con máscara — el DS ya tiene `Input` y el caso es una fecha simple |
| {{nombre}} | {{chart}} | sin componente | **Crear componente** — aparece también en P-04 y P-07 |
| {{nombre}} | {{slider}} | sin componente | **Dejar anotado** — único uso, el implementador lo resuelve inline |

{{Si no hay gaps:}}
Todos los tipos de bloque del delta tienen componente en el DS de `{{surface}}`. Sin gaps.

### Justificación (mapeo al diseño técnico)
- {{delta entry}} ← {{sección del REQ que lo justifica}}

---

**¿Aprobás esta propuesta?**
- **Si** → aplico los cambios y regenero los wireframes
- **Ajustar** → decime qué agregar, quitar, renombrar o cambiar

{{Si hay gaps con propuesta "Crear componente":}}
> **Atención:** si confirmás crear {{N}} componente(s), hay que correr
> `/product-design-system-update` antes de planificar las stories — `/service-planify-story` va a
> abortar mientras falten. Si preferís no crearlos, cambiá esa resolución a "Reemplazar" o
> "Dejar anotado" ahora.
```

**WAIT for user response.**

If the user requests adjustments, modify the delta and present again. Repeat until approved.

If the delta is empty (no-op confirmed in Step 4): skip this step.

---

### Step 6: Apply Approved Changes

For each entry in the approved delta, apply the corresponding edits:

**6.1 Update `product-map.md` of each affected surface**

- **Screens added:** append rows to "Inventario de Pantallas" with PRD reference column citing the REQ number. Update navigation diagram (mermaid) accordingly.
- **Screens modified:** update the row's "Propósito" if scope changed; do NOT renumber existing screens. If navigation changes, update the mermaid block.
- **Screens removed:** remove the row from the inventory. Add a one-liner under the "Pantallas explícitamente excluidas" note explaining why. Remove from the mermaid diagram.
- **Overlays added/modified/removed:** mirror the same logic on the "Inventario de Overlays" section. If that section doesn't exist yet and we're adding the first overlay, create it (see `ux-product-map-tmpl.yaml`).

**6.2 Update `user-flows.md` of each affected surface**

- New flow → append it following the user-flows template structure (JTBD, audience, trigger, happy path, alternatives, errors, final state, success criteria)
- Modified flow → patch the affected steps in place
- Flow eliminated → remove the flow section; if the surface ends up with fewer than 3 critical flows, flag it in the user-flows.md preamble

**6.3 Update screen `.md` files** under `docs/ux/surfaces/{surface}/screens/`

- **New screen** → create `{screen-name}.md` following the screen template:
  - Full frontmatter (`viewports`, `fidelity: mid`). No `accent_color`: it is a surface-level property living in `docs/design-system/{surface}/foundations/color.md`
  - All sections present, including **`Layout por viewport` with one subsection per declared viewport**
  - Blocks declared with real microcopy (no "Pendiente"), variants, icons, and visibility rules — including the `Viewports` column and `viewport_overrides` when a block differs between widths
  - States declared with real user-facing messages
  - "Decisiones y descartes" mandatory — cite the REQ as the source decision, and record why each viewport is laid out the way it is
- **Modified screen** → edit only the affected sections (Estructura, Layout por viewport, Contenido, Estados, Interacciones, Decisiones). Touch a viewport's layout subsection **only** if its arrangement changes — a new block that appears in both viewports usually means editing both subsections; a microcopy fix means editing none. Append an entry to "Decisiones y descartes" citing the REQ as the trigger of the change.
- **Removed screen** → delete the `.md` file. If any other screen referenced this one in Entradas/Salidas, update those references.

**6.4 Apply the approved Design System resolutions**

- **Reemplazar bloque** → the delta itself changes: use the covered block type in the screen.md's
  Estructura and Contenido, and note in "Decisiones y descartes" that the type was chosen because the
  DS covers it. This is a real design decision, not a workaround, and deserves the trace.
- **Crear componente** → do NOT create it here. `/product-design-system-update` owns component specs,
  their semver bump and their CHANGELOG; writing one from this skill would skip all three. Record it
  as pending in Step 8 and tell the user in Step 9.
- **Dejar anotado** → nothing to change in the docs; it travels to the REQ as a known gap.

**6.5 Update `cross-surface-flows.md` if applicable**

Add or modify cross-surface flow entries reflecting new cross-service interactions identified in Step 4.

**6.6 Inform user (in Spanish) of files modified:**

```markdown
Cambios aplicados en docs UX:
- product-map.md · {{N}} cambios en {{surface}}
- user-flows.md · {{M}} cambios en {{surface}}
- screens/*.md · {{K}} archivos creados / modificados / eliminados
- cross-surface-flows.md · {{P}} cambios

Procediendo a regenerar los wireframes…
```

---

### Step 7: Regenerate Wireframes (delegate to `/product-ux-wireframes`)

Delegate to `/product-ux-wireframes` to regenerate `wireframes.html` for each affected surface. The skill accepts a CSV argument that limits the scope to a specific set of surfaces.

Build the CSV from the **affected_surfaces** list produced in Step 4 (e.g. `app-conductor,dashboard-admin`).

Use the **Agent tool** with `subagent_type: "general-purpose"` and the following prompt:

```
Ejecutá el skill product-ux-wireframes con los siguientes parámetros:
- Argumento: {{CSV de superficies afectadas}} --no-interactive

El skill debe leer los screen.md actualizados y regenerar el screens.json + wireframes.html de cada superficie listada.
El flag --no-interactive hace que devuelva el control sin esperar confirmación del usuario.
```

After delegation, verify:
- For each affected surface, `docs/ux/surfaces/{{surface}}/wireframes.html` has a newer modification timestamp
- If verification fails for any surface: notify the user but continue — they can re-run `/product-ux-wireframes {{surface}}` manually

---

### Step 8: Record UX Review in the Request

Edit the request file in **requests_folder**:

**8.1 Add a new section `## Revisión UX`** at the end of the document (after "Story Split Propuesto"):

```markdown
## Revisión UX

**Fecha:** {{YYYY-MM-DD}}
**Superficies afectadas:** {{lista}}

**Viewports de las superficies afectadas:** {{surface: mobile, desktop}}

### Pantallas
| Cambio | Pantalla | Viewports | Detalle |
|--------|----------|-----------|---------|
| Agregar | {{P-XX Nombre}} | {{ambos / solo X}} | {{1 línea}} |
| Modificar | {{existing}} | {{1 línea}} |
| Eliminar | {{existing}} | {{razón}} |

### Overlays
| Cambio | Overlay | Detalle |
|--------|---------|---------|
| Agregar | {{O-XX Nombre}} | {{tipo, trigger, 1 línea}} |

### Flujos
- `surfaces/{{surface}}/user-flows.md` — {{cambio}}
- `cross-surface-flows.md` — {{cambio}} (si aplica)

### Design System

**Verificado contra:** `{{surface}}` v{{X.Y.Z}}

| Bloque | Tipo | Resolución | Detalle | Estado |
|--------|------|-----------|---------|--------|
| {{nombre}} | {{date-picker}} | Reemplazar | usa `text-input` con máscara | resuelto |
| {{nombre}} | {{chart}} | Crear componente | `Chart` en el DS de {{surface}} | **pendiente-DS** |
| {{nombre}} | {{slider}} | Dejar anotado | uso único, se improvisa | aceptado |

{{Si no hubo gaps:}}
Sin gaps: todos los tipos de bloque del delta tienen componente en el DS de `{{surface}}`.

### Archivos modificados
- `docs/ux/surfaces/{{surface}}/product-map.md`
- `docs/ux/surfaces/{{surface}}/user-flows.md`
- `docs/ux/surfaces/{{surface}}/screens/{{name}}.md` (nuevo / modificado / eliminado)
- `docs/ux/surfaces/{{surface}}/wireframes.html` (regenerado)
- `docs/ux/cross-surface-flows.md` (si aplica)
```

(For empty deltas confirmed in Step 4, write a single line: `Sin impacto UX detectado. Confirmación del usuario: {{YYYY-MM-DD}}.`)

**8.2 Update the frontmatter:**
- Set `ux_review: done`
- Do NOT change `status` — it stays `designed` so `/product-create-stories` picks it up next

**8.3 Save the file.**

---

### Step 9: Show Next Steps

Present a final summary (in Spanish):

```markdown
**Revisión UX completada**

Request: REQ-{{number}} — {{title}}
Status: designed · ux_review: done

**Resumen del delta:**
- {{N}} pantallas creadas
- {{M}} pantallas modificadas
- {{K}} pantallas eliminadas
- {{P}} overlays agregados
- Flujos: {{descripción corta}}
- Wireframes regenerados: {{lista de superficies}}

{{Si quedó algún gap en `pendiente-DS`:}}
**Antes del siguiente paso — componentes de Design System pendientes:**

| Componente | Surface | Para |
|---|---|---|
| {{Chart}} | {{surface}} | {{pantallas que lo usan}} |

Ejecutá `/product-design-system-update` y creá esos componentes. `/service-planify-story` **aborta**
mientras falten, porque una story planificada contra un componente inexistente termina improvisada en
implementación. Si decidís no crearlos, editá la resolución en la sección `## Revisión UX` del REQ y
pasala a "Dejar anotado".

**Siguiente paso:**
Ejecutá `/product-create-stories REQ-{{number}}` para crear las stories.
```

---

## Output

- `docs/ux/surfaces/{{surface}}/product-map.md` — updated for each affected surface
- `docs/ux/surfaces/{{surface}}/user-flows.md` — updated for each affected surface
- `docs/ux/surfaces/{{surface}}/screens/{{name}}.md` — created / modified / deleted as per delta
- `docs/ux/surfaces/{{surface}}/screens.json` + `wireframes.html` — regenerated for each affected surface
- `docs/ux/cross-surface-flows.md` — updated if cross-surface flows changed
- `docs/requests/REQ-{{number}}.{{title-short}}.md` — gains `## Revisión UX` section, frontmatter `ux_review: done`

---

## Auto Mode

When `$ARGUMENTS` contains `--auto`, strip the flag before parsing the REQ number and apply these overrides:

### Step 0: Parse `--auto`

- `REQ-001 --auto` → main arg: `REQ-001`, **auto_mode = ON**
- `REQ-001` → main arg: `REQ-001`, **auto_mode = OFF**

### Overrides

- **Step 4** (empty-delta confirmation): Treat empty delta as confirmed automatically — set `ux_review: done` and proceed to Step 8.

- **Step 4.5** (Design System cross-check): still run it — the check is cheap and the record is what keeps `/service-planify-story` from re-discovering the gap. But **never resolve a gap as "Crear componente" in auto mode**: there is nobody to run `/product-design-system-update`, and `/service-planify-story` would abort and kill the automated run. Resolve every gap as **Reemplazar** when the catalog plausibly covers the job, otherwise **Dejar anotado**. Record in the REQ that the resolution was automatic, so a human can revisit it:

  ```markdown
  [Auto] {{N}} gaps de Design System resueltos automáticamente ({{M}} reemplazos, {{K}} anotados).
  Ningún componente nuevo: en modo auto no se crean componentes de DS.
  ```

- **Step 5** (Propose delta): Skip the wait-for-approval block. Apply the inferred delta as-is and continue to Step 6. Print:
  ```markdown
  [Auto] Delta UX inferido — aplicando sin esperar confirmación.
  ```

- **Step 9** (Show Next Steps): Skip entirely — the subagent completes here and returns control to the orchestrator.
