---
name: tareas-por-responsable
surface: web
route: /objectives/by-responsible
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.1"
date: 2026-09-02
---

# Pantalla: Tareas por responsable

## Identidad

- **Audiencia primaria:** equipo-interno.
- **JTBD / Propósito:** ver las tareas activas agrupadas por persona responsable, ordenadas por fecha estimada de finalización [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport de la superficie. La grilla de cards se adapta por `auto-fit` con columnas de 350px mínimo y se fija en 4 columnas a partir de 1680px (`ObjectivesGroup.module.scss:88-89`, `:93-95`) [fuente: código-existente].
  - Mobile queda fuera de la superficie `web`: el shell tiene una sidebar de 290px fija sin ninguna media query, así que por debajo de ese ancho no hay navegación disponible (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente]. La pantalla tampoco declara tratamiento mobile propio.
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Desde la navegación del shell · subítem `"Por responsable"` (`Navbar.tsx:73`)

**Salidas user-driven:**
- A `/objectives/{id}` · click en cualquier card-tarea (`ObjectiveCard.tsx:108`)
- A `/objectives/new?personId={id}` · click en boton-nueva-tarea-grupo (`ObjectivesGroup.tsx:74`, vía `buildHref()`)

**Salidas automáticas:**
- Ninguna.

Nota [fuente: código-existente]: **nada enlaza de vuelta a esta vista.** `detalle-tarea` siempre vuelve a `/objectives/by-project`, incluso si se entró desde acá.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | grupo-persona | section | — | layout | desktop | — | Agrupa las tareas de una persona |
| 2 | titulo-grupo | heading | h2 | content | desktop | — | Nombre completo de la persona |
| 3 | boton-nueva-tarea-grupo | button | — | input | desktop | — | Alta de tarea precargada con el responsable |
| 4 | grilla-tareas | list | — | layout | desktop | — | Cards de las tareas del grupo |
| 5 | card-tarea | card | por `data-state` de vencimiento | navigation | desktop | — | Una tarea, navega al detalle |
| 6 | contenedor-portal | — | — | layout | desktop | — | Destino del portal del date-picker |
| 7 | date-picker-cierre | date-picker | open | input | desktop | visible_only_in_states: date-picker abierto | Edita la fecha de cierre desde la card |
| 8 | cargando-vista | loader | — | feedback | desktop | visible_only_in_states: loading | `loading.tsx` de la ruta |
| 9 | pantalla-error | alert | error | feedback | desktop | visible_only_in_states: error de sistema | `error.tsx` de la ruta |

**Origen:** `src/app/(loggedin)/objectives/by-responsible/page.tsx`, `src/app/(loggedin)/objectives/by-responsible/loading.tsx`, `src/app/(loggedin)/objectives/by-responsible/error.tsx`, `src/features/objectives/components/ObjectivesGroup/ObjectivesGroup.tsx`, `src/features/objectives/components/ObjectiveCard/ObjectiveCard.tsx`.

Notas de transcripción [fuente: código-existente]:
- **No hay `tag-horas-mes` ni su tooltip**, a diferencia de tareas-por-proyecto: el bloque se renderiza solo si `currentMonthHours` está definido (`ObjectivesGroup.tsx:65`) y esta página no lo pasa.
- El resto de los bloques internos de la card (pill de estado, tag de área y responsable, horas trabajadas con su tooltip, las tres etiquetas de fecha) son los mismos que en tareas-por-proyecto y están documentados en esa pantalla.
- Las cards se renderizan con `showProject` (`:78`), lo que hace que el tooltip del responsable muestre el nombre del proyecto en vez de la lista de responsables (`AreaTag.tsx:35`).

## Layout por viewport

### desktop · 1440px

- grupo-persona × N (pila vertical)
  - row `cabecera` (dentro del `<h2>`): titulo-grupo · boton-nueva-tarea-grupo
  - grilla-tareas: card-tarea × N, en columnas de **350px mínimo** con `auto-fit`
- contenedor-portal

**Origen:** `ObjectivesGroup.module.scss:88-89` y `:93-95`, idéntico a tareas-por-proyecto [fuente: código-existente].

**Las fracciones de la grilla no son derivables** por debajo de 1680px: la cantidad de columnas depende del ancho disponible. A partir de **1680px** la grilla se fija en **4 columnas de 3/12** cada una.

## Contenido

### grupo-persona
- Texto/label: contenedor sin texto propio
- Icono: nada
- Asset: nada
- Annotation: `<ObjectivesGroup>` (`:73-79`)

### titulo-grupo
- Texto/label: dinámico — el nombre completo de la persona, compuesto en la página (`by-responsible/page.tsx:70-71`):

  ```tsx
  const fullName = `${person.person.firstName}
   ${person.person.lastName}`;
  ```

- Icono: nada
- Asset: nada
- Annotation: **el template string contiene un salto de línea literal** entre nombre y apellido, más un espacio de indentación. En HTML el whitespace colapsa a un solo espacio, así que se ve bien, pero el valor del string tiene `"\n   "` en el medio (`:75`)

### boton-nueva-tarea-grupo
- Texto/label: sin texto visible. Nombre accesible `"add icon"` (`ObjectivesGroup.tsx:74`, `AddButton.tsx:30-42`)
- Icono: `add icon`
- Asset: nada
- Annotation: el `href` incluye `?personId={id}` para precargar el responsable en el alta (`ObjectivesGroup.tsx:15-16`)

### grilla-tareas
- Texto/label: contenedor de las cards
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.containerObjectives}>` con `display: grid` (`ObjectivesGroup.tsx:77`)

### card-tarea
- Texto/label: igual que en tareas-por-proyecto — título dinámico, horas, estado, área y responsable, tres etiquetas de fecha
- Icono: nada
- Asset: nada
- Annotation: `<ObjectiveCard showProject>` (`ObjectivesGroup.tsx:81`, `:78`). La card entera es un `<Link>` a `/objectives/{id}` (`ObjectiveCard.tsx:108`)

### contenedor-portal
- Texto/label: vacío
- Icono: nada
- Asset: nada
- Annotation: `<div ref={portalContainerRef}>` (`ObjectivesGroup.tsx:109`)

### date-picker-cierre
- Texto/label: el calendario de `react-datepicker`
- Icono: nada
- Asset: nada
- Annotation: `<DatePicker inline>` montado por portal (`FinishDateLabel.tsx:175-191`). Permite editar la fecha de cierre estimada desde la card

### cargando-vista
- Texto/label: `"Cargando..."` (`by-responsible/loading.tsx:5`)
- Icono: nada
- Asset: nada
- Annotation: `<Loader>` del `loading.tsx` de la ruta

### pantalla-error
- Texto/label: el del `error.tsx` de la ruta (`by-responsible/error.tsx`)
- Icono: nada
- Asset: nada
- Annotation: casi no se dispara, porque la llamada está envuelta en su propio `try/catch`

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). `getObjectives({ state: 'activo' })` resuelve con al menos una tarea con responsable (`by-responsible/page.tsx:66-84`)
- Sub-estados de vencimiento por card (`data-state`): `finished` · `expiresToday` · `expired` · `closeToDeadline` · `default`
- Sub-estado `date-picker abierto`: click en la etiqueta de fecha de cierre monta date-picker-cierre en contenedor-portal (`FinishDateLabel.tsx:166`)

### empty
- Aplica: No — no implementado (ver gaps-as-is.md). `personsList.map(...)` sobre un array vacío no renderiza nada y no hay chequeo de largo: queda el `<h1>` con el contenido en blanco (`by-responsible/page.tsx:69`). El empty por grupo no puede ocurrir, porque un grupo existe solo porque tiene al menos una tarea (`:40-46`) [fuente: código-existente]

### loading
- Aplica: Sí
- Mensaje: `"Cargando..."` (`by-responsible/loading.tsx:5`)
- Cambios:
  - cargando-vista: solo visible en este estado; es todo lo que se ve en el área de contenido, la sidebar del shell queda
- Nota: **no hay loading del cambio de estado inline:** la pill no se deshabilita ni muestra spinner durante la mutación (`StateTag.tsx:82-89`)

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). La pantalla no tiene formulario

### error de sistema / sin conexión
- Aplica: No — no implementado (ver gaps-as-is.md). `try { objectives = await getObjectives(filters) } catch (error) { console.error(error) }` deja `objectives = []`, así que la pantalla renderiza el título y nada más (`by-responsible/page.tsx:20-25`). El `error.tsx` de la ruta existe pero casi nunca se dispara por ese mismo `try/catch` [fuente: código-existente]

### success
- Aplica: Sí
- Mensaje: toast `` `Se cambió el estado de la tarea a ${newValue}` `` (`StateTag.tsx:59`)
- Cambios: solo el toast, tras el cambio de estado inline de una card

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). La vista filtra `state: 'activo'`, así que no muestra tareas finalizadas ni canceladas, pero el dropdown de estado de cada card ofrece las 5 opciones igual (`:17-19`, `StateTag.tsx:21-25`) [fuente: código-existente]

## Interacciones

**Eventos:** [fuente: código-existente]
- card-tarea · click → navega a `/objectives/{id}` (`ObjectiveCard.tsx:108`)
- pill-estado de la card · click → abre el dropdown; seleccionar → muta el estado (`StateTag.tsx:74-78`, `:55-64`)
- boton-nueva-tarea-grupo · click → navega a `/objectives/new?personId={id}` (`ObjectivesGroup.tsx:74`)
- etiqueta-fecha-cierre de la card · click → abre el date-picker por portal (`FinishDateLabel.tsx:166`)
- horas-trabajadas de la card · hover → tooltip con el desglose por persona (`ObjectiveCard.tsx:148-163`)

**Validaciones:**
- Ninguna.

**Feedback:**
- Estado visual de vencimiento por `data-state` en la card
- Tooltips de horas y de área
- Toast del cambio de estado

**Ordenamiento (todo en el servidor)** [fuente: código-existente]:
1. Las tareas se ordenan por `estimatedFinishDate` ascendente, con las sin fecha al final (`Infinity`) (`:27-35`)
2. Se agrupan por persona recorriendo `objective.persons` (`:38-48`) — **una tarea con N responsables aparece en N grupos**
3. Los grupos se ordenan por `"{firstName} {lastName}"` en minúsculas (`:50-61`). **El comparador nunca devuelve `0`:** `if (fullName1 > fullName2) return 1; return -1;` (`:57-60`), así que el orden entre homónimos es indefinido

**Filtros** [fuente: código-existente]: **no hay ninguno.** La vista es fija: solo tareas activas, todas las personas (`:17-19`). Tampoco hay paginación ni límite (`:69`, `ObjectivesGroup.tsx:78`).

**Datos ausentes** [fuente: código-existente]: **las tareas sin responsable desaparecen de la vista.** El agrupamiento recorre `objective.persons` (`:39`), así que una tarea activa sin nadie asignado no entra en ningún grupo y no se muestra; no hay grupo "Sin asignar".

## Accesibilidad

- **Orden de foco:** por cada grupo: boton-nueva-tarea-grupo → card-tarea × N (la card entera es un `<Link>`, enfocable y navegable, `ObjectiveCard.tsx:108`). **La pill de estado es un `<button>` dentro del `<Link>` de la card** (`:125`): contenido interactivo anidado. **La etiqueta de fecha de cierre queda fuera del orden de foco:** su disparador es un `<div onClick>` sin `role` ni `tabIndex`, así que esa escritura es **inalcanzable por teclado** (`FinishDateLabel.tsx:162-167`) [fuente: código-existente].
- **Landmarks y jerarquía:** los landmarks son los del shell. Un solo `<h1>`, el del `PageLayout` (`"Tareas por responsable"`, `by-responsible/page.tsx:67`), y un `<h2>` por persona. **El `<h2>` contiene el `<AddButton>`** (`ObjectivesGroup.tsx:62-76`), así que su nombre accesible queda como `"{nombre} add icon"`.
- **Foco y teclado:** los overlays de esta composición son el dropdown de estado de cada card (`StateTag`) y el date-picker de la fecha de cierre montado por portal; ninguno atrapa el foco. No hay atajos propios.
- **Propio de esta composición:** **una tarea con N responsables aparece N veces, una por grupo, y nada indica que es la misma tarea** (`by-responsible/page.tsx:38-48`): los N links llevan al mismo destino sin señalarlo, y el conteo total de cards no coincide con la cantidad de tareas. **`boton-nueva-tarea-grupo` no tiene nombre accesible útil:** su único contenido es `<Image alt="add icon">`, sin `aria-label` (`AddButton.tsx:30-42`). **El área se comunica solo por color** (`AreaTag.tsx:32-34`). La grilla es un `<div>` con `display: grid`, sin `role="list"` ni conteo (`ObjectivesGroup.tsx:77`). Los iconos decorativos usan `alt="responsable icon"`, `"schedule icon"`, `"question icon"` y `"calendar icon"`, que describen el icono y no su función (`ObjectiveCard.tsx:116`, `:143`, `:163`, `FinishDateLabel.tsx:170`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
- **[REQ-013] La identidad cambia; la pantalla, no.** Esta ficha documenta *qué* hay en la pantalla y *para qué* está; el Manual de marca Jiku v1.0 cambia **con qué está construido**. El accent pasa del magenta `#DA2C6A` al verde agua `#61CCB9` sobre azul oscuro `#0B1934` con fondo niebla `#F6F6F9`, y Archivo se reemplaza por Sora (títulos de vista) + Gabarito (interfaz, datos, microcopy). Ningún bloque de esta pantalla se agrega, se elimina ni cambia de propósito por ese motivo [REQ-013 RF-1, RF-2, CA-1].
- **[REQ-013] Cada elemento hecho a mano pasa a su componente del Design System.** Los bloques que esta ficha declara —botones, campos, selects, tarjetas, tablas, badges— se implementan con los componentes normativos de `docs/design-system/web/components/`, no con marcado propio. Es un cambio de implementación con consecuencia visible —dejan de haber dos botones que se ven distinto haciendo lo mismo— pero **no cambia la estructura declarada acá**: un bloque que ya existía sigue existiendo, con el mismo tipo y el mismo propósito [REQ-013 RF-3, RF-4, CA-5, CA-10].
- **[REQ-013] Los estados declarados en esta ficha se conservan.** La migración es de presentación: ningún estado se agrega, se quita ni cambia su condición de disparo. Lo que cambia es cómo se ve cada uno —el loader es ahora uno solo, el vacío tiene componente `EmptyState` disponible— sin que la ficha declare estados nuevos. **Cablear `EmptyState` en las pantallas que hoy no tienen estado vacío queda fuera de este REQ** y sigue registrado en `gaps-as-is.md` [REQ-013 §Fuera de Alcance].
- **[REQ-013] `desktop` sigue siendo el viewport único.** El requerimiento **no** habilita mobile: el DS mantiene el responsive del shell como objetivo declarado sin fecha y no declara el viewport `mobile` hasta que el shell lo cumpla. El layout por viewport de esta ficha no cambia [REQ-013 §Fuera de Alcance, CA-15].
- **[REQ-013] El selector de tema vive en el shell, no en esta pantalla.** La superficie gana modo oscuro con un control para elegirlo, ubicado en el pie de la sidebar junto a Cerrar sesión. Como es parte del shell de `(loggedin)`, está presente acá pero **no se declara como bloque de esta ficha**: declararlo en las 21 pantallas autenticadas repetiría veintiuna veces el mismo control. En modo oscuro esta pantalla usa la paleta propia del DS —canvas `#0E121A`, superficies `#1B202C` separadas por contraste y sin borde—, no una inversión de la clara [REQ-013 RF-7, CA-11].
