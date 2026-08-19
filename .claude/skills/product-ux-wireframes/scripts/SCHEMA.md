# `screens.json` Schema (mid-fi)

Canonical input format for `build_book.py`. The agent (Claude) produces this JSON by reading the human-readable `screens/*.md` files plus `user-flows.md`. The script does NOT parse markdown — it only validates and renders this JSON.

The renderer emits a **self-contained HTML wireframe book** (`wireframes.html`): one file, no
dependencies, opened by double-clicking. Layout is CSS grid executed by the browser, which is why
a 12-column row and a fixed 420px column are respected rather than approximated. The previous
Excalidraw renderer had no layout engine, so it reimplemented CSS by hand — with hardcoded block
heights and a text-width heuristic that erred by about +20% on real Spanish microcopy.

Mid-fi extensions over low-fi:
- Surface-level `viewports` (one canvas section per viewport), `accent_color` and `grid_baseline`
- Per-screen `layouts`: how blocks are arranged in each viewport (a stack, or rows of columns)
- Block-level viewport visibility (`hidden_in_viewports`, `visible_only_in_viewports`) and
  `viewport_overrides`
- Block-level `variant` (button: primary/secondary/...), `state` (input/dropdown), `level` (heading/paragraph), `kind` (alert), `icon`, `value`, `error_msg`, `aspect_ratio`, `items`, `options`, `annotation`
- Real content (microcopy, headings, error messages) in `content` and dedicated fields

## File location

```
docs/ux/surfaces/{surface}/screens.json
```

**It is versioned.** It used to be written to `/tmp` and discarded after every build, which meant
the richest artifact of the pipeline — every block, layout, state and piece of microcopy already
resolved — was ungoverned and unreviewable. Now it is the source file the renderer consumes, it
diffs cleanly in a PR, and a wireframe can be regenerated without re-deriving it from the `.md`.

The per-screen `.md` files remain the human-facing source of truth; `screens.json` is their
canonical machine form. When they disagree, the `.md` wins and the JSON is regenerated.

## Top-level structure

```json
{
  "_generated": "derivado de screens/*.md por /product-ux-wireframes — no editar a mano",
  "surface": "string",
  "platform": "web",
  "viewports": ["mobile", "desktop"],
  "accent_color": "#2563eb",
  "grid_baseline": 8,
  "viewport_widths": { "desktop": 1440 },
  "screens": [ ... ],
  "transitions": [ ... ]
}
```

`viewport_widths` overrides the canvas width of any viewport (defaults: mobile 400, desktop 1200,
phone 390, phone-landscape 844, tablet 834; accepted range 320–3840).

**Set it whenever a layout uses fixed px columns.** Those numbers come from measuring a real browser,
and they only add up at the width they were measured at. Rendering a `220px + 559px` pair into a
1200px canvas that already spends 300px on a sidebar leaves ~64px for the flexible column, and the
text wraps one word per line. Nothing is technically wrong — the browser executed exactly what was
declared — but the frame is unreadable. Record the survey width here instead of rewriting the
measurements. The builder warns when a flexible column with text in it falls under 180px.

`_generated` is a marker, not data — the renderer ignores it. It is there because this file sits next
to human-readable docs, is the thing the renderer actually reads, and is therefore tempting to edit
directly. The next `/product-ux-wireframes` run overwrites it without asking.

**What this file holds that the `.md` files do not:** the sample data — table rows, activity-feed
entries, filter chips, example ids. Microcopy is a contract and lives in the spec; sample data is
illustrative and lives only here (see rule 8b of `SKILL.md`). Two consequences:

- **Deleting it loses work.** It is not reproducible from the specs — an agent derives it, not a
  compiler, and the sample data comes out different each time.
- **Regeneration diffs even when nothing changed.** The renderer is deterministic (same JSON → same
  bytes of HTML, verified); the derivation step is not.

| Key | Required | Type | Description |
|-----|----------|------|-------------|
| `surface` | Yes | string | Surface name (matches the surface folder under `docs/ux/surfaces/`) |
| `platform` | No | enum | `web` (default) · `mobile-app` · `desktop-app`. Determines which viewports are valid. Declared per surface in `product-overview.md` |
| `viewports` | Yes | array | Ordered subset of the platform's viewports (see the table below). Each one becomes a SECTION on the canvas with its own frame size. The **first** one is the primary viewport: arrows are drawn there. Rendered in canonical order regardless of declaration order. A viewport outside the platform's set is a **hard error** |
| `device` | No | enum | **Deprecated** single-viewport alias, kept so documents written before viewports keep rendering: `device: "mobile"` is equivalent to `viewports: ["mobile"]`. `device: "tablet"` warns and renders as **mobile**, preserving the legacy behavior from when tablet had no frame of its own — for a real tablet frame declare `platform: "mobile-app"` + `viewports: ["tablet"]`. Ignored when `viewports` is present |

### Platforms and their viewports

| Platform | Viewports | Frames | Axis of variation |
|---|---|---|---|
| `web` | `mobile`, `desktop` | 400×800, 1200×800 | window width → breakpoints |
| `mobile-app` | `phone`, `tablet`, `phone-landscape` | 390×844, 834×1112, 844×390 | safe areas and text scaling; **not** width |
| `desktop-app` | `desktop` | 1200×800 | window width → breakpoints |

**A `mobile-app` surface cannot declare `desktop`, and a `web` surface cannot declare `phone`.** The
builder rejects it. This is not a preference: a native phone app has no desktop, and a web surface's
narrow frame is `mobile`, not a phone device frame.

**`phone-landscape` is not part of the canonical offer.** Most phone apps lock portrait, so it is a
per-screen exception: the surface declares it only when some screen actually rotates (video, camera, a
long form), and only those screens include it. The orientation policy lives in the surface's grid
foundation (`docs/design-system/{surface}/foundations/grid.md`, native variant).

**A `mobile-app` with a single `phone` viewport is complete.** In a native app there is one layout;
what varies — safe-area insets, text scaling — are constraints on that layout declared in the grid
foundation, not separate arrangements. Do not synthesize a second viewport to look thorough.
| `accent_color` | No | string | Hex used for primary buttons, focused inputs, active tabs, links. **Read from `docs/design-system/{surface}/foundations/color.md` → `color.brand.primary`**, which is its canonical home; falls back to the surface's `Accent:` line in `product-overview.md`, then to `#2563eb`. It is a SURFACE-level value: it does not belong in a screen's frontmatter, and a stale per-screen copy is ignored. **That cascade is what YOU resolve when writing this file.** If the key is missing or not a hex, the renderer paints the book fully greyscale (`#4a4a4a`) and warns — it does not invent a brand color |
| `grid_baseline` | No | int | Pixel baseline for grid alignment (informational; default `8`) |
| `screens` | Yes | array | Non-empty list of screen objects, in display order (first one = top row) |

**There is no frame height.** A screen is a DOM element as tall as its content, exactly like the page
it represents. The viewport only fixes the WIDTH — 400px, 1200px — which is the axis that actually
changes the layout. The previous renderer had to pick a height, and picking 800px meant silently
dropping whatever did not fit.
| `transitions` | No | array | List of transitions between screens. Empty/omitted = no arrows |

## Screen object

```json
{
  "name": "kebab-case-id",
  "displayName": "Human-readable name",
  "audiences": ["audience-1", "audience-2"],
  "viewports": ["desktop"],
  "overlay": false,
  "overlay_type": "drawer",
  "triggered_by": "parent-screen-name",
  "blocks": [ ... ],
  "layouts": { "mobile": [ ... ], "desktop": [ ... ] },
  "states": [ ... ]
}
```

| Key | Required | Type | Description |
|-----|----------|------|-------------|
| `name` | Yes | string | Internal id, used to reference in transitions. Kebab-case |
| `displayName` | Yes | string | Shown as the row label and frame name |
| `audiences` | No | array | Audience names (informative) |
| `overlay` | No | boolean | `true` if this is an overlay (drawer, bottom-sheet, modal, popover) rather than a full-screen route. Default `false` |
| `overlay_type` | No | string | `drawer` · `bottom-sheet` · `modal` · `popover`. Required when `overlay: true` (informative — affects label in canvas) |
| `triggered_by` | No | string | `name` of the parent screen that opens this overlay. Used by the layout engine to position the overlay frame near the parent |
| `viewports` | No | array | Subset of the surface's viewports where this screen exists. Omitted = all of them. Use it for a screen that only makes sense on one viewport (a dense config table on desktop, a camera capture on mobile) |
| `blocks` | Yes | array | The screen's block inventory, declared ONCE regardless of viewport. Order is the default vertical stack |
| `layouts` | No | object | Per-viewport arrangement, keyed by viewport name. See "Layout object". Omitted for a viewport = the flat stack in `blocks[]` order, which is exactly the pre-viewport behavior |
| `states` | Yes | array | Non-empty list of state objects |

## Block object

```json
{
  "name": "Block label (internal id)",
  "type": "button",
  "category": "input",
  "content": "Confirmar equipo",
  "variant": "primary",
  "icon": "check",
  "annotation": "click → confirma + redirect"
}
```

### Common keys

| Key | Required | Type | Description |
|-----|----------|------|-------------|
| `name` | Yes | string | Internal label (used as id and fallback content) |
| `type` | Yes | string | One of the 36 dictionary types |
| `category` | No | string | layout / navigation / content / input / feedback (informative) |
| `content` | No | string | Real text rendered on the block (microcopy, label, heading) — defaults to `name` |
| `icon` | No | string | Icon name from the Unicode map (search, check, menu, arrow-right, etc.). Falls back to `[name]` text if unknown |
| `annotation` | No | string | Inline note rendered in small gray text below the block (e.g., "polling 30s", "valida >8 chars") |
| `hidden_in_states` | No | string[] | State names in which this block is NOT rendered. Case-insensitive match. Backward-compatible — omitting this field renders the block in all states (original behavior). Example: `["default", "loading"]` |
| `visible_only_in_states` | No | string[] | Inverse of `hidden_in_states`. Block is rendered ONLY in the listed states. Mutually exclusive with `hidden_in_states` (use one or the other). Example: `["error de validación", "error de sistema"]` |
| `hidden_in_viewports` | No | string[] | Viewports in which this block is NOT rendered. Example: `["mobile"]` for a desktop-only sidebar |
| `visible_only_in_viewports` | No | string[] | Inverse of `hidden_in_viewports`. Mutually exclusive with it — declaring both is a hard error |
| `viewport_overrides` | No | object | Map of viewport name → field overrides. Any block field can be overridden, including `type` (e.g. `tabs` on desktop → `dropdown` on mobile). Example: `{"desktop": {"content": "Pedidos del turno", "icon": null}}` |
| `state_overrides` | No | object | Map of state name → field overrides applied on top of the base block before rendering. Any block field can be overridden (content, variant, kind, icon, annotation, etc.). Overrides are applied case-sensitively first, then with lowercase fallback. Example: `{"loading": {"variant": "disabled", "content": "Guardando…"}}` |

### Type-specific keys

**`button`**
- `variant`: `primary` (filled accent) · `secondary` (outline) · `tertiary` (link-style) · `disabled` (gray) · `error` (red). Default `primary`.

**`text-input`**
- `state`: `default` · `focused` (accent border) · `error` (red border + msg) · `disabled`. Default `default`.
- `value`: real input text (rendered instead of placeholder)
- `error_msg`: error message rendered below the input (visible only when `state: error`)

**`heading`**
- `level`: `h1` (28px) · `h2` (22px, default) · `h3` (18px)

**`paragraph`**
- `level`: `body` (default) · `caption` (smaller, gray)
- `lines`: number of placeholder lines (used only when `content` is empty)

**`alert`**
- `kind`: `error` (red) · `warning` (orange) · `info` (blue) · `success` (green). Default `error`. Auto-icon by kind unless `icon` provided.

**`image`**
- `aspect_ratio`: e.g., `4:3`, `16:9`. Rendered as text inside the placeholder
- `h`: explicit height in px (default 200)

**`list`**
- `items`: list of `{title, subtitle, icon}` for real items. If absent, falls back to `items_count`.
- `items_count`: fallback count (default 3)

**`dropdown`**
- `state`: `closed` (default) · `open` (renders options below)
- `options`: list of strings shown when `state: open` (max 6)

**`tabs`**
- `labels`: list of tab labels (or pipe-separated in `content`)
- `active`: index of active tab (default 0)

**`nav-bar`**
- `labels`: list of nav items

**`sidebar`**
- `items`: list of `{title, icon}` (or plain strings) rendered as stacked nav entries

> **Every `items` / `labels` list accepts both shapes** — a plain string, or an object whose label is
> read from `title`, `label`, `text` or `name` (first one present wins). Use the object form when the
> item carries an `icon`. An object with none of those keys renders empty and the builder warns.
- `content`: optional panel label above the entries
- `h`: explicit height. Omitted, the panel fills the room left in its column down to the footer — which is what a persistent desktop sidebar looks like

**`table`**
- `columns`: list of column labels, or of `{label, width}` where `width` is the column's share (percent or twelfths). Widths matter: a listing whose title column takes 42% reads nothing like one with even columns
- `rows`: number of data rows to draw (default 3) · `row_h`: row height (default 32)

**`pagination`**
- `pages`: how many page buttons to draw (default 3, capped at 5) · `page_size`: draws the page-size select when set

**`date-picker`**
- `value`: the selected date, rendered instead of the placeholder

**`breadcrumbs`**
- `items`: the trail, e.g. `["Inicio", "Requisitos", "#1042"]`. Falls back to splitting `content` on `/` or `›`

**`chart`**
- `kind`: `bar` (default) · `line` · `h`: height (default 180). Renders axes plus placeholder marks — enough to read as a chart

**`slider`**
- `fill`: 0..1 position of the thumb (default 0.5)

**`toast`**
- `kind`: `info` (default) · `error` · `success` · `warning`. Anchored to the right edge of the frame

**`section`**
- `h`: explicit height (default 50)

**`card`**, **`badge`**, **`progress-bar`**, **`avatar`**, **`toggle`**, **`checkbox`**, **`radio`** — see SKILL.md for behavior.

### Block types (dictionary)
- Layout: `header`, `footer`, `sidebar`, `main`, `modal`, `section`
- Navigation: `nav-bar`, `tabs`, `link`, `breadcrumbs`, `pagination`
- Content: `heading`, `paragraph`, `image`, `icon`, `list`, `card`, `table`, `avatar`, `badge`, `chart`
- Input: `text-input`, `button`, `dropdown`, `checkbox`, `radio`, `toggle`, `search-bar`, `slider`, `date-picker`
- Feedback: `alert`, `toast`, `progress-bar`, `tooltip`, `empty-state`, `loader`

## Layout object (per viewport)

`screens[].layouts` maps a viewport name to a list of **layout items**. A layout item is either:

- **a string** — the `name` of a block from this screen's `blocks[]`, rendered full width of its column
- **a row object** — `{"row": "<id>", "cols": [{"w": <n>, "stack": [<items>]}, ...]}`

```json
"layouts": {
  "mobile": ["Buscador", "Btn nuevo", "card-1", "card-2", "nav-inferior"],
  "desktop": [
    {"row": "shell", "cols": [
      {"w": 3, "stack": ["sidebar-nav"]},
      {"w": 9, "stack": [
        {"row": "acciones", "cols": [
          {"w": 8, "stack": ["Buscador"]},
          {"w": 4, "stack": ["Btn nuevo"]}
        ]},
        {"row": "grilla", "cols": [
          {"w": 4, "stack": ["card-1"]},
          {"w": 4, "stack": ["card-2"]},
          {"w": 4, "stack": ["card-3"]}
        ]}
      ]}
    ]}
  ]
}
```

| Key | Required | Type | Description |
|-----|----------|------|-------------|
| `row` | No | string | Row id. Informative — helps humans read the layout and match it to the `.md` |
| `cols` | Yes | array | Non-empty list of columns |
| `cols[].w` | Yes | number | Width in grid columns out of 12. Normalized by the **sum** of the row's fractions, so `3+9` and `1+3` both split 25/75 |
| `cols[].stack` | Yes | array | Layout items stacked vertically inside the column. May contain further row objects |

**Rules the script enforces:**

- Nesting is capped at 3 levels (`MAX_LAYOUT_DEPTH`). Deeper fails the build.
- Every block name referenced must exist in this screen's `blocks[]`. An unknown name fails the build.
- `header` and `footer` are **frame chrome**: they render at the top and bottom of the frame and are
  skipped if referenced in a layout. A layout arranges everything *between* them — so a desktop
  sidebar starts below the full-width header, which is the common shell pattern.
- A block name may appear more than once (a grid of identical cards). Each occurrence renders; the
  **first** one is recorded in `coords.blocks` as the arrow anchor.
- A row's height is the tallest of its columns.
- Blocks hidden in this viewport are skipped even if the layout lists them, so one layout can be
  shared across viewports.

**Omitting a layout** for a viewport falls back to the flat vertical stack in `blocks[]` order. That
is the exact behavior that existed before viewports, which is why documents that predate them render
unchanged.

## Override precedence

Two independent dimensions can restrict or modify a block: **viewport** and **state**. They compose:

1. Visibility is evaluated on both. A block hidden in either dimension does not render.
2. `viewport_overrides` are applied first, then `state_overrides` on top — **state wins on conflict**,
   because state is the transient dimension (a button that is `primary` on desktop still becomes
   `disabled` while loading).
3. Both override maps are matched case-sensitively first, then case-insensitively.

## State object

```json
{
  "name": "default",
  "applies": true
}
```

| Key | Required | Type | Description |
|-----|----------|------|-------------|
| `name` | Yes | string | Lowercase. One of: `default`, `empty`, `loading`, `error de validación`, `error de sistema`, `success`, `not found`, `terminal`, `readonly`, `permiso denegado` |
| `applies` | Yes | boolean | If `false`, the state is not rendered (no frame). If `true`, a frame is generated |

States are rendered **in this order**: `default` first (column 0), then the rest as declared.

## Transition object

```json
{
  "src": "screen-name-id",
  "srcState": "default",
  "srcBlock": "Block name in src.blocks[]",
  "dst": "screen-name-id",
  "trigger": "click 'Confirm'",
  "automatic": false
}
```

| Key | Required | Type | Description |
|-----|----------|------|-------------|
| `src` | Yes | string | Source screen `name` (must match a screen's `name`) |
| `srcState` | No | string | Source state name. Default `"default"`. Use other state names when the trigger lives in a non-default state |
| `srcBlock` | No | string | Block `name` within `src.blocks[]` that triggers the transition. Used by the agent to know which block to anchor the arrow to |
| `dst` | Yes | string | Destination screen `name` (must match a screen's `name`) |
| `trigger` | No | string | Short label (4-6 words, ~25 chars). Used by the agent as the label text |
| `automatic` | No | boolean | If `true`, arrow is dashed (auto transition). Default `false` (solid, user-driven) |

**`build_book.py` turns each transition into a clickable block.** The block named by `srcBlock`
becomes a jump to `dst` inside the book, labelled with `trigger`. There are no arrows to lay out: the
reader walks the flow instead of reading a diagram of it, which is also why there is no arrow geometry
left in the codebase.

A transition naming a screen that does not exist is **skipped with a warning** rather than failing the
build — it means `transitions[]` and the screen inventory disagree, and the source needs fixing.

## Complete example

```json
{
  "surface": "web-11",
  "viewports": ["mobile"],
  "accent_color": "#2563eb",
  "grid_baseline": 8,
  "screens": [
    {
      "name": "home",
      "displayName": "Home",
      "audiences": ["fan-casual-share"],
      "blocks": [
        {"name": "header", "type": "header", "icon": "menu", "content": "11"},
        {"name": "Hero heading", "type": "heading", "level": "h1", "content": "Armá tu 11 ideal"},
        {"name": "Hero subtitle", "type": "paragraph", "level": "caption", "content": "Sin registro · 5 minutos · listo para compartir"},
        {"name": "Hero image", "type": "image", "aspect_ratio": "16:9", "content": "Card de ejemplo"},
        {"name": "CTA primario", "type": "button", "variant": "primary", "icon": "arrow-right", "content": "Armá tu 11"},
        {"name": "CTA secundario", "type": "button", "variant": "secondary", "content": "Crear sala draft"},
        {"name": "Campo código", "type": "text-input", "icon": "search", "content": "Tenés un código? ingresalo", "annotation": "valida 6 chars alfanuméricos"},
        {"name": "Link feed", "type": "link", "icon": "arrow-right", "content": "Ver feed"},
        {"name": "indicador-offline", "type": "alert", "kind": "warning", "content": "Sin conexión · Los cambios se guardan localmente", "visible_only_in_states": ["error de sistema"]}
      ],
      "states": [
        {"name": "default", "applies": true},
        {"name": "loading", "applies": true},
        {"name": "error de sistema", "applies": true}
      ]
    },
    {
      "name": "armar",
      "displayName": "Armar",
      "audiences": ["fan-casual-share"],
      "blocks": [
        {"name": "header", "type": "header", "icon": "arrow-left", "content": "Volver"},
        {"name": "Cancha", "type": "image", "aspect_ratio": "1:1", "content": "Cancha + 11 puestos clickables", "h": 380, "annotation": "tap puesto → abre selector en sheet"},
        {"name": "Formación", "type": "section", "content": "Formación · 4-3-3"},
        {"name": "Botón Confirmar", "type": "button", "variant": "primary", "icon": "check", "content": "Confirmar equipo",
          "state_overrides": {"loading": {"variant": "disabled", "content": "Guardando…"}, "error de validación": {"variant": "error"}}}
      ],
      "states": [
        {"name": "default", "applies": true},
        {"name": "empty", "applies": true},
        {"name": "loading", "applies": true},
        {"name": "error de validación", "applies": true},
        {"name": "permiso denegado", "applies": false}
      ]
    },
    {
      "name": "pagina-publica",
      "displayName": "Página pública",
      "blocks": [
        {"name": "header", "type": "header", "content": "Tu 11"},
        {"name": "Card equipo", "type": "image", "aspect_ratio": "4:5", "content": "Formación confirmada"},
        {"name": "Botón compartir", "type": "button", "variant": "primary", "icon": "share", "content": "Compartir"}
      ],
      "states": [
        {"name": "default", "applies": true},
        {"name": "not found", "applies": true}
      ]
    },
    {
      "name": "menu-navegacion",
      "displayName": "Menú de navegación",
      "overlay": true,
      "overlay_type": "drawer",
      "triggered_by": "home",
      "blocks": [
        {"name": "header", "type": "header", "icon": "close", "content": "Menú"},
        {"name": "Nav", "type": "list", "items": [{"title": "Feed"}, {"title": "Reglas"}, {"title": "Sobre"}]}
      ],
      "states": [
        {"name": "default", "applies": true}
      ]
    }
  ],
  "transitions": [
    {"src": "home", "srcBlock": "CTA primario", "dst": "armar", "trigger": "click 'Armá tu 11'", "automatic": false},
    {"src": "armar", "srcBlock": "Botón Confirmar", "dst": "pagina-publica", "trigger": "post-confirmación", "automatic": true},
    {"src": "home", "srcBlock": "header", "dst": "menu-navegacion", "trigger": "abre menú", "automatic": false}
  ]
}
```

### Overlay example

An overlay is a screen object with `"overlay": true`. It is rendered in a separate section below the main grid, not as a row in it.

```json
{
  "name": "menu-navegacion",
  "displayName": "Menú de navegación",
  "overlay": true,
  "overlay_type": "drawer",
  "triggered_by": "home",
  "blocks": [
    {"name": "header-menu", "type": "header", "content": "Menú"},
    {"name": "item-perfil", "type": "link", "icon": "user", "content": "Perfil y Vehículos"},
    {"name": "item-mantenimiento", "type": "link", "icon": "settings", "content": "Mantenimiento"},
    {"name": "item-notificaciones", "type": "link", "icon": "bell", "content": "Notificaciones",
      "annotation": "badge con contador de no leídas"}
  ],
  "states": [
    {"name": "default", "applies": true}
  ]
}
```

## Complete example — two viewports

Same surface with `mobile` + `desktop`. Note what is declared once (blocks, states, microcopy) and
what is declared per viewport (presence, arrangement).

```json
{
  "surface": "app-operador",
  "viewports": ["mobile", "desktop"],
  "accent_color": "#2563eb",
  "grid_baseline": 8,
  "screens": [
    {
      "name": "listado-pedidos",
      "displayName": "Listado de pedidos",
      "audiences": ["operador-turno"],
      "blocks": [
        {"name": "header", "type": "header", "content": "Pedidos", "icon": "menu",
         "viewport_overrides": {"desktop": {"content": "Pedidos del turno", "icon": null}}},
        {"name": "sidebar-nav", "type": "sidebar", "content": "Navegación",
         "visible_only_in_viewports": ["desktop"],
         "items": [{"title": "Pedidos", "icon": "list"}, {"title": "Clientes", "icon": "users"}]},
        {"name": "nav-inferior", "type": "nav-bar", "labels": ["Pedidos", "Clientes", "Perfil"],
         "visible_only_in_viewports": ["mobile"]},
        {"name": "Buscador", "type": "search-bar", "content": "Buscar pedido…", "icon": "search"},
        {"name": "Btn nuevo", "type": "button", "variant": "primary", "content": "Nuevo pedido",
         "icon": "plus", "state_overrides": {"loading": {"variant": "disabled", "content": "Guardando…"}}},
        {"name": "card-1", "type": "card", "content": "Pedido #1042"},
        {"name": "card-2", "type": "card", "content": "Pedido #1043"},
        {"name": "card-3", "type": "card", "content": "Pedido #1044"},
        {"name": "footer", "type": "footer", "content": "v1.0"}
      ],
      "layouts": {
        "mobile": ["Buscador", "Btn nuevo", "card-1", "card-2", "card-3", "nav-inferior"],
        "desktop": [
          {"row": "shell", "cols": [
            {"w": 3, "stack": ["sidebar-nav"]},
            {"w": 9, "stack": [
              {"row": "acciones", "cols": [
                {"w": 8, "stack": ["Buscador"]},
                {"w": 4, "stack": ["Btn nuevo"]}
              ]},
              {"row": "grilla", "cols": [
                {"w": 4, "stack": ["card-1"]},
                {"w": 4, "stack": ["card-2"]},
                {"w": 4, "stack": ["card-3"]}
              ]}
            ]}
          ]}
        ]
      },
      "states": [
        {"name": "default", "applies": true},
        {"name": "empty", "applies": true},
        {"name": "loading", "applies": true}
      ]
    },
    {
      "name": "ajuste-reglas",
      "displayName": "Ajuste de reglas de picking",
      "viewports": ["desktop"],
      "blocks": [
        {"name": "header", "type": "header", "content": "Reglas de picking"},
        {"name": "Tabla reglas", "type": "table", "content": "Prioridad por zona"}
      ],
      "states": [{"name": "default", "applies": true}]
    }
  ],
  "transitions": [
    {"src": "listado-pedidos", "srcState": "default", "srcBlock": "Btn nuevo",
     "dst": "ajuste-reglas", "trigger": "abrir reglas", "automatic": false}
  ]
}
```

What this example shows:

- `header` exists in both viewports but says something longer on desktop, via `viewport_overrides`.
- `sidebar-nav` and `nav-inferior` are the same navigation solved two ways — each restricted to one
  viewport with `visible_only_in_viewports`.
- The three cards stack on mobile and sit 3-per-row on desktop. Same blocks, same content: only the
  layout differs.
- `Btn nuevo` becomes `disabled` while loading through `state_overrides`, in **both** viewports — the
  state dimension is declared once.
- `ajuste-reglas` only exists on desktop (`viewports: ["desktop"]`), so it renders as a row in the
  desktop section and is absent from the mobile one.
- Arrows are drawn only on `mobile` (the primary), even for the transition into a desktop-only screen.

## Complete example — native phone app

A `mobile-app` surface with a single `phone` viewport. This is the **complete and correct** shape for
almost every phone app: one viewport, one layout per screen, no `layouts` needed beyond the phone one.

```json
{
  "surface": "app-conductor",
  "platform": "mobile-app",
  "viewports": ["phone"],
  "accent_color": "#0f766e",
  "screens": [
    {
      "name": "viaje-activo",
      "displayName": "Viaje activo",
      "audiences": ["conductor-en-turno"],
      "blocks": [
        {"name": "header", "type": "header", "content": "Viaje #4821", "icon": "menu"},
        {"name": "Mapa", "type": "image", "aspect_ratio": "1:1", "h": 280, "content": "Mapa del recorrido"},
        {"name": "Datos pasajero", "type": "card", "content": "Ana M. · 4.9 ★"},
        {"name": "Btn llegue", "type": "button", "variant": "primary", "content": "Llegué al punto"},
        {"name": "Btn cancelar", "type": "button", "variant": "tertiary", "content": "Cancelar viaje"},
        {"name": "nav-inferior", "type": "nav-bar", "labels": ["Viajes", "Ganancias", "Perfil"],
         "annotation": "respeta el inset del home indicator"}
      ],
      "layouts": {
        "phone": ["Mapa", "Datos pasajero", "Btn llegue", "Btn cancelar", "nav-inferior"]
      },
      "states": [
        {"name": "default", "applies": true},
        {"name": "loading", "applies": true},
        {"name": "error de sistema", "applies": true}
      ]
    }
  ],
  "transitions": []
}
```

What this example shows:

- **`platform: "mobile-app"` with one viewport is not an incomplete document.** There is no second
  layout to declare, because the app has one. Declaring `desktop` here would be rejected by the builder.
- The layout is a plain stack — correct for a phone screen, and not the "stretched mobile" failure mode
  that the row containers exist to prevent on desktop.
- The adaptive concerns that DO apply — the bottom nav clearing the home indicator, surviving text
  scaling — are **not** viewports. They live in the surface's grid foundation and show up here only as
  an `annotation` where they affect a specific block.
- If this app later supported tablets, it would add `"tablet"` to `viewports` and a `layouts.tablet`
  per screen — likely a split view (map on one side, trip data on the other), which is a real second
  layout rather than a wider version of the first.

## Validation errors

The script fails with `[build_wireframes] ERROR: ...` and exit code 1 on:

- Missing required top-level key (`surface`, `device`, `screens`)
- `device` not in `mobile`/`desktop`/`tablet`
- `screens` empty
- Screen missing `name`, `displayName`, `blocks`, or `states`
- `states` empty
- Block missing `name` or `type`
- State `applies` not boolean
- Unknown viewport name (valid: `mobile`, `desktop`, `phone`, `phone-landscape`, `tablet`)
- Unknown platform (valid: `web`, `mobile-app`, `desktop-app`)
- A viewport that does not belong to the declared platform (e.g. `desktop` on a `mobile-app`)
- A block declaring both `hidden_in_viewports` and `visible_only_in_viewports`
- A layout referencing a block name that does not exist in the screen
- A layout row without a non-empty `cols` list, or a column without a `stack` or with `w <= 0`
- Layout nesting deeper than 3 levels

Transitions are **not** fatal: a transition naming an unknown screen, or anchored to a block that does
not exist in the source screen, is skipped (or anchored at the frame edge) with a warning on stderr.
The rest of the canvas still renders — an unrenderable arrow should not cost you the wireframe.

Unknown block types do **not** fail — they render as `[type] {name}` so the issue is visible without breaking the build.

---
