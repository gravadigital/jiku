---
document: UX Survey Screen
screen: reporte-requisitos
route: /requirements/report
service: web
source_files:
  - src/app/(loggedin)/requirements/report/page.tsx
  - src/features/requirements/components/RequirementsReportPage/RequirementsReportPage.tsx
  - src/features/requirements/components/RequirementsReportFilters/RequirementsReportFilters.tsx
  - src/features/requirements/components/RequirementsReportTable/RequirementsReportTable.tsx
  - src/features/requirements/utils/requirementsReportCsv.ts
  - src/features/requirements/hooks/useRequirementsReport.ts
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: reporte-requisitos

> **Relevamiento as-is** de `/requirements/report`, extraído de
> `src/app/(loggedin)/requirements/report/page.tsx` y su árbol.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md).

## Identidad

- **Ruta:** `/requirements/report`
- **Archivo:** `src/app/(loggedin)/requirements/report/page.tsx` (Server Component,
  `dynamic = 'force-dynamic'`) → `<RequirementsReportPage>` (`'use client'`)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** tabla plana de 12 columnas con los requisitos y sus datos de resolución,
  filtrable, y exportable a CSV.
- **Viewports con tratamiento:** ninguno.

## Entrada y salida

**Entradas:**
- **Ninguna desde la UI.** Ver Observaciones.

**Salidas:**
- Descarga de un archivo `reporte-requisitos.csv` · botón de exportar ·
  `RequirementsReportPage.tsx:43-46`

**Redirects automáticos:**
- Ninguno.

> **La pantalla no tiene navegación de salida:** ni `"Volver"`, ni links en las filas de la tabla.
> Solo se sale por la sidebar.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | barra-filtros | `section` | — | ambos | `<div className={styles.filterSection}>` | `RequirementsReportFilters.tsx:83` |
| 2 | buscador-titulo | `search-bar` | default | ambos | `<input type="text" id="report-search">` | `RequirementsReportFilters.tsx:88-95` |
| 3 | filtro-fecha-desde | `date-picker` | default | ambos | `<input type="date" id="report-created-from">` | `RequirementsReportFilters.tsx:103-108` |
| 4 | filtro-fecha-hasta | `date-picker` | default | ambos | `<input type="date" id="report-created-to">` | `RequirementsReportFilters.tsx:116-121` |
| 5 | filtro-proyecto | `dropdown` | closed / open | ambos | `<ReactSelect inputId="report-project">` | `RequirementsReportFilters.tsx:128-136` |
| 6 | boton-exportar-csv | `button` | secondary | ambos | `<button>` con texto `"Exportar CSV"` | `RequirementsReportFilters.tsx:139-141` |
| 7 | tabla-reporte | `table` | — | ambos | `<table className={styles.table}>` | `RequirementsReportTable.tsx:31` |
| 8 | vacio-reporte | `empty-state` | — | ambos | `<div className={styles.empty}>` | `RequirementsReportTable.tsx:25` |
| 9 | mensaje-error | `alert` | error | ambos | `<div className={styles.error}>` | `RequirementsReportPage.tsx:63` |
| 10 | cargando-reporte | `loader` | — | ambos | `<Loader label="Cargando reporte...">` como fallback de `<Suspense>` | `requirements/report/page.tsx:12` |

> `barra-filtros` se relevó como `section`. Es un `<div>`, igual que en `listado-requisitos`.

> **No hay paginación.** La tabla renderiza `items` completo (`RequirementsReportTable.tsx:49`).

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- titulo-pagina (`"Reporte de Requisitos"`, del shell)
- row `filtros`
  - col ~4.4/12: buscador-titulo (`flex: 2`)
  - col ~2.2/12: filtro-fecha-desde (`flex: 1`)
  - col ~2.2/12: filtro-fecha-hasta (`flex: 1`)
  - col ~3.1/12: filtro-proyecto (`flex: 1.4`)
  - boton-exportar-csv (ancho intrínseco, al final de la fila)
- tabla-reporte (12 columnas, con scroll horizontal propio)

**Origen de las fracciones:** estilos inline en el JSX, igual que en `listado-requisitos`:

```tsx
<div className={styles.filterField} style={{ flex: 2 }}>    // búsqueda
<div className={styles.filterField}>                        // fecha desde
<div className={styles.filterField}>                        // fecha hasta
<div className={styles.filterField} style={{ flex: 1.4 }}>  // proyecto
```
`RequirementsReportFilters.tsx:84`, `:98`, `:111`, `:124`

Los campos de fecha no declaran `flex` inline, así que toman el `flex: 1` de `.filterField`
(`RequirementsReportFilters.module.scss:14`). Pesos 2 + 1 + 1 + 1.4 = 5.4 → **4.4/12 + 2.2/12 +
2.2/12 + 3.1/12**. Cada campo tiene además `min-width: 140px` (`:13`), que a anchos angostos gana
sobre las fracciones.

**Origen del scroll de la tabla:** `.tableWrap` declara **`overflow-x: auto`**
(`RequirementsReportTable.module.scss:1-5`). Es el **único bloque del producto con scroll horizontal
propio**: las otras 6 tablas comprimen las celdas y recortan con elipsis.

## Contenido

### buscador-titulo
- Texto/label: `"Búsqueda"` · placeholder `"Buscar por título"`
- Origen: `RequirementsReportFilters.tsx:92`
- Annotation: debounce antes de propagar (`:73-76`). **El label sí tiene `htmlFor="report-search"`**
  y el input el `id` correspondiente — a diferencia de `RequirementFilters`, donde los labels están
  sueltos.

### filtro-fecha-desde / filtro-fecha-hasta
- Textos/label verbatim: `"Desde"` y `"Hasta"`. Los `id` son `report-created-from` y
  `report-created-to`
- Origen: `RequirementsReportFilters.tsx:103-121`
- Annotation: `type="date"` nativos, sin validación de rango entre ellos

### filtro-proyecto
- Texto/label: `"Proyecto"` · `aria-label="Proyecto"` · `:130`
- Opciones: `"Todos los proyectos"` (`''`) + la lista de proyectos · `:78-80`
- Origen: `RequirementsReportFilters.tsx:128-136`

### boton-exportar-csv
- Texto/label: `"Exportar CSV"`
- Origen: `RequirementsReportFilters.tsx:139-141`
- Annotation: exporta **lo que está en pantalla** (`items` ya filtrado), no el dataset completo
  (`RequirementsReportPage.tsx:43-46`)

### tabla-reporte
- Columnas verbatim (12): `"ID"` · `"Tipo"` · `"Título"` · `"Proyecto"` · `"Creado por"` ·
  `"Fecha creación"` · `"Fecha inicio"` · `"Fecha resolución"` · `"Horas"` ·
  `"Tipo de resolución"` · `"Conclusión"` · `"Comentario de resolución"`
- Origen: `RequirementsReportTable.tsx:34-46`
- Placeholder de celda vacía: `"-"` (guion corto) · `RequirementsReportTable.tsx:~7`
- Formato de fecha: `DD/MM/YYYY` vía `labelFromDate` · `:19`
- Horas: vía `formatMinutes` · `:59`

### vacio-reporte
- Texto/label: `"No se encontraron requisitos con los filtros aplicados"`
- Origen: `RequirementsReportTable.tsx:25`

### mensaje-error
- Texto/label: `"Ocurrió un error al cargar el reporte"`
- Origen: `RequirementsReportPage.tsx:63`

### cargando-reporte
- Texto/label: `"Cargando reporte..."`
- Origen: `requirements/report/page.tsx:12`

### CSV exportado
- Nombre del archivo: `reporte-requisitos.csv` · `RequirementsReportPage.tsx:45`
- Encabezados: **los mismos 12 de la tabla**, definidos aparte en `CSV_HEADERS`
  (`requirementsReportCsv.ts:10-23`)
- Annotation: incluye BOM UTF-8 (`requirementsReportCsv.ts:8`, `:59`) para que Excel abra bien los
  acentos, y escapa comas, comillas y saltos de línea (`:30-35`)

## Estados presentes

### default
- Disparado por: query resuelta con al menos un ítem
- Origen: `RequirementsReportTable.tsx:29-68`

### loading
- Mensaje: `"Cargando reporte..."`
- Disparado por: el `<Suspense>` de la página en el primer render
- Origen: `requirements/report/page.tsx:12`
- Cambios: reemplaza toda la pantalla, incluida la barra de filtros

### empty
- Mensaje: `"No se encontraron requisitos con los filtros aplicados"`
- Disparado por: `items.length === 0`
- Origen: `RequirementsReportTable.tsx:23-27`
- Cambios: reemplaza la tabla; los filtros quedan

### error de sistema
- Mensaje: `"Ocurrió un error al cargar el reporte"`
- Disparado por: `isError` de `useRequirementsReport`
- Origen: `RequirementsReportPage.tsx:25`, `:62-64`
- Cambios: reemplaza la tabla por el mensaje; los filtros quedan

> **Es una de las cuatro pantallas del producto que manejan el error de su query**, y una de las dos
> que lo muestran **en pantalla** en vez de solo por toast. La otra es `asignacion-tiempo`.

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| loading en el refetch por filtro | **el `<Suspense>` no lleva `key`** y `isLoading` no se desestructura: al cambiar un filtro la tabla vieja queda en pantalla sin indicador | `requirements/report/page.tsx:12`, `RequirementsReportPage.tsx:25` |
| empty de primer uso | no diferenciado: el mensaje dice `"con los filtros aplicados"` incluso sin ningún filtro activo | `RequirementsReportTable.tsx:25` |
| error de validación | no aplica: la pantalla no tiene formulario de escritura | — |
| **rango de fechas inválido** | **no se valida.** `createdFrom` posterior a `createdTo` se manda a la api tal cual; el resultado depende de ella | `RequirementsReportFilters.tsx:103-121` |
| success | no aplica; la exportación no confirma nada | `RequirementsReportPage.tsx:43-46` |
| **feedback de la exportación** | **ausente.** El click dispara la descarga sin toast, sin spinner, sin cambio visible. Con el navegador configurado para descargar en silencio, no hay señal de que pasó algo | `RequirementsReportPage.tsx:43-46` |
| **exportar con 0 filas** | **no se previene.** `buildRequirementsReportCsv([])` produce un CSV con solo la fila de encabezados, y se descarga igual. El botón no se deshabilita | `requirementsReportCsv.ts:54-60`; el botón sin `disabled` en `RequirementsReportFilters.tsx:139` |
| not found | no aplica | — |
| estado terminal / readonly | no aplica: el reporte es de solo lectura por naturaleza | — |
| **paginación** | **no existe.** La tabla renderiza todos los ítems que devuelve la api. Con muchos requisitos el render crece sin límite | `RequirementsReportTable.tsx:49` |
| **total de resultados** | no se muestra en ningún lado | `RequirementsReportTable.tsx:29-68` |

## Interacciones

**Eventos:**
- buscador-titulo · on change → debounce → `onSearchChange` → `setFilters` ·
  `RequirementsReportFilters.tsx:73-76`, `RequirementsReportPage.tsx:27-29`
- filtro-fecha-desde / hasta · on change → `setFilters` inmediato ·
  `RequirementsReportPage.tsx:31-37`
- filtro-proyecto · on change → `setFilters` inmediato · `RequirementsReportPage.tsx:39-41`
- boton-exportar-csv · click → `buildRequirementsReportCsv(items)` + `downloadCsv(...)` ·
  `RequirementsReportPage.tsx:43-46`

**Validaciones:**
- Ninguna.

**Feedback:**
- Ninguno para la exportación.
- El cambio de filtro no tiene indicador de carga.

> **Los filtros viven en estado local, no en la URL** (`RequirementsReportPage.tsx:18-23`). Es la
> única pantalla de listado del producto que hace esto: `listado-actores`, `listado-proyectos`,
> `listado-requisitos` y `listado-tareas` los ponen en `searchParams`. **Consecuencia:** un reporte
> filtrado no se puede compartir por link ni recuperar con el botón de atrás.

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Labels asociados | **Presentes con `htmlFor` / `id`** en los tres inputs nativos — mejor que `RequirementFilters`, donde los labels están sueltos | `RequirementsReportFilters.tsx:85-89`, `:99-104`, `:112-117` |
| `react-select` con label | `inputId="report-project"` **más** `aria-label="Proyecto"`. Correcto | `:129-130` |
| Encabezados de tabla | `<th>` dentro de `<thead>`. Correcto | `RequirementsReportTable.tsx:32-47` |
| Filas no interactivas | Correcto: las filas del reporte no navegan, así que no hay `<tr onClick>` sin rol — a diferencia de las otras 6 tablas del producto | `RequirementsReportTable.tsx:50` |
| Scroll horizontal | `.tableWrap` tiene `overflow-x: auto` pero **sin `tabindex="0"` ni `role="region"`**: la región scrolleable no es enfocable, así que un usuario de teclado no puede desplazarla para ver las últimas columnas | `RequirementsReportTable.module.scss:1-5`, `RequirementsReportTable.tsx:30` |
| Botón de exportar | Texto `"Exportar CSV"`. Correcto | `:139-141` |
| Anuncio de la descarga | **ausente:** sin `aria-live`. La acción no produce ningún cambio anunciable | `RequirementsReportPage.tsx:43-46` |
| Anuncio del resultado del filtrado | **ausente:** sin `aria-live` | `RequirementsReportTable.tsx:29` |
| Mensaje de error | Es un `<div>` sin `role="alert"`: al aparecer no se anuncia | `RequirementsReportPage.tsx:63` |
| Jerarquía de encabezados | `<h1>` del shell (`"Reporte de Requisitos"`). Sin `<h2>` — la pantalla no tiene secciones | `requirements/report/page.tsx:10` |

## Observaciones del relevamiento

- **No hay forma de llegar a esta pantalla desde la UI.** El `Navbar` no tiene un ítem ni un subítem
  para `/requirements/report` (`Navbar.tsx:58-62`: `"Requisitos"` apunta a `/requirements` y no
  declara `subItems`), y ninguna otra pantalla enlaza acá. Comparar con `"Horas Trabajadas"`, que sí
  tiene los subítems `"Carga"` y `"Visualización"` para sus dos rutas. **Es una pantalla completa,
  funcional y huérfana.**
- **Es la única pantalla de listado con los filtros en estado local** en vez de la URL. Rompe el link
  compartible y el botón de atrás, justamente en la pantalla cuyo output es un reporte que alguien
  querría compartir.
- **El CSV está bien hecho.** BOM UTF-8 para Excel, escapado de comas/comillas/saltos de línea, y
  encabezados en español (`requirementsReportCsv.ts:8-35`). Es el bloque de mejor calidad técnica de
  la pantalla.
- **Los encabezados están definidos dos veces:** `CSV_HEADERS` (`requirementsReportCsv.ts:10-23`) y
  los `<th>` de la tabla (`RequirementsReportTable.tsx:34-46`). Son las mismas 12 etiquetas en el
  mismo orden, en dos archivos. Si una cambia y la otra no, la tabla y el CSV divergen.
- **`downloadCsv` revoca la URL del blob inmediatamente después del `click()`**
  (`requirementsReportCsv.ts:68-69`), sin esperar. Funciona en los navegadores actuales porque el
  click es sincrónico, pero es una carrera potencial. Tampoco agrega el `<a>` al DOM, que algunos
  navegadores requerían.
- **La tabla no pagina.** Con 12 columnas y todos los ítems, es la pantalla del producto con más
  riesgo de volumen.
- **`"Ocurrió un error al cargar el reporte"`** rompe el patrón de mensajes del producto, que usa
  `"Hubo un error al..."` o `"Error al..."`.
- **Es la única tabla del producto con scroll horizontal real** (`overflow-x: auto`), y la región no
  es enfocable por teclado: las últimas de las 12 columnas quedan inalcanzables sin mouse.
- **A confirmar en consolidación:** si esta pantalla debe estar en la navegación (y bajo qué ítem), si
  los filtros deben ir a la URL, y si la exportación debe confirmar.
