---
document: UX Survey Screen
screen: alta-tareas
route: /objectives/new
service: web
source_files:
  - src/app/(loggedin)/objectives/new/page.tsx
  - src/app/(loggedin)/objectives/new/styles.module.scss
  - src/features/objectives/hooks/useCreateObjective.ts
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: alta-tareas

> **Relevamiento as-is** de `/objectives/new`, extraído de
> `src/app/(loggedin)/objectives/new/page.tsx` (428 líneas, `'use client'`).
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> **El plural del nombre es deliberado:** es el único formulario del producto que crea varias
> entidades en un submit. El chrome está relevado en [_shell.md](./_shell.md).

## Identidad

- **Ruta:** `/objectives/new`
- **Archivo:** `src/app/(loggedin)/objectives/new/page.tsx`
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** crea una o **varias** tareas en un solo envío, con formularios clonables.
- **Viewports con tratamiento:** ninguno.

## Entrada y salida

**Entradas:**
- Botón `"Nueva tarea"` del encabezado de `listado-tareas` · `objectives/page.tsx:28`
- Botón `+` de un grupo en `tareas-por-proyecto`, con `?projectId={id}` ·
  `ObjectivesGroup.tsx:74`
- Botón `+` de un grupo en `tareas-por-responsable`, con `?personId={id}` ·
  `ObjectivesGroup.tsx:74`
- Botón `+` de la sección de tareas de `detalle-proyecto`, con `?projectId={id}` ·
  `ProjectObjectivesSection.tsx:81`
- Botón `+` de la sección de tareas de `detalle-requisito`, con `?requirementId={id}` ·
  `RequirementDetail.tsx:~155`

**Salidas:**
- `/requirements/{requirementId}` · tras crear con éxito, **si se vino con `?requirementId=`** ·
  `:145`
- `/objectives` · tras crear con éxito en cualquier otro caso · `:147`

**Redirects automáticos:**
- Ninguno.

> **Cinco entradas distintas, tres query params** (`projectId`, `personId`, `requirementId`), que se
> leen en `:93-94` para precargar los campos correspondientes.

> **No hay botón de volver ni cancelar** en la pantalla.

## Estructura

Los bloques 4-15 se repiten **una vez por formulario** en el array `formsData`.

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | cargando-datos | `loader` | — | ambos | `<Loader label="Cargando...">` | `:263` |
| 2 | boton-guardar | `button` | primary · loading / disabled | ambos | `<Button label="Guardar" loading disabled>` en `actions` de `PageLayout` | `:232-239` |
| 3 | tarjeta-formulario | `card` | — | ambos | `<SectionCard>` × N | `:270` |
| 4 | campo-titulo | `text-input` | default / error | ambos | `<InputText label="Título">` | `:274-283` |
| 5 | campo-proyecto | `dropdown` | closed / open · error | ambos | `<InputSelect label="Corresponde a...">` | `:285-296` |
| 6 | campo-requisito | `dropdown` | closed / open | ambos | `<InputSelect label="Requisito">` | `:298-308` |
| 7 | campo-responsables | `dropdown` | multi · error | ambos | `<InputMultiplePersons label="Responsable(s)">` | `:309-326` |
| 8 | campo-area | `dropdown` | closed / open · error | ambos | `<InputSelect label="Área">` | `:328-355` |
| 9 | campo-visibilidad | `dropdown` | closed / open | ambos | `<InputSelect label="Nivel de visibilidad">` | `:357-376` |
| 10 | campo-fecha-estimada | `date-picker` | default | ambos | `<InputDate label="Fecha de finalización estimada">` | `:379-389` |
| 11 | campo-descripcion | `text-input` | default / error | ambos | `<InputTextarea label="Descripción">` | `:391-400` |
| 12 | mensaje-error-formulario | `alert` | error | ambos | `<div className={styles.invalidFormContainer}>` con icono | `:404-410` |
| 13 | boton-borrar-formulario | `button` | primary | ambos | `<Button label="Borrar">` — solo si hay más de uno | `:415-417` |
| 14 | boton-clonar-formulario | `button` | primary | ambos | `<Button label="Clonar">` | `:420` |

> **Usa los componentes compartidos** (`InputText`, `InputSelect`, `InputTextarea`, `InputDate`,
> `InputMultiplePersons`, `Button`, `SectionCard`, `PageLayout`), a diferencia de los formularios de
> proyecto y de requisito, que montan `<input>` nativos y `react-select`. **Es el formulario más
> alineado con el sistema de componentes del producto.**

> **`campo-requisito` solo se renderiza si hay un proyecto elegido**: `{Boolean(form.projectId) && …}`
> (`:297`). Al entrar con `?requirementId=` desde el detalle de un requisito, el campo aparece recién
> cuando el proyecto está cargado.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- titulo-pagina (`"Tareas / crear"`, del shell) · boton-guardar
- tarjeta-formulario × N (pila vertical)
  - row `formulario` (2 columnas)
    - col izquierda (`.textareaCont`): campo-titulo, campo-proyecto, campo-requisito,
      campo-responsables, campo-area, campo-visibilidad
    - col derecha (`.column`): campo-fecha-estimada, campo-descripcion
  - mensaje-error-formulario (solo en error)
  - row `acciones`: boton-borrar-formulario · boton-clonar-formulario

**Origen:** `objectives/new/styles.module.scss` — `.formContainer` con `.textareaCont` y `.column`.
**Las fracciones no son derivables de este relevamiento:** los anchos exactos de las dos columnas no
se leyeron, y no hay una grilla de 12 declarada.

> Con 6 campos en una columna y 2 en la otra, la columna derecha queda mayormente vacía salvo por el
> `<textarea>` de descripción, que presumiblemente se estira.

## Contenido

### titulo-pagina
- Texto/label: `"Tareas / crear"`
- Origen: `:267`
- Annotation: **usa una notación de ruta con barra** (`"Tareas / crear"`), distinta de
  `"Nuevo Proyecto"`, `"Nuevo Requisito"` y `"Crear actor"`. El par de esta pantalla,
  `edicion-tarea`, usa `"Tareas / editar"`.

### Campos

| Campo | Label verbatim | Placeholder verbatim | Obligatorio |
|---|---|---|---|
| campo-titulo | `"Título"` | `"Título de la tarea"` | sí |
| campo-proyecto | `"Corresponde a..."` | `"Nombre del proyecto"` | sí |
| campo-requisito | `"Requisito"` | `"Seleccionar requisito (opcional)"` | no |
| campo-responsables | `"Responsable(s)"` | `"Nombre(s)"` | sí |
| campo-area | `"Área"` | `"Área de la tarea"` | sí |
| campo-visibilidad | `"Nivel de visibilidad"` | `"Nivel de visibilidad de la tarea"` | no |
| campo-fecha-estimada | `"Fecha de finalización estimada"` | — | no |
| campo-descripcion | `"Descripción"` | `"Descripción de la tarea"` | sí |

Origen: `:274-400`

> **`"Corresponde a..."` es el label del campo de proyecto**, con el placeholder
> `"Nombre del proyecto"`. La etiqueta no dice "Proyecto" en ninguna parte, lo que la hace ambigua
> frente al campo `"Requisito"` que viene justo debajo.

Opciones de `campo-area`: `"Diseño"` (`diseño`) · `"Desarrollo"` (`desarrollo`) ·
`"Gestión"` (`gestion`) · `"Investigación"` (`investigacion`) · `:333-349`

Opciones de `campo-visibilidad`: `"Público"` (`public`) · `"Interno"` (`internal`) · `:362-370`

Defaults: `area: 'desarrollo'`, `state: 'activo'`, `visibilityLevel: 'internal'` · `:47`, `:56`, `:58`

> **El default de visibilidad es `internal`** acá, `public` en el alta de requisito. Tercer par de
> defaults opuestos del producto para el mismo concepto.

> **No hay campo de estado ni de prioridad.** El estado se fija en `activo` (`:56`) y la prioridad no
> aparece — aunque `listado-tareas` la muestra como columna. Igual que en los formularios de proyecto:
> **no se puede determinar desde el código cómo se setea la prioridad de una tarea.**

### mensaje-error-formulario
- Texto/label: `"Revisá que no haya campos incompletos"`
- Origen: `:408`
- Icono: `assets/errorIcon` con `alt="error icon"` · `:407`
- Annotation: es un mensaje **por formulario**, no por campo. Los campos sí reciben la prop `error`
  vía `fieldHasError(campo, valor)` (`:281`, `:293`, `:324`, `:353`, `:398`), que marca el borde.

### boton-borrar-formulario / boton-clonar-formulario
- Textos verbatim: `"Borrar"` · `"Clonar"`
- Origen: `:416`, `:420`
- Annotation: `"Borrar"` **solo se renderiza si `formsData.length > 1`** (`:415`), así que nunca se
  puede quedar sin formularios.

### boton-guardar
- Texto/label: `"Guardar"`
- Origen: `:234`
- Annotation: `loading` y `disabled` desde `createObjectiveMutation.isPending` (`:238-239`). Va en el
  `actions` de `PageLayout`, o sea **fuera del `<form>`**.

### Mensajes de toast
- Éxito: `"Tareas creadas con éxito"` (plural) · `:138`
- Error: `error.message` o `"Error al crear algunas tareas"` · `:150`

> **Los dos mensajes están en plural y el de error dice `"algunas"`**, lo que reconoce que el envío
> múltiple puede fallar parcialmente. Ver estados ausentes.

## Estados presentes

### loading inicial
- Mensaje: `"Cargando..."`
- Disparado por: `isLoadingPersons || isLoadingProjects`
- Origen: `:260-264`
- Cambios: reemplaza toda la pantalla, incluido el título

### default
- Disparado por: personas y proyectos cargados
- Origen: `:266-427`
- Annotation: arranca con **un** formulario (`useState([defaultValues])`, `:74`)

### campo con error (sub-estado)
- Disparado por: `fieldHasError(campo, valor)` tras un intento de submit
- Origen: `:281`, `:293`, `:324`, `:353`, `:387`, `:398`
- Cambios: la prop `error` del componente de input marca el campo

### error de validación por formulario
- Mensaje: `"Revisá que no haya campos incompletos"`
- Origen: `:404-410`
- Cambios: aparece el bloque con icono debajo de los campos de ese formulario

> **Este formulario sí muestra los errores**, a diferencia de los de proyecto y requisito: marca los
> campos **y** muestra un mensaje. Es el mejor manejo de validación del producto — aunque el mensaje
> sea genérico.

### loading (durante el guardado)
- Mensaje: spinner en el botón + `"Cargando..."` `sr-only`
- Disparado por: `isPending`
- Origen: `:238-239`
- Cambios: el botón muestra spinner **y** se deshabilita

### success
- Mensaje: toast `"Tareas creadas con éxito"`
- Disparado por: el `.then()` del `Promise.all` de las N mutaciones
- Origen: `:136-148`
- Cambios: si se vino con `?requirementId=`, **invalida `['requirement', {id}]`** y navega al detalle
  del requisito (`:139-145`); si no, navega a `/objectives` (`:147`)

### error de sistema
- Mensaje: toast `error?.message ?? "Error al crear algunas tareas"`
- Disparado por: el `.catch()` del `Promise.all` — o sea **la primera mutación que rechaza**
- Origen: `:149-151`
- Cambios: **solo el toast.** No navega, no marca nada, los N formularios quedan como estaban.

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **fallo parcial del envío múltiple** | **el más grave de esta pantalla.** El envío es `Promise.all(formsData.map(mutateAsync))` (`:136`): las N mutaciones salen en paralelo y `Promise.all` rechaza con **el primer error**, sin esperar ni reportar el resto. Las que sí se crearon **quedan creadas**, la UI muestra solo un toast, los N formularios siguen ahí idénticos, y **volver a apretar `"Guardar"` reenvía todas — duplicando las que ya se habían creado** | `:136`, `:149-151` |
| error al cargar personas | `usePersons` sin `isError`: el select de responsables queda vacío sin explicación, y `isLoadingPersons` pasa a false, así que la pantalla se muestra | `:81`, `:260` |
| error al cargar proyectos | `useProjects` sin `isError`: el select de proyecto queda vacío | `:82-84` |
| **error específico por campo** | el mensaje es genérico (`"Revisá que no haya campos incompletos"`): marca los campos con error pero **no dice qué falta en cada uno** | `:408` |
| empty | no aplica: es un alta | — |
| not found | no aplica | — |
| estado terminal / readonly | no aplica | — |
| **confirmación al salir con cambios** | no existe. **Más grave acá:** se pueden tener varios formularios completos y salir por la navegación los descarta todos sin aviso | `:266-427` |
| **confirmación al borrar un formulario** | `"Borrar"` elimina el formulario y todo lo escrito **sin confirmar** | `:416` |
| cancelar / volver | **no hay control** | `:266-427` |
| **campo de prioridad** | no existe, aunque el listado la muestra como columna | `:24-60` (valores por defecto) |

## Interacciones

**Eventos:**
- cada campo · on change → `handleInputChange(campo, valor, form.id)`, que actualiza **solo el
  formulario con ese id** · `:279`, `:291`, `:304`, `:318-323`, `:351`, `:372`, `:384`, `:396`
- boton-clonar-formulario · click → `cloneForm(form.id)`: duplica el formulario con sus valores ·
  `:420`
- boton-borrar-formulario · click → `deleteForm(form.id)` · `:416`
- boton-guardar · click → valida todos los formularios y llama a la mutación · `:237`
- `<form>` · submit → `handleSubmit` con `preventDefault()` · `:226-229`, `:271`
- al montar · lee `?projectId`, `?personId` y `?requirementId` de la URL para precargar · `:93-94`

**Validaciones:**
- `fieldHasError(campo, valor)` por campo, en `title`, `projectId`, `personIds`, `area` y
  `description` · `:281`, `:293`, `:324`, `:353`, `:398`
- El mensaje agregado es `"Revisá que no haya campos incompletos"` · `:408`

**Feedback:**
- Campos marcados con la prop `error`
- Mensaje con icono por formulario
- Spinner + `disabled` en el botón de guardar
- Toast del resultado
- Invalidación del requisito de origen, si aplica

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Labels de los campos | Presentes vía la prop `label` de los componentes compartidos | `:275`, `:286`, `:299`, `:310`, `:330`, `:358`, `:380`, `:393` |
| Asociación label-input | La resuelven los componentes `Input*` usando `code` como `id`/`name` | `:276`, `:287`, `:311`, `:331` |
| Error asociado al campo | Se pasa por la prop `error`; **no se verificó** si `Input*` lo vincula con `aria-invalid` / `aria-describedby` | `:281` |
| Anuncio del error | El bloque es un `<div>` **sin `role="alert"`**: al aparecer no se anuncia | `:404-410` |
| Icono del error | `alt="error icon"` — describe el icono, no el mensaje. El texto está al lado, así que no se pierde información | `:407` |
| `<form>` semántico | **Presente** (`<form onSubmit>`, `:271`) — a diferencia de los formularios de actor. **Pero el botón de guardar está fuera del `<form>`**, en el `actions` de `PageLayout`, así que **Enter dentro de un campo dispara el submit sin pasar por el botón** | `:271`, `:232-239` |
| Un `<form>` por tarjeta | Cada `<SectionCard>` tiene su propio `<form>` (`:270-271`), pero el botón de guardar es único y externo: **N formularios, un solo botón fuera de todos** | `:270-271` |
| Nombre accesible del botón en loading | Correcto vía `<Button>`: `aria-busy` + `sr-only` | `Button.tsx:48`, `:53-57` |
| Jerarquía de encabezados | Solo el `<h1>` del `PageLayout`. **Las tarjetas de formulario no tienen encabezado**, así que con 5 formularios en pantalla no hay forma de distinguirlos ni de navegarlos por estructura | `:267`, `:270` |
| Formularios sin identificación | Nada numera ni nombra cada tarjeta: son N bloques idénticos | `:269-424` |
| `"Borrar"` sin contexto | El nombre accesible es solo `"Borrar"`, igual en los N formularios: un lector de pantalla no puede distinguir cuál borra | `:416` |
| `"Clonar"` sin contexto | Igual | `:420` |

## Observaciones del relevamiento

- **Es el único formulario multi-instancia del producto**, y el que mejor maneja la validación: marca
  los campos con error y muestra un mensaje. El resto de los formularios (proyecto, requisito) tiene
  los mensajes escritos y descartados.
- **Los N formularios no tienen identificación.** Sin encabezado, sin número, sin el título de la
  tarea como referencia. Con 5 formularios abiertos, los botones `"Borrar"` y `"Clonar"` de cada uno
  son indistinguibles entre sí, tanto visualmente como para un lector de pantalla.
- **El botón de guardar está fuera de los `<form>`.** Va en el `actions` de `PageLayout`
  (`:232-239`), mientras cada tarjeta tiene su propio `<form onSubmit>` (`:271`). Presionar Enter en
  un campo dispara el submit de **ese** formulario; el botón dispara el guardado de **todos**. Dos
  caminos con comportamiento potencialmente distinto.
- **El fallo parcial se reconoce en el copy pero no en la UI.** `"Error al crear algunas tareas"`
  (`:150`) implica que el envío es N mutaciones y que algunas pueden fallar. La pantalla no dice
  cuáles: quedan los N formularios como estaban, sin marca de qué se creó. **Reintentar podría
  duplicar las que sí se crearon.**
- **`"Corresponde a..."`** es un label ambiguo para el campo de proyecto, especialmente con el campo
  `"Requisito"` justo debajo.
- **El default de visibilidad es `internal`** acá y `public` en el alta de requisito. Tercer par de
  defaults opuestos del producto.
- **Invalida la query del requisito de origen** tras crear (`:139-143`), lo que hace que el detalle
  del requisito muestre la tarea nueva al volver. Es el único caso del producto de invalidación
  cruzada entre dominios.
- **El envío múltiple usa `Promise.all` sin manejo de resultados parciales** (`:136`). Con 5
  formularios y un fallo en el tercero: dos tareas creadas, un toast de error, cinco formularios
  intactos y ningún registro de qué pasó. **Reintentar duplica.** `Promise.allSettled` daría el
  detalle por tarea; el código no lo usa.
- **El disparo del guardado pasa por un `useEffect`.** El botón setea `canCreate` y un efecto que
  observa ese estado ejecuta las mutaciones (`:108-156`). Es indirección: el submit no llama a la
  mutación, sino que setea una bandera que otro código observa.
- **No se relevaron con precisión** los anchos exactos de las dos columnas del layout
  (`objectives/new/styles.module.scss`). El resto del relevamiento está completo.
- **A confirmar en consolidación:** si los formularios deberían numerarse o titularse, qué debería
  pasar ante un fallo parcial, y de dónde sale la prioridad de una tarea.
