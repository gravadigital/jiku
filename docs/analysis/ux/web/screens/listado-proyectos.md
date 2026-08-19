---
document: UX Survey Screen
screen: listado-proyectos
route: /projects
service: web
source_files:
  - src/app/(loggedin)/projects/page.tsx
  - src/app/(loggedin)/projects/styles.module.scss
  - src/app/(loggedin)/projects/error.tsx
  - src/features/projects/components/ProjectListFilters/ProjectListFilters.tsx
  - src/features/projects/components/ProjectsBoard/ProjectsBoard.tsx
  - src/features/projects/components/ProjectCard/ProjectCard.tsx
  - src/features/projects/components/ProjectTypeTag/ProjectTypeTag.tsx
  - src/features/projects/components/ProjectPriorityTag/ProjectPriorityTag.tsx
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: listado-proyectos

> **Relevamiento as-is** de `/projects`, extraído de `src/app/(loggedin)/projects/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md).

## Identidad

- **Ruta:** `/projects`
- **Archivo:** `src/app/(loggedin)/projects/page.tsx` (Server Component, `dynamic = 'force-dynamic'`)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** grilla de cards de proyecto, filtrable por texto, tipo, estado y orden.
- **Viewports con tratamiento:** ninguno. La grilla se adapta por `auto-fill`, no por media query.

## Entrada y salida

**Entradas:**
- Ítem `"Proyectos"` de la navegación · `Navbar.tsx:54`
- Redirect desde `time-allocation`, `worked-times` y `worked-times/report` cuando el rol es
  `external-user` · `time-allocation/page.tsx:14`, `worked-times/page.tsx:14`,
  `worked-times/report/page.tsx:14`
- Vuelta desde `edicion-proyecto` tras guardar · `projects/edit/[id]/page.tsx:~272`

**Salidas:**
- `/projects/new` · botón `"Nuevo proyecto"` del encabezado · `projects/page.tsx:23`
- `/projects/{id}` · click en cualquier card · `ProjectCard.tsx:22`
- La propia ruta con otros `searchParams`, en cada cambio de filtro ·
  `ProjectListFilters.tsx:34`

**Redirects automáticos:**
- Ninguno propio.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | boton-nuevo-proyecto | `button` | primary | ambos | `<Button label="Nuevo proyecto" href="/projects/new">` | `projects/page.tsx:23` |
| 2 | barra-filtros | `section` | — | ambos | `<section>` en `<ProjectListFilters>` | `ProjectListFilters.tsx:57` |
| 3 | buscador-proyecto | `search-bar` | default | ambos | `<InputText label="Búsqueda">` | `ProjectListFilters.tsx:59-70` |
| 4 | filtro-tipo | `dropdown` | closed | ambos | `<InputSelect label="Tipo">` | `ProjectListFilters.tsx:73-87` |
| 5 | filtro-estado | `dropdown` | closed | ambos | `<InputSelect label="Estado">` | `ProjectListFilters.tsx:90-112` |
| 6 | filtro-orden | `dropdown` | closed | ambos | `<InputSelect label="Ordenar por">` | `ProjectListFilters.tsx:115-126` |
| 7 | grilla-proyectos | `list` | — | ambos | `<div className={styles.gridContainer}>` | `ProjectsBoard.tsx:11` |
| 8 | card-proyecto | `card` | — | ambos | `<ProjectCard>` | `ProjectsBoard.tsx:18` |
| 9 | fecha-proyecto | `paragraph` | caption | ambos | `<div className={styles.dateLabel}>` con icono de calendario | `ProjectCard.tsx:25-33` |
| 10 | badge-estado-proyecto | `badge` | por `data-status` | ambos | `<span className={styles.statusLabel}>` | `ProjectCard.tsx:36-38` |
| 11 | nombre-proyecto | `heading` | h2 | ambos | `<h2 className={styles.title}>{name}</h2>` | `ProjectCard.tsx:39` |
| 12 | descripcion-proyecto | `paragraph` | body | ambos | `<p className={styles.description}>` | `ProjectCard.tsx:40` |
| 13 | tag-tipo-proyecto | `badge` | por tipo | ambos | `<ProjectTypeTag>` → `<TagProject>` | `ProjectCard.tsx:43` |
| 14 | tag-prioridad-proyecto | `badge` | por prioridad 0-5 | ambos | `<ProjectPriorityTag>` → `<TagProject>` | `ProjectCard.tsx:44` |
| 15 | cargando-proyectos | `loader` | — | ambos | `<Loader label="Cagando...">` | `projects/page.tsx:30` |
| 16 | vacio-proyectos | `empty-state` | — | ambos | `<span className={styles.noProjects}>` | `ProjectsBoard.tsx:13` |
| 17 | pantalla-error | `alert` | error | ambos | `error.tsx` de la ruta: `<h1>Error</h1>` + `<p>{error.message}</p>` | `projects/error.tsx:6-11` |

> `barra-filtros` y `grilla-proyectos` se relevaron como `section` y `list`: contenedores sin tipo
> propio en el diccionario.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive por media query.

- boton-nuevo-proyecto (encabezado de `PageLayout`, a la derecha del título)
- row `filtros`
  - col 6/12: buscador-proyecto
  - col 2/12: filtro-tipo
  - col 2/12: filtro-estado
  - col 2/12: filtro-orden
- grilla-proyectos
  - card-proyecto × N, columnas de 300px mínimo con `auto-fill`

**Origen de las fracciones de los filtros:** `ProjectListFilters.module.scss:2-13`:

```scss
.filterSection { display: flex; gap: 1rem; flex-direction: row; flex-wrap: nowrap;
  & > div { width: calc(50% / 3); }
  & > div.search { width: 50%; }
}
```

El buscador ocupa `50%` (**6/12**) y los tres selects `50%/3` cada uno (**2/12**). A diferencia de
`listado-actores`, que usa `flex: 1` / `flex: 2`, acá los anchos son porcentajes explícitos con
`flex-wrap: nowrap`: **el `gap: 1rem` se suma por encima del 100%**, así que la fila desborda su
contenedor. Con `overflow-x: hidden` en el `body` (`globals.scss:172`) el desborde se recorta.

**Origen de la grilla:** `ProjectsBoard.module.scss:2-5` —
`grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`.

**Las fracciones de la grilla no son derivables:** la cantidad de columnas depende del ancho
disponible. Con el contenido a ~880px (1200px de viewport menos la sidebar de 290px y 2rem de padding
por lado) entran 2 columnas; a 1440px entran 3; a 1920px entran 5.

## Contenido

### boton-nuevo-proyecto
- Texto/label: `"Nuevo proyecto"`
- Origen: `projects/page.tsx:23` (hardcodeado)

### buscador-proyecto
- Texto/label: `"Búsqueda"` · placeholder `"Buscar proyecto"`
- Origen: `ProjectListFilters.tsx:60`, `:69`
- Annotation: debounce de **500 ms** antes de escribir en `searchParams`
  (`ProjectListFilters.tsx:47-54`). Valor inicial desde la URL.

### filtro-tipo
- Texto/label: `"Tipo"`
- Opciones verbatim: `"Todos"` (`all`) · `"Interno"` (`interno`) · `"Comercial"` (`comercial`) ·
  `"Investigación"` (`investigacion`) · `"Propuesta"` (`propuesta`)
- Origen: `ProjectListFilters.tsx:74`, `:78-83`

### filtro-estado
- Texto/label: `"Estado"`
- Opciones verbatim: `"Todos"` (`all`) · `"Activo"` (`activo`) · `"Análisis"` (`analisis`) ·
  `"Inactivo"` (`inactivo`) · `"Finalizado"` (`finalizado`) · `"Cancelado"` (`cancelado`)
- Origen: `ProjectListFilters.tsx:91`, `:95-101`
- Annotation: **el default es `activo`**, no "Todos" (`projects/page.tsx:19`,
  `ProjectListFilters.tsx:15`). Al entrar a la pantalla los proyectos inactivos, finalizados y
  cancelados **no se ven**, y el filtro no comunica que hay un recorte activo más allá de mostrar
  "Activo" seleccionado.

### filtro-orden
- Texto/label: `"Ordenar por"`
- Opciones verbatim: `"Más recientes"` (`-initDate`, default) · `"Más antiguos"` (`initDate`)
- Origen: `ProjectListFilters.tsx:116`, `:120-121`
- Annotation: solo dos opciones, ambas por fecha de inicio. No hay orden por nombre ni por prioridad.

### fecha-proyecto
- Texto/label: dinámico. Formato `"Aug 18 2026"` — `initDate.toUTCString().slice(4, 16)`. Con fecha
  de cierre válida se concatena `" - {endDate}"` en el mismo formato
- Origen: `ProjectCard.tsx:25-33`
- Icono: `assets/calendar…` con `alt="calendar icon"`
- Annotation: **el formato de fecha es el de `toUTCString()`, en inglés** (`"Aug"`, `"Sep"`), a
  diferencia del resto del producto que usa `toLocaleDateString('es-ES')` o `'es-AR'`. El `slice`
  posicional sobre el string de `toUTCString()` es frágil y depende del formato exacto de ese método

### badge-estado-proyecto
- Texto/label: dinámico desde `status`, pasado por `getProjectStatus` para la etiqueta legible
- Origen: `ProjectCard.tsx:36-38`
- Annotation: el color se aplica con el atributo `data-status`, que el SCSS mapea a
  `--color-status-*`. **Dos pares de estados comparten color:** `inactivo` y `backlog` son ambos
  `#5F6D7F`, y `analisis` y `en_revision` son ambos `#208CEF` (`_variables.scss:44-50`).

### nombre-proyecto
- Texto/label: dinámico desde `name` — no hay copy fijo
- Origen: `ProjectCard.tsx:39`
- Annotation: se renderiza como `<h2>`, así que la grilla **sí** es navegable por encabezados

### descripcion-proyecto
- Texto/label: dinámico desde `project.description` — no hay copy fijo
- Origen: `ProjectCard.tsx:40`
- Annotation: truncado a N líneas con `-webkit-line-clamp` (`ProjectCard.module.scss:105`). **Se
  renderiza como texto plano**, no como markdown, aunque el campo acepta markdown y el detalle sí lo
  renderiza: en la card se ven los asteriscos y los `#` literales.

### tag-tipo-proyecto
- Texto/label: dinámico — **el valor crudo de la api**, no una etiqueta traducida
- Origen: `ProjectTypeTag.tsx:18` — `<TagProject … text={value} />`
- Annotation: muestra `investigacion` sin tilde y en minúscula, mientras el filtro de la misma
  pantalla ofrece `"Investigación"`. Ver Observaciones.

### tag-prioridad-proyecto
- Texto/label: dinámico desde `priority` (0-5)
- Origen: `ProjectPriorityTag.tsx:13`
- Annotation: color por `--color-priority-0..5`, gradiente amarillo → rojo

### cargando-proyectos
- Texto/label: `"Cagando..."`
- Origen: `projects/page.tsx:30`
- Annotation: **typo.** Falta la `r` de "Cargando". Copiado verbatim.

### vacio-proyectos
- Texto/label: `"No hay proyectos que coincidan con estos filtros."`
- Origen: `ProjectsBoard.tsx:13`

### pantalla-error
- Texto/label: `"Error"` como título y `error.message` dinámico como cuerpo
- Origen: `projects/error.tsx:8-9`

## Estados presentes

### default
- Disparado por: la Server Action devuelve al menos un proyecto
- Origen: `ProjectsBoard.tsx:11-24`

### loading
- Mensaje: `"Cagando..."`
- Disparado por: el `<Suspense>` de la página mientras `ProjectsBoard` resuelve
- Origen: `projects/page.tsx:30`
- Cambios: reemplaza la grilla; la barra de filtros queda visible

### empty
- Mensaje: `"No hay proyectos que coincidan con estos filtros."`
- Disparado por: `projects.length === 0`
- Origen: `ProjectsBoard.tsx:12-14`
- Cambios: reemplaza la grilla por el texto

> No distingue "no hay proyectos" de "el filtro no matchea". Y como el estado por defecto es
> `activo`, un sistema con proyectos —todos inactivos— muestra este mensaje al entrar.

### error de sistema (render de servidor)
- Mensaje: `"Error"` + `error.message`
- Disparado por: excepción no atrapada en el render del Server Component o de la Server Action
- Origen: `projects/error.tsx:5-11`
- Cambios: reemplaza el contenido de la ruta. **La sidebar queda montada** porque el boundary está
  dentro del grupo `(loggedin)`.

> **Esta pantalla es una de las cinco que tienen `error.tsx`**, y su boundary cubre también las
> subrutas `/projects/[id]`, `/projects/new` y `/projects/edit/[id]`.

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| empty de primer uso | no diferenciado del empty por filtros. Agravado porque el filtro por defecto es `activo` | `ProjectsBoard.tsx:13`, `projects/page.tsx:19` |
| error de validación | no aplica: la pantalla no tiene formulario | — |
| success | no aplica acá; el toast lo dispara la pantalla de alta/edición antes de navegar | `projects/new/page.tsx:196` |
| not found | no aplica: es un listado | — |
| estado terminal / readonly | **no existe.** Un proyecto `finalizado` o `cancelado` se muestra igual que uno activo salvo el color del badge. No hay tratamiento visual de "cerrado" en la card | `ProjectCard.tsx:22-47` |
| loading en el refetch por filtro | **el `<Suspense>` no lleva `key`**, así que al cambiar un filtro la grilla vieja queda en pantalla sin ningún indicador hasta que llega la nueva. Otras pantallas del producto (`listado-tareas`, `listado-requisitos`) sí usan `key` | `projects/page.tsx:30` vs `objectives/page.tsx:34` |
| **reset de paginación al filtrar** | no aplica directamente (esta pantalla no pagina) pero `ProjectListFilters` tampoco resetea `page`, así que el parámetro sobrevive si vino de otra navegación | `ProjectListFilters.tsx:21-34` |

## Interacciones

**Eventos:**
- buscador-proyecto · on change → debounce 500ms → `router.push('/projects?search=…')` ·
  `ProjectListFilters.tsx:47-54`
- filtro-tipo · on change → `router.push` inmediato · `ProjectListFilters.tsx:84-86`
- filtro-estado · on change → `router.push` inmediato, con `all` → borra el parámetro ·
  `ProjectListFilters.tsx:104-111`
- filtro-orden · on change → `router.push` inmediato · `ProjectListFilters.tsx:123-125`
- card-proyecto · click → navega a `/projects/{id}` · `ProjectCard.tsx:22`
- card-proyecto · hover → elevación (`hover-lift`) · `ProjectCard.module.scss`

**Validaciones:**
- Ninguna: no hay inputs validados.

**Feedback:**
- Hover en la card: elevación y sombra
- Cambio de filtro: **sin indicador** (ver estados ausentes)

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Alt en imágenes | El icono de calendario tiene `alt="calendar icon"` — describe el icono, no su función; siendo decorativo debería ser `alt=""` | `ProjectCard.tsx:26` |
| Alt del icono de tipo | `alt="project type"` — mismo problema | `ProjectTypeTag.tsx:18` |
| Card como link | Correcto: la card entera es un `<Link>`, así que es enfocable y navegable por teclado | `ProjectCard.tsx:22` |
| Nombre accesible de la card | **el nombre accesible del link es todo el texto de la card** (fecha, estado, nombre, descripción, tags). Un lector de pantalla lee el bloque completo como el nombre del enlace, y la fecha va primero | `ProjectCard.tsx:22-47` |
| Jerarquía de encabezados | Presente: el nombre va en `<h2>`, así que la grilla se puede navegar por encabezados. Pero el `<h2>` está **dentro** del `<Link>`, lo que anida un encabezado en contenido interactivo | `ProjectCard.tsx:39` |
| Semántica de la grilla | Es un `<div>` con `display: grid`, sin `role="list"` ni conteo anunciado | `ProjectsBoard.tsx:11` |
| Labels de los filtros | Presentes vía la prop `label` | `ProjectListFilters.tsx:60,74,91,116` |
| Anuncio del resultado del filtrado | **ausente:** sin `aria-live`. Al filtrar no se anuncia el cambio ni la cantidad de resultados | `ProjectsBoard.tsx:11` |
| Estado del proyecto anunciado | El badge es texto, así que se lee. El color es redundante con el texto, lo cual es correcto | `ProjectCard.tsx:36-38` |
| Prioridad anunciada | Se muestra como número (0-5) sin explicación de la escala ni de si 0 es alta o baja | `ProjectPriorityTag.tsx:13` |

## Observaciones del relevamiento

- **Los tags muestran el valor crudo de la api.** `ProjectTypeTag` pasa `text={value}`
  (`ProjectTypeTag.tsx:18`), así que en la card se lee `investigacion` mientras el filtro de la misma
  pantalla dice `"Investigación"`. Hay un `getProjectStatus` en `shared/utils` para el estado, pero
  no existe el equivalente para tipo. **Inconsistencia dentro de una sola pantalla.**
- **La descripción se muestra como texto plano.** El campo acepta markdown (el detalle lo renderiza
  con `MarkdownViewer`) pero la card usa `<p>{description}</p>`, así que los asteriscos y almohadillas
  se ven literales y truncados.
- **La fila de filtros desborda su contenedor.** Los anchos son `50% + 3 × (50%/3) = 100%` más
  `gap: 1rem` × 3 con `flex-wrap: nowrap`. En `listado-actores` el mismo patrón está resuelto con
  `flex: 1`/`flex: 2`, que sí reparte el espacio restante. **Dos implementaciones del mismo bloque
  con distinta corrección.**
- **El typo `"Cagando..."`** (`projects/page.tsx:30`) se copia verbatim.
- **El default `state: 'activo'` está duplicado** en `projects/page.tsx:19` y
  `ProjectListFilters.tsx:15`. Si uno cambia y el otro no, la URL y el control se desincronizan.
- **`filtro-estado` tiene código muerto.** El handler construye un `URLSearchParams`, hace
  `params.delete` / `params.set`, y **descarta el resultado**: la línea que efectivamente navega es
  el `changeFilter` posterior (`ProjectListFilters.tsx:104-111`). Las tres líneas del medio no tienen
  efecto.
- **No se pudo determinar** qué formato tiene `fecha-proyecto` sin leer el SCSS y el helper: el JSX
  compone dos valores dentro de un `<span>` (`ProjectCard.tsx:27-32`).
- **A confirmar en consolidación:** si el default `activo` es el correcto para la pantalla de entrada
  al dominio, si la escala de prioridad 0-5 necesita leyenda, y si los tags deberían mostrar
  etiquetas traducidas.
