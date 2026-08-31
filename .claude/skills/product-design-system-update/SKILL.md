---
name: product-design-system-update
description: Interactive mode to update the design system — add, modify, or remove components, foundations, tokens, patterns, and guidelines with automatic semver bumping and CHANGELOG entries
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
---

# Update Design System

## Purpose

Interactive skill for the design team (or anyone managing the design system) to iterate on `docs/design-system/`. Loads the current state of the DS, listens to free-form user requests, applies changes, updates CHANGELOG and bumps semver automatically.

**Flow:**
```
Step 0: Validate prerequisites (DS must exist)
  |
Step 1: Pick the target surface (interactive if multiple)
  |
Step 2: Load DS context for that surface (current state + templates)
  |
Step 3: Confirm context loaded
  |
Loop: Attend user requests
       (add / modify / remove / apply-full-doc / ask questions)
       → apply change → update CHANGELOG → bump version → notify
```

**Result:** `docs/design-system/{surface}/` updated according to the user's requests. Every change is reflected in the surface's `CHANGELOG.md` and its version is bumped per semver (independent of other surfaces).

**This command does NOT:**
- Bootstrap the design system structure (that happens in `/product-ux-generate`)
- Modify wireframes (`docs/ux/surfaces/{surface}/screens/*.md`) — those are agnostic of the DS
- Modify code in service repositories — the DS is consumed by services at implementation time

## References

**Read [UX Methodology](.claude/specs/ux-methodology.md)** and apply it. — extended with design-system stewardship: applies changes faithfully, maintains semver discipline, never silently breaks consumers.

## CRITICAL RULES

1. **Use Spanish for generated content** — All `.md` content and CHANGELOG entries in Spanish. Skill itself in English. User-facing messages in Spanish.

2. **Save first, then validate** — Apply changes to files immediately, update CHANGELOG, then notify. The user reads the diff in their editor.

3. **Reference locations from Files index** — Do not hardcode paths. Read [Files index](.claude/utils/index.md) for design system folder.

4. **ABORT if there is nothing to work on** — Neither a `docs/design-system/` with surfaces, nor surfaces declared in `docs/ux/surfaces/` that could receive a scaffold. Instruct the user to run `/product-ux-generate` first.

4b. **Scaffold orphan surfaces instead of hiding them** — A surface with UX docs but no design-system folder must still be selectable: this skill is the only one that can create its scaffold after the initial bootstrap. Never present the list as if that surface did not exist.

5. **Use the canonical templates** — When creating a new component, follow [DS Component Template](.claude/templates/ds-component-tmpl.yaml) (12 sections). When creating/modifying a foundation, follow [DS Foundation Template](.claude/templates/ds-foundation-tmpl.yaml).

6. **Bump semver automatically** — After applying any change, determine the bump type and update `docs/design-system/{{target_surface}}/README.md` version + add CHANGELOG entry:
   - **MAJOR** (X.0.0): breaking change — remove variant, rename component, change API, change semantic token mapping, change palette role.
   - **MINOR** (0.X.0): additive — add component, add variant, add foundation, add token, add pattern.
   - **PATCH** (0.0.X): fix — correct spec, adjust microcopy, fix typo, ajustar valor de un primitivo sin renombrar.

7. **CHANGELOG entry mandatory** — Every change adds an entry to `docs/design-system/{{target_surface}}/CHANGELOG.md` under a new version section, using categories: Agregado / Cambiado / Eliminado / Deprecado / Corregido.

8. **Confirm destructive changes** — Before MAJOR bumps (remove variant, rename, breaking change), ask the user to confirm. Suggest `deprecated: true` + migration path as a safer alternative.

9. **Update per-file changelog too** — Each `.md` in the DS has a `## Historial` section at the end. Append the change there as well.

10. **NEVER touch wireframes from this skill** — `docs/ux/surfaces/{surface}/screens/*.md` are agnostic of the DS. If the user wants to update a wireframe, redirect them to `/product-ux-agent` or `/product-ux-wireframes`.

11. **Apply full docs when pasted** — If the user pastes a complete document or links a file ("aplicá todo este doc que tengo acá @design-spec.md"), diff against the current DS, apply changes section-by-section, and consolidate the version bump (typically MINOR or MAJOR depending on scope).

12. **NEVER dump full content in chat** — After applying a change, notify briefly with summary + paths. Let the user review files in their editor.

13. **Do not invent foundation values** — If the user asks "agregá un nuevo color para acento" without specifying the hex, ASK. Do not pick arbitrary values.

14. **Reference foundations from components** — When documenting a component, always link to tokens semánticos. Components consume `bg.action.primary`, NEVER `color.blue.500` directly.

## Execution

### Step 0: Validate Prerequisites

**0.1 Check that the DS scaffold exists**

```bash
test -d docs/design-system && test -f docs/design-system/README.md && echo "OK" || echo "MISSING"
```

**If MISSING:**

```markdown
No hay Design System inicializado.

El scaffold del Design System se crea automáticamente al ejecutar
`/product-ux-generate`. Ejecutalo primero para tener la estructura base
con placeholders, y después volvé a `/product-design-system-update`
para iterarla.
```

**ABORT.**

---

### Step 1: Pick the Target Surface

The DS is per-surface — each surface has its own folder, version, and CHANGELOG. Determine which surface this iteration targets.

**1.1 List available surfaces — and detect orphans**

```bash
# surfaces with a DS folder
ls -d docs/design-system/*/ 2>/dev/null | xargs -n 1 basename
# surfaces declared in the UX docs
ls -d docs/ux/surfaces/*/ 2>/dev/null | xargs -n 1 basename
```

A surface present in `docs/ux/surfaces/` **without** a folder in `docs/design-system/` is an
**orphan**: it has UX documentation and wireframes but no design system. It happens to surfaces added
after the initial bootstrap. Offer it in the list anyway, marked as such, and scaffold it on selection
(1.4) — otherwise there is no skill able to create its design system.

**Consequences worth knowing while it stays orphaned:** its wireframes render with the default accent
because `foundations/color.md` does not exist, and `/product-ux-request` has no component catalog to
check the delta against.

**1.2 If exactly ONE surface exists** → pick it automatically. Inform the user:

```markdown
Surface detectado: **{{surface}}** (único disponible). Cargando su Design System…
```

Set **target_surface = {{surface}}** and continue to Step 2.

**1.3 If MULTIPLE surfaces exist** → ask the user which one.

Use `AskUserQuestion` with one question listing the available surfaces as options:

```
"¿Sobre qué surface vas a iterar el Design System?"
header: "Surface"
options:
  - label: "{{surface-1}}"
    description: "vX.Y.Z · {{count}} components"
  - label: "{{surface-2}}"
    description: "vX.Y.Z · {{count}} components"
```

(Read each surface's `README.md` to fill in the version and component count for each option.)

Set **target_surface** to the user's choice and continue.

**1.4 If the chosen surface is an orphan** → scaffold it before loading:

```bash
mkdir -p docs/design-system/{{target_surface}}
cp -r .claude/skills/product-ux-generate/assets/design-system-bootstrap-per-surface/* \
      docs/design-system/{{target_surface}}/
sed -i "s/{{SURFACE}}/{{target_surface}}/g" docs/design-system/{{target_surface}}/README.md

# grid variant per the surface's platform (product-overview.md -> Inventario de Superficies)
if [ "{{platform}}" = "mobile-app" ]; then
  mv docs/design-system/{{target_surface}}/foundations/grid.mobile-app.md \
     docs/design-system/{{target_surface}}/foundations/grid.md
else
  rm -f docs/design-system/{{target_surface}}/foundations/grid.mobile-app.md
fi

TODAY=$(date +%Y-%m-%d)
find docs/design-system/{{target_surface}} -name '*.md' -exec sed -i "s/{{DATE}}/${TODAY}/g" {} +
```

Then add the surface to the root `docs/design-system/README.md` index, and seed
`foundations/color.md` → `color.brand.primary` with the accent declared for the surface in
`product-overview.md` if there is one. Inform the user:

```markdown
`{{target_surface}}` no tenía Design System: le creé el scaffold inicial (v0.1.0) antes de iterar.
{{Si se sembró el accent:}} Accent `{{#hex}}` tomado de `product-overview.md`.
```

**1.5 If NO surfaces exist** (only the root README.md is there):

```markdown
No hay surfaces con Design System inicializado en `docs/design-system/`, ni superficies
declaradas en `docs/ux/surfaces/` a las que crearles uno.

Esto puede pasar si el bootstrap del DS no terminó o si los surfaces fueron
removidos manualmente. Ejecutá `/product-ux-generate` primero para
inicializar el DS de cada surface.
```

**ABORT.**

---

### Step 2: Load Design System Context (for target_surface)

All paths in this skill are scoped to `docs/design-system/{{target_surface}}/`.

**2.1 Read Files index** to get folder locations. Note that `ds_surface_folder` resolves to `docs/design-system/{{target_surface}}/`.

**2.2 Load current DS state of target_surface**

- Read `docs/design-system/{{target_surface}}/README.md` to know the current version.
- Read `docs/design-system/{{target_surface}}/CHANGELOG.md` to know history.
- List all files in `docs/design-system/{{target_surface}}/foundations/`, `tokens/`, `components/`, `patterns/`, `guidelines/`.
- Read selectively (do NOT dump everything into context — only files the user references).

**2.3 Load templates**

- Read [DS Component Template](.claude/templates/ds-component-tmpl.yaml).
- Read [DS Foundation Template](.claude/templates/ds-foundation-tmpl.yaml).

---

### Step 3: Confirm Context Loaded

```markdown
## Design System cargado · surface `{{target_surface}}`

**Versión actual:** {{vX.Y.Z}}

**Inventario:**
- Foundations: color, typography, spacing, grid, iconography, motion, elevation, voice-tone
- Tokens: reference, semantic, component
- Components: {{lista actual}} ({{N}} total)
- Patterns: {{lista actual}}
- Guidelines: accessibility, i18n, content

**¿Qué querés modificar?** Algunos ejemplos:
- "agregá un componente Button con variants primary/secondary/disabled"
- "modificá la paleta — primary ahora es #1e40af"
- "eliminá el componente Badge"
- "aplicá todo este doc que tengo acá @path/to/file.md"
- "deprecá la variant tertiary del button"

> Estás iterando el DS de **{{target_surface}}** únicamente. Otros surfaces del
> producto no se ven afectados. Si querés cambiar otro surface, terminá este
> y volvé a ejecutar el skill.
```

**WAIT for user request.**

---

### Loop: Attend User Requests

From this point, respond to whatever the user needs. Categorize the request and apply the corresponding sub-flow.

**Common request types:**

#### A. Add component

User says: "agregá un componente {name} con {variants/specs}"

1. Use [DS Component Template](.claude/templates/ds-component-tmpl.yaml) as structure.
2. Generate `docs/design-system/{{target_surface}}/components/{name}.md` with the 12 canonical sections. Fill what the user specified; mark "Pendiente" where info is missing.
3. If new tokens are needed, add them to `docs/design-system/{{target_surface}}/tokens/component.md`.
4. Bump version: **MINOR**.
5. Update CHANGELOG.
6. Update per-file `## Historial` of created components and modified tokens.
7. Notify with the path and bump info.

#### B. Modify component

User says: "modificá {component} — agregale {variant/state} / cambiá {prop}"

1. Read the current `docs/design-system/{{target_surface}}/components/{component}.md`.
2. Apply the change (add variant to Variants section, modify state in States section, etc.).
3. If the change is **additive** (new variant, new state, new size) → MINOR.
4. If the change is **adjustment** (fix a spec, microcopy) → PATCH.
5. If the change is **breaking** (remove variant, change API of existing prop) → confirm with user before applying. If confirmed → MAJOR. Otherwise propose `deprecated: true` (MINOR) + migration path.
6. Update CHANGELOG + per-file `## Historial`.

#### C. Remove component

User says: "eliminá el componente {name}"

1. **Ask confirmation** — removing a component is destructive.
2. Suggest alternative: `status: deprecated` + migration path (MINOR), keep file for ≥1 release.
3. If user insists on removal: delete `docs/design-system/{{target_surface}}/components/{name}.md`, remove related tokens from `docs/design-system/{{target_surface}}/tokens/component.md`.
4. Bump: **MAJOR**.
5. Update CHANGELOG with migration notes.

#### D. Modify foundation (color, typography, spacing, etc.)

User says: "modificá {foundation} — {change}"

1. Read `docs/design-system/{{target_surface}}/foundations/{foundation}.md`.
2. Apply the change.
3. Bump based on impact:
   - Change a primitive value (e.g., `color.blue.500: #2563eb → #1e40af`) → MAJOR if it changes appearance broadly; PATCH if it's a small calibration.
   - Add new value (new color, new size) → MINOR.
   - Remove a value → MAJOR.
4. If the foundation change cascades to tokens or components, update those too.
5. Update CHANGELOG + per-file `## Historial`.

#### E. Modify tokens

User says: "modificá tokens — {change}"

1. Read the relevant tier (`reference.md`, `semantic.md`, `component.md`).
2. Apply the change.
3. Bump:
   - New token added → MINOR.
   - Renamed token → MAJOR.
   - Remapped semantic token → MAJOR.
   - Adjusted primitive value → see foundation rules.
4. Update CHANGELOG + per-file `## Historial`.

#### F. Add/modify pattern

User says: "agregá un pattern de {form/empty-state/etc.}"

1. Create `docs/design-system/{{target_surface}}/patterns/{name}.md` with structure (purpose, components used, do/don't, examples).
2. Reference the components it composes.
3. Bump: **MINOR**.

#### G. Apply a full document pasted/referenced

User says: "aplicá todo este doc @path/to/file.md" or pastes content.

1. Read the document.
2. Diff against current DS state.
3. Group changes by type (foundations, tokens, components, patterns, guidelines).
4. For each change, apply the corresponding sub-flow.
5. Consolidate into a single CHANGELOG entry with version bump per the most impactful change in the batch (e.g., if it contains 1 MAJOR + 3 MINOR → MAJOR).
6. Notify with summary of what was applied.

#### H. Answer questions

User asks: "¿qué variants tiene Button?", "¿cómo está el contraste de mi paleta?"

1. Read the relevant file(s).
2. Answer with grounding (cite exact path + section).
3. No file changes — purely informational.

#### I. Suggest next steps

User asks: "¿qué falta?", "¿qué componentes faltan documentar?"

1. Cross-reference: which block types from the wireframe dictionary (button, text-input, etc.) are NOT yet documented as components?
2. List missing components in order of likely impact (button > text-input > card > modal > ...).
3. Suggest which placeholders in foundations are still un-replaced.

---

### Update procedure (common to all changes)

After applying any change:

**1. Update version**

Read `docs/design-system/{{target_surface}}/README.md`, find current version (e.g., `0.1.0`), bump per semver rule, write back.

**2. Update CHANGELOG**

Add new section at the top of `docs/design-system/{{target_surface}}/CHANGELOG.md` (under the placeholder section if it's still the initial 0.1.0):

```markdown
## [X.Y.Z] - YYYY-MM-DD

### {Agregado | Cambiado | Eliminado | Deprecado | Corregido}
- {Descripción concisa del cambio}

---
```

**3. Update per-file changelog**

Each modified `.md` has a `## Historial` section at the end. Append:

```markdown
- YYYY-MM-DD vX.Y.Z — {descripción del cambio}
```

**4. Notify**

```markdown
Cambio aplicado.

**Versión:** vX.Y.Z (bump: {{MAJOR|MINOR|PATCH}})

**Archivos modificados:**
- `{path 1}`
- `{path 2}`

**CHANGELOG actualizado:** `docs/design-system/{{target_surface}}/CHANGELOG.md`

**¿Querés hacer otro cambio?**
```

---

## Output

Files modified under `docs/design-system/{{target_surface}}/`:

- `README.md` — version bumped (for this surface only)
- `CHANGELOG.md` — new entry per change (for this surface only)
- `foundations/{name}.md` / `tokens/{tier}.md` / `components/{name}.md` / `patterns/{name}.md` / `guidelines/{name}.md` — depending on the request

Other surfaces under `docs/design-system/` are NEVER touched. Wireframes, PRD, and code are NEVER touched from this skill.
