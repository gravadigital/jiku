---
document: UX Survey Screen
screen: listado-requisitos
route: /requirements
service: web
source_files:
  - src/app/(loggedin)/requirements/page.tsx
  - src/app/(loggedin)/requirements/requirements.module.scss
  - src/features/requirements/components/RequirementList/RequirementList.tsx
  - src/features/requirements/components/RequirementList/RequirementList.module.scss
  - src/features/requirements/components/RequirementFilters/RequirementFilters.tsx
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: listado-requisitos

> **Relevamiento as-is** de `/requirements`, extraído de
> `src/app/(loggedin)/requirements/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md).

## Identidad

- **Ruta:** `/requirements`
- **Archivo:** `src/app/(loggedin)/requirements/page.tsx` (Server Component,
  `dynamic = 'force-dynamic'`)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** tabla paginada de requisitos, filtrable por texto, estado, proyecto y
  orden.
- **Viewports con tratamiento:** ninguno. La tabla usa anchos de columna en porcentaje, sin media
  query.

## Entrada y salida

**Entradas:**
- Ítem `"Requisitos"` de la navegación · `Navbar.tsx:59`
- Link `"Volver"` del detalle de requisito · `RequirementHeader.tsx:207-209`
- Redirect tras crear un requisito · `CreateRequirementForm.tsx:345`

**Salidas:**
- `/requirements/new` · botón `"Nuevo requisito"` del encabezado · `requirements/page.tsx:35`
- `/requirements/{id}` · click en una fila de la tabla · `RequirementList.tsx:~147`
- La propia ruta con otros `searchParams`, en cada cambio de filtro o de página ·
  `RequirementList.tsx:88`, `:98`, `:108`

**Redirects automáticos:**
- Ninguno.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | boton-nuevo-requisito | `button` | primary | ambos | `<Button label="Nuevo requisito" href="/requirements/new">` envuelto en un `<div>` | `requirements/page.tsx:34-36` |
| 2 | barra-filtros | `section` | — | ambos | `<div className={styles.filterSection}>` | `RequirementFilters.tsx:129` |
| 3 | buscador-requisito | `search-bar` | default | ambos | `<input type="text">` nativo | `RequirementFilters.tsx:132-138` |
| 4 | filtro-estado | `dropdown` | closed / open | ambos | `<ReactSelect>` | `RequirementFilters.tsx:142-149` |
| 5 | filtro-proyecto | `dropdown` | closed / open | ambos | `<ReactSelect>` | `RequirementFilters.tsx:153-162` |
| 6 | filtro-orden | `dropdown` | closed / open | ambos | `<ReactSelect>` | `RequirementFilters.tsx:166-174` |
| 7 | tarjeta-tabla | `card` | — | ambos | `<div className={styles.tableCard}>` | `RequirementList.tsx:117` |
| 8 | tabla-requisitos | `table` | — | ambos | `<table className={styles.table}>` | `RequirementList.tsx:118` |
| 9 | pill-estado | `badge` | por `data-state` | ambos | `<span className={styles.sTag}>` con un `<span className={styles.dot}>` | `RequirementList.tsx:175-178` |
| 10 | pill-tipo | `badge` | por `data-type` | ambos | `<span className={styles.pill}>` | `RequirementList.tsx:181-183` |
| 11 | pill-prioridad | `badge` | por `data-priority` | ambos | `<span className={styles.pill}>` | `RequirementList.tsx:186-188` |
| 12 | paginacion | `pagination` | — | ambos | `<div className={styles.pagination}>` — reimplementada inline | `RequirementList.tsx:196-247` |
| 13 | selector-tamano-pagina | `dropdown` | closed | ambos | `<select>` nativo | `RequirementList.tsx:238-245` |
| 14 | cargando-requisitos | `loader` | — | ambos | `<Loader label="Cargando...">` como fallback de `<Suspense>` | `requirements/page.tsx:39` |
| 15 | cargando-tabla | `paragraph` | body | ambos | `<td colSpan={8}>Cargando requisitos...</td>` | `RequirementList.tsx:132-137` |
| 16 | vacio-requisitos | `empty-state` | — | ambos | `<td colSpan={8}>No se encontraron requisitos</td>` | `RequirementList.tsx:138-143` |

> `barra-filtros` se relevó como `section`. **Es un `<div>`, no un `<section>`**, a diferencia de
> `ClientListFilters` y `ProjectListFilters`, que sí usan `<section>`.

> **`boton-nuevo-requisito` va envuelto en un `<div>` con overrides `!important`** para forzar su
> tamaño (`requirements.module.scss:1-5`). Es el único caso del producto donde se pisa el estilo de
> `<Button>` desde afuera.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- boton-nuevo-requisito (encabezado de `PageLayout`, a la derecha del título)
- row `filtros` (`flex-wrap: nowrap`, `align-items: flex-end`)
  - col ~6/12: buscador-requisito (`flex: 2`)
  - col ~2.4/12: filtro-estado (`flex: 1.6`)
  - col ~1.8/12: filtro-proyecto (`flex: 1.2`)
  - col ~1.5/12: filtro-orden (`flex: 1`)
- tarjeta-tabla
  - tabla-requisitos (8 columnas con anchos en porcentaje)
  - paginacion + selector-tamano-pagina

**Origen de las fracciones de los filtros:** estilos inline en el JSX, no en el módulo:

```tsx
<div className={styles.filterField} style={{ flex: 2 }}>    // búsqueda
<div className={styles.filterField} style={{ flex: 1.6 }}>  // estado
<div className={styles.filterField} style={{ flex: 1.2 }}>  // proyecto
<div className={styles.filterField} style={{ flex: 1 }}>    // orden
```
`RequirementFilters.tsx:130`, `:140`, `:151`, `:164`

Pesos 2 + 1.6 + 1.2 + 1 = 5.8 → **4.1/12 + 3.3/12 + 2.5/12 + 2.1/12**. Los pesos van **inline**, no
en el SCSS: es el tercer mecanismo de reparto de la barra de filtros en el producto (`flex` en el
módulo en actores, `width: calc()` en proyectos, `flex` inline acá).

**Origen de los anchos de la tabla:** `RequirementList.module.scss:36-52` — `4%` (ID), `11%`
(Proyecto), `42%` (Título), `11%` (Responsable) y `8%` para las cuatro columnas compactas.
`4 + 11 + 42 + 11 + 8×4 = 100%`. En doceavos: **0.5/12 + 1.3/12 + 5/12 + 1.3/12 + ~1/12 cada
compacta**.

> Con `overflow-x: hidden` en el `body` (`globals.scss:172`) y 8 columnas de ancho fijo en
> porcentaje, a anchos angostos las celdas se comprimen sin scroll horizontal. `td` global tiene
> `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` (`globals.scss:180-186`), así que
> el contenido se recorta con puntos suspensivos.

## Contenido

### boton-nuevo-requisito
- Texto/label: `"Nuevo requisito"`
- Origen: `requirements/page.tsx:35`

### buscador-requisito
- Texto/label: `"Búsqueda"` · placeholder `"Buscar requisito"`
- Origen: `RequirementFilters.tsx:131`, `:135`
- Annotation: debounce antes de propagar el cambio (`:113`, `:117-119`). Es un `<input>` nativo con
  `<label className={styles.fLabel}>`, **sin `htmlFor`** — ver Accesibilidad.

### filtro-estado
- Texto/label: `"Estado"`
- Opciones verbatim: `"Todos los estados"` (`''`) · `"Análisis"` · `"Planificación"` ·
  `"En cola"` · `"Desarrollo"` · `"Revisión"` · `"Resuelto"` · `"Cancelado"`
- Origen: `RequirementFilters.tsx:141`, `:21-28`
- Annotation: el sentinel de "sin filtro" acá es `''`, no `'all'` como en actores y proyectos

### filtro-proyecto
- Texto/label: `"Proyecto"`
- Opciones: `"Todos los proyectos"` (`''`) + los proyectos en estado `analisis` o `activo`
- Origen: `RequirementFilters.tsx:152`, `:122-127`, `:104`
- Annotation: **la lista de proyectos excluye los inactivos, finalizados y cancelados**
  (`useProjects({ filters: { state: 'analisis,activo' } })`). Un requisito de un proyecto finalizado
  no se puede filtrar por su proyecto.

### filtro-orden
- Texto/label: `"Ordenar por"`
- Opciones verbatim: `"Más recientes"` (`recent`, default) · `"Más antiguos"` (`oldest`) ·
  `"Prioridad"` (`priority`)
- Origen: `RequirementFilters.tsx:165`, `:32-34`

### tabla-requisitos
- Columnas verbatim: `"ID"` · `"Proyecto"` · `"Título"` · `"Responsable"` · `"Estado"` · `"Tipo"` ·
  `"Prioridad"` · `"Creación"`
- Origen: `RequirementList.tsx:121-128`
- Etiquetas de estado: `"Análisis"` · `"Planificación"` · `"En cola"` · `"Desarrollo"` ·
  `"Revisión"` · `"Resuelto"` · `"Cancelado"` · `:21-29`
- Etiquetas de prioridad: `"Sin prioridad"` · `"Baja"` · `"Media"` · `"Alta"` · `"Urgente"` ·
  `:31-37`
- Responsable vacío: `"Sin asignar"` · `:56`
- Proyecto vacío: `"—"` (guion largo) · `:153`
- Formato de fecha: `DD/MM/YYYY` vía `labelFromDate` · `:41`

> **El responsable se resume:** con más de uno muestra el primero y un `+N`, con la lista completa en
> el atributo `title` (`:55-70`, `:163-172`). El líder se prioriza sobre el resto.

### paginacion
- Textos verbatim: `aria-label="Página anterior"` y `"Página siguiente"` en las flechas
- Origen: `RequirementList.tsx:202`, `:232`
- Opciones del selector de tamaño: `"15 por página"` · `"20 por página"` · `"25 por página"` ·
  `:242-244`
- Annotation: default 15 (`requirements/page.tsx:26`)

### cargando-requisitos / cargando-tabla
- Textos verbatim: `"Cargando..."` (fallback del `Suspense`) y `"Cargando requisitos..."` (dentro de
  la tabla)
- Origen: `requirements/page.tsx:39`, `RequirementList.tsx:135`

### vacio-requisitos
- Texto/label: `"No se encontraron requisitos"`
- Origen: `RequirementList.tsx:141`

## Estados presentes

### default
- Disparado por: query resuelta con al menos un requisito
- Origen: `RequirementList.tsx:145-193`

### loading (dos niveles)
- Mensajes: `"Cargando..."` en el primer render, `"Cargando requisitos..."` en los refetch
- Disparado por: el `<Suspense key={JSON.stringify(filters)}>` y `isLoading` de `useRequirements`
- Origen: `requirements/page.tsx:39`, `RequirementList.tsx:132-137`
- Cambios: el `Suspense` reemplaza toda la tabla y los filtros; el `isLoading` reemplaza solo el
  cuerpo de la tabla

> **Esta pantalla sí usa `key` en el `<Suspense>`** (`requirements/page.tsx:39`), así que al cambiar
> un filtro el fallback vuelve a aparecer. `listado-proyectos` no lo hace.

### empty
- Mensaje: `"No se encontraron requisitos"`
- Disparado por: `requirements.length === 0`
- Origen: `RequirementList.tsx:138-143`
- Cambios: una fila con `colSpan={8}`; los encabezados de la tabla quedan visibles

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error de sistema / sin conexión** | **no se maneja.** `useRequirements` se desestructura como `{ data: requirements = [], isLoading }`: `isError` se ignora y el default `[]` hace que un fallo se vea como `"No se encontraron requisitos"` | `RequirementList.tsx:74`, `:138-143` |
| **`error.tsx` de la ruta** | **no existe.** Una excepción en el render del Server Component cae en la pantalla de error por defecto de Next, sin sidebar. Comparar con `/projects` y `/objectives`, que sí tienen boundary | no existe `app/(loggedin)/requirements/error.tsx` |
| empty de primer uso | no diferenciado del empty por filtros | `RequirementList.tsx:141` |
| error de validación | no aplica: la pantalla no tiene formulario | — |
| success | no aplica acá; el toast lo dispara `alta-requisito` antes de navegar | `CreateRequirementForm.tsx:344` |
| not found | no aplica: es un listado | — |
| **estado terminal / readonly** | **no existe.** Un requisito `resuelto` o `cancelado` se muestra igual que uno en curso, salvo el color del pill | `RequirementList.tsx:145-193` |
| **última página conocida** | **la paginación no sabe el total.** El botón "siguiente" se habilita comparando `requirements.length >= limit` (`:218`, `:231`), o sea "vino una página llena, asumo que hay más". Con un total múltiplo exacto del límite, se puede navegar a una página vacía. Y **no hay número total de páginas ni de resultados** en ningún lado | `RequirementList.tsx:215-233` |

## Interacciones

**Eventos:**
- buscador-requisito · on change → debounce → `onChange('search', value)` → `router.push` ·
  `RequirementFilters.tsx:113`, `:117-119`
- filtro-estado / filtro-proyecto / filtro-orden · on change → `onChange(campo, valor)` inmediato ·
  `RequirementFilters.tsx:147`, `:161`, `:173`
- `updateFilter` → borra `page` y hace `router.push` · `RequirementList.tsx:82-89`
- fila de la tabla · click → navega a `/requirements/{id}` · `RequirementList.tsx:~147`
- flecha de página · click → `params.set('page', ...)` + `router.push` ·
  `RequirementList.tsx:93-99`
- selector-tamano-pagina · on change → setea `limit` y **resetea `page` a 1** ·
  `RequirementList.tsx:102-109`

**Validaciones:**
- Ninguna: no hay inputs validados.

**Feedback:**
- Cambio de filtro: el `<Suspense key>` remonta y muestra el fallback
- Página activa: `data-active="true"` + `aria-current="page"` · `RequirementList.tsx:215`
- Responsables múltiples: `title` con la lista completa

> **`updateFilter` sí borra la página al filtrar** (`RequirementList.tsx:87`), a diferencia de
> `ClientListFilters` y `ProjectListFilters`, que no lo hacen. Es el manejo correcto del producto.

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Labels de los filtros | Son `<label className={styles.fLabel}>` **sin `htmlFor`** y sin envolver al control: **no están asociados a ningún input**. Un lector de pantalla lee el input sin nombre | `RequirementFilters.tsx:131`, `:141`, `:152`, `:165` |
| `aria-label` de respaldo | `filtro-proyecto` del reporte sí lo tiene, pero **acá ninguno de los cuatro controles tiene `aria-label`** | `RequirementFilters.tsx:132-174` |
| `react-select` con `inputId` | Presente (`filter-state`, `filter-project`, `filter-sort`), pero **ningún `<label>` los referencia** | `RequirementFilters.tsx:143`, `:154`, `:167` |
| Encabezados de tabla | `<th>` correctos, con `<thead>` | `RequirementList.tsx:119-129` |
| Filas clickeables | `<tr onClick>` **sin `role`, sin `tabIndex`, sin handler de teclado**: la tabla no es navegable por teclado | `RequirementList.tsx:~147` |
| Paginación | Es un `<div>`, **no un `<nav>`** y sin `aria-label`. Las flechas sí tienen `aria-label`, y la página activa `aria-current="page"` | `RequirementList.tsx:196`, `:202`, `:215`, `:232` |
| Selector de tamaño | `aria-label="Elementos por página"` presente | `RequirementList.tsx:240` |
| Estado y prioridad | Son texto dentro de los pills, así que se leen. El color es redundante. Correcto | `RequirementList.tsx:175-188` |
| Punto de color del estado | `<span className={styles.dot}>` vacío, **sin `aria-hidden`** | `RequirementList.tsx:176` |
| Responsables `+N` | La lista completa va en `title`, que es un fallback débil: no aparece con el foco por teclado ni lo anuncian todos los lectores | `RequirementList.tsx:166` |
| Anuncio del resultado del filtrado | **ausente:** sin `aria-live` | `RequirementList.tsx:114` |
| Total de resultados | **no existe en la UI**, así que tampoco hay nada que anunciar | `RequirementList.tsx:196-247` |

## Observaciones del relevamiento

- **Los labels de los filtros no están asociados a sus controles.** Son `<label>` sueltos sin
  `htmlFor` y sin envolver el input (`RequirementFilters.tsx:131-174`). Es el problema de
  accesibilidad más concreto de la pantalla, y contrasta con `ClientListFilters` /
  `ProjectListFilters`, que usan los componentes `Input*` compartidos y sí asocian.
- **Tercer mecanismo de reparto de la barra de filtros.** Actores usa `flex` en el SCSS, proyectos
  `width: calc()`, y acá `style={{ flex: N }}` inline. Tres implementaciones del mismo bloque.
- **La paginación no conoce el total.** El "siguiente" se infiere de `length >= limit`. No hay
  cantidad de resultados ni de páginas. Comparar con `listado-tareas`, que sí trae un conteo aparte
  (`&count=true`) y usa `<Pagination totalItems limit>`.
- **El sentinel de "sin filtro" es `''` acá y `'all'` en los otros dos listados.** Dos convenciones
  para lo mismo dentro del producto.
- **El filtro de proyecto excluye proyectos no activos.** Un requisito de un proyecto finalizado
  aparece en la tabla pero no se puede filtrar por su proyecto.
- **Los mapas `STATE_LABELS` y `PRIORITY_LABELS` están redeclarados acá** (`:21-37`), y son dos de
  las cinco copias del producto (`RequirementHeader`, `RequirementStatusCard`,
  `RequirementActivityFeed`, `ProjectRequirementsSection`).
- **`requirements.module.scss` existe para un solo override con `!important`** de tres propiedades
  del `<Button>` (`:1-5`). Es la señal de que `<Button>` no tiene una variante del tamaño que esta
  pantalla necesita.
- **Es la única ruta de listado del producto sin `error.tsx`.** `/projects` y `/objectives` tienen
  boundary; `/clients` y `/requirements` no.
- **No se pudo determinar** cómo se ordena por `"Prioridad"`: el valor `priority` se manda a la api y
  el orden lo resuelve ella. **A verificar contra `api`** si `sin_prioridad` va primero o último.
- **A confirmar en consolidación:** si hace falta mostrar el total de resultados, y si la tabla debe
  ser navegable por teclado (afecta a las 6 tablas clickeables del producto).
