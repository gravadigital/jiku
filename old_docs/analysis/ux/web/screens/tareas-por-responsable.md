---
document: UX Survey Screen
screen: tareas-por-responsable
route: /objectives/by-responsible
service: web
source_files:
  - src/app/(loggedin)/objectives/by-responsible/page.tsx
  - src/app/(loggedin)/objectives/by-responsible/loading.tsx
  - src/app/(loggedin)/objectives/by-responsible/error.tsx
  - src/features/objectives/components/ObjectivesGroup/ObjectivesGroup.tsx
  - src/features/objectives/components/ObjectiveCard/ObjectiveCard.tsx
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: tareas-por-responsable

> **Relevamiento as-is** de `/objectives/by-responsible`, extraído de
> `src/app/(loggedin)/objectives/by-responsible/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> **Comparte el componente de grupo y de card con [tareas-por-proyecto](./tareas-por-proyecto.md)**;
> este survey documenta las diferencias en detalle y remite a ese para lo compartido.

## Identidad

- **Ruta:** `/objectives/by-responsible`
- **Archivo:** `src/app/(loggedin)/objectives/by-responsible/page.tsx` (Server Component, 85 líneas)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** agrupa las tareas activas por persona responsable, ordenadas por fecha
  estimada de finalización.
- **Viewports con tratamiento:** la grilla de cards se adapta por `auto-fit` con un corte en
  `≥1680px`. Sin tratamiento mobile.

## Diferencias con `tareas-por-proyecto`

| # | Diferencia | Origen |
|---|---|---|
| 1 | Agrupa por **persona**, no por proyecto. Una tarea con N responsables **aparece en N grupos** | `:38-48` |
| 2 | **Sin tag de horas del mes:** no se pasa `currentMonthHours`, así que el bloque no se renderiza | `:73-79` vs `ObjectivesGroup.tsx:65` |
| 3 | El botón `+` va a `/objectives/new?personId={id}`, no `?projectId=` | `ObjectivesGroup.tsx:15-16` |
| 4 | Las cards muestran el proyecto (`showProject`), que en la otra vista es redundante | `:78` |
| 5 | Filtra solo `state: 'activo'`, sin más filtros | `:17-19` |
| 6 | **Sin `<ScrollToProject>`:** no hay navegación por ancla hacia esta vista | comparar con `by-project/page.tsx:17` |
| 7 | Todo el ordenamiento y agrupamiento ocurre **en el servidor, en la página** | `:27-64` |

## Entrada y salida

**Entradas:**
- Subítem `"Por responsable"` de la navegación · `Navbar.tsx:73`

**Salidas:**
- `/objectives/{id}` · click en cualquier card · `ObjectiveCard.tsx:108`
- `/objectives/new?personId={id}` · botón `+` del encabezado de cada grupo ·
  `ObjectivesGroup.tsx:74` (vía `buildHref()`)

**Redirects automáticos:**
- Ninguno.

> **Nada enlaza de vuelta a esta vista.** `detalle-tarea` siempre vuelve a
> `/objectives/by-project`, incluso si se entró desde acá.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | grupo-persona | `section` | — | ambos | `<ObjectivesGroup>` | `:73-79` |
| 2 | titulo-grupo | `heading` | h2 | ambos | `<h2 className={styles.title}>` con el nombre completo | `ObjectivesGroup.tsx:62-64` |
| 3 | boton-nueva-tarea-grupo | `button` | — | ambos | `<AddButton href="/objectives/new?personId={id}">` | `ObjectivesGroup.tsx:74` |
| 4 | grilla-tareas | `list` | — | ambos | `<div className={styles.containerObjectives}>` | `ObjectivesGroup.tsx:77` |
| 5 | card-tarea | `card` | por `data-state` de vencimiento | ambos | `<ObjectiveCard showProject>` | `ObjectivesGroup.tsx:81` |
| 6 | contenedor-portal | — | — | — | `<div ref={portalContainerRef}>` — destino del date-picker de `FinishDateLabel` | `ObjectivesGroup.tsx:109` |
| 7 | date-picker-cierre | `date-picker` | open | ambos | `<DatePicker inline>` por portal | `FinishDateLabel.tsx:175-191` |
| 8 | cargando-vista | `loader` | — | ambos | `<Loader label="Cargando...">` | `by-responsible/loading.tsx:5` |
| 9 | pantalla-error | `alert` | error | ambos | `error.tsx` de la ruta | `by-responsible/error.tsx` |

> **No hay `tag-horas-mes` ni su tooltip**, a diferencia de `tareas-por-proyecto`: el bloque se
> renderiza solo si `currentMonthHours` está definido (`ObjectivesGroup.tsx:65`) y esta página no lo
> pasa.

El resto de los bloques internos de la card (pill de estado, tag de área y responsable, horas
trabajadas con su tooltip, tres etiquetas de fecha) son los mismos que en
[tareas-por-proyecto](./tareas-por-proyecto.md).

## Layout observado por viewport

### desktop · ≤1679px

- grupo-persona × N (pila vertical)
  - titulo-grupo · boton-nueva-tarea-grupo (fila, dentro del `<h2>`)
  - grilla-tareas: card-tarea × N, columnas de **350px mínimo** con `auto-fit`
- contenedor-portal

### desktop grande · ≥1680px

Igual, con la grilla fija en **4 columnas de 3/12** cada una.

**Origen:** `ObjectivesGroup.module.scss:88-89` y `:93-95`. Idéntico a
[tareas-por-proyecto](./tareas-por-proyecto.md).

**Las fracciones no son derivables** por debajo de 1680px: dependen del ancho disponible.

## Contenido

### titulo-grupo
- Texto/label: dinámico — el nombre completo de la persona, compuesto en la página:

  ```tsx
  const fullName = `${person.person.firstName}
   ${person.person.lastName}`;
  ```
  `by-responsible/page.tsx:70-71`

- Origen: `:75`
- Annotation: **el template string contiene un salto de línea literal** entre nombre y apellido, más
  un espacio de indentación. En HTML el whitespace colapsa a un solo espacio, así que se ve bien —
  pero el valor del string tiene `"\n   "` en el medio. Es un artefacto del formateo del código, no
  una decisión.

### boton-nueva-tarea-grupo
- Texto/label: sin texto visible. Nombre accesible `"add icon"` (ver Accesibilidad)
- Origen: `ObjectivesGroup.tsx:74`
- Annotation: el `href` incluye `?personId={id}` para precargar el responsable en el alta
  (`ObjectivesGroup.tsx:15-16`)

### card-tarea
- Igual que en `tareas-por-proyecto`, **con `showProject`** (`:78`), que hace que el tooltip del
  responsable muestre el nombre del proyecto en vez de la lista de responsables
  (`AreaTag.tsx:35`)
- Origen: `ObjectivesGroup.tsx:81`

### cargando-vista
- Texto/label: `"Cargando..."`
- Origen: `by-responsible/loading.tsx:5`

## Estados presentes

### default
- Disparado por: `getObjectives({ state: 'activo' })` resuelve con al menos una tarea con
  responsable
- Origen: `by-responsible/page.tsx:66-84`

### loading
- Mensaje: `"Cargando..."`
- Disparado por: el `loading.tsx` de la ruta
- Origen: `by-responsible/loading.tsx`
- Cambios: es todo lo que se ve; la sidebar queda

### error de sistema (render)
- Origen: `by-responsible/error.tsx`
- Annotation: **casi no se dispara**, porque la llamada está envuelta en `try/catch`. Ver estados
  ausentes.

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error de la api** | **invisible.** `try { objectives = await getObjectives(filters) } catch (error) { console.error(error) }` deja `objectives = []`. La pantalla renderiza el título y nada más | `by-responsible/page.tsx:20-25` |
| **empty** | **no existe.** `personsList.map(...)` sobre un array vacío no renderiza nada y **no hay chequeo de largo**: queda el `<h1>Tareas por responsable"` con el contenido en blanco | `by-responsible/page.tsx:69` |
| **tareas sin responsable** | **desaparecen de la vista.** El agrupamiento recorre `objective.persons` (`:39`): una tarea activa sin nadie asignado no entra en ningún grupo y **no se muestra en ningún lado de esta pantalla**. No hay grupo "Sin asignar" | `by-responsible/page.tsx:38-48` |
| empty por grupo | no puede ocurrir: un grupo existe solo porque tiene al menos una tarea | `:40-46` |
| error de validación | no aplica | — |
| success | el cambio de estado inline de una card sí produce toast | `StateTag.tsx:59` |
| not found | no aplica | — |
| estado terminal / readonly | no aplica de forma visible: la vista filtra `state: 'activo'`, así que no muestra tareas finalizadas ni canceladas | `:17-19` |
| **paginación / límite** | **no existe.** Se renderizan todas las personas con todas sus tareas activas | `:69`, `ObjectivesGroup.tsx:78` |
| **filtros** | **no hay ninguno.** A diferencia de `listado-tareas` (6 filtros), esta vista es fija: solo tareas activas, todas las personas | `:17-19` |

## Interacciones

**Eventos:**
- card-tarea · click → navega a `/objectives/{id}` · `ObjectiveCard.tsx:108`
- pill-estado · click → abre el dropdown; seleccionar → muta el estado ·
  `StateTag.tsx:74-78`, `:55-64`
- boton-nueva-tarea-grupo · click → navega a `/objectives/new?personId={id}` ·
  `ObjectivesGroup.tsx:74`
- etiqueta-fecha-cierre · click → abre el date-picker por portal ·
  `FinishDateLabel.tsx:166`
- horas-trabajadas · hover → tooltip con el desglose por persona · `ObjectiveCard.tsx:148-163`

**Validaciones:**
- Ninguna.

**Feedback:**
- Estado visual de vencimiento por `data-state` en la card
- Tooltips de horas y de área
- Toast del cambio de estado

**Ordenamiento (todo en el servidor):**

1. Las tareas se ordenan por `estimatedFinishDate` ascendente, con las sin fecha al final
   (`Infinity`) · `:27-35`
2. Se agrupan por persona recorriendo `objective.persons` · `:38-48`
3. Los grupos se ordenan por `"{firstName} {lastName}"` en minúsculas · `:50-61`

> **El comparador del paso 3 nunca devuelve `0`:** `if (fullName1 > fullName2) return 1; return -1;`
> (`:57-60`). Con dos nombres iguales devuelve `-1`, lo que no es un comparador válido. En la práctica
> `Array.sort` sigue funcionando, pero el orden entre homónimos es indefinido.

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Jerarquía de encabezados | `<h1>` del `PageLayout` (`"Tareas por responsable"`) y `<h2>` por persona. **El `<h2>` contiene el `<AddButton>`**, así que su nombre accesible es `"{nombre} add icon"` | `by-responsible/page.tsx:67`, `ObjectivesGroup.tsx:62-76` |
| **`boton-nueva-tarea-grupo` sin nombre accesible** | `<AddButton>` es un `<button>` cuyo único contenido es `<Image alt="add icon">`, **sin `aria-label`** | `AddButton.tsx:30-42` |
| Card como link | La card entera es un `<Link>`: enfocable y navegable. Correcto | `ObjectiveCard.tsx:108` |
| `pill-estado` dentro del link | `<button>` dentro de `<Link>`: contenido interactivo anidado | `ObjectiveCard.tsx:108`, `:125` |
| Área solo por color | `<span>` vacío con `data-area`, nombre en tooltip de `:hover` | `AreaTag.tsx:32-34` |
| `date-picker-cierre` | Disparador `<div onClick>` sin `role` ni `tabIndex`: **escritura inalcanzable por teclado** | `FinishDateLabel.tsx:162-167` |
| Semántica de la grilla | `<div>` con `display: grid`, sin `role="list"` ni conteo | `ObjectivesGroup.tsx:77` |
| Iconos decorativos | `alt="responsable icon"`, `"schedule icon"`, `"question icon"`, `"calendar icon"`: describen el icono, no su función | `ObjectiveCard.tsx:116`, `:143`, `:163`, `FinishDateLabel.tsx:170` |
| Tarea repetida en varios grupos | Una tarea con 3 responsables aparece 3 veces. **Nada indica que es la misma tarea**: los tres links llevan al mismo destino sin señalarlo | `by-responsible/page.tsx:38-48` |

## Observaciones del relevamiento

- **Una tarea con N responsables aparece N veces**, una por grupo (`:38-48`). Es coherente con el
  propósito de la vista (qué tiene cada persona), pero nada en la UI indica que son la misma tarea, y
  el conteo total de cards no coincide con la cantidad de tareas.
- **Las tareas sin responsable no aparecen.** El agrupamiento recorre `objective.persons`, así que una
  tarea activa sin nadie asignado queda fuera de esta vista por completo. `listado-tareas` sí las
  muestra (su filtro de responsable tiene la opción `"Cualquiera"`). **No hay grupo "Sin asignar".**
- **No hay estado vacío ni de error**, igual que en `tareas-por-proyecto`: el `try/catch` silencioso
  más el `.map()` sin chequeo de largo hacen que un fallo de red y un sistema sin datos den la misma
  pantalla en blanco.
- **El comparador de ordenamiento de grupos no devuelve `0`** (`:57-60`). No rompe nada visible, pero
  el orden entre nombres idénticos es indefinido.
- **El nombre completo se compone con un salto de línea literal** en el template string
  (`:70-71`). HTML lo colapsa, así que no se ve — pero el string que llega al `<h2>` contiene
  `"\n   "`.
- **Sin tag de horas del mes**, a diferencia de la vista por proyecto. La prop existe en
  `<ObjectivesGroup>` y esta página no la pasa: **el mismo componente rinde distinto en las dos
  pantallas** sin que nada lo declare en la UI.
- **Esta vista no tiene filtros.** `listado-tareas` tiene 6; acá el estado está fijo en `activo`
  (`:17-19`) y no hay forma de ver otras tareas de una persona sin ir al listado general.
- **Es una vista huérfana en la vuelta:** `detalle-tarea` siempre vuelve a
  `/objectives/by-project`, así que entrar a una tarea desde acá y volver deja al usuario en la otra
  vista.
- **A confirmar en consolidación:** si las tareas sin responsable deberían tener grupo, si hace falta
  estado vacío y de error, y si la vista debería tener al menos el filtro de estado.
