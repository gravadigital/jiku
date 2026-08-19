---
name: detalle-tarea
surface: web
route: /objectives/[id]
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Detalle de tarea

## Identidad

- **Audiencia primaria:** equipo-interno.
- **JTBD / Propósito:** consultar los metadatos de una tarea, su historial de cambios y sus comentarios, y agregar un comentario nuevo [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport de la superficie. La grilla de metadatos es de dos columnas exactas (`ObjectiveDetails.module.scss:99-103`) [fuente: código-existente].
  - Mobile queda fuera de la superficie `web`: el shell tiene una sidebar de 290px fija sin ninguna media query, así que por debajo de ese ancho no hay navegación disponible (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente]. La grilla de metadatos sí declara un corte propio en 767px vía el mixin `mobile` (`ObjectiveDetails.module.scss:106-108`), pero el resto de la pantalla —el encabezado con los dos botones, las listas de historial y comentarios, y el editor— no tiene tratamiento a ningún ancho, y el chrome tampoco.
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Desde listado-tareas · click en una fila (`TableRow.tsx:16`)
- Desde tareas-por-proyecto o tareas-por-responsable · click en una card (`ObjectiveCard.tsx:108`)
- Desde detalle-proyecto · click en una fila de la tabla de tareas (`ProjectObjectivesSection.tsx:~132`)
- Desde detalle-requisito · click en una fila de la tabla de tareas (`RequirementDetail.tsx:~206`)

**Salidas user-driven:**
- A `/objectives/by-project#project-{projectId}` · click en boton-volver (`objectives/[id]/page.tsx:21`)
- A `/objectives/edit/{id}` · click en boton-editar (`objectives/[id]/page.tsx:23`)
- A `/requirements/{requirementId}` · click en link-requisito (`ObjectiveDetails.tsx:118-120`)
- A `/projects/{projectId}` · click en link-proyecto (`ObjectiveDetails.tsx:79`)
- A una URL externa en pestaña nueva · click en link-url-externa (`ObjectiveDetails.tsx:88`)

**Salidas automáticas:**
- A `/objectives/{id}` · tras guardar un comentario nuevo, la pantalla navega a sí misma (`CommentEditor.tsx:107`)

Nota [fuente: código-existente]: **`"Volver"` no vuelve a donde se venía.** Siempre va a `/objectives/by-project#project-{projectId}`, incluso si se entró desde `/objectives`, desde el detalle de proyecto o desde el de requisito. Hay cuatro entradas posibles y una sola salida ofrecida.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | boton-volver | button | primary | navigation | desktop | — | Salida a la vista por proyecto |
| 2 | boton-editar | button | primary | navigation | desktop | — | Entrada a la edición |
| 3 | tarjeta-detalle | card | — | layout | desktop | — | Agrupa metadatos y descripción |
| 4 | tag-prioridad | badge | por prioridad 0-5 | content | desktop | — | Prioridad de la tarea |
| 5 | grilla-metadatos | section | — | layout | desktop | — | Dos columnas de metadatos |
| 6 | fila-metadato | paragraph | body | content | desktop | — | Un par etiqueta-valor |
| 7 | badge-estado | badge | por `data-state` | content | desktop | — | Estado de la tarea |
| 8 | link-proyecto | link | — | navigation | desktop | — | Navega al proyecto |
| 9 | link-requisito | link | — | navigation | desktop | — | Navega al requisito vinculado |
| 10 | link-url-externa | link | — | navigation | desktop | hidden_in_states: sin url definida | Abre la url externa en pestaña nueva |
| 11 | lista-equipo | list | — | content | desktop | — | Personas asignadas |
| 12 | descripcion-tarea | paragraph | body | content | desktop | — | Descripción en markdown |
| 13 | titulo-historial | heading | h2 | content | desktop | — | Encabeza el historial |
| 14 | lista-historial | list | — | content | desktop | hidden_in_states: empty del historial | Entradas de actividad |
| 15 | titulo-comentarios | heading | h2 | content | desktop | — | Encabeza los comentarios |
| 16 | lista-comentarios | list | — | content | desktop | hidden_in_states: empty de comentarios | Comentarios de la tarea |
| 17 | comentario | card | lectura / edición | content | desktop | — | Un comentario, editable in-place |
| 18 | badge-visibilidad-comentario | badge | public / internal | content | desktop | — | Marca si el comentario es visible para externos |
| 19 | boton-editar-comentario | button | — | input | desktop | — | Entra en modo edición del comentario |
| 20 | editor-comentario-nuevo | text-input | default · disabled | input | desktop | state_overrides: loading→disabled | Redacción del comentario nuevo |
| 21 | lista-adjuntos-borrador | list | — | content | desktop | visible_only_in_states: default (con adjuntos subidos) | Adjuntos del comentario en borrador |
| 22 | boton-quitar-adjunto | button | — | input | desktop | — | Quita un adjunto del borrador |
| 23 | checkbox-comentario-publico | checkbox | unchecked (default) / checked | input | desktop | — | Marca el comentario como público |
| 24 | boton-adjuntar-comentario | button | — | input | desktop | — | Sube un adjunto al borrador |
| 25 | boton-guardar-comentario | button | primary · loading / disabled | input | desktop | state_overrides: sin contenido→disabled; loading→spinner | Guarda el comentario nuevo |
| 26 | vacio-historial | empty-state | — | feedback | desktop | visible_only_in_states: empty del historial | Mensaje de historial vacío |
| 27 | vacio-comentarios | empty-state | — | feedback | desktop | visible_only_in_states: empty de comentarios | Mensaje de comentarios vacíos |

**Origen:** `src/app/(loggedin)/objectives/[id]/page.tsx`, `src/features/objectives/components/ObjectiveDetails/ObjectiveDetails.tsx`, `src/features/objectives/components/ObjectiveDetails/ObjectiveDetails.module.scss`, `src/features/objectives/components/ObjectiveHistoryList/ObjectiveHistoryList.tsx`, `src/features/objectives/components/ObjectiveComment/ObjectiveComment.tsx`, `src/shared/components/ui/CommentEditor/CommentEditor.tsx`.

Notas de transcripción [fuente: código-existente]:
- `fila-metadato` está relevado como `paragraph` porque el markup real es `<p><span>Etiqueta</span> valor</p>`, no una lista de definición — a diferencia de `detalle-proyecto` y `detalle-requisito`, que usan `<dl>`/`<dt>`/`<dd>`.
- `grilla-metadatos` está relevado como `section`.

## Layout por viewport

### desktop · 1440px

- boton-volver, boton-editar (en el encabezado de `PageLayout`; el array se renderiza en `row-reverse`, así que **`"Editar"` aparece a la izquierda de `"Volver"`**, `PageLayout.module.scss:33`)
- tarjeta-detalle
  - tag-prioridad
  - row `metadatos`
    - col 6/12: badge-estado (Estado), link-proyecto (Proyecto), link-url-externa (Url Externa), Área, Visibilidad, Creado por, link-requisito (Requisito)
    - col 6/12: Fecha de inicio, Fecha de finalización estimada, Fecha de cierre, Última actualización, Horas trabajadas, lista-equipo (Equipo)
  - descripcion-tarea
- titulo-historial
- lista-historial
- titulo-comentarios
- lista-comentarios
  - comentario × N (con badge-visibilidad-comentario y boton-editar-comentario)
- editor-comentario-nuevo
- lista-adjuntos-borrador
  - boton-quitar-adjunto por adjunto
- checkbox-comentario-publico
- boton-adjuntar-comentario
- boton-guardar-comentario

**Origen:** `ObjectiveDetails.module.scss:99-103` [fuente: código-existente]:

```scss
.metadataGrid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg); }
```

Fracciones de la grilla de metadatos: **exactas, 6/12 + 6/12**. El resto de la pantalla es una pila vertical a ancho completo, sin fracciones declaradas.

El módulo declara un corte propio en 767px (`@include mobile { grid-template-columns: 1fr; }`, `:106-108`) que colapsa la grilla a una columna en el orden del DOM, fuera de los viewports de la superficie.

## Contenido

### boton-volver
- Texto/label: `"Volver"` (`objectives/[id]/page.tsx:20`)
- Icono: nada
- Asset: nada
- Annotation: `<Button>` con `href` a `/objectives/by-project#project-{projectId}`. El orden visual está invertido por el `row-reverse` de `PageLayout.module.scss:33`

### boton-editar
- Texto/label: `"Editar"` (`objectives/[id]/page.tsx:23`)
- Icono: nada
- Asset: nada
- Annotation: `<Button>` con `href` a `/objectives/edit/{id}`

### tarjeta-detalle
- Texto/label: contenedor sin texto propio
- Icono: nada
- Asset: nada
- Annotation: `<SectionCard>` (`ObjectiveDetails.tsx:60`)

### tag-prioridad
- Texto/label: el número de prioridad crudo (0-5)
- Icono: nada
- Asset: nada
- Annotation: `<ProjectPriorityTag>` (`ObjectiveDetails.tsx:63`), sin leyenda de la escala

### grilla-metadatos
- Texto/label: contenedor de las filas de metadato
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.metadataGrid}>` (`ObjectiveDetails.tsx:66`)

### fila-metadato
- Texto/label: etiquetas verbatim, en el orden del DOM (`ObjectiveDetails.tsx:68-166`): `"Estado"` · `"Proyecto"` (vacío: `"No definido"`) · `"Url Externa"` (vacío: la fila no se renderiza) · `"Área"` · `"Visibilidad"` · `"Creado por"` · `"Requisito"` (si la query falla: `"Requisito no disponible"`) · `"Fecha de inicio"` · `"Fecha de finalización estimada"` (vacío: `"No definida"`) · `"Fecha de cierre"` (la fila solo aparece si existe) · `"Última actualización"` · `"Horas trabajadas"` (la fila solo aparece si existe) · `"Equipo"` (vacío: `"No hay personas asignadas"`)
- Icono: nada
- Asset: nada
- Annotation: markup `<p><span>Etiqueta</span> valor</p>`. Formato de la fecha de cierre: `toLocaleDateString('es-ES', { month: 'short', year: 'numeric', … })` (`:145-149`)

### badge-estado
- Texto/label: el estado de la tarea como texto dentro del `<span>`
- Icono: nada
- Asset: nada
- Annotation: `<span className={styles.statusLabel}>` con `data-state` (`ObjectiveDetails.tsx:71-73`)

### link-proyecto
- Texto/label: el nombre del proyecto
- Icono: nada
- Asset: nada
- Annotation: `<a onClick={handleClick}>` **sin `href`** (`ObjectiveDetails.tsx:79`)

### link-requisito
- Texto/label: el identificador del requisito vinculado; `"Requisito no disponible"` si la query falla
- Icono: nada
- Asset: nada
- Annotation: `<Link href="/requirements/{id}">` (`ObjectiveDetails.tsx:118-120`)

### link-url-externa
- Texto/label: la url externa
- Icono: nada
- Asset: nada
- Annotation: `<a target="_blank" rel="noopener noreferrer">` sin aviso de que abre en pestaña nueva (`ObjectiveDetails.tsx:88`)

### lista-equipo
- Texto/label: un `<li>` por persona; `"No hay personas asignadas"` si no hay ninguna
- Icono: nada
- Asset: nada
- Annotation: `<ul>` con `<li>` (`ObjectiveDetails.tsx:169`, `:25`, `:46`)

### descripcion-tarea
- Texto/label: etiqueta `"Descripción"` (`ObjectiveDetails.tsx:175`); contenido `objective.description` renderizado como markdown, o `"No definida"` (`:179`, `:181`)
- Icono: nada
- Asset: nada
- Annotation: `<MarkdownViewer>`

### titulo-historial
- Texto/label: `"Historial de cambios"` (`ObjectiveHistoryList.tsx:101`)
- Icono: nada
- Asset: nada
- Annotation: nada

### lista-historial
- Texto/label: por entrada, el nombre del usuario, el tipo de actividad vía `getObjectiveTypeOfActivity`, el valor anterior y el nuevo (vía `getObjectiveState`), y la fecha en un `Tooltip` (`:39-61`). Valor nuevo vacío: `"No definida"` (`:52`)
- Icono: nada
- Asset: nada
- Annotation: las actividades de tipo `description` no muestran el cambio de valor (`:44`), solo que hubo un cambio

### titulo-comentarios
- Texto/label: `"Comentarios"` (`ObjectiveHistoryList.tsx:104`)
- Icono: nada
- Asset: nada
- Annotation: el feed se parte en dos listas filtrando por `typeOfActivity === 'comment'` (`:22`, `:28`)

### lista-comentarios
- Texto/label: contenedor de los comentarios
- Icono: nada
- Asset: nada
- Annotation: `<ul className={styles.connectedComments}>` (`ObjectiveHistoryList.tsx:75`)

### comentario
- Texto/label: autor dinámico (`ObjectiveComment.tsx:79`); marca `"(editado)"` con `Tooltip` en los modificados (`:94`); fecha en un `Tooltip` con `` `Creación: ${fecha}` `` (`:98`); contenido en markdown vía `<MarkdownViewer>` (`:116`). En edición, botones `"Cancelar"` y `"Guardar"` (`:124`, `:130`)
- Icono: nada
- Asset: nada
- Annotation: toast de éxito `"Comentario editado exitosamente"` (`:60`); toasts de error `"El comentario no puede estar vacío"` (`:51`) y `"Hubo un error al editar el comentario"` (`:66`)

### badge-visibilidad-comentario
- Texto/label: `"👁"` (público) o `"🔒"` (interno), con `Tooltip` `"Visible para externos"` / `"Solo interno"` (`ObjectiveComment.tsx:81`, `:84`)
- Icono: nada
- Asset: nada
- Annotation: el emoji es el único indicador visible; el significado vive en un tooltip de `:hover`

### boton-editar-comentario
- Texto/label: sin texto; `aria-label="Editar comentario"` (`ObjectiveComment.tsx:136-143`, `:140`)
- Icono: icono de edición, `<Image>` con `alt="Editar"` (`:142`)
- Asset: nada
- Annotation: el `alt` de la imagen es redundante con el `aria-label` del botón

### editor-comentario-nuevo
- Texto/label: placeholder `"Escribe un comentario..."` (`CommentEditor.tsx:121`); `ariaLabel="Comentario"` (`:120`)
- Icono: nada
- Asset: nada
- Annotation: tuteo peninsular (`"Escribe"`), a diferencia del voseo del resto del producto. Se deshabilita durante el guardado (`disabled={loading}`, `:123`)

### lista-adjuntos-borrador
- Texto/label: los nombres de los adjuntos ya subidos al borrador
- Icono: nada
- Asset: nada
- Annotation: los adjuntos se suben con `entityType: 'objective_comment_draft'` y el `objectiveId` como `entityId` (`CommentEditor.tsx:50`), antes de que el comentario exista

### boton-quitar-adjunto
- Texto/label: `"×"` como texto; `aria-label="Quitar adjunto"` (`CommentEditor.tsx:134`, `:136`)
- Icono: nada
- Asset: nada
- Annotation: el `aria-label` no dice cuál adjunto; con varios, todos tienen el mismo nombre accesible

### checkbox-comentario-publico
- Texto/label: `"Comentario público (visible para usuarios externos)"` (`CommentEditor.tsx:150`)
- Icono: nada
- Asset: nada
- Annotation: default sin marcar (`isPublic = false`, `:30`), o sea interno por defecto. El `<input type="checkbox">` está envuelto en el `<label>` (`:144-151`)

### boton-adjuntar-comentario
- Texto/label: el de `<AttachFileButton>` (`CommentEditor.tsx:152`)
- Icono: nada
- Asset: nada
- Annotation: error de permisos al subir: toast `"No tenés permisos para subir archivos a esta tarea"` (`:38`)

### boton-guardar-comentario
- Texto/label: `"Guardar"` (`CommentEditor.tsx:155`)
- Icono: nada
- Asset: nada
- Annotation: `loading={loading || isUploading}` y `disabled={isEmpty}` — se habilita cuando hay texto o al menos un adjunto (`:45`). Toast de éxito `"Comentario agregado exitosamente"` (`:101`); de error `"Hubo un error al agregar el comentario"` (`:110`)

### vacio-historial
- Texto/label: `"No hay cambios aún"` (`ObjectiveHistoryList.tsx:33`)
- Icono: nada
- Asset: nada
- Annotation: es un `<div>` que se renderiza dentro de un `<ul>`

### vacio-comentarios
- Texto/label: `"No hay comentarios aún"` (`ObjectiveHistoryList.tsx:71`)
- Icono: nada
- Asset: nada
- Annotation: es un `<div>` que se renderiza dentro de un `<ul>`

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). `getObjectiveById` resuelve (`objectives/[id]/page.tsx:12-33`)
- Sub-estado `comentario en edición`: click en boton-editar-comentario reemplaza el markdown por el editor, con `"Cancelar"` y `"Guardar"` (`ObjectiveComment.tsx:120-134`)

### empty
- Aplica: Sí
- Mensaje: `"No hay cambios aún"` (historial) · `"No hay comentarios aún"` (comentarios) · `"No hay personas asignadas"` (equipo)
- Cambios:
  - vacio-historial: solo visible cuando `activities.length === 0`; lista-historial oculta (`ObjectiveHistoryList.tsx:32-34`)
  - vacio-comentarios: solo visible cuando `commentActivities.length === 0`; lista-comentarios oculta (`:70-72`)
  - lista-equipo: content=`"No hay personas asignadas"` cuando `!objective.persons || objective.persons.length === 0` (`ObjectiveDetails.tsx:25`, `:46`)

### loading
- Aplica: Sí (solo para el guardado de comentario)
- Mensaje: spinner en boton-guardar-comentario vía `<Button loading>` (`CommentEditor.tsx:157`)
- Cambios:
  - editor-comentario-nuevo: variant=disabled (`disabled={loading}`, `:123`)
  - boton-guardar-comentario: spinner (state_override)
- Nota: **no hay loading inicial.** No existe `objectives/[id]/loading.tsx`, así que la navegación hacia esta pantalla no tiene feedback mientras el Server Component espera la respuesta: la pantalla anterior queda congelada [fuente: código-existente]

### error de validación
- Aplica: Sí (parcialmente)
- Mensaje: toast `"El comentario no puede estar vacío"` (`ObjectiveComment.tsx:51`)
- Cambios: solo el toast. **El mensaje no aparece junto al campo**, y es la única validación de la pantalla [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí (parcialmente)
- Mensaje: `"Requisito no disponible"` en la fila del requisito (`ObjectiveDetails.tsx:116`); toast `"Hubo un error al editar el comentario"` (`ObjectiveComment.tsx:66`) o `"Hubo un error al agregar el comentario"` (`CommentEditor.tsx:110`)
- Cambios:
  - link-requisito: content=`"Requisito no disponible"` cuando `hasRequirementError` de `useRequirement` (state_override, `ObjectiveDetails.tsx:19-23`)
  - El resto: solo toasts
- Nota: **la pantalla no tiene boundary propio.** Hereda el `error.tsx` de `/objectives`, que descarta el error real y muestra `"Error inesperado"` (`objectives/error.tsx:5-9`) [fuente: código-existente]

### success
- Aplica: Sí
- Mensaje: toast `"Comentario agregado exitosamente"` (`CommentEditor.tsx:101`) · toast `"Comentario editado exitosamente"` (`ObjectiveComment.tsx:60`)
- Cambios: tras agregar un comentario, la pantalla hace `push('/objectives/{id}')` — **la ruta en la que ya está** (`CommentEditor.tsx:107`)

### not found
- Aplica: No — no implementado (ver gaps-as-is.md). `getObjectiveById(id)` corre sin try/catch y sin validar el id: un id inexistente o no numérico lanza y lo agarra el `error.tsx` de `/objectives`, que muestra `"Error inesperado"` sin decir qué pasó (`objectives/[id]/page.tsx:11-12`, `objectives/error.tsx:9`) [fuente: código-existente]

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). Una tarea `finalizado` o `cancelado` ofrece el mismo botón `"Editar"` y el mismo editor de comentarios; el estado es una fila de metadato más (`objectives/[id]/page.tsx:23`, `:31`) [fuente: código-existente]

## Interacciones

**Eventos:** [fuente: código-existente]
- boton-volver · click → navega a `/objectives/by-project#project-{projectId}` (`objectives/[id]/page.tsx:21`)
- boton-editar · click → navega a `/objectives/edit/{id}` (`objectives/[id]/page.tsx:23`)
- link-proyecto · click → `handleClick` navega al proyecto (`ObjectiveDetails.tsx:79`)
- link-requisito · click → navega al requisito (`ObjectiveDetails.tsx:118`)
- link-url-externa · click → abre en pestaña nueva (`ObjectiveDetails.tsx:88`)
- boton-editar-comentario · click → entra en modo edición (`ObjectiveComment.tsx:138`)
- `"Guardar"` del comentario en edición · click → valida no vacío y muta (`ObjectiveComment.tsx:49-67`)
- `"Cancelar"` del comentario en edición · click → `handleCancel` descarta lo editado sin aviso (`ObjectiveComment.tsx:124`)
- boton-guardar-comentario · click → guarda el comentario nuevo y navega a la ruta actual (`CommentEditor.tsx:107`)

**Validaciones:**
- comentario editado · no vacío → toast `"El comentario no puede estar vacío"` (`ObjectiveComment.tsx:50-52`)
- boton-guardar-comentario · `disabled={isEmpty}` hasta que haya texto o al menos un adjunto, sin mensaje (`CommentEditor.tsx:45`, `:158`)

**Feedback:**
- Toasts para el alta y la edición de comentario
- `Tooltip` con la fecha completa en el historial y en cada comentario
- Marca `"(editado)"` en los comentarios modificados

**Acciones ausentes** [fuente: código-existente]: no se puede borrar un comentario (solo editarlo, `ObjectiveComment.tsx:120-145`), ni borrar la tarea desde esta pantalla — existe un `<DeleteObjectiveButton>` con label `"Eliminar"` (`DeleteObjectiveButton.tsx:15`) que no se monta acá ni en ningún otro lado.

## Accesibilidad

- **Orden de foco:** boton-editar → boton-volver (el `row-reverse` de `PageLayout` invierte el orden visual pero no el del DOM, `PageLayout.module.scss:33`) → link-requisito → link-url-externa → boton-editar-comentario de cada comentario → editor-comentario-nuevo → boton-quitar-adjunto de cada adjunto → checkbox-comentario-publico → boton-adjuntar-comentario → boton-guardar-comentario. **`link-proyecto` no está en el orden de foco:** es un `<a onClick>` sin `href`, así que no es enfocable por teclado ni se anuncia como enlace (`ObjectiveDetails.tsx:79`) [fuente: código-existente].
- **Landmarks y jerarquía:** los landmarks son los del shell. Un solo `<h1>`, el del `PageLayout` (el título de la tarea, `objectives/[id]/page.tsx:16`), y dos `<h2>`: `"Historial de cambios"` y `"Comentarios"` (`ObjectiveHistoryList.tsx:101`, `:104`). Correcto. **La estructura de metadatos no es semántica:** `<p><span>Etiqueta</span> valor</p>` en vez de `<dl>`/`<dt>`/`<dd>`, así que la relación etiqueta-valor no se anuncia (`ObjectiveDetails.tsx:68-166`).
- **Foco y teclado:** la pantalla no abre modales ni dropdowns propios, así que no introduce focus traps. Los `Tooltip` del historial y de los comentarios son de `:hover` puro. No hay atajos de teclado propios.
- **Propio de esta composición:** **HTML inválido en las dos listas de actividad:** el empty de historial y el de comentarios devuelven un `<div>` que se renderiza dentro de un `<ul>` (`<ul>{renderActivityContent(...)}</ul>`, `ObjectiveHistoryList.tsx:33`, `:102`). **La visibilidad de cada comentario se comunica solo por emoji** (`👁` / `🔒`), con el significado en un `Tooltip` de `:hover`: los emoji los leen los lectores de pantalla, pero como `"ojo"` / `"candado"`, no como `"público"` / `"interno"` (`ObjectiveComment.tsx:84`). **Las fechas completas viven solo en tooltips de `:hover`** y son inalcanzables por teclado (`ObjectiveHistoryList.tsx:56`, `ObjectiveComment.tsx:98`). `boton-guardar-comentario` está `disabled` sin `aria-describedby` que explique por qué (`CommentEditor.tsx:158`), y `boton-quitar-adjunto` no identifica cuál adjunto quita (`CommentEditor.tsx:134`). El tag de prioridad muestra el número crudo sin leyenda de la escala (`ObjectiveDetails.tsx:63`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
