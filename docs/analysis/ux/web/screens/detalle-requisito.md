---
document: UX Survey Screen
screen: detalle-requisito
route: /requirements/[reqid]
service: web
source_files:
  - src/app/(loggedin)/requirements/[reqid]/page.tsx
  - src/features/requirements/components/RequirementDetailContainer/RequirementDetailContainer.tsx
  - src/features/requirements/components/RequirementDetail/RequirementDetail.tsx
  - src/features/requirements/components/RequirementDetail/RequirementDetail.module.scss
  - src/features/requirements/components/RequirementHeader/RequirementHeader.tsx
  - src/features/requirements/components/RequirementHeader/RequirementHeader.module.scss
  - src/features/requirements/components/RequirementStatusCard/RequirementStatusCard.tsx
  - src/features/requirements/components/RequirementResolutionCard/RequirementResolutionCard.tsx
  - src/features/requirements/components/RequirementActivityFeed/RequirementActivityFeed.tsx
  - src/features/requirements/components/RequirementActivityForm/RequirementActivityForm.tsx
viewports_detected:
  - mobile
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: detalle-requisito

> **Relevamiento as-is** de `/requirements/[reqid]`, extraído de
> `src/app/(loggedin)/requirements/[reqid]/page.tsx` y su árbol de componentes.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> **Es la pantalla más compleja del producto:** 10 archivos, ~1.600 líneas de componentes. El chrome
> está relevado en [_shell.md](./_shell.md); los pills-dropdown, en
> [_overlays.md](./_overlays.md).

## Identidad

- **Ruta:** `/requirements/[reqid]`
- **Archivo:** `src/app/(loggedin)/requirements/[reqid]/page.tsx` (Server Component) →
  `<RequirementDetailContainer>` (`'use client'`) → `<RequirementDetail>`
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** vista de trabajo de un requisito: edita estado, tipo y prioridad desde el
  header; avanza el workflow paso a paso con los campos que cada paso pide; muestra tareas
  vinculadas, actividad con comentarios, información general, etiquetas y resolución.
- **Viewports con tratamiento:** `mobile` y `desktop`, con el corte en **1023px**. Es la pantalla con
  el tratamiento responsive más explícito del producto.

## Entrada y salida

**Entradas:**
- Click en una fila de `listado-requisitos` · `RequirementList.tsx:~147`
- Click en una fila de la tabla de requisitos de `detalle-proyecto` ·
  `ProjectRequirementsSection.tsx:~145`
- Link `"Requisito"` de `detalle-tarea` · `ObjectiveDetails.tsx:118-120`

**Salidas:**
- `/requirements` · link `"Volver"` · `RequirementHeader.tsx:207-209`
- `/requirements/{id}/edit` · link `"Editar"` · `RequirementHeader.tsx:210-212`
- `/objectives/new?requirementId={id}` · botón `+` de la sección de tareas ·
  `RequirementDetail.tsx:~155`
- `/objectives/{id}` · click en una fila de la tabla de tareas · `RequirementDetail.tsx:~206`

**Redirects automáticos:**
- `notFound()` si el `reqid` de la URL no es numérico · `requirements/[reqid]/page.tsx:15`

> **Es una de las dos rutas del producto que validan el parámetro dinámico.** Las de proyecto, actor
> y tarea no lo hacen.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | encabezado-requisito | `header` | — | ambos | `<div className={styles.pageHeader}>` | `RequirementHeader.tsx:169` |
| 2 | titulo-requisito | `heading` | h1 | ambos | `<h1 className={styles.reqTitle}>` | `RequirementHeader.tsx:~171` |
| 3 | codigo-requisito | `badge` | — | ambos | `<span className={styles.reqCode}>#{id}</span>` | `RequirementHeader.tsx:173` |
| 4 | pill-estado | `dropdown` | closed / open · disabled | ambos | `<PillDropdown dataAttr="data-state">` | `RequirementHeader.tsx:175-184` |
| 5 | pill-tipo | `dropdown` | closed / open · disabled | ambos | `<PillDropdown dataAttr="data-type">` | `RequirementHeader.tsx:186-194` |
| 6 | pill-prioridad | `dropdown` | closed / open · disabled | ambos | `<PillDropdown dataAttr="data-priority">` | `RequirementHeader.tsx:196-204` |
| 7 | boton-volver | `link` | — | ambos | `<Link href="/requirements">` | `RequirementHeader.tsx:207-209` |
| 8 | boton-editar | `link` | — | ambos | `<Link href="/requirements/{id}/edit">` | `RequirementHeader.tsx:210-212` |
| 9 | card-contexto | `card` | — | ambos | `<div className={styles.card}>` + `<MarkdownViewer>` | `RequirementDetail.tsx:132-136` |
| 10 | card-estado | `card` | — | ambos | `<RequirementStatusCard>` | `RequirementDetail.tsx:140-145` |
| 11 | stepper-workflow | `progress-bar` | 5 pasos · current / done / skipped | ambos | `<div className={styles.stepper}>` | `RequirementStatusCard.tsx:353-355` |
| 12 | paso-workflow | `badge` | current / done / pendiente / skipped | ambos | `<div className={styles.step}>` con `aria-current="step"` | `RequirementStatusCard.tsx:324-345` |
| 13 | acordeon-campo | `section` | abierto / cerrado · met / missing | ambos | `<FieldAccordion>` × 4 | `RequirementStatusCard.tsx:115-145` |
| 14 | boton-guardar-campos | `button` | primary · small | ambos | `<button className={styles.btnSmallPrimary}>` | `RequirementStatusCard.tsx:376-382` |
| 15 | boton-transicion | `button` | primary | ambos | `<button className={styles.transitionButton}>` | `RequirementStatusCard.tsx:385-391` |
| 16 | seccion-tareas | `section` | — | ambos | `<div className={styles.card}>` | `RequirementDetail.tsx:147-287` |
| 17 | tabs-estado-tarea | `tabs` | 5 estados | ambos | `<div className={styles.tabs}>` | `RequirementDetail.tsx:159-180` |
| 18 | tabla-tareas | `table` | — | ambos | `<table className={styles.objTable}>` | `RequirementDetail.tsx:185-225` |
| 19 | paginacion-tareas | `pagination` | — | ambos | `<nav className={styles.objPagination}>` — reimplementada inline | `RequirementDetail.tsx:227-280` |
| 20 | card-actividad | `card` | — | ambos | `<div className={styles.card}>` | `RequirementDetail.tsx:289-295` |
| 21 | feed-actividad | `list` | — | ambos | `<div className={styles.feed}>` en `<RequirementActivityFeed>` | `RequirementActivityFeed.tsx:118` |
| 22 | formulario-comentario | `section` | — | ambos | `<form className={styles.activityForm}>` | `RequirementActivityForm.tsx:59` |
| 23 | editor-comentario | `text-input` | default | ambos | `<RequirementRichTextEditor>` | `RequirementActivityForm.tsx:61-67` |
| 24 | boton-adjuntar | `button` | — | ambos | `<button aria-label="Adjuntar archivo">` con SVG de clip | `RequirementActivityForm.tsx:82-103` |
| 25 | toggle-visibilidad | `toggle` | internal / public | ambos | dos `<button aria-pressed>` | `RequirementActivityForm.tsx:105-127` |
| 26 | boton-enviar-comentario | `button` | primary · disabled | ambos | `<button type="submit" aria-label="Enviar comentario">` con SVG de avión | `RequirementActivityForm.tsx:128-148` |
| 27 | card-informacion-general | `card` | — | ambos | `<div className={styles.card}>` con `<dl>` | `RequirementDetail.tsx:301-367` |
| 28 | card-etiquetas | `card` | — | ambos | `<div className={styles.card}>` | `RequirementDetail.tsx:370-392` |
| 29 | chip-etiqueta | `badge` | — | ambos | `<span className={styles.tagPill}>` con botón de borrar | `RequirementDetail.tsx:376-390` |
| 30 | card-resolucion | `card` | abierto / resuelto / cancelado | ambos | `<RequirementResolutionCard>` | `RequirementDetail.tsx:394-398` |
| 31 | campo-tipo-resolucion | `dropdown` | closed · disabled | ambos | `<select id="resolution-type">` nativo | `RequirementResolutionCard.tsx:101-119` |
| 32 | campo-conclusion | `text-input` | default · disabled | ambos | `<textarea id="resolution-conclusion">` | `RequirementResolutionCard.tsx:120-131` |
| 33 | campo-nota-cliente | `text-input` | default · disabled | ambos | `<textarea id="resolution-comment">` | `RequirementResolutionCard.tsx:133-145` |
| 34 | boton-cancelar-requisito | `button` | error | ambos | `<button className={styles.cancelButton}>` | `RequirementResolutionCard.tsx:160-167` |
| 35 | boton-resolver-requisito | `button` | primary | ambos | `<button className={styles.resolveButton}>` | `RequirementResolutionCard.tsx:168-175` |
| 36 | badge-resultado | `badge` | cancelado | ambos | `<div className={styles.resultBadge}>` | `RequirementResolutionCard.tsx:155-158` |

> `card-estado`, `seccion-tareas`, `acordeon-campo`, `formulario-comentario` y
> `card-resolucion` se relevaron como `card` / `section`: son compuestos sin tipo propio en el
> diccionario.

> `stepper-workflow` se relevó como `progress-bar` por ser lo más cercano del diccionario. No es una
> barra: son 5 nodos con conectores y un símbolo por nodo (`✓`, `×` o el número).

## Layout observado por viewport

### desktop · ≥1024px

- encabezado-requisito
  - row `header` (`space-between`)
    - col izquierda: titulo-requisito, y debajo la fila de badges (codigo-requisito, pill-estado,
      pill-tipo, pill-prioridad)
    - col derecha: boton-volver, boton-editar
- row `dos-columnas`
  - col ~7/12 (`1fr`): columna izquierda
    - card-contexto
    - card-estado (stepper-workflow, 4 acordeon-campo, boton-guardar-campos, boton-transicion)
    - seccion-tareas (tabs-estado-tarea, tabla-tareas, paginacion-tareas)
    - card-actividad (feed-actividad, formulario-comentario)
  - col ~5/12 (420px fijos): columna derecha
    - card-informacion-general
    - card-etiquetas
    - card-resolucion

**Origen:** `RequirementDetail.module.scss:3-7`:

```scss
.container { display: grid; grid-template-columns: 1fr 420px; gap: 1.25rem; align-items: start; }
```

**Las fracciones son aproximadas:** la columna derecha es de **420px fijos**. A 1440px de viewport
(contenido ~1118px) es ~7.5/12 + ~4.5/12; a 1920px, ~9.2/12 + ~2.8/12.

### mobile · ≤1023px

- encabezado-requisito, **apilado en columna**:
  - titulo-requisito
  - fila de badges (codigo-requisito, pill-estado, pill-tipo, pill-prioridad)
  - boton-volver, boton-editar
- columna única, en el orden del DOM:
  - card-contexto
  - card-estado
  - seccion-tareas
  - card-actividad
  - card-informacion-general
  - card-etiquetas
  - card-resolucion

**Origen:** `RequirementDetail.module.scss:9-14` y `RequirementHeader.module.scss:7-13`, ambos con un
comentario que explica el porqué:

```scss
/* RequirementDetail.module.scss:9-14 */
// Mobile + tablet unificados: en esta pantalla, tablet se comporta igual que mobile
// (apilado vertical), a diferencia del patrón de ObjectiveDetails/ProjectDetails, que
// en tablet mantienen el layout de 2 columnas. Pedido explícito del usuario.
@media (max-width: 1023px) { grid-template-columns: 1fr; }
```

```scss
/* RequirementHeader.module.scss:7-13 */
// Mobile/tablet: los botones (ancho fijo, flex-shrink: 0) le quitaban espacio horizontal
// al título en pantallas angostas, cortándolo. Se apila verticalmente en el orden que ya
// trae el DOM: título, pills (ambos dentro de .headerLeft), y por último los botones.
@media (max-width: 1023px) { flex-direction: column; align-items: stretch; }
```

> **Estos dos comentarios son la única documentación de intención responsive del producto**, y aun así
> el "pedido explícito del usuario" no dice qué usuario ni por qué. Ver "No determinable".

> **En una columna, la resolución queda al final**, después del feed de actividad y del formulario de
> comentario. Y la información general, después de las tareas.

## Contenido

### encabezado-requisito
- codigo-requisito: `` `#${id}` `` · `RequirementHeader.tsx:173`
- titulo-requisito: dinámico desde `requirement.title`
- boton-volver / boton-editar: textos en `RequirementHeader.tsx:208`, `:211` (`"Volver"` y `"Editar"`)

### pill-estado / pill-tipo / pill-prioridad
- Opciones verbatim en [_overlays.md](./_overlays.md)
- Annotation: **el update es optimista** (`useUpdateRequirement.ts:36-43`), así que el valor cambia
  en pantalla antes de la confirmación de la api, con rollback ante error.
- **Regla de negocio:** para `type: 'incidencia'`, `"En cola"` se saca de las opciones de estado
  salvo que el requisito ya esté ahí · `RequirementHeader.tsx:161-166`

### card-contexto
- Título: `"Contexto"` · `RequirementDetail.tsx:133`
- Contenido: `requirement.description` renderizado como markdown · `:135`

### card-estado
- Título: `` `Estado - ${STATE_LABELS[state]}` `` — p.ej. `"Estado - Desarrollo"` ·
  `RequirementStatusCard.tsx:350`
- Pasos del stepper (`INLINE_STEPS`): `"Análisis"` · `"Planificación"` · `"En cola"` ·
  `"Desarrollo"` · `"Revisión"` · `:24-29`
- Descripciones por paso (`STEP_DESCRIPTIONS`, `:72-79`), verbatim:
  - `analisis`: `"Se entiende el requerimiento y se define el alcance."`
  - `planificacion`: `"Se define la propuesta y los criterios de aceptación."`
  - `en_cola`: `"Se prioriza el orden de trabajo entre los requisitos planificados."`
  - `desarrollo`: `"Se ejecuta la solución definida en Planificación."`
  - `revision`: `"Se valida la implementación con el cliente o responsable."`
  - `resuelto`: `"El requisito fue resuelto y no requiere más trabajo."`
- Símbolos del nodo: `"✓"` si superado, `"×"` si superado-sin-actividad tras cancelar, o el número
  del paso · `:339`

### acordeon-campo
Cuatro campos, con label y placeholder verbatim (`RequirementStatusCard.tsx:198-221`):

| Campo | Label | Placeholder | Tipo |
|---|---|---|---|
| `scope` | `"Alcance"` | `"Qué se acordó con el cliente / qué entendió el equipo, y cómo impacta..."` | markdown |
| `technicalSolution` | `"Propuesta"` | `"Describí el enfoque técnico..."` | markdown |
| `acceptanceCriteria` | `"Criterios de aceptación"` | `"¿Qué se espera que pase? ¿Cómo se determina el éxito?"` | markdown |
| `estimatedFinishDate` | `"Cierre estimado"` | — | `date` |

- Indicador de completitud: `"✓"` si el campo tiene valor, `"!"` si no · `:118`
- Chevron: `"▾"` · `:121`
- Annotation: **cuáles se abren por defecto depende del estado real del requisito**
  (`DEFAULT_OPEN_FIELDS_BY_STATE`, `:184-188`): `analisis` → `scope`; `planificacion` →
  `technicalSolution` + `acceptanceCriteria`; `en_cola` → `estimatedFinishDate`. En `desarrollo`,
  `revision` y los estados terminales **no se abre ninguno**, con el comentario explicando que ahí no
  hay edición esperada como flujo principal (`:181-183`).
- El editor arranca en modo `preview` si el campo ya tiene valor, y en `edit` si está vacío ·
  `:141`

### boton-guardar-campos / boton-transicion
- Textos verbatim: `"Guardar"` · y `` `${getTransitionLabel(...)} →` `` — p.ej. `"Desarrollo →"`
- Origen: `RequirementStatusCard.tsx:381`, `:390`
- Annotation: el comentario del código explica la regla (`:290-294`): `"Guardar"` **siempre** está
  disponible y persiste solo los campos cambiados sin transicionar; con siguiente paso disponible,
  `"Pasar a X"` convive con `"Guardar"` y hace las dos cosas en una acción. En `Revisión`, `Resuelto`
  y `Cancelado` no hay destino, así que `"Guardar"` queda solo.
- **Flujo de trabajo** (`NEXT_WORK_STEP`, `:44-49`): `analisis → planificacion → en_cola →
  desarrollo → revision`. Para incidencias (`NEXT_WORK_STEP_INCIDENCIA`, `:55-58`):
  `analisis → planificacion → desarrollo → revision`, salteando `en_cola`.

### seccion-tareas
- Título: `"Tareas"` · `RequirementDetail.tsx:149`
- Tabs verbatim: `"Backlog"` · `"Activo"` · `"En revisión"` · `"Finalizado"` · `"Cancelado"`, con
  contador · `:23-27`, `:173`
- **Tab por defecto: `activo`** · `:81`
- Columnas: `"ID"` · `"Título"` · `"Responsable"` · `"Creación"` · `"Cierre estimado"` · `:188-192`
- Botón de alta: sin texto, `aria-label="Nueva tarea"` · `:153`
- Responsable vacío: `"-"` (guion corto) · `:43`
- Formato de fecha: `toLocaleDateString('es-AR', { day, month, year: '2-digit'/'numeric' })` · `:39`

> **Tercer valor para "sin responsable" en el producto:** acá `"-"` (guion corto), en
> `ProjectObjectivesSection` `"—"` (guion largo), en `RequirementList` `"Sin asignar"`.

> **Segundo locale:** acá `'es-AR'`, en `ProjectGeneralInfo` `'es-ES'`.

### card-actividad
- Título: `"Actividad"` · `RequirementDetail.tsx:290`
- Empty del feed: `"Sin actividad registrada"` · `RequirementActivityFeed.tsx:110`
- Etiquetas de visibilidad en el feed: `"Interno"` / `"Público"` · `RequirementActivityFeed.tsx:177`
- Placeholder del editor: `"Escribe un comentario..."` · `RequirementActivityForm.tsx:64`
- `ariaLabel` del editor: `"Comentario"` · `:65`
- Toast de éxito: `"Comentario agregado"` · `:45`
- Toast de error: `error.message` o `"Error al agregar el comentario"` · `:50`

> **El placeholder usa tuteo peninsular (`"Escribe"`)** mientras el resto del producto usa voseo
> rioplatense (`"Describí"`, `"Arrastrá"`, `"Intentá"`, `"hacé"`).

### toggle-visibilidad
- Sin texto visible. `aria-label="Comentario interno"` y `"Comentario público"` ·
  `RequirementActivityForm.tsx:112`, `:122`
- Annotation: default `internal` · `:19`

### card-informacion-general
- Título: `"Información General"` · `RequirementDetail.tsx:302`
- Filas verbatim (`<dt>`): `"Proyecto"` · `"Responsable (líder)"` · `"Responsable(s)"` ·
  `"Visibilidad"` · `"Creado por"` · `"Fecha de creación"` · `"Última actualización"` ·
  `:306-364`
- Visibilidad: `"Público"` / `"Interno"` · `:349`

### card-etiquetas
- Título: `"Etiquetas"` · `RequirementDetail.tsx:371`
- Empty: `"Sin etiquetas registradas"` · `:374`
- Botón de borrar chip: `aria-label={`Eliminar etiqueta ${tag.key}:${tag.value}`}` · `:383`

### card-resolucion
- Título: `"Resolución"` · `RequirementResolutionCard.tsx:90`
- Fila cuando está abierto: `"Cierre estimado"` · `:94`
- Fila cuando está resuelto: `"Fecha de finalización"` · `:151`
- Campos (solo para `type: 'incidencia'`, `:58`):
  - `"Tipo de resolución"` (label en `:102-104`), con opción vacía
    `"Seleccioná una opción"` · `:112`
  - `"Conclusión interna"` — placeholder
    `"Describí la conclusión interna de esta incidencia..."` · `:127`
  - `"Nota para cliente"` — placeholder `"Describí la resolución de esta incidencia..."` · `:140`
- Botones: `"Cancelar"` · `"Resolver"` · `:166`, `:174`
- Badge de resultado: `"Resuelto"` / `"Cancelado"` · `:28-30`

> **`"Cancelar"` acá cancela el requisito, no la acción.** Está al lado de `"Resolver"` y ambos son
> transiciones de estado terminales. En el resto del producto `"Cancelar"` significa descartar
> (`ConfirmDialog`, `ObjectiveComment`).

## Estados presentes

### default
- Disparado por: requisito resuelto (viene del servidor como `initialRequirement` y se refresca con
  `useRequirement`)
- Origen: `RequirementDetailContainer.tsx:19`, `RequirementDetail.tsx:126-400`

### estados del stepper
| Estado del nodo | Símbolo | Disparado por | Origen |
|---|---|---|---|
| actual | el número del paso | `state === step.value` | `RequirementStatusCard.tsx:313`, `:339` |
| superado | `"✓"` | `stepIdx < currentIdx`, o el requisito está en un estado terminal | `:317` |
| superado sin actividad tras cancelar | `"×"` | `state === 'cancelado'` y sin actividad registrada en ese paso | `:320-321`, `:339` |
| pendiente | el número del paso | ninguna de las anteriores | `:339` |

> El comentario del código explica el `"×"` (`:318-319`): *"Si terminó Cancelado, un paso 'superado'
> sin actividad real registrada (nunca se pasó por ahí) se marca con × en vez de ✓, para no sugerir
> que se completó."*

### acordeón abierto / cerrado, campo completo / faltante
- Símbolos: `"✓"` (met) / `"!"` (missing) · `RequirementStatusCard.tsx:118`
- Disparado por: `met` = el campo tiene valor; `open` = por defecto según el estado, o toggle manual
- Origen: `:115-145`, `:184-195`

### loading (mutación en curso)
- Disparado por: `isPending` de `useUpdateRequirement`
- Origen: `RequirementDetail.tsx:79`, propagado a `RequirementHeader`, `RequirementStatusCard` y
  `RequirementResolutionCard`
- Cambios: las pills, los botones de guardar/transicionar y los de resolución se **deshabilitan**.
  **Ninguno muestra spinner.** El valor de la pill ya cambió por el update optimista.

### estado terminal — resuelto
- Disparado por: `state === 'resuelto'`
- Origen: `RequirementResolutionCard.tsx:55`, `:150-153`
- Cambios: la card de resolución muestra `"Fecha de finalización"` en vez de los botones. Los campos
  de resolución quedan `disabled` (`isClosed`).

### estado terminal — cancelado
- Disparado por: `state === 'cancelado'`
- Origen: `RequirementResolutionCard.tsx:56`, `:154-158`
- Cambios: badge `"Cancelado"` en vez de los botones; campos deshabilitados; el stepper marca los
  pasos no recorridos con `"×"`

### empty por sección
- Mensajes: `"Sin actividad registrada"`, `"Sin etiquetas registradas"`, y el empty de la tabla de
  tareas (`RequirementDetail.tsx:196-200`)
- Origen: `RequirementActivityFeed.tsx:110`, `RequirementDetail.tsx:374`

### success / error de las acciones
- Éxito de comentario: toast `"Comentario agregado"` · `RequirementActivityForm.tsx:45`
- Error de actualización: toast `error.message` o `"Error al actualizar el requisito"` ·
  `RequirementDetail.tsx:108`
- Error de comentario: toast `error.message` o `"Error al agregar el comentario"` ·
  `RequirementActivityForm.tsx:50`

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error al refrescar el requisito** | **no se maneja.** `RequirementDetailContainer` hace `requirement ?? initialRequirement`: si el refetch falla, **se sigue mostrando el dato del render inicial sin ningún aviso**. La pantalla se ve normal con datos potencialmente viejos | `RequirementDetailContainer.tsx:19` |
| **not found (id numérico inexistente)** | `getRequirementById` en el Server Component **sin try/catch**. Un id que no existe lanza y **no hay `error.tsx` en la ruta** → pantalla de error por defecto de Next, sin sidebar | `requirements/[reqid]/page.tsx:17`; no existe `requirements/error.tsx` |
| id no numérico | **sí se maneja:** `if (isNaN(id)) notFound()` | `requirements/[reqid]/page.tsx:15` |
| loading inicial | no aplica: el Server Component espera el dato antes de renderizar. No hay `loading.tsx` en la ruta, así que la navegación se siente como una espera sin feedback | no existe `requirements/[reqid]/loading.tsx` |
| **spinner en las acciones** | los botones se deshabilitan vía `isPending` pero **ninguno muestra spinner**: no usan `<Button loading>` sino `<button>` nativos | `RequirementStatusCard.tsx:376-391`, `RequirementResolutionCard.tsx:160-175` |
| **confirmación al resolver o cancelar** | **ausente.** `"Resolver"` y `"Cancelar"` disparan la transición terminal **directo, sin `ConfirmDialog`**. Son las dos acciones menos reversibles de la pantalla | `RequirementResolutionCard.tsx:81`, `:85` |
| **confirmación al borrar una etiqueta** | ausente: el chip se borra al click | `RequirementDetail.tsx:380-388` |
| error de validación | **no hay validación en esta pantalla.** Los campos del acordeón y de resolución se guardan sin reglas: `"Guardar"` persiste lo que haya, y la transición no exige que el campo del paso esté completo. El `"!"` del acordeón es informativo, no bloqueante | `RequirementStatusCard.tsx:302-307` |
| error al cargar las tareas vinculadas | `linkedObjectives` viene en el mismo payload del requisito; si falta, la tabla queda vacía sin distinguir de "no hay tareas" | `RequirementDetail.tsx:33` |
| **cierre del acordeón con `Escape`** | ausente | `RequirementStatusCard.tsx:116` |

## Interacciones

**Eventos:**
- pill-estado / pill-tipo / pill-prioridad · seleccionar opción → `onUpdate({campo: valor})` con
  update optimista · `RequirementHeader.tsx:~183`, `useUpdateRequirement.ts:36-43`
- acordeon-campo · click en el encabezado → toggle `open` · `RequirementStatusCard.tsx:116`
- acordeon-campo · editar → `handleDraftChange(field, value)` en estado local ·
  `RequirementStatusCard.tsx:300-302`
- boton-guardar-campos · click → `handleSaveFields()`: arma el payload **solo con los campos
  cambiados** y **retorna sin hacer nada si no hay ninguno** · `RequirementStatusCard.tsx:304-308`
- boton-transicion · click → `handleTransition()`: manda los campos cambiados **más** el nuevo estado
  en una sola mutación · `RequirementStatusCard.tsx:295-298`
- tab de tarea · click → cambia `activeObjTab` local · `RequirementDetail.tsx:~166`
- fila de tarea · click → navega a `/objectives/{id}` · `RequirementDetail.tsx:~206`
- chip-etiqueta · click en la cruz → borra del estado local `localTags` y manda la mutación ·
  `RequirementDetail.tsx:380-388`
- editor-comentario · on change → `setIsEmpty(value.trim().length === 0)` ·
  `RequirementActivityForm.tsx:23-25`
- toggle-visibilidad · click → `setVisibility('internal' | 'public')` ·
  `RequirementActivityForm.tsx:110`, `:120`
- boton-enviar-comentario · submit → `addActivity`; **deshabilitado si el editor está vacío** ·
  `RequirementActivityForm.tsx:131`
- boton-resolver-requisito · click → `onUpdate({ state: 'resuelto' })` ·
  `RequirementResolutionCard.tsx:81`
- boton-cancelar-requisito · click → `onUpdate({ state: 'cancelado' })` ·
  `RequirementResolutionCard.tsx:85`

**Validaciones:**
- comentario · no vacío tras `trim()` → el botón de enviar queda `disabled`, sin mensaje ·
  `RequirementActivityForm.tsx:24`, `:131`
- **Ninguna otra.** No hay reglas sobre los campos del workflow ni sobre los de resolución.

**Feedback:**
- Update optimista: el valor de la pill cambia de inmediato
- Contador por tab de tarea
- `"✓"` / `"!"` por campo del acordeón
- Toasts de éxito y error
- Botones deshabilitados durante la mutación

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Jerarquía de encabezados | `<h1>` para el título del requisito. **Los títulos de card son `<div className={styles.cardTitle}>`, no encabezados**: la pantalla tiene un solo nivel y no se puede navegar por secciones | `RequirementHeader.tsx:~171` vs `RequirementDetail.tsx:133`, `:290`, `:302`, `:371` |
| Título de la sección de tareas | `<span className={styles.cardTitle}>`, tampoco encabezado | `RequirementDetail.tsx:149` |
| Stepper | `aria-current="step"` en el nodo actual. Correcto | `RequirementStatusCard.tsx:328` |
| Estado del nodo del stepper | El símbolo `✓`/`×`/número es texto, así que se lee. **Pero no hay texto que explique qué significa `×`** | `RequirementStatusCard.tsx:339` |
| Acordeón | `aria-expanded` presente en el botón del encabezado. **Falta `aria-controls`** | `RequirementStatusCard.tsx:116` |
| Indicador `✓`/`!` del campo | Es un `<span>` con el símbolo, **sin texto alternativo**: un lector lee `"! Alcance"` sin saber que significa "falta completar" | `RequirementStatusCard.tsx:118` |
| Pills-dropdown | ARIA completo (`aria-haspopup`, `aria-expanded`, `role="listbox"`, `role="option"`, `aria-selected`, `aria-disabled`). Ver [_overlays.md](./_overlays.md) | `RequirementHeader.tsx:99-145` |
| Motivo de opción deshabilitada | Comunicado por `Tooltip`, que es **solo `:hover`** y sin `aria-describedby`: inaccesible por teclado | `RequirementHeader.tsx:136-138`, `Tooltip.module.scss:37` |
| Tabs de tarea | `<div className={styles.tabs}>` con `<button>`. **Sin `role="tablist"`/`role="tab"` y sin `<nav aria-label>`** — peor que las tabs de `detalle-proyecto`, que al menos tienen `<nav aria-label>` | `RequirementDetail.tsx:159-180` |
| Paginación de tareas | `<nav aria-label="Paginación">` con `aria-current="page"`. Correcto | `RequirementDetail.tsx:227`, `:254` |
| Filas de tarea clickeables | `<tr onClick>` **sin `role`, sin `tabIndex`, sin handler de teclado** | `RequirementDetail.tsx:~206` |
| Botones de icono | `aria-label` presente en todos: `"Nueva tarea"`, `"Adjuntar archivo"`, `"Enviar comentario"`, `"Comentario interno"`, `"Comentario público"`, `"Eliminar etiqueta {k}:{v}"` | `RequirementDetail.tsx:153`, `:383`, `RequirementActivityForm.tsx:85`, `:112`, `:122`, `:132` |
| SVG decorativos | `aria-hidden="true"` presente en los del formulario de comentario | `RequirementActivityForm.tsx:98`, `:144` |
| Toggle de visibilidad | `aria-pressed` presente en los dos botones. Correcto | `RequirementActivityForm.tsx:111`, `:121` |
| Campos de resolución | `<label htmlFor>` correctamente asociados a `id` en los tres | `RequirementResolutionCard.tsx:102-145` |
| Error de subida en el comentario | `role="alert"` presente | `RequirementActivityForm.tsx:76` |
| `<form noValidate>` | Presente: la validación es propia | `RequirementActivityForm.tsx:59` |
| Botón de enviar deshabilitado | `disabled` sin explicación de por qué. No hay `aria-describedby` que diga "escribí un comentario" | `RequirementActivityForm.tsx:131` |
| Anuncio del cambio de tab | **ausente:** sin `aria-live` | `RequirementDetail.tsx:159-180` |
| Anuncio del update optimista | **ausente:** el valor de la pill cambia sin anuncio | `RequirementHeader.tsx:99-111` |

## Observaciones del relevamiento

- **Es la pantalla con más intención documentada del producto.** Cinco comentarios explican
  decisiones concretas: los dos breakpoints unificados, el `"×"` del stepper cancelado, la
  convivencia de `"Guardar"` con `"Pasar a X"` (con referencia a la historia `S-087`), qué campos se
  abren por defecto (con referencia a criterios `CA-2` a `CA-5`), y el flujo alternativo de
  incidencias. **Es la única pantalla donde el código explica el por qué**, y aun así los comentarios
  citan artefactos (`S-087`, `CA-2`) que no están en este repositorio.
- **Las dos acciones más irreversibles no piden confirmación.** `"Resolver"` y `"Cancelar"` llaman a
  `onUpdate` directo (`RequirementResolutionCard.tsx:81`, `:85`), mientras borrar un adjunto o una
  hora cargada sí usa `ConfirmDialog`. Asimetría de riesgo.
- **`"Cancelar"` significa dos cosas distintas en el producto.** Acá cancela el requisito; en
  `ConfirmDialog` y en `ObjectiveComment` descarta la acción. En esta pantalla está al lado de
  `"Resolver"`, lo que ayuda a leerlo — pero es la misma palabra.
- **La transición no exige que el campo del paso esté completo.** El acordeón marca `"!"` en un campo
  faltante y `"Pasar a X"` funciona igual. No se puede determinar si es deliberado.
- **Los títulos de card no son encabezados.** Son `<div>`/`<span>` con clase `cardTitle`
  (`:133`, `:149`, `:290`, `:302`, `:371`). En una pantalla con 8 secciones, eso deja un solo `<h1>` y
  ninguna estructura navegable.
- **Un error de refetch es invisible.** `requirement ?? initialRequirement`
  (`RequirementDetailContainer.tsx:19`) es un fallback silencioso: si la api empieza a fallar, la
  pantalla sigue mostrando el snapshot del primer render.
- **Tercer valor de "sin responsable" y segundo locale de fecha** en el producto, dentro de una
  pantalla que ya comparte tabla con `ProjectObjectivesSection`.
- **`"Escribe un comentario..."` rompe el voseo** del resto del producto.
- **Los mapas de etiquetas están redeclarados** en `RequirementDetail`, `RequirementHeader`,
  `RequirementStatusCard` y `RequirementActivityFeed` — cuatro de las cinco copias.
- **No determinable desde el código:** qué usuario pidió unificar mobile y tablet en esta pantalla y
  por qué solo acá; qué son `S-087`, `CA-2` a `CA-5`; y por qué el tab de tareas por defecto es
  `activo` acá y en `detalle-proyecto`, pero el de requisitos en `detalle-proyecto` es `desarrollo`.
- **A confirmar en consolidación:** si resolver y cancelar deben pedir confirmación, si la transición
  debe exigir los campos del paso, y si los títulos de card deben ser encabezados.
