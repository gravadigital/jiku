---
name: product-ux-audit
description: Check the UX documentation set for inconsistencies - broken references, viewport and platform mismatches, design system wiring and stale wireframes
argument-hint: "[surface1,surface2,...]"
allowed-tools: "Read, Glob, Grep, Bash"
---

# UX Audit

## Purpose

Check that the UX documentation set still holds together. The set is ~8 document types that reference
each other, produced by six different skills and edited by hand in between — nothing verifies they
still agree.

Inconsistencies are otherwise found late and one at a time: `/service-planify-story` warns that a
`screen.md` is missing, the renderer fails on a block that does not exist, or — the worst case —
nothing fails and a story gets implemented against documentation that lies.

**Flow:**
```
Step 0: Validate & take inventory
  |
Step 1: Load the documents
  |
Step 2: Structural checks (broken references)
  |
Step 3: Viewport and platform checks
  |
Step 4: Design System wiring checks
  |
Step 5: Freshness check
  |
Step 6: Methodology checks (judgement-based)
  |
Step 7: Report
```

**Result:** a report, in chat, of every inconsistency found — each one with its severity, where it is,
and which skill fixes it.

**This command does NOT:**
- Modify any file. It is strictly read-only — see Rule 2 for why
- Generate or regenerate wireframes — use `/product-ux-wireframes`
- Create missing artifacts — the report names the skill that creates each one
- Check the PRD or the technical architecture for internal consistency — its scope is `docs/ux/` and
  its wiring into `docs/design-system/`

## Role

**Adopt the [UX Researcher Agent](.claude/agents/ux-researcher.md) role**

This skill runs in the **research tier** of Rule 4: it reads and reports, and produces nothing.

## CRITICAL RULES

1. **Use Spanish for all output** — The report and every message in Spanish. The skill itself stays in
   English.

2. **Read-only. Never write, never fix.** Not even the obvious ones. A validator that edits has to
   choose, and the choice is often ambiguous: facing an orphan `screen.md`, deleting the file and
   adding it to the inventory are opposite actions and either can be the right one. Report, name the
   skill that fixes it, and let the person decide.

3. **Reference locations from Files index** — Do not hardcode paths.

4. **Every finding names its fix** — Same discipline as `/status`: each item ends with `->` and the
   specific command. A finding without a next action is noise.

5. **Separate mechanical findings from judgement ones** — Groups in Steps 2-5 are deterministic:
   either the reference resolves or it does not. Step 6 is the agent reading content and forming an
   opinion. They go in different sections of the report, and the judgement ones never come first —
   they would bury the broken references, which are the ones that actually break things.

6. **Do NOT report what is intentional** — An empty Design System is the designed initial state, not a
   finding. A `research-context` in `hipótesis-preliminar` is correct. A screen with a single viewport
   on a `mobile-app` surface is complete. Reporting these trains the user to ignore the report.

7. **Cite evidence** — Every finding names the file, and the line or section when it helps. A finding
   the user cannot verify in ten seconds is not actionable.

8. **ABORT if `ux_folder` does not exist** — Nothing to audit. Point at `/product-ux-generate`.

## Execution

### Step 0: Validate & Take Inventory

**0.1 Load Context**

1. Read [Files index](.claude/utils/index.md) to get all locations
2. Identify: **ux_folder**, **ux_audiences_folder**, **ux_surfaces_folder**, **ds_folder**,
   **prd_folder**, **architectures_folder**

**0.2 Validate**

```bash
ls docs/ux/product-overview.md 2>/dev/null
```

**If missing, ABORT:**

```markdown
No hay documentación UX que auditar en `docs/ux/`.

**Ejecutá** `/product-ux-generate` para generarla.
```

**0.3 Parse `$ARGUMENTS` — optional surface scope**

Comma-separated surface names limit the audit. No argument = every surface. Scoping is useful on large
products; the shared documents (`product-overview.md`, `cross-surface-flows.md`) are read either way,
since the cross-references live there.

**0.4 Take inventory (cheap, no full reads yet)**

```bash
ls -d docs/ux/surfaces/*/ 2>/dev/null | xargs -n1 basename
ls -d docs/ux/audiences/*/ 2>/dev/null | xargs -n1 basename
ls -d docs/design-system/*/ 2>/dev/null | xargs -n1 basename
ls docs/ux/surfaces/*/screens/*.md 2>/dev/null
ls docs/architectures/*/manifest.yaml 2>/dev/null
```

---

### Step 1: Load the Documents

Read, for the surfaces in scope:

1. **ux_folder**/`product-overview.md` — surfaces with their platform, viewports and accent; audiences;
   the matrix
2. Each surface's `product-map.md` (screen and overlay inventories, navigation) and `user-flows.md`
3. Each surface's `screens/*.md` — frontmatter, Estructura, Layout por viewport, Contenido, Estados,
   Entrada/salida
4. Each audience's `research-context.md` (frontmatter and section headings suffice for most checks)
5. **ds_folder**/`{surface}`/`foundations/color.md` and `foundations/grid.md`, plus the file listing of
   `components/`
6. **ux_folder**/`cross-surface-flows.md`
7. **prd_folder**/`requirements.md` — only if the methodology checks (Step 6) will run traceability
8. The `manifest.yaml` of the service serving each surface, when it exists

---

### Step 2: Structural Checks

Broken references. Deterministic: either the target exists or it does not.

| # | Check | Severity |
|---|---|---|
| E1 | A surface declared in `product-overview.md` has no folder under **ux_surfaces_folder** | Rota |
| E2 | A folder under **ux_surfaces_folder** is not declared in `product-overview.md` | Rota |
| E3 | A surface has no folder under **ds_folder** | Silenciosa |
| E4 | An audience in the matrix has no `research-context.md` | Rota |
| E5 | An audience folder is not in the matrix | Deuda |
| E6 | A screen in the product-map's "Inventario de Pantallas" has no `screens/{name}.md` | Rota |
| E7 | A `screens/{name}.md` is not in the product-map's inventory (orphan file) | Rota |
| E8 | An overlay in "Inventario de Overlays" has no `screens/{name}.md` | Rota |
| E9 | A screen's Entrada/Salida or a user-flow names a screen that does not exist | Rota |
| E10 | A "Layout por viewport" references a block absent from the Estructura table | Rota |
| E11 | A screen names an audience that does not exist | Rota |

For **E7**, state both readings in the finding — the file may need to be added to the inventory, or the
file may be dead. The skill does not decide which.

---

### Step 3: Viewport and Platform Checks

These matter most because **the failure is silent**: nothing errors, the output is just wrong.

| # | Check | Severity |
|---|---|---|
| V1 | A screen declares a viewport outside its surface's set | Rota |
| V2 | **A screen is missing a "Layout por viewport" subsection for a viewport it declares** | Silenciosa |
| V3 | A surface's viewports do not belong to its platform (`mobile-app` with `desktop`) | Rota |
| V4 | The surface's platform contradicts the `language` of its service's `manifest.yaml` (`flutter` → `mobile-app`, `nextjs` → `web`) | Silenciosa |
| V5 | The surface's `foundations/grid.md` variant does not match its platform (a px breakpoint table on a `mobile-app`, or the native variant on a `web`) | Silenciosa |
| V6 | A screen still declares `device:` in its frontmatter (deprecated alias) | Deuda |

**V2 is the highest-value check in this skill.** A missing layout subsection does not fail: the renderer
falls back to the flat block stack, which on a desktop frame produces a 1160px-wide single column — the
"stretched mobile" outcome the whole viewport model exists to prevent. Nobody finds this except by
looking at the wireframe.

---

### Step 4: Design System Wiring Checks

| # | Check | Severity |
|---|---|---|
| D1 | A `screen.md` still carries `accent_color` in its frontmatter (surface-level property, deprecated there) | Deuda |
| D2 | The surface's `Accent:` in `product-overview.md` differs from `color.brand.primary` in its `foundations/color.md` | Silenciosa |
| D3 | Block types in use across the surface's screens with no matching component in its `components/` catalog | Deuda |

For **D2**, state that the design system wins and that `product-overview.md` is the stale one — that is
the declared precedence.

For **D3**, apply the canonical matching rule from
[`/product-ux-wireframes`](.claude/skills/product-ux-wireframes/SKILL.md) → "Block type → DS component".
Do not restate it. Report it as a **coverage figure per surface** ("14 de 19 tipos cubiertos") plus the
list of uncovered ones — not one finding per block type, which would flood the report. An empty catalog
is the designed initial state: report the coverage, do not call it a defect (Rule 6).

---

### Step 5: Freshness Check

| # | Check | Severity |
|---|---|---|
| F1 | A surface's `screens.json` is older than any of its `screens/*.md` | Silenciosa |
| F2 | A surface has screens but no `screens.json` or no `wireframes.html` | Rota |
| F3 | A surface's `wireframes.html` is older than its `screens.json` | Silenciosa |
| F4 | A `screens.json` has no `_generated` marker as its first key | Deuda |

```bash
for s in {{surfaces en alcance}}; do
  find docs/ux/surfaces/$s/screens -name '*.md' -newer docs/ux/surfaces/$s/screens.json 2>/dev/null
  [ docs/ux/surfaces/$s/screens.json -nt docs/ux/surfaces/$s/wireframes.html ] && echo "$s: render viejo"
done
```

The chain is `screens/*.md` → `screens.json` → `wireframes.html`, and each link can rot on its own.
F1 means someone edited a spec and never re-derived the JSON; F3 means the JSON was updated but never
rendered. Either way the wireframe someone is looking at is not what the spec says. Cheapest check
here and the easiest to let rot.

**F3 is fixable without an agent** — re-running the renderer is enough:
```bash
python3 .claude/skills/product-ux-wireframes/scripts/build_book.py \
  docs/ux/surfaces/$s/screens.json docs/ux/surfaces/$s/wireframes.html \
  .claude/skills/product-ux-wireframes/scripts/assets/Excalifont-Regular.woff2
```
F1 is not: deriving `screens.json` from the specs is interpretation, so it needs
`/product-ux-wireframes {surface}`.

**F4** means the file was either hand-edited or written before the marker existed. It is Deuda and
not Rota because the render works either way — but a `screens.json` without the marker is one nobody
was warned about, and hand edits there are silently overwritten on the next run. Check whether the
edit carries content the specs do not have before regenerating:
```bash
head -2 docs/ux/surfaces/$s/screens.json | grep -q _generated || echo "$s: sin marcador"
```

---

### Step 6: Methodology Checks

The agent reads content and forms an opinion. These go in their own section of the report, always
after the mechanical ones.

| # | Check | Severity |
|---|---|---|
| M1 | Microcopy containing "Pendiente" or an obvious placeholder in a screen's Contenido | Deuda |
| M2 | A block whose type is outside the 36-type dictionary | Deuda |
| M3 | A screen without "Decisiones y descartes", or with it empty. **Excluded:** screens with `status: as-is-sin-validar`, where the single origin entry is correct by design | Deuda |
| M4 | A `research-context.md` without "Lo que NO sabemos" | Deuda |
| M5 | A screen in the inventory with no PRD reference and not marked "sugerencia fuera de PRD" | Deuda |
| M6 | A capability (C-XX) in `requirements.md` that no screen covers | Deuda |
| M7 | Emotional vocabulary banned by Rule 6 in a research-context ("frustrado", "abrumado", "en control"…) | Deuda |
| M8 | A surface with fewer than 3 or more than 5 critical flows | Deuda |
| M9 | A screen still carrying the old `fidelity` map (`visuals`/`content`/`interactivity`) instead of the scalar `fidelity: mid`, or a leftover `## Specs visuales` section | Deuda |
| M10 | A screen's Accesibilidad restating what a component spec owns (the contrast of a button, the ARIA of an icon) instead of composition-level concerns | Deuda |
| M11 | A screen with far more blocks than the granularity rule implies (roughly over 15), or whose Estructura lists parts of one component as separate blocks — title, id and pills of the same header | Deuda |

For **M11**, the block count alone is not the finding: a genuinely rich screen can be long. Report it
when the rows read as **atoms of one component** rather than as parts of the screen. It matters because
the wireframe renders one box per block: a screen decomposed into atoms draws the component tree
instead of the page, and its frame grows to several times the nominal height. Typical in screens
transcribed from a brownfield survey.

For **M10**, only report it when the screen text clearly duplicates a component's own spec. Accessibility
notes that are genuinely about the composition — focus order across blocks, landmarks, a focus trap an
overlay introduces — are correct and are not a finding.

For **M6**, be conservative: a capability may legitimately have no screen (backend, batch, an
integration). Report it as *worth confirming*, never as an error.

---

### Step 7: Report

Order by severity, mechanical findings first. Use this structure:

```markdown
# Auditoría UX

**Alcance:** {{N}} superficies ({{lista}}) · {{M}} audiencias · {{K}} pantallas
{{Si hubo alcance por argumento:}} *Acotado a `{{lista}}`. Los documentos compartidos se leyeron igual.*

## Resumen

| Severidad | Qué significa | Hallazgos |
|---|---|---|
| **Rota** | Una referencia no resuelve. Algún skill aguas abajo va a fallar o avisar | {{N}} |
| **Silenciosa** | Nada falla, pero el output es incorrecto. Solo se descubre mirando | {{N}} |
| **Deuda** | Calidad o completitud. Nada roto hoy | {{N}} |

{{Si no hay hallazgos de ninguna severidad:}}
**Sin inconsistencias.** El set UX es coherente: las referencias resuelven, cada pantalla tiene layout
para cada viewport de su superficie, el accent coincide con el design system y los wireframes están al día.

## Rotas

| Dónde | Qué | Cómo se arregla |
|---|---|---|
| `{{archivo}}` | {{qué falta o no resuelve, con la evidencia}} | `-> /{{skill}}` |

## Silenciosas

| Dónde | Qué | Por qué importa | Cómo se arregla |
|---|---|---|---|
| `{{archivo}}` | {{qué}} | {{qué output incorrecto produce}} | `-> /{{skill}}` |

## Deuda

| Dónde | Qué | Cómo se arregla |
|---|---|---|

## Cobertura del Design System

| Superficie | Tipos de bloque en uso | Con componente | Sin componente |
|---|---|---|---|
| {{surface}} | {{19}} | {{14}} | {{list}} |

## Metodología

> Estos hallazgos son de criterio, no de referencia: revisalos, no todos ameritan acción.

| Dónde | Qué | Cómo se arregla |
|---|---|---|

## Siguiente paso

{{La acción que resuelve más hallazgos de una, o la de mayor severidad.}}
```

**If there are no findings at all**, present only the header, the summary with the "sin
inconsistencias" line, and the Design System coverage table — a clean report should be short.

## Output

Text output only. No files created or modified.

The report contains:
- Scope audited (surfaces, audiences, screens)
- Findings grouped by severity — Rota, Silenciosa, Deuda — each with its file, its evidence and the
  command that fixes it
- Design System coverage per surface
- Methodology findings in their own section, marked as judgement-based
- A suggested next step
