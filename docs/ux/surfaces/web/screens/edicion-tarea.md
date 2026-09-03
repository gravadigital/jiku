---
name: edicion-tarea
surface: web
route: /objectives/edit/[id]
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.1"
date: 2026-09-02
---

# Pantalla: Edición de tarea

## Identidad

- **Audiencia primaria:** equipo-interno.
- **JTBD / Propósito:** editar una tarea existente: título, proyecto, requisito, responsables, área, estado, prioridad, visibilidad, fecha estimada y descripción. Es la única pantalla del producto donde se puede setear la prioridad de una tarea [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport de la superficie. La pantalla no declara ningún tratamiento responsive: la tarjeta de formulario se rinde a dos columnas a cualquier ancho [fuente: código-existente].
  - Mobile queda fuera de la superficie `web`: el shell tiene una sidebar de 290px fija sin ninguna media query, así que por debajo de ese ancho no hay navegación disponible (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Desde detalle-tarea · botón `"Editar"` (`objectives/[id]/page.tsx:23`)

**Salidas user-driven:**
- Ninguna. **No hay botón de volver ni cancelar** (`:239-433`)

**Salidas automáticas:**
- A `/objectives/{id}` · tras guardar con éxito, al detalle de la tarea (`:207`)

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | cargando-datos | loader | — | feedback | desktop | visible_only_in_states: loading inicial | Espera de la tarea y las personas |
| 2 | boton-guardar | button | primary · loading / disabled | input | desktop | state_overrides: loading→spinner | Guarda la tarea |
| 3 | tarjeta-formulario | card | — | layout | desktop | — | Contiene los diez campos |
| 4 | campo-titulo | text-input | default / error | input | desktop | state_overrides: error de validación→error | Título de la tarea |
| 5 | campo-proyecto | text-input | **disabled** | input | desktop | — | Proyecto, no editable |
| 6 | campo-requisito | dropdown | closed / open | input | desktop | — | Requisito vinculado |
| 7 | campo-responsables | dropdown | multi · error | input | desktop | state_overrides: error de validación→error | Personas responsables |
| 8 | campo-area | dropdown | closed / open · error | input | desktop | state_overrides: error de validación→error | Área de la tarea |
| 9 | campo-estado | dropdown | closed / open · error | input | desktop | state_overrides: error de validación→error | Estado de la tarea |
| 10 | campo-prioridad | dropdown | closed / open · error | input | desktop | state_overrides: error de validación→error | Prioridad de la tarea |
| 11 | campo-visibilidad | dropdown | closed / open | input | desktop | — | Público o interno |
| 12 | campo-fecha-estimada | date-picker | default | input | desktop | — | Fecha estimada de finalización |
| 13 | campo-descripcion | text-input | default / error | input | desktop | state_overrides: error de validación→error | Descripción de la tarea |
| 14 | mensaje-error-formulario | alert | error | feedback | desktop | visible_only_in_states: error de validación | Mensaje agregado del formulario |

**Origen:** `src/app/(loggedin)/objectives/edit/[id]/page.tsx:220-437`, `src/app/(loggedin)/objectives/edit/[id]/styles.module.scss`, `src/features/objectives/hooks/useObjective.ts`, `src/features/objectives/hooks/useUpdateObjective.ts`.

Notas de transcripción [fuente: código-existente]:
- Usa los componentes compartidos, igual que el alta, y a diferencia de los formularios de proyecto y requisito.
- **Un solo formulario:** sin `"Clonar"` ni `"Borrar"`, sin array de formularios (`:239`).
- El bloque de error del formulario es distinto del alta: acá es `<p>* Campos incompletos</p>` **sin icono** (`:435-437`), mientras el alta muestra `"Revisá que no haya campos incompletos"` con un icono de error.
- El título de la pantalla (`"Tareas / editar"`) lo aporta el shell vía `PageLayout` (`:238`).

## Layout por viewport

### desktop · 1440px

- boton-guardar (en el `actions` de `PageLayout`, junto al título)
- tarjeta-formulario
  - row `formulario`: los 10 campos repartidos entre `.textareaCont` y `.column`
  - mensaje-error-formulario

**Origen:** `objectives/edit/[id]/styles.module.scss`.

**Las fracciones no son derivables de este relevamiento:** los anchos exactos de las dos columnas no se leyeron [fuente: código-existente].

## Contenido

### cargando-datos
- Texto/label: `"Cargando..."` (`:~232`)
- Icono: nada
- Asset: nada
- Annotation: `<Loader>`; reemplaza toda la pantalla, incluido el título

### boton-guardar
- Texto/label: `"Guardar"` (`:220-223`)
- Icono: nada
- Asset: nada
- Annotation: va en el `actions` de `PageLayout`, o sea **fuera del `<form>`** de la tarjeta

### tarjeta-formulario
- Texto/label: contenedor sin texto propio — la tarjeta no tiene encabezado
- Icono: nada
- Asset: nada
- Annotation: `<SectionCard>` (`:239`)

### campo-titulo
- Texto/label: label `"Título"`; placeholder `"Título de la tarea"` (`:243-252`)
- Icono: nada
- Asset: nada
- Annotation: editable

### campo-proyecto
- Texto/label: label `"Corresponde a..."`; sin placeholder (`:254-261`)
- Icono: nada
- Asset: nada
- Annotation: **`<InputText disabled>`** — una tarea no se puede reasignar a otro proyecto desde esta pantalla. En el alta el mismo campo es un select editable. No hay mensaje que lo explique

### campo-requisito
- Texto/label: label `"Requisito"`; placeholder `"Seleccionar requisito (opcional)"` (`:263-272`)
- Icono: nada
- Asset: nada
- Annotation: editable

### campo-responsables
- Texto/label: label `"Responsable(s)"`; placeholder `"Nombre(s)"` (`:273-289`)
- Icono: nada
- Asset: nada
- Annotation: editable, obligatorio

### campo-area
- Texto/label: label `"Área"`; placeholder `"Área de la tarea"`. Opciones verbatim: `"Diseño"` · `"Desarrollo"` · `"Gestión"` · `"Investigación"` (`:296-313`)
- Icono: nada
- Asset: nada
- Annotation: editable, obligatorio

### campo-estado
- Texto/label: label `"Estado"`; placeholder `"Estado de la tarea"`. Opciones verbatim: `"Activo"` (`activo`) · `"Backlog"` (`backlog`) · `"En revisión"` (`en_revision`) · `"Finalizado"` (`finalizado`) · `"Cancelado"` (`cancelado`) (`:327-348`)
- Icono: nada
- Asset: nada
- Annotation: editable, obligatorio. Ofrece las 5 opciones sin restricción, incluido volver de `finalizado` a `activo`. Es el mismo conjunto que el dropdown inline de `<StateTag>` en el listado y las cards

### campo-prioridad
- Texto/label: label `"Prioridad"`; placeholder `"Prioridad de la tarea"` (`:355-389`)
- Icono: nada
- Asset: nada
- Annotation: editable, obligatorio. **Es el único lugar del producto donde se setea la prioridad de una tarea**

### campo-visibilidad
- Texto/label: label `"Nivel de visibilidad"`; sin placeholder. Opciones verbatim: `"Público"` (`public`) · `"Interno"` (`internal`) (`:397-405`)
- Icono: nada
- Asset: nada
- Annotation: editable

### campo-fecha-estimada
- Texto/label: label `"Fecha de finalización estimada"`; sin placeholder (`:410-419`)
- Icono: nada
- Asset: nada
- Annotation: editable

### campo-descripcion
- Texto/label: label `"Descripción"`; placeholder `"Descripción de la tarea"` (`:422-431`)
- Icono: nada
- Asset: nada
- Annotation: editable, obligatorio. `<InputTextarea>`

### mensaje-error-formulario
- Texto/label: `"* Campos incompletos"` (`:435-437`)
- Icono: nada — **sin icono**, a diferencia del alta
- Asset: nada
- Annotation: `<div className={styles.generalError}>` con un `<p>`. El asterisco inicial sugiere una nota al pie, pero no hay ningún asterisco en los labels que lo referencie

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). La tarea resuelta y el estado local poblado (`:239-433`)

### empty
- Aplica: No — no implementado (ver gaps-as-is.md)

### loading
- Aplica: Sí
- Mensaje: `"Cargando..."` (inicial, `:~232`) · spinner en el botón (durante el guardado, `:220-223`)
- Cambios:
  - **Loading inicial** (`isLoadingObjective || isLoadingPersons || !formInitialized`): cargando-datos solo visible en este estado; reemplaza toda la pantalla, incluido el título (`:231-235`)
  - **Loading del guardado** (`isPending`): boton-guardar muestra spinner (state_override)
- Nota: `!formInitialized` es un tercer gate además de los dos `isLoading` — es la bandera que se levanta cuando el estado local del formulario se pobló desde la tarea

### error de validación
- Aplica: Sí
- Mensaje: `"* Campos incompletos"` (`:64`, `:435-437`)
- Cambios:
  - mensaje-error-formulario: solo visible en este estado, debajo de los campos, sin icono (visible_only_in_states)
  - campo-titulo / campo-responsables / campo-area / campo-estado / campo-prioridad / campo-descripcion: state=error vía `fieldHasError` (state_override, `:250`, `:287`, `:316`, `:351`, `:388`, `:429`)
- Disparado por `generalError === true`, seteado en el submit

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: toast `error?.message ?? "Hubo un error al editar la tarea"` (`:203-205`)
- Cambios:
  - Solo el toast; el formulario queda con los datos
- Nota: **el error al cargar la tarea no se maneja.** `useObjective` se desestructura como `{ data: objective, isLoading: isLoadingObjective }` e ignora `isError`; como la condición de carga incluye `!formInitialized` y esa bandera solo pasa a `true` cuando la tarea llegó, ante un fallo queda un **loader infinito** (`:68`, `:231-235`). `usePersons` tampoco maneja `isError`: el select de responsables queda vacío (`:69`) [fuente: código-existente]

### success
- Aplica: Sí
- Mensaje: toast `"Tarea editada con éxito"` (`:208`)
- Cambios: navega a `/objectives/{id}` (`:207`)

### not found
- Aplica: No — no implementado (ver gaps-as-is.md). Una tarea inexistente produce el mismo loader infinito; no hay `notFound()`, y el id no numérico no se valida — el tipo declara `Promise<{ id: number }>` pero el valor de la URL es string, así que `/objectives/edit/abc` pasa `"abc"` a la api (`:59-60`, `:231-235`) [fuente: código-existente]

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). Una tarea `finalizado` o `cancelado` se edita igual, y el select permite volverla a `activo` sin restricción (`:327-348`) [fuente: código-existente]

## Interacciones

**Eventos:** [fuente: código-existente]
- cada campo · on change → `handleInputChange(campo, valor)` sobre el estado local (`:248`, `:269`, `:281-287`, `:315`, `:350`, `:387`, `:406`, `:417`, `:427`)
- boton-guardar · click → valida y llama a la mutación (`:222`)
- `<form>` · submit → `handleSubmit` con `preventDefault()`

**Validaciones:**
- campo-titulo · `fieldHasError('title', valor)` → marca el campo; mensaje agregado `"* Campos incompletos"` (`:250`, `:435-437`)
- campo-responsables · `fieldHasError('personIds', valor)` → marca el campo; mismo mensaje agregado (`:287`)
- campo-area · `fieldHasError('area', valor)` → marca el campo; mismo mensaje agregado (`:316`)
- campo-estado · `fieldHasError('state', valor)` → marca el campo; mismo mensaje agregado (`:351`)
- campo-prioridad · `fieldHasError('priority', valor)` → marca el campo; mismo mensaje agregado (`:388`)
- campo-descripcion · `fieldHasError('description', valor)` → marca el campo; mismo mensaje agregado (`:429`)

**Feedback:**
- Campos marcados con la prop `error`
- Spinner en el botón de guardar
- Toast del resultado

## Accesibilidad

- **Orden de foco:** boton-guardar → campo-titulo → campo-requisito → campo-responsables → campo-area → campo-estado → campo-prioridad → campo-visibilidad → campo-fecha-estimada → campo-descripcion. **`campo-proyecto` queda fuera del orden de tabulación** por estar `disabled`, y no hay `aria-describedby` que diga por qué no se puede cambiar (`:254-261`). **El botón de guardar está fuera del `<form>`** de la tarjeta, en el `actions` de `PageLayout` (`:220-223`, `:~240`): Enter en un campo y el click en el botón son caminos distintos [fuente: código-existente].
- **Landmarks y jerarquía:** los landmarks son los del shell. Un solo `<h1>`, el del `PageLayout` (`"Tareas / editar"`, `:238`). La tarjeta no tiene encabezado, lo cual es aceptable con un solo formulario, a diferencia del alta (`:239`).
- **Foco y teclado:** los menús de los `InputSelect` son los overlays de esta composición; su comportamiento de foco lo aportan los componentes compartidos. No hay atajos propios ni focus traps.
- **Propio de esta composición:** `mensaje-error-formulario` no tiene `role="alert"` relevado, así que al aparecer no se anuncia (`:250`). No se verificó si los componentes `Input*` vinculan la prop `error` con `aria-invalid` / `aria-describedby` (`:250`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
- **[REQ-013] La identidad cambia; la pantalla, no.** Esta ficha documenta *qué* hay en la pantalla y *para qué* está; el Manual de marca Jiku v1.0 cambia **con qué está construido**. El accent pasa del magenta `#DA2C6A` al verde agua `#61CCB9` sobre azul oscuro `#0B1934` con fondo niebla `#F6F6F9`, y Archivo se reemplaza por Sora (títulos de vista) + Gabarito (interfaz, datos, microcopy). Ningún bloque de esta pantalla se agrega, se elimina ni cambia de propósito por ese motivo [REQ-013 RF-1, RF-2, CA-1].
- **[REQ-013] Cada elemento hecho a mano pasa a su componente del Design System.** Los bloques que esta ficha declara —botones, campos, selects, tarjetas, tablas, badges— se implementan con los componentes normativos de `docs/design-system/web/components/`, no con marcado propio. Es un cambio de implementación con consecuencia visible —dejan de haber dos botones que se ven distinto haciendo lo mismo— pero **no cambia la estructura declarada acá**: un bloque que ya existía sigue existiendo, con el mismo tipo y el mismo propósito [REQ-013 RF-3, RF-4, CA-5, CA-10].
- **[REQ-013] Los estados declarados en esta ficha se conservan.** La migración es de presentación: ningún estado se agrega, se quita ni cambia su condición de disparo. Lo que cambia es cómo se ve cada uno —el loader es ahora uno solo, el vacío tiene componente `EmptyState` disponible— sin que la ficha declare estados nuevos. **Cablear `EmptyState` en las pantallas que hoy no tienen estado vacío queda fuera de este REQ** y sigue registrado en `gaps-as-is.md` [REQ-013 §Fuera de Alcance].
- **[REQ-013] `desktop` sigue siendo el viewport único.** El requerimiento **no** habilita mobile: el DS mantiene el responsive del shell como objetivo declarado sin fecha y no declara el viewport `mobile` hasta que el shell lo cumpla. El layout por viewport de esta ficha no cambia [REQ-013 §Fuera de Alcance, CA-15].
- **[REQ-013] El selector de tema vive en el shell, no en esta pantalla.** La superficie gana modo oscuro con un control para elegirlo, ubicado en el pie de la sidebar junto a Cerrar sesión. Como es parte del shell de `(loggedin)`, está presente acá pero **no se declara como bloque de esta ficha**: declararlo en las 21 pantallas autenticadas repetiría veintiuna veces el mismo control. En modo oscuro esta pantalla usa la paleta propia del DS —canvas `#0E121A`, superficies `#1B202C` separadas por contraste y sin borde—, no una inversión de la clara [REQ-013 RF-7, CA-11].
