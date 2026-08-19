---
name: product-ux-generate
description: Generate complete UX documentation set (overview, benchmarks, research-contexts, product-maps, user-flows, cross-surface-flows) from PRD, then generate mid-fidelity HTML wireframes for every surface
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, WebSearch, Agent"
---

> **Implementation note:** this skill does NOT render wireframes itself. Steps 10-11 **delegate** to
> [`/product-ux-wireframes`](.claude/skills/product-ux-wireframes/SKILL.md), which owns the whole
> rendering contract: the canonical `screens.json`, the block dictionary, variants, the accent color,
> the icon map, the 8 fixed states and the deterministic Python renderer (`build_book.py`). Keeping that logic in one skill is deliberate — it used to be duplicated here and
> the two copies drifted.
>
> To iterate on wireframes after this run (add a screen, change microcopy, regenerate a surface), use
> `/product-ux-wireframes` directly.

# UX Generate

## Purpose

Bootstrap the complete UX documentation set for a product from scratch, then generate mid-fidelity wireframes for every surface. Single command covers the full design phase: research artifacts → screen inventory → wireframes.

**Flow:**
```
Step 0:  Validate & Setup
  |
Step 1:  Load PRD context
  |
Step 2:  Detect audiences and surfaces (with user confirmation)
  |
Step 3:  Generate product-overview.md
  |
Step 4:  Generate benchmarks (per audience, in parallel)
  |
Step 5:  Generate research-contexts (per audience, in parallel)
  |
Step 6:  Generate product-maps (per surface, in parallel)
  |
Step 7:  Generate user-flows (per surface, in parallel)
  |
Step 8:  Generate cross-surface-flows.md
  |
Step 8.5: Bootstrap Design System scaffold (skip if exists)
  |
Step 9:  UX docs summary — announce wireframe generation start
  |
Step 10: Delegate wireframes to /product-ux-wireframes (all surfaces)
  |
Step 11: Wireframes summary — wait for user feedback / re-delegate
```

**Result:** Full `docs/ux/` tree populated + `docs/ux/surfaces/{surface}/screens/{screen}.md` per screen + `docs/ux/surfaces/{surface}/wireframes.html` per surface + `docs/design-system/` scaffold.

**This command does NOT:**
- Modify existing UX artifacts — for that, use `/product-ux-agent`
- Produce a visual specification — that lives in the surface's design system. There is no high-fi stage in this workflow; see the hand-off in `docs/guides/ux-and-design-system.md`
- Render visual designs in external tools (Figma, Claude Design) — the output is a self-contained HTML book
- Render the wireframes itself — Step 10 delegates to `/product-ux-wireframes` (single source of rendering truth)

For interactive editing of existing UX artifacts, use `/product-ux-agent`.
For iterating wireframes after the initial run, use `/product-ux-wireframes`.

## Role

**Adopt the [UX Researcher Agent](.claude/agents/ux-researcher.md) role**

## CRITICAL RULES

### UX documentation rules

1. **ABORT if PRD does not exist** — Requires `goals-and-context.md` and `requirements.md` in **prd_folder**. Run `/product-initialize` first if missing.
2. **ABORT if technical architecture does not exist** — Requires `architecture.md` in **prd_folder**. Without architecture, services (and therefore surfaces) cannot be identified. Run `/product-initialize-technical` first if missing.
3. **ABORT if `ux_folder` already exists** — This skill is for bootstrapping. If `docs/ux/` exists, suggest `/product-ux-agent` for UX modifications or `/product-ux-wireframes` for regenerating wireframes only. **Brownfield products never run this skill:** their UX comes from `/product-analyze-service` (survey) + `/product-consolidate-services` (Step 9.7), transcribed from the real code. If `docs/analysis/ux/` exists, say so in the abort message.
4. **Use Spanish for generated content** — Match the language of the PRD. All user interactions in Spanish.
5. **Save first, then continue** — Save each artifact, do not stop for intermediate approval. Show summary at Step 9 before continuing to wireframes.
6. **Reference locations from Files Index** — Use folder IDs (`prd_folder`, `ux_folder`, `ux_audiences_folder`, `ux_surfaces_folder`).
7. **Do NOT dump full content in chat** — Save to files, show summary.
8. **Follow the 7 firm rules** of the methodology (defined in the agent file): persona genérica, audiencias por JTBD, sin versionado de archivos, alcance declarado por el skill invocante (este skill habilita el tier de producción), trazabilidad obligatoria, vocabulario funcional, no rellenar.
9. **Generation order is mandatory** — Each step depends on the previous. Do not parallelize across phase boundaries.
10. **Use templates strictly** — Read each template from Files Index before drafting its corresponding artifact.
11. **Parallel steps MUST use the `ux-researcher` subagent** — Steps 4, 5, 6, and 7 launch one subagent per audience/surface. ALWAYS pass `subagent_type: "ux-researcher"` to the `Agent` tool.

### Wireframe delegation rules

12. **NEVER render wireframes directly** — Do not write `screens.json`, do not invoke
    `build_book.py`, do not write HTML or geometry. Step 10 delegates to
    `/product-ux-wireframes`, which owns the rendering contract. Same rule as
    `/product-ux-request`. The screen `.md` files, `screens.json` and `wireframes.html` are produced by that skill.

13. **Delegate non-interactively** — Always pass `--no-interactive` so the delegated run returns
    control instead of waiting for the user. This skill owns the conversation.

14. **WAIT for user feedback after wireframes** — After the delegated run completes, present the
    summary (Step 11) and wait. If the user requests changes, re-delegate to
    `/product-ux-wireframes` with the affected surfaces and the change request. Repeat until the
    user confirms.

---

## Execution

### Step 0: Validate & Setup

**0.1 Load Context**

1. Read [Files index](.claude/utils/index.md) to get all locations
2. Identify key folders:
   - **prd_folder** — PRD location (input)
   - **references_folder** — External references (optional input)
   - **ux_folder** — Root UX output
   - **ux_audiences_folder** — Per-audience artifacts
   - **ux_surfaces_folder** — Per-surface artifacts

**0.2 Validate Prerequisites**

```bash
ls docs/prd/goals-and-context.md docs/prd/requirements.md docs/prd/architecture.md 2>/dev/null
ls -d docs/ux 2>/dev/null
```

**If PRD files are missing, ABORT:**

```markdown
No encuentro el PRD necesario para ejecutar este skill.

Faltan archivos en **prd_folder**:
- goals-and-context.md
- requirements.md

**Ejecutá primero** `/product-initialize` para crear la documentación base del producto.
```

**If technical architecture is missing, ABORT:**

```markdown
No encuentro la documentación de arquitectura técnica necesaria para ejecutar este skill.

Falta archivo en **prd_folder**:
- architecture.md

Sin arquitectura no puedo identificar los servicios del producto, y por lo tanto no puedo mapear las superficies (regla: 1 superficie = 1 app/web/cliente deployable).

**Ejecutá primero** `/product-initialize-technical` para crear la documentación de arquitectura.
```

**If `docs/ux/` already exists, ABORT:**

```markdown
Ya existe documentación UX en `docs/ux/`.

Este skill es para inicialización desde cero. Para modificar o extender la documentación UX existente, usá:

- **`/product-ux-agent`** — Modo interactivo para editar los artefactos UX existentes.
- **`/product-ux-wireframes`** — Para regenerar o iterar solo los wireframes.

Si querés rehacer todo desde cero, eliminá `docs/ux/` manualmente y volvé a ejecutar este skill.

**Si este producto vino de código existente (brownfield):** la documentación UX la generó
`/product-consolidate-services` transcribiendo el relevamiento de `/product-analyze-service`, con los
viewports, breakpoints y pantallas reales del código. No la regeneres con este skill: perderías esa
correspondencia y volverías a inferir desde el PRD lo que ya está relevado. Para extenderla usá los
dos skills de arriba, y mirá `docs/ux/gaps-as-is.md` para saber qué le falta a la UI actual.
```

**0.4 Create base UX folder structure**

```bash
mkdir -p docs/ux/audiences docs/ux/surfaces
```

---

### Step 1: Load PRD Context

Read all PRD files and references. Do not summarize yet — gather first.

**1.1 Read PRD**

Read from **prd_folder**:
- `goals-and-context.md` (users U-XX, goals G-XX, scope)
- `requirements.md` (domain entities, capabilities C-XX, business rules)
- `feature-groups.md` (if exists — useful for detecting surfaces)

**1.2 Read references (if any)**

```bash
ls docs/references/ 2>/dev/null
```

If exists, read `index.md` and any files relevant to UX (brand, prior client products, integrations affecting UX).

**1.3 Detect PRD language**

Identify language. The full UX document set MUST match this language.

---

### Step 2: Detect Audiences and Surfaces

Propose candidate audiences and surfaces inferred from the PRD. Confirm with the user before generating.

**2.1 Propose candidates**

Based on the PRD, infer:

- **Audiences** — From Target Users (U-XX), capability Actor column, and distinct JTBDs. Remember Rule 2: split by JTBD, not by U-XX label.
- **Surfaces** — From feature groups, capability groupings, and explicit mentions in goals-and-context.md.
- **Platform per surface** — `web`, `mobile-app` (native phone/tablet app) or `desktop-app`. Infer from the PRD and from `docs/prd/architecture.md`: a service described as a native app, or one whose stack is Flutter / React Native, is `mobile-app`; anything served in a browser is `web`. If the surface's service already has a `manifest.yaml`, cross-check its `language` (`flutter` → `mobile-app`, `nextjs` → `web`) and **flag any mismatch instead of choosing silently**.

- **Viewports per surface** — determined by the platform. Offer ONLY what the platform allows:

  | Platform | Viewports ofrecibles |
  |---|---|
  | `web` | `mobile` (400×800), `desktop` (1200×800) |
  | `mobile-app` | `phone` (390×844), `tablet` (834×1112) |
  | `desktop-app` | `desktop` (1200×800) |

  **Never offer `desktop` for a `mobile-app` surface.** A native phone app has no desktop: it is a
  category error, not a cost/benefit trade-off, and the wireframe generator rejects the combination.

  For `mobile-app`, `phone` alone is the complete and correct answer for almost every product — a
  phone app has one layout. Add `tablet` only if the product genuinely supports tablets. Do not offer
  `phone-landscape` here: most phone apps lock portrait, so it is a per-screen exception that gets
  declared later, on the screens that actually rotate.

  For `web`, infer from the PRD: a surface used in the field or on the move is `mobile`; a dense
  admin/monitoring surface is `desktop`; one used in both contexts declares both. Do NOT default
  everything to both — each declared viewport means every screen needs its own layout.

- **Accent color per surface** — the color of its primary actions, and the only color the mid-fi
  wireframes use. Look for a brand color in the PRD, in `docs/references/` (brand guidelines, prior
  client material), or in `goals-and-context.md`. If there is none, propose the default `#2563eb` and
  say explicitly that it IS the default, so the user can supply the real one now instead of
  discovering grey-blue wireframes later. Do not invent a hex from a color name — if the PRD says
  "verde institucional" without a value, ask.

Notify user:

```markdown
## Audiencias y superficies detectadas

Basándome en el PRD, identifico:

**Audiencias** (separadas por JTBD distintos):
- **{{audience-1-slug}}** — {{1 línea: rol y contexto}}
- **{{audience-2-slug}}** — {{1 línea}}

**Superficies** (áreas coherentes del producto), con su plataforma y viewports:
- **{{surface-1-slug}}** — {{1 línea: qué área cubre}}
  - Plataforma: `{{web | mobile-app | desktop-app}}` {{· coincide con `language: X` del manifest}}
  - Viewports: `{{primario}}`{{, `{{secundario}}`}} — {{por qué: dónde y con qué se usa}}
  - Accent: `{{#hex}}` — {{de dónde salió, o "default — no encontré color de marca"}}
- **{{surface-2-slug}}** — {{1 línea}}
  - Plataforma: `{{...}}`
  - Viewports: `{{...}}` — {{por qué}}
  - Accent: `{{#hex}}` — {{origen}}

**Matriz preliminar (audiencia ↔ superficie):**
- {{audience-1}} usa: {{surface-1}}, {{surface-2}}
- {{audience-2}} usa: {{surface-2}}

**¿Es correcto? Modificarías algo?**

Podés:
- Agregar / quitar / renombrar audiencias o superficies
- Corregir la plataforma, los viewports o el accent de una superficie
- Corregir la matriz
- Confirmar para continuar

> **Sobre el accent:** es el único color que usan los wireframes mid-fi (botones primarios, links,
> foco, tab activa; todo lo demás queda en gris). Se guarda en el Design System de la superficie
> (`foundations/color.md` → `color.brand.primary`), que es de donde lo leen los wireframes. Si el
> cliente tiene color de marca, este es el momento de ponerlo: cambiarlo después implica editar el DS
> y regenerar.

> **Sobre plataforma y viewports:** la plataforma define qué viewports existen. Una app nativa
> (`mobile-app`) no puede tener `desktop`: no es que sea caro, es que no existe. Y una app de
> teléfono con `phone` solo está completa — en nativo hay un layout, y lo que varía (safe areas,
> escalado de texto) se define en el Design System, no como un layout aparte.
>
> En `web`, declarar `desktop` implica diseñar un layout de escritorio para **cada** pantalla de la
> superficie. Si solo se usa en el celular, dejá solo `mobile`.
```

**WAIT for user response.**

**2.2 Iterate until confirmed**

If the user requests changes, update the proposal and re-confirm. Repeat until user explicitly confirms.

**Slug naming rules:**
- Lowercase, hyphens (kebab-case)
- Audience: descriptive of role + context (e.g., `operador-turno`, `admin-sistema`)
- Surface: descriptive of area + platform if relevant (e.g., `app-operador`, `dashboard-supervisor`)

**2.3 Create folder structure**

For each confirmed audience and surface:

```bash
mkdir -p docs/ux/audiences/{{audience-name}}
mkdir -p docs/ux/surfaces/{{surface-name}}
```

---

### Step 3: Generate `product-overview.md`

Generate the root UX document.

**3.1 Read template**

Read **UX Overview Template** from Files Index.

**3.2 Draft and save**

Follow the template structure. Use confirmed audiences, surfaces, and matrix from Step 2. Extract glossary terms from PRD entities and key concepts (5-15 terms).

**The "Inventario de Superficies" MUST record the confirmed platform, viewports AND accent of each surface**, with the one-line reason for each. This document is the single source of truth for viewports: `/product-ux-wireframes` reads it to decide what to render, and `/service-planify-story` reads it to know which viewports a UI story has to cover. A surface without declared viewports is rendered as mobile-only.

Save to **ux_folder**/`product-overview.md`.

Continue without notifying — full summary at Step 9.

---

### Step 4: Generate Benchmarks (per audience, in parallel)

Generate `benchmark.md` for EACH audience.

**4.1 Read template**

Read **UX Benchmark Template** from Files Index (read once, use for all audiences).

**4.2 For each audience, in parallel**

Launch one `ux-researcher` subagent per audience using the `Agent` tool with `subagent_type: "ux-researcher"`. All subagents run in parallel (single message with multiple Agent tool calls).

Each subagent must:

1. Use `WebSearch` to research 2-4 direct competitors and 1-3 indirect references relevant to its assigned audience
2. Cite sources for every reference
3. If a specific aspect cannot be verified, declare it explicitly in "Limitaciones del Benchmark"
4. Follow template structure
5. Save to **ux_audiences_folder**/`{{audience-name}}/benchmark.md`

**Honesty rules** (from agent):
- If web search returns nothing useful, write "No se encontró información suficiente sobre [aspecto]"
- Never fabricate UI details

---

### Step 5: Generate Research Contexts (per audience, in parallel)

Generate `research-context.md` for EACH audience. **Requires the benchmark for that audience to exist.**

**5.1 Read template**

Read **UX Research Context Template** from Files Index.

**5.2 For each audience, in parallel**

Launch one `ux-researcher` subagent per audience using the `Agent` tool with `subagent_type: "ux-researcher"`. All subagents run in parallel (single message with multiple Agent tool calls).

Each subagent must:

1. Read its `benchmark.md` (just saved in Step 4)
2. Read PRD sections relevant to this audience
3. Apply the firm rules strictly:
   - **Rule 1**: One generic persona, no fictional names
   - **Rule 5**: Trace every JTBD/pain/gain/hypothesis to PRD/benchmark/input-cliente. Drop items without traceability.
   - **Rule 6**: Functional vocabulary. No banned words.
   - **Rule 7**: Maximums are ceilings (3 JTBD, 3 pains, 3 gains, 5 hypotheses). Document fewer if base info is limited.
4. For each behavioral hypothesis, label both state (`hipótesis` default) and strength (`inferida-PRD` / `inferida-benchmark` / `por-analogía`)
5. ALWAYS include "Lo que NO sabemos" section (mandatory, minimum 3 questions)
6. Set frontmatter `status: hipótesis-preliminar`
7. Save to **ux_audiences_folder**/`{{audience-name}}/research-context.md`

---

### Step 6: Generate Product Maps (per surface, in parallel)

Generate `product-map.md` for EACH surface.

**6.1 Read template**

Read **UX Product Map Template** from Files Index.

**6.2 For each surface, in parallel**

Launch one `ux-researcher` subagent per surface using the `Agent` tool with `subagent_type: "ux-researcher"`. All subagents run in parallel (single message with multiple Agent tool calls).

Each subagent must:

1. Identify which audiences use this surface (from the matrix in product-overview.md)
2. Read the research-contexts of those audiences
3. Read PRD feature groups and capabilities relevant to this surface
4. Apply rules:
   - Default to MINIMUM screens
   - Every screen traces to PRD reference (C-XX, U-XX, or "sugerencia fuera de PRD")
   - Decisional tone, no decorative language
   - Follow template structure
   - Include "Inventario de Overlays" section for drawers/modals/bottom-sheets (if any)
5. Generate at least 3 open questions with A/B impact
6. Save to **ux_surfaces_folder**/`{{surface-name}}/product-map.md`

---

### Step 7: Generate User Flows (per surface, in parallel)

Generate `user-flows.md` for EACH surface. Requires product-map.md of the surface to exist.

**7.1 Read template**

Read **UX User Flows Template** from Files Index.

**7.2 For each surface, in parallel**

Launch one `ux-researcher` subagent per surface using the `Agent` tool with `subagent_type: "ux-researcher"`. All subagents run in parallel (single message with multiple Agent tool calls).

Each subagent must:

1. Read the surface's `product-map.md` (just saved)
2. Read research-contexts of audiences using this surface
3. Identify 3-5 critical flows (NOT all flows — only the ones that define the product's value for this surface)
4. For each flow, document:
   - JTBD it solves (linked to research-context)
   - Audience executing it
   - Trigger
   - Happy path
   - Alternative paths
   - Errors and recovery (mandatory)
   - Final state
   - Success criteria
5. EXCLUDE cross-surface flows (those go in Step 8)
6. Save to **ux_surfaces_folder**/`{{surface-name}}/user-flows.md`

---

### Step 8: Generate `cross-surface-flows.md`

Generate the global cross-surface flows document.

**8.1 Read template**

Read **UX Cross-Surface Flows Template** from Files Index.

**8.2 Draft based on full surface set**

Read all surface user-flows generated in Step 7. Identify flows where state, notifications, or actions actually cross between surfaces.

**Special case: single-surface product**

If the product has only one surface, write the document with the empty-case section only:

```markdown
## No aplica

Este producto tiene una sola superficie (**{{surface-name}}**). Los flujos viven en `surfaces/{{surface-name}}/user-flows.md`.

Si en el futuro se agrega otra superficie, este documento se completará con los flujos que crucen entre superficies.
```

**For multi-surface products:**

For each cross-surface flow:
- Surfaces involved (with order and role)
- Audiences involved
- Sequence with surface markers `[surface-name]` per step
- Synchronization (real-time / polling / batch / manual + latency)
- Intermediate states (what each audience sees during the flow)

Save to **ux_folder**/`cross-surface-flows.md`.

---

### Step 8.5: Bootstrap Design System structure

After UX docs are generated, bootstrap the Design System scaffold if it doesn't exist yet.

The DS is bootstrapped **per surface**: each surface confirmed in Step 2 gets its own complete DS scaffold under `docs/design-system/{surface}/`. A `docs/design-system/README.md` index at the root lists all surfaces.

**8.5.1 Check what already exists — per surface, not globally**

```bash
test -d docs/design-system && echo "ROOT_EXISTS" || echo "ROOT_MISSING"
for s in {{lista de surfaces confirmados}}; do
  test -d "docs/design-system/$s" && echo "$s: EXISTS" || echo "$s: MISSING"
done
```

Scaffold the root index if it is missing, and **each surface that lacks its own folder**. Never
overwrite a folder that already exists.

Checking only the root was a bug: with one surface bootstrapped, the root exists forever, so no surface
added later ever received a folder — and `/product-design-system-update` only lists folders that exist,
which left those surfaces with no way to get a design system at all.

**8.5.2 Copy the root index**

```bash
mkdir -p docs/design-system
cp -r .claude/skills/product-ux-generate/assets/design-system-bootstrap-root/* docs/design-system/
```

**8.5.3 Copy per-surface scaffold for each surface that lacks one**

For each `{{surface-name}}` confirmed in Step 2 **whose folder is missing** (per 8.5.1):

```bash
mkdir -p docs/design-system/{{surface-name}}
cp -r .claude/skills/product-ux-generate/assets/design-system-bootstrap-per-surface/* docs/design-system/{{surface-name}}/
```

After copying, replace the `{{SURFACE}}` placeholder in each surface's `README.md` with the actual surface name:

```bash
sed -i "s/{{SURFACE}}/{{surface-name}}/g" docs/design-system/{{surface-name}}/README.md
```

**Pick the grid foundation variant for the surface's platform.** The scaffold ships both; keep the one
that matches and delete the other. This matters because the grid foundation is what
`/service-planify-story` copies into the Story Plan and what the implementor builds against — a web
breakpoint table shipped into a native app is wrong vocabulary that then propagates into code.

```bash
# platform: mobile-app → the native variant becomes grid.md
if [ "{{platform}}" = "mobile-app" ]; then
  mv docs/design-system/{{surface-name}}/foundations/grid.mobile-app.md \
     docs/design-system/{{surface-name}}/foundations/grid.md
else
  rm -f docs/design-system/{{surface-name}}/foundations/grid.mobile-app.md
fi
```

**8.5.4 Populate the root `README.md` surfaces list**

The root `docs/design-system/README.md` ships with a placeholder bullet for the surfaces list. Replace that bullet with one line per surface, linking to its README:

```markdown
- [`{{surface-name}}`](./{{surface-name}}/README.md) — versión inicial 0.1.0
```

Locate the comment block and the placeholder bullet (`- (se completa al bootstrappear...)`) and replace with the generated list. One bullet per surface, alphabetical order.

**8.5.5 Write each surface's accent into its color foundation**

The accent confirmed in Step 2 is a design-system value, and `foundations/color.md` is its canonical
home — it is what `/product-ux-wireframes` reads to render, and what the implementor consumes through
the semantic token `bg.action.primary`. Leaving it as the bootstrap placeholder while the real brand
color lives only in prose is how the two end up disagreeing.

For each surface whose accent is NOT the default `#2563eb`:

1. In `docs/design-system/{{surface-name}}/foundations/color.md`, replace the `color.brand.primary`
   hex with the confirmed accent.
2. Append a line to that file's `## Historial` noting that the brand primary came from the surface
   confirmation, with the date.
3. Leave the rest of the palette as placeholder — only this token is a decision at this point. Do NOT
   invent a secondary, a neutral ramp or semantic colors: `/product-design-system-update` owns those,
   and inventing them would make a placeholder look decided.

For surfaces using the default, change nothing: the placeholder already carries `#2563eb`, and the
wireframe report will flag that it is a default rather than a decision.

**8.5.6 Replace `{{DATE}}` placeholders with today's date**

```bash
TODAY=$(date +%Y-%m-%d)
find docs/design-system -name '*.md' -exec sed -i "s/{{DATE}}/${TODAY}/g" {} +
```

---

### Step 9: UX docs summary

Present the UX documentation summary, then immediately continue to Step 10 without waiting.

```markdown
Documentación UX generada. Generando wireframes mid-fi…

**Estructura UX:**
docs/ux/
├── product-overview.md
├── cross-surface-flows.md
├── audiences/
{{Para cada audiencia:}}
│   └── {{audience-name}}/ benchmark.md · research-context.md
└── surfaces/
{{Para cada superficie:}}
    └── {{surface-name}}/ product-map.md · user-flows.md

{{Si se creó DS:}} docs/design-system/ inicializado con un scaffold por surface ({{N}} surfaces).

Todos los research-contexts en estado `hipótesis-preliminar`. Comenzando wireframes…
```

Continue immediately to Step 10.

---

### Step 10: Delegate wireframe generation

Hand the whole wireframe phase to `/product-ux-wireframes`. It reads the UX docs just generated
(product-map + user-flows + research-contexts per surface), infers the per-screen definitions,
writes `screens/{screen}.md` and renders `wireframes.html` for every surface.

**10.1 Collect the surface list**

Every surface confirmed in Step 2 now has `product-map.md` + `user-flows.md`, so the delegated skill
would pick them all up on its own. Pass the explicit CSV anyway — it makes the run deterministic and
keeps a surface that failed an earlier step from being silently included.

**10.2 Delegate**

Use the **Agent tool** with `subagent_type: "general-purpose"` and this prompt:

```
Ejecutá el skill product-ux-wireframes con los siguientes parámetros:
- Argumento: {{CSV de superficies}} --no-interactive

Es el bootstrap inicial del producto: no existen todavía los screens/*.md ni los
wireframes.html. El skill debe inferirlos desde product-map.md y user-flows.md
de cada superficie, guardar los screen.md y renderizar el wireframes.html por superficie.

La plataforma y los viewports de cada superficie ya están declarados en
docs/ux/product-overview.md ("Inventario de Superficies"): usá esos, no los inventes.
Cada pantalla necesita un layout por cada viewport de su superficie. En superficies
mobile-app con un solo viewport `phone`, eso es un solo layout por pantalla y está bien
así: no inventes un segundo.

No esperes confirmación del usuario al finalizar: devolvé el control con el resumen
de lo generado (superficies, cantidad de pantallas, estados y overlays por superficie).
```

**10.3 Verify the output**

For each surface, check that the artifacts exist before reporting success:

```bash
ls docs/ux/surfaces/{surface}/wireframes.html docs/ux/surfaces/{surface}/screens.json \
   docs/ux/surfaces/{surface}/screens/*.md 2>/dev/null
```

If a surface produced no output, report it in Step 11 as pending and tell the user to run
`/product-ux-wireframes {surface}` manually — do not abort the whole run for one surface.

**Do NOT** read the generated `wireframes.html` into context — it is a rendered artifact, not a source.

---

### Step 11: Wireframes summary — wait for feedback

Report what the delegated run produced (in Spanish):

```markdown
Wireframes mid-fi generados.

**{surface-1}:**
- {N} pantallas: {pantalla-1}, {pantalla-2}, ...
- {M} estados representados · {K} overlays
- Accent color: {color hex}
- Archivos:
  - `docs/ux/surfaces/{surface-1}/screens/*.md` ({N} archivos)
  - `docs/ux/surfaces/{surface-1}/wireframes.html`

**{surface-2}:** …

{{Si alguna superficie quedó sin generar:}}
**Pendiente:** {surface-X} no generó wireframes. Corré `/product-ux-wireframes {surface-X}`.

Para abrir el book: doble clic en `wireframes.html`. No necesita servidor ni conexión.

**Revisá los wireframes y decime si está correcto o querés cambios.**
```

**WAIT for user response.**

**If the user requests changes:**

1. Identify the scope — which surface(s) the change affects
2. Re-delegate to `/product-ux-wireframes` with only those surfaces and the change request:

```
Ejecutá el skill product-ux-wireframes con los siguientes parámetros:
- Argumento: {{CSV de superficies afectadas}} --no-interactive

Cambios pedidos por el usuario:
- {{cambio 1}}
- {{cambio 2}}

Aplicá los cambios sobre los screen.md correspondientes (son la fuente de verdad) y
regenerá el wireframes.html de cada superficie afectada. No esperes confirmación: devolvé
el resumen de lo modificado.
```

3. Notify and wait again:

```markdown
Cambios aplicados:
- {Cambio 1}
- {Cambio 2}

Archivos modificados:
- {paths}

**Revisá los cambios y decime si ahora está correcto o querés ajustar algo más.**
```

**Repeat until the user confirms.**

---

## Output

Files saved on completion:

**UX documentation** (under **ux_folder**):
- `docs/ux/product-overview.md` — incluye plataforma, viewports y accent declarados por superficie (traza; el responsive y el color tienen su fuente en el DS)
- `docs/ux/audiences/{audience}/benchmark.md` (one per audience)
- `docs/ux/audiences/{audience}/research-context.md` (one per audience)
- `docs/ux/surfaces/{surface}/product-map.md` (one per surface)
- `docs/ux/surfaces/{surface}/user-flows.md` (one per surface)
- `docs/ux/cross-surface-flows.md`

**Wireframes** (under **ux_surfaces_folder**) — produced by the delegated `/product-ux-wireframes` run; see that skill for the full rendering contract:
- `docs/ux/surfaces/{surface}/screens/{screen-name}.md` — Per screen at mid-fi:
  - Frontmatter with `viewports` and `fidelity: mid` (no `accent_color`: surface-level, lives in the DS)
  - Identidad, Entrada/Salida, Estructura (with variant + visibility columns)
  - Contenido with REAL microcopy per block
  - Estados with REAL user-facing messages
  - Interacciones populated
  - Accesibilidad: composition-level
  - Decisiones y descartes (mandatory)
- `docs/ux/surfaces/{surface}/screens.json` — One per surface, **versioned**: the canonical
  intermediate the renderer consumes. It is what `git diff` shows when a wireframe changes.
- `docs/ux/surfaces/{surface}/wireframes.html` — One per surface, self-contained (no server, no
  network, no dependencies — double-click to open):
  - Index of screens, with overlays indented under their parent and tagged by overlay type
  - One frame per screen, with viewport and state toggles
  - Blocks laid out by the browser from the declared grid — a screen is as tall as its content
  - Icons as Unicode glyphs, annotations as inline gray notes
  - Transitions as clickable blocks that jump to the destination screen

**Design System scaffold** (under `docs/design-system/`, only on first run):
- `docs/design-system/README.md` — root index linking to each surface's DS
- One folder per surface (`docs/design-system/{surface}/`) with its complete scaffold:
  - README.md, CHANGELOG.md, governance.md (versioning is independent per surface)
  - foundations/ (color, typography, spacing, grid, iconography, motion, elevation, voice-tone)
  - tokens/ (reference, semantic, component)
  - components/ (empty — to fill via `/product-design-system-update`)
  - patterns/ (empty — to fill)
  - guidelines/ (accessibility, i18n, content)

All documents:
- Frontmatter with metadata
- Language matches PRD
- Status indicating draft / hipótesis-preliminar
- Traceability to PRD / benchmark / input-cliente

---

## Wireframe reference (see `/product-ux-wireframes`)

The block dictionary (36 types in 5 categories), the variants table, the accent-color rules, the icon
Unicode map and the 8 fixed UI states are **not duplicated here**. They are the rendering contract and
live in one place:

- [`/product-ux-wireframes`](.claude/skills/product-ux-wireframes/SKILL.md) — reference sections at the end of the file
- [`scripts/SCHEMA.md`](.claude/skills/product-ux-wireframes/scripts/SCHEMA.md) — canonical `screens.json` schema
- [Screen Template](.claude/templates/screen-tmpl.yaml) — structure of each `screens/{screen}.md`

This skill does not need them: it delegates the whole wireframe phase (Step 10).
