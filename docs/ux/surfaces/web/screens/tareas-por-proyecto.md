---
name: tareas-por-proyecto
surface: web
route: /objectives/by-project
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Tareas por proyecto

## Identidad

- **Audiencia primaria:** equipo-interno.
- **JTBD / Propósito:** ver las tareas agrupadas por proyecto, con las horas trabajadas del mes por proyecto, y saltar automáticamente al proyecto indicado en el hash de la URL [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport de la superficie. La grilla de cards se adapta por `auto-fit` con columnas de 350px mínimo y se fija en 4 columnas a partir de 1680px (`ObjectivesGroup.module.scss:88-89`, `:93-95`) [fuente: código-existente].
  - Mobile queda fuera de la superficie `web`: el shell tiene una sidebar de 290px fija sin ninguna media query, así que por debajo de ese ancho no hay navegación disponible (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente]. La pantalla tampoco declara tratamiento mobile propio: ni el encabezado de grupo ni la grilla cambian por debajo de 350px de columna.
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Desde la navegación del shell · subítem `"Por proyecto"` (`Navbar.tsx:69`)
- Desde detalle-tarea · botón `"Volver"`, con el ancla `#project-{projectId}` (`objectives/[id]/page.tsx:21`)

**Salidas user-driven:**
- A `/objectives/{id}` · click en cualquier card-tarea (`ObjectiveCard.tsx:108`)
- A `/objectives/new?projectId={id}` · click en boton-nueva-tarea-grupo (`ObjectivesGroup.tsx:74`, vía `buildHref()`)

**Salidas automáticas:**
- Ninguna.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | scroll-a-proyecto | — | — | layout | desktop | — | Componente cliente que no renderiza nada; hace el scroll al ancla |
| 2 | grupo-proyecto | section | — | layout | desktop | — | Agrupa las tareas de un proyecto |
| 3 | encabezado-grupo | header | — | layout | desktop | — | Título, horas y acción del grupo |
| 4 | titulo-grupo | heading | h2 | content | desktop | — | Nombre del proyecto |
| 5 | tag-horas-mes | badge | — | content | desktop | visible_only_in_states: con `currentMonthHours` definido | Horas trabajadas en el mes |
| 6 | tooltip-horas-mes | tooltip | — | feedback | desktop | visible_only_in_states: hover sobre tag-horas-mes | Explica el dato de horas |
| 7 | boton-nueva-tarea-grupo | button | — | input | desktop | — | Alta de tarea precargada con el proyecto |
| 8 | grilla-tareas | list | — | layout | desktop | — | Cards de las tareas del grupo |
| 9 | card-tarea | card | por `data-state` de vencimiento | navigation | desktop | — | Una tarea, navega al detalle |
| 10 | icono-soy-responsable | icon | — | content | desktop | visible_only_in_states: soy responsable de la tarea | Marca la propia participación |
| 11 | pill-estado | dropdown | closed / open | input | desktop | — | Cambia el estado inline |
| 12 | tag-area-responsable | badge | por `data-area` | content | desktop | — | Área (color) y responsable |
| 13 | horas-trabajadas | paragraph | caption | content | desktop | — | Horas de la tarea |
| 14 | tooltip-horas-por-persona | tooltip | — | feedback | desktop | visible_only_in_states: hover sobre horas-trabajadas | Desglose de horas por persona |
| 15 | etiqueta-fecha-creacion | badge | por `cardClass` | content | desktop | — | Fecha de creación |
| 16 | etiqueta-fecha-modificacion | badge | por `cardClass` | content | desktop | — | Fecha de modificación |
| 17 | etiqueta-fecha-cierre | badge | por estado de vencimiento | input | desktop | — | Fecha de cierre estimada, editable |
| 18 | contenedor-portal | — | — | layout | desktop | — | Destino del portal del date-picker |
| 19 | date-picker-cierre | date-picker | open | input | desktop | visible_only_in_states: date-picker abierto | Edita la fecha de cierre desde la card |
| 20 | cargando-vista | loader | — | feedback | desktop | visible_only_in_states: loading | `loading.tsx` de la ruta |
| 21 | pantalla-error | alert | error | feedback | desktop | visible_only_in_states: error de sistema | `error.tsx` de la ruta |

**Origen:** `src/app/(loggedin)/objectives/by-project/page.tsx`, `src/app/(loggedin)/objectives/by-project/ScrollToProject.tsx`, `src/app/(loggedin)/objectives/by-project/loading.tsx`, `src/app/(loggedin)/objectives/by-project/error.tsx`, `src/features/projects/components/ProjectObjectives/ProjectObjectives.tsx`, `src/features/objectives/components/ObjectivesGroup/ObjectivesGroup.tsx`, `src/features/objectives/components/ObjectivesGroup/ObjectivesGroup.module.scss`, `src/features/objectives/components/ObjectiveCard/ObjectiveCard.tsx`.

Notas de transcripción [fuente: código-existente]:
- `grupo-proyecto` y `grilla-tareas` se relevaron como `section` y `list`: contenedores sin tipo propio en el diccionario.
- `scroll-a-proyecto` devuelve `null` y no es un bloque de UI; se lista porque está en el árbol.
- `contenedor-portal` es un `<div>` vacío que sí tiene contenido en un estado: es donde `FinishDateLabel` monta su date-picker por portal (`ObjectivesGroup.tsx:109`, `FinishDateLabel.tsx:174-191`). Ese overlay no está en el inventario de `_overlays.md` como bloque de esta pantalla.
- `pill-estado` está relevado como overlay compartido en `_overlays.md` (`StateTag`).

## Layout por viewport

### desktop · 1440px

- grupo-proyecto × N (pila vertical)
  - encabezado-grupo
    - row `cabecera` : titulo-grupo · tag-horas-mes · boton-nueva-tarea-grupo
  - grilla-tareas: card-tarea × N, en columnas de **350px mínimo** con `auto-fit`
    - card-tarea contiene: icono-soy-responsable, pill-estado, tag-area-responsable, horas-trabajadas, etiqueta-fecha-creacion, etiqueta-fecha-modificacion, etiqueta-fecha-cierre
- contenedor-portal

**Origen:** `ObjectivesGroup.module.scss:88-89` [fuente: código-existente]:

```scss
.containerObjectives { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); }
```

**Las fracciones de la grilla no son derivables:** la cantidad de columnas depende del ancho disponible. Con el contenido a ~880px (viewport 1200px) entran 2 columnas; a 1440px entran 3.

A partir de **1680px** la grilla se fija en **4 columnas de 3/12** cada una (`ObjectivesGroup.module.scss:93-95` — `@media (min-width: 1680px) { grid-template-columns: repeat(4, 1fr); }`). `1680px` no es ninguno de los breakpoints declarados (`_mixins.scss` define 767/768/1024/1440) y es el único `min-width` de los 14 media queries del producto.

## Contenido

### scroll-a-proyecto
- Texto/label: no renderiza nada
- Icono: nada
- Asset: nada
- Annotation: `<ScrollToProject>` lee `window.location.hash`, busca el elemento por id y hace `scrollIntoView({ behavior: 'smooth', block: 'start' })` tras un `setTimeout` de 100ms (`ScrollToProject.tsx:5-19`)

### grupo-proyecto
- Texto/label: contenedor sin texto propio
- Icono: nada
- Asset: nada
- Annotation: `<div id="project-{id}">` + `<ObjectivesGroup>` (`ProjectObjectives.tsx:27-28`)

### encabezado-grupo
- Texto/label: contiene titulo-grupo, tag-horas-mes y boton-nueva-tarea-grupo
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.titleContainer}>` (`ObjectivesGroup.tsx:63`)

### titulo-grupo
- Texto/label: dinámico — el nombre del proyecto, vía la prop `title` de `<ObjectivesGroup>` (`ProjectObjectives.tsx:30`, `by-project/page.tsx:27`)
- Icono: nada
- Asset: nada
- Annotation: `<h2 className={styles.title}>` que **contiene un `<div>` y un `<button>`** (el tag de horas y `<AddButton>`)

### tag-horas-mes
- Texto/label: dinámico — horas y minutos trabajados en el mes, calculados en la página: `Math.floor(monthWorkedMinutes / 60)` y `monthWorkedMinutes % 60` (`by-project/page.tsx:20-21`)
- Icono: `assets/schedule-icon.svg` con `alt=""` (`ObjectivesGroup.tsx:68`)
- Asset: nada
- Annotation: solo se renderiza si `currentMonthHours` está definido (`:65`). En tareas-por-responsable, que usa el mismo componente, no se pasa, así que el tag no aparece

### tooltip-horas-mes
- Texto/label: `"Trabajadas en el mes"` (`ObjectivesGroup.tsx:71`)
- Icono: nada
- Asset: nada
- Annotation: es un `<div>` con clase, mostrado por CSS al hacer hover — no usa el componente `<Tooltip>` sino un tooltip propio del módulo

### boton-nueva-tarea-grupo
- Texto/label: sin texto visible — es un `<AddButton>` cuyo único contenido es una `<Image alt="add icon">` (`ObjectivesGroup.tsx:74`, `AddButton.tsx:30-42`)
- Icono: `add icon`
- Asset: nada
- Annotation: el `href` lo arma `buildHref()`, que incluye `?projectId={id}` para precargar el proyecto en el alta. El texto útil (`"Crear una nueva tarea asociada"`) está en el `title` de la imagen

### grilla-tareas
- Texto/label: contenedor de las cards
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.containerObjectives}>` con `display: grid` (`ObjectivesGroup.tsx:77`)

### card-tarea
- Texto/label: título dinámico desde `objective.title`; horas como `` `${hours} hora(s) ${worked}` `` donde `worked` es `"trabajada"` con 1 hora y `"trabajadas"` con otro número (`ObjectiveCard.tsx:22`)
- Icono: nada
- Asset: nada
- Annotation: la card entera es un `<Link>` a `/objectives/{id}` (`:108`). `getCardClass()` devuelve uno de cinco valores para `data-state` (`:86-105`): `finished` (finalizada) · `expiresToday` (vence hoy) · `expired` (vencida) · `closeToDeadline` (próxima al vencimiento) · `default` (el resto)

### icono-soy-responsable
- Texto/label: `title="Soy parte de esta tarea"` como único texto (`ObjectiveCard.tsx:119`)
- Icono: icono de responsable, `alt="responsable icon"` (`:116`)
- Asset: nada
- Annotation: `title` es un fallback débil como único nombre

### pill-estado
- Texto/label: el `label` del estado actual. Opciones verbatim: `"Activo"` · `"Backlog"` · `"En revisión"` · `"Cancelado"` · `"Finalizado"` (`StateTag.tsx:21-25`)
- Icono: nada
- Asset: nada
- Annotation: es un `<button>` **dentro** del `<Link>` de la card (`ObjectiveCard.tsx:108`, `:125`). Toast de éxito: `` `Se cambió el estado de la tarea a ${newValue}` `` con el valor crudo (`StateTag.tsx:59`); de error: `"Hubo un error al cambiar el estado"` (`:62`)

### tag-area-responsable
- Texto/label: el nombre del responsable como texto; **el área no tiene texto visible, solo color**
- Icono: nada
- Asset: nada
- Annotation: `<AreaTag>` renderiza el área como un `<span>` vacío con `data-area`, con el nombre en un `Tooltip` de `:hover` (`AreaTag.tsx:32-34`)

### horas-trabajadas
- Texto/label: las horas de la tarea, con el icono al lado
- Icono: `schedule icon`, `alt="schedule icon"` (`ObjectiveCard.tsx:143`)
- Asset: nada
- Annotation: `<p className={styles.workedText}>` (`:143-146`)

### tooltip-horas-por-persona
- Texto/label: el desglose de horas por persona (`ObjectiveCard.tsx:148-163`)
- Icono: `question icon`, `alt="question icon"` (`:163`)
- Asset: nada
- Annotation: es un `<div>` mostrado por CSS `:hover`. **El desglose por persona no está disponible de ninguna otra forma en esta pantalla**

### etiqueta-fecha-creacion
- Texto/label: etiqueta `"Creación"` + la fecha (`ObjectiveCard.tsx:168`)
- Icono: nada
- Asset: nada
- Annotation: `<DateLabel label="Creación">`

### etiqueta-fecha-modificacion
- Texto/label: etiqueta `"Modificación"` + la fecha (`ObjectiveCard.tsx:169`)
- Icono: nada
- Asset: nada
- Annotation: `<DateLabel label="Modificación">`

### etiqueta-fecha-cierre
- Texto/label: el texto de `getStatusMessage()` y `getDaysLeft()` (`FinishDateLabel.tsx:168`, `:171`)
- Icono: `getCalendarIcon()` con `alt="calendar icon"` (`FinishDateLabel.tsx:170`)
- Asset: nada
- Annotation: `<div onClick={handleDivClick}>` que abre el date-picker (`FinishDateLabel.tsx:162-167`). El `Tooltip` que la envuelve se desactiva mientras el picker está abierto (`disableTooltip={isDatePickerOpen}`, `:160`)

### contenedor-portal
- Texto/label: vacío
- Icono: nada
- Asset: nada
- Annotation: `<div ref={portalContainerRef}>` (`ObjectivesGroup.tsx:109`); si no existe, el picker no se abre y no hay aviso (`FinishDateLabel.tsx:173`)

### date-picker-cierre
- Texto/label: el calendario de `react-datepicker`
- Icono: nada
- Asset: nada
- Annotation: `<DatePicker inline>` montado por `ReactDOM.createPortal`, posicionado en absoluto según el `getBoundingClientRect()` del contenedor (`FinishDateLabel.tsx:137`, `:175-191`). **Permite editar la fecha de cierre estimada de una tarea desde la card**, una escritura que no existe en ninguna otra pantalla

### cargando-vista
- Texto/label: `"Cargando..."` (`by-project/loading.tsx:5`)
- Icono: nada
- Asset: nada
- Annotation: `<Loader>` del `loading.tsx` de la ruta

### pantalla-error
- Texto/label: el del `error.tsx` de la ruta (`by-project/error.tsx`)
- Icono: nada
- Asset: nada
- Annotation: este boundary casi no se dispara, porque el único trabajo de la página está envuelto en su propio `try/catch`

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). `getProjectsObjectivesSummary()` resuelve con al menos un proyecto (`by-project/page.tsx:15-36`)
- Sub-estados de vencimiento por card (`data-state`, `ObjectiveCard.tsx:86-105`): `finished` · `expiresToday` · `expired` · `closeToDeadline` · `default`
- Sub-estado `date-picker abierto`: click en etiqueta-fecha-cierre monta date-picker-cierre en contenedor-portal (`FinishDateLabel.tsx:166`, `:173`)
- Sub-estado `grupo sin tag de horas`: `typeof currentMonthHours === 'undefined'` oculta tag-horas-mes (`ObjectivesGroup.tsx:46`, `:65`); no ocurre en esta pantalla porque la página siempre calcula las horas

### empty
- Aplica: No — no implementado (ver gaps-as-is.md). `projectsList.map(...)` sobre un array vacío no renderiza nada y no hay chequeo de largo: queda el `<h1>` con el área de contenido en blanco, sin mensaje (`by-project/page.tsx:19`). Un proyecto sin tareas renderiza su encabezado y una grilla vacía, también sin mensaje (`ObjectivesGroup.tsx:77-107`) [fuente: código-existente]

### loading
- Aplica: Sí
- Mensaje: `"Cargando..."` (`by-project/loading.tsx:5`)
- Cambios:
  - cargando-vista: solo visible en este estado; es todo lo que se ve en el área de contenido, la sidebar del shell queda
- Nota: **no hay loading del cambio de estado inline:** la pill no se deshabilita ni muestra spinner durante la mutación (`StateTag.tsx:82-89`)

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). La pantalla no tiene formulario

### error de sistema / sin conexión
- Aplica: No — no implementado (ver gaps-as-is.md). La página envuelve la llamada en un `try/catch` que hace `console.error` y deja `projectsList = []`, así que la pantalla renderiza el título y nada más: **un fallo de la api es indistinguible de "no hay proyectos"** (`by-project/page.tsx:9-13`). El `error.tsx` de la ruta existe pero casi nunca se dispara por ese mismo `try/catch` [fuente: código-existente]

### success
- Aplica: Sí
- Mensaje: toast `` `Se cambió el estado de la tarea a ${newValue}` `` (`StateTag.tsx:59`)
- Cambios: solo el toast, tras el cambio de estado inline de una card

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). Una tarea finalizada tiene su propio `data-state` visual en la card, pero el dropdown de estado ofrece las 5 opciones igual (`StateTag.tsx:21-25`) [fuente: código-existente]

## Interacciones

**Eventos:** [fuente: código-existente]
- card-tarea · click → navega a `/objectives/{id}` (`ObjectiveCard.tsx:108`)
- pill-estado · click → abre el dropdown; seleccionar → muta el estado (`StateTag.tsx:74-78`, `:55-64`)
- boton-nueva-tarea-grupo · click → navega a `/objectives/new?projectId={id}` (`ObjectivesGroup.tsx:74`)
- tag-horas-mes · hover → muestra tooltip-horas-mes (`ObjectivesGroup.module.scss`)
- horas-trabajadas · hover → muestra tooltip-horas-por-persona con el desglose (`ObjectiveCard.tsx:148-163`)
- etiqueta-fecha-cierre · click → abre date-picker-cierre por portal (`FinishDateLabel.tsx:166`)
- al montar · si `window.location.hash` tiene valor → busca el elemento por id y hace `scrollIntoView({ behavior: 'smooth', block: 'start' })` tras 100ms (`ScrollToProject.tsx:5-19`)

**Validaciones:**
- Ninguna.

**Feedback:**
- Scroll suave al proyecto del ancla
- Tooltips de horas
- Estado visual de vencimiento por `data-state` en la card
- Toast del cambio de estado

**Volumen** [fuente: código-existente]: no hay paginación ni límite. Se renderizan todos los proyectos con todas sus tareas activas, sin scroll virtual ni "ver más" (`by-project/page.tsx:19`, `ObjectivesGroup.tsx:78`).

## Accesibilidad

- **Orden de foco:** por cada grupo: boton-nueva-tarea-grupo → card-tarea × N (la card entera es un `<Link>`, enfocable y navegable por teclado, `ObjectiveCard.tsx:108`). **`pill-estado` es un `<button>` dentro del `<Link>` de la card** (`:125`): contenido interactivo anidado, HTML inválido, y el comportamiento del teclado es ambiguo. **`etiqueta-fecha-cierre` queda fuera del orden de foco:** su disparador es un `<div onClick>` sin `role` ni `tabIndex`, así que la edición de la fecha de cierre es **inalcanzable por teclado** (`FinishDateLabel.tsx:162-167`) [fuente: código-existente].
- **Landmarks y jerarquía:** los landmarks son los del shell más el `<header>` de cada grupo. Un solo `<h1>`, el del `PageLayout` (`by-project/page.tsx:16`), y un `<h2>` por grupo de proyecto (`ObjectivesGroup.tsx:62-64`). **El `<h2>` contiene un `<div>` y un `<button>`** (`ObjectivesGroup.tsx:62-76`), así que el nombre accesible del encabezado incluye el tag de horas y el `"add icon"` del botón: queda como `"{proyecto} {horas} add icon"`.
- **Foco y teclado:** los overlays de esta composición son el dropdown de pill-estado (`StateTag`, sin `aria-expanded`, sin cierre por click afuera ni `Escape`) y el date-picker de la fecha de cierre montado por portal; ninguno atrapa el foco. **El scroll automático al ancla no mueve el foco** (`ScrollToProject.tsx:12-15`): un usuario de teclado queda con el foco donde estaba y un lector de pantalla no anuncia el salto. No hay atajos propios.
- **Propio de esta composición:** el nombre accesible de cada card es **todo el texto de la card** (estado, área, responsable, horas, tres fechas), que un lector lee completo como el nombre del enlace (`ObjectiveCard.tsx:108-185`). **`boton-nueva-tarea-grupo` no tiene nombre accesible útil:** es un `<button>` cuyo único contenido es `<Image alt="add icon">`, sin `aria-label` (`AddButton.tsx:30-42`), y sus clases condicionales escriben la cadena `"false"` en el atributo `class` cuando no está deshabilitado (`AddButton.tsx:32`). **El área se comunica solo por color** (`AreaTag.tsx:32-34`), y **los dos tooltips de horas son `<div>` de `:hover` sin ARIA**, inaccesibles por teclado (`ObjectivesGroup.tsx:71`, `ObjectiveCard.tsx:148-163`). La grilla es un `<div>` con `display: grid`, sin `role="list"` ni conteo (`ObjectivesGroup.tsx:77`). Los iconos decorativos usan `alt="responsable icon"`, `alt="schedule icon"` y `alt="question icon"`, que describen el icono y no su función (`ObjectiveCard.tsx:116`, `:143`, `:163`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
