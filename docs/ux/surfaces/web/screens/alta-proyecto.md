---
name: alta-proyecto
surface: web
route: /projects/new
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Alta de proyecto

## Identidad

- **Audiencia primaria:** equipo-interno. Requiere sesión — el guard está en `(loggedin)/layout.tsx:13-21` [fuente: código-existente].
- **JTBD / Propósito:** formulario de alta de proyecto en dos cards: información general y propiedades clave/valor extensibles [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport. Sin tratamiento responsive: las grillas son `1fr 1fr` fijas, sin media query, así que la grilla de 2 columnas se mantiene a cualquier ancho.
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Botón `"Nuevo proyecto"` del encabezado de `listado-proyectos` · `projects/page.tsx:23` [fuente: código-existente]

**Salidas user-driven:**
- `/projects` · click en `boton-volver` · `projects/new/page.tsx:234`
- `/projects/{id}` · tras crear con éxito, al **detalle del proyecto nuevo** · `projects/new/page.tsx:195`

**Salidas automáticas:**
- Ninguna.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | cargando-clientes | loader | — | feedback | desktop | visible_only_in_states: loading | Indicador mientras trae los clientes |
| 2 | encabezado-pagina | header | — | layout | desktop | hidden_in_states: loading | Título y acciones |
| 3 | titulo-pagina | heading | h1 | content | desktop | hidden_in_states: loading | Nombra la pantalla |
| 4 | boton-volver | button | secondary | input | desktop | hidden_in_states: loading | Vuelve al listado sin guardar |
| 5 | boton-guardar | button | primary · default / loading | input | desktop | state_overrides: loading→"Guardando..." + disabled | Envía el alta |
| 6 | card-informacion-general | card | — | layout | desktop | hidden_in_states: loading | Agrupa los campos generales |
| 7 | campo-nombre | text-input | default | input | desktop | hidden_in_states: loading | Nombre del proyecto |
| 8 | campo-fecha-inicio | date-picker | default | input | desktop | hidden_in_states: loading | Fecha de inicio |
| 9 | campo-codigo | text-input | default | input | desktop | hidden_in_states: loading | Código del proyecto |
| 10 | campo-fecha-cierre | date-picker | default | input | desktop | hidden_in_states: loading | Fecha de cierre estimada |
| 11 | campo-cliente | dropdown | closed / open | input | desktop | hidden_in_states: loading | Actor asociado |
| 12 | campo-descripcion | text-input | default | input | desktop | hidden_in_states: loading | Descripción del proyecto |
| 13 | campo-tipo | dropdown | closed / open | input | desktop | hidden_in_states: loading | Tipo de proyecto |
| 14 | card-propiedades | card | — | layout | desktop | hidden_in_states: loading | Agrupa las propiedades clave/valor |
| 15 | campo-documentacion | text-input | default | input | desktop | hidden_in_states: loading | URL de documentación |
| 16 | campo-board | text-input | default | input | desktop | hidden_in_states: loading | URL del board |
| 17 | campo-diseno | text-input | default | input | desktop | hidden_in_states: loading | URL de diseño |
| 18 | propiedad-dinamica | text-input | default | input | desktop | hidden_in_states: loading | Par clave/valor agregado por el usuario |
| 19 | boton-borrar-propiedad | button | — | input | desktop | hidden_in_states: loading | Quita un par dinámico |
| 20 | campo-clave-nueva | text-input | default | input | desktop | hidden_in_states: loading | Clave del par a agregar |
| 21 | campo-valor-nuevo | text-input | default | input | desktop | hidden_in_states: loading | Valor del par a agregar |
| 22 | boton-agregar-propiedad | button | secondary | input | desktop | hidden_in_states: loading | Agrega el par al formulario |
| 23 | marca-obligatorio | badge | — | feedback | desktop | visible_only_in_states: campo obligatorio vacío | Marca el campo requerido sin completar |

**Origen:** `projects/new/page.tsx:227`, `:231`, `:232`, `:234-236`, `:237-244`, `:250`, `:257-265`, `:275-282`, `:289-297`, `:304-310`, `:317-330`, `:338-345`, `:352-372`, `:378`, `:385-392`, `:399-406`, `:413-420`, `:424-459`, `:435-456`, `:468-475`, `:481-488`, `:492-494`, `:255`, `:272`, `:287`, `:336`, `:350`

**No usa `<PageLayout>`** ni `<Button>` ni los `Input*` compartidos: monta su propio encabezado y usa `<input>`/`<textarea>`/`<button>` nativos con clases propias, más `react-select` para los dos dropdowns. Es una de las 6 pantallas con encabezado propio [fuente: código-existente].

## Layout por viewport

### desktop · 1440px

- encabezado-pagina
  - row `acciones` (`space-between`): titulo-pagina · boton-volver · boton-guardar
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
    - col 6/12 × N: propiedad-dinamica (con boton-borrar-propiedad)
    - row `agregar` (3 columnas `1fr 1fr auto`)
      - campo-clave-nueva · campo-valor-nuevo · boton-agregar-propiedad

**Origen:** `projects/new/styles.module.scss:83-84` — `.formGrid { display: grid; grid-template-columns: 1fr 1fr; }`, y `:180-181` — `.addPropRow { display: grid; grid-template-columns: 1fr 1fr auto; }`. Las fracciones son exactas: 6/12 + 6/12 [fuente: código-existente].

`campo-descripcion` usa `.fieldSpan3` (`styles.module.scss:95` — `grid-row: span 3`), que en una grilla de 2 columnas **abarca 3 filas de la primera columna**, no las dos columnas de ancho. El nombre de la clase sugiere `span 3` de columnas [fuente: código-existente].

Sin media query, la grilla de 2 columnas se mantiene a 400px de ancho: cada campo queda en ~180px, y los `<input type="date">` nativos no caben en ese ancho [fuente: código-existente].

## Contenido

### cargando-clientes
- Texto/label: `"Cargando..."`
- Icono: nada
- Asset: imagen del componente `<Loader>`
- Annotation: `projects/new/page.tsx:227`

### encabezado-pagina
- Texto/label: sin texto propio — contiene título y acciones
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.pageHeader}>` (`:231`)

### titulo-pagina
- Texto/label: `"Nuevo Proyecto"`
- Icono: nada
- Asset: nada
- Annotation: capitalización de título (`"Nuevo Proyecto"`), distinta de `"Editar Proyecto"` en la pantalla hermana y de `"Crear actor"` en el dominio de actores (`:232`) [fuente: código-existente]

### boton-volver
- Texto/label: `"Volver"`
- Icono: nada
- Asset: nada
- Annotation: `<button onClick={() => push('/projects')}>` (`:235`)

### boton-guardar
- Texto/label: `"Guardar"`; en loading, `"Guardando..."`
- Icono: nada
- Asset: nada
- Annotation: **sí** lleva `disabled={createProjectMutation.isPending}` (`:241`) — a diferencia de los formularios de actor (`:243`) [fuente: código-existente]

### card-informacion-general
- Texto/label: título de card `<h2>` que agrupa los siete campos generales
- Icono: nada
- Asset: nada
- Annotation: `:250-251`

### campo-nombre
- Texto/label: `"Nombre"` · placeholder `"Nombre del proyecto"` · obligatorio
- Icono: nada
- Asset: nada
- Annotation: `required` nativo presente (`:264`)

### campo-fecha-inicio
- Texto/label: `"Fecha de inicio"` · sin placeholder (`type="date"`) · obligatorio
- Icono: nada
- Asset: nada
- Annotation: `required` nativo presente (`:281`). El default es `new Date('')` — una fecha inválida a propósito: `dateToInputValue` la convierte en `''`, y el submit la elimina del payload si sigue inválida (`:24-38`, `:166-168`) [fuente: código-existente]

### campo-codigo
- Texto/label: `"Código"` · placeholder `"Código del proyecto"` · obligatorio
- Icono: nada
- Asset: nada
- Annotation: `required` nativo presente (`:296`)

### campo-fecha-cierre
- Texto/label: `"Fecha de cierre estimada"` · sin placeholder · no obligatorio
- Icono: nada
- Asset: nada
- Annotation: si queda falsy se elimina de la request (`:162-180`)

### campo-cliente
- Texto/label: `"Cliente"` · placeholder `"Cliente del proyecto"` · no obligatorio
- Icono: nada
- Asset: nada
- Annotation: `<ReactSelect isClearable>` con `inputId` que coincide con el `htmlFor` del label (`:317-330`)

### campo-descripcion
- Texto/label: `"Descripción"` · placeholder `"Descripción del proyecto"` · obligatorio
- Icono: nada
- Asset: nada
- Annotation: es un `<textarea>` plano, **sin preview de markdown**, aunque el detalle del proyecto lo renderiza como markdown. El placeholder no menciona markdown, a diferencia del de actor (`:338-345`) [fuente: código-existente]

### campo-tipo
- Texto/label: `"Tipo"` · placeholder `"Tipo de proyecto"` · obligatorio · opciones `"Interno"` (`interno`) · `"Comercial"` (`comercial`) · `"Investigación"` (`investigacion`) · `"Propuesta"` (`propuesta`)
- Icono: nada
- Asset: nada
- Annotation: el array de opciones está escrito dos veces en el mismo componente: una para calcular el `value` seleccionado (`:358-363`) y otra para el prop `options` (`:366-371`). **No hay campo de estado en el alta:** se fija `status: 'analisis'` en los valores por defecto (`:36`) [fuente: código-existente]

### card-propiedades
- Texto/label: título de card `<h2>` que agrupa las propiedades
- Icono: nada
- Asset: nada
- Annotation: `:378-379`

### campo-documentacion
- Texto/label: `"Documentación"` · placeholder `"URL de documentación"`
- Icono: nada
- Asset: nada
- Annotation: clave fija `documentacion` (`FIXED_KEYS`, `:40`)

### campo-board
- Texto/label: `"Board de Tareas"` · placeholder `"URL del board"`
- Icono: nada
- Asset: nada
- Annotation: clave fija `board_de_tareas`

### campo-diseno
- Texto/label: `"Diseño"` · placeholder `"URL de diseño"`
- Icono: nada
- Asset: nada
- Annotation: clave fija `diseño`

### propiedad-dinamica
- Texto/label: la clave cruda, sin formatear · placeholder `"Valor"`
- Icono: nada
- Asset: nada
- Annotation: **el label es la clave cruda** (`<label>{key}</label>`, `:426`): si el usuario escribe `mattermost_group_name`, eso es lo que se muestra. El detalle del proyecto sí pasa las claves por un `formatKey` (`ProjectProperties.tsx:29`); acá no. El label **no tiene `htmlFor`** (`:426`), a diferencia de todos los demás [fuente: código-existente]

### boton-borrar-propiedad
- Texto/label: sin texto visible · `aria-label="Eliminar link {key}"`
- Icono: tacho (SVG)
- Asset: nada
- Annotation: el SVG **no** tiene `aria-hidden` (`:435-456`, `:439`, `:441-455`)

### campo-clave-nueva
- Texto/label: `"Clave"` · placeholder `"Clave"`
- Icono: nada
- Asset: nada
- Annotation: `:468-475`

### campo-valor-nuevo
- Texto/label: `"Valor"` · placeholder `"Valor"`
- Icono: nada
- Asset: nada
- Annotation: `:481-488`

### boton-agregar-propiedad
- Texto/label: `"Agregar"`
- Icono: nada
- Asset: nada
- Annotation: se alinea con un espaciador `<span className={styles.fieldLabel}>&nbsp;</span>` (`:491`, `:492-494`)

### marca-obligatorio
- Texto/label: `"(obligatorio)"`
- Icono: nada
- Asset: nada
- Annotation: **aparece solo mientras el campo está vacío** y desaparece al completarlo: `{!formData.name && <span className={styles.required}>(obligatorio)</span>}`. No es un mensaje de error: es una marca de estado del campo (`:255`, `:272`, `:287`, `:336`, `:350`) [fuente: código-existente]

### Mensajes de toast (chrome compartido)
- Validación fallida: `"Hay campos obligatorios sin completar"` · `:186`
- Error de creación: `"Hubo un error al crear el proyecto"` · `:192`
- Éxito: `"Proyecto creado con éxito"` · `:196`

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Disparado por los clientes cargados; valores por defecto en `:24-38` (`:229-502`) [fuente: código-existente]

### empty
- Aplica: No — no implementado (ver gaps-as-is.md). Es un alta.

### loading
- Aplica: Sí
- Mensajes: `"Cargando..."` (carga inicial de clientes) y `"Guardando..."` (durante el guardado)
- Cambios:
  - **Carga inicial:** cargando-clientes solo visible en este estado (visible_only_in_states); reemplaza toda la pantalla, incluido el encabezado. Disparado por `isLoadingClients` de `useClients()` (`:227`)
  - **Guardado:** boton-guardar: content=`"Guardando..."`, variant=disabled (state_override). Los campos siguen editables. Disparado por `createProjectMutation.isPending` (`:241-243`)
  [fuente: código-existente]

### error de validación
- Aplica: Sí
- Mensaje: toast `"Hay campos obligatorios sin completar"`
- Cambios: **solo el toast.** Ningún campo se marca: el schema usa `abortEarly: false`, que produce todos los errores, y el `catch` los descarta por completo (`catch { toast.error('Hay campos obligatorios sin completar'); return; }`). Con 5 campos obligatorios, hay que adivinar cuál falta (`:183-188`) [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: toast `"Hubo un error al crear el proyecto"`
- Cambios: ninguno en la pantalla; el formulario queda con los datos (`:191-193`). En un fallo de render, el boundary heredado `projects/error.tsx:6-11` muestra `"Error"` + `error.message` [fuente: código-existente]
- **El error al cargar clientes no se maneja:** `useClients` sin `isError`; ante un fallo, `clients` cae al default `[]` y el select de cliente queda vacío sin explicación, mientras `isLoadingClients` pasa a false y la pantalla se muestra (`:146`, `:227`) [fuente: código-existente]

### success
- Aplica: Sí
- Mensaje: toast `"Proyecto creado con éxito"`
- Cambios: navega al detalle del proyecto creado (`/projects/{created.id}`), no al listado (`:194-197`) [fuente: código-existente]

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md)

### campo obligatorio vacío (parent_state: default)
- Aplica: Sí
- Mensaje: `"(obligatorio)"` junto al label
- Cambios:
  - marca-obligatorio: solo visible en este estado (visible_only_in_states), por campo
  - El campo **no cambia de color ni de borde**
- Disparado por el valor del campo falsy (`:255`, `:272`, `:287`, `:336`, `:350`) [fuente: código-existente]

### confirmación al salir con cambios
- Aplica: No — no implementado (ver gaps-as-is.md). `"Volver"` navega directo, descartando todo sin aviso (`:234-236`) [fuente: código-existente].

### error por campo devuelto por la api
- Aplica: No — no implementado (ver gaps-as-is.md). Se muestra como toast genérico; un código duplicado no se asocia al campo (`:191-193`) [fuente: código-existente].

### feedback al agregar propiedad
- Aplica: No — no implementado (ver gaps-as-is.md). `handleAddPair` **retorna en silencio** si la clave está vacía, si es una de las fijas, o si ya existe. Sin mensaje (`:210-217`) [fuente: código-existente].

## Interacciones

**Eventos:**
- cada campo · on change → `setField(name, value)`, que soporta rutas anidadas de un nivel (`keyValuePairs.documentacion`) partiendo por `.` · `:149-160`
- campo-cliente · on change → `setField('clientId', Number(opt.value))` o `null` si se limpia · `:327`
- boton-guardar · on click → `processCreation()` · `:240`
- `<form>` · on submit → `preventDefault()` + `processCreation()` · `:201-204`
- boton-agregar-propiedad · on click → `handleAddPair()`: trimea la clave, rechaza vacía / fija / duplicada, agrega al objeto y limpia los dos inputs · `:210-217`
- boton-borrar-propiedad · on click → `handleRemovePair(key)`, sin confirmar · `:219-225`
- boton-volver · on click → `push('/projects')` · `:234-236`

[fuente: código-existente]

**Validaciones (schema yup, `:42-68`):**
- campo-codigo · `required` → mensaje `"El código es requerido"`
- campo-descripcion · `required` → mensaje `"La descripción es requerida"`
- campo-fecha-inicio · `date().required` → mensaje `"La fecha de inicio es requerida"`
- campo-nombre · `required` → mensaje `"El nombre es requerido"`
- campo-tipo · `required` → mensaje `"El tipo es requerido"`
- campo-cliente · `number().nullable()` → sin regla
- campo-fecha-cierre · `date().nullable()` → sin regla
- `keyValuePairs` · objeto nullable con transform que convierte `''` y `undefined` en `null` · `:48-65`

**Los cinco mensajes del schema nunca se muestran:** el `catch` los descarta y muestra el toast genérico. Están escritos y son código inalcanzable desde la UI [fuente: código-existente].

Limpieza del payload antes de enviar (`:162-180`): `endDate` falsy → se elimina; `clientId` falsy → se elimina; `initDate` inválida → `undefined`; `keyValuePairs` sin ningún valor no-nulo → se elimina.

**Feedback:**
- Campo obligatorio vacío: la marca `"(obligatorio)"`
- Guardado: `"Guardando..."` + `disabled`
- Resultado: toast, ya sobre el detalle del proyecto en el caso de éxito

## Accesibilidad

- **Orden de foco:** boton-volver → boton-guardar → campo-nombre → campo-fecha-inicio → campo-codigo → campo-fecha-cierre → campo-cliente → campo-descripcion → campo-tipo → campo-documentacion → campo-board → campo-diseno → por cada par dinámico: propiedad-dinamica y boton-borrar-propiedad → campo-clave-nueva → campo-valor-nuevo → boton-agregar-propiedad. Los botones de acción están en el encabezado, así que **se recorren antes que los campos que envían** [fuente: código-existente].
- **Landmarks y jerarquía:** `<h1>` para titulo-pagina y `<h2>` para cada card (información general y propiedades). Correcto (`:232`, `:251`, `:379`) [fuente: código-existente].
- **Foco y teclado:** los dos dropdowns son de `react-select`, que aporta su propio comportamiento de teclado; la pantalla no monta overlays propios con focus trap. **Tras un error de validación el foco no se maneja:** queda en el botón (`:183-188`) [fuente: código-existente].
- **Propio de esta composición:**
  - **El error no se anuncia por campo:** no hay `aria-invalid`, ni `aria-describedby`, ni `role="alert"` propio. El único canal es el toast, que `react-toastify` sí anuncia (`:183-188`).
  - **El label de `propiedad-dinamica` no está asociado a su input** (sin `htmlFor`), a diferencia de todos los campos fijos, que sí tienen `htmlFor`/`id` (`:426` vs `:254`, `:269`, `:286`, `:301`, `:314`, `:334`, `:349`).
  - **`required` nativo está en nombre, fecha de inicio, código y descripción, pero ausente en `campo-tipo`**, que sí es obligatorio en el schema (`:264`, `:281`, `:296`, `:344` vs `:352-372`).
  - **La marca `"(obligatorio)"` es texto dentro del `<label>`, así que se lee como parte del nombre accesible del campo — y desaparece al completarlo, así que el nombre accesible cambia mientras se escribe** (`:255`).
  - El espaciador `<span className={styles.fieldLabel}>&nbsp;</span>` que alinea el botón de agregar es un label vacío que se lee como espacio (`:491`).
  [fuente: código-existente]

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
