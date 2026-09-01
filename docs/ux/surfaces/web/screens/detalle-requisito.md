---
name: detalle-requisito
surface: web
route: /requirements/[reqid]
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.1"
date: 2026-09-01
---

# Pantalla: Detalle de requisito

## Identidad

- **Audiencia primaria:** equipo-interno. Requiere sesión — el guard está en `(loggedin)/layout.tsx:13-21` [fuente: código-existente].
- **JTBD / Propósito:** vista de trabajo de un requisito: edita estado, tipo y prioridad desde el header; avanza el workflow paso a paso con los campos que cada paso pide; muestra tareas vinculadas, actividad con comentarios, información general, etiquetas y resolución [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport declarado. El layout de dos columnas es la forma en que la pantalla existe en la superficie.
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente]. Esta pantalla **sí** define reglas `@media (max-width: 1023px)` que colapsan las dos columnas a una y apilan el encabezado (`RequirementDetail.module.scss:9-14`, `RequirementHeader.module.scss:7-13`); quedan registradas en Layout como comportamiento observado del código, aunque no correspondan a un viewport alcanzable de la superficie. Es la pantalla con el tratamiento responsive más explícito del producto.
  - Tablet: se comporta como desktop por encima de 1023px.

## Entrada y salida

**Entradas:**
- Click en una fila de `listado-requisitos` · `RequirementList.tsx:~147` [fuente: código-existente]
- Click en una fila de la tabla de requisitos de `detalle-proyecto` · `ProjectRequirementsSection.tsx:~145`
- Link `"Requisito"` de `detalle-tarea` · `ObjectiveDetails.tsx:118-120`

**Salidas user-driven:**
- `/requirements` · click en `boton-volver` · `RequirementHeader.tsx:207-209`
- `/requirements/{id}/edit` · click en `boton-editar` · `RequirementHeader.tsx:210-212`
- `/objectives/new?requirementId={id}` · botón `+` de la sección de tareas · `RequirementDetail.tsx:~155`
- `/objectives/{id}` · click en una fila de `tabla-tareas` · `RequirementDetail.tsx:~206`

**Salidas automáticas:**
- `notFound()` si el `reqid` de la URL no es numérico · `requirements/[reqid]/page.tsx:15`. Es una de las dos rutas del producto que validan el parámetro dinámico [fuente: código-existente]

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | encabezado-requisito | header | — | layout | desktop | todos los estados | Título, badges y acciones |
| 2 | titulo-requisito | heading | h1 | content | desktop | todos los estados | Título del requisito |
| 3 | codigo-requisito | badge | — | content | desktop | todos los estados | Identificador `#{id}` |
| 4 | pill-estado | dropdown | closed / open · disabled | input | desktop | state_overrides: loading→disabled; estado terminal→disabled | Cambia el estado in-place |
| 5 | pill-tipo | dropdown | closed / open · disabled | input | desktop | state_overrides: loading→disabled | Cambia el tipo in-place |
| 6 | pill-prioridad | dropdown | closed / open · disabled | input | desktop | state_overrides: loading→disabled | Cambia la prioridad in-place |
| 7 | boton-volver | link | — | navigation | desktop | todos los estados | Vuelve al listado |
| 8 | boton-editar | link | — | navigation | desktop | todos los estados | Va a la edición |
| 9 | card-contexto | card | — | content | desktop | todos los estados | Descripción en markdown |
| 10 | card-estado | card | — | content | desktop | todos los estados | Workflow del requisito |
| 11 | stepper-workflow | progress-bar | 5 pasos · current / done / skipped | content | desktop | todos los estados | Avance por los pasos del flujo |
| 12 | paso-workflow | badge | current / done / pendiente / skipped | content | desktop | todos los estados | Un nodo del stepper |
| 13 | acordeon-campo | section | abierto / cerrado · met / missing | input | desktop | todos los estados | Campo del paso, editable |
| 14 | boton-guardar-campos | button | primary · small | input | desktop | state_overrides: loading→disabled | Persiste los campos cambiados |
| 15 | boton-transicion | button | primary | input | desktop | state_overrides: loading→disabled; estado terminal→ausente | Guarda y avanza de paso |
| 16 | seccion-tareas | section | — | content | desktop | todos los estados | Tareas vinculadas |
| 17 | tabs-estado-tarea | tabs | 5 estados | navigation | desktop | todos los estados | Filtra la tabla por estado |
| 18 | tabla-tareas | table | — | content | desktop | todos los estados | Lista de tareas del estado activo |
| 19 | paginacion-tareas | pagination | — | navigation | desktop | todos los estados | Paginación de la tabla de tareas |
| 20 | card-actividad | card | — | content | desktop | todos los estados | Feed de actividad y alta de comentario |
| 21 | feed-actividad | list | — | content | desktop | todos los estados | Historial de actividad |
| 22 | formulario-comentario | section | — | input | desktop | todos los estados | Alta de comentario |
| 23 | editor-comentario | text-input | default | input | desktop | todos los estados | Cuerpo del comentario |
| 24 | boton-adjuntar | button | — | input | desktop | todos los estados | Adjunta un archivo al comentario, de a uno por vez |
| 25 | toggle-visibilidad | toggle | internal / public | input | desktop | todos los estados | Visibilidad del comentario |
| 26 | boton-enviar-comentario | button | primary · disabled | input | desktop | state_overrides: editor vacío→disabled | Envía el comentario |
| 27 | card-informacion-general | card | — | content | desktop | todos los estados | Metadatos del requisito |
| 28 | card-etiquetas | card | — | content | desktop | todos los estados | Etiquetas del requisito |
| 29 | chip-etiqueta | badge | — | content | desktop | todos los estados | Una etiqueta, con botón de borrar |
| 30 | card-resolucion | card | abierto / resuelto / cancelado | content | desktop | todos los estados | Cierre del requisito |
| 31 | campo-tipo-resolucion | dropdown | closed · disabled | input | desktop | visible_only_in_states: requisito de tipo incidencia; state_overrides: estado terminal→disabled | Tipo de resolución |
| 32 | campo-conclusion | text-input | default · disabled | input | desktop | visible_only_in_states: requisito de tipo incidencia; state_overrides: estado terminal→disabled | Conclusión interna |
| 33 | campo-nota-cliente | text-input | default · disabled | input | desktop | visible_only_in_states: requisito de tipo incidencia; state_overrides: estado terminal→disabled | Nota para cliente |
| 34 | boton-cancelar-requisito | button | error | input | desktop | hidden_in_states: estado terminal / readonly | Cancela el requisito |
| 35 | boton-resolver-requisito | button | primary | input | desktop | hidden_in_states: estado terminal / readonly | Resuelve el requisito |
| 36 | badge-resultado | badge | cancelado | content | desktop | visible_only_in_states: estado terminal / readonly | Muestra el resultado final |
| 37 | progreso-subida-adjunto | progress-bar | — | feedback | desktop | visible_only_in_states: subiendo adjunto | Progreso real de la subida del archivo en curso |
| 38 | marca-identidad-automatica | badge | automatico | content | desktop | hidden_in_states: loading, not found | Marca que el autor mostrado es una identidad de servicio y no una persona |
| 39 | card-horas-trabajadas | card | — | content | desktop | todos los estados | Total de horas imputadas al requisito y su desglose por persona |
| 40 | total-horas-trabajadas | heading | h3 | content | desktop | hidden_in_states: horas cargando, horas no disponibles | Total de horas del requisito, incluidas las de sus tareas |
| 41 | desglose-horas-persona | list | — | content | desktop | hidden_in_states: horas cargando, horas no disponibles, sin horas cargadas | Una fila por persona con lo que imputó |
| 42 | vacio-horas-trabajadas | empty-state | — | feedback | desktop | visible_only_in_states: sin horas cargadas | Mensaje cuando el requisito no tiene horas |
| 43 | cargando-horas-trabajadas | loader | — | feedback | desktop | visible_only_in_states: horas cargando | Carga del card, independiente del resto de la pantalla |

**Origen:** `RequirementHeader.tsx:169`, `:~171`, `:173`, `:175-184`, `:186-194`, `:196-204`, `:207-209`, `:210-212`; `RequirementDetail.tsx:132-136`, `:140-145`, `:147-254`, `:159-180`, `:185-225`, `:229-250`, `:256-262`, `:267-334`, `:337-359`, `:343-357`, `:361-365`; `RequirementStatusCard.tsx:353-355`, `:324-345`, `:115-145`, `:376-382`, `:385-391`; `RequirementActivityFeed.tsx:118`; `RequirementActivityForm.tsx:59`, `:61-67`, `:82-103`, `:105-127`, `:128-148`; `RequirementResolutionCard.tsx:101-119`, `:120-131`, `:133-145`, `:155-158`, `:160-167`, `:168-175`

`card-estado`, `seccion-tareas`, `acordeon-campo`, `formulario-comentario` y `card-resolucion` se relevaron como `card` / `section`: son compuestos sin tipo propio en el diccionario. `stepper-workflow` se relevó como `progress-bar` por ser lo más cercano del diccionario: no es una barra, son 5 nodos con conectores y un símbolo por nodo (`✓`, `×` o el número). El chrome es compartido; los pills-dropdown están documentados aparte [fuente: código-existente].

## Layout por viewport

### desktop · 1440px

- encabezado-requisito
  - row `header` (`space-between`)
    - col izquierda: titulo-requisito, y debajo la fila de badges (codigo-requisito, pill-estado, pill-tipo, pill-prioridad)
    - col derecha: boton-volver, boton-editar
- row `dos-columnas`
  - col ~7/12 (`1fr`): columna izquierda
    - card-contexto
    - card-estado (stepper-workflow con paso-workflow × 5, 4 acordeon-campo, boton-guardar-campos, boton-transicion)
    - seccion-tareas (tabs-estado-tarea, tabla-tareas, paginacion-tareas)
    - card-actividad (feed-actividad —con marca-identidad-automatica junto al autor de cada entrada de una identidad de servicio—, formulario-comentario con editor-comentario, boton-adjuntar, progreso-subida-adjunto *(solo mientras sube)*, toggle-visibilidad, boton-enviar-comentario)
  - col ~5/12 (420px fijos): columna derecha
    - card-informacion-general (marca-identidad-automatica en la fila "Creado por", cuando el creador es una identidad de servicio)
    - card-etiquetas (chip-etiqueta × N)
    - card-resolucion (campo-tipo-resolucion, campo-conclusion, campo-nota-cliente, boton-cancelar-requisito, boton-resolver-requisito, badge-resultado)
    - card-horas-trabajadas (total-horas-trabajadas, desglose-horas-persona, vacio-horas-trabajadas *(sin horas)*, cargando-horas-trabajadas *(mientras carga)*) [REQ-010 RF-8]

**Origen:** `RequirementDetail.module.scss:3-7` — `.container { display: grid; grid-template-columns: 1fr 420px; gap: 1.25rem; align-items: start; }`.

**El card de horas va último en la columna derecha** [REQ-010 RF-8]. Las tres cards que ya están tienen un orden con sentido —contexto del requisito, sus etiquetas, su cierre— y el de horas es una lectura de consulta, no parte de ese recorrido: intercalarlo entre "Etiquetas" y "Resolución" partiría en dos la secuencia de identificación-y-cierre. Al final queda a la vista sin scroll en la mayoría de los requisitos y no compite con las acciones de resolución, que son las únicas de esa columna.

**Las fracciones son aproximadas:** la columna derecha es de 420px fijos. A 1440px de viewport (contenido ~1118px) es ~7.5/12 + ~4.5/12; a 1920px, ~9.2/12 + ~2.8/12 [fuente: código-existente].

**Comportamiento observado a ≤1023px** (fuera de los viewports declarados de la superficie): el encabezado se apila en columna (titulo-requisito, fila de badges, boton-volver + boton-editar) y el cuerpo pasa a columna única en el orden del DOM: card-contexto, card-estado, seccion-tareas, card-actividad, card-informacion-general, card-etiquetas, card-resolucion, card-horas-trabajadas. En una columna la resolución queda al final, después del feed de actividad y del formulario de comentario, y la información general después de las tareas. Los dos módulos llevan un comentario de código que explica el porqué —tablet unificado con mobile por "pedido explícito del usuario", y el apilado del header para que los botones de ancho fijo no corten el título— (`RequirementDetail.module.scss:9-14`, `RequirementHeader.module.scss:7-13`) [fuente: código-existente].

## Contenido

### encabezado-requisito
- Texto/label: sin texto propio — agrupa título, badges y acciones
- Icono: nada
- Asset: nada
- Annotation: `RequirementHeader.tsx:169`

### titulo-requisito
- Texto/label: dinámico desde `requirement.title`
- Icono: nada
- Asset: nada
- Annotation: `RequirementHeader.tsx:~171`

### codigo-requisito
- Texto/label: `` `#${id}` ``
- Icono: nada
- Asset: nada
- Annotation: `RequirementHeader.tsx:173`

### pill-estado
- Texto/label: el estado actual · opciones `"Análisis"` · `"Planificación"` · `"En cola"` · `"Desarrollo"` · `"Revisión"` · `"Resuelto"` · `"Cancelado"`
- Icono: nada
- Asset: nada
- Annotation: **el update es optimista** (`useUpdateRequirement.ts:36-43`), así que el valor cambia en pantalla antes de la confirmación de la api, con rollback ante error. **Regla de negocio:** para `type: 'incidencia'`, `"En cola"` se saca de las opciones salvo que el requisito ya esté ahí (`RequirementHeader.tsx:161-166`, `:175-184`, `:23-30`) [fuente: código-existente]

### pill-tipo
- Texto/label: el tipo actual · opciones `"Sin tipo"` · `"Funcionalidad"` · `"Mejora"` · `"Incidencia"` · `"Otro"`
- Icono: nada
- Asset: nada
- Annotation: `RequirementHeader.tsx:186-194`, `:43-47`

### pill-prioridad
- Texto/label: la prioridad actual · opciones `"Sin prioridad"` · `"Baja"` · `"Media"` · `"Alta"` · `"Urgente"`
- Icono: nada
- Asset: nada
- Annotation: `RequirementHeader.tsx:196-204`, `:51-55`

### boton-volver
- Texto/label: `"Volver"`
- Icono: nada
- Asset: nada
- Annotation: `RequirementHeader.tsx:208`

### boton-editar
- Texto/label: `"Editar"`
- Icono: nada
- Asset: nada
- Annotation: `RequirementHeader.tsx:211`

### card-contexto
- Texto/label: título `"Contexto"`; contenido dinámico desde `requirement.description` renderizado como markdown
- Icono: nada
- Asset: nada
- Annotation: `RequirementDetail.tsx:133`, `:135`

### card-estado
- Texto/label: título `` `Estado - ${STATE_LABELS[state]}` `` — p.ej. `"Estado - Desarrollo"`
- Icono: nada
- Asset: nada
- Annotation: `RequirementStatusCard.tsx:350`

### stepper-workflow
- Texto/label: sin texto propio — contiene los 5 nodos
- Icono: nada
- Asset: nada
- Annotation: `RequirementStatusCard.tsx:353-355`. **Flujo de trabajo** (`NEXT_WORK_STEP`, `:44-49`): `analisis → planificacion → en_cola → desarrollo → revision`. Para incidencias (`NEXT_WORK_STEP_INCIDENCIA`, `:55-58`): `analisis → planificacion → desarrollo → revision`, salteando `en_cola` [fuente: código-existente]

### paso-workflow
- Texto/label: pasos `"Análisis"` · `"Planificación"` · `"En cola"` · `"Desarrollo"` · `"Revisión"`, cada uno con su descripción verbatim:
  - `analisis`: `"Se entiende el requerimiento y se define el alcance."`
  - `planificacion`: `"Se define la propuesta y los criterios de aceptación."`
  - `en_cola`: `"Se prioriza el orden de trabajo entre los requisitos planificados."`
  - `desarrollo`: `"Se ejecuta la solución definida en Planificación."`
  - `revision`: `"Se valida la implementación con el cliente o responsable."`
  - `resuelto`: `"El requisito fue resuelto y no requiere más trabajo."`
- Icono: símbolo del nodo — `"✓"` si superado, `"×"` si superado-sin-actividad tras cancelar, o el número del paso
- Asset: nada
- Annotation: `RequirementStatusCard.tsx:24-29`, `:72-79`, `:339`, `:324-345`

### acordeon-campo
- Texto/label: cuatro campos con label y placeholder verbatim:
  - `scope` — label `"Alcance"`, placeholder `"Qué se acordó con el cliente / qué entendió el equipo, y cómo impacta..."`, markdown
  - `technicalSolution` — label `"Propuesta"`, placeholder `"Describí el enfoque técnico..."`, markdown
  - `acceptanceCriteria` — label `"Criterios de aceptación"`, placeholder `"¿Qué se espera que pase? ¿Cómo se determina el éxito?"`, markdown
  - `estimatedFinishDate` — label `"Cierre estimado"`, sin placeholder, tipo `date`
- Icono: indicador de completitud `"✓"` (con valor) / `"!"` (sin valor); chevron `"▾"`
- Asset: nada
- Annotation: **cuáles se abren por defecto depende del estado real del requisito** (`DEFAULT_OPEN_FIELDS_BY_STATE`, `:184-188`): `analisis` → `scope`; `planificacion` → `technicalSolution` + `acceptanceCriteria`; `en_cola` → `estimatedFinishDate`. En `desarrollo`, `revision` y los estados terminales no se abre ninguno. El editor arranca en modo `preview` si el campo ya tiene valor, y en `edit` si está vacío (`RequirementStatusCard.tsx:198-221`, `:118`, `:121`, `:141`, `:181-183`) [fuente: código-existente]

### boton-guardar-campos
- Texto/label: `"Guardar"`
- Icono: nada
- Asset: nada
- Annotation: `"Guardar"` **siempre** está disponible y persiste solo los campos cambiados sin transicionar (`RequirementStatusCard.tsx:381`, `:290-294`)

### boton-transicion
- Texto/label: `` `${getTransitionLabel(...)} →` `` — p.ej. `"Desarrollo →"`
- Icono: flecha (dentro del texto)
- Asset: nada
- Annotation: con siguiente paso disponible convive con `"Guardar"` y hace las dos cosas en una acción. En `Revisión`, `Resuelto` y `Cancelado` no hay destino, así que `"Guardar"` queda solo (`RequirementStatusCard.tsx:390`, `:290-294`) [fuente: código-existente]

### seccion-tareas
- Texto/label: título `"Tareas"`; botón de alta sin texto con `aria-label="Nueva tarea"`
- Icono: plus (en el botón de alta)
- Asset: nada
- Annotation: `RequirementDetail.tsx:149`, `:153`

### tabs-estado-tarea
- Texto/label: `"Backlog"` · `"Activo"` · `"En revisión"` · `"Finalizado"` · `"Cancelado"`, cada uno con contador
- Icono: nada
- Asset: nada
- Annotation: **tab por defecto: `activo`** (`RequirementDetail.tsx:23-27`, `:173`, `:81`)

### tabla-tareas
- Texto/label: columnas `"ID"` · `"Título"` · `"Responsable"` · `"Creación"` · `"Cierre estimado"`. Responsable vacío: `"-"` (guion corto)
- Icono: nada
- Asset: nada
- Annotation: formato de fecha `toLocaleDateString('es-AR', { day, month, year: '2-digit'/'numeric' })` (`RequirementDetail.tsx:188-192`, `:43`, `:39`). **Tercer valor para "sin responsable" en el producto:** acá `"-"` (guion corto), en `ProjectObjectivesSection` `"—"` (guion largo), en `RequirementList` `"Sin asignar"` [fuente: código-existente]

### paginacion-tareas
- Texto/label: controles de página con `aria-label="Paginación"` en el `<nav>`
- Icono: flechas de anterior/siguiente. Glifos `<` / `>` (antes `‹` / `›` de la reimplementación inline)
- Asset: nada
- Annotation: usa el componente compartido `Pagination` en modo controlado
  (`web/src/shared/components/ui/Pagination/Pagination.tsx`), con ventana deslizante de máximo 10
  números centrada en la página actual y sin elipsis — mismo componente que `tabla-tareas` de
  `listado-tareas` y `paginacion-requisitos` de `detalle-proyecto` (story S-039). Con 0 tareas en la
  tab activa, el paginador no se renderiza (antes dibujaba un `<nav>` con un botón "1" inerte)

### card-actividad
- Texto/label: título `"Actividad"`
- Icono: nada
- Asset: nada
- Annotation: `RequirementDetail.tsx:290`

### feed-actividad
- Texto/label: empty `"Sin actividad registrada"`; etiquetas de visibilidad `"Interno"` / `"Público"`
- Icono: nada
- Asset: nada
- Annotation: `RequirementActivityFeed.tsx:110`, `:177`, `:118`

### formulario-comentario
- Texto/label: sin texto propio — agrupa el editor, el adjuntar, el toggle y el enviar
- Icono: nada
- Asset: nada
- Annotation: `<form noValidate>` (`RequirementActivityForm.tsx:59`)

### editor-comentario
- Texto/label: placeholder `"Escribe un comentario..."` · `ariaLabel` `"Comentario"`
- Icono: nada
- Asset: nada
- Annotation: **el placeholder usa tuteo peninsular (`"Escribe"`)** mientras el resto del producto usa voseo rioplatense (`"Describí"`, `"Arrastrá"`, `"hacé"`). Copiado verbatim (`RequirementActivityForm.tsx:64`, `:65`) [fuente: código-existente]

### boton-adjuntar
- Texto/label: sin texto visible · `aria-label="Adjuntar archivo"`
- Icono: clip (SVG con `aria-hidden="true"`)
- Asset: nada
- Annotation: `RequirementActivityForm.tsx:82-103`, `:85`, `:98`. **Con REQ-001** el tipo y el tamaño los valida el servidor y son configurables en caliente (RF-6, RF-15), así que el rechazo llega después de intentar subir: `"El archivo supera el tamaño máximo permitido"` o `"Ese tipo de archivo no está permitido"`. La subida es de a un archivo por vez (RF-7)

### progreso-subida-adjunto
- Texto/label: `"Subiendo {nombre del archivo}... {progress}%"`
- Icono: nada
- Asset: nada
- Annotation: **bloque nuevo con REQ-001** (RF-8). El byte va del navegador directo al storage, así que el porcentaje es el de la transferencia real. Antes esta pantalla no daba ningún feedback de subida: el adjunto aparecía o no aparecía

### toggle-visibilidad
- Texto/label: sin texto visible · `aria-label="Comentario interno"` y `"Comentario público"`
- Icono: nada
- Asset: nada
- Annotation: dos `<button aria-pressed>`; default `internal` (`RequirementActivityForm.tsx:105-127`, `:112`, `:122`, `:19`)

### boton-enviar-comentario
- Texto/label: sin texto visible · `aria-label="Enviar comentario"`
- Icono: avión (SVG con `aria-hidden="true"`)
- Asset: nada
- Annotation: deshabilitado si el editor está vacío (`RequirementActivityForm.tsx:128-148`, `:131`, `:144`). Toast de éxito `"Comentario agregado"` (`:45`); toast de error `error.message` o `"Error al agregar el comentario"` (`:50`)

### card-informacion-general
- Texto/label: título `"Información General"`; filas (`<dt>`) `"Proyecto"` · `"Responsable (líder)"` · `"Responsable(s)"` · `"Visibilidad"` · `"Creado por"` · `"Fecha de creación"` · `"Última actualización"`. Visibilidad: `"Público"` / `"Interno"`
- Icono: nada
- Asset: nada
- Annotation: `RequirementDetail.tsx:302`, `:306-364`, `:349`

### card-etiquetas
- Texto/label: título `"Etiquetas"`; empty `"Sin etiquetas registradas"`
- Icono: nada
- Asset: nada
- Annotation: `RequirementDetail.tsx:371`, `:374`

### chip-etiqueta
- Texto/label: dinámico — `{tag.key}:{tag.value}`; botón de borrar con `aria-label={`Eliminar etiqueta ${tag.key}:${tag.value}`}`
- Icono: cruz (en el botón de borrar)
- Asset: nada
- Annotation: `RequirementDetail.tsx:376-390`, `:383`

### card-resolucion
- Texto/label: título `"Resolución"`; fila `"Cierre estimado"` cuando está abierto; fila `"Fecha de finalización"` cuando está resuelto
- Icono: nada
- Asset: nada
- Annotation: `RequirementResolutionCard.tsx:90`, `:94`, `:151`

### campo-tipo-resolucion
- Texto/label: `"Tipo de resolución"` · opción vacía `"Seleccioná una opción"`
- Icono: nada
- Asset: nada
- Annotation: `<select id="resolution-type">` nativo, solo para `type: 'incidencia'` (`RequirementResolutionCard.tsx:102-104`, `:112`, `:58`, `:101-119`)

### campo-conclusion
- Texto/label: `"Conclusión interna"` · placeholder `"Describí la conclusión interna de esta incidencia..."`
- Icono: nada
- Asset: nada
- Annotation: `<textarea id="resolution-conclusion">`, solo para incidencias (`RequirementResolutionCard.tsx:127`, `:120-131`)

### campo-nota-cliente
- Texto/label: `"Nota para cliente"` · placeholder `"Describí la resolución de esta incidencia..."`
- Icono: nada
- Asset: nada
- Annotation: `<textarea id="resolution-comment">`, solo para incidencias (`RequirementResolutionCard.tsx:140`, `:133-145`)

### boton-cancelar-requisito
- Texto/label: `"Cancelar"`
- Icono: nada
- Asset: nada
- Annotation: **acá `"Cancelar"` cancela el requisito, no la acción.** Está al lado de `"Resolver"` y ambos son transiciones de estado terminales; en el resto del producto `"Cancelar"` significa descartar (`RequirementResolutionCard.tsx:166`, `:160-167`) [fuente: código-existente]

### boton-resolver-requisito
- Texto/label: `"Resolver"`
- Icono: nada
- Asset: nada
- Annotation: `RequirementResolutionCard.tsx:174`, `:168-175`

### badge-resultado
- Texto/label: `"Resuelto"` / `"Cancelado"`
- Icono: nada
- Asset: nada
- Annotation: `RequirementResolutionCard.tsx:28-30`, `:155-158`

### marca-identidad-automatica
- Texto/label: `"Automático"` · nombre accesible `"Identidad automática: no es una persona"`
- Icono: nada
- Asset: nada
- Annotation: **nuevo con REQ-005.** Acompaña al nombre del autor —no lo reemplaza— en los dos lugares de esta pantalla donde se muestra autoría: la fila `"Creado por"` de `card-informacion-general` y el autor de cada entrada de `feed-actividad`. Se renderiza **solo cuando esa identidad es de tipo servicio**; para una persona no hay bloque, no hay espacio reservado y no hay marca de "es una persona" (REQ-005 RF-3, RF-10). Es la primera vez que la interfaz representa un autor que no es alguien del equipo ni el cliente: desde REQ-005 un conector externo tiene fila en `users` y puede figurar como `created_by` de un requisito y como autor de una actividad (REQ-005 "Impacto en UX" pregunta 1)


### card-horas-trabajadas
- Texto/label: título `"Horas Trabajadas"`
- Icono: nada
- Asset: nada
- Annotation: card de la columna derecha, **última**, después de `"Resolución"`. Se carga por su cuenta, con una consulta propia y no con el payload del requisito: **si falla o tarda, el resto del detalle se renderiza igual** [REQ-010 RF-8, Escenario B]

### total-horas-trabajadas
- Texto/label: el total formateado como `Xh Ym` — `"5h 0m"` para 300 minutos
- Icono: nada
- Asset: nada
- Annotation: suma las horas imputadas directamente al requisito **más** las de sus tareas, sin doble conteo. Es el mismo número que muestra la columna `"Hs. Trab."` del listado, y siempre es igual a la suma del desglose de abajo [REQ-010 RF-3, AC-6, AC-10]

### desglose-horas-persona
- Texto/label: una fila por persona — `"{Nombre} {Apellido}"` a la izquierda y sus horas formateadas `Xh Ym` a la derecha. Ejemplo: `"Ana García"` · `"3h 0m"` / `"Beto Ruiz"` · `"2h 0m"`
- Icono: nada
- Asset: nada
- Annotation: **de mayor a menor**, la persona que más cargó primero [REQ-010 RF-1, AC-10]. Cada persona aparece **una sola vez**, con lo que imputó al requisito y a sus tareas ya sumado: no se separan las dos fuentes [REQ-010 RF-2, AC-2]. **Es un desglose histórico:** quien cargó horas aparece siempre, incluso si ya no está en el equipo o está deshabilitado — es lo que hace que la suma dé el total [REQ-010 RF-3, AC-4, AC-18]

### vacio-horas-trabajadas
- Texto/label: `"Sin horas cargadas"`
- Icono: nada
- Asset: nada
- Annotation: reemplaza al total y al desglose cuando el requisito no tiene ninguna hora imputada. **La card sigue estando**, no desaparece: que no haya horas es en sí un dato de gestión [REQ-010 RF-8, AC-11]

### cargando-horas-trabajadas
- Texto/label: `"Cargando horas..."`
- Icono: nada
- Asset: imagen del componente `<Loader>`
- Annotation: ocupa el cuerpo de la card mientras la consulta está en vuelo. Es el único loader de la pantalla que no depende de una mutación: la card se carga sola, después del primer render del detalle [REQ-010 Escenario B]

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Disparado por el requisito resuelto, que viene del servidor como `initialRequirement` y se refresca con `useRequirement` (`RequirementDetailContainer.tsx:19`, `RequirementDetail.tsx:126-400`) [fuente: código-existente]
  - marca-identidad-automatica: presente o ausente **según el dato, no según el estado** — aparece junto a cada autor cuyo `identityType` es `service` (REQ-005 RF-3). Un requisito creado por una persona y comentado solo por personas no la muestra nunca; el mismo requisito con una actividad del conector externo la muestra en esa entrada y no en las otras

### empty
- Aplica: Sí (por sección; no hay empty global)
- Mensajes: `"Sin actividad registrada"` · `"Sin etiquetas registradas"` · `"Sin horas cargadas"` · el empty de la tabla de tareas
- Cambios:
  - feed-actividad: se reemplaza por el mensaje (`RequirementActivityFeed.tsx:110`)
  - card-etiquetas: chip-etiqueta ausente, se muestra el mensaje (`RequirementDetail.tsx:374`)
  - tabla-tareas: el cuerpo se reemplaza por el mensaje (`RequirementDetail.tsx:196-200`)
  [fuente: código-existente]
  - card-horas-trabajadas: ver el sub-estado **sin horas cargadas** más abajo. Es el cuarto empty por sección de esta pantalla, y sigue la misma regla que los otros tres: la card se queda, cambia su cuerpo [REQ-010 AC-11]

### loading
- Aplica: Sí (solo durante las mutaciones)
- Mensaje: ninguno
- Cambios:
  - pill-estado, pill-tipo, pill-prioridad, boton-guardar-campos, boton-transicion, boton-cancelar-requisito, boton-resolver-requisito: variant=disabled (state_override). **Ninguno muestra spinner**, porque no usan `<Button loading>` sino `<button>` nativos
  - El valor de la pill ya cambió por el update optimista
- Disparado por `isPending` de `useUpdateRequirement`, propagado a `RequirementHeader`, `RequirementStatusCard` y `RequirementResolutionCard` (`RequirementDetail.tsx:79`, `RequirementStatusCard.tsx:376-391`, `RequirementResolutionCard.tsx:160-175`) [fuente: código-existente]
- **No hay loading inicial:** el Server Component espera el dato antes de renderizar y no hay `loading.tsx` en la ruta, así que la navegación se siente como una espera sin feedback [fuente: código-existente]

### subiendo adjunto (parent_state: default)
- Aplica: Sí — **estado nuevo con REQ-001** (RF-8)
- Mensaje: `"Subiendo {nombre del archivo}... {progress}%"`
- Cambios:
  - progreso-subida-adjunto: solo visible en este estado (visible_only_in_states)
  - boton-adjuntar: variant=disabled mientras hay una subida en curso (de a uno, RF-7)
  - boton-enviar-comentario: variant=disabled — enviar mientras el byte viaja vincularía un archivo incompleto, y el sistema no verifica que haya llegado (D-13)
- **Por qué es nuevo:** hasta ahora la subida no tenía ninguna representación en esta pantalla. El byte pasaba por la api y el usuario esperaba sin saber cuánto faltaba

### sin horas cargadas (parent_state: default)
- Aplica: Sí — **estado nuevo con REQ-010** (RF-8)
- Mensaje: `"Sin horas cargadas"`
- Cambios:
  - vacio-horas-trabajadas: solo visible en este estado (visible_only_in_states)
  - total-horas-trabajadas y desglose-horas-persona: ausentes — no se muestra `"0h 0m"` ni una lista vacía
  - card-horas-trabajadas: presente, con su título. La card **no desaparece**
- Disparado por un requisito sin ninguna hora imputada, ni directa ni en sus tareas: la respuesta trae el total en cero y el desglose vacío [REQ-010 RF-8, AC-3, AC-11]

### horas cargando (parent_state: default)
- Aplica: Sí — **estado nuevo con REQ-010** (Escenario B)
- Mensaje: `"Cargando horas..."`
- Cambios:
  - cargando-horas-trabajadas: solo visible en este estado (visible_only_in_states)
  - total-horas-trabajadas, desglose-horas-persona y vacio-horas-trabajadas: ausentes
  - **El resto de la pantalla se renderiza completo y es operable**: el header, el workflow, las tareas y el feed no esperan a las horas
- **Es el primer loading de esta pantalla que no viene de una mutación.** Los demás loaders del detalle aparecen porque el usuario hizo algo (guardar, transicionar, comentar); este aparece solo, en el primer render, porque la card tiene su propia consulta [REQ-010 Escenario B]

### horas no disponibles (parent_state: default)
- Aplica: Sí — **estado nuevo con REQ-010** (Escenario B)
- Mensaje: `"No se pudieron cargar las horas"`
- Cambios:
  - card-horas-trabajadas: presente, con el mensaje en el cuerpo en lugar del total y el desglose
  - total-horas-trabajadas, desglose-horas-persona, vacio-horas-trabajadas: ausentes
  - **El resto del detalle no se ve afectado.** Ninguna otra sección cambia y ninguna acción se bloquea
- **Por qué existe como estado propio y no como toast:** es la contrapartida de que la card tenga su propia consulta. Sin este estado la falla se vería como `"Sin horas cargadas"` —un requisito con horas parecería no tenerlas—, que es el modo de falla peor: silencioso y con un dato falso en pantalla. Distinguir "no hay horas" de "no pude traerlas" es la razón de que el estado esté declarado [REQ-010 RF-8, AC-11]

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). No hay validación en esta pantalla: los campos del acordeón y de resolución se guardan sin reglas, `"Guardar"` persiste lo que haya, y la transición no exige que el campo del paso esté completo. El `"!"` del acordeón es informativo, no bloqueante (`RequirementStatusCard.tsx:302-307`). La única regla es que el comentario no puede estar vacío, y se expresa deshabilitando el botón sin mensaje (`RequirementActivityForm.tsx:24`, `:131`) [fuente: código-existente].

### error de sistema / sin conexión
- Aplica: Sí (solo como toast de las acciones)
- Mensajes: `error.message` o `"Error al actualizar el requisito"` (actualización); `error.message` o `"Error al agregar el comentario"` (comentario); **con REQ-001** `"No podés adjuntar un archivo que subió otra persona"` cuando el vínculo se rechaza por titularidad (RF-12, CA-10) y `"El archivo no está disponible"` al abrir un adjunto cuyo contenido nunca llegó (RF-21, CA-15)
- Cambios: ninguno en la pantalla; el toast aparece en el contenedor del shell (`RequirementDetail.tsx:108`, `RequirementActivityForm.tsx:50`) [fuente: código-existente]
- **El error al refrescar el requisito no se maneja:** `RequirementDetailContainer` hace `requirement ?? initialRequirement`, así que si el refetch falla **se sigue mostrando el dato del render inicial sin ningún aviso** — la pantalla se ve normal con datos potencialmente viejos (`RequirementDetailContainer.tsx:19`). El error al cargar las tareas vinculadas tampoco: `linkedObjectives` viene en el mismo payload del requisito y, si falta, la tabla queda vacía sin distinguir de "no hay tareas" (`RequirementDetail.tsx:33`) [fuente: código-existente]
- **REQ-004: la falla del bus se parte en dos y la recuperación no es la misma.** La api separa `503 service_unavailable` (`"El servicio no está disponible en este momento"`) de `504 gateway_timeout` (`"La operación tardó demasiado"`) (RF-16, CA-8, CA-9). Los dos salen por los toasts que ya existen: **la pantalla no se modifica**. Aplica a las tres escrituras de la pantalla —avanzar el workflow, editar la clasificación inline y comentar—: con el 503 nada ocurrió; con el 504 **pudo haber ocurrido**, y acá el reintento a ciegas es especialmente caro porque el cambio de estado y el comentario son **actividad del feed**: se duplican a la vista, y si son públicos **el cliente los ve duplicados en Opus**. Agrava el problema que ya está anotado abajo: si el refetch del requisito falla, la pantalla sigue mostrando el dato viejo sin avisar, así que el usuario no puede verificar si el cambio entró [REQ-004]

### success
- Aplica: Sí
- Mensaje: toast `"Comentario agregado"`
- Cambios: el feed de actividad se refresca; el toast aparece en el contenedor del shell (`RequirementActivityForm.tsx:45`) [fuente: código-existente]

### not found
- Aplica: Sí (parcialmente)
- Mensaje: el 404 por defecto de Next para un id no numérico; para un id numérico inexistente, la pantalla de error por defecto de Next
- Cambios:
  - **Id no numérico: sí se maneja** con `if (isNaN(id)) notFound()` (`requirements/[reqid]/page.tsx:15`)
  - **Id numérico inexistente: no se maneja.** `getRequirementById` en el Server Component está **sin try/catch**; un id que no existe lanza y **no hay `error.tsx` en la ruta**, así que cae en la pantalla de error por defecto de Next, sin sidebar (`requirements/[reqid]/page.tsx:17`) [fuente: código-existente]

### estado terminal / readonly
- Aplica: Sí
- Mensajes: `"Fecha de finalización"` (resuelto) · badge `"Resuelto"` / `"Cancelado"`
- Cambios:
  - **Resuelto** (`state === 'resuelto'`): card-resolucion muestra `"Fecha de finalización"` en vez de los botones; campo-tipo-resolucion, campo-conclusion y campo-nota-cliente quedan `disabled` (`isClosed`); boton-cancelar-requisito y boton-resolver-requisito ocultos (hidden_in_states) (`RequirementResolutionCard.tsx:55`, `:150-153`)
  - **Cancelado** (`state === 'cancelado'`): badge-resultado `"Cancelado"` en vez de los botones; campos deshabilitados; el stepper marca los pasos no recorridos con `"×"` (`RequirementResolutionCard.tsx:56`, `:154-158`)
  [fuente: código-existente]
- **El readonly no alcanza al resto de la pantalla:** las pills de estado, tipo y prioridad, el acordeón y las acciones de tarea siguen disponibles.

### estados del stepper (parent_state: default)
- Aplica: Sí
- Mensaje: el símbolo del nodo
- Cambios por nodo:
  - actual: el número del paso, disparado por `state === step.value` (`RequirementStatusCard.tsx:313`, `:339`)
  - superado: `"✓"`, disparado por `stepIdx < currentIdx` o requisito en estado terminal (`:317`)
  - superado sin actividad tras cancelar: `"×"`, disparado por `state === 'cancelado'` y sin actividad registrada en ese paso (`:320-321`, `:339`)
  - pendiente: el número del paso (`:339`)
  [fuente: código-existente]

### acordeón abierto / cerrado, campo completo / faltante (parent_state: default)
- Aplica: Sí
- Mensaje: `"✓"` (met) / `"!"` (missing)
- Cambios:
  - acordeon-campo: `met` = el campo tiene valor; `open` = por defecto según el estado, o toggle manual (`RequirementStatusCard.tsx:115-145`, `:118`, `:184-195`)
  [fuente: código-existente]

### confirmación al resolver, cancelar o borrar etiqueta
- Aplica: No — no implementado (ver gaps-as-is.md). `"Resolver"` y `"Cancelar"` disparan la transición terminal **directo, sin `ConfirmDialog`**, siendo las dos acciones menos reversibles de la pantalla (`RequirementResolutionCard.tsx:81`, `:85`). El chip de etiqueta se borra al click, también sin confirmar (`RequirementDetail.tsx:380-388`) [fuente: código-existente].

## Interacciones

**Eventos:**
- pill-estado / pill-tipo / pill-prioridad · seleccionar opción → `onUpdate({campo: valor})` con update optimista · `RequirementHeader.tsx:~183`, `useUpdateRequirement.ts:36-43`
- acordeon-campo · on click en el encabezado → toggle `open` · `RequirementStatusCard.tsx:116`
- acordeon-campo · on change → `handleDraftChange(field, value)` en estado local · `RequirementStatusCard.tsx:300-302`
- boton-guardar-campos · on click → `handleSaveFields()`: arma el payload solo con los campos cambiados y **retorna sin hacer nada si no hay ninguno** · `RequirementStatusCard.tsx:304-308`
- boton-transicion · on click → `handleTransition()`: manda los campos cambiados **más** el nuevo estado en una sola mutación · `RequirementStatusCard.tsx:295-298`
- tabs-estado-tarea · on click → cambia `activeObjTab` local · `RequirementDetail.tsx:~166`
- fila de tabla-tareas · on click → navega a `/objectives/{id}` · `RequirementDetail.tsx:~206`
- chip-etiqueta · on click en la cruz → borra del estado local `localTags` y manda la mutación · `RequirementDetail.tsx:380-388`
- editor-comentario · on change → `setIsEmpty(value.trim().length === 0)` · `RequirementActivityForm.tsx:23-25`
- toggle-visibilidad · on click → `setVisibility('internal' | 'public')` · `RequirementActivityForm.tsx:110`, `:120`
- boton-enviar-comentario · on submit → `addActivity`; deshabilitado si el editor está vacío · `RequirementActivityForm.tsx:131`
- boton-resolver-requisito · on click → `onUpdate({ state: 'resuelto' })` · `RequirementResolutionCard.tsx:81`
- boton-cancelar-requisito · on click → `onUpdate({ state: 'cancelado' })` · `RequirementResolutionCard.tsx:85`
- card-horas-trabajadas · **sin eventos de usuario**: es una card de lectura. Ni el total ni las filas del desglose son clickeables — no llevan a un reporte, a la persona ni a las horas de una tarea [REQ-010 RF-8]

[fuente: código-existente]

**Validaciones:**
- editor-comentario · no vacío tras `trim()` → boton-enviar-comentario queda `disabled`, sin mensaje · `RequirementActivityForm.tsx:24`, `:131`
- **Ninguna otra.** No hay reglas sobre los campos del workflow ni sobre los de resolución [fuente: código-existente].

**Feedback:**
- Update optimista: el valor de la pill cambia de inmediato
- La card de horas tiene **su propio ciclo de carga y su propio error**, separados de los del requisito: se revalida sola y una falla suya no toca al resto de la pantalla [REQ-010 Escenario B]
- Contador por tab de tarea
- `"✓"` / `"!"` por campo del acordeón
- Toasts de éxito y error
- Botones deshabilitados durante la mutación

## Accesibilidad

- **Orden de foco:** pill-estado → pill-tipo → pill-prioridad → boton-volver → boton-editar → acordeon-campo × 4 (encabezado y editor) → boton-guardar-campos → boton-transicion → tabs-estado-tarea → filas de tabla-tareas (**no enfocables**, ver abajo) → paginacion-tareas → editor-comentario → boton-adjuntar → toggle-visibilidad → boton-enviar-comentario → botón de borrar de cada chip-etiqueta → campo-tipo-resolucion → campo-conclusion → campo-nota-cliente → boton-cancelar-requisito → boton-resolver-requisito. **`card-horas-trabajadas` no agrega paradas al orden de foco**: es de solo lectura y no tiene controles [REQ-010 RF-8]. **Las filas de tabla-tareas son `<tr onClick>` sin `role`, sin `tabIndex` y sin handler de teclado**, así que quedan fuera del orden de foco pese a ser la vía a cada tarea (`RequirementDetail.tsx:~206`) [fuente: código-existente].
- **Landmarks y jerarquía:** hay un solo `<h1>` (titulo-requisito). **Los títulos de card no son encabezados:** son `<div className={styles.cardTitle}>` / `<span className={styles.cardTitle}>`, así que en una pantalla con 8 secciones la jerarquía tiene un solo nivel y **no se puede navegar por secciones** (`RequirementHeader.tsx:~171` vs `RequirementDetail.tsx:133`, `:149`, `:290`, `:302`, `:371`) [fuente: código-existente].
- **Foco y teclado:** los overlays de esta pantalla son los tres `PillDropdown` del encabezado. Tienen el juego completo de ARIA (`aria-haspopup="listbox"`, `aria-expanded`, `role="listbox"`, `role="option"`, `aria-selected`, `aria-disabled`) y **cierran por click afuera**, pero **no cierran con `Escape` y no soportan navegación por flechas** pese al `role="listbox"` (`RequirementHeader.tsx:99-145`, `:88-93`). Los acordeones **tampoco cierran con `Escape`** (`RequirementStatusCard.tsx:116`) [fuente: código-existente].
- **Propio de esta composición:**
  - **El motivo de una opción deshabilitada solo llega por `Tooltip`, que es solo `:hover` y sin `aria-describedby`:** un usuario de teclado o de lector de pantalla ve la opción deshabilitada sin explicación, y esa información no está en ningún otro lado (`RequirementHeader.tsx:136-138`, `Tooltip.module.scss:37`).
  - **Las tabs de tarea no se anuncian como tabs:** son un `<div className={styles.tabs}>` con `<button>`, **sin `role="tablist"`/`role="tab"` y sin `<nav aria-label>`** — peor que las tabs de `detalle-proyecto`, que al menos tienen `<nav aria-label>` (`RequirementDetail.tsx:159-180`). El cambio de tab tampoco se anuncia: sin `aria-live`.
  - **El update optimista no se anuncia:** el valor de la pill cambia sin aviso (`RequirementHeader.tsx:99-111`).
  - **El indicador `✓`/`!` del campo del acordeón no tiene texto alternativo:** un lector lee `"! Alcance"` sin saber que significa "falta completar" (`RequirementStatusCard.tsx:118`). El acordeón tiene `aria-expanded` pero **le falta `aria-controls`** (`:116`).
  - **El símbolo `×` del stepper no tiene texto que lo explique**, aunque se lee como carácter (`RequirementStatusCard.tsx:339`); el nodo actual sí lleva `aria-current="step"` (`:328`).
  - **`boton-enviar-comentario` está `disabled` sin explicación:** no hay `aria-describedby` que diga que hace falta escribir un comentario (`RequirementActivityForm.tsx:131`).
  - **La marca de identidad automática no puede quedar solo en el color ni solo en un `title`.** Es un `badge` con texto visible (`"Automático"`) y nombre accesible propio; **se descartó resolverla con un `Tooltip` de `:hover`**, que es el patrón que esta pantalla ya usa para el motivo de una opción deshabilitada y que este mismo documento registra como inalcanzable por teclado y sin `aria-describedby` (REQ-005).
  - **El título `"Horas Trabajadas"` hereda el problema de jerarquía de las demás cards:** como los otros siete títulos de sección, no es un encabezado sino un `div`, así que la card nueva **no** agrega un punto de navegación por secciones. La carencia es de la pantalla entera y este requerimiento no la cierra, pero la card la agrava en un grado: son ocho secciones sin jerarquía en vez de siete [REQ-010 RF-8].
  - **Ni la carga ni el resultado de las horas se anuncian:** el card pasa de `"Cargando horas..."` a mostrar el total sin región `aria-live`, así que quien usa lector de pantalla y ya recorrió la columna derecha no se entera de que el contenido llegó. Es un gap que el estado de carga propio introduce —los demás loaders de la pantalla siguen a una acción del usuario, que sabe que algo está pasando— y queda registrado sin cerrarse acá [REQ-010 Escenario B].
  - Bien resueltos: la paginación de tareas es `<nav aria-label="Paginación">` con `aria-current="page"` (`RequirementDetail.tsx:227`, `:254`); todos los botones de icono llevan `aria-label`; el toggle de visibilidad lleva `aria-pressed`; los tres campos de resolución tienen `<label htmlFor>` correctamente asociados (`RequirementResolutionCard.tsx:102-145`); y el error de subida en el comentario lleva `role="alert"` (`RequirementActivityForm.tsx:76`).
  [fuente: código-existente]

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-001 — Rediseño de archivos y adjuntos (2026-08-19)

- **La subida gana representación visible donde antes no tenía ninguna.** El progreso real es lo único que el rediseño le aporta al usuario de esta pantalla (RF-8), y sin un bloque propio se perdería: el botón de adjuntar no tiene estado de carga.

### REQ-004 — El bus en dos servicios micro (2026-08-23)

- **Se documenta en el estado de error, no en un bloque nuevo.** `web` no se modifica (RF-16) y los dos mensajes viajan en el cuerpo del error. Lo que cambia es la recuperación, y la recuperación es información de estado.
- **Es la pantalla donde el 504 y un gap previo se multiplican.** El `requirement ?? initialRequirement` hace que un refetch fallido muestre datos viejos sin avisar. Con una sola falla genérica eso era molesto; con el 504 —"pudo haber ocurrido"— es lo que le saca al usuario **la única forma de verificar** si su cambio entró. Queda anotado: no se corrige acá porque es código de `web`.
- **La edición inline de clasificación (O-04) no recibe tratamiento propio.** Cambiar estado, tipo o prioridad es idempotente: reintentar el mismo valor no crea nada. El desdoblamiento no cambia la acción del usuario ahí, así que no se documenta por separado.

- **Enviar el comentario queda deshabilitado mientras un archivo sube.** El sistema no verifica que el byte llegue (D-13), así que enviar antes de tiempo produciría un comentario con un adjunto vacío y sin síntoma hasta que alguien lo abra. Se descartó encolar el envío por eso.
- **`file_not_available` se comunica al abrir, no al listar.** El adjunto embebido en el markdown se sigue mostrando; el mensaje aparece cuando el usuario intenta verlo (RF-21, CA-15). Se descartó marcar los adjuntos rotos en el feed: exigiría verificar cada uno al renderizar, y el propio REQ registra que cada lectura cuesta un comando por el bus.
- **El error de titularidad se dice en lenguaje de personas.** *"No podés adjuntar un archivo que subió otra persona"* en lugar de nombrar propiedad de archivos, un concepto que la interfaz nunca expuso.
- **No se agregó componente al Design System.** `progress-bar` no tiene spec en `web` v0.1.0 — el catálogo es un scaffold de tres componentes. Gap anotado en la `## Revisión UX` de REQ-001.

### REQ-005 — Sincronización de usuarios y roles desde el bus (2026-08-24)

- **Un autor que no es una persona se marca, no se oculta.** Desde REQ-005 toda identidad que se autentica en el bus —incluidos los service users— tiene fila en `users`, así que el conector externo puede aparecer como `created_by` de un requisito y como autor de una actividad. Se descartó **filtrarlo**: es el comportamiento que REQ-001 buscó a propósito (*"el publicador externo es el autor"*), y esconderlo dejaría el requisito sin autor visible. Se descartó también **no hacer nada**: el usuario leería el `name` de un service user creyendo que es alguien del equipo. La respuesta es un `badge` de texto al lado del nombre.
- **`"Automático"`, no `"Servicio"` ni `"Integración"`.** `"Servicio"` nombra el `identityType` de la base, un concepto que la interfaz nunca expuso. `"Integración"` está peor: REQ-003 dio de baja la integración con sistemas externos **como capacidad**, y reintroducir la palabra en la UI sugeriría que volvió. `"Automático"` describe lo único que el lector necesita saber: eso no lo escribió una persona.
- **La marca acompaña al nombre y no lo reemplaza.** El `name` del service user sigue siendo el dato más útil para saber **qué** lo creó (`Conector`, `Portal`, el nombre que traiga el token); la marca solo dice **qué clase** de autor es.
- **No se marca a las personas.** Se descartó un par simétrico (`"Persona"` / `"Automático"`): el caso normal no necesita etiqueta y etiquetarlo sumaría ruido a cada entrada del feed, que es el bloque de mayor densidad de la pantalla.
- **No se agregó componente al Design System.** `badge` no tiene spec en `web` v0.1.0 —el catálogo sigue siendo el scaffold de tres componentes— pero **es un tipo que esta pantalla ya usa** en `codigo-requisito` y `badge-resultado`: el gap es previo y la marca no suma un compromiso nuevo. Anotado en la `## Revisión UX` de REQ-005.
- **Pregunta abierta:** el `name` de un service user lo define su plantilla del auth-callout y hoy nadie lo revisa como microcopy. Si llega vacío o con un identificador técnico, esta pantalla lo muestra tal cual. Queda anotado; el fallback (`"—"` o un genérico) no se decide acá porque el dato es de despliegue.

### REQ-010 — Horas cargadas por requisito (2026-09-01)

- **El desglose vive en el detalle y el total en el listado, no al revés.** Son dos preguntas distintas: el listado responde "cuánto costó cada uno" de un vistazo sobre muchos requisitos, y el detalle responde "quién lo trabajó" sobre uno solo. **Descartado** llevar el desglose al listado —no hay lugar en una tabla de nueve columnas y obligaría a un tooltip o un overlay por fila— y **descartado** dejar el total solo en el detalle, que es exactamente lo que el requerimiento viene a resolver: no tener que abrir cada requisito para saber cuántas horas lleva [REQ-010 C.1, C.3].
- **La card se carga sola, con su propia consulta, y no cuelga del payload del requisito.** Es la decisión de UX más consecuente del cambio: si el desglose viajara con el requisito, se recargaría en cada edición inline del header —que son muchas— y una falla suya rompería el detalle entero. Con consulta propia, el peor caso es una card que muestra su error mientras el resto de la pantalla funciona [REQ-010 Escenario B].
- **`"No se pudieron cargar las horas"` es un estado declarado y no un toast.** Sin él, un fallo se vería como `"Sin horas cargadas"`: un requisito con horas mostrando que no las tiene. Es el modo de falla que más había que evitar, porque es silencioso y el dato falso es plausible [REQ-010 AC-11].
- **La card se queda cuando no hay horas, con `"Sin horas cargadas"`.** **Descartado** ocultarla: que un requisito en desarrollo no tenga horas imputadas es en sí un dato de gestión, y una card que aparece y desaparece obliga a recordar si estaba [REQ-010 RF-8, AC-11].
- **El total se muestra además del desglose, aunque sea la suma de lo que está debajo.** La redundancia es deliberada: la pregunta más frecuente es "cuánto lleva", y obligar a sumar mentalmente cinco filas para responderla sería peor que repetir un número [REQ-010 RF-8, AC-10].
- **Una fila por persona, con las dos fuentes ya sumadas.** Que las horas se hayan imputado al requisito o a una de sus tareas es una distinción del modelo de datos, no de quien lee: la pregunta es cuánto puso cada uno. **Descartado** separar "directas" y "de tareas", que duplicaría filas de la misma persona y rompería la lectura de mayor a menor [REQ-010 RF-2, AC-2].
- **El desglose es histórico y no filtra a nadie.** Quien cargó horas aparece siempre, aunque esté deshabilitado, tenga fecha de baja o no tenga usuario. Es a la vez una decisión de producto —el trabajo hecho no se borra cuando alguien se va— y la única forma de que la suma del desglose dé el total [REQ-010 RF-3, AC-4, AC-18].
- **La card va última en la columna derecha.** Contexto, etiquetas y resolución forman una secuencia de identificación y cierre; el dato de horas es de consulta y no pertenece a esa secuencia. Al final no compite con los botones de resolver y cancelar, que son las únicas acciones de esa columna [REQ-010 RF-8].
- **Nada de esto llega a `opus-web`.** Las horas son dato interno: el PRD es explícito en que mostrarle al cliente el tablero con horas y costos no es opción. El portal no tiene ni la card ni la columna, y el recorte no depende de un condicional de UI sino de que sus rutas son otras [REQ-010 RF-9, AC-16].
- **[Auto] Design System — sin componentes nuevos.** Los cinco bloques usan tipos que la pantalla ya tiene: `card` (como las otras cuatro cards), `heading`, `list` (como `feed-actividad`), `empty-state` (como los tres empties por sección) y `loader`. Ningún tipo de bloque nuevo entra en la pantalla, y `loader` además está cubierto por el spec `Loader` del DS de `web`. Los tipos `card`, `list`, `heading` y `empty-state` no tienen spec en el catálogo (v0.1.0: Button, Loader, InputSelect), pero es una carencia preexistente y transversal —las cuatro cards actuales de esta misma pantalla ya la tienen— y no un gap que este requerimiento abra. Reponer el catálogo corresponde a `/product-design-system-update`.
