---
name: product-ux-add-surface
description: Add a new surface to an existing product - UX docs, Design System scaffold and wireframes, without touching the existing ones
argument-hint: "[surface-name]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent"
---

# UX Add Surface

## Purpose

Add one surface to a product whose UX was already bootstrapped. Produces the same artifacts
`/product-ux-generate` produces for a surface — product-map, user-flows, screens, wireframes and a
Design System scaffold — without touching the surfaces that already exist.

This exists because `/product-ux-generate` is a bootstrap: it aborts once `docs/ux/` exists. Before
this skill, a surface added later ended up with UX documentation and wireframes but **no Design
System folder**, and no skill able to create one — `/product-design-system-update` only lists the
folders that already exist.

**Flow:**
```
Step 0: Validate prerequisites & parse the surface name
  |
Step 1: Load product + UX context
  |
Step 2: Define the surface (audiences, platform, viewports, accent)
  |
Step 3: Generate product-map.md
  |
Step 4: Generate user-flows.md
  |
Step 5: Scaffold the Design System for the surface
  |
Step 6: Update product-overview.md (inventory + matrix)
  |
Step 7: Update cross-surface-flows.md (if the new surface crosses)
  |
Step 8: Delegate wireframes to /product-ux-wireframes
  |
Step 9: Summary and next steps
```

**Result:** the new surface fully set up — `docs/ux/surfaces/{surface}/` with product-map, user-flows,
screens and `wireframes.html`; `docs/design-system/{surface}/` scaffolded with its own semver and
CHANGELOG; and `product-overview.md` updated with the surface and its audience matrix.

**This command does NOT:**
- Create audiences — `/product-ux-agent` does that, and this skill maps the new surface against the
  audiences that already exist
- Modify other surfaces — it only touches the new one and the two shared documents
  (`product-overview.md`, `cross-surface-flows.md`)
- Populate the Design System — the scaffold starts empty by design; `/product-design-system-update`
  fills it as reusable components appear
- Bootstrap a product from scratch — use `/product-ux-generate` for that

## References

**Read [UX Methodology](.claude/specs/ux-methodology.md)** and apply it.

This skill runs in the **production tier** of Rule 4: it produces screens, wireframes and a Design
System scaffold, in addition to the research-tier artifacts.

## CRITICAL RULES

1. **Use Spanish for generated content** - All user interactions and generated documents in Spanish.
   The skill itself stays in English.
2. **Save first, then validate** - Save documents, notify user, wait for confirmation.
3. **Reference locations from Files index** - Do not hardcode paths.
4. **Do NOT dump full content in chat** - Save to file, show summary, let user review.
5. **ABORT if `ux_folder` does not exist** - This skill extends an existing UX set. If `docs/ux/` is
   missing, the product was never bootstrapped: run `/product-ux-generate` first.
6. **ABORT if the surface already exists** - If `docs/ux/surfaces/{name}/` is present, this is not an
   alta. Point at `/product-ux-agent` for documentation changes and `/product-ux-wireframes` for
   wireframes.
7. **NEVER touch other surfaces** - Only the new surface's folder plus the two shared documents. A
   surface alta that rewrites a sibling's product-map is a bug, not a feature.
8. **Respect the firm rules of the methodology** (see agent file): persona genérica, audiencias por
   JTBD, sin versionado de archivos, trazabilidad obligatoria, vocabulario funcional, no rellenar.
   Every screen in the new product-map traces to a capability, requirement or input-cliente.
9. **The platform bounds the viewports** - `web` → `mobile` / `desktop`; `mobile-app` → `phone` /
   `tablet`; `desktop-app` → `desktop`. A native phone app has no desktop viewport, and the wireframe
   generator rejects the combination.
10. **NEVER render wireframes directly** - Step 8 delegates to `/product-ux-wireframes` with
    `--no-interactive`. Same rule as `/product-ux-generate` and `/product-ux-request`: the rendering
    contract lives in one skill.
11. **The accent goes into the Design System** - `foundations/color.md` → `color.brand.primary` is its
    canonical home, and what the wireframe generator reads. `product-overview.md` records the trace.

## Execution

### Step 0: Validate & Parse

**0.1 Load Context**

1. Read [Files index](.claude/utils/index.md) to get all locations
2. Identify key folders:
   - **prd_folder** — product definition (input)
   - **ux_folder** — UX root
   - **ux_audiences_folder** — existing audiences
   - **ux_surfaces_folder** — where the new surface goes
   - **ds_folder** — Design System root

**0.2 Validate prerequisites**

```bash
ls docs/ux/product-overview.md 2>/dev/null
ls -d docs/ux/surfaces/*/ 2>/dev/null
```

**If `docs/ux/` or `product-overview.md` is missing, ABORT:**

```markdown
No encuentro documentación UX en `docs/ux/`.

Este skill agrega una superficie a un producto que **ya tiene UX inicializado**. Para generarla desde cero:

**Ejecutá** `/product-ux-generate`
```

**0.3 Resolve the surface name**

Parse `$ARGUMENTS` as the surface slug (kebab-case, lowercase, hyphens).

If no argument was provided, ask for it with `AskUserQuestion`, showing the existing surfaces as
context so the new name is consistent with them.

**0.4 ABORT if the surface already exists**

```bash
ls -d docs/ux/surfaces/{{surface-name}} 2>/dev/null
```

```markdown
La superficie `{{surface-name}}` ya existe en `docs/ux/surfaces/`.

Este skill es para dar de alta una superficie nueva. Para lo que ya existe:
- **`/product-ux-agent`** — editar su documentación
- **`/product-ux-wireframes {{surface-name}}`** — regenerar sus wireframes
- **`/product-design-system-update`** — iterar su Design System

{{Si existe en docs/ux/surfaces/ pero le falta docs/design-system/{{surface-name}}/:}}
**Ojo:** la superficie existe pero **no tiene carpeta de Design System**. Ejecutá
`/product-design-system-update` y elegí `{{surface-name}}`: detecta ese caso y crea el scaffold.
```

**ABORT.**

---

### Step 1: Load Context

**1.1 Read the PRD** from **prd_folder**: `goals-and-context.md`, `requirements.md`, and
`feature-groups.md` if it exists. The new surface's screens must trace to it.

**1.2 Read `product-overview.md`** — existing surfaces (with their platform, viewports and accent),
audiences, and the audience ↔ surface matrix. This is what the new surface has to slot into.

**1.3 Read the existing audiences' `research-context.md`** from **ux_audiences_folder**. The new
surface serves audiences that already exist; their JTBDs decide which screens it needs.

**1.4 Read one sibling `product-map.md`** from an existing surface, as the structural reference for the
document you are about to write (it reflects the conventions this product actually uses).

**1.5 Read the architecture** — `docs/prd/architecture.md`, and the `manifest.yaml` of the service that
serves this surface if it exists. Its `language` cross-checks the platform (`flutter` → `mobile-app`,
`nextjs` → `web`).

---

### Step 2: Define the Surface

**2.1 Propose the definition**

Infer from the PRD and the loaded context, then present everything in ONE block:

```markdown
## Nueva superficie: `{{surface-name}}`

**Qué cubre:** {{1 línea}}

**Plataforma:** `{{web | mobile-app | desktop-app}}`
{{· coincide con `language: {{x}}` del manifest de {{servicio}} | · sin servicio asociado todavía}}

**Viewports:** `{{primario}}`{{, `{{secundario}}`}} — {{por qué: dónde y con qué se usa}}

**Accent:** `{{#hex}}` — {{origen: color de marca / el mismo que {{otra superficie}} / default}}

**Audiencias que la usan:**
| Audiencia | Para qué |
|---|---|
| {{audience-slug}} | {{1 línea, derivada de su JTBD}} |

**Pantallas previstas** ({{N}}):
| Pantalla | Propósito | Referencia PRD |
|---|---|---|
| {{Nombre}} | {{1 línea}} | {{C-XX}} |

**¿Es correcto?** Podés corregir plataforma, viewports, accent, audiencias o el inventario de pantallas.
```

> Recordatorios al usuario, incluidos en el bloque cuando apliquen:
> - Declarar un segundo viewport implica diseñar un layout por pantalla para él.
> - Una superficie `mobile-app` no puede tener `desktop`.
> - Si ninguna audiencia existente usa esta superficie, hace falta una audiencia nueva:
>   creala con `/product-ux-agent` y volvé.

**WAIT for user response.** Iterate until confirmed.

**2.2 Create the folder**

```bash
mkdir -p docs/ux/surfaces/{{surface-name}}
```

---

### Step 3: Generate `product-map.md`

**3.1** Read **UX Product Map Template** from Files Index.

**3.2** Draft it from the confirmed definition: audiences on this surface (linked to their
research-contexts), the screen inventory with its Viewports column and PRD traceability, the overlay
inventory if any, navigation structure, information architecture and global states.

Save to **ux_surfaces_folder**/`{{surface-name}}`/`product-map.md`.

---

### Step 4: Generate `user-flows.md`

**4.1** Read **UX User Flows Template** from Files Index.

**4.2** Identify 3-5 critical flows for this surface — the ones that define its value, not all of them.
Each flow names the JTBD it solves, its audience, trigger, happy path, alternatives, errors and
recovery, final state and success criteria. Exclude cross-surface flows: those go in Step 7.

Save to **ux_surfaces_folder**/`{{surface-name}}`/`user-flows.md`.

---

### Step 5: Scaffold the Design System

The reason this skill exists. Without it, the surface has no DS and no skill can create one.

**5.1 Copy the per-surface scaffold**

```bash
mkdir -p docs/design-system/{{surface-name}}
cp -r .claude/skills/product-ux-generate/assets/design-system-bootstrap-per-surface/* \
      docs/design-system/{{surface-name}}/
sed -i "s/{{SURFACE}}/{{surface-name}}/g" docs/design-system/{{surface-name}}/README.md
```

**5.2 Pick the grid foundation variant for the platform**

```bash
if [ "{{platform}}" = "mobile-app" ]; then
  mv docs/design-system/{{surface-name}}/foundations/grid.mobile-app.md \
     docs/design-system/{{surface-name}}/foundations/grid.md
else
  rm -f docs/design-system/{{surface-name}}/foundations/grid.mobile-app.md
fi
```

**5.3 Seed the accent**

If the confirmed accent is not the default `#2563eb`, replace `color.brand.primary` in
`docs/design-system/{{surface-name}}/foundations/color.md` and add a line to its `## Historial`. Only
that token — the rest of the palette stays placeholder, because it is not a decision yet.

**5.4 Replace dates**

```bash
TODAY=$(date +%Y-%m-%d)
find docs/design-system/{{surface-name}} -name '*.md' -exec sed -i "s/{{DATE}}/${TODAY}/g" {} +
```

**5.5 Add the surface to the root DS index**

Append a bullet to `docs/design-system/README.md`, in alphabetical order among the existing ones:

```markdown
- [`{{surface-name}}`](./{{surface-name}}/README.md) — versión inicial 0.1.0
```

---

### Step 6: Update `product-overview.md`

Edit **ux_folder**/`product-overview.md` — the only shared document this skill rewrites:

1. **Inventario de Superficies**: add the surface with its platform, viewports and accent, each with
   its one-line reason.
2. **Matriz Audiencia ↔ Superficie**: add the new surface to the row of every audience that uses it.
3. **Glosario**: add a term only if the surface introduces genuinely new vocabulary.

Do NOT modify the entries of other surfaces.

---

### Step 7: Update `cross-surface-flows.md`

Read **ux_folder**/`cross-surface-flows.md`. Add a flow only when state, notifications or actions
actually cross between the new surface and an existing one — not merely because two surfaces touch the
same entity.

If the document holds the single-surface empty case (the product had only one surface until now),
replace that section with the real cross-surface flows.

---

### Step 8: Generate Wireframes

Delegate. Do NOT render here.

Use the **Agent tool** with `subagent_type: "general-purpose"` and this prompt:

```
Ejecutá el skill product-ux-wireframes con los siguientes parámetros:
- Argumento: {{surface-name}} --no-interactive

La superficie es nueva: tiene product-map.md y user-flows.md recién creados, y todavía no tiene
screens/*.md ni wireframes.html. Inferilos desde esos dos documentos.

Su plataforma y sus viewports están declarados en docs/ux/product-overview.md
("Inventario de Superficies"). Cada pantalla necesita un layout por cada viewport de la superficie.

NO toques ninguna otra superficie.

No esperes confirmación del usuario: devolvé el resumen de lo generado.
```

Verify afterwards that `docs/ux/surfaces/{{surface-name}}/wireframes.html` exists. If it does
not, report it without aborting — the user can run `/product-ux-wireframes {{surface-name}}` manually.

---

### Step 9: Summary

```markdown
Superficie `{{surface-name}}` agregada.

**Documentación UX:**
- `docs/ux/surfaces/{{surface-name}}/product-map.md` — {{N}} pantallas{{, {{M}} overlays}}
- `docs/ux/surfaces/{{surface-name}}/user-flows.md` — {{K}} flujos críticos
- `docs/ux/surfaces/{{surface-name}}/screens/*.md` — {{N}} archivos
- `docs/ux/surfaces/{{surface-name}}/wireframes.html`

**Design System:**
- `docs/design-system/{{surface-name}}/` — scaffold inicial v0.1.0, con su propio CHANGELOG y versionado
- Accent `{{#hex}}` en `foundations/color.md`
- Grid: variante {{web | app nativa}}

**Documentos compartidos actualizados:**
- `product-overview.md` — inventario y matriz
{{Si hubo cambios:}} - `cross-surface-flows.md` — {{N}} flujos nuevos

**Plataforma:** `{{platform}}` · **Viewports:** {{lista}}

**Siguientes pasos:**
1. Revisá los wireframes: doble clic en `wireframes.html`
2. El Design System arranca vacío a propósito. Se llena con `/product-design-system-update`
   a medida que aparecen componentes reutilizables — no es bloqueante para la primera story.
3. Si la superficie la sirve un servicio nuevo, creá su arquitectura con
   `/product-create-frontend-architecture {{servicio}}`.
```

## Output

Files saved (see Files index for locations):

- `docs/ux/surfaces/{{surface-name}}/product-map.md` — screen and overlay inventory, navigation, IA
- `docs/ux/surfaces/{{surface-name}}/user-flows.md` — 3-5 critical flows
- `docs/ux/surfaces/{{surface-name}}/screens/{{screen}}.md` — one per screen, produced by the delegated
  wireframes run
- `docs/ux/surfaces/{{surface-name}}/screens.json` + `wireframes.html` — the wireframe book
- `docs/design-system/{{surface-name}}/` — complete scaffold with independent semver and CHANGELOG,
  the grid variant matching the platform, and the accent seeded in `foundations/color.md`
- `docs/design-system/README.md` — the root index gains the new surface
- `docs/ux/product-overview.md` — inventory and audience matrix updated
- `docs/ux/cross-surface-flows.md` — updated when the new surface introduces cross-surface flows
