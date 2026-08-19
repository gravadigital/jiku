---
name: detalle-requisito
surface: opus-web
route: /projects/[projectId]/requirements/[requirementId]
viewports:
  - mobile
  - desktop
audiences:
  - cliente
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Detalle de requisito

> Este documento describe la **versión página** del detalle. Existe además una versión overlay casi idéntica (`RequirementDetailModal`), que se abre desde el tablero en desktop y comparte los tres paneles internos con esta pantalla pero tiene su propio header y su propio layout. **El overlay es un overlay de la superficie y está documentado aparte: acá se lo referencia, no se lo duplica** [fuente: código-existente].

## Identidad

- **Audiencia primaria:**
  - [cliente](../../../audiences/cliente/research-context.md) — la audiencia no es determinable desde el código; se transcribe la declarada para la superficie [fuente: código-existente].
- **JTBD / Propósito:** Mostrar toda la información de un requisito —propiedades, descripción, resolución— junto a su historial de actividad, y permitir comentar.
- **Viewports:**
  - **mobile** — todo se apila en un scroll continuo: las propiedades quedan arriba de todo y la actividad debajo. Un `@include mobile` deshace los dos anidamientos de columnas. Sin chrome: el sidebar no se renderiza.
  - **desktop** — layout de tres columnas anidadas: propiedades (220px) | contenido (flexible) | actividad (559px fijos), con el sidebar del shell a la izquierda.
  - **Diferencia clave contra el overlay:** acá el mobile es un scroll continuo; el overlay usa tabs ("Detalle" / "Actividad") para el mismo contenido. El usuario llega a uno u otro según desde dónde abra el requisito.
  - Tablet: se comporta como desktop (el corte real de la superficie es 768px).

Envuelta por el chrome de `(dashboard)`.

## Entrada y salida

**Entradas:**
- Desde el tablero en mobile, click en una card · `MobileRequirementsBoard.tsx:71-75` (`<Link>`) [fuente: código-existente]
- Desde el overlay de detalle, botón "Abrir" · `ModalTopbar.tsx:57-60`
- Desde un enlace copiado con el botón "Enlace" · `ModalTopbar.tsx:62-68`, `BoardHeader.tsx:51-57`
- Por URL directa

**Salidas user-driven:**
- A `/projects/{id}/requirements` · botón "Volver" · `BoardHeader.tsx:138`
- A `/projects/{id}/requirements` · click en "Requisitos" del breadcrumb · `BoardHeader.tsx:81`
- A `/projects/{id}/requirements` · botón "Volver al listado" en los estados de error y not found · `[requirementId]/page.tsx:38`, `:55`

**Salidas automáticas:**
- Ninguna.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | encabezado-detalle | header | — | layout | ambos | hidden_in_states: loading, error de sistema / sin conexión, not found | Breadcrumb + acciones del detalle |
| 2 | breadcrumb | breadcrumbs | 3 niveles | navigation | ambos | hidden_in_states: loading, error de sistema / sin conexión, not found | Ubicación y vuelta al tablero |
| 3 | boton-enlace | button | secondary · con feedback | input | ambos | hidden_in_states: loading, error de sistema / sin conexión, not found | Copiar la URL del requisito |
| 4 | boton-suscripcion | button | secondary · suscrito/no/error | input | ambos *(solo `external-user`)* | hidden_in_states: loading, error de sistema / sin conexión, not found | Suscribirse a las novedades |
| 5 | boton-volver | button | secondary | input | ambos | hidden_in_states: loading, error de sistema / sin conexión, not found | Volver al tablero |
| 6 | panel-propiedades | sidebar | — | layout | ambos | visible_only_in_states: default | Columna de propiedades del requisito |
| 7 | propiedad-estado | badge | 7 estados · readonly | content | ambos | visible_only_in_states: default | Estado actual, de solo lectura |
| 8 | propiedad-tipo | section | — | content | ambos | visible_only_in_states: default | Tipo del requisito |
| 9 | propiedad-prioridad | badge | 5 prioridades · readonly | content | ambos | visible_only_in_states: default | Prioridad, de solo lectura |
| 10 | lista-suscriptores | list | — | content | ambos | visible_only_in_states: default | Quiénes siguen el requisito |
| 11 | propiedad-fechas | section | — | content | ambos | visible_only_in_states: default | Creación, finalización y última actualización |
| 12 | titulo-requisito | heading | h2 | content | ambos | visible_only_in_states: default | Título del requisito |
| 13 | descripcion | paragraph | body | content | ambos | visible_only_in_states: default | Descripción con adjuntos y markdown |
| 14 | bloque-resolucion | section | — | content | ambos *(solo incidencias)* | visible_only_in_states: default | Resolución de la incidencia |
| 15 | pie-autoria | paragraph | caption | content | ambos | visible_only_in_states: default | Quién creó el requisito |
| 16 | titulo-actividad | heading | h3 | content | ambos | visible_only_in_states: default | Encabeza el panel de actividad |
| 17 | feed-actividad | list | — | content | ambos | visible_only_in_states: default | Historial de comentarios y cambios |
| 18 | item-comentario | card | — | content | ambos | visible_only_in_states: default | Un comentario del feed |
| 19 | item-cambio | list | timeline | content | ambos | visible_only_in_states: default | Un cambio de campo en el feed |
| 20 | editor-comentario | text-input | multilínea con adjuntos | input | ambos | visible_only_in_states: default | Escribir un comentario |
| 21 | boton-adjuntar | button | secondary | input | ambos | visible_only_in_states: default | Adjuntar un archivo al comentario |
| 22 | boton-enviar | button | primary · disabled | input | ambos | visible_only_in_states: default | Enviar el comentario |
| 23 | indicador-carga | loader | lg | feedback | ambos | visible_only_in_states: loading | Señal de carga de la pantalla entera |
| 24 | sidebar-navegacion | sidebar | — | layout | solo desktop | — | Chrome de `(dashboard)`: proyectos, alta y cerrar sesión. Bajo 768px no se renderiza |
| 25 | alerta-sistema | alert | error | feedback | ambos | visible_only_in_states: error de sistema / sin conexión | Texto del fallo de carga |
| 26 | alerta-not-found | alert | error | feedback | ambos | visible_only_in_states: not found | Texto de requisito inexistente |
| 27 | boton-volver-listado | button | secondary | input | ambos | visible_only_in_states: error de sistema / sin conexión, not found | Salida del estado de excepción |
| 28 | boton-reintentar | button | primary | input | ambos | visible_only_in_states: error de sistema / sin conexión | Reintentar la carga. **No existe en not found** |

**Origen:** `src/app/(dashboard)/projects/[projectId]/requirements/[requirementId]/page.tsx`, `RequirementDetailView/RequirementDetailView.tsx`, `RequirementDetailView/RequirementDetailView.module.scss`, `BoardHeader/BoardHeader.tsx`, `RequirementDetailModal/components/RequirementInfoPanel/RequirementInfoPanel.tsx`, `RequirementDetailModal/components/ActivityPanel/ActivityPanel.tsx`, `RequirementDetailModal/components/CommentInput/CommentInput.tsx`, `subscriptions/components/SubscribersList/SubscribersList.tsx` [fuente: código-existente].

Notas de tipificación del relevamiento: `panel-propiedades` se relevó como `sidebar` — es una columna lateral persistente dentro de la pantalla, aunque no sea la navegación global. `propiedad-tipo`, `propiedad-fechas` y `bloque-resolucion` se relevaron como `section` — son grupos etiqueta/valor sin tipo propio.

## Layout por viewport

### mobile · 390px

- *(sin chrome)*
- encabezado-detalle
- panel-propiedades *(ancho completo, con borde inferior en vez de lateral)*
- titulo-requisito
- descripcion
- bloque-resolucion
- pie-autoria
- titulo-actividad
- feed-actividad
- editor-comentario

**Origen:** `RequirementDetailView.module.scss:91-99` — `@include mobile { .body { flex-direction: column } .rightPanel { width: 100%; flex-shrink: 1 } }` y `RequirementInfoPanel.module.scss:20-40` — `.layout { @include mobile { flex-direction: column; overflow: visible } }`, `.sidebar { @include mobile { width: 100%; border-right: none; border-bottom: 1px solid #e5e7eb } }` [fuente: código-existente].

**Todo se apila en un solo stack.** Los dos anidamientos de columnas se deshacen: las propiedades quedan arriba de todo, en una tira de secciones apiladas. **Las fracciones de columna no son derivables del código:** en mobile no hay columnas.

### desktop · 1440px

- *(chrome: sidebar-navegacion 263px)*
- encabezado-detalle *(61px)*
  - row `header`
    - col 5/12: breadcrumb *(proyecto › Requisitos › #id)*
    - col 7/12: boton-enlace, boton-suscripcion, boton-volver *(a la derecha)*
- row `cuerpo`
  - col 7/12: panel izquierdo *(flexible)*
    - row `info`
      - col 3/12: panel-propiedades *(220px fijos)* — propiedad-estado, propiedad-tipo, propiedad-prioridad, lista-suscriptores, propiedad-fechas
      - col 9/12: titulo-requisito, descripcion, bloque-resolucion, pie-autoria
  - col 5/12: panel derecho *(559px fijos)*
    - titulo-actividad
    - feed-actividad *(scroll)* — item-comentario, item-cambio
    - editor-comentario *(anclado abajo)* — boton-adjuntar, boton-enviar

**Origen:** `RequirementDetailView.module.scss:11-49` — `.body { display:flex }` con `.leftPanel { flex: 1 1 0 }` y `.rightPanel { width: 559px; flex-shrink: 0 }`; el panel de propiedades en `RequirementInfoPanel.module.scss:15-40` — `.layout { display:flex }` con `.sidebar { width: 220px; flex-shrink: 0 }` [fuente: código-existente].

**Las fracciones son aproximadas y no son derivables del código como fracciones, y el motivo importa:** el panel derecho es de **559px fijos**, no proporcional, y el de propiedades de **220px fijos**. A 1200px de viewport menos 263 de sidebar quedan 937 útiles, así que la actividad se lleva ~60% del ancho; a 1920px se lleva ~34%. La proporción cambia con la pantalla. Las fracciones 5/12 y 7/12 del header tampoco son una grilla: es un reparto entre dos grupos de ancho natural.

Es un layout de **tres columnas anidadas**: propiedades (220px) | contenido (flexible) | actividad (559px).

## Contenido

### encabezado-detalle
- Texto/label: sin texto propio — contiene el breadcrumb y los tres botones de acción
- Icono: nada
- Asset: nada
- Annotation: es el mismo `BoardHeader` del tablero, invocado con `requirementId` (`RequirementDetailView.tsx:28-35`). 61px de alto

### breadcrumb
- Texto/label: `{nombre del proyecto}` › "Requisitos" › `#{id}`
- Icono: nada — el separador `›` es un carácter literal
- Asset: nada
- Annotation: con `requirementId` presente, "Requisitos" pasa a ser un `<button>` clickeable (`BoardHeader.tsx:78-84`); sin él es un `<span>`

### boton-enlace
- Texto/label: "Enlace" · tras copiar: "Copiado"
- Icono: `Link` de lucide-react, 14px · tras copiar: `Check` (`BoardHeader.tsx:104-107`)
- Asset: nada
- Annotation: copia `{origin}/projects/{projectId}/requirements/{requirementId}` al portapapeles y vuelve a "Enlace" a los **2 segundos** (`:51-57`)

### boton-suscripcion
- Texto/label: "Suscribirse" / "Desuscribirse" · en curso: "..." · en error: "Error"
- Icono: `Bell` / `BellOff` de lucide-react, 14px (`BoardHeader.tsx:120-124`)
- Asset: nada
- Annotation: **solo se renderiza para `external-user`** (`:111`). El estado sale de si el `currentUserId` está en `subscribers` (`:35`). En error, el motivo va en el `title`: "Error al procesar la solicitud" (`:118`)

### boton-volver
- Texto/label: "Volver"
- Icono: `ArrowLeft` de lucide-react, 14px
- Asset: nada
- Annotation: `router.push` al tablero (`BoardHeader.tsx:138`)

### panel-propiedades
- Texto/label — etiquetas en orden, verbatim, con su valor y su texto de ausencia:

| Etiqueta | Valor | Ausencia |
|---|---|---|
| "Estado" | punto de color + etiqueta | — |
| "Tipo" | etiqueta del tipo | "Sin tipo" |
| "Prioridad" | bandera de color + etiqueta | "Sin prioridad" |
| "Suscriptores" | lista de nombres | "Sin suscriptores" |
| "Fecha de creación" | fecha larga | "Sin fecha" |
| "Fecha de finalización" | fecha larga | **la sección no se renderiza** |
| "Última actualización" | fecha larga | "Sin fecha" |

- Icono: punto de color (estado), bandera de color (prioridad)
- Asset: nada
- Annotation: origen en `RequirementInfoPanel.tsx:89`, `:97`, `:102`, `:120`, `:125`, `:131`, `:137`; ausencias en `:44`, `SubscribersList.tsx:12`, `:15`, `:129`. Formato de fecha `d 'de' MMMM yyyy` con locale `es` de date-fns (`:18`) — p. ej. "3 de marzo 2026". "Última actualización" se calcula como el `createdAt` máximo de la actividad (`:21-26`), no de un campo del requisito. Las etiquetas van en mayúsculas por CSS (`text-transform: uppercase`)

### propiedad-estado
- Texto/label: la etiqueta del estado actual ("Análisis", "Planificación", "En cola", "Desarrollo", "Revisión", "Resuelto", "Cancelado")
- Icono: punto de color
- Asset: nada
- Annotation: **de solo lectura acá para todos los roles**, incluidos los internos que sí pueden editarlo en el tablero. Nada lo indica (`RequirementInfoPanel.tsx:88-94`)

### propiedad-tipo
- Texto/label: "Tipo" + la etiqueta del tipo · ausencia: "Sin tipo"
- Icono: nada
- Asset: nada
- Annotation: `RequirementInfoPanel.tsx:96-99`, ausencia en `:44`

### propiedad-prioridad
- Texto/label: la etiqueta de la prioridad ("Sin prioridad", "Baja", "Media", "Alta", "Urgente")
- Icono: bandera de color
- Asset: nada
- Annotation: de solo lectura acá para todos los roles (`RequirementInfoPanel.tsx:101-117`)

### lista-suscriptores
- Texto/label: lista de nombres · ausencia: "Sin suscriptores"
- Icono: nada
- Asset: nada
- Annotation: `SubscribersList.tsx:11-13`, `:16-22` — es una `<ul>`/`<li>` real

### propiedad-fechas
- Texto/label: "Fecha de creación", "Fecha de finalización", "Última actualización" + fecha larga · ausencia: "Sin fecha"
- Icono: nada
- Asset: nada
- Annotation: la sección de finalización **no se renderiza** si no hay fecha (`RequirementInfoPanel.tsx:129`)

### titulo-requisito
- Texto/label: dinámico — `requirement.title`
- Icono: nada
- Asset: nada
- Annotation: **28px en esta pantalla y 26px en el overlay**, mismo componente. El override está en `RequirementDetailView.module.scss:27-29` con el comentario *"Override título a 28px (vs 26px del modal)"*

### descripcion
- Texto/label: dinámico — `requirement.description`, renderizado con `RichContentRenderer` · ausencia: "Sin descripción" (`RequirementInfoPanel.tsx:150`)
- Icono: nada
- Asset: previews de imagen o bloques de descarga para los adjuntos embebidos
- Annotation: parsea placeholders de adjunto en dos formatos —`![attach:N]` de este frontend y `[nombre](/api/attachments/N/preview)` del gestor interno— y renderiza preview de imagen o bloque de descarga (`RichContentRenderer.tsx:22-24`). El resto pasa por markdown. Los adjuntos se resuelven con un `HEAD` por adjunto; si ese fetch falla hay un `.catch` vacío y el adjunto se muestra sin nombre ni tamaño

### bloque-resolucion
- Texto/label: "Resolución" + el contenido
- Icono: nada
- Asset: nada
- Annotation: **solo se muestra si `type === 'incidencia'` Y hay `resolutionComment`** (`RequirementInfoPanel.tsx:154`). Un requisito de otro tipo con resolución cargada no la muestra

### pie-autoria
- Texto/label: "Elemento creado por **{nombre}**" · ausencia del creador: `"—"`
- Icono: nada
- Asset: nada
- Annotation: `RequirementInfoPanel.tsx:165`. Dice "Elemento", no "Requisito"

### titulo-actividad
- Texto/label: "ACTIVIDAD"
- Icono: nada
- Asset: nada
- Annotation: **en mayúsculas en el código** (`RequirementDetailView.tsx:46`). En el overlay el mismo bloque dice "Actividad" en capitalización normal, y las dos hojas aplican `text-transform: uppercase`: el literal difiere, el resultado visual no

### feed-actividad
- Texto/label: la secuencia de item-comentario e item-cambio · vacío: "No hay actividad registrada"
- Icono: nada
- Asset: nada
- Annotation: orden **ascendente** (lo más viejo arriba, `ActivityPanel.tsx:132-134`), así que lo último queda al fondo, junto al editor. No hay auto-scroll al final

### item-comentario
- Texto/label: dinámico — nombre del autor, fecha relativa, contenido · autor ausente: "Usuario"
- Icono: nada
- Asset: avatar de iniciales (dos primeras palabras del nombre)
- Annotation: `ActivityPanel.tsx:76-96`, ausencia en `:77`, iniciales en `:20-27`; fecha con `formatDistanceToNow` de date-fns con locale `es` y `addSuffix` — "hace 3 días"

### item-cambio
- Texto/label: "**{Autor}** cambió *{Campo}* de {valor anterior} a **{valor nuevo}**". Nombres de campo: "Estado", "Prioridad", "Tipo", "Título", "Descripción"
- Icono: punto y línea de timeline
- Asset: nada
- Annotation: `ActivityPanel.tsx:109-123`, campos en `:30-37`. Para `description` **no muestra los valores**, solo "cambió Descripción" (`:113`). Conserva etiquetas de un enum anterior como fallback legible para historial persistido antes de una migración — "Programado", "Finalizado" (`:48-51`), con el motivo escrito en el código. La línea de la timeline se dibuja salvo cuando el siguiente ítem es un comentario (`:151`)

### editor-comentario
- Texto/label del placeholder: "Escribe un comentario..."
- Icono: nada
- Asset: nada
- Annotation: `CommentInput.tsx:149` — **usa "tú" ("Escribe"), no voseo**; queda registrado como hallazgo de microcopy, no se corrige acá. `RichTextEditor` parte el valor en segmentos de texto y adjuntos y renderiza un `<textarea>` por segmento de texto (`RichTextEditor.tsx:123-135`): al insertar un adjunto en el medio, el texto se parte en dos textareas independientes

### boton-adjuntar
- Texto/label: "Adjuntar"
- Icono: `Paperclip` de lucide-react, 16px
- Asset: nada
- Annotation: dispara un `<input type="file">` oculto que acepta las 12 extensiones permitidas (`CommentInput.tsx:156-163`)

### boton-enviar
- Texto/label: "Enviar"
- Icono: `Send` de lucide-react, 16px
- Asset: nada
- Annotation: deshabilitado si no hay contenido o si la mutación está en curso (`CommentInput.tsx:133`)

### indicador-carga
- Texto/label: texto visualmente oculto "Cargando..." dentro del spinner
- Icono: spinner, `size="lg"`
- Asset: nada
- Annotation: `role="status"` (`Spinner.tsx:9`). Acompañado del texto "Cargando requisito..."

### sidebar-navegacion
- Texto/label: "Opus" + la lista de proyectos + "Nuevo requisito" + "Cerrar sesión"
- Icono: folder por proyecto · plus en el alta · lock en cerrar sesión
- Asset: nada
- Annotation: chrome del grupo `(dashboard)`, no de esta pantalla. `display:none` bajo 768px (`Sidebar.module.scss:13`) **sin reemplazo**: en mobile el detalle no tiene ninguna salida de navegación fuera de sus propios botones

### alerta-sistema
- Texto/label: "Error al cargar el requisito"
- Icono: error (automático por `kind`)
- Asset: nada
- Annotation: `[requirementId]/page.tsx:32-47` · disparado por el `error` de `useRequirement`

### alerta-not-found
- Texto/label: "Requisito no encontrado"
- Icono: error (automático por `kind`)
- Asset: nada
- Annotation: `[requirementId]/page.tsx:49-61` · query resuelta sin error y sin datos. **No distingue permiso denegado** de inexistente

### boton-volver-listado
- Texto/label: "Volver al listado"
- Icono: arrow-left
- Asset: nada
- Annotation: única salida en `not found`; en `error de sistema` acompaña a "Reintentar"

### boton-reintentar
- Texto/label: "Reintentar"
- Icono: refresh
- Asset: nada
- Annotation: `refetch()` de `useRequirement`, no navega. **No existe en `not found`**: ahí reintentar no tendría sentido

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base) · `[requirementId]/page.tsx:63-69` → `RequirementDetailView` [fuente: código-existente]
- Sub-estados implementados dentro del default:
  - **empty (actividad)** — Mensaje: "No hay actividad registrada" · feed-actividad reemplazado por el texto (`ActivityPanel.tsx:136-142`)
  - **empty (suscriptores)** — Mensaje: "Sin suscriptores" (`SubscribersList.tsx:11-13`)
  - **empty (descripción)** — Mensaje: "Sin descripción" (`RequirementInfoPanel.tsx:150`)
  - **loading (subida de adjunto)** — aparece un `AttachmentSkeleton` al final del editor, con forma de imagen o de archivo según el mime, disparado por `uploading === true` (`CommentInput.tsx:151-152` → `RichTextEditor.tsx:161-165`)
  - **loading (envío de comentario)** — el editor, boton-adjuntar y boton-enviar se deshabilitan, disparado por `isPending` de `useCreateComment`. **Sin texto de "enviando"** (`CommentInput.tsx:133`, `:151`, `:169`)

### empty
- Aplica: No — no implementado (ver gaps-as-is.md) a nivel pantalla. Un requisito siempre tiene contenido; los vacíos son por bloque y están listados como sub-estados del default

### loading
- Aplica: Sí
- Mensaje: "Cargando requisito..."
- Cambios:
  - indicador-carga: solo visible en este estado (visible_only_in_states)
  - todos los demás bloques: ocultos en este estado (hidden_in_states) — **reemplaza la pantalla entera** por spinner + texto centrados · `[requirementId]/page.tsx:23-30`
- Annotation: disparado por `isLoading` de `useRequirement` [fuente: código-existente]

### error de validación
- Aplica: Sí — solo en el editor de comentarios (adjuntos)
- Mensaje: "El archivo supera el límite de 10MB" · "Tipo de archivo no permitido" · "Error al subir el archivo"
- Cambios:
  - editor-comentario: `<p role="alert">` agregado sobre el editor con el mensaje (`CommentInput.tsx:138-142`)
- Annotation: disparado por tamaño > 10 MB, extensión fuera de las 12 permitidas, o fallo de la subida (`CommentInput.tsx:75`, `:81`, `:108`). **El comentario vacío no tiene mensaje:** el botón queda deshabilitado y el submit hace `return` en silencio (`:117-118`, `:133`)

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: "Error al cargar el requisito"
- Cambios:
  - texto de error + **dos botones**: "Volver al listado" (secondary) y "Reintentar" (primary)
  - todos los bloques de contenido: ocultos en este estado (hidden_in_states) · `[requirementId]/page.tsx:32-47`
- Annotation: disparado por `error` de `useRequirement`. Hay además un error de sistema propio del comentario, dentro del default: "Sin permiso para comentar" (403), o el `message` del `ApiError`, o "Error al enviar el comentario", en el mismo `<p role="alert">` (`CommentInput.tsx:38-45`). El **error de la suscripción no está implementado como estado**: el botón muestra "Error" y el motivo va en un `title`, invisible en touch, sin toast ni mensaje persistente (`BoardHeader.tsx:114-131`)

### success
- Aplica: Sí — solo para el envío de comentario
- Mensaje: ninguno — **sin toast ni confirmación explícita**
- Cambios:
  - editor-comentario: se limpian el texto, los adjuntos pendientes y el error
  - feed-actividad: el comentario aparece tras la invalidación de `['requirement', requirementId]` · `CommentInput.tsx:123-127`, `useCreateComment.ts:10-12`
- Annotation: el **success de la suscripción no está implementado**: sin confirmación, el botón cambia de "Suscribirse" a "Desuscribirse" cuando llega el refetch (`useSubscribe.ts:11-16`)

### not found
- Aplica: Sí
- Mensaje: "Requisito no encontrado"
- Cambios:
  - texto + botón "Volver al listado". **Sin reintentar**
  - todos los bloques de contenido: ocultos en este estado (hidden_in_states) · `[requirementId]/page.tsx:49-61`
- Annotation: disparado por una query que resolvió sin error pero sin datos. Un requisito de otro proyecto cae acá o en error, según responda la api: **no se distingue el permiso denegado**. Es el único estado not-found implementado de la superficie; no hay `not-found.tsx` en ninguna ruta

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). Está presente de hecho y sin marcarse: estado, tipo y prioridad son de solo lectura acá para todos los roles, incluidos los internos que sí pueden editarlos en el tablero, y nada lo indica (`RequirementInfoPanel.tsx:88-117`). Un requisito `resuelto` o `cancelado` se ve igual que uno activo, y el editor de comentarios sigue habilitado

## Interacciones

**Eventos:**
- boton-enlace · on click → copia la URL al portapapeles, cambia a "Copiado" 2 s · `BoardHeader.tsx:51-57` [fuente: código-existente]
- boton-suscripcion · on click → `subscribe` o `unsubscribe` según el estado actual · `:59-66`
- boton-volver · on click → `router.push` al tablero · `:138`
- breadcrumb "Requisitos" · on click → `router.push` al tablero · `:81`
- boton-adjuntar · on click → abre el selector de archivos · `CommentInput.tsx:167`
- input de archivo · on change → valida y sube; inserta el placeholder en el texto · `:66-113`
- editor-comentario · on change → actualiza el texto y **descarta los adjuntos cuyo placeholder ya no está** · `:61-64`
- adjunto en el editor · on click en quitar → lo saca del texto y fusiona los segmentos vecinos · `RichTextEditor.tsx:101-119`
- boton-enviar / submit · → crea el comentario con los `attachmentIds` pendientes · `CommentInput.tsx:115-130`

**Validaciones:**
- Adjunto · tamaño ≤ 10 MB → mensaje "El archivo supera el límite de 10MB" · `CommentInput.tsx:74-77`
- Adjunto · extensión en `jpg, jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, ppt, pptx` → mensaje "Tipo de archivo no permitido" · `:11-24`, `:79-83`
- Comentario · no vacío tras `trim()` → **sin mensaje**; el submit hace `return` en silencio · `:117-118`

**Feedback:**
- Comentario enviado → el editor se limpia y el comentario aparece en el feed tras invalidar `['requirement', requirementId]` · `useCreateComment.ts:10-12`
- Subida en curso → skeleton en el editor
- Enlace copiado → el botón dice "Copiado" 2 s

## Accesibilidad

- **Orden de foco:** breadcrumb ("Requisitos" es un `<button>` cuando hay `requirementId`) → boton-enlace → boton-suscripcion *(solo `external-user`)* → boton-volver → editor-comentario → boton-adjuntar → boton-enviar. El panel de propiedades y el feed no aportan elementos focalizables [fuente: código-existente].
- **Landmarks y jerarquía:** el landmark `<main>` lo hereda del shell. **La jerarquía arranca en `<h2>`: hay un `<h2>` con el título del requisito y ningún `<h1>` en la pantalla** (`RequirementInfoPanel.tsx:144`). El breadcrumb **no es semántico**: `<div>` sin `<nav aria-label>` ni lista (`BoardHeader.tsx:74`).
- **Foco y teclado:** esta pantalla no monta overlays propios; es la alternativa navegable al overlay de detalle. **Ningún overlay de la superficie atrapa el foco ni lo devuelve al cerrar**, incluido el overlay equivalente a esta pantalla. **Tras enviar un comentario el foco no se devuelve al editor** (`CommentInput.tsx:123-127`).
- **Propio de esta composición:**
  - El **cambio de "Enlace" a "Copiado" no se anuncia**: sin `aria-live` (`BoardHeader.tsx:103-108`).
  - El **feed de actividad no es una lista**: `<div>` anidados, sin `<ul>`/`<li>` ni `role="list"` (`ActivityPanel.tsx:145-153`).
  - El **`<textarea>` del editor no tiene etiqueta**: solo `placeholder`, sin `<label>` ni `aria-label` (`RichTextEditor.tsx:126-134`). Y como el editor se parte en un `<textarea>` por segmento de texto, el foco no se maneja entre ellos.
  - Presentes: `aria-label` en los tres botones del header (`BoardHeader.tsx:101`, `:117`, `:139`), `role="alert"` en el error del comentario (`CommentInput.tsx:139`), `aria-label` en el input de archivo y en los botones de adjuntar y enviar (`:162`, `:168`, `:178`), `aria-hidden` en iconos decorativos, avatar de comentario, timeline y punto de estado, y `<ul>`/`<li>` reales en la lista de suscriptores (`SubscribersList.tsx:16-22`).

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
