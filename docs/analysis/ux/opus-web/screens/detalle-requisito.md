---
document: UX Survey Screen
screen: detalle-requisito
route: /projects/[projectId]/requirements/[requirementId]
service: opus-web
source_files:
  - src/app/(dashboard)/projects/[projectId]/requirements/[requirementId]/page.tsx
  - src/features/requirements/components/RequirementDetailView/RequirementDetailView.tsx
  - src/features/requirements/components/RequirementDetailView/RequirementDetailView.module.scss
  - src/features/requirements/components/BoardHeader/BoardHeader.tsx
  - src/features/requirements/components/RequirementDetailModal/components/RequirementInfoPanel/RequirementInfoPanel.tsx
  - src/features/requirements/components/RequirementDetailModal/components/ActivityPanel/ActivityPanel.tsx
  - src/features/requirements/components/RequirementDetailModal/components/CommentInput/CommentInput.tsx
  - src/features/subscriptions/components/SubscribersList/SubscribersList.tsx
viewports_detected:
  - mobile
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: detalle-requisito

> **Relevamiento as-is** de `/projects/[projectId]/requirements/[requirementId]`, extraído de
> `.../[requirementId]/page.tsx`. Describe lo que el código hace hoy, no lo que debería hacer.

Es la **versión página** del detalle. Existe una versión overlay casi idéntica
([_overlays](./_overlays.md)) que comparte los tres paneles internos pero tiene su propio header y
su propio layout.

## Identidad

- **Ruta:** `/projects/[projectId]/requirements/[requirementId]`
- **Archivo:** `src/app/(dashboard)/projects/[projectId]/requirements/[requirementId]/page.tsx`
- **Requiere auth:** sí — `middleware.ts:45-47`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** mostrar toda la información de un requisito —propiedades, descripción,
  resolución— junto a su historial de actividad, y permitir comentar.
- **Viewports con tratamiento:** mobile, desktop — un `@include mobile` que apila los dos paneles

Envuelta por el [chrome de `(dashboard)`](./_shell.md).

## Entrada y salida

**Entradas:**
- Desde el tablero en mobile, click en una card · `MobileRequirementsBoard.tsx:71-75` (`<Link>`)
- Desde el overlay de detalle, botón "Abrir" · `ModalTopbar.tsx:57-60`
- Desde un enlace copiado con el botón "Enlace" · `ModalTopbar.tsx:62-68`,
  `BoardHeader.tsx:51-57`
- Por URL directa

**Salidas:**
- A `/projects/{id}/requirements` · botón "Volver" · `BoardHeader.tsx:138`
- A `/projects/{id}/requirements` · click en "Requisitos" del breadcrumb · `BoardHeader.tsx:81`
- A `/projects/{id}/requirements` · botón "Volver al listado" en los estados de error ·
  `[requirementId]/page.tsx:38`, `:55`

**Redirects automáticos:** ninguno.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | encabezado-detalle | `header` | — | ambos | `<BoardHeader>` con `requirementId` | `RequirementDetailView.tsx:28-35` |
| 2 | breadcrumb | `breadcrumbs` | 3 niveles | ambos | `<div className={styles.breadcrumb}>` | `BoardHeader.tsx:74-94` |
| 3 | boton-enlace | `button` | secondary · con feedback | ambos | `<button className={styles.actionBtn}>` | `BoardHeader.tsx:97-109` |
| 4 | boton-suscripcion | `button` | secondary · suscrito/no/error | ambos *(solo `external-user`)* | `<button>` | `BoardHeader.tsx:111-133` |
| 5 | boton-volver | `button` | secondary | ambos | `<button className={styles.actionBtn}>` | `BoardHeader.tsx:135-143` |
| 6 | panel-propiedades | `sidebar` | — | ambos | `<div className={styles.sidebar}>` en `RequirementInfoPanel` | `RequirementInfoPanel.tsx:87-140` |
| 7 | propiedad-estado | `badge` | 7 estados · readonly | ambos | `<div className={styles.sidebarValue}>` + punto | `RequirementInfoPanel.tsx:88-94` |
| 8 | propiedad-tipo | `section` | — | ambos | `<div className={styles.sidebarSection}>` | `RequirementInfoPanel.tsx:96-99` |
| 9 | propiedad-prioridad | `badge` | 5 prioridades · readonly | ambos | ícono de bandera + texto | `RequirementInfoPanel.tsx:101-117` |
| 10 | lista-suscriptores | `list` | — | ambos | `<SubscribersList>` | `RequirementInfoPanel.tsx:119-122` |
| 11 | propiedad-fechas | `section` | — | ambos | 2-3 `sidebarSection` | `RequirementInfoPanel.tsx:124-139` |
| 12 | titulo-requisito | `heading` | h2 | ambos | `<h2 className={styles.title}>` | `RequirementInfoPanel.tsx:144` |
| 13 | descripcion | `paragraph` | body | ambos | `<RichContentRenderer>` | `RequirementInfoPanel.tsx:146-152` |
| 14 | bloque-resolucion | `section` | — | ambos *(solo incidencias)* | `<div className={styles.resolution}>` | `RequirementInfoPanel.tsx:154-161` |
| 15 | pie-autoria | `paragraph` | caption | ambos | `<div className={styles.footer}>` | `RequirementInfoPanel.tsx:163-166` |
| 16 | titulo-actividad | `heading` | h3 | ambos | `<span className={styles.rightPanelTitle}>` | `RequirementDetailView.tsx:46` |
| 17 | feed-actividad | `list` | — | ambos | `<ActivityPanel>` | `RequirementDetailView.tsx:49` |
| 18 | item-comentario | `card` | — | ambos | `<CommentItem>` | `ActivityPanel.tsx:76-96` |
| 19 | item-cambio | `list` | timeline | ambos | `<ChangeItem>` | `ActivityPanel.tsx:98-128` |
| 20 | editor-comentario | `text-input` | multilínea con adjuntos | ambos | `<CommentInput>` → `<RichTextEditor>` | `RequirementDetailView.tsx:52` |
| 21 | boton-adjuntar | `button` | secondary | ambos | `<button className={styles.attachBtn}>` | `CommentInput.tsx:164-173` |
| 22 | boton-enviar | `button` | primary · disabled | ambos | `<button type="submit">` | `CommentInput.tsx:174-182` |
| 23 | indicador-carga | `loader` | lg | ambos | `<Spinner size="lg">` | `[requirementId]/page.tsx:26` |

> `panel-propiedades` se relevó como `sidebar`: es una columna lateral persistente dentro de la
> pantalla, aunque no sea la navegación global. `propiedad-tipo`, `propiedad-fechas` y
> `bloque-resolucion` se relevaron como `section` — son grupos etiqueta/valor sin tipo propio.

## Layout observado por viewport

### desktop · 1200px

- (chrome: sidebar-navegacion 263px)
- encabezado-detalle (61px)
  - row `header`
    - col 5/12: breadcrumb (proyecto › Requisitos › #id)
    - col 7/12: boton-enlace + boton-suscripcion + boton-volver (a la derecha)
- row `cuerpo`
  - col 7/12: panel izquierdo *(flexible)*
    - row `info`
      - col 3/12: panel-propiedades *(220px fijos)*
      - col 9/12: titulo-requisito, descripcion, bloque-resolucion, pie-autoria
  - col 5/12: panel derecho *(559px fijos)*
    - titulo-actividad
    - feed-actividad *(scroll)*
    - editor-comentario *(anclado abajo)*

**Origen:** `RequirementDetailView.module.scss:11-49` — `.body { display:flex }` con
`.leftPanel { flex: 1 1 0 }` y `.rightPanel { width: 559px; flex-shrink: 0 }`; el panel de
propiedades en `RequirementInfoPanel.module.scss:15-40` — `.layout { display:flex }` con
`.sidebar { width: 220px; flex-shrink: 0 }`.

**Las fracciones son aproximadas y el motivo importa:** el panel derecho es de **559px fijos**, no
proporcional. A 1200px de viewport menos 263 de sidebar quedan 937 útiles, así que la actividad se
lleva ~60% del ancho. A 1920px se lleva ~34%. La proporción cambia con la pantalla.

Es un layout de **tres columnas anidadas**: propiedades (220px) | contenido (flexible) |
actividad (559px).

### mobile · 400px

- *(sin chrome)*
- encabezado-detalle
- panel-propiedades *(ancho completo, con borde inferior en vez de lateral)*
- titulo-requisito, descripcion, bloque-resolucion, pie-autoria
- titulo-actividad
- feed-actividad
- editor-comentario

**Origen:** `RequirementDetailView.module.scss:91-99`:

```scss
@include mobile {
  .body { flex-direction: column; }
  .rightPanel { width: 100%; flex-shrink: 1; }
}
```

y `RequirementInfoPanel.module.scss:20-40`:

```scss
.layout { @include mobile { flex-direction: column; overflow: visible; } }
.sidebar { @include mobile { width: 100%; border-right: none; border-bottom: 1px solid #e5e7eb; } }
```

**Todo se apila en un solo stack.** Los dos anidamientos de columnas se deshacen: las propiedades
quedan arriba de todo, en una tira horizontal de secciones apiladas.

**Diferencia clave contra el overlay:** acá el mobile es un scroll continuo. El overlay usa
**tabs** ("Detalle" / "Actividad") para el mismo contenido.

## Contenido

### breadcrumb
- Texto/label: `{nombre del proyecto}` › "Requisitos" › `#{id}`
- Origen: `BoardHeader.tsx:75-93`
- Annotation: con `requirementId` presente, "Requisitos" pasa a ser un `<button>` clickeable
  (`:78-84`); sin él es un `<span>`

### boton-enlace
- Texto/label: "Enlace" · tras copiar: "Copiado"
- Origen: `BoardHeader.tsx:108`
- Icono: `Link` de lucide-react, 14px · tras copiar: `Check` · `:104-107`
- Annotation: copia `{origin}/projects/{projectId}/requirements/{requirementId}` al portapapeles y
  vuelve a "Enlace" a los **2 segundos** (`:51-57`)

### boton-suscripcion
- Texto/label: "Suscribirse" / "Desuscribirse" · en curso: "..." · en error: "Error"
- Origen: `BoardHeader.tsx:125-131`
- Icono: `Bell` / `BellOff` de lucide-react, 14px · `:120-124`
- Annotation: **solo se renderiza para `external-user`** (`:111`). El estado sale de si el
  `currentUserId` está en `subscribers` (`:35`). En error, el motivo va en el `title`: "Error al
  procesar la solicitud" (`:118`)

### boton-volver
- Texto/label: "Volver"
- Origen: `BoardHeader.tsx:142`
- Icono: `ArrowLeft` de lucide-react, 14px

### panel-propiedades
Etiquetas en orden, verbatim (`RequirementInfoPanel.tsx:89`, `:97`, `:102`, `:120`, `:125`,
`:131`, `:137`):

| Etiqueta | Valor | Ausencia |
|---|---|---|
| "Estado" | punto de color + etiqueta | — |
| "Tipo" | etiqueta del tipo | "Sin tipo" (`:44`) |
| "Prioridad" | bandera de color + etiqueta | "Sin prioridad" |
| "Suscriptores" | lista de nombres | "Sin suscriptores" (`SubscribersList.tsx:12`) |
| "Fecha de creación" | fecha larga | "Sin fecha" (`:15`) |
| "Fecha de finalización" | fecha larga | **la sección no se renderiza** (`:129`) |
| "Última actualización" | fecha larga | "Sin fecha" |

- Formato de fecha: `d 'de' MMMM yyyy` con locale `es` de date-fns (`:18`) — p. ej. "3 de marzo
  2026"
- "Última actualización" se calcula como el `createdAt` máximo de la actividad (`:21-26`), no de
  un campo del requisito
- Las etiquetas van en mayúsculas por CSS (`text-transform: uppercase`,
  `RequirementInfoPanel.module.scss:55`)

### titulo-requisito
- Texto/label: dinámico — `requirement.title`
- Origen: `RequirementInfoPanel.tsx:144`
- Annotation: **28px en esta pantalla y 26px en el overlay**, mismo componente. El override está
  en `RequirementDetailView.module.scss:27-29` con el comentario *"Override título a 28px (vs 26px
  del modal)"*

### descripcion
- Texto/label: dinámico — `requirement.description`, renderizado con `RichContentRenderer`
- Origen: `RequirementInfoPanel.tsx:146-152`
- Ausencia: "Sin descripción" (`:150`)
- Annotation: parsea placeholders de adjunto en dos formatos —`![attach:N]` de este frontend y
  `[nombre](/api/attachments/N/preview)` del gestor interno— y renderiza preview de imagen o bloque
  de descarga (`RichContentRenderer.tsx:22-24`). El resto pasa por markdown

### bloque-resolucion
- Texto/label: "Resolución" + el contenido
- Origen: `RequirementInfoPanel.tsx:154-161`
- Annotation: **solo se muestra si `type === 'incidencia'` Y hay `resolutionComment`** (`:154`).
  Un requisito de otro tipo con resolución cargada no la muestra

### pie-autoria
- Texto/label: "Elemento creado por **{nombre}**"
- Origen: `RequirementInfoPanel.tsx:165`
- Ausencia: `"—"` si no hay creador
- Annotation: dice "Elemento", no "Requisito"

### titulo-actividad
- Texto/label: "ACTIVIDAD"
- Origen: `RequirementDetailView.tsx:46` — **en mayúsculas en el código**
- Annotation: en el overlay el mismo bloque dice "Actividad" en capitalización normal
  (`RequirementDetailModal.tsx:117`), y las dos hojas aplican `text-transform: uppercase`. El
  literal difiere; el resultado visual no

### item-comentario
- Texto/label: dinámico — nombre del autor, fecha relativa, contenido
- Origen: `ActivityPanel.tsx:76-96`
- Ausencia de autor: "Usuario" (`:77`)
- Annotation: avatar de iniciales (dos primeras palabras del nombre, `:20-27`); fecha con
  `formatDistanceToNow` de date-fns con locale `es` y `addSuffix` — "hace 3 días"

### item-cambio
- Texto/label: "**{Autor}** cambió *{Campo}* de {valor anterior} a **{valor nuevo}**"
- Origen: `ActivityPanel.tsx:109-123`
- Nombres de campo: "Estado", "Prioridad", "Tipo", "Título", "Descripción" (`:30-37`)
- Annotation: para `description` **no muestra los valores**, solo "cambió Descripción" (`:113`).
  Los valores se traducen a etiquetas legibles con mapas por tipo (`:69-74`)

> **Conserva etiquetas de un enum anterior**, con el motivo escrito:
> ```ts
> // ActivityPanel.tsx:48-51
> // Valores del enum viejo (ADR-009), conservados como fallback legible para
> // historial de actividad persistido antes de REQ-040/S-064 (CA-4).
> programado: 'Programado',
> finalizado: 'Finalizado',
> ```
> Es el único lugar del frontend que trata explícitamente el historial anterior a una migración.

### editor-comentario
- Texto/label del placeholder: "Escribe un comentario..."
- Origen: `CommentInput.tsx:149` — **usa "tú" ("Escribe"), no voseo**
- Annotation: `RichTextEditor` parte el valor en segmentos de texto y adjuntos, y renderiza un
  `<textarea>` por segmento de texto (`RichTextEditor.tsx:123-135`)

### boton-adjuntar
- Texto/label: "Adjuntar"
- Origen: `CommentInput.tsx:172`
- Icono: `Paperclip` de lucide-react, 16px
- Annotation: dispara un `<input type="file">` oculto que acepta las 12 extensiones
  (`:156-163`)

### boton-enviar
- Texto/label: "Enviar"
- Origen: `CommentInput.tsx:181`
- Icono: `Send` de lucide-react, 16px
- Annotation: deshabilitado si no hay contenido o si la mutación está en curso (`:133`)

## Estados presentes

### loading
- Mensaje: "Cargando requisito..."
- Disparado por: `isLoading` de `useRequirement`
- Origen: `[requirementId]/page.tsx:23-30`
- Cambios: reemplaza la pantalla entera por spinner + texto centrados

### error de sistema
- Mensaje: "Error al cargar el requisito"
- Disparado por: `error` de `useRequirement`
- Origen: `[requirementId]/page.tsx:32-47`
- Cambios: texto de error + **dos botones**: "Volver al listado" (secondary) y "Reintentar"
  (primary)

### not found
- Mensaje: "Requisito no encontrado"
- Disparado por: la query resolvió sin error pero sin datos
- Origen: `[requirementId]/page.tsx:49-61`
- Cambios: texto + botón "Volver al listado". **Sin reintentar**, correctamente

### default
- Origen: `[requirementId]/page.tsx:63-69` → `RequirementDetailView`

### empty (actividad)
- Mensaje: "No hay actividad registrada"
- Disparado por: la lista de actividad está vacía
- Origen: `ActivityPanel.tsx:136-142`

### empty (suscriptores)
- Mensaje: "Sin suscriptores"
- Origen: `SubscribersList.tsx:11-13`

### error de validación (adjunto)
- Mensajes: "El archivo supera el límite de 10MB" · "Tipo de archivo no permitido" · "Error al
  subir el archivo"
- Disparado por: tamaño > 10 MB, extensión fuera de las 12 permitidas, o fallo de la subida
- Origen: `CommentInput.tsx:75`, `:81`, `:108`
- Cambios: `<p role="alert">` sobre el editor (`:138-142`)

### error de sistema (comentario)
- Mensajes: "Sin permiso para comentar" (403) · o el `message` del `ApiError` · o "Error al enviar
  el comentario"
- Origen: `CommentInput.tsx:38-45`
- Cambios: mismo `<p role="alert">`

### loading (subida de adjunto)
- Disparado por: `uploading === true`
- Origen: `CommentInput.tsx:151-152` → `RichTextEditor.tsx:161-165`
- Cambios: aparece un `AttachmentSkeleton` al final del editor, con forma de imagen o de archivo
  según el mime

### loading (envío de comentario)
- Disparado por: `isPending` de `useCreateComment`
- Origen: `CommentInput.tsx:133`, `:151`, `:169`
- Cambios: el editor se deshabilita y los dos botones también. **Sin texto de "enviando"**

### success (comentario)
- Origen: `CommentInput.tsx:123-127`
- Cambios: se limpian el texto, los adjuntos pendientes y el error. El comentario aparece en el
  feed tras la invalidación. **Sin toast ni confirmación explícita**

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| error de la suscripción | El botón muestra "Error" y el motivo va en un `title` — invisible en touch. No hay toast ni mensaje persistente | `BoardHeader.tsx:114-131` |
| success de la suscripción | Sin confirmación: el botón cambia de "Suscribirse" a "Desuscribirse" cuando llega el refetch | `useSubscribe.ts:11-16` — sin `onSuccess` visible |
| readonly explícito | **Presente de hecho, sin marcarse.** Estado, tipo y prioridad son de solo lectura acá para todos los roles, incluidos los internos que sí pueden editarlos en el tablero. Nada lo indica | `RequirementInfoPanel.tsx:88-117` — sin dropdowns |
| estado terminal | Un requisito `resuelto` o `cancelado` se ve igual que uno activo, y el editor de comentarios sigue habilitado | `RequirementInfoPanel.tsx`, `CommentInput.tsx` |
| empty de descripción | **Sí cubierto** — "Sin descripción" | `RequirementInfoPanel.tsx:150` |
| permiso/acceso denegado | No se distingue: un requisito de otro proyecto cae en "Requisito no encontrado" o en error, según responda la api | `[requirementId]/page.tsx:32-61` |
| error de validación del comentario vacío | No hay mensaje: el botón queda deshabilitado y el submit hace `return` en silencio | `CommentInput.tsx:117-118`, `:133` |
| feedback de "Copiado" accesible | El cambio de "Enlace" a "Copiado" es solo visual, sin `aria-live` | `BoardHeader.tsx:103-108` |

**Lo más notable:** un rol interno puede cambiar estado y prioridad desde el tablero pero **no
desde esta pantalla**. Los mismos datos son editables en una vista y de solo lectura en la otra,
sin ninguna indicación.

## Interacciones

**Eventos:**
- boton-enlace · click → copia la URL al portapapeles, cambia a "Copiado" 2 s ·
  `BoardHeader.tsx:51-57`
- boton-suscripcion · click → `subscribe` o `unsubscribe` según el estado actual · `:59-66`
- boton-volver / breadcrumb "Requisitos" · click → `router.push` al tablero · `:138`, `:81`
- boton-adjuntar · click → abre el selector de archivos · `CommentInput.tsx:167`
- input de archivo · change → valida y sube; inserta el placeholder en el texto · `:66-113`
- editor · change → actualiza el texto y **descarta los adjuntos cuyo placeholder ya no está** ·
  `:61-64`
- adjunto en el editor · click en quitar → lo saca del texto y fusiona los segmentos vecinos ·
  `RichTextEditor.tsx:101-119`
- boton-enviar / submit · → crea el comentario con los `attachmentIds` pendientes · `:115-130`

**Validaciones:**
- Adjunto · tamaño ≤ 10 MB → "El archivo supera el límite de 10MB" · `CommentInput.tsx:74-77`
- Adjunto · extensión en `jpg, jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, ppt, pptx` → "Tipo
  de archivo no permitido" · `:11-24`, `:79-83`
- Comentario · no vacío tras `trim()` → **sin mensaje**; el submit hace `return` · `:117-118`

**Feedback:**
- Comentario enviado → el editor se limpia y el comentario aparece en el feed tras invalidar
  `['requirement', requirementId]` · `useCreateComment.ts:10-12`
- Subida en curso → skeleton en el editor
- Enlace copiado → el botón dice "Copiado" 2 s

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Encabezado de página | **parcial** — hay un `<h2>` con el título del requisito, pero ningún `<h1>` en la pantalla | `RequirementInfoPanel.tsx:144` |
| Botones de acción con label | **presente** — `aria-label` en los tres del header | `BoardHeader.tsx:101`, `:117`, `:139` |
| Iconos decorativos | **presente** — `aria-hidden="true"` en los de lucide y en los SVG | `BoardHeader.tsx:104`, `RequirementInfoPanel.tsx:111` |
| Mensajes de error anunciados | **presente** — `role="alert"` en el error del comentario | `CommentInput.tsx:139` |
| Input de archivo etiquetado | **presente** — `aria-label="Adjuntar archivo"` en el input y `aria-label="Adjuntar archivo al comentario"` en el botón | `CommentInput.tsx:162`, `:168` |
| Botón enviar etiquetado | **presente** — `aria-label="Enviar comentario"` | `CommentInput.tsx:178` |
| Avatar de comentario | **presente** — `aria-hidden="true"` en las iniciales | `ActivityPanel.tsx:82` |
| Timeline decorativo | **presente** — punto y línea con `aria-hidden` | `ActivityPanel.tsx:105-106` |
| Breadcrumb semántico | **ausente** — `<div>` sin `<nav aria-label>` ni lista | `BoardHeader.tsx:74` |
| Punto de estado | **presente** — `aria-hidden="true"`, el texto lleva la información | `RequirementInfoPanel.tsx:91` |
| Feed como lista | **ausente** — `<div>` anidados, sin `<ul>`/`<li>` ni `role="list"` | `ActivityPanel.tsx:145-153` |
| Lista de suscriptores | **presente** — `<ul>`/`<li>` reales | `SubscribersList.tsx:16-22` |
| Cambio de "Enlace" a "Copiado" | **ausente** — sin `aria-live`; un lector no lo anuncia | `BoardHeader.tsx:103-108` |
| Etiqueta del editor | **ausente** — el `<textarea>` solo tiene `placeholder`, sin `<label>` ni `aria-label` | `RichTextEditor.tsx:126-134` |
| Foco tras enviar | **ausente** — no se devuelve el foco al editor | `CommentInput.tsx:123-127` |

## Observaciones del relevamiento

- **Esta pantalla y el overlay son dos implementaciones del mismo detalle.** Comparten los tres
  paneles internos (`RequirementInfoPanel`, `ActivityPanel`, `CommentInput`) y difieren en el
  header (`BoardHeader` vs `ModalTopbar`), el layout y dos medidas: el título (28 vs 26px) y el
  panel de actividad (559 vs 558px). Las diferencias no parecen intencionales.

- **El comportamiento en mobile difiere entre las dos.** Acá todo se apila en un scroll continuo;
  el overlay usa tabs "Detalle" / "Actividad". Mismo contenido, dos modelos de navegación — y el
  usuario llega a uno u otro según desde dónde abra el requisito.

- **El feed mezcla dos tipos de ítem con tratamiento visual distinto:** los comentarios son cards
  con avatar; los cambios son una timeline con punto y línea. La línea se dibuja salvo cuando el
  siguiente ítem es un comentario (`ActivityPanel.tsx:151`), lo que corta el hilo visual en cada
  comentario.

- **El orden del feed es ascendente** (lo más viejo arriba, `ActivityPanel.tsx:132-134`), así que
  lo último queda al fondo — junto al editor. No hay auto-scroll al final: en un requisito con
  mucha actividad, lo nuevo no se ve al abrir.

- **`Comment` (`comments/types/comment.types.ts:1-10`) se declara y no se usa.** El feed tipa todo
  con `RequirementActivity`.

- **Los adjuntos se resuelven con un `HEAD` por adjunto** para sacar nombre y tamaño de
  `Content-Disposition` y `Content-Length` (`RichContentRenderer.tsx:94-116`). Si ese fetch falla
  hay un `.catch` vacío: el adjunto se muestra sin nombre ni tamaño, sin ninguna señal.

- **`RichContentRenderer` soporta el formato de adjuntos de los dos frontends** (`:22-24`), lo que
  confirma que el contenido creado en el gestor interno se lee acá.

- **El editor de comentarios es un `<textarea>` por segmento de texto**, no un editor único. Al
  insertar un adjunto en el medio, el texto se parte en dos textareas independientes. El foco no
  se maneja entre ellos.

- No se pudo determinar si el bloque de resolución debería mostrarse para tipos distintos de
  `incidencia`: el campo `resolutionComment` existe en todos los requisitos y solo se renderiza
  para ese tipo (`RequirementInfoPanel.tsx:154`).

- No se pudo determinar por qué el estado y la prioridad son de solo lectura acá y editables en el
  tablero. A confirmar en consolidación.
