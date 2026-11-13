---
document: UX Survey Screen
screen: tablero-requisitos
route: /projects/[projectId]/requirements
service: opus-web
source_files:
  - src/app/(dashboard)/projects/[projectId]/requirements/page.tsx
  - src/app/(dashboard)/projects/[projectId]/requirements/page.module.scss
  - src/features/requirements/components/BoardHeader/BoardHeader.tsx
  - src/features/requirements/components/ListView/ListView.tsx
  - src/features/requirements/components/ListView/components/RequirementGroupRow/RequirementGroupRow.tsx
  - src/features/requirements/components/ListRequirementRow/ListRequirementRow.tsx
  - src/features/requirements/components/KanbanBoard/KanbanBoard.tsx
  - src/features/requirements/components/KanbanColumn/KanbanColumn.tsx
  - src/features/requirements/components/KanbanBoard/components/KanbanCard/KanbanCard.tsx
  - src/features/requirements/components/MobileRequirementsBoard/MobileRequirementsBoard.tsx
  - src/features/requirements/components/StateAccordion/StateAccordion.tsx
  - src/features/requirements/components/RequirementCard/RequirementCard.tsx
viewports_detected:
  - mobile
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: tablero-requisitos

> **Relevamiento as-is** de `/projects/[projectId]/requirements`, extraído de
> `src/app/(dashboard)/projects/[projectId]/requirements/page.tsx`. Describe lo que el código hace
> hoy, no lo que debería hacer.

Es la pantalla principal del portal: donde el usuario pasa el tiempo. **Tiene tres
representaciones distintas del mismo contenido**, elegidas por viewport y por query param.

## Identidad

- **Ruta:** `/projects/[projectId]/requirements`
- **Archivo:** `src/app/(dashboard)/projects/[projectId]/requirements/page.tsx`
- **Requiere auth:** sí — `middleware.ts:45-47`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** mostrar todos los requisitos de un proyecto agrupados por estado, con
  paginación por grupo, y permitir abrir el detalle de cada uno.
- **Viewports con tratamiento:** mobile, desktop — **con árboles de componentes distintos**, no
  solo layouts distintos

Envuelta por el [chrome de `(dashboard)`](./_shell.md).

### Las tres vistas

```tsx
// requirements/page.tsx:171-185
{isMobile ? (
  <MobileRequirementsBoard states={statesData} projectId={projectId} />
) : view === 'list' ? (
  <ListView sections={columnsData} ... />
) : (
  <KanbanBoard columns={columnsData} ... />
)}
```

| Vista | Cuándo | Componente |
|---|---|---|
| Acordeones | `useIsMobile()` → ancho < 768px | `MobileRequirementsBoard` |
| Lista agrupada | desktop, `?view=list` (default) | `ListView` |
| Kanban | desktop, `?view=kanban` | `KanbanBoard` |

**En mobile el `?view=` se ignora por completo.** El toggle de vista existe en el `BoardHeader`,
que sí se renderiza en mobile, pero cambiarlo no tiene efecto visible.

## Entrada y salida

**Entradas:**
- Desde `/projects` por redirección automática · `projects/page.tsx:23`
- Desde el sidebar, click en un proyecto · `Sidebar.tsx:40`
- Desde `detalle-requisito`, botón "Volver" o el breadcrumb · `BoardHeader.tsx:81`, `:138`
- Por URL directa

**Salidas:**
- Abre el overlay de detalle · click en fila o card (desktop) · `requirements/page.tsx:137-139`
- A `/projects/{id}/requirements/{reqId}` · click en una card (mobile) ·
  `MobileRequirementsBoard.tsx:71-75` (`<Link>`)
- A `?view=list` / `?view=kanban` · toggle del header · `BoardHeader.tsx:68-70`
  (`router.replace`)

**Redirects automáticos:** ninguno.

**Efecto lateral:** sincroniza el proyecto activo del contexto con el `projectId` de la URL
(`requirements/page.tsx:65-72`).

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | encabezado-tablero | `header` | — | ambos | `<BoardHeader>` | `requirements/page.tsx:166-170` |
| 2 | breadcrumb | `breadcrumbs` | — | ambos | `<div className={styles.breadcrumb}>` | `BoardHeader.tsx:74-94` |
| 3 | toggle-vista | `tabs` | list / kanban | ambos *(sin efecto en mobile)* | `<div className={styles.viewToggles}>` | `BoardHeader.tsx:147-190` |
| 4 | cabecera-columnas | `table` | sticky | **solo desktop** | `<div className={styles.colHeader}>` | `ListView.tsx:75-85` |
| 5 | fila-grupo | `list` | colapsable | solo desktop | `<RequirementGroupRow>` | `ListView.tsx:95-100` |
| 6 | fila-requisito | `table` | — | solo desktop | `<ListRequirementRow>` | `ListView.tsx:104-109` |
| 7 | pill-estado | `badge` | 7 estados · editable/readonly | solo desktop | `<Dropdown>` o `<span>` | `ListRequirementRow.tsx:152-198` |
| 8 | pill-prioridad | `badge` | 5 prioridades · editable/readonly | solo desktop | `<Dropdown>` o `<span>` | `ListRequirementRow.tsx:218-267` |
| 9 | columna-kanban | `section` | colapsada/expandida | solo desktop (`?view=kanban`) | `<KanbanColumn>` | `KanbanBoard.tsx:47-67` |
| 10 | card-kanban | `card` | — | solo desktop (`?view=kanban`) | `<KanbanCard>` | `KanbanBoard.tsx:60-65` |
| 11 | boton-ver-mas | `button` | secondary · loading | ambos | `<button className={styles.loadMoreButton}>` | `KanbanColumn.tsx:81-96`, `StateAccordion.tsx:85-100` |
| 12 | acordeon-estado | `section` | expandido/colapsado | **solo mobile** | `<StateAccordion>` | `MobileRequirementsBoard.tsx:58-88` |
| 13 | card-requisito-mobile | `card` | — | solo mobile | `<RequirementCard>` | `MobileRequirementsBoard.tsx:76-81` |
| 14 | indicador-carga | `loader` | lg | ambos | `<Spinner size="lg">` | `requirements/page.tsx:157` |

> `columna-kanban` y `acordeon-estado` se relevaron como `section`: son contenedores colapsables
> sin tipo propio en el diccionario (no son `card` ni `list`).
>
> `cabecera-columnas` y `fila-requisito` se relevaron como `table` aunque el DOM son `<div>` con
> `display: grid` — semánticamente son una tabla. Ver Accesibilidad.

## Layout observado por viewport

### desktop · 1200px — vista lista (default)

- (chrome: sidebar-navegacion 263px a la izquierda)
- encabezado-tablero (61px de alto, fijo)
  - row `header`
    - col 6/12: breadcrumb
    - col 6/12: toggle-vista (alineado a la derecha)
- cabecera-columnas (sticky al tope del scroll)
  - row `grid-7` — 7 columnas de ancho fijo: `64px 1fr 140px 140px 160px 120px 150px`
- por cada uno de los 7 estados:
  - fila-grupo (ancho completo, clickeable)
  - fila-requisito × N (mismo grid de 7 columnas)

**Origen:** `BoardHeader.module.scss:3-13` (`display:flex; justify-content:space-between;
height:61px`), `ListView.module.scss:10-14` y `ListRequirementRow.module.scss:3-15` — las dos
declaran `grid-template-columns: 64px 1fr 140px 140px 160px 120px 150px`.

**Las fracciones 6/12 del header son aproximadas:** es un `space-between` entre dos grupos de
ancho natural, no una grilla. Las 7 columnas de la tabla **no son fracciones de 12**: son anchos
fijos en px con una sola columna flexible (el título, `1fr`).

### desktop · 1200px — vista kanban

- (chrome: sidebar)
- encabezado-tablero
- row `tablero` (scroll horizontal)
  - columna-kanban × 7, cada una de **500px fijos**, con `gap: 20px`

**Origen:** `KanbanBoard.module.scss:1-11` — `display:flex; gap:20px; overflow-x:auto` y
`KanbanColumn.module.scss:3-6` — `flex: 0 0 500px`.

**No es una grilla de 12 columnas:** son 7 columnas de ancho fijo que suman 3620px, siempre con
scroll horizontal. A 1200px de viewport (menos el sidebar) entran poco más de **dos columnas
completas**. Una columna colapsada se reduce (`.columnCollapsed`), lo que permite ver más.

### mobile · 400px

- *(sin chrome — el sidebar está oculto)*
- encabezado-tablero
  - breadcrumb
  - toggle-vista *(visible pero sin efecto)*
- acordeon-estado × 7 (ancho completo, apilados, `gap: var(--spacing-sm)`)
  - al expandir: card-requisito-mobile × N + boton-ver-mas

**Origen:** `MobileRequirementsBoard.module.scss:5-9` — `display:flex; flex-direction:column;
gap: var(--spacing-sm)`.

Stack vertical simple. **Todos los acordeones arrancan colapsados**
(`MobileRequirementsBoard.tsx:36` — `useState(new Set())`), a diferencia de desktop donde solo
`resuelto` y `cancelado` lo hacen.

## Contenido

### breadcrumb
- Texto/label: `{nombre del proyecto}` › "Requisitos"
- Origen: `BoardHeader.tsx:75-87`; el separador `›` es un carácter literal en `:76`
- Annotation: el nombre es dinámico desde `useProjects`; **si la query falla cae al literal
  "Proyecto"** (`requirements/page.tsx:133`)

### toggle-vista
- Texto/label: "Lista" y "Columnas"
- Origen: `BoardHeader.tsx:168`, `:187`
- Icono: SVG inline de líneas (lista) y de cuadrantes (columnas) · `:153-167`, `:174-186`
- Annotation: el activo se marca con `styles.active` según `searchParams.get('view')`. Usa
  `router.replace`, no `push` — no ensucia el historial

### cabecera-columnas
- Texto/label, en orden: "ID", "TÍTULO", "ESTADO", "CREACIÓN", "AUTOR", "TIPO", "PRIORIDAD"
- Origen: `ListView.tsx:77-83`
- Annotation: en mayúsculas en el código, no por CSS. Sticky con sombra al scrollear
  (`ListView.tsx:75`, estado `isScrolled` en `:47`)

### fila-grupo
- Texto/label: la etiqueta del estado + el conteo
- Origen: `RequirementGroupRow.tsx:14-22` (mapa `STATE_LABELS`) y `:38` (conteo)
- Etiquetas: "Análisis", "Planificación", "En cola", "Desarrollo", "Revisión", "Resuelto",
  "Cancelado"
- Icono: `ChevronDown` de lucide-react, 14px, rotado al colapsar · `:34`

### fila-requisito
- Texto/label: dinámico — `#{id}`, `title`, etiqueta de estado, fecha, `creator.name`, tipo,
  prioridad
- Origen: `ListRequirementRow.tsx:144-268`
- Valores por defecto: autor sin nombre → `"—"` (`:209`); fecha nula → `"—"` (`:73`); tipo nulo o
  `sin_tipo` → `"Sin tipo"` (`:60`)
- Fecha: `toLocaleDateString('es-ES', {day:'2-digit', month:'short', year:'numeric'})` · `:75-79`
- Icono: `Calendar` de lucide-react, 12px · `:204`

### pill-estado y pill-prioridad
- Texto/label: la etiqueta del valor actual
- Origen: mapas `PRIORITY_LABEL` (`ListRequirementRow.tsx:44-50`) y `stateLabel` recibido por prop
- Annotation: **son dropdowns solo para roles internos.** `isInternal = roles incluye 'user' o
  'admin'` (`:119-120`). Para `external-user` es un `<span>` estático. El click hace
  `stopPropagation` para no abrir el detalle (`:151`, `:217`)

### card-kanban
- Texto/label: dinámico — `#{id}`, título, fecha, autor, y los dos pills
- Origen: `KanbanCard.tsx:125-249`
- Annotation: **los pills solo se muestran si el requisito tiene descripción**
  (`KanbanCard.tsx:140`) — condición que no está explicada en el código
- Fecha: formato propio en UTC, distinto del de la lista: `{día} {mes abreviado} {año}`
  (`:60-66`)

### card-requisito-mobile
- Texto/label: dinámico — título, `#{id}`, fecha
- Origen: `RequirementCard.tsx:55-77`
- Icono: SVG de calendario inline, 14px · `:59-75`
- Annotation: **no muestra estado, tipo, autor ni prioridad.** Es la representación más reducida
  de las tres

### acordeon-estado
- Texto/label: la etiqueta del estado + el conteo
- Origen: `MobileRequirementsBoard.tsx:25-33` (`MOBILE_STATES_ORDER`) y `StateAccordion.tsx:60-62`
- Annotation: `aria-label={`${state}, ${count} objetivos`}` (`StateAccordion.tsx:58`) — **dice
  "objetivos", no "requisitos"**

### boton-ver-mas
- Texto/label: "Ver más" · en carga: "Cargando..." con spinner
- Origen: `KanbanColumn.tsx:87-94`, `StateAccordion.tsx:91-98` — **implementaciones idénticas**
- Annotation: aparece solo si `hasMore`; trae 20 más de ese estado
  (`useRequirementsByStatus.ts:11`)

### Estados vacíos por sección
- Lista: "Sin elementos" · `ListView.tsx:112`
- Mobile: "Sin requisitos en este estado" · `MobileRequirementsBoard.tsx:86`
- Kanban: **ninguno** — la columna queda vacía

## Estados presentes

### loading
- Mensaje: "Cargando requisitos..."
- Disparado por: `queries.some((q) => q.isLoading)` — **las siete queries a la vez**
  (`requirements/page.tsx:63`)
- Origen: `requirements/page.tsx:153-162`
- Cambios: reemplaza la pantalla entera (incluido el `BoardHeader`) por spinner + texto centrados
- Annotation: es un `some`, así que la pantalla espera a la query más lenta. No hay carga
  progresiva por columna

### default
- Origen: `requirements/page.tsx:164-196`
- Las tres vistas según viewport y `?view=`

### loading parcial (paginación)
- Mensaje: "Cargando..." dentro del botón "Ver más"
- Disparado por: `isFetchingNextPage` de la query de ese estado
- Origen: `KanbanColumn.tsx:87-93`, `StateAccordion.tsx:91-97`
- Cambios: el botón se deshabilita y muestra spinner + texto

### empty por sección
- Mensaje: "Sin elementos" (lista) / "Sin requisitos en este estado" (mobile)
- Disparado por: `requirements.length === 0` en esa sección
- Origen: `ListView.tsx:111-113`, `MobileRequirementsBoard.tsx:85-87`
- Annotation: **en la lista solo se ve si el grupo está expandido**, y los grupos vacíos arrancan
  colapsados (`ListView.tsx:35-44`)

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error de sistema** | **No se maneja.** Las siete queries pueden fallar y la pantalla renderiza el tablero con las siete secciones en cero, indistinguible de un proyecto sin requisitos | `requirements/page.tsx:153-196` — solo evalúa `isLoading`, nunca `isError` |
| **empty (de la pantalla)** | Un proyecto sin ningún requisito muestra las 7 secciones en cero, sin mensaje ni acción. En desktop además todas colapsadas, así que la pantalla queda casi en blanco | `requirements/page.tsx:164-196` |
| error de proyecto | Si `useProjects` falla, el breadcrumb muestra el literal "Proyecto" y nada avisa | `requirements/page.tsx:132-135` |
| empty en kanban | Una columna vacía no muestra nada: ni "Sin elementos" como la lista | `KanbanBoard.tsx:59-66` |
| error de validación | no aplica — la pantalla no tiene formulario propio | — |
| not found | **No se maneja.** Un `projectId` inexistente o sin permiso deja la pantalla en el tablero vacío, sin 404 | `requirements/page.tsx:35` — `Number(params.projectId)` sin validar |
| success | no aplica en la pantalla; el cambio de estado da un toast global | `useUpdateRequirement.ts:19` |
| permiso/acceso denegado | no se distingue: un proyecto ajeno se ve igual que uno vacío | — |
| estado terminal / readonly | **presente de hecho, sin marcarse.** Para `external-user` los pills no son editables, pero nada indica que sean de solo lectura: se ven igual sin el chevron | `ListRequirementRow.tsx:193-198` |

## Interacciones

**Eventos:**
- fila-requisito · click → abre el overlay de detalle · `ListView.tsx:108` →
  `requirements/page.tsx:137-139`
- card-kanban · click → abre el overlay de detalle · `KanbanBoard.tsx:64`
- card-requisito-mobile · click → **navega** a `/projects/{id}/requirements/{reqId}` ·
  `MobileRequirementsBoard.tsx:71-75`
- fila-grupo · click → colapsa/expande el grupo · `ListView.tsx:99`
- cabecera de columna kanban · click → colapsa la columna · `KanbanColumn.tsx:70`
- acordeon-estado · click o Enter/Space → expande/colapsa · `StateAccordion.tsx:35-40`, `:53-54`
- pill-estado · click *(solo rol interno)* → abre dropdown; al elegir, `PATCH` del estado ·
  `ListRequirementRow.tsx:129-132`
- pill-prioridad · click *(solo rol interno)* → ídem con la prioridad · `:134-140`
- boton-ver-mas · click → `fetchNextPage()` de ese estado · `requirements/page.tsx:80`
- toggle-vista · click → `router.replace` con el nuevo `?view=` · `BoardHeader.tsx:68-70`

**Diferencia de comportamiento por viewport:** en desktop el requisito abre en **overlay**; en
mobile **navega** a otra ruta. No es solo layout: es un modelo de navegación distinto.

**Validaciones:**
- Ninguna en esta pantalla.
- Los cambios de estado y prioridad **no validan transiciones**: el dropdown ofrece los siete
  estados siempre, en cualquier orden. Un requisito puede pasar de `analisis` a `resuelto`
  directamente. Solo se descarta re-seleccionar el valor actual (`ListRequirementRow.tsx:130`).

**Feedback:**
- Cambio de estado/prioridad exitoso → toast "Requisito actualizado correctamente" ·
  `useUpdateRequirement.ts:19`
- Fallido → toast "Error al actualizar el estado" o "Error al actualizar la prioridad" · `:26-32`
- **Sin update optimista:** el pill no cambia hasta que vuelve el refetch de las siete queries

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Filas navegables por teclado | **ausente** — `<div onClick>` sin `role`, `tabIndex` ni `onKeyDown` | `ListRequirementRow.tsx:143` |
| Cards de kanban navegables | **ausente** — `<article onClick>` sin `role="button"` ni `tabIndex` | `KanbanCard.tsx:124` |
| Cards mobile navegables | **presente** — son `<Link>`, más `RequirementCard` con `role="button"`, `tabIndex` y `onKeyDown` cuando recibe `onClick` | `MobileRequirementsBoard.tsx:71`, `RequirementCard.tsx:46-53` |
| Acordeones por teclado | **presente** — `role="button"`, `tabIndex={0}`, `onKeyDown` con Enter y Space, `aria-expanded` | `StateAccordion.tsx:51-58` |
| Cabecera de columna kanban | **ausente** — `<header onClick>` con `cursor:pointer` inline, sin rol ni teclado | `KanbanColumn.tsx:68-72` |
| Semántica de tabla | **ausente** — `<div>` con `display:grid`, sin `role="table"`/`row`/`cell` | `ListView.tsx:76`, `ListRequirementRow.tsx:143` |
| Dropdowns | **parcial** — `aria-expanded` y `aria-haspopup="listbox"` en el trigger, `role="listbox"`/`option` en el menú. Pero `aria-selected="false"` está **fijo en todas las opciones**, incluida la actual | `Dropdown.tsx:100`, `:118-119` |
| Iconos decorativos | **presente** — `aria-hidden="true"` en los SVG de chevron y en los iconos de lucide | `ListRequirementRow.tsx:163`, `BoardHeader.tsx:104` |
| Encabezado de página | **ausente** — no hay `<h1>`. El nombre del proyecto es un `<span>` en el breadcrumb | `BoardHeader.tsx:75` |
| Breadcrumb semántico | **ausente** — `<div>` sin `<nav aria-label>` ni lista | `BoardHeader.tsx:74` |
| Toggle de vista | **ausente** — dos `<button>` sin `role="tab"` ni `aria-pressed`; el activo se marca solo por clase | `BoardHeader.tsx:149-188` |
| Estado de carga anunciado | **presente** — el `Spinner` tiene `role="status"` | `Spinner.tsx:9` |
| Toasts anunciados | **presente** — `role="alert"` | `Toast.tsx:42` |

## Observaciones del relevamiento

- **Tres implementaciones del mismo contenido, con tres formatos de fecha distintos.**
  `ListRequirementRow.tsx:75-79` usa `toLocaleDateString('es-ES', …)`;
  `KanbanCard.tsx:60-66` arma la fecha a mano en UTC; `RequirementCard.tsx:13-19` usa
  `toLocaleDateString('es-ES', …)` otra vez. Los tres producen resultados parecidos pero no
  garantizadamente iguales.

- **La lista de estados está declarada tres veces**, una por vista: `ListView.tsx:22-30`,
  `KanbanBoard.tsx:25-33`, `MobileRequirementsBoard.tsx:25-33`. Más las etiquetas en
  `RequirementGroupRow.tsx:14-22` y el mapa canónico en `requirement.constants.ts:1-9` — que solo
  usan los dropdowns. Cinco fuentes para la misma lista.

- **`StateAccordion` pinta todos los acordeones del mismo color.** Su
  `getStateDataAttribute` (`:15-23`) mapea `Backlog`, `Activo`, `En revisión`, `Finalizado` —
  etiquetas de un enum anterior que ya no existe. Recibe "Análisis", "Planificación", etc., que no
  matchean, y siempre devuelve `'backlog'`. **La vista mobile perdió la codificación por color de
  estado.**

- **`StateAccordion` dice "objetivos" en su `aria-label`** (`:58`): `${state}, ${count}
  objetivos`. Un lector de pantalla anuncia "Análisis, 4 objetivos" en una UI que dice
  "requisitos".

- **Los pills del kanban dependen de que haya descripción.** `KanbanCard.tsx:140` envuelve los dos
  pills en `{description && (...)}`. Un requisito sin descripción no muestra estado ni prioridad
  en la card — y para un rol interno, tampoco los dropdowns para cambiarlos. El código no explica
  por qué.

- **En desktop no hay ningún botón de "nuevo requisito" en esta pantalla.** `BoardHeader` recibe
  `onNewRequirement` y lo ignora (`:24`, renombrado `_onNewRequirement`), aunque la pantalla se lo
  pasa (`requirements/page.tsx:169`). El único acceso es el botón del sidebar. **En mobile, donde
  el sidebar no existe, no hay ninguno.**

- **Hay un `CreateRequirementModal` montado en esta pantalla que nada puede abrir**
  (`requirements/page.tsx:192-195`), además del que monta el layout. Dos instancias en el DOM, una
  alcanzable.

- **El requisito abierto no tiene URL.** Es `useState` (`:40`), así que un refresh pierde el
  contexto y vuelve al tablero. El botón "Enlace" del overlay copia la URL de la página de
  detalle, que sí existe como ruta.

- **Siete requests HTTP al abrir la pantalla**, una por estado. Es lo que permite paginar por
  columna, y el costo es que `isLoading` sea un `some`: la pantalla entera espera a la más lenta.

- **El toggle de vista se muestra en mobile y no hace nada.** `BoardHeader` no sabe del viewport;
  la rama de `useIsMobile` está en la pantalla, por encima.

- No se pudo determinar si el orden de los siete estados es un flujo de trabajo o solo una
  convención de visualización: las tres listas lo declaran igual, ninguna lo justifica.
