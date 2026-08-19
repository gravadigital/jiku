---
name: asignacion-tiempo
surface: web
route: /time-allocation
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Asignación de tiempo

## Identidad

- **Audiencia primaria:** equipo-interno. Solo un `admin` puede editar y guardar [fuente: código-existente].
- **JTBD / Propósito:** asignar el porcentaje de capacidad de cada persona a cada proyecto en una grilla semanal proyecto × persona [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport de la superficie. La pantalla es una grilla de `N + 2` columnas (proyecto + N personas + total) y no declara ningún tratamiento responsive [fuente: código-existente].
  - Mobile queda fuera de la superficie `web`: el shell tiene una sidebar de 290px fija sin ninguna media query, así que por debajo de ese ancho no hay navegación disponible (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Desde la navegación del shell · ítem `"Asignación de Tiempo"` (`Navbar.tsx:79`)

**Salidas user-driven:**
- A la propia pantalla con otra semana · navegador-semana (`WeeklyAllocationTable.tsx:367`)

**Salidas automáticas:**
- A `/projects` · redirect si `session.user.roles` incluye `external-user` (`time-allocation/page.tsx:13-15`). Este chequeo es redundante: el layout de `(loggedin)` ya redirigió a `/unauthorized` a cualquier `external-user` antes de llegar acá

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | navegador-semana | section | — | layout | desktop | — | Agrupa los controles de semana |
| 2 | boton-semana-anterior | button | primary · small | input | desktop | — | Retrocede una semana |
| 3 | rango-semana | paragraph | body | content | desktop | — | Rango de fechas de la semana |
| 4 | boton-esta-semana | button | primary · small · disabled | input | desktop | state_overrides: semana actual→disabled | Vuelve a la semana actual |
| 5 | boton-semana-siguiente | button | primary · small | input | desktop | — | Avanza una semana |
| 6 | banner-precarga | alert | info | feedback | desktop | visible_only_in_states: precarga desde la semana anterior | Avisa que los valores vienen de la semana previa |
| 7 | cargando-asignaciones | loader | — | feedback | desktop | visible_only_in_states: loading | Espera de las asignaciones |
| 8 | mensaje-error | alert | error | feedback | desktop | visible_only_in_states: error de sistema | Mensaje de fallo de la query |
| 9 | vacio-proyectos | empty-state | — | feedback | desktop | visible_only_in_states: empty | Mensaje de sin proyectos |
| 10 | tabla-asignaciones | table | — | content | desktop | hidden_in_states: loading, error de sistema, empty | Grilla proyecto × persona |
| 11 | encabezado-persona | table | — | content | desktop | — | Un `<th>` por persona |
| 12 | fila-grupo | section | — | content | desktop | — | Encabezado de sección por tipo de proyecto |
| 13 | celda-editable | text-input | default · **overallocated** · disabled | input | desktop | visible_only_in_states: default con `isEditable` | Porcentaje de capacidad asignado |
| 14 | celda-lectura | paragraph | body | content | desktop | visible_only_in_states: solo lectura | Porcentaje y horas, no editables |
| 15 | celda-total-proyecto | paragraph | body | content | desktop | — | Total por proyecto |
| 16 | fila-total | table | — | content | desktop | — | Totales por persona |
| 17 | boton-guardar | button | primary · loading | input | desktop | visible_only_in_states: default con `isEditable` | Guarda las asignaciones de la semana |
| 18 | cargando-vista | loader | — | feedback | desktop | visible_only_in_states: loading inicial | Fallback del `<Suspense>` de la página |

**Origen:** `src/app/(loggedin)/time-allocation/page.tsx`, `src/features/time-allocation/components/WeeklyAllocationTable/WeeklyAllocationTable.tsx`, `src/features/time-allocation/components/WeeklyAllocationTable/WeeklyAllocationTable.module.scss`, `src/features/time-allocation/components/WeekNavigator/WeekNavigator.tsx`, `src/features/time-allocation/components/EditableCell/EditableCell.tsx`, `src/features/time-allocation/hooks/useWeekAllocations.ts`, `src/features/time-allocation/hooks/useHoursPerDay.ts`, `src/features/time-allocation/hooks/useSaveAllocations.ts`.

Notas de transcripción [fuente: código-existente]:
- `navegador-semana`, `fila-grupo` y `vacio-proyectos` se relevaron como `section` y `empty-state`: contenedores sin tipo propio en el diccionario.
- `mensaje-error` y `vacio-proyectos` comparten la clase `.emptyState` aunque son estados distintos: visualmente son iguales.

## Layout por viewport

### desktop · 1440px

- navegador-semana
  - row `navegacion`
    - boton-semana-anterior
    - rango-semana
    - boton-esta-semana
    - boton-semana-siguiente
- banner-precarga
- **uno** de: cargando-asignaciones · mensaje-error · vacio-proyectos · tabla-asignaciones
  - encabezado-persona × N (en el `<thead>`)
  - fila-grupo por cada uno de los tres grupos
  - celda-editable o celda-lectura por cruce proyecto × persona
  - celda-total-proyecto por fila
  - fila-total al final
- boton-guardar

**Origen:** `WeekNavigator.module.scss` — `.navigation` en fila, con `.rightActions` agrupando boton-esta-semana y boton-semana-siguiente [fuente: código-existente].

**Las fracciones no son derivables:** la pantalla es una pila vertical con una tabla adentro, y el ancho de las columnas de la tabla depende de la cantidad de personas — son `N + 2` columnas (proyecto + N personas + total), no una grilla de 12.

La tabla usa `@include table-container` (`WeeklyAllocationTable.module.scss:29`), que aporta radio, sombra y **`overflow: hidden`, no `auto`**: con muchas personas las columnas se comprimen sin scroll horizontal.

## Contenido

### navegador-semana
- Texto/label: contenedor de los tres botones y el rango
- Icono: nada
- Asset: nada
- Annotation: `<WeekNavigator>` (`:367`)

### boton-semana-anterior
- Texto/label: `"‹ Anterior"` (`WeekNavigator.tsx:91`)
- Icono: nada — el chevron `‹` es un carácter del texto, no un icono
- Asset: nada
- Annotation: nada

### rango-semana
- Texto/label: dinámico — el rango de la semana, compuesto con nombres de mes en español en minúscula (`"enero"`…`"diciembre"`, `WeekNavigator.tsx:8-19`)
- Icono: nada
- Asset: nada
- Annotation: `<span className={styles.rangeLabel}>` (`WeekNavigator.tsx:92`)

### boton-esta-semana
- Texto/label: `"Esta semana"` (`WeekNavigator.tsx:94`)
- Icono: nada
- Asset: nada
- Annotation: se deshabilita cuando ya se está en la semana actual (`disabled={isCurrentWeek}`, `:94`)

### boton-semana-siguiente
- Texto/label: `"Siguiente ›"` (`WeekNavigator.tsx:95`)
- Icono: nada — el chevron `›` es un carácter del texto
- Asset: nada
- Annotation: nada

### banner-precarga
- Texto/label: `"ℹ️ Valores precargados de la semana anterior"` (`:371`)
- Icono: nada — el emoji `ℹ️` es parte del string
- Asset: nada
- Annotation: aparece cuando la semana está vacía y se copiaron los valores de la anterior

### cargando-asignaciones
- Texto/label: `"Cargando asignaciones..."` (`:377`)
- Icono: nada
- Asset: nada
- Annotation: `<Loader>`; reemplaza la tabla, el navegador de semana queda visible

### mensaje-error
- Texto/label: `"No se pudieron cargar las asignaciones. Intentá de nuevo más tarde."` (`:383`)
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.emptyState}>` con un `<p>`, sin `role="alert"`. Además dispara un toast `"Error al cargar las asignaciones de tiempo"` (`:185`), o sea que el error se comunica dos veces

### vacio-proyectos
- Texto/label: `"No hay proyectos con asignaciones para esta semana."` (`:389`)
- Icono: nada
- Asset: nada
- Annotation: comparte la clase `.emptyState` con mensaje-error

### tabla-asignaciones
- Texto/label: encabezados `"Proyecto"` · un `<th>` por persona con su nombre formateado · `"Total"` (`:398-402`). Grupos de fila (`GROUP_LABELS`, `:68-70`): `"Comerciales activos"` (0) · `"Internos activos"` (1) · `"En análisis"` (2). La primera celda de la fila de total dice `"Total"` (`:426`)
- Icono: nada
- Asset: nada
- Annotation: la clasificación de grupo se calcula en el cliente (`:124-125`): `status === 'activo' && type === 'comercial'` → grupo 0; `status === 'activo'` → grupo 1; el resto → grupo 2. La api no devuelve el grupo

### encabezado-persona
- Texto/label: el nombre de la persona formateado
- Icono: nada
- Asset: nada
- Annotation: `<th>` por persona (`:400`)

### fila-grupo
- Texto/label: uno de los tres `GROUP_LABELS` (`"Comerciales activos"` · `"Internos activos"` · `"En análisis"`)
- Icono: nada
- Asset: nada
- Annotation: `<tr className={styles.groupRow}>` con un `<td colSpan>` (`:408-411`)

### celda-editable
- Texto/label: el porcentaje asignado, como valor del input
- Icono: nada
- Asset: nada
- Annotation: `<input type="number" min="0" step="0.1">` sin `max` (`:297-307`, `EditableCell.tsx:37-44`, `:41-42`). El valor es el porcentaje de capacidad; las horas se derivan con `hoursPerDay`, que viene de `GET /settings/hours-per-day`

### celda-lectura
- Texto/label: el porcentaje y las horas, formateados con `formatPercentage` y `formatHours` (`:322-323`)
- Icono: nada
- Asset: nada
- Annotation: `<span className={styles.percentage}>` + `<span className={styles.hours}>`

### celda-total-proyecto
- Texto/label: el total de la fila del proyecto
- Icono: nada
- Asset: nada
- Annotation: `<td className={styles.totalCell}>` (`:336-337`)

### fila-total
- Texto/label: primera celda `"Total"` (`:426`), después el total por persona
- Icono: nada
- Asset: nada
- Annotation: `<tr className={styles.totalRow}>` (`:424-430`)

### boton-guardar
- Texto/label: `"Guardar"` (`:439`)
- Icono: nada
- Asset: nada
- Annotation: `loading={saveMutation.isPending}` (`:441`). **Solo se renderiza si `isEditable`** (`:436`)

### cargando-vista
- Texto/label: `"Cargando asignaciones..."` (`time-allocation/page.tsx:20`)
- Icono: nada
- Asset: nada
- Annotation: `<Loader>` como fallback del `<Suspense>` de la página

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). `!isLoading && !isError && projects.length > 0` (`:393-434`)
- Sub-estado `sobreasignación`: disparado por `overallocatedPersons.has(personId)` en las celdas (`:293`) y `totalPercentage > 100` en la fila de total (`:348`). **Las tres capas se marcan a la vez** — celda-editable (fondo `rgba(251, 3, 63, 0.1)`, borde y texto en `--color-objective-expired`), celda-lectura y celda-total-proyecto de esa persona (`:293`, `:306`, `:319`, `:348`, `:354`, `EditableCell.module.scss:34-39`). **Es color puro:** sin texto, sin icono, sin `aria-invalid`, sin mensaje, y **no bloquea el guardado**
- Sub-estado `precarga desde la semana anterior`: mensaje `"ℹ️ Valores precargados de la semana anterior"`, disparado por `shouldFetchPrevious && allocations.length === 0 && previousWeekData.allocations.length > 0` (`:203-206`). Aparece el banner y las celdas vienen con los valores de la semana anterior (`:370-372`, `:201-216`). `shouldFetchPrevious` requiere `allocations.length === 0 && isAdmin && isEditable` (`:176`)

### empty
- Aplica: Sí
- Mensaje: `"No hay proyectos con asignaciones para esta semana."` (`:389`)
- Cambios:
  - vacio-proyectos: solo visible en este estado (visible_only_in_states)
  - tabla-asignaciones y boton-guardar: ocultos en este estado
  - navegador-semana: sin cambios, queda visible
- Disparado por `!isLoading && !isError && projects.length === 0` (`:387`)

### loading
- Aplica: Sí
- Mensaje: `"Cargando asignaciones..."` (`:377`, y el mismo texto en el fallback del `<Suspense>`, `time-allocation/page.tsx:20`)
- Cambios:
  - cargando-asignaciones: solo visible en este estado (visible_only_in_states)
  - tabla-asignaciones: oculta en este estado
  - navegador-semana: sin cambios, queda visible
- Disparado por `isLoadingAllocations || isLoadingHours` (`:152`)
- Sub-estado `loading del guardado`: spinner en boton-guardar vía `<Button loading>`, disparado por `saveMutation.isPending` (`:441`)
- Nota: **la precarga no tiene loading propio.** La query de la semana anterior corre en segundo plano; mientras llega, la tabla se muestra vacía y después las celdas se llenan de golpe, con el banner apareciendo después (`:180-182`, `:201-216`)

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). No hay validación de ningún tipo que produzca un mensaje. La sobreasignación se marca visualmente (ver `default`) pero no bloquea el guardado ni explica nada, y el input tiene `min="0"` y `step="0.1"` pero **no `max`** (`EditableCell.tsx:41-42`, `:436-442`) [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: en pantalla `"No se pudieron cargar las asignaciones. Intentá de nuevo más tarde."` (`:383`); en toast `"Error al cargar las asignaciones de tiempo"` (`:185`)
- Cambios:
  - mensaje-error: solo visible en este estado (visible_only_in_states)
  - tabla-asignaciones: oculta en este estado
  - navegador-semana: sin cambios, queda visible
- Disparado por `isErrorAllocations || isErrorHours` (`:153`). Es el único caso del producto donde el error de una query se muestra en pantalla **y** por toast

### success
- Aplica: Sí
- Mensaje: toast `"Cambios guardados correctamente"` (`:278`)
- Cambios: solo el toast. El error del guardado usa toast `error.message` o `"Error al guardar los cambios"` (`:282-283`)

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: Sí
- Mensaje: ninguno — **la razón de no poder editar nunca se dice** [fuente: código-existente]
- Cambios:
  - celda-editable: oculta en este estado; en su lugar se renderiza celda-lectura (`:296`)
  - boton-guardar: **no se renderiza** (`:436`)
- Disparado por `!isAdmin || !isWeekEditable(weekStart)` (`:170-171`). Regla de editabilidad copiada del código (`:155-171`): **los domingos**, solo las semanas **futuras** son editables (`week > currentMonday`); **el resto de los días**, la semana actual y las futuras (`week >= currentMonday`); y siempre, además, `isAdmin`. El comentario del código dice *"On Sunday, only future weeks are editable"* / *"On other days, current and future weeks are editable"*, sin decir por qué el domingo es distinto
- Nota: con tres condiciones posibles (no sos admin, es una semana pasada, es domingo y es la semana actual), la UI simplemente muestra texto en vez de inputs y hace desaparecer el botón, sin explicar cuál aplica

## Interacciones

**Eventos:** [fuente: código-existente]
- boton-semana-anterior · click → cambia `weekStart` → refetch (`WeekNavigator.tsx:91`, `:367`)
- boton-semana-siguiente · click → cambia `weekStart` → refetch (`WeekNavigator.tsx:95`, `:367`)
- boton-esta-semana · click → vuelve a la semana actual; deshabilitado si ya está ahí (`WeekNavigator.tsx:94`)
- celda-editable · on change → actualiza `localAllocations[personId-projectId]` (`:297`, `EditableCell.tsx`)
- boton-guardar · click → `saveMutation` con el estado local (`:440`)

**Validaciones:**
- celda-editable · `min="0"` y `step="0.1"` nativos del `<input type="number">`, sin `max` (`EditableCell.tsx:41-42`)
- suma por persona > 100% → marca visual en las celdas de esa persona y en su total, **sin mensaje y sin bloquear el guardado** (`:293`, `:348`)
- No hay ninguna otra regla, y ninguna impide guardar

**Feedback:**
- Total por proyecto (columna) y por persona (fila de total), recalculados en vivo
- Banner de precarga
- Spinner en el botón de guardar
- Toasts de resultado
- Las horas se derivan del porcentaje con `hoursPerDay`, que viene de `GET /settings/hours-per-day` (`:88-91`); cada celda muestra las dos cosas (`:322-323`)

**Pérdida de datos** [fuente: código-existente]: **los cambios sin guardar se pierden al cambiar de semana, sin aviso.** El `useEffect` de `:190-199` repuebla `localAllocations` con los datos de la semana nueva (`:367`).

## Accesibilidad

- **Orden de foco:** boton-semana-anterior → boton-esta-semana → boton-semana-siguiente → celda-editable × (N personas × M proyectos), recorriendo la grilla en el orden del DOM → boton-guardar. En estado terminal / readonly las celdas no son enfocables porque se renderizan como `<span>` (`:296`) [fuente: código-existente].
- **Landmarks y jerarquía:** los landmarks son los del shell. Un solo `<h1>`, el del `PageLayout` (`"Asignación de Tiempo"`, `time-allocation/page.tsx:18`). La pantalla no tiene `<h2>`. **Las filas de grupo son `<tr>` con un `<td colSpan>`** (`:408-411`): una fila de datos que actúa como encabezado de sección, sin `<th scope="rowgroup">` ni `<tbody>` por grupo, así que los lectores de pantalla no la anuncian como agrupamiento.
- **Foco y teclado:** la pantalla no abre modales ni dropdowns, así que no introduce focus traps. No hay atajos de teclado propios.
- **Propio de esta composición:** **las celdas de la grilla no tienen nombre accesible.** `<EditableCell>` es un `<input type="number">` sin `<label>` ni `aria-label`, y la primera celda de cada fila es un `<td>`, no un `<th>` de fila (`EditableCell.tsx:37-44`, `:415-417`): en una grilla de N×M, un lector de pantalla anuncia el input sin decir de qué persona ni de qué proyecto es. **La sobreasignación se comunica únicamente por color** (fondo rojo claro, borde y texto rojos), sin `aria-invalid`, sin texto y sin icono (`EditableCell.module.scss:34-39`). **`banner-precarga` es un `<div>` sin `role="status"` ni `aria-live`**: aparece después del render inicial y no se anuncia (`:370-372`). **Los totales se recalculan al editar sin `aria-live`** (`:340-360`). `mensaje-error` no tiene `role="alert"`, aunque la misma información llega por el toast, que sí se anuncia (`:381-385`, `:185`). El **estado no editable no se anuncia**: las celdas pasan de `<input>` a `<span>` sin ninguna indicación de por qué (`:296`), y `boton-esta-semana` está `disabled` sin `aria-describedby` que diga que ya está en la semana actual (`WeekNavigator.tsx:94`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
