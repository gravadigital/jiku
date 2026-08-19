---
document: UX Survey Screen
screen: edicion-requisito
route: /requirements/[reqid]/edit
service: web
source_files:
  - src/app/(loggedin)/requirements/[reqid]/edit/page.tsx
  - src/features/requirements/components/EditRequirementForm/EditRequirementForm.tsx
  - src/features/requirements/components/EditRequirementForm/EditRequirementForm.module.scss
  - src/features/requirements/hooks/useUpdateRequirement.ts
viewports_detected:
  - mobile
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: edicion-requisito

> **Relevamiento as-is** de `/requirements/[reqid]/edit`, extraído de
> `src/features/requirements/components/EditRequirementForm/EditRequirementForm.tsx` (615 líneas).
> La página de la ruta son 19 líneas.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> **Es un duplicado de [alta-requisito](./alta-requisito.md)** con seis diferencias. Este survey
> documenta la pantalla y marca en cada sección qué difiere.

## Identidad

- **Ruta:** `/requirements/[reqid]/edit`
- **Archivo:** `src/app/(loggedin)/requirements/[reqid]/edit/page.tsx` (Server Component) →
  `<EditRequirementForm>` (`'use client'`)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** edita un requisito existente en dos paneles: detalle (título, contexto,
  etiquetas) e información general.
- **Viewports con tratamiento:** `mobile` y `desktop`, con cortes en **1024px** y **640px**.

## Diferencias con `alta-requisito`

| # | Diferencia | Origen |
|---|---|---|
| 1 | Título `"Editar Requisito"`; botón `"Guardar"` / `"Guardando..."` en vez de `"Crear Requisito"` / `"Creando..."` | `:343`, `:356` |
| 2 | `"Volver"` va al **detalle** del requisito, no al listado | `:346` |
| 3 | Tras guardar navega al **detalle**, no al listado | `:308` |
| 4 | Todos los `id`/`htmlFor` llevan prefijo `edit-` | `:375`, `:489`, `:591`… |
| 5 | `campo-fecha-creacion` es `type="text"` con la fecha real formateada, no `type="date"` con hoy | `:579-586` |
| 6 | El `aria-label` de la fecha estimada dice `"Fecha estimada"` mientras el label visible dice `"Fecha de finalización estimada"` | `:601`, `:606` |

Todo lo demás —estructura, layout, los tres cortes responsive, la validación descartada, la
accesibilidad— es idéntico.

## Entrada y salida

**Entradas:**
- Link `"Editar"` del encabezado de `detalle-requisito` · `RequirementHeader.tsx:210-212`

**Salidas:**
- `/requirements/{id}` · link `"Volver"` · `:346-348`
- `/requirements/{id}` · tras guardar con éxito · `:308`

**Redirects automáticos:**
- `notFound()` si el `reqid` de la URL no es numérico · `requirements/[reqid]/edit/page.tsx:14`

> **Es la segunda de las dos rutas del producto que validan el parámetro dinámico.**

> **El flujo de ida y vuelta es coherente acá:** se entra desde el detalle y se vuelve al detalle,
> tanto por `"Volver"` como al guardar. Contrasta con `edicion-proyecto`, que se entra desde el
> detalle y vuelve al listado.

## Estructura

Igual que `alta-requisito`:

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | encabezado-pagina | `header` | — | ambos | `<header className={styles.pageHeader}>` | `:341` |
| 2 | titulo-pagina | `heading` | h1 | ambos | `<h1>Editar Requisito</h1>` | `:343` |
| 3 | boton-volver | `link` | — | ambos | `<Link href="/requirements/{id}">` | `:346-348` |
| 4 | boton-guardar | `button` | primary · default / loading | ambos | `<button type="submit" disabled aria-busy>` | `:349-357` |
| 5 | panel-detalle | `card` | — | ambos | `<div className={styles.panelCard}>` | `:~362` |
| 6 | titulo-panel-detalle | `heading` | h2 | ambos | `<h2>Detalle</h2>` | `:~363` |
| 7 | campo-titulo | `text-input` | default | ambos | `<input type="text" aria-label="Título">` | `:~370-378` |
| 8 | campo-contexto | `text-input` | default | ambos | `<RequirementRichTextEditor>` | `:387-394` |
| 9 | seccion-etiquetas | `section` | — | ambos | `<div className={styles.tagsSection}>` | `:~400` |
| 10 | chip-etiqueta | `badge` | — | ambos | `<span className={styles.chip}>` con botón de borrar | `:~424-433` |
| 11 | campo-clave-etiqueta | `text-input` | default | ambos | `<input aria-label="Clave">` | `:~443-449` |
| 12 | campo-valor-etiqueta | `text-input` | default | ambos | `<input aria-label="Valor">` | `:~456-462` |
| 13 | boton-agregar-etiqueta | `button` | secondary · disabled | ambos | `<button>` con texto `"Agregar"` | `:~468` |
| 14 | panel-informacion | `card` | — | ambos | `<aside className={styles.panelRight}>` | `:477` |
| 15 | titulo-panel-informacion | `heading` | h2 | ambos | `<h2>Información general</h2>` | `:~478` |
| 16 | campo-proyecto | `dropdown` | closed / open | ambos | `<Select inputId="edit-project">` | `:~485-493` |
| 17 | campo-estado | `dropdown` | closed / open | ambos | `<Select inputId="edit-state">` | `:500-506` |
| 18 | campo-tipo | `dropdown` | closed / open | ambos | `<Select inputId="edit-type">` | `:514-520` |
| 19 | campo-prioridad | `dropdown` | closed / open | ambos | `<Select inputId="edit-priority">` | `:528-534` |
| 20 | campo-visibilidad | `dropdown` | closed / open | ambos | `<Select inputId="edit-visibility">` | `:544-550` |
| 21 | campo-responsables | `dropdown` | multi · closed / open | ambos | `<Select isMulti isClearable={false}>` | `:563-580` |
| 22 | campo-fecha-creacion | `text-input` | disabled · readonly | ambos | `<input type="text" disabled readOnly>` | `:579-586` |
| 23 | campo-fecha-estimada | `date-picker` | default | ambos | `<input type="date">` | `:600-607` |

> **No hay `sugerencias-etiqueta`** en esta pantalla: el bloque de sugerencias de
> `useRequirementTagSuggestions` existe solo en el alta.

> **No usa `<PageLayout>`, `<Button>` ni los `Input*` compartidos**, igual que el alta.

## Layout observado por viewport

### desktop · ≥1025px

- encabezado-pagina
  - titulo-pagina · boton-volver · boton-guardar (fila, `space-between`)
- row `paneles`
  - col ~7/12 (`minmax(0, 1fr)`): panel-detalle (titulo, contexto, etiquetas)
  - col ~5/12 (420px fijos): panel-informacion (8 campos en columna)

**Origen:** `EditRequirementForm.module.scss:89-90` — `grid-template-columns: minmax(0, 1fr) 420px`.

**Las fracciones son aproximadas** (columna derecha de 420px fijos): a 1440px de viewport es
~7.5/12 + ~4.5/12.

### mobile / tablet · ≤1024px

- encabezado-pagina
- columna única: panel-detalle, panel-informacion

**Origen:** `EditRequirementForm.module.scss:94-96` — `@media (max-width: 1024px)
{ grid-template-columns: 1fr; }`. Segundo corte en **640px** con ajustes de las etiquetas
(`:416`).

> **El corte es 1024px acá y 1023px en `detalle-requisito`**, de donde se entra y a donde se vuelve.

## Contenido

### encabezado-pagina
- titulo-pagina: `"Editar Requisito"` · `:343`
- boton-volver: `"Volver"` · `:347`
- boton-guardar: `"Guardar"`, y en loading `"Guardando..."` · `:356`

### campo-titulo
- Texto/label: `"Título"` (visible) · `aria-label="Título"` · `:~372`, `:375`
- Annotation: sin placeholder. Valor inicial desde `requirement.title`.

### campo-contexto
- Texto/label: `"Contexto"` (visible, `id="edit-description-label"`) · `ariaLabel="Contexto"` ·
  `:390`
- Placeholder: `"Describe el requisito..."` · `:391`
- Annotation: mismo editor markdown con adjuntos que el alta. **Tuteo peninsular**, igual que el alta.

### seccion-etiquetas
- chip-etiqueta: `` `${tag.key}:${tag.value}` `` con `aria-label={`Eliminar tag ${k}:${v}`}` · `:429`
- campo-clave-etiqueta: label `"Clave"` · `aria-label="Clave"` · `:446`
- campo-valor-etiqueta: label `"Valor"` · `aria-label="Valor"` · `:459`
- boton-agregar-etiqueta: `"Agregar"`, deshabilitado hasta que los dos campos tengan contenido

### Campos del panel de información

| Campo | Label verbatim | `aria-label` | Placeholder |
|---|---|---|---|
| campo-proyecto | `"Proyecto"` | `"Proyecto"` | — |
| campo-estado | `"Estado"` | `"Estado"` | — |
| campo-tipo | `"Tipo"` | `"Tipo"` | — |
| campo-prioridad | `"Prioridad"` | `"Prioridad"` | — |
| campo-visibilidad | `"Visibilidad"` | `"Visibilidad"` | — |
| campo-responsables | `"Responsable(s)"` | `"Responsable(s)"` | `"Seleccionar responsable(s)..."` |
| campo-fecha-creacion | `"Fecha de creación"` | `"Fecha de creación"` | — |
| campo-fecha-estimada | `"Fecha de finalización estimada"` | **`"Fecha estimada"`** | — |

Origen: `:485-607`

Las opciones de estado, tipo, prioridad y visibilidad son las mismas del alta, incluidos
`"En cola"`, `"Resuelto"` y `"Cancelado"`.

> **El `aria-label` de la fecha estimada no coincide con el label visible** (`"Fecha estimada"` vs
> `"Fecha de finalización estimada"`, `:601` y `:606`). El `aria-label` gana, así que un lector de
> pantalla anuncia un nombre distinto del que se ve. En el alta los dos dicen lo mismo.

> **`campo-fecha-creacion` es `type="text"`** con `formatDate(requirement.createdAt)` y
> `disabled readOnly` (`:579-586`). En el alta es `type="date"` con la fecha de hoy. Acá el valor sí
> aporta información (cuándo se creó), aunque no se puede editar.

### Mensajes de toast
- Éxito: `"Requisito actualizado correctamente"` · `:307`
- Error: `msg` compuesto o el fallback del componente · `:316`

## Estados presentes

### default (precargado)
- Disparado por: el requisito llega del Server Component como prop `requirement`
- Origen: `requirements/[reqid]/edit/page.tsx:16-18`, `EditRequirementForm.tsx:~230`
- Annotation: el estado local del formulario se inicializa desde la prop. Es el uso **legítimo** de
  copiar datos a estado local: un borrador editable.

### loading (durante el guardado)
- Mensaje: `"Guardando..."` en el botón
- Disparado por: `isPending` de `useUpdateRequirement`
- Origen: `:352-356`
- Cambios: texto del botón, `disabled` y `aria-busy`. Los campos siguen editables.

### success
- Mensaje: toast `"Requisito actualizado correctamente"`
- Disparado por: `onSuccess`
- Origen: `:306-309`
- Cambios: navega al detalle del requisito

### error de sistema
- Mensaje: toast con el mensaje de la api o el fallback
- Disparado por: `onError`
- Origen: `:311-317`
- Cambios: solo toast; el formulario queda con los datos

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error de validación visible** | mismo gap que el alta: el schema define los mensajes, el estado de errores se declara con el getter descartado, y **ningún campo se marca**. Con tres campos obligatorios no hay indicación de cuál falta | igual patrón que `CreateRequirementForm.tsx:236` |
| **not found (id numérico inexistente)** | `getRequirementById` en el Server Component **sin try/catch**, y **no hay `error.tsx` en la ruta** → pantalla de error por defecto de Next, sin sidebar | `requirements/[reqid]/edit/page.tsx:16`; no existe `requirements/error.tsx` |
| id no numérico | **sí se maneja:** `if (isNaN(id)) notFound()` | `requirements/[reqid]/edit/page.tsx:14` |
| loading inicial | no aplica: el Server Component espera el dato. **No hay `loading.tsx`**, así que la navegación desde el detalle no tiene feedback | no existe `requirements/[reqid]/edit/loading.tsx` |
| error al cargar proyectos / personas | `useProjects` y `usePersons` sin `isError`: los selects quedan vacíos sin explicación | `:~222-224` |
| confirmación al salir con cambios | no existe. `"Volver"` descarta todo, **incluidos los adjuntos ya subidos** | `:346-348` |
| error por campo desde la api | toast genérico | `:311-317` |
| etiqueta duplicada | no se controla, igual que en el alta | mismo patrón |
| **estado terminal / readonly** | **no existe.** Un requisito `resuelto` o `cancelado` se edita igual, y el select de estado permite cualquier transición entre los 7 — **salteando el workflow que `detalle-requisito` modela con el stepper y las reglas de incidencia** | `:500-506` |
| **sugerencias de etiqueta** | **no existen acá**, aunque el hook `useRequirementTagSuggestions` existe y el alta las usa. Editar un requisito no ofrece las etiquetas ya usadas en el sistema | comparar con `CreateRequirementForm.tsx:438-453` |

## Interacciones

**Eventos:**
- Idénticos al alta: `setForm` por campo, `handleAddTag` con `disabled` preventivo, borrado de chip
  por índice, submit del `<form>`.
- `<form onSubmit={handleSubmit}>` con `noValidate` · `:340`

**Validaciones:**
- Las mismas tres del alta (`title`, `description`, `projectId`), con los mismos mensajes y el mismo
  problema: **no se muestran**.

**Feedback:**
- Guardado: `"Guardando..."` + `disabled` + `aria-busy`
- Resultado: toast, ya sobre el detalle en el caso de éxito

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Labels asociados | Presentes con `htmlFor` / `id`, todos con prefijo `edit-` | `:~372`, `:~445`, `:~486`, `:501`, `:515`, `:529`, `:545`, `:~564`, `:580`, `:601` |
| `aria-label` redundante | Presente además del label visible en casi todos | `:375`, `:489`, `:502`, `:516`, `:530`, `:546`, `:565`, `:591`, `:606` |
| **`aria-label` que contradice el label visible** | `campo-fecha-estimada`: `aria-label="Fecha estimada"` vs label `"Fecha de finalización estimada"`. El `aria-label` gana | `:601`, `:606` |
| `react-select` con `inputId` | Presente y coincidente | `:~487`, `:501`, `:515`, `:529`, `:545`, `:564` |
| Editor markdown | `ariaLabel="Contexto"` + `labelId` | `:389-390` |
| `boton-agregar-etiqueta` | Texto `"Agregar"`. El `disabled` no se explica con `aria-describedby` | `:~468` |
| Botón de borrar chip | `aria-label` con clave y valor. Correcto | `:429` |
| `aria-busy` en el submit | Presente | `:353` |
| `<form noValidate>` | Presente, pero los mensajes no se muestran | `:340` |
| Error anunciado | **ausente.** Sin `aria-invalid`, sin `aria-describedby`, sin mensaje | igual que el alta |
| Jerarquía de encabezados | `<h1>` + `<h2>` por panel. Correcto | `:343`, `:~363`, `:~478` |
| `<aside>` para campos obligatorios | El panel derecho es un `<aside>` y contiene `campo-proyecto`, obligatorio | `:477` |
| Campo readonly | `campo-fecha-creacion` con `disabled` **y** `readOnly`: `disabled` lo saca del árbol accesible, así que **la fecha de creación no es legible por lector de pantalla** | `:584-585` |
| `required` nativo | **ausente en todos los campos** | `:~370-378`, `:~485-493` |

## Observaciones del relevamiento

- **Es un duplicado de 615 líneas contra 651 del alta**, con el mismo módulo SCSS clase por clase y
  seis diferencias reales. El prefijo `edit-` en los `id` sugiere que se copió el archivo y se
  renombraron los identificadores para evitar colisiones — que no pueden ocurrir, porque las dos
  pantallas nunca se renderizan juntas.
- **La divergencia ya ocurrió en dos lugares:** las sugerencias de etiqueta existen solo en el alta, y
  el `aria-label` de la fecha estimada se desincronizó del label visible.
- **El select de estado saltea el workflow.** `detalle-requisito` modela el flujo con un stepper,
  reglas de siguiente paso y un tratamiento especial para incidencias (`RequirementStatusCard.tsx:44-58`).
  Acá se puede pasar de `analisis` a `resuelto` en un submit, sin restricción. **Dos mecanismos de
  transición de estado con reglas distintas para el mismo recurso**: uno en el detalle con reglas, otro
  acá sin ninguna.
- **La fecha de creación no es accesible.** `disabled` la saca del orden de tabulación y del árbol de
  accesibilidad, así que el dato se ve pero no se lee.
- **No hay `loading.tsx` en la ruta.** Al navegar desde el detalle, el Server Component espera la
  respuesta de la api sin ningún indicador: la pantalla anterior queda congelada.
- **Los adjuntos del borrador pueden quedar huérfanos** si se abandona la pantalla, igual que en el
  alta.
- **A confirmar en consolidación:** si conviene unificar alta y edición en un componente con modo, si
  el select de estado debe respetar el workflow del stepper, y si la edición debería ofrecer las
  sugerencias de etiqueta.
