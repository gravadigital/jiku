---
document: UX Survey Screen
screen: listado-actores
route: /clients
service: web
source_files:
  - src/app/(loggedin)/clients/page.tsx
  - src/app/(loggedin)/clients/styles.module.scss
  - src/features/clients/components/ClientListFilters/ClientListFilters.tsx
  - src/features/clients/components/ClientsBoard/ClientsBoard.tsx
  - src/features/clients/components/ClientCard/ClientCard.tsx
  - src/features/clients/components/ClientProjects/ClientProjects.tsx
  - src/features/projects/components/ProjectCard/ProjectCard.tsx
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: listado-actores

> **Relevamiento as-is** de `/clients`, extraído de `src/app/(loggedin)/clients/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome (sidebar, área de contenido, toasts, encabezado de `PageLayout`) está relevado en
> [_shell.md](./_shell.md) y no se repite acá.

## Identidad

- **Ruta:** `/clients`
- **Archivo:** `src/app/(loggedin)/clients/page.tsx` (Server Component, `dynamic = 'force-dynamic'`)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** lista los actores filtrables por texto y estado, cada uno expandible para
  ver su descripción y sus proyectos.
- **Viewports con tratamiento:** solo la barra de filtros tiene tratamiento (`@include mobile` en
  `ClientListFilters.module.scss:19`). El resto de la pantalla, y el shell que la contiene, no.

## Entrada y salida

**Entradas:**
- Ítem `"Actores"` de la navegación · `Navbar.tsx:49`
- Vuelta desde `alta-actor` tras crear · `clients/new/page.tsx:24`
- Vuelta desde `edicion-actor` tras guardar · `clients/edit/[id]/page.tsx:40`

**Salidas:**
- `/clients/new` · botón `"Nuevo actor"` del encabezado · `clients/page.tsx:22`
- `/clients/edit/{id}` · icono de lápiz en la fila del actor · `ClientCard.tsx:60-67`
- `/projects/{id}` · click en una card de proyecto del contenido expandido ·
  `ProjectCard.tsx:22`
- La propia ruta con otros `searchParams`, en cada cambio de filtro · `ClientListFilters.tsx:34`

**Redirects automáticos:**
- Ninguno propio.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | boton-nuevo-actor | `button` | primary | ambos | `<Button label="Nuevo actor" href="/clients/new">` | `clients/page.tsx:22` |
| 2 | barra-filtros | `section` | — | ambos | `<section>` en `<ClientListFilters>` | `ClientListFilters.tsx:57` |
| 3 | buscador-actor | `search-bar` | default | ambos | `<InputText label="Búsqueda">` | `ClientListFilters.tsx:59-65` |
| 4 | filtro-estado | `dropdown` | closed | ambos | `<InputSelect label="Estado">` | `ClientListFilters.tsx:68-78` |
| 5 | filtro-orden | `dropdown` | closed | ambos | `<InputSelect label="Ordenar por">` | `ClientListFilters.tsx:81-93` |
| 6 | tablero-actores | `list` | — | ambos | `<div className={styles.boardContainer}>` | `ClientsBoard.tsx:117` |
| 7 | fila-actor | `card` | colapsada / expandida | ambos | `<ClientCard>` — un `<button>` de ancho completo | `ClientCard.tsx:52` |
| 8 | chevron-expandir | `icon` | expandido / colapsado | ambos | SVG inline `ChevronIcon` | `ClientCard.tsx:53-55` |
| 9 | badge-estado-actor | `badge` | activo / inactivo | ambos | `<span className={styles.statusBadge}>` | `ClientCard.tsx:56-58` |
| 10 | nombre-actor | `paragraph` | body | ambos | `<span className={styles.name}>` | `ClientCard.tsx:59` |
| 11 | accion-editar-actor | `link` | — | ambos | `<Link>` con SVG `EditIcon` | `ClientCard.tsx:60-67` |
| 12 | contenido-expandido | `section` | — | ambos | `<div className={styles.expandedContent}>` | `ClientsBoard.tsx:135` |
| 13 | descripcion-actor | `paragraph` | body | ambos | `<MarkdownViewer>` | `ClientsBoard.tsx:136` |
| 14 | grilla-proyectos-actor | `list` | — | ambos | `<div className={styles.projectsGrid}>` en `<ClientProjects>` | `ClientProjects.tsx:15` |
| 15 | card-proyecto | `card` | — | ambos | `<ProjectCard>` | `ClientProjects.tsx:18` |
| 16 | boton-ver-mas | `button` | tertiary | ambos | `<button className={styles.verMas}>` | `ClientsBoard.tsx:145-147` |
| 17 | cargando-actores | `loader` | — | ambos | `<Loader label="Cargando actores...">` | `ClientsBoard.tsx:98` |
| 18 | cargando-tablero | `loader` | — | ambos | `<Loader label="Cargando  ...">` como fallback de `<Suspense>` | `clients/page.tsx:29` |
| 19 | vacio-actores | `empty-state` | — | ambos | `<span className={styles.emptyState}>` | `ClientsBoard.tsx:105` |
| 20 | vacio-proyectos-actor | `empty-state` | — | ambos | `<div className={styles.empty}>` | `ClientProjects.tsx:11` |

> `barra-filtros`, `contenido-expandido` y `grilla-proyectos-actor` se relevaron como `section` y
> `list`: son contenedores sin tipo propio en el diccionario.

> **`fila-actor` es un `<button>`, no una fila de tabla.** El tablero es una pila de botones de ancho
> completo con borde inferior, no un `<table>` — aunque `clients/styles.module.scss:6-13` define una
> clase `.table` que el JSX no usa.

## Layout observado por viewport

### todos los anchos (excepto la barra de filtros)

- boton-nuevo-actor (en el encabezado de `PageLayout`, a la derecha del título)
- row `filtros`
  - col 6/12: buscador-actor
  - col 3/12: filtro-estado
  - col 3/12: filtro-orden
- tablero-actores
  - fila-actor (pila vertical, ancho completo)
    - contenido-expandido (solo cuando está expandida)
      - descripcion-actor
      - grilla-proyectos-actor: card-proyecto, columnas de 300px mínimo con `auto-fill`
  - boton-ver-mas

**Origen de las fracciones de los filtros:** `ClientListFilters.module.scss:3-17`:

```scss
.filterSection { display: flex; gap: 1rem; flex-direction: row;
  & > div { flex: 1; }
  & > div.search { flex: 2; }
}
```

Tres hijos con pesos 2 + 1 + 1 = 4 → **6/12 + 3/12 + 3/12**.

**Origen de la grilla de proyectos:** `ClientProjects.module.scss:1-6` —
`grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`. **Las fracciones no son derivables:**
la cantidad de columnas depende del ancho disponible, no de un número declarado. Con el contenido a
~880px (1200px de viewport menos la sidebar de 290px y 2rem de padding por lado) entran 2 columnas;
a 1440px entran 3.

### mobile · 400px (solo la barra de filtros)

- barra-filtros en columna, cada control al 100%
  - buscador-actor
  - filtro-estado
  - filtro-orden

**Origen:** `ClientListFilters.module.scss:19-31` — `@include mobile { .filterSection { flex-direction: column; & > div { width: 100% } } }`

> **Este es el único bloque de la pantalla con tratamiento mobile**, y no se puede llegar a él desde
> un teléfono: el shell no tiene navegación en mobile (ver [_shell.md](./_shell.md)).

## Contenido

### boton-nuevo-actor
- Texto/label: `"Nuevo actor"`
- Origen: `clients/page.tsx:22` (hardcodeado)

### buscador-actor
- Texto/label: `"Búsqueda"` · placeholder `"Buscar actor"`
- Origen: `ClientListFilters.tsx:60`, `:64`
- Annotation: debounce de **500 ms** antes de escribir en `searchParams`
  (`ClientListFilters.tsx:47-54`). El valor inicial se lee de la URL, así que un reload lo preserva.

### filtro-estado
- Texto/label: `"Estado"`
- Opciones verbatim: `"Todos"` (`all`) · `"Activo"` (`activo`) · `"Inactivo"` (`inactivo`)
- Origen: `ClientListFilters.tsx:69`, `:73-76`
- Annotation: el valor `all` **borra** el parámetro de la URL en vez de escribirlo
  (`ClientListFilters.tsx:21-22`)

### filtro-orden
- Texto/label: `"Ordenar por"`
- Opciones verbatim: `"Activos primero (A-Z)"` (`status-name`, default) ·
  `"Más recientes"` (`-createdAt`) · `"Más antiguos"` (`createdAt`) · `"Nombre (A-Z)"` (`name`) ·
  `"Nombre (Z-A)"` (`-name`)
- Origen: `ClientListFilters.tsx:82`, `:86-91`
- Annotation: **el orden se aplica en el cliente**, sobre el array ya traído
  (`ClientsBoard.tsx:31-49` → `sortClients`). El parámetro `sort` también va a la api, pero el
  resultado se reordena localmente.

### badge-estado-actor
- Texto/label: `"Activo"` o `"Inactivo"`
- Origen: `ClientCard.tsx:57`
- Annotation: **el estado no viene de la api.** Se deriva de los proyectos del actor:
  ```ts
  // ClientsBoard.tsx:17-18
  const hasActive = client.projects?.some((p) => p.status === 'activo' || p.status === 'analisis');
  return hasActive ? 'activo' : 'inactivo';
  ```

### nombre-actor
- Texto/label: dinámico desde `client.name` — no hay copy fijo
- Origen: `ClientCard.tsx:59`

### accion-editar-actor
- Texto/label: sin texto visible. `title="Editar actor"`
- Origen: `ClientCard.tsx:64`
- Icono: SVG inline de lápiz (`EditIcon`, `ClientCard.tsx:33-46`)

### descripcion-actor
- Texto/label: dinámico desde `client.description`, renderizado como markdown
- Origen: `ClientsBoard.tsx:136`
- Annotation: solo se renderiza si `client.description` es truthy; sin descripción, el bloque no
  aparece (no hay placeholder)

### card-proyecto
- Texto/label: dinámico — `project.name`, `project.description`, fechas, estado, tipo y prioridad
- Origen: `ProjectCard.tsx:22-47`
- Annotation: los proyectos del actor se ordenan por `initDate` descendente antes de renderizar
  (`ClientsBoard.tsx:122-124`)

### boton-ver-mas
- Texto/label: `"Ver más"`
- Origen: `ClientsBoard.tsx:146`
- Annotation: suma `BATCH_SIZE` al conteo visible. La cantidad inicial se **calcula midiendo el
  viewport**: `Math.floor((window.innerHeight - containerTop - 60) / (CARD_HEIGHT + CARD_GAP))`, con
  mínimo `BATCH_SIZE`, y se recalcula en cada `resize` (`ClientsBoard.tsx:81-95`).

### cargando-actores / cargando-tablero
- Texto/label: `"Cargando actores..."` (del componente) y `"Cargando  ..."` (del `Suspense` de la
  página)
- Origen: `ClientsBoard.tsx:98`, `clients/page.tsx:29`
- Annotation: **`"Cargando  ..."` tiene dos espacios antes de los puntos.** Copiado verbatim.

### vacio-actores
- Texto/label: `"No hay actores que coincidan con estos filtros."`
- Origen: `ClientsBoard.tsx:105`

### vacio-proyectos-actor
- Texto/label: `"No hay proyectos asociados."`
- Origen: `ClientProjects.tsx:11`

## Estados presentes

### default
- Disparado por: query resuelta con al menos un actor tras filtrar
- Origen: `ClientsBoard.tsx:116-149`

### loading (dos niveles)
- Mensaje: `"Cargando  ..."` en el primer render (fallback del `<Suspense>`), y
  `"Cargando actores..."` en los refetch del componente cliente
- Disparado por: el `<Suspense>` de la página, y `isLoading` de `useClients`
- Origen: `clients/page.tsx:29`, `ClientsBoard.tsx:97-99`
- Cambios: reemplaza el tablero completo; la barra de filtros queda visible

### empty
- Mensaje: `"No hay actores que coincidan con estos filtros."`
- Disparado por: `allFiltered.length === 0` — **después** del filtrado en cliente
- Origen: `ClientsBoard.tsx:103-107`
- Cambios: reemplaza el tablero por el texto

> El mensaje asume que hay filtros aplicados. Con la lista realmente vacía (cero actores en el
> sistema) dice lo mismo, y no hay estado de primer uso diferenciado.

### fila expandida (sub-estado de default)
- Disparado por: click en la fila; `expandedId === client.id`
- Origen: `ClientsBoard.tsx:120`, `:134-139`
- Cambios: aparece `contenido-expandido` con animación `slideDown 0.2s`
  (`ClientsBoard.module.scss:19`), y el chevron rota 180°. **Solo una fila puede estar expandida a la
  vez:** abrir otra cierra la anterior (`ClientCard` recibe `onToggle` que setea `expandedId` o
  `null`).

### empty del contenido expandido
- Mensaje: `"No hay proyectos asociados."`
- Disparado por: `!projects || projects.length === 0`
- Origen: `ClientProjects.tsx:10-12`

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| error de sistema / sin conexión | **no se maneja.** `useClients` se desestructura como `{ data: clients, isLoading }`: `isError` se ignora. Ante un fallo, `clients` es `undefined`, `applyFilters(clients \|\| [], …)` devuelve `[]` y la pantalla muestra `"No hay actores que coincidan con estos filtros."` — **un error de red es indistinguible de un filtro sin resultados** | `ClientsBoard.tsx:70`, `:101-107` |
| error de sistema (render de servidor) | **sin boundary propio:** no existe `clients/error.tsx`. Una excepción en el render del Server Component cae en la pantalla de error por defecto de Next, sin sidebar | no existe `app/(loggedin)/clients/error.tsx` |
| empty de primer uso | no diferenciado del empty por filtros: el mismo mensaje para "no hay actores" y "el filtro no matchea" | `ClientsBoard.tsx:105` |
| error de validación | no aplica: la pantalla no tiene formulario | — |
| success | no aplica acá; el toast de éxito lo dispara `alta-actor` / `edicion-actor` antes de navegar | `clients/new/page.tsx:25` |
| not found | no aplica: es un listado | — |
| estado terminal / readonly | **no existe**, y podría aplicar: un actor `inactivo` se muestra igual que uno activo salvo el badge. No hay tratamiento readonly | `ClientCard.tsx:52-68` |
| loading del contenido expandido | no aplica: los proyectos vienen en la misma respuesta que el actor, no hay segunda query | `ClientsBoard.tsx:122` |

## Interacciones

**Eventos:**
- buscador-actor · on change → debounce 500ms → `router.push('/clients?search=…')` ·
  `ClientListFilters.tsx:47-54`
- filtro-estado · on change → `router.push` inmediato · `ClientListFilters.tsx:77`
- filtro-orden · on change → `router.push` inmediato · `ClientListFilters.tsx:92`
- fila-actor · click → expande o colapsa; cierra la que estuviera abierta ·
  `ClientsBoard.tsx:132`
- accion-editar-actor · click → navega a `/clients/edit/{id}` · `ClientCard.tsx:61`
- card-proyecto · click → navega a `/projects/{id}` · `ProjectCard.tsx:22`
- boton-ver-mas · click → `visibleCount += BATCH_SIZE` · `ClientsBoard.tsx:112-114`
- window · resize → recalcula `visibleCount` según el alto disponible ·
  `ClientsBoard.tsx:90-95`
- cambio de filtros → resetea `visibleCount` a `BATCH_SIZE` y colapsa la fila abierta ·
  `ClientsBoard.tsx:76-79`

**Validaciones:**
- Ninguna: no hay inputs validados.

**Feedback:**
- Hover en la fila: `background-color: var(--color-surface-alt)` ·
  `ClientCard.module.scss:26-28`
- Expansión: animación `slideDown 0.2s ease` · `ClientsBoard.module.scss:19`
- Cambio de filtro: el `<Suspense key={...}>` **no** se usa en esta pantalla, así que el tablero
  viejo queda en pantalla durante el refetch, sin indicador · `clients/page.tsx:29`

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Alt en imágenes | El icono de calendario de `ProjectCard` tiene `alt="calendar icon"` — describe el icono, no su función; siendo decorativo debería ser `alt=""` | `ProjectCard.tsx:26` |
| SVG inline | `ChevronIcon` y `EditIcon` no tienen `aria-hidden="true"` ni `role="img"` con label | `ClientCard.tsx:14-47` |
| Nombre accesible de la acción editar | Solo `title="Editar actor"`. `title` es un fallback débil: no lo anuncian todos los lectores y no aparece en foco por teclado | `ClientCard.tsx:64` |
| Estado expandido anunciado | **ausente:** la fila es un `<button>` sin `aria-expanded` ni `aria-controls`. Un lector de pantalla no sabe que expande algo ni si está abierto | `ClientCard.tsx:52` |
| Semántica de la lista | El tablero es una pila de `<div>`/`<button>`, no una lista. Sin `role="list"` ni conteo anunciado | `ClientsBoard.tsx:117-143` |
| Link anidado en botón | `accion-editar-actor` es un `<Link>` **dentro** del `<button>` de la fila. HTML inválido (contenido interactivo anidado) y el comportamiento del teclado es ambiguo | `ClientCard.tsx:52-67` |
| Labels de los filtros | Presentes vía la prop `label` de `InputText`/`InputSelect` | `ClientListFilters.tsx:60,69,82` |
| `boton-ver-mas` | Es un `<button type="button">` con texto. Correcto. No anuncia cuántos elementos agrega ni cuántos faltan | `ClientsBoard.tsx:145-147` |
| Anuncio del resultado del filtrado | **ausente:** sin `aria-live`. Al filtrar, un usuario de lector de pantalla no recibe aviso de que la lista cambió ni de cuántos resultados hay | `ClientsBoard.tsx:116` |
| Manejo de foco al expandir | **ausente:** el foco queda en el botón; el contenido nuevo aparece después en el orden del documento pero no se anuncia | `ClientsBoard.tsx:134-139` |

## Observaciones del relevamiento

- **El filtrado y el orden ocurren dos veces.** Los filtros van a la api como query params
  (`clientsApi.ts:17-22`) **y** se vuelven a aplicar en el cliente sobre la respuesta
  (`ClientsBoard.tsx:52-62`). No se puede determinar desde el código si la api los honra: si lo
  hace, el trabajo está duplicado; si no, el filtro de la api es decorativo. **A verificar contra
  `api`.**
- **El estado del actor es una derivación del cliente**, no un dato. Cualquier cambio en los estados
  de proyecto que cuentan como "activo" hay que hacerlo en `ClientsBoard.tsx:17`, no en la api.
- **La paginación mide el DOM.** `visibleCount` sale de `window.innerHeight` menos la posición del
  contenedor, dividido por una altura de card constante. Depende de que `CARD_HEIGHT` coincida con el
  alto real, que cambia si el contenido crece. No se puede verificar la coincidencia desde el
  código.
- **`clients/styles.module.scss` define una clase `.table`** (`líneas 6-13`) que ningún JSX usa. El
  tablero actual no es una tabla. Sugiere una implementación anterior; el código no lo confirma.
- **Typo en microcopy:** `"Cargando  ..."` con doble espacio (`clients/page.tsx:29`). Se copia
  verbatim por si el arreglo tiene que ser una decisión explícita.
- **No se pudo determinar** si el orden `"Activos primero (A-Z)"` es el default deseado o solo el
  primero de la lista: es el valor por defecto en dos lugares (`clients/page.tsx:18` y
  `ClientListFilters.tsx:84`), duplicado.
- **A confirmar en consolidación:** si el empty debería distinguir "todavía no hay actores" de "el
  filtro no encontró nada", y si un error de red debe verse distinto de una lista vacía. Es el gap
  más repetido del producto.
