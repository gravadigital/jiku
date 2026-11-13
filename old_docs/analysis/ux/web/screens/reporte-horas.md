---
document: UX Survey Screen
screen: reporte-horas
route: /worked-times/report
service: web
source_files:
  - src/app/(loggedin)/worked-times/report/page.tsx
  - src/features/worked-times/components/ReportPage/ReportPage.tsx
  - src/features/worked-times/components/ReportPage/ReportPage.module.scss
  - src/features/worked-times/components/PeriodFilter/PeriodFilter.tsx
  - src/features/worked-times/components/ViewToggle/ViewToggle.tsx
  - src/features/worked-times/components/ProjectTypeFilterDropdown/ProjectTypeFilterDropdown.tsx
  - src/features/worked-times/components/SummaryCards/SummaryCards.tsx
  - src/features/worked-times/components/SummaryCards/SummaryCards.module.scss
  - src/features/worked-times/components/HierarchicalTable/HierarchicalTable.tsx
viewports_detected:
  - mobile
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: reporte-horas

> **Relevamiento as-is** de `/worked-times/report`, extraído de
> `src/app/(loggedin)/worked-times/report/page.tsx` y su árbol.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md); el dropdown de tipo de proyecto, en
> [_overlays.md](./_overlays.md).

## Identidad

- **Ruta:** `/worked-times/report`
- **Archivo:** `src/app/(loggedin)/worked-times/report/page.tsx` (Server Component,
  `dynamic = 'force-dynamic'`) → `<ReportPage>` (`'use client'`, 149 líneas)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`, **más un chequeo propio**: `external-user`
  redirigido a `/projects` (`worked-times/report/page.tsx:13-15`)
- **Audiencia:** no determinable desde el código
- **Propósito observado:** visualiza las horas trabajadas de un período, por persona o por proyecto,
  con cards de resumen y una tabla jerárquica de 4 niveles.
- **Viewports con tratamiento:** `mobile` y `desktop`, con el corte en **767px** vía el mixin
  `mobile`. Es una de las 4 pantallas con tratamiento responsive en código vivo.

## Entrada y salida

**Entradas:**
- Subítem `"Visualización"` del ítem `"Horas Trabajadas"` de la navegación · `Navbar.tsx:94`

**Salidas:**
- `/projects` · **redirect automático** si el rol es `external-user` ·
  `worked-times/report/page.tsx:14`
- **Ninguna navegación desde la UI.** Las filas de la tabla expanden, no navegan.

**Redirects automáticos:**
- `/projects` si `session.user.roles` incluye `external-user` · `worked-times/report/page.tsx:13-15`

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | controles | `section` | — | ambos | `<div className={styles.controls}>` | `:116` |
| 2 | filtro-periodo | `section` | — | ambos | `<PeriodFilter>` | `:117` |
| 3 | boton-periodo | `button` | primary (activo) / secondary · small | ambos | `<Button size="small" variant>` × 5 | `PeriodFilter.tsx:129-135` |
| 4 | campo-fecha-desde | `date-picker` | default | ambos | `<input type="date" id="report-date-from">` | `PeriodFilter.tsx:145-150` |
| 5 | campo-fecha-hasta | `date-picker` | default | ambos | `<input type="date" id="report-date-to">` | `PeriodFilter.tsx:157-162` |
| 6 | toggle-vista | `toggle` | por-persona / por-proyecto | ambos | `<ViewToggle>` → `<ToggleGroup>` | `:119` |
| 7 | filtro-tipo-proyecto | `dropdown` | closed / open · con contador | ambos | `<ProjectTypeFilterDropdown>` | `:120-124` |
| 8 | cargando-reporte | `loader` | — | ambos | `<Spinner>` | `:128-130` |
| 9 | cards-resumen | `section` | — | ambos | `<SummaryCards>` → `<div className={styles.cards}>` | `:133`, `SummaryCards.tsx:61` |
| 10 | card-resumen | `card` | — | ambos | `<div className={styles.card}>` × 4 | `SummaryCards.tsx:62-77` |
| 11 | tabla-jerarquica | `table` | por-persona / por-proyecto | ambos | `<HierarchicalTable>` → `<div className={styles.table}>` | `:138`, `HierarchicalTable.tsx:111` |
| 12 | fila-nivel-1 | `list` | expandida / colapsada | ambos | `<div className={styles.row}>` con chevron | `HierarchicalTable.tsx:~120-135` |
| 13 | fila-nivel-2 | `list` | expandida / colapsada | ambos | `<div className={styles.row} styles.level2>` | `HierarchicalTable.tsx:~150-165` |
| 14 | fila-nivel-3 | `list` | expandida / colapsada | ambos | `<div className={styles.row} styles.level3>` | `HierarchicalTable.tsx:~184-200` |
| 15 | fila-nivel-4 | `list` | — | ambos | `<div className={styles.row} styles.level4>` | `HierarchicalTable.tsx:~212-235` |
| 16 | chevron-expandir | `icon` | expandido (`▼`) / colapsado (`▶`) | ambos | `<span className={styles.chevron}>` | `HierarchicalTable.tsx:123`, `:154` |
| 17 | barra-proporcion | `chart` | — | ambos | `<span className={styles.barBg} style={{ width: '{pct}%' }}>` | `HierarchicalTable.tsx:153`, `:414` |
| 18 | icono-tipo-entrada | `icon` | project / requirement / objective | ambos | `<TintedIcon>` | `HierarchicalTable.tsx:193`, `:215`, `:264` |
| 19 | cargando-vista | `loader` | — | ambos | `<Loader label="Cargando visualización...">` como fallback de `<Suspense>` | `worked-times/report/page.tsx:20` |

> `controles`, `filtro-periodo`, `cards-resumen` y las filas de la tabla se relevaron como `section` y
> `list`: compuestos sin tipo propio en el diccionario.

> **`tabla-jerarquica` no es un `<table>`**: es una estructura de `<div>` con clases de nivel. Ver
> Accesibilidad.

> **`barra-proporcion` se relevó como `chart`**: es la única visualización de datos del producto — una
> barra de fondo cuyo ancho es el porcentaje del total.

## Layout observado por viewport

### desktop · ≥768px

- row `controles` (`flex-between`)
  - filtro-periodo (izquierda): los 5 botones en fila, más los dos campos de fecha si el período es
    personalizado
  - grupo derecho (`flex`): toggle-vista · filtro-tipo-proyecto
- cards-resumen: row de **4 columnas de 3/12** cada una
- tabla-jerarquica

**Origen:** `ReportPage.module.scss:9` (`@include flex-between` en `.controls`), `:20` (`.toggleGroup`
en `flex`), y `SummaryCards.module.scss:4-5` (`grid-template-columns: repeat(4, 1fr)`).

Fracciones de las cards: exactas, **3/12 cada una**.

### mobile · ≤767px

- controles, **apilado en columna** (`@include flex-column`)
  - filtro-periodo
  - grupo derecho, también en columna
- cards-resumen: row de **2 columnas de 6/12** cada una
- tabla-jerarquica

**Origen:** `ReportPage.module.scss:13-14` y `:24-26` (los dos `@include mobile`), y
`SummaryCards.module.scss:8-9` (`@include mobile { grid-template-columns: repeat(2, 1fr) }`).

> **Es la pantalla con más bloques con tratamiento responsive del producto:** 3 de las 6 apariciones
> del mixin `mobile` en código vivo están acá (`ReportPage.module.scss:13`, `:24`,
> `SummaryCards.module.scss:8`).

> **La tabla jerárquica no tiene tratamiento responsive.** Con 4 niveles de indentación, es el bloque
> que más lo necesitaría.

## Contenido

### filtro-periodo
- Opciones verbatim (`PERIOD_OPTIONS`, `PeriodFilter.tsx:62-66`): `"Esta semana"` (`this-week`,
  default) · `"Semana pasada"` (`last-week`) · `"Este mes"` (`this-month`) ·
  `"Mes pasado"` (`last-month`) · `"Rango personalizado"` (`custom`)
- Labels de los campos de fecha: en `PeriodFilter.tsx:142-144` y `:154-156`
- Origen: `PeriodFilter.tsx:126-165`
- Annotation: los dos campos de fecha **solo se renderizan si el período es `custom`** (`:139`).
  Default `this-week` (`:70`).

### toggle-vista
- Opciones verbatim: `"Por persona"` (`by-person`, default) · `"Por proyecto"` (`by-project`) ·
  `ViewToggle.tsx:14-15`
- Origen: `:119`
- Annotation: cambia **cuál de las dos queries está activa** (`enabled: activeView === 'by-person'`,
  `:50`, `:56`), no solo la presentación

### filtro-tipo-proyecto
- Label del botón: `"Tipo de proyecto"`, o `` `Tipo de proyecto (${N})` `` con selección ·
  `ProjectTypeFilterDropdown.tsx:59`
- Opciones verbatim: `"Comercial"` · `"Interno"` · `"Investigación"` · `"Propuesta"` · `:14-17`
- Origen: `:120-124`

### cards-resumen
Cuatro cards, etiquetas verbatim (`SummaryCards.tsx:62-77`):

| Valor | Etiqueta |
|---|---|
| `formatHours(stats.totalMinutes)` | `"Total horas"` |
| `stats.personCount` | `"Personas"` |
| `stats.projectCount` | `"Proyectos"` |
| `formatHours(stats.avgMinutes)` | `"Promedio / persona"` |

Annotation: las estadísticas se calculan en el cliente, con ramas distintas según la vista activa
(`SummaryCards.tsx:23`, `:36`).

### tabla-jerarquica

**Vista por persona** — 4 niveles (`HierarchicalTable.tsx:111-395`):
1. persona (nombre y total)
2. proyecto (nombre, código, total, porcentaje del total de la persona)
3. requisito, o el grupo `"Tareas sin requisito"` (`:270`)
4. tarea, o el literal `"Sin tarea"` (`:233`)

Más una rama especial de nivel 2: `"Ausencias"` (`:353`), que se expande a los motivos.

**Vista por proyecto** — la jerarquía arranca en el proyecto (`:400-...`).

Textos verbatim encontrados: `"Sin tarea"` (`:233`) · `"Tareas sin requisito"` (`:270`) ·
`"Ausencias"` (`:353`)

Chevrons: `"▼"` (`▼`) expandido y `"▶"` (`▶`) colapsado · `:123`, `:415`

### Mensajes de toast
- Error: `"Error al cargar los datos del reporte"` · `:97`

## Estados presentes

### default
- Disparado por: la query activa resuelve
- Origen: `:131-140`

### loading
- Mensaje: `<Spinner>` sin texto
- Disparado por: `activeQuery.isLoading` (`:127`)
- Origen: `:127-130`
- Cambios: reemplaza cards y tabla; los controles quedan visibles

### error de sistema
- Mensaje: toast `"Error al cargar los datos del reporte"`
- Disparado por: `activeQuery.isError`, en un `useEffect` (`:96-99`)
- Origen: `:96-99`
- Cambios: **solo el toast.** La pantalla queda con las cards en cero y la tabla vacía.

### período personalizado
- Disparado por: `activePeriod === 'custom'`
- Origen: `PeriodFilter.tsx:139-164`
- Cambios: aparecen los dos campos de fecha

### filas expandidas / colapsadas
- Disparado por: click en la fila; estado por clave compuesta
- Origen: `HierarchicalTable.tsx:~120`, `:~150`, `:~184`
- Cambios: el chevron rota y aparecen los hijos del nivel siguiente

### paso superado en la barra de proporción
- Disparado por: el porcentaje calculado sobre el total del nivel padre
- Origen: `HierarchicalTable.tsx:153`, `:162`, `:414`

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error visible en pantalla** | el error **solo se comunica por toast** (`autoClose: 2000`). Después de 2 segundos la pantalla muestra cards en cero y una tabla vacía, **indistinguible de un período sin horas cargadas** | `:96-99` |
| **empty** | **no existe.** Con la query resuelta y sin datos, `SummaryCards` muestra ceros (`SummaryCards.tsx:23`, `:36` — las ramas requieren `length > 0`) y la tabla no renderiza filas. **Sin mensaje** | `:131-140` |
| error de la query de personas | `usePersons`, usada para la vista por persona, sin `isError` relevado | `:92` |
| **validación del rango de fechas** | **no existe.** `dateFrom` posterior a `dateTo` se manda a la api tal cual | `PeriodFilter.tsx:104-124` |
| error de validación | no aplica: no hay formulario de escritura | — |
| success | no aplica: es una vista de lectura | — |
| not found | no aplica | — |
| estado terminal / readonly | no aplica: el reporte es de lectura por naturaleza | — |
| **exportación** | **no existe.** A diferencia de `reporte-requisitos`, que tiene `"Exportar CSV"`, este reporte no se puede exportar | `:115-141` |
| **limpiar el filtro de tipo** | hay que destildar de a uno | `ProjectTypeFilterDropdown.tsx:76-88` |
| **expandir / colapsar todo** | no existe: con 4 niveles hay que abrir cada rama a mano | `HierarchicalTable.tsx:111-395` |
| paginación / límite | no existe: se renderiza todo el árbol del período | `HierarchicalTable.tsx:111` |

## Interacciones

**Eventos:**
- boton-periodo · click → setea el período y calcula el rango de fechas ·
  `PeriodFilter.tsx:78-100`, `:134`
- campo-fecha-desde / hasta · on change → actualizan el rango ·
  `PeriodFilter.tsx:104-124`
- toggle-vista · click → `handleViewChange` → cambia qué query está activa · `:119`
- filtro-tipo-proyecto · click en una opción → agrega o quita el tipo de la selección ·
  `ProjectTypeFilterDropdown.tsx:78-86`
- fila de cualquier nivel · click → expande o colapsa sus hijos ·
  `HierarchicalTable.tsx:~121`, `:~152`

**Validaciones:**
- Ninguna.

**Feedback:**
- Barras de proporción por fila, con el porcentaje al lado (`HierarchicalTable.tsx:162`)
- Totales por nivel
- Cards de resumen recalculadas
- Chevrons que indican el estado de expansión
- Toast ante error

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| **La tabla no es una tabla** | `tabla-jerarquica` es una estructura de `<div>` con clases `.row`, `.level2`, `.level3`, `.level4`. **Sin `<table>`, sin `<th>`, sin `role="treegrid"` ni `role="tree"`**: para un lector de pantalla es una pila de texto sin estructura ni jerarquía | `HierarchicalTable.tsx:111-395` |
| **Filas expandibles sin ARIA** | Las filas son `<div>` clickeables **sin `role="button"`, sin `tabIndex`, sin `aria-expanded`, sin handler de teclado**: el árbol de 4 niveles **no se puede expandir sin mouse** | `HierarchicalTable.tsx:~121`, `:~152`, `:~186` |
| Chevron | Carácter `▼`/`▶` como texto dentro de un `<span>`: se lee como el símbolo, no como el estado | `HierarchicalTable.tsx:123` |
| **Barra de proporción sin valor accesible** | `<span className={styles.barBg} style={{ width: '{pct}%' }}>` es un `<span>` vacío. El porcentaje **sí** está como texto al lado (`:162`), así que la información no se pierde | `HierarchicalTable.tsx:153`, `:162` |
| Toggle de vista | `aria-pressed` presente vía `<ToggleGroup>`. Correcto | `ToggleGroup.tsx:27` |
| Botones de período | `<Button>` con texto y `variant` que cambia según el activo. **El estado activo se comunica solo por color**: no hay `aria-pressed` | `PeriodFilter.tsx:129-135` |
| Campos de fecha | `<label htmlFor="report-date-from">` / `"report-date-to"` con los `id` correspondientes. Correcto | `PeriodFilter.tsx:142-150`, `:154-162` |
| Dropdown de tipo | `aria-expanded` + `Escape` + checkboxes con `aria-label`. Ver [_overlays.md](./_overlays.md) | `ProjectTypeFilterDropdown.tsx:67`, `:34-37`, `:83` |
| Cards de resumen | Valor y etiqueta como texto en `<span>`. **La relación valor-etiqueta no es semántica** (no es un `<dl>`), pero el orden del DOM las mantiene juntas | `SummaryCards.tsx:62-77` |
| Iconos de tipo | `<TintedIcon>` con `alt` que aporta el tipo | `HierarchicalTable.tsx:193`, `:215` |
| Spinner de carga | Sin `aria-live` ni `role="status"` | `:128-129` |
| Error solo por toast | El toast sí se anuncia (`react-toastify` usa `role="alert"`), pero no queda nada en pantalla | `:97` |
| Jerarquía de encabezados | Solo el `<h1>` del `PageLayout` (`"Visualización de Horas"`). **Ni las cards ni la tabla tienen encabezado** | `worked-times/report/page.tsx:18` |

## Observaciones del relevamiento

- **La tabla jerárquica de 4 niveles no es accesible.** Es el componente más grande del producto
  (725 líneas) y está construido con `<div>` clickeables sin `role`, sin `tabIndex`, sin
  `aria-expanded` y sin handlers de teclado (`HierarchicalTable.tsx:111-395`). El contenido —el
  desglose de horas por persona, proyecto, requisito y tarea— **es inalcanzable sin mouse**.
- **Es la pantalla con más tratamiento responsive del producto** (3 de las 6 apariciones del mixin
  `mobile` en código vivo), y el bloque que más lo necesitaría —la tabla de 4 niveles— **no lo tiene**.
- **El error se comunica solo por toast de 2 segundos.** Pasado ese tiempo, la pantalla muestra cards
  en cero y una tabla vacía: un fallo de red se ve igual que un período sin horas cargadas. En un
  reporte, eso puede llevar a conclusiones equivocadas.
- **No hay estado vacío.** Ni mensaje ni distinción: cards en cero y tabla sin filas.
- **No hay exportación**, a diferencia de `reporte-requisitos`, que tiene `"Exportar CSV"` con BOM y
  escapado. Los dos reportes del producto difieren en eso.
- **El estado activo del período se comunica solo por color** (`variant` de `<Button>`,
  `PeriodFilter.tsx:133`), sin `aria-pressed`. El `toggle-vista`, que está al lado, sí lo tiene.
- **La barra de proporción es la única visualización de datos del producto**, y está bien resuelta
  desde el punto de vista de la información: el porcentaje también está como texto (`:162`).
- **`"Sin tarea"` y `"Tareas sin requisito"`** son grupos sintéticos que el componente crea para las
  horas que no cuelgan de la jerarquía completa (`:233`, `:270`). Es un manejo explícito de datos
  incompletos que el resto del producto no tiene.
- **No hay expandir/colapsar todo.** Con 4 niveles y sin límite de volumen, revisar un mes completo
  requiere abrir cada rama a mano.
- **No se relevó con precisión** el interior completo de `HierarchicalTable` (725 líneas): las líneas
  de las filas están aproximadas y la vista por proyecto se relevó solo en su estructura general. A
  completar antes de consolidar.
- **A confirmar en consolidación:** si el árbol debe ser navegable por teclado (es el bloque menos
  accesible del producto), si hace falta exportación, y si el error debe verse en pantalla.
