---
document: UX Survey Screen
screen: tareas-por-proyecto
route: /objectives/by-project
service: web
source_files:
  - src/app/(loggedin)/objectives/by-project/page.tsx
  - src/app/(loggedin)/objectives/by-project/ScrollToProject.tsx
  - src/app/(loggedin)/objectives/by-project/loading.tsx
  - src/app/(loggedin)/objectives/by-project/error.tsx
  - src/features/projects/components/ProjectObjectives/ProjectObjectives.tsx
  - src/features/objectives/components/ObjectivesGroup/ObjectivesGroup.tsx
  - src/features/objectives/components/ObjectivesGroup/ObjectivesGroup.module.scss
  - src/features/objectives/components/ObjectiveCard/ObjectiveCard.tsx
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: tareas-por-proyecto

> **Relevamiento as-is** de `/objectives/by-project`, extraído de
> `src/app/(loggedin)/objectives/by-project/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md); el dropdown de estado de las cards, en
> [_overlays.md](./_overlays.md).

## Identidad

- **Ruta:** `/objectives/by-project`
- **Archivo:** `src/app/(loggedin)/objectives/by-project/page.tsx` (Server Component, 37 líneas)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** agrupa las tareas por proyecto, con las horas trabajadas del mes por
  proyecto, y hace scroll automático al proyecto indicado en el hash de la URL.
- **Viewports con tratamiento:** la grilla de cards se adapta por `auto-fit` y tiene un corte en
  `≥1680px`. Sin tratamiento mobile.

## Entrada y salida

**Entradas:**
- Subítem `"Por proyecto"` de la navegación · `Navbar.tsx:69`
- Botón `"Volver"` de `detalle-tarea`, **con el ancla `#project-{projectId}`** ·
  `objectives/[id]/page.tsx:21`

**Salidas:**
- `/objectives/{id}` · click en cualquier card · `ObjectiveCard.tsx:108`
- `/objectives/new?projectId={id}` · botón `+` del encabezado de cada grupo ·
  `ObjectivesGroup.tsx:74` (vía `buildHref()`)

**Redirects automáticos:**
- Ninguno.

> **El scroll al ancla es la razón de ser del `#project-{id}`** que pone `detalle-tarea`. Lo ejecuta
> `<ScrollToProject>`, un componente cliente que no renderiza nada.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | scroll-a-proyecto | — | — | — | `<ScrollToProject>` — **no renderiza nada** | `by-project/page.tsx:17`, `ScrollToProject.tsx:21` |
| 2 | grupo-proyecto | `section` | — | ambos | `<div id="project-{id}">` + `<ObjectivesGroup>` | `ProjectObjectives.tsx:27-28` |
| 3 | encabezado-grupo | `header` | — | ambos | `<div className={styles.titleContainer}>` | `ObjectivesGroup.tsx:63` |
| 4 | titulo-grupo | `heading` | h2 | ambos | `<h2 className={styles.title}>` con el nombre del proyecto | `ObjectivesGroup.tsx:62-64` |
| 5 | tag-horas-mes | `badge` | — | ambos | `<span className={styles.monthHoursTag}>` con icono | `ObjectivesGroup.tsx:67-69` |
| 6 | tooltip-horas-mes | `tooltip` | — | ambos | `<div className={styles.monthHoursTooltip}>` | `ObjectivesGroup.tsx:71` |
| 7 | boton-nueva-tarea-grupo | `button` | — | ambos | `<AddButton href={buildHref()}>` | `ObjectivesGroup.tsx:74` |
| 8 | grilla-tareas | `list` | — | ambos | `<div className={styles.containerObjectives}>` | `ObjectivesGroup.tsx:77` |
| 9 | card-tarea | `card` | por `data-state` de vencimiento | ambos | `<ObjectiveCard>` | `ObjectivesGroup.tsx:81` |
| 10 | icono-soy-responsable | `icon` | — | ambos | `<Image title="Soy parte de esta tarea">` | `ObjectiveCard.tsx:113-121` |
| 11 | pill-estado | `dropdown` | closed / open | ambos | `<StateTag>` | `ObjectiveCard.tsx:125-131` |
| 12 | tag-area-responsable | `badge` | por `data-area` | ambos | `<AreaTag>` | `ObjectiveCard.tsx:135-140` |
| 13 | horas-trabajadas | `paragraph` | caption | ambos | `<p className={styles.workedText}>` con icono | `ObjectiveCard.tsx:143-146` |
| 14 | tooltip-horas-por-persona | `tooltip` | — | ambos | `<div className={styles.workedTimesTooltip}>` | `ObjectiveCard.tsx:148-163` |
| 15 | etiqueta-fecha-creacion | `badge` | por `cardClass` | ambos | `<DateLabel label="Creación">` | `ObjectiveCard.tsx:168` |
| 16 | etiqueta-fecha-modificacion | `badge` | por `cardClass` | ambos | `<DateLabel label="Modificación">` | `ObjectiveCard.tsx:169` |
| 17 | etiqueta-fecha-cierre | `badge` | por estado de vencimiento | ambos | `<FinishDateLabel>` | `ObjectiveCard.tsx:170` |
| 18 | contenedor-portal | — | — | — | `<div ref={portalContainerRef}>` — destino del portal del date-picker de `FinishDateLabel` | `ObjectivesGroup.tsx:109`, `FinishDateLabel.tsx:174-191` |
| 18b | date-picker-cierre | `date-picker` | open | ambos | `<DatePicker inline>` montado por `ReactDOM.createPortal` | `FinishDateLabel.tsx:175-191` |
| 19 | cargando-vista | `loader` | — | ambos | `<Loader label="Cargando...">` | `by-project/loading.tsx:5` |
| 20 | pantalla-error | `alert` | error | ambos | `error.tsx` de la ruta | `by-project/error.tsx` |

> `grupo-proyecto` y `grilla-tareas` se relevaron como `section` y `list`: contenedores sin tipo
> propio en el diccionario.

> `scroll-a-proyecto` devuelve `null` y no es un bloque de UI. `contenedor-portal` es un `<div>`
> vacío, pero **sí tiene contenido en un estado**: es donde `FinishDateLabel` monta su date-picker por
> portal al hacer click en la etiqueta de fecha de cierre de una card. Ese overlay **no está en el
> inventario de [_overlays.md](./_overlays.md)** — es un séptimo dropdown del producto.

## Layout observado por viewport

### desktop · ≤1679px

- grupo-proyecto × N (pila vertical)
  - encabezado-grupo: titulo-grupo · tag-horas-mes · boton-nueva-tarea-grupo (fila)
  - grilla-tareas: card-tarea × N, columnas de **350px mínimo** con `auto-fit`
- contenedor-portal

**Origen:** `ObjectivesGroup.module.scss:88-89`:

```scss
.containerObjectives { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); }
```

**Las fracciones no son derivables:** la cantidad de columnas depende del ancho. Con el contenido a
~880px (viewport 1200px) entran 2 columnas; a 1440px entran 3.

### desktop grande · ≥1680px

Igual, pero la grilla se fija en **4 columnas de 3/12** cada una:

**Origen:** `ObjectivesGroup.module.scss:93-95`:

```scss
@media (min-width: 1680px) { grid-template-columns: repeat(4, 1fr); }
```

> **`1680px` no es ninguno de los breakpoints declarados** (`_mixins.scss` define 767/768/1024/1440).
> Es un valor único en el producto, y el único `min-width` de los 14 media queries: todos los demás son
> `max-width`.

> **Sin tratamiento mobile:** ni el encabezado de grupo ni la grilla cambian por debajo de 350px de
> columna, así que a anchos angostos la grilla queda en una columna por el `minmax` — pero el shell ya
> no es usable ahí (ver [_shell.md](./_shell.md)).

## Contenido

### titulo-grupo
- Texto/label: dinámico — el nombre del proyecto, vía la prop `title` de `<ObjectivesGroup>`
- Origen: `ProjectObjectives.tsx:30`, `by-project/page.tsx:27`

### tag-horas-mes
- Texto/label: dinámico — horas y minutos trabajados en el mes, calculados en la página:
  `Math.floor(monthWorkedMinutes / 60)` y `monthWorkedMinutes % 60` · `by-project/page.tsx:20-21`
- Origen: `ObjectivesGroup.tsx:67-69`
- Icono: `assets/schedule-icon.svg` con `alt=""` · `:68`
- Annotation: **solo se renderiza si `currentMonthHours` está definido** (`:65`). En
  `tareas-por-responsable`, que usa el mismo componente, no se pasa, así que el tag no aparece.

### tooltip-horas-mes
- Texto/label: `"Trabajadas en el mes"`
- Origen: `ObjectivesGroup.tsx:71`
- Annotation: es un `<div>` con clase, mostrado por CSS al hacer hover — **no usa el componente
  `<Tooltip>`**, sino un tooltip propio del módulo

### boton-nueva-tarea-grupo
- Texto/label: sin texto visible — es un `<AddButton>`
- Origen: `ObjectivesGroup.tsx:74`
- Annotation: el `href` lo arma `buildHref()`, que incluye `?projectId={id}` para precargar el
  proyecto en el alta

### card-tarea
- Título: dinámico desde `objective.title`
- Horas: `` `${hours} hora(s) ${worked}` `` donde `worked` es `"trabajada"` con 1 hora y
  `"trabajadas"` con otro número · `ObjectiveCard.tsx:22`
- Etiquetas de fecha: `"Creación"` y `"Modificación"` · `:168`, `:169`
- Icono de responsable: `title="Soy parte de esta tarea"` · `:119`
- Origen: `ObjectiveCard.tsx:108-185`

### estados de vencimiento de la card
`getCardClass()` devuelve uno de cinco valores, que van al atributo `data-state`
(`ObjectiveCard.tsx:86-105`):

| Valor | Cuándo |
|---|---|
| `finished` | la tarea está finalizada |
| `expiresToday` | vence hoy |
| `expired` | vencida |
| `closeToDeadline` | próxima al vencimiento |
| `default` | el resto |

### cargando-vista
- Texto/label: `"Cargando..."`
- Origen: `by-project/loading.tsx:5`

## Estados presentes

### default
- Disparado por: `getProjectsObjectivesSummary()` resuelve con al menos un proyecto
- Origen: `by-project/page.tsx:15-36`

### loading
- Mensaje: `"Cargando..."`
- Disparado por: el `loading.tsx` de la ruta mientras el Server Component resuelve
- Origen: `by-project/loading.tsx`
- Cambios: es todo lo que se ve; la sidebar queda

### error de sistema (render)
- Origen: `by-project/error.tsx`
- Annotation: **este boundary casi no se dispara**, porque el único trabajo de la página está
  envuelto en su propio `try/catch`. Ver estados ausentes.

### grupo sin tag de horas
- Disparado por: `typeof currentMonthHours === 'undefined'`
- Origen: `ObjectivesGroup.tsx:46`, `:65`
- Annotation: no ocurre en esta pantalla (la página siempre calcula las horas), sí en
  `tareas-por-responsable`

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error de la api** | **invisible.** La página envuelve la llamada en `try/catch` que hace `console.error` y deja `projectsList = []`. La pantalla renderiza **el título y nada más**: un fallo de la api es indistinguible de "no hay proyectos" | `by-project/page.tsx:9-13` |
| **empty** | **no existe.** `projectsList.map(...)` sobre un array vacío no renderiza nada y **no hay chequeo de largo**: queda el `<h1>Tareas por proyecto"` con el área de contenido en blanco, sin mensaje | `by-project/page.tsx:19` |
| **empty por grupo** | un proyecto sin tareas renderiza su encabezado y una grilla vacía, sin mensaje | `ObjectivesGroup.tsx:77-107` |
| error de validación | no aplica: la pantalla no tiene formulario | — |
| success | el cambio de estado inline de una card sí produce toast | `StateTag.tsx:59` |
| not found | no aplica: es una vista agregada | — |
| **estado terminal / readonly** | **no existe.** Una tarea finalizada tiene su propio `data-state` visual, pero el dropdown de estado ofrece las 5 opciones igual | `StateTag.tsx:21-25` |
| **paginación / límite** | **no existe.** Se renderizan **todos** los proyectos con **todas** sus tareas activas. Sin scroll virtual, sin "ver más", sin límite | `by-project/page.tsx:19`, `ObjectivesGroup.tsx:78` |
| **loading del cambio de estado** | la pill no se deshabilita ni muestra spinner | `StateTag.tsx:82-89` |
| **feedback del scroll al ancla** | el scroll ocurre tras un `setTimeout` de 100ms, sin indicación. Si el elemento no existe, no pasa nada y no hay aviso | `ScrollToProject.tsx:10-17` |

## Interacciones

**Eventos:**
- card-tarea · click → navega a `/objectives/{id}` · `ObjectiveCard.tsx:108`
- pill-estado · click → abre el dropdown; seleccionar → muta el estado ·
  `StateTag.tsx:74-78`, `:55-64`
- boton-nueva-tarea-grupo · click → navega a `/objectives/new?projectId={id}` ·
  `ObjectivesGroup.tsx:74`
- tag-horas-mes · hover → muestra `tooltip-horas-mes` · `ObjectivesGroup.module.scss`
- horas-trabajadas · hover → muestra `tooltip-horas-por-persona` con el desglose ·
  `ObjectiveCard.tsx:148-163`
- al montar · si `window.location.hash` tiene valor → busca el elemento por id y hace
  `scrollIntoView({ behavior: 'smooth', block: 'start' })` tras 100ms ·
  `ScrollToProject.tsx:5-19`

**Validaciones:**
- Ninguna.

**Feedback:**
- Scroll suave al proyecto del ancla
- Tooltips de horas
- Estado visual de vencimiento por `data-state` en la card
- Toast del cambio de estado

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Jerarquía de encabezados | `<h1>` del `PageLayout` y `<h2>` por grupo de proyecto. Correcto — **pero el `<h2>` contiene un `<div>` y un `<button>`** (`<AddButton>`), así que el nombre accesible del encabezado incluye el tag de horas y el `"add icon"` del botón | `by-project/page.tsx:16`, `ObjectivesGroup.tsx:62-76` |
| Card como link | La card entera es un `<Link>`: enfocable y navegable por teclado. Correcto | `ObjectiveCard.tsx:108` |
| Nombre accesible de la card | Es **todo el texto de la card** (estado, área, responsable, horas, tres fechas). Un lector lee el bloque completo como el nombre del enlace | `ObjectiveCard.tsx:108-185` |
| Icono de responsable | Usa `title="Soy parte de esta tarea"` como único texto. `title` es un fallback débil | `ObjectiveCard.tsx:119` |
| Iconos decorativos | `alt="responsable icon"`, `alt="schedule icon"`, `alt="question icon"`: **describen el icono, no su función**; siendo decorativos deberían ser `alt=""` | `ObjectiveCard.tsx:116`, `:143`, `:163` |
| Tooltip de horas del mes | Un `<div>` mostrado por CSS `:hover`, sin ARIA: inaccesible por teclado | `ObjectivesGroup.tsx:71` |
| Tooltip de horas por persona | Igual: `:hover` sin ARIA. El desglose por persona **no está disponible** de otra forma | `ObjectiveCard.tsx:148-163` |
| `pill-estado` dentro del link | El `<StateTag>` es un `<button>` **dentro** del `<Link>` de la card: contenido interactivo anidado, HTML inválido, y el comportamiento del teclado es ambiguo | `ObjectiveCard.tsx:108`, `:125` |
| Área solo por color | `<AreaTag>` renderiza el área como un `<span>` vacío con `data-area`. Ver [listado-tareas.md](./listado-tareas.md) | `AreaTag.tsx:32-34` |
| Semántica de la grilla | Un `<div>` con `display: grid`, sin `role="list"` ni conteo | `ObjectivesGroup.tsx:77` |
| Scroll automático | `scrollIntoView` sin mover el foco: un usuario de teclado queda con el foco donde estaba, y un lector de pantalla no anuncia el salto | `ScrollToProject.tsx:12-15` |
| **`boton-nueva-tarea-grupo` sin nombre accesible** | `<AddButton>` es un `<button>` cuyo único contenido es una `<Image alt="add icon">`. **No tiene `aria-label`**, así que su nombre accesible es `"add icon"`. El texto útil (`"Crear una nueva tarea asociada"`) está en el `title` de la imagen, que no lo suple | `AddButton.tsx:30-42` |
| Clases condicionales rotas en `AddButton` | `` className={`${disabled && styles.disabled} ${styles.primary}`} `` escribe `"false"` en el atributo `class` cuando no está deshabilitado | `AddButton.tsx:32` |
| `date-picker-cierre` | Se abre por click en un `<div onClick>` sin `role` ni `tabIndex`: **inalcanzable por teclado**. El `DatePicker` de `react-datepicker` sí es navegable una vez abierto | `FinishDateLabel.tsx:162-167` |

## Observaciones del relevamiento

- **No hay estado vacío ni de error.** El `try/catch` de `by-project/page.tsx:9-13` convierte
  cualquier fallo de la api en una pantalla con título y nada más, y el `.map()` sobre un array vacío
  hace lo mismo. **Un fallo de red, un sistema sin proyectos y un sistema sin tareas activas producen
  exactamente la misma pantalla en blanco.** Es el caso más crudo del gap más frecuente del producto.
- **No hay límite de volumen.** Se renderizan todos los proyectos con todas sus tareas. Es la única
  vista de listado del producto sin paginación ni "ver más" — `listado-actores` y `AttachmentsList` sí
  tienen "Ver más", y las tablas tienen paginación.
- **El breakpoint `1680px` es único en el producto**, y es el único `min-width` de los 14 media
  queries. No corresponde a ningún breakpoint declarado.
- **`<StateTag>` es un botón dentro de un link.** La card entera es un `<Link>` y el dropdown de
  estado vive adentro (`ObjectiveCard.tsx:108`, `:125`). Además de HTML inválido, significa que
  clickear la pill puede navegar en vez de abrir el dropdown, según cómo se propague el evento.
  `StateTag` hace `event.preventDefault()` en su handler (`StateTag.tsx:76`), lo que sugiere que el
  problema se detectó y se parcheó ahí.
- **Los tooltips de horas son un tercer mecanismo de tooltip** en el producto: además del componente
  `<Tooltip>` y del `title` nativo, acá hay dos tooltips propios en módulos SCSS
  (`ObjectivesGroup.module.scss` y `ObjectiveCard.module.scss`).
- **El desglose de horas por persona solo existe en un tooltip de `:hover`**
  (`ObjectiveCard.tsx:148-163`): el dato no está disponible de ninguna otra forma en esta pantalla.
- **El `<h2>` del grupo envuelve controles interactivos.** `ObjectivesGroup.tsx:62-76` mete dentro del
  encabezado un `<div>` contenedor, el tag de horas con su tooltip, y el `<AddButton>`. Un encabezado
  con un botón adentro es HTML válido pero hace que el nombre accesible del `<h2>` sea
  `"{proyecto} {horas} add icon"`.
- **El contenedor de portal existe para el date-picker de la fecha de cierre.** `FinishDateLabel`
  monta un `<DatePicker inline>` con `ReactDOM.createPortal` en ese `<div>`, posicionado en absoluto
  según el `getBoundingClientRect()` del contenedor (`FinishDateLabel.tsx:137`, `:174-191`). Es un
  séptimo mecanismo de overlay del producto, y **permite editar la fecha de cierre estimada
  directamente desde la card** — una acción de escritura que no está documentada en ninguna otra
  parte de la UI.
- **A confirmar en consolidación:** si esta vista necesita estado vacío y de error (el arreglo es
  chequear el largo del array), y si el volumen sin límite es viable con la cantidad real de proyectos.
