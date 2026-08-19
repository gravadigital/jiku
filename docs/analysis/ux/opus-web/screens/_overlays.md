---
document: UX Survey Screen
screen: _overlays
route: "(varias)"
service: opus-web
source_files:
  - src/features/requirements/components/RequirementDetailModal/RequirementDetailModal.tsx
  - src/features/requirements/components/RequirementDetailModal/RequirementDetailModal.module.scss
  - src/features/requirements/components/RequirementDetailModal/components/ModalTopbar/ModalTopbar.tsx
  - src/features/requirements/components/CreateRequirementModal/CreateRequirementModal.tsx
  - src/features/requirements/components/CreateRequirementModal/CreateRequirementModal.types.ts
  - src/features/subscriptions/components/UserSelector/UserSelector.tsx
  - src/shared/components/ui/Dropdown/Dropdown.tsx
  - src/shared/components/ui/Toast/Toast.tsx
viewports_detected:
  - mobile
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: overlays

> **Relevamiento as-is** de los overlays de `opus-web`, extraídos de sus componentes.
> Describe lo que el código hace hoy, no lo que debería hacer.

Siete overlays alcanzables desde la UI, más dos que existen en el código y **no se pueden abrir**.
Ninguno es una ruta.

| Overlay | Tipo | Disparado desde | Archivo |
|---|---|---|---|
| [Detalle de requisito](#1-detalle-de-requisito) | modal (desktop) / fullscreen con tabs (mobile) | tablero-requisitos | `RequirementDetailModal.tsx` |
| [Nuevo requisito](#2-nuevo-requisito) | modal | Sidebar | `CreateRequirementModal.tsx` |
| [Dropdown de estado](#3-dropdowns-de-estado-y-prioridad) | dropdown en portal | fila de lista, card de kanban | `Dropdown.tsx` |
| [Dropdown de prioridad](#3-dropdowns-de-estado-y-prioridad) | dropdown en portal | fila de lista, card de kanban | `Dropdown.tsx` |
| [Dropdowns del formulario](#4-dropdowns-del-formulario) | panel posicionado a mano | Nuevo requisito | `CreateRequirementModal.tsx:581-645` |
| [Selector de suscriptores](#5-selector-de-suscriptores) | panel posicionado a mano | Nuevo requisito | `UserSelector.tsx:65-83` |
| [Toast](#6-toast) | notificación efímera | `useUpdateRequirement` | `Toast.tsx` |

**Inalcanzables:** `Modal` (genérico, `shared/components/ui/Modal/`) y `MobileMenu` (drawer de
navegación) — ver Observaciones.

---

## 1. Detalle de requisito

### Identidad

- **Tipo:** modal centrado (desktop) / pantalla completa con tabs (mobile)
- **Archivo:** `RequirementDetailModal.tsx`
- **Disparado desde:** click en fila de `ListView` o card de `KanbanBoard` ·
  `requirements/page.tsx:137-139`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** ver y comentar un requisito sin salir del tablero.
- **Viewports:** mobile y desktop, **con árboles distintos** — la rama la decide
  `useIsMobile()` (`:21`, `:63`)

Es la versión overlay de [detalle-requisito](./detalle-requisito.md), con la que comparte los tres
paneles internos.

### Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | overlay-fondo | `modal` | oscuro / opaco | ambos *(distinto)* | `<div className={styles.overlay}>` o `.overlayMobile` | `:96` / `:65` |
| 2 | topbar-modal | `header` | — | ambos | `<ModalTopbar>` | `:98-106` / `:67-75` |
| 3 | boton-abrir | `button` | secondary | ambos | `<button>` con `ArrowUpRight` | `ModalTopbar.tsx:76-85` |
| 4 | boton-enlace | `button` | secondary · con feedback | ambos | `<button>` con `Link`/`Check` | `ModalTopbar.tsx:87-96` |
| 5 | boton-suscripcion | `button` | suscrito/no/error | ambos *(solo `external-user`)* | `<button>` con `Bell`/`BellOff` | `ModalTopbar.tsx:98-120` |
| 6 | boton-cerrar | `button` | secondary | ambos | `<button>` con `X` | `ModalTopbar.tsx:122-131` |
| 7 | tabs-detalle-actividad | `tabs` | detalle / actividad | **solo mobile** | `<div role="tablist">` | `:78-99` |
| 8 | panel-informacion | `section` | — | ambos | `<RequirementInfoPanel>` | `:104` / `:111` |
| 9 | titulo-actividad | `heading` | h3 | **solo desktop** | `<span className={styles.rightPanelTitle}>` | `:117` |
| 10 | feed-actividad | `list` | — | ambos | `<ActivityPanel>` | `:108` / `:120` |
| 11 | editor-comentario | `text-input` | multilínea con adjuntos | ambos | `<CommentInput>` | `:111` / `:123` |

El contenido de los bloques 8-11 está relevado en [detalle-requisito](./detalle-requisito.md): son
los mismos componentes.

### Layout observado por viewport

#### desktop · 1200px

- overlay-fondo (`position: fixed; inset: 0`, fondo `rgba(0,0,0,0.45)`, `padding: 40px`)
  - contenedor del modal (hasta **1632px** de ancho, alto `100vh - 80px`)
    - topbar-modal
    - row `cuerpo`
      - col 7/12: panel-informacion *(flexible)*
      - col 5/12: panel de actividad *(558px fijos)*
        - titulo-actividad
        - feed-actividad *(scroll)*
        - editor-comentario *(anclado abajo)*

**Origen:** `RequirementDetailModal.module.scss:4-13` (overlay centrado con flex), `:16-27`
(`width: 1632px; max-width: 100%; height: calc(100vh - 80px)`), `:30-34` (`.body { display:flex }`),
`:37-52` (`.leftPanel { flex: 1 1 0 }`) y `:55-63` (`.rightPanel { width: 558px }`).

**Las fracciones son aproximadas:** el panel derecho es fijo en 558px. En un modal de 1632px eso
es ~4/12; en uno de 1200px (viewport chico), ~5.5/12.

#### mobile · 400px

- overlay-fondo (`position: fixed; inset: 0`, **fondo blanco opaco, sin oscurecer**)
  - contenedor (100% × 100%)
    - topbar-modal
    - tabs-detalle-actividad (dos tabs, 50% cada uno)
    - contenido del tab activo:
      - "Detalle" → panel-informacion
      - "Actividad" → feed-actividad *(scroll)* + editor-comentario *(anclado abajo)*

**Origen:** `RequirementDetailModal.module.scss:130-145` (`.overlayMobile { background: #fff }`,
`.containerMobile { width:100%; height:100% }`) y `:148-153` (`.tabs { display:flex }` con
`.tab { flex: 1 }`).

**No es el mismo layout apilado: es otra estructura.** En desktop los dos paneles conviven; en
mobile son excluyentes. El tab por defecto es "detalle" (`:22`).

### Contenido

Los textos del topbar, verbatim:

| Bloque | Texto | Origen |
|---|---|---|
| breadcrumb | `{proyecto}` › `#{id}` | `ModalTopbar.tsx:72-74` |
| boton-abrir | "Abrir" | `ModalTopbar.tsx:84` |
| boton-enlace | "Enlace" / "Copiado" | `ModalTopbar.tsx:95` |
| boton-suscripcion | "Suscribirse" / "Desuscribirse" / "..." / "Error" | `ModalTopbar.tsx:118` |
| boton-cerrar | "Cerrar" | `ModalTopbar.tsx:130` |
| tab 1 | "Detalle" | `:86` |
| tab 2 | "Actividad" | `:96` |
| titulo del panel derecho | "Actividad" | `:117` |

**El topbar tiene un botón más que el de la página:** "Abrir", que navega a la ruta de detalle y
cierra el overlay (`ModalTopbar.tsx:57-60`).

### Estados presentes

| Estado | Mensaje | Origen |
|---|---|---|
| loading | *(solo spinner, sin texto)* | `:35-52` |
| error de sistema | "Error al cargar el requisito. Intentá de nuevo más tarde." | `:53` |
| default (desktop) | dos paneles | `:122-156` |
| default (mobile) | tabs | `:63-119` |

El error usa `role="alert"` (`:53`).

### Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| reintentar tras error | **No hay botón.** La página equivalente sí ofrece "Reintentar" y "Volver al listado"; acá solo queda cerrar clickeando el overlay | `:48-60` |
| not found | No se distingue del error: `isError \|\| !requirement` caen en el mismo mensaje | `:49` |
| cierre en el estado de error (mobile) | El layout de error usa `styles.overlay` (el de desktop) **incluso en mobile**, y en mobile el overlay no tiene `onClick` de cierre en el contenedor de error... salvo que sí lo tiene: `handleOverlayClick` está en `:37` y `:50` | `:37`, `:50` |
| permiso denegado | No se distingue del error genérico | `:48` |

### Interacciones

- overlay-fondo · click fuera del contenedor → cierra · `:30-32`, `:96`
- **En mobile el overlay NO cierra al hacer click fuera**: `overlayMobile` no tiene `onClick`
  (`:65`). Es correcto — ocupa toda la pantalla, no hay "afuera"
- boton-abrir · click → `router.push` a la ruta de detalle y `onClose()` · `ModalTopbar.tsx:57-60`
- boton-cerrar · click → `onClose()` · `ModalTopbar.tsx:125`
- tabs · click → cambia `activeTab` · `:88`, `:98`

### Estados ausentes de interacción

| Aspecto | Qué pasa hoy | Evidencia |
|---|---|---|
| Cerrar con `Escape` | **No implementado.** A diferencia de `Modal` y `CreateRequirementModal`, este overlay no registra ningún handler de teclado | `RequirementDetailModal.tsx` — sin `useEffect` de `keydown` |
| Bloqueo del scroll de fondo | **No implementado.** No setea `document.body.style.overflow` | ídem |
| Focus trap | **No implementado** | ídem |

**Es el overlay con peor manejo de teclado de los tres modales**, y el más usado.

### Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| `role="dialog"` / `aria-modal` | **ausente** — el overlay es un `<div>` sin roles de diálogo | `:37`, `:65`, `:96` |
| Tabs semánticos | **presente** — `role="tablist"`, `role="tab"`, `aria-selected` | `:79-98` |
| Paneles de tab | **ausente** — sin `role="tabpanel"` ni `aria-labelledby` | `:101-118` |
| Botones con label | **presente** — `aria-label` en los cuatro del topbar | `ModalTopbar.tsx:80`, `:91`, `:104`, `:126` |
| Error anunciado | **presente** — `role="alert"` | `:53` |
| Cierre por teclado | **ausente** | — |
| Foco al abrir / al cerrar | **ausente** | — |

---

## 2. Nuevo requisito

### Identidad

- **Tipo:** modal centrado, renderizado en portal a `document.body`
- **Archivo:** `CreateRequirementModal.tsx`
- **Disparado desde:** botón "Nuevo requisito" del `Sidebar` · `(dashboard)/layout.tsx:13`
- **Propósito observado:** crear un requisito con título, descripción con adjuntos, proyecto,
  prioridad, tipo y suscriptores.
- **Viewports:** ambos — un `@include mobile` que ajusta el ancho

> **Solo alcanzable en desktop.** El único disparador vivo está en el `Sidebar`, que en mobile es
> `display: none`. Hay una segunda instancia montada en el tablero
> (`requirements/page.tsx:192-195`) que ningún control abre.

### Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | overlay-fondo | `modal` | — | ambos | `<div className={styles.overlay}>` | `:272` |
| 2 | encabezado | `header` | — | ambos | `<div className={styles.header}>` | `:294-311` |
| 3 | chip-estado | `badge` | fijo, no editable | ambos | `<button className={styles.statusChip} tabIndex={-1}>` | `:314-318` |
| 4 | campo-titulo | `text-input` | default / error | ambos | `<input type="text">` | `:323-335` |
| 5 | editor-descripcion | `text-input` | multilínea con adjuntos | ambos | `<RichTextEditor>` | `:338-345` |
| 6 | boton-adjuntar | `button` | secondary | ambos | `<button className={styles.descAttachBtn}>` | `:357-365` |
| 7 | tabla-campos | `table` | — | ambos | `<table role="presentation">` | `:381-506` |
| 8 | selector-proyecto | `dropdown` | — | ambos | `<button data-testid="dropdown-project">` | `:390-414` |
| 9 | selector-prioridad | `dropdown` | 5 opciones | ambos | `<button data-testid="dropdown-priority">` | `:426-460` |
| 10 | selector-tipo | `dropdown` | 4 opciones | ambos | `<button data-testid="dropdown-type">` | `:472-501` |
| 11 | pills-suscriptores | `badge` | removibles | ambos | `<span className={styles.pill}>` | `:523-544` |
| 12 | selector-suscriptores | `dropdown` | — | ambos | `<UserSelector>` | `:552-557` |
| 13 | boton-crear | `button` | primary · loading | ambos | `<button className={styles.createButton}>` | `:567-574` |
| 14 | estado-exito | `section` | — | ambos | `<div className={styles.successState}>` | `:274-290` |

### Layout observado por viewport

#### desktop · 1200px

- overlay-fondo (fijo, centrado)
  - contenedor del modal
    - encabezado ("Nuevo requisito" + X)
    - chip-estado ("Análisis")
    - campo-titulo (ancho completo)
    - editor-descripcion + boton-adjuntar (ancho completo)
    - separador
    - sección "Campos"
      - tabla de 2 columnas: etiqueta | control
        - "Proyecto" | selector-proyecto
        - "Prioridad" | selector-prioridad
        - "Tipo" | selector-tipo
    - sección "Suscriptores"
      - tabla de 2 columnas: pills | selector-suscriptores
    - boton-crear (a la derecha)

**Origen:** `CreateRequirementModal.module.scss:50` (`@include mobile` sobre el ancho del modal) y
la estructura de `<table>` en `:381-506`, `:512-562`.

**Las filas de campos son una `<table>` real** con `role="presentation"` (`:381`) — dos celdas por
fila, etiqueta y control. No es una grilla de 12 columnas.

#### mobile · 400px

Misma composición vertical; solo cambia el ancho del contenedor.

**Origen:** `CreateRequirementModal.module.scss:50` — el único `@include mobile` del archivo.

### Contenido

| Bloque | Texto verbatim | Origen |
|---|---|---|
| encabezado | "Nuevo requisito" | `:295` |
| chip-estado | "Análisis" | `:317` |
| campo-titulo | placeholder "Título del requisito" | `:327` |
| editor-descripcion | placeholder "Agregar descripción..." | `:342` |
| boton-adjuntar | "Adjuntar" | `:364` |
| sección campos | "Campos" | `:380` |
| etiquetas | "Proyecto", "Prioridad", "Tipo" | `:386`, `:422`, `:468` |
| sin proyecto | "Sin proyecto" | `:398` |
| sin tipo | "Sin tipo" | `:484` |
| sección suscriptores | "Suscriptores" | `:511` |
| sin suscriptores | "Sin suscriptores" | `:517` |
| boton-crear | "Crear elemento" · en curso: "Creando..." | `:573` |
| éxito, título | "Elemento creado" | `:288` |
| éxito, subtítulo | "El elemento fue agregado a análisis correctamente." | `:289` |

**Opciones de prioridad** (`CreateRequirementModal.types.ts:24-30`): "Sin prioridad", "Baja",
"Media", "Alta", "Urgente".

**Opciones de tipo, con descripción** (`:32-61`) — es la definición funcional más explícita del
dominio en todo el código:

| Opción | Descripción verbatim |
|---|---|
| Funcionalidad | "nueva función del sistema" |
| Mejora | "optimización de algo existente" |
| Incidencia | "bug, error o comportamiento inesperado" |
| Otro | "tarea operativa, documentación, gestión, etc." |

> **El copy dice "elemento", no "requisito".** El botón es "Crear elemento" y el éxito "Elemento
> creado", mientras el encabezado dice "Nuevo requisito" y el placeholder "Título del requisito".
> Dos vocabularios en el mismo formulario.

### Estados presentes

| Estado | Mensaje | Origen |
|---|---|---|
| default | el formulario | `:292-576` |
| loading (envío) | botón "Creando...", deshabilitado | `:571-573` |
| success | "Elemento creado" + "El elemento fue agregado a análisis correctamente." con ícono verde | `:274-290` |
| error de validación (título) | **sin mensaje** — solo borde rojo y foco | `:217-221`, `:326` |
| error de validación (adjunto) | "El archivo supera el límite de 10MB" · "Tipo de archivo no permitido" · "Error al subir el archivo" | `:124`, `:129`, `:155` |
| loading (adjunto) | skeleton en el editor | `:343-344` |

El estado de éxito **reemplaza el formulario entero** y cierra solo a los **1.8 s** (`:236-238`).

### Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error de creación** | **No se muestra nada.** `useCreateRequirement` no tiene `onError` y el modal solo mira `isPending`: el botón vuelve de "Creando..." a "Crear elemento" sin explicación, con el formulario intacto | `:571-573` + `useCreateRequirement.ts:9-20` |
| mensaje del título obligatorio | Solo el borde rojo. Sin texto, sin `aria-invalid`, sin `aria-describedby` | `:326` |
| loading de la lista de proyectos | Si `useProjects` está cargando, el selector muestra "Sin proyecto" | `:398` |
| error de la lista de proyectos | Ídem: indistinguible de no tener proyectos | `:398` |
| confirmación al cerrar con datos | Cerrar con `Escape`, la X o el click afuera **descarta el formulario sin preguntar** | `:162-165`, `:194`, `:213` |

**El primero es el más grave de la pantalla:** el usuario puede completar el formulario, subir
adjuntos, apretar "Crear elemento" y quedarse sin saber que falló.

### Interacciones

- overlay · click fuera → `handleClose()` (resetea y cierra) · `:212-214`
- `Escape` → `handleClose()` · `:192-198`, `:200-208`
- X → `handleClose()` · `:299`
- boton-crear · click → valida el título; si falla, foco al input; si pasa, `mutate` · `:216-242`
- selectores · click → abre el panel calculando coordenadas · `:244-260`
- click afuera o scroll → cierra el panel abierto · `:168-189`
- pill de suscriptor · click en la X → lo quita de la selección · `:525-534`
- adjuntar · change → valida y sube; inserta el placeholder en la descripción · `:117-160`

**Al abrir se bloquea el scroll del fondo** (`document.body.style.overflow = 'hidden'`, `:203`) y
se restaura al cerrar (`:206`).

**El título tiene `autoFocus`** (`:334`).

### Validaciones

| Campo | Regla real | Mensaje |
|---|---|---|
| Título | `title.trim()` no vacío | **ninguno** — borde rojo y foco |
| Adjunto | ≤ 10 MB | "El archivo supera el límite de 10MB" |
| Adjunto | extensión en las 12 permitidas | "Tipo de archivo no permitido" |
| Proyecto, prioridad, tipo, suscriptores | **sin validación** — tienen default | — |

El tipo por defecto es `'Otro'` si no se elige: `(selectedType ?? 'Otro').toLowerCase()` (`:227`).

### Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| `role="dialog"` / `aria-modal` | **presente** | `:272` |
| Label del título | **presente** — `aria-label="Título del requisito"` | `:333` |
| `autoFocus` al abrir | **presente** | `:334` |
| Cerrar con `Escape` | **presente** | `:192-208` |
| Bloqueo del scroll de fondo | **presente** | `:203` |
| Focus trap | **ausente** — el tab sale del modal | — |
| Devolución del foco al cerrar | **ausente** | — |
| Error de título anunciado | **ausente** — sin `aria-invalid` ni mensaje | `:326` |
| Error de adjunto anunciado | **presente** — `role="alert"` | `:369` |
| Opciones de los dropdowns | **ausente** — `<div onClick>` sin `role="option"`, `tabIndex` ni teclado | `:584`, `:602`, `:631` |
| Botones con label | **presente** — `aria-label` en cerrar, adjuntar y quitar suscriptor | `:300`, `:355`, `:361`, `:533` |
| Tabla de campos | `role="presentation"` — correcto: es maquetación, no datos | `:381`, `:512` |
| chip-estado | es un `<button>` con `tabIndex={-1}` que no hace nada: se anuncia como botón sin acción | `:315` |

---

## 3. Dropdowns de estado y prioridad

- **Tipo:** menú en portal a `document.body`
- **Archivo:** `shared/components/ui/Dropdown/Dropdown.tsx`
- **Disparado desde:** pill de estado o prioridad en `ListRequirementRow` y `KanbanCard`
- **Visible solo para roles internos** (`user` / `admin`)

### Comportamiento

- Calcula la posición con `getBoundingClientRect()` del trigger y la fija en el portal
  (`:40-48`).
- **Se reposiciona en scroll con captura** (`:65`) — necesario porque el trigger vive dentro de un
  contenedor scrolleable.
- Cierra con click afuera (`:53-58`) y con `Escape` (`:83-85`).
- `align: 'right'` para el de prioridad, que está en la última columna
  (`ListRequirementRow.tsx:258`).

### Contenido

Las opciones salen de `requirement.constants.ts`: los siete estados con su punto de color y las
cinco prioridades con su bandera.

### Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| `aria-expanded` / `aria-haspopup` | **presente** | `Dropdown.tsx:118-119` |
| `role="listbox"` / `role="option"` | **presente** | `:92`, `:100` |
| `aria-selected` | **incorrecto** — fijo en `"false"` para todas las opciones, incluida la actual | `:100` |
| Navegación con flechas | **ausente** — solo `Escape`; no hay manejo de ↑/↓ | `:83-85` |
| Foco al abrir | **ausente** — el menú no recibe foco | — |

---

## 4. Dropdowns del formulario

- **Tipo:** panel posicionado a mano, dentro del overlay del modal
- **Archivo:** `CreateRequirementModal.tsx:581-645`
- **Tres instancias:** proyecto, prioridad, tipo

**Reimplementan lo que hace `Dropdown`** sin usarlo: coordenadas propias (`:244-260`), cierre por
click afuera y por scroll (`:168-189`), y render dentro del overlay —no en `document.body`— con el
comentario *"rendered inside overlay portal to escape modal overflow"* (`:580`).

### Contenido

- Proyecto: la lista de `useProjects`, con la actual marcada con `styles.selected` (`:586`)
- Prioridad: las 5 opciones con su bandera de color (`:601-624`)
- Tipo: las 4 opciones con su descripción entre paréntesis (`:630-643`)

### Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Roles ARIA | **ausentes** — `<div onClick>` sin `role="listbox"`/`"option"` | `:582-596`, `:600-625`, `:629-644` |
| `aria-expanded` en el trigger | **ausente** | `:390-414`, `:426-460`, `:472-501` |
| Navegación por teclado | **ausente** — no se puede abrir ni elegir con teclado | — |

Es la parte menos accesible del formulario: **tres de los cinco campos son inoperables sin
mouse.**

---

## 5. Selector de suscriptores

- **Tipo:** panel posicionado a mano
- **Archivo:** `UserSelector.tsx:65-83`
- **Disparado desde:** la fila "Suscriptores" del modal de creación

### Contenido

| Estado | Texto verbatim | Origen |
|---|---|---|
| trigger | "Seleccionar suscriptor" | `:48` |
| loading | "Cargando..." | `:67` |
| empty | "Sin usuarios disponibles" | `:69` |
| opciones | dinámico — `user.name` | `:79` |

Filtra los ya seleccionados (`:38`). Al elegir uno, lo agrega y cierra (`:25-28`).

### Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| error | **No se maneja.** Si `useProjectUsers` falla, muestra "Sin usuarios disponibles" — igual que si la lista estuviera vacía | `:68-70` — no lee `isError` |
| cierre por click afuera | **No implementado.** A diferencia de los otros paneles, este solo se cierra eligiendo una opción o volviendo a clickear el trigger | `:30-36` |
| cierre con `Escape` | **No implementado** | — |

### Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| `role="option"` / `aria-selected` | **presente** en las opciones | `:74-75` |
| `role="listbox"` en el contenedor | **ausente** | `:66` |
| `aria-expanded` en el trigger | **ausente** | `:42-47` |
| Navegación por teclado | **ausente** — las opciones son `<div onClick>` | `:72-80` |

---

## 6. Toast

- **Tipo:** notificación efímera, en portal a `document.body`
- **Archivo:** `shared/components/ui/Toast/Toast.tsx`
- **Disparado desde:** `showToast()` — hoy **solo** desde `useUpdateRequirement`

### Contenido

Los tres únicos mensajes de toast de la aplicación:

| Mensaje | Tipo | Cuándo |
|---|---|---|
| "Requisito actualizado correctamente" | success | cambio de estado o prioridad exitoso |
| "Error al actualizar el estado" | error | falla el cambio de estado |
| "Error al actualizar la prioridad" | error | falla el cambio de prioridad |

Origen: `useUpdateRequirement.ts:19`, `:28`, `:30`.

### Comportamiento

- Pub/sub de módulo: `showToast` notifica a los listeners registrados (`Toast.tsx:13-19`).
- Se descarta solo a los **4 segundos** (`:27-29`).
- Ícono de check (success) o de exclamación (error), dibujados inline (`:43-64`).
- **No se puede cerrar a mano** y **no hay límite de apilamiento**.

### Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| `role="alert"` | **presente** en cada toast | `:42` |
| Iconos decorativos | **presente** — `aria-hidden="true"` | `:44`, `:55` |
| Cierre manual | **ausente** — 4 s fijos, sin botón | `:27-29` |
| Pausa al hacer hover | **ausente** | — |

---

## Overlays inalcanzables

Existen en el código, tienen tests y **ningún camino de la UI los abre**.

### `Modal` — `shared/components/ui/Modal/`

Modal genérico completo: `role="dialog"`, `aria-modal`, `aria-labelledby`, cierre con `Escape`
(`:16-23`) y por click en el overlay (`:25-32`), bloqueo del scroll de fondo (`:37`), portal a
`document.body` (`:98`), y slot de `footer` opcional.

**Es el más accesible de los tres modales del código, y es el único que no se usa.** Los dos
modales vivos (`RequirementDetailModal`, `CreateRequirementModal`) reimplementan el overlay por su
cuenta, y el de detalle sin `Escape`, sin bloqueo de scroll y sin roles de diálogo.

Sus cinco `@include mobile` (`Modal.module.scss`) son código responsive que nunca se renderiza.

### `MobileMenu` — `shared/components/layout/MobileMenu/`

Drawer de navegación para mobile: `role="dialog"`, `aria-modal`, `aria-label="Menú de
navegación"`, cierre con `Escape` (`:38-54`), bloqueo del scroll (`:47`), **foco al botón de
cerrar al abrir** (`:32-36`) — el único componente del servicio que maneja el foco.

Contiene dropdown de proyectos, link "Suscriptores", botón "Nueva tarea" y botón "Cerrar sesión".

**Solo lo importa `Header`, que tampoco se usa.** Es la pieza que resolvería la ausencia de
navegación mobile, desconectada del árbol.

Su botón "Nueva tarea" (`:149-151`) **no tiene `onClick`**: aunque el drawer se montara, ese botón
no haría nada.

---

## Observaciones del relevamiento

- **Tres implementaciones de overlay conviven**, con niveles de calidad inversos a su uso: `Modal`
  (el más completo) no se usa; `CreateRequirementModal` (bueno: `Escape`, scroll, roles) se usa
  poco; `RequirementDetailModal` (sin `Escape`, sin bloqueo de scroll, sin roles de diálogo) es el
  más usado.

- **Tres implementaciones de dropdown**: el componente `Dropdown` con portal, los tres paneles
  inline de `CreateRequirementModal` y el de `UserSelector`. Las dos últimas reimplementan
  posicionamiento y cierre, con menos accesibilidad.

- **El vocabulario cambia dentro del mismo formulario**: encabezado "Nuevo requisito", botón "Crear
  elemento", éxito "Elemento creado". Y el código muerto agrega "Nueva tarea".

- **El overlay de detalle y la página de detalle divergen en mobile**: tabs contra scroll continuo.
  El usuario llega a uno u otro según desde dónde abra el requisito, y ve dos experiencias
  distintas del mismo contenido.

- **El éxito de creación dura 1.8 s y cierra solo** (`:236-238`). No hay forma de quedarse en la
  confirmación ni de ir al requisito recién creado.

- No se pudo determinar por qué `CreateRequirementModal` no usa el componente `Modal`: el
  comentario de `:580` explica el portal de los dropdowns, no la decisión del overlay.

- No se pudo determinar si el chip "Análisis" no editable es una regla de negocio o una
  simplificación de la UI. `tabIndex={-1}` sugiere que es deliberadamente inerte.
