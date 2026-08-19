---
name: service-update-reusable-code
description: Create or update reusable code documentation catalog - scans codebase and generates docs/reusable-code/
argument-hint: "[service]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
---

# Update Reusable Code

## Purpose

Create or update the reusable code documentation (`docs/reusable-code/`) that catalogs all reusable code in the current service repository. This documentation is used by `/service-planify-story` to include reusable code context in Story Plans.

**Flow:**
```
Step 1: Check current state (existing docs?)
  |
Step 2: Load service architecture
  |
Step 3: Explore codebase (selective)
  |
Step 4: Categorize findings & compare
  |
Step 5: Gather details
  |
Step 6: Generate documents (index + detail files)
  |
Step 7: Summary
```

**Result:** Reusable code documentation generated in `docs/reusable-code/`, ready for use by `/service-planify-story`.

**This command does NOT:**
- Modify source code -- Only generates documentation
- Implement new reusable code -- Only catalogs what exists
- Plan stories -- Use `/service-planify-story` which consumes this documentation

## Role

**Adopt the Technical Leader Agent role** - Read [Technical Leader Agent](.claude/agents/technical-leader.md)

## CRITICAL RULES

1. **Use Spanish** for all user interactions (messages, summaries, confirmations)
2. **Save first, then validate** - Generate documentation, show summary, wait for confirmation
3. **Reference locations from Files index** - Do not hardcode paths
   - Read [Files index](.claude/utils/index.md) for reusable code locations
4. **Do NOT dump full content in chat** - Save to file, show summary
5. **Generate documentation in ENGLISH** - All technical docs in English for better agent comprehension
6. **Explore selectively** - Focus on folders identified in architecture, don't read entire codebase

## Execution

### Step 0: Resolve Configuration

Resolve following the **Configuration Resolution Convention** in `rules/skill.md`.
**Check the monorepo signal first:**

1. **`docs/prd/` exists at the repo root** → **monorepo**. **Ignore any `local-config.yaml`** (stale —
   warn once). Do NOT abort. The service name comes from the `[service]` argument if provided; otherwise,
   if `docs/architectures/` has exactly one service use it, and if several, ask which one with
   `AskUserQuestion`.
2. **No `docs/prd/` but `.claude/local-config.yaml` exists** → **multirepo**. Identify the service from
   its `service.name`.
3. **Neither** → ABORT:
   ```markdown
   No encontré configuración de servicio ni documentación de producto en este repo.

   - Si es un producto nuevo: ejecutá `/product-initialize`.
   - Si es un repo de servicio (multirepo): ejecutá `/service-setup-repo` para configurarlo.
   ```
   **ABORT immediately. Do NOT continue with any other step.**

### Step 1: Check Current State

1. Read [Files index](.claude/utils/index.md) to get locations and resolve **reusable_code_folder**
   (mode-dependent — reusable code is per service):
   - **Multirepo:** `docs/reusable-code/`
   - **Monorepo:** `docs/reusable-code/{{service_name}}/` (per-service subfolder so services don't
     overwrite each other's catalogs)
   - The index is **reusable_code_folder**`/index.md`; detail files are **reusable_code_folder**`/{category}.md`.
   - Also get architectures_folder (to read service architecture).

2. Use the service resolved in Step 0 (**service_name**) — do not re-derive it here.

3. Check if **reusable_code_folder** exists and what files are present

4. Inform user (in Spanish):

   **If index exists:**
   ```markdown
   Documentacion de codigo reutilizable existente encontrada.

   **Indice:** {{reusable_code_folder}}/index.md
   **Archivos de detalle:** {{list existing detail files}}

   Este comando va a actualizar los documentos con codigo reutilizable encontrado.
   **Queres continuar?**
   ```
   Wait for confirmation. If no, ABORT.

   **If NOT exists:**
   ```markdown
   No se encontro documentacion de codigo reutilizable.

   Este comando va a crear:
   - Indice compacto: `{{reusable_code_folder}}/index.md`
   - Archivos de detalle por categoria

   **Queres continuar?**
   ```
   Wait for confirmation. If no, ABORT.

### Step 2: Load Service Architecture

1. **Read Service Architecture** from **architectures_folder/[service-name]/**:
   - Read `index.md` to discover architecture documents
   - Read relevant sections: `structure.md` or `overview.md`
   - Understand:
     - Service type (Frontend/Backend/Worker/etc.)
     - Folder structure
     - Tech stack
     - Patterns used

2. **Detect stack-specific patterns** (will determine additional categories):
   - **Flutter + Riverpod**: Look for providers (`*_provider.dart`, `providers/` folder)
   - **React + Redux/Zustand**: Look for stores (`store.ts`, `stores/` folder, `slices/` folder)
   - **Vue + Pinia**: Look for stores (`stores/` folder, `*.store.ts`)
   - **NestJS**: Look for guards, interceptors, decorators (`guards/`, `interceptors/`, `decorators/`)
   - **Any framework**: Look for composables (`composables/`), extensions, mixins

   **Store detected patterns** to add as additional categories later.

3. Inform user (in Spanish):
   ```markdown
   Arquitectura del servicio cargada

   **Servicio:** {{service_name}}
   **Tipo:** {{Frontend/Backend/etc}}
   **Tech Stack:** {{brief summary}}

   Explorando codigo reutilizable...
   ```

### Step 3: Explore Codebase

**IMPORTANT:** Explore selectively based on architecture documentation. Read folder structure and index files, not individual implementation files.

**Use folder structure from architecture** to identify where to look.

**Common patterns to look for:**
- **Frontend (React/Vue/Angular)**:
  - Components: `src/components/`, `components/`
  - Hooks: `src/hooks/`, `hooks/`
  - Styles: `src/styles/`, `styles/`, CSS/SCSS files
  - Utils: `src/utils/`, `lib/`
  - Types: `src/types/`, `types/`
  - Constants: `src/constants/`, `config/`

- **Frontend (Flutter)**:
  - Components (Widgets): `lib/widgets/`, `lib/shared/widgets/`
  - Utils: `lib/utils/`, `lib/shared/utils/`
  - Types: `lib/models/`, `lib/types/`
  - Constants: `lib/constants/`, `lib/config/`
  - Providers (Riverpod): `lib/providers/`, `lib/shared/providers/`, files ending in `*_provider.dart`

- **Backend (Node.js/Express/NestJS)**:
  - Middlewares: `src/middlewares/`, `middleware/`
  - Services: `src/services/`
  - Repositories: `src/repositories/`
  - Utils: `src/utils/`, `lib/`
  - Types: `src/types/`, `types/`
  - Validators: `src/validators/`, `validation/`
  - Constants: `src/constants/`, `config/`

- **Backend (NestJS specific)**:
  - Guards: `src/guards/`, `guards/`
  - Interceptors: `src/interceptors/`, `interceptors/`
  - Decorators: `src/decorators/`, `decorators/`

- **Framework-agnostic state management**:
  - Redux/Zustand stores: `src/store/`, `src/stores/`, `src/slices/`
  - Pinia stores: `src/stores/`, files ending in `*.store.ts`

**For each relevant folder found:**
1. Check if folder exists (use `ls` or `glob`)
2. List files or read index files
3. Identify main exports
4. DO NOT read full implementations - just understand what's available

**Exploration strategy:**
- For components/hooks: Look at folder names or index exports
- For utils: Look at file names or exported functions
- For types: Look at file names or exported interfaces
- For middlewares/services: Look at class/function names

### Step 4: Categorize Findings and Compare with Existing

1. **Organize found code** into categories based on service type and detected stack patterns:

   **Base Frontend categories:**
   - Components
   - Hooks (React/Vue)
   - Styles
   - Utils/Helpers
   - Types/Interfaces
   - Constants

   **Base Backend categories:**
   - Middlewares
   - Services/Repositories
   - Utils/Helpers
   - Types/Interfaces
   - Validators
   - Constants

   **Additional categories** (add if detected in Step 2):
   - **Providers** (Flutter + Riverpod)
   - **Stores** (Redux/Zustand/Pinia)
   - **Guards** (NestJS)
   - **Interceptors** (NestJS)
   - **Decorators** (NestJS)
   - **Composables** (Vue Composition API)
   - **Extensions** (Kotlin/Swift/Dart)
   - **Mixins** (Vue/Sass)

2. **Compare with existing documentation** (if it exists):
   - Identify new items (not previously documented)
   - Identify removed items (documented but no longer exist in code)
   - Identify existing items (still present, may need update)

3. Inform user (in Spanish):
   ```markdown
   Codigo reutilizable encontrado: {{total_count}} items

   Generando documentacion...
   ```

### Step 5: Gather Details

For each piece of reusable code found:

1. Read the file to extract:
   - Exported functions/components/classes/types/constants
   - Function signatures, props interfaces, or class methods
   - Brief description from JSDoc comments, TypeDoc, or code analysis

2. Prepare entry with:
   - Name
   - Location (file path)
   - Description
   - Signature/Interface/Props
   - Usage example (infer from signature or extract from comments/tests if available)

**Important:** Don't overwhelm user with details in chat. Prepare internally.

Inform user:
```markdown
Extrayendo detalles de cada pieza...

Procesando {{count}} items...
```

### Step 6: Generate Documents

**CRITICAL: Generate ALL documentation in ENGLISH for optimal agent comprehension.**

1. Read **Reusable Code Index Template** and **Reusable Code Detail Template** from Files index

2. **Create folder structure:**
   - Create **reusable_code_folder** if it doesn't exist (in monorepo this is the per-service subfolder
     `docs/reusable-code/{{service_name}}/`)

3. **Generate index file** (**reusable_code_folder**`/index.md`) in ENGLISH:
   - Overview section
   - For each category with items:
     - **CRITICAL: List ALL items (one line each). Do NOT truncate or add "Y mas..."**
     - Format: Name, Location, one-line description (in English)
     - Link to detailed file (e.g., "See full details in [components.md](./components.md)")
   - For categories without items: State "No X documented yet" or "N/A (Backend/Frontend service)"

   **IMPORTANT:** The index must be complete. Its purpose is to show all available items so that
   agents can decide if they need to read the detail files. If you truncate, the index becomes useless.

4. **Generate detail files in ENGLISH** (only for categories with items):

   All detail files live under **reusable_code_folder** (per-service subfolder in monorepo).

   **Base categories:**
   - `{category}.md` for each: components (if Frontend), utils, middlewares, services/repositories,
     styles (if Frontend), hooks (if Frontend), types, validators, constants — created only when the
     category has items.

   **Additional stack-specific categories** (only if detected and have items):
   - providers (Flutter + Riverpod), stores (Redux/Zustand/Pinia), guards / interceptors / decorators
     (NestJS), composables (Vue), extensions (Kotlin/Swift/Dart), mixins (Vue/Sass).

   Each detail file contains (in English):
   - Category name as title
   - For each item: Name, Location, Description, Signature/Interface/Props, Usage example

   **Format reference for additional categories:**

   **Providers (Riverpod/Provider pattern):**
   ```markdown
   ### {{providerName}}
   **Location:** `{{file_path}}`
   **Description:** {{what it provides}}

   **Definition:**
   ```dart/typescript
   {{provider definition}}
   ```

   **Usage:**
   ```dart/typescript
   {{how to consume it}}
   ```
   ```

   **Stores (Redux/Zustand/Pinia):**
   ```markdown
   ### {{storeName}}
   **Location:** `{{file_path}}`
   **Description:** {{what state it manages}}

   **State:**
   ```typescript
   {{state interface}}
   ```

   **Actions/Methods:**
   ```typescript
   {{available actions}}
   ```

   **Usage:**
   ```typescript
   {{how to use in components}}
   ```
   ```

   **Guards/Interceptors/Decorators (NestJS):**
   ```markdown
   ### {{name}}
   **Location:** `{{file_path}}`
   **Description:** {{what it does}}

   **Implementation:**
   ```typescript
   {{signature/class}}
   ```

   **Usage:**
   ```typescript
   {{how to apply it}}
   ```
   ```

   **Composables (Vue):**
   ```markdown
   ### {{composableName}}
   **Location:** `{{file_path}}`
   **Description:** {{what it provides}}

   **Returns:**
   ```typescript
   {{return type}}
   ```

   **Usage:**
   ```vue
   {{usage in component}}
   ```
   ```

5. Proceed to Step 7 (Summary)

### Step 7: Summary

Present final summary (in Spanish):

```markdown
## Codigo Reutilizable Documentado

**Indice:** {{reusable_code_folder}}/index.md
**Archivos de detalle:** {{count}} archivos generados

### Cambios Realizados

**Agregados:** {{count}} nuevos items
{{list new items if any, or "Ninguno"}}

**Actualizados:** {{count}} items modificados
{{list updated items if any, or "Ninguno"}}

**Eliminados:** {{count}} items removidos
{{list removed items if any, or "Ninguno"}}

### Por Categoria
{{list categories with counts}}

---

**Siguiente paso:**
Esta documentacion sera usada automaticamente por `/service-planify-story` al planificar stories.

**Como funciona:**
- `/service-planify-story` lee primero el indice compacto
- Luego carga solo los archivos de detalle relevantes para la story
- Esto optimiza el uso de contexto

**Mantenimiento:**
Podes ejecutar `/service-update-reusable-code` nuevamente para actualizar cuando:
- Agregues nuevo codigo reutilizable
- Modifiques signatures de codigo existente
- Elimines codigo reutilizable
```

## Output

Under **reusable_code_folder** (`docs/reusable-code/` in multirepo; `docs/reusable-code/{service}/` in monorepo):

- `index.md` - Compact index of all reusable code
- `{category}.md` - Detailed documentation for each category with items
