---
name: alta-tareas
surface: web
route: /objectives/new
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Alta de tareas

## Identidad

- **Audiencia primaria:** equipo-interno.
- **JTBD / Propósito:** crear una o **varias** tareas en un solo envío, con formularios clonables. Es el único formulario del producto que crea varias entidades en un submit [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport de la superficie. La pantalla no declara ningún tratamiento responsive: cada tarjeta de formulario se rinde a dos columnas a cualquier ancho [fuente: código-existente].
  - Mobile queda fuera de la superficie `web`: el shell tiene una sidebar de 290px fija sin ninguna media query, así que por debajo de ese ancho no hay navegación disponible (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Desde listado-tareas · botón `"Nueva tarea"` del encabezado (`objectives/page.tsx:28`)
- Desde tareas-por-proyecto · botón `+` de un grupo, con `?projectId={id}` (`ObjectivesGroup.tsx:74`)
- Desde tareas-por-responsable · botón `+` de un grupo, con `?personId={id}` (`ObjectivesGroup.tsx:74`)
- Desde detalle-proyecto · botón `+` de la sección de tareas, con `?projectId={id}` (`ProjectObjectivesSection.tsx:81`)
- Desde detalle-requisito · botón `+` de la sección de tareas, con `?requirementId={id}` (`RequirementDetail.tsx:~155`)

**Salidas user-driven:**
- Ninguna. **No hay botón de volver ni cancelar en la pantalla** (`:266-427`)

**Salidas automáticas:**
- A `/requirements/{requirementId}` · tras crear con éxito, si se vino con `?requirementId=` (`:145`)
- A `/objectives` · tras crear con éxito en cualquier otro caso (`:147`)

## Estructura

Los bloques 4-14 se repiten **una vez por formulario** en el array `formsData`.

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | cargando-datos | loader | — | feedback | desktop | visible_only_in_states: loading inicial | Espera de personas y proyectos |
| 2 | boton-guardar | button | primary · loading / disabled | input | desktop | state_overrides: loading→spinner + disabled | Guarda todas las tareas del array |
| 3 | tarjeta-formulario | card | — | layout | desktop | — | Un formulario de tarea |
| 4 | campo-titulo | text-input | default / error | input | desktop | state_overrides: error de validación→error | Título de la tarea |
| 5 | campo-proyecto | dropdown | closed / open · error | input | desktop | state_overrides: error de validación→error | Proyecto al que pertenece |
| 6 | campo-requisito | dropdown | closed / open | input | desktop | visible_only_in_states: con proyecto elegido | Requisito vinculado |
| 7 | campo-responsables | dropdown | multi · error | input | desktop | state_overrides: error de validación→error | Personas responsables |
| 8 | campo-area | dropdown | closed / open · error | input | desktop | state_overrides: error de validación→error | Área de la tarea |
| 9 | campo-visibilidad | dropdown | closed / open | input | desktop | — | Público o interno |
| 10 | campo-fecha-estimada | date-picker | default | input | desktop | — | Fecha estimada de finalización |
| 11 | campo-descripcion | text-input | default / error | input | desktop | state_overrides: error de validación→error | Descripción de la tarea |
| 12 | mensaje-error-formulario | alert | error | feedback | desktop | visible_only_in_states: error de validación | Mensaje agregado por formulario |
| 13 | boton-borrar-formulario | button | primary | input | desktop | visible_only_in_states: con más de un formulario | Elimina esa tarjeta |
| 14 | boton-clonar-formulario | button | primary | input | desktop | — | Duplica esa tarjeta con sus valores |

**Origen:** `src/app/(loggedin)/objectives/new/page.tsx:226-427`, `src/app/(loggedin)/objectives/new/styles.module.scss`, `src/features/objectives/hooks/useCreateObjective.ts`.

Notas de transcripción [fuente: código-existente]:
- Usa los componentes compartidos (`InputText`, `InputSelect`, `InputTextarea`, `InputDate`, `InputMultiplePersons`, `Button`, `SectionCard`, `PageLayout`), a diferencia de los formularios de proyecto y de requisito.
- `campo-requisito` solo se renderiza si hay un proyecto elegido: `{Boolean(form.projectId) && …}` (`:297`).
- El título de la pantalla (`"Tareas / crear"`) lo aporta el shell vía `PageLayout` (`:267`).

## Layout por viewport

### desktop · 1440px

- boton-guardar (en el `actions` de `PageLayout`, junto al título)
- tarjeta-formulario × N (pila vertical)
  - row `formulario`
    - col izquierda (`.textareaCont`): campo-titulo, campo-proyecto, campo-requisito, campo-responsables, campo-area, campo-visibilidad
    - col derecha (`.column`): campo-fecha-estimada, campo-descripcion
  - mensaje-error-formulario
  - row `acciones`
    - boton-borrar-formulario
    - boton-clonar-formulario

**Origen:** `objectives/new/styles.module.scss` — `.formContainer` con `.textareaCont` y `.column`.

**Las fracciones no son derivables de este relevamiento:** los anchos exactos de las dos columnas no se leyeron, y no hay una grilla de 12 declarada [fuente: código-existente].

## Contenido

### cargando-datos
- Texto/label: `"Cargando..."` (`:263`)
- Icono: nada
- Asset: nada
- Annotation: `<Loader>`; reemplaza toda la pantalla, incluido el título

### boton-guardar
- Texto/label: `"Guardar"` (`:234`)
- Icono: nada
- Asset: nada
- Annotation: `loading` y `disabled` desde `createObjectiveMutation.isPending` (`:238-239`). Va en el `actions` de `PageLayout`, o sea **fuera del `<form>`**

### tarjeta-formulario
- Texto/label: contenedor sin texto propio — **las tarjetas no tienen encabezado ni número**
- Icono: nada
- Asset: nada
- Annotation: `<SectionCard>` con un `<form onSubmit>` propio adentro (`:270-271`)

### campo-titulo
- Texto/label: label `"Título"`; placeholder `"Título de la tarea"` (`:274-283`)
- Icono: nada
- Asset: nada
- Annotation: obligatorio

### campo-proyecto
- Texto/label: label `"Corresponde a..."`; placeholder `"Nombre del proyecto"` (`:285-296`)
- Icono: nada
- Asset: nada
- Annotation: obligatorio. La etiqueta no dice "Proyecto" en ninguna parte, lo que la hace ambigua frente al campo `"Requisito"` que viene justo debajo. Se precarga con `?projectId=` de la URL (`:93-94`)

### campo-requisito
- Texto/label: label `"Requisito"`; placeholder `"Seleccionar requisito (opcional)"` (`:298-308`)
- Icono: nada
- Asset: nada
- Annotation: opcional. Solo se renderiza si hay un proyecto elegido (`:297`); al entrar con `?requirementId=` el campo aparece recién cuando el proyecto está cargado

### campo-responsables
- Texto/label: label `"Responsable(s)"`; placeholder `"Nombre(s)"` (`:309-326`)
- Icono: nada
- Asset: nada
- Annotation: obligatorio. Se precarga con `?personId=` de la URL (`:93-94`)

### campo-area
- Texto/label: label `"Área"`; placeholder `"Área de la tarea"`. Opciones verbatim: `"Diseño"` (`diseño`) · `"Desarrollo"` (`desarrollo`) · `"Gestión"` (`gestion`) · `"Investigación"` (`investigacion`) (`:333-349`)
- Icono: nada
- Asset: nada
- Annotation: obligatorio. Default `desarrollo` (`:47`)

### campo-visibilidad
- Texto/label: label `"Nivel de visibilidad"`; placeholder `"Nivel de visibilidad de la tarea"`. Opciones verbatim: `"Público"` (`public`) · `"Interno"` (`internal`) (`:362-370`)
- Icono: nada
- Asset: nada
- Annotation: opcional. Default `internal` (`:58`); en el alta de requisito el default es `public`

### campo-fecha-estimada
- Texto/label: label `"Fecha de finalización estimada"` (`:379-389`)
- Icono: nada
- Asset: nada
- Annotation: opcional

### campo-descripcion
- Texto/label: label `"Descripción"`; placeholder `"Descripción de la tarea"` (`:391-400`)
- Icono: nada
- Asset: nada
- Annotation: obligatorio. `<InputTextarea>`

### mensaje-error-formulario
- Texto/label: `"Revisá que no haya campos incompletos"` (`:408`)
- Icono: `assets/errorIcon` con `alt="error icon"` (`:407`)
- Asset: nada
- Annotation: es un mensaje **por formulario**, no por campo. Los campos sí reciben la prop `error` vía `fieldHasError(campo, valor)` (`:281`, `:293`, `:324`, `:353`, `:398`), que marca el borde

### boton-borrar-formulario
- Texto/label: `"Borrar"` (`:416`)
- Icono: nada
- Asset: nada
- Annotation: solo se renderiza si `formsData.length > 1` (`:415`), así que nunca se puede quedar sin formularios. Elimina el formulario y todo lo escrito sin confirmar

### boton-clonar-formulario
- Texto/label: `"Clonar"` (`:420`)
- Icono: nada
- Asset: nada
- Annotation: `cloneForm(form.id)` duplica el formulario con sus valores

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Personas y proyectos cargados (`:266-427`); arranca con **un** formulario (`useState([defaultValues])`, `:74`)

### empty
- Aplica: No — no implementado (ver gaps-as-is.md)

### loading
- Aplica: Sí
- Mensaje: `"Cargando..."` (inicial, `:263`) · spinner en el botón con `"Cargando..."` `sr-only` (durante el guardado, `:238-239`)
- Cambios:
  - **Loading inicial** (`isLoadingPersons || isLoadingProjects`): cargando-datos solo visible en este estado; reemplaza toda la pantalla, incluido el título (`:260-264`)
  - **Loading del guardado** (`isPending`): boton-guardar muestra spinner y se deshabilita (state_override)

### error de validación
- Aplica: Sí
- Mensaje: `"Revisá que no haya campos incompletos"` (`:408`)
- Cambios:
  - mensaje-error-formulario: solo visible en este estado, con icono, debajo de los campos de ese formulario (visible_only_in_states)
  - campo-titulo / campo-proyecto / campo-responsables / campo-area / campo-descripcion: state=error vía `fieldHasError` (state_override, `:281`, `:293`, `:324`, `:353`, `:398`)
- Nota: el mensaje es genérico — marca los campos con error pero **no dice qué falta en cada uno** [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: toast `error.message` o `"Error al crear algunas tareas"` (`:150`)
- Cambios:
  - Solo el toast. No navega, no marca nada, los N formularios quedan como estaban (`:149-151`)
- Nota: **el fallo parcial no está resuelto.** El envío es `Promise.all(formsData.map(mutateAsync))` (`:136`): las N mutaciones salen en paralelo y `Promise.all` rechaza con el primer error, sin esperar ni reportar el resto. Las que sí se crearon quedan creadas, y volver a apretar `"Guardar"` reenvía todas, duplicando las ya creadas [fuente: código-existente]. Tampoco hay manejo de `isError` de `usePersons` (`:81`) ni de `useProjects` (`:82-84`): los selects quedan vacíos sin explicación

### success
- Aplica: Sí
- Mensaje: toast `"Tareas creadas con éxito"` (`:138`)
- Cambios: si se vino con `?requirementId=`, invalida `['requirement', {id}]` y navega al detalle del requisito (`:139-145`); si no, navega a `/objectives` (`:147`)

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md)

## Interacciones

**Eventos:** [fuente: código-existente]
- cada campo · on change → `handleInputChange(campo, valor, form.id)`, que actualiza **solo el formulario con ese id** (`:279`, `:291`, `:304`, `:318-323`, `:351`, `:372`, `:384`, `:396`)
- boton-clonar-formulario · click → `cloneForm(form.id)`: duplica el formulario con sus valores (`:420`)
- boton-borrar-formulario · click → `deleteForm(form.id)`, sin confirmar (`:416`)
- boton-guardar · click → valida todos los formularios y llama a la mutación (`:237`)
- `<form>` de cada tarjeta · submit → `handleSubmit` con `preventDefault()` (`:226-229`, `:271`)
- al montar · lee `?projectId`, `?personId` y `?requirementId` de la URL para precargar los campos (`:93-94`)

**Validaciones:**
- campo-titulo · `fieldHasError('title', valor)` → marca el campo; mensaje agregado `"Revisá que no haya campos incompletos"` (`:281`, `:408`)
- campo-proyecto · `fieldHasError('projectId', valor)` → marca el campo; mismo mensaje agregado (`:293`)
- campo-responsables · `fieldHasError('personIds', valor)` → marca el campo; mismo mensaje agregado (`:324`)
- campo-area · `fieldHasError('area', valor)` → marca el campo; mismo mensaje agregado (`:353`)
- campo-descripcion · `fieldHasError('description', valor)` → marca el campo; mismo mensaje agregado (`:398`)

**Feedback:**
- Campos marcados con la prop `error`
- Mensaje con icono por formulario
- Spinner + `disabled` en el botón de guardar
- Toast del resultado
- Invalidación de la query del requisito de origen, si aplica

**Nota de mecánica** [fuente: código-existente]: el disparo del guardado pasa por un `useEffect` — el botón setea `canCreate` y un efecto que observa ese estado ejecuta las mutaciones (`:108-156`).

## Accesibilidad

- **Orden de foco:** boton-guardar → por cada tarjeta: campo-titulo → campo-proyecto → campo-requisito → campo-responsables → campo-area → campo-visibilidad → campo-fecha-estimada → campo-descripcion → boton-borrar-formulario → boton-clonar-formulario. **El botón de guardar está fuera de los `<form>`:** va en el `actions` de `PageLayout` (`:232-239`) mientras cada tarjeta tiene su propio `<form onSubmit>` (`:271`), así que Enter dentro de un campo dispara el submit de **ese** formulario y el botón dispara el guardado de **todos**: dos caminos con comportamiento potencialmente distinto [fuente: código-existente].
- **Landmarks y jerarquía:** los landmarks son los del shell. Un solo `<h1>`, el del `PageLayout` (`"Tareas / crear"`, `:267`). **Las tarjetas de formulario no tienen encabezado** (`:270`), así que con N formularios en pantalla no hay forma de distinguirlos ni de navegarlos por estructura.
- **Foco y teclado:** los menús de los `InputSelect` son los overlays de esta composición; su comportamiento de foco lo aportan los componentes compartidos. No hay atajos propios ni focus traps.
- **Propio de esta composición:** **nada numera ni nombra cada tarjeta** (`:269-424`): son N bloques idénticos, y los botones `"Borrar"` y `"Clonar"` tienen el mismo nombre accesible en todos, así que un lector de pantalla no puede distinguir cuál borra o clona (`:416`, `:420`). `mensaje-error-formulario` es un `<div>` **sin `role="alert"`**: al aparecer no se anuncia (`:404-410`). El icono del error tiene `alt="error icon"`, que describe el icono y no el mensaje, aunque el texto está al lado (`:407`). No se verificó si los componentes `Input*` vinculan la prop `error` con `aria-invalid` / `aria-describedby` (`:281`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
