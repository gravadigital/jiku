---
document: UX Survey Screen
screen: _overlays
route: "ninguna — overlays disparados desde pantallas"
service: web
source_files:
  - src/features/attachments/components/PreviewModal/PreviewModal.tsx
  - src/shared/components/ui/ConfirmDialog/ConfirmDialog.tsx
  - src/features/objectives/components/StateTag/StateTag.tsx
  - src/features/requirements/components/RequirementHeader/RequirementHeader.tsx
  - src/features/worked-times/components/ProjectTypeFilterDropdown/ProjectTypeFilterDropdown.tsx
  - src/shared/components/ui/Tooltip/Tooltip.tsx
  - src/features/clients/components/ClientsDrawer/ClientsDrawer.tsx
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: _overlays

> **Relevamiento as-is** de los overlays del producto, extraído de sus componentes.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> **Ninguno es una ruta.** Se relevan juntos porque varios se disparan desde más de una pantalla y
> comparten (o deberían compartir) comportamiento. Cada survey de pantalla los referencia.

## Identidad

- **Ruta:** ninguna
- **Requiere auth:** heredado de la pantalla que los dispara
- **Audiencia:** no determinable desde el código
- **Propósito observado:** confirmar acciones destructivas, previsualizar adjuntos, y editar o
  filtrar valores in-place sin navegar.
- **Viewports con tratamiento:** ninguno tiene media queries propios.

## Inventario

| Overlay | Tipo | Disparado desde | Archivo |
|---|---|---|---|
| Vista previa de adjunto | `modal` | detalle-proyecto | `PreviewModal.tsx` |
| Confirmación de borrado | `modal` | carga-horas (×2), detalle-proyecto | `ConfirmDialog.tsx` |
| Dropdown de estado de tarea | `dropdown` | listado-tareas, tareas-por-proyecto, tareas-por-responsable | `StateTag.tsx` |
| Pills de estado / tipo / prioridad | `dropdown` | detalle-requisito | `RequirementHeader.tsx` |
| Dropdown de tipo de proyecto | `dropdown` | reporte-horas | `ProjectTypeFilterDropdown.tsx` |
| Menú de `react-select` | `dropdown` | 6 pantallas con selects de búsqueda | `react-select` |
| Tooltip | `tooltip` | transversal, 10 usos | `Tooltip.tsx` |
| Date-picker de fecha de cierre | `dropdown` (portal) | tareas-por-proyecto, tareas-por-responsable | `FinishDateLabel.tsx` |
| Cajón de actores | `modal` lateral | **ninguno — código muerto** | `ClientsDrawer.tsx` |

---

## Date-picker de fecha de cierre (`FinishDateLabel`)

Editar la fecha de cierre estimada de una tarea **desde la card**, sin entrar al detalle. Se monta por
`ReactDOM.createPortal` en un contenedor que `ObjectivesGroup` provee.

### Estructura

| # | Nombre | Tipo | Variant | Componente real | Origen |
|---|--------|------|---------|-----------------|--------|
| 1 | etiqueta-fecha-cierre | `badge` | por `data-state` de vencimiento | `<div onClick={handleDivClick}>` | `FinishDateLabel.tsx:162-167` |
| 2 | date-picker | `date-picker` | open | `<DatePicker inline>` en un portal | `FinishDateLabel.tsx:175-191` |

### Contenido

- Texto de la etiqueta: `getStatusMessage()` y `getDaysLeft()` · `:168`, `:171`
- Icono: `getCalendarIcon()` con `alt="calendar icon"` · `:170`
- El `Tooltip` que envuelve la etiqueta se **desactiva mientras el picker está abierto**
  (`disableTooltip={isDatePickerOpen}`, `:160`)

### Estados presentes

| Estado | Disparado por | Origen |
|---|---|---|
| cerrado | `isDatePickerOpen === false` | `FinishDateLabel.tsx:173` |
| abierto | click en la etiqueta | `:166` |

El posicionamiento se calcula con el `getBoundingClientRect()` del contenedor del portal y se aplica
como `position: absolute` con `top`/`left` inline (`:137`, `:177-181`).

### Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| loading al guardar | no relevado | `:~150` |
| **apertura por teclado** | **ausente.** El disparador es un `<div onClick>` **sin `role`, sin `tabIndex`, sin handler de teclado**: el picker es inalcanzable sin mouse | `:162-167` |
| reposicionamiento al scrollear | la posición se calcula al abrir; **no relevado** si se recalcula | `:137` |
| sin contenedor de portal | `portalContainer !== null` es condición para renderizar: en un contexto sin ese `<div>` el picker **no se abre y no hay aviso** | `:173` |

### Accesibilidad

| Aspecto | Estado | Evidencia |
|---|---|---|
| Disparador enfocable | **no.** `<div onClick>` sin `role="button"` ni `tabIndex` | `:162-167` |
| Cierre por click afuera | Presente vía `onClickOutside` de `react-datepicker` | `:186` |
| `Escape` | Lo aporta `react-datepicker` | comportamiento de la librería |
| Alt del icono | `alt="calendar icon"` — describe el icono, no su función | `:170` |
| Anuncio del cambio de fecha | **ausente** | `:185` |

> **Este overlay permite una escritura que no está documentada en ninguna otra pantalla:** cambiar la
> fecha de cierre estimada de una tarea desde la vista agregada. Y es inalcanzable por teclado.

---

## Vista previa de adjunto (`PreviewModal`)

### Estructura

| # | Nombre | Tipo | Variant/Level/State | Componente real | Origen |
|---|--------|------|---------------------|-----------------|--------|
| 1 | overlay-preview | `modal` | — | `<div role="dialog" aria-modal="true">` | `PreviewModal.tsx:76-83` |
| 2 | encabezado-preview | `header` | — | `<div className={styles.header}>` | `PreviewModal.tsx:85` |
| 3 | nombre-archivo | `paragraph` | body | `<span className={styles.fileName}>` | `PreviewModal.tsx:86` |
| 4 | boton-cerrar-preview | `button` | — | `<button>` con SVG de cruz | `PreviewModal.tsx:87-96` |
| 5 | contenido-preview | `section` | image / pdf / unsupported | `<div className={styles.content}>` | `PreviewModal.tsx:99` |
| 6 | imagen-preview | `image` | — | `<img src={blobUrl}>` | `PreviewModal.tsx:113` |
| 7 | pdf-preview | `section` | — | `<iframe>` | `PreviewModal.tsx:115-120` |
| 8 | pie-preview | `footer` | — | `<div className={styles.footer}>` con botón `"Cerrar"` | `PreviewModal.tsx:129-132` |

### Layout observado

Sin tratamiento responsive. Overlay a pantalla completa con la modal centrada; encabezado, contenido
y pie en columna. **Las fracciones no son derivables:** es un overlay posicionado, no una grilla.

### Contenido

- nombre-archivo: dinámico desde `attachment.fileName`
- boton-cerrar-preview: sin texto, `aria-label="Cerrar vista previa"` · `PreviewModal.tsx:91`
- Cargando imagen: `"Cargando vista previa..."` · `:101`
- Sin permiso: texto en `:104-107` (el mensaje se compone en esas líneas)
- Error: `"Error al cargar la vista previa"` · `:109`
- Tipo no soportado: mensaje en `:123-126`
- Botón del pie: `"Cerrar"` · `:130`

### Estados presentes

| Estado | Mensaje | Disparado por | Origen |
|---|---|---|---|
| loading | `"Cargando vista previa..."` | `fetchStatus === 'loading'` y tipo imagen | `PreviewModal.tsx:100-102` |
| forbidden | mensaje de sin permiso | `fetchStatus === 'forbidden'` (403 del BFF) | `:103-107` |
| error | `"Error al cargar la vista previa"` | `.catch()` del fetch del blob | `:108-110` |
| ready (imagen) | la imagen | `fetchStatus === 'ready'` y `blobUrl` | `:111-114` |
| pdf | `<iframe>` directo al BFF | `previewType === 'pdf'` | `:115-120` |
| unsupported | mensaje de tipo no soportado | `getPreviewType()` devuelve `'unsupported'` | `:122-126` |

**Nota:** el PDF **no pasa por el estado de carga**: `fetchStatus` se setea en `'ready'`
inmediatamente para todo lo que no sea imagen (`:29-31`), y el `<iframe>` carga por su cuenta sin
indicador.

### Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| loading del PDF | el `<iframe>` carga sin ningún indicador: el área queda en blanco | `PreviewModal.tsx:29-31`, `:115-120` |
| error del PDF | el `<iframe>` no tiene `onError`: un 403 o 500 muestra el error del navegador dentro del marco | `PreviewModal.tsx:115-120` |
| **focus trap** | **ausente.** Tabular desde la modal sale al contenido de atrás | `PreviewModal.tsx:76-134` |
| **devolución del foco al cerrar** | **ausente.** El foco no vuelve al botón `"Preview"` que la abrió | `PreviewModal.tsx:65-69` |
| foco inicial | **ausente.** Al abrir, el foco queda donde estaba | `PreviewModal.tsx:76` |

### Interacciones

- `Escape` → cierra · `PreviewModal.tsx:64-69`
- click en el overlay (no en la modal) → cierra · `:71-74`
- boton-cerrar-preview y botón `"Cerrar"` del pie → cierran · `:89`, `:130`
- Al abrir: `document.body.style.overflow = 'hidden'`, restaurado al desmontar · `:56-62`

### Accesibilidad

| Aspecto | Estado | Evidencia |
|---|---|---|
| Rol y modalidad | `role="dialog"` + `aria-modal="true"`. Correcto | `PreviewModal.tsx:80-81` |
| Nombre accesible | `aria-label={`Vista previa de ${attachment.fileName}`}`. Correcto | `:82` |
| Botón de cerrar | `aria-label="Cerrar vista previa"`, SVG con `aria-hidden="true"`. Correcto | `:91,93` |
| Alt de la imagen | `alt={attachment.fileName}`. Presente | `:113` |
| Título del iframe | `title={attachment.fileName}`. Presente | `:119` |
| Focus trap | **ausente** | `:76-134` |
| Foco al cerrar | **ausente** | `:65-69` |
| Scroll del fondo | Bloqueado correctamente | `:56-62` |

---

## Confirmación de borrado (`ConfirmDialog`)

Usa `<dialog>` **nativo** con `showModal()`, a diferencia de `PreviewModal`.

### Estructura

| # | Nombre | Tipo | Variant | Componente real | Origen |
|---|--------|------|---------|-----------------|--------|
| 1 | dialogo-confirmacion | `modal` | — | `<dialog>` con `showModal()` | `ConfirmDialog.tsx:51-56` |
| 2 | titulo-confirmacion | `heading` | h3 | `<h3 className={styles.title}>` | `:58` |
| 3 | mensaje-confirmacion | `paragraph` | body | `<p className={styles.message}>` | `:59` |
| 4 | boton-cancelar | `button` | secondary · small | `<Button variant="secondary" size="small">` | `:61-67` |
| 5 | boton-confirmar | `button` | primary · small | `<Button size="small">` | `:68-73` |

### Contenido

Todo por props. Defaults: `confirmLabel = "Confirmar"`, `cancelLabel = "Cancelar"`
(`ConfirmDialog.tsx:22-23`).

Instancias reales:

| Pantalla | title | confirmLabel | cancelLabel | Origen |
|---|---|---|---|---|
| detalle-proyecto (adjunto) | `"Eliminar archivo"` | `"Eliminar"` | `"Cancelar"` | `AttachmentItem.tsx:105-108` |
| carga-horas (registro) | `"Eliminar registro"` | `"Eliminar"` | `"Cancelar"` | `DayEntriesList.tsx:227-230` |
| carga-horas (ausencia) | `"Eliminar ausencia"` | `"Eliminar"` | `"Cancelar"` | `DayEntriesList.tsx:237-240` |

**El default `"Confirmar"` no se usa en ninguna instancia:** las tres pasan `"Eliminar"`.

### Estados presentes

| Estado | Disparado por | Origen |
|---|---|---|
| abierto | prop `open` → `dialog.showModal()` en un efecto | `ConfirmDialog.tsx:30-39` |
| cerrado | `open` false → `dialog.close()` | `:36-38` |
| acciones deshabilitadas | prop `actionsDisabled` (viene de `isPending` de la mutación) | `:66,72` |

### Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| loading dentro del diálogo | los botones se deshabilitan vía `actionsDisabled` pero **no muestran spinner**: no se pasa `loading` a `<Button>` | `ConfirmDialog.tsx:61-73` |
| error de la acción | el diálogo se cierra y el error se muestra como toast en la pantalla de atrás | `DayEntriesList.tsx:113`, `AttachmentItem.tsx:~` |

### Interacciones

- boton-confirmar → `onConfirm()` · `:65`
- boton-cancelar → `onCancel()` · `:63`
- click en el backdrop → `onCancel()` · `:41-48`
- `Escape` → lo maneja el `<dialog>` nativo, que dispara `close` → `onClose={onCancel}` · `:55`

### Accesibilidad

| Aspecto | Estado | Evidencia |
|---|---|---|
| Focus trap | **presente por el elemento nativo:** `showModal()` lo aporta el navegador | `ConfirmDialog.tsx:35` |
| `Escape` | **presente por el elemento nativo** | `:55` |
| Rol y modalidad | Implícitos en `<dialog>` con `showModal()` | `:51` |
| Nombre accesible del diálogo | **ausente:** el `<h3>` no está vinculado con `aria-labelledby` | `:51-58` |
| Jerarquía de encabezados | El título es `<h3>` sin `<h2>` previo en el diálogo. Menor | `:58` |
| Foco al cerrar | **lo devuelve el elemento nativo** al disparador | comportamiento de `<dialog>` |
| Polyfill en tests | `tests/setup.ts` implementa `showModal`/`close` porque jsdom no los trae | `tests/setup.ts:12-20` |

> **`ConfirmDialog` es el overlay mejor resuelto del producto**, y lo es por usar `<dialog>` nativo:
> el focus trap, el `Escape` y la devolución del foco los aporta el navegador. `PreviewModal`
> reimplementa el mismo problema a mano y le faltan las tres cosas.

---

## Dropdown de estado de tarea (`StateTag`)

Cambia el estado de una tarea in-place, desde la tabla o desde una card.

### Estructura

| # | Nombre | Tipo | Variant | Componente real | Origen |
|---|--------|------|---------|-----------------|--------|
| 1 | pill-estado | `badge` | por `data-state` | `<button className={styles.statusSelect}>` | `StateTag.tsx:82-89` |
| 2 | menu-estados | `dropdown` | open | `<div className={styles.dropdownContent}>` | `:91-100` |
| 3 | opcion-estado | `button` | por `data-state` | `<button>` × 5 | `:93-99` |

### Contenido

Opciones verbatim: `"Activo"` (`activo`) · `"Backlog"` (`backlog`) · `"En revisión"` (`en_revision`) ·
`"Cancelado"` (`cancelado`) · `"Finalizado"` (`finalizado`) · `StateTag.tsx:21-25`

El texto de la pill es el `label` de la opción seleccionada · `:88`

Toast de éxito: `` `Se cambió el estado de la tarea a ${newValue}` `` · `:59`
Toast de error: `"Hubo un error al cambiar el estado"` · `:62`

> **El toast de éxito interpola el valor crudo de la api**, no la etiqueta: dice
> `"Se cambió el estado de la tarea a en_revision"`, con guion bajo y sin tilde.

### Estados presentes

| Estado | Disparado por | Origen |
|---|---|---|
| cerrado (default) | `isDropdownOpen === false` | `StateTag.tsx:91` |
| abierto | click en la pill | `:74-78` |
| success | `onSuccess` de la mutación → toast | `:59` |
| error | `onError` → toast, y **el valor vuelve al anterior** | `:60-63` |

### Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| loading durante el cambio | **ausente:** no hay spinner ni deshabilitado. La pill se puede clickear de nuevo mientras la mutación está en vuelo | `StateTag.tsx:82-89` |
| cierre por click afuera | **ausente:** no hay listener de `mousedown` en `document`. El menú queda abierto hasta que se elige una opción o se vuelve a clickear la pill. Comparar con `RequirementHeader` y `ProjectTypeFilterDropdown`, que sí lo tienen | `StateTag.tsx:71-79` |
| cierre con `Escape` | **ausente** | `StateTag.tsx:71-79` |
| estado terminal | una tarea `finalizado` o `cancelado` ofrece las mismas 5 opciones, incluida volver a `activo` | `:21-25` |

### Accesibilidad

| Aspecto | Estado | Evidencia |
|---|---|---|
| `aria-expanded` | **ausente** en la pill | `StateTag.tsx:83-87` |
| `aria-haspopup` | **ausente** | `:83-87` |
| `role="listbox"` / `role="option"` | **ausentes:** el menú es un `<div>` con `<button>`s | `:91-99` |
| Navegación por flechas | **ausente** | `:91-99` |
| Nombre accesible | La pill tiene el label del estado como texto. Correcto | `:88` |
| Cierre con teclado | **ausente** | `:71-79` |

> **`RequirementHeader.PillDropdown` resuelve el mismo problema mejor:** tiene `aria-haspopup`,
> `aria-expanded`, `role="listbox"`, `role="option"`, `aria-selected` y cierre por click afuera.
> Dos dropdowns del mismo tipo con distinta calidad.

---

## Pills de estado / tipo / prioridad (`RequirementHeader.PillDropdown`)

Componente genérico interno de `RequirementHeader`, usado tres veces.

### Estructura

| # | Nombre | Tipo | Variant | Componente real | Origen |
|---|--------|------|---------|-----------------|--------|
| 1 | pill-disparador | `badge` | por `dataAttr` | `<button aria-haspopup="listbox">` | `RequirementHeader.tsx:99-111` |
| 2 | menu-opciones | `dropdown` | open | `<div role="listbox">` | `:113-145` |
| 3 | opcion | `button` | selected / disabled | `<button role="option" aria-selected>` | `:117-135` |
| 4 | tooltip-opcion-deshabilitada | `tooltip` | — | `<Tooltip message={disabledTooltip}>` | `:136-138` |

### Contenido

Tres instancias, con `dataAttr` distinto para el color:

| Instancia | Opciones | Origen |
|---|---|---|
| Estado | `"Análisis"` · `"Planificación"` · `"En cola"` · `"Desarrollo"` · `"Revisión"` · `"Resuelto"` · `"Cancelado"` | `RequirementHeader.tsx:23-30` |
| Tipo | `"Sin tipo"` · `"Funcionalidad"` · `"Mejora"` · `"Incidencia"` · `"Otro"` | `:43-47` |
| Prioridad | `"Sin prioridad"` · `"Baja"` · `"Media"` · `"Alta"` · `"Urgente"` | `:51-55` |

### Estados presentes

| Estado | Disparado por | Origen |
|---|---|---|
| cerrado | `open === false` | `RequirementHeader.tsx:113` |
| abierto | click en la pill | `:102` |
| opción deshabilitada | `isDisabled` por opción, con tooltip explicativo | `:122`, `:136-138` |
| pill deshabilitada | `disabled={!canEdit \|\| isPending}` | `:180,191,201` |

**Regla de negocio visible:** para requisitos de tipo `incidencia`, `"En cola"` se saca de las
opciones salvo que el requisito ya esté en ese estado (`:161-166`).

### Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| loading | la pill se deshabilita vía `isPending` pero no muestra spinner. El update es optimista, así que el valor cambia de inmediato | `RequirementHeader.tsx:180`, `useUpdateRequirement.ts:36-43` |
| cierre con `Escape` | **ausente:** hay click afuera pero no `keydown` | `RequirementHeader.tsx:88-93` |
| navegación por flechas | **ausente** aunque el `role="listbox"` lo hace esperable | `:113-145` |

### Accesibilidad

| Aspecto | Estado | Evidencia |
|---|---|---|
| `aria-haspopup="listbox"` | Presente | `RequirementHeader.tsx:104` |
| `aria-expanded` | Presente | `:105` |
| `role="listbox"` / `role="option"` | Presentes | `:113`, `:120` |
| `aria-selected` | Presente | `:121` |
| `aria-disabled` | Presente en las opciones deshabilitadas | `:122` |
| Motivo del deshabilitado | Comunicado por `Tooltip`, que es visual: **no hay equivalente accesible** | `:136-138` |
| Cierre por click afuera | Presente (`mousedown` en `document`) | `:88-93` |
| `Escape` | **ausente** | `:88-93` |
| Navegación por flechas | **ausente** | `:113-145` |

---

## Dropdown de tipo de proyecto (`ProjectTypeFilterDropdown`)

Multi-selección con checkboxes, en el reporte de horas.

### Estructura

| # | Nombre | Tipo | Variant | Componente real | Origen |
|---|--------|------|---------|-----------------|--------|
| 1 | boton-filtro-tipo | `button` | secondary | `<button aria-expanded>` | `ProjectTypeFilterDropdown.tsx:63-73` |
| 2 | chevron | `icon` | open / closed | `<span aria-hidden="true">` | `:70-72` |
| 3 | panel-opciones | `dropdown` | open | `<div className={styles.panel}>` | `:76-88` |
| 4 | opcion-checkbox | `checkbox` | checked / unchecked | `<label>` + `<input type="checkbox">` | `:78-86` |

### Contenido

Opciones verbatim: `"Comercial"` (`comercial`) · `"Interno"` (`interno`) ·
`"Investigación"` (`investigacion`) · `"Propuesta"` (`propuesta`) ·
`ProjectTypeFilterDropdown.tsx:14-17`

Label del botón: `"Tipo de proyecto"` sin selección, o `` `Tipo de proyecto (${value.length})` ``
con selección · `:59`

### Estados presentes

| Estado | Disparado por | Origen |
|---|---|---|
| cerrado | `isOpen === false` | `ProjectTypeFilterDropdown.tsx:76` |
| abierto | click en el botón | `:65` |
| con selección | `value.length > 0` → el label muestra el contador | `:59` |

### Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| limpiar selección | **no hay control:** hay que destildar de a uno | `:76-88` |
| empty | no aplica: las opciones son una constante | `:14-17` |

### Accesibilidad

| Aspecto | Estado | Evidencia |
|---|---|---|
| `aria-expanded` | Presente | `ProjectTypeFilterDropdown.tsx:67` |
| `aria-haspopup` | **ausente** | `:64-69` |
| Checkboxes nativos | Sí, con `<label>` envolvente y `aria-label` | `:78-84` |
| Cierre por click afuera | Presente (`mousedown`) | `:39,43` |
| Cierre con `Escape` | **Presente** — el único de los tres dropdowns propios que lo tiene | `:34-37,40` |
| Chevron decorativo | `aria-hidden="true"`. Correcto | `:70` |
| Contador anunciado | Va en el texto del botón, así que se lee. Correcto | `:59` |

---

## Tooltip (`Tooltip`)

10 usos: `ObjectiveHistoryList`, `ProjectInactiveObjectivesTable` (muerto), `RequirementHeader`,
`AreaTag` (×2), `ObjectiveComment`, `DateLabel`.

Prop `disableTooltip` para apagarlo condicionalmente (lo usa
`ProjectInactiveObjectivesTable` cuando el texto no está truncado).

### Estructura

| # | Nombre | Tipo | Componente real | Origen |
|---|--------|------|-----------------|--------|
| 1 | contenedor-tooltip | `section` | `<div className={styles.tooltipContainer}>` | `Tooltip.tsx:12` |
| 2 | contenido-tooltip | `tooltip` | `<p className={styles.tooltipContent}>` | `Tooltip.tsx:14` |

Es un componente de 17 líneas, **sin estado y sin ningún handler**: el `<p>` está siempre en el DOM
y la visibilidad la resuelve el CSS.

### Contenido

Dinámico desde la prop `message`. Instancias reales:

| Uso | message | Origen |
|---|---|---|
| Historial de tarea | fecha formateada de la actividad | `ObjectiveHistoryList.tsx:56` |
| Área de tarea | el nombre del área | `AreaTag.tsx:32` |
| Responsable de tarea | nombre del proyecto o lista de responsables | `AreaTag.tsx:35` |
| Comentario | `` `Creación: ${fecha}` `` | `ObjectiveComment.tsx:98` |
| Visibilidad de comentario | `"Visible para externos"` / `"Solo interno"` | `ObjectiveComment.tsx:81` |
| Etiqueta de fecha | fecha formateada | `DateLabel.tsx:46` |
| Opción deshabilitada de pill | el motivo del deshabilitado | `RequirementHeader.tsx:136` |

### Estados presentes

| Estado | Disparado por | Origen |
|---|---|---|
| oculto (default) | `visibility: hidden; opacity: 0` | `Tooltip.module.scss:7,21` |
| visible | `:hover` sobre el contenedor, transición de opacidad 0.3s | `Tooltip.module.scss:37` |
| desactivado | prop `disableTooltip` → el `<p>` no se renderiza | `Tooltip.tsx:14` |

### Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **activación por foco** | **ausente.** El único selector es `.tooltipContainer:hover`. No hay `:focus`, `:focus-visible` ni `:focus-within`: **el tooltip es inalcanzable por teclado** | `Tooltip.module.scss:37` |
| activación táctil | sin `:hover` real en touch, el comportamiento depende del navegador. No hay handler de `click` ni de `touchstart` | `Tooltip.tsx:10-16` |
| texto largo | `white-space: nowrap` (`Tooltip.module.scss:23`): un mensaje largo se estira en una línea y puede salir del viewport. No hay reposicionamiento | `Tooltip.module.scss:23` |
| colisión con el borde | **ausente:** posición fija `bottom: 140%; left: 50%` con `translateX(-50%)`. Un tooltip en el borde superior o lateral se recorta | `Tooltip.module.scss:16-20` |

### Accesibilidad

| Aspecto | Estado | Evidencia |
|---|---|---|
| `role="tooltip"` | **ausente** | `Tooltip.tsx:14` |
| `aria-describedby` | **ausente:** el mensaje no está vinculado a ningún elemento | `Tooltip.tsx:12-15` |
| Alcanzable por teclado | **no.** Solo `:hover` | `Tooltip.module.scss:37` |
| Presente en el árbol de accesibilidad | **sí, siempre.** El `<p>` está en el DOM y `visibility: hidden` lo saca del árbol… pero al ser el hermano del trigger, cuando es visible se lee como texto suelto, sin relación con lo que describe | `Tooltip.tsx:14` |
| `z-index` | `20` literal, no el token `--z-index-tooltip` (300) | `Tooltip.module.scss:17` |

> **El caso grave es `RequirementHeader`.** Ahí el tooltip comunica **por qué** una opción de estado
> está deshabilitada — información que no está en ningún otro lado. Al no ser alcanzable por teclado
> ni estar vinculada con `aria-describedby`, un usuario de teclado o de lector de pantalla ve la
> opción deshabilitada sin explicación.

---

## Cajón de actores (`ClientsDrawer`) — código muerto

**Ningún componente lo importa.** Se releva porque está en el árbol de archivos y porque su
contenido se solapa con `listado-actores`.

### Estructura

| # | Nombre | Tipo | Componente real | Origen |
|---|--------|------|-----------------|--------|
| 1 | cajon | `modal` lateral | `<div className={styles.drawer}>` con clase `.open` | `ClientsDrawer.tsx:21` |
| 2 | encabezado-cajon | `header` | `<div className={styles.header}>` con `<h2>Actores</h2>` | `:22-23` |
| 3 | boton-cerrar | `button` | `<button className={styles.closeBtn}>` | `:24-26` |
| 4 | fila-actor | `list` | `<div className={styles.clientRow}>` | `:35` |
| 5 | accion-editar | `link` | `<Link>` con SVG de lápiz y `title="Editar"` | `:41-56` |

### Contenido

- Título: `"Actores"` · `:23`
- Loading: `"Cargando..."` · `:29`
- Empty: `"No hay actores disponibles."` · `:31`
- Acción: `title="Editar"` · `:42`

> **El empty dice `"No hay actores disponibles."`** mientras `listado-actores` dice
> `"No hay actores que coincidan con estos filtros."` Dos textos para el mismo vacío.

### Observación

Usa `useClients({ enabled: isOpen })` (`:16`), o sea que estaba pensado para no traer datos hasta
abrirse. No se puede determinar desde el código si es una feature planeada, una removida, o un
componente de otra iteración.

---

## Observaciones del relevamiento

- **Dos implementaciones de modal con calidad muy distinta.** `ConfirmDialog` usa `<dialog>` nativo y
  obtiene focus trap, `Escape` y devolución del foco gratis. `PreviewModal` los reimplementa a mano y
  le faltan los tres. **Ningún overlay del producto atrapa el foco salvo el que usa el elemento
  nativo.**
- **Cuatro dropdowns propios con cuatro niveles de accesibilidad.** `StateTag` no tiene ni
  `aria-expanded`; `PillDropdown` tiene el juego completo de ARIA pero no `Escape`;
  `ProjectTypeFilterDropdown` tiene `Escape` pero no `aria-haspopup`. **Ninguno soporta navegación
  por flechas.** Los tres podrían ser un solo componente.
- **`StateTag` no cierra por click afuera**, a diferencia de los otros dos. Es el que aparece en las
  tablas y cards de tarea, o sea el más usado.
- **El toast de `StateTag` muestra el valor crudo** (`en_revision`) en vez de la etiqueta
  (`"En revisión"`), aunque el mapa de etiquetas está en el mismo archivo (`:21-25`).
- **`react-select` aporta un cuarto comportamiento de dropdown**, con su propia accesibilidad y sus
  propios estilos (duplicados en 6 archivos). El producto tiene cuatro mecánicas de dropdown
  conviviendo.
- **No se pudo determinar** el comportamiento accesible de `Tooltip` sin leer su implementación
  completa. Queda pendiente, y es relevante porque en `PillDropdown` el tooltip comunica información
  que no está en ningún otro lado.
- **A confirmar en consolidación:** si los tres dropdowns propios deben unificarse en un componente
  del design system, y si `PreviewModal` debe migrar a `<dialog>` nativo como `ConfirmDialog`.
