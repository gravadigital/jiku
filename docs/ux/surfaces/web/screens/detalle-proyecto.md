---
name: detalle-proyecto
surface: web
route: /projects/[id]
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.1"
date: 2026-09-02
---

# Pantalla: Detalle de proyecto

## Identidad

- **Audiencia primaria:** equipo-interno. Requiere sesión — el guard está en `(loggedin)/layout.tsx:13-21` [fuente: código-existente].
- **JTBD / Propósito:** vista compuesta de un proyecto: descripción, sus requisitos, sus tareas, información general, propiedades y adjuntos [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport declarado. El layout de dos columnas es la forma en que la pantalla existe en la superficie.
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente]. Esta pantalla **sí** define una regla `@media (max-width: 1200px)` que colapsa las dos columnas a una (`projects/[id]/styles.module.scss:85-87`); queda registrada en Layout como comportamiento observado del código, aunque no corresponde a un viewport alcanzable de la superficie.
  - Tablet: se comporta como desktop por encima de 1200px.

## Entrada y salida

**Entradas:**
- Click en una card de `listado-proyectos` · `ProjectCard.tsx:22` [fuente: código-existente]
- Click en una card de proyecto del contenido expandido de `listado-actores` · `ClientProjects.tsx:18` → `ProjectCard.tsx:22`
- Redirect tras crear un proyecto · `projects/new/page.tsx:195` — `push('/projects/${created.id}')`

**Salidas user-driven:**
- `/projects` · click en `boton-volver` · `projects/[id]/page.tsx:34-36`
- `/projects/edit/{id}` · click en `boton-editar` · `projects/[id]/page.tsx:22`
- `/requirements/new?projectId={id}` · botón `+` de la sección de requisitos · `ProjectRequirementsSection.tsx:92`
- `/objectives/new?projectId={id}` · botón `+` de la sección de tareas · `ProjectObjectivesSection.tsx:81`
- `/requirements/{id}` y `/objectives/{id}` · click en una fila de las tablas embebidas · `ProjectRequirementsSection.tsx:~145`, `ProjectObjectivesSection.tsx:~132`
- URL externa · links de `card-propiedades` con `target="_blank"` · `ProjectProperties.tsx:32`

**Salidas automáticas:**
- Ninguna.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | cargando-proyecto | loader | — | feedback | desktop | visible_only_in_states: loading | Indicador de la carga inicial |
| 2 | encabezado-proyecto | header | — | layout | desktop | hidden_in_states: loading | Título y acciones de la pantalla |
| 3 | titulo-proyecto | heading | h1 | content | desktop | hidden_in_states: loading | Nombre del proyecto |
| 4 | boton-volver | link | — | navigation | desktop | hidden_in_states: loading | Vuelve al listado |
| 5 | boton-editar | button | secondary | input | desktop | hidden_in_states: loading | Va a la edición |
| 6 | card-descripcion | card | — | content | desktop | hidden_in_states: loading | Descripción en markdown |
| 7 | card-vacia | card | — | layout | desktop | hidden_in_states: loading | Contenedor con estilos de card y sin contenido |
| 8 | seccion-requisitos | section | — | content | desktop | hidden_in_states: loading | Requisitos del proyecto |
| 9 | tabs-estado-requisito | tabs | 7 estados | navigation | desktop | hidden_in_states: loading | Filtra la tabla por estado |
| 10 | tabla-requisitos | table | — | content | desktop | hidden_in_states: loading | Lista de requisitos del estado activo |
| 11 | paginacion-requisitos | pagination | controlado (sin ruta) | navigation | desktop | hidden_in_states: loading; oculto cuando el estado activo tiene 0 requisitos | Paginación de la tabla de requisitos, con ventana de máximo 10 números |
| 12 | seccion-tareas | section | — | content | desktop | hidden_in_states: loading | Tareas del proyecto |
| 13 | tabs-estado-tarea | tabs | 5 estados | navigation | desktop | hidden_in_states: loading | Filtra la tabla por estado |
| 14 | tabla-tareas | table | — | content | desktop | hidden_in_states: loading | Lista de tareas del estado activo |
| 15 | paginacion-tareas | pagination | — | navigation | desktop | hidden_in_states: loading | Paginación de la tabla de tareas |
| 16 | card-informacion-general | card | — | content | desktop | hidden_in_states: loading | Metadatos del proyecto |
| 17 | card-propiedades | card | — | content | desktop | hidden_in_states: loading | Pares clave/valor del proyecto |
| 18 | card-adjuntos | card | — | content | desktop | hidden_in_states: loading | Archivos adjuntos |
| 19 | zona-subida-archivos | section | default / uploading / error | input | desktop | state_overrides: subiendo archivo→barra de progreso | Selección de archivos, **de a uno por vez** |
| 20 | barra-progreso-subida | progress-bar | — | feedback | desktop | visible_only_in_states: subiendo archivo | Progreso **real** de la subida del archivo en curso |
| 21 | lista-adjuntos | list | — | content | desktop | hidden_in_states: loading | Adjuntos ya subidos |
| 22 | item-adjunto | card | disponible / no disponible | content | desktop | hidden_in_states: loading | Un adjunto con sus acciones |
| 23 | boton-ver-mas-adjuntos | button | tertiary | input | desktop | hidden_in_states: loading | Suma un lote de adjuntos visibles |
| 24 | marca-identidad-automatica | badge | automatico | content | desktop | hidden_in_states: loading | Marca que el creador mostrado es una identidad de servicio y no una persona |

**Origen:** `projects/[id]/page.tsx:26`, `projects/[id]/page.tsx:31`, `projects/[id]/page.tsx:32`, `projects/[id]/page.tsx:34-36`, `projects/[id]/page.tsx:37-39`, `projects/[id]/page.tsx:46-49`, `projects/[id]/page.tsx:51`, `projects/[id]/page.tsx:54`, `projects/[id]/page.tsx:58`, `projects/[id]/page.tsx:64-67`, `projects/[id]/page.tsx:69-72`, `projects/[id]/page.tsx:74`, `ProjectRequirementsSection.tsx:98-113`, `ProjectRequirementsSection.tsx:117-160`, `ProjectRequirementsSection.tsx:164-210`, `ProjectObjectivesSection.tsx:87-102`, `ProjectObjectivesSection.tsx:105-157`, `ProjectObjectivesSection.tsx:159-205`, `FileUploader.tsx:94-158`, `FileUploader.tsx:126-133`, `AttachmentsList.tsx:57`, `AttachmentsList.tsx:59`, `AttachmentsList.tsx:69`

`card-vacia` es un bloque real que renderiza un contenedor con estilos de card y cero contenido; se lista porque produce espacio visible en la columna izquierda. `seccion-requisitos`, `seccion-tareas` y `zona-subida-archivos` se relevaron como `section`: son compuestos sin un tipo propio en el diccionario. El chrome es compartido; los overlays de esta pantalla (`PreviewModal`, `ConfirmDialog`) están documentados aparte [fuente: código-existente].

## Layout por viewport

### desktop · 1440px

- encabezado-proyecto
  - row `acciones` (`space-between`): titulo-proyecto · boton-volver · boton-editar
- row `dos-columnas`
  - col 7/12 (`minmax(0, 1fr)`): columna izquierda
    - card-descripcion
    - card-vacia
    - seccion-requisitos (tabs-estado-requisito, tabla-requisitos, paginacion-requisitos)
    - seccion-tareas (tabs-estado-tarea, tabla-tareas, paginacion-tareas)
  - col 5/12 (420px fijos): columna derecha
    - card-informacion-general (marca-identidad-automatica en la fila "Creado por", cuando el creador es una identidad de servicio)
    - card-propiedades
    - card-adjuntos (zona-subida-archivos, lista-adjuntos, boton-ver-mas-adjuntos)

**Origen:** `projects/[id]/styles.module.scss:80-83` — `.twoColumnLayout { display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 1.25rem; }`.

**Las fracciones son aproximadas:** la columna derecha es de 420px fijos y la izquierda toma el resto, así que la proporción cambia con el ancho. A 1440px de viewport el contenido mide ~1118px, así que es ~7.5/12 + ~4.5/12; a 1920px, ~9.2/12 + ~2.8/12 [fuente: código-existente].

**Comportamiento observado a ≤1200px** (fuera de los viewports declarados de la superficie): `projects/[id]/styles.module.scss:85-87` — `@media (max-width: 1200px) { grid-template-columns: 1fr; }`. En una columna el orden es el del DOM: card-descripcion, card-vacia, seccion-requisitos, seccion-tareas, card-informacion-general, card-propiedades, card-adjuntos. La información general y las propiedades quedan al final, después de las dos tablas; no hay `order` que lo corrija. El corte en 1200px no coincide con ningún breakpoint declarado ni con los 1023/1024 que usa el dominio de requisitos [fuente: código-existente].

## Contenido

### cargando-proyecto
- Texto/label: `"Cargando..."`
- Icono: nada
- Asset: imagen del componente `<Loader>`
- Annotation: `projects/[id]/page.tsx:26`

### encabezado-proyecto
- Texto/label: sin texto propio — contiene título y acciones
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.pageHeader}>` (`projects/[id]/page.tsx:31`). La pantalla **no usa `PageLayout`**: monta su propio encabezado

### titulo-proyecto
- Texto/label: dinámico desde `project.name`
- Icono: nada
- Asset: nada
- Annotation: `projects/[id]/page.tsx:32`

### boton-volver
- Texto/label: `"Volver"`
- Icono: nada
- Asset: nada
- Annotation: es un `<Link>`, mientras `boton-editar` es un `<button>` con `router.push`: dos mecanismos para la misma clase de acción en la misma fila. **No usan `<Button>`**: tienen estilos propios (`styles.backButton`, `styles.editButton`) (`projects/[id]/page.tsx:35`) [fuente: código-existente]

### boton-editar
- Texto/label: `"Editar"`
- Icono: nada
- Asset: nada
- Annotation: `<button onClick={handleEdit}>` con `router.push` (`projects/[id]/page.tsx:38`)

### card-descripcion
- Texto/label: título `"Descripción"`; contenido dinámico desde `project.description` renderizado como markdown con `<MarkdownViewer>`; vacío `"Sin descripción"`
- Icono: nada
- Asset: nada
- Annotation: `projects/[id]/page.tsx:47`, `ProjectDescription.tsx:14`, `:16`

### card-vacia
- Texto/label: ninguno — el contenedor no tiene contenido
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.card}></div>` produce un bloque visible con fondo, borde y padding en la columna izquierda, entre la descripción y los requisitos (`projects/[id]/page.tsx:51`) [fuente: código-existente]

### seccion-requisitos
- Texto/label: título `"Requisitos"`; botón de alta sin texto con `aria-label="Nuevo requisito"`
- Icono: plus (en el botón de alta)
- Asset: nada
- Annotation: `ProjectRequirementsSection.tsx:87`, `:91`

### tabs-estado-requisito
- Texto/label: `"Análisis"` · `"Planificación"` · `"En cola"` · `"Desarrollo"` · `"Revisión"` · `"Resuelto"` · `"Cancelado"`, cada uno con contador
- Icono: nada
- Asset: nada
- Annotation: **tab por defecto: `desarrollo`** (`ProjectRequirementsSection.tsx:18-24`, `:54`) [fuente: código-existente]
- **REQ-008:** el contador de cada tab es el **total real de requisitos de ese estado en el proyecto**, pedido a la api por separado (`count=true`), y ya no el recuento de los datos ya traídos. Antes los 7 contadores se calculaban sobre las 20 filas que devolvía el default del endpoint, así que con más de 20 requisitos **los números eran falsos y nada lo avisaba** (RF-6, CA-7). Un contador que no pudo resolverse muestra un placeholder neutro en lugar de un número, sin romper el resto de la card (CA-20)

### tabla-requisitos
- Texto/label: columnas `"ID"` · `"Título"` · `"Responsable"` · `"Tipo"` · `"Prioridad"` · `"Creación"`. Loading: `"Cargando requisitos..."`. Empty: `"No se encontraron requisitos"`. Responsable vacío: `"Sin asignar"`
- Icono: nada
- Asset: nada
- Annotation: la fecha se compone `DD/MM/YYYY` a mano con `padStart` (`ProjectRequirementsSection.tsx:38-43`, `:120-125`, `:132`, `:138`, `:47`) [fuente: código-existente]

### paginacion-requisitos
- Texto/label: `<select>` de tamaño de página con `"5 por página"` / `"10 por página"`; números de página
- Icono: nada
- Asset: nada
- Annotation: tamaño de página 5 por defecto; paginación reimplementada inline (`ProjectRequirementsSection.tsx:27`, `:164-210`, `:206-207`)
- **REQ-008:** deja de ser una reimplementación inline y pasa a ser el **paginador único del producto**, en modo controlado — el bloque no navega por URL, avisa el cambio de página al contenedor y la card conserva su estado local (RF-4, RF-5, CA-6). Muestra **como máximo 10 números** en una ventana centrada en la página actual, ajustada a los extremos; con 10 páginas o menos las muestra todas sin huecos (RF-1, RF-2). El recorte anterior —páginas 1-3 más la última con elipsis— desaparece. El total de páginas se calcula sobre el **total real del estado activo**, no sobre las filas en memoria, y el `<select>` de tamaño de página conserva 5/10 con default 5 (RF-10). **Con 0 requisitos en el estado el bloque no se renderiza** (CA-11, CA-19)

### seccion-tareas
- Texto/label: título `"Tareas"`; botón de alta sin texto con `aria-label="Nueva tarea"`
- Icono: plus (en el botón de alta)
- Asset: nada
- Annotation: `ProjectObjectivesSection.tsx:76`, `:80`

### tabs-estado-tarea
- Texto/label: `"Backlog"` · `"Activo"` · `"En revisión"` · `"Finalizado"` · `"Cancelado"`, cada uno con contador
- Icono: nada
- Asset: nada
- Annotation: **tab por defecto: `activo`** (`ProjectObjectivesSection.tsx:14-18`, `:48`) [fuente: código-existente]

### tabla-tareas
- Texto/label: columnas `"ID"` · `"Título"` · `"Responsable"` · `"Creación"` · `"Cierre estimado"`. Loading: `"Cargando tareas..."`. Empty: `"No se encontraron tareas"`. Responsable vacío: `"—"` (guion largo)
- Icono: nada
- Asset: nada
- Annotation: **los dos "sin responsable" difieren:** requisitos dice `"Sin asignar"`, tareas dice `"—"` (`ProjectObjectivesSection.tsx:108-113`, `:119`, `:125`, `:34`) [fuente: código-existente]

### paginacion-tareas
- Texto/label: controles de página, sin texto fijo relevado más allá de los números
- Icono: nada
- Asset: nada
- Annotation: reimplementada inline como un `<div>` (`ProjectObjectivesSection.tsx:159-205`)

### card-informacion-general
- Texto/label: título `"Información general"`; filas (`<dl>` con `<dt>`/`<dd>`) con etiquetas `"Código"` · `"Cliente"` (vacío: `"No definido"`) · `"Estado"` · `"Creado por"` · `"Fecha de inicio"` · `"Fecha de cierre estimada"` (vacío: `"No definida"`)
- Icono: nada
- Asset: nada
- Annotation: el formato de fecha es `toLocaleDateString('es-ES', { day, month, year: 'numeric' })` — **distinto** del `toUTCString().slice()` en inglés que usa la card del listado (`projects/[id]/page.tsx:65`, `ProjectGeneralInfo.tsx:11-15`, `:20-45`) [fuente: código-existente]

### card-propiedades
- Texto/label: título `"Propiedades"`; pares clave/valor de `keyValuePairs`, con la clave pasada por `formatKey`; vacío `"Sin propiedades definidas"`
- Icono: flecha SVG en los valores que son link externo
- Asset: nada
- Annotation: los valores que empiezan con `http://` o `https://` se renderizan como link externo con `target="_blank"` (`projects/[id]/page.tsx:70`, `ProjectProperties.tsx:22`, `:29`, `:31-48`)

### card-adjuntos
- Texto/label: título `"Archivos Adjuntos"`. Loading de la lista: `"Cargando archivos..."`. Error de la lista: `"Error al cargar archivos"`. Empty: `"No hay archivos adjuntos"`. Acciones por adjunto: `"Preview"` · `"Download"` · `"Eliminar"`
- Icono: nada
- Asset: nada
- Annotation: **`"Download"` está en inglés** entre dos botones en español. Copiado verbatim (`ProjectAttachmentsSection.tsx:16`, `AttachmentsList.tsx:35`, `:41`, `:45`, `AttachmentItem.tsx:82,85,94`) [fuente: código-existente]

### zona-subida-archivos
- Texto/label: `"Arrastrá un archivo acá o hacé click para seleccionarlo"`. Subiendo: `"Subiendo {nombre del archivo}..."`. Error de archivo rechazado por el servidor: el mensaje del error de dominio — `"El archivo supera el tamaño máximo permitido"` (`file_too_large`) · `"Ese tipo de archivo no está permitido"` (`file_type_not_allowed`)
- Icono: nada
- Asset: nada
- Annotation: `<div role="button">` con drag & drop y handlers de `Enter`/`Space` (`FileUploader.tsx:146`, `:124`, `:78`, `:94-158`). **La subida es de a un archivo por vez** (REQ-001 RF-7): soltar varios los encola, no los sube en lote. **El límite de tamaño y las extensiones ya no se deciden acá**: son configurables en caliente y los valida `core` (REQ-001 RF-6, RF-15), así que el cliente no puede anticipar el mensaje — lo muestra tal como vuelve

### barra-progreso-subida
- Texto/label: `"{progress}%"`
- Icono: nada
- Asset: nada
- Annotation: `<div role="progressbar">` con `aria-valuenow`/`min`/`max` (`FileUploader.tsx:126-133`). **El porcentaje pasa a ser real** (REQ-001 RF-8): el byte va del navegador directo al storage y el progreso es el de esa transferencia, no el de una request a la api que solo se sabe terminada. Con varios archivos encolados, la barra reporta **el archivo en curso**, no el conjunto

### lista-adjuntos
- Texto/label: sin texto propio — es el contenedor de los adjuntos
- Icono: nada
- Asset: nada
- Annotation: `AttachmentsList.tsx:57`

### item-adjunto
- Texto/label: dinámico — nombre del archivo, más los botones `"Preview"` · `"Download"` · `"Eliminar"`
- Icono: nada
- Asset: nada
- Annotation: `"Preview"` abre `PreviewModal`; `"Eliminar"` abre `ConfirmDialog` con title `"Eliminar archivo"`, confirmLabel `"Eliminar"`, cancelLabel `"Cancelar"` (`AttachmentsList.tsx:59`, `AttachmentItem.tsx:82-108`). **Variante `no disponible`** (REQ-001 RF-21, CA-15): el adjunto figura en la lista pero su contenido nunca llegó al storage. El nombre se muestra igual, con la leyenda `"El archivo no está disponible"` y `"Preview"` / `"Download"` deshabilitados; `"Eliminar"` sigue habilitado, que es la única salida útil

### boton-ver-mas-adjuntos
- Texto/label: `"Ver más"`
- Icono: nada
- Asset: nada
- Annotation: `AttachmentsList.tsx:69`

### marca-identidad-automatica
- Texto/label: `"Automático"` · nombre accesible `"Identidad automática: no es una persona"`
- Icono: nada
- Asset: nada
- Annotation: **nuevo con REQ-005.** Acompaña al valor de la fila `"Creado por"` de `card-informacion-general` cuando ese usuario es una identidad de servicio, y **solo ahí**: esta pantalla no muestra autoría en ningún otro bloque —`item-adjunto` lista el nombre del archivo y no quién lo subió, así que `uploaded_by` sigue siendo invisible acá pese a que desde REQ-005 puede ser un service user. Se renderiza solo cuando `identityType` es `service`; para una persona no hay bloque ni espacio reservado (REQ-005 RF-3, RF-10)

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Disparado por `project` resuelto (`projects/[id]/page.tsx:29-78`) [fuente: código-existente]
  - marca-identidad-automatica: presente o ausente **según el dato, no según el estado** — aparece solo si el creador del proyecto es una identidad de servicio (REQ-005 RF-3)

### empty
- Aplica: Sí (por sección; no hay empty global)
- Mensajes: `"No se encontraron requisitos"` · `"No se encontraron tareas"` · `"No hay archivos adjuntos"` · `"Sin descripción"` · `"Sin propiedades definidas"`
- Cambios:
  - tabla-requisitos: el cuerpo se reemplaza por una celda con `colSpan` y el mensaje (`ProjectRequirementsSection.tsx:135-140`)
  - **REQ-008 · tabs-estado-requisito y paginacion-requisitos:** un estado sin requisitos muestra el tab con el total `0` —dato real de la api, no ausencia de datos— y **el paginador no se renderiza**: no hay páginas navegables (CA-11). Con el proyecto entero vacío los 7 tabs muestran `0` (CA-19). El vacío ahora es un hecho verificado del proyecto y no el efecto de una página fuera de rango
  - tabla-tareas: ídem (`ProjectObjectivesSection.tsx:122-127`)
  - lista-adjuntos: se reemplaza por el mensaje (`AttachmentsList.tsx:44-46`)
  - card-descripcion y card-propiedades: contenido reemplazado por su texto vacío (`ProjectDescription.tsx:16`, `ProjectProperties.tsx:21-23`)
- Disparado por `paginated.length === 0` / `attachments.length === 0` / campo falsy [fuente: código-existente]

### loading
- Aplica: Sí
- Mensajes: `"Cargando..."` (carga inicial), `"Cargando requisitos..."` y `"Cargando tareas..."` (por sección), `"Cargando archivos..."` (adjuntos)
- Cambios:
  - **Carga inicial:** cargando-proyecto solo visible en este estado (visible_only_in_states); reemplaza toda la pantalla, incluido el encabezado. Disparado por `isLoadingProject || !project` (`projects/[id]/page.tsx:25-27`)
  - **Por sección:** solo el cuerpo de la tabla se reemplaza por una celda con `colSpan`; tabs y encabezados quedan (`ProjectRequirementsSection.tsx:129-134`, `ProjectObjectivesSection.tsx:116-121`)
  [fuente: código-existente]
  - **REQ-008 · la sección de requisitos carga en dos pistas independientes.** El listado del estado activo y los 7 contadores son consultas separadas: el cuerpo de la tabla puede estar cargando mientras los tabs ya muestran sus totales, y al revés. Cambiar de tab o de tamaño de página vuelve a poner en carga el cuerpo de la tabla —nunca la pantalla completa—, y al cambiar de tab **los 7 contadores también se refrescan** (RF-8, CA-10). Los tabs, el `<select>` de tamaño y el paginador siguen visibles y operables durante la carga

### error de validación
- Aplica: Sí (solo para la subida de archivos)
- Mensaje: `validation.error ?? "Archivo inválido"`; ante un error de permisos el mensaje se compone con el tipo de entidad (`"este proyecto"`)
- Cambios:
  - zona-subida-archivos: aparece un `<div role="alert">` con el mensaje debajo de la zona de arrastre (`FileUploader.tsx:33-48`, `:76-79`, `:155`)
- La pantalla no tiene formulario propio más allá de la subida [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí (parcialmente)
- Mensajes: `"Error al cargar archivos"` (adjuntos); `"Error"` + `error.message` en el boundary heredado de `/projects`
- Cambios:
  - lista-adjuntos: se reemplaza por el mensaje de error. **Es la única sección de esta pantalla que maneja el error de su query** (`AttachmentsList.tsx:40-42`)
  - En un fallo de render, el boundary `projects/error.tsx:6-11` reemplaza el contenido de la ruta; no existe `projects/[id]/error.tsx` propio, así que el mensaje llega crudo, sin contexto del proyecto
- **REQ-008 · el fallo de un contador queda aislado.** Los 7 conteos son consultas independientes: si uno falla, **ese tab muestra un placeholder neutro en lugar del número y nada más se ve afectado** — ni la tabla del tab activo, ni los otros seis contadores (CA-20). Es consecuencia directa de pedir cada total por separado: antes había un solo cálculo en memoria y cualquier fallo se llevaba puesta la sección entera.
- **El error al cargar el proyecto no se maneja:** `useProject` se desestructura como `{ data: project, isLoading: isLoadingProject }` e ignora `isError`; ante un fallo, `project` queda `undefined` y la condición `isLoadingProject || !project` sigue siendo verdadera: **loader infinito** (`projects/[id]/page.tsx:19`, `:25-27`). Los errores de las tablas de requisitos y tareas tampoco se manejan: `useRequirements` y `useObjectives` sin `isError`, así que un fallo se ve como `"No se encontraron requisitos"` / `"No se encontraron tareas"` (`ProjectRequirementsSection.tsx:58`, `ProjectObjectivesSection.tsx:52`) [fuente: código-existente]

### success
- Aplica: Sí (solo para las acciones de adjunto)
- Mensaje: toast disparado desde `AttachmentItem` tras el borrado
- Cambios: la lista de adjuntos se refresca; el toast aparece en el contenedor del shell (`AttachmentItem.tsx:35,39,50`) [fuente: código-existente]

### not found
- Aplica: No — no implementado (ver gaps-as-is.md). Un proyecto inexistente produce el mismo loader infinito; no hay `notFound()`. Un id no numérico tampoco se valida: el tipo declara `Promise<{ id: number }>` pero el valor de la URL es string, y `/projects/abc` pasa `"abc"` a la api — a diferencia de las rutas de requisito, que sí hacen `if (isNaN(id)) notFound()` (`projects/[id]/page.tsx:16`, `:25-27` vs `requirements/[reqid]/page.tsx:15`) [fuente: código-existente].

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). Un proyecto `finalizado` o `cancelado` muestra los mismos botones de `"Editar"`, `+` de alta de requisito y `+` de alta de tarea que uno activo; el único indicio del estado es una fila de la card de información general (`projects/[id]/page.tsx:37-39`, `ProjectRequirementsSection.tsx:88-96`) [fuente: código-existente].

### subiendo archivo (parent_state: default)
- Aplica: Sí
- Mensaje: `"Subiendo {nombre del archivo}..."` + porcentaje
- Cambios:
  - zona-subida-archivos: la zona de arrastre se reemplaza por la barra de progreso (state_override)
  - barra-progreso-subida: solo visible en este estado (visible_only_in_states)
- Disparado por `isPending` de `useUploadAttachment` (`FileUploader.tsx:122-135`) [fuente: código-existente]
- **Cambia con REQ-001:** el progreso pasa a ser el de la transferencia real del byte al storage, y el estado es **por archivo**, no por lote (RF-7, RF-8). El mensaje nombra el archivo en curso porque con una cola de tres archivos, `"Subiendo archivos..."` no dice cuál va ni cuánto falta

### archivo no disponible (parent_state: default)
- Aplica: Sí — **estado nuevo con REQ-001** (RF-21, CA-15)
- Mensaje: `"El archivo no está disponible"`
- Cambios:
  - item-adjunto: variant=`no disponible` (state_override) — `"Preview"` y `"Download"` deshabilitados, `"Eliminar"` habilitado
- **Por qué existe:** con la subida directa al storage, el sistema registra el archivo antes de que el byte llegue y **no verifica que haya llegado** (REQ-001 D-13). Si el navegador se cierra o la red corta a mitad del envío, queda un adjunto con nombre y sin contenido. Antes este caso no era representable —la fila se escribía después de que la api recibiera el archivo entero—, así que es un modo de fallo nuevo, no una variante de uno viejo
- **Por qué no es un error genérico:** el sistema distingue "el archivo no está disponible" de "algo falló" (RF-21). Al usuario le importa la diferencia: en un caso el adjunto no sirve y conviene volver a subirlo, en el otro conviene reintentar

## Interacciones

**Eventos:**
- boton-volver · on click → navega a `/projects` · `projects/[id]/page.tsx:34`
- boton-editar · on click → `push('/projects/edit/{id}')` · `projects/[id]/page.tsx:21-23`
- tabs-estado-requisito / tabs-estado-tarea · on click → cambia `activeState` en estado local y resetea la página a 1 · `ProjectRequirementsSection.tsx:~105`, `ProjectObjectivesSection.tsx:~94`
- **REQ-008 · tabs-estado-requisito · on click** → además del reset a la página 1, se pide a la api el listado del nuevo estado y **se refrescan los 7 contadores** (RF-8, CA-10)
- **REQ-008 · paginacion-requisitos · on click en un número** → el bloque **no navega**: avisa la página elegida al contenedor, que pide a la api esa página del estado activo. La URL no cambia (CA-6, CA-9)
- **REQ-008 · si la página activa deja de existir** —porque un requisito cambió de estado y el total del tab bajó— la paginación se reajusta al total vigente en lugar de dejar la tabla en una página vacía sin salida (CA-21)
- fila de tabla-requisitos / tabla-tareas · on click → navega al detalle del requisito o de la tarea · `ProjectRequirementsSection.tsx:~145`, `ProjectObjectivesSection.tsx:~132`
- botón `+` de sección · on click → navega al alta con `?projectId={id}` · `ProjectRequirementsSection.tsx:92`, `ProjectObjectivesSection.tsx:81`
- `<select>` de tamaño de página · on change → cambia `pageSize` y resetea la página · `ProjectRequirementsSection.tsx:79-83`. **REQ-008:** el nuevo tamaño se le pide a la api en vez de recortar en memoria, y el tab activo se mantiene (RF-9, CA-12)
- zona-subida-archivos · on drop / on click / `Enter` / `Space` → abre el selector o procesa los archivos · `FileUploader.tsx:60-65`, `:96-107`
- item-adjunto · `"Preview"` → abre `PreviewModal`; `"Download"` → descarga; `"Eliminar"` → abre `ConfirmDialog` · `AttachmentItem.tsx:82-100`
- link de propiedad · on click → abre la URL en pestaña nueva · `ProjectProperties.tsx:32`

[fuente: código-existente]

**Validaciones:**
- Archivo adjunto · tipo y tamaño validados antes de subir → mensaje `validation.error ?? "Archivo inválido"` · `FileUploader.tsx:76-79`

**Feedback:**
- Tabs: contador de elementos por estado, calculado con `countByState` (`ProjectRequirementsSection.tsx:110`, `ProjectObjectivesSection.tsx:98`). **REQ-008:** en la sección de requisitos el contador ya no se calcula en el cliente — es el total real que devuelve la api por estado
- Subida: barra de progreso con porcentaje
- Borrado de adjunto: `ConfirmDialog` y luego toast
- Estado activo de tab y de página: clase + `aria-current`

## Accesibilidad

- **Orden de foco:** boton-volver → boton-editar → tabs-estado-requisito → filas de tabla-requisitos (**no enfocables**, ver abajo) → paginacion-requisitos → tabs-estado-tarea → filas de tabla-tareas (**no enfocables**) → paginacion-tareas → zona-subida-archivos → acciones de cada item-adjunto → boton-ver-mas-adjuntos. **Las filas de ambas tablas son `<tr onClick>` sin `role`, sin `tabIndex` y sin handler de teclado: solo son navegables con mouse**, así que quedan fuera del orden de foco pese a ser la vía principal a requisitos y tareas (`ProjectRequirementsSection.tsx:~145`, `ProjectObjectivesSection.tsx:~132`) [fuente: código-existente].
- **Landmarks y jerarquía:** `<h1>` para el nombre del proyecto (titulo-proyecto) y `<h2>` para los títulos de card, incluidos `"Requisitos"`, `"Tareas"` y `"Archivos Adjuntos"`. La jerarquía es correcta y la pantalla se puede navegar por encabezados (`projects/[id]/page.tsx:32,47,65,70`, `ProjectRequirementsSection.tsx:87`, `ProjectObjectivesSection.tsx:76`, `ProjectAttachmentsSection.tsx:16`) [fuente: código-existente].
- **Foco y teclado:** los dos overlays de esta pantalla se comportan distinto. `ConfirmDialog` (borrado de adjunto) usa `<dialog>` nativo con `showModal()`, así que **el focus trap, el `Escape` y la devolución del foco los aporta el navegador**. `PreviewModal` (vista previa de adjunto) los reimplementa a mano y **le faltan los tres: no atrapa el foco, no lo devuelve al botón `"Preview"` que la abrió, y no mueve el foco al abrir** (`ConfirmDialog.tsx:35`, `PreviewModal.tsx:65-69`, `:76-134`) [fuente: código-existente].
- **Propio de esta composición:**
  - **Las tabs no se anuncian como tabs:** son `<nav aria-label="Filtro por estado">` / `"Filtro por estado de tarea"` con `<button>`, **sin `role="tablist"`/`role="tab"`**, así que no responden a flechas (`ProjectRequirementsSection.tsx:98`, `ProjectObjectivesSection.tsx:87`).
  - **El cambio de tab no se anuncia:** sin `aria-live`, cambiar de tab no anuncia el nuevo contenido (`ProjectRequirementsSection.tsx:98-113`).
  - **Las dos paginaciones tienen distinta calidad:** la de requisitos es `<nav aria-label="Paginación">` con `aria-current="page"`; la de tareas es un `<div>` sin `<nav>` ni label (`ProjectRequirementsSection.tsx:164,191` vs `ProjectObjectivesSection.tsx:159,186`). **REQ-008 cierra la mitad de esa brecha:** la paginación de requisitos pasa al componente único, que conserva `<nav aria-label="Paginación">` y `aria-current="page"`. **La de tareas de esta pantalla queda como está** —el requerimiento nombra dos paginadores y este no es ninguno de los dos—, así que la asimetría persiste dentro de la misma pantalla, ahora con un motivo registrado en vez de por accidente.
  - **REQ-008 · el paginador nunca muestra más de 10 números,** lo que acota el recorrido por teclado a un tramo constante: hoy un estado con muchas páginas obliga a tabular por todas ellas para llegar al bloque siguiente.
  - `zona-subida-archivos` es el bloque mejor resuelto: `role="button"` + `aria-label` descriptivo + handlers de `Enter`/`Space`, con el `<input type="file">` oculto por `aria-hidden="true"` (`FileUploader.tsx:95-107`, `:118`). El error de subida lleva `role="alert"`, así que se anuncia al aparecer (`FileUploader.tsx:155`).
  [fuente: código-existente]

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-001 — Rediseño de archivos y adjuntos (2026-08-19)

- **La subida pasa a ser de a un archivo por vez, y se dice en el microcopy.** Es requisito del rediseño (RF-7), no una simplificación de interfaz. Se descartó mantener el plural `"Subiendo archivos..."` con una barra agregada: esconde cuál archivo está en curso justo cuando el progreso empieza a ser real y por lo tanto informativo.
- **El progreso se mantiene como bloque `progress-bar` y no se convierte en una lista de archivos con progreso individual.** Con una cola de a uno, la barra del archivo en curso más el nombre alcanzan. Una lista de progresos paralelos representaría una concurrencia que el flujo no tiene.
- **`archivo no disponible` se resuelve dentro de `item-adjunto` y no como un overlay o una pantalla de error.** El adjunto sigue existiendo y sigue siendo borrable; sacarlo de la lista lo volvería invisible y no habría forma de limpiarlo. Se descartó ocultarlo por eso.
- **Los límites de tamaño y tipo dejan de estar en el microcopy de la pantalla.** Pasan a ser configurables en caliente (RF-15), así que cualquier número escrito en la interfaz puede quedar desactualizado sin que nadie lo note. El mensaje de rechazo viene del servidor. Se descartó leer la configuración para mostrarla: agrega un pedido de datos a una pantalla que hoy no lo necesita, para prevenir un error que el servidor ya explica bien.
- **No se agregó componente al Design System.** `progress-bar` y el mensaje de error inline no tienen spec en `web` v0.1.0, pero ese catálogo es un scaffold placeholder con tres componentes; crear uno suelto acá lo desbalancea. Queda anotado como gap conocido en la `## Revisión UX` de REQ-001.

### REQ-005 — Sincronización de usuarios y roles desde el bus (2026-08-24)

- **La marca de autoría automática entra en un solo bloque de esta pantalla.** `"Creado por"` de `card-informacion-general` es el único lugar donde el proyecto expone un usuario. Se revisó el resto y no hay más: las dos tablas muestran requisitos y tareas sin columna de autor, y `item-adjunto` muestra el nombre del archivo sin quién lo subió.
- **`uploaded_by` sigue sin mostrarse, y ahora es una decisión y no una omisión.** Desde REQ-005 un conector externo puede ser el `uploaded_by` de un archivo de esta lista. Se descartó agregar la columna: el adjunto se identifica por su nombre, agregar autoría a cada fila competiría con las tres acciones que ya lleva (`Preview` · `Download` · `Eliminar`), y la regla que importa —que un archivo solo lo puede adjuntar quien lo subió (REQ-001 RF-12)— ya se comunica cuando se rompe, no de forma preventiva. Queda anotado como gap: si el equipo necesita rastrear qué subió un conector, hoy la interfaz no lo dice en ninguna parte.
- **Consistencia con `detalle-requisito`.** Mismo bloque, mismo microcopy `"Automático"`, misma decisión de acompañar el nombre en vez de reemplazarlo. Una segunda forma de decir lo mismo en la pantalla de al lado sería peor que no decirlo.
- **No se agregó componente al Design System.** `badge` no tiene spec en `web` v0.1.0; el gap es previo y esta pantalla ya no tenía badges propios, así que la marca los introduce como tipo pero no como compromiso nuevo del catálogo. Anotado en la `## Revisión UX` de REQ-005.

### REQ-008 — Paginación y totales reales en los requisitos del proyecto (2026-08-31)

- **Los contadores de los tabs pasan a ser un dato pedido, no un cálculo derivado.** Hasta acá los 7 números salían de contar las filas que la sección ya tenía en memoria, y esas filas eran las 20 que devuelve el default del endpoint: con más de 20 requisitos **la pantalla informaba mal cuántos requisitos tiene el proyecto, y los que faltaban eran los más nuevos**. Se descartó el paliativo de pedir 100 filas para contar mejor: mueve el techo sin sacarlo, y deja a la pantalla mintiendo en silencio a partir del requisito 101. Un total pedido a la api es correcto en cualquier volumen.
- **No se agrega un aviso de "datos posiblemente incompletos".** Era la salida obvia mientras el truncado existía, y el análisis previo la proponía. Con totales reales y paginación por estado el truncado **desaparece por construcción**, así que el aviso avisaría de algo que ya no pasa: una advertencia permanente que nunca se cumple enseña a ignorar las advertencias.
- **La card sigue sin llevar su paginación a la URL.** El paginador unificado ofrece los dos modos y acá se usa el controlado. Se descartó pasar a URL: es un bloque embebido en una pantalla que ya tiene dos tablas paginadas, y compartir el `?page` entre las dos las acoplaría; además cambiaría el comportamiento de navegación, que el requerimiento pide explícitamente conservar (RF-5).
- **La ventana es de 10 números centrada, y no una elipsis con primera y última.** El recorte anterior (`1-3` + última) tiene un defecto que no es de cantidad sino de orientación: **nunca muestra dónde está parado el usuario** — en la página 15 de 30 las páginas vecinas, las únicas a las que se salta de verdad, no están. Una ventana centrada da siempre las adyacentes; ajustarla a los extremos evita el hueco al principio y al final.
- **La entrada de la card no cambia:** arranca en `Desarrollo`, con selector 5/10 y default 5 (RF-10). Es una pantalla de uso diario y el requerimiento corrige datos incorrectos, no rehace la interacción; mover el punto de entrada sería un costo de reaprendizaje sin nada a cambio.
- **Un contador que falla degrada solo su tab.** Al ser 7 consultas independientes, se eligió que el fallo de una muestre un placeholder neutro y no un error de sección: el resto de los totales y la tabla del tab activo son correctos y útiles. Se descartó mostrar `0` ante un fallo — `0` es un dato, y confundirlo con "no se pudo saber" es peor que no mostrar nada.
- **No se agregó componente al Design System.** El tipo `pagination` no tiene spec en `web` v0.1.0, pero **el gap es previo a este requerimiento**: la pantalla ya tenía dos paginadores. El catálogo es un scaffold placeholder de tres componentes y crear uno suelto acá lo desbalancea, igual que se decidió en REQ-001 y REQ-005. Anotado como gap conocido en la `## Revisión UX` de REQ-008 — con el matiz de que este requerimiento **reduce** la deuda: deja un solo paginador donde había dos, que es exactamente el estado en que conviene especificarlo cuando el DS se trabaje en serio.
- **[REQ-013] La identidad cambia; la pantalla, no.** Esta ficha documenta *qué* hay en la pantalla y *para qué* está; el Manual de marca Jiku v1.0 cambia **con qué está construido**. El accent pasa del magenta `#DA2C6A` al verde agua `#61CCB9` sobre azul oscuro `#0B1934` con fondo niebla `#F6F6F9`, y Archivo se reemplaza por Sora (títulos de vista) + Gabarito (interfaz, datos, microcopy). Ningún bloque de esta pantalla se agrega, se elimina ni cambia de propósito por ese motivo [REQ-013 RF-1, RF-2, CA-1].
- **[REQ-013] Cada elemento hecho a mano pasa a su componente del Design System.** Los bloques que esta ficha declara —botones, campos, selects, tarjetas, tablas, badges— se implementan con los componentes normativos de `docs/design-system/web/components/`, no con marcado propio. Es un cambio de implementación con consecuencia visible —dejan de haber dos botones que se ven distinto haciendo lo mismo— pero **no cambia la estructura declarada acá**: un bloque que ya existía sigue existiendo, con el mismo tipo y el mismo propósito [REQ-013 RF-3, RF-4, CA-5, CA-10].
- **[REQ-013] Los estados declarados en esta ficha se conservan.** La migración es de presentación: ningún estado se agrega, se quita ni cambia su condición de disparo. Lo que cambia es cómo se ve cada uno —el loader es ahora uno solo, el vacío tiene componente `EmptyState` disponible— sin que la ficha declare estados nuevos. **Cablear `EmptyState` en las pantallas que hoy no tienen estado vacío queda fuera de este REQ** y sigue registrado en `gaps-as-is.md` [REQ-013 §Fuera de Alcance].
- **[REQ-013] `desktop` sigue siendo el viewport único.** El requerimiento **no** habilita mobile: el DS mantiene el responsive del shell como objetivo declarado sin fecha y no declara el viewport `mobile` hasta que el shell lo cumpla. El layout por viewport de esta ficha no cambia [REQ-013 §Fuera de Alcance, CA-15].
- **[REQ-013] El selector de tema vive en el shell, no en esta pantalla.** La superficie gana modo oscuro con un control para elegirlo, ubicado en el pie de la sidebar junto a Cerrar sesión. Como es parte del shell de `(loggedin)`, está presente acá pero **no se declara como bloque de esta ficha**: declararlo en las 21 pantallas autenticadas repetiría veintiuna veces el mismo control. En modo oscuro esta pantalla usa la paleta propia del DS —canvas `#0E121A`, superficies `#1B202C` separadas por contraste y sin borde—, no una inversión de la clara [REQ-013 RF-7, CA-11].
