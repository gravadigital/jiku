---
document: UX Survey Screen
screen: carga-horas
route: /worked-times
service: web
source_files:
  - src/app/(loggedin)/worked-times/page.tsx
  - src/features/worked-times/components/WorkedTimesPage/WorkedTimesPage.tsx
  - src/features/worked-times/components/DaySelector/DaySelector.tsx
  - src/features/worked-times/components/TargetSelector/TargetSelector.tsx
  - src/features/worked-times/components/TimeButtons/TimeButtons.tsx
  - src/features/worked-times/components/DayEntriesList/DayEntriesList.tsx
  - src/shared/components/ui/ToggleGroup/ToggleGroup.tsx
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: carga-horas

> **Relevamiento as-is** de `/worked-times`, extraído de
> `src/app/(loggedin)/worked-times/page.tsx` y su árbol.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md); los `ConfirmDialog` de borrado, en
> [_overlays.md](./_overlays.md).

## Identidad

- **Ruta:** `/worked-times`
- **Archivo:** `src/app/(loggedin)/worked-times/page.tsx` (Server Component,
  `dynamic = 'force-dynamic'`) → `<WorkedTimesPage>` (`'use client'`, 308 líneas)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`, **más un chequeo propio**: `external-user`
  redirigido a `/projects` (`worked-times/page.tsx:13-15`)
- **Audiencia:** no determinable desde el código. `admin` puede cargar en nombre de otra persona
- **Propósito observado:** registra las horas trabajadas o la ausencia de un día, contra un proyecto,
  requisito o tarea, y lista lo ya cargado en ese día.
- **Viewports con tratamiento:** ninguno.

## Entrada y salida

**Entradas:**
- Ítem `"Horas Trabajadas"` o su subítem `"Carga"` de la navegación · `Navbar.tsx:84`, `:89`

**Salidas:**
- `/projects` · **redirect automático** si el rol es `external-user` · `worked-times/page.tsx:14`
- **Ninguna navegación desde la UI.** La pantalla no enlaza a ningún lado: es un formulario de carga
  que se queda donde está.

**Redirects automáticos:**
- `/projects` si `session.user.roles` incluye `external-user` · `worked-times/page.tsx:13-15`

> Redundante con el redirect a `/unauthorized` del layout, igual que en `asignacion-tiempo`.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | tarjeta-formulario | `card` | — | ambos | `<div className={styles.formCard}>` | `:241` |
| 2 | selector-persona | `dropdown` | closed / open | ambos | `<Select label="Persona">` — **solo admin** | `:244-250` |
| 3 | separador | `section` | — | ambos | `<hr className={styles.divider}>` × 4 | `:252`, `:263`, `:267`, `:292` |
| 4 | selector-dia | `section` | — | ambos | `<DaySelector>` | `:256-261` |
| 5 | boton-dia | `button` | selected · completed / partial / empty | ambos | `<button aria-pressed aria-current>` × 8 | `DaySelector.tsx:63-78` |
| 6 | semaforo-dia | `icon` | completed / partial / empty | ambos | `<span className={cn(styles.dot, styles[status])}>` | `DaySelector.tsx:76` |
| 7 | toggle-modo | `toggle` | presente / ausente | ambos | `<ToggleGroup>` | `:265` |
| 8 | selector-objetivo | `dropdown` | closed / open · grouped | ambos | `<TargetSelector>` → `<ReactSelect>` agrupado | `:270-274` |
| 9 | selector-motivo-ausencia | `dropdown` | closed / open | ambos | `<ReactSelect>` — **solo en modo ausente** | `:278-289` |
| 10 | botones-tiempo | `section` | — | ambos | `<TimeButtons>` | `:294-302` |
| 11 | boton-hora | `button` | selected / unselected | ambos | `<button aria-pressed>` × N | `TimeButtons.tsx:62-75` |
| 12 | boton-hora-personalizada | `button` | selected / unselected | ambos | `<button aria-pressed={isCustom}>` | `TimeButtons.tsx:77-85` |
| 13 | campo-hora-personalizada | `text-input` | default | ambos | `<input type="number" placeholder="Horas">` | `TimeButtons.tsx:89-99` |
| 14 | boton-minuto | `button` | selected / unselected | ambos | `<button aria-pressed>` × N | `TimeButtons.tsx:110-121` |
| 15 | total-tiempo | `paragraph` | body | ambos | `<span className={styles.total}>` | `TimeButtons.tsx:126-128` |
| 16 | boton-cargar-horas | `button` | primary · disabled | ambos | `<Button label="Cargar horas">` | `TimeButtons.tsx:129-131` |
| 17 | lista-cargas-dia | `card` | — | ambos | `<SectionCard>` en `<DayEntriesList>` | `DayEntriesList.tsx:169` |
| 18 | titulo-cargas-dia | `paragraph` | body | ambos | `<span className={styles.title}>` | `DayEntriesList.tsx:171` |
| 19 | total-dia | `paragraph` | body | ambos | `<span className={styles.total}>` | `DayEntriesList.tsx:172` |
| 20 | item-carga | `list` | — | ambos | `<li className={styles.entry}>` | `DayEntriesList.tsx:188`, `:206` |
| 21 | icono-tipo-carga | `icon` | project / requirement / objective | ambos | `<TintedIcon>` | `DayEntriesList.tsx:189` |
| 22 | boton-borrar-carga | `button` | — | ambos | `<button aria-label="Eliminar {label}">` | `DayEntriesList.tsx:192-199` |
| 23 | cargando-dia | `loader` | — | ambos | `<Spinner>` | `DayEntriesList.tsx:176-178` |
| 24 | vacio-dia | `empty-state` | — | ambos | `<p className={styles.empty}>` | `DayEntriesList.tsx:181` |
| 25 | dialogo-borrar-carga | `modal` | — | ambos | `<ConfirmDialog title="Eliminar registro">` | `DayEntriesList.tsx:225-232` |
| 26 | dialogo-borrar-ausencia | `modal` | — | ambos | `<ConfirmDialog title="Eliminar ausencia">` | `DayEntriesList.tsx:235-242` |
| 27 | cargando-vista | `loader` | — | ambos | `<Loader label="Cargando horas trabajadas...">` como fallback de `<Suspense>` | `worked-times/page.tsx:20` |

> `selector-dia`, `botones-tiempo` y `separador` se relevaron como `section`: compuestos y separadores
> sin tipo propio en el diccionario.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- tarjeta-formulario (pila vertical con separadores entre bloques)
  - selector-persona (solo admin) · separador
  - selector-dia: los 8 botones de día en fila
  - separador
  - toggle-modo
  - separador
  - **uno** de: selector-objetivo (modo presente) · selector-motivo-ausencia (modo ausente)
  - separador
  - botones-tiempo: fila de horas, fila de minutos, total y boton-cargar-horas
- lista-cargas-dia
  - titulo-cargas-dia · total-dia (fila)
  - item-carga × N (lista vertical)

**Origen:** `:240-306` — una pila con `<hr>` como separadores explícitos.

**Las fracciones no son derivables:** es una columna con filas de botones de ancho intrínseco, no una
grilla de 12.

> **Sin tratamiento responsive:** el `selector-dia` son 8 botones en fila y `botones-tiempo` son dos
> filas de botones más un input. A anchos angostos no hay reflow declarado.

## Contenido

### selector-persona
- Texto/label: `"Persona"` · placeholder `"Seleccionar persona..."`
- Origen: `:245`, `:250`
- Annotation: **solo se renderiza para `admin`** (`:84`, `:~243`). Permite cargar horas en nombre de
  otra persona. Sin él, la persona es la propia, resuelta desde `zitadelId` contra `/persons`
  (`:88-91`).

### selector-dia
- Nombres de día verbatim: `["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]` · `DaySelector.tsx:16`
- Origen: `DaySelector.tsx:59-80`
- Annotation: muestra **los últimos 8 días hábiles**, no una semana. El bucle recorre hacia atrás
  desde hoy y **saltea sábados y domingos** (`if (dayOfWeek !== 0 && dayOfWeek !== 6)`,
  `DaySelector.tsx:46`), acumulando 8 y ordenándolos con `unshift` para que queden cronológicos. En
  un lunes, los 8 días llegan hasta el miércoles de la semana anterior.
- Semáforo por día (`DaySelector.tsx:26-28`):
  - `empty` — sin minutos cargados
  - `partial` — algo cargado pero menos que el umbral
  - `completed` — alcanzó o superó el umbral
- El umbral viene de `hoursPerDay` (`GET /settings/hours-per-day`)

### toggle-modo
- Opciones verbatim: `"Presente"` (`presente`) · `"Ausente"` (`ausente`) · `:28-29`
- Origen: `:265`
- Annotation: default `presente` (`:99`). Al pasar a `ausente` cambia el bloque de abajo.

### selector-objetivo
- Texto/label: en `TargetSelector.tsx:146-148` · placeholder
  `"Buscar proyecto, requisito o tarea..."` · `:156`
- Grupos verbatim: `"Proyectos"` · `"Requisitos"` · `"Tareas"` · `TargetSelector.tsx:85-87`
- Sin resultados: `"Sin resultados"` · `TargetSelector.tsx:160`
- Origen: `:270-274`
- Annotation: es un `react-select` con opciones agrupadas. Los proyectos vienen filtrados por
  `state: 'activo,analisis'` (`TargetSelector.tsx:57`). Al elegir, el `value` se parsea por prefijo
  (`requirement-`, `objective-`) para saber qué tipo es (`TargetSelector.tsx:116-137`).

### selector-motivo-ausencia
- Texto/label: `"Motivo de ausencia:"` · `:277`
- Placeholder: `"Cargando motivos..."` mientras carga, `"Seleccioná un motivo..."` después · `:284`
- Sin resultados: `"Sin resultados"` · `:287`
- Origen: `:276-290`
- Motivos (`REASON_LABELS`, `DayEntriesList.tsx:27-35`): `"Trámite"` · `"Corte de servicios"` ·
  `"Vacaciones"` · `"Día no laborable"` · `"Personal"` · `"Médico"` · `"Estudio"` · `"Enfermedad"` ·
  `"Otro"`
- Annotation: los motivos vienen de `GET /unworked-times/reasons`

### botones-tiempo
- Etiquetas verbatim: `"Horas:"` · `"Minutos:"` · `TimeButtons.tsx:59`, `:107`
- Placeholder del campo personalizado: `"Horas"` · `TimeButtons.tsx:98`
- Botón de envío: `"Cargar horas"` · `TimeButtons.tsx:130`
- Total: dinámico, en `TimeButtons.tsx:126-128`
- Annotation: `Enter` en el campo personalizado confirma el valor (`TimeButtons.tsx:47`)

### lista-cargas-dia
- Título: `` `Cargas del ${formatDateLabel(date)}` `` · `DayEntriesList.tsx:171`
- Total: `` `Total: ${formatMinutes(totalMinutes)}` `` · `:172`
- Empty: `"No hay cargas para este día"` · `:181`
- Etiqueta de una carga presente: `["Presente", projectName]` compuesto, con
  `"Proyecto desconocido"` como fallback · `:135-136`
- Meses abreviados para el título: `["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]` ·
  `:48-59`
- Iconos por tipo: `alt="Tarea"` / `"Requisito"` / `"Proyecto"` · `:158`, `:161`, `:163`

### Mensajes de toast
- Horas cargadas: `"Horas cargadas exitosamente"` · `:190`
- Error al cargar horas: `apiError.message` o `"Error al cargar horas"` · `:197`
- Ausencia registrada: `"Ausencia registrada exitosamente"` · `:211`
- Error de ausencia: `apiError.message` o `"Error al registrar ausencia"` · `:219`
- Registro eliminado: `"Registro eliminado"` · `DayEntriesList.tsx:108`
- Error al eliminar: `apiError.message` o `"Error al eliminar"` · `:113`
- Ausencia eliminada: `"Ausencia eliminada"` · `:123`
- Error al eliminar ausencia: `apiError.message` o `"Error al eliminar ausencia"` · `:128`

### Diálogos de confirmación
- `"Eliminar registro"` · confirmar `"Eliminar"` · cancelar `"Cancelar"` ·
  `DayEntriesList.tsx:227-230`
- `"Eliminar ausencia"` · confirmar `"Eliminar"` · cancelar `"Cancelar"` ·
  `DayEntriesList.tsx:237-240`

## Estados presentes

### default (modo presente)
- Disparado por: `mode === 'presente'` (default)
- Origen: `:99`, `:269-275`
- Cambios: se muestra `selector-objetivo`

### modo ausente
- Disparado por: `mode === 'ausente'`
- Origen: `:276-290`
- Cambios: `selector-objetivo` se reemplaza por `selector-motivo-ausencia`
- Annotation: **tras registrar una ausencia con éxito, el modo vuelve a `presente`** (`:212`)

### loading de motivos
- Mensaje: `"Cargando motivos..."` como placeholder del select
- Disparado por: `isLoadingReasons`
- Origen: `:284`

### loading de las cargas del día
- Mensaje: `<Spinner>` sin texto
- Disparado por: `workedTimesResult.isLoading || unworkedTimesResult.isLoading` ·
  `DayEntriesList.tsx:82`
- Origen: `DayEntriesList.tsx:175-179`

### empty del día
- Mensaje: `"No hay cargas para este día"`
- Disparado por: `!isLoading && !hasEntries` · `DayEntriesList.tsx:181`
- Annotation: `hasEntries` considera **las dos** listas (horas y ausencias) · `:102`

### semáforo por día
- Tres estados por botón de día: `completed`, `partial`, `empty` · `DaySelector.tsx:26-28`, `:76`
- Annotation: es **el mejor feedback de progreso del producto** — muestra de un vistazo qué días
  están completos

### botón de envío deshabilitado
- Disparado por: `canSubmit === false`. Requiere, en este orden (`:164-169`):
  1. `totalMinutes > 0` — hay horas o minutos elegidos
  2. `effectivePersonId !== 0` — hay una persona resuelta
  3. en modo `presente`, un objetivo resuelto (`resolvedProjectId != null`); en modo `ausente`, un
     motivo
- Origen: `:164-169`, `TimeButtons.tsx:131`
- Annotation: `handleSubmit` **repite los dos primeros chequeos** como guarda (`:177`), así que el
  envío está protegido incluso si el `disabled` fallara

### loading del envío
- Disparado por: `createMutation.isPending || createUnworkedMutation.isPending` · `:237`
- Origen: `:237`

### confirmación de borrado
- Disparado por: click en `boton-borrar-carga`
- Origen: `DayEntriesList.tsx:225-242`
- Annotation: **dos `ConfirmDialog` separados**, uno para cargas y uno para ausencias, con títulos
  distintos

### borrado en curso
- Disparado por: `deleteWorkedMutation.isPending || deleteUnworkedMutation.isPending` ·
  `DayEntriesList.tsx:166`
- Origen: `:166`, pasado como `actionsDisabled` a los diálogos

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error de las cargas del día** | **no se maneja.** `DayEntriesList` desestructura solo `isLoading` de los dos resultados: `isError` se ignora. Ante un fallo, las listas quedan vacías y se muestra `"No hay cargas para este día"` — **un error es indistinguible de un día sin cargas** | `DayEntriesList.tsx:82`, `:181` |
| **error del semáforo** | los datos del semáforo vienen de una query sin manejo de error: un fallo deja todos los días en `empty`, que es visualmente idéntico a "no cargué nada" | `DaySelector.tsx:26-28` |
| error al cargar personas | `usePersons` sin `isError`: el select de persona (admin) queda vacío | `:~86` |
| error al cargar motivos | sin `isError`: el select queda vacío tras el placeholder de carga | `:104` |
| validación del tiempo en cero | **sí está resuelta:** `canSubmit` devuelve `false` si `totalMinutes === 0` o si no hay persona resuelta, antes de chequear el modo | `:165-168` |
| **tope diario** | **no existe ningún bloqueo.** El semáforo marca `completed` al alcanzar el umbral (`hoursPerDay`, default 6h) pero **no impide seguir cargando**: se puede registrar 20 horas en un día sin advertencia. Comparar con `asignacion-tiempo`, que al menos marca la sobreasignación en rojo | `:160`, `DaySelector.tsx:26-28` |
| error de validación por campo | no existe: la validación es un `disabled` en el botón, sin mensaje | `TimeButtons.tsx:131` |
| not found | no aplica | — |
| **carga fuera del rango visible** | **no aplica por construcción:** el selector solo ofrece los últimos 8 días hábiles, así que no hay forma de cargar en un día más viejo ni en el futuro. **Pero tampoco hay forma de corregir una carga de hace dos semanas** — no hay navegación a otros períodos, a diferencia de `asignacion-tiempo`, que tiene `WeekNavigator` | `DaySelector.tsx:38-56` |
| **por qué el botón está deshabilitado** | `disabled` sin `aria-describedby` ni mensaje: no dice que falta elegir el objetivo o el motivo | `TimeButtons.tsx:131` |

## Interacciones

**Eventos:**
- selector-persona · on change → cambia la persona destino de la carga · `:~248`
- boton-dia · click → cambia `selectedDate` · `DaySelector.tsx:~70`
- toggle-modo · click → `handleModeChange` · `:265`
- selector-objetivo · on change → parsea el tipo por prefijo y setea `projectId`,
  `requirementId` u `objectiveId` · `TargetSelector.tsx:110-137`
- selector-motivo-ausencia · on change → setea el motivo · `:~285`
- boton-hora / boton-minuto · click → setea el valor · `TimeButtons.tsx:~68`, `:~116`
- boton-hora-personalizada · click → abre el campo numérico · `TimeButtons.tsx:~80`
- campo-hora-personalizada · `Enter` → confirma · `TimeButtons.tsx:47`
- boton-cargar-horas · click → según el modo, `POST /worked-times` o `POST /unworked-times` ·
  `:179-222`
- boton-borrar-carga · click → abre el `ConfirmDialog` correspondiente ·
  `DayEntriesList.tsx:~195`, `:~215`

**Validaciones:**
- `canSubmit` (`:164-169`): `totalMinutes > 0` **y** persona resuelta **y** (objetivo en modo
  `presente` / motivo en modo `ausente`)
- `handleSubmit` repite la guarda de minutos y persona · `:177`
- **Ninguna regla de tope diario ni de rango de fecha.**

**Feedback:**
- Semáforo por día (completo / parcial / vacío)
- Total del tiempo seleccionado, en vivo
- Total del día en la lista
- Toasts para cada operación
- Confirmación antes de borrar
- Tras registrar una ausencia, el modo vuelve a `presente`

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| **`aria-pressed` en los toggles** | Presente en `boton-dia`, `boton-hora`, `boton-hora-personalizada`, `boton-minuto` y en los botones de `<ToggleGroup>`. **Es la pantalla con más uso correcto de `aria-pressed` del producto** | `DaySelector.tsx:72`, `TimeButtons.tsx:72`, `:83`, `:117`, `ToggleGroup.tsx:27` |
| `aria-current="date"` en el día de hoy | Presente. Correcto | `DaySelector.tsx:73` |
| **Semáforo solo por color** | `<span className={cn(styles.dot, styles[status])}>` es un `<span>` **vacío**: el estado `completed`/`partial`/`empty` se comunica **únicamente por color**, sin texto ni `aria-label` | `DaySelector.tsx:76` |
| Nombre accesible del día | El botón tiene el nombre del día y el número. **No dice el estado de carga** | `DaySelector.tsx:63-78` |
| Label del selector de persona | Vía la prop `label` de `<Select>`. Correcto | `:245` |
| Label del selector de objetivo | `<label id="target-selector-label">` + `aria-labelledby` en el `ReactSelect`. **Correcto y explícito** | `TargetSelector.tsx:146-152` |
| Label del motivo de ausencia | `<label htmlFor="absence-reason">` + `inputId="absence-reason"`. Correcto | `:277`, `:279` |
| Botones de borrar | `aria-label={`Eliminar ${label}`}` y `aria-label={`Eliminar ausencia: ${motivo}`}`: **incluyen de qué registro se trata**. Es el mejor uso de `aria-label` contextual del producto | `DayEntriesList.tsx:197`, `:216` |
| Diálogos de confirmación | `<dialog>` nativo con `showModal()`: focus trap, `Escape` y devolución del foco los aporta el navegador. Ver [_overlays.md](./_overlays.md) | `ConfirmDialog.tsx:35` |
| Iconos de tipo de carga | `<TintedIcon alt="Tarea" / "Requisito" / "Proyecto">`: el `alt` **sí aporta** información (el tipo de la carga) | `DayEntriesList.tsx:158-163` |
| Separadores `<hr>` | Cuatro `<hr>` como separadores semánticos entre bloques del formulario. Correcto | `:252`, `:263`, `:267`, `:292` |
| Spinner de carga | `<Spinner>` sin `aria-live` ni `role="status"`: el cambio no se anuncia | `DayEntriesList.tsx:177` |
| Total del día | Cambia al cargar o borrar **sin `aria-live`** | `DayEntriesList.tsx:172` |
| Botón de envío deshabilitado | `disabled` sin explicación accesible | `TimeButtons.tsx:131` |
| Jerarquía de encabezados | Solo el `<h1>` del `PageLayout` (`"Horas Trabajadas"`). El título de la lista del día es un `<span>`, no un encabezado | `worked-times/page.tsx:18`, `DayEntriesList.tsx:171` |

## Observaciones del relevamiento

- **Es la pantalla con mejor accesibilidad de interacción del producto.** `aria-pressed` en todos los
  toggles, `aria-current` en el día de hoy, `aria-labelledby` explícito en el selector de objetivo,
  `aria-label` contextual en los botones de borrar, `<dialog>` nativo para confirmar, y `<hr>`
  semánticos. Contrasta con las tablas del producto, que no son navegables por teclado.
- **El semáforo de días es el mejor feedback de progreso del producto** — y se comunica solo por
  color (`DaySelector.tsx:76`). Un `<span>` vacío con una clase: sin texto, sin `aria-label`. La
  información más útil de la pantalla es invisible para quien no distingue el color.
- **El selector muestra los últimos 8 días hábiles**, no una semana calendario: el bucle va hacia
  atrás desde hoy salteando fines de semana (`DaySelector.tsx:38-56`, y la misma lógica duplicada en
  `WorkedTimesPage.tsx:66-79` como `getVisibleDates`). **El número 8 no está explicado en el código.**
  El efecto práctico es una ventana móvil de ~una semana y media hábil.
- **La lógica de los días está duplicada.** `DaySelector.tsx:38-56` y
  `WorkedTimesPage.tsx:66-79` implementan el mismo recorrido con el mismo `< 8` y el mismo salteo de
  fines de semana, una para renderizar y otra para pedir los minutos por día. Si una cambia y la otra
  no, el semáforo deja de corresponder a los botones.
- **No hay tope diario.** El semáforo marca `completed` al alcanzar `hoursPerDay` (default 6, `:160`)
  y nada impide seguir. En una pantalla de registro de horas, cargar 20 horas en un día es posible sin
  ninguna advertencia.
- **El error de las cargas del día es indistinguible del día vacío.** `DayEntriesList` ignora
  `isError` de sus dos queries (`:82`) y muestra `"No hay cargas para este día"`. En una pantalla cuyo
  propósito es registrar trabajo, eso significa que un fallo de red puede hacer creer que no se cargó
  nada — y llevar a cargar dos veces.
- **Dos `ConfirmDialog` para dos tipos de registro** (`DayEntriesList.tsx:225-242`), con títulos
  distintos (`"Eliminar registro"` / `"Eliminar ausencia"`). Correcto y específico.
- **Tras registrar una ausencia el modo vuelve a `presente`** (`:212`), pero tras cargar horas el modo
  no cambia. Asimetría no explicada.
- **No hay navegación de salida.** La pantalla es un formulario que se queda donde está; el único
  camino afuera es la sidebar. Coherente con su propósito.
- **No hay forma de corregir una carga vieja.** El selector solo alcanza 8 días hábiles atrás y no hay
  navegador de períodos. `asignacion-tiempo`, la pantalla hermana, sí tiene `WeekNavigator`.
- **No se relevó** el texto exacto del label del selector de objetivo (`TargetSelector.tsx:146-148`).
- **A confirmar en consolidación:** por qué la ventana es de 8 días hábiles, si el semáforo necesita
  texto además de color, si debería haber un tope diario, y cómo se corrige una carga de hace más de
  8 días hábiles.
