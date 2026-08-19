---
document: UX Survey Screen
screen: listado-tareas
route: /objectives
service: web
source_files:
  - src/app/(loggedin)/objectives/page.tsx
  - src/app/(loggedin)/objectives/styles.module.scss
  - src/app/(loggedin)/objectives/error.tsx
  - src/features/objectives/components/ObjectiveSearchFilters/ObjectiveSearchFilters.tsx
  - src/features/objectives/components/ObjectiveSearchFilters/ObjectiveSearchFilters.module.scss
  - src/features/objectives/components/ObjectivesTable/ObjectivesTable.tsx
  - src/features/objectives/components/TableRow/TableRow.tsx
  - src/features/objectives/components/StateTag/StateTag.tsx
  - src/features/objectives/components/AreaTag/AreaTag.tsx
  - src/shared/components/ui/Pagination/Pagination.tsx
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: listado-tareas

> **Relevamiento as-is** de `/objectives`, extraído de `src/app/(loggedin)/objectives/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md); el dropdown de estado, en
> [_overlays.md](./_overlays.md).

## Identidad

- **Ruta:** `/objectives`
- **Archivo:** `src/app/(loggedin)/objectives/page.tsx` (Server Component,
  `dynamic = 'force-dynamic'`)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** tabla paginada de tareas con 6 filtros, y cambio de estado inline desde la
  propia tabla.
- **Viewports con tratamiento:** ninguno.

## Entrada y salida

**Entradas:**
- Ítem `"Tareas"` de la navegación · `Navbar.tsx:64`

**Salidas:**
- `/objectives/new` · botón `"Nueva tarea"` del encabezado · `objectives/page.tsx:28`
- `/objectives/{id}` · click en cualquier fila · `TableRow.tsx:16`
- La propia ruta con otros `searchParams`, en cada cambio de filtro o de página ·
  `ObjectiveSearchFilters.tsx:74`, `Pagination.tsx:35`

**Redirects automáticos:**
- Ninguno.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | boton-nueva-tarea | `button` | primary | ambos | `<Button label="Nueva tarea" href="/objectives/new">` | `objectives/page.tsx:28` |
| 2 | barra-filtros | `section` | — | ambos | `<section>` en `<ObjectiveSearchFilters>` | `ObjectiveSearchFilters.tsx:107` |
| 3 | buscador-tarea | `search-bar` | default | ambos | `<InputText label="Búsqueda">` | `ObjectiveSearchFilters.tsx:109-120` |
| 4 | filtro-estado | `dropdown` | multi · closed / open | ambos | `<InputMultipleSelect label="Estado">` | `ObjectiveSearchFilters.tsx:123-148` |
| 5 | filtro-proyecto | `dropdown` | closed / open | ambos | `<InputSelect label="Proyecto">` | `ObjectiveSearchFilters.tsx:151-159` |
| 6 | filtro-responsable | `dropdown` | closed / open | ambos | `<InputSelect label="Responsable">` | `ObjectiveSearchFilters.tsx:162-173` |
| 7 | filtro-area | `dropdown` | closed / open | ambos | `<InputSelect label="Área">` | `ObjectiveSearchFilters.tsx:176-190` |
| 8 | filtro-orden | `dropdown` | closed / open | ambos | `<InputSelect label="Ordenar por">` | `ObjectiveSearchFilters.tsx:193-204` |
| 9 | tabla-tareas | `table` | — | ambos | `<table className={styles.tableContainer}>` | `ObjectivesTable.tsx:62` |
| 10 | fila-tarea | `link` | — | ambos | `<TableRow>` → `<tr onClick>` | `TableRow.tsx:20` |
| 11 | pill-estado | `dropdown` | closed / open | ambos | `<StateTag>` — cambia el estado inline | `ObjectivesTable.tsx:80-88` |
| 12 | tag-area-responsable | `badge` | por `data-area` | ambos | `<AreaTag>` con dos `<Tooltip>` | `ObjectivesTable.tsx:92-97` |
| 13 | etiqueta-vencimiento | `badge` | finished / expiresToday / expired / closeToDeadline / default | ambos | `<span>` con clase condicional | `ObjectivesTable.tsx:107-115` |
| 14 | paginacion | `pagination` | — | ambos | `<Pagination totalItems limit>` — **el componente compartido** | `ObjectivesTable.tsx:131` |
| 15 | cargando-tareas | `loader` | — | ambos | `<Loader label="Cargando...">` y `<Loader label="Cargando tabla...">` | `objectives/page.tsx:34-35` |
| 16 | vacio-tareas | `empty-state` | — | ambos | `<h3 className={styles.noObjectives}>` | `ObjectivesTable.tsx:58` |
| 17 | pantalla-error | `alert` | error | ambos | `error.tsx` de la ruta | `objectives/error.tsx:6-11` |

> **Es la única pantalla del producto que usa el componente `<Pagination>` compartido.** Las otras
> cinco tablas paginadas lo reimplementan inline, porque `<Pagination>` hardcodea `/objectives` como
> destino. Ver Observaciones.

> **`vacio-tareas` es un `<h3>`**, no un párrafo: el mensaje de vacío se marca como encabezado.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- boton-nueva-tarea (encabezado de `PageLayout`, a la derecha del título)
- row `filtros` (`flex-wrap: nowrap`)
  - col ~3.6/12: buscador-tarea (`width: 30%`)
  - col ~4.2/12: filtro-estado (`width: 35%`)
  - col ~3/12: filtro-proyecto (`width: 25%`)
  - col ~2/12: filtro-responsable (`width: calc(50%/3)`)
  - col ~2/12: filtro-area (`width: calc(50%/3)`)
  - col ~2/12: filtro-orden (`width: calc(50%/3)`)
- tabla-tareas (7 columnas)
- paginacion

**Origen:** `ObjectiveSearchFilters.module.scss:9-21`:

```scss
& > div { width: calc(50% / 3); }
& > div.searchSelect { width: 30%; }
& > div.stateSelect  { width: 35%; }
& > div.projectSelect { width: 25%; }
```

**Los anchos suman más de 100%:** `30 + 35 + 25 + 3 × 16.67 = 140%`, con `gap: 1rem` × 5 encima y
`flex-wrap: nowrap`. La fila **desborda su contenedor por ~40%**, y `overflow-x: hidden` en el `body`
(`globals.scss:172`) lo recorta: **los últimos filtros quedan fuera de la pantalla**.

Es el cuarto mecanismo de reparto de barra de filtros del producto, y el único donde los anchos no
cierran.

**La tabla no declara anchos de columna:** usa los estilos globales de `table`/`th`/`td`
(`globals.scss:161-187`), con `td { max-width: 9.4rem }` y `white-space: nowrap; overflow: hidden;
text-overflow: ellipsis`. Las 7 columnas se reparten automáticamente y el contenido largo se recorta
con elipsis.

## Contenido

### boton-nueva-tarea
- Texto/label: `"Nueva tarea"`
- Origen: `objectives/page.tsx:28`

### buscador-tarea
- Texto/label: `"Búsqueda"` · placeholder `"Buscar tarea"`
- Origen: `ObjectiveSearchFilters.tsx:110`, `:119`
- Annotation: debounce antes de escribir en `searchParams` (`:102`)

### filtro-estado
- Texto/label: `"Estado"` · placeholder `"Todos"`
- Opciones verbatim: `"Activo"` (`activo`) · `"Backlog"` (`backlog`) · `"En revisión"`
  (`en_revision`) · `"Cancelado"` (`cancelado`) · `"Finalizado"` (`finalizado`) · `:16-20`
- Origen: `ObjectiveSearchFilters.tsx:124`, `:147`
- Annotation: **es multi-selección** (`InputMultipleSelect`). El valor se serializa como lista
  separada por comas en la URL (`:69`). Con la opción `all` presente entre las elegidas, se filtran
  las demás (`:138-142`). **Default: `activo`** (`objectives/page.tsx:25`).

### filtro-proyecto
- Texto/label: `"Proyecto"`
- Opciones: `"Todos"` (`all`) + los proyectos en estado `activo` o `analisis`, ordenados por nombre ·
  `:155`, `:88`
- Origen: `ObjectiveSearchFilters.tsx:152`
- Annotation: **la lista excluye proyectos inactivos, finalizados y cancelados**, igual que en
  `listado-requisitos`. Una tarea de un proyecto cerrado aparece en la tabla y no se puede filtrar
  por su proyecto.

### filtro-responsable
- Texto/label: `"Responsable"`
- Opciones: `"Cualquiera"` (`all`) + las personas · `:167`
- Origen: `ObjectiveSearchFilters.tsx:163`
- Annotation: **el sentinel de "sin filtro" dice `"Cualquiera"` acá y `"Todos"` en los otros tres
  filtros de la misma barra.**

### filtro-area
- Texto/label: `"Área"`
- Opciones verbatim: `"Todos"` (`all`) · `"Desarrollo"` (`desarrollo`) · `"Diseño"` (`diseño`) ·
  `"Gestión"` (`gestion`) · `"Investigación"` (`investigacion`) · `:181-185`
- Origen: `ObjectiveSearchFilters.tsx:177`
- Annotation: el valor de `"Diseño"` es `diseño`, **con `ñ`**, y viaja así en la URL

### filtro-orden
- Texto/label: `"Ordenar por"`
- Opciones verbatim: `"Más recientes"` (`-createdAt`, default) · `"Más antiguos"` (`createdAt`) ·
  `:198-199`
- Origen: `ObjectiveSearchFilters.tsx:194`

### tabla-tareas
- Columnas verbatim (7): `"Proyecto"` · `"Tarea"` · `"Estado"` · `"Área y Responsable"` ·
  `"Prioridad"` · `"Fecha de Inicio"` · `"Fecha de Cierre"`
- Origen: `ObjectivesTable.tsx:65-71`
- Formato de fecha de inicio: `toLocaleDateString('es-ES', { month: 'short', year: 'numeric', ... })` ·
  `:101-105`
- Prioridad: el número crudo · `:99`

> **`"Área y Responsable"` es una sola columna con dos datos**, renderizada por `<AreaTag>`: un
> cuadrito de color para el área (con tooltip que dice el área) y el nombre del responsable (con
> tooltip que dice el proyecto o la lista completa). El área **no tiene texto visible**, solo color.

### etiqueta-vencimiento
- Textos verbatim posibles:
  - `"No definida"` cuando no hay fecha estimada · `ObjectivesTable.tsx:19`
  - `"Vence hoy"` · `:36`
  - el texto calculado por `getFinishDateText` para el resto de los casos · `:114`
- Origen: `ObjectivesTable.tsx:16-40`, `:107-115`
- Annotation: la tarea finalizada usa una clase distinta (`styles.finished`, `:109`)

### vacio-tareas
- Texto/label: `"No hay tareas que coincidan con estos filtros."`
- Origen: `ObjectivesTable.tsx:58`

### cargando-tareas
- Textos verbatim: `"Cargando..."` (Suspense externo) y `"Cargando tabla..."` (Suspense interno)
- Origen: `objectives/page.tsx:34`, `:35`
- Annotation: **hay dos `<Suspense>` anidados**, uno dentro del otro, con labels distintos. Ver
  Observaciones.

### pantalla-error
- Texto/label: `"Error"` como título y **`"Error inesperado"`** fijo como cuerpo
- Origen: `objectives/error.tsx:8-9`
- Annotation: **descarta el error real.** El parámetro se renombra a `_error` y no se usa
  (`objectives/error.tsx:5`). Los otros cuatro `error.tsx` del producto muestran `error.message`.

## Estados presentes

### default
- Disparado por: query resuelta con al menos una tarea
- Origen: `ObjectivesTable.tsx:56-134`

### loading (dos niveles anidados)
- Mensajes: `"Cargando..."` y `"Cargando tabla..."`
- Disparado por: los dos `<Suspense>` de la página. El externo lleva
  `key={JSON.stringify(filters)}`, así que remonta al cambiar filtros
- Origen: `objectives/page.tsx:34-38`
- Cambios: reemplaza la tabla; la barra de filtros queda

### empty
- Mensaje: `"No hay tareas que coincidan con estos filtros."`
- Disparado por: `objectives.length === 0`
- Origen: `ObjectivesTable.tsx:57-59`
- Cambios: reemplaza la tabla completa, incluidos los encabezados

### error de sistema (render de servidor)
- Mensaje: `"Error"` + `"Error inesperado"`
- Disparado por: excepción no atrapada en el render
- Origen: `objectives/error.tsx:5-11`
- Cambios: reemplaza el contenido de la ruta; la sidebar queda

### estados de vencimiento (sub-estados de default)
| Estado | Disparado por | Origen |
|---|---|---|
| finalizada | la tarea está finalizada | `ObjectivesTable.tsx:108-112` |
| vence hoy | la fecha estimada es hoy | `:34-37` |
| vencida / próxima al vencimiento | cálculo sobre la fecha estimada | `:16-40` |
| sin fecha | `"No definida"` | `:18-19` |

### cambio de estado inline
- Disparado por: seleccionar una opción en `pill-estado`
- Origen: `StateTag.tsx:55-64`
- Cambios: toast `` `Se cambió el estado de la tarea a ${newValue}` `` o
  `"Hubo un error al cambiar el estado"`. Ver [_overlays.md](./_overlays.md).

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error de la query de tareas** | **no se maneja en el componente.** `ObjectivesTable` recibe los datos ya resueltos; un fallo de la Server Action lanza y lo agarra el `error.tsx`, que **muestra `"Error inesperado"` sin decir qué pasó** | `ObjectivesTable.tsx:~50`, `objectives/error.tsx:9` |
| **el error real se descarta** | el `error.tsx` renombra el parámetro a `_error` y muestra un texto fijo. Es el único de los cinco boundaries del producto que hace esto | `objectives/error.tsx:5-9` |
| empty de primer uso | no diferenciado del empty por filtros. Agravado porque el default de estado es `activo` | `ObjectivesTable.tsx:58`, `objectives/page.tsx:25` |
| error de validación | no aplica: la pantalla no tiene formulario | — |
| success | el cambio de estado inline sí produce toast de éxito | `StateTag.tsx:59` |
| not found | no aplica: es un listado | — |
| **estado terminal / readonly** | **no existe.** Una tarea `finalizado` o `cancelado` ofrece el mismo dropdown con las 5 opciones, incluida volver a `activo`. El único tratamiento es la clase de la etiqueta de vencimiento | `StateTag.tsx:21-25`, `ObjectivesTable.tsx:108-112` |
| **loading del cambio de estado** | ausente: la pill no se deshabilita ni muestra spinner durante la mutación | `StateTag.tsx:82-89` |
| **filtros fuera de pantalla** | los anchos de la barra suman 140% con `nowrap`: los últimos filtros quedan recortados por el `overflow-x: hidden` del body, **sin scroll para alcanzarlos** | `ObjectiveSearchFilters.module.scss:9-21`, `globals.scss:172` |

## Interacciones

**Eventos:**
- buscador-tarea · on change → debounce → `router.push('/objectives?search=…')` ·
  `ObjectiveSearchFilters.tsx:102`
- filtro-estado · on change → serializa la selección múltiple a lista con comas → `router.push` ·
  `ObjectiveSearchFilters.tsx:66-72`, `:137-145`
- los otros cuatro filtros · on change → `router.push` inmediato · `:157`, `:171`, `:188`, `:202`
- **cambio de cualquier filtro → resetea `page` a 1** · `ObjectiveSearchFilters.tsx:55-57`
- fila-tarea · click → `router.push('/objectives/{id}')` · `TableRow.tsx:16`
- pill-estado · click → abre el dropdown; seleccionar → muta el estado ·
  `StateTag.tsx:74-78`, `:55-64`
- paginacion · click → `router.push('/objectives?page=N')` · `Pagination.tsx:34-36`

**Validaciones:**
- Ninguna.

**Feedback:**
- Cambio de filtro: el `<Suspense key>` remonta y muestra `"Cargando..."`
- Hover en la fila: `tr:hover { background-color: var(--color-surface-hover) }` global ·
  `globals.scss:187`
- Cursor: `style={{ cursor: 'pointer' }}` inline en la fila · `TableRow.tsx:20`
- Cambio de estado: toast

> **`ObjectiveSearchFilters` sí resetea la página al filtrar** (`:55-57`), igual que
> `RequirementList` y a diferencia de `ClientListFilters` y `ProjectListFilters`.

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Labels de los filtros | Presentes vía la prop `label` de `InputText` / `InputSelect` / `InputMultipleSelect` — usa los componentes compartidos, a diferencia de `RequirementFilters` | `ObjectiveSearchFilters.tsx:110`, `:124`, `:152`, `:163`, `:177`, `:194` |
| Encabezados de tabla | `<th>` dentro de `<thead>`. Correcto | `ObjectivesTable.tsx:63-72` |
| **Filas clickeables** | `<tr onClick>` **sin `role`, sin `tabIndex`, sin handler de teclado**, con el cursor puesto por estilo inline. La tabla **no es navegable por teclado** | `TableRow.tsx:20` |
| Área comunicada solo por color | `<span className={styles.areaLabel} data-area={area} />` es un `<span>` **vacío**: el área se comunica **únicamente por color**, con el nombre en un `Tooltip` que es solo `:hover`. **Inaccesible por teclado y por lector de pantalla** | `AreaTag.tsx:32-34`, `Tooltip.module.scss:37` |
| Tooltips | Solo `:hover`, sin `aria-describedby`. Ver [_overlays.md](./_overlays.md) | `AreaTag.tsx:32`, `:35` |
| `pill-estado` | Sin `aria-expanded`, sin `aria-haspopup`, sin `role="listbox"`. Ver [_overlays.md](./_overlays.md) | `StateTag.tsx:82-99` |
| Paginación | `<nav aria-label="Paginación" role="navigation">` con `aria-label` por página y `aria-current="page"`. **Es la paginación mejor resuelta del producto** | `Pagination.tsx:43`, `:48`, `:62-63`, `:73` |
| Prioridad | Número crudo (0-5) sin leyenda de la escala | `ObjectivesTable.tsx:99` |
| Anuncio del resultado del filtrado | **ausente:** sin `aria-live` | `ObjectivesTable.tsx:56` |
| Vacío como `<h3>` | El mensaje de vacío es un encabezado de nivel 3 sin `<h2>` previo: aparece en el índice de encabezados como si fuera una sección | `ObjectivesTable.tsx:58` |
| Anuncio del cambio de estado | El toast lo anuncia (`react-toastify` usa `role="alert"`), pero con el **valor crudo** (`en_revision`) | `StateTag.tsx:59` |

## Observaciones del relevamiento

- **La barra de filtros desborda.** Los seis anchos suman 140% con `flex-wrap: nowrap`
  (`ObjectiveSearchFilters.module.scss:9-21`), y el `overflow-x: hidden` del `body` recorta sin
  ofrecer scroll: **los últimos filtros son inalcanzables**. Es el hallazgo de layout más concreto del
  producto, y es la cuarta implementación distinta de la misma barra (actores con `flex`, proyectos con
  `width: calc()` que suma 100%, requisitos con `flex` inline, y esta con `width` que suma 140%).
- **`error.tsx` descarta el error.** `objectives/error.tsx:5-9` renombra el parámetro a `_error` y
  muestra `"Error inesperado"` fijo. Los otros cuatro boundaries del producto muestran
  `error.message`. No se puede determinar si es una decisión de no filtrar detalles o un descuido.
- **Es la única pantalla que usa `<Pagination>`**, y no por casualidad: el componente hardcodea
  `router.push('/objectives?...')` (`Pagination.tsx:35`). Es la causa de que las otras cinco tablas
  paginadas del producto reimplementen la paginación inline. Irónicamente, **`<Pagination>` es la
  implementación con mejor accesibilidad** de las seis.
- **Dos `<Suspense>` anidados** con labels distintos (`objectives/page.tsx:34-38`). El externo tiene la
  `key` de filtros; el interno no aporta nada visible, porque el externo ya cubre el mismo subárbol.
  No se puede determinar la intención.
- **El área de la tarea se comunica solo por color.** `AreaTag` renderiza un `<span>` vacío con
  `data-area` y el nombre queda en un tooltip de `:hover` (`AreaTag.tsx:32-34`). Para un usuario de
  teclado o de lector de pantalla, la columna `"Área y Responsable"` solo tiene el responsable.
- **`"Cualquiera"` vs `"Todos"`:** el sentinel de "sin filtro" tiene dos textos distintos dentro de la
  misma barra (`:167` vs `:73`, `:155`, `:181`).
- **`diseño` con `ñ` viaja en la URL** como valor de filtro (`:335` del alta, `:184` acá).
- **La paginación usa un `totalItems` real.** `ObjectivesTable` recibe `objectivesCount`
  (`:131`), que viene de una segunda llamada con `&count=true` (`objectivesApi.ts`). Es el único
  listado del producto que conoce su total — y aun así **no lo muestra**.
- **A confirmar en consolidación:** si el `error.tsx` debe mostrar el error real, si el área necesita
  texto además de color, y si el total de resultados debe mostrarse (el dato ya está).
