---
name: listado-tareas
surface: web
route: /objectives
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.1"
date: 2026-09-02
---

# Pantalla: Listado de tareas

## Identidad

- **Audiencia primaria:** equipo-interno.
- **JTBD / Propósito:** consultar una tabla paginada de tareas con 6 filtros, y cambiar el estado de una tarea inline desde la propia tabla [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport de la superficie. La pantalla no declara ningún tratamiento responsive: la barra de 6 filtros y la tabla de 7 columnas se rinden igual a cualquier ancho [fuente: código-existente].
  - Mobile queda fuera de la superficie `web`: el shell tiene una sidebar de 290px fija sin ninguna media query, así que por debajo de ese ancho no hay navegación disponible (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Desde la navegación del shell · ítem `"Tareas"` (`Navbar.tsx:64`)

**Salidas user-driven:**
- A `/objectives/new` · click en boton-nueva-tarea (`objectives/page.tsx:28`)
- A `/objectives/{id}` · click en cualquier fila-tarea (`TableRow.tsx:16`)
- A la propia ruta con otros `searchParams` · cada cambio de filtro o de página (`ObjectiveSearchFilters.tsx:74`, `Pagination.tsx:35`)

**Salidas automáticas:**
- Ninguna.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | boton-nueva-tarea | button | primary | input | desktop | — | Disparador del alta |
| 2 | barra-filtros | section | — | layout | desktop | — | Agrupa los seis filtros |
| 3 | buscador-tarea | search-bar | default | input | desktop | — | Filtra por texto |
| 4 | filtro-estado | dropdown | multi · closed / open | input | desktop | — | Filtra por uno o varios estados |
| 5 | filtro-proyecto | dropdown | closed / open | input | desktop | — | Filtra por proyecto |
| 6 | filtro-responsable | dropdown | closed / open | input | desktop | — | Filtra por persona responsable |
| 7 | filtro-area | dropdown | closed / open | input | desktop | — | Filtra por área |
| 8 | filtro-orden | dropdown | closed / open | input | desktop | — | Ordena el resultado |
| 9 | tabla-tareas | table | — | content | desktop | hidden_in_states: empty, loading, error de sistema | 7 columnas con las tareas |
| 10 | fila-tarea | link | — | navigation | desktop | — | Navega al detalle de la tarea |
| 11 | pill-estado | dropdown | closed / open | input | desktop | — | Cambia el estado inline |
| 12 | tag-area-responsable | badge | por `data-area` | content | desktop | — | Área (color) y responsable |
| 13 | etiqueta-vencimiento | badge | finished / expiresToday / expired / closeToDeadline / default | content | desktop | — | Estado de vencimiento de la tarea |
| 14 | paginacion | pagination | modo URL | navigation | desktop | hidden_in_states: empty, loading, error de sistema | Navegación entre páginas, con ventana de máximo 10 números |
| 15 | cargando-tareas | loader | — | feedback | desktop | visible_only_in_states: loading | Fallback de los dos `<Suspense>` |
| 16 | vacio-tareas | empty-state | — | feedback | desktop | visible_only_in_states: empty | Mensaje de sin resultados |
| 17 | pantalla-error | alert | error | feedback | desktop | visible_only_in_states: error de sistema | `error.tsx` de la ruta |

**Origen:** `src/app/(loggedin)/objectives/page.tsx`, `src/app/(loggedin)/objectives/styles.module.scss`, `src/app/(loggedin)/objectives/error.tsx`, `src/features/objectives/components/ObjectiveSearchFilters/ObjectiveSearchFilters.tsx`, `src/features/objectives/components/ObjectiveSearchFilters/ObjectiveSearchFilters.module.scss`, `src/features/objectives/components/ObjectivesTable/ObjectivesTable.tsx`, `src/features/objectives/components/TableRow/TableRow.tsx`, `src/features/objectives/components/StateTag/StateTag.tsx`, `src/features/objectives/components/AreaTag/AreaTag.tsx`, `src/shared/components/ui/Pagination/Pagination.tsx`.

Notas de transcripción [fuente: código-existente]:
- Es la única pantalla del producto que usa el componente `<Pagination>` compartido; las otras cinco tablas paginadas lo reimplementan inline porque `<Pagination>` hardcodea `/objectives` como destino.
- `vacio-tareas` es un `<h3>`, no un párrafo: el mensaje de vacío se marca como encabezado (`ObjectivesTable.tsx:58`).
- `pill-estado` está relevado como overlay compartido en `_overlays.md` (`StateTag`).

## Layout por viewport

### desktop · 1440px

- boton-nueva-tarea (en el encabezado de `PageLayout`, a la derecha del título)
- row `filtros` (`flex-wrap: nowrap`)
  - col ~3.6/12: buscador-tarea
  - col ~4.2/12: filtro-estado
  - col ~3/12: filtro-proyecto
  - col ~2/12: filtro-responsable
  - col ~2/12: filtro-area
  - col ~2/12: filtro-orden
- tabla-tareas
- paginacion

**Origen:** `ObjectiveSearchFilters.module.scss:9-21` [fuente: código-existente]:

```scss
& > div { width: calc(50% / 3); }
& > div.searchSelect { width: 30%; }
& > div.stateSelect  { width: 35%; }
& > div.projectSelect { width: 25%; }
```

**Los anchos declarados suman más de 100%:** `30 + 35 + 25 + 3 × 16.67 = 140%`, con `gap: 1rem` × 5 encima y `flex-wrap: nowrap`. La fila desborda su contenedor por ~40%, y el `overflow-x: hidden` del `body` (`globals.scss:172`) lo recorta: **los últimos filtros quedan fuera de la pantalla, sin scroll para alcanzarlos**. Las fracciones de arriba son la traducción proporcional de esos anchos declarados, no el reparto real en pantalla.

**La tabla no declara anchos de columna:** usa los estilos globales de `table`/`th`/`td` (`globals.scss:161-187`), con `td { max-width: 9.4rem }` y `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. Las 7 columnas se reparten automáticamente y el contenido largo se recorta con elipsis, así que **no hay fracciones de 12 derivables para la tabla**.

## Contenido

### boton-nueva-tarea
- Texto/label: `"Nueva tarea"` (`objectives/page.tsx:28`)
- Icono: nada
- Asset: nada
- Annotation: `<Button label="Nueva tarea" href="/objectives/new">`

### barra-filtros
- Texto/label: contenedor sin texto propio
- Icono: nada
- Asset: nada
- Annotation: `<section>` en `<ObjectiveSearchFilters>` (`ObjectiveSearchFilters.tsx:107`)

### buscador-tarea
- Texto/label: label `"Búsqueda"`; placeholder `"Buscar tarea"` (`ObjectiveSearchFilters.tsx:110`, `:119`)
- Icono: nada
- Asset: nada
- Annotation: debounce antes de escribir en `searchParams` (`:102`)

### filtro-estado
- Texto/label: label `"Estado"`; placeholder `"Todos"`. Opciones verbatim: `"Activo"` (`activo`) · `"Backlog"` (`backlog`) · `"En revisión"` (`en_revision`) · `"Cancelado"` (`cancelado`) · `"Finalizado"` (`finalizado`) (`:16-20`)
- Icono: nada
- Asset: nada
- Annotation: es multi-selección (`InputMultipleSelect`). El valor se serializa como lista separada por comas en la URL (`:69`). Con la opción `all` entre las elegidas se filtran las demás (`:138-142`). **Default: `activo`** (`objectives/page.tsx:25`)

### filtro-proyecto
- Texto/label: label `"Proyecto"`. Opciones: `"Todos"` (`all`) + los proyectos en estado `activo` o `analisis`, ordenados por nombre (`:155`, `:88`)
- Icono: nada
- Asset: nada
- Annotation: la lista excluye proyectos inactivos, finalizados y cancelados. Una tarea de un proyecto cerrado aparece en la tabla y no se puede filtrar por su proyecto

### filtro-responsable
- Texto/label: label `"Responsable"`. Opciones: `"Cualquiera"` (`all`) + las personas (`:167`)
- Icono: nada
- Asset: nada
- Annotation: el sentinel de "sin filtro" dice `"Cualquiera"` acá y `"Todos"` en los otros tres filtros de la misma barra

### filtro-area
- Texto/label: label `"Área"`. Opciones verbatim: `"Todos"` (`all`) · `"Desarrollo"` (`desarrollo`) · `"Diseño"` (`diseño`) · `"Gestión"` (`gestion`) · `"Investigación"` (`investigacion`) (`:181-185`)
- Icono: nada
- Asset: nada
- Annotation: el valor de `"Diseño"` es `diseño`, con `ñ`, y viaja así en la URL

### filtro-orden
- Texto/label: label `"Ordenar por"`. Opciones verbatim: `"Más recientes"` (`-createdAt`, default) · `"Más antiguos"` (`createdAt`) (`:198-199`)
- Icono: nada
- Asset: nada
- Annotation: nada

### tabla-tareas
- Texto/label: columnas verbatim (7): `"Proyecto"` · `"Tarea"` · `"Estado"` · `"Área y Responsable"` · `"Prioridad"` · `"Fecha de Inicio"` · `"Fecha de Cierre"` (`ObjectivesTable.tsx:65-71`)
- Icono: nada
- Asset: nada
- Annotation: la fecha de inicio se formatea con `toLocaleDateString('es-ES', { month: 'short', year: 'numeric', ... })` (`:101-105`); la prioridad se muestra como el número crudo (`:99`). `"Área y Responsable"` es una sola columna con dos datos, renderizada por `<AreaTag>`

### fila-tarea
- Texto/label: los valores de las 7 columnas de esa tarea
- Icono: nada
- Asset: nada
- Annotation: `<tr onClick>` con `style={{ cursor: 'pointer' }}` inline (`TableRow.tsx:16`, `:20`)

### pill-estado
- Texto/label: el `label` de la opción seleccionada. Opciones verbatim: `"Activo"` · `"Backlog"` · `"En revisión"` · `"Cancelado"` · `"Finalizado"` (`StateTag.tsx:21-25`)
- Icono: nada
- Asset: nada
- Annotation: cambia el estado inline. Toast de éxito: `` `Se cambió el estado de la tarea a ${newValue}` `` (`:59`) — **interpola el valor crudo de la api, no la etiqueta**: dice `"Se cambió el estado de la tarea a en_revision"`, con guion bajo y sin tilde. Toast de error: `"Hubo un error al cambiar el estado"` (`:62`)

### tag-area-responsable
- Texto/label: el nombre del responsable como texto; **el área no tiene texto visible, solo color** (`<span className={styles.areaLabel} data-area={area} />` vacío)
- Icono: nada
- Asset: nada
- Annotation: dos `<Tooltip>` de `:hover` — uno dice el área, otro el proyecto o la lista completa de responsables (`AreaTag.tsx:32`, `:35`)

### etiqueta-vencimiento
- Texto/label: textos verbatim posibles: `"No definida"` cuando no hay fecha estimada (`ObjectivesTable.tsx:19`) · `"Vence hoy"` (`:36`) · el texto calculado por `getFinishDateText` para el resto de los casos (`:114`)
- Icono: nada
- Asset: nada
- Annotation: la tarea finalizada usa una clase distinta (`styles.finished`, `:109`)

### paginacion
- Texto/label: los números de página
- Icono: nada
- Asset: nada
- Annotation: componente compartido `<Pagination totalItems limit>` (`ObjectivesTable.tsx:131`). Recibe `objectivesCount`, que viene de una segunda llamada con `&count=true`: es el único listado del producto que conoce su total, y **no lo muestra**
- **REQ-008:** muestra **como máximo 10 números** en una ventana centrada en la página actual y ajustada a los extremos —página 1 de 30 → `1-10`; página 15 → `10-19`; página 30 → `21-30`—, en lugar de un botón por página. Con 10 páginas o menos las muestra todas, sin relleno ni huecos (RF-1, RF-2, CA-1 a CA-4). **La navegación no cambia:** sigue siendo por URL contra `/objectives` con el `page` actualizado; el único cambio observable es cuántos números hay (RF-5, CA-5). El componente deja de tener la ruta hardcodeada, pero esta pantalla la sigue recibiendo y se comporta igual

### cargando-tareas
- Texto/label: `"Cargando..."` (Suspense externo) y `"Cargando tabla..."` (Suspense interno) (`objectives/page.tsx:34`, `:35`)
- Icono: nada
- Asset: nada
- Annotation: hay dos `<Suspense>` anidados con labels distintos

### vacio-tareas
- Texto/label: `"No hay tareas que coincidan con estos filtros."` (`ObjectivesTable.tsx:58`)
- Icono: nada
- Asset: nada
- Annotation: es un `<h3>`

### pantalla-error
- Texto/label: `"Error"` como título y `"Error inesperado"` fijo como cuerpo (`objectives/error.tsx:8-9`)
- Icono: nada
- Asset: nada
- Annotation: **descarta el error real**: el parámetro se renombra a `_error` y no se usa (`objectives/error.tsx:5`)

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Query resuelta con al menos una tarea (`ObjectivesTable.tsx:56-134`)
- Sub-estados de vencimiento por fila (`ObjectivesTable.tsx:16-40`, `:107-115`): finalizada (`:108-112`) · vence hoy (`:34-37`) · vencida / próxima al vencimiento (`:16-40`) · sin fecha, con el texto `"No definida"` (`:18-19`)
- Sub-estado de cambio de estado inline: seleccionar una opción en pill-estado dispara la mutación y su toast (`StateTag.tsx:55-64`)

### empty
- Aplica: Sí
- Mensaje: `"No hay tareas que coincidan con estos filtros."` (`ObjectivesTable.tsx:58`)
- Cambios:
  - vacio-tareas: solo visible en este estado (visible_only_in_states)
  - tabla-tareas: oculta en este estado, **incluidos los encabezados** (hidden_in_states)
  - paginacion: oculta en este estado
  - barra-filtros: sin cambios, queda visible
- Nota: no diferencia el empty de primer uso del empty por filtros, agravado porque el default de estado es `activo` (`objectives/page.tsx:25`)

### loading
- Aplica: Sí
- Mensaje: `"Cargando..."` y `"Cargando tabla..."` (`objectives/page.tsx:34-38`)
- Cambios:
  - cargando-tareas: solo visible en este estado (visible_only_in_states)
  - tabla-tareas y paginacion: ocultas en este estado
  - barra-filtros: sin cambios, queda visible
- Los dos `<Suspense>` están anidados; el externo lleva `key={JSON.stringify(filters)}`, así que remonta al cambiar filtros
- **No hay loading del cambio de estado inline:** la pill no se deshabilita ni muestra spinner durante la mutación (`StateTag.tsx:82-89`)

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). La pantalla no tiene formulario de escritura

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"Error"` + `"Error inesperado"` (`objectives/error.tsx:5-11`)
- Cambios:
  - pantalla-error: solo visible en este estado (visible_only_in_states); reemplaza el contenido de la ruta, la sidebar del shell queda
  - Disparado por una excepción no atrapada en el render
- Nota: **el error real se descarta.** El `error.tsx` renombra el parámetro a `_error` y muestra un texto fijo; es el único de los cinco boundaries del producto que hace esto (`objectives/error.tsx:5-9`)

### success
- Aplica: Sí
- Mensaje: toast `` `Se cambió el estado de la tarea a ${newValue}` `` (`StateTag.tsx:59`)
- Cambios: solo el toast, tras el cambio de estado inline. El texto interpola el valor crudo de la api (`en_revision`), no la etiqueta

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). Una tarea `finalizado` o `cancelado` ofrece el mismo dropdown con las 5 opciones, incluida volver a `activo`; el único tratamiento es la clase de etiqueta-vencimiento (`StateTag.tsx:21-25`, `ObjectivesTable.tsx:108-112`) [fuente: código-existente]

## Interacciones

**Eventos:** [fuente: código-existente]
- buscador-tarea · on change → debounce → `router.push('/objectives?search=…')` (`ObjectiveSearchFilters.tsx:102`)
- filtro-estado · on change → serializa la selección múltiple a lista con comas → `router.push` (`:66-72`, `:137-145`)
- filtro-proyecto / filtro-responsable / filtro-area / filtro-orden · on change → `router.push` inmediato (`:157`, `:171`, `:188`, `:202`)
- cambio de cualquier filtro → resetea `page` a 1 (`ObjectiveSearchFilters.tsx:55-57`)
- fila-tarea · click → `router.push('/objectives/{id}')` (`TableRow.tsx:16`)
- pill-estado · click → abre el dropdown; seleccionar una opción → muta el estado (`StateTag.tsx:74-78`, `:55-64`)
- paginacion · click → `router.push('/objectives?page=N')` (`Pagination.tsx:34-36`). **REQ-008: sin cambios** — el arreglo de la ventana no toca el comportamiento de navegación de esta pantalla (CA-5)
- boton-nueva-tarea · click → navega a `/objectives/new`

**Validaciones:**
- Ninguna.

**Feedback:**
- Cambio de filtro: el `<Suspense key>` remonta y muestra `"Cargando..."`
- Hover en la fila: `tr:hover { background-color: var(--color-surface-hover) }` global (`globals.scss:187`)
- Cursor: `style={{ cursor: 'pointer' }}` inline en la fila (`TableRow.tsx:20`)
- Cambio de estado: toast

## Accesibilidad

- **Orden de foco:** boton-nueva-tarea → buscador-tarea → filtro-estado → filtro-proyecto → filtro-responsable → filtro-area → filtro-orden → pill-estado de cada fila → paginacion. **Las filas de la tabla no están en el orden de foco:** `fila-tarea` es un `<tr onClick>` sin `role`, sin `tabIndex` y sin handler de teclado, con el cursor puesto por estilo inline, así que **la tabla no es navegable por teclado** y el destino de cada fila es inalcanzable sin mouse (`TableRow.tsx:20`) [fuente: código-existente].
- **Landmarks y jerarquía:** los landmarks son los del shell (`<nav>`, `<main>`, `<aside>`, `<header>` de `PageLayout`) más el `<section>` de barra-filtros. Un solo `<h1>`, el del shell. **`vacio-tareas` es un `<h3>` sin `<h2>` previo** (`ObjectivesTable.tsx:58`): el mensaje de vacío aparece en el índice de encabezados como si fuera una sección.
- **Foco y teclado:** el overlay de esta composición es el dropdown de pill-estado (`StateTag`), que **no cierra por click afuera ni con `Escape`, y no tiene `aria-expanded` ni `aria-haspopup` ni `role="listbox"`** (`StateTag.tsx:71-79`, `:82-99`); ver `_overlays.md`. No hay atajos de teclado propios de la pantalla.
- **Propio de esta composición:** el resultado del filtrado se reemplaza **sin ninguna región live** que lo anuncie (`ObjectivesTable.tsx:56`). **El área de la tarea se comunica únicamente por color:** `<AreaTag>` renderiza un `<span>` vacío con `data-area` y el nombre queda en un `Tooltip` de `:hover`, así que para un usuario de teclado o de lector de pantalla la columna `"Área y Responsable"` solo tiene el responsable (`AreaTag.tsx:32-34`, `Tooltip.module.scss:37`). La prioridad se muestra como número crudo (0-5) sin leyenda de la escala (`ObjectivesTable.tsx:99`). El cambio de estado sí se anuncia por el toast (`react-toastify` usa `role="alert"`), pero con el valor crudo (`StateTag.tsx:59`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-008 — Paginación y totales reales en los requisitos del proyecto (2026-08-31)

- **Esta pantalla no cambia de comportamiento: cambia cuántos números ve el usuario.** Con 30 páginas dibujaba 30 botones, una fila de números que no cabe y en la que ninguno destaca. La ventana de 10 centrada en la página actual mantiene siempre visibles las páginas vecinas —las únicas a las que se salta de verdad— y acota el recorrido por teclado a un tramo constante.
- **Se descartó la elipsis con primera y última** (el patrón `1 … 14 15 16 … 30`) que usaban los paginadores inline del producto. Muestra menos contexto alrededor de la posición actual y agrega dos elementos no interactivos al recorrido; la ventana corrida da lo mismo sin huecos.
- **El total sigue sin mostrarse.** Esta pantalla es la única del producto que conoce su total —lo pide con `count=true`— y no lo dice en ninguna parte. Está fuera del alcance de este requerimiento, que se ocupa de cuántos números dibuja el paginador. **Queda registrado como gap**: el dato ya está pedido, mostrarlo no cuesta una llamada más.
- **El paginador pierde la ruta hardcodeada, y esta pantalla no se entera.** El componente pasa a aceptar una ruta o un callback para poder servir también a la card de requisitos del proyecto; acá se sigue usando en modo URL contra `/objectives`, con la misma navegación de siempre (RF-4, RF-5).
- **No se agregó componente al Design System.** `pagination` no tiene spec en `web` v0.1.0; el gap es previo y este requerimiento lo reduce, porque deja un único paginador en el producto en vez de varios reimplementados. Anotado en la `## Revisión UX` de REQ-008.
- **[REQ-013] La identidad cambia; la pantalla, no.** Esta ficha documenta *qué* hay en la pantalla y *para qué* está; el Manual de marca Jiku v1.0 cambia **con qué está construido**. El accent pasa del magenta `#DA2C6A` al verde agua `#61CCB9` sobre azul oscuro `#0B1934` con fondo niebla `#F6F6F9`, y Archivo se reemplaza por Sora (títulos de vista) + Gabarito (interfaz, datos, microcopy). Ningún bloque de esta pantalla se agrega, se elimina ni cambia de propósito por ese motivo [REQ-013 RF-1, RF-2, CA-1].
- **[REQ-013] Cada elemento hecho a mano pasa a su componente del Design System.** Los bloques que esta ficha declara —botones, campos, selects, tarjetas, tablas, badges— se implementan con los componentes normativos de `docs/design-system/web/components/`, no con marcado propio. Es un cambio de implementación con consecuencia visible —dejan de haber dos botones que se ven distinto haciendo lo mismo— pero **no cambia la estructura declarada acá**: un bloque que ya existía sigue existiendo, con el mismo tipo y el mismo propósito [REQ-013 RF-3, RF-4, CA-5, CA-10].
- **[REQ-013] Los estados declarados en esta ficha se conservan.** La migración es de presentación: ningún estado se agrega, se quita ni cambia su condición de disparo. Lo que cambia es cómo se ve cada uno —el loader es ahora uno solo, el vacío tiene componente `EmptyState` disponible— sin que la ficha declare estados nuevos. **Cablear `EmptyState` en las pantallas que hoy no tienen estado vacío queda fuera de este REQ** y sigue registrado en `gaps-as-is.md` [REQ-013 §Fuera de Alcance].
- **[REQ-013] `desktop` sigue siendo el viewport único.** El requerimiento **no** habilita mobile: el DS mantiene el responsive del shell como objetivo declarado sin fecha y no declara el viewport `mobile` hasta que el shell lo cumpla. El layout por viewport de esta ficha no cambia [REQ-013 §Fuera de Alcance, CA-15].
- **[REQ-013] El selector de tema vive en el shell, no en esta pantalla.** La superficie gana modo oscuro con un control para elegirlo, ubicado en el pie de la sidebar junto a Cerrar sesión. Como es parte del shell de `(loggedin)`, está presente acá pero **no se declara como bloque de esta ficha**: declararlo en las 21 pantallas autenticadas repetiría veintiuna veces el mismo control. En modo oscuro esta pantalla usa la paleta propia del DS —canvas `#0E121A`, superficies `#1B202C` separadas por contraste y sin borde—, no una inversión de la clara [REQ-013 RF-7, CA-11].
