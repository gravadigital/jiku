---
document: UX Survey Screen
screen: alta-proyecto
route: /projects/new
service: web
source_files:
  - src/app/(loggedin)/projects/new/page.tsx
  - src/app/(loggedin)/projects/new/styles.module.scss
  - src/features/projects/hooks/useCreateProject.ts
  - src/features/projects/hooks/useClients.ts
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: alta-proyecto

> **Relevamiento as-is** de `/projects/new`, extraído de
> `src/app/(loggedin)/projects/new/page.tsx` (503 líneas, `'use client'`).
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md).

## Identidad

- **Ruta:** `/projects/new`
- **Archivo:** `src/app/(loggedin)/projects/new/page.tsx`
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** formulario de alta de proyecto en dos cards: información general y
  propiedades clave/valor extensibles.
- **Viewports con tratamiento:** ninguno. Las grillas son `1fr 1fr` fijas, sin media query.

## Entrada y salida

**Entradas:**
- Botón `"Nuevo proyecto"` del encabezado de `listado-proyectos` · `projects/page.tsx:23`

**Salidas:**
- `/projects` · botón `"Volver"` · `projects/new/page.tsx:234`
- `/projects/{id}` · tras crear con éxito, al **detalle del proyecto nuevo** ·
  `projects/new/page.tsx:195`

**Redirects automáticos:**
- Ninguno.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | cargando-clientes | `loader` | — | ambos | `<Loader label="Cargando...">` | `projects/new/page.tsx:227` |
| 2 | encabezado-pagina | `header` | — | ambos | `<div className={styles.pageHeader}>` | `:231` |
| 3 | titulo-pagina | `heading` | h1 | ambos | `<h1>Nuevo Proyecto</h1>` | `:232` |
| 4 | boton-volver | `button` | secondary | ambos | `<button onClick={() => push('/projects')}>` | `:234-236` |
| 5 | boton-guardar | `button` | primary · default / loading | ambos | `<button disabled={isPending}>` | `:237-244` |
| 6 | card-informacion-general | `card` | — | ambos | `<div className={styles.card}>` | `:250` |
| 7 | campo-nombre | `text-input` | default | ambos | `<input type="text">` | `:257-265` |
| 8 | campo-fecha-inicio | `date-picker` | default | ambos | `<input type="date">` | `:275-282` |
| 9 | campo-codigo | `text-input` | default | ambos | `<input type="text">` | `:289-297` |
| 10 | campo-fecha-cierre | `date-picker` | default | ambos | `<input type="date">` | `:304-310` |
| 11 | campo-cliente | `dropdown` | closed / open | ambos | `<ReactSelect isClearable>` | `:317-330` |
| 12 | campo-descripcion | `text-input` | default | ambos | `<textarea>` | `:338-345` |
| 13 | campo-tipo | `dropdown` | closed / open | ambos | `<ReactSelect>` | `:352-372` |
| 14 | card-propiedades | `card` | — | ambos | `<div className={styles.card}>` | `:378` |
| 15 | campo-documentacion | `text-input` | default | ambos | `<input type="text">` | `:385-392` |
| 16 | campo-board | `text-input` | default | ambos | `<input type="text">` | `:399-406` |
| 17 | campo-diseno | `text-input` | default | ambos | `<input type="text">` | `:413-420` |
| 18 | propiedad-dinamica | `text-input` | default | ambos | `<input>` + botón de borrar por par | `:424-459` |
| 19 | boton-borrar-propiedad | `button` | — | ambos | `<button aria-label="Eliminar link {key}">` con SVG de tacho | `:435-456` |
| 20 | campo-clave-nueva | `text-input` | default | ambos | `<input type="text">` | `:468-475` |
| 21 | campo-valor-nuevo | `text-input` | default | ambos | `<input type="text">` | `:481-488` |
| 22 | boton-agregar-propiedad | `button` | secondary | ambos | `<button onClick={handleAddPair}>` | `:492-494` |
| 23 | marca-obligatorio | `badge` | — | ambos | `<span className={styles.required}>(obligatorio)</span>` | `:255`, `:272`, `:287`, `:336`, `:350` |

> **No usa `<PageLayout>`** ni `<Button>` ni los `Input*` compartidos: monta su propio encabezado y
> usa `<input>`/`<textarea>`/`<button>` nativos con clases propias, más `react-select` para los dos
> dropdowns. Es una de las 6 pantallas con encabezado propio.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- encabezado-pagina
  - titulo-pagina · boton-volver · boton-guardar (fila, `space-between`)
- card-informacion-general
  - row `grilla` (2 columnas)
    - col 6/12: campo-nombre
    - col 6/12: campo-fecha-inicio
    - col 6/12: campo-codigo
    - col 6/12: campo-fecha-cierre
    - col 6/12: campo-cliente
    - col 12/12: campo-descripcion (`fieldSpan3`)
    - col 6/12: campo-tipo
- card-propiedades
  - row `grilla` (2 columnas)
    - col 6/12: campo-documentacion
    - col 6/12: campo-board
    - col 6/12: campo-diseno
    - col 6/12 × N: propiedad-dinamica
    - celda de alta: row `agregar` (3 columnas `1fr 1fr auto`)
      - campo-clave-nueva · campo-valor-nuevo · boton-agregar-propiedad

**Origen:** `projects/new/styles.module.scss:83-84` — `.formGrid { display: grid;
grid-template-columns: 1fr 1fr; }`, y `:180-181` — `.addPropRow { display: grid;
grid-template-columns: 1fr 1fr auto; }`.

Las fracciones son exactas: **6/12 + 6/12**. La descripción usa `.fieldSpan3`
(`:95` — `grid-row: span 3`), que en una grilla de 2 columnas **abarca 3 filas de la primera
columna**, no las dos columnas de ancho. Ver Observaciones.

> **Sin media query**, la grilla de 2 columnas se mantiene a 400px de ancho: cada campo queda en
> ~180px. Los `<input type="date">` nativos no caben en ese ancho.

## Contenido

### titulo-pagina
- Texto/label: `"Nuevo Proyecto"`
- Origen: `:232`
- Annotation: capitalización de título (`"Nuevo Proyecto"`), distinta de `"Editar Proyecto"` en la
  pantalla hermana y de `"Crear actor"` en el dominio de actores

### boton-volver / boton-guardar
- Textos verbatim: `"Volver"` · `"Guardar"` · en loading, `"Guardando..."`
- Origen: `:235`, `:243`
- Annotation: `boton-guardar` **sí** lleva `disabled={createProjectMutation.isPending}` (`:241`) — a
  diferencia de los formularios de actor

### Campos de información general

| Campo | Label verbatim | Placeholder verbatim | Obligatorio |
|---|---|---|---|
| campo-nombre | `"Nombre"` | `"Nombre del proyecto"` | sí |
| campo-fecha-inicio | `"Fecha de inicio"` | — (`type="date"`) | sí |
| campo-codigo | `"Código"` | `"Código del proyecto"` | sí |
| campo-fecha-cierre | `"Fecha de cierre estimada"` | — | no |
| campo-cliente | `"Cliente"` | `"Cliente del proyecto"` | no |
| campo-descripcion | `"Descripción"` | `"Descripción del proyecto"` | sí |
| campo-tipo | `"Tipo"` | `"Tipo de proyecto"` | sí |

Origen: `:254-372`

Opciones de `campo-tipo`: `"Interno"` (`interno`) · `"Comercial"` (`comercial`) ·
`"Investigación"` (`investigacion`) · `"Propuesta"` (`propuesta`) · `:358-371`

> **El array de opciones de tipo está escrito dos veces** en el mismo componente: una para calcular
> el `value` seleccionado (`:358-363`) y otra para el prop `options` (`:366-371`).

> **`campo-descripcion` es un `<textarea>` plano**, sin preview de markdown, aunque el detalle del
> proyecto lo renderiza como markdown. El placeholder no menciona markdown, a diferencia del de
> actor.

> **No hay campo de estado.** El alta fija `status: 'analisis'` en los valores por defecto
> (`:36`), sin control en la UI. La pantalla de edición **sí** tiene el select de estado.

### Campos de propiedades

| Campo | Label verbatim | Placeholder verbatim |
|---|---|---|
| campo-documentacion | `"Documentación"` | `"URL de documentación"` |
| campo-board | `"Board de Tareas"` | `"URL del board"` |
| campo-diseno | `"Diseño"` | `"URL de diseño"` |
| propiedad-dinamica | la clave cruda, sin formatear | `"Valor"` |
| campo-clave-nueva | `"Clave"` | `"Clave"` |
| campo-valor-nuevo | `"Valor"` | `"Valor"` |
| boton-agregar-propiedad | `"Agregar"` | — |

Origen: `:382-494`

Las tres claves fijas son `documentacion`, `board_de_tareas` y `diseño` (`FIXED_KEYS`, `:40`).

> **El label de una propiedad dinámica es la clave cruda** (`<label>{key}</label>`, `:426`): si el
> usuario escribe `mattermost_group_name`, eso es lo que se muestra. El detalle del proyecto sí pasa
> las claves por un `formatKey` (`ProjectProperties.tsx:29`); acá no.

> **El label de `propiedad-dinamica` no tiene `htmlFor`** (`:426`), a diferencia de todos los demás.

### marca-obligatorio
- Texto/label: `"(obligatorio)"`
- Origen: `:255`, `:272`, `:287`, `:336`, `:350`
- Annotation: **aparece solo mientras el campo está vacío** y desaparece al completarlo:
  `{!formData.name && <span className={styles.required}>(obligatorio)</span>}`. No es un mensaje de
  error: es una marca de estado del campo.

### Mensajes de toast
- Validación fallida: `"Hay campos obligatorios sin completar"` · `:186`
- Error de creación: `"Hubo un error al crear el proyecto"` · `:192`
- Éxito: `"Proyecto creado con éxito"` · `:196`

## Estados presentes

### loading inicial
- Mensaje: `"Cargando..."`
- Disparado por: `isLoadingClients` de `useClients()`
- Origen: `:227`
- Cambios: reemplaza toda la pantalla, incluido el encabezado

### default
- Disparado por: clientes cargados
- Origen: `:229-502`
- Annotation: valores por defecto en `:24-38`. **`initDate: new Date('')`** es una fecha inválida
  (`Invalid Date`) a propósito: `dateToInputValue` la convierte en `''`, y el submit la elimina del
  payload si sigue inválida (`:166-168`).

### campo obligatorio vacío (sub-estado de default)
- Mensaje: `"(obligatorio)"` junto al label
- Disparado por: el valor del campo es falsy
- Origen: `:255`, `:272`, `:287`, `:336`, `:350`
- Cambios: aparece la marca; el campo no cambia de color ni de borde

### error de validación
- Mensaje: toast `"Hay campos obligatorios sin completar"`
- Disparado por: `validationSchema.validateSync` lanza en el submit
- Origen: `:183-188`
- Cambios: **solo el toast.** Ver estados ausentes.

### loading (durante el guardado)
- Mensaje: `"Guardando..."` en el botón
- Disparado por: `createProjectMutation.isPending`
- Origen: `:241-243`
- Cambios: el texto del botón y `disabled`. Los campos siguen editables.

### success
- Mensaje: toast `"Proyecto creado con éxito"`
- Disparado por: `onSuccess` de la mutación
- Origen: `:194-197`
- Cambios: navega al detalle del proyecto creado (`/projects/{created.id}`), no al listado

### error de sistema
- Mensaje: toast `"Hubo un error al crear el proyecto"`
- Disparado por: `onError` de la mutación
- Origen: `:191-193`
- Cambios: solo toast; el formulario queda con los datos

### error de sistema (render)
- Cubierto por `projects/error.tsx`, el boundary del padre
- Origen: `projects/error.tsx:6-11`

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error de validación por campo** | **es el gap principal de esta pantalla.** El schema usa `abortEarly: false`, que produce todos los errores… y el `catch` los **descarta por completo**: `catch { toast.error('Hay campos obligatorios sin completar'); return; }`. El usuario recibe un toast genérico que se cierra en 2 segundos y **ningún campo se marca**. Con 5 campos obligatorios, hay que adivinar cuál falta | `:183-188` |
| **error al cargar clientes** | `useClients` sin `isError`. Ante un fallo, `clients` cae al default `[]` y el select de cliente queda vacío sin explicación. `isLoadingClients` pasa a false, así que la pantalla se muestra | `:146`, `:227` |
| empty | no aplica: es un alta | — |
| not found | no aplica | — |
| estado terminal / readonly | no aplica | — |
| confirmación al salir con cambios | no existe. `"Volver"` navega directo, descartando todo sin aviso | `:234-236` |
| error por campo desde la api | se muestra como toast genérico; un código duplicado no se asocia al campo | `:191-193` |
| feedback al agregar propiedad | `handleAddPair` **retorna en silencio** si la clave está vacía, si es una de las fijas, o si ya existe. Sin mensaje | `:210-217` |
| feedback al borrar propiedad | borra sin confirmar. Coherente con que es un campo de formulario, no un dato persistido | `:219-225` |

## Interacciones

**Eventos:**
- cada campo · on change → `setField(name, value)`, que soporta rutas anidadas de un nivel
  (`keyValuePairs.documentacion`) partiendo por `.` · `:149-160`
- campo-cliente · on change → `setField('clientId', Number(opt.value))` o `null` si se limpia ·
  `:327`
- boton-guardar · click → `processCreation()` · `:240`
- `<form>` · submit → `preventDefault()` + `processCreation()` · `:201-204`
- boton-agregar-propiedad · click → `handleAddPair()`: trimea la clave, rechaza vacía / fija /
  duplicada, agrega al objeto y limpia los dos inputs · `:210-217`
- boton-borrar-propiedad · click → `handleRemovePair(key)` · `:219-225`

**Validaciones (schema yup, `:42-68`):**
- `code` · `required` → `"El código es requerido"`
- `description` · `required` → `"La descripción es requerida"`
- `initDate` · `date().required` → `"La fecha de inicio es requerida"`
- `name` · `required` → `"El nombre es requerido"`
- `type` · `required` → `"El tipo es requerido"`
- `clientId` · `number().nullable()` → sin regla
- `endDate` · `date().nullable()` → sin regla
- `keyValuePairs` · objeto nullable con transform que convierte `''` y `undefined` en `null` ·
  `:48-65`

> **Los cinco mensajes del schema nunca se muestran.** El `catch` los descarta y muestra el toast
> genérico. Están escritos y son código inalcanzable desde la UI.

**Limpieza del payload antes de enviar (`:162-180`):**
- `endDate` falsy → se elimina de la request
- `clientId` falsy → se elimina
- `initDate` inválida → se pone `undefined`
- `keyValuePairs` sin ningún valor no-nulo → se elimina

**Feedback:**
- Campo obligatorio vacío: la marca `"(obligatorio)"`
- Guardado: `"Guardando..."` + `disabled`
- Resultado: toast, ya sobre el detalle del proyecto en el caso de éxito

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Labels asociados | Presentes con `htmlFor` / `id` en todos los campos fijos | `:254`, `:269`, `:286`, `:301`, `:314`, `:334`, `:349` |
| Label de propiedad dinámica | **sin `htmlFor`**: no está asociado al input | `:426` |
| `react-select` con label | Usa `inputId` que coincide con el `htmlFor` del label. Correcto | `:318`, `:353` |
| `required` nativo | Presente en nombre, fecha de inicio, código, descripción | `:264`, `:281`, `:296`, `:344` |
| `required` en los selects | **ausente** en `campo-tipo`, que sí es obligatorio en el schema | `:352-372` |
| Error anunciado | **ausente.** No hay `aria-invalid`, no hay `aria-describedby`, no hay `role="alert"` propio. El único canal es el toast, que `react-toastify` sí anuncia | `:183-188` |
| Marca `"(obligatorio)"` | Es texto dentro del `<label>`, así que **se lee como parte del nombre accesible** del campo. Correcto — pero desaparece al completar, así que el nombre accesible cambia mientras se escribe | `:255` |
| Botón de borrar propiedad | `aria-label={`Eliminar link ${key}`}` presente; el SVG **no** tiene `aria-hidden` | `:439`, `:441-455` |
| Botón de agregar | Texto `"Agregar"`. Correcto | `:493` |
| Espaciador con `&nbsp;` | `<span className={styles.fieldLabel}>&nbsp;</span>` para alinear el botón: es un label vacío que se lee como espacio | `:491` |
| Jerarquía de encabezados | `<h1>` para el título, `<h2>` para cada card. Correcto | `:232`, `:251`, `:379` |
| Foco tras el error | No se maneja: el foco queda en el botón | `:183-188` |

## Observaciones del relevamiento

- **El gap más importante es que los mensajes de validación existen y no se muestran.** El schema
  define cinco mensajes específicos en español, el `validateSync` corre con `abortEarly: false`
  para juntarlos todos, y el `catch` los tira. `NewClientForm` del dominio de actores **sí** los mapea
  a errores por campo con `transformYupErrors`. El helper existe en `shared/utils` y esta pantalla no
  lo usa.
- **`.fieldSpan3` con `grid-row: span 3`** (`styles.module.scss:95`) hace que la descripción abarque
  **tres filas de una columna**, no el ancho completo. El nombre de la clase sugiere `span 3` de
  columnas, que en una grilla de 2 no tendría sentido. No se puede determinar si el efecto visual es
  el buscado.
- **El alta no tiene campo de estado y la edición sí.** El alta fija `status: 'analisis'` (`:36`);
  `edicion-proyecto` ofrece un select con cinco opciones y lo declara `required` en su schema
  (`projects/edit/[id]/page.tsx:69`). Asimetría entre las dos pantallas del mismo recurso.
- **`edicion-proyecto` tiene una cuarta clave fija, `mattermost_group_name`**, que el alta no tiene
  (`projects/edit/[id]/page.tsx:41` vs `:40` de esta). Un proyecto creado acá no tiene ese campo hasta
  que se lo edita.
- **Los dos archivos comparten el módulo SCSS clase por clase** (mismo set exacto de nombres), pero
  son dos archivos separados de 503 y 583 líneas. Es un formulario duplicado con cinco diferencias.
- **El objeto `selectStyles` de `react-select` está definido en esta pantalla** (`:87-138`) y es una
  de las 6 copias del producto.
- **No hay control de estado del proyecto ni de prioridad** en el alta, aunque el listado muestra
  ambos como tags. La prioridad no aparece en ninguno de los dos formularios: **no se puede determinar
  desde el código cómo se setea.**
- **A confirmar en consolidación:** si los errores deben mostrarse por campo (el arreglo es usar
  `transformYupErrors`, que ya existe), y de dónde sale la prioridad del proyecto.
