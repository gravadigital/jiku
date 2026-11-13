---
document: UX Survey Screen
screen: edicion-proyecto
route: /projects/edit/[id]
service: web
source_files:
  - src/app/(loggedin)/projects/edit/[id]/page.tsx
  - src/app/(loggedin)/projects/edit/[id]/styles.module.scss
  - src/features/projects/hooks/useProject.ts
  - src/features/projects/hooks/useUpdateProject.ts
  - src/features/projects/hooks/useClients.ts
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: edicion-proyecto

> **Relevamiento as-is** de `/projects/edit/[id]`, extraído de
> `src/app/(loggedin)/projects/edit/[id]/page.tsx` (583 líneas, `'use client'`).
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> **Es un duplicado de [alta-proyecto](./alta-proyecto.md)** con cinco diferencias. Este survey
> documenta la pantalla completa y marca en cada sección qué difiere, para no obligar a leer los dos
> archivos en paralelo.

## Identidad

- **Ruta:** `/projects/edit/[id]`
- **Archivo:** `src/app/(loggedin)/projects/edit/[id]/page.tsx`
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** edita un proyecto existente: información general, estado, y propiedades
  clave/valor extensibles.
- **Viewports con tratamiento:** ninguno. Grillas `1fr 1fr` fijas, sin media query.

## Diferencias con `alta-proyecto`

| # | Diferencia | Origen |
|---|---|---|
| 1 | **Tiene campo de estado** (`campo-estado`), con 5 opciones y `required` en el schema | `:69`, `:164-168`, `:427` |
| 2 | **Cuarta clave fija de propiedades:** `mattermost_group_name`, además de las tres del alta | `:34`, `:41`, `:66` |
| 3 | Título `"Editar Proyecto"` en vez de `"Nuevo Proyecto"` | `:291` |
| 4 | Precarga los valores del proyecto y hace `push('/projects')` al terminar, no al detalle | `:193`, `:~272` |
| 5 | Tiene un loader inicial adicional por la query del proyecto | `:285` |

Todo lo demás —estructura, layout, validación descartada, accesibilidad— es idéntico.

## Entrada y salida

**Entradas:**
- Botón `"Editar"` del encabezado de `detalle-proyecto` · `projects/[id]/page.tsx:37-39`

**Salidas:**
- `/projects` · botón `"Volver"` · `:298`
- `/projects` · tras guardar con éxito · `:~272`

**Redirects automáticos:**
- Ninguno.

> **Asimetría con el alta:** crear lleva al **detalle** del proyecto nuevo
> (`projects/new/page.tsx:195`); editar lleva al **listado**. Volver del listado al proyecto que se
> acaba de editar requiere buscarlo de nuevo.

## Estructura

Igual que `alta-proyecto`, más `campo-estado` y `campo-mattermost`:

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | cargando-proyecto | `loader` | — | ambos | `<Loader label="Cargando...">` | `:285` |
| 2 | encabezado-pagina | `header` | — | ambos | `<div className={styles.pageHeader}>` | `:290` |
| 3 | titulo-pagina | `heading` | h1 | ambos | `<h1>Editar Proyecto</h1>` | `:291` |
| 4 | boton-volver | `button` | secondary | ambos | `<button>` | `:296-299` |
| 5 | boton-guardar | `button` | primary · default / loading | ambos | `<button disabled={isPending}>` | `:301-307` |
| 6 | card-informacion-general | `card` | — | ambos | `<div className={styles.card}>` | `:~313` |
| 7 | campo-nombre | `text-input` | default | ambos | `<input type="text">` | `:317-326` |
| 8 | campo-fecha-inicio | `date-picker` | default | ambos | `<input type="date">` | `:332-340` |
| 9 | campo-codigo | `text-input` | default | ambos | `<input type="text">` | `:349-358` |
| 10 | campo-fecha-cierre | `date-picker` | default | ambos | `<input type="date">` | `:364-370` |
| 11 | campo-cliente | `dropdown` | closed / open | ambos | `<ReactSelect isClearable>` | `:377-391` |
| 12 | campo-descripcion | `text-input` | default | ambos | `<textarea>` | `:397-406` |
| 13 | campo-tipo | `dropdown` | closed / open | ambos | `<ReactSelect>` | `:412-419` |
| 14 | **campo-estado** | `dropdown` | closed / open | ambos | `<ReactSelect>` | `:427-434` |
| 15 | card-propiedades | `card` | — | ambos | `<div className={styles.card}>` | `:~445` |
| 16 | campo-documentacion | `text-input` | default | ambos | `<input type="text">` | `:~450-457` |
| 17 | campo-board | `text-input` | default | ambos | `<input type="text">` | `:~464-471` |
| 18 | **campo-mattermost** | `text-input` | default | ambos | `<input type="text">` | `:~478-485` |
| 19 | campo-diseno | `text-input` | default | ambos | `<input type="text">` | `:~492-499` |
| 20 | propiedad-dinamica | `text-input` | default | ambos | `<input>` + botón de borrar | `:~506-520` |
| 21 | boton-borrar-propiedad | `button` | — | ambos | `<button aria-label="Eliminar link {key}">` | `:~519` |
| 22 | campo-clave-nueva | `text-input` | default | ambos | `<input type="text">` | `:~548-555` |
| 23 | campo-valor-nuevo | `text-input` | default | ambos | `<input type="text">` | `:~561-568` |
| 24 | boton-agregar-propiedad | `button` | secondary | ambos | `<button>` | `:~572` |
| 25 | marca-obligatorio | `badge` | — | ambos | `<span className={styles.required}>(obligatorio)</span>` | varios |

> **No usa `<PageLayout>`, `<Button>` ni los `Input*` compartidos**, igual que el alta.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- encabezado-pagina
  - titulo-pagina · boton-volver · boton-guardar (fila, `space-between`)
- card-informacion-general
  - row `grilla` (2 columnas): campo-nombre · campo-fecha-inicio · campo-codigo ·
    campo-fecha-cierre · campo-cliente · campo-descripcion (`fieldSpan3`) · campo-tipo ·
    **campo-estado** — 6/12 cada uno
- card-propiedades
  - row `grilla` (2 columnas): campo-documentacion · campo-board · **campo-mattermost** ·
    campo-diseno · propiedad-dinamica × N — 6/12 cada uno
    - celda de alta: row `agregar` (`1fr 1fr auto`): campo-clave-nueva · campo-valor-nuevo ·
      boton-agregar-propiedad

**Origen:** `projects/edit/[id]/styles.module.scss:83-84` — `grid-template-columns: 1fr 1fr`, y
`:180-181` para la fila de alta. **El módulo SCSS tiene exactamente el mismo set de clases que el del
alta.**

Fracciones exactas: **6/12 + 6/12**.

> **`campo-estado` es el octavo campo de una grilla de 2 columnas**, así que cae en la cuarta fila
> junto a `campo-tipo`. Sumado a `.fieldSpan3` de la descripción (que ocupa 3 filas de una columna),
> el orden visual no coincide con el orden del DOM. No se puede determinar desde el código cuál es el
> resultado buscado.

## Contenido

### titulo-pagina
- Texto/label: `"Editar Proyecto"`
- Origen: `:291`

### boton-volver / boton-guardar
- Textos verbatim: `"Volver"` · `"Guardar"` · en loading, `"Guardando..."`
- Origen: `:298`, `:306`
- Annotation: `disabled={updateProjectMutation.isPending}` presente

### Campos de información general

| Campo | Label verbatim | Placeholder verbatim | Obligatorio en el schema |
|---|---|---|---|
| campo-nombre | `"Nombre"` | `"Nombre del proyecto"` | sí |
| campo-fecha-inicio | `"Fecha de inicio"` | — | sí |
| campo-codigo | `"Código"` | `"Código del proyecto"` | sí |
| campo-fecha-cierre | `"Fecha de cierre estimada"` | — | no |
| campo-cliente | `"Cliente"` | `"Cliente del proyecto"` | no |
| campo-descripcion | `"Descripción"` | `"Descripción del proyecto"` | sí |
| campo-tipo | `"Tipo"` | `"Tipo de proyecto"` | sí |
| **campo-estado** | `"Estado"` | `"Estado del proyecto"` | **sí** |

Origen: `:317-434`

Opciones de `campo-tipo`: `"Interno"` · `"Comercial"` · `"Investigación"` · `"Propuesta"` · `:157-160`

Opciones de `campo-estado`: `"Activo"` (`activo`) · `"Análisis"` (`analisis`) ·
`"Inactivo"` (`inactivo`) · `"Finalizado"` (`finalizado`) · `"Cancelado"` (`cancelado`) · `:164-168`

> **Las opciones de estado están extraídas a constantes de módulo** (`:157-168`), a diferencia del
> alta, donde el array de tipo está inline y duplicado dos veces en el JSX. Es la única mejora
> estructural del duplicado.

### Campos de propiedades

| Campo | Label verbatim | Placeholder verbatim |
|---|---|---|
| campo-documentacion | `"Documentación"` | `"URL de documentación"` |
| campo-board | `"Board de Tareas"` | `"URL del board"` |
| **campo-mattermost** | no relevado con precisión — ver Observaciones | `"Nombre del grupo"` |
| campo-diseno | `"Diseño"` | `"URL de diseño"` |
| propiedad-dinamica | la clave cruda, sin formatear | `"Valor"` |
| campo-clave-nueva | `"Clave"` | `"Clave"` |
| campo-valor-nuevo | `"Valor"` | `"Valor"` |
| boton-agregar-propiedad | `"Agregar"` | — |

Las cuatro claves fijas: `board_de_tareas`, `diseño`, `documentacion`, `mattermost_group_name`
(`FIXED_KEYS`, `:41`).

> **`campo-mattermost` es el único campo de propiedades que no es una URL** — su placeholder es
> `"Nombre del grupo"` (`:485`). Los otros tres piden URLs.

### Mensajes de toast
- Validación fallida: `"Hay campos obligatorios sin completar"` · `:261`
- Error de guardado: `"Hubo un error al editar el proyecto"` · `:269`
- Éxito: `"Proyecto editado con éxito"` · `:273`

## Estados presentes

### loading inicial
- Mensaje: `"Cargando..."`
- Disparado por: la query del proyecto y/o la de clientes
- Origen: `:285`
- Cambios: reemplaza toda la pantalla, incluido el encabezado

### default (precargado)
- Disparado por: el proyecto resuelto y el estado local poblado desde `projectData`
- Origen: `:193` (copia `status` y el resto de los campos al estado local)
- Annotation: los valores del proyecto se copian a estado local para editarlos. Es el uso
  **legítimo** de copiar datos de query a `useState` — un borrador editable.

### campo obligatorio vacío (sub-estado de default)
- Mensaje: `"(obligatorio)"` junto al label
- Disparado por: el valor del campo es falsy
- Cambios: aparece la marca

### error de validación
- Mensaje: toast `"Hay campos obligatorios sin completar"`
- Disparado por: `validationSchema.validateSync` lanza en el submit
- Origen: `:261`
- Cambios: **solo el toast.** Igual que el alta: los mensajes del schema se descartan.

### loading (durante el guardado)
- Mensaje: `"Guardando..."` en el botón + `disabled`
- Disparado por: `updateProjectMutation.isPending`
- Origen: `:301-307`

### success
- Mensaje: toast `"Proyecto editado con éxito"`
- Disparado por: `onSuccess`
- Origen: `:272-274`
- Cambios: navega a `/projects`

### error de sistema
- Mensaje: toast `"Hubo un error al editar el proyecto"`
- Disparado por: `onError`
- Origen: `:268-270`

### error de sistema (render)
- Cubierto por `projects/error.tsx`, el boundary del padre
- Origen: `projects/error.tsx:6-11`

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error de validación por campo** | mismo gap que el alta: el schema define 6 mensajes específicos, `abortEarly: false` los junta, y el `catch` los descarta a favor de un toast genérico de 2 segundos. Con 6 campos obligatorios hay que adivinar | `:261` |
| **error al cargar el proyecto** | **no se maneja.** `useProject` sin `isError`. Ante un fallo, el estado local no se puebla y la condición de carga sigue verdadera: **loader infinito**, igual que en `detalle-proyecto` y `edicion-actor` | `:~180`, `:285` |
| **not found (proyecto inexistente)** | mismo loader infinito. No hay `notFound()` | `:285` |
| **id no numérico** | sin validación. `/projects/edit/abc` pasa `"abc"` a la api | `:~175` |
| error al cargar clientes | `useClients` sin `isError`: el select queda vacío sin explicación | `:~181` |
| confirmación al salir con cambios | no existe. `"Volver"` descarta todo sin aviso — **más grave acá que en el alta**, porque los datos ya existían | `:296-299` |
| error por campo desde la api | toast genérico; un código duplicado no se asocia al campo | `:268-270` |
| **estado terminal / readonly** | **no existe.** Un proyecto `finalizado` o `cancelado` se edita igual que uno activo, y el select permite cualquier transición entre los 5 estados sin restricción. Comparar con requisitos, que sí tienen reglas de flujo | `:164-168` |
| feedback al agregar propiedad | retorna en silencio si la clave está vacía, es fija o ya existe | `:~210-217` |
| **campo de prioridad** | **no existe en ninguno de los dos formularios**, aunque `priority: number` está en el tipo (`project.types.ts:19`) y el listado la muestra como tag. No se puede determinar desde el código cómo se setea | `project.types.ts:19` |

## Interacciones

**Eventos:**
- cada campo · on change → `setField(name, value)` con soporte de rutas anidadas de un nivel
- campo-estado · on change → `setField('status', opt.value)` · `:~432`
- boton-guardar · click → valida y llama a `updateProjectMutation.mutate` · `:~255-275`
- `<form>` · submit → `preventDefault()` + el mismo handler
- boton-agregar-propiedad / boton-borrar-propiedad · igual que el alta

**Validaciones (schema yup):**
- `code` · `required` → `"El código es requerido"`
- `description` · `required` → `"La descripción es requerida"`
- `initDate` · `required` → `"La fecha de inicio es requerida"`
- `name` · `required` → `"El nombre es requerido"`
- `type` · `required` → `"El tipo es requerido"`
- **`status` · `required` → `"El estado es requerido"`** · `:69`
- `clientId`, `endDate` · nullable, sin regla
- `keyValuePairs` · objeto nullable con transform de `''` → `null`, incluyendo
  `mattermost_group_name` · `:66`

> **Los seis mensajes son código inalcanzable desde la UI**, igual que en el alta.

**Feedback:**
- Campo obligatorio vacío: marca `"(obligatorio)"`
- Guardado: `"Guardando..."` + `disabled`
- Resultado: toast, ya sobre el listado en el caso de éxito

## Accesibilidad observada

Idéntica a [alta-proyecto](./alta-proyecto.md). Lo relevante:

| Aspecto | Estado | Evidencia |
|---|---|---|
| Labels asociados | Presentes con `htmlFor` / `id` en los campos fijos | `:317`, `:332`, `:349`, `:364`, `:377`, `:397`, `:412`, `:427` |
| Label de propiedad dinámica | **sin `htmlFor`** | `:~508` |
| `react-select` con label | `inputId` coincide con el `htmlFor`. Correcto en los tres selects | `:~380`, `:~415`, `:~430` |
| `required` nativo | Presente en los inputs de texto y fecha obligatorios |  |
| `required` en los selects | **ausente** en `campo-tipo` y `campo-estado`, ambos obligatorios en el schema | `:412-434` |
| Error anunciado | **ausente.** Sin `aria-invalid`, sin `aria-describedby`. Solo el toast | `:261` |
| Marca `"(obligatorio)"` | Texto dentro del `<label>`: se lee como parte del nombre accesible, y desaparece al completar | varios |
| Botón de borrar propiedad | `aria-label` presente; el SVG sin `aria-hidden` | `:~519` |
| Jerarquía de encabezados | `<h1>` + `<h2>` por card. Correcto | `:291`, `:~313`, `:~445` |
| Foco tras el error | No se maneja | `:261` |

## Observaciones del relevamiento

- **Es un formulario duplicado, no una variante.** 583 líneas contra 503 del alta, mismo set exacto
  de clases SCSS, mismos labels, mismos placeholders, misma lógica de `setField`, `handleAddPair`,
  `handleRemovePair`, `dateToInputValue` e `inputValueToDate`. Las cinco diferencias reales están
  listadas arriba. Mantener las dos en sincronía es manual.
- **La divergencia ya ocurrió:** `mattermost_group_name` existe solo acá. Un proyecto creado en el
  alta no tiene ese campo hasta que alguien lo edita. No se puede determinar desde el código si el
  alta debería tenerlo.
- **El mismo `catch` que descarta los mensajes de validación** está en las dos pantallas. El helper
  `transformYupErrors` existe en `shared/utils` y ninguna de las dos lo usa, aunque
  `NewClientForm` sí.
- **La transición de estado no tiene reglas.** El select ofrece los 5 estados sin restricción: se
  puede pasar de `finalizado` a `analisis`. El dominio de requisitos sí tiene un stepper con flujo
  definido (`RequirementStatusCard.tsx:44-58`). No se puede determinar si la ausencia de reglas acá
  es deliberada.
- **`campo-mattermost` no se relevó con precisión.** El label exacto no se leyó; el placeholder es
  `"Nombre del grupo"` (`:485`). A completar antes de consolidar.
- **La asimetría de destino** (crear → detalle, editar → listado) no está explicada en el código.
- **No se pudo determinar** de dónde sale `priority`. Está en el tipo, se muestra en el listado y en
  el detalle, y **ningún formulario del frontend la escribe**. Puede venir de la api con un default,
  de otro servicio, o de `core`. **A verificar contra `api`.**
- **A confirmar en consolidación:** si conviene unificar las dos pantallas en un componente con modo
  alta/edición, si el estado debe tener reglas de transición, y de dónde sale la prioridad.
