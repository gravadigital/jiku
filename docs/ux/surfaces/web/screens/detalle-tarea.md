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
version: "1.2"
date: 2026-09-02
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
| 10 | lista-equipo | list | — | content | desktop | — | Personas asignadas |
| 11 | descripcion-tarea | paragraph | body | content | desktop | — | Descripción en markdown |
| 12 | titulo-historial | heading | h2 | content | desktop | — | Encabeza el historial |
| 13 | lista-historial | list | — | content | desktop | hidden_in_states: empty del historial | Entradas de actividad |
| 14 | titulo-comentarios | heading | h2 | content | desktop | — | Encabeza los comentarios |
| 15 | lista-comentarios | list | — | content | desktop | hidden_in_states: empty de comentarios | Comentarios de la tarea |
| 16 | comentario | card | lectura / edición | content | desktop | — | Un comentario, editable in-place |
| 17 | badge-visibilidad-comentario | badge | public / internal | content | desktop | — | Marca si el comentario es visible para externos |
| 18 | boton-editar-comentario | button | — | input | desktop | **solo si el usuario es autor del comentario o tiene rol `admin`** | Entra en modo edición del comentario |
| 19 | editor-comentario-nuevo | text-input | default · disabled | input | desktop | state_overrides: loading→disabled | Redacción del comentario nuevo |
| 20 | lista-adjuntos-pendientes | list | — | content | desktop | visible_only_in_states: default (con archivos ya subidos) | Archivos subidos, todavía sin vincular al comentario |
| 21 | boton-quitar-adjunto | button | — | input | desktop | — | Saca un archivo del comentario en curso |
| 22 | checkbox-comentario-publico | checkbox | unchecked (default) / checked | input | desktop | — | Marca el comentario como público |
| 23 | boton-adjuntar-comentario | button | — | input | desktop | — | Sube un archivo, de a uno por vez |
| 24 | boton-guardar-comentario | button | primary · loading / disabled | input | desktop | state_overrides: sin contenido→disabled; loading→spinner | Guarda el comentario nuevo |
| 25 | vacio-historial | empty-state | — | feedback | desktop | visible_only_in_states: empty del historial | Mensaje de historial vacío |
| 26 | vacio-comentarios | empty-state | — | feedback | desktop | visible_only_in_states: empty de comentarios | Mensaje de comentarios vacíos |
| 27 | progreso-subida-adjunto | progress-bar | — | feedback | desktop | visible_only_in_states: subiendo adjunto | Progreso real de la subida del archivo en curso |
| 28 | marca-identidad-automatica | badge | automatico | content | desktop | hidden_in_states: empty del historial, empty de comentarios | Marca que el autor mostrado es una identidad de servicio y no una persona |
| 29 | marca-comentario-editado | badge | editado / editado-por-otro | content | desktop | **solo en comentarios con fecha de edición** | Indica que el comentario fue editado, y por quién si no fue su autor |
| 30 | lista-adjuntos-comentario | list | — | content | desktop | visible_only_in_states: comentario en edición (con adjuntos) | Adjuntos del comentario que se está editando, con la opción de quitarlos |

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
    - col 6/12: badge-estado (Estado), link-proyecto (Proyecto), Área, Visibilidad, Creado por *(con marca-identidad-automatica cuando el creador es una identidad de servicio)*, link-requisito (Requisito)
    - col 6/12: Fecha de inicio, Fecha de finalización estimada, Fecha de cierre, Última actualización, Horas trabajadas, lista-equipo (Equipo)
  - descripcion-tarea
- titulo-historial
- lista-historial *(con marca-identidad-automatica junto al autor de cada entrada de una identidad de servicio)*
- titulo-comentarios
- lista-comentarios
  - comentario × N (con badge-visibilidad-comentario, marca-identidad-automatica *(solo si el autor es una identidad de servicio)*, marca-comentario-editado *(solo si fue editado)* y boton-editar-comentario *(solo para su autor o para un `admin`)*; en edición, el markdown se reemplaza por el editor con lista-adjuntos-comentario, boton-adjuntar-comentario y los botones `"Cancelar"` / `"Guardar"`)
- editor-comentario-nuevo
- lista-adjuntos-pendientes
  - boton-quitar-adjunto por archivo
- progreso-subida-adjunto *(solo mientras sube)*
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
- Texto/label: etiquetas verbatim, en el orden del DOM (`ObjectiveDetails.tsx:68-166`): `"Estado"` · `"Proyecto"` (vacío: `"No definido"`) · `"Área"` · `"Visibilidad"` · `"Creado por"` · `"Requisito"` (si la query falla: `"Requisito no disponible"`) · `"Fecha de inicio"` · `"Fecha de finalización estimada"` (vacío: `"No definida"`) · `"Fecha de cierre"` (la fila solo aparece si existe) · `"Última actualización"` · `"Horas trabajadas"` (la fila solo aparece si existe) · `"Equipo"` (vacío: `"No hay personas asignadas"`)
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
- Texto/label: autor: el nombre del usuario de Jiku que escribió el comentario (`ObjectiveComment.tsx:79`, alimentado por `ObjectiveHistoryList.tsx:80`); la marca de editado pasa a ser marca-comentario-editado (ver abajo); fecha en un `Tooltip` con `` `Creación: ${fecha}` `` (`:98`); contenido en markdown vía `<MarkdownViewer>` (`:116`). En edición, botones `"Cancelar"` y `"Guardar"` (`:124`, `:130`)
- Icono: nada
- Asset: nada
- Annotation: toast de éxito `"Comentario editado exitosamente"` (`:60`); toasts de error `"El comentario no puede estar vacío"` (`:51`) y `"Hubo un error al editar el comentario"` (`:66`). **El autor no tiene variantes**: con REQ-003 desaparece la rama que sufijaba `"(En sistema externo)"` al nombre cuando la actividad venía de un sistema externo — nunca se renderizó, porque nada escribía esos campos

### badge-visibilidad-comentario
- Texto/label: `"👁"` (público) o `"🔒"` (interno), con `Tooltip` `"Visible para externos"` / `"Solo interno"` (`ObjectiveComment.tsx:81`, `:84`)
- Icono: nada
- Asset: nada
- Annotation: el emoji es el único indicador visible; el significado vive en un tooltip de `:hover`

### boton-editar-comentario
- Texto/label: sin texto; `aria-label="Editar comentario"` (`ObjectiveComment.tsx:136-143`, `:140`)
- Icono: icono de edición, `<Image>` con `alt="Editar"` (`:142`)
- Annotation: **cambia con REQ-011.** Hasta acá aparecía solo para el autor del comentario; ahora también para un `admin`, que puede editar comentarios ajenos con las mismas capacidades (RF-3, CA-4). El resto no cambia: para quien no puede editar, el botón sigue sin estar —no deshabilitado, ausente— y las entradas del historial de cambios nunca lo tuvieron ni lo tendrán, porque un cambio de campo no es editable (RF-12, CA-12)
- Asset: nada
- Annotation: el `alt` de la imagen es redundante con el `aria-label` del botón

### editor-comentario-nuevo
- Texto/label: placeholder `"Escribe un comentario..."` (`CommentEditor.tsx:121`); `ariaLabel="Comentario"` (`:120`)
- Icono: nada
- Asset: nada
- Annotation: tuteo peninsular (`"Escribe"`), a diferencia del voseo del resto del producto. Se deshabilita durante el guardado (`disabled={loading}`, `:123`)

### lista-adjuntos-pendientes
- Texto/label: los nombres de los archivos ya subidos, todavía sin vincular
- Icono: nada
- Asset: nada
- Annotation: **cambia de fondo con REQ-001.** Antes los adjuntos se subían como borrador, con `entityType: 'objective_comment_draft'` y el `objectiveId` como `entityId` (`CommentEditor.tsx:50`) — o sea que había que declarar a qué se iban a colgar antes de subirlos. Ahora **el archivo existe por sí solo** y el vínculo con el comentario se crea recién al guardar (RF-1, RF-3, RF-4). Para el usuario el gesto es el mismo; lo que cambia es que un archivo subido y no guardado **deja de ser un borrador huérfano** y pasa a ser un archivo suyo, que es un estado válido del sistema

### progreso-subida-adjunto
- Texto/label: `"Subiendo {nombre del archivo}... {progress}%"`
- Icono: nada
- Asset: nada
- Annotation: **bloque nuevo con REQ-001** (RF-8). El byte va del navegador directo al storage, así que hay progreso real de la transferencia. Antes el único feedback era el `loading` del botón de guardar, que no distinguía subir de enviar. La subida es de a un archivo por vez (RF-7)

### boton-quitar-adjunto
- Texto/label: `"×"` como texto; `aria-label="Quitar adjunto"` (`CommentEditor.tsx:134`, `:136`)
- Icono: nada
- Asset: nada
- Annotation: el `aria-label` no dice cuál adjunto; con varios, todos tienen el mismo nombre accesible. **Con REQ-001 quitar deja de borrar nada**: saca el archivo del comentario en curso, y el archivo sigue existiendo sin vínculo (RF-1). No hay que avisarlo en la interfaz —el usuario no distingue los dos casos ni le importa— pero sí explica por qué la acción no pide confirmación

### checkbox-comentario-publico
- Texto/label: `"Comentario público (visible para usuarios externos)"` (`CommentEditor.tsx:150`)
- Icono: nada
- Asset: nada
- Annotation: default sin marcar (`isPublic = false`, `:30`), o sea interno por defecto. El `<input type="checkbox">` está envuelto en el `<label>` (`:144-151`)

### boton-adjuntar-comentario
- Texto/label: el de `<AttachFileButton>` (`CommentEditor.tsx:152`)
- Icono: nada
- Asset: nada
- Annotation: error de permisos al subir: toast `"No tenés permisos para subir archivos a esta tarea"` (`:38`). **Con REQ-001 el tipo y el tamaño los valida el servidor** (RF-6, RF-15): son configurables en caliente, así que el cliente no puede anticipar el rechazo y muestra el mensaje que vuelve — `"El archivo supera el tamaño máximo permitido"` o `"Ese tipo de archivo no está permitido"`

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

### marca-identidad-automatica
- Texto/label: `"Automático"` · nombre accesible `"Identidad automática: no es una persona"`
- Icono: nada
- Asset: nada
- Annotation: **nuevo con REQ-005.** Acompaña al nombre del autor —no lo reemplaza— en los tres lugares donde esta pantalla expone un usuario: la fila `"Creado por"` de la grilla de metadatos, el autor de cada entrada de `lista-historial` y el autor de cada `comentario`. Se renderiza **solo cuando ese usuario es de tipo servicio** (REQ-005 RF-3, RF-10); para una persona no hay bloque ni espacio reservado. **Es la variante de autoría que REQ-003 dejó explícitamente sin diseñar** al eliminar el sufijo `"(En sistema externo)"`, y no es la misma: aquella marcaba a una persona que había escrito en otro sistema; esta marca a una identidad del propio producto que no es una persona

### marca-comentario-editado
- Texto/label: `"(editado)"` cuando el editor fue el propio autor · `"(editado por {nombre})"` cuando no lo fue
- Icono: nada
- Asset: nada
- Annotation: **cambia con REQ-011.** La marca ya existía, pero se derivaba de un campo prestado que solo decía que algo había cambiado alguna vez; ahora se apoya en una fecha de edición real, y el `Tooltip` de la fecha puede mostrar cuándo fue la última edición junto a la de creación. La variante `editado-por-otro` es nueva y existe porque un `admin` puede editar comentarios ajenos: sin decir quién editó, el texto cambiado quedaría atribuido al autor original (RF-4, RF-5, CA-4). **Nunca se muestra más de una edición**: se guarda la última, no un historial (CA-7)

### lista-adjuntos-comentario
- Texto/label: un ítem por adjunto ya vinculado al comentario, con su nombre de archivo y un control para quitarlo
- Icono: cruz por ítem, con `aria-label` que nombra el archivo
- Asset: nada
- Annotation: **nueva con REQ-011.** Hasta acá los adjuntos de un comentario se elegían solo al escribirlo y después quedaban fijos: `lista-adjuntos-pendientes` cubre el alta y desaparece al guardar. En edición se muestran los adjuntos que el comentario ya tiene, se pueden quitar y se pueden sumar archivos propios con `boton-adjuntar-comentario` (RF-2, CA-3). Lo que se guarda es **el conjunto completo que debe quedar**, no un delta: si la escritura falla no se aplica ningún cambio, ni de texto ni de vínculos (CA-14). Quitar un adjunto **no borra el archivo** —queda subido y se puede volver a usar—, igual que en el alta (REQ-001 RF-8)

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). `getObjectiveById` resuelve (`objectives/[id]/page.tsx:12-33`)
- Sub-estado `comentario en edición`: click en boton-editar-comentario reemplaza el markdown por el editor, con `"Cancelar"` y `"Guardar"` (`ObjectiveComment.tsx:120-134`). **Con REQ-011** el modo edición suma lista-adjuntos-comentario y boton-adjuntar-comentario —el texto y los adjuntos se editan juntos, en la misma escritura (RF-2, CA-3)— y **no ofrece checkbox-comentario-publico**: la visibilidad quedó fijada en el alta y es inmutable (RF-8, CA-8)
- marca-comentario-editado: presente o ausente **según el dato, no según el estado** — aparece en cada comentario que tenga fecha de edición, y con la variante `editado-por-otro` cuando quien editó no es el autor (REQ-011 RF-5)
- marca-identidad-automatica: presente o ausente **según el dato, no según el estado** — aparece junto a cada autor cuyo `identityType` es `service` (REQ-005 RF-3). En `comentario` es compatible con el sub-estado de edición: la marca es del autor, no del modo de la tarjeta

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

### subiendo adjunto (parent_state: default)
- Aplica: Sí — **estado nuevo con REQ-001** (RF-8)
- Mensaje: `"Subiendo {nombre del archivo}... {progress}%"`
- Cambios:
  - progreso-subida-adjunto: solo visible en este estado (visible_only_in_states)
  - boton-adjuntar-comentario: variant=disabled mientras hay una subida en curso (la subida es de a uno, RF-7)
  - boton-guardar-comentario: variant=disabled — guardar mientras el byte viaja crearía el vínculo contra un archivo incompleto
- **Por qué se separa del `loading` existente:** hoy `loading={loading || isUploading}` mezcla subir un archivo con enviar el comentario en un mismo spinner (`CommentEditor.tsx:157`). Con progreso real son dos esperas distintas —una tiene porcentaje y la otra no— y colapsarlas desperdicia la única información nueva que el rediseño aporta

### error de validación
- Aplica: Sí (parcialmente)
- Mensaje: toast `"El comentario no puede estar vacío"` (`ObjectiveComment.tsx:51`) · toast del rechazo del servidor: `"El archivo supera el tamaño máximo permitido"` · `"Ese tipo de archivo no está permitido"`
- Cambios: solo el toast. **El mensaje no aparece junto al campo**, y era la única validación de la pantalla [fuente: código-existente]
- **Cambia con REQ-001:** el rechazo del archivo pasa a venir del servidor en lugar del cliente (RF-6, RF-15). El síntoma para el usuario es el mismo mensaje en el mismo lugar; lo que cambia es que llega **después** de intentar subir, no antes

### error de sistema / sin conexión
- Aplica: Sí (parcialmente)
- Mensaje: `"Requisito no disponible"` en la fila del requisito (`ObjectiveDetails.tsx:116`); toast `"Hubo un error al editar el comentario"` (`ObjectiveComment.tsx:66`) o `"Hubo un error al agregar el comentario"` (`CommentEditor.tsx:110`); **con REQ-001** toast `"No podés adjuntar un archivo que subió otra persona"` cuando el vínculo se rechaza por titularidad (RF-12, CA-10); **con REQ-011** toast `"No podés editar un comentario que no es tuyo"` cuando la edición se rechaza por autoría (CA-10) y `"El comentario ya no existe"` cuando fue borrado mientras estaba abierto en edición (CA-16) — los dos son red de seguridad ante una pantalla desactualizada, no flujo previsto, porque el botón de editar solo aparece donde la edición está permitida
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
- boton-editar-comentario · click → entra en modo edición (`ObjectiveComment.tsx:138`); **con REQ-011** carga también los adjuntos actuales del comentario en lista-adjuntos-comentario
- `"Guardar"` del comentario en edición · click → valida no vacío y muta (`ObjectiveComment.tsx:49-67`); **con REQ-011** manda el texto y el conjunto completo de adjuntos que debe quedar, y **la escritura pasa por el bus** en vez de escribirse directo desde la api — para quien usa la pantalla no cambia nada salvo que ahora los errores del bus también aplican acá [REQ-011 Escenario B]
- quitar un adjunto de lista-adjuntos-comentario · click → lo saca del conjunto que se va a guardar; **el cambio recién se aplica al guardar**, y `"Cancelar"` lo revierte [REQ-011]
- `"Cancelar"` del comentario en edición · click → `handleCancel` descarta lo editado sin aviso (`ObjectiveComment.tsx:124`)
- boton-guardar-comentario · click → guarda el comentario nuevo y navega a la ruta actual (`CommentEditor.tsx:107`)

**Validaciones:**
- comentario editado · no vacío → toast `"El comentario no puede estar vacío"` (`ObjectiveComment.tsx:50-52`)
- boton-guardar-comentario · `disabled={isEmpty}` hasta que haya texto o al menos un adjunto, sin mensaje (`CommentEditor.tsx:45`, `:158`)

**Feedback:**
- Toasts para el alta y la edición de comentario
- `Tooltip` con la fecha completa en el historial y en cada comentario
- Marca `"(editado)"` en los comentarios modificados, **derivada de la fecha de edición desde REQ-011**, con `"(editado por X)"` cuando quien editó no es el autor

**Acciones ausentes** [fuente: código-existente]: no se puede borrar un comentario (solo editarlo, `ObjectiveComment.tsx:120-145`), ni borrar la tarea desde esta pantalla — existe un `<DeleteObjectiveButton>` con label `"Eliminar"` (`DeleteObjectiveButton.tsx:15`) que no se monta acá ni en ningún otro lado.

## Accesibilidad

- **Orden de foco:** boton-editar → boton-volver (el `row-reverse` de `PageLayout` invierte el orden visual pero no el del DOM, `PageLayout.module.scss:33`) → link-requisito → boton-editar-comentario de cada comentario → editor-comentario-nuevo → boton-quitar-adjunto de cada adjunto → checkbox-comentario-publico → boton-adjuntar-comentario → boton-guardar-comentario. **`link-proyecto` no está en el orden de foco:** es un `<a onClick>` sin `href`, así que no es enfocable por teclado ni se anuncia como enlace (`ObjectiveDetails.tsx:79`) [fuente: código-existente].
- **Landmarks y jerarquía:** los landmarks son los del shell. Un solo `<h1>`, el del `PageLayout` (el título de la tarea, `objectives/[id]/page.tsx:16`), y dos `<h2>`: `"Historial de cambios"` y `"Comentarios"` (`ObjectiveHistoryList.tsx:101`, `:104`). Correcto. **La estructura de metadatos no es semántica:** `<p><span>Etiqueta</span> valor</p>` en vez de `<dl>`/`<dt>`/`<dd>`, así que la relación etiqueta-valor no se anuncia (`ObjectiveDetails.tsx:68-166`).
- **Foco y teclado:** la pantalla no abre modales ni dropdowns propios, así que no introduce focus traps. Los `Tooltip` del historial y de los comentarios son de `:hover` puro. No hay atajos de teclado propios.
- **Propio de esta composición:** **HTML inválido en las dos listas de actividad:** el empty de historial y el de comentarios devuelven un `<div>` que se renderiza dentro de un `<ul>` (`<ul>{renderActivityContent(...)}</ul>`, `ObjectiveHistoryList.tsx:33`, `:102`). **La visibilidad de cada comentario se comunica solo por emoji** (`👁` / `🔒`), con el significado en un `Tooltip` de `:hover`: los emoji los leen los lectores de pantalla, pero como `"ojo"` / `"candado"`, no como `"público"` / `"interno"` (`ObjectiveComment.tsx:84`). **Las fechas completas viven solo en tooltips de `:hover`** y son inalcanzables por teclado (`ObjectiveHistoryList.tsx:56`, `ObjectiveComment.tsx:98`). `boton-guardar-comentario` está `disabled` sin `aria-describedby` que explique por qué (`CommentEditor.tsx:158`), y `boton-quitar-adjunto` no identifica cuál adjunto quita (`CommentEditor.tsx:134`) — **con REQ-011 el problema se repite en lista-adjuntos-comentario**, donde quitar un adjunto de un comentario en edición necesita nombrar el archivo en el `aria-label`, y **la fecha de edición no puede vivir solo en el tooltip de `:hover`** por la misma razón que ya está anotada para la fecha de creación. El tag de prioridad muestra el número crudo sin leyenda de la escala (`ObjectiveDetails.tsx:63`) [fuente: código-existente]. **La marca de identidad automática se resuelve como texto visible y no como emoji ni `Tooltip`**, a propósito y contra los dos patrones que esta misma pantalla ya tiene registrados como defectos: la visibilidad de un comentario se comunica con `👁`/`🔒` que un lector lee como `"ojo"`/`"candado"`, y las fechas completas viven en tooltips de `:hover` inalcanzables por teclado. Repetir cualquiera de los dos para una marca nueva sería sumar un defecto conocido (REQ-005).

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-001 — Rediseño de archivos y adjuntos (2026-08-19)

- **`lista-adjuntos-borrador` se renombra a `lista-adjuntos-pendientes`.** El borrador desaparece del modelo (RF-3): ya no hay un adjunto en estado provisorio esperando una entidad, hay un archivo que existe y todavía no se vinculó. Mantener el nombre viejo dejaría el vocabulario de la documentación describiendo un mecanismo que se eliminó, que es justamente lo que este rediseño vino a limpiar.
- **La subida gana estado propio en vez de reutilizar `loading`.** Hoy el mismo spinner cubre subir y enviar. Con progreso real son dos esperas con forma distinta, y fundirlas tiraría el porcentaje —el único aporte visible del rediseño en esta pantalla.
- **Guardar queda deshabilitado mientras un archivo sube.** Se descartó permitirlo y encolar el guardado: el vínculo se crea contra un archivo cuyo contenido todavía viaja, y el sistema no verifica que haya llegado (D-13), así que el comentario podría quedar con un adjunto vacío y sin síntoma hasta que alguien lo abra.
- **El error de titularidad se comunica en lenguaje de personas, no de sistema.** `file_not_owned` se muestra como *"No podés adjuntar un archivo que subió otra persona"* (RF-12). Se descartó *"No sos el propietario del archivo"*: nombra un concepto —propiedad de archivo— que el usuario nunca vio en la interfaz y que no necesita aprender para entender qué hacer.
- **No se agregó componente al Design System.** `progress-bar` no tiene spec en `web` v0.1.0. Queda anotado como gap conocido en la `## Revisión UX` de REQ-001; el catálogo completo lo resuelve `/product-design-system-update`.

### REQ-003 — Baja de la integración con sistemas externos (2026-08-20)

- **`link-url-externa` se elimina, no se oculta.** La fila `"Url Externa"` de la grilla de metadatos era la única superficie visible de la integración con Jira en todo el producto, y su condición de visibilidad (`objective.externalProjectId ?`) **siempre tomaba la rama vacía**: ninguna escritura del producto poblaba ese campo. Al darse de baja el esquema (RF-2, RF-3), el bloque deja de ser un bloque oculto y pasa a no existir. Se descartó dejarlo declarado como `hidden_in_states` permanente: un bloque que nunca puede aparecer documenta una capacidad que el producto ya no tiene.
- **La atribución de autor de un comentario pierde su variante.** Se elimina el sufijo `"(En sistema externo)"` sobre el nombre del autor (`ObjectiveHistoryList.tsx:80-84`). El autor de un comentario es siempre un usuario de Jiku, y ahora eso es una regla y no una rama. La contracara es que el microcopy de esta pantalla queda **sin ninguna forma de representar autoría ajena al producto**: si alguna vez vuelve a hacer falta, hay que diseñarla de cero, y es deliberado (RF-1: la integración se descarta como capacidad, no se posterga).
- **Ningún cambio visual.** Las dos ramas que se eliminan son las que ya se tomaban en toda fila que el producto haya escrito. La pantalla renderiza **exactamente lo mismo** antes y después; lo que cambia es que deja de declarar dos caminos que nunca se recorrían. Por eso no se toca ningún estado, ninguna transición ni el `user-flows.md` de la superficie.
- **La grilla de metadatos no se rebalancea.** La columna izquierda pasa de 7 a 6 filas y la derecha se queda en 6, así que las dos columnas quedan parejas sin mover nada. Se descartó reordenar filas entre columnas para aprovechar el hueco: el orden actual es el del DOM y cualquier reordenamiento sería un cambio de diseño que este REQ no pidió.
- **Sin cambios en el Design System.** El delta solo **quita** un bloque `link` y simplifica microcopy: no introduce ningún tipo de bloque nuevo, así que no hay nada que verificar contra el catálogo de `web` v0.1.0.

### REQ-005 — Sincronización de usuarios y roles desde el bus (2026-08-24)

- **La autoría no-humana vuelve a hacer falta, ocho meses después de darla de baja.** REQ-003 dejó escrito que esta pantalla quedaba *"sin ninguna forma de representar autoría ajena al producto"* y que *"si alguna vez vuelve a hacer falta, hay que diseñarla de cero"*. REQ-005 es ese caso, y **la diferencia importa para no repetir el diseño viejo**: `"(En sistema externo)"` marcaba a una **persona** que había escrito en Jira; `"Automático"` marca a una identidad que **no es una persona**. Un sufijo entre paréntesis pegado al nombre servía para lo primero; para lo segundo hace falta separar el qué del quién, y por eso es un bloque propio y no un sufijo.
- **Tres lugares, un solo bloque.** `"Creado por"`, el historial y los comentarios muestran el mismo dato con la misma consecuencia para el lector. Se descartó tratar el historial distinto (por ejemplo, con la marca en la propia frase *"{Autor} cambió {Campo}"*): dejaría al lector aprendiendo dos convenciones en una pantalla que ya mezcla dos listas de actividad.
- **La marca no cambia nada de lo que el usuario puede hacer.** Un comentario de una identidad de servicio se lee igual y **no se puede editar** —`boton-editar-comentario` ya está acotado a los comentarios propios—, así que no hace falta ningún estado nuevo ni ninguna advertencia.
- **No se agregó componente al Design System.** `badge` no tiene spec en `web` v0.1.0, pero es un tipo que esta pantalla ya usa tres veces (`tag-prioridad`, `badge-estado`, `badge-visibilidad-comentario`): el gap es previo al delta. Anotado en la `## Revisión UX` de REQ-005.

### REQ-011 — Edición de comentarios (2026-09-01)

- **La pantalla que ya tenía edición es la que menos cambia, y el cambio es de fondo igual.** Editar un comentario existía acá desde siempre, pero escribía **por fuera del camino que todo el resto del producto usa**: la api tocaba la base directamente en vez de pasar por el bus. Para quien usa la pantalla el gesto es el mismo; lo que cambia es que ahora la edición falla, se rechaza y se audita como cualquier otra escritura, y los errores del bus —el servicio caído, la operación que tardó demasiado— pasan a aplicar también acá [REQ-011 Escenario B].
- **La marca `"(editado)"` deja de ser una inferencia.** Se derivaba de un campo que guardaba el valor anterior de un cambio de campo y que en un comentario solo servía para saber que algo había pasado alguna vez: no decía cuándo ni quién, y era un uso prestado que además ensuciaba la lectura del historial. Con una fecha de edición propia la marca es verificable y el tooltip puede decir cuándo fue. **Descartado un historial de versiones** por lo mismo que en el detalle de requisito: nadie pidió leer lo que decía antes, y guardarlo obligaría a decidir quién puede ver versiones previas de un comentario que pudo haber sido público (CA-7).
- **El `admin` entra a la excepción, y por eso la marca tiene que nombrar al editor.** Ampliar quién puede editar sin decir quién editó dejaría el feed atribuyendo a una persona un texto que escribió otra. Es el mismo problema que REQ-005 resolvió con el badge "Automático" —un autor que no es quien parece— y se resuelve igual: **marcando, no ocultando** (RF-3, RF-5, CA-4).
- **Los adjuntos se editan junto con el texto, en una sola escritura.** Se descartó tratarlos como dos operaciones —guardar el texto y administrar los adjuntos aparte—: dejaría estados intermedios visibles donde el comentario ya cambió pero sus archivos no, y obligaría a explicar por qué una parte se guardó y la otra no. Como es una sola escritura, si algo falla no se aplica nada (CA-14).
- **En edición no hay checkbox de visibilidad.** Es la misma decisión que en el detalle de requisito y por el mismo motivo: el comentario pudo haber sido leído ya por el cliente en el portal, y volverlo interno no lo des-lee (RF-8, CA-8). Acá el descarte es más visible porque el checkbox **está a la vista en el formulario de alta**, justo debajo: se aceptó esa asimetría antes que ofrecer un control que no puede cumplir lo que promete.
- **[Auto] Design System — sin componentes nuevos.** Los dos bloques nuevos usan tipos que la pantalla ya tiene: `badge`, que ya usa cuatro veces (`tag-prioridad`, `badge-estado`, `badge-visibilidad-comentario`, `marca-identidad-automatica`), y `list`, que ya usa tres (`lista-equipo`, `lista-historial`, `lista-comentarios`, `lista-adjuntos-pendientes`). Ninguno tiene spec en el catálogo de `web` v0.1.0 (Button, Loader, InputSelect), pero es la misma carencia preexistente que REQ-001, REQ-005 y REQ-010 ya dejaron anotada, no un gap que este requerimiento abra. Reponer el catálogo corresponde a `/product-design-system-update`.
- **[REQ-013] La identidad cambia; la pantalla, no.** Esta ficha documenta *qué* hay en la pantalla y *para qué* está; el Manual de marca Jiku v1.0 cambia **con qué está construido**. El accent pasa del magenta `#DA2C6A` al verde agua `#61CCB9` sobre azul oscuro `#0B1934` con fondo niebla `#F6F6F9`, y Archivo se reemplaza por Sora (títulos de vista) + Gabarito (interfaz, datos, microcopy). Ningún bloque de esta pantalla se agrega, se elimina ni cambia de propósito por ese motivo [REQ-013 RF-1, RF-2, CA-1].
- **[REQ-013] Cada elemento hecho a mano pasa a su componente del Design System.** Los bloques que esta ficha declara —botones, campos, selects, tarjetas, tablas, badges— se implementan con los componentes normativos de `docs/design-system/web/components/`, no con marcado propio. Es un cambio de implementación con consecuencia visible —dejan de haber dos botones que se ven distinto haciendo lo mismo— pero **no cambia la estructura declarada acá**: un bloque que ya existía sigue existiendo, con el mismo tipo y el mismo propósito [REQ-013 RF-3, RF-4, CA-5, CA-10].
- **[REQ-013] Los estados declarados en esta ficha se conservan.** La migración es de presentación: ningún estado se agrega, se quita ni cambia su condición de disparo. Lo que cambia es cómo se ve cada uno —el loader es ahora uno solo, el vacío tiene componente `EmptyState` disponible— sin que la ficha declare estados nuevos. **Cablear `EmptyState` en las pantallas que hoy no tienen estado vacío queda fuera de este REQ** y sigue registrado en `gaps-as-is.md` [REQ-013 §Fuera de Alcance].
- **[REQ-013] `desktop` sigue siendo el viewport único.** El requerimiento **no** habilita mobile: el DS mantiene el responsive del shell como objetivo declarado sin fecha y no declara el viewport `mobile` hasta que el shell lo cumpla. El layout por viewport de esta ficha no cambia [REQ-013 §Fuera de Alcance, CA-15].
- **[REQ-013] El selector de tema vive en el shell, no en esta pantalla.** La superficie gana modo oscuro con un control para elegirlo, ubicado en el pie de la sidebar junto a Cerrar sesión. Como es parte del shell de `(loggedin)`, está presente acá pero **no se declara como bloque de esta ficha**: declararlo en las 21 pantallas autenticadas repetiría veintiuna veces el mismo control. En modo oscuro esta pantalla usa la paleta propia del DS —canvas `#0E121A`, superficies `#1B202C` separadas por contraste y sin borde—, no una inversión de la clara [REQ-013 RF-7, CA-11].
