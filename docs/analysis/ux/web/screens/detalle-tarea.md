---
document: UX Survey Screen
screen: detalle-tarea
route: /objectives/[id]
service: web
source_files:
  - src/app/(loggedin)/objectives/[id]/page.tsx
  - src/features/objectives/components/ObjectiveDetails/ObjectiveDetails.tsx
  - src/features/objectives/components/ObjectiveDetails/ObjectiveDetails.module.scss
  - src/features/objectives/components/ObjectiveHistoryList/ObjectiveHistoryList.tsx
  - src/features/objectives/components/ObjectiveComment/ObjectiveComment.tsx
  - src/shared/components/ui/CommentEditor/CommentEditor.tsx
viewports_detected:
  - mobile
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: detalle-tarea

> **Relevamiento as-is** de `/objectives/[id]`, extraído de
> `src/app/(loggedin)/objectives/[id]/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md).

## Identidad

- **Ruta:** `/objectives/[id]`
- **Archivo:** `src/app/(loggedin)/objectives/[id]/page.tsx` (Server Component, 34 líneas)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** muestra los metadatos de una tarea, su historial de cambios, sus
  comentarios, y permite agregar uno nuevo.
- **Viewports con tratamiento:** `mobile` y `desktop`. La grilla de metadatos colapsa a una columna en
  `≤767px`, vía el mixin `mobile`.

## Entrada y salida

**Entradas:**
- Click en una fila de `listado-tareas` · `TableRow.tsx:16`
- Click en una card de `tareas-por-proyecto` o `tareas-por-responsable` · `ObjectiveCard.tsx:108`
- Click en una fila de la tabla de tareas de `detalle-proyecto` ·
  `ProjectObjectivesSection.tsx:~132`
- Click en una fila de la tabla de tareas de `detalle-requisito` · `RequirementDetail.tsx:~206`

**Salidas:**
- `/objectives/by-project#project-{projectId}` · botón `"Volver"` ·
  `objectives/[id]/page.tsx:21`
- `/objectives/edit/{id}` · botón `"Editar"` · `objectives/[id]/page.tsx:23`
- `/requirements/{requirementId}` · link en la fila `"Requisito"` · `ObjectiveDetails.tsx:118-120`
- `/projects/{projectId}` · click en el nombre del proyecto · `ObjectiveDetails.tsx:79`
- URL externa · link de la fila `"Url Externa"`, con `target="_blank"` · `ObjectiveDetails.tsx:88`

**Redirects automáticos:**
- Ninguno.

> **`"Volver"` no vuelve a donde se venía.** Siempre va a
> `/objectives/by-project#project-{projectId}`, incluso si se entró desde `/objectives`, desde el
> detalle de proyecto o desde el de requisito. Es una de las cuatro entradas posibles y la única
> salida ofrecida.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | boton-volver | `button` | primary | ambos | `<Button label="Volver" href="/objectives/by-project#...">` | `objectives/[id]/page.tsx:18-22` |
| 2 | boton-editar | `button` | primary | ambos | `<Button label="Editar" href="/objectives/edit/{id}">` | `objectives/[id]/page.tsx:23` |
| 3 | tarjeta-detalle | `card` | — | ambos | `<SectionCard>` | `ObjectiveDetails.tsx:60` |
| 4 | tag-prioridad | `badge` | por prioridad 0-5 | ambos | `<ProjectPriorityTag>` | `ObjectiveDetails.tsx:63` |
| 5 | grilla-metadatos | `section` | — | ambos | `<div className={styles.metadataGrid}>` | `ObjectiveDetails.tsx:66` |
| 6 | fila-metadato | `paragraph` | body | ambos | `<p>` con `<span>` de etiqueta | `ObjectiveDetails.tsx:68-166` |
| 7 | badge-estado | `badge` | por `data-state` | ambos | `<span className={styles.statusLabel}>` | `ObjectiveDetails.tsx:71-73` |
| 8 | link-proyecto | `link` | — | ambos | `<a onClick={handleClick}>` | `ObjectiveDetails.tsx:79-81` |
| 9 | link-requisito | `link` | — | ambos | `<Link href="/requirements/{id}">` | `ObjectiveDetails.tsx:118-120` |
| 10 | link-url-externa | `link` | — | ambos | `<a target="_blank" rel="noopener noreferrer">` | `ObjectiveDetails.tsx:88` |
| 11 | lista-equipo | `list` | — | ambos | `<ul>` con `<li>` por persona | `ObjectiveDetails.tsx:169` |
| 12 | descripcion-tarea | `paragraph` | body | ambos | `<MarkdownViewer>` | `ObjectiveDetails.tsx:179` |
| 13 | titulo-historial | `heading` | h2 | ambos | `<h2>Historial de cambios</h2>` | `ObjectiveHistoryList.tsx:101` |
| 14 | lista-historial | `list` | — | ambos | `<ul className={styles.connectedList}>` | `ObjectiveHistoryList.tsx:37` |
| 15 | titulo-comentarios | `heading` | h2 | ambos | `<h2>Comentarios</h2>` | `ObjectiveHistoryList.tsx:104` |
| 16 | lista-comentarios | `list` | — | ambos | `<ul className={styles.connectedComments}>` | `ObjectiveHistoryList.tsx:75` |
| 17 | comentario | `card` | lectura / edición | ambos | `<ObjectiveComment>` | `ObjectiveHistoryList.tsx:78` |
| 18 | badge-visibilidad-comentario | `badge` | public / internal | ambos | `<span className={styles.visibilityBadge}>` con `👁`/`🔒` | `ObjectiveComment.tsx:83-85` |
| 19 | boton-editar-comentario | `button` | — | ambos | `<button aria-label="Editar comentario">` con icono | `ObjectiveComment.tsx:136-143` |
| 20 | editor-comentario-nuevo | `text-input` | default · disabled | ambos | `<InlineCommentEditor>` dentro de `<CommentEditor>` | `CommentEditor.tsx:118-124` |
| 21 | lista-adjuntos-borrador | `list` | — | ambos | `<div className={styles.attachmentList}>` | `CommentEditor.tsx:126-141` |
| 22 | boton-quitar-adjunto | `button` | — | ambos | `<button aria-label="Quitar adjunto">` con `×` | `CommentEditor.tsx:130-137` |
| 23 | checkbox-comentario-publico | `checkbox` | unchecked (default) / checked | ambos | `<label>` + `<input type="checkbox">` | `CommentEditor.tsx:144-151` |
| 24 | boton-adjuntar-comentario | `button` | — | ambos | `<AttachFileButton>` | `CommentEditor.tsx:152` |
| 25 | boton-guardar-comentario | `button` | primary · loading / disabled | ambos | `<Button label="Guardar" loading disabled>` | `CommentEditor.tsx:153-159` |
| 26 | vacio-historial | `empty-state` | — | ambos | `<div className={styles.noActivity}>` | `ObjectiveHistoryList.tsx:33` |
| 27 | vacio-comentarios | `empty-state` | — | ambos | `<div className={styles.noActivity}>` | `ObjectiveHistoryList.tsx:71` |

> `grilla-metadatos` se relevó como `section`. `fila-metadato` se relevó como `paragraph` porque el
> markup real es `<p><span>Etiqueta</span> valor</p>`, no una lista de definición — a diferencia de
> `detalle-proyecto` y `detalle-requisito`, que usan `<dl>`/`<dt>`/`<dd>`.

## Layout observado por viewport

### desktop · ≥768px

- boton-volver, boton-editar (en el encabezado de `PageLayout`; el array se renderiza en
  `row-reverse`, así que **`"Editar"` aparece a la izquierda de `"Volver"`**)
- tarjeta-detalle
  - tag-prioridad
  - row `metadatos` (2 columnas)
    - col 6/12: Estado, Proyecto, Url Externa, Área, Visibilidad, Creado por, Requisito
    - col 6/12: Fecha de inicio, Fecha de finalización estimada, Fecha de cierre, Última
      actualización, Horas trabajadas, Equipo
  - descripcion-tarea
- titulo-historial, lista-historial
- titulo-comentarios, lista-comentarios
- editor-comentario-nuevo

**Origen:** `ObjectiveDetails.module.scss:99-103`:

```scss
.metadataGrid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg); }
```

Fracciones exactas: **6/12 + 6/12**.

### mobile · ≤767px

- boton-volver, boton-editar
- tarjeta-detalle
  - tag-prioridad
  - columna única con todos los metadatos, en el orden del DOM (primero los 7 de la columna
    izquierda, después los 6 de la derecha)
  - descripcion-tarea
- titulo-historial, lista-historial
- titulo-comentarios, lista-comentarios
- editor-comentario-nuevo

**Origen:** `ObjectiveDetails.module.scss:106-108` —
`@include mobile { grid-template-columns: 1fr; }`

> **Es una de las 5 apariciones del mixin `mobile` en el producto**, y de las 4 que están en código
> vivo. El corte es **767px**, distinto de los 1023/1024 del dominio de requisitos y de los 1200 del
> detalle de proyecto.

> **El resto de la pantalla no tiene tratamiento:** el encabezado con los dos botones, las listas de
> historial y comentarios, y el editor no cambian a ningún ancho.

## Contenido

### boton-volver / boton-editar
- Textos verbatim: `"Volver"` · `"Editar"`
- Origen: `objectives/[id]/page.tsx:20`, `:23`
- Annotation: los dos usan `<Button>` con `href`, a diferencia de `detalle-proyecto`, que mezcla
  `<Link>` y `<button>`. **El orden visual está invertido** por el `row-reverse` de
  `PageLayout.module.scss:33`.

### Filas de metadatos

Etiquetas verbatim, en el orden del DOM (`ObjectiveDetails.tsx:68-166`):

| Etiqueta | Valor | Vacío |
|---|---|---|
| `"Estado"` | `badge-estado` con `data-state` | — |
| `"Proyecto"` | nombre del proyecto, clickeable | `"No definido"` |
| `"Url Externa"` | link con `target="_blank"` | la fila no se renderiza |
| `"Área"` | el área de la tarea | — |
| `"Visibilidad"` | vía `getObjectiveVisibility` | — |
| `"Creado por"` | nombre del creador | — |
| `"Requisito"` | link al requisito | `"Requisito no disponible"` si la query falla |
| `"Fecha de inicio"` | fecha formateada | — |
| `"Fecha de finalización estimada"` | fecha formateada | `"No definida"` |
| `"Fecha de cierre"` | fecha formateada; la fila solo aparece si existe | — |
| `"Última actualización"` | fecha formateada | — |
| `"Horas trabajadas"` | total; la fila solo aparece si existe | — |
| `"Equipo"` | `lista-equipo` | `"No hay personas asignadas"` |

- Formato de la fecha de cierre: `toLocaleDateString('es-ES', { month: 'short', year: 'numeric', … })` ·
  `:145-149`

### descripcion-tarea
- Etiqueta: `"Descripción"` · `ObjectiveDetails.tsx:175`
- Contenido: `objective.description` como markdown, o `"No definida"` · `:179`, `:181`

### titulo-historial / lista-historial
- Título: `"Historial de cambios"` · `ObjectiveHistoryList.tsx:101`
- Cada entrada: nombre del usuario, el tipo de actividad vía `getObjectiveTypeOfActivity`, el valor
  anterior y el nuevo (vía `getObjectiveState`), y la fecha en un `Tooltip` · `:39-61`
- Valor nuevo vacío: `"No definida"` · `:52`
- Empty: `"No hay cambios aún"` · `:33`
- Annotation: las actividades de tipo `description` **no muestran el cambio de valor** (`:44`), solo
  que hubo un cambio

### titulo-comentarios / lista-comentarios
- Título: `"Comentarios"` · `ObjectiveHistoryList.tsx:104`
- Empty: `"No hay comentarios aún"` · `:71`
- Annotation: el feed se parte en dos listas filtrando por `typeOfActivity === 'comment'`
  (`:22`, `:28`)

### comentario
- Autor: dinámico · `ObjectiveComment.tsx:79`
- Badge de visibilidad: `"👁"` (público) o `"🔒"` (interno), con `Tooltip`
  `"Visible para externos"` / `"Solo interno"` · `:81`, `:84`
- Marca de editado: `"(editado)"` con `Tooltip` · `:94`
- Fecha: en un `Tooltip` con `` `Creación: ${fecha}` `` · `:98`
- Contenido: markdown vía `<MarkdownViewer>` · `:116`
- En edición: botones `"Cancelar"` y `"Guardar"` · `:124`, `:130`
- Toast de éxito: `"Comentario editado exitosamente"` · `:60`
- Toast de error: `"El comentario no puede estar vacío"` · `:51`, o
  `"Hubo un error al editar el comentario"` · `:66`

> **El badge de visibilidad usa emoji como único indicador** (`👁` / `🔒`), con el significado en un
> tooltip de `:hover`.

### editor-comentario-nuevo
- Placeholder: `"Escribe un comentario..."` · `CommentEditor.tsx:121`
- `ariaLabel`: `"Comentario"` · `:120`
- Annotation: **tuteo peninsular (`"Escribe"`)**, igual que los editores del dominio de requisitos y
  a diferencia del voseo del resto del producto

### checkbox-comentario-publico
- Texto/label: `"Comentario público (visible para usuarios externos)"`
- Origen: `CommentEditor.tsx:150`
- Annotation: **default sin marcar** (`isPublic = false`, `:30`), o sea **interno por defecto**. Es
  el mismo default que el formulario de comentario de requisito (`internal`) y el opuesto al del alta
  de requisito (`public`). Es el único de los tres que explica en el texto qué implica.

### lista-adjuntos-borrador
- Botón de quitar: `"×"` como texto, `aria-label="Quitar adjunto"` · `CommentEditor.tsx:134`, `:136`
- Annotation: los adjuntos se suben con `entityType: 'objective_comment_draft'` y el `objectiveId`
  como `entityId` (`:50`), antes de que el comentario exista

### boton-guardar-comentario
- Texto/label: `"Guardar"`
- Origen: `CommentEditor.tsx:155`
- Annotation: `loading={loading || isUploading}` y **`disabled={isEmpty}`** — se habilita cuando hay
  texto o al menos un adjunto (`:45`)
- Toast de éxito: `"Comentario agregado exitosamente"` · `:101`
- Toast de error: `"Hubo un error al agregar el comentario"` · `:110`
- Error de permisos al subir: `"No tenés permisos para subir archivos a esta tarea"` · `:38`

## Estados presentes

### default
- Disparado por: `getObjectiveById` resuelve
- Origen: `objectives/[id]/page.tsx:12-33`

### empty del historial / de los comentarios
- Mensajes: `"No hay cambios aún"` · `"No hay comentarios aún"`
- Disparado por: `activities.length === 0` / `commentActivities.length === 0`
- Origen: `ObjectiveHistoryList.tsx:32-34`, `:70-72`

### empty del equipo
- Mensaje: `"No hay personas asignadas"`
- Disparado por: `!objective.persons || objective.persons.length === 0`
- Origen: `ObjectiveDetails.tsx:25`, `:46`

### error del requisito vinculado
- Mensaje: `"Requisito no disponible"`
- Disparado por: `hasRequirementError` de `useRequirement`
- Origen: `ObjectiveDetails.tsx:19-23`, `:116`
- Cambios: la fila `"Requisito"` muestra el texto en vez del link

> **Es el único manejo de `isError` de esta pantalla**, y está bien hecho: degrada un bloque sin
> romper el resto.

### comentario en edición
- Disparado por: click en `boton-editar-comentario`
- Origen: `ObjectiveComment.tsx:120-134`
- Cambios: el markdown se reemplaza por el editor, con `"Cancelar"` y `"Guardar"`

### success / error de edición de comentario
- Toasts: `"Comentario editado exitosamente"` / `"Hubo un error al editar el comentario"` /
  `"El comentario no puede estar vacío"`
- Origen: `ObjectiveComment.tsx:51`, `:60`, `:66`

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **not found (tarea inexistente)** | `getObjectiveById(id)` **sin try/catch y sin validar el id**. Un id inexistente o no numérico lanza, y lo agarra el `error.tsx` de `/objectives`, que muestra **`"Error inesperado"`** sin decir qué pasó. Comparar con las rutas de requisito, que hacen `if (isNaN(id)) notFound()` | `objectives/[id]/page.tsx:11-12`; `objectives/error.tsx:9` |
| **id no numérico** | el tipo declara `Promise<{ id: number }>` pero el valor es string. `/objectives/abc` pasa `"abc"` a la api | `objectives/[id]/page.tsx:9-11` |
| loading inicial | **no hay `loading.tsx` en la ruta.** El Server Component espera la respuesta sin ningún indicador: la pantalla anterior queda congelada | no existe `objectives/[id]/loading.tsx` |
| error de sistema propio | hereda el boundary de `/objectives`, que descarta el error real | `objectives/error.tsx:5-9` |
| error de validación | la única validación es "comentario no vacío", y se comunica por **toast**, no junto al campo | `ObjectiveComment.tsx:51` |
| **estado terminal / readonly** | **no existe.** Una tarea `finalizado` o `cancelado` ofrece el mismo botón `"Editar"` y el mismo editor de comentarios. El estado es una fila de metadato más | `objectives/[id]/page.tsx:23`, `:31` |
| loading del editor de comentario | **sí está resuelto:** el editor se deshabilita (`disabled={loading}`) y el botón muestra spinner vía `<Button loading>` | `CommentEditor.tsx:123`, `:157` |
| **navegación redundante al comentar** | tras guardar hace `push('/objectives/{id}')` — **la ruta en la que ya está**. Es un refresh disfrazado de navegación | `CommentEditor.tsx:107` |
| confirmación al cancelar la edición de un comentario | `"Cancelar"` descarta lo editado sin aviso | `ObjectiveComment.tsx:124` |
| **borrado de comentario** | **no existe.** Se puede editar un comentario pero no borrarlo | `ObjectiveComment.tsx:120-145` |
| **borrado de la tarea** | **no existe en esta pantalla**, aunque hay un componente `<DeleteObjectiveButton>` (`DeleteObjectiveButton.tsx:15`, con label `"Eliminar"`) que **no se monta acá ni en ningún otro lado con ese propósito** | `objectives/[id]/page.tsx:17-24` |

## Interacciones

**Eventos:**
- boton-volver · click → navega a `/objectives/by-project#project-{projectId}` ·
  `objectives/[id]/page.tsx:21`
- boton-editar · click → navega a `/objectives/edit/{id}` · `objectives/[id]/page.tsx:23`
- link-proyecto · click → `handleClick` navega al proyecto · `ObjectiveDetails.tsx:79`
- link-requisito · click → navega al requisito · `ObjectiveDetails.tsx:118`
- link-url-externa · click → abre en pestaña nueva · `ObjectiveDetails.tsx:88`
- boton-editar-comentario · click → entra en modo edición · `ObjectiveComment.tsx:138`
- `"Guardar"` del comentario · click → valida no vacío y muta · `ObjectiveComment.tsx:49-67`
- `"Cancelar"` del comentario · click → `handleCancel` descarta · `ObjectiveComment.tsx:124`

**Validaciones:**
- comentario editado · no vacío → toast `"El comentario no puede estar vacío"` ·
  `ObjectiveComment.tsx:50-52`

**Feedback:**
- Toasts para la edición de comentario
- `Tooltip` con la fecha completa en el historial y en cada comentario
- Marca `"(editado)"` en los comentarios modificados

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Jerarquía de encabezados | `<h1>` del `PageLayout` (el título de la tarea) y `<h2>` para `"Historial de cambios"` y `"Comentarios"`. Correcto | `objectives/[id]/page.tsx:16`, `ObjectiveHistoryList.tsx:101`, `:104` |
| Estructura de los metadatos | `<p><span>Etiqueta</span> valor</p>`: **no es una lista de definición**, así que la relación etiqueta-valor no es semántica. `detalle-proyecto` y `detalle-requisito` usan `<dl>` | `ObjectiveDetails.tsx:68-166` |
| `link-proyecto` sin `href` | Es un `<a onClick={handleClick}>` **sin `href`**: no es enfocable por teclado ni se anuncia como enlace | `ObjectiveDetails.tsx:79` |
| `link-url-externa` | `target="_blank"` + `rel="noopener noreferrer"`. **Sin aviso de que abre en pestaña nueva** | `ObjectiveDetails.tsx:88` |
| Lista del equipo | `<ul>` con `<li>` por persona. Correcto | `ObjectiveDetails.tsx:39`, `:169` |
| Listas de historial y comentarios | `<ul>` con `<li>`. Correcto | `ObjectiveHistoryList.tsx:37-39`, `:75-77` |
| `<ul>` con `<div>` adentro | El empty de historial y de comentarios devuelve un `<div>` que se renderiza **dentro de un `<ul>`** (`<ul>{renderActivityContent(...)}</ul>`): HTML inválido | `ObjectiveHistoryList.tsx:33`, `:102` |
| Botón de editar comentario | `aria-label="Editar comentario"` presente; la `<Image>` tiene `alt="Editar"` — redundante con el `aria-label` del botón | `ObjectiveComment.tsx:140`, `:142` |
| **Visibilidad del comentario solo por emoji** | `👁` / `🔒` como único indicador visible, con el significado en un `Tooltip` de `:hover`. Los emoji **sí** los leen los lectores de pantalla, pero como `"ojo"` / `"candado"`, no como `"público"` / `"interno"` | `ObjectiveComment.tsx:84` |
| Marca `"(editado)"` | Texto dentro de un `Tooltip`: el texto se lee, la fecha de edición del tooltip no | `ObjectiveComment.tsx:94` |
| Checkbox de visibilidad | `<input type="checkbox">` **envuelto en el `<label>`**: la asociación es implícita y correcta, y el texto explica la consecuencia | `CommentEditor.tsx:144-151` |
| Botón de quitar adjunto | `aria-label="Quitar adjunto"` presente. **No dice cuál adjunto** — con varios, todos tienen el mismo nombre accesible | `CommentEditor.tsx:134` |
| Botón de guardar deshabilitado | `disabled={isEmpty}` sin `aria-describedby` que explique por qué | `CommentEditor.tsx:158` |
| Fechas en tooltip | La fecha corta es visible y la completa está solo en el `Tooltip` de `:hover`: **inaccesible por teclado** | `ObjectiveHistoryList.tsx:56`, `ObjectiveComment.tsx:98` |
| Badge de estado | Texto dentro del `<span>`, así que se lee. Correcto | `ObjectiveDetails.tsx:71-73` |
| Tag de prioridad | Número crudo sin leyenda de la escala | `ObjectiveDetails.tsx:63` |

## Observaciones del relevamiento

- **`"Volver"` siempre va a `/objectives/by-project`**, sin importar de dónde se entró
  (`objectives/[id]/page.tsx:21`). Hay cuatro entradas posibles a esta pantalla y una sola salida
  ofrecida, que además no es la más común (`/objectives`). El `#project-{id}` sugiere que la vista por
  proyecto era el punto de entrada previsto.
- **El orden de los botones está invertido** respecto del array: `PageLayout` usa `row-reverse`
  (`PageLayout.module.scss:33`), así que `[Volver, Editar]` se ve como `Editar | Volver`. Es
  consistente con las otras pantallas que usan `PageLayout`, pero opuesto a `detalle-proyecto` y
  `detalle-requisito`, que montan su propio header y muestran `Volver | Editar`.
- **Es la única pantalla que maneja un `isError` de forma elegante:** la fila del requisito degrada a
  `"Requisito no disponible"` sin romper nada (`ObjectiveDetails.tsx:19-23`, `:116`). El resto del
  producto ignora `isError` o lo manda a un toast.
- **No se puede borrar un comentario**, solo editarlo. Y **no se puede borrar la tarea** desde acá:
  `<DeleteObjectiveButton>` (label `"Eliminar"`, `DeleteObjectiveButton.tsx:15`) está exportado
  desde el barrel de `features/objectives` (`features/objectives/index.ts:3`) y **no se monta en
  ningún JSX del proyecto**. Es código muerto, y con él el borrado de tareas no existe en la UI —
  aunque la Server Action `deleteObjective` sí existe (`objectivesApi.ts`).
- **Tras agregar un comentario, la pantalla navega a sí misma** (`push('/objectives/{id}')`,
  `CommentEditor.tsx:107`). Consigue refrescar los datos del Server Component, pero el mecanismo es
  una navegación a la ruta actual en vez de invalidar la query.
- **La estructura de metadatos usa `<p><span>` en vez de `<dl>`**, a diferencia de las otras dos
  pantallas de detalle del producto. Tres pantallas de detalle, dos estructuras distintas.
- **El corte responsive es 767px** (mixin `mobile`), y en la misma sesión de trabajo el dominio de
  requisitos usa 1023/1024 y el detalle de proyecto 1200. Cuatro cortes distintos en cuatro pantallas
  de detalle.
- **`link-proyecto` no es un enlace real** (`<a>` sin `href`, `ObjectiveDetails.tsx:79`): no se puede
  abrir en pestaña nueva ni alcanzar con teclado.
- **A confirmar en consolidación:** a dónde debería volver el botón `"Volver"`, si hace falta borrar
  comentarios y tareas, y si el badge de visibilidad necesita texto además del emoji.
