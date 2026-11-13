---
document: UX Survey
service: web
repo_path: web/
date: 2026-08-18
status: relevamiento
---

# UX Survey: web

> **Relevamiento del estado actual** del frontend `web`, extraído del código.
> No es documentación UX: es el insumo que `/product-consolidate-services` transcribe
> para armar `docs/ux/`. Cada dato cita su origen. Lo que el código no dice —audiencias,
> JTBD, el porqué de cada decisión— no está acá y se releva en la entrevista.

## Stack de UI

| Aspecto | Valor | Origen |
|---|---|---|
| Framework | Next.js 16.1.1 (App Router) + React 19.2.3 | `web/package.json` |
| Styling | Sass 1.97 + CSS Modules (117 módulos) + custom properties en `:root` | `web/src/styles/`, `web/next.config.js:17-24` |
| Librería de componentes | ninguna. 33 componentes propios en `src/shared/components/ui/` | `web/src/shared/components/ui/` |
| Componentes de terceros con UI | `react-select` (selects con búsqueda/agrupados), `react-datepicker`, `easymde` vía `react-simplemde-editor`, `react-toastify`, `react-markdown` | `web/package.json` |
| i18n | **ninguna.** Todos los textos están hardcodeados en JSX o en constantes de módulo, en español | sin dependencia de i18n en `package.json` |
| Tipografía | Archivo (Google Fonts), pesos 100/400/500/600/700, expuesta como `--font-primary` | `web/src/app/layout.tsx:6-10` |
| Iconografía | SVG y PNG propios en `src/assets/`. Recoloreo por CSS mask vía `<TintedIcon>`. Algunos SVG inline en JSX | `web/src/assets/`, `_mixins.scss:437-451` |

## Breakpoints

**Origen:** `web/src/styles/_mixins.scss` — declarados como mixins, no como variables.

| Token | Media query | Origen |
|---|---|---|
| `mobile` | `max-width: 767px` | `_mixins.scss:318` |
| `tablet` | `min-width: 768px` y `max-width: 1023px` | `_mixins.scss:324` |
| `desktop` | `min-width: 1024px` | `_mixins.scss:330` |
| `large-desktop` | `min-width: 1440px` | `_mixins.scss:336` |

## Viewports en uso

| Mecanismo | Ocurrencias | Ejemplos |
|---|---|---|
| `@include mobile` | 6 en 5 archivos | `ClientListFilters.module.scss:19`, `ObjectiveDetails.module.scss:106`, `SummaryCards.module.scss:8`, `ReportPage.module.scss:13,24`, `ProjectDetails.module.scss:25` |
| `@include tablet` | 0 | — |
| `@include desktop` | 0 | — |
| `@include large-desktop` | 0 | — |
| `@media (max-width: 1023px)` cruda | 2 | `RequirementHeader.module.scss:10`, `RequirementDetail.module.scss:12` |
| `@media (max-width: 1024px)` cruda | 2 | `CreateRequirementForm.module.scss:94`, `EditRequirementForm.module.scss:94` |
| `@media (max-width: 640px)` cruda | 3 | `CreateRequirementForm.module.scss:322,479`, `EditRequirementForm.module.scss:416` |
| `@media (max-width: 1200px)` cruda | 1 | `app/(loggedin)/projects/[id]/styles.module.scss:85` |
| `@media (max-width: 900px)` cruda | 1 | `app/(loggedin)/clients/edit/[id]/styles.module.scss:108` |
| `@media (min-width: 1680px)` cruda | 1 | `ObjectivesGroup.module.scss:93` |
| `useMediaQuery` / `matchMedia` / `innerWidth` en JS | 0 en código de producción | única mención en `RequirementDetail.test.tsx:133` (comentario de un test) |

**Conclusión:** la superficie se comporta como **un solo viewport, `desktop`**.

La evidencia decisiva no está en los conteos de arriba sino en el shell: el layout de la
aplicación no tiene ningún media query.

```scss
/* web/src/app/(loggedin)/styles.module.scss:1-26 */
.layoutContainer { display: flex; height: 100vh; overflow: hidden; }
.sidebarContainer { width: 290px; height: 100vh; overflow-y: auto; }
.mainContainer { flex: 1; height: 100vh; overflow-y: auto; padding: 1rem 2rem; }
```

La sidebar ocupa 290 px fijos a cualquier ancho, no hay drawer, no hay botón de hamburguesa y no
hay ningún estado colapsado. A 400 px de ancho el contenido queda con ~46 px útiles. **No hay
navegación posible en mobile**, así que el tratamiento responsive que sí existe en 11 archivos
aplica a un contenido al que no se puede llegar desde un teléfono.

**No hay un breakpoint "real" de corte.** Los 11 archivos con tratamiento responsive usan 6 valores
distintos (640, 767, 900, 1023, 1024, 1200) sin coordinación: dos pantallas hermanas del mismo
dominio cortan en 1023 y en 1024. `tablet`, `desktop` y `large-desktop` están declarados y sin usar.

> **A resolver en consolidación, no acá:** si `desktop` único es una decisión de producto o una
> deuda. El código no lo dice. Si se decide soportar mobile, el shell es el primer trabajo, no los
> 11 archivos que ya tienen media queries.

## Tokens de diseño

**Origen:** `web/src/styles/_variables.scss` (~70 custom properties en `:root`).

> **Los tokens están declarados dos veces.** `web/src/app/globals.scss:4-77` redeclara el mismo
> `:root` con los mismos valores, además de hacer `@use '@/styles/variables'` en su primera línea.
> Al consolidar hay que tomar `_variables.scss` como fuente y registrar la duplicación como gap.

### Paleta

| Nombre en código | Valor | Uso observado |
|---|---|---|
| `--color-general-primary` | `#FF3C3C` | Título del login, textos de error del login |
| `--color-button` | `#DA2C6A` | Botón primario, día seleccionado del datepicker, opción seleccionada de `react-select` |
| `--color-button-delete` | `#FB033F` | Botón de borrado, borde de input con error |
| `--color-highlighted` | `rgb(54, 0, 136)` | Outline de foco de inputs y selects |
| `--color-general-title` | `#1F2633` | Títulos `h1`/`h2`, texto de `<span>` |
| `--color-general-text` | `#5f6d7f` | Texto de párrafo, labels, placeholders |
| `--color-general-background` | `#F5F2F0` | Fondo del `body` y del área de contenido |
| `--color-general-border` | `#E2E8F0` | Borde de inputs |
| `--color-general-disabled` | `#D9D9D9` | Fondo de `th`, bordes de tabla, botón secundario |
| `--color-background` | `#ffffff` | Superficie de cards e inputs |
| `--color-surface-light` | `#f5f5f5` | Fondo de la sidebar, panel derecho del login |
| `--color-surface-hover` | `#e0e0e0` | Hover de fila de tabla |
| `--color-surface-alt` | `#f8f9fa` | — |
| `--color-tooltip-bg` | `#625F5F` | Fondo de tooltip |
| `--color-text-dark` / `-muted` / `-light` / `-placeholder` | `#222` / `#666` / `#888` / `#a0aec0` | Jerarquía de texto secundaria |
| `--color-border-light` / `-default` / `-medium` | `#ccc` / `#ddd` / `#e5e5e5` | Tres grises de borde sin nombre semántico |
| `--color-link` | `#0000ff` | — |
| `--color-link-primary` / `-hover` | `#ed2c6c` / `#a31342` | Links de acento |

**Colores de estado de proyecto:** `--color-status-analisis` `#208CEF` · `-activo` `#2EBE27` ·
`-cancelado` `#FB033F` · `-inactivo` `#5F6D7F` · `-finalizado` `#B8CBDD` · `-backlog` `#5F6D7F` ·
`-en-revision` `#208CEF`.

> `-inactivo` y `-backlog` son el mismo valor; `-analisis` y `-en-revision` también. Dos pares de
> estados distintos son visualmente indistinguibles.

**Colores de área de tarea:** `--color-area-diseño` `#6B5FF8` · `-gestion` `#9AD183` ·
`-desarrollo` `#06DAF6` · `-investigacion` `#FF6363`. La clave `diseño` lleva `ñ`.

**Colores de prioridad (0→5):** `#FBC403` · `#ffa800` · `#ff8b04` · `#FB6B03` · `#ff472f` ·
`#FB033F` — gradiente amarillo→rojo.

**Colores de etapa:** 7 pares texto/fondo (`--color-stage-{scope,support,date,active,finished,hours,month}`
y su `-bg`).

**Colores de vencimiento de tarea:** `--color-objective-close-to-deadline` `#DA2C6A` ·
`-expired` `#FB2A2A` · `-finished` `#AAAAAA`.

**Badges:** `--color-badge-active` `#2e7d32` / `-bg` `#e8f5e8` · `-finished` `#757575` / `-bg` `#f5f5f5`.

### Tipografía

| Token | Tamaño | Uso observado |
|---|---|---|
| `--font-size-xs` | 0.625rem (10px) | Tags y badges (`tag-base`) |
| `--font-size-sm` | 0.75rem (12px) | Labels (`label-text`), `p` global |
| `--font-size-base` | 0.875rem (14px) | Texto de inputs y botones |
| `--font-size-md` | 1rem (16px) | `h2`, label de `PageLayout` |
| `--font-size-lg` | 1.25rem (20px) | `span` global |
| `--font-size-xl` | 1.5rem (24px) | — |
| `--font-size-2xl` | 2rem (32px) | `h1` |

Pesos: `--font-weight-normal` 400 · `-medium` 500 · `-semibold` 600 · `-bold` 700 ·
`-extrabold` 800.

Line heights: `--line-height-tight` 1.25 · `-normal` 1.5 · `-relaxed` 1.75.

> **Los estilos de elemento en `globals.scss` compiten con la escala.** `globals.scss:189-207`
> define `h1 { font-size: 2rem; line-height: 2rem }`, `h2 { 1rem/1rem }`, `p { 0.75rem/0.75rem }` y
> `span { font-size: 1.25rem }`. Los `line-height` iguales al `font-size` hacen que el texto de más
> de una línea se toque. Y `span` a 20px es más grande que el `p` que lo contiene, lo que explica
> por qué muchos módulos redefinen el tamaño de sus `span`.

### Espaciado

Escala propia en `rem`, base 4px:

| Token | Valor |
|---|---|
| `--spacing-xs` | 0.25rem (4px) |
| `--spacing-sm` | 0.5rem (8px) |
| `--spacing-md` | 1rem (16px) |
| `--spacing-lg` | 1.5rem (24px) |
| `--spacing-xl` | 2rem (32px) |
| `--spacing-2xl` | 3rem (48px) |

**Uso real:** los módulos usan mayoritariamente valores literales en `rem` (`1.25rem`, `0.75rem`,
`1.375rem`) en vez de los tokens. `1.25rem` es el gap más frecuente en los layouts de dos columnas
y **no está en la escala**.

### Otros

Radios: `--radius-items` 0.5rem (inputs, tags, botones) · `--radius-cards` 1rem ·
`--radius-buttons` 0.5rem. Varios módulos usan `10px` literal (`RequirementDetail.module.scss:29`).

Sombras: `--box-shadow` y `--box-shadow-hover`, ambas de dos capas.

Transiciones: `--transition-fast` 150ms · `-base` 200ms · `-slow` 300ms, todas `ease`.

Z-index: `--z-index-dropdown` 100 · `-modal` 200 · `-tooltip` 300 · `-navbar` 400.

> `--z-index-navbar` (400) es **mayor** que `-modal` (200) y `-tooltip` (300). La sidebar usa
> `z-index: 10` literal (`(loggedin)/styles.module.scss:15`), no el token.

## Rutas y pantallas

**Origen:** `web/src/app/` (App Router). 25 rutas, 3 layouts, 4 `loading.tsx`, 5 `error.tsx`.

Auth: `sí` = dentro del grupo `(loggedin)`, protegido por `auth()` + `redirect` en
`(loggedin)/layout.tsx:13-21`. No hay `middleware.ts`.

| # | Ruta | Pantalla | Auth | Archivo | Survey |
|---|---|---|---|---|---|
| 1 | `/` | home-vacia | no | `app/page.tsx` | [screens/home-vacia.md](./screens/home-vacia.md) |
| 2 | `/login` | login | no | `app/login/page.tsx` | [screens/login.md](./screens/login.md) |
| 3 | `/login/enter` | login-entrada | no | `app/login/enter/page.tsx` | [screens/login-entrada.md](./screens/login-entrada.md) |
| 4 | `/unauthorized` | sin-permisos | no | `app/unauthorized/page.tsx` | [screens/sin-permisos.md](./screens/sin-permisos.md) |
| 5 | `/clients` | listado-actores | sí | `app/(loggedin)/clients/page.tsx` | [screens/listado-actores.md](./screens/listado-actores.md) |
| 6 | `/clients/new` | alta-actor | sí | `app/(loggedin)/clients/new/page.tsx` | [screens/alta-actor.md](./screens/alta-actor.md) |
| 7 | `/clients/edit/[id]` | edicion-actor | sí | `app/(loggedin)/clients/edit/[id]/page.tsx` | [screens/edicion-actor.md](./screens/edicion-actor.md) |
| 8 | `/projects` | listado-proyectos | sí | `app/(loggedin)/projects/page.tsx` | [screens/listado-proyectos.md](./screens/listado-proyectos.md) |
| 9 | `/projects/[id]` | detalle-proyecto | sí | `app/(loggedin)/projects/[id]/page.tsx` | [screens/detalle-proyecto.md](./screens/detalle-proyecto.md) |
| 10 | `/projects/new` | alta-proyecto | sí | `app/(loggedin)/projects/new/page.tsx` | [screens/alta-proyecto.md](./screens/alta-proyecto.md) |
| 11 | `/projects/edit/[id]` | edicion-proyecto | sí | `app/(loggedin)/projects/edit/[id]/page.tsx` | [screens/edicion-proyecto.md](./screens/edicion-proyecto.md) |
| 12 | `/requirements` | listado-requisitos | sí | `app/(loggedin)/requirements/page.tsx` | [screens/listado-requisitos.md](./screens/listado-requisitos.md) |
| 13 | `/requirements/[reqid]` | detalle-requisito | sí | `app/(loggedin)/requirements/[reqid]/page.tsx` | [screens/detalle-requisito.md](./screens/detalle-requisito.md) |
| 14 | `/requirements/new` | alta-requisito | sí | `app/(loggedin)/requirements/new/page.tsx` | [screens/alta-requisito.md](./screens/alta-requisito.md) |
| 15 | `/requirements/[reqid]/edit` | edicion-requisito | sí | `app/(loggedin)/requirements/[reqid]/edit/page.tsx` | [screens/edicion-requisito.md](./screens/edicion-requisito.md) |
| 16 | `/requirements/report` | reporte-requisitos | sí | `app/(loggedin)/requirements/report/page.tsx` | [screens/reporte-requisitos.md](./screens/reporte-requisitos.md) |
| 17 | `/objectives` | listado-tareas | sí | `app/(loggedin)/objectives/page.tsx` | [screens/listado-tareas.md](./screens/listado-tareas.md) |
| 18 | `/objectives/[id]` | detalle-tarea | sí | `app/(loggedin)/objectives/[id]/page.tsx` | [screens/detalle-tarea.md](./screens/detalle-tarea.md) |
| 19 | `/objectives/new` | alta-tareas | sí | `app/(loggedin)/objectives/new/page.tsx` | [screens/alta-tareas.md](./screens/alta-tareas.md) |
| 20 | `/objectives/edit/[id]` | edicion-tarea | sí | `app/(loggedin)/objectives/edit/[id]/page.tsx` | [screens/edicion-tarea.md](./screens/edicion-tarea.md) |
| 21 | `/objectives/by-project` | tareas-por-proyecto | sí | `app/(loggedin)/objectives/by-project/page.tsx` | [screens/tareas-por-proyecto.md](./screens/tareas-por-proyecto.md) |
| 22 | `/objectives/by-responsible` | tareas-por-responsable | sí | `app/(loggedin)/objectives/by-responsible/page.tsx` | [screens/tareas-por-responsable.md](./screens/tareas-por-responsable.md) |
| 23 | `/time-allocation` | asignacion-tiempo | sí | `app/(loggedin)/time-allocation/page.tsx` | [screens/asignacion-tiempo.md](./screens/asignacion-tiempo.md) |
| 24 | `/worked-times` | carga-horas | sí | `app/(loggedin)/worked-times/page.tsx` | [screens/carga-horas.md](./screens/carga-horas.md) |
| 25 | `/worked-times/report` | reporte-horas | sí | `app/(loggedin)/worked-times/report/page.tsx` | [screens/reporte-horas.md](./screens/reporte-horas.md) |

### Chrome compartido

El shell de `(loggedin)/layout.tsx` envuelve las 21 pantallas autenticadas y **no se repite en cada
survey**:

| Bloque | Tipo | Componente real | Origen |
|---|---|---|---|
| sidebar-navegacion | `sidebar` | `<Navbar>` | `(loggedin)/layout.tsx:25-27`, `Navbar.tsx` |
| area-contenido | `main` | `<main>` con `<Suspense>` | `(loggedin)/layout.tsx:28-30` |
| contenedor-toasts | `toast` | `<ToastContainer>` | `(loggedin)/layout.tsx:31-42` |

La navegación tiene 6 ítems (`Actores`, `Proyectos`, `Requisitos`, `Tareas`, `Asignación de
Tiempo`, `Horas Trabajadas`), 2 con subítems, más el bloque de enlaces externos configurable y
`Cerrar sesión`. Detalle en [screens/_shell.md](./screens/_shell.md).

### Overlays detectados

Ninguno es ruta. El relevamiento completo de cada uno está en
[screens/_overlays.md](./screens/_overlays.md).

| Overlay | Tipo | Disparado desde | Archivo |
|---|---|---|---|
| Vista previa de adjunto | `modal` (`role="dialog"`, `aria-modal`) | detalle-proyecto, vía botón "Preview" de un adjunto | `PreviewModal.tsx:80-134` |
| Confirmación de borrado | `modal` (`<dialog>` nativo con `showModal()`) | carga-horas (2 instancias) y detalle-proyecto (adjuntos) | `ConfirmDialog.tsx:51-70` |
| Dropdown de estado de tarea | `dropdown` | listado-tareas y las cards de tarea, desde el tag de estado | `StateTag.tsx:81-100` |
| Pills-dropdown de estado/tipo/prioridad | `dropdown` (`role="listbox"`) | detalle-requisito, header | `RequirementHeader.tsx:98-145` |
| Dropdown de tipo de proyecto | `dropdown` (checkboxes) | reporte-horas | `ProjectTypeFilterDropdown.tsx:62-90` |
| Date-picker de fecha de cierre | `dropdown` (por portal) | tareas-por-proyecto, tareas-por-responsable — desde la etiqueta de fecha de una card | `FinishDateLabel.tsx:175-191` |
| Menú de `react-select` | `dropdown` | 6 pantallas con selects de búsqueda | `react-select`, estilos inline por pantalla |
| Tooltip | `tooltip` | transversal (10 usos) | `Tooltip.tsx` |
| Acordeón de campos de estado | in-place, no overlay | detalle-requisito | `RequirementStatusCard.tsx:115-145` |
| Cajón de actores | `modal` lateral | **ninguno — código muerto** | `ClientsDrawer.tsx` |

## Inventario de componentes

### Compartidos — `src/shared/components/ui/` (33)

Usos = ocurrencias de la etiqueta JSX fuera del propio archivo del componente y de los tests.

| Componente | Archivo | Usos | Variants observadas | ¿Candidato a DS? |
|---|---|---|---|---|
| `Button` | `ui/Button/Button.tsx` | 29 | `variant`: primary, secondary · `size`: normal, small · `loading`, `disabled` | **sí** |
| `Loader` | `ui/Loader/Loader.tsx` | 25 | prop `label` (12 valores distintos) | **sí** |
| `InputSelect` | `ui/InputSelect/InputSelect.tsx` | 18 | `error` | **sí** |
| `TintedIcon` | `ui/TintedIcon/TintedIcon.tsx` | 11 | color y tamaño por props | **sí** |
| `Tooltip` | `ui/Tooltip/Tooltip.tsx` | 10 | `disableTooltip` | **sí** |
| `InputText` | `ui/InputText/InputText.tsx` | 8 | `error` | **sí** |
| `SectionCard` | `ui/SectionCard/SectionCard.tsx` | 7 | — | **sí** |
| `Spinner` | `ui/Spinner/Spinner.tsx` | 5 | — | **sí** |
| `InputTextarea` | `ui/InputTextarea/InputTextarea.tsx` | 4 | `error` | **sí** |
| `ToggleGroup` | `ui/ToggleGroup/ToggleGroup.tsx` | 3 | genérico sobre `T extends string` | **sí** |
| `ConfirmDialog` | `ui/ConfirmDialog/ConfirmDialog.tsx` | 3 | `confirmLabel`, `cancelLabel`, `actionsDisabled` | **sí** |
| `InputDate` | `ui/InputDate/InputDate.tsx` | 2 | `error` | sí |
| `InputMultiplePersons` | `ui/InputMultiplePersons/InputMultiplePersons.tsx` | 2 | `error` | sí |
| `DateLabel` | `ui/DateLabel/DateLabel.tsx` | 2 | `cardClass` | sí |
| `AddButton` | `ui/AddButton/AddButton.tsx` | 1 | — | sí |
| `CommentEditor` | `ui/CommentEditor/CommentEditor.tsx` | 1 | — | revisar |
| `FinishDateLabel` | `ui/FinishDateLabel/FinishDateLabel.tsx` | 1 | — | revisar |
| `MarkdownEditorWithPreview` | `ui/MarkdownEditorWithPreview/…` | 1 | `initialMode`: edit, preview | revisar |
| `Pagination` | `ui/Pagination/Pagination.tsx` | 1 | — | **no — ver nota** |
| `InlineCommentEditor` | `ui/InlineCommentEditor/…` | 1 (dentro de `CommentEditor`) | — | revisar |
| `AttachmentPreview` | `ui/AttachmentPreview/…` | 2 | — | revisar |
| `AttachmentSkeleton` | `ui/AttachmentSkeleton/…` | 1 (dentro de `RichTextEditor`, muerto) | — | revisar |
| `AttachFileButton` | `ui/AttachFileButton/…` | 1 | — | revisar |
| `DatePicker` | `ui/DatePicker/DatePicker.tsx` | 1 (dentro de `FinishDateLabel`) | — | revisar |
| `Select` | `ui/Select/Select.tsx` | 15 | — | **sí** |
| `RichTextEditor` | `ui/RichTextEditor/…` | 1 (dentro de `RequirementRichTextEditor`) | — | revisar |
| `Card` | `ui/Card/Card.tsx` | **0** | — | **no — muerto** |
| `Header` | `layout/Header/Header.tsx` | **0** | — | **no — muerto** |
| `Input` | `ui/Input/Input.tsx` | **0** | — | **no — muerto** |
| `Textarea` | `ui/Textarea/Textarea.tsx` | **0** | — | **no — muerto** |
| `MarkdownEditor` | `ui/MarkdownEditor/…` | **0** | — | **no — muerto** |
| `MultiSelect` | `ui/MultiSelect/MultiSelect.tsx` | **0** | — | **no — muerto** |
| `AttachmentDownload` | `ui/AttachmentDownload/…` | **0** | — | **no — muerto** |
| `InputMultipleSelect` | `ui/InputMultipleSelect/…` | 1 | — | revisar |

> **`Pagination` no es reutilizable.** Hardcodea `router.push('/objectives?...')`
> (`Pagination.tsx:35`), así que solo funciona en `/objectives`. Es la causa de que haya 4
> paginaciones reimplementadas inline (ver "Patrones repetidos").

### Layout — `src/shared/components/layout/` (5)

| Componente | Usos | Notas |
|---|---|---|
| `PageLayout` | 15 | Título + label opcional + array de `actions`. Usa `next/head`, sin efecto en App Router |
| `Navbar` | 1 | El shell de navegación completo |
| `NavItem` | 3 | Ítem de primer nivel |
| `NavSubItem` | 3 | Subítem |
| `Header` | **0** | Muerto |

### De dominio — `src/features/*/components/` (72)

Los que aparecen en más de una pantalla, y por eso son candidatos a DS o a patrón:

| Componente | Usos | Aparece en |
|---|---|---|
| `MarkdownViewer` | 8 | Descripciones y comentarios en 6 pantallas |
| `StateTag` | 3 | listado-tareas, cards de tarea (dropdown de cambio de estado inline) |
| `AreaTag` | 3 | listado-tareas, cards de tarea |
| `ProjectPriorityTag` | 3 | listado-proyectos, detalle-proyecto, detalle-tarea |
| `RequirementRichTextEditor` | 3 | alta/edición de requisito, formulario de actividad |
| `TagProject` | 2 | base de `ProjectTypeTag` y `ProjectPriorityTag` |
| `ProjectTypeTag` | 2 | listado-proyectos, detalle-proyecto |
| `ObjectiveCard` | 2 | tareas-por-proyecto, tareas-por-responsable |
| `ProjectCard` | 2 | listado-proyectos, detalle de actor expandido |
| `ObjectivesGroup` | 2 | tareas-por-proyecto, tareas-por-responsable |

### Patrones repetidos sin componente

| Patrón | Repeticiones | Archivos |
|---|---|---|
| **Paginación con elipsis** — flechas prev/next, números con `'ellipsis'` colapsado, y `<select>` de "N por página" | 4 | `RequirementList.tsx:196-247`, `ProjectObjectivesSection.tsx:159-205`, `ProjectRequirementsSection.tsx:164-210`, `RequirementDetail.tsx:227-280` |
| **Objeto `selectStyles` de `react-select`** | 6 | `projects/new/page.tsx:87-138`, `projects/edit/[id]/page.tsx:~90-153`, `RequirementFilters.tsx:40-95`, `CreateRequirementForm.tsx:60-190`, `WorkedTimesPage.tsx:33-45`, `TargetSelector.tsx:30-50` |
| **Tabs por estado con contador** — `<nav>` + botones con `tabLabel` y `tabCount` | 3 | `ProjectObjectivesSection.tsx:87-102`, `ProjectRequirementsSection.tsx:98-113`, `RequirementDetail.tsx:159-180` |
| **Sección de filtros de listado** — `<section>` con búsqueda con debounce 500ms + N selects que escriben en `searchParams` | 3 | `ClientListFilters.tsx`, `ProjectListFilters.tsx`, `ObjectiveSearchFilters.tsx` |
| **Header de página con "Volver" + acción** — dos links/botones a la derecha del `h1` | 4 | `projects/[id]/page.tsx:31-41`, `projects/new/page.tsx:231-246`, `RequirementHeader.tsx:206-213`, `CreateRequirementForm.tsx:377-394` |
| **Tabla de tareas embebida** — mismas 5 columnas (ID, Título, Responsable, Creación, Cierre estimado) | 3 | `ProjectObjectivesSection.tsx:105-157`, `RequirementDetail.tsx:185-225`, `ProjectInactiveObjectivesTable.tsx` (muerto) |
| **Formateo de lista de personas** — `formatPersons` / `formatResponsibles` con "+N" y `title` con la lista completa | 4 | `ProjectObjectivesSection.tsx:33-45`, `ProjectRequirementsSection.tsx:46-52`, `RequirementList.tsx:55-70`, `RequirementDetail.tsx:42-66` |
| **Mapa de etiquetas de estado/prioridad/tipo de requisito** — `STATE_LABELS`, `PRIORITY_LABELS` redeclarados | 5 | `RequirementList.tsx:21-37`, `RequirementHeader.tsx:32-55`, `RequirementStatusCard.tsx:31-38`, `RequirementActivityFeed.tsx:14-21`, `ProjectRequirementsSection.tsx:18-34` |
| **Fila expandible con chevron** — botón que togglea, chevron `▼`/`▶`, contenido debajo | 3 | `ClientCard.tsx:52-67`, `HierarchicalTable.tsx` (4 niveles), `RequirementStatusCard.tsx:116-123` |

## Gaps detectados

| Pantalla | Gap | Categoría | Evidencia |
|---|---|---|---|
| todas las autenticadas | Sin navegación en mobile: sidebar de 290px fija, sin drawer ni hamburguesa | responsive | `(loggedin)/styles.module.scss:1-26` — ningún media query |
| home-vacia | La pantalla no hace nada: `<h1>Home</h1>`, con el `redirect('/clients')` comentado | funcionalidad ausente | `app/page.tsx:3-13` |
| home-vacia | Es el destino del login: `/login/enter` redirige a `/` | flujo roto | `login/enter/page.tsx:8` |
| listado-actores | Sin estado de error de query | estado ausente | `ClientsBoard.tsx:70` — solo desestructura `isLoading` |
| listado-actores | Typo en microcopy: `"Cargando  ..."` (doble espacio) | microcopy | `clients/page.tsx:29` |
| listado-actores | El filtro por estado se aplica en memoria después de traer todo | performance | `ClientsBoard.tsx:17-45` |
| listado-actores | Al cambiar filtro no se resetea `page` | estado inconsistente | `ClientListFilters.tsx:21-34` |
| listado-proyectos | Typo en microcopy: `"Cagando..."` | microcopy | `projects/page.tsx:30` |
| listado-proyectos | Sin estado de error de query | estado ausente | `ProjectsBoard.tsx:11-13` — solo chequea largo |
| listado-proyectos | Al cambiar filtro no se resetea `page` | estado inconsistente | `ProjectListFilters.tsx:21-34` |
| detalle-proyecto | Card vacía renderizada entre secciones | bloque residual | `projects/[id]/page.tsx:51` — `<div className={styles.card}></div>` |
| detalle-proyecto | Sin manejo de proyecto inexistente: `useProject` sin `isError`, queda en loader | estado ausente | `projects/[id]/page.tsx:25-27` |
| detalle-proyecto | Sin `error.tsx` propio; el de `/projects` cubre la subruta | estado ausente | no existe `projects/[id]/error.tsx` |
| listado-requisitos | Sin estado de error de query | estado ausente | `RequirementList.tsx:74` |
| listado-requisitos | La paginación no sabe el total: el botón "siguiente" se habilita comparando `length >= limit` | funcionalidad parcial | `RequirementList.tsx:218,231` |
| listado-requisitos | Sin `error.tsx` en la ruta | estado ausente | no existe `requirements/error.tsx` |
| detalle-requisito | Sin estado de error: `RequirementDetailContainer` cae a `initialRequirement` sin avisar | estado ausente | `RequirementDetailContainer.tsx:19` |
| listado-tareas | `error.tsx` descarta el error y muestra `"Error inesperado"` fijo | estado degradado | `objectives/error.tsx:5-11` |
| listado-tareas | Sin estado de error de query | estado ausente | `ObjectivesTable.tsx:56-58` |
| detalle-tarea | Sin manejo de tarea inexistente: `getObjectiveById` sin try/catch ni `notFound()` | estado ausente | `objectives/[id]/page.tsx:12` |
| tareas-por-proyecto | Fallo de la api indistinguible de "no hay datos": `catch` → `console.error`, lista vacía sin mensaje | estado ausente | `objectives/by-project/page.tsx:9-13` |
| tareas-por-proyecto | Sin estado empty: mapea el array sin chequear largo | estado ausente | `objectives/by-project/page.tsx:19` |
| tareas-por-responsable | Mismo `catch` silencioso | estado ausente | `objectives/by-responsible/page.tsx:21-25` |
| tareas-por-responsable | Sin estado empty | estado ausente | `objectives/by-responsible/page.tsx:69` |
| alta-tareas / edicion-tarea | Mensaje de validación genérico: `"Revisá que no haya campos incompletos"` sin decir cuáles | error de validación | `objectives/new/page.tsx:408` |
| alta-proyecto / edicion-proyecto | Validación yup con `abortEarly:false` pero los errores se descartan: solo un toast `"Hay campos obligatorios sin completar"` | error de validación | `projects/new/page.tsx:184-188` |
| alta-proyecto | Sin `notFound()` ni validación del `id` en la variante de edición | not found ausente | `projects/edit/[id]/page.tsx` |
| carga-horas | Sin estado de error de las queries del día | estado ausente | `DayEntriesList.tsx:82` — solo `isLoading` |
| reporte-horas | Error solo por toast; la tabla queda vacía sin mensaje en pantalla | estado degradado | `ReportPage.tsx:96-99` |
| reporte-requisitos | Sin estado empty diferenciado del filtrado | estado ausente | `RequirementsReportTable.tsx:23-26` |
| asignacion-tiempo | Único caso con los 3 estados completos (loading, error, empty) | — *referencia positiva* | `WeeklyAllocationTable.tsx:375-392` |
| tareas-por-proyecto | Sin estado empty ni de error: un fallo de la api, un sistema sin proyectos y uno sin tareas activas dan la misma pantalla en blanco | estado ausente | `objectives/by-project/page.tsx:9-13`, `:19` |
| tareas-por-proyecto | Sin límite de volumen: renderiza todos los proyectos con todas sus tareas, sin paginación ni "ver más" | performance | `objectives/by-project/page.tsx:19` |
| tareas-por-proyecto, tareas-por-responsable | El date-picker de la fecha de cierre se abre desde un `<div onClick>` sin `role` ni `tabIndex`: escritura inalcanzable por teclado | accesibilidad | `FinishDateLabel.tsx:162-167` |
| tareas-por-proyecto, tareas-por-responsable | `<AddButton>` sin `aria-label`: su nombre accesible es `"add icon"` | accesibilidad | `AddButton.tsx:30-42` |
| listado-tareas | La barra de filtros suma 140% de ancho con `nowrap`: los últimos filtros quedan recortados sin scroll para alcanzarlos | responsive | `ObjectiveSearchFilters.module.scss:9-21`, `globals.scss:172` |
| listado-tareas, tareas-por-proyecto, tareas-por-responsable | El área de la tarea se comunica solo por color: `<span>` vacío con `data-area` y el nombre en un tooltip de `:hover` | accesibilidad | `AreaTag.tsx:32-34` |
| detalle-tarea | `"Volver"` va siempre a `/objectives/by-project`, sin importar desde dónde se entró (4 entradas posibles) | navegación | `objectives/[id]/page.tsx:21` |
| detalle-tarea | No se puede borrar una tarea ni un comentario; `<DeleteObjectiveButton>` es código muerto | funcionalidad ausente | `features/objectives/index.ts:3` |
| reporte-requisitos | No hay forma de llegar desde la UI: no está en la navegación ni la enlaza ninguna pantalla | navegación | `Navbar.tsx:58-62` |
| reporte-requisitos | Los filtros viven en estado local, no en la URL: el reporte filtrado no se puede compartir por link | estado inconsistente | `RequirementsReportPage.tsx:18-23` |
| reporte-requisitos | La tabla de 12 columnas tiene `overflow-x: auto` pero la región no es enfocable: las últimas columnas son inalcanzables por teclado | accesibilidad | `RequirementsReportTable.module.scss:1-5` |
| alta-requisito, edicion-requisito | Los mensajes de validación existen y no se muestran: el getter del estado de errores está descartado (`const [, setErrors]`) | error de validación | `CreateRequirementForm.tsx:236` |
| alta-proyecto, edicion-proyecto | Los mensajes de validación del schema se descartan en el `catch` a favor de un toast genérico | error de validación | `projects/new/page.tsx:183-188` |
| detalle-requisito | `"Resolver"` y `"Cancelar"` (transiciones terminales) no piden confirmación, mientras borrar un adjunto sí | confirmación ausente | `RequirementResolutionCard.tsx:81`, `:85` |
| edicion-requisito | El select de estado permite cualquier transición, salteando el workflow que el detalle modela con reglas | regla inconsistente | `EditRequirementForm.tsx:500-506` |
| detalle-proyecto, edicion-proyecto, edicion-actor | Error al cargar la entidad no manejado: la condición de carga nunca se resuelve → loader infinito | estado ausente | `projects/[id]/page.tsx:25-27`, `clients/edit/[id]/page.tsx:47-49` |
| reporte-horas | La tabla jerárquica de 4 niveles se expande con `<div>` clickeables sin `role`, `tabIndex`, `aria-expanded` ni teclado: el desglose de horas es inalcanzable sin mouse | accesibilidad | `HierarchicalTable.tsx:111-395` |
| reporte-horas | Sin estado empty y con el error solo por toast de 2s: un fallo se ve igual que un período sin horas | estado ausente | `ReportPage.tsx:96-99`, `:131-140` |
| reporte-horas | Sin exportación, a diferencia de reporte-requisitos que sí tiene CSV | funcionalidad ausente | `ReportPage.tsx:115-141` |
| reporte-horas | El período activo se comunica solo por color (`variant` del botón), sin `aria-pressed` | accesibilidad | `PeriodFilter.tsx:129-135` |
| carga-horas | El semáforo de días (completo/parcial/vacío) se comunica solo por color: `<span>` vacío sin texto ni `aria-label` | accesibilidad | `DaySelector.tsx:76` |
| carga-horas | Sin manejo de error de las cargas del día: un fallo se ve como `"No hay cargas para este día"` | estado ausente | `DayEntriesList.tsx:82`, `:181` |
| carga-horas | Sin tope diario: se puede registrar 20 horas en un día sin advertencia | validación ausente | `WorkedTimesPage.tsx:160`, `DaySelector.tsx:26-28` |
| carga-horas | La ventana de carga es de 8 días hábiles sin navegador de períodos: no hay forma de corregir una carga más vieja | funcionalidad ausente | `DaySelector.tsx:38-56` |
| carga-horas | La lógica de los 8 días está duplicada en dos archivos: si divergen, el semáforo deja de corresponder a los botones | duplicación | `DaySelector.tsx:38-56`, `WorkedTimesPage.tsx:66-79` |
| asignacion-tiempo | Los inputs de la grilla N×M no tienen `<label>` ni `aria-label`, y la primera celda de cada fila es `<td>` en vez de `<th scope="row">`: una celda se anuncia sin decir de qué persona ni proyecto es | accesibilidad | `EditableCell.tsx:37-44`, `WeeklyAllocationTable.tsx:415-417` |
| asignacion-tiempo | La sobreasignación se marca solo por color, sin texto ni `aria-invalid`, y no bloquea el guardado | accesibilidad | `EditableCell.module.scss:34-39` |
| asignacion-tiempo | No se explica por qué no se puede editar (rol, semana pasada, o domingo) | estado ausente | `WeeklyAllocationTable.tsx:296`, `:436` |
| asignacion-tiempo | Los cambios sin guardar se pierden al cambiar de semana, sin aviso | confirmación ausente | `WeeklyAllocationTable.tsx:190-199` |
| alta-tareas | El envío múltiple usa `Promise.all`: falla con el primer error, las creadas quedan creadas, y reintentar duplica | correctness | `objectives/new/page.tsx:136`, `:149-151` |
| alta-tareas | Los N formularios no tienen encabezado ni número: los botones "Borrar"/"Clonar" son indistinguibles entre sí | accesibilidad | `objectives/new/page.tsx:269-424` |
| edicion-tarea | El proyecto no es editable (`<InputText disabled>`) y nada explica por qué ni cómo mover la tarea | estado ausente | `objectives/edit/[id]/page.tsx:254-261` |
| tareas-por-responsable | Las tareas sin responsable no aparecen en ningún grupo: quedan fuera de la vista | funcionalidad ausente | `objectives/by-responsible/page.tsx:38-48` |
| tareas-por-responsable | Sin estado empty ni de error, igual que tareas-por-proyecto | estado ausente | `objectives/by-responsible/page.tsx:20-25`, `:69` |
| todos los overlays | Ningún modal atrapa el foco ni lo devuelve al disparador al cerrar, salvo `ConfirmDialog` que usa `<dialog>` nativo | accesibilidad | `PreviewModal.tsx:80` (solo `Escape`), `ConfirmDialog.tsx:51` |
| transversal | El `Tooltip` se activa solo con `:hover`, sin `:focus` ni `aria-describedby`: en `RequirementHeader` comunica por qué una opción está deshabilitada y esa información es inalcanzable por teclado | accesibilidad | `Tooltip.module.scss:37`, `RequirementHeader.tsx:136-138` |
| transversal | 6 tablas con filas clickeables (`<tr onClick>`) sin `role`, `tabIndex` ni handler de teclado | accesibilidad | `TableRow.tsx:20`, `RequirementList.tsx:~147`, y 4 más |
| transversal | Cuatro dropdowns propios con cuatro niveles distintos de ARIA, ninguno con navegación por flechas | accesibilidad | `StateTag.tsx`, `RequirementHeader.tsx`, `ProjectTypeFilterDropdown.tsx`, `FinishDateLabel.tsx` |
| listado-tareas, cards | `<tr onClick>` navegable solo con mouse: sin `role`, sin `tabIndex`, sin handler de teclado | accesibilidad | `TableRow.tsx:20` |
| detalle-proyecto, sin-permisos | Estilos inline en vez de tokens/módulo | tokens | `unauthorized/page.tsx:6-38` (todo inline), `ProjectAttachmentsSection.tsx:18` |
| 3 componentes de navegación | Clases condicionales con template string: escriben `"false"` en el atributo `class` | bug latente | `NavItem.tsx:48-51`, `NavSubItem.tsx:49-52` |
| transversal | Dos pares de colores de estado idénticos: `inactivo`=`backlog`, `analisis`=`en_revision` | tokens | `_variables.scss:44-50` |
| transversal | `--z-index-navbar` (400) > `-modal` (200) y `-tooltip` (300) | tokens | `_variables.scss:196-199` |
| transversal | Tokens de color declarados dos veces con los mismos valores | tokens | `globals.scss:4-77` vs `_variables.scss:6-160` |
| transversal | `line-height` igual al `font-size` en `h1`, `h2`, `p` globales: el texto multilínea se toca | tipografía | `globals.scss:189-207` |

**Resumen:** 76 gaps registrados, sobre 22 pantallas nombradas más 11 entradas transversales o de bloque compartido.

Los dos más frecuentes, por lejos:

1. **Estado de error de query no implementado** — 11 pantallas. El patrón es desestructurar solo
   `isLoading` de `useQuery` e ignorar `isError`. La consecuencia es siempre la misma: un fallo de
   la api se ve como "no hay datos". Cuatro pantallas lo manejan (`asignacion-tiempo`,
   `reporte-horas`, `reporte-requisitos`, y los adjuntos de `detalle-proyecto`) y solo
   `asignacion-tiempo` lo muestra en pantalla en vez de solo un toast.
2. **Un solo viewport sin decirlo** — la superficie es desktop-only por el shell, pero 11 archivos
   tienen media queries con 6 valores distintos. Es tratamiento responsive parcial sobre contenido
   inalcanzable en mobile.

## No determinable desde el código

- **Audiencias y JTBD.** El código distingue tres roles (`admin`, `user`, `external-user`) pero no
  dice quién es cada uno, qué hace en su día ni para qué usa cada pantalla. Se releva en la
  entrevista de consolidación.
- **Por qué la superficie es desktop-only**, y si eso es una decisión de producto o una deuda.
- **Por qué hay media queries con 6 valores distintos** y por qué `RequirementDetail` corta en
  1023px mientras `CreateRequirementForm` corta en 1024px. Hay un comentario en
  `RequirementDetail.module.scss:9-11` que dice *"Pedido explícito del usuario"* sobre unificar
  mobile y tablet en esa pantalla — pero no dice qué usuario ni por qué.
- **Si `/` debería redirigir a `/clients`** como sugiere el código comentado en `app/page.tsx:4-8`.
- **Qué pantallas usa cada rol en la práctica.** La navegación filtra 2 ítems para
  `external-user`, pero ese rol es redirigido a `/unauthorized` por el layout — el filtro nunca se
  ejecuta en esta aplicación. Es lógica de `opus-web` que quedó acá, o al revés.
- **Prioridad de los gaps.** El relevamiento los lista; cuáles importan es decisión de producto.
- **Contenido dinámico:** los textos de proyectos, requisitos, tareas y comentarios vienen de la
  api. El relevamiento marca qué campo alimenta cada bloque, no muestrea valores.
- **`EXTERNAL_LINKS`** cambia la UI: el bloque de enlaces del pie de la navegación aparece o no
  según una variable de entorno con JSON. No se puede saber desde el código qué enlaces tiene cada
  instalación.
