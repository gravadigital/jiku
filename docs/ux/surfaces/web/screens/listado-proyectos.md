---
name: listado-proyectos
surface: web
route: /projects
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.1"
date: 2026-09-02
---

# Pantalla: Listado de proyectos

## Identidad

- **Audiencia primaria:** equipo-interno. Requiere sesión — el guard está en `(loggedin)/layout.tsx:13-21` [fuente: código-existente].
- **JTBD / Propósito:** grilla de cards de proyecto, filtrable por texto, tipo, estado y orden [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport. Sin tratamiento responsive por media query: la grilla se adapta por `auto-fill`.
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Ítem `"Proyectos"` de la navegación del shell · `Navbar.tsx:54` [fuente: código-existente]
- Redirect desde `time-allocation`, `worked-times` y `worked-times/report` cuando el rol es `external-user` · `time-allocation/page.tsx:14`, `worked-times/page.tsx:14`, `worked-times/report/page.tsx:14`
- Vuelta desde `edicion-proyecto` tras guardar · `projects/edit/[id]/page.tsx:~272`

**Salidas user-driven:**
- `/projects/new` · click en `boton-nuevo-proyecto` · `projects/page.tsx:23`
- `/projects/{id}` · click en cualquier `card-proyecto` · `ProjectCard.tsx:22`
- La propia ruta con otros `searchParams`, en cada cambio de filtro · `ProjectListFilters.tsx:34`

**Salidas automáticas:**
- Ninguna propia.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | boton-nuevo-proyecto | button | primary | input | desktop | todos los estados | Ir al alta de proyecto |
| 2 | barra-filtros | section | — | layout | desktop | todos los estados | Contenedor de los cuatro filtros |
| 3 | buscador-proyecto | search-bar | default | input | desktop | todos los estados | Filtro por texto |
| 4 | filtro-tipo | dropdown | closed | input | desktop | todos los estados | Filtro por tipo de proyecto |
| 5 | filtro-estado | dropdown | closed | input | desktop | todos los estados | Filtro por estado de proyecto |
| 6 | filtro-orden | dropdown | closed | input | desktop | todos los estados | Orden del listado |
| 7 | grilla-proyectos | list | — | content | desktop | hidden_in_states: loading, empty, error de sistema / sin conexión | Grilla de cards |
| 8 | card-proyecto | card | — | content | desktop | hidden_in_states: loading, empty, error de sistema / sin conexión | Un proyecto de la grilla |
| 9 | fecha-proyecto | paragraph | caption | content | desktop | hidden_in_states: loading, empty | Fechas de inicio y cierre |
| 10 | badge-estado-proyecto | badge | por `data-status` | content | desktop | hidden_in_states: loading, empty | Estado del proyecto |
| 11 | nombre-proyecto | heading | h2 | content | desktop | hidden_in_states: loading, empty | Identifica al proyecto |
| 12 | descripcion-proyecto | paragraph | body | content | desktop | hidden_in_states: loading, empty | Resumen truncado |
| 13 | tag-tipo-proyecto | badge | por tipo | content | desktop | hidden_in_states: loading, empty | Tipo del proyecto |
| 14 | tag-prioridad-proyecto | badge | por prioridad 0-5 | content | desktop | hidden_in_states: loading, empty | Prioridad del proyecto |
| 15 | cargando-proyectos | loader | — | feedback | desktop | visible_only_in_states: loading | Fallback del `<Suspense>` |
| 16 | vacio-proyectos | empty-state | — | feedback | desktop | visible_only_in_states: empty | Mensaje de grilla sin resultados |
| 17 | pantalla-error | alert | error | feedback | desktop | visible_only_in_states: error de sistema / sin conexión | Boundary de error de la ruta |

**Origen:** `projects/page.tsx:23`, `projects/page.tsx:30`, `ProjectListFilters.tsx:57`, `ProjectListFilters.tsx:59-70`, `ProjectListFilters.tsx:73-87`, `ProjectListFilters.tsx:90-112`, `ProjectListFilters.tsx:115-126`, `ProjectsBoard.tsx:11`, `ProjectsBoard.tsx:13`, `ProjectsBoard.tsx:18`, `ProjectCard.tsx:25-33`, `ProjectCard.tsx:36-38`, `ProjectCard.tsx:39`, `ProjectCard.tsx:40`, `ProjectCard.tsx:43`, `ProjectCard.tsx:44`, `projects/error.tsx:6-11`

`barra-filtros` y `grilla-proyectos` se relevaron como `section` y `list`: contenedores sin tipo propio en el diccionario. El chrome (sidebar, área de contenido, toasts, encabezado de `PageLayout`) es compartido y no se repite acá [fuente: código-existente].

## Layout por viewport

### desktop · 1440px

- boton-nuevo-proyecto (en el encabezado de `PageLayout`, a la derecha del título)
- row `filtros`
  - col 6/12: buscador-proyecto
  - col 2/12: filtro-tipo
  - col 2/12: filtro-estado
  - col 2/12: filtro-orden
- grilla-proyectos
  - card-proyecto × N (fecha-proyecto, badge-estado-proyecto, nombre-proyecto, descripcion-proyecto, tag-tipo-proyecto, tag-prioridad-proyecto)

**Origen de las fracciones de los filtros:** `ProjectListFilters.module.scss:2-13` — el buscador ocupa `50%` (6/12) y los tres selects `50%/3` cada uno (2/12). A diferencia de `listado-actores`, que usa `flex: 1` / `flex: 2`, acá los anchos son porcentajes explícitos con `flex-wrap: nowrap`: **el `gap: 1rem` se suma por encima del 100%**, así que la fila desborda su contenedor. Con `overflow-x: hidden` en el `body` (`globals.scss:172`) el desborde se recorta [fuente: código-existente].

**Origen de la grilla:** `ProjectsBoard.module.scss:2-5` — `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`. **Las fracciones de la grilla no son derivables:** la cantidad de columnas depende del ancho disponible. Con el contenido a ~880px (1200px de viewport menos la sidebar de 290px y 2rem de padding por lado) entran 2 columnas; a 1440px entran 3; a 1920px entran 5 [fuente: código-existente].

## Contenido

### boton-nuevo-proyecto
- Texto/label: `"Nuevo proyecto"`
- Icono: nada
- Asset: nada
- Annotation: hardcodeado (`projects/page.tsx:23`)

### barra-filtros
- Texto/label: sin texto propio — es el contenedor de los cuatro filtros
- Icono: nada
- Asset: nada
- Annotation: `<section>` en `<ProjectListFilters>` (`ProjectListFilters.tsx:57`)

### buscador-proyecto
- Texto/label: `"Búsqueda"` · placeholder `"Buscar proyecto"`
- Icono: nada
- Asset: nada
- Annotation: debounce de 500 ms antes de escribir en `searchParams` (`ProjectListFilters.tsx:47-54`). Valor inicial desde la URL (`:60`, `:69`) [fuente: código-existente]

### filtro-tipo
- Texto/label: `"Tipo"` · opciones `"Todos"` (`all`) · `"Interno"` (`interno`) · `"Comercial"` (`comercial`) · `"Investigación"` (`investigacion`) · `"Propuesta"` (`propuesta`)
- Icono: nada
- Asset: nada
- Annotation: `ProjectListFilters.tsx:74`, `:78-83`

### filtro-estado
- Texto/label: `"Estado"` · opciones `"Todos"` (`all`) · `"Activo"` (`activo`) · `"Análisis"` (`analisis`) · `"Inactivo"` (`inactivo`) · `"Finalizado"` (`finalizado`) · `"Cancelado"` (`cancelado`)
- Icono: nada
- Asset: nada
- Annotation: **el default es `activo`**, no "Todos" (`projects/page.tsx:19`, `ProjectListFilters.tsx:15`). Al entrar a la pantalla los proyectos inactivos, finalizados y cancelados no se ven, y el filtro no comunica que hay un recorte activo más allá de mostrar "Activo" seleccionado (`:91`, `:95-101`) [fuente: código-existente]

### filtro-orden
- Texto/label: `"Ordenar por"` · opciones `"Más recientes"` (`-initDate`, default) · `"Más antiguos"` (`initDate`)
- Icono: nada
- Asset: nada
- Annotation: solo dos opciones, ambas por fecha de inicio. No hay orden por nombre ni por prioridad (`ProjectListFilters.tsx:116`, `:120-121`) [fuente: código-existente]

### grilla-proyectos
- Texto/label: sin texto propio — es el contenedor de las cards
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.gridContainer}>` (`ProjectsBoard.tsx:11`)

### card-proyecto
- Texto/label: compone los seis bloques de contenido siguientes
- Icono: nada
- Asset: nada
- Annotation: la card entera es un `<Link>` a `/projects/{id}` (`ProjectCard.tsx:22`)

### fecha-proyecto
- Texto/label: dinámico. Formato `"Aug 18 2026"` — `initDate.toUTCString().slice(4, 16)`. Con fecha de cierre válida se concatena `" - {endDate}"` en el mismo formato
- Icono: calendar, con `alt="calendar icon"`
- Asset: nada
- Annotation: **el formato de fecha es el de `toUTCString()`, en inglés** (`"Aug"`, `"Sep"`), a diferencia del resto del producto que usa `toLocaleDateString('es-ES')` o `'es-AR'`. El `slice` posicional sobre el string de `toUTCString()` es frágil y depende del formato exacto de ese método (`ProjectCard.tsx:25-33`) [fuente: código-existente]

### badge-estado-proyecto
- Texto/label: dinámico desde `status`, pasado por `getProjectStatus` para la etiqueta legible
- Icono: nada
- Asset: nada
- Annotation: el color se aplica con el atributo `data-status`, que el SCSS mapea a `--color-status-*`. **Dos pares de estados comparten color:** `inactivo` y `backlog` son ambos `#5F6D7F`, y `analisis` y `en_revision` son ambos `#208CEF` (`_variables.scss:44-50`, `ProjectCard.tsx:36-38`) [fuente: código-existente]

### nombre-proyecto
- Texto/label: dinámico desde `name` — no hay copy fijo
- Icono: nada
- Asset: nada
- Annotation: se renderiza como `<h2>`, así que la grilla es navegable por encabezados (`ProjectCard.tsx:39`)

### descripcion-proyecto
- Texto/label: dinámico desde `project.description` — no hay copy fijo
- Icono: nada
- Asset: nada
- Annotation: truncado a N líneas con `-webkit-line-clamp` (`ProjectCard.module.scss:105`). **Se renderiza como texto plano**, no como markdown, aunque el campo acepta markdown y el detalle sí lo renderiza: en la card se ven los asteriscos y los `#` literales (`ProjectCard.tsx:40`) [fuente: código-existente]

### tag-tipo-proyecto
- Texto/label: dinámico — **el valor crudo de la api**, no una etiqueta traducida
- Icono: icono de tipo de proyecto, con `alt="project type"`
- Asset: nada
- Annotation: muestra `investigacion` sin tilde y en minúscula, mientras el filtro de la misma pantalla ofrece `"Investigación"` (`ProjectTypeTag.tsx:18`) [fuente: código-existente]

### tag-prioridad-proyecto
- Texto/label: dinámico desde `priority` (0-5)
- Icono: nada
- Asset: nada
- Annotation: color por `--color-priority-0..5`, gradiente amarillo → rojo (`ProjectPriorityTag.tsx:13`)

### cargando-proyectos
- Texto/label: `"Cagando..."`
- Icono: nada
- Asset: imagen del componente `<Loader>`
- Annotation: **typo: falta la `r` de "Cargando".** Copiado verbatim del código (`projects/page.tsx:30`) [fuente: código-existente]

### vacio-proyectos
- Texto/label: `"No hay proyectos que coincidan con estos filtros."`
- Icono: nada
- Asset: nada
- Annotation: `ProjectsBoard.tsx:13`

### pantalla-error
- Texto/label: `"Error"` como título y `error.message` dinámico como cuerpo
- Icono: nada
- Asset: nada
- Annotation: `projects/error.tsx:8-9`

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Disparado por la Server Action que devuelve al menos un proyecto (`ProjectsBoard.tsx:11-24`) [fuente: código-existente]

### empty
- Aplica: Sí
- Mensaje: `"No hay proyectos que coincidan con estos filtros."`
- Cambios:
  - vacio-proyectos: solo visible en este estado (visible_only_in_states)
  - grilla-proyectos y card-proyecto: ocultos en este estado (hidden_in_states)
- Disparado por `projects.length === 0` (`ProjectsBoard.tsx:12-14`). No distingue "no hay proyectos" de "el filtro no matchea", y como el estado por defecto es `activo`, un sistema con proyectos —todos inactivos— muestra este mensaje al entrar [fuente: código-existente]

### loading
- Aplica: Sí
- Mensaje: `"Cagando..."`
- Cambios:
  - cargando-proyectos: solo visible en este estado (visible_only_in_states)
  - grilla-proyectos: oculta en este estado (hidden_in_states); la barra de filtros queda visible
- Disparado por el `<Suspense>` de la página mientras `ProjectsBoard` resuelve (`projects/page.tsx:30`) [fuente: código-existente]

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). La pantalla no tiene formulario.

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"Error"` + `error.message`
- Cambios:
  - pantalla-error: solo visible en este estado (visible_only_in_states); reemplaza el contenido de la ruta
  - **La sidebar queda montada** porque el boundary está dentro del grupo `(loggedin)`
- Disparado por una excepción no atrapada en el render del Server Component o de la Server Action (`projects/error.tsx:5-11`). Este boundary cubre también las subrutas `/projects/[id]`, `/projects/new` y `/projects/edit/[id]` [fuente: código-existente]

### success
- Aplica: No — no implementado (ver gaps-as-is.md). El toast lo dispara la pantalla de alta/edición antes de navegar (`projects/new/page.tsx:196`).

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). Un proyecto `finalizado` o `cancelado` se muestra igual que uno activo salvo el color del badge; no hay tratamiento visual de "cerrado" en la card (`ProjectCard.tsx:22-47`) [fuente: código-existente].

### loading en el refetch por filtro
- Aplica: No — no implementado (ver gaps-as-is.md). El `<Suspense>` **no lleva `key`**, así que al cambiar un filtro la grilla vieja queda en pantalla sin ningún indicador hasta que llega la nueva; otras pantallas del producto (`listado-tareas`, `listado-requisitos`) sí usan `key` (`projects/page.tsx:30` vs `objectives/page.tsx:34`) [fuente: código-existente].

## Interacciones

**Eventos:**
- buscador-proyecto · on change → debounce 500ms → `router.push('/projects?search=…')` · `ProjectListFilters.tsx:47-54`
- filtro-tipo · on change → `router.push` inmediato · `ProjectListFilters.tsx:84-86`
- filtro-estado · on change → `router.push` inmediato, con `all` → borra el parámetro · `ProjectListFilters.tsx:104-111`
- filtro-orden · on change → `router.push` inmediato · `ProjectListFilters.tsx:123-125`
- card-proyecto · on click → navega a `/projects/{id}` · `ProjectCard.tsx:22`
- card-proyecto · on hover → elevación (`hover-lift`) · `ProjectCard.module.scss`

[fuente: código-existente]

**Validaciones:**
- Ninguna: no hay inputs validados.

**Feedback:**
- Hover en la card: elevación y sombra
- Cambio de filtro: **sin indicador** (ver el estado `loading en el refetch por filtro`)

## Accesibilidad

- **Orden de foco:** boton-nuevo-proyecto (en el encabezado del shell) → buscador-proyecto → filtro-tipo → filtro-estado → filtro-orden → card-proyecto × N, en el orden de la grilla. Cada card es un `<Link>` entero, así que es enfocable y navegable por teclado (`ProjectCard.tsx:22`) [fuente: código-existente].
- **Landmarks y jerarquía:** el `<h1>` de la pantalla lo aporta el `titulo-pagina` de `PageLayout`, chrome compartido. Cada `nombre-proyecto` es un `<h2>`, así que la grilla se puede navegar por encabezados — pero **el `<h2>` está dentro del `<Link>`**, lo que anida un encabezado en contenido interactivo (`ProjectCard.tsx:39`). La grilla es un `<div>` con `display: grid`, sin `role="list"` ni conteo anunciado (`ProjectsBoard.tsx:11`) [fuente: código-existente].
- **Foco y teclado:** esta pantalla no dispara overlays con focus trap [fuente: código-existente].
- **Propio de esta composición:**
  - **El nombre accesible de cada card es todo el texto de la card** (fecha, estado, nombre, descripción, tags): un lector de pantalla lee el bloque completo como el nombre del enlace, y la fecha va primero (`ProjectCard.tsx:22-47`).
  - **El resultado del filtrado no se anuncia:** no hay `aria-live`, así que al filtrar no se anuncia el cambio ni la cantidad de resultados (`ProjectsBoard.tsx:11`).
  - La prioridad se muestra como número (0-5) sin explicación de la escala ni de si 0 es alta o baja (`ProjectPriorityTag.tsx:13`).
  [fuente: código-existente]

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
- **[REQ-013] La identidad cambia; la pantalla, no.** Esta ficha documenta *qué* hay en la pantalla y *para qué* está; el Manual de marca Jiku v1.0 cambia **con qué está construido**. El accent pasa del magenta `#DA2C6A` al verde agua `#61CCB9` sobre azul oscuro `#0B1934` con fondo niebla `#F6F6F9`, y Archivo se reemplaza por Sora (títulos de vista) + Gabarito (interfaz, datos, microcopy). Ningún bloque de esta pantalla se agrega, se elimina ni cambia de propósito por ese motivo [REQ-013 RF-1, RF-2, CA-1].
- **[REQ-013] Cada elemento hecho a mano pasa a su componente del Design System.** Los bloques que esta ficha declara —botones, campos, selects, tarjetas, tablas, badges— se implementan con los componentes normativos de `docs/design-system/web/components/`, no con marcado propio. Es un cambio de implementación con consecuencia visible —dejan de haber dos botones que se ven distinto haciendo lo mismo— pero **no cambia la estructura declarada acá**: un bloque que ya existía sigue existiendo, con el mismo tipo y el mismo propósito [REQ-013 RF-3, RF-4, CA-5, CA-10].
- **[REQ-013] Los estados declarados en esta ficha se conservan.** La migración es de presentación: ningún estado se agrega, se quita ni cambia su condición de disparo. Lo que cambia es cómo se ve cada uno —el loader es ahora uno solo, el vacío tiene componente `EmptyState` disponible— sin que la ficha declare estados nuevos. **Cablear `EmptyState` en las pantallas que hoy no tienen estado vacío queda fuera de este REQ** y sigue registrado en `gaps-as-is.md` [REQ-013 §Fuera de Alcance].
- **[REQ-013] `desktop` sigue siendo el viewport único.** El requerimiento **no** habilita mobile: el DS mantiene el responsive del shell como objetivo declarado sin fecha y no declara el viewport `mobile` hasta que el shell lo cumpla. El layout por viewport de esta ficha no cambia [REQ-013 §Fuera de Alcance, CA-15].
- **[REQ-013] El selector de tema vive en el shell, no en esta pantalla.** La superficie gana modo oscuro con un control para elegirlo, ubicado en el pie de la sidebar junto a Cerrar sesión. Como es parte del shell de `(loggedin)`, está presente acá pero **no se declara como bloque de esta ficha**: declararlo en las 21 pantallas autenticadas repetiría veintiuna veces el mismo control. En modo oscuro esta pantalla usa la paleta propia del DS —canvas `#0E121A`, superficies `#1B202C` separadas por contraste y sin borde—, no una inversión de la clara [REQ-013 RF-7, CA-11].
