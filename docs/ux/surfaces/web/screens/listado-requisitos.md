---
name: listado-requisitos
surface: web
route: /requirements
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.1"
date: 2026-09-01
---

# Pantalla: Listado de requisitos

## Identidad

- **Audiencia primaria:** equipo-interno. Requiere sesión — el guard está en `(loggedin)/layout.tsx:13-21` [fuente: código-existente].
- **JTBD / Propósito:** tabla paginada de requisitos, filtrable por texto, estado, proyecto y orden [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport. Sin tratamiento responsive: la tabla usa anchos de columna en porcentaje, sin media query.
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Ítem `"Requisitos"` de la navegación del shell · `Navbar.tsx:59` [fuente: código-existente]
- Link `"Volver"` del detalle de requisito · `RequirementHeader.tsx:207-209`
- Redirect tras crear un requisito · `CreateRequirementForm.tsx:345`

**Salidas user-driven:**
- `/requirements/new` · click en `boton-nuevo-requisito` · `requirements/page.tsx:35`
- `/requirements/{id}` · click en una fila de `tabla-requisitos` · `RequirementList.tsx:~147`
- La propia ruta con otros `searchParams`, en cada cambio de filtro o de página · `RequirementList.tsx:88`, `:98`, `:108`

**Salidas automáticas:**
- Ninguna.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | boton-nuevo-requisito | button | primary | input | desktop | todos los estados | Ir al alta de requisito |
| 2 | barra-filtros | section | — | layout | desktop | todos los estados | Contenedor de los cuatro filtros |
| 3 | buscador-requisito | search-bar | default | input | desktop | todos los estados | Filtro por texto |
| 4 | filtro-estado | dropdown | multi · closed / open | input | desktop | todos los estados | Filtro por uno o varios estados del requisito |
| 5 | filtro-proyecto | dropdown | closed / open | input | desktop | todos los estados | Filtro por proyecto |
| 6 | filtro-orden | dropdown | closed / open | input | desktop | todos los estados | Orden del listado |
| 7 | tarjeta-tabla | card | — | layout | desktop | hidden_in_states: loading | Contenedor de la tabla |
| 8 | tabla-requisitos | table | — | content | desktop | hidden_in_states: loading | Lista paginada de requisitos |
| 9 | pill-estado | badge | por `data-state` | content | desktop | hidden_in_states: loading, empty | Estado del requisito |
| 10 | pill-tipo | badge | por `data-type` | content | desktop | hidden_in_states: loading, empty | Tipo del requisito |
| 11 | pill-prioridad | badge | por `data-priority` | content | desktop | hidden_in_states: loading, empty | Prioridad del requisito |
| 12 | paginacion | pagination | ventana deslizante | navigation | desktop | hidden_in_states: loading | Navegación entre páginas del conjunto filtrado, con total real |
| 13 | selector-tamano-pagina | dropdown | closed | input | desktop | hidden_in_states: loading | Cantidad de filas por página |
| 14 | cargando-requisitos | loader | — | feedback | desktop | visible_only_in_states: loading | Fallback del `<Suspense>` |
| 15 | cargando-tabla | paragraph | body | feedback | desktop | visible_only_in_states: loading | Mensaje dentro del cuerpo de la tabla |
| 16 | vacio-requisitos | empty-state | — | feedback | desktop | visible_only_in_states: empty | Mensaje de tabla sin resultados |

**Origen:** `requirements/page.tsx:34-36`, `requirements/page.tsx:39`, `RequirementFilters.tsx:129`, `RequirementFilters.tsx:132-138`, `RequirementFilters.tsx:142-149`, `RequirementFilters.tsx:153-162`, `RequirementFilters.tsx:166-174`, `RequirementList.tsx:117`, `RequirementList.tsx:118`, `RequirementList.tsx:132-137`, `RequirementList.tsx:138-143`, `RequirementList.tsx:175-178`, `RequirementList.tsx:181-183`, `RequirementList.tsx:186-188`, `RequirementList.tsx:196-247`, `RequirementList.tsx:238-245`

`barra-filtros` se relevó como `section` pero **es un `<div>`, no un `<section>`**, a diferencia de `ClientListFilters` y `ProjectListFilters`. `boton-nuevo-requisito` va envuelto en un `<div>` con overrides `!important` para forzar su tamaño (`requirements.module.scss:1-5`): es el único caso del producto donde se pisa el estilo de `<Button>` desde afuera. El chrome es compartido y no se repite acá [fuente: código-existente].

## Layout por viewport

### desktop · 1440px

- boton-nuevo-requisito (en el encabezado de `PageLayout`, a la derecha del título)
- row `filtros` (`flex-wrap: nowrap`, `align-items: flex-end`)
  - col ~4.1/12: buscador-requisito (`flex: 2`)
  - col ~3.3/12: filtro-estado (`flex: 1.6`)
  - col ~2.5/12: filtro-proyecto (`flex: 1.2`)
  - col ~2.1/12: filtro-orden (`flex: 1`)
- tarjeta-tabla
  - tabla-requisitos (8 columnas con anchos en porcentaje; pill-estado, pill-tipo y pill-prioridad van en sus celdas)
  - row `pie`: paginacion · selector-tamano-pagina

**Origen de las fracciones de los filtros:** estilos inline en el JSX, no en el módulo — `style={{ flex: 2 }}` / `1.6` / `1.2` / `1` (`RequirementFilters.tsx:130`, `:140`, `:151`, `:164`). Pesos 2 + 1.6 + 1.2 + 1 = 5.8 → 4.1/12 + 3.3/12 + 2.5/12 + 2.1/12. Es el tercer mecanismo de reparto de la barra de filtros en el producto (`flex` en el módulo en actores, `width: calc()` en proyectos, `flex` inline acá) [fuente: código-existente].

**Origen de los anchos de la tabla:** `RequirementList.module.scss:36-52` — `4%` (ID), `11%` (Proyecto), `42%` (Título), `11%` (Responsable) y `8%` para las cuatro columnas compactas; `4 + 11 + 42 + 11 + 8×4 = 100%`. En doceavos: 0.5/12 + 1.3/12 + 5/12 + 1.3/12 + ~1/12 cada compacta [fuente: código-existente].

Con `overflow-x: hidden` en el `body` (`globals.scss:172`) y 8 columnas de ancho fijo en porcentaje, a anchos angostos las celdas se comprimen sin scroll horizontal; `td` global tiene `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` (`globals.scss:180-186`), así que el contenido se recorta con puntos suspensivos [fuente: código-existente].

## Contenido

### boton-nuevo-requisito
- Texto/label: `"Nuevo requisito"`
- Icono: nada
- Asset: nada
- Annotation: `requirements/page.tsx:35`

### barra-filtros
- Texto/label: sin texto propio — es el contenedor de los cuatro filtros
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.filterSection}>` (`RequirementFilters.tsx:129`)

### buscador-requisito
- Texto/label: `"Búsqueda"` · placeholder `"Buscar requisito"`
- Icono: nada
- Asset: nada
- Annotation: debounce antes de propagar el cambio (`:113`, `:117-119`). Es un `<input>` nativo con `<label className={styles.fLabel}>` **sin `htmlFor`** (`:131`, `:135`) [fuente: código-existente]

### filtro-estado
- Texto/label: `"Estado"` · placeholder con la selección vacía: `"Todos los estados"` · opciones `"Análisis"` (`analisis`) · `"Planificación"` (`planificacion`) · `"En cola"` (`en_cola`) · `"Desarrollo"` (`desarrollo`) · `"Revisión"` (`revision`) · `"Resuelto"` (`resuelto`) · `"Cancelado"` (`cancelado`)
- Icono: nada
- Asset: nada
- Annotation: **selección múltiple** — cada estado elegido se muestra como un chip removible dentro del control, y el orden de las siete opciones es el del enum `requirement_state`, no alfabético. **La opción `"Todos los estados"` de valor `''` desaparece de la lista:** deja de ser una opción y pasa a ser la ausencia de selección [REQ-009 RF-4, RF-6].
  - **Default al entrar sin `state` en la URL:** `"Planificación"`, `"En cola"`, `"Desarrollo"` y `"Revisión"` seleccionados. `"Análisis"`, `"Resuelto"` y `"Cancelado"` quedan fuera — el listado abre en el trabajo en curso, no en el histórico completo [REQ-009 RF-5, AC-1].
  - **Selección vacía = todos los estados.** Quitar el último chip no vacía la tabla ni devuelve el default: muestra los siete estados. Se persiste en la URL como `state=all`, y el sentinel **tiene que sobrevivir en la URL** — borrar el parámetro equivaldría a volver al default de cuatro [REQ-009 RF-6, AC-4, riesgo R1].
  - **La selección viaja en la URL como lista separada por comas** (`state=desarrollo,revision`), de modo que recargar o compartir el link reproduce el mismo filtro; al entrar por link el control deriva sus chips parseando ese CSV [REQ-009 RF-7, AC-5].
  - Mismo mecanismo que el filtro de estado de `listado-tareas` (`InputMultipleSelect`, CSV en la URL, sentinel `all`), que es el precedente que el requerimiento pide replicar [REQ-009].

### filtro-proyecto
- Texto/label: `"Proyecto"` · opciones `"Todos los proyectos"` (`''`) + los proyectos en estado `analisis` o `activo`
- Icono: nada
- Asset: nada
- Annotation: **la lista de proyectos excluye los inactivos, finalizados y cancelados** (`useProjects({ filters: { state: 'analisis,activo' } })`). Un requisito de un proyecto finalizado no se puede filtrar por su proyecto (`RequirementFilters.tsx:152`, `:122-127`, `:104`) [fuente: código-existente]

### filtro-orden
- Texto/label: `"Ordenar por"` · opciones `"Más recientes"` (`recent`, default) · `"Más antiguos"` (`oldest`) · `"Prioridad"` (`priority`)
- Icono: nada
- Asset: nada
- Annotation: `RequirementFilters.tsx:165`, `:32-34`

### tarjeta-tabla
- Texto/label: sin texto propio — es el contenedor de la tabla y su pie
- Icono: nada
- Asset: nada
- Annotation: `RequirementList.tsx:117`

### tabla-requisitos
- Texto/label: columnas `"ID"` · `"Proyecto"` · `"Título"` · `"Responsable"` · `"Estado"` · `"Tipo"` · `"Prioridad"` · `"Creación"`. Responsable vacío: `"Sin asignar"`. Proyecto vacío: `"—"` (guion largo)
- Icono: nada
- Asset: nada
- Annotation: formato de fecha `DD/MM/YYYY` vía `labelFromDate` (`:41`). **El responsable se resume:** con más de uno muestra el primero y un `+N`, con la lista completa en el atributo `title`, priorizando al líder (`:55-70`, `:163-172`). Columnas en `:121-128`, responsable vacío en `:56`, proyecto vacío en `:153` [fuente: código-existente]

### pill-estado
- Texto/label: `"Análisis"` · `"Planificación"` · `"En cola"` · `"Desarrollo"` · `"Revisión"` · `"Resuelto"` · `"Cancelado"`
- Icono: nada
- Asset: nada
- Annotation: `<span className={styles.sTag}>` con un `<span className={styles.dot}>` de color; el color se aplica por `data-state` (`RequirementList.tsx:175-178`, `:21-29`)

### pill-tipo
- Texto/label: dinámico desde el tipo del requisito
- Icono: nada
- Asset: nada
- Annotation: color por `data-type` (`RequirementList.tsx:181-183`)

### pill-prioridad
- Texto/label: `"Sin prioridad"` · `"Baja"` · `"Media"` · `"Alta"` · `"Urgente"`
- Icono: nada
- Asset: nada
- Annotation: color por `data-priority` (`RequirementList.tsx:186-188`, `:31-37`)

### paginacion
- Texto/label: flechas con `aria-label="Página anterior"` y `"Página siguiente"`, más los números de página
- Icono: flechas de anterior/siguiente
- Asset: nada
- Annotation: **deja de ser una reimplementación inline y pasa al paginador unificado** del producto (el mismo bloque que ya usan `listado-tareas`, la card de requisitos del detalle de proyecto y la tabla de tareas del requisito), en su modo URL. **Conoce el total del conjunto filtrado:** la cantidad de páginas se calcula sobre el total de requisitos que cumplen los estados seleccionados y los demás filtros, en vez de adivinar si hay una página siguiente porque la actual vino llena [REQ-009 RF-9, AC-6].
  - Con 32 requisitos en los cuatro estados por default y 15 por página, ofrece **3 páginas** — no 4 ni las que resultarían del total sin filtrar [REQ-009 AC-6].
  - Muestra como máximo 10 números en una ventana deslizante centrada en la página actual, como el resto de las tablas del producto.
  - **El total corresponde siempre al conjunto filtrado**, así que cambiar los estados cambia el total y la cantidad de páginas, y cualquier cambio de la selección devuelve a la página 1 [REQ-009 RF-8, RF-9].

### selector-tamano-pagina
- Texto/label: opciones `"15 por página"` · `"20 por página"` · `"25 por página"`
- Icono: nada
- Asset: nada
- Annotation: default 15 (`requirements/page.tsx:26`, `RequirementList.tsx:242-244`)

### cargando-requisitos
- Texto/label: `"Cargando..."`
- Icono: nada
- Asset: imagen del componente `<Loader>`
- Annotation: fallback del `<Suspense key={JSON.stringify(filters)}>` (`requirements/page.tsx:39`)

### cargando-tabla
- Texto/label: `"Cargando requisitos..."`
- Icono: nada
- Asset: nada
- Annotation: `<td colSpan={8}>` dentro del cuerpo de la tabla (`RequirementList.tsx:135`)

### vacio-requisitos
- Texto/label: `"No se encontraron requisitos"`
- Icono: nada
- Asset: nada
- Annotation: `<td colSpan={8}>`; los encabezados de la tabla quedan visibles (`RequirementList.tsx:141`)

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Disparado por la query resuelta con al menos un requisito (`RequirementList.tsx:145-193`) [fuente: código-existente]

### empty
- Aplica: Sí
- Mensaje: `"No se encontraron requisitos"`
- Cambios:
  - vacio-requisitos: solo visible en este estado (visible_only_in_states), como una fila con `colSpan={8}`
  - pill-estado, pill-tipo, pill-prioridad: ocultos en este estado (hidden_in_states)
  - Los encabezados de la tabla quedan visibles
- Disparado por `requirements.length === 0` (`RequirementList.tsx:138-143`). No diferencia el empty de primer uso del empty por filtros [fuente: código-existente]
- **Alcanzable por una combinación de estados sin resultados.** Con el default de cuatro estados, un listado que solo tenga requisitos en `analisis`, `resuelto` o `cancelado` abre vacío aunque existan requisitos — el empty no lo explica, porque el mensaje es el mismo para "no hay nada" y "no hay nada con estos filtros". En ese caso el total informado es 0 y el paginador no ofrece páginas navegables [REQ-009 AC-13]

### loading
- Aplica: Sí
- Mensajes: `"Cargando..."` en el primer render y `"Cargando requisitos..."` en los refetch
- Cambios:
  - cargando-requisitos: solo visible en este estado (visible_only_in_states); el `<Suspense>` reemplaza toda la tabla y los filtros
  - cargando-tabla: solo visible en este estado (visible_only_in_states); el `isLoading` reemplaza solo el cuerpo de la tabla
- **Esta pantalla sí usa `key` en el `<Suspense>`** (`requirements/page.tsx:39`), así que al cambiar un filtro el fallback vuelve a aparecer — a diferencia de `listado-proyectos` (`RequirementList.tsx:132-137`) [fuente: código-existente]

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). La pantalla no tiene formulario.

### error de sistema / sin conexión
- Aplica: No — no implementado (ver gaps-as-is.md). `useRequirements` se desestructura como `{ data: requirements = [], isLoading }`: `isError` se ignora y el default `[]` hace que un fallo se vea como `"No se encontraron requisitos"` (`RequirementList.tsx:74`, `:138-143`). Tampoco existe `app/(loggedin)/requirements/error.tsx`: una excepción en el render del Server Component cae en la pantalla de error por defecto de Next, sin sidebar. Es la única ruta de listado del producto sin `error.tsx` [fuente: código-existente].

### success
- Aplica: No — no implementado (ver gaps-as-is.md). El toast lo dispara `alta-requisito` antes de navegar (`CreateRequirementForm.tsx:344`).

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). Un requisito `resuelto` o `cancelado` se muestra igual que uno en curso, salvo el color del pill (`RequirementList.tsx:145-193`) [fuente: código-existente].

### última página conocida
- Aplica: Sí — **pasa a estar implementado** [REQ-009 RF-9, AC-6].
- Mensaje: —
- Cambios:
  - paginacion: la última página es la real del conjunto filtrado. La flecha "siguiente" queda deshabilitada en ella, y ya no se puede navegar a una página vacía cuando el total es múltiplo exacto del límite
  - El total del conjunto filtrado deja de ser desconocido para la pantalla, y por lo tanto la cantidad de páginas es exacta en vez de inferida
- Antes de este requerimiento la paginación adivinaba: habilitaba "siguiente" comparando `requirements.length >= limit` —"vino una página llena, asumo que hay más"— y no existía número total de páginas ni de resultados en ningún lado (`RequirementList.tsx:215-233`) [fuente: código-existente].

## Interacciones

**Eventos:**
- buscador-requisito · on change → debounce → `onChange('search', value)` → `router.push` · `RequirementFilters.tsx:113`, `:117-119`
- filtro-estado · on change → serializa la selección múltiple a lista separada por comas → `onChange('state', csv)` inmediato → `router.push`. **Con la selección vacía emite el sentinel `'all'`, que se escribe en la URL en vez de borrarse** [REQ-009 RF-6, RF-7, AC-4]
- filtro-proyecto / filtro-orden · on change → `onChange(campo, valor)` inmediato · `RequirementFilters.tsx:161`, `:173`
- `updateFilter` → borra `page` y hace `router.push` · `RequirementList.tsx:82-89`. **`state` es la excepción al borrado del sentinel:** los demás filtros siguen quitando el parámetro de la URL cuando el valor es vacío o `'all'`, pero `state=all` se conserva, porque una URL sin `state` significa el default de cuatro estados [REQ-009 RF-6, riesgo R1]
- fila de tabla-requisitos · on click → navega a `/requirements/{id}` · `RequirementList.tsx:~147`
- flecha de paginacion · on click → `params.set('page', ...)` + `router.push` · `RequirementList.tsx:93-99`
- selector-tamano-pagina · on change → setea `limit` y **resetea `page` a 1** · `RequirementList.tsx:102-109`

[fuente: código-existente]

**Validaciones:**
- Ninguna: no hay inputs validados.

**Feedback:**
- Cambio de filtro: el `<Suspense key>` remonta y muestra el fallback
- Cambio de la selección de estados: la paginación vuelve a la página 1 y el total se recalcula sobre el conjunto filtrado [REQ-009 RF-8, RF-9]
- Página activa: `data-active="true"` + `aria-current="page"` (`RequirementList.tsx:215`)
- Responsables múltiples: `title` con la lista completa
- `updateFilter` borra la página al filtrar (`RequirementList.tsx:87`), a diferencia de `ClientListFilters` y `ProjectListFilters`

## Accesibilidad

- **Orden de foco:** boton-nuevo-requisito (en el encabezado del shell) → buscador-requisito → filtro-estado → filtro-proyecto → filtro-orden → paginacion → selector-tamano-pagina. **Las filas de la tabla quedan fuera del orden de foco:** son `<tr onClick>` sin `role`, sin `tabIndex` y sin handler de teclado, así que **la tabla no es navegable por teclado** pese a ser la única vía al detalle de un requisito (`RequirementList.tsx:~147`) [fuente: código-existente].
- **Landmarks y jerarquía:** el `<h1>` de la pantalla lo aporta el `titulo-pagina` de `PageLayout`, chrome compartido. La tabla tiene `<thead>` con `<th>` correctos (`RequirementList.tsx:119-129`). **La paginación es un `<div>`, no un `<nav>`, y sin `aria-label`**, aunque las flechas sí tienen `aria-label` y la página activa `aria-current="page"` (`RequirementList.tsx:196`, `:202`, `:215`, `:232`) [fuente: código-existente].
- **Foco y teclado:** los tres filtros de tipo dropdown son `react-select`, que aporta su propio comportamiento de teclado; la pantalla no monta overlays propios con focus trap [fuente: código-existente].
- **Propio de esta composición:**
  - **Los labels de los cuatro filtros no están asociados a sus controles:** son `<label className={styles.fLabel}>` sin `htmlFor` y sin envolver el input, y ninguno de los cuatro controles tiene `aria-label` de respaldo. Un lector de pantalla lee los inputs sin nombre. Los `react-select` sí tienen `inputId` (`filter-state`, `filter-project`, `filter-sort`) pero **ningún `<label>` los referencia** (`RequirementFilters.tsx:131`, `:141`, `:152`, `:165`, `:143`, `:154`, `:167`).
  - **El resultado del filtrado no se anuncia:** sin `aria-live` (`RequirementList.tsx:114`). Con el total del conjunto filtrado ya disponible en la pantalla [REQ-009 RF-9], **ahora sí existe algo que anunciar** y la ausencia de región live pasa de ser una consecuencia a ser una carencia propia: quien filtra con lector de pantalla no percibe que el conjunto cambió. Queda registrado como gap; este requerimiento no lo cierra.
  - **El filtro de estado pasa a ser múltiple**, así que el control deja de anunciar un valor y anuncia una lista. Los chips de estados elegidos tienen que ser removibles por teclado, y el label sigue sin `htmlFor` que lo asocie al control — el gap de nombre accesible del filtro **no se cierra acá y se agrava**, porque ahora el control tiene más estado que comunicar [REQ-009 RF-4].
  - El punto de color del estado es un `<span className={styles.dot}>` vacío **sin `aria-hidden`** (`RequirementList.tsx:176`).
  - La lista completa de responsables va en `title`, un fallback débil que no aparece con el foco por teclado ni lo anuncian todos los lectores (`RequirementList.tsx:166`).
  - `selector-tamano-pagina` sí tiene `aria-label="Elementos por página"` (`RequirementList.tsx:240`).
  [fuente: código-existente]

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-009 — Filtro multi-estado en el listado de requisitos

- **El filtro de estado pasa a selección múltiple, replicando el de `listado-tareas` en vez de inventar un mecanismo.** El requerimiento lo pide textualmente ("como en el listado de tareas") y la superficie ya tiene ese patrón resuelto: multi-select, CSV en la URL y sentinel `all`. Copiarlo cierra una inconsistencia entre dos pantallas hermanas en lugar de sumar una tercera forma de filtrar [REQ-009 RF-4].
- **El default es de cuatro estados y no "todos".** `planificacion`, `en_cola`, `desarrollo` y `revision` son el trabajo en curso; `analisis`, `resuelto` y `cancelado` quedan fuera. El listado abre en lo que se está haciendo, que es lo que se consulta a diario, y el histórico se pide explícitamente [REQ-009 RF-5].
- **El default vive en el servidor de la página, no en el componente de filtros.** Así el primer render ya trae el recorte correcto y no hay parpadeo de "todos y después cuatro" — mismo lugar donde lo resuelve el listado de tareas [REQ-009, Escenario A].
- **Deseleccionar todo muestra todo, y no vacía la tabla ni vuelve al default.** Es la decisión menos obvia de las tres posibles, y es la que pide el requerimiento: quitar los filtros tiene que significar "sin filtrar". **Descartado** vaciar la tabla (leería como "no hay requisitos", que es falso) y **descartado** devolver al default de cuatro (haría imposible ver los siete estados juntos) [REQ-009 RF-6, AC-4].
- **El sentinel `all` se conserva en la URL en vez de borrarse.** Es la consecuencia directa de la decisión anterior: con un default de cuatro estados, una URL sin `state` ya no significa "sin filtro" sino "el default", así que "sin filtro" necesita su propia representación explícita. Es la excepción de `state` frente a los demás filtros del listado, que sí borran el parámetro [REQ-009 RF-6, riesgo R1].
- **La opción `"Todos los estados"` de valor `''` se elimina de la lista.** Con selección múltiple, "todos" deja de ser una opción entre siete y pasa a ser la ausencia de selección; mantenerla habilitaría el estado contradictorio de tener "todos" elegido junto a dos estados concretos [REQ-009 RF-6].
- **El paginador se migra al componente unificado y se alimenta con el total real.** No estaba en el pedido: es un hallazgo del diseño. El paginador inline adivinaba las páginas comparando si la página vino llena, y con un filtro que recorta el conjunto eso pasa de ser impreciso a ser visiblemente incorrecto — el requerimiento exige que el total y las páginas correspondan a los estados seleccionados. **Descartado** dejarlo como estaba: el filtro nuevo habría quedado sin una lectura fiable de cuánto trae [REQ-009 RF-9, AC-6, riesgo R2].
- **No se agrega desglose por estado en el listado global.** Con multi-estado sería tentador mostrar cuántos requisitos hay de cada estado, pero ese desglose ya existe donde tiene sentido —los tabs de la card del detalle de proyecto— y acá el paginador informa el total de la selección, que es lo que se necesita para navegar [REQ-009, clarificación de negocio].
- **La card de requisitos del detalle de proyecto no se toca.** Sigue con sus siete tabs de un estado cada uno. El cambio es compatible hacia atrás y esa card resuelve otro trabajo: comparar estados de a uno dentro de un proyecto, no filtrar el listado global [REQ-009, clarificación de alcance; AC-8].
- **`opus-web` no se modifica.** El portal externo consume el mismo endpoint y su comportamiento no cambia; el multi-select es de la superficie interna [REQ-009 RF-11, AC-15].
- **[Auto] Design System — sin componentes nuevos.** El multi-select se expresa con el tipo de bloque `dropdown` en variante múltiple, que ya está en uso en `listado-tareas` (`InputMultipleSelect`), y el paginador con el tipo `pagination` del paginador unificado. Ningún tipo de bloque nuevo entra en la pantalla, así que no se crea ningún componente de DS. La deuda conocida de la superficie —tres formas distintas de hacer un select— **no se resuelve acá**: se reutiliza la que ya usa la pantalla hermana, que es la que este requerimiento pide replicar.
