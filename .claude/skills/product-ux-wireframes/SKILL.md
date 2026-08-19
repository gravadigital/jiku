---
name: product-ux-wireframes
description: Iterate on mid-fidelity wireframes — regenerate or update the HTML wireframe book and per-screen docs for existing UX documentation. Use after /product-ux-generate has bootstrapped the product.
argument-hint: "[surface1,surface2,...] [--no-interactive]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep"
---

> **This skill is for iteration, not bootstrap.** The first time you generate UX docs + wireframes for a product, use `/product-ux-generate` — it generates everything end-to-end (research artifacts + product-maps + user-flows + wireframes) in a single run.
>
> Use this skill when `docs/ux/` already exists and you need to: add a new screen, change microcopy or block structure, update a state, change the accent color, or regenerate a surface's wireframe book from scratch.
>
> **Implementation note:** wireframes are a **self-contained HTML book** (`wireframes.html`), produced by `scripts/build_book.py` from the canonical `screens.json`. One file, no dependencies, opened by double-clicking; layout is CSS grid executed by the browser. Nothing about the render is agent-driven: your job ends at writing `screens.json`. See `scripts/SCHEMA.md`.
>
> This replaced an Excalidraw renderer. Excalidraw has no layout engine, so that renderer reimplemented CSS by hand — hardcoded heights per block type and a text-width heuristic that erred ~+20% on real Spanish microcopy, which is not fixable inside the format. Blocks that did not fit were dropped silently.

# Product UX Wireframes (mid-fi) — iteración

## Purpose

Iterate on mid-fidelity wireframes for an existing product. Re-generates or updates `screens/*.md`, `screens.json` and `wireframes.html` for every surface (or specific surfaces if scoped by the user).

**Flow:**
```
Step 0: Initialize (load context)
  |
Step 1: Validate prerequisites
  |
Step 2: For each surface — update per-screen docs + render the canvas
  |
Step 3: Report and wait for user feedback
  |
Step 4: Iterate on changes (modify the .md, re-render, repeat Step 3)
```

**Result:** Updated `docs/ux/surfaces/{surface}/screens/{screen}.md` per screen + updated `docs/ux/surfaces/{surface}/screens.json` + `wireframes.html` per surface.

**This command does NOT:**
- Create or update product-overview.md, product-map.md, user-flows.md, research-contexts, benchmarks — use `/product-ux-generate` (bootstrap) or `/product-ux-agent` (interactive edits)
- Produce a visual specification — that lives in the surface's design system. There is no high-fi stage in this workflow; see the hand-off in `docs/guides/ux-and-design-system.md`
- Render visual designs in external tools (Figma, Claude Design) — the output is a self-contained HTML book

## Role

**Adopt the [UX Researcher Agent](.claude/agents/ux-researcher.md) role**

## CRITICAL RULES

1. **Use Spanish for generated content** — All `.md` content and rendered labels in Spanish. Skill itself in English. User-facing notifications in Spanish.

2. **Save first, then validate** — Generate all artifacts, save them, notify the user, wait for feedback. If changes are requested, modify the `.md` files and re-render, then notify again.

3. **Reference locations from Files index** — Do not hardcode paths. Read [Files index](.claude/utils/index.md) for `ux_folder`, `ux_surfaces_folder`, `ux_audiences_folder`.

4. **Do NOT dump full content in chat** — Save to files, show summary, let user review in their editor.

5. **ABORT if UX prerequisites are missing** — Required: `docs/ux/product-overview.md`, at least one surface with `product-map.md` + `user-flows.md`, at least one audience with `research-context.md`. If missing, instruct the user to run `/product-ux-generate` first.

6. **Process ALL surfaces — do not ask** — The skill iterates over every detected surface without prompting for selection.

7. **The `.md` is the SOURCE OF TRUTH** — It must contain everything needed to regenerate the wireframe (texts, icons, variants, states, transitions). Coordinates and pixel geometry are NOT stored — the browser derives them from the declared layout. Block visibility per state is declared on the block itself (not as duplicate screen entries): use `hidden_in_states`, `visible_only_in_states`, or `state_overrides` — see `scripts/SCHEMA.md`. **Never split a logical screen into two JSON entries to work around visibility.**

8. **Real microcopy in every block — NO "Pendiente"** — Mid-fi requires real text. Button labels, headings, paragraphs, error messages, placeholder text — all must be the actual text the user will see. Decide reasonable copy from context if the source `.md` is vague; do not leave placeholders.

8b. **Microcopy goes in the `.md`; sample data does NOT** — These are different things and they live in different places:

   | | Where it lives | Why |
   |---|---|---|
   | **Microcopy** — button labels, headings, empty states, error messages, placeholders, column headers | The `screen.md`, verbatim | It is a contract: the implementor ships exactly this string |
   | **Sample data** — table rows, activity-feed entries, filter chips, avatar names, example ids | `screens.json` only | It is illustrative. Nobody maintains three fake company names, and enumerating them in the spec bloats a document people have to read |

   Invent plausible sample data when writing `screens.json` — a table with no rows renders as an empty
   box and teaches the reader nothing. Use the product's real domain vocabulary so it reads as
   credible. **Do not** copy it back into the `.md`, and **do not** treat its absence from the `.md` as
   a spec gap.

   The cost of this split, stated plainly: re-deriving `screens.json` from unchanged specs produces
   different sample data, so regeneration diffs even when nothing changed. That is accepted. The
   alternative — pinning every fake row in the spec — buys reproducibility with a document nobody
   keeps current.

9. **Block variants are mandatory for interactive blocks** — Every `button` must declare `variant: primary | secondary | tertiary | disabled | error`. Every `text-input` must declare `state: default | focused | error | disabled` (per applicable state). The Estructura table includes a column for variant/level/state.

10. **Block types must come from the dictionary** — 36 types in 5 categories (see "Block dictionary" reference below). Unknown types render as `[type] {name}` (visible flag, not failure).

11. **Granularity: molecule/organism, NOT atom** — Represent "search-bar" as one block, not as input + icon + button atoms.

12. **States limited to the 8 fixed UI states** — Plus optional sub-states (modal abierto, dropdown open) declared with a `parent_state` field. Each state with `Aplica: Sí` becomes a frame. Each state must declare its real user-facing message (not "Pendiente").

13. **Overlays (drawers, modals, bottom-sheets) are separate screen objects with `overlay: true`** — They appear in the product-map's "Inventario de Overlays" section (not in the main screen table) and in `screens.json` as entries with `"overlay": true`, `"overlay_type"`, and `"triggered_by"`. The book lists them in its index, indented under the surface and tagged with their overlay type. Transitions FROM parent screens TO overlays are declared normally in `transitions[]`. **Do NOT list overlays in the "Inventario de Pantallas" main table, and do NOT create a separate row in the main grid for them.**

14. **"Permiso/acceso denegado" applies ONLY for auth/role/ownership contexts** — Not for transient interaction states.

15. **Surface-level accent color, sourced from the Design System** — The accent is a property of the SURFACE, and its canonical home is `docs/design-system/{surface}/foundations/color.md` → `color.brand.primary`. Read it from there (cascade in Step 2.2); do not parse it out of prose and do not invent it. It goes at the top of `screens.json`. NO other element uses color — everything else stays grayscale. That restraint is deliberate: a wireframe that looks finished invites review of the wrong thing. The full palette lives in the design system, which is where visual decisions belong.

15b. **`accent_color` is NOT a screen-level field** — It used to live in every `screen.md` frontmatter, duplicated across all screens of a surface. If a screen.md still carries it, **ignore it** and warn once in the final report: the design system is the source, and honoring a stale per-screen copy is how the wireframes end up disagreeing with the palette the implementor reads.

16. **Icons by name from the Unicode map** — When declaring an icon (`icon: "search"`), use a name from the icon dictionary (see the reference section). Common names: search, menu, close, check, x, plus, minus, arrow-up/down/left/right, chevron-up/down, home, user, settings, edit, trash, heart, star, info, warning, error, success, more, calendar, clock, image, file, folder, link, share, download, upload, refresh, eye, eye-off, lock, mail, phone, bell, message. Unknown names render as a neutral glyph. Map to the dictionary rather than inventing names in Spanish: `tacho` → `trash`, `flecha` → `arrow-right`.

17. **Annotations describe behavior** — Use `annotation` on a block to add an inline gray note describing behavior (e.g., "polling 30s", "valida >8 chars al submit", "sheet-style modal"). Useful for mid-fi to communicate behaviors without animating them.

18. **Headings have hierarchy** — `heading` blocks declare `level: h1 | h2 | h3`. h1 is for the screen's main title (one per screen typically). h2 for section titles. h3 for subsections.

19. **Real error messages, not generic** — In `error de validación` and `error de sistema` states, declare the actual user-facing message ("Email inválido. Probá de nuevo.", not "Error message"). The script renders this as the `alert` content.

20. **Platform and viewports come from `product-overview.md` — never guess them** — Each surface declares its `platform` and its `viewports` in the "Inventario de Superficies". Render exactly those. The platform bounds what is even valid:

    | Platform | Viewports | Frame |
    |---|---|---|
    | `web` | `mobile` / `desktop` | 400×800 / 1200×800 |
    | `mobile-app` | `phone` / `tablet` (+ `phone-landscape` per screen) | 390×844 / 834×1112 / 844×390 |
    | `desktop-app` | `desktop` | 1200×800 |

    The build script **rejects** a viewport that does not belong to the platform — a `mobile-app` surface with a `desktop` viewport is a category error, not a preference. If the surface declares no platform, assume `web`; if it declares no viewports, fall back to the platform's first and note it in the report. A screen may narrow the set via the product-map's Viewports column, never widen it — except `phone-landscape`, which a rotating screen may carry when the surface declares it. For `web`, tablet is not a viewport: it is documented as behaving like one of the two.

    **A `mobile-app` surface with a single `phone` viewport is complete.** Do not invent a second layout: in a native app there is one layout, and what varies (safe areas, text scaling) is a constraint declared in the Design System's grid foundation, not a separate arrangement.

21. **Layout: one section per viewport; inside it, vertical = screens, horizontal = states** — Each viewport becomes a canvas section with its own frame size. Within a section: each screen = one row, each state = one column, default state always column 0. Overlays go in their own subsection per viewport. Screen numbers are global, so a destination number means the same screen in every section.

21b. **Arrows are drawn ONLY on the primary viewport** — Transitions are viewport-independent: the same tap leads to the same screen at any width; only the layout differs. The script handles this. If a trigger genuinely differs per viewport (a drawer opened by a hamburger on mobile vs. an always-visible sidebar link on desktop), record the difference as an `annotation` on the block.

21c. **One `screen.md` covers ALL viewports** — Block inventory, microcopy, states, interactions and traceability are declared once. Only two things vary per viewport: which blocks are present (`Viewports` column) and how they are arranged (`Layout por viewport`). **Never** write one file per viewport.

22. **Overwrite without asking** — If `screens/*.md`, `screens.json` or `wireframes.html` exist, overwrite them. The user has git for history — and unlike the Excalidraw output this one diffs readably.

23. **Render via the bundled script — never write HTML, never compute geometry** — `build_book.py` produces the whole book from `screens.json`. Do not write HTML or CSS in chat, do not compute positions, do not post-process the output. Your job ends at writing a correct `screens.json`.

23d. **Fixed px columns need their survey width recorded** — When a layout declares `fixed_cols` with px literals (typical for brownfield surfaces, where the widths were measured off a real browser), also set `viewport_widths` in `screens.json` to the width they were measured at. Those numbers only add up at their native width: dropped into a narrower canvas they squeeze the flexible column until the text wraps one word per line. The book warns when that happens — **do not answer the warning by shrinking the measurements**, that discards the survey. Answer it by declaring the width, or by making the column flexible if the real site is fluid there.

23b. **`screens.json` is a versioned artifact, derived and never hand-edited** — It lives at `docs/ux/surfaces/{surface}/screens.json`, not in `/tmp`. It is the machine form of the screen specs: it diffs cleanly in a PR and lets the book be regenerated without re-deriving everything from the `.md`. The `.md` files remain the human source of truth; when they disagree, the `.md` wins.

   **Always write `"_generated"` as its first key**, with the exact value:
   ```json
   "_generated": "derivado de screens/*.md por /product-ux-wireframes — no editar a mano"
   ```
   It is the only warning a reader gets before editing a file that the next run overwrites. It is not
   a build artifact you can delete and rebuild identically: it holds the sample data (rule 8b), which
   exists nowhere else, so **deleting it loses work**. Closer to a lockfile than to a build output.

24. **WAIT for user feedback at end — unless `--no-interactive`** — After generating everything, present summary and wait. If user requests changes, apply them to the relevant `.md`, re-render, then notify and wait again. When invoked with `--no-interactive` (delegation from another skill), skip the wait entirely: print the summary and return control to the caller. **Never wait for input in `--no-interactive` mode** — the caller owns the conversation with the user.

## Execution

### Step 0: Initialize

Load context.

**0.0 Parse `$ARGUMENTS` — surface scope**

The argument is optional and accepts a comma-separated list of surface names to limit the run, plus an optional `--no-interactive` flag.

**First, extract the flag:** if `$ARGUMENTS` contains `--no-interactive`, set **interactive_mode = OFF** and strip the flag before parsing the surface list. Otherwise **interactive_mode = ON**.

Then parse what remains as the surface scope:

- **No argument** (empty or whitespace-only) → `target_surfaces = "all"` — process every surface under **ux_surfaces_folder** with both `product-map.md` and `user-flows.md`.
- **Single surface** (`app-conductor`) → `target_surfaces = ["app-conductor"]`.
- **Multiple surfaces** (`app-conductor,dashboard-admin`) → split by comma, strip whitespace from each entry, deduplicate.

Examples:
- `app-conductor,dashboard-admin --no-interactive` → those two surfaces, no wait at the end (delegated run)
- `--no-interactive` → all surfaces, no wait at the end
- `app-conductor` → that surface, wait for feedback at the end

Validation:
- Each name listed MUST exist as a folder under **ux_surfaces_folder** AND contain both `product-map.md` and `user-flows.md`.
- If any listed surface fails the check:
  ```markdown
  No puedo procesar las siguientes superficies (no existen o les faltan documentos UX base):
  - {{lista de superficies inválidas}}

  Superficies disponibles:
  - {{lista de superficies válidas detectadas}}

  Ejecutá `/product-ux-wireframes` sin argumentos para procesar todas, o pasá una lista CSV de las válidas.
  ```
  **ABORT.**

**0.1 Read Files index**

1. Read [Files index](.claude/utils/index.md) to get folder locations
2. Identify key folders:
   - **ux_folder** — root of UX docs (`docs/ux/`)
   - **ux_surfaces_folder** — per-surface artifacts (`docs/ux/surfaces/`)
   - **ux_audiences_folder** — per-audience artifacts (`docs/ux/audiences/`)

**0.2 Read screen template**

Read [Screen Template](.claude/templates/screen-tmpl.yaml) to know the structure of per-screen `.md` files at mid-fi.

**0.3 Read scripts schema**

Read `.claude/skills/product-ux-wireframes/scripts/SCHEMA.md` to understand the canonical JSON structure required by the build script.

---

### Step 1: Validate prerequisites

Check that the UX documentation set exists.

**1.1 Required files:**

- **ux_folder**/product-overview.md
- At least one **ux_surfaces_folder**/{surface}/product-map.md
- At least one **ux_surfaces_folder**/{surface}/user-flows.md
- At least one **ux_audiences_folder**/{audience}/research-context.md

**1.2 If any required file is missing:**

```markdown
No puedo iterar wireframes: falta la documentación UX base.

Falta:
- {Lista de archivos faltantes}

Este skill es para iteración sobre documentación UX existente.
Ejecutá `/product-ux-generate` para generar el set completo desde cero (UX docs + wireframes).
```

**ABORT.**

---

### Step 2: Process each surface

Detect surfaces under **ux_surfaces_folder** that have both `product-map.md` and `user-flows.md`. Filter by **target_surfaces** from Step 0.0:

- If `target_surfaces == "all"` → process all detected surfaces, in order.
- If `target_surfaces` is a list → process only those (already validated in Step 0.0 to exist).

For each surface in scope, execute steps 2.1 through 2.5.

If `target_surfaces` is a list, also notify the user at the start of this step:

```markdown
Procesando solo las superficies seleccionadas: {{lista}}.
```

#### 2.1 Read surface UX docs

For the current surface:

1. Read **ux_folder**/product-overview.md (cached for all surfaces)
2. Read **ux_surfaces_folder**/{surface}/product-map.md
3. Read **ux_surfaces_folder**/{surface}/user-flows.md
4. Read **ux_audiences_folder**/{audience}/research-context.md for each audience listed in the product-map

#### 2.2 Resolve the surface's viewports and visual style

- **`platform`** and **`viewports`**: read the surface's entry in product-overview.md → "Inventario de Superficies". Take the platform and the declared viewport list, primary first. No platform declared → assume `web`; no viewports declared → the platform's first viewport, flagged in the final report.
- **`accent_color`**: resolve with this cascade, stopping at the first hit:
  1. `docs/design-system/{surface}/foundations/color.md` → `color.brand.primary`, **if the file is not a placeholder** (its frontmatter `status` is not `placeholder`, or the value differs from the bootstrap default). This is the canonical source.
  2. The `Accent:` line of the surface's entry in `product-overview.md` → "Inventario de Superficies".
  3. `#2563eb`, and **flag it in the final report** so the user knows the wireframes are rendering a default rather than a decision.

  Report which source won. If (1) and (2) both exist and disagree, **the design system wins** — and say so in the report, because it means `product-overview.md` is stale.
- **`grid_baseline`**: default 8.
- **Grid foundation** (optional, informative): if `docs/design-system/{surface}/foundations/grid.md` exists and is not a placeholder, read it. For `web` it gives the real breakpoint widths, so the `Layout por viewport` headings reference those instead of the canonical defaults. For `mobile-app` it gives the **orientation policy** (which tells you whether any screen may declare `phone-landscape`) and the size classes if tablet is supported. Do NOT edit that file from here.

Inform which viewports the surface will be rendered in before continuing — it determines how much work the run does.

#### 2.3 Infer per-screen definitions

For each screen listed in the product-map's "Inventario de Pantallas":

**Identity:**
- `name`: kebab-case from screen name
- `route`: from product-map's "Ruta" column
- `viewports`: from the product-map's "Viewports" column, intersected with the surface's set. Omit the field when the screen exists in all of them
- `audiences`: from product-map (single or co-primary)

**Blocks:** infer from the screen's "Propósito" cell + descriptive notes. For each block decide:
- `type` from the dictionary
- `category` (informative)
- `content` — the **real text** that will be rendered (label, heading, microcopy)
- `variant` — for buttons (primary/secondary/disabled/...)
- `level` — for headings (h1/h2/h3) and paragraphs (body/caption)
- `kind` — for alerts (error/warning/info/success)
- `icon` — when applicable, name from the Unicode map
- `aspect_ratio` — for images
- `items` — for lists (list of `{title, subtitle, icon}`)
- `annotation` — inline behavior note when needed
- `visible_only_in_viewports` / `hidden_in_viewports` — when the block exists in some viewports only. Typical: a `sidebar` only on desktop, a bottom `nav-bar` only on mobile, a `search-bar` promoted from a drawer on desktop
- `viewport_overrides` — when the block exists in both but differs: different `content` (a longer label fits on desktop), different `variant`, or even a different `type` (`tabs` on desktop → `dropdown` on mobile). Applied BEFORE state overrides, so state wins on conflict

**Per-viewport layout:** for each viewport the screen exists in, decide the arrangement and record it in `layouts`:
- A plain vertical stack (list of block names) is the default and correct answer for mobile in almost every case.
- Use `row` containers with 12-column fractions when blocks sit side by side. The two arrangements worth reaching for on desktop:
  - **shell**: `sidebar` (2-3/12) + main content (9-10/12), when the surface has persistent navigation
  - **grid**: repeated cards or tiles, 3-4 per row (4/12 or 3/12 each)
- Do NOT list `header` / `footer` in a layout — they are frame chrome, rendered automatically above and below the layout.
- Nesting is capped at 3 levels. If a desktop layout needs more, the screen is doing too much — flag it instead of nesting deeper.
- **Do not invent a desktop layout that stretches the mobile one.** A single 1160px-wide column of stacked full-width blocks is the failure mode this whole feature exists to prevent. If a screen genuinely has nothing to put side by side, constrain the content: put it in a centered column (e.g. `row` with `2/12` empty, `8/12` content, `2/12` empty) and say so in "Decisiones y descartes".

**Applicable states:** evaluate each of the 8 fixed states. For each applicable, declare:
- The actual user-facing message
- Which blocks change and HOW (variant, state, content overrides)

Also evaluate sub-states (modal abierto, dropdown open). Declare them as additional state objects with `parent_state` if needed.

**Overlays:** if the product-map has an "Inventario de Overlays" section, include each overlay as a screen object with `"overlay": true`, `"overlay_type"` (drawer / bottom-sheet / modal / popover), and `"triggered_by"` (the parent screen `name`). Overlays are NOT rows of the main grid — the script renders them in their own section (see rule 13).

**Transitions:** from user-flows.md, extract user-driven and automatic transitions to/from this screen. For each transition, decide:
- `src`, `dst` (matching screen `name`s)
- `srcState` (default unless trigger lives in a non-default state — e.g., "Reintentar" button inside `error de sistema`)
- `srcBlock` — the block name that triggers the transition (button, link, input)
- Short `trigger` text (4-6 words)
- `automatic` boolean

**Decisions:** extract from product-map's notes anything relevant to this screen.

#### 2.4 Generate per-screen `.md` files

For each screen, generate `docs/ux/surfaces/{surface}/screens/{screen-name}.md` following the screen template, with `fidelity: mid` in the frontmatter.

Frontmatter must include `viewports` (the screen's set, from 2.3). Never write `accent_color` — it is a surface-level property that lives in the design system, not in a per-screen file. Never write `device`: it is the deprecated alias.

All template sections present. `Estructura` includes the **Viewports** column per block. **`Layout por viewport` has one subsection per viewport the screen exists in** — omitting it for a declared viewport is an error, since the renderer would fall back to the flat stack and silently produce a stretched mobile layout. `Contenido` filled with real text. `Estados` filled with real messages. `Interacciones` populated with events and validations. `Accesibilidad` covers what is composition-level only — focus order, landmarks, focus traps — never the contrast or ARIA of a component, which the design system owns. `Decisiones y descartes` mandatory — and when a viewport layout is non-obvious, the reason belongs there.

#### 2.5 Generate the wireframe book

**2.5.a Produce canonical `screens.json`**

Write it to **`docs/ux/surfaces/{surface}/screens.json`** — it is versioned, not temporary. Follow `scripts/SCHEMA.md`. Include:
- `surface`, `platform`, `viewports` (primary first), `accent_color`
- `screens[]` with full block/state info from the `.md`, plus per screen:
  - `viewports` — only when the screen does not exist in all of the surface's
  - `layouts` — one entry per viewport, transcribed from the `.md`'s "Layout por viewport"
  - block-level `visible_only_in_viewports` / `hidden_in_viewports` / `viewport_overrides`
- `transitions[]` with `srcBlock` declared — that is what makes the block clickable in the book

**Two things the renderer needs that the old one did not:**

- **Tables need real rows.** `rows` used to be a count ("draw 6 empty rows"). Now it carries content,
  because in a data product the table IS the screen and an empty rectangle says nothing:
  ```json
  "rows": [["1042", "Jiku Core", "Exportar reporte a Excel", "badge:Desarrollo"],
           ["1041", "—", "skeleton:62", "badge:Análisis"]]
  ```
  Inside a cell: `badge:Texto` renders a pill **inside the cell** (which the old grid could not do),
  `skeleton` or `skeleton:NN` a filler bar, anything else plain text.

- **A row can declare a literal CSS template** with `fixed_cols` when the split is not in twelfths:
  `{"row": "paneles", "fixed_cols": "minmax(0,1fr) 420px", "cols": [...]}`. Use it when the spec says
  a column is a fixed width — forcing that into twelfths was a lie the old DSL had to tell. And
  `cols[].card: true` wraps a column in a bordered panel without declaring a container block.

**2.5.b Render the book**

```bash
python3 .claude/skills/product-ux-wireframes/scripts/build_book.py \
  docs/ux/surfaces/{surface}/screens.json \
  docs/ux/surfaces/{surface}/wireframes.html \
  .claude/skills/product-ux-wireframes/scripts/assets/Excalifont-Regular.woff2
```

One command produces the whole book: every screen, every viewport, every state, plus the index and
the toggles. Layout is CSS grid executed by the browser — there is no geometry to compute and no
text to measure.

**Read the stderr output.** Two warnings matter and both mean the source is wrong, not the renderer:

- *"N bloque(s) declarados pero ausentes del layout"* — a `layouts` entry REPLACES the default stack,
  so a block it never mentions is never drawn. The frame can look fine while half the screen is
  missing. Fix the layout in the `.md`.
- *"transición a una pantalla inexistente"* — `transitions[]` and the screen inventory disagree.

A block type with no renderer shows as a **loud red block** in the output rather than a silent grey
box. If you see one, the type is outside the 36-type dictionary.

**Do NOT** read the generated `wireframes.html` into context — it is a rendered artifact, not a source.

---

### Step 3: Report and wait for feedback

After all surfaces are generated, present a summary:

```markdown
Wireframes mid-fi generados.

**{surface-1}:**
- Plataforma: {web} · Viewports: {mobile 400×800, desktop 1200×800} · flechas en {viewport primario}
- Accent: {color hex} — origen: {design system | product-overview | default}
- {N} pantallas: {pantalla-1}, {pantalla-2}, ...
  {{Si alguna está restringida a un viewport:}} {pantalla-X}: solo {viewport}
- {M} estados representados
- Archivos:
  - `docs/ux/surfaces/{surface-1}/screens/*.md` ({N} archivos)
  - `docs/ux/surfaces/{surface-1}/screens.json` · `docs/ux/surfaces/{surface-1}/wireframes.html`

**{surface-2}:** ...

{{Si alguna superficie renderizó con el accent por default:}}
**Atención:** {surface} está usando el accent por default (`#2563eb`). No hay color de marca en
`docs/design-system/{surface}/foundations/color.md` ni en `product-overview.md`. Cuando se defina,
actualizá `color.brand.primary` y regenerá.

{{Si algún screen.md traía `accent_color` en el frontmatter:}}
**Nota:** {N} screen.md tenían `accent_color` en el frontmatter (campo de superficie, ya deprecado
ahí). Lo ignoré: el accent sale del design system. Podés borrarlo de esos archivos.

{{Si alguna superficie no declaraba viewports en product-overview.md:}}
**Atención:** {surface} no declara viewports en `product-overview.md`. Rendericé solo `mobile`.
Si la superficie también se usa en desktop, agregalo al "Inventario de Superficies" y volvé a correr este skill.

Para abrir el book: doble clic en `wireframes.html`. No necesita servidor ni conexión.
Adentro tenés el índice de pantallas, y toggles de viewport y de estado. Los bloques que disparan
una transición son clickeables: te llevan a la pantalla destino.

**Revisá los archivos y decime si está correcto o querés cambios.**
```

**If interactive_mode is ON: WAIT for user response.**

**If interactive_mode is OFF** (`--no-interactive`): omit the "Revisá los archivos…" line, print the summary and **return** — the calling skill continues from here. Do not run Step 4.

---

### Step 4: Iterate on changes (interactive_mode ON only)

Skipped entirely under `--no-interactive`. When a caller needs changes applied in a delegated run, it invokes this skill again with the change request in the delegation prompt.

When the user requests changes:

**4.1 Identify scope of change**
- ¿A qué pantalla(s)/superficie(s) afecta?
- ¿A qué viewport(s)? Un cambio de arreglo suele afectar uno solo; un cambio de microcopy o de estado afecta a los dos porque se declaran una vez.
- ¿Es cambio de estructura, contenido, variants, accent color, layout por viewport, o el set de viewports de la superficie?

Si el pedido es agregar o quitar un viewport de la superficie, eso se declara en `product-overview.md` (no en los screens): actualizá ahí el "Inventario de Superficies" y después regenerá. Agregar un viewport obliga a definir un layout nuevo para **cada** pantalla de la superficie.

**4.2 Apply changes**
- Edit the relevant screen `.md` files (the `.md` is the source of truth)
- For each affected surface, run 2.5.a and 2.5.b again
- **If the user changes the accent color**, that is a design-system change, not a wireframe one: update `color.brand.primary` in `docs/design-system/{surface}/foundations/color.md` and the `Accent:` line in `product-overview.md`, then re-render. Do NOT patch the accent into `screens.json` alone — it would revert on the next regeneration. If the DS is otherwise still a placeholder, mention that `/product-design-system-update` is the skill that owns the palette.

**4.3 Notify and wait again**

```markdown
Cambios aplicados:
- {Cambio 1}
- {Cambio 2}

Archivos modificados:
- {paths}

**Revisá los cambios y decime si ahora está correcto o querés ajustar algo más.**
```

**WAIT for user response. Repeat Step 4 until the user confirms.**

---

## Output

Files saved per surface to **ux_surfaces_folder**/{surface}/ (see Files index for locations):

- `screens/{screen-name}.md` — One per screen at mid-fi, covering ALL its viewports:
  - Frontmatter with `viewports` and `fidelity: mid` (no `accent_color`: surface-level, lives in the DS)
  - Identidad (incluye qué optimiza cada viewport), Entrada/Salida, Estructura (with variant + Viewports columns)
  - Layout por viewport — one subsection per viewport, with rows and 12-column fractions
  - Contenido with REAL microcopy per block (no "Pendiente")
  - Estados with REAL user-facing messages
  - Interacciones populated (events, validations, feedback)
  - Accesibilidad: composition-level (orden de foco, landmarks, focus traps)
  - Decisiones y descartes (mandatory)

- `screens.json` — One per surface, **versioned**. The canonical machine form of the screen specs:
  blocks, layouts per viewport, states, microcopy, transitions. Diffs readably in a PR.

- `wireframes.html` — One per surface: a self-contained book, no dependencies, opened by
  double-clicking. Contains every screen × viewport × state pre-rendered, an index (overlays
  indented under their type), toggles for viewport and state, and clickable blocks for the declared
  transitions. Layout is CSS grid, so declared column fractions and fixed widths are respected
  rather than approximated.

---

## Block dictionary (reference)

The skill recognizes 36 block types in 5 categories. Use ONLY these types in screen `.md` files. For unmapped concepts, fall back to `section`.

### Layout (6)
`header` · `footer` · `sidebar` · `main` · `modal` · `section`

### Navigation (5)
`nav-bar` · `tabs` · `link` · `breadcrumbs` · `pagination`

### Content (10)
`heading` · `paragraph` · `image` · `icon` · `list` · `card` · `table` · `avatar` · `badge` · `chart`

### Input (9)
`text-input` · `button` · `dropdown` · `checkbox` · `radio` · `toggle` · `search-bar` · `slider` · `date-picker`

### Feedback (6)
`alert` · `toast` · `progress-bar` · `tooltip` · `empty-state` · `loader`

---

## Viewports and layout (reference)

| Viewport | Frame | When a surface declares it |
|---|---|---|
| `mobile` | 400×800 | The surface is used on a phone. Default when the overview says nothing |
| `desktop` | 1200×800 | The surface is actually used on a desktop/laptop |

Tablet is not a viewport — it is documented as behaving like one of the two.

**Layout items** (in `layouts.<viewport>`):
- a **string** → block name, full width of its container
- a **row** → `{"row": "<id>", "cols": [{"w": <1..12>, "stack": [<items>]}]}`

Fractions are out of 12, normalized by the row's sum. Nesting caps at 3 levels. `header` and `footer`
are frame chrome and are skipped if listed. A block name may repeat; the first occurrence is the arrow
anchor. Blocks hidden in a viewport are skipped even if the layout lists them, so a layout can be
shared between viewports.

Omitting `layouts` for a viewport falls back to the flat stack in block order — correct for mobile,
almost always **wrong for desktop** (that is the stretched-mobile failure mode).

**Two dimensions of variation, and their precedence:** `viewport_overrides` apply first, then
`state_overrides` — state wins on conflict. Visibility is evaluated on both: a block hidden in either
dimension does not render.

---

## Block type → DS component (reference)

**Canonical rule. `/product-ux-request` and `/service-planify-story` both apply it — do not restate it
there, reference this section.** It lives here because this skill owns the block dictionary, and the
rule is about mapping that dictionary onto a surface's design system.

For a given surface, a block type is **covered** when `docs/design-system/{surface}/components/` holds
a spec whose component maps to it. Matching is by role, not by filename: a `text-input` block is
covered by a component named `Input`, `TextField` or `FormInput`. Read the component's spec to confirm
the role rather than trusting the name.

A block type is a **gap** when no component in that surface's catalog fills its role.

Not everything counts:

| Category | Needs a DS component? |
|---|---|
| Layout (`header`, `footer`, `sidebar`, `main`, `section`) | No — structural containers, not components |
| Navigation, Content, Input, Feedback | Yes |
| `modal` | Yes — it is an overlay component with its own spec |

Two exclusions worth stating, because they generate false positives:
- A block rendered via the fallback (`section` standing in for an unmapped concept) is **not** a gap in
  the design system: it is a gap in the block dictionary, and should be reported as such.
- A block that appears only inside a non-default state (an `alert` visible only in
  `error de validación`) counts the same as any other. States do not make a component optional.

**Gaps are per surface.** The same block type can be covered in one surface and a gap in another —
each surface has its own catalog and its own version.

---

## Variants by block (mid-fi)

| Block | Field | Values |
|-------|-------|--------|
| `button` | `variant` | primary (filled accent), secondary (outline), tertiary (link-style), disabled (gray), error (red) |
| `text-input` | `state` | default, focused (accent border), error (red + msg), disabled |
| `heading` | `level` | h1 (28px), h2 (22px default), h3 (18px) |
| `paragraph` | `level` | body, caption |
| `alert` | `kind` | error (red), warning (orange), info (blue), success (green) |
| `dropdown` | `state` | closed (default), open |
| `tabs` | `active` | index of active tab |

---

## Accent color (mid-fi)

A single accent color per surface, read from `docs/design-system/{surface}/foundations/color.md`
(`color.brand.primary`). Default `#2563eb` only when the DS is still a placeholder and the surface
declares nothing. Applied to:
- `button` variant `primary` (background fill)
- `button` variant `secondary` (border + text)
- `button` variant `tertiary` (text)
- `text-input` state `focused` (border)
- `tabs` active tab (text + bottom border)
- `link` (text)
- `dropdown` state `open` (border)

NO other elements use color (everything else stays in `#1e1e1e` + grays).

---

## Icon names (Unicode map)

The skill maps icon names to Unicode glyphs. Common names:

| Group | Names |
|-------|-------|
| Navigation | `menu`, `close`, `x`, `arrow-up`, `arrow-down`, `arrow-left`, `arrow-right`, `chevron-up`, `chevron-down`, `chevron-left`, `chevron-right`, `home`, `more` |
| User/social | `user`, `users`, `heart`, `star`, `mail`, `phone`, `bell`, `notification`, `message`, `comment`, `share` |
| Action | `search`, `check`, `checkmark`, `plus`, `minus`, `edit`, `trash`, `delete`, `refresh`, `download`, `upload`, `link`, `eye`, `eye-off`, `lock`, `unlock` |
| Status | `info`, `warning`, `error`, `alert`, `success` |
| Content | `image`, `file`, `folder`, `calendar`, `clock`, `time`, `play`, `pause`, `stop`, `filter`, `sort` |
| Settings | `settings` |

Unknown names render as `[name]` text (visible flag).

---

## 8 fixed UI states

| # | State | When it applies |
|---|-------|-----------------|
| 1 | default | Happy path |
| 2 | empty | First use / no data yet |
| 3 | loading | Fetching data |
| 4 | error de validación | User input invalid |
| 5 | error de sistema / sin conexión | Server failure or network loss |
| 6 | success | Confirmation after action |
| 7 | not found | Resource doesn't exist |
| 8 | estado terminal / readonly | Locked, immutable |

Sub-states (modal abierto, dropdown open) can be declared as additional state objects with `parent_state: default`.
