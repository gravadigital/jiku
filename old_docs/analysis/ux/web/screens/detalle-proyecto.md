---
document: UX Survey Screen
screen: detalle-proyecto
route: /projects/[id]
service: web
source_files:
  - src/app/(loggedin)/projects/[id]/page.tsx
  - src/app/(loggedin)/projects/[id]/styles.module.scss
  - src/features/projects/components/ProjectDescription/ProjectDescription.tsx
  - src/features/projects/components/ProjectGeneralInfo/ProjectGeneralInfo.tsx
  - src/features/projects/components/ProjectProperties/ProjectProperties.tsx
  - src/features/projects/components/ProjectRequirementsSection/ProjectRequirementsSection.tsx
  - src/features/projects/components/ProjectObjectivesSection/ProjectObjectivesSection.tsx
  - src/features/projects/components/ProjectAttachmentsSection/ProjectAttachmentsSection.tsx
  - src/features/attachments/components/FileUploader/FileUploader.tsx
  - src/features/attachments/components/AttachmentsList/AttachmentsList.tsx
  - src/features/attachments/components/AttachmentItem/AttachmentItem.tsx
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: detalle-proyecto

> **Relevamiento as-is** de `/projects/[id]`, extraído de
> `src/app/(loggedin)/projects/[id]/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md). Los overlays de esta pantalla
> (`PreviewModal`, `ConfirmDialog`) están relevados en [_overlays.md](./_overlays.md).

## Identidad

- **Ruta:** `/projects/[id]`
- **Archivo:** `src/app/(loggedin)/projects/[id]/page.tsx` (`'use client'`)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** vista compuesta de un proyecto: descripción, sus requisitos, sus tareas,
  información general, propiedades y adjuntos.
- **Viewports con tratamiento:** el layout de dos columnas colapsa a una en `≤1200px`
  (`styles.module.scss:85`). Es la única regla responsive de la pantalla.

## Entrada y salida

**Entradas:**
- Click en una card de `listado-proyectos` · `ProjectCard.tsx:22`
- Click en una card de proyecto del contenido expandido de `listado-actores` ·
  `ClientProjects.tsx:18` → `ProjectCard.tsx:22`
- Redirect tras crear un proyecto · `projects/new/page.tsx:195` — `push('/projects/${created.id}')`

**Salidas:**
- `/projects` · link `"Volver"` · `projects/[id]/page.tsx:34-36`
- `/projects/edit/{id}` · botón `"Editar"` · `projects/[id]/page.tsx:22`
- `/requirements/new?projectId={id}` · botón `+` de la sección de requisitos ·
  `ProjectRequirementsSection.tsx:92`
- `/objectives/new?projectId={id}` · botón `+` de la sección de tareas ·
  `ProjectObjectivesSection.tsx:81`
- `/requirements/{id}` y `/objectives/{id}` · click en una fila de las tablas embebidas ·
  `ProjectRequirementsSection.tsx:~145`, `ProjectObjectivesSection.tsx:~132`
- URL externa · links de `Propiedades` con `target="_blank"` · `ProjectProperties.tsx:32`

**Redirects automáticos:**
- Ninguno.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | cargando-proyecto | `loader` | — | ambos | `<Loader label="Cargando...">` | `projects/[id]/page.tsx:26` |
| 2 | encabezado-proyecto | `header` | — | ambos | `<div className={styles.pageHeader}>` | `projects/[id]/page.tsx:31` |
| 3 | titulo-proyecto | `heading` | h1 | ambos | `<h1 className={styles.pageTitle}>{project.name}</h1>` | `projects/[id]/page.tsx:32` |
| 4 | boton-volver | `link` | — | ambos | `<Link href="/projects">` | `projects/[id]/page.tsx:34-36` |
| 5 | boton-editar | `button` | secondary | ambos | `<button onClick={handleEdit}>` | `projects/[id]/page.tsx:37-39` |
| 6 | card-descripcion | `card` | — | ambos | `<div className={styles.card}>` + `<ProjectDescription>` | `projects/[id]/page.tsx:46-49` |
| 7 | card-vacia | `card` | — | ambos | `<div className={styles.card}></div>` — **sin contenido** | `projects/[id]/page.tsx:51` |
| 8 | seccion-requisitos | `section` | — | ambos | `<ProjectRequirementsSection>` | `projects/[id]/page.tsx:54` |
| 9 | tabs-estado-requisito | `tabs` | 7 estados | ambos | `<nav className={styles.tabs}>` | `ProjectRequirementsSection.tsx:98-113` |
| 10 | tabla-requisitos | `table` | — | ambos | `<table className={styles.reqTable}>` | `ProjectRequirementsSection.tsx:117-160` |
| 11 | paginacion-requisitos | `pagination` | — | ambos | `<nav className={styles.pagination}>` — reimplementada inline | `ProjectRequirementsSection.tsx:164-210` |
| 12 | seccion-tareas | `section` | — | ambos | `<ProjectObjectivesSection>` | `projects/[id]/page.tsx:58` |
| 13 | tabs-estado-tarea | `tabs` | 5 estados | ambos | `<nav className={styles.tabs}>` | `ProjectObjectivesSection.tsx:87-102` |
| 14 | tabla-tareas | `table` | — | ambos | `<table className={styles.objTable}>` | `ProjectObjectivesSection.tsx:105-157` |
| 15 | paginacion-tareas | `pagination` | — | ambos | `<div className={styles.pagination}>` — reimplementada inline | `ProjectObjectivesSection.tsx:159-205` |
| 16 | card-informacion-general | `card` | — | ambos | `<div className={styles.card}>` + `<ProjectGeneralInfo>` | `projects/[id]/page.tsx:64-67` |
| 17 | card-propiedades | `card` | — | ambos | `<div className={styles.card}>` + `<ProjectProperties>` | `projects/[id]/page.tsx:69-72` |
| 18 | card-adjuntos | `card` | — | ambos | `<ProjectAttachmentsSection>` | `projects/[id]/page.tsx:74` |
| 19 | zona-subida-archivos | `section` | default / uploading / error | ambos | `<div role="button">` con drag & drop | `FileUploader.tsx:94-158` |
| 20 | barra-progreso-subida | `progress-bar` | — | ambos | `<div role="progressbar">` | `FileUploader.tsx:126-133` |
| 21 | lista-adjuntos | `list` | — | ambos | `<div className={styles.list}>` | `AttachmentsList.tsx:57` |
| 22 | item-adjunto | `card` | — | ambos | `<AttachmentItem>` | `AttachmentsList.tsx:59` |
| 23 | boton-ver-mas-adjuntos | `button` | tertiary | ambos | `<button className={styles.verMas}>` | `AttachmentsList.tsx:69` |

> `card-vacia` es un bloque real que renderiza un contenedor con estilos de card y **cero
> contenido**. Se lista porque produce espacio visible en la columna izquierda.

> `seccion-requisitos`, `seccion-tareas` y `zona-subida-archivos` se relevaron como `section`: son
> compuestos sin un tipo propio en el diccionario.

## Layout observado por viewport

### desktop · ≥1201px

- encabezado-proyecto
  - titulo-proyecto · boton-volver · boton-editar (fila, `space-between`)
- row `dos-columnas`
  - col 7/12 (`minmax(0, 1fr)`): columna izquierda
    - card-descripcion
    - card-vacia
    - seccion-requisitos (tabs-estado-requisito, tabla-requisitos, paginacion-requisitos)
    - seccion-tareas (tabs-estado-tarea, tabla-tareas, paginacion-tareas)
  - col 5/12 (420px fijos): columna derecha
    - card-informacion-general
    - card-propiedades
    - card-adjuntos (zona-subida-archivos, lista-adjuntos, boton-ver-mas-adjuntos)

**Origen:** `projects/[id]/styles.module.scss:80-83`:

```scss
.twoColumnLayout { display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 1.25rem; }
```

**Las fracciones son aproximadas:** la columna derecha es de **420px fijos** y la izquierda toma el
resto, así que la proporción cambia con el ancho. Con el contenido a ~880px (viewport 1200px) sería
5.7/12 + 5.7/12 — pero a ese ancho ya aplica el media query. A 1440px de viewport el contenido mide
~1118px, así que es ~7.5/12 + ~4.5/12. A 1920px, ~9.2/12 + ~2.8/12.

### mobile / tablet · ≤1200px

- encabezado-proyecto
- columna única, en el orden del DOM:
  - card-descripcion
  - card-vacia
  - seccion-requisitos
  - seccion-tareas
  - card-informacion-general
  - card-propiedades
  - card-adjuntos

**Origen:** `projects/[id]/styles.module.scss:85-87` —
`@media (max-width: 1200px) { grid-template-columns: 1fr; }`

> **La información general y las propiedades quedan al final**, después de las dos tablas. En una
> columna el orden del DOM manda, y el DOM pone la columna izquierda primero. No hay `order` que lo
> corrija.
>
> El corte en **1200px** no coincide con ningún breakpoint declarado ni con los 1023/1024 que usa el
> dominio de requisitos.

## Contenido

### titulo-proyecto
- Texto/label: dinámico desde `project.name`
- Origen: `projects/[id]/page.tsx:32`

### boton-volver / boton-editar
- Textos verbatim: `"Volver"` y `"Editar"`
- Origen: `projects/[id]/page.tsx:35`, `:38`
- Annotation: `"Volver"` es un `<Link>` y `"Editar"` un `<button>` con `router.push`. Dos mecanismos
  para la misma clase de acción en la misma fila. **No usan `<Button>`**: tienen estilos propios
  (`styles.backButton`, `styles.editButton`).

### card-descripcion
- Texto/label del título: `"Descripción"` · `projects/[id]/page.tsx:47`
- Contenido: dinámico desde `project.description`, renderizado como markdown con
  `<MarkdownViewer>` · `ProjectDescription.tsx:14`
- Estado vacío: `"Sin descripción"` · `ProjectDescription.tsx:16`

### card-informacion-general
- Texto/label del título: `"Información general"` · `projects/[id]/page.tsx:65`
- Filas (`<dl>` con `<dt>`/`<dd>`), etiquetas verbatim · `ProjectGeneralInfo.tsx:20-45`:
  - `"Código"` → `project.code`
  - `"Cliente"` → `project.client?.name` o `"No definido"`
  - `"Estado"` → `getProjectStatus(project.status)`
  - `"Creado por"` → `project.creator.name`
  - `"Fecha de inicio"` → formateada
  - `"Fecha de cierre estimada"` → formateada o `"No definida"`
- Annotation: el formato de fecha es `toLocaleDateString('es-ES', { day, month, year: 'numeric' })`
  (`ProjectGeneralInfo.tsx:11-15`) — **distinto** del `toUTCString().slice()` en inglés que usa la
  card del listado.

### card-propiedades
- Texto/label del título: `"Propiedades"` · `projects/[id]/page.tsx:70`
- Contenido: pares clave/valor de `keyValuePairs`. La clave pasa por `formatKey` para mostrarse
  legible · `ProjectProperties.tsx:29`
- Los valores que empiezan con `http://` o `https://` se renderizan como link externo con un icono
  SVG de flecha · `ProjectProperties.tsx:31-48`
- Estado vacío: `"Sin propiedades definidas"` · `ProjectProperties.tsx:22`

### seccion-requisitos
- Título: `"Requisitos"` · `ProjectRequirementsSection.tsx:87`
- Tabs verbatim, con contador: `"Análisis"` · `"Planificación"` · `"En cola"` · `"Desarrollo"` ·
  `"Revisión"` · `"Resuelto"` · `"Cancelado"` · `ProjectRequirementsSection.tsx:18-24`
- **Tab por defecto: `desarrollo`** · `ProjectRequirementsSection.tsx:54`
- Columnas de la tabla: `"ID"` · `"Título"` · `"Responsable"` · `"Tipo"` · `"Prioridad"` ·
  `"Creación"` · `ProjectRequirementsSection.tsx:120-125`
- Loading: `"Cargando requisitos..."` · `:132`
- Empty: `"No se encontraron requisitos"` · `:138`
- Responsable vacío: `"Sin asignar"` · `:47`
- Botón de alta: sin texto, `aria-label="Nuevo requisito"` · `:91`
- Tamaño de página: 5 por defecto, con `<select>` de `"5 por página"` / `"10 por página"` ·
  `:27`, `:206-207`

### seccion-tareas
- Título: `"Tareas"` · `ProjectObjectivesSection.tsx:76`
- Tabs verbatim, con contador: `"Backlog"` · `"Activo"` · `"En revisión"` · `"Finalizado"` ·
  `"Cancelado"` · `ProjectObjectivesSection.tsx:14-18`
- **Tab por defecto: `activo`** · `ProjectObjectivesSection.tsx:48`
- Columnas: `"ID"` · `"Título"` · `"Responsable"` · `"Creación"` · `"Cierre estimado"` ·
  `ProjectObjectivesSection.tsx:108-113`
- Loading: `"Cargando tareas..."` · `:119`
- Empty: `"No se encontraron tareas"` · `:125`
- Responsable vacío: `"—"` (guion largo) · `:34`
- Botón de alta: sin texto, `aria-label="Nueva tarea"` · `:80`

> **Los dos "sin responsable" difieren:** requisitos dice `"Sin asignar"`, tareas dice `"—"`.

### card-adjuntos
- Título: `"Archivos Adjuntos"` · `ProjectAttachmentsSection.tsx:16`
- Zona de subida: `"Arrastrá archivos aquí o hacé click para seleccionar"` · `FileUploader.tsx:146`
- Subiendo: `"Subiendo archivos..."` + `"{progress}%"` · `FileUploader.tsx:124`, `:133`
- Loading de la lista: `"Cargando archivos..."` · `AttachmentsList.tsx:35`
- Error de la lista: `"Error al cargar archivos"` · `AttachmentsList.tsx:41`
- Empty: `"No hay archivos adjuntos"` · `AttachmentsList.tsx:45`
- Acciones por adjunto: `"Preview"` · `"Download"` · `"Eliminar"` · `AttachmentItem.tsx:82,85,94`

> **`"Download"` está en inglés** entre dos botones en español. Copiado verbatim.

## Estados presentes

### loading inicial
- Mensaje: `"Cargando..."`
- Disparado por: `isLoadingProject || !project`
- Origen: `projects/[id]/page.tsx:25-27`
- Cambios: reemplaza toda la pantalla, incluido el encabezado

### default
- Disparado por: `project` resuelto
- Origen: `projects/[id]/page.tsx:29-78`

### loading por sección
- Mensajes: `"Cargando requisitos..."` y `"Cargando tareas..."`, dentro de una celda con `colSpan`
- Disparado por: `isLoading` de `useRequirements` / `useObjectives`
- Origen: `ProjectRequirementsSection.tsx:129-134`, `ProjectObjectivesSection.tsx:116-121`
- Cambios: solo el cuerpo de la tabla; tabs y encabezados quedan

### empty por sección
- Mensajes: `"No se encontraron requisitos"`, `"No se encontraron tareas"`,
  `"No hay archivos adjuntos"`, `"Sin descripción"`, `"Sin propiedades definidas"`
- Disparado por: `paginated.length === 0` / `attachments.length === 0` / campo falsy
- Origen: `ProjectRequirementsSection.tsx:135-140`, `ProjectObjectivesSection.tsx:122-127`,
  `AttachmentsList.tsx:44-46`, `ProjectDescription.tsx:16`, `ProjectProperties.tsx:21-23`

### error de los adjuntos
- Mensaje: `"Error al cargar archivos"`
- Disparado por: `error` de `useAttachments`
- Origen: `AttachmentsList.tsx:40-42`
- Cambios: reemplaza la lista

> **Es la única sección de esta pantalla que maneja el error de su query.**

### subiendo archivo
- Mensaje: `"Subiendo archivos..."` + porcentaje
- Disparado por: `isPending` de `useUploadAttachment`
- Origen: `FileUploader.tsx:122-135`
- Cambios: la zona de arrastre se reemplaza por la barra de progreso

### error de subida
- Mensaje: dinámico. Ante un error de permisos se compone con el tipo de entidad
  (`"este proyecto"`) · `FileUploader.tsx:33-48`; ante archivo inválido,
  `validation.error ?? "Archivo inválido"` · `:78`
- Origen: `FileUploader.tsx:155` — `<div role="alert">`
- Cambios: aparece el mensaje debajo de la zona de arrastre

### error de sistema (render de servidor)
- Cubierto por `projects/error.tsx` (el boundary del padre), que muestra `"Error"` + `error.message`
- Origen: `projects/error.tsx:6-11`

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error al cargar el proyecto** | **no se maneja.** `useProject` se desestructura como `{ data: project, isLoading: isLoadingProject }`: `isError` se ignora. Ante un fallo, `project` queda `undefined` y la condición `isLoadingProject \|\| !project` sigue siendo verdadera: **loader infinito** | `projects/[id]/page.tsx:19`, `:25-27` |
| **not found (proyecto inexistente)** | mismo loader infinito. No hay `notFound()` | `projects/[id]/page.tsx:25-27` |
| **id no numérico** | el tipo declara `Promise<{ id: number }>` pero el valor de la URL es string. `/projects/abc` pasa `"abc"` a la api sin validar. Comparar con las rutas de requisito, que sí hacen `if (isNaN(id)) notFound()` | `projects/[id]/page.tsx:16` vs `requirements/[reqid]/page.tsx:15` |
| **error de la tabla de requisitos** | `useRequirements` sin `isError`: un fallo se ve como `"No se encontraron requisitos"` | `ProjectRequirementsSection.tsx:58` |
| **error de la tabla de tareas** | `useObjectives` sin `isError`: un fallo se ve como `"No se encontraron tareas"` | `ProjectObjectivesSection.tsx:52` |
| `error.tsx` propio de la ruta | no existe; hereda el de `/projects`, que muestra `error.message` crudo sin contexto del proyecto | no existe `projects/[id]/error.tsx` |
| error de validación | no aplica: la pantalla no tiene formulario propio | — |
| success | los toasts de las acciones de adjunto (borrado) se disparan desde `AttachmentItem` | `AttachmentItem.tsx:35,39,50` |
| **estado terminal / readonly** | **no existe.** Un proyecto `finalizado` o `cancelado` muestra los mismos botones de `"Editar"`, `+` de alta de requisito y `+` de alta de tarea que uno activo. El único indicio del estado es una fila de la card de información general | `projects/[id]/page.tsx:37-39`, `ProjectRequirementsSection.tsx:88-96` |
| **empty global** | no aplica; cada sección tiene el suyo | — |

## Interacciones

**Eventos:**
- boton-volver · click → navega a `/projects` · `projects/[id]/page.tsx:34`
- boton-editar · click → `push('/projects/edit/{id}')` · `projects/[id]/page.tsx:21-23`
- tab de estado (requisitos / tareas) · click → cambia `activeState` en estado local y resetea la
  página a 1 · `ProjectRequirementsSection.tsx:~105`, `ProjectObjectivesSection.tsx:~94`
- fila de tabla · click → navega al detalle del requisito o de la tarea ·
  `ProjectRequirementsSection.tsx:~145`, `ProjectObjectivesSection.tsx:~132`
- botón `+` de sección · click → navega al alta con `?projectId={id}` ·
  `ProjectRequirementsSection.tsx:92`, `ProjectObjectivesSection.tsx:81`
- `<select>` de tamaño de página · on change → cambia `pageSize` y resetea la página ·
  `ProjectRequirementsSection.tsx:79-83`
- zona-subida-archivos · drop / click / `Enter` / `Space` → abre el selector o procesa los archivos ·
  `FileUploader.tsx:60-65`, `:96-107`
- item-adjunto · `"Preview"` → abre `PreviewModal`; `"Download"` → descarga;
  `"Eliminar"` → abre `ConfirmDialog` · `AttachmentItem.tsx:82-100`
- link de propiedad · click → abre la URL en pestaña nueva · `ProjectProperties.tsx:32`

**Validaciones:**
- Archivo adjunto · tipo y tamaño validados antes de subir → mensaje
  `validation.error ?? "Archivo inválido"` · `FileUploader.tsx:76-79`

**Feedback:**
- Tabs: contador de elementos por estado, calculado con `countByState` ·
  `ProjectRequirementsSection.tsx:110`, `ProjectObjectivesSection.tsx:98`
- Subida: barra de progreso con porcentaje
- Borrado de adjunto: `ConfirmDialog` y luego toast
- Estado activo de tab y de página: clase + `aria-current`

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Jerarquía de encabezados | `<h1>` para el nombre del proyecto, `<h2>` para los títulos de card. Correcto | `projects/[id]/page.tsx:32,47,65,70` |
| Títulos de sección | `"Requisitos"` y `"Tareas"` son `<h2>`; `"Archivos Adjuntos"` también | `ProjectRequirementsSection.tsx:87`, `ProjectObjectivesSection.tsx:76`, `ProjectAttachmentsSection.tsx:16` |
| Botones de icono | Los `+` de alta tienen `aria-label="Nuevo requisito"` / `"Nueva tarea"`. Correcto | `ProjectRequirementsSection.tsx:91`, `ProjectObjectivesSection.tsx:80` |
| Tabs | Son `<nav aria-label="Filtro por estado">` / `"Filtro por estado de tarea"` con `<button>`. **No usan `role="tablist"`/`role="tab"`**, así que no se anuncian como pestañas ni responden a flechas | `ProjectRequirementsSection.tsx:98`, `ProjectObjectivesSection.tsx:87` |
| Paginación | `<nav aria-label="Paginación">` con `aria-current="page"` en la activa (requisitos). La de tareas es un `<div>` sin `<nav>` ni label | `ProjectRequirementsSection.tsx:164,191` vs `ProjectObjectivesSection.tsx:159,186` |
| `<select>` de tamaño de página | Tiene `aria-label="Elementos por página"` en requisitos; **no se pudo verificar** el de tareas desde el fragmento leído | `ProjectRequirementsSection.tsx:205` |
| Filas de tabla clickeables | `<tr onClick>` **sin `role`, sin `tabIndex`, sin handler de teclado**: solo navegables con mouse | `ProjectRequirementsSection.tsx:~145`, `ProjectObjectivesSection.tsx:~132` |
| Zona de subida | `role="button"` + `aria-label` descriptivo + handlers de `Enter`/`Space`. **El mejor bloque accesible de la pantalla** | `FileUploader.tsx:95-107` |
| Barra de progreso | `role="progressbar"` con `aria-valuenow`/`min`/`max`. Correcto | `FileUploader.tsx:126-131` |
| Error de subida | `role="alert"`: se anuncia al aparecer | `FileUploader.tsx:155` |
| Input de archivo oculto | `aria-hidden="true"` sobre el `<input type="file">`, con la zona `role="button"` como control accesible | `FileUploader.tsx:118` |
| Estilo inline | `<div style={{ marginTop: '0.75rem' }}>` en la sección de adjuntos, en vez de una clase | `ProjectAttachmentsSection.tsx:18` |
| Anuncio del cambio de tab | **ausente:** sin `aria-live`, cambiar de tab no anuncia el nuevo contenido | `ProjectRequirementsSection.tsx:98-113` |

## Observaciones del relevamiento

- **`card-vacia` es un contenedor con estilos de card y sin contenido**
  (`projects/[id]/page.tsx:51`). Produce un bloque visible con fondo, borde y padding en la columna
  izquierda, entre la descripción y los requisitos. No se puede determinar si es un placeholder para
  algo que se sacó o un resto.
- **Tres formatos de fecha en una pantalla.** `ProjectGeneralInfo` usa
  `toLocaleDateString('es-ES')`; `ProjectRequirementsSection` compone `DD/MM/YYYY` a mano con
  `padStart` (`:38-43`); y la card de la que se llegó usa `toUTCString().slice()` en inglés.
- **El permiso de subida es de rol, no de proyecto.** `useCanUploadToProject` devuelve
  `roles.includes('admin') || roles.includes('user')` (`useCanUploadToProject.ts:11`) — **no consulta
  el proyecto**, a pesar del nombre. Cualquier usuario interno puede subir a cualquier proyecto. La
  autoridad real está en la api.
- **Los tabs por defecto difieren entre secciones:** requisitos abre en `desarrollo`, tareas en
  `activo`. No hay una razón visible en el código.
- **La paginación de las dos secciones es la misma reimplementación con distinta accesibilidad.**
  La de requisitos tiene `<nav aria-label>` y `aria-current`; la de tareas es un `<div>`. Es el
  patrón repetido 4 veces que el índice registra.
- **`ProjectDetails` no se usa acá.** Existe un componente `ProjectDetails` con una vista completa
  del proyecto (`ProjectDetails.tsx`, con `@include mobile` en su SCSS) que **no se importa desde
  ningún lado**. Esta pantalla compone `ProjectDescription` + `ProjectGeneralInfo` +
  `ProjectProperties` en su lugar. Sugiere una reescritura donde el componente viejo quedó; el
  código no lo confirma.
- **`ProjectInactiveObjectivesTable` y `ProjectActiveObjectives` también están muertos** y su
  contenido se solapa con `ProjectObjectivesSection`.
- **El corte responsive en 1200px** no coincide con ningún breakpoint declarado. En una columna, la
  información general y las propiedades quedan al final, después de dos tablas paginadas.
- **A confirmar en consolidación:** qué debería ir en `card-vacia`, si un proyecto cerrado debe
  ofrecer las mismas acciones, y si el orden de bloques en una columna es el deseado.
