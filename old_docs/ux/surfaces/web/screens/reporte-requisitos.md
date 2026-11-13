---
name: reporte-requisitos
surface: web
route: /requirements/report
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.1"
date: 2026-09-02
---

# Pantalla: Reporte de requisitos

## Identidad

- **Audiencia primaria:** equipo-interno.
- **JTBD / Propósito:** consultar una tabla plana de 12 columnas con los requisitos y sus datos de resolución, filtrable, y exportarla a CSV [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport de la superficie. La tabla de 12 columnas es el bloque central y tiene scroll horizontal propio (`RequirementsReportTable.module.scss:1-5`) [fuente: código-existente].
  - Mobile queda fuera de la superficie `web`: el shell tiene una sidebar de 290px fija sin ninguna media query, así que por debajo de ese ancho no hay navegación disponible (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente]. La pantalla tampoco declara tratamiento responsive propio.
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- **Ninguna desde la UI.** El `Navbar` no tiene ítem ni subítem para `/requirements/report` (`Navbar.tsx:58-62`) y ninguna otra pantalla enlaza acá [fuente: código-existente]

**Salidas user-driven:**
- Descarga del archivo `reporte-requisitos.csv` · click en boton-exportar-csv (`RequirementsReportPage.tsx:43-46`)

**Salidas automáticas:**
- Ninguna. La pantalla no tiene navegación de salida: ni `"Volver"`, ni links en las filas de la tabla. Solo se sale por la sidebar.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | barra-filtros | section | — | layout | desktop | — | Agrupa los cuatro filtros y la exportación |
| 2 | buscador-titulo | search-bar | default | input | desktop | — | Filtra por título del requisito |
| 3 | filtro-fecha-desde | date-picker | default | input | desktop | — | Límite inferior de fecha de creación |
| 4 | filtro-fecha-hasta | date-picker | default | input | desktop | — | Límite superior de fecha de creación |
| 5 | filtro-proyecto | dropdown | closed / open | input | desktop | — | Filtra por proyecto |
| 6 | boton-exportar-csv | button | secondary | input | desktop | — | Descarga el CSV de lo filtrado |
| 7 | tabla-reporte | table | — | content | desktop | hidden_in_states: empty, error de sistema, loading | 12 columnas con los datos de resolución |
| 8 | vacio-reporte | empty-state | — | feedback | desktop | visible_only_in_states: empty | Mensaje de sin resultados |
| 9 | mensaje-error | alert | error | feedback | desktop | visible_only_in_states: error de sistema | Mensaje de fallo de la query |
| 10 | cargando-reporte | loader | — | feedback | desktop | visible_only_in_states: loading | Fallback del `<Suspense>` de la página |

**Origen:** `src/app/(loggedin)/requirements/report/page.tsx`, `src/features/requirements/components/RequirementsReportPage/RequirementsReportPage.tsx`, `src/features/requirements/components/RequirementsReportFilters/RequirementsReportFilters.tsx`, `src/features/requirements/components/RequirementsReportTable/RequirementsReportTable.tsx`, `src/features/requirements/utils/requirementsReportCsv.ts`, `src/features/requirements/hooks/useRequirementsReport.ts`.

Notas de transcripción [fuente: código-existente]:
- `barra-filtros` es un `<div>`, relevado como `section`.
- **No hay paginación.** La tabla renderiza `items` completo (`RequirementsReportTable.tsx:49`).
- El título de la pantalla (`"Reporte de Requisitos"`) lo aporta el shell, no un bloque propio.

## Layout por viewport

### desktop · 1440px

- row `filtros`
  - col ~4.4/12: buscador-titulo
  - col ~2.2/12: filtro-fecha-desde
  - col ~2.2/12: filtro-fecha-hasta
  - col ~3.1/12: filtro-proyecto
  - boton-exportar-csv (ancho intrínseco, al final de la fila)
- tabla-reporte

**Origen de las fracciones:** estilos inline en el JSX (`RequirementsReportFilters.tsx:84`, `:98`, `:111`, `:124`) [fuente: código-existente]:

```tsx
<div className={styles.filterField} style={{ flex: 2 }}>    // búsqueda
<div className={styles.filterField}>                        // fecha desde
<div className={styles.filterField}>                        // fecha hasta
<div className={styles.filterField} style={{ flex: 1.4 }}>  // proyecto
```

Los campos de fecha no declaran `flex` inline, así que toman el `flex: 1` de `.filterField` (`RequirementsReportFilters.module.scss:14`). Pesos 2 + 1 + 1 + 1.4 = 5.4 → **4.4/12 + 2.2/12 + 2.2/12 + 3.1/12**. Cada campo tiene además `min-width: 140px` (`:13`), que a anchos angostos gana sobre las fracciones, así que las fracciones son aproximadas.

`tabla-reporte` tiene scroll horizontal propio: `.tableWrap` declara `overflow-x: auto` (`RequirementsReportTable.module.scss:1-5`). Es el único bloque del producto con scroll horizontal real.

## Contenido

### barra-filtros
- Texto/label: contenedor sin texto propio
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.filterSection}>` (`RequirementsReportFilters.tsx:83`)

### buscador-titulo
- Texto/label: label `"Búsqueda"`; placeholder `"Buscar por título"` (`RequirementsReportFilters.tsx:92`)
- Icono: nada
- Asset: nada
- Annotation: debounce antes de propagar el valor (`:73-76`). El label tiene `htmlFor="report-search"` y el input el `id` correspondiente

### filtro-fecha-desde
- Texto/label: label `"Desde"`; `id="report-created-from"` (`RequirementsReportFilters.tsx:103-108`)
- Icono: nada
- Asset: nada
- Annotation: `<input type="date">` nativo, sin validación de rango contra filtro-fecha-hasta

### filtro-fecha-hasta
- Texto/label: label `"Hasta"`; `id="report-created-to"` (`RequirementsReportFilters.tsx:116-121`)
- Icono: nada
- Asset: nada
- Annotation: `<input type="date">` nativo, sin validación de rango contra filtro-fecha-desde

### filtro-proyecto
- Texto/label: label `"Proyecto"`, `aria-label="Proyecto"` (`:130`). Opciones: `"Todos los proyectos"` (`''`) + la lista de proyectos (`:78-80`)
- Icono: nada
- Asset: nada
- Annotation: `<ReactSelect inputId="report-project">` (`:128-136`)

### boton-exportar-csv
- Texto/label: `"Exportar CSV"` (`RequirementsReportFilters.tsx:139-141`)
- Icono: nada
- Asset: nada
- Annotation: exporta lo que está en pantalla (`items` ya filtrado), no el dataset completo (`RequirementsReportPage.tsx:43-46`). El archivo se llama `reporte-requisitos.csv` (`:45`), incluye BOM UTF-8 (`requirementsReportCsv.ts:8`, `:59`) y escapa comas, comillas y saltos de línea (`:30-35`). Sus encabezados son los mismos 12 de la tabla, definidos aparte en `CSV_HEADERS` (`requirementsReportCsv.ts:10-23`)

### tabla-reporte
- Texto/label: columnas verbatim (12): `"ID"` · `"Tipo"` · `"Título"` · `"Proyecto"` · `"Creado por"` · `"Fecha creación"` · `"Fecha inicio"` · `"Fecha resolución"` · `"Horas"` · `"Tipo de resolución"` · `"Conclusión"` · `"Comentario de resolución"` (`RequirementsReportTable.tsx:34-46`). Placeholder de celda vacía: `"-"` (guion corto, `:~7`)
- Icono: nada
- Asset: nada
- Annotation: formato de fecha `DD/MM/YYYY` vía `labelFromDate` (`:19`); horas vía `formatMinutes` (`:59`). Las filas no navegan

### vacio-reporte
- Texto/label: `"No se encontraron requisitos con los filtros aplicados"` (`RequirementsReportTable.tsx:25`)
- Icono: nada
- Asset: nada
- Annotation: nada

### mensaje-error
- Texto/label: `"Ocurrió un error al cargar el reporte"` (`RequirementsReportPage.tsx:63`)
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.error}>` sin `role="alert"`

### cargando-reporte
- Texto/label: `"Cargando reporte..."` (`requirements/report/page.tsx:12`)
- Icono: nada
- Asset: nada
- Annotation: `<Loader>` como fallback del `<Suspense>` de la página

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Query resuelta con al menos un ítem (`RequirementsReportTable.tsx:29-68`)

### empty
- Aplica: Sí
- Mensaje: `"No se encontraron requisitos con los filtros aplicados"` (`RequirementsReportTable.tsx:25`)
- Cambios:
  - vacio-reporte: solo visible en este estado (visible_only_in_states)
  - tabla-reporte: oculta en este estado (hidden_in_states)
  - barra-filtros: sin cambios, queda visible
- Nota: no diferencia el empty de primer uso. El mensaje dice `"con los filtros aplicados"` incluso sin ningún filtro activo

### loading
- Aplica: Sí
- Mensaje: `"Cargando reporte..."` (`requirements/report/page.tsx:12`)
- Cambios:
  - cargando-reporte: solo visible en este estado (visible_only_in_states)
  - Reemplaza **toda** la pantalla, incluida la barra de filtros
- Nota: solo cubre el primer render. **En el refetch por cambio de filtro no hay indicador:** el `<Suspense>` no lleva `key` e `isLoading` no se desestructura, así que la tabla vieja queda en pantalla (`requirements/report/page.tsx:12`, `RequirementsReportPage.tsx:25`)

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). El rango de fechas no se valida: `createdFrom` posterior a `createdTo` se manda a la api tal cual (`RequirementsReportFilters.tsx:103-121`) [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"Ocurrió un error al cargar el reporte"` (`RequirementsReportPage.tsx:63`)
- Cambios:
  - mensaje-error: solo visible en este estado (visible_only_in_states)
  - tabla-reporte: oculta en este estado (hidden_in_states)
  - barra-filtros: sin cambios, queda visible
- Disparado por `isError` de `useRequirementsReport` (`RequirementsReportPage.tsx:25`, `:62-64`)

### success
- Aplica: No — no implementado (ver gaps-as-is.md). La exportación no confirma nada: el click dispara la descarga sin toast, sin spinner y sin cambio visible (`RequirementsReportPage.tsx:43-46`) [fuente: código-existente]

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md)

## Interacciones

**Eventos:** [fuente: código-existente]
- buscador-titulo · on change → debounce → `onSearchChange` → `setFilters` (`RequirementsReportFilters.tsx:73-76`, `RequirementsReportPage.tsx:27-29`)
- filtro-fecha-desde · on change → `setFilters` inmediato (`RequirementsReportPage.tsx:31-37`)
- filtro-fecha-hasta · on change → `setFilters` inmediato (`RequirementsReportPage.tsx:31-37`)
- filtro-proyecto · on change → `setFilters` inmediato (`RequirementsReportPage.tsx:39-41`)
- boton-exportar-csv · click → `buildRequirementsReportCsv(items)` + `downloadCsv(...)` (`RequirementsReportPage.tsx:43-46`)

**Validaciones:**
- Ninguna. El rango entre las dos fechas no se valida, y exportar con 0 filas no se previene: `buildRequirementsReportCsv([])` produce un CSV con solo la fila de encabezados y se descarga igual; el botón no se deshabilita (`requirementsReportCsv.ts:54-60`, `RequirementsReportFilters.tsx:139`)

**Feedback:**
- Ninguno para la exportación
- El cambio de filtro no tiene indicador de carga
- El total de resultados no se muestra en ningún lado (`RequirementsReportTable.tsx:29-68`)

**Nota de estado:** los filtros viven en estado local, no en la URL (`RequirementsReportPage.tsx:18-23`), a diferencia del resto de los listados del producto. Un reporte filtrado no se puede compartir por link ni recuperar con el botón de atrás.

## Accesibilidad

- **Orden de foco:** buscador-titulo → filtro-fecha-desde → filtro-fecha-hasta → filtro-proyecto → boton-exportar-csv → tabla-reporte. **La región scrolleable de la tabla no es enfocable:** `.tableWrap` tiene `overflow-x: auto` pero sin `tabindex="0"` ni `role="region"`, así que un usuario de teclado no puede desplazarla y las últimas de las 12 columnas quedan inalcanzables sin mouse (`RequirementsReportTable.module.scss:1-5`, `RequirementsReportTable.tsx:30`) [fuente: código-existente].
- **Landmarks y jerarquía:** los landmarks son los del shell (`<nav>`, `<main>`, `<aside>`, `<header>` de `PageLayout`). Un solo `<h1>`, el del shell (`"Reporte de Requisitos"`, `requirements/report/page.tsx:10`); la pantalla no tiene `<h2>` porque no tiene secciones.
- **Foco y teclado:** el único overlay de la composición es el menú de `react-select` de filtro-proyecto, cuyo comportamiento de foco lo aporta la librería. No hay atajos propios.
- **Propio de esta composición:** el cambio de filtro reemplaza el contenido de la tabla **sin ninguna región live** que lo anuncie (`RequirementsReportTable.tsx:29`), y la descarga del CSV tampoco produce ningún cambio anunciable (`RequirementsReportPage.tsx:43-46`). `mensaje-error` es un `<div>` sin `role="alert"`, así que al aparecer no se anuncia (`RequirementsReportPage.tsx:63`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
- **[REQ-013] La identidad cambia; la pantalla, no.** Esta ficha documenta *qué* hay en la pantalla y *para qué* está; el Manual de marca Jiku v1.0 cambia **con qué está construido**. El accent pasa del magenta `#DA2C6A` al verde agua `#61CCB9` sobre azul oscuro `#0B1934` con fondo niebla `#F6F6F9`, y Archivo se reemplaza por Sora (títulos de vista) + Gabarito (interfaz, datos, microcopy). Ningún bloque de esta pantalla se agrega, se elimina ni cambia de propósito por ese motivo [REQ-013 RF-1, RF-2, CA-1].
- **[REQ-013] Cada elemento hecho a mano pasa a su componente del Design System.** Los bloques que esta ficha declara —botones, campos, selects, tarjetas, tablas, badges— se implementan con los componentes normativos de `docs/design-system/web/components/`, no con marcado propio. Es un cambio de implementación con consecuencia visible —dejan de haber dos botones que se ven distinto haciendo lo mismo— pero **no cambia la estructura declarada acá**: un bloque que ya existía sigue existiendo, con el mismo tipo y el mismo propósito [REQ-013 RF-3, RF-4, CA-5, CA-10].
- **[REQ-013] Los estados declarados en esta ficha se conservan.** La migración es de presentación: ningún estado se agrega, se quita ni cambia su condición de disparo. Lo que cambia es cómo se ve cada uno —el loader es ahora uno solo, el vacío tiene componente `EmptyState` disponible— sin que la ficha declare estados nuevos. **Cablear `EmptyState` en las pantallas que hoy no tienen estado vacío queda fuera de este REQ** y sigue registrado en `gaps-as-is.md` [REQ-013 §Fuera de Alcance].
- **[REQ-013] `desktop` sigue siendo el viewport único.** El requerimiento **no** habilita mobile: el DS mantiene el responsive del shell como objetivo declarado sin fecha y no declara el viewport `mobile` hasta que el shell lo cumpla. El layout por viewport de esta ficha no cambia [REQ-013 §Fuera de Alcance, CA-15].
- **[REQ-013] El selector de tema vive en el shell, no en esta pantalla.** La superficie gana modo oscuro con un control para elegirlo, ubicado en el pie de la sidebar junto a Cerrar sesión. Como es parte del shell de `(loggedin)`, está presente acá pero **no se declara como bloque de esta ficha**: declararlo en las 21 pantallas autenticadas repetiría veintiuna veces el mismo control. En modo oscuro esta pantalla usa la paleta propia del DS —canvas `#0E121A`, superficies `#1B202C` separadas por contraste y sin borde—, no una inversión de la clara [REQ-013 RF-7, CA-11].
