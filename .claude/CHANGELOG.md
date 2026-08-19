# Changelog - Grava Workflow

Todos los cambios notables de esta metodología serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [6.1.0] - 2026-06-08

### Agregado

- **Skill `/product-architect`** — Modo arquitecto interactivo. Carga el contexto completo del producto (PRD, arquitecturas, ADRs, APIs, schemas, flows) y asiste para razonar decisiones de arquitectura, patrones de diseño, features grandes y flujos cross-service. Solo lectura + investigación (`Read`, `Glob`, `Grep`, `Bash`, `AskUserQuestion`, `WebSearch`).
- **Flujo de UX por request** — Nuevo skill `/product-ux-request` y flag `ux_review` en el REQ. `/product-design-request` setea `ux_review` (`required` | `not-applicable`); `/product-create-stories` aborta si quedó `required`; `/product-ux-request` infiere el delta UX (screens, overlays, flows), lo aplica a `product-map` / `user-flows` / `screens` y regenera los wireframes afectados. `/auto-implement-request` inserta un Step 1.5 cuando aplica.
- **Gate `affects_ui` en `/service-planify-story`** — Nuevo frontmatter `affects_ui` derivado del REQ y del tipo de servicios. Las stories backend-only ya no cargan UX ni design system (ahorro de contexto); cuando aplica, planify lee también user-flows, navegación, overlays y cross-surface-flows. `/service-implement-story` regenera wireframes automáticamente al final si modificó docs de UX (delegando a `/product-ux-wireframes`).
- **Design System por superficie** — `docs/design-system/{surface}/` versionado de forma independiente, con `docs/design-system/README.md` como índice raíz. `/product-ux-generate` copia el root + un set per-surface por cada superficie en el bootstrap; `/product-design-system-update` pregunta la `target_surface` al iniciar.
- **Migración `009-remove-monorepo-local-config.sh`** (target 6.1.0) — En monorepo, borra el `local-config.yaml` obsoleto. Idempotente; no toca multirepo.

### Cambiado

- **Monorepo sin `local-config.yaml`** — En monorepo el archivo dejaba de aportar valor (paths constantes iguales a los defaults del Files index y un `service.name/type` único que no representa un repo multi-servicio). Ahora los skills de servicio (`planify`, `implement`, `dev`, `update-reusable-code`, `auto-implement-*`, `status`) **autodetectan el modo desde `docs/prd/` en la raíz** y resuelven paths por defecto; el `service.type` sale del `manifest.yaml`. `/service-setup-repo` ya no crea el archivo en monorepo (y elimina uno viejo si existe). **Multirepo sin cambios:** el archivo sigue siendo requerido (path al `product_repo`).
- **Una rama por story compartida entre servicios** — En stories multi-servicio (monorepo) se usa una única rama compartida en vez de una rama por servicio.
- **Código reutilizable por servicio en monorepo** — `docs/reusable-code/` pasa a vivir en una subcarpeta por servicio para evitar colisiones.
- **`/product-ux-wireframes`** — Acepta un CSV de superficies a regenerar para no rehacer todo el set.
- **`rules/skill.md`** — Nueva "Configuration Resolution Convention" que chequea monorepo primero (presencia de `docs/prd/` en la raíz) e ignora un `local-config.yaml` viejo en monorepo.
- **Correcciones de auditoría de consistencia** — Ajustes en convenciones, discovery y el flujo monorepo a partir de la auditoría de consistencia.

### Corregido

- **`/service-planify-story`** — Resuelve el path del Story Plan según el modo (monorepo/multirepo). Los nombres de story-plan incluyen el servicio para evitar colisiones en monorepo.

### Eliminado

- **Concepto de quick-task** — Estaba a medio implementar (ningún skill generaba archivos `QT-XXX`; solo se creaba la carpeta) y el único flujo de tareas chicas es `/service-dev`. Se eliminó por completo: borrado `quick-task-tmpl.yaml`, quitadas las filas del Files index, `/service-setup-repo` ya no crea `docs/quick-tasks/` ni la clave `local_quick_tasks`, y se limpiaron las menciones en METHODOLOGY, `rules/skill.md` y docs.
- **Skills UX obsoletos** — `/product-ux-design-brief` y `/product-ux-wireframes-low` eliminados (consolidados en el flujo actual de `/product-ux-generate` + `/product-ux-wireframes`).

---

## [6.0.0] - 2026-06-07

### Agregado

- **Conventions catalog** (`.claude/conventions/`) — Catálogo de convenciones de desarrollo por lenguaje y preocupación. Cada convención define un paquete y sus reglas (logging, validación, HTTP server, manejo de errores, etc.). Lenguajes incluidos: **Node.js** (5 convenciones: `_base`, `error-handling`, `http-server`, `logging`, `validation`), **Next.js** (6 convenciones: `_base`, `data-fetching`, `mutations`, `forms`, `error-handling`, `styling`), **Go** (`_base`, `auth-jwt`, `ci-gitlab`, `config`, `database`, `dockerfile`, `error-handling`, `http-server`, `logging`, `messaging`, `observability`, `testing`, `validation`) y **Flutter** (`_base`, `ci-gitlab`, `env-config`, `error-handling`, `i18n`, `models-serialization`, `navigation`, `networking`, `state-management`, `testing`, `theming`).
- **Manifest schema** (`.claude/conventions/manifest-schema.md`) — Especificación del formato `manifest.yaml`, reglas de resolución (custom > catálogo) y algoritmo de transitive closure para `required_by`.
- **Convention template** (`.claude/templates/convention-tmpl.yaml`) — Template formal para crear convenciones (catálogo y custom): frontmatter obligatorio, secciones, checklist de calidad de 12 ítems.
- **Custom conventions** — Los servicios pueden crear convenciones propias en `docs/architectures/{service}/conventions/` para reemplazar o extender el catálogo. Una custom con el mismo id que una del catálogo la reemplaza solo para ese servicio.
- **Skill `/product-create-backend-architecture`** reescrito — Crea `manifest.yaml`, `overview.md`, e `index.md` en vez de 10+ archivos de secciones. Flujo interactivo con 6 gates obligatorios (A-F). Incluye sub-flow asistido para crear convenciones custom (consulta documentación oficial, propone estructura, espera confirmación).
- **Skill `/product-create-frontend-architecture`** reescrito — Equivalente al backend, adaptado para servicios frontend (Next.js). Mismo flujo de 6 gates.
- **Skill `/product-change-technical-definition`** reescrito — Soporta gestión de convenciones post-hoc (agregar/quitar/reemplazar del manifest, crear/editar customs) además de ADRs, APIs y schemas. Detecta automáticamente formato manifest vs. legacy.
- **Fase de análisis previa a la inicialización (Discovery)** — Dos nuevos skills, `/product-discovery-functional` (rol Analyst) y `/product-discovery-technical` (rol Technical Leader), producen tres documentos de discovery *decisión-completos* en `docs/discovery/`: `analisis-funcional.md`, `analisis-dominio.md` y `analisis-tecnico.md`. Front-loadean todo el descubrimiento para que la inicialización sea lineal.
- **Análisis de dominio DDD-light** — Nuevo artefacto puente entre lo funcional y lo técnico: lenguaje ubicuo, entidades con tipos/enums, ciclos de vida, invariantes, eventos de dominio y **bounded contexts que mapean a servicios**. Es un superset verbatim de la sección Domain Entities del PRD.
- **Modo transcripción en los skills de inicialización** — Cuando existen los documentos en `docs/discovery/`, `/product-initialize` y `/product-initialize-technical` detectan el análisis y, en vez de la entrevista interactiva completa, transcriben los artefactos (PRD/arquitectura) desde los documentos y solo preguntan ante huecos o contradicciones reales. Se preserva el ciclo guardar→validar→corregir y el aborto ante gaps genuinos.
- **Tres templates de discovery nuevos** — `discovery-functional-tmpl.yaml`, `discovery-domain-tmpl.yaml`, `discovery-technical-tmpl.yaml` (formato reference v2.0).
- **`docs/discovery/` registrado** — Nuevo `discovery_folder` y patrones de archivo en el Files index.
- **Trazabilidad y promoción del discovery** — En modo transcripción, los `initialize` agregan back-links desde el PRD/arquitectura hacia `docs/discovery/` y promueven el rationale a los homes canónicos (decisiones técnicas → ADRs con cita al análisis técnico; decisiones de producto → Context/Key Decisions de goals-and-context). El PRD/ADRs siguen siendo la fuente viva; el discovery queda como snapshot congelado y enlazado, sin que los skills downstream tengan que leerlo.

### Cambiado

- **Skill `/service-planify-story`** — Step 3.a detecta el formato del servicio: si existe `manifest.yaml` usa Format A (resolución de convenciones con transitive closure, prioridad custom > catálogo); si no, usa Format B (lectura de secciones legacy). Compatible con proyectos existentes.
- **Templates legacy marcados** — `backend-architecture-tmpl.yaml` y `frontend-architecture-tmpl.yaml` tienen `status: legacy` y nota explicativa. Se mantienen para servicios que aún usan el formato de secciones múltiples.
- **`/product-initialize` y `/product-initialize-technical`** — Nueva sección `## Discovery Mode` (después de `## Output`, siguiendo la convención de `## Auto Mode`) con los overrides por paso; chequeo liviano de existencia de `docs/discovery/` en `## Pre-loaded Context`. Comportamiento sin cambios cuando `docs/discovery/` no existe.
- **`rules/skill.md`** — Documentada la "Discovery Mode Convention" (paralela a la convención `--auto`) y agregado el ítem al checklist.
- **`.claude/METHODOLOGY.md`** — Agregado el paso 0 de discovery y la carpeta `docs/discovery/` en la estructura.

---

## [5.4.0] - 2026-04-14

### Agregado
- **Nuevo skill `/auto-new-request-from-fg`** — Genera un documento REQ a partir de un feature group del PRD sin interacción del usuario. Reemplaza el modo `--auto` que existía en `/product-new-request`

### Cambiado
- **Separación de auto mode en skills** — Toda la lógica `--auto` se movió de los pasos interactivos a una sección dedicada `## Auto Mode` al final de cada skill. Esto mantiene el flujo interactivo limpio e idéntico a v5.2.0, mientras que las variaciones de auto mode quedan concentradas en un solo lugar auditable
- **Skills afectados:** `/product-design-request`, `/product-create-stories`, `/service-planify-story`, `/service-implement-story`
- **`/product-new-request`** — Restaurado a v5.2.0 (sin modo auto, esa responsabilidad pasa a `/auto-new-request-from-fg`)
- **`/auto-implement-product`** — Actualizado para usar `/auto-new-request-from-fg` en vez de `/product-new-request --auto`
- **`rules/skill.md` y `templates/skill.md`** — Convención `--auto` actualizada al nuevo patrón de sección separada

---

## [5.3.1] - 2026-04-13

### Corregido
- **`/product-new-request --auto`** — Omite el mensaje de "next steps" para evitar que el subagente se bloquee esperando input del usuario
- **`/auto-implement-request`** — Sugiere `/service-dev` correctamente para correcciones post-implementación

---

## [5.3.0] - 2026-04-13

### Agregado
- **Nuevo skill `/auto-implement-request`** — Orquesta el flujo completo de implementación de un request de forma autónoma: diseño técnico → stories → planificación → implementación, con manejo de ramas y commits
- **Nuevo skill `/auto-implement-product`** — Lee los feature groups del PRD, detecta cobertura existente y orquesta `/auto-implement-request` para cada grupo pendiente. Soporta filtro por texto libre
- **Modo `--auto` en skills de flujo** — `/product-new-request`, `/product-design-request`, `/product-create-stories`, `/service-planify-story` y `/service-implement-story` aceptan flag `--auto` para ejecutar sin interacción del usuario
- **Nuevo agente `orchestrator.md`** — Agente especializado en coordinación secuencial de flujos multi-skill, usado por `/auto-implement-request` y `/auto-implement-product`
- **Convención `--auto` en templates y reglas** — `rules/skill.md` y `templates/skill.md` documentan el patrón `--auto` para nuevos skills

### Corregido
- **`/auto-implement-request`** — Sugiere `/service-dev` para correcciones post-implementación

---

## [5.2.0] - 2026-04-10

### Agregado
- **Documentación de referencias externas** (`docs/references/`) — Nueva carpeta de producto para almacenar documentación de referencia externa (APIs de terceros, guías de integración, definiciones de negocio). Incluye un `index.md` como punto de entrada con descripciones y hints de lectura para que el agente identifique y consuma eficientemente solo las referencias relevantes. Sin restricción de formato de archivo
- **Integración en skills de diseño y planificación** — `/product-design-request` lee referencias en Step 3 y las considera en Step 4. `/service-planify-story` carga referencias y copia contenido relevante al Story Plan (Integration Points). `/service-dev` carga referencias del servicio al iniciar
- **Integración en skills de inicialización** — `/product-initialize` acepta documentación externa y la guarda como referencia. `/product-initialize-technical` pregunta por documentación de integraciones externas al crear la arquitectura
- **Análisis de impacto en referencias** — `/product-change-technical-definition` incluye referencias en el contexto cargado y evalúa si necesitan actualización
- **Migración 007** — Crea `docs/references/` con `index.md` vacío y agrega `product_references` al `local-config.yaml`

### Corregido
- **`/service-implement-story`** — Quality verification y error handling ahora exigen corregir **todos** los errores encontrados (build, lint, type, test), incluyendo preexistentes. No se permite saltear errores etiquetándolos como "pre-existing"

---

## [5.1.2] - 2026-04-10

### Corregido
- **`/service-implement-story`** — Step 8 (Finalization) no referenciaba el path **product_stories** de `local-config.yaml` al actualizar el estado de la story, causando que en monorepo no se actualice el campo Estado en "Servicios Afectados"
- **`/service-planify-story`** — Mensaje de error referenciaba `docs/stories/` hardcodeado en vez del path configurado en `local-config.yaml`
- **Files index** (`utils/index.md`) — Links apuntaban a `../commands/` (eliminado en v5.0.0), actualizado a `../skills/`. Agregados skills faltantes: `product-initialize-technical`, `product-generate-flows`, `service-dev`, `status`

---

## [5.1.1] - 2026-03-30

### Corregido
- **`/product-create-stories`** — El Step 5 (Update Technical Documentation) se salteaba cuando no había cambios de API o DB, ignorando cambios de flows. Ahora incluye flows en la condición y en el output esperado

---

## [5.1.0] - 2026-03-29

### Agregado
- **Nuevo skill `/service-dev`** — Modo interactivo de desarrollo: carga contexto técnico completo (arquitectura, APIs, schemas, ADRs, flows, código reutilizable) y queda disponible para lo que el usuario necesite. Cuando hay cambios de código aplica test-first + quality verification + aprobación antes de commitear
- **`rules/skill.md`** — Reglas actualizadas para skills: frontmatter obligatorio, reglas de `!cat`, naming flat, parseo flexible de argumentos
- **`templates/skill.md`** — Template actualizado para skills: soporte para frontmatter, auto-detect role, Loop pattern para skills interactivos, QA Reviewer Agent

### Cambiado
- **`CLAUDE.md`** — Sección "Creación y Edición de Comandos" reescrita como "Creación y Edición de Skills" con checklist actualizado
- **`rules/command.md` → `rules/skill.md`** — Renombrado y actualizado
- **`templates/command.md` → `templates/skill.md`** — Renombrado y actualizado

---

## [5.0.0] - 2026-03-29

### Agregado
- **Skills system** — Migración completa de `.claude/commands/` a `.claude/skills/`. Cada skill es una carpeta con `SKILL.md` y frontmatter (`name`, `description`, `allowed-tools`, `argument-hint`)
- **Nuevo skill `/status`** — Dashboard de estado del proyecto/servicio: requests pendientes, stories activas, siguiente acción sugerida. Detecta automáticamente si es producto, servicio o monorepo
- **Parseo flexible de argumentos** — Los skills con REQ/Story number aceptan múltiples formatos: `REQ-003`, `003`, `3` (todos resuelven a `REQ-003`)
- **Diagrama de workflow** — `docs/workflow-diagram.excalidraw` con todos los skills y sus dependencias, organizado por fases
- **Documentación reestructurada** — Nueva estructura: `getting-started.md` (instalación), `setup.md` (fase de puesta a punto), `development.md` (ciclo de desarrollo), `reference/commands.md` (tabla de skills), `reference/concepts.md` (glosario)

### Cambiado
- **Invocación de skills** — Formato cambia de `/product:xxx` a `/product-xxx` y `/service:xxx` a `/service-xxx` (limitación de skills: no soportan subdirectorios namespace)
- **`allowed-tools` en cada skill** — Cada skill declara explícitamente qué herramientas necesita, reduciendo riesgo de desvío
- **README.md** — Reescrito con nueva estructura, quick start actualizado, link al diagrama de workflow

### Eliminado
- **Carpeta `.claude/commands/`** — Reemplazada completamente por `.claude/skills/`
- **`/service-create-quick-task` y `/service-implement-quick-task`** — Eliminados del workflow
- **Documentación anterior** — `docs/daily-use.md`, `docs/commands-reference.md`, `docs/new-project.md`, `docs/existing-project.md`, `docs/guides/` reemplazados por nueva estructura

---

## [4.1.0] - 2026-03-27

### Agregado
- **Domain Entities como vocabulario compartido** — Nueva sección en `requirements.md` (definida durante `/product:initialize`) con entidades tipadas, enums, transiciones de estado, relaciones y business rules. Alimenta toda la cadena downstream
- **Clarificación funcional basada en análisis de issues** — `/product:new-request` Step 3 reescrito: el agente cruza el request contra el dominio y detecta 16 tipos de issues (ambigüedades, conflictos, información faltante, consecuencias de alcance, calidad). Solo pregunta sobre lo que encontró — si no hay issues, no pregunta
- **Acceptance criteria con error cases automáticos** — `/product:new-request` Step 4 ahora tiene 2 sub-pasos: 4.1 happy path (validado por usuario), 4.2 error cases derivados del dominio (transiciones inválidas, permisos, business rules, side effects) sin interacción extra
- **Propagación de Domain Entities en flujo cotidiano** — `/product:new-request` lee Domain Entities como contexto; detecta entidades nuevas o cambios; propone sección `## Impacto en Domain Entities` en el REQ-XXX. `/product:design-request` valida el impacto con contexto técnico y actualiza `requirements.md`
- **Migraciones de agente** — Nuevo tipo de migración `.md` (además de `.sh`) para tareas que requieren análisis semántico. `migrate.sh` genera `agent-migrations-pending.md` y `/update-tools` Step 6 las ejecuta
- **Migración `006-infer-domain-entities.md`** — Infiere Domain Entities desde documentación existente (arquitecturas, schemas, APIs, stories) para productos iniciados con versiones anteriores
- **Diseño dual-audience en templates PRD** — Templates v2.0 con capabilities table (C-XX), Feature IDs (F-XX), Goal IDs (G-XX), User IDs (U-XX), NFRs en tabla con targets medibles
- **Agente Analyst como facilitador** — Reescrito para extraer conocimiento (no generar), desafiar vaguedades en items de alto impacto, y explicitar supuestos antes de escribir

### Cambiado
- **`/product:initialize` reestructurado** — Nuevo Step 3 para Domain Entities; pregunta abierta en vez de cuestionario rígido; agente lista supuestos antes de draftar; challenge rules para estados, permisos y tipos
- **`/product:new-request` simplificado** — Eliminada estimación de complejidad (baja/media/alta) redundante; `design-request` ya hace análisis técnico real. Flujo de 8 a 7 pasos
- **`/product:design-request` ampliado** — Nuevo paso para evaluar impacto en Domain Entities del REQ antes de analizar
- **`/update-tools` ampliado** — Nuevo Step 6 para ejecutar migraciones de agente pendientes
- **`migrate.sh` ampliado** — Nueva función `detect_agent_migrations()` que escanea migraciones `.md` y genera archivo de pendientes
- **Template `prd-goals-context-tmpl.yaml`** — "Background and Context" reemplazado por "Context" (Existing Systems, Key Decisions) — más práctico para productos de cliente
- **Template `prd-architecture-tmpl.yaml`** — Columna "Owns Entities" en tabla de servicios

### Eliminado
- **Estimación de complejidad en `/product:new-request`** — Campo `complexity` removido del frontmatter REQ-XXX y de la sección Clasificación. `design-request` determina el scope con análisis técnico real
- **Cuestionario fijo en Step 3 de `/product:new-request`** — Reemplazado por análisis de issues basado en dominio

---

## [4.0.1] - 2026-03-25

### Cambiado
- **Reglas de sizing en Feature Groups (`/product:initialize`)** - Nuevas reglas explícitas de dimensionamiento: target de **3-8 stories por feature group**, con límites para split (10+) y merge (1-2). Basado en evidencia de Lean (curva U de Reinertsen) y DORA/Accelerate
- **Feature Group 1 redefinido como walking skeleton** - FG1 ahora es exclusivamente infraestructura + funcionalidad mínima para demostrar que el sistema está vivo (health check, endpoint trivial). Las features de negocio reales arrancan en FG2+
- **Invertida regla "preferir pocos y grandes"** - Reemplazada por "preferir más chicos y enfocados", alineando con la evidencia de que batches más pequeños reducen riesgo y aceleran feedback

---

## [4.0.0] - 2026-03-20

### Agregado
- **Nuevo comando `/product:generate-flows`** - Genera documentación de flujos del sistema (cross-service). Documenta interacciones entre servicios con pasos detallados, contratos de datos, y diagramas de secuencia
- **Nuevo template `flow-tmpl.yaml`** - Template de referencia para documentar flujos del sistema con formato estandarizado
- **Soporte monorepo en `/service:setup-repo`** - Detección automática de monorepos, configuración de `service_root` relativo, y soporte para múltiples servicios dentro del mismo repositorio
- **Migración `005-add-monorepo-support.sh`** - Agrega automáticamente soporte monorepo a `local-config.yaml` existentes
- **Sección "Affected Flows" en stories y requests** - Los templates de story y request ahora incluyen sección para documentar qué flujos del sistema se crean o modifican
- **"Flow Context" en story plans** - Los story plans ahora incluyen contexto de flujos copiados verbatim para que el implementador conozca los contratos cross-service exactos
- **Detección de flujos parciales en `/product:analyze-service`** - Detecta automáticamente interacciones cross-service (HTTP calls, eventos, webhooks) durante el análisis
- **Generación de flujos en `/product:consolidate-services`** - Nuevo Step 9.5 que genera flujos del sistema a partir de las interacciones detectadas en los análisis de servicios
- **Hooks de continuidad** - Nuevos hooks `on-pre-compact.sh` y `on-session-resume.sh` que preservan el contexto del comando en ejecución durante compactaciones de contexto
- **Reglas de citación literal** - Múltiples comandos ahora requieren copiar verbatim campos de templates y documentación existente en lugar de parafrasear

### Cambiado
- **`/product:design-request` ampliado** - Nuevos pasos para identificar y documentar flujos afectados por el request
- **`/product:create-stories` ampliado** - Incluye flujos afectados en cada story generada
- **`/service:planify-story` ampliado** - Lee y copia flujos relevantes como contexto para la implementación
- **`/service:implement-story` ampliado** - Incluye validación de contratos cross-service definidos en los flujos
- **`/product:initialize-technical` ampliado** - Soporte para definición inicial de flujos del sistema
- **`/product:new-request` ampliado** - Paso adicional para identificar flujos potencialmente afectados
- **README.md actualizado** - Incluye `/product:generate-flows` en Quick Start y hooks de continuidad en características

---

## [3.0.0] - 2026-03-07

### Eliminado
- **Concepto de Epic eliminado completamente** - Los epics ya no existen como entidad. Las requests son la unidad principal de captura y las stories son la unidad de implementacion
- **Comandos eliminados:** `/product:create-epic`, `/product:planify-epic`, `/product:create-story` - Reemplazados por `/product:create-stories`
- **Template eliminado:** `epic-tmpl.yaml` - Ya no es necesario
- **Template eliminado:** `prd-epic-candidates-tmpl.yaml` - Reemplazado por `prd-feature-groups-tmpl.yaml`
- **Carpeta `docs/epics/`** eliminada del indice de ubicaciones
- **Clasificacion story/epic en requests** - Reemplazada por estimacion de complejidad (baja/media/alta)
- **Modos dual (story/epic) en `/product:design-request`** - Ahora siempre hace analisis detallado

### Agregado
- **Nuevo comando `/product:create-stories`** - Crea 1 o N stories desde un request disenado (status: designed). Reemplaza create-epic, planify-epic y create-story en un solo comando
- **Story split en `/product:design-request`** - Nuevo Step 5 que propone la division en stories basado en complejidad y boundaries de servicio
- **Seccion "Story Split Propuesto" en requests** - Los requests disenados ahora incluyen la propuesta de division en stories
- **Estimacion de complejidad en `/product:new-request`** - Nuevo Step 5 con tabla baja/media/alta reemplazando la clasificacion story/epic
- **Template `prd-feature-groups-tmpl.yaml`** - Reemplaza epic-candidates con Feature Groups
- **Migracion `004-remove-epics.sh`** - Renombra epic-candidates.md a feature-groups.md automaticamente

### Cambiado
- **"Epic Candidates" renombrado a "Feature Groups"** en toda la documentacion (PRD, commands, agents, templates)
- **Flujo simplificado de 6 a 4 comandos:** `new-request` → `design-request` → `create-stories` → `planify-story`/`implement-story`
- **`/product:new-request`** - Paso 1 lee feature groups en vez de epics; Paso 5 estima complejidad en vez de clasificar tipo
- **`/product:design-request`** - Analisis siempre detallado (sin modo dual); incluye propuesta de story split
- **`/product:initialize`** - Steps 5-6 crean Feature Groups en vez de Epic Candidates
- **`/product:consolidate-services`** - Step 7 genera Feature Groups; Step 10-11 sin carpeta epics
- **Story template** - Eliminado campo `epic` del frontmatter; un solo patron de naming `S-XXX`
- **Request template** - `complexity` reemplaza `type`; eliminados formatos duales story/epic; agregada seccion story-split
- **Agents actualizados** - Analyst y Technical Leader sin referencias a epics
- **METHODOLOGY.md** - Flujo actualizado sin epics
- **README.md** - Quick Start actualizado con nuevo flujo

---

## [2.4.1] - 2026-02-10

### Cambiado
- **Regla 5 reforzada en `/service:implement-story`** - Ahora prohíbe explícitamente leer archivos existentes para "entender patrones". Solo se permite leer archivos que la task requiere modificar
- **Step 4.2 más restrictivo** - Instrucción directa de no leer archivos fuente adicionales; los patrones y convenciones ya están en el Architectural Context del Story Plan

---

## [2.4.0] - 2026-02-10

### Agregado
- **Actualización incremental de código reutilizable en `/service:implement-story`** - Nuevo Step 6 que documenta automáticamente el código reutilizable creado durante la implementación (componentes, utils, hooks, middlewares, etc.) sin necesidad de ejecutar `/service:update-reusable-code`. Solo analiza los archivos recién creados, no todo el codebase

### Cambiado
- **User Review simplificado en `/service:implement-story`** - Eliminadas las secciones "Story Implementation Summary" y "Tasks Completed" del resumen final. El review ahora se enfoca en: Acceptance Criteria, Quality Results, Manual Testing Guide, Reusable Code Updated, Architectural Decisions

---

## [2.3.0] - 2026-02-10

### Cambiado
- **`/service:implement-story` optimizado — Story Plan como única fuente de verdad** - Eliminada la lectura redundante de documentación de arquitectura del product repo (6-8 archivos), el escaneo completo del codebase para código reutilizable, y la re-lectura de la story. Toda esa información ya estaba embebida en el Story Plan por `/service:planify-story`. El comando pasa de 9 a 7 pasos, ahorrando ventana de contexto para la implementación real
- **Nueva regla crítica "Story Plan is the single source of truth"** - Hace explícito que `implement-story` no debe re-leer documentos de arquitectura ni escanear el codebase, ya que el Story Plan contiene todo lo necesario
- **Eliminados paths hardcodeados en `implement-story`** - Removidas referencias directas a `src/middlewares/`, `src/components/ui/`, `src/hooks/`, etc. que violaban la regla de no hardcodear paths

---

## [2.2.1] - 2026-02-06

### Agregado
- **Validación obligatoria de `local-config.yaml` en comandos service** - Los 5 comandos de servicio (`create-quick-task`, `implement-quick-task`, `implement-story`, `planify-story`, `update-reusable-code`) ahora verifican que exista `.claude/local-config.yaml` como primer paso. Si no existe, informan al usuario y **abortan inmediatamente**, dirigiendo a ejecutar `/service:setup-repo`

---

## [2.2.0] - 2026-02-06

### Cambiado
- **Todos los comandos refactorizados al template estándar** - Los 14 comandos (`product/` y `service/`) ahora siguen la estructura: Purpose (con Flow, Result, "does NOT") → Role (con link markdown al agente) → CRITICAL RULES → Execution → Output
- **`/product:change-technical-definition` reescrito completamente** - Nuevo flujo autocontenido con 7 pasos: Initialize → Identify Changes → Evaluate → Impact Analysis → Update Definitions → Handle Affected Stories → Register Changes. Incluye soporte para changelog técnico y stories correctivas
- **`/service:setup-repo` en inglés** - Texto del comando migrado de español a inglés (siguiendo convención: commands en inglés, contenido generado en español)
- **`/service:implement-quick-task` mejorado** - Nuevo flujo con pasos explícitos de setup de branch, quality verification y user review
- **`/service:create-quick-task` mejorado** - Reorganizado con exploración de codebase y formato de output más claro
- **`utils/index.md` actualizado** - Agregados `changelog_folder` y pattern de Changelog Entry. `local-config.yaml` documentado como "Service Configuration (Committed)" en lugar de "Local Configuration (Not Committed)"

---

## [2.1.0] - 2026-02-02

### Agregado
- **`/product:initialize-technical`** - Nuevo comando separado para definir arquitectura técnica (antes parte de `/product:initialize`). Genera arquitecturas, ADRs, APIs y schemas de BD.
- **`templates/command.md`** - Template de referencia para estructura de comandos (en inglés, para desarrollo)
- **`rules/command.md`** - Reglas que todos los comandos deben seguir (en inglés, para desarrollo)

### Cambiado
- **Comandos autocontenidos** - Los comandos `/product:initialize`, `/product:analyze-service` y `/product:consolidate-services` ahora son completamente autocontenidos. Ya no usan subagents ni archivos externos de `_command_steps/`.
- **`/product:initialize` simplificado** - Ahora solo maneja la definición del producto (PRD). La arquitectura técnica se genera con `/product:initialize-technical`.
- **Convención de idioma clarificada** - Documentos FOR Claude (commands, agents, templates) en inglés; documentos GENERATED BY commands en español.

### Eliminado
- **Carpeta `_command_steps/`** - Eliminada completamente. Toda la lógica está ahora dentro de cada comando.

---

## [2.0.1] - 2026-01-30

### Corregido
- **Flujo save-first en `/product:consolidate-services`** - Corregidas las instrucciones del comando para usar el patrón "guardar primero, pedir review después" en lugar de "mostrar draft, aprobar, guardar". Alinea el comando con la metodología save-first adoptada en v2.0.0.

---

## [2.0.0] - 2026-01-30

### Agregado
- **`/product:new-request` y `/product:design-request`** - Nuevo flujo dividido en dos fases: captura de requerimientos y diseño técnico. El comando `new-request` captura y estructura la información inicial, mientras que `design-request` genera las arquitecturas técnicas basándose en los requerimientos capturados.
- **`/service:update-reusable-code`** - Nuevo comando para documentar código reutilizable del servicio. Analiza componentes, hooks, utilidades y helpers generando documentación estructurada que facilita el reuso durante la implementación.

### Cambiado
- **`/product:analyze-service` mejorado** - Ahora fuerza el uso de estructura de templates para documentación de arquitectura, asegurando consistencia en la documentación generada.
- **`/service:planify-story` mejorado** - Ahora incluye lectura completa de documentación del producto con referencias específicas en el story-plan, mejorando el contexto disponible durante la planificación.
- **Flujo save-first adoptado** - Los comandos ahora guardan información inmediatamente después de capturarla, reduciendo riesgo de pérdida de trabajo y permitiendo construcción incremental.

### Eliminado
- **Comandos obsoletos de flujo antiguo** - Removidos comandos legacy que fueron reemplazados por el nuevo flujo de importación y patrón orchestrator.
- **Templates obsoletos** - Eliminados templates que ya no se usan en el nuevo workflow.

---

## [1.10.2] - 2026-01-14

### Cambiado
- **`/planify-story` reforzado con lectura obligatoria de arquitectura** - El comando ahora requiere explícitamente leer el documento de arquitectura del servicio desde el repositorio de producto ANTES de planificar. Nuevo paso 3 "Read Architecture and Explore Codebase" que obliga a:
  - Leer y extraer reglas de arquitectura (folder structure, naming conventions, design patterns, prohibited practices)
  - Explorar el codebase existente para identificar elementos reutilizables (components, hooks, utils, styles, services)
  - Documentar hallazgos antes de continuar con la planificación
- **Restricciones obligatorias en planificación de tareas** - Nuevas reglas "MANDATORY CONSTRAINTS" que enfatizan:
  - **Respetar reglas de arquitectura** - Toda tarea debe cumplir con los patrones y decisiones documentadas. Violar las reglas es INACEPTABLE
  - **Reutilizar código existente** - Cada tarea debe mencionar explícitamente qué elementos existentes reutilizar. Crear código duplicado es INACEPTABLE

---

## [1.10.1] - 2026-01-13

### Corregido
- **Bug en `migrate.sh` con captura de versiones** - Las funciones de log ahora redirigen correctamente a stderr (`>&2`) en lugar de stdout, evitando que los mensajes informativos se capturen en las variables `PROJECT_VERSION` y `TARGET_VERSION`. Esto corrige el error "se esperaba una expresión entera" que ocurría cuando no existía el archivo `.grava-version`.

---

## [1.10.0] - 2026-01-12

### Cambiado
- **`/planify-story` ahora guarda incrementalmente** - El comando ahora guarda cada tarea inmediatamente después de la aprobación del usuario, en lugar de esperar a guardar todo al final. Esto permite construir el documento de manera incremental, reduciendo el riesgo de pérdida de trabajo y mejorando la visibilidad del progreso.

---

## [1.9.2] - 2026-01-12

### Corregido
- **`/setup-service-repo` ahora guarda rutas relativas** - El comando ahora convierte automáticamente rutas absolutas a relativas usando `realpath --relative-to` antes de guardar en `local-config.yaml`. Esto permite que múltiples desarrolladores compartan el mismo archivo de configuración si tienen estructura de carpetas similar.

---

## [1.9.1] - 2026-01-12

### Cambiado
- **Documentación de migraciones mejorada** - Agregadas instrucciones claras en README y CHANGELOG para usuarios que actualizan desde versiones < 1.8.0, explicando cómo ejecutar migraciones manualmente con `bash .claude/scripts/migrate.sh`

### Eliminado
- **`local_tasks` removido de `local-config.yaml`** - Eliminada la clave `local_tasks` ya que la carpeta `docs/tasks/` fue deprecada en v1.6.0 y migrada a `docs/story-plans/`. Ya no se crea el directorio `docs/tasks/` durante setup

---

## [1.9.0] - 2026-01-12

### Agregado
- **`story_plans` en `local-config.yaml`** - Nueva ruta `story_plans: docs/story-plans` agregada al archivo de configuración generado por `/setup-service-repo`
- **Migración automática `002-add-story-plans-path.sh`** - Script que agrega automáticamente la clave `story_plans` a archivos `local-config.yaml` existentes durante `/update-tools`

### Cambiado
- **Variables de rutas estandarizadas** - Los comandos `/planify-story`, `/implement-story-back` e `/implement-story-front` ahora usan las variables del YAML (`{{product_stories}}`, `{{story_plans}}`) en lugar de variables genéricas (`{{PRODUCT_DOCS}}`, `{{LOCAL_DOCS}}`)
- **Ubicación de `story-plans` y `quick-tasks` clarificada** - Movidos de "Product Repository" a "Service Repository (Implementation Planning)" en `utils/index.md`, reflejando que la planificación de implementación es específica de cada servicio
- **`/setup-service-repo` actualizado** - Ahora crea el directorio `docs/story-plans/` durante la inicialización

### Corregido
- **Bug en búsqueda de story plans** - Los comandos `/implement-story-back` e `/implement-story-front` ahora encuentran correctamente los archivos de planificación en el repositorio del servicio en lugar de buscar en el repositorio del producto

### Nota de Migración
**Para usuarios con `local-config.yaml` existente:** Al ejecutar `/update-tools`, la migración `002-add-story-plans-path.sh` agregará automáticamente esta línea en la sección `paths`:
```yaml
story_plans: docs/story-plans
```
Si prefieres hacerlo manualmente, simplemente agrega esa línea después de `product_architectures` en tu archivo `.claude/local-config.yaml`.

---

## [1.8.0] - 2026-01-09

### Agregado
- **Sistema de migraciones automáticas** - Nuevo sistema completo para migrar automáticamente la estructura de archivos de proyectos al actualizar versiones del workflow
- **`.claude/migrations/`** - Nueva carpeta con scripts de migración versionados y documentación del sistema
- **`.claude/scripts/migrate.sh`** - Script orquestador que detecta versión del proyecto, ejecuta migraciones necesarias y actualiza `.claude/.grava-version`
- **Migración `001-consolidate-tasks.sh`** - Primera migración que consolida estructura legacy `docs/tasks/{story_id}/` a `docs/story-plans/{story}.md` (v1.5.0 → v1.6.0)
- **`.claude/.grava-version`** - Archivo que almacena la versión de estructura del proyecto (creado y gestionado automáticamente, protegido durante actualizaciones)

### Cambiado
- **`/update-tools` integrado con migraciones** - El comando ahora ejecuta automáticamente migraciones pendientes después de actualizar archivos del workflow
- **Archivos protegidos actualizados** - `.claude/.grava-version` agregado a la lista de archivos que nunca se sobrescriben durante actualizaciones
- **README actualizado** - Nueva sección completa documentando el sistema de migraciones, archivo `.grava-version`, y proceso de actualización
- **Migraciones eliminan estructura legacy** - Los archivos legacy se eliminan automáticamente después de migrar exitosamente (se asume uso de git/backups)

---

## [1.7.0] - 2026-01-09

### Agregado
- **`/create-epic`** - Nuevo comando para crear épicas y agregarlas a la sección `epic-list` del PRD. Permite definir épicas con numeración automática, goal statement, capacidades clave, criterios de éxito, dependencias y servicios afectados. Opcionalmente puede crear un documento detallado de épica en `docs/epics/`.

---

## [1.6.0] - 2026-01-07

### Agregado
- **`story-plan-tmpl.yaml`** - Nueva plantilla que consolida toda la información de tasks de una story en un único archivo

### Cambiado
- **Estructura de planificación de stories** - Cambio de carpeta `docs/tasks/{{story_id}}/` con múltiples archivos a un único archivo `docs/story-plans/{{story_filename}}.md`
- **`/planify-story` actualizado** - Ahora genera un único archivo Story Plan en `docs/story-plans/` usando la nueva plantilla
- **`/implement-story-back` y `/implement-story-front` actualizados** - Leen tasks desde el nuevo archivo consolidado y actualizan estados directamente en él
- **Quality Verification optimizado** - Ahora se ejecuta una sola vez al finalizar todas las tasks (en lugar de después de cada task) para optimizar tiempos de implementación
- **`/consolidate-product-docs` simplificado** - Eliminadas secciones redundantes de prerequisites, service guides y consolidación de deuda técnica. El comando ahora se enfoca en copiar documentación ya aprobada y generar PRD
- **Templates y comandos estandarizados** - Todos los archivos ahora están en inglés, manteniendo "Use spanish for all interactions" para que la ejecución y documentos generados sean en español

### Eliminado
- **`/implement-task-back`** - Comando eliminado (usar `/implement-story-back`)
- **`/implement-task-front`** - Comando eliminado (usar `/implement-story-front`)
- **`task-tmpl.yaml`** - Template eliminado (integrado en `story-plan-tmpl.yaml`)
- **`task-index-tmpl.yaml`** - Template eliminado (ya no necesario)

---

## [1.5.0] - 2025-12-29

### Agregado
- **`frontend-workflows-tmpl.yaml`** - Nuevo template para documentación de workflows de frontend (componentes, estado, consumo de APIs, lógica de negocio, flujos de usuario)

### Cambiado
- **`/analyze-frontend-service` rediseñado** - Ahora genera documentación usando templates estándar (Frontend Architecture, Frontend Workflows, Service Guide) similar al comando de backend. Estructura de salida actualizada a `docs/architecture/`, `docs/workflows.md`, `docs/service-guide.md`
- **`/analyze-backend-service` mejorado** - Instrucciones importantes movidas a la sección Instructions para mejor legibilidad
- **`db-schema-tmpl.yaml` renombrado** - "Database Schemas Document" → "Database Schema Document" (singular, consistente con el uso)
- **`index.md` actualizado** - Nueva referencia al template de Frontend Workflows y estructura de documentación de frontend simplificada

---

## [1.4.0] - 2025-12-29

### Agregado
- **`service-guide-tmpl.yaml`** - Nuevo template para documentación de onboarding de desarrolladores (módulos, flujos, desarrollo local, troubleshooting)

### Cambiado
- **`/analyze-backend-service` rediseñado** - Ahora genera documentación usando los templates estándar (Backend Architecture, API REST Interface, Database Schema, Service Guide) en lugar de formatos ad-hoc. Cada sección requiere aprobación del usuario via task "Create doc"
- **`/consolidate-product-docs` simplificado** - Ahora **copia** la documentación ya aprobada en lugar de regenerarla. Solo genera service-map.md y technical-debt.md. PRD inferido es opcional
- **Merge de DB schemas mejorado** - Cuando dos servicios definen la misma BD, muestra diferencias al usuario y pide resolver conflictos en lugar de crear secciones duplicadas
- **`index.md` actualizado** - Nuevas ubicaciones para documentación de servicios (`docs/api.md`, `docs/service-guide.md`, `docs/db-schemas/`)

---

## [1.3.0] - 2025-12-21

### Agregado
- **`METHODOLOGY.md`** - Nuevo archivo de referencia rápida para Claude con información sobre flujos de trabajo, contextos de uso y estructura de carpetas
- **Manual Testing Guide en `/implement-task-back`** - Guía detallada con endpoints, cURL commands, edge cases y verificación de BD
- **Manual Testing Guide en `/implement-task-front`** - Guía detallada con step-by-step instructions, edge cases, responsive testing y user flows
- **Auto-completado de stories en `/implement-task-*`** - Verifica si todos los servicios están completados y actualiza el estado de la story a "Completed"

---

## [1.2.4] - 2025-12-19

### Cambiado
- **Protección de `local-config.yaml`** - El archivo de configuración local ahora está protegido en `/update-tools` y nunca se sobrescribe durante actualizaciones

---

## [1.2.3] - 2025-12-19

### Cambiado
- **Auto-completado de stories** - Los comandos `/implement-story-back` e `/implement-story-front` ahora verifican si todos los servicios están completados y automáticamente cambian el estado de la story a "Completed"

---

## [1.2.2] - 2025-12-19

### Agregado
- **Archivos protegidos en `/update-tools`** - Soporte para archivos que NUNCA se sobrescriben durante actualizaciones (ej: `settings.local.json`). Se preservan automáticamente sin preguntar al usuario

---

## [1.2.1] - 2025-12-19

### Cambiado
- **Commits sin marcas de Claude** - Los comandos de implementación (`implement-story-back`, `implement-story-front`, `implement-task-back`, `implement-task-front`, `implement-quick-task`) ahora incluyen instrucción explícita de no agregar footers ni referencias a Claude/AI en los commits

---

## [1.2.0] - 2025-12-19

### Agregado
- **`/implement-story-back`** - Nuevo comando para implementar todas las tareas de una story completa en backend, con verificación de calidad por tarea y revisión final del usuario
- **`/implement-story-front`** - Nuevo comando para implementar todas las tareas de una story completa en frontend, con verificación de calidad por tarea y revisión final del usuario

### Cambiado
- **Mejora en `/create-quick-task`** - Agregado contexto de lectura de PRD, arquitecturas, APIs y schemas para mejor entendimiento del producto

---

## [1.1.2] - 2025-12-19

### Cambiado
- **Estandarización de `local-config.yaml`** - Todos los comandos ahora incluyen la línea consistente para leer configuración local
- **Simplificación de comandos de implementación** - Eliminada sección "Resolve Document Paths" redundante en `implement-task-back`, `implement-task-front`, `implement-quick-task`, `planify-story` y `create-quick-task`, reemplazada por contexto simplificado
- **Corrección en `planify-epic`** - Cambiado "stories" por "epics" en la lectura de contexto existente

### Corregido
- **Título del README** - Corregido de "Claude PROD Documentation" a "Grava Workflow"
- **Referencia a templates en `change-technical-definition`** - Agregada lista de templates a respetar al modificar documentos

---

## [1.1.1] - 2025-12-15

### Cambiado
- **Backups movidos a `/tmp`** - Ya no se crea `.claude-backups` en el repositorio, manteniendo el workspace limpio
- **Nueva lógica de conflictos `.bkp`** - Al preservar archivos modificados:
  - El archivo **nuevo** queda con el nombre original
  - El archivo **modificado del usuario** se guarda como `.bkp` para revisión

---

## [1.1.0] - 2025-12-15

### Cambiado
- **Renombrado `/update-methodology` a `/update-tools`** - Nombre más claro y conciso
- **URL del repositorio cambiada a SSH** - Usa `git@git.grava.io` en lugar de HTTPS para evitar problemas de permisos

### Agregado
- **Script `update-tools.sh`** - Nueva carpeta `.claude/scripts/` con script bash que maneja toda la lógica de actualización:
  - Versionado semántico
  - Detección de modificaciones locales
  - Backups automáticos
  - Actualización con o sin preservación de cambios
  - Verificación post-actualización
- **Comando `/update-tools` simplificado** - Reduce consumo de tokens delegando lógica al script

### Eliminado
- Comando `/update-methodology` (reemplazado por `/update-tools`)

---

## [1.0.0] - 2024-12-15

### Agregado
- **Flujo para proyectos nuevos (Top-Down)**
  - `/create-prd` - Crear Product Requirements Document
  - `/create-backend-architecture` - Crear arquitectura backend
  - `/create-frontend-architecture` - Crear arquitectura frontend
  - `/define-database-schema` - Definir esquemas de BD
  - `/define-service-api` - Definir APIs REST
  - `/create-adr` - Crear Architecture Decision Records

- **Flujo para proyectos existentes (Bottom-Up)**
  - `/analyze-backend-service` - Análisis exhaustivo de backend
  - `/analyze-frontend-service` - Análisis exhaustivo de frontend
  - `/consolidate-product-docs` - Consolidar documentación de servicios

- **Comandos de desarrollo**
  - `/create-story` - Crear stories
  - `/planify-story` - Dividir story en tareas
  - `/implement-task-back` - Implementar tarea backend
  - `/implement-task-front` - Implementar tarea frontend

- **Quick Tasks**
  - `/create-quick-task` - Crear quick tasks (fix, chore, refactor, hotfix)
  - `/implement-quick-task` - Implementar quick tasks

- **Mantenimiento**
  - `/change-technical-definition` - Modificar definiciones técnicas
  - `/update-methodology` - Actualizar la metodología

- **Agentes especializados**
  - Analyst Agent
  - Technical Leader Agent
  - Backend Developer Agent
  - Frontend Developer Agent
  - Database Architector Agent

- **Templates YAML**
  - PRD, arquitecturas backend/frontend, APIs, DB schemas
  - Stories, tasks, task index
  - Quick tasks
  - Analysis summary, improvement notes, integrations, service map

- **Sistema de documentación**
  - Task `create-doc` con soporte para sharding
  - Index centralizado de ubicaciones
  - Soporte para aprobación sección por sección

### Notas
- Primera versión estable de la metodología
- Documentación en español
- Soporte para múltiples servicios por producto
