---
name: tablero-requisitos
surface: opus-web
route: /projects/[projectId]/requirements
viewports:
  - mobile
  - desktop
audiences:
  - cliente
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Tablero de requisitos

> Es la pantalla principal del portal: donde el usuario pasa el tiempo. **Tiene tres representaciones distintas del mismo contenido**, elegidas por viewport y por query param [fuente: código-existente].

## Identidad

- **Audiencia primaria:**
  - [cliente](../../../audiences/cliente/research-context.md) — la audiencia no es determinable desde el código; se transcribe la declarada para la superficie [fuente: código-existente].
- **JTBD / Propósito:** Mostrar todos los requisitos de un proyecto agrupados por estado, con paginación por grupo, y permitir abrir el detalle de cada uno.
- **Viewports:**
  - **mobile** — bajo 768px monta `MobileRequirementsBoard`: acordeones por estado, apilados, todos colapsados al abrir. **No es un reflow de CSS: es otro árbol de componentes**, decidido en JS por `useIsMobile()` (768px exactos). Sin chrome: el sidebar no se renderiza.
  - **desktop** — a partir de 768px monta `ListView` (default, `?view=list`) o `KanbanBoard` (`?view=kanban`), con el sidebar del shell a la izquierda.
  - **En mobile el `?view=` se ignora por completo.** El toggle de vista existe en el `BoardHeader`, que sí se renderiza en mobile, pero cambiarlo no tiene efecto visible: `BoardHeader` no sabe del viewport; la rama de `useIsMobile` está en la pantalla, por encima.
  - Tablet: se comporta como desktop (el corte real de la superficie es 768px; los mixins `tablet` y `desktop` solo se usan en código muerto).

Envuelta por el chrome de `(dashboard)`.

**Las tres vistas** (`requirements/page.tsx:171-185`):

| Vista | Cuándo | Componente |
|---|---|---|
| Acordeones | `useIsMobile()` → ancho < 768px | `MobileRequirementsBoard` |
| Lista agrupada | desktop, `?view=list` (default) | `ListView` |
| Kanban | desktop, `?view=kanban` | `KanbanBoard` |

## Entrada y salida

**Entradas:**
- Desde `/projects` por redirección automática · `projects/page.tsx:23` [fuente: código-existente]
- Desde el sidebar, click en un proyecto · `Sidebar.tsx:40`
- Desde detalle-requisito, botón "Volver" o el breadcrumb · `BoardHeader.tsx:81`, `:138`
- Por URL directa

**Salidas user-driven:**
- Abre el overlay de detalle de requisito · click en fila o card (desktop) · `requirements/page.tsx:137-139` — ver overlays de la superficie
- A `/projects/{id}/requirements/{reqId}` · click en una card (mobile) · `MobileRequirementsBoard.tsx:71-75` (`<Link>`)
- A `?view=list` / `?view=kanban` · toggle del header · `BoardHeader.tsx:68-70` (`router.replace`)
- Abre el overlay de alta de requisito · click en "Nuevo requisito" del sidebar · `Sidebar.tsx:95-98`, montado por `(dashboard)/layout.tsx:13` — ver overlays de la superficie

**Salidas automáticas:**
- Ninguna.

**Efecto lateral:** sincroniza el proyecto activo del contexto con el `projectId` de la URL (`requirements/page.tsx:65-72`).

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | encabezado-tablero | header | — | layout | ambos | hidden_in_states: loading | Contenedor del breadcrumb y el toggle |
| 2 | breadcrumb | breadcrumbs | — | navigation | ambos | hidden_in_states: loading | Ubicación y vuelta al proyecto |
| 3 | toggle-vista | tabs | list / kanban | navigation | ambos *(sin efecto en mobile)* | hidden_in_states: loading | Cambiar entre lista y kanban |
| 4 | cabecera-columnas | table | sticky | content | solo desktop | hidden_in_states: loading | Encabezados de las 7 columnas |
| 5 | fila-grupo | list | colapsable | content | solo desktop | hidden_in_states: loading | Cabecera de grupo por estado, con conteo |
| 6 | fila-requisito | table | — | content | solo desktop | hidden_in_states: loading | Un requisito en la lista |
| 7 | pill-estado | badge | 7 estados · editable/readonly | input | solo desktop | state_overrides: readonly para `external-user` | Ver y cambiar el estado |
| 8 | pill-prioridad | badge | 5 prioridades · editable/readonly | input | solo desktop | state_overrides: readonly para `external-user` | Ver y cambiar la prioridad |
| 9 | columna-kanban | section | colapsada/expandida | content | solo desktop (`?view=kanban`) | hidden_in_states: loading | Columna por estado |
| 10 | card-kanban | card | — | content | solo desktop (`?view=kanban`) | hidden_in_states: loading | Un requisito en el kanban |
| 11 | boton-ver-mas | button | secondary · loading | input | ambos | visible_only_in_states: default (cuando `hasMore`) | Traer 20 requisitos más de ese estado |
| 12 | acordeon-estado | section | expandido/colapsado | content | solo mobile | hidden_in_states: loading | Grupo colapsable por estado |
| 13 | card-requisito-mobile | card | — | content | solo mobile | hidden_in_states: loading | Un requisito en mobile |
| 14 | indicador-carga | loader | lg | feedback | ambos | visible_only_in_states: loading | Señal de carga de la pantalla entera |
| 15 | boton-nuevo-requisito | button | primary | input | solo desktop | hidden_in_states: loading | Abrir el alta de requisito. Vive en el sidebar del shell |
| 16 | sidebar-navegacion | sidebar | — | layout | solo desktop | — | Chrome de `(dashboard)`: proyectos, alta y cerrar sesión. Bajo 768px no se renderiza |

**Origen:** `src/app/(dashboard)/projects/[projectId]/requirements/page.tsx`, `.../page.module.scss`, `BoardHeader/BoardHeader.tsx`, `ListView/ListView.tsx`, `ListView/components/RequirementGroupRow/RequirementGroupRow.tsx`, `ListRequirementRow/ListRequirementRow.tsx`, `KanbanBoard/KanbanBoard.tsx`, `KanbanColumn/KanbanColumn.tsx`, `KanbanBoard/components/KanbanCard/KanbanCard.tsx`, `MobileRequirementsBoard/MobileRequirementsBoard.tsx`, `StateAccordion/StateAccordion.tsx`, `RequirementCard/RequirementCard.tsx` [fuente: código-existente].

Notas de tipificación del relevamiento: `columna-kanban` y `acordeon-estado` se relevaron como `section` — son contenedores colapsables sin tipo propio en el diccionario (no son `card` ni `list`). `cabecera-columnas` y `fila-requisito` se relevaron como `table` aunque el DOM son `<div>` con `display: grid` — semánticamente son una tabla. Ver Accesibilidad.

## Layout por viewport

### mobile · 390px

Árbol de componentes propio (`MobileRequirementsBoard`), no un reflow del de desktop.

- *(sin chrome — el sidebar está oculto)*
- encabezado-tablero
  - breadcrumb
  - toggle-vista *(visible pero sin efecto)*
- acordeon-estado × 7 *(ancho completo, apilados, `gap: var(--spacing-sm)`)*
  - al expandir: card-requisito-mobile × N + boton-ver-mas

**Origen:** `MobileRequirementsBoard.module.scss:5-9` — `display:flex; flex-direction:column; gap: var(--spacing-sm)` [fuente: código-existente].

Stack vertical simple. **Todos los acordeones arrancan colapsados** (`MobileRequirementsBoard.tsx:36` — `useState(new Set())`), a diferencia de desktop donde solo `resuelto` y `cancelado` lo hacen.

**Las fracciones de columna no son derivables del código:** es un stack de ancho completo, sin grilla.

### desktop · 1440px — vista lista (default)

- *(chrome: sidebar-navegacion 263px a la izquierda, con boton-nuevo-requisito dentro)*
- encabezado-tablero *(61px de alto, fijo)*
  - row `header`
    - col 6/12: breadcrumb
    - col 6/12: toggle-vista *(alineado a la derecha)*
- cabecera-columnas *(sticky al tope del scroll)*
  - row `grid-7` — 7 columnas de ancho fijo: `64px 1fr 140px 140px 160px 120px 150px`
- por cada uno de los 7 estados:
  - fila-grupo *(ancho completo, clickeable)*
  - fila-requisito × N *(mismo grid de 7 columnas)*

**Origen:** `BoardHeader.module.scss:3-13` (`display:flex; justify-content:space-between; height:61px`), `ListView.module.scss:10-14` y `ListRequirementRow.module.scss:3-15` — las dos declaran `grid-template-columns: 64px 1fr 140px 140px 160px 120px 150px` [fuente: código-existente].

**Las fracciones 6/12 del header son aproximadas:** es un `space-between` entre dos grupos de ancho natural, no una grilla. **Las 7 columnas de la tabla no son fracciones de 12 y no son derivables del código como tales:** son anchos fijos en px con una sola columna flexible (el título, `1fr`).

### desktop · 1440px — vista kanban (`?view=kanban`)

- *(chrome: sidebar, con boton-nuevo-requisito dentro)*
- encabezado-tablero
- row `tablero` *(scroll horizontal)*
  - columna-kanban × 7, cada una de **500px fijos**, con `gap: 20px`
    - card-kanban × N
    - boton-ver-mas

**Origen:** `KanbanBoard.module.scss:1-11` — `display:flex; gap:20px; overflow-x:auto` y `KanbanColumn.module.scss:3-6` — `flex: 0 0 500px` [fuente: código-existente].

**No es una grilla de 12 columnas y las fracciones no son derivables del código:** son 7 columnas de ancho fijo que suman 3620px, siempre con scroll horizontal. A 1200px de viewport (menos el sidebar) entran poco más de dos columnas completas. Una columna colapsada se reduce (`.columnCollapsed`), lo que permite ver más.

**Cómo se representa en el wireframe:** el book renderiza un solo layout por viewport, así que la vista kanban se dibuja **debajo** de la vista lista en el mismo frame de desktop, con **3 de las 7 columnas** (`fixed_cols: 500px 500px 500px`) — suficiente para leer la forma y el scroll horizontal sin repetir siete veces la misma columna. No es que convivan en pantalla: son excluyentes según `?view=`.

## Contenido

### encabezado-tablero
- Texto/label: sin texto propio — contiene breadcrumb y toggle-vista
- Icono: nada
- Asset: nada
- Annotation: 61px de alto fijo, `space-between`. Recibe un `onNewRequirement` de la pantalla y **lo ignora** (`BoardHeader.tsx:24`, renombrado `_onNewRequirement`): no hay botón de nuevo requisito en esta pantalla

### breadcrumb
- Texto/label: `{nombre del proyecto}` › "Requisitos"
- Icono: nada — el separador `›` es un carácter literal (`BoardHeader.tsx:76`)
- Asset: nada
- Annotation: el nombre es dinámico desde `useProjects`; **si la query falla cae al literal "Proyecto"** (`requirements/page.tsx:133`)

### toggle-vista
- Texto/label: "Lista" y "Columnas"
- Icono: SVG inline de líneas (lista) y de cuadrantes (columnas) · `BoardHeader.tsx:153-167`, `:174-186`
- Asset: nada
- Annotation: el activo se marca con `styles.active` según `searchParams.get('view')`. Usa `router.replace`, no `push` — no ensucia el historial. **En mobile se muestra y no hace nada**

### cabecera-columnas
- Texto/label, en orden: "ID", "TÍTULO", "ESTADO", "CREACIÓN", "AUTOR", "TIPO", "PRIORIDAD"
- Icono: nada
- Asset: nada
- Annotation: en mayúsculas en el código, no por CSS (`ListView.tsx:77-83`). Sticky con sombra al scrollear (`ListView.tsx:75`, estado `isScrolled` en `:47`)

### fila-grupo
- Texto/label: la etiqueta del estado + el conteo. Etiquetas: "Análisis", "Planificación", "En cola", "Desarrollo", "Revisión", "Resuelto", "Cancelado"
- Icono: `ChevronDown` de lucide-react, 14px, rotado al colapsar · `RequirementGroupRow.tsx:34`
- Asset: nada
- Annotation: mapa `STATE_LABELS` en `RequirementGroupRow.tsx:14-22`, conteo en `:38`. En desktop arrancan colapsados solo `resuelto` y `cancelado`

### fila-requisito
- Texto/label: dinámico — `#{id}`, `title`, etiqueta de estado, fecha, `creator.name`, tipo, prioridad
- Icono: `Calendar` de lucide-react, 12px · `ListRequirementRow.tsx:204`
- Asset: nada
- Annotation: valores por defecto — autor sin nombre → `"—"` (`:209`); fecha nula → `"—"` (`:73`); tipo nulo o `sin_tipo` → `"Sin tipo"` (`:60`). Fecha con `toLocaleDateString('es-ES', {day:'2-digit', month:'short', year:'numeric'})` (`:75-79`)

### pill-estado
- Texto/label: la etiqueta del valor actual ("Análisis", "Planificación", "En cola", "Desarrollo", "Revisión", "Resuelto", "Cancelado")
- Icono: chevron SVG inline cuando es editable
- Asset: nada
- Annotation: **es dropdown solo para roles internos** — `isInternal = roles incluye 'user' o 'admin'` (`ListRequirementRow.tsx:119-120`). Para `external-user` es un `<span>` estático, sin chevron y sin nada que indique que es de solo lectura. El click hace `stopPropagation` para no abrir el detalle (`:151`)

### pill-prioridad
- Texto/label: la etiqueta del valor actual ("Sin prioridad", "Baja", "Media", "Alta", "Urgente")
- Icono: bandera de color + chevron cuando es editable
- Asset: nada
- Annotation: mapa `PRIORITY_LABEL` (`ListRequirementRow.tsx:44-50`). Mismo tratamiento por rol que pill-estado; `stopPropagation` en `:217`

### columna-kanban
- Texto/label: la etiqueta del estado en la cabecera de la columna
- Icono: nada
- Asset: nada
- Annotation: 500px fijos, colapsable por click en la cabecera (`KanbanColumn.tsx:70`)

### card-kanban
- Texto/label: dinámico — `#{id}`, título, fecha, autor, y los dos pills
- Icono: nada
- Asset: nada
- Annotation: **los pills solo se muestran si el requisito tiene descripción** (`KanbanCard.tsx:140`) — condición que no está explicada en el código. Fecha con formato propio en UTC, distinto del de la lista: `{día} {mes abreviado} {año}` (`:60-66`)

### boton-ver-mas
- Texto/label: "Ver más" · en carga: "Cargando..." con spinner
- Icono: spinner en carga
- Asset: nada
- Annotation: implementaciones idénticas en `KanbanColumn.tsx:87-94` y `StateAccordion.tsx:91-98`. Aparece solo si `hasMore`; trae 20 más de ese estado (`useRequirementsByStatus.ts:11`)

### acordeon-estado
- Texto/label: la etiqueta del estado + el conteo
- Icono: chevron
- Asset: nada
- Annotation: orden en `MobileRequirementsBoard.tsx:25-33` (`MOBILE_STATES_ORDER`), etiqueta y conteo en `StateAccordion.tsx:60-62`. Su `aria-label` dice `${state}, ${count} objetivos` (`StateAccordion.tsx:58`) — **dice "objetivos", no "requisitos"**. Su `getStateDataAttribute` (`:15-23`) mapea etiquetas de un enum anterior que ya no existe, así que siempre devuelve `'backlog'`: los siete acordeones se pintan del mismo color

### card-requisito-mobile
- Texto/label: dinámico — título, `#{id}`, fecha
- Icono: SVG de calendario inline, 14px · `RequirementCard.tsx:59-75`
- Asset: nada
- Annotation: **no muestra estado, tipo, autor ni prioridad.** Es la representación más reducida de las tres

### indicador-carga
- Texto/label: texto visualmente oculto "Cargando..." dentro del spinner
- Icono: spinner, `size="lg"`
- Asset: nada
- Annotation: `role="status"` (`Spinner.tsx:9`). Acompañado del texto "Cargando requisitos..."

### boton-nuevo-requisito
- Texto/label: "Nuevo requisito"
- Icono: plus
- Asset: nada
- Annotation: vive en el sidebar del shell (`Sidebar.tsx:95-98`), no en el cuerpo de la pantalla. Abre `CreateRequirementModal`, montado por `(dashboard)/layout.tsx:13` — por eso el alta está disponible en todas las pantallas del grupo, y por eso **bajo 768px desaparece con el sidebar**

### Mensajes de sección vacía
- Texto/label: "Sin elementos" (lista, `ListView.tsx:112`) · "Sin requisitos en este estado" (mobile, `MobileRequirementsBoard.tsx:86`) · **ninguno en kanban** — la columna queda vacía
- Icono: nada
- Asset: nada
- Annotation: en la lista solo se ve si el grupo está expandido, y los grupos vacíos arrancan colapsados (`ListView.tsx:35-44`)

### sidebar-navegacion
- Texto/label: "Opus" + la lista de proyectos + "Nuevo requisito" + "Cerrar sesión"
- Icono: folder por proyecto · plus en el alta · lock en cerrar sesión
- Asset: nada
- Annotation: chrome del grupo `(dashboard)`, no de esta pantalla. `display:none` bajo 768px (`Sidebar.module.scss:13`) **sin reemplazo**: en mobile no hay ninguna navegación

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Las tres vistas según viewport y `?view=` · `requirements/page.tsx:164-196` [fuente: código-existente]

### empty
- Aplica: No — no implementado (ver gaps-as-is.md) a nivel pantalla. Un proyecto sin ningún requisito muestra las 7 secciones en cero, sin mensaje ni acción; en desktop además todas colapsadas, así que la pantalla queda casi en blanco (`requirements/page.tsx:164-196`).
- Sí existe un **empty por sección**, que no es el estado de pantalla:
  - Mensaje: "Sin elementos" (lista) / "Sin requisitos en este estado" (mobile) / ninguno (kanban)
  - Cambios: fila-requisito / card-requisito-mobile reemplazados por el texto de sección vacía · `ListView.tsx:111-113`, `MobileRequirementsBoard.tsx:85-87`
  - En la lista solo se ve si el grupo está expandido, y los grupos vacíos arrancan colapsados

### loading
- Aplica: Sí
- Mensaje: "Cargando requisitos..."
- Cambios:
  - indicador-carga: solo visible en este estado (visible_only_in_states)
  - encabezado-tablero, breadcrumb, toggle-vista y las tres vistas: ocultos en este estado (hidden_in_states) — **reemplaza la pantalla entera, incluido el `BoardHeader`**, por spinner + texto centrados · `requirements/page.tsx:153-162`
- Annotation: disparado por `queries.some((q) => q.isLoading)` — **las siete queries a la vez** (`requirements/page.tsx:63`). Es un `some`, así que la pantalla espera a la query más lenta: no hay carga progresiva por columna
- Sub-estado **loading parcial (paginación)**, `parent_state: default`:
  - Mensaje: "Cargando..." dentro del botón "Ver más"
  - Cambios: boton-ver-mas: variant=disabled + spinner + texto (state_override) · `KanbanColumn.tsx:87-93`, `StateAccordion.tsx:91-97`
  - Disparado por `isFetchingNextPage` de la query de ese estado

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). La pantalla no tiene formulario propio. Los cambios de estado y prioridad **no validan transiciones**: el dropdown ofrece los siete estados siempre, en cualquier orden

### error de sistema / sin conexión
- Aplica: No — no implementado (ver gaps-as-is.md). Las siete queries pueden fallar y la pantalla renderiza el tablero con las siete secciones en cero, indistinguible de un proyecto sin requisitos: `requirements/page.tsx:153-196` solo evalúa `isLoading`, nunca `isError`. Si además falla `useProjects`, el breadcrumb muestra el literal "Proyecto" y nada avisa (`requirements/page.tsx:132-135`)
- **REQ-004: ahora hay dos fallas distinguibles y la pantalla no muestra ninguna.** La api separa `503 service_unavailable` (`"El servicio no está disponible en este momento"`, la operación **no** ocurrió) de `504 gateway_timeout` (`"La operación tardó demasiado"`, **pudo** haber ocurrido) — RF-16, CA-8, CA-9. Alcanza a las dos escrituras que salen de acá: el alta de requisito que abre `boton-nuevo-requisito` (overlay O-02) y el cambio inline de estado y prioridad de los pills. El cambio inline es idempotente y no cambia nada; **el alta no**, y es donde el gap se vuelve caro: el modal no muestra error alguno, así que ante un 504 el cliente no sabe que su pedido pudo haberse creado y el reintento probable lo duplica —y el duplicado aparece en `web` para el equipo. El desdoblamiento **mejora el diagnóstico del servidor y no cambia nada de lo que el cliente ve**: la información existe y la superficie la descarta [REQ-004]

### success
- Aplica: No — no implementado (ver gaps-as-is.md) a nivel pantalla. El éxito de un cambio de estado o prioridad se manifiesta como un toast global: "Requisito actualizado correctamente" (`useUpdateRequirement.ts:19`) — ver overlays de la superficie

### not found
- Aplica: No — no implementado (ver gaps-as-is.md). Un `projectId` inexistente o sin permiso deja la pantalla en el tablero vacío, sin 404: `requirements/page.tsx:35` hace `Number(params.projectId)` sin validar, y no hay `not-found.tsx` en ninguna ruta

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). Está presente de hecho y sin marcarse: para `external-user` los pills no son editables, pero nada indica que sean de solo lectura — se ven igual, sin el chevron (`ListRequirementRow.tsx:193-198`)

## Interacciones

**Eventos:**
- fila-requisito · on click → abre el overlay de detalle · `ListView.tsx:108` → `requirements/page.tsx:137-139` [fuente: código-existente]
- card-kanban · on click → abre el overlay de detalle · `KanbanBoard.tsx:64`
- card-requisito-mobile · on click → **navega** a `/projects/{id}/requirements/{reqId}` · `MobileRequirementsBoard.tsx:71-75`
- fila-grupo · on click → colapsa/expande el grupo · `ListView.tsx:99`
- columna-kanban (cabecera) · on click → colapsa la columna · `KanbanColumn.tsx:70`
- acordeon-estado · on click o Enter/Space → expande/colapsa · `StateAccordion.tsx:35-40`, `:53-54`
- pill-estado · on click *(solo rol interno)* → abre dropdown; al elegir, `PATCH` del estado · `ListRequirementRow.tsx:129-132`
- pill-prioridad · on click *(solo rol interno)* → ídem con la prioridad · `:134-140`
- boton-ver-mas · on click → `fetchNextPage()` de ese estado · `requirements/page.tsx:80`
- toggle-vista · on click → `router.replace` con el nuevo `?view=` · `BoardHeader.tsx:68-70`
- boton-nuevo-requisito · on click → abre el overlay de alta de requisito · `Sidebar.tsx:95-98` → `(dashboard)/layout.tsx:13`

**Diferencia de comportamiento por viewport:** en desktop el requisito abre en **overlay**; en mobile **navega** a otra ruta. No es solo layout: es un modelo de navegación distinto.

**Validaciones:**
- Ninguna en esta pantalla.
- Los cambios de estado y prioridad no validan transiciones: un requisito puede pasar de `analisis` a `resuelto` directamente. Solo se descarta re-seleccionar el valor actual (`ListRequirementRow.tsx:130`).

**Feedback:**
- Cambio de estado/prioridad exitoso → toast "Requisito actualizado correctamente" · `useUpdateRequirement.ts:19`
- Fallido → toast "Error al actualizar el estado" o "Error al actualizar la prioridad" · `:26-32`
- **Sin update optimista:** el pill no cambia hasta que vuelve el refetch de las siete queries.

## Accesibilidad

- **Orden de foco:** el orden lógico sería breadcrumb → toggle-vista → contenido de la vista activa. **En desktop el contenido no participa del orden de foco:** ni las filas de la lista ni las cards de kanban ni las cabeceras de columna son alcanzables por teclado. En mobile los acordeones y las cards sí lo son [fuente: código-existente].
- **Landmarks y jerarquía:** el landmark `<main>` lo hereda del shell. **La pantalla no tiene `<h1>`**: el nombre del proyecto es un `<span>` dentro del breadcrumb (`BoardHeader.tsx:75`). El breadcrumb **no es semántico**: `<div>` sin `<nav aria-label>` ni lista (`BoardHeader.tsx:74`).
- **Foco y teclado:** los dropdowns de estado y prioridad se montan en portal; **ningún overlay de esta superficie atrapa el foco ni lo devuelve al cerrar**. El overlay de detalle que esta pantalla abre en desktop tampoco.
- **Propio de esta composición:**
  - **`ListView` es una tabla hecha con `<div>` + `display: grid`, sin roles ARIA de tabla** (`role="table"`/`"row"`/`"cell"`): `ListView.tsx:76`, `ListRequirementRow.tsx:143`.
  - **Las filas de `ListRequirementRow` son clickeables sin `role`, `tabIndex` ni `onKeyDown`** (`ListRequirementRow.tsx:143`).
  - Las cards de kanban son `<article onClick>` sin `role="button"` ni `tabIndex` (`KanbanCard.tsx:124`).
  - La cabecera de columna de kanban es `<header onClick>` con `cursor:pointer` inline, sin rol ni teclado (`KanbanColumn.tsx:68-72`).
  - El toggle de vista son dos `<button>` sin `role="tab"` ni `aria-pressed`; el activo se marca solo por clase (`BoardHeader.tsx:149-188`).
  - En mobile sí está resuelto: las cards son `<Link>` y los acordeones tienen `role="button"`, `tabIndex={0}`, `onKeyDown` con Enter y Space y `aria-expanded` (`MobileRequirementsBoard.tsx:71`, `StateAccordion.tsx:51-58`). El `aria-label` del acordeón, en cambio, **anuncia "objetivos"** en una UI que dice "requisitos" (`StateAccordion.tsx:58`).
  - Los dropdowns son parciales: `aria-expanded` y `aria-haspopup="listbox"` en el trigger, `role="listbox"`/`option` en el menú, pero `aria-selected="false"` **fijo en todas las opciones**, incluida la actual (`Dropdown.tsx:100`, `:118-119`).
  - Iconos decorativos con `aria-hidden="true"`, spinner con `role="status"` y toasts con `role="alert"`: presentes.

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-004 — El bus en dos servicios micro (2026-08-23)

- **Se anota en un estado marcado "no implementado", y es deliberado.** La tentación era diseñar acá el estado de error que falta. No se hace: el REQ deja `opus-web` sin cambios (RF-16) y crear un estado nuevo sería inventar alcance. Lo que sí se registra es que el gap **empeoró**: antes faltaba mostrar "algo falló", ahora faltan **dos mensajes con recuperación opuesta**, y uno de ellos ("pudo haber ocurrido") es el que evita un duplicado.
- **El alta se documenta desde esta pantalla porque el overlay no tiene documento propio.** O-02 vive en el inventario de overlays del product-map, no en un `.md` de pantalla; `boton-nuevo-requisito` está declarado acá, así que acá va la consecuencia. El inventario de overlays también la registra en su fila.
