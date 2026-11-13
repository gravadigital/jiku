---
document: UX Survey Screen
screen: alta-requisito
route: /requirements/new
service: web
source_files:
  - src/app/(loggedin)/requirements/new/page.tsx
  - src/features/requirements/components/CreateRequirementForm/CreateRequirementForm.tsx
  - src/features/requirements/components/CreateRequirementForm/CreateRequirementForm.module.scss
  - src/features/requirements/components/RequirementRichTextEditor/RequirementRichTextEditor.tsx
  - src/features/requirements/hooks/useCreateRequirement.ts
  - src/features/requirements/hooks/useRequirementTagSuggestions.ts
viewports_detected:
  - mobile
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: alta-requisito

> **Relevamiento as-is** de `/requirements/new`, extraído de
> `src/features/requirements/components/CreateRequirementForm/CreateRequirementForm.tsx`
> (651 líneas). La página de la ruta son 6 líneas que montan el componente.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md).

## Identidad

- **Ruta:** `/requirements/new`
- **Archivo:** `src/app/(loggedin)/requirements/new/page.tsx` → `<CreateRequirementForm>`
  (`'use client'`)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** alta de requisito en dos paneles: detalle (título, contexto markdown,
  etiquetas) e información general (proyecto, estado, tipo, prioridad, visibilidad, responsables,
  fechas).
- **Viewports con tratamiento:** `mobile` y `desktop`. Dos cortes: **1024px** (colapsa a una columna)
  y **640px** (ajustes menores).

## Entrada y salida

**Entradas:**
- Botón `"Nuevo requisito"` del encabezado de `listado-requisitos` · `requirements/page.tsx:35`
- Botón `+` de la sección de requisitos de `detalle-proyecto`, con
  `?projectId={id}` · `ProjectRequirementsSection.tsx:92`

**Salidas:**
- `/requirements` · link `"Volver"` · `CreateRequirementForm.tsx:382-384`
- `/requirements` · tras crear con éxito · `CreateRequirementForm.tsx:345`

**Redirects automáticos:**
- Ninguno.

> **Preselección por query param:** si la URL trae `?projectId=`, el select de proyecto se precarga
> con ese valor una vez que la lista de proyectos llegó · `CreateRequirementForm.tsx:220`, `:277-278`

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | encabezado-pagina | `header` | — | ambos | `<header className={styles.pageHeader}>` | `:377` |
| 2 | titulo-pagina | `heading` | h1 | ambos | `<h1>Nuevo Requisito</h1>` | `:379` |
| 3 | boton-volver | `link` | — | ambos | `<Link href="/requirements">` | `:382-384` |
| 4 | boton-crear | `button` | primary · default / loading | ambos | `<button type="submit" disabled aria-busy>` | `:385-392` |
| 5 | panel-detalle | `card` | — | ambos | `<div className={styles.panelCard}>` | `:399` |
| 6 | titulo-panel-detalle | `heading` | h2 | ambos | `<h2>Detalle</h2>` | `:400` |
| 7 | campo-titulo | `text-input` | default | ambos | `<input type="text" aria-label="Título">` | `:408-414` |
| 8 | campo-contexto | `text-input` | default | ambos | `<RequirementRichTextEditor>` | `:424-432` |
| 9 | seccion-etiquetas | `section` | — | ambos | `<div className={styles.tagsSection}>` | `:435` |
| 10 | sugerencias-etiqueta | `list` | — | ambos | `<div className={styles.suggestions}>` con botones | `:438-453` |
| 11 | chip-etiqueta | `badge` | — | ambos | `<span className={styles.chip}>` con botón de borrar | `:457-471` |
| 12 | campo-clave-etiqueta | `text-input` | default | ambos | `<input aria-label="Clave">` | `:479-485` |
| 13 | campo-valor-etiqueta | `text-input` | default | ambos | `<input aria-label="Valor">` | `:492-498` |
| 14 | boton-agregar-etiqueta | `button` | secondary · disabled | ambos | `<button>` con texto `"Agregar"` | `:500-507` |
| 15 | panel-informacion | `card` | — | ambos | `<aside className={styles.panelRight}>` | `:513` |
| 16 | titulo-panel-informacion | `heading` | h2 | ambos | `<h2>Información general</h2>` | `:514` |
| 17 | campo-proyecto | `dropdown` | closed / open | ambos | `<Select inputId="projectId">` | `:520-528` |
| 18 | campo-estado | `dropdown` | closed / open | ambos | `<Select inputId="state">` | `:535-543` |
| 19 | campo-tipo | `dropdown` | closed / open | ambos | `<Select inputId="type">` | `:550-557` |
| 20 | campo-prioridad | `dropdown` | closed / open | ambos | `<Select inputId="priority">` | `:564-573` |
| 21 | campo-visibilidad | `dropdown` | closed / open | ambos | `<Select inputId="visibilityLevel">` | `:580-592` |
| 22 | campo-responsables | `dropdown` | multi · closed / open | ambos | `<Select isMulti isClearable={false}>` | `:599-616` |
| 23 | campo-fecha-creacion | `date-picker` | disabled · readonly | ambos | `<input type="date" disabled readOnly>` | `:623-631` |
| 24 | campo-fecha-estimada | `date-picker` | default | ambos | `<input type="date">` | `:638-646` |

> **`panel-informacion` es un `<aside>`**, aunque contiene los campos obligatorios principales
> (proyecto). Ver Accesibilidad.

> **No usa `<PageLayout>`, `<Button>` ni los `Input*` compartidos.** Monta su propio encabezado y usa
> `<input>` nativos y `react-select` (importado como `Select`, que **no** es el `<Select>` de
> `shared/components/ui`).

## Layout observado por viewport

### desktop · ≥1025px

- encabezado-pagina
  - titulo-pagina · boton-volver · boton-crear (fila, `space-between`)
- row `paneles`
  - col ~7/12 (`minmax(0, 1fr)`): panel-detalle
    - titulo-panel-detalle
    - campo-titulo
    - campo-contexto
    - seccion-etiquetas (sugerencias-etiqueta, chip-etiqueta × N, campo-clave-etiqueta,
      campo-valor-etiqueta, boton-agregar-etiqueta)
  - col ~5/12 (420px fijos): panel-informacion
    - titulo-panel-informacion
    - campo-proyecto · campo-estado · campo-tipo · campo-prioridad · campo-visibilidad ·
      campo-responsables · campo-fecha-creacion · campo-fecha-estimada (columna)

**Origen:** `CreateRequirementForm.module.scss:89-90`:

```scss
.panels { display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: ...; }
```

**Las fracciones son aproximadas:** columna derecha de **420px fijos**. A 1440px de viewport
(contenido ~1118px) es ~7.5/12 + ~4.5/12.

### mobile / tablet · ≤1024px

- encabezado-pagina
- columna única, en el orden del DOM:
  - panel-detalle
  - panel-informacion

**Origen:** `CreateRequirementForm.module.scss:94-96` —
`@media (max-width: 1024px) { grid-template-columns: 1fr; }`

Hay un segundo corte en **640px** con ajustes de los bloques de etiquetas
(`CreateRequirementForm.module.scss:322`, `:479`).

> **El corte es 1024px acá y 1023px en `detalle-requisito`.** Un pixel de diferencia entre dos
> pantallas del mismo dominio: a exactamente 1024px, el detalle está en una columna y el formulario en
> dos.

## Contenido

### encabezado-pagina
- titulo-pagina: `"Nuevo Requisito"` · `:379`
- boton-volver: `"Volver"` · `:383`
- boton-crear: `"Crear Requisito"`, y en loading `"Creando..."` · `:391`

### campo-titulo
- Texto/label: `"Título"` (label visible) · `aria-label="Título"` · `:404`, `:411`
- Origen: `:402-415`
- Annotation: sin placeholder

### campo-contexto
- Texto/label: `"Contexto"` (label visible, con `id="description-label"`) ·
  `ariaLabel="Contexto"` · `:419-423`, `:426`
- Placeholder: `"Describe el requisito..."` · `:427`
- Origen: `:418-433`
- Annotation: editor markdown con soporte de adjuntos embebidos
  (`entityType="requirement_draft"`), que se pueden subir **antes** de que el requisito exista — el
  backend los ancla al usuario. `<RequirementRichTextEditor>` es el mismo componente del formulario de
  comentarios del detalle.
- **El placeholder usa tuteo peninsular (`"Describe"`)**, igual que el del comentario en el detalle, y
  a diferencia del voseo del resto del producto.

### seccion-etiquetas
- Label: `"Etiquetas"` · `:436`
- Sugerencias: dinámicas desde `useRequirementTagSuggestions`. Se muestran como botones clickeables ·
  `:438-453`
- Chip: `` `${tag.key}:${tag.value}` `` con botón de borrar,
  `aria-label={`Eliminar tag ${tag.key}:${tag.value}`}` · `:457-471`
- campo-clave-etiqueta: label `"Clave"` · `aria-label="Clave"` · `:476`, `:482`
- campo-valor-etiqueta: label `"Valor"` · `aria-label="Valor"` · `:488`, `:495`
- boton-agregar-etiqueta: `"Agregar"` · `:506`
- Annotation: **está deshabilitado hasta que clave y valor tengan contenido tras `trim()`**
  (`disabled={!tagKey.trim() || !tagValue.trim()}`, `:504`). Es el único control del formulario con
  validación efectiva en la UI.

> Hay además un SVG de etiqueta declarado en el archivo (`:362-372`, con `aria-hidden="true"`) que
> **no se renderiza** en el botón de agregar. Componente sin uso dentro del propio archivo.

### Campos del panel de información

| Campo | Label verbatim | Placeholder verbatim | Opciones |
|---|---|---|---|
| campo-proyecto | `"Proyecto"` | `"Seleccionar proyecto..."` | `"Seleccionar proyecto..."` (`''`) + proyectos en `analisis`/`activo` |
| campo-estado | `"Estado"` | — | `"Análisis"` · `"Planificación"` · `"En cola"` · `"Desarrollo"` · `"Revisión"` · `"Resuelto"` · `"Cancelado"` |
| campo-tipo | `"Tipo"` | — | `"Sin tipo"` (`''`) · `"Funcionalidad"` · `"Mejora"` · `"Incidencia"` · `"Otro"` |
| campo-prioridad | `"Prioridad"` | — | `"Sin prioridad"` · `"Baja"` · `"Media"` · `"Alta"` · `"Urgente"` |
| campo-visibilidad | `"Visibilidad"` | — | `"Público"` (`public`) · `"Interno"` (`internal`) |
| campo-responsables | `"Responsable(s)"` | `"Seleccionar responsable(s)..."` | las personas de `usePersons` |
| campo-fecha-creacion | `"Fecha de creación"` | — | `disabled readOnly`, valor `todayISO` |
| campo-fecha-estimada | `"Fecha de finalización estimada"` | — | `type="date"` editable |

Origen: `:517-646`, opciones en `:30-57`, `:263`

Defaults: `priority: 'sin_prioridad'`, `state: 'analisis'`, `visibilityLevel: 'public'` · `:229-231`

> **El default de visibilidad es `public`.** En el formulario de comentario del detalle el default es
> `internal` (`RequirementActivityForm.tsx:19`). Dos defaults opuestos para el mismo concepto.

> **`campo-estado` ofrece los 7 estados en el alta**, incluidos `"Resuelto"` y `"Cancelado"`: se puede
> crear un requisito ya cerrado, salteando el workflow del stepper.

> **`campo-fecha-creacion` está deshabilitado y muestra la fecha de hoy.** Es un campo de solo lectura
> en un formulario de alta: no aporta información que el usuario no sepa y no se puede cambiar.

### Mensajes de toast
- Éxito: `"Requisito creado correctamente"` · `:344`
- Error: `error.message` o `"Error al crear el requisito"` · `:350-352`

## Estados presentes

### default
- Disparado por: carga de la pantalla
- Origen: `:376-649`
- Annotation: `form` inicial en `:225-234`

### loading (durante la creación)
- Mensaje: `"Creando..."` en el botón
- Disparado por: `isPending` de `useCreateRequirement`
- Origen: `:388-391`
- Cambios: el texto del botón, `disabled` y `aria-busy`. Los campos siguen editables.

### success
- Mensaje: toast `"Requisito creado correctamente"`
- Disparado por: `onSuccess`
- Origen: `:343-346`
- Cambios: navega a `/requirements`

### error de sistema
- Mensaje: toast `error.message` o `"Error al crear el requisito"`
- Disparado por: `onError`
- Origen: `:348-353`
- Cambios: solo toast; el formulario queda con los datos

### sugerencias de etiqueta disponibles
- Disparado por: `tagSuggestions.length > 0`
- Origen: `:438-453`
- Cambios: aparece la fila de botones de sugerencia

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error de validación visible** | **el gap central.** El schema yup define tres mensajes específicos (`"El título es requerido"`, `"La descripción es requerida"`, `"El proyecto es requerido"`, con `.test('not-blank')` para strings de espacios), y el estado de errores se declara como `const [, setErrors] = useState<Record<string, string>>({})` — **el getter está descartado con una coma**. Los errores se escriben y **nunca se leen**: ningún campo se marca y no hay mensaje | `:195-202`, `:236` |
| error al cargar proyectos | `useProjects` sin `isError`: el select queda vacío sin explicación | `:222` |
| error al cargar personas | `usePersons` sin `isError`: el select de responsables queda vacío | `:~223` |
| error al cargar sugerencias | sin manejo: la fila de sugerencias no aparece | `:438` |
| empty | no aplica: es un alta | — |
| not found | no aplica | — |
| estado terminal / readonly | no aplica al alta | — |
| confirmación al salir con cambios | no existe. `"Volver"` descarta todo, **incluidos los adjuntos ya subidos** al borrador | `:382-384` |
| error por campo desde la api | toast genérico | `:348-353` |
| feedback al agregar etiqueta con clave vacía | **no aplica: está prevenido.** El botón se deshabilita hasta que clave y valor tengan contenido | `:504` |
| **etiqueta duplicada** | **no se controla.** `handleAddTag` hace `setTags(prev => [...prev, {key, value}])` sin chequear si el par ya existe: se puede agregar la misma etiqueta N veces y aparecen N chips | `:292-293` |
| **huérfanos de adjuntos** | si se suben adjuntos al borrador y se abandona la pantalla, quedan anclados al usuario sin requisito. **No hay limpieza en el frontend** | `:426-431` (`entityType="requirement_draft"`) |

## Interacciones

**Eventos:**
- campo-titulo · on change → `setForm` · `:412`
- campo-contexto · on change → `setForm`, vía el editor · `:428`
- cada `<Select>` · on change → `setForm({[campo]: opt?.value ?? default})` · `:529`, `:544`,
  `:558`, `:571`, `:590`
- campo-responsables · on change → `setForm({responsiblePersonIds: opts.map(o => o.value)})` ·
  `:611-615`
- campo-fecha-estimada · on change → `setForm({estimatedFinishDate: e.target.value})` · `:645`
- sugerencia de etiqueta · click → agrega el chip · `:444-450`
- boton-agregar-etiqueta · click → `handleAddTag`: retorna si clave o valor están vacíos tras `trim()`, si no agrega `{key, value}` a `tags` y limpia los inputs · `:292-296`
- chip-etiqueta · click en la cruz → quita del array · `:462-468`
- `<form>` · submit → valida, arma el payload y llama a `createRequirement` · `:~330-355`

**Validaciones (schema yup, `:194-203`):**
- `title` · `required` + `.test('not-blank')` → `"El título es requerido"`
- `description` · `required` + `.test('not-blank')` → `"La descripción es requerida"`
- `projectId` · `typeError` + `required` → `"El proyecto es requerido"`

> **Los tres mensajes son código inalcanzable desde la UI**, igual que en los formularios de proyecto
> — pero acá el motivo es distinto y más explícito: el getter del estado de errores está descartado
> (`const [, setErrors]`).

**Payload condicional (`:335-338`):**
- `responsiblePersonIds` se incluye solo si hay al menos uno
- `tags` se incluye solo si hay al menos una

**Feedback:**
- Creación: `"Creando..."` + `disabled` + `aria-busy`
- Resultado: toast, ya sobre el listado en el caso de éxito
- Sugerencias de etiqueta como atajo

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Labels asociados | Presentes con `htmlFor` / `id` en todos los campos | `:403`, `:419`, `:475`, `:487`, `:517`, `:532`, `:547`, `:561`, `:577`, `:600`, `:624`, `:639` |
| `aria-label` redundante | Presente **además** del label visible en casi todos los campos. Redundante pero no dañino: el `aria-label` gana y el texto coincide | `:411`, `:482`, `:495`, `:522`, `:537`, `:552`, `:566`, `:582`, `:605`, `:628`, `:644` |
| `react-select` con `inputId` | Presente y coincidente con el `htmlFor`. Correcto | `:521`, `:536`, `:551`, `:565`, `:581`, `:604` |
| Editor markdown | `ariaLabel="Contexto"` y `labelId="description-label"` | `:425-426` |
| `boton-agregar-etiqueta` | Tiene texto `"Agregar"`, así que su nombre accesible es correcto. El `disabled` **no** se explica con `aria-describedby`: un usuario de lector de pantalla no sabe por qué no se puede activar | `:500-507` |
| Botón de borrar chip | `aria-label={`Eliminar tag ${k}:${v}`}`. Correcto | `:465` |
| `aria-busy` en el submit | Presente. Correcto | `:389` |
| `<form noValidate>` | Presente: la validación es propia — **pero los mensajes no se muestran** | `:376` |
| Error anunciado | **ausente.** Sin `aria-invalid`, sin `aria-describedby`, sin `role="alert"`. Y sin mensaje de ningún tipo | `:236` |
| Jerarquía de encabezados | `<h1>` para el título, `<h2>` para cada panel. Correcto | `:379`, `:400`, `:514` |
| `<aside>` para campos obligatorios | El panel derecho es un `<aside>` (landmark complementario) y contiene `campo-proyecto`, que es **obligatorio**. Semánticamente sugiere contenido secundario | `:513` |
| Campo readonly | `campo-fecha-creacion` tiene `disabled` **y** `readOnly`: `disabled` lo saca del orden de tabulación y del árbol accesible | `:629-630` |
| `required` nativo | **ausente en todos los campos**, incluidos los tres obligatorios del schema | `:408-414`, `:520-528` |
| Foco tras el error | No se maneja | `:~330` |

## Observaciones del relevamiento

- **`const [, setErrors] = useState({})`** (`:236`) es la evidencia más directa del producto de que
  el manejo de errores de validación quedó a medio hacer: el estado se escribe y el getter está
  descartado sintácticamente. Los tres mensajes del schema existen, están en español y son
  inalcanzables.
- **Las etiquetas se pueden duplicar.** `handleAddTag` no chequea si el par `key:value` ya está en
  el array (`:292-293`), así que el mismo par agregado dos veces produce dos chips. El botón de borrar
  filtra por índice (`:299`), así que borrar funciona — pero el payload manda el duplicado. **A
  verificar en `api`** si lo rechaza.
- **Se puede crear un requisito ya `resuelto` o `cancelado`** desde el select de estado (`:46-52`),
  salteando el workflow que `detalle-requisito` modela con el stepper. No se puede determinar si es
  deliberado.
- **El default de visibilidad es `public`** acá y `internal` en el formulario de comentario del
  detalle. Dos defaults opuestos para el mismo concepto en el mismo dominio.
- **Los adjuntos del borrador pueden quedar huérfanos.** El editor sube con
  `entityType="requirement_draft"` sin `entityId`, anclados al usuario. Si se abandona la pantalla, no
  hay limpieza del lado del frontend. **A verificar en `api`** si hay recolección.
- **`campo-fecha-creacion` es un campo deshabilitado que muestra la fecha de hoy.** No aporta y ocupa
  lugar. En `edicion-requisito` el equivalente es `type="text"` con la fecha formateada, también
  deshabilitado.
- **El corte responsive es 1024px acá y 1023px en el detalle.** A exactamente 1024px las dos
  pantallas del mismo requisito tienen layouts distintos.
- **`"Describe el requisito..."` rompe el voseo** del resto del producto.
- **El objeto `selectStyles` está definido dos veces en este archivo** (`:60-115` para los selects
  normales y `:117-190` para el multi de responsables), y es una de las 6 copias del producto.
- **A confirmar en consolidación:** si los errores deben mostrarse (el arreglo es leer `errors`, que ya
  se calcula), si el alta debe permitir estados terminales, y cuál es el default correcto de
  visibilidad.
