---
name: carga-horas
surface: web
route: /worked-times
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Carga de horas

## Identidad

- **Audiencia primaria:** equipo-interno. Un `admin` puede además cargar en nombre de otra persona [fuente: código-existente].
- **JTBD / Propósito:** registrar las horas trabajadas o la ausencia de un día, contra un proyecto, requisito o tarea, y ver lo ya cargado en ese día [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport de la superficie. El selector de día son 8 botones en fila y los botones de tiempo son dos filas más un input, sin reflow declarado a ningún ancho [fuente: código-existente].
  - Mobile queda fuera de la superficie `web`: el shell tiene una sidebar de 290px fija sin ninguna media query, así que por debajo de ese ancho no hay navegación disponible (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Desde la navegación del shell · ítem `"Horas Trabajadas"` o su subítem `"Carga"` (`Navbar.tsx:84`, `:89`)

**Salidas user-driven:**
- **Ninguna.** La pantalla no enlaza a ningún lado: es un formulario de carga que se queda donde está; el único camino afuera es la sidebar

**Salidas automáticas:**
- A `/projects` · redirect si `session.user.roles` incluye `external-user` (`worked-times/page.tsx:13-15`). Redundante con el redirect a `/unauthorized` del layout

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | tarjeta-formulario | card | — | layout | desktop | — | Agrupa todo el formulario de carga |
| 2 | selector-persona | dropdown | closed / open | input | desktop | visible_only_in_states: rol admin | Persona destino de la carga |
| 3 | separador | section | — | layout | desktop | — | `<hr>` entre bloques del formulario |
| 4 | selector-dia | section | — | layout | desktop | — | Agrupa los ocho botones de día |
| 5 | boton-dia | button | selected · completed / partial / empty | input | desktop | — | Elige el día a cargar |
| 6 | semaforo-dia | icon | completed / partial / empty | content | desktop | — | Estado de carga de ese día |
| 7 | toggle-modo | toggle | presente / ausente | input | desktop | — | Alterna entre carga de horas y ausencia |
| 8 | selector-objetivo | dropdown | closed / open · grouped | input | desktop | visible_only_in_states: modo presente | Proyecto, requisito o tarea |
| 9 | selector-motivo-ausencia | dropdown | closed / open | input | desktop | visible_only_in_states: modo ausente | Motivo de la ausencia |
| 10 | botones-tiempo | section | — | layout | desktop | — | Agrupa horas, minutos, total y envío |
| 11 | boton-hora | button | selected / unselected | input | desktop | — | Elige una cantidad de horas |
| 12 | boton-hora-personalizada | button | selected / unselected | input | desktop | — | Abre el campo de horas libre |
| 13 | campo-hora-personalizada | text-input | default | input | desktop | visible_only_in_states: hora personalizada activa | Cantidad de horas libre |
| 14 | boton-minuto | button | selected / unselected | input | desktop | — | Elige una cantidad de minutos |
| 15 | total-tiempo | paragraph | body | content | desktop | — | Total del tiempo elegido |
| 16 | boton-cargar-horas | button | primary · disabled | input | desktop | state_overrides: `canSubmit` false→disabled | Envía la carga |
| 17 | lista-cargas-dia | card | — | layout | desktop | — | Agrupa lo ya cargado en el día |
| 18 | titulo-cargas-dia | paragraph | body | content | desktop | — | Encabeza la lista del día |
| 19 | total-dia | paragraph | body | content | desktop | — | Total cargado en el día |
| 20 | item-carga | list | — | content | desktop | hidden_in_states: empty del día | Un registro de carga o ausencia |
| 21 | icono-tipo-carga | icon | project / requirement / objective | content | desktop | — | Tipo del registro |
| 22 | boton-borrar-carga | button | — | input | desktop | — | Abre la confirmación de borrado |
| 23 | cargando-dia | loader | — | feedback | desktop | visible_only_in_states: loading de las cargas del día | Espera de las cargas del día |
| 24 | vacio-dia | empty-state | — | feedback | desktop | visible_only_in_states: empty del día | Mensaje de día sin cargas |
| 25 | dialogo-borrar-carga | modal | — | feedback | desktop | visible_only_in_states: confirmación de borrado de carga | Confirma el borrado de un registro |
| 26 | dialogo-borrar-ausencia | modal | — | feedback | desktop | visible_only_in_states: confirmación de borrado de ausencia | Confirma el borrado de una ausencia |
| 27 | cargando-vista | loader | — | feedback | desktop | visible_only_in_states: loading inicial | Fallback del `<Suspense>` de la página |

**Origen:** `src/app/(loggedin)/worked-times/page.tsx`, `src/features/worked-times/components/WorkedTimesPage/WorkedTimesPage.tsx`, `src/features/worked-times/components/DaySelector/DaySelector.tsx`, `src/features/worked-times/components/TargetSelector/TargetSelector.tsx`, `src/features/worked-times/components/TimeButtons/TimeButtons.tsx`, `src/features/worked-times/components/DayEntriesList/DayEntriesList.tsx`, `src/shared/components/ui/ToggleGroup/ToggleGroup.tsx`.

Notas de transcripción [fuente: código-existente]:
- `selector-dia`, `botones-tiempo` y `separador` se relevaron como `section`: compuestos y separadores sin tipo propio en el diccionario.
- Los dos `ConfirmDialog` están relevados como overlays compartidos en `_overlays.md`.

## Layout por viewport

### desktop · 1440px

- tarjeta-formulario (pila vertical con separadores explícitos)
  - selector-persona
  - separador
  - selector-dia: los 8 botones de día en fila, cada uno con su semaforo-dia
  - separador
  - toggle-modo
  - separador
  - **uno** de: selector-objetivo (modo presente) · selector-motivo-ausencia (modo ausente)
  - separador
  - botones-tiempo
    - row `horas`: boton-hora × N · boton-hora-personalizada · campo-hora-personalizada
    - row `minutos`: boton-minuto × N
    - total-tiempo
    - boton-cargar-horas
- lista-cargas-dia
  - row `cabecera`: titulo-cargas-dia · total-dia
  - item-carga × N (lista vertical), cada uno con icono-tipo-carga y boton-borrar-carga

**Origen:** `:240-306` — una pila con cuatro `<hr>` como separadores explícitos (`:252`, `:263`, `:267`, `:292`) [fuente: código-existente].

**Las fracciones no son derivables:** es una columna con filas de botones de ancho intrínseco, no una grilla de 12.

## Contenido

### tarjeta-formulario
- Texto/label: contenedor sin texto propio
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.formCard}>` (`:241`)

### selector-persona
- Texto/label: label `"Persona"`; placeholder `"Seleccionar persona..."` (`:245`, `:250`)
- Icono: nada
- Asset: nada
- Annotation: **solo se renderiza para `admin`** (`:84`, `:~243`). Permite cargar horas en nombre de otra persona. Sin él, la persona es la propia, resuelta desde `zitadelId` contra `/persons` (`:88-91`)

### separador
- Texto/label: sin texto
- Icono: nada
- Asset: nada
- Annotation: cuatro `<hr className={styles.divider}>` como separadores semánticos (`:252`, `:263`, `:267`, `:292`)

### selector-dia
- Texto/label: nombres de día verbatim: `["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]` (`DaySelector.tsx:16`), con el número de cada fecha
- Icono: nada
- Asset: nada
- Annotation: muestra **los últimos 8 días hábiles**, no una semana. El bucle recorre hacia atrás desde hoy y saltea sábados y domingos (`if (dayOfWeek !== 0 && dayOfWeek !== 6)`, `DaySelector.tsx:46`), acumulando 8 y ordenándolos con `unshift` para que queden cronológicos. En un lunes, los 8 días llegan hasta el miércoles de la semana anterior

### boton-dia
- Texto/label: el nombre abreviado del día y su número
- Icono: nada
- Asset: nada
- Annotation: `<button aria-pressed aria-current>` (`DaySelector.tsx:63-78`, `:72`, `:73`). El nombre accesible no incluye el estado de carga

### semaforo-dia
- Texto/label: **sin texto** — es un `<span>` vacío cuyo estado se comunica por color
- Icono: nada
- Asset: nada
- Annotation: `<span className={cn(styles.dot, styles[status])}>` (`DaySelector.tsx:76`). Tres estados (`:26-28`): `empty` (sin minutos cargados) · `partial` (algo cargado pero menos que el umbral) · `completed` (alcanzó o superó el umbral). El umbral viene de `hoursPerDay` (`GET /settings/hours-per-day`)

### toggle-modo
- Texto/label: opciones verbatim `"Presente"` (`presente`) · `"Ausente"` (`ausente`) (`:28-29`)
- Icono: nada
- Asset: nada
- Annotation: `<ToggleGroup>` (`:265`). Default `presente` (`:99`). Al pasar a `ausente` cambia el bloque de abajo

### selector-objetivo
- Texto/label: el label está en `TargetSelector.tsx:146-148`, cuyo texto exacto no se relevó; placeholder `"Buscar proyecto, requisito o tarea..."` (`:156`). Grupos verbatim: `"Proyectos"` · `"Requisitos"` · `"Tareas"` (`TargetSelector.tsx:85-87`). Sin resultados: `"Sin resultados"` (`:160`)
- Icono: nada
- Asset: nada
- Annotation: `react-select` con opciones agrupadas. Los proyectos vienen filtrados por `state: 'activo,analisis'` (`TargetSelector.tsx:57`). Al elegir, el `value` se parsea por prefijo (`requirement-`, `objective-`) para saber qué tipo es (`:116-137`)

### selector-motivo-ausencia
- Texto/label: label `"Motivo de ausencia:"` (`:277`); placeholder `"Cargando motivos..."` mientras carga y `"Seleccioná un motivo..."` después (`:284`). Sin resultados: `"Sin resultados"` (`:287`). Motivos (`REASON_LABELS`, `DayEntriesList.tsx:27-35`): `"Trámite"` · `"Corte de servicios"` · `"Vacaciones"` · `"Día no laborable"` · `"Personal"` · `"Médico"` · `"Estudio"` · `"Enfermedad"` · `"Otro"`
- Icono: nada
- Asset: nada
- Annotation: los motivos vienen de `GET /unworked-times/reasons`

### botones-tiempo
- Texto/label: etiquetas verbatim `"Horas:"` (`TimeButtons.tsx:59`) y `"Minutos:"` (`:107`)
- Icono: nada
- Asset: nada
- Annotation: `<TimeButtons>` (`:294-302`)

### boton-hora
- Texto/label: la cantidad de horas de esa opción
- Icono: nada
- Asset: nada
- Annotation: `<button aria-pressed>` × N (`TimeButtons.tsx:62-75`, `:72`)

### boton-hora-personalizada
- Texto/label: la opción de horas libre
- Icono: nada
- Asset: nada
- Annotation: `<button aria-pressed={isCustom}>` (`TimeButtons.tsx:77-85`, `:83`)

### campo-hora-personalizada
- Texto/label: placeholder `"Horas"` (`TimeButtons.tsx:98`)
- Icono: nada
- Asset: nada
- Annotation: `<input type="number">` (`TimeButtons.tsx:89-99`). `Enter` confirma el valor (`:47`)

### boton-minuto
- Texto/label: la cantidad de minutos de esa opción
- Icono: nada
- Asset: nada
- Annotation: `<button aria-pressed>` × N (`TimeButtons.tsx:110-121`, `:117`)

### total-tiempo
- Texto/label: dinámico — el total del tiempo elegido (`TimeButtons.tsx:126-128`)
- Icono: nada
- Asset: nada
- Annotation: `<span className={styles.total}>`

### boton-cargar-horas
- Texto/label: `"Cargar horas"` (`TimeButtons.tsx:130`)
- Icono: nada
- Asset: nada
- Annotation: `disabled` cuando `canSubmit === false` (`:131`), sin mensaje que lo explique

### lista-cargas-dia
- Texto/label: contenedor sin texto propio
- Icono: nada
- Asset: nada
- Annotation: `<SectionCard>` en `<DayEntriesList>` (`DayEntriesList.tsx:169`)

### titulo-cargas-dia
- Texto/label: `` `Cargas del ${formatDateLabel(date)}` `` (`DayEntriesList.tsx:171`). Meses abreviados: `["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]` (`:48-59`)
- Icono: nada
- Asset: nada
- Annotation: es un `<span>`, no un encabezado

### total-dia
- Texto/label: `` `Total: ${formatMinutes(totalMinutes)}` `` (`DayEntriesList.tsx:172`)
- Icono: nada
- Asset: nada
- Annotation: cambia al cargar o borrar

### item-carga
- Texto/label: la etiqueta de la carga; para una carga presente es `["Presente", projectName]` compuesto, con `"Proyecto desconocido"` como fallback (`DayEntriesList.tsx:135-136`)
- Icono: nada
- Asset: nada
- Annotation: `<li className={styles.entry}>` (`:188`, `:206`)

### icono-tipo-carga
- Texto/label: sin texto propio
- Icono: `<TintedIcon>` con `alt="Tarea"` / `"Requisito"` / `"Proyecto"` (`DayEntriesList.tsx:158`, `:161`, `:163`)
- Asset: nada
- Annotation: el `alt` aporta información real (el tipo de la carga)

### boton-borrar-carga
- Texto/label: sin texto; `aria-label={`Eliminar ${label}`}` en las cargas (`DayEntriesList.tsx:197`) y `aria-label={`Eliminar ausencia: ${motivo}`}` en las ausencias (`:216`)
- Icono: nada
- Asset: nada
- Annotation: `<button>` (`DayEntriesList.tsx:192-199`); los `aria-label` incluyen de qué registro se trata

### cargando-dia
- Texto/label: **sin texto** — es un `<Spinner>` (`DayEntriesList.tsx:176-178`)
- Icono: nada
- Asset: nada
- Annotation: sin `aria-live` ni `role="status"`

### vacio-dia
- Texto/label: `"No hay cargas para este día"` (`DayEntriesList.tsx:181`)
- Icono: nada
- Asset: nada
- Annotation: `<p className={styles.empty}>`

### dialogo-borrar-carga
- Texto/label: título `"Eliminar registro"`; confirmar `"Eliminar"`; cancelar `"Cancelar"` (`DayEntriesList.tsx:227-230`)
- Icono: nada
- Asset: nada
- Annotation: `<ConfirmDialog>` con `<dialog>` nativo y `showModal()` (`ConfirmDialog.tsx:35`)

### dialogo-borrar-ausencia
- Texto/label: título `"Eliminar ausencia"`; confirmar `"Eliminar"`; cancelar `"Cancelar"` (`DayEntriesList.tsx:237-240`)
- Icono: nada
- Asset: nada
- Annotation: segundo `<ConfirmDialog>` separado, con título propio

### cargando-vista
- Texto/label: `"Cargando horas trabajadas..."` (`worked-times/page.tsx:20`)
- Icono: nada
- Asset: nada
- Annotation: `<Loader>` como fallback del `<Suspense>` de la página

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base), en modo `presente` (`:99`, `:269-275`): se muestra selector-objetivo
- Sub-estado `modo ausente` (`mode === 'ausente'`): selector-objetivo se oculta y selector-motivo-ausencia se muestra (`:276-290`). Tras registrar una ausencia con éxito, el modo vuelve a `presente` (`:212`)
- Sub-estado `semáforo por día`: tres estados por botón (`completed`, `partial`, `empty`, `DaySelector.tsx:26-28`, `:76`)
- Sub-estado `botón de envío deshabilitado`: `canSubmit === false`. Requiere, en este orden (`:164-169`): `totalMinutes > 0`, `effectivePersonId !== 0`, y en modo `presente` un objetivo resuelto (`resolvedProjectId != null`) o en modo `ausente` un motivo. `handleSubmit` repite los dos primeros chequeos como guarda (`:177`)
- Sub-estado `confirmación de borrado`: click en boton-borrar-carga abre dialogo-borrar-carga o dialogo-borrar-ausencia (`DayEntriesList.tsx:225-242`); `actionsDisabled` viene de `deleteWorkedMutation.isPending || deleteUnworkedMutation.isPending` (`:166`)

### empty
- Aplica: Sí
- Mensaje: `"No hay cargas para este día"` (`DayEntriesList.tsx:181`)
- Cambios:
  - vacio-dia: solo visible en este estado (visible_only_in_states)
  - item-carga: oculto en este estado (hidden_in_states)
- Disparado por `!isLoading && !hasEntries`; `hasEntries` considera **las dos** listas (horas y ausencias) (`:102`)

### loading
- Aplica: Sí
- Mensaje: `"Cargando horas trabajadas..."` (inicial, `worked-times/page.tsx:20`) · `"Cargando motivos..."` (placeholder del selector de motivo, `:284`) · sin texto, solo `<Spinner>`, para las cargas del día (`DayEntriesList.tsx:175-179`)
- Cambios:
  - cargando-vista: solo visible durante el loading inicial
  - cargando-dia: solo visible mientras `workedTimesResult.isLoading || unworkedTimesResult.isLoading` (`DayEntriesList.tsx:82`)
  - selector-motivo-ausencia: content del placeholder = `"Cargando motivos..."` mientras `isLoadingReasons` (state_override)
  - **Loading del envío** (`createMutation.isPending || createUnworkedMutation.isPending`, `:237`)

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). La validación existe pero es solo un `disabled` en el botón, sin ningún mensaje: nada dice que falta elegir el objetivo, el motivo o el tiempo (`TimeButtons.tsx:131`, `:164-169`) [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí (parcialmente)
- Mensaje: toast `apiError.message` o `"Error al cargar horas"` (`:197`) · `"Error al registrar ausencia"` (`:219`) · `"Error al eliminar"` (`DayEntriesList.tsx:113`) · `"Error al eliminar ausencia"` (`:128`)
- Cambios: solo toasts
- Nota: **el error de las cargas del día no se maneja.** `DayEntriesList` desestructura solo `isLoading` de sus dos queries e ignora `isError`, así que ante un fallo las listas quedan vacías y se muestra `"No hay cargas para este día"`: **un error es indistinguible de un día sin cargas** (`DayEntriesList.tsx:82`, `:181`). Lo mismo con el semáforo: un fallo deja todos los días en `empty`, visualmente idéntico a "no cargué nada" (`DaySelector.tsx:26-28`). `usePersons` (`:~86`) y la query de motivos (`:104`) tampoco manejan `isError`: los selects quedan vacíos [fuente: código-existente]
- **REQ-004: la falla del bus se parte en dos y la recuperación no es la misma.** La api separa `503 service_unavailable` —no hay ningún `jiku-commands` escuchando, mensaje `"El servicio no está disponible en este momento"`— de `504 gateway_timeout` —la respuesta no llegó a tiempo, mensaje `"La operación tardó demasiado"`— (RF-16, CA-8, CA-9). Los dos salen por el mismo toast de `apiError.message`: **la pantalla no se modifica**. Lo que cambia es qué puede hacer el usuario: con el 503 la carga **no ocurrió** y reintentar es seguro; con el 504 **pudo haber ocurrido**, y reintentar duplica el asiento y consume el tope diario dos veces. La única recuperación disponible es **mirar la lista del día antes de repetir** — y el toast dura 2 segundos, así que puede desaparecer antes de que el usuario lea la diferencia [REQ-004]

### success
- Aplica: Sí
- Mensaje: toast `"Horas cargadas exitosamente"` (`:190`) · `"Ausencia registrada exitosamente"` (`:211`) · `"Registro eliminado"` (`DayEntriesList.tsx:108`) · `"Ausencia eliminada"` (`:123`)
- Cambios: tras registrar una ausencia, el modo vuelve a `presente` (`:212`); tras cargar horas el modo no cambia

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). No hay tope diario ni bloqueo de ningún tipo: el semáforo marca `completed` al alcanzar el umbral (`hoursPerDay`, default 6h) pero no impide seguir cargando — se pueden registrar 20 horas en un día sin advertencia (`:160`, `DaySelector.tsx:26-28`) [fuente: código-existente]

## Interacciones

**Eventos:** [fuente: código-existente]
- selector-persona · on change → cambia la persona destino de la carga (`:~248`)
- boton-dia · click → cambia `selectedDate` (`DaySelector.tsx:~70`)
- toggle-modo · click → `handleModeChange` (`:265`)
- selector-objetivo · on change → parsea el tipo por prefijo y setea `projectId`, `requirementId` u `objectiveId` (`TargetSelector.tsx:110-137`)
- selector-motivo-ausencia · on change → setea el motivo (`:~285`)
- boton-hora / boton-minuto · click → setea el valor (`TimeButtons.tsx:~68`, `:~116`)
- boton-hora-personalizada · click → abre campo-hora-personalizada (`TimeButtons.tsx:~80`)
- campo-hora-personalizada · `Enter` → confirma el valor (`TimeButtons.tsx:47`)
- boton-cargar-horas · click → según el modo, `POST /worked-times` o `POST /unworked-times` (`:179-222`)
- boton-borrar-carga · click → abre el `ConfirmDialog` correspondiente (`DayEntriesList.tsx:~195`, `:~215`)

**Validaciones:**
- boton-cargar-horas · `canSubmit` (`:164-169`): `totalMinutes > 0` **y** persona resuelta **y** (objetivo en modo `presente` / motivo en modo `ausente`) → el botón queda `disabled`, **sin mensaje**
- `handleSubmit` repite la guarda de minutos y persona (`:177`)
- No hay regla de tope diario ni de rango de fecha

**Feedback:**
- Semáforo por día (completo / parcial / vacío)
- Total del tiempo seleccionado, en vivo
- Total del día en la lista
- Toasts para cada operación
- Confirmación antes de borrar
- Tras registrar una ausencia, el modo vuelve a `presente`

**Rango de edición** [fuente: código-existente]: el selector solo ofrece los últimos 8 días hábiles, así que no hay forma de cargar en un día más viejo ni en el futuro, y **tampoco de corregir una carga de hace más de 8 días hábiles** — no hay navegación a otros períodos (`DaySelector.tsx:38-56`).

## Accesibilidad

- **Orden de foco:** selector-persona (si admin) → boton-dia × 8 → toggle-modo → selector-objetivo o selector-motivo-ausencia → boton-hora × N → boton-hora-personalizada → campo-hora-personalizada → boton-minuto × N → boton-cargar-horas → boton-borrar-carga de cada item-carga [fuente: código-existente].
- **Landmarks y jerarquía:** los landmarks son los del shell. Un solo `<h1>`, el del `PageLayout` (`"Horas Trabajadas"`, `worked-times/page.tsx:18`). **El título de la lista del día es un `<span>`, no un encabezado** (`DayEntriesList.tsx:171`), así que la pantalla no tiene ningún `<h2>` pese a tener dos bloques claramente distintos. Los cuatro `<hr>` sí separan semánticamente los bloques del formulario (`:252`, `:263`, `:267`, `:292`).
- **Foco y teclado:** los overlays de esta composición son los dos `ConfirmDialog` de borrado, que usan `<dialog>` nativo con `showModal()`: **el focus trap, el `Escape` y la devolución del foco al disparador los aporta el navegador** (`ConfirmDialog.tsx:35`, ver `_overlays.md`). Los menús de `react-select` de selector-objetivo y selector-motivo-ausencia aportan su propio comportamiento de foco. `Enter` en campo-hora-personalizada confirma el valor (`TimeButtons.tsx:47`); no hay otros atajos propios.
- **Propio de esta composición:** **el semáforo de días se comunica únicamente por color.** `<span className={cn(styles.dot, styles[status])}>` es un `<span>` vacío sin texto ni `aria-label`, y el nombre accesible del botón de día no dice el estado de carga (`DaySelector.tsx:76`, `:63-78`): la información más útil de la pantalla es invisible para quien no distingue el color. El spinner de las cargas del día no tiene `aria-live` ni `role="status"` (`DayEntriesList.tsx:177`), y **total-dia cambia al cargar o borrar sin `aria-live`** (`:172`). `boton-cargar-horas` está `disabled` sin explicación accesible (`TimeButtons.tsx:131`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-004 — El bus en dos servicios micro (2026-08-23)

- **No se agrega ningún bloque para el 504, y es una decisión.** El REQ deja `web` sin cambios de código a propósito (RF-16): la api separa las dos fallas y el frontend muestra el mensaje que viene en el cuerpo. Diseñar acá un `alert` propio para el timeout habría inventado UI que el REQ declaró fuera de alcance. Lo que sí se documenta es la **consecuencia**, porque cambia la recuperación del usuario y ninguna otra pieza la registra.
- **Es la pantalla donde el 504 duele más de la superficie.** Es el flujo de mayor frecuencia (flujo 1 de `user-flows`) y su escritura **no es idempotente**: un asiento duplicado no solo ensucia el dato, consume el tope de 1440 minutos del día. Por eso el estado de error dice explícitamente "mirar la lista antes de reintentar" en vez de "reintentar".
- **Descartado avisar del riesgo de duplicado en la confirmación de borrado (O-02).** El borrado sí es idempotente desde el punto de vista del usuario: reintentar un borrado que ya ocurrió no crea nada. El desdoblamiento no cambia nada ahí.
