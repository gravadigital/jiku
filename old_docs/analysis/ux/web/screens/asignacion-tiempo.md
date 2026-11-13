---
document: UX Survey Screen
screen: asignacion-tiempo
route: /time-allocation
service: web
source_files:
  - src/app/(loggedin)/time-allocation/page.tsx
  - src/features/time-allocation/components/WeeklyAllocationTable/WeeklyAllocationTable.tsx
  - src/features/time-allocation/components/WeeklyAllocationTable/WeeklyAllocationTable.module.scss
  - src/features/time-allocation/components/WeekNavigator/WeekNavigator.tsx
  - src/features/time-allocation/components/EditableCell/EditableCell.tsx
  - src/features/time-allocation/hooks/useWeekAllocations.ts
  - src/features/time-allocation/hooks/useHoursPerDay.ts
  - src/features/time-allocation/hooks/useSaveAllocations.ts
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: asignacion-tiempo

> **Relevamiento as-is** de `/time-allocation`, extraído de
> `src/app/(loggedin)/time-allocation/page.tsx` y su árbol.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> **Es la pantalla con los tres estados de datos mejor resueltos del producto.** El chrome está
> relevado en [_shell.md](./_shell.md).

## Identidad

- **Ruta:** `/time-allocation`
- **Archivo:** `src/app/(loggedin)/time-allocation/page.tsx` (Server Component,
  `dynamic = 'force-dynamic'`) → `<WeeklyAllocationTable>` (`'use client'`, 448 líneas)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`, **más un chequeo de rol propio**:
  `external-user` es redirigido a `/projects` (`time-allocation/page.tsx:13-15`)
- **Audiencia:** no determinable desde el código. Solo `admin` puede editar y guardar
- **Propósito observado:** grilla semanal proyecto × persona donde se asigna el porcentaje de
  capacidad de cada persona a cada proyecto.
- **Viewports con tratamiento:** ninguno.

## Entrada y salida

**Entradas:**
- Ítem `"Asignación de Tiempo"` de la navegación · `Navbar.tsx:79`

**Salidas:**
- `/projects` · **redirect automático** si el rol es `external-user` ·
  `time-allocation/page.tsx:14`
- La propia pantalla con otra semana · `WeekNavigator` · `WeeklyAllocationTable.tsx:367`

**Redirects automáticos:**
- `/projects` si `session.user.roles` incluye `external-user` · `time-allocation/page.tsx:13-15`

> **Este chequeo es redundante:** el layout de `(loggedin)` ya redirigió a `/unauthorized` a cualquier
> `external-user` antes de llegar acá.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | navegador-semana | `section` | — | ambos | `<WeekNavigator>` | `:367` |
| 2 | boton-semana-anterior | `button` | primary · small | ambos | `<Button label="‹ Anterior" size="small">` | `WeekNavigator.tsx:91` |
| 3 | rango-semana | `paragraph` | body | ambos | `<span className={styles.rangeLabel}>` | `WeekNavigator.tsx:92` |
| 4 | boton-esta-semana | `button` | primary · small · disabled | ambos | `<Button label="Esta semana" disabled={isCurrentWeek}>` | `WeekNavigator.tsx:94` |
| 5 | boton-semana-siguiente | `button` | primary · small | ambos | `<Button label="Siguiente ›" size="small">` | `WeekNavigator.tsx:95` |
| 6 | banner-precarga | `alert` | info | ambos | `<div className={styles.preloadBanner}>` | `:370-372` |
| 7 | cargando-asignaciones | `loader` | — | ambos | `<Loader label="Cargando asignaciones...">` | `:377` |
| 8 | mensaje-error | `alert` | error | ambos | `<div className={styles.emptyState}>` con `<p>` | `:381-385` |
| 9 | vacio-proyectos | `empty-state` | — | ambos | `<div className={styles.emptyState}>` con `<p>` | `:387-391` |
| 10 | tabla-asignaciones | `table` | — | ambos | `<table>` | `:395` |
| 11 | encabezado-persona | `table` | — | ambos | `<th>` por persona | `:400` |
| 12 | fila-grupo | `section` | — | ambos | `<tr className={styles.groupRow}>` con `colSpan` | `:408-411` |
| 13 | celda-editable | `text-input` | default · **overallocated** · disabled | ambos | `<EditableCell>` → `<input type="number" min="0" step="0.1">` | `:297-307`, `EditableCell.tsx:37-44` |
| 14 | celda-lectura | `paragraph` | body | ambos | `<span className={styles.percentage}>` + `<span className={styles.hours}>` | `:322-323` |
| 15 | celda-total-proyecto | `paragraph` | body | ambos | `<td className={styles.totalCell}>` | `:336-337` |
| 16 | fila-total | `table` | — | ambos | `<tr className={styles.totalRow}>` | `:424-430` |
| 17 | boton-guardar | `button` | primary · loading | ambos | `<Button label="Guardar" loading>` | `:438-441` |
| 18 | cargando-vista | `loader` | — | ambos | `<Loader label="Cargando asignaciones...">` como fallback de `<Suspense>` | `time-allocation/page.tsx:20` |

> `navegador-semana`, `fila-grupo` y `vacio-proyectos` se relevaron como `section` y `empty-state`:
> contenedores sin tipo propio en el diccionario.

> **`mensaje-error` y `vacio-proyectos` comparten la clase `.emptyState`** aunque son estados
> distintos. Visualmente son iguales.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- navegador-semana
  - boton-semana-anterior · rango-semana · (boton-esta-semana · boton-semana-siguiente)
  - **Origen:** `WeekNavigator.module.scss` — `.navigation` en fila, con `.rightActions` agrupando
    los dos últimos
- banner-precarga (solo cuando aplica)
- **uno** de: cargando-asignaciones · mensaje-error · vacio-proyectos · tabla-asignaciones
- boton-guardar (solo si `isEditable` y hay proyectos)

**Las fracciones no son derivables:** la pantalla es una pila vertical con una tabla adentro. El
ancho de las columnas de la tabla depende de la cantidad de personas: son `N + 2` columnas
(proyecto + N personas + total).

**Origen de la tabla:** `WeeklyAllocationTable.module.scss:29` — `@include table-container`
(radio, sombra y `overflow: hidden`). **`overflow: hidden`, no `auto`:** con muchas personas las
columnas se comprimen sin scroll horizontal.

## Contenido

### navegador-semana
- Textos verbatim: `"‹ Anterior"` · `"Esta semana"` · `"Siguiente ›"` ·
  `WeekNavigator.tsx:91`, `:94`, `:95`
- rango-semana: dinámico, compuesto con nombres de mes en español en minúscula
  (`"enero"`…`"diciembre"`, `WeekNavigator.tsx:8-19`)
- Annotation: `"Esta semana"` se deshabilita cuando ya se está en la semana actual (`:94`)
- Annotation: los chevrons `‹` y `›` son **caracteres del texto**, no iconos

### banner-precarga
- Texto/label: `"ℹ️ Valores precargados de la semana anterior"`
- Origen: `:371`
- Annotation: el emoji `ℹ️` es parte del string. Aparece cuando la semana está vacía y se copiaron
  los valores de la anterior.

### tabla-asignaciones
- Encabezados: `"Proyecto"` · un `<th>` por persona con su nombre formateado · `"Total"` ·
  `:398-402`
- Grupos de fila (`GROUP_LABELS`, `:68-70`): `"Comerciales activos"` (0) · `"Internos activos"` (1) ·
  `"En análisis"` (2)
- Fila de total: la primera celda dice `"Total"` · `:426`
- Celdas: porcentaje y horas, formateados con `formatPercentage` y `formatHours` · `:322-323`

> **La clasificación de grupo se calcula en el cliente** (`:124-125`): `status === 'activo' &&
> type === 'comercial'` → grupo 0; `status === 'activo'` → grupo 1; el resto → grupo 2. **La api no
> devuelve el grupo.**

### celda-editable
- Origen: `:297`, `EditableCell.tsx:38`
- Annotation: `<input type="number">`. El valor es el **porcentaje** de capacidad; las horas se
  derivan con `hoursPerDay`, que viene de `GET /settings/hours-per-day`.

### mensaje-error
- Texto/label: `"No se pudieron cargar las asignaciones. Intentá de nuevo más tarde."`
- Origen: `:383`
- Annotation: **además** dispara un toast `"Error al cargar las asignaciones de tiempo"` (`:185`), o
  sea que el error se comunica **dos veces**: en pantalla y por toast.

### vacio-proyectos
- Texto/label: `"No hay proyectos con asignaciones para esta semana."`
- Origen: `:389`

### boton-guardar
- Texto/label: `"Guardar"`
- Origen: `:439`
- Annotation: `loading={saveMutation.isPending}` (`:441`). **Solo se renderiza si `isEditable`**
  (`:436`).

### Mensajes de toast
- Éxito: `"Cambios guardados correctamente"` · `:278`
- Error de guardado: `error.message` o `"Error al guardar los cambios"` · `:282`
- Error de carga: `"Error al cargar las asignaciones de tiempo"` · `:185`

## Estados presentes

### loading
- Mensaje: `"Cargando asignaciones..."`
- Disparado por: `isLoadingAllocations || isLoadingHours` (`:152`)
- Origen: `:375-379`
- Cambios: reemplaza la tabla; el navegador de semana queda visible

### error de sistema
- Mensaje en pantalla: `"No se pudieron cargar las asignaciones. Intentá de nuevo más tarde."`
- Mensaje en toast: `"Error al cargar las asignaciones de tiempo"`
- Disparado por: `isErrorAllocations || isErrorHours` (`:153`)
- Origen: `:381-385`, `:184-187`
- Cambios: reemplaza la tabla

> **Es el único caso del producto donde el error de una query se muestra en pantalla Y por toast**, y
> uno de los cuatro que lo maneja en absoluto.

### empty
- Mensaje: `"No hay proyectos con asignaciones para esta semana."`
- Disparado por: `!isLoading && !isError && projects.length === 0` (`:387`)
- Origen: `:387-391`
- Cambios: reemplaza la tabla

> **Los tres estados son mutuamente excluyentes y explícitos:** cada bloque chequea `!isLoading &&
> !isError` antes de renderizar (`:381`, `:387`, `:393`). Es el manejo más riguroso del producto.

### default
- Disparado por: `!isLoading && !isError && projects.length > 0` (`:393`)
- Origen: `:393-434`

### precarga desde la semana anterior
- Mensaje: `"ℹ️ Valores precargados de la semana anterior"`
- Disparado por: `shouldFetchPrevious && allocations.length === 0 &&
  previousWeekData.allocations.length > 0` (`:203-206`)
- Origen: `:370-372`, `:201-216`
- Cambios: aparece el banner y las celdas vienen con los valores de la semana anterior
- Annotation: `shouldFetchPrevious` requiere `allocations.length === 0 && isAdmin && isEditable`
  (`:176`), o sea que **solo un admin, en una semana editable y vacía, dispara la precarga**

### sobreasignación (sub-estado de default)
- Disparado por: `overallocatedPersons.has(personId)` en las celdas (`:293`) y
  `totalPercentage > 100` en la fila de total (`:348`)
- Origen: `:293`, `:306`, `:319`, `:348`, `:354`, `EditableCell.module.scss:34-39`
- Cambios: **las tres capas se marcan a la vez** — la celda editable (fondo
  `rgba(251, 3, 63, 0.1)`, borde y texto en `--color-objective-expired`), la celda de lectura, y la
  celda del total de esa persona
- Annotation: **es color puro.** No hay texto, ni icono, ni `aria-invalid`, ni mensaje. Y **no
  bloquea el guardado.**

### solo lectura (no editable)
- Disparado por: `!isAdmin || !isWeekEditable(weekStart)` (`:170-171`)
- Origen: `:296`, `:436`
- Cambios: las celdas se renderizan como `celda-lectura` en vez de `celda-editable`, y el botón de
  guardar **no se renderiza**

**Regla de editabilidad** (`:155-171`), copiada del código:
- **Los domingos**, solo las semanas **futuras** son editables (`week > currentMonday`)
- **El resto de los días**, la semana actual y las futuras (`week >= currentMonday`)
- Y siempre, además, `isAdmin`

> El comentario del código dice *"On Sunday, only future weeks are editable"* / *"On other days,
> current and future weeks are editable"*. **No dice por qué el domingo es distinto.**

### loading del guardado
- Mensaje: spinner en el botón vía `<Button loading>`
- Disparado por: `saveMutation.isPending`
- Origen: `:441`

### success / error del guardado
- Toasts: `"Cambios guardados correctamente"` / `error.message` o
  `"Error al guardar los cambios"`
- Origen: `:278`, `:282-283`

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **por qué no se puede editar** | **no se explica.** Con la semana no editable, las celdas son texto y el botón de guardar desaparece. **Nada dice si es por el rol, por la semana pasada, o por ser domingo.** Es el gap principal de esta pantalla | `:296`, `:436` |
| **bloqueo de la sobreasignación** | la sobreasignación **sí se marca visualmente** (ver "Estados presentes") pero **no bloquea el guardado**: se puede guardar una persona al 150% sin ninguna advertencia ni confirmación | `:436-442` — el botón no consulta `overallocatedPersons` |
| **explicación de la sobreasignación** | la marca es **solo color**: fondo rojo claro y borde/texto rojo, **sin texto, sin icono y sin `aria-invalid`**. Un usuario que no distingue el color, o uno de lector de pantalla, no recibe la señal | `EditableCell.module.scss:34-39`, `EditableCell.tsx:32-44` |
| tope del input | tiene `min="0"` y `step="0.1"` pero **no `max`**: el 100% no es un tope duro, lo cual es coherente con que la sobreasignación se marque en vez de prevenirse | `EditableCell.tsx:41-42` |
| **cambios sin guardar al navegar de semana** | **no hay aviso.** Editar celdas y apretar `"Siguiente ›"` descarta lo editado: el `useEffect` de `:190-199` repuebla `localAllocations` con los datos de la semana nueva | `:190-199`, `:367` |
| confirmación al salir con cambios | no existe | `:366-444` |
| error de validación | no hay validación de ningún tipo | — |
| not found | no aplica | — |
| **loading de la precarga** | la query de la semana anterior corre en segundo plano; mientras llega, la tabla se muestra vacía y después las celdas se llenan de golpe, con el banner apareciendo después | `:180-182`, `:201-216` |
| empty de una persona sin asignaciones | no aplica: las personas son columnas, no filas | `:400` |

## Interacciones

**Eventos:**
- boton-semana-anterior / siguiente · click → cambia `weekStart` → refetch ·
  `WeekNavigator.tsx:91`, `:95`, `:367`
- boton-esta-semana · click → vuelve a la semana actual; deshabilitado si ya está ahí ·
  `WeekNavigator.tsx:94`
- celda-editable · on change → actualiza `localAllocations[personId-projectId]` ·
  `:297`, `EditableCell.tsx`
- boton-guardar · click → `saveMutation` con el estado local · `:440`

**Validaciones:**
- `celda-editable` · `min="0"` y `step="0.1"` nativos del `<input type="number">` ·
  `EditableCell.tsx:41-42`
- suma por persona > 100% → **marca visual** en las celdas de esa persona y en su total, **sin
  bloquear el guardado** · `:293`, `:348`
- **No hay ninguna otra regla**, y ninguna impide guardar.

**Feedback:**
- Total por proyecto (columna) y por persona (fila de total), recalculados en vivo
- Banner de precarga
- Spinner en el botón de guardar
- Toasts de resultado

**Derivación de horas:** el porcentaje se convierte a horas con `hoursPerDay`, que viene de
`GET /settings/hours-per-day` (`:88-91`). Cada celda muestra las dos cosas (`:322-323`).

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Encabezados de tabla | `<th>` para `"Proyecto"`, cada persona y `"Total"`, dentro de `<thead>`. Correcto | `:397-403` |
| **Filas de grupo** | `<tr className={styles.groupRow}>` con un `<td colSpan>`: es una **fila de datos que actúa como encabezado de sección**, sin `<th scope="rowgroup">` ni `<tbody>` por grupo. Los lectores de pantalla no la anuncian como agrupamiento | `:408-411` |
| **Celdas sin nombre accesible** | `<EditableCell>` es un `<input type="number">` **sin `<label>` ni `aria-label`**. En una grilla de N×M, un lector de pantalla anuncia el input sin decir de qué persona ni de qué proyecto es. `<th>` de fila **no existe**: la primera celda de cada fila es un `<td>` (`:415`) | `EditableCell.tsx:37-44`, `:415-417` |
| Rango del input | `min="0"` presente, sin `max`. El navegador lo expone, así que el mínimo sí se anuncia | `EditableCell.tsx:41-42` |
| **Sobreasignación solo por color** | El estado de sobreasignación se comunica **únicamente con color** (fondo rojo claro, borde y texto rojos), sin `aria-invalid`, sin texto y sin icono | `EditableCell.module.scss:34-39` |
| Botones del navegador | Textos `"‹ Anterior"`, `"Esta semana"`, `"Siguiente ›"`. Los chevrons son caracteres del texto, así que **se leen como parte del nombre** (`"‹ Anterior"` se anuncia con el símbolo) | `WeekNavigator.tsx:91`, `:95` |
| `"Esta semana"` deshabilitado | `disabled` sin `aria-describedby` que diga que ya está en la semana actual | `WeekNavigator.tsx:94` |
| Banner de precarga | Es un `<div>` **sin `role="status"` ni `aria-live`**: aparece después del render inicial y **no se anuncia** | `:370-372` |
| Mensaje de error | `<div>` con `<p>` **sin `role="alert"`**. El toast sí se anuncia (`react-toastify` usa `role="alert"`), así que la información llega por ese canal | `:381-385`, `:185` |
| Estado no editable | **no anunciado.** Las celdas pasan de `<input>` a `<span>` sin ninguna indicación de por qué | `:296` |
| Totales recalculados | Cambian al editar **sin `aria-live`**: un usuario de lector de pantalla no sabe que el total se actualizó | `:340-360` |
| Nombre accesible del botón en loading | Correcto vía `<Button>` | `Button.tsx:48`, `:53-57` |
| Jerarquía de encabezados | Solo el `<h1>` del `PageLayout` (`"Asignación de Tiempo"`) | `time-allocation/page.tsx:18` |

## Observaciones del relevamiento

- **Es la referencia positiva del producto en manejo de estados de datos.** Los tres estados
  (`isLoading`, `isError`, `length === 0`) se chequean explícitamente y son mutuamente excluyentes
  (`:375-393`). Ninguna otra pantalla lo hace así: el resto ignora `isError` o lo manda solo a un
  toast.
- **El error se comunica dos veces**, en pantalla y por toast (`:184-187`, `:381-385`). Es
  redundante, pero significa que el mensaje también se anuncia a lectores de pantalla — que es más de
  lo que logran las otras pantallas.
- **La grilla no es accesible.** Sin `<th scope="row">` para el proyecto y sin `aria-label` en los
  inputs, una celda editable de una grilla N×M no tiene contexto: se anuncia como un campo numérico
  suelto. Es el problema más severo de accesibilidad del producto, porque la pantalla **es** la
  grilla.
- **La sobreasignación se detecta y se marca, pero no se explica ni se bloquea.** El código calcula
  `overallocatedPersons` y pinta las celdas y el total de esa persona en rojo (`:293`, `:348`,
  `EditableCell.module.scss:34-39`). Es más de lo que hace el resto del producto — pero la señal es
  **solo color**, sin texto ni `aria-invalid`, y el botón de guardar no consulta ese estado: una
  persona al 150% se guarda igual. **A verificar en `api`** si hay validación del lado del servidor.
- **La razón de no poder editar nunca se dice.** Con tres condiciones posibles (no sos admin, es una
  semana pasada, es domingo y es la semana actual), la UI simplemente muestra texto en vez de inputs.
- **La regla del domingo no está explicada.** El comentario dice qué hace, no por qué
  (`:155-167`). Es una regla de negocio con impacto directo en quién puede hacer qué y cuándo.
- **Los cambios sin guardar se pierden al cambiar de semana** (`:190-199`), sin aviso. En una grilla
  que se llena a mano celda por celda, es una pérdida de trabajo real.
- **La clasificación en grupos se calcula en el cliente** (`:124-125`) a partir de `status` y `type`
  del proyecto. Cambiar los criterios requiere tocar el frontend.
- **La precarga tiene tres condiciones y un banner** (`:176`, `:201-216`, `:370-372`), pero el banner
  aparece **después** de que las celdas ya se llenaron, sin `aria-live`.
- **A confirmar en consolidación:** si la suma por persona debe validarse, si hace falta explicar por
  qué no se puede editar, y de dónde viene la regla del domingo.
