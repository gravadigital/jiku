---
name: product-create-frontend-architecture
description: Create architecture manifest for a frontend service - declares language, type, conventions and modules
argument-hint: "[service-name]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, WebFetch, WebSearch"
---

# Create Frontend Architecture

## Purpose

Create the architecture documents for a frontend service. The service declares its language (e.g., `nextjs`), type (`frontend`), and which **conventions** it follows. Conventions live in `.claude/conventions/` (catalog, shared by all services) or in `docs/architectures/{service}/conventions/` (custom, this service only). Catalog conventions are atomic (id determines package). When a service needs something the catalog does not cover, this skill **assists the user in creating a custom convention** during the flow.

**Flow:**
```
Step 0: Validate input (service-name required)
Step 1: Load context (Files index, PRD, conventions catalog)
Step 2: Validate service scope from PRD
        --- GATE A: user confirms scope ---
Step 3: Pick language (service type is always "frontend")
        --- GATE B: user picks language ---
Step 4.1-4.2: Compute and present suggested catalog set
        --- GATE C: user accepts or adjusts the suggested set ---
Step 4.3 (per custom): Assisted custom creation
        --- GATE D (per custom): user confirms approach before file is written ---
Step 4.5: Show final active set (catalog + customs)
        --- GATE E: user confirms final set ---
Step 5: Capture service-specific details (purpose, modules)
Step 6: Generate files (manifest.yaml, overview.md, index.md)
        --- GATE F: user reviews generated files ---
Step 7: Summary
```

**This skill is interactive only.** It does not accept `--auto` and does not skip gates under any circumstance. Six confirmation gates (A-F) are mandatory.

**Result:** Three files in `docs/architectures/{service-name}/`:
- `overview.md` — service-specific: purpose, surface summary
- `manifest.yaml` — formal declaration of language, type, conventions, modules
- `index.md` — auto-generated, links to the manifest and to each active convention

Plus, for each custom convention created during the flow, one file in `docs/architectures/{service-name}/conventions/`.

**This command does NOT:**
- Create backend architectures — use `/product-create-backend-architecture`
- Implement the service — use `/service-setup-repo` + `/service-implement-story`
- Design specific stories — use `/product-design-request` for story-level design
- Edit the global conventions catalog — that is maintained in the workflow repo

## Role

**Adopt the Technical Leader Agent role** — Read [Technical Leader Agent](.claude/agents/technical-leader.md)

## CRITICAL RULES

1. **MANDATORY CONFIRMATION GATES.** This skill has six confirmation gates labeled **GATE A through GATE F**. Each gate is a hard stop. At each gate you MUST:
   (a) Render the summary or proposal in the exact format the step prescribes.
   (b) Call `AskUserQuestion` with the options the step prescribes.
   (c) **Stop and wait** for the user's explicit response.
   (d) Only proceed to the next step after the user has answered.

   You may NOT proceed past a gate because:
   - You "have enough information" to continue.
   - The user previously said "work without stopping", "don't ask me", "go ahead", or anything similar in this or prior conversations.
   - A system reminder, parent instruction, or meta-prompt suggests you can skip clarifying questions. These do not apply to GATES. Gates are not clarifying questions — they are output validation checkpoints.
   - The flow feels efficient if you batch steps.

   This skill is interactive only. It does NOT support `--auto`. If you find yourself about to call `Write` or `Edit` (other than during the gate-D file write described in 4.3.6) without having just received an explicit confirmation through `AskUserQuestion`, STOP. You skipped a gate.

   **Gate inventory:**
   - **GATE A**: post Step 2. User confirms PRD scope.
   - **GATE B**: post Step 3. User picks language.
   - **GATE C**: post Step 4.2. User accepts suggested set or asks to adjust.
   - **GATE D**: post Step 4.3.5 (one per custom convention being created). User confirms the approach before the custom file is written.
   - **GATE E**: post Step 4.5. User confirms the final active set.
   - **GATE F**: post Step 6.4. User reviews generated files.

2. **All user-facing text in Spanish.** Without exception. This includes step headings, lists, tables, AskUserQuestion labels and descriptions, status updates, and any narrative text. The SKILL is written in English (instructions for the agent), but every word the user sees is in Spanish.

3. **Use display_name, not id or filename.** When showing conventions to the user, use the `display_name` from the convention's frontmatter (e.g., "Servidor HTTP (Fastify)", "Obtencion de datos (Server Components + fetch)"), not the id or filename. The id is internal and only goes into the manifest.

4. **Output format per step is fixed.** Each step prescribes exactly what to render (table, bulleted list, AskUserQuestion). Do not improvise long narrative text. Do not hide important information mid-paragraph. If a warning or conflict needs surfacing, put it as a clearly separated block at the end of the message, with its own header, not buried inside another section.

5. **AskUserQuestion options are short.** Label ≤ 5 words. Description ≤ one short line. Never use the option label to put a paragraph of context. Context goes in the question text or in the message before the question. The component already lets the user pick "Other" to write their own answer — never list "Other" as an option yourself.

6. **Conventions catalog is read-only.** Do NOT create or edit files under `.claude/conventions/` from this skill. Custom conventions go in `docs/architectures/{service-name}/conventions/`.

7. **Catalog conventions are atomic.** A catalog convention is its package + its rules together. There are no variants, parameters, or framework options to choose within a catalog convention. If the user wants a different package, the right answer is to **create a custom convention** for this service (assisted in Step 4.3).

8. **Reference locations from Files index.** Do not hardcode paths.

9. **Save first, then validate.** Save documents, notify user, wait for confirmation.

10. **Do NOT dump full content in chat.** Save to file, show summary, let user review.

11. **Auto-include resolution.** When listing active conventions, apply transitive closure on `required_by`. Auto-included conventions are shown for transparency but not asked.

12. **Custom conventions follow the Convention Template.** Read [Convention Template](.claude/templates/convention-tmpl.yaml) before generating any custom convention. The frontmatter format, mandatory body sections, and quality checklist are not optional. When the custom replaces a catalog convention (same id), also read the catalog file and preserve the same H2 sections, the same Rules intent (renumber/adapt wording for the new package, but do not silently drop rules), and the same integration points. Adapt code examples and configuration to the user's package; do not adapt the contract.

## Execution

### Step 0: Validate Input

Parse `$ARGUMENTS` as the service name.

If no service name provided:

```markdown
Necesito el nombre del servicio frontend.

**Uso:** `/product-create-frontend-architecture {nombre-servicio}`

**Ejemplos:**
- `/product-create-frontend-architecture web-app`
- `/product-create-frontend-architecture admin-portal`
- `/product-create-frontend-architecture customer-dashboard`
```

**ABORT.**

### Step 1: Load Context

1. Read [Files index](.claude/utils/index.md) to get **architectures_folder**, **prd_folder**, and the conventions catalog location.
2. Read `.claude/local-config.yaml` if present.
3. Read PRD files (whichever exist):
   - `docs/prd/goals-and-context.md`
   - `docs/prd/requirements.md`
   - `docs/prd/feature-groups.md`
   - `docs/prd/architecture.md`
4. Read UX context if present (helps inform suggested conventions):
   - `docs/ux/product-overview.md`
   - `docs/ux/surfaces/{surface}/product-map.md` for the surface this service serves
5. Read `.claude/conventions/index.md` and the frontmatter of every convention file under `.claude/conventions/{language}/` for each frontend-capable language. Keep id, display_name, description, applies_to, required_by, package in memory.

Do NOT confront the PRD against the catalog in this step. That happens later (Step 4).

### Step 2: Validate Service Scope from PRD

Goal: confirm what the PRD says about this specific frontend service. Do not show conflicts with the catalog yet.

From the PRD architecture, UX docs, and requirements, extract what is mentioned about `{service-name}` (if anything): purpose, surface served, technologies, integrations with backend services.

Render a short list (not narrative):

```markdown
## {service-name}

Esto es lo que dice el PRD sobre este servicio:

- **Proposito:** {one short line, or "No especificado en el PRD"}
- **Superficie / audiencia:** {which UX surface and audience this app serves, or "No especificada"}
- **Tecnologias mencionadas:** {comma-separated list, or "No especificadas"}
- **Integraciones con backend:** {API services it consumes, or "Ninguna"}

Confirmas que esto refleja lo que queres construir?
```

**=== GATE A — Confirm PRD scope ===**

Ask with `AskUserQuestion`:
- Question: "Es correcto el alcance del servicio?"
- Options:
  - `Confirmar` / "Sigue el flujo con esta informacion"
  - `Ajustar` / "Necesito corregir o agregar algo"

**STOP and wait for the user's response. Do NOT proceed to Step 3 until the user answers.**

If `Ajustar`: ask free-text what to correct. Update the in-memory summary, re-render the list, and re-open GATE A. Loop until the user picks `Confirmar`.

**Do NOT** mention catalog conventions, packages, or conflicts at this step. The goal is only to confirm the PRD scope.

### Step 3: Pick Language

For frontend, the service type is always `frontend`. The user only picks the language.

**=== GATE B — Language ===**

Render one `AskUserQuestion`:

**Question — "En que lenguaje / framework?"**
Options: one per language folder under `.claude/conventions/` that has `applies_to` including `frontend` in at least one of its conventions. Label = language/framework name capitalized. Description = first sentence of that language's `_base.md` intro.

For the current catalog, this means at minimum:
- `Next.js` / "App Router, React Server Components, TypeScript estricto"

Suggest the default if the PRD mentioned a specific framework, but always ask.

**STOP and wait for the user's response. Do NOT proceed to Step 4 until the user has answered.**

Store as `language`. (`service_type` is fixed as `frontend`.)

### Step 4: Pick Conventions

**4.1 Compute suggested catalog set**

From `.claude/conventions/{language}/`:
- Always active (implicit): `_base`
- Filter remaining conventions by `applies_to` containing `frontend`
- Exclude conventions that exist primarily as auto-includes (those whose `required_by` is populated and are not typically picked directly). For the current Next.js catalog, this means: suggest `data-fetching`, `mutations`, `forms`, `styling` for most apps. `error-handling` auto-includes via `required_by` from those three.

**4.2 Present the suggested set**

Render this exact format:

```markdown
## Convenciones sugeridas

Para un servicio **frontend** en **{language}**, te sugiero estas convenciones del catalogo:

| Convencion | Descripcion |
|---|---|
| {display_name} | {description} |
| ... | ... |

> Convenciones generales se incluyen siempre. Otras pueden auto-incluirse segun lo que elijas.
```

**=== GATE C — Accept or adjust suggested set ===**

Ask with `AskUserQuestion`:
- Question: "Aceptas el set sugerido?"
- Options:
  - `Aceptar` / "Uso el set sugerido tal cual"
  - `Ajustar` / "Quiero agregar, quitar o reemplazar algo"

**STOP and wait for the user's response. Do NOT proceed to Step 4.3 or Step 4.5 until the user answers.**

If `Aceptar`: jump to 4.5.

If `Ajustar`: ask in free-text what changes the user wants. Possible cases:

- **Remove a catalog convention**: drop from the set. If it is required_by another active one, warn that the dependent will no longer auto-include but allow it.
- **Add another catalog convention**: add it.
- **Replace a catalog convention with a different package** (e.g., "quiero CSS Modules en vez de Tailwind", "quiero Redux en vez de Zustand"): open the **assisted custom creation sub-flow (4.3)** for that concern. The catalog convention is removed from the set; the custom replaces it with the same id.
- **Add a new concern not in the catalog** (e.g., "necesito una convencion para autenticacion con Clerk", "necesito convenciones de i18n"): open the **assisted custom creation sub-flow (4.3)** with a new id.

**4.3 Assisted custom convention sub-flow**

This sub-flow creates one custom convention file in `docs/architectures/{service-name}/conventions/{id}.md`.

**4.3.1 Identify the convention id**

- If replacing a catalog one: keep the same id (e.g., `styling`).
- If new concern: ask the user for a short id in kebab-case.

**4.3.2 Ask the user about the package and requirements**

Render:

```markdown
## Definicion de convencion custom: **{convention-display}**

Para armar esta convencion, necesito que me digas:

1. **Que paquete o framework queres usar?** (ej. CSS Modules, Redux, Clerk, etc.)
2. **Hay algo en particular que quieras tener en cuenta?** (ej. integracion con un servicio especifico, restriccion de version, preferencia de patron)

Podes responder en una sola pasada.
```

Wait for free-text response. Store as `package_name` and `user_requirements`.

**4.3.3 Load template and (if applicable) catalog reference**

Read [Convention Template](.claude/templates/convention-tmpl.yaml). Keep the section list, frontmatter spec, and quality checklist in memory — these constrain what the custom convention must contain.

Determine the case:

- **Case A — Replacement** (the chosen id matches an existing file under `.claude/conventions/{language}/`). Read that catalog file completely. The custom must preserve the same H2 section list (in the same order) and the same number/intent of Rules. Code and configuration are adapted to the new package; the contract is not.
- **Case B — New concern** (the id does not exist in the catalog). The template alone is the structural guide. Decide which optional sections apply (Structure, Integration, domain-specific) based on the concern.

**4.3.4 Notify and fetch documentation**

Render:

```markdown
Voy a leer la documentacion oficial de **{package_name}** para alinear las reglas con las mejores practicas. Esto puede tardar unos segundos.
```

Then:
- Use `WebSearch` to locate the official documentation URL.
- Use `WebFetch` on the most relevant pages (getting started, best practices, integration patterns).
- Read at most 2-3 pages — enough to understand the recommended setup, common patterns, and gotchas.
- If the search/fetch fails or returns nothing useful: tell the user "No pude obtener documentacion oficial, voy a basarme en buenas practicas generales" and continue.

**4.3.5 Propose the convention to the user**

Synthesize what the convention will contain, in plain prose (NO markdown code blocks wrapping prose, NO long paragraphs).

For **Case A (replacement)**:

```markdown
## Propuesta para **{convention-display}**

**Paquete:** {package_name}

Voy a generar la convencion siguiendo la misma estructura que la del catalogo ({catalog-display}). Adapto la configuracion y los ejemplos de codigo al paquete elegido, pero mantengo las secciones y las reglas (contrato).

**Secciones (en este orden):**
{render the H2 section list of the catalog file, one per line, with the same headings}

**Reglas:**
{render each rule from the catalog file, renumbered if needed, with a short note when the wording was adapted for the new package}

Si alguna regla del catalogo no aplica al nuevo paquete, la marco como N/A explicando por que.

Confirmas el enfoque?
```

For **Case B (new concern)**:

```markdown
## Propuesta para **{convention-display}**

**Paquete:** {package_name}

**Secciones (en este orden):**
- # {Title H1}
- (intro paragraph sin heading)
- ## When to use
- ## Package
- ## Configuration (o Base configuration)
- ## How to use
{add optional sections as needed: ## Structure, ## Integration with other conventions, or domain-specific ## headings}
- ## Rules

**Reglas que voy a definir:**
1. {rule one — concrete, one line}
2. {rule two}
...

Confirmas el enfoque?
```

**=== GATE D — Confirm approach for THIS custom convention ===**

Ask with `AskUserQuestion`:
- Question: "Te parece bien?"
- Options:
  - `Confirmar y generar` / "Genera el archivo"
  - `Ajustar` / "Quiero corregir algo"

**STOP and wait for the user's response. Do NOT call `Write` to create the convention file (Step 4.3.6) until the user picks `Confirmar y generar`.**

If `Ajustar`: ask in free-text what to change. Update the in-memory proposal and re-render 4.3.5, then re-open GATE D. Loop until confirmed.

This gate fires **once per custom convention** being created.

**4.3.6 Generate the custom convention file**

Write `docs/architectures/{service-name}/conventions/{id}.md` following the [Convention Template](.claude/templates/convention-tmpl.yaml):

- **Frontmatter**: all mandatory fields with valid values (`id`, `display_name`, `language`, `description`, `applies_to`, `required_by`, `package`).
- **Body**: every mandatory section from the template, plus any optional section decided in 4.3.3.
- **Case A (replacement)**: section list mirrors the catalog file 1-to-1. Rules count and intent preserved. Code blocks adapted to the new package.
- **Case B (new concern)**: section list follows the proposal from 4.3.5.
- Content in English (matches the catalog). The `display_name` is in Spanish.
- Apply the quality checklist from the template before saving.

Confirm to the user:

```markdown
Convencion custom **{convention-display}** generada en `docs/architectures/{service-name}/conventions/{id}.md`.
```

Add the convention to the active set (with origin "custom").

**4.4 Back to selection**

Re-render the active set (catalog + customs created so far) and ask again if the user wants more changes. Loop 4.2 until the user accepts the final set.

**4.5 Apply auto-includes**

Compute the transitive closure on `required_by` over the final set (catalog and custom participate equally). Show the final list:

```markdown
## Convenciones activas finales

| Convencion | Origen | Notas |
|---|---|---|
| Convenciones generales | catalogo | siempre |
| {display_name} | catalogo | elegida |
| {display_name} | custom | creada en este flujo |
| {display_name} | catalogo | auto-incluida por {other} |
| ... | ... | ... |

Total: {N} convenciones activas.
```

**=== GATE E — Confirm final active set ===**

Ask with `AskUserQuestion`:
- Question: "Confirmas el set final?"
- Options:
  - `Confirmar` / "Sigo con el resto del flujo"
  - `Volver a ajustar` / "Quiero seguir cambiando"

**STOP and wait for the user's response. Do NOT proceed to Step 5 until the user picks `Confirmar`.**

If `Volver a ajustar`: go back to Step 4.2 (re-opens GATE C).

### Step 5: Capture Service-Specific Details

Render:

```markdown
## Detalles del servicio

Necesito un par de cosas especificas:

1. **Proposito** — Una linea explicando para que existe este servicio.
2. **Modulos / superficies principales** — Lista separada por comas. Para frontend tipicamente son rutas o secciones de la app. Ejemplos: marketing, dashboard, settings, auth.
3. **Algo mas que quieras dejar anotado?** (deployment, integraciones externas, restricciones, design system). Si no, escribi "no".

Podes responder todo de una vez.
```

Wait for free-text. Parse into `purpose`, `modules` (kebab-case), `additional_notes`.

### Step 6: Generate Files

**6.1 `manifest.yaml`** — at `docs/architectures/{service-name}/manifest.yaml`:

```yaml
service: {service-name}
type: frontend
language: {language}

conventions:
  - {id of each user-selected convention, both catalog and custom}
  # auto-included conventions are NOT written here

modules:
  - {module-id}
```

**6.2 `overview.md`** — at `docs/architectures/{service-name}/overview.md`, in Spanish:

```markdown
# {service-name} — Overview

## Proposito
{purpose}

## Tipo de servicio
Frontend en {language}

## Modulos / superficies
- **{module-id}**
- ...

## Notas adicionales
{additional_notes or "Sin notas adicionales por el momento."}

---

**Manifest:** [manifest.yaml](./manifest.yaml)
**Indice de arquitectura:** [index.md](./index.md)
```

**6.3 `index.md`** — auto-generated, in Spanish:

```markdown
# {service-name} — Arquitectura

> Auto-generado desde [manifest.yaml](./manifest.yaml). No editar a mano.

**Tipo:** frontend | **Lenguaje:** {language}

## Especifico del servicio
- [Overview](./overview.md)
- [Manifest](./manifest.yaml)

## Convenciones activas

- **[{display_name}]({resolved-relative-path})** — {description} {tag}
- ...

> Donde `{tag}` es " (auto-incluida)" si vino por `required_by`, " (custom)" si esta en el path del servicio, y vacio si es del catalogo elegida explicitamente.

---

**Total:** {N} convenciones activas.
```

For each active convention, the resolved-relative-path is:
- Catalog: `.claude/conventions/{language}/{id}.md`
- Custom: `./conventions/{id}.md`

**6.4 Notify user**

```markdown
Arquitectura de **{service-name}** creada.

**Archivos:**
- `docs/architectures/{service-name}/manifest.yaml`
- `docs/architectures/{service-name}/overview.md`
- `docs/architectures/{service-name}/index.md`
{if any customs were created}
- Convenciones custom:
  - `docs/architectures/{service-name}/conventions/{id}.md`
  - ...

**Convenciones activas:** {N}

Revisa los archivos y decime si esta correcto o queres cambios.
```

**=== GATE F — Review generated files ===**

Ask with `AskUserQuestion`:
- Question: "Esta todo correcto?"
- Options:
  - `Aprobar` / "Los archivos estan bien, pasa al resumen"
  - `Pedir cambios` / "Quiero corregir algo"

**STOP and wait for the user's response. Do NOT proceed to Step 7 until the user picks `Aprobar`.**

If `Pedir cambios`: ask free-text what to change. Apply changes:
- Manifest changes (add/remove conventions, modules): edit and regenerate `index.md`.
- Overview changes: edit `overview.md` only.
- Custom convention changes: edit the corresponding file.

Then re-open GATE F. Loop until approved.

### Step 7: Summary

```markdown
## Arquitectura de {service-name} completada

**Tipo:** frontend | **Lenguaje:** {language}

**Convenciones elegidas explicitamente:**
- {display_name}{ " (custom)" if custom}
- ...

**Convenciones auto-incluidas:**
- {display_name}
- ...

**Modulos / superficies:** {comma-separated}

---

**Siguientes pasos:**
1. Revisa `overview.md`.
2. Si el servicio esta en otro repo: ejecuta `/service-setup-repo` ahi.
3. Empeza a planificar stories con `/service-planify-story S-XXX`.

Necesitas crear arquitectura para otro servicio?
```

## Output

Files saved to `docs/architectures/{service-name}/`:

- `manifest.yaml` — formal declaration (English keys, ids)
- `overview.md` — service-specific content (Spanish)
- `index.md` — auto-generated index with links to active conventions (Spanish)
- `conventions/{id}.md` (zero or more) — custom conventions created during the flow (English, same format as catalog)
