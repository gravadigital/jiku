---
name: listado-actores
surface: web
route: /clients
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Listado de actores

## Identidad

- **Audiencia primaria:** equipo-interno. Requiere sesión — el guard está en `(loggedin)/layout.tsx:13-21` [fuente: código-existente].
- **JTBD / Propósito:** lista los actores filtrables por texto y estado, cada uno expandible para ver su descripción y sus proyectos [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport. La pantalla y el shell que la contiene no tienen tratamiento responsive; la grilla de proyectos del contenido expandido se adapta por `auto-fill`, no por media query.
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente]. La barra de filtros de esta pantalla es el único bloque con un `@include mobile` (`ClientListFilters.module.scss:19-31`), y no se puede llegar a él desde un teléfono.
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Ítem `"Actores"` de la navegación del shell · `Navbar.tsx:49` [fuente: código-existente]
- Vuelta desde `alta-actor` tras crear · `clients/new/page.tsx:24`
- Vuelta desde `edicion-actor` tras guardar · `clients/edit/[id]/page.tsx:40`

**Salidas user-driven:**
- `/clients/new` · click en `boton-nuevo-actor` · `clients/page.tsx:22`
- `/clients/edit/{id}` · click en `accion-editar-actor` · `ClientCard.tsx:60-67`
- `/projects/{id}` · click en `card-proyecto` del contenido expandido · `ProjectCard.tsx:22`
- La propia ruta con otros `searchParams`, en cada cambio de filtro · `ClientListFilters.tsx:34`

**Salidas automáticas:**
- Ninguna propia.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | boton-nuevo-actor | button | primary | input | desktop | todos los estados | Ir al alta de actor |
| 2 | barra-filtros | section | — | layout | desktop | todos los estados | Contenedor de los tres filtros |
| 3 | buscador-actor | search-bar | default | input | desktop | todos los estados | Filtro por texto |
| 4 | filtro-estado | dropdown | closed | input | desktop | todos los estados | Filtro por estado del actor |
| 5 | filtro-orden | dropdown | closed | input | desktop | todos los estados | Orden del listado |
| 6 | tablero-actores | list | — | content | desktop | hidden_in_states: loading, empty | Pila de filas de actor |
| 7 | fila-actor | card | colapsada / expandida | content | desktop | hidden_in_states: loading, empty | Fila clickeable de un actor |
| 8 | chevron-expandir | icon | expandido / colapsado | content | desktop | hidden_in_states: loading, empty | Indica el estado de expansión |
| 9 | badge-estado-actor | badge | activo / inactivo | content | desktop | hidden_in_states: loading, empty | Estado derivado del actor |
| 10 | nombre-actor | paragraph | body | content | desktop | hidden_in_states: loading, empty | Identifica al actor |
| 11 | accion-editar-actor | link | — | navigation | desktop | hidden_in_states: loading, empty | Ir a la edición del actor |
| 12 | contenido-expandido | section | — | content | desktop | visible_only_in_states: fila expandida | Detalle del actor abierto |
| 13 | descripcion-actor | paragraph | body | content | desktop | visible_only_in_states: fila expandida | Descripción en markdown |
| 14 | grilla-proyectos-actor | list | — | content | desktop | visible_only_in_states: fila expandida | Proyectos del actor |
| 15 | card-proyecto | card | — | content | desktop | visible_only_in_states: fila expandida | Un proyecto del actor |
| 16 | boton-ver-mas | button | tertiary | input | desktop | hidden_in_states: loading, empty | Suma un lote de filas visibles |
| 17 | cargando-actores | loader | — | feedback | desktop | visible_only_in_states: loading | Indicador del refetch del componente cliente |
| 18 | cargando-tablero | loader | — | feedback | desktop | visible_only_in_states: loading | Fallback del `<Suspense>` de la página |
| 19 | vacio-actores | empty-state | — | feedback | desktop | visible_only_in_states: empty | Mensaje de listado sin resultados |
| 20 | vacio-proyectos-actor | empty-state | — | feedback | desktop | visible_only_in_states: fila expandida sin proyectos | Mensaje de actor sin proyectos |

**Origen:** `clients/page.tsx:22`, `clients/page.tsx:29`, `ClientListFilters.tsx:57`, `ClientListFilters.tsx:59-65`, `ClientListFilters.tsx:68-78`, `ClientListFilters.tsx:81-93`, `ClientsBoard.tsx:98`, `ClientsBoard.tsx:105`, `ClientsBoard.tsx:117`, `ClientsBoard.tsx:135`, `ClientsBoard.tsx:136`, `ClientsBoard.tsx:145-147`, `ClientCard.tsx:52`, `ClientCard.tsx:53-55`, `ClientCard.tsx:56-58`, `ClientCard.tsx:59`, `ClientCard.tsx:60-67`, `ClientProjects.tsx:11`, `ClientProjects.tsx:15`, `ClientProjects.tsx:18`

`barra-filtros`, `contenido-expandido` y `grilla-proyectos-actor` se relevaron como `section` y `list`: son contenedores sin tipo propio en el diccionario. `fila-actor` es un `<button>`, no una fila de tabla: el tablero es una pila de botones de ancho completo con borde inferior, no un `<table>` — aunque `clients/styles.module.scss:6-13` define una clase `.table` que el JSX no usa [fuente: código-existente].

El chrome (sidebar, área de contenido, toasts, encabezado de `PageLayout`) es compartido y no se repite acá.

## Layout por viewport

### desktop · 1440px

- boton-nuevo-actor (en el encabezado de `PageLayout`, a la derecha del título)
- row `filtros`
  - col 6/12: buscador-actor
  - col 3/12: filtro-estado
  - col 3/12: filtro-orden
- tablero-actores
  - fila-actor (pila vertical, ancho completo)
    - contenido-expandido (solo cuando está expandida)
      - descripcion-actor
      - grilla-proyectos-actor: card-proyecto
  - boton-ver-mas

**Origen de las fracciones de los filtros:** `ClientListFilters.module.scss:3-17` — tres hijos con pesos 2 + 1 + 1 = 4 → 6/12 + 3/12 + 3/12 [fuente: código-existente].

**Origen de la grilla de proyectos:** `ClientProjects.module.scss:1-6` — `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`. **Las fracciones no son derivables:** la cantidad de columnas depende del ancho disponible, no de un número declarado. Con el contenido a ~880px (1200px de viewport menos la sidebar de 290px y 2rem de padding por lado) entran 2 columnas; a 1440px entran 3 [fuente: código-existente].

## Contenido

### boton-nuevo-actor
- Texto/label: `"Nuevo actor"`
- Icono: nada
- Asset: nada
- Annotation: hardcodeado (`clients/page.tsx:22`)

### barra-filtros
- Texto/label: sin texto propio — es el contenedor de los tres filtros
- Icono: nada
- Asset: nada
- Annotation: `<section>` en `<ClientListFilters>` (`ClientListFilters.tsx:57`)

### buscador-actor
- Texto/label: `"Búsqueda"` · placeholder `"Buscar actor"`
- Icono: nada
- Asset: nada
- Annotation: debounce de 500 ms antes de escribir en `searchParams` (`ClientListFilters.tsx:47-54`). El valor inicial se lee de la URL, así que un reload lo preserva [fuente: código-existente]

### filtro-estado
- Texto/label: `"Estado"` · opciones `"Todos"` (`all`) · `"Activo"` (`activo`) · `"Inactivo"` (`inactivo`)
- Icono: nada
- Asset: nada
- Annotation: el valor `all` **borra** el parámetro de la URL en vez de escribirlo (`ClientListFilters.tsx:21-22`, `:69`, `:73-76`)

### filtro-orden
- Texto/label: `"Ordenar por"` · opciones `"Activos primero (A-Z)"` (`status-name`, default) · `"Más recientes"` (`-createdAt`) · `"Más antiguos"` (`createdAt`) · `"Nombre (A-Z)"` (`name`) · `"Nombre (Z-A)"` (`-name`)
- Icono: nada
- Asset: nada
- Annotation: el orden se aplica en el cliente sobre el array ya traído (`ClientsBoard.tsx:31-49` → `sortClients`). El parámetro `sort` también va a la api, pero el resultado se reordena localmente (`ClientListFilters.tsx:82`, `:86-91`) [fuente: código-existente]

### tablero-actores
- Texto/label: sin texto propio — es el contenedor de las filas
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.boardContainer}>` (`ClientsBoard.tsx:117`)

### fila-actor
- Texto/label: compone chevron-expandir, badge-estado-actor, nombre-actor y accion-editar-actor
- Icono: nada
- Asset: nada
- Annotation: es un `<button>` de ancho completo (`ClientCard.tsx:52`). Solo una fila puede estar expandida a la vez: abrir otra cierra la anterior

### chevron-expandir
- Texto/label: sin texto
- Icono: chevron (SVG inline `ChevronIcon`, `ClientCard.tsx:53-55`)
- Asset: nada
- Annotation: rota 180° cuando la fila está expandida

### badge-estado-actor
- Texto/label: `"Activo"` o `"Inactivo"`
- Icono: nada
- Asset: nada
- Annotation: **el estado no viene de la api**, se deriva de los proyectos del actor: `hasActive = client.projects?.some(p => p.status === 'activo' || p.status === 'analisis')` (`ClientsBoard.tsx:17-18`, `ClientCard.tsx:57`) [fuente: código-existente]

### nombre-actor
- Texto/label: dinámico desde `client.name` — no hay copy fijo
- Icono: nada
- Asset: nada
- Annotation: `ClientCard.tsx:59`

### accion-editar-actor
- Texto/label: sin texto visible. `title="Editar actor"`
- Icono: edit (SVG inline `EditIcon`, `ClientCard.tsx:33-46`)
- Asset: nada
- Annotation: `ClientCard.tsx:64`

### contenido-expandido
- Texto/label: sin texto propio — contiene descripcion-actor y grilla-proyectos-actor
- Icono: nada
- Asset: nada
- Annotation: aparece con animación `slideDown 0.2s` (`ClientsBoard.module.scss:19`, `ClientsBoard.tsx:135`)

### descripcion-actor
- Texto/label: dinámico desde `client.description`, renderizado como markdown
- Icono: nada
- Asset: nada
- Annotation: solo se renderiza si `client.description` es truthy; sin descripción, el bloque no aparece (no hay placeholder) (`ClientsBoard.tsx:136`) [fuente: código-existente]

### grilla-proyectos-actor
- Texto/label: sin texto propio — es la grilla de cards
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.projectsGrid}>` (`ClientProjects.tsx:15`)

### card-proyecto
- Texto/label: dinámico — `project.name`, `project.description`, fechas, estado, tipo y prioridad
- Icono: calendar (en la fecha)
- Asset: nada
- Annotation: los proyectos del actor se ordenan por `initDate` descendente antes de renderizar (`ClientsBoard.tsx:122-124`, `ProjectCard.tsx:22-47`)

### boton-ver-mas
- Texto/label: `"Ver más"`
- Icono: nada
- Asset: nada
- Annotation: suma `BATCH_SIZE` al conteo visible. La cantidad inicial se calcula midiendo el viewport: `Math.floor((window.innerHeight - containerTop - 60) / (CARD_HEIGHT + CARD_GAP))`, con mínimo `BATCH_SIZE`, y se recalcula en cada `resize` (`ClientsBoard.tsx:81-95`, `:146`) [fuente: código-existente]

### cargando-actores
- Texto/label: `"Cargando actores..."`
- Icono: nada
- Asset: imagen del componente `<Loader>`
- Annotation: `ClientsBoard.tsx:98`

### cargando-tablero
- Texto/label: `"Cargando  ..."`
- Icono: nada
- Asset: imagen del componente `<Loader>`
- Annotation: **el texto tiene dos espacios antes de los puntos.** Copiado verbatim del código (`clients/page.tsx:29`) [fuente: código-existente]

### vacio-actores
- Texto/label: `"No hay actores que coincidan con estos filtros."`
- Icono: nada
- Asset: nada
- Annotation: `ClientsBoard.tsx:105`

### vacio-proyectos-actor
- Texto/label: `"No hay proyectos asociados."`
- Icono: nada
- Asset: nada
- Annotation: `ClientProjects.tsx:11`

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Disparado por la query resuelta con al menos un actor tras filtrar (`ClientsBoard.tsx:116-149`) [fuente: código-existente]

### empty
- Aplica: Sí
- Mensaje: `"No hay actores que coincidan con estos filtros."`
- Cambios:
  - vacio-actores: solo visible en este estado (visible_only_in_states)
  - tablero-actores, fila-actor, boton-ver-mas: ocultos en este estado (hidden_in_states)
- Disparado por `allFiltered.length === 0`, **después** del filtrado en cliente (`ClientsBoard.tsx:103-107`). El mensaje asume que hay filtros aplicados: con la lista realmente vacía (cero actores en el sistema) dice lo mismo [fuente: código-existente]

### loading
- Aplica: Sí
- Mensaje: `"Cargando  ..."` en el primer render (fallback del `<Suspense>`) y `"Cargando actores..."` en los refetch del componente cliente
- Cambios:
  - cargando-tablero y cargando-actores: solo visibles en este estado (visible_only_in_states)
  - tablero-actores: oculto en este estado (hidden_in_states); la barra de filtros queda visible
- Origen: `clients/page.tsx:29`, `ClientsBoard.tsx:97-99` [fuente: código-existente]

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). La pantalla no tiene formulario.

### error de sistema / sin conexión
- Aplica: No — no implementado (ver gaps-as-is.md). `useClients` se desestructura como `{ data: clients, isLoading }`: `isError` se ignora. Ante un fallo, `clients` es `undefined`, `applyFilters(clients || [], …)` devuelve `[]` y la pantalla muestra `"No hay actores que coincidan con estos filtros."` — un error de red es indistinguible de un filtro sin resultados (`ClientsBoard.tsx:70`, `:101-107`). Tampoco existe `app/(loggedin)/clients/error.tsx` [fuente: código-existente].

### success
- Aplica: No — no implementado (ver gaps-as-is.md). El toast de éxito lo dispara `alta-actor` / `edicion-actor` antes de navegar (`clients/new/page.tsx:25`).

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). Un actor `inactivo` se muestra igual que uno activo salvo el badge; no hay tratamiento readonly (`ClientCard.tsx:52-68`) [fuente: código-existente].

### fila expandida (parent_state: default)
- Aplica: Sí
- Mensaje: `"No hay proyectos asociados."` cuando el actor no tiene proyectos
- Cambios:
  - contenido-expandido, descripcion-actor, grilla-proyectos-actor, card-proyecto: solo visibles en este estado (visible_only_in_states)
  - chevron-expandir: rota 180° (state_override)
  - vacio-proyectos-actor: solo visible si `!projects || projects.length === 0` (`ClientProjects.tsx:10-12`)
- Disparado por click en la fila; `expandedId === client.id` (`ClientsBoard.tsx:120`, `:134-139`) [fuente: código-existente]

## Interacciones

**Eventos:**
- buscador-actor · on change → debounce 500ms → `router.push('/clients?search=…')` · `ClientListFilters.tsx:47-54`
- filtro-estado · on change → `router.push` inmediato · `ClientListFilters.tsx:77`
- filtro-orden · on change → `router.push` inmediato · `ClientListFilters.tsx:92`
- fila-actor · on click → expande o colapsa; cierra la que estuviera abierta · `ClientsBoard.tsx:132`
- accion-editar-actor · on click → navega a `/clients/edit/{id}` · `ClientCard.tsx:61`
- card-proyecto · on click → navega a `/projects/{id}` · `ProjectCard.tsx:22`
- boton-ver-mas · on click → `visibleCount += BATCH_SIZE` · `ClientsBoard.tsx:112-114`
- window · on resize → recalcula `visibleCount` según el alto disponible · `ClientsBoard.tsx:90-95`
- cambio de filtros → resetea `visibleCount` a `BATCH_SIZE` y colapsa la fila abierta · `ClientsBoard.tsx:76-79`

[fuente: código-existente]

**Validaciones:**
- Ninguna: no hay inputs validados.

**Feedback:**
- Hover en la fila: `background-color: var(--color-surface-alt)` (`ClientCard.module.scss:26-28`)
- Expansión: animación `slideDown 0.2s ease` (`ClientsBoard.module.scss:19`)
- Cambio de filtro: el `<Suspense>` **no** lleva `key` en esta pantalla, así que el tablero viejo queda en pantalla durante el refetch, sin indicador (`clients/page.tsx:29`) [fuente: código-existente]

## Accesibilidad

- **Orden de foco:** boton-nuevo-actor (en el encabezado del shell) → buscador-actor → filtro-estado → filtro-orden → por cada fila: fila-actor y accion-editar-actor → boton-ver-mas. **accion-editar-actor es un `<Link>` dentro del `<button>` de la fila**: HTML inválido (contenido interactivo anidado) y el comportamiento del teclado es ambiguo (`ClientCard.tsx:52-67`) [fuente: código-existente].
- **Landmarks y jerarquía:** el `<h1>` de la pantalla lo aporta el `titulo-pagina` de `PageLayout` (chrome compartido). El tablero es una pila de `<div>`/`<button>`, **no una lista**: sin `role="list"` ni conteo anunciado (`ClientsBoard.tsx:117-143`) [fuente: código-existente].
- **Foco y teclado:** esta pantalla no dispara overlays con focus trap. Al expandir una fila **el foco no se maneja**: queda en el botón, y el contenido nuevo aparece después en el orden del documento sin anunciarse (`ClientsBoard.tsx:134-139`) [fuente: código-existente].
- **Propio de esta composición:**
  - **El estado expandido no se anuncia:** la fila es un `<button>` sin `aria-expanded` ni `aria-controls`, así que un lector de pantalla no sabe que expande algo ni si está abierto (`ClientCard.tsx:52`).
  - **El resultado del filtrado no se anuncia:** no hay `aria-live` en el tablero, así que al filtrar un usuario de lector de pantalla no recibe aviso de que la lista cambió ni de cuántos resultados hay (`ClientsBoard.tsx:116`).
  - El nombre accesible de `accion-editar-actor` viene solo de `title="Editar actor"`, un fallback débil que no anuncian todos los lectores y no aparece en foco por teclado (`ClientCard.tsx:64`).
  - `boton-ver-mas` no anuncia cuántos elementos agrega ni cuántos faltan (`ClientsBoard.tsx:145-147`).
  [fuente: código-existente]

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
