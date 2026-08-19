---
name: service-setup-repo
description: Configure service repository to use product documentation - supports monorepo and multirepo modes
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
---

# Setup Service Repository

## Purpose

Configure a service repository to use product documentation. Supports two modes:

- **Monorepo:** Product documentation and service code live in the same repository. Paths point to local `docs/` folders.
- **Multirepo:** Product documentation lives in a separate repository. Paths point to an external product repo.

**When is this required?**
- **Multirepo: required.** The `local-config.yaml` is the only place that records the relative path to
  the external product repo — service skills cannot work without it. This command CREATES that file.
- **Monorepo: NOT used to create a config — and it must NOT create one.** In a monorepo the file would
  be pure ambiguity: its paths are constants (the Files-index defaults) and a single `service.name`/
  `type` cannot represent a repo with several services. Service skills auto-detect monorepo from the
  repo structure (`docs/prd/` at the root) and resolve everything from defaults + each service's
  `manifest.yaml` (see Configuration Resolution Convention in `rules/skill.md`). In monorepo this
  command only ensures the local folders exist and tells the user no config is needed — it does **not**
  write `local-config.yaml`.

**Flow:**
```
Step 0: Initialize & check existing config
  |
Step 1: Detect or ask mode (monorepo / multirepo)
  |
Step 2: Validate paths (product repo for multirepo, local docs for monorepo)
  |
Step 3: Detect service info
  |
Step 4: Save config & initialize structure
  |
Step 5: Verify & summary
```

**Result:** Service repository configured with `local-config.yaml`, local directories created, and connection to product documentation verified.

**This command does NOT:**
- Create product documentation -> Run `/product-initialize` first
- Generate service architectures -> Use `/product-create-backend-architecture` or `/product-create-frontend-architecture`
- Plan or implement stories -> Use `/service-planify-story` and `/service-implement-story`

## Role

**Adopt the Technical Leader Agent role** - Read [Technical Leader Agent](.claude/agents/technical-leader.md)

## CRITICAL RULES

1. **Use Spanish for generated content** - All user interactions and generated documents in Spanish
2. **Save first, then validate** - Save configuration, notify user, wait for confirmation
3. **Reference locations from Files index** - Do not hardcode paths
   - Read [Files index](.claude/utils/index.md) for service repository structure
4. **Do NOT dump full content in chat** - Save to file, show summary, let user review
5. **Always store RELATIVE paths** - Convert absolute paths to relative before saving

## Execution

### Step 0: Initialize

**0.1 Load Context**

1. Read [Files index](.claude/utils/index.md) to identify:
   - **Local Config** path
   - **Service Repository** structure (story plans path)

**0.2 Check Existing Configuration**

1. Read `.claude/local-config.yaml` if it exists
2. **If exists:**
   - Show current configuration to user
   - Ask if they want to modify or keep it
   - If keep -> skip to Step 5 (Verify & Summary)

---

### Step 1: Detect or Ask Mode

**1.1 Auto-detect mode**

Check if **prd_folder** (default: `docs/prd/`, see Files index) exists in the current repository root:
- **If exists:** This is likely a monorepo (product docs are local). Propose `monorepo` mode.
- **If does NOT exist:** This is likely a multirepo setup. Propose `multirepo` mode.

**1.2 Confirm with user**

```markdown
Configuracion de Repositorio de Servicio

{{if monorepo detected}}
Detecte documentacion de producto en este repositorio (**prd_folder** encontrado).

**Es un monorepo?** (documentacion de producto y codigo del servicio en el mismo repo)
- **Si** -> Configuro en modo monorepo
- **No** -> Pido la ruta al repositorio de producto externo
{{else}}
No encontre documentacion de producto en este repositorio.

**Cual es la ruta al repositorio de producto?**
Puede ser absoluta o relativa (se guardara como relativa).

Ejemplos:
  - Relativa: ../mi-producto
  - Absoluta: /home/usuario/proyectos/mi-producto
{{endif}}
```

**WAIT for user response.**

---

### Step 2: Validate Paths

**2.1 If Monorepo:**

Validate that the current repository has the expected product structure:
1. Check **prd_folder** exists
2. Check **stories_folder** or similar product docs exist

**If invalid:**
```markdown
No se encontro la estructura esperada de documentacion de producto.

Se esperaba encontrar:
- **prd_folder** (documentacion de producto)

**Queres ejecutar `/product-initialize` primero para crear la documentacion?**
```

**2.2 If Multirepo:**

1. **Normalize path:** If absolute, convert to relative using `realpath --relative-to=$(pwd) <path>`
2. **Validate repository structure:**
   - Check directory exists
   - Verify `docs/prd/` or `docs/prd/index.md`
   - Verify `.claude/` directory

**If invalid:**
```markdown
El directorio especificado no parece ser un repositorio de producto valido.

Se esperaba encontrar:
- docs/prd/ (documentacion de producto)
- .claude/ (metodologia)

**Queres especificar otra ruta?**
```

**WAIT for user response.** If yes, go back to Step 1.

---

### Step 3: Detect Service Information

**Monorepo: SKIP this step entirely.** No config is written, so there is no `service.name`/`type` to
capture — the service type comes from each service's `manifest.yaml` at planify/implement time. Go
straight to Step 4 (monorepo branch).

**Multirepo only:**

**3.1 Detect from Codebase**

1. Read `package.json` or main configuration file
2. Identify service name
3. Identify service type (backend/frontend) based on dependencies

**3.2 Confirm with User**

```markdown
Informacion del servicio detectada:

- **Nombre:** {{service_name}}
- **Tipo:** {{service_type}}

**Es correcto o queres modificar algo?**
```

**WAIT for user response.**

---

### Step 4: Save Configuration & Initialize Structure

**4.1 Save local-config.yaml**

**If Monorepo: do NOT write `local-config.yaml`.**

In a monorepo the config file is intentionally absent — it would only add ambiguity (see Purpose). Skip
saving any file here. If a `.claude/local-config.yaml` already exists in this monorepo (e.g. created by
an older version), DELETE it — the service skills auto-detect monorepo from `docs/prd/` and a stale
config with a single `service.name` only causes confusion. Then go to Step 4.2.

**If Multirepo:** Save `.claude/local-config.yaml`:

```yaml
# Configuracion del servicio (compartido con el equipo)
# Generado por /setup-repo

mode: multirepo

product_repo:
  path: {{relative_path}}  # SIEMPRE ruta relativa

service:
  name: {{service_name}}
  type: {{service_type}}  # backend | frontend

# Rutas derivadas (para referencia, todas relativas)
paths:
  product_docs: {{relative_path}}/docs
  product_prd: {{relative_path}}/docs/prd
  product_stories: {{relative_path}}/docs/stories
  product_architectures: {{relative_path}}/docs/architectures
  product_flows: {{relative_path}}/docs/flows
  product_references: {{relative_path}}/docs/references
  story_plans: docs/story-plans
```

**4.2 Initialize Local Structure**

1. Create directories referenced in Files index:
   - `docs/story-plans/`

---

### Step 5: Verify & Summary

**If Monorepo:**

```markdown
Monorepo detectado — no hace falta archivo de configuración.

En monorepo los skills de servicio detectan el contexto solos (hay `docs/prd/` en la raíz) y resuelven
los paths desde los defaults y los `manifest.yaml` de cada servicio. **No se creó `local-config.yaml`**
{{if borrado}}(y se eliminó el `local-config.yaml` previo que existía){{endif}}.

Se aseguró la carpeta local:
- `docs/story-plans/`

Ya podés usar `/service-planify-story S-XXX [servicio]` y `/service-implement-story S-XXX [servicio]`
directamente.
```

No hay archivo que revisar — el comando terminó.

**If Multirepo:**

**5.1 Verify Connection**

1. Attempt to read PRD from product repo (`{{relative_path}}/docs/prd/`)
   - If fails, warn but don't block
2. Check for service architecture (`{{relative_path}}/docs/architectures/{{service_name}}/`)
   - If not found, inform user

**5.2 Notify User**

```markdown
Repositorio de servicio configurado

Incluye:
- Configuracion guardada en `.claude/local-config.yaml`
- Directorio local creado (`docs/story-plans/`)

Resumen:
- **Servicio:** {{service_name}} ({{service_type}})
- **Producto:** {{relative_path}}
- **PRD:** Encontrado / No encontrado
- **Arquitectura del servicio:** Encontrada / No encontrada

**Revisa la configuracion y decime si esta correcta o queres cambios.**
```

**If user requests changes:** Edit configuration, save again, verify again, and repeat notification.

**5.3 Present Next Steps**

```markdown
Proximos pasos:
- `/service-planify-story` - Dividir una story en tareas
- `/service-implement-story` - Implementar una story
```

## Output

**Multirepo:**
- `.claude/local-config.yaml` - Service configuration with relative paths to product repo (committed, shared with team)
- `docs/story-plans/` - Directory for story implementation plans

**Monorepo:**
- NO `local-config.yaml` is created (and any pre-existing one is deleted)
- `docs/story-plans/` - Directory for story implementation plans
