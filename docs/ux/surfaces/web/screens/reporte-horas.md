---
name: reporte-horas
surface: web
route: /worked-times/report
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Reporte de horas

## Identidad

- **Audiencia primaria:** equipo-interno.
- **JTBD / Propósito:** visualizar las horas trabajadas de un período, por persona o por proyecto, con cards de resumen y una tabla jerárquica de 4 niveles [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport de la superficie. Los controles van en una fila y las cards de resumen en 4 columnas de 3/12 (`ReportPage.module.scss:9`, `SummaryCards.module.scss:4-5`) [fuente: código-existente].
  - Mobile queda fuera de la superficie `web`: el shell tiene una sidebar de 290px fija sin ninguna media query, así que por debajo de ese ancho no hay navegación disponible (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente]. La pantalla sí declara tres cortes propios en 767px vía el mixin `mobile` (`ReportPage.module.scss:13`, `:24`, `SummaryCards.module.scss:8`) —los controles se apilan en columna y las cards pasan a 2 columnas de 6/12— pero el chrome no los acompaña, y la tabla jerárquica de 4 niveles, que es el bloque que más lo necesitaría, no tiene ningún tratamiento.
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Desde la navegación del shell · subítem `"Visualización"` del ítem `"Horas Trabajadas"` (`Navbar.tsx:94`)

**Salidas user-driven:**
- **Ninguna.** Las filas de la tabla expanden, no navegan

**Salidas automáticas:**
- A `/projects` · redirect si `session.user.roles` incluye `external-user` (`worked-times/report/page.tsx:13-15`)

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | controles | section | — | layout | desktop | — | Agrupa período, vista y filtro de tipo |
| 2 | filtro-periodo | section | — | layout | desktop | — | Agrupa los cinco botones de período y las fechas |
| 3 | boton-periodo | button | primary (activo) / secondary · small | input | desktop | — | Elige el período del reporte |
| 4 | campo-fecha-desde | date-picker | default | input | desktop | visible_only_in_states: período personalizado | Límite inferior del rango |
| 5 | campo-fecha-hasta | date-picker | default | input | desktop | visible_only_in_states: período personalizado | Límite superior del rango |
| 6 | toggle-vista | toggle | por-persona / por-proyecto | input | desktop | — | Alterna el eje de agrupación |
| 7 | filtro-tipo-proyecto | dropdown | closed / open · con contador | input | desktop | — | Filtra por tipo de proyecto |
| 8 | cargando-reporte | loader | — | feedback | desktop | visible_only_in_states: loading | Espera de la query activa |
| 9 | cards-resumen | section | — | layout | desktop | hidden_in_states: loading | Agrupa las cuatro cards |
| 10 | card-resumen | card | — | content | desktop | — | Un valor de resumen con su etiqueta |
| 11 | tabla-jerarquica | table | por-persona / por-proyecto | content | desktop | hidden_in_states: loading | Desglose de horas en 4 niveles |
| 12 | fila-nivel-1 | list | expandida / colapsada | content | desktop | — | Persona o proyecto |
| 13 | fila-nivel-2 | list | expandida / colapsada | content | desktop | — | Proyecto, o la rama `"Ausencias"` |
| 14 | fila-nivel-3 | list | expandida / colapsada | content | desktop | — | Requisito o grupo sintético |
| 15 | fila-nivel-4 | list | — | content | desktop | — | Tarea o el literal `"Sin tarea"` |
| 16 | chevron-expandir | icon | expandido (`▼`) / colapsado (`▶`) | content | desktop | — | Indica el estado de expansión |
| 17 | barra-proporcion | chart | — | content | desktop | — | Proporción de la fila sobre el total del padre |
| 18 | icono-tipo-entrada | icon | project / requirement / objective | content | desktop | — | Tipo de la entrada |
| 19 | cargando-vista | loader | — | feedback | desktop | visible_only_in_states: loading inicial | Fallback del `<Suspense>` de la página |

**Origen:** `src/app/(loggedin)/worked-times/report/page.tsx`, `src/features/worked-times/components/ReportPage/ReportPage.tsx`, `src/features/worked-times/components/ReportPage/ReportPage.module.scss`, `src/features/worked-times/components/PeriodFilter/PeriodFilter.tsx`, `src/features/worked-times/components/ViewToggle/ViewToggle.tsx`, `src/features/worked-times/components/ProjectTypeFilterDropdown/ProjectTypeFilterDropdown.tsx`, `src/features/worked-times/components/SummaryCards/SummaryCards.tsx`, `src/features/worked-times/components/SummaryCards/SummaryCards.module.scss`, `src/features/worked-times/components/HierarchicalTable/HierarchicalTable.tsx`.

Notas de transcripción [fuente: código-existente]:
- `controles`, `filtro-periodo`, `cards-resumen` y las filas de la tabla se relevaron como `section` y `list`: compuestos sin tipo propio en el diccionario.
- **`tabla-jerarquica` no es un `<table>`**: es una estructura de `<div>` con clases de nivel (`HierarchicalTable.tsx:111`). Ver Accesibilidad.
- `barra-proporcion` se relevó como `chart`: es la única visualización de datos del producto — una barra de fondo cuyo ancho es el porcentaje del total.
- El relevamiento del interior de `HierarchicalTable` (725 líneas) no fue exhaustivo: las líneas de las filas están aproximadas y la vista por proyecto se relevó solo en su estructura general.
- `filtro-tipo-proyecto` está relevado como overlay compartido en `_overlays.md` (`ProjectTypeFilterDropdown`).

## Layout por viewport

### desktop · 1440px

- row `controles` (`flex-between`)
  - filtro-periodo (izquierda)
    - row `botones-periodo`: boton-periodo × 5
    - row `rango-personalizado`: campo-fecha-desde · campo-fecha-hasta
  - grupo derecho (`flex`): toggle-vista · filtro-tipo-proyecto
- cards-resumen
  - row `resumen`
    - col 3/12: card-resumen
    - col 3/12: card-resumen
    - col 3/12: card-resumen
    - col 3/12: card-resumen
- tabla-jerarquica
  - fila-nivel-1 (con chevron-expandir y barra-proporcion)
    - fila-nivel-2
      - fila-nivel-3
        - fila-nivel-4 (con icono-tipo-entrada)

**Origen:** `ReportPage.module.scss:9` (`@include flex-between` en `.controls`), `:20` (`.toggleGroup` en `flex`), y `SummaryCards.module.scss:4-5` (`grid-template-columns: repeat(4, 1fr)`) [fuente: código-existente].

Fracciones de las cards de resumen: **exactas, 3/12 cada una**.

**Las fracciones de tabla-jerarquica no son derivables:** es una estructura de `<div>` con clases de nivel y una indentación por nivel, no una grilla de 12.

Los tres cortes propios en 767px (`ReportPage.module.scss:13-14`, `:24-26`, `SummaryCards.module.scss:8-9`) apilan los controles en columna y llevan las cards a 2 columnas de 6/12, fuera de los viewports de la superficie.

## Contenido

### controles
- Texto/label: contenedor sin texto propio
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.controls}>` (`:116`)

### filtro-periodo
- Texto/label: contenedor de los botones de período y las fechas
- Icono: nada
- Asset: nada
- Annotation: `<PeriodFilter>` (`:117`). Los dos campos de fecha solo se renderizan si el período es `custom` (`PeriodFilter.tsx:139`)

### boton-periodo
- Texto/label: opciones verbatim (`PERIOD_OPTIONS`, `PeriodFilter.tsx:62-66`): `"Esta semana"` (`this-week`, default) · `"Semana pasada"` (`last-week`) · `"Este mes"` (`this-month`) · `"Mes pasado"` (`last-month`) · `"Rango personalizado"` (`custom`)
- Icono: nada
- Asset: nada
- Annotation: `<Button size="small" variant>` × 5 (`PeriodFilter.tsx:129-135`). Default `this-week` (`:70`). El estado activo se comunica cambiando el `variant`, o sea **solo por color**

### campo-fecha-desde
- Texto/label: el label está en `PeriodFilter.tsx:142-144`; `id="report-date-from"` (`:145-150`)
- Icono: nada
- Asset: nada
- Annotation: `<input type="date">` con `<label htmlFor>` correspondiente

### campo-fecha-hasta
- Texto/label: el label está en `PeriodFilter.tsx:154-156`; `id="report-date-to"` (`:157-162`)
- Icono: nada
- Asset: nada
- Annotation: `<input type="date">` con `<label htmlFor>` correspondiente

### toggle-vista
- Texto/label: opciones verbatim `"Por persona"` (`by-person`, default) · `"Por proyecto"` (`by-project`) (`ViewToggle.tsx:14-15`)
- Icono: nada
- Asset: nada
- Annotation: `<ViewToggle>` → `<ToggleGroup>` (`:119`). Cambia **cuál de las dos queries está activa** (`enabled: activeView === 'by-person'`, `:50`, `:56`), no solo la presentación

### filtro-tipo-proyecto
- Texto/label: label del botón `"Tipo de proyecto"`, o `` `Tipo de proyecto (${N})` `` con selección (`ProjectTypeFilterDropdown.tsx:59`). Opciones verbatim: `"Comercial"` · `"Interno"` · `"Investigación"` · `"Propuesta"` (`:14-17`)
- Icono: chevron con `aria-hidden="true"` (`:70-72`)
- Asset: nada
- Annotation: multi-selección con checkboxes. **No hay control para limpiar la selección:** hay que destildar de a uno (`:76-88`)

### cargando-reporte
- Texto/label: **sin texto** — es un `<Spinner>` (`:128-130`)
- Icono: nada
- Asset: nada
- Annotation: reemplaza cards y tabla; los controles quedan visibles

### cards-resumen
- Texto/label: contenedor de las cuatro cards
- Icono: nada
- Asset: nada
- Annotation: `<SummaryCards>` → `<div className={styles.cards}>` (`:133`, `SummaryCards.tsx:61`)

### card-resumen
- Texto/label: cuatro cards, etiquetas verbatim (`SummaryCards.tsx:62-77`): `formatHours(stats.totalMinutes)` con `"Total horas"` · `stats.personCount` con `"Personas"` · `stats.projectCount` con `"Proyectos"` · `formatHours(stats.avgMinutes)` con `"Promedio / persona"`
- Icono: nada
- Asset: nada
- Annotation: las estadísticas se calculan en el cliente, con ramas distintas según la vista activa (`SummaryCards.tsx:23`, `:36`)

### tabla-jerarquica
- Texto/label: textos verbatim encontrados: `"Sin tarea"` (`HierarchicalTable.tsx:233`) · `"Tareas sin requisito"` (`:270`) · `"Ausencias"` (`:353`)
- Icono: nada
- Asset: nada
- Annotation: **vista por persona** — 4 niveles (`:111-395`): (1) persona con nombre y total, (2) proyecto con nombre, código, total y porcentaje del total de la persona, (3) requisito o el grupo `"Tareas sin requisito"`, (4) tarea o el literal `"Sin tarea"`. Más una rama especial de nivel 2, `"Ausencias"` (`:353`), que se expande a los motivos. **Vista por proyecto** — la jerarquía arranca en el proyecto (`:400-...`)

### fila-nivel-1
- Texto/label: el nombre de la persona (o del proyecto, según la vista) y su total
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.row}>` con chevron (`HierarchicalTable.tsx:~120-135`)

### fila-nivel-2
- Texto/label: el nombre del proyecto, su código, su total y el porcentaje; o la rama `"Ausencias"`
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.row} styles.level2>` (`HierarchicalTable.tsx:~150-165`)

### fila-nivel-3
- Texto/label: el requisito, o el grupo sintético `"Tareas sin requisito"` (`:270`)
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.row} styles.level3>` (`HierarchicalTable.tsx:~184-200`)

### fila-nivel-4
- Texto/label: la tarea, o el literal `"Sin tarea"` (`:233`)
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.row} styles.level4>` (`HierarchicalTable.tsx:~212-235`)

### chevron-expandir
- Texto/label: `"▼"` expandido y `"▶"` colapsado (`HierarchicalTable.tsx:123`, `:415`)
- Icono: nada — los chevrons son caracteres de texto dentro de un `<span>`
- Asset: nada
- Annotation: se lee como el símbolo, no como el estado

### barra-proporcion
- Texto/label: sin texto propio; el porcentaje **sí** está como texto al lado (`HierarchicalTable.tsx:162`)
- Icono: nada
- Asset: nada
- Annotation: `<span className={styles.barBg} style={{ width: '{pct}%' }}>` (`:153`, `:414`), calculado sobre el total del nivel padre

### icono-tipo-entrada
- Texto/label: sin texto propio
- Icono: `<TintedIcon>` con `alt` que aporta el tipo (`HierarchicalTable.tsx:193`, `:215`, `:264`)
- Asset: nada
- Annotation: nada

### cargando-vista
- Texto/label: `"Cargando visualización..."` (`worked-times/report/page.tsx:20`)
- Icono: nada
- Asset: nada
- Annotation: `<Loader>` como fallback del `<Suspense>` de la página

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). La query activa resuelve (`:131-140`)
- Sub-estado `período personalizado` (`activePeriod === 'custom'`): campo-fecha-desde y campo-fecha-hasta solo visibles en este estado (`PeriodFilter.tsx:139-164`)
- Sub-estado `filas expandidas / colapsadas`: click en la fila; estado por clave compuesta. El chevron rota y aparecen los hijos del nivel siguiente (`HierarchicalTable.tsx:~120`, `:~150`, `:~184`)

### empty
- Aplica: No — no implementado (ver gaps-as-is.md). Con la query resuelta y sin datos, `SummaryCards` muestra ceros (las ramas requieren `length > 0`, `SummaryCards.tsx:23`, `:36`) y la tabla no renderiza filas, **sin ningún mensaje** (`:131-140`) [fuente: código-existente]

### loading
- Aplica: Sí
- Mensaje: sin texto — `<Spinner>` (`:128-130`); `"Cargando visualización..."` en el fallback del `<Suspense>` de la página (`worked-times/report/page.tsx:20`)
- Cambios:
  - cargando-reporte: solo visible en este estado (visible_only_in_states)
  - cards-resumen y tabla-jerarquica: ocultas en este estado
  - controles: sin cambios, quedan visibles
- Disparado por `activeQuery.isLoading` (`:127`)

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). El rango de fechas no se valida: `dateFrom` posterior a `dateTo` se manda a la api tal cual (`PeriodFilter.tsx:104-124`) [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí (parcialmente)
- Mensaje: toast `"Error al cargar los datos del reporte"` (`:97`)
- Cambios:
  - **Solo el toast.** La pantalla queda con las cards en cero y la tabla vacía (`:96-99`)
- Nota: el toast tiene `autoClose: 2000`, así que después de 2 segundos la pantalla es **indistinguible de un período sin horas cargadas**. No hay ningún mensaje de error en pantalla. `usePersons`, usada para la vista por persona, no tiene manejo de `isError` relevado (`:92`) [fuente: código-existente]

### success
- Aplica: No — no implementado (ver gaps-as-is.md). Es una vista de lectura y no tiene exportación: a diferencia de reporte-requisitos, que tiene `"Exportar CSV"`, este reporte no se puede exportar (`:115-141`) [fuente: código-existente]

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md)

## Interacciones

**Eventos:** [fuente: código-existente]
- boton-periodo · click → setea el período y calcula el rango de fechas (`PeriodFilter.tsx:78-100`, `:134`)
- campo-fecha-desde / campo-fecha-hasta · on change → actualizan el rango (`PeriodFilter.tsx:104-124`)
- toggle-vista · click → `handleViewChange` → cambia qué query está activa (`:119`)
- filtro-tipo-proyecto · click en una opción → agrega o quita el tipo de la selección (`ProjectTypeFilterDropdown.tsx:78-86`)
- fila de cualquier nivel · click → expande o colapsa sus hijos (`HierarchicalTable.tsx:~121`, `:~152`)

**Validaciones:**
- Ninguna.

**Feedback:**
- Barras de proporción por fila, con el porcentaje al lado (`HierarchicalTable.tsx:162`)
- Totales por nivel
- Cards de resumen recalculadas
- Chevrons que indican el estado de expansión
- Toast ante error

**Volumen** [fuente: código-existente]: no hay paginación ni límite — se renderiza todo el árbol del período (`HierarchicalTable.tsx:111`) — ni control de expandir / colapsar todo: con 4 niveles hay que abrir cada rama a mano (`:111-395`).

## Accesibilidad

- **Orden de foco:** boton-periodo × 5 → campo-fecha-desde → campo-fecha-hasta (si el período es personalizado) → toggle-vista → filtro-tipo-proyecto → **fin**. **Las filas de la tabla jerárquica no están en el orden de foco:** son `<div>` clickeables sin `role="button"`, sin `tabIndex`, sin `aria-expanded` y sin handler de teclado, así que el árbol de 4 niveles **no se puede expandir sin mouse** y todo el desglose de horas por persona, proyecto, requisito y tarea es inalcanzable por teclado (`HierarchicalTable.tsx:~121`, `:~152`, `:~186`) [fuente: código-existente].
- **Landmarks y jerarquía:** los landmarks son los del shell. Un solo `<h1>`, el del `PageLayout` (`"Visualización de Horas"`, `worked-times/report/page.tsx:18`). **Ni las cards de resumen ni la tabla tienen encabezado**, así que la pantalla no tiene ningún `<h2>` pese a tener tres bloques distintos.
- **Foco y teclado:** el overlay de esta composición es el panel de filtro-tipo-proyecto, que **sí cierra con `Escape`** y tiene `aria-expanded` (`ProjectTypeFilterDropdown.tsx:34-37`, `:40`, `:67`) aunque le falta `aria-haspopup`; ver `_overlays.md`. No hay atajos de teclado propios de la pantalla.
- **Propio de esta composición:** **la tabla jerárquica no es una tabla.** Es una estructura de `<div>` con clases `.row`, `.level2`, `.level3`, `.level4`, sin `<table>`, sin `<th>`, sin `role="treegrid"` ni `role="tree"`: para un lector de pantalla es una pila de texto sin estructura ni jerarquía (`HierarchicalTable.tsx:111-395`). Los chevrons `▼`/`▶` son caracteres dentro de un `<span>` y se leen como el símbolo, no como el estado (`:123`). **El estado activo del período se comunica solo por color** (el `variant` de `<Button>`), sin `aria-pressed` (`PeriodFilter.tsx:129-135`), a diferencia del toggle-vista que está al lado y sí lo tiene (`ToggleGroup.tsx:27`). El spinner de carga no tiene `aria-live` ni `role="status"` (`:128-129`), y **el error solo existe como toast**: no queda nada en pantalla (`:97`). Las cards de resumen mantienen valor y etiqueta juntos por el orden del DOM, pero la relación no es semántica (no es un `<dl>`, `SummaryCards.tsx:62-77`). `barra-proporcion` es un `<span>` vacío, pero la información no se pierde porque el porcentaje también está como texto al lado (`:153`, `:162`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
