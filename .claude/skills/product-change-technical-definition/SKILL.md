---
name: product-change-technical-definition
description: Modify existing technical definitions - conventions, manifest, ADRs, APIs, schemas - with impact analysis and changelog
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, WebFetch, WebSearch"
---

# Change Technical Definition

## Purpose

Modify existing technical definitions of a service. Covers two complementary layers:

1. **Convention layer** — add/remove catalog conventions, create custom conventions, or edit existing custom conventions in `docs/architectures/{service}/conventions/`.
2. **Architecture document layer** — update ADRs, API definitions, database schemas, or the service overview.

**Flow:**
```
Step 0: Load context (Files index, PRD, service architecture)
Step 1: Classify requested change
        --- GATE A: user confirms scope of change ---
Step 2 (if convention change): Convention management
        --- GATE B (per custom): user confirms approach before file is written ---
        --- GATE C: user confirms updated manifest ---
Step 3 (if architecture change): Architecture document changes
        --- GATE D: user reviews updated documents ---
Step 4: Register changes (changelog)
        --- GATE E: user reviews changelog entry ---
Step 5: Summary
```

**This skill is interactive only.** It does not accept `--auto` and does not skip gates under any circumstance.

**Result:**
- Updated `manifest.yaml` (when conventions changed)
- Updated or new `docs/architectures/{service}/conventions/{id}.md` (custom conventions)
- Updated `index.md` regenerated from manifest (when manifest changed)
- Updated ADRs, API specs, schemas, overview (as applicable)
- Changelog entry in **changelog_folder**

**This command does NOT:**
- Create a new service architecture from scratch — use `/product-create-backend-architecture` or `/product-create-frontend-architecture`
- Implement code — use `/service-implement-story`
- Plan stories — use `/service-planify-story`
- Edit the global conventions catalog (`.claude/conventions/`) — that is maintained in the workflow repo

## Role

**Adopt the Technical Leader Agent role** — Read [Technical Leader Agent](.claude/agents/technical-leader.md)

## CRITICAL RULES

1. **MANDATORY CONFIRMATION GATES.** This skill has five confirmation gates labeled **GATE A through GATE E**. Each gate is a hard stop. At each gate you MUST:
   (a) Render the summary or proposal in the exact format the step prescribes.
   (b) Call `AskUserQuestion` with the options the step prescribes.
   (c) **Stop and wait** for the user's explicit response.
   (d) Only proceed to the next step after the user has answered.

   You may NOT proceed past a gate because you "have enough information". Gates are output validation checkpoints, not clarifying questions. This skill is interactive only.

   **Gate inventory:**
   - **GATE A**: post Step 1. User confirms scope and type of change.
   - **GATE B**: post Step 2.3 per custom convention. User confirms approach before any file is written.
   - **GATE C**: post Step 2.5. User confirms the updated manifest.
   - **GATE D**: post Step 3.3. User reviews updated architecture documents.
   - **GATE E**: post Step 4.2. User reviews changelog entry.

2. **All user-facing text in Spanish.** Without exception. The SKILL file is in English (for the agent), but every word the user sees is in Spanish.

3. **Use display_name, not id or filename.** When showing conventions to the user, use the `display_name` from the convention's frontmatter, not the id or filename. The id is internal and only goes into the manifest.

4. **Require manifest format.** Every service must have `docs/architectures/{service}/manifest.yaml`. If it does not exist, abort with:
   ```
   Este servicio no tiene manifest.yaml. Ejecutá /product-migrate-architecture para migrarlo al formato actual antes de hacer cambios técnicos.
   ```

5. **Conventions catalog is read-only.** Do NOT create or edit files under `.claude/conventions/`. Custom conventions go in `docs/architectures/{service}/conventions/`.

6. **Catalog conventions are atomic.** A catalog convention is its package + its rules. There are no variants or parameters. If the user wants a different package, the answer is to create a custom convention with the same id.

7. **Custom conventions follow the Convention Template.** Read [Convention Template](.claude/templates/convention-tmpl.yaml) before generating or editing any custom convention. The frontmatter format, mandatory body sections, and quality checklist are not optional.

8. **Custom conventions mirror the catalog structure (when replacing).** When a custom has the same id as a catalog convention (Case A — replacement), it must use the catalog file as the structural template: same H2 sections in the same order, same Rules count and intent. Code and configuration are adapted to the user's package; the contract is not.

9. **Reference locations from Files index.** Do not hardcode paths.

10. **Do NOT dump full content in chat.** Save to file, show summary, let user review directly.

11. **AskUserQuestion options are short.** Label ≤ 5 words. Description ≤ one short line.

---

## Execution

### Step 0: Load Context

**0.1 Read Files index and config**

1. Read [Files index](.claude/utils/index.md) → identify **architectures_folder**, **prd_folder**, **apis_folder**, **db_schemas_folder**, **adrs_folder**, **stories_folder**, **changelog_folder**, **conventions_catalog**.
2. Read `.claude/local-config.yaml` if present.

**0.2 Identify target service**

If `$ARGUMENTS` contains a service name, use it. Otherwise ask:

```markdown
¿Sobre qué servicio querés hacer cambios técnicos?

Indicá el nombre del servicio (ej. `user-service`, `api-gateway`).
```

Wait for response. Store as `service_name`.

**0.3 Verify manifest exists**

- If `docs/architectures/{service_name}/manifest.yaml` exists → read it.
- Else if `docs/architectures/{service_name}/` exists but has no `manifest.yaml` → inform the user and **ABORT**:
  ```
  Este servicio no tiene manifest.yaml. Ejecutá /product-migrate-architecture para migrarlo al formato actual antes de hacer cambios técnicos.
  ```
- Else → inform the user that this service has no architecture documentation yet and suggest running `/product-create-backend-architecture` or `/product-create-frontend-architecture`. **ABORT.**

**0.4 Load service context**

1. Read `manifest.yaml` → store `service_type`, `language`, current `conventions` list, `modules`.
2. Read `.claude/conventions/index.md` and the frontmatter of every convention file under `.claude/conventions/{language}/`.
3. Resolve the full active set (transitive closure on `required_by`): current manifest conventions + auto-included.
4. For each custom convention id in the manifest or in `docs/architectures/{service_name}/conventions/`, read its frontmatter too.

**0.5 Load PRD and other docs**

Read (skip if not present):
- PRD files from **prd_folder**
- All ADRs from **adrs_folder**
- Relevant API specs from **apis_folder**
- Relevant DB schemas from **db_schemas_folder**

**0.6 Inform user**

```markdown
Contexto cargado para **{service_name}**

**Tipo:** {service_type} | **Lenguaje:** {language}
**Convenciones activas:** {N} ({lista breve de display_names})

**Documentacion adicional:**
- ADRs: {count}
- APIs: {count}
- Schemas de BD: {count}
```

---

### Step 1: Classify Requested Change

**1.1 Ask the user to describe the change**

```markdown
Describí el cambio técnico que querés hacer.

**Puede ser:**
- Agregar o quitar una convención del manifest
- Reemplazar una convención del catálogo por una custom (otro paquete)
- Editar una convención custom existente
- Crear una nueva convención custom (preocupación no cubierta en el catálogo)
- Modificar un ADR existente o crear uno nuevo
- Cambiar una API, schema de BD, o el overview del servicio
- Una combinación de los anteriores

**Cuanto más detalle, mejor.** Incluí el "por qué" del cambio.
```

**WAIT** for user response. Store verbatim as `original_request`.

**1.2 Analyze and classify**

From the user's description, determine which of these change types apply (may be multiple):

- **convention-add**: add a catalog convention to the manifest
- **convention-remove**: remove a convention from the manifest
- **convention-replace**: replace a catalog convention with a custom one (same id, different package)
- **convention-new-custom**: create a custom convention for a concern not in the catalog
- **convention-edit-custom**: edit an existing custom convention in `docs/architectures/{service}/conventions/`
- **architecture-doc**: change ADRs, API specs, DB schemas, or overview

**1.3 Present analysis**

```markdown
## Análisis del cambio

{brief technical assessment: is the approach sound? any risks? any conflicts with existing ADRs or conventions?}

**Tipo(s) de cambio identificado(s):**
- {change-type-1} — {brief description}
- {change-type-2} — {brief description}

**Documentos afectados:**
- {path} — {why}
- ...

{if risks or concerns:}
⚠️ **A tener en cuenta:**
- {risk 1}
- {risk 2}
```

**=== GATE A — Confirm scope of change ===**

Ask with `AskUserQuestion`:
- Question: "¿Te parece correcto este análisis?"
- Options:
  - `Confirmar` / "Sigo con los cambios descritos"
  - `Ajustar` / "Quiero corregir o agregar algo"

**STOP and wait. Do NOT proceed to Step 2 or Step 3 until the user confirms.**

If `Ajustar`: ask free-text what to correct. Update the classification and re-render 1.3, then re-open GATE A.

---

### Step 2: Convention Management

**Run this step only for manifest-format services and when at least one `convention-*` change type was identified in Step 1.**

Skip this step when only architecture-doc changes were requested (no `convention-*` change type identified in Step 1).

**2.1 Determine convention operations**

From the confirmed change types, build the operation list:

| Operation | Action |
|-----------|--------|
| convention-add | Add convention id to manifest `conventions` list |
| convention-remove | Remove convention id from manifest `conventions` list (warn if depended on) |
| convention-replace | Remove catalog id from list; run assisted custom creation (→ 2.3) |
| convention-new-custom | Run assisted custom creation (→ 2.3) with new id |
| convention-edit-custom | Edit existing file (→ 2.4) |

Process all operations in order. If multiple custom creations are needed, run the sub-flow (2.3) once per custom.

**2.2 Simple operations (add / remove)**

For each add/remove operation:

- **Add**: check `applies_to` of the chosen convention against `service_type`. Warn if it doesn't match, but allow.
- **Remove**: if the removed convention appears in another active convention's `required_by`, warn that the dependent will no longer auto-include.
- Apply the change to the in-memory manifest (do not write yet).

**2.3 Assisted custom convention creation (per custom needed)**

This sub-flow creates or replaces one file in `docs/architectures/{service_name}/conventions/{id}.md`.

**2.3.1 Identify the convention id**

- If replacing a catalog convention: keep the same id.
- If new concern: ask the user for a short kebab-case id.

**2.3.2 Ask about package and requirements**

```markdown
## Definición de convención custom: **{convention-display}**

Para armar esta convención, necesito que me digas:

1. **¿Qué paquete o framework querés usar?** (ej. Express, Winston, Drizzle, etc.)
2. **¿Hay algo particular que quieras tener en cuenta?** (ej. integración con un servicio específico, restricción de versión, preferencia de patrón)

Podés responder en una sola pasada.
```

Wait. Store as `package_name` and `user_requirements`.

**2.3.3 Load template and catalog reference**

Read [Convention Template](.claude/templates/convention-tmpl.yaml). Keep section list, frontmatter spec, and quality checklist in memory.

Determine case:
- **Case A — Replacement**: the id matches an existing file under `.claude/conventions/{language}/`. Read that catalog file completely. The custom must preserve the same H2 section list (same order) and same number/intent of Rules.
- **Case B — New concern**: id does not exist in the catalog. Template alone is the structural guide.

**2.3.4 Notify and fetch documentation**

```markdown
Voy a leer la documentación oficial de **{package_name}** para alinear las reglas con las mejores prácticas. Esto puede tardar unos segundos.
```

Then:
- Use `WebSearch` to locate the official documentation URL.
- Use `WebFetch` on 2-3 relevant pages (getting started, best practices, integration patterns).
- If fetch fails: tell the user "No pude obtener documentación oficial, voy a basarme en buenas prácticas generales" and continue.

**2.3.5 Propose the convention**

For **Case A (replacement)**:

```markdown
## Propuesta para **{convention-display}**

**Paquete:** {package_name}

Voy a generar la convención siguiendo la misma estructura que la del catálogo ({catalog-display}). Adapto la configuración y los ejemplos de código al paquete elegido, pero mantengo las secciones y las reglas (contrato).

**Secciones (en este orden):**
{render the H2 section list from the catalog file, one per line}

**Reglas:**
{render each rule from the catalog file, with a short note when wording was adapted for the new package — "(adaptada: ahora menciona {package_name})"}

Si alguna regla del catálogo no aplica al nuevo paquete, la marco como N/A explicando por qué (sin removerla).

Confirmás el enfoque?
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
{add optional sections as needed: ## Structure, ## Integration with other conventions, or domain-specific headings}
- ## Rules

**Reglas que voy a definir:**
1. {rule one — concrete, one line}
2. {rule two}
...

Confirmás el enfoque?
```

**=== GATE B — Confirm approach for THIS custom convention ===**

Ask with `AskUserQuestion`:
- Question: "¿Te parece bien?"
- Options:
  - `Confirmar y generar` / "Genera el archivo"
  - `Ajustar` / "Quiero corregir algo"

**STOP and wait. Do NOT write the convention file until the user picks `Confirmar y generar`.**

If `Ajustar`: ask free-text. Update proposal, re-render 2.3.5, re-open GATE B. Loop until confirmed.

This gate fires **once per custom convention** being created.

**2.3.6 Generate the custom convention file**

Write `docs/architectures/{service_name}/conventions/{id}.md` following the [Convention Template](.claude/templates/convention-tmpl.yaml):

- Frontmatter: all mandatory fields.
- Body: every mandatory section, plus optional sections decided in 2.3.3.
- Case A: section list and rules mirror the catalog 1-to-1. Code blocks adapted to the new package.
- Case B: section list follows the proposal from 2.3.5.
- Content in English. `display_name` in Spanish.
- Apply quality checklist before saving.

Confirm:

```markdown
Convención custom **{convention-display}** generada en `docs/architectures/{service_name}/conventions/{id}.md`.
```

Add to the active set (origin: "custom"). If this is a replacement, remove the catalog id from the active set.

**2.4 Edit existing custom convention**

When `convention-edit-custom` was requested:

1. Read the existing file `docs/architectures/{service_name}/conventions/{id}.md`.
2. Identify what needs to change from the user's description.
3. Apply edits preserving the convention structure.
4. Confirm edit to the user (do not dump content).

**2.5 Show updated manifest and confirm**

After all convention operations are processed, re-compute the active set (transitive closure) and render:

```markdown
## Manifest actualizado — {service_name}

**Convenciones explícitas en manifest.yaml:**
| Convención | Origen | Cambio |
|---|---|---|
| {display_name} | catálogo | sin cambios |
| {display_name} | catálogo | → agregada |
| {display_name} | custom | → nueva |
| {display_name} | catálogo | → eliminada |

**Convenciones auto-incluidas:**
| Convención | Auto-incluida por |
|---|---|
| {display_name} | {trigger convention display_name} |

Total: {N} convenciones activas.
```

**=== GATE C — Confirm updated manifest ===**

Ask with `AskUserQuestion`:
- Question: "¿Confirmás el set final de convenciones?"
- Options:
  - `Confirmar` / "Actualizo el manifest y el index"
  - `Volver a ajustar` / "Quiero hacer más cambios"

**STOP and wait. Do NOT write manifest.yaml or index.md until the user picks `Confirmar`.**

If `Volver a ajustar`: go back to 2.1 for additional operations.

**2.6 Write manifest.yaml and regenerate index.md**

Update `docs/architectures/{service_name}/manifest.yaml` — keep the same structure, update only the `conventions` list:

```yaml
service: {service_name}
type: {service_type}
language: {language}

conventions:
  - {id of each explicitly chosen convention — catalog and custom}
  # auto-included conventions are NOT written here

modules:
  - {module-id}
```

Regenerate `docs/architectures/{service_name}/index.md`:

```markdown
# {service_name} — Arquitectura

> Auto-generado desde [manifest.yaml](./manifest.yaml). No editar a mano.

**Tipo:** {service_type} | **Lenguaje:** {language}

## Específico del servicio
- [Overview](./overview.md)
- [Manifest](./manifest.yaml)

## Convenciones activas

- **[{display_name}]({resolved-relative-path})** — {description} {tag}
- ...

> `{tag}` es " (auto-incluida)" si vino por `required_by`, " (custom)" si está en el path del servicio, vacío si es del catálogo.

---

**Total:** {N} convenciones activas.
```

For each active convention, the resolved-relative-path is:
- Catalog: `.claude/conventions/{language}/{id}.md`
- Custom: `./conventions/{id}.md`

---

### Step 3: Architecture Document Changes

**Run this step when at least one `architecture-doc` change type was identified.**

**3.1 Templates**

For each document type being modified, read the corresponding template from Files index:
- ADRs → **ADR Template**
- APIs → **API REST Interface Template**
- DB schemas → **Database Schema Template**
- Overview → no template, keep the same structure

**3.2 Apply changes**

For each affected document:

1. Read the current document.
2. Apply the approved changes from Step 1.
3. If a new ADR is needed: determine next ADR number, create file in **adrs_folder** following the ADR Template.
4. Update any pending stories in **stories_folder** if they are directly impacted by the change.

**3.3 Notify user and show what changed**

```markdown
Documentación técnica actualizada

**Archivos modificados:**
{for each modified document:}
- `{path}` — {brief change description}

{if new ADRs:}
**Nuevos ADRs:**
- `{adr_path}` — {title}

{if pending stories updated:}
**Stories actualizadas:**
- `{story_path}` — {brief change description}

Revisá los archivos y decime si están correctos o querés cambios.
```

**=== GATE D — Review updated architecture documents ===**

Ask with `AskUserQuestion`:
- Question: "¿Los cambios están correctos?"
- Options:
  - `Aprobar` / "Los archivos están bien"
  - `Pedir cambios` / "Quiero corregir algo"

**STOP and wait.**

If `Pedir cambios`: ask free-text. Apply changes. Re-open GATE D. Loop until approved.

**3.4 Identify corrective stories (if needed)**

Check **stories_folder** for implemented stories (status: done/completed) affected by the change.

If any exist:

```markdown
⚠️ **Stories ya implementadas que requieren corrección:**

| Story | Título | Impacto |
|-------|--------|---------|
| {id} | {title} | {what needs correction} |

¿Querés que cree stories correctivas para estas?
```

Ask with `AskUserQuestion`:
- Question: "¿Creo stories correctivas?"
- Options:
  - `Sí, crear stories` / "Crea las stories correctivas"
  - `No por ahora` / "Las manejo yo manualmente"

If `Sí, crear stories`:
1. Read **Story Template** from Files index.
2. For each affected story, generate next S-XXX, create corrective story in **stories_folder**, status `Ready`.
3. Confirm:
   ```markdown
   Story correctiva creada: **{S-XXX} — {title}**
   Archivo: `{stories_folder}/{S-XXX}.{title_short}.md`
   Revisá y decime si está correcto.
   ```
   Wait for approval per story. Iterate if changes needed.

---

### Step 4: Register Changes

**4.1 Collect all changes made**

Compile:
- Convention changes (added, removed, replaced, new customs, edited customs)
- Architecture document changes (ADRs, APIs, schemas, overview)
- Corrective stories created

**4.2 Create changelog entry**

Create **changelog_folder** if it doesn't exist.

Save to `{changelog_folder}/{YYYY-MM-DD}-{service_name}-{short_description}.md`:

```markdown
---
date: {YYYY-MM-DD}
type: technical-change
service: {service_name}
---

# Cambio Técnico: {service_name} — {short description}

## Requerimiento Original

> {verbatim original_request from Step 1.1}

## Resumen

{2-3 sentences summarizing what changed and why}

{if convention changes:}
## Cambios de Convenciones

| Convención | Cambio |
|---|---|
| {display_name} | agregada / eliminada / reemplazada por custom / nueva custom |

{if architecture doc changes:}
## Documentos Modificados

| Documento | Cambio |
|-----------|--------|
| {path} | {description} |

{if new ADRs:}
## Nuevos ADRs

- `{adr_path}` — {title}

{if corrective stories:}
## Stories Correctivas Creadas

- {story_id} — {title} (originada por: {reason})
```

Confirm:

```markdown
Changelog guardado: `{changelog_path}`

Revisá el archivo y decime si está correcto.
```

**=== GATE E — Review changelog entry ===**

Ask with `AskUserQuestion`:
- Question: "¿El changelog está correcto?"
- Options:
  - `Aprobar` / "Está bien, continúa"
  - `Corregir` / "Quiero ajustar algo"

**STOP and wait.**

If `Corregir`: ask free-text. Edit file. Re-open GATE E.

---

### Step 5: Summary

```markdown
## Cambio técnico completado — {service_name}

{if convention changes:}
### Convenciones
{list each change: agregada / eliminada / nueva custom / custom editada}

{if architecture doc changes:}
### Documentos modificados
{list each doc with brief change}

{if new ADRs:}
### Nuevos ADRs
{list}

{if corrective stories:}
### Stories correctivas
{list with IDs}

### Changelog
- `{changelog_path}`

---

**Siguientes pasos:**
{if corrective stories created:}
- Planificar stories correctivas con `/service-planify-story`
{if conventions changed:}
- Los próximos planes de stories van a reflejar el set actualizado automáticamente
- Revisá que `docs/architectures/{service_name}/index.md` esté actualizado
```

## Output

Files modified or created (see Files index for locations):

- `docs/architectures/{service}/manifest.yaml` — updated conventions list (if convention changes)
- `docs/architectures/{service}/index.md` — regenerated (if manifest changed)
- `docs/architectures/{service}/conventions/{id}.md` — new or edited custom conventions
- ADRs in **adrs_folder** (if architectural decisions changed)
- API specs, DB schemas, overview in respective folders (if changed)
- Corrective stories in **stories_folder** (if implemented stories were affected)
- Changelog entry in **changelog_folder**
