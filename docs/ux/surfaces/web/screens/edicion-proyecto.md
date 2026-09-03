---
name: edicion-proyecto
surface: web
route: /projects/edit/[id]
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.1"
date: 2026-09-02
---

# Pantalla: Edición de proyecto

## Identidad

- **Audiencia primaria:** equipo-interno. Requiere sesión — el guard está en `(loggedin)/layout.tsx:13-21` [fuente: código-existente].
- **JTBD / Propósito:** edita un proyecto existente: información general, estado, y propiedades clave/valor extensibles [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport. Sin tratamiento responsive: grillas `1fr 1fr` fijas, sin media query.
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Botón `"Editar"` del encabezado de `detalle-proyecto` · `projects/[id]/page.tsx:37-39` [fuente: código-existente]

**Salidas user-driven:**
- `/projects` · click en `boton-volver` · `:298`
- `/projects` · tras guardar con éxito · `:~272`

**Salidas automáticas:**
- Ninguna.

Crear lleva al **detalle** del proyecto nuevo (`projects/new/page.tsx:195`); editar lleva al **listado**. Volver del listado al proyecto que se acaba de editar requiere buscarlo de nuevo [fuente: código-existente].

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | cargando-proyecto | loader | — | feedback | desktop | visible_only_in_states: loading | Indicador de la carga inicial |
| 2 | encabezado-pagina | header | — | layout | desktop | hidden_in_states: loading | Título y acciones |
| 3 | titulo-pagina | heading | h1 | content | desktop | hidden_in_states: loading | Nombra la pantalla |
| 4 | boton-volver | button | secondary | input | desktop | hidden_in_states: loading | Vuelve al listado sin guardar |
| 5 | boton-guardar | button | primary · default / loading | input | desktop | state_overrides: loading→"Guardando..." + disabled | Envía la edición |
| 6 | card-informacion-general | card | — | layout | desktop | hidden_in_states: loading | Agrupa los campos generales |
| 7 | campo-nombre | text-input | default | input | desktop | hidden_in_states: loading | Nombre del proyecto |
| 8 | campo-fecha-inicio | date-picker | default | input | desktop | hidden_in_states: loading | Fecha de inicio |
| 9 | campo-codigo | text-input | default | input | desktop | hidden_in_states: loading | Código del proyecto |
| 10 | campo-fecha-cierre | date-picker | default | input | desktop | hidden_in_states: loading | Fecha de cierre estimada |
| 11 | campo-cliente | dropdown | closed / open | input | desktop | hidden_in_states: loading | Actor asociado |
| 12 | campo-descripcion | text-input | default | input | desktop | hidden_in_states: loading | Descripción del proyecto |
| 13 | campo-tipo | dropdown | closed / open | input | desktop | hidden_in_states: loading | Tipo de proyecto |
| 14 | campo-estado | dropdown | closed / open | input | desktop | hidden_in_states: loading | Estado del proyecto |
| 15 | card-propiedades | card | — | layout | desktop | hidden_in_states: loading | Agrupa las propiedades clave/valor |
| 16 | campo-documentacion | text-input | default | input | desktop | hidden_in_states: loading | URL de documentación |
| 17 | campo-board | text-input | default | input | desktop | hidden_in_states: loading | URL del board |
| 18 | campo-mattermost | text-input | default | input | desktop | hidden_in_states: loading | Nombre del grupo de Mattermost |
| 19 | campo-diseno | text-input | default | input | desktop | hidden_in_states: loading | URL de diseño |
| 20 | propiedad-dinamica | text-input | default | input | desktop | hidden_in_states: loading | Par clave/valor agregado por el usuario |
| 21 | boton-borrar-propiedad | button | — | input | desktop | hidden_in_states: loading | Quita un par dinámico |
| 22 | campo-clave-nueva | text-input | default | input | desktop | hidden_in_states: loading | Clave del par a agregar |
| 23 | campo-valor-nuevo | text-input | default | input | desktop | hidden_in_states: loading | Valor del par a agregar |
| 24 | boton-agregar-propiedad | button | secondary | input | desktop | hidden_in_states: loading | Agrega el par al formulario |
| 25 | marca-obligatorio | badge | — | feedback | desktop | visible_only_in_states: campo obligatorio vacío | Marca el campo requerido sin completar |

**Origen:** `projects/edit/[id]/page.tsx:285`, `:290`, `:291`, `:296-299`, `:301-307`, `:~313`, `:317-326`, `:332-340`, `:349-358`, `:364-370`, `:377-391`, `:397-406`, `:412-419`, `:427-434`, `:~445`, `:~450-457`, `:~464-471`, `:~478-485`, `:~492-499`, `:~506-520`, `:~519`, `:~548-555`, `:~561-568`, `:~572`

**No usa `<PageLayout>`, `<Button>` ni los `Input*` compartidos**, igual que el alta. La estructura es la de `alta-proyecto` más `campo-estado` y `campo-mattermost` [fuente: código-existente].

## Layout por viewport

### desktop · 1440px

- encabezado-pagina
  - row `acciones` (`space-between`): titulo-pagina · boton-volver · boton-guardar
- card-informacion-general
  - row `grilla` (2 columnas), 6/12 cada uno: campo-nombre · campo-fecha-inicio · campo-codigo · campo-fecha-cierre · campo-cliente · campo-descripcion (`fieldSpan3`) · campo-tipo · campo-estado
- card-propiedades
  - row `grilla` (2 columnas), 6/12 cada uno: campo-documentacion · campo-board · campo-mattermost · campo-diseno · propiedad-dinamica × N (con boton-borrar-propiedad)
    - row `agregar` (`1fr 1fr auto`): campo-clave-nueva · campo-valor-nuevo · boton-agregar-propiedad

**Origen:** `projects/edit/[id]/styles.module.scss:83-84` — `grid-template-columns: 1fr 1fr`, y `:180-181` para la fila de alta. El módulo SCSS tiene exactamente el mismo set de clases que el del alta. Fracciones exactas: 6/12 + 6/12 [fuente: código-existente].

`campo-estado` es el octavo campo de una grilla de 2 columnas, así que cae en la cuarta fila junto a `campo-tipo`. Sumado a `.fieldSpan3` de la descripción (que ocupa 3 filas de una columna), el orden visual no coincide con el orden del DOM [fuente: código-existente].

## Contenido

### cargando-proyecto
- Texto/label: `"Cargando..."`
- Icono: nada
- Asset: imagen del componente `<Loader>`
- Annotation: `:285`

### encabezado-pagina
- Texto/label: sin texto propio — contiene título y acciones
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.pageHeader}>` (`:290`)

### titulo-pagina
- Texto/label: `"Editar Proyecto"`
- Icono: nada
- Asset: nada
- Annotation: `:291`

### boton-volver
- Texto/label: `"Volver"`
- Icono: nada
- Asset: nada
- Annotation: `:296-299`, `:298`

### boton-guardar
- Texto/label: `"Guardar"`; en loading, `"Guardando..."`
- Icono: nada
- Asset: nada
- Annotation: `disabled={updateProjectMutation.isPending}` presente (`:301-307`, `:306`)

### card-informacion-general
- Texto/label: título de card `<h2>` que agrupa los ocho campos generales
- Icono: nada
- Asset: nada
- Annotation: `:~313`

### campo-nombre
- Texto/label: `"Nombre"` · placeholder `"Nombre del proyecto"` · obligatorio en el schema
- Icono: nada
- Asset: nada
- Annotation: `:317-326`

### campo-fecha-inicio
- Texto/label: `"Fecha de inicio"` · sin placeholder · obligatorio en el schema
- Icono: nada
- Asset: nada
- Annotation: `:332-340`

### campo-codigo
- Texto/label: `"Código"` · placeholder `"Código del proyecto"` · obligatorio en el schema
- Icono: nada
- Asset: nada
- Annotation: `:349-358`

### campo-fecha-cierre
- Texto/label: `"Fecha de cierre estimada"` · sin placeholder · no obligatorio
- Icono: nada
- Asset: nada
- Annotation: `:364-370`

### campo-cliente
- Texto/label: `"Cliente"` · placeholder `"Cliente del proyecto"` · no obligatorio
- Icono: nada
- Asset: nada
- Annotation: `<ReactSelect isClearable>` con `inputId` (`:377-391`)

### campo-descripcion
- Texto/label: `"Descripción"` · placeholder `"Descripción del proyecto"` · obligatorio en el schema
- Icono: nada
- Asset: nada
- Annotation: `<textarea>` plano, sin preview de markdown (`:397-406`)

### campo-tipo
- Texto/label: `"Tipo"` · placeholder `"Tipo de proyecto"` · obligatorio en el schema · opciones `"Interno"` · `"Comercial"` · `"Investigación"` · `"Propuesta"`
- Icono: nada
- Asset: nada
- Annotation: `:157-160`, `:412-419`

### campo-estado
- Texto/label: `"Estado"` · placeholder `"Estado del proyecto"` · obligatorio en el schema · opciones `"Activo"` (`activo`) · `"Análisis"` (`analisis`) · `"Inactivo"` (`inactivo`) · `"Finalizado"` (`finalizado`) · `"Cancelado"` (`cancelado`)
- Icono: nada
- Asset: nada
- Annotation: **el alta no tiene este campo** y fija `status: 'analisis'`. Las opciones de estado están extraídas a constantes de módulo (`:164-168`), a diferencia del alta, donde el array de tipo está inline y duplicado (`:427-434`) [fuente: código-existente]

### card-propiedades
- Texto/label: título de card `<h2>` que agrupa las propiedades
- Icono: nada
- Asset: nada
- Annotation: `:~445`

### campo-documentacion
- Texto/label: `"Documentación"` · placeholder `"URL de documentación"`
- Icono: nada
- Asset: nada
- Annotation: clave fija `documentacion` (`FIXED_KEYS`, `:41`)

### campo-board
- Texto/label: `"Board de Tareas"` · placeholder `"URL del board"`
- Icono: nada
- Asset: nada
- Annotation: clave fija `board_de_tareas`

### campo-mattermost
- Texto/label: **el label exacto no se relevó con precisión en el survey de origen** · placeholder `"Nombre del grupo"`
- Icono: nada
- Asset: nada
- Annotation: clave fija `mattermost_group_name`, que **existe solo en esta pantalla y no en el alta**. Es el único campo de propiedades que no pide una URL (`:34`, `:41`, `:66`, `:485`) [fuente: código-existente]

### campo-diseno
- Texto/label: `"Diseño"` · placeholder `"URL de diseño"`
- Icono: nada
- Asset: nada
- Annotation: clave fija `diseño`

### propiedad-dinamica
- Texto/label: la clave cruda, sin formatear · placeholder `"Valor"`
- Icono: nada
- Asset: nada
- Annotation: el label **no tiene `htmlFor`** (`:~508`), igual que en el alta

### boton-borrar-propiedad
- Texto/label: sin texto visible · `aria-label="Eliminar link {key}"`
- Icono: tacho (SVG)
- Asset: nada
- Annotation: el SVG sin `aria-hidden` (`:~519`)

### campo-clave-nueva
- Texto/label: `"Clave"` · placeholder `"Clave"`
- Icono: nada
- Asset: nada
- Annotation: `:~548-555`

### campo-valor-nuevo
- Texto/label: `"Valor"` · placeholder `"Valor"`
- Icono: nada
- Asset: nada
- Annotation: `:~561-568`

### boton-agregar-propiedad
- Texto/label: `"Agregar"`
- Icono: nada
- Asset: nada
- Annotation: `:~572`

### marca-obligatorio
- Texto/label: `"(obligatorio)"`
- Icono: nada
- Asset: nada
- Annotation: aparece solo mientras el campo está vacío y desaparece al completarlo. No es un mensaje de error: es una marca de estado del campo [fuente: código-existente]

### Mensajes de toast (chrome compartido)
- Validación fallida: `"Hay campos obligatorios sin completar"` · `:261`
- Error de guardado: `"Hubo un error al editar el proyecto"` · `:269`
- Éxito: `"Proyecto editado con éxito"` · `:273`

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Los campos vienen precargados desde `projectData`, copiados a estado local para editarlos (`:193`) [fuente: código-existente]

### empty
- Aplica: No — no implementado (ver gaps-as-is.md). Es un formulario de edición.

### loading
- Aplica: Sí
- Mensajes: `"Cargando..."` (carga inicial) y `"Guardando..."` (durante el guardado)
- Cambios:
  - **Carga inicial:** cargando-proyecto solo visible en este estado (visible_only_in_states); reemplaza toda la pantalla, incluido el encabezado. Disparado por la query del proyecto y/o la de clientes (`:285`)
  - **Guardado:** boton-guardar: content=`"Guardando..."`, variant=disabled (state_override). Disparado por `updateProjectMutation.isPending` (`:301-307`)
  [fuente: código-existente]

### error de validación
- Aplica: Sí
- Mensaje: toast `"Hay campos obligatorios sin completar"`
- Cambios: **solo el toast.** Igual que el alta: el schema define 6 mensajes específicos, `abortEarly: false` los junta, y el `catch` los descarta. Con 6 campos obligatorios hay que adivinar cuál falta (`:261`) [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: toast `"Hubo un error al editar el proyecto"`
- Cambios: ninguno en la pantalla (`:268-270`). En un fallo de render, el boundary heredado `projects/error.tsx:6-11` muestra `"Error"` + `error.message` [fuente: código-existente]
- **El error al cargar el proyecto no se maneja:** `useProject` sin `isError`; ante un fallo el estado local no se puebla y la condición de carga sigue verdadera: **loader infinito** (`:~180`, `:285`). El error al cargar clientes tampoco: el select queda vacío sin explicación (`:~181`) [fuente: código-existente]

### success
- Aplica: Sí
- Mensaje: toast `"Proyecto editado con éxito"`
- Cambios: navega a `/projects` y el toast se ve sobre el listado (`:272-274`) [fuente: código-existente]

### not found
- Aplica: No — no implementado (ver gaps-as-is.md). Un proyecto inexistente produce el mismo loader infinito; no hay `notFound()` y el id no numérico no se valida: `/projects/edit/abc` pasa `"abc"` a la api (`:285`, `:~175`) [fuente: código-existente].

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). Un proyecto `finalizado` o `cancelado` se edita igual que uno activo, y el select permite cualquier transición entre los 5 estados sin restricción (`:164-168`) [fuente: código-existente].

### campo obligatorio vacío (parent_state: default)
- Aplica: Sí
- Mensaje: `"(obligatorio)"` junto al label
- Cambios:
  - marca-obligatorio: solo visible en este estado (visible_only_in_states), por campo
- Disparado por el valor del campo falsy [fuente: código-existente]

### confirmación al salir con cambios
- Aplica: No — no implementado (ver gaps-as-is.md). `"Volver"` descarta todo sin aviso (`:296-299`) [fuente: código-existente].

### error por campo devuelto por la api
- Aplica: No — no implementado (ver gaps-as-is.md). Toast genérico; un código duplicado no se asocia al campo (`:268-270`) [fuente: código-existente].

### feedback al agregar propiedad
- Aplica: No — no implementado (ver gaps-as-is.md). Retorna en silencio si la clave está vacía, es fija o ya existe (`:~210-217`) [fuente: código-existente].

### campo de prioridad
- Aplica: No — no implementado (ver gaps-as-is.md). `priority: number` está en el tipo (`project.types.ts:19`) y el listado la muestra como tag, pero ningún formulario del frontend la escribe [fuente: código-existente].

## Interacciones

**Eventos:**
- cada campo · on change → `setField(name, value)` con soporte de rutas anidadas de un nivel
- campo-estado · on change → `setField('status', opt.value)` · `:~432`
- boton-guardar · on click → valida y llama a `updateProjectMutation.mutate` · `:~255-275`
- `<form>` · on submit → `preventDefault()` + el mismo handler
- boton-agregar-propiedad · on click → `handleAddPair()`, igual que el alta
- boton-borrar-propiedad · on click → `handleRemovePair(key)`, sin confirmar
- boton-volver · on click → navega a `/projects` · `:296-299`

[fuente: código-existente]

**Validaciones (schema yup):**
- campo-codigo · `required` → mensaje `"El código es requerido"`
- campo-descripcion · `required` → mensaje `"La descripción es requerida"`
- campo-fecha-inicio · `required` → mensaje `"La fecha de inicio es requerida"`
- campo-nombre · `required` → mensaje `"El nombre es requerido"`
- campo-tipo · `required` → mensaje `"El tipo es requerido"`
- campo-estado · `required` → mensaje `"El estado es requerido"` · `:69`
- campo-cliente y campo-fecha-cierre · nullable, sin regla
- `keyValuePairs` · objeto nullable con transform de `''` → `null`, incluyendo `mattermost_group_name` · `:66`

**Los seis mensajes son código inalcanzable desde la UI**, igual que en el alta [fuente: código-existente].

**Feedback:**
- Campo obligatorio vacío: marca `"(obligatorio)"`
- Guardado: `"Guardando..."` + `disabled`
- Resultado: toast, ya sobre el listado en el caso de éxito

## Accesibilidad

- **Orden de foco:** boton-volver → boton-guardar → campo-nombre → campo-fecha-inicio → campo-codigo → campo-fecha-cierre → campo-cliente → campo-descripcion → campo-tipo → campo-estado → campo-documentacion → campo-board → campo-mattermost → campo-diseno → por cada par dinámico: propiedad-dinamica y boton-borrar-propiedad → campo-clave-nueva → campo-valor-nuevo → boton-agregar-propiedad. Los botones de acción están en el encabezado, así que se recorren antes que los campos [fuente: código-existente].
- **Landmarks y jerarquía:** `<h1>` para titulo-pagina y `<h2>` por card. Correcto (`:291`, `:~313`, `:~445`) [fuente: código-existente].
- **Foco y teclado:** los tres dropdowns son de `react-select`, que aporta su propio comportamiento de teclado; la pantalla no monta overlays propios con focus trap. Tras un error de validación el foco no se maneja (`:261`) [fuente: código-existente].
- **Propio de esta composición:**
  - **El error no se anuncia por campo:** sin `aria-invalid` ni `aria-describedby`; el único canal es el toast (`:261`).
  - **El label de `propiedad-dinamica` no está asociado a su input** (sin `htmlFor`), a diferencia de los campos fijos, que sí tienen `htmlFor`/`id` (`:~508` vs `:317`, `:332`, `:349`, `:364`, `:377`, `:397`, `:412`, `:427`).
  - **`required` nativo está ausente en `campo-tipo` y `campo-estado`**, ambos obligatorios en el schema (`:412-434`).
  - **La marca `"(obligatorio)"` es texto dentro del `<label>`:** se lee como parte del nombre accesible y desaparece al completar el campo.
  - Los tres `react-select` sí tienen `inputId` coincidente con el `htmlFor` del label (`:~380`, `:~415`, `:~430`).
  [fuente: código-existente]

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
- **[REQ-013] La identidad cambia; la pantalla, no.** Esta ficha documenta *qué* hay en la pantalla y *para qué* está; el Manual de marca Jiku v1.0 cambia **con qué está construido**. El accent pasa del magenta `#DA2C6A` al verde agua `#61CCB9` sobre azul oscuro `#0B1934` con fondo niebla `#F6F6F9`, y Archivo se reemplaza por Sora (títulos de vista) + Gabarito (interfaz, datos, microcopy). Ningún bloque de esta pantalla se agrega, se elimina ni cambia de propósito por ese motivo [REQ-013 RF-1, RF-2, CA-1].
- **[REQ-013] Cada elemento hecho a mano pasa a su componente del Design System.** Los bloques que esta ficha declara —botones, campos, selects, tarjetas, tablas, badges— se implementan con los componentes normativos de `docs/design-system/web/components/`, no con marcado propio. Es un cambio de implementación con consecuencia visible —dejan de haber dos botones que se ven distinto haciendo lo mismo— pero **no cambia la estructura declarada acá**: un bloque que ya existía sigue existiendo, con el mismo tipo y el mismo propósito [REQ-013 RF-3, RF-4, CA-5, CA-10].
- **[REQ-013] Los estados declarados en esta ficha se conservan.** La migración es de presentación: ningún estado se agrega, se quita ni cambia su condición de disparo. Lo que cambia es cómo se ve cada uno —el loader es ahora uno solo, el vacío tiene componente `EmptyState` disponible— sin que la ficha declare estados nuevos. **Cablear `EmptyState` en las pantallas que hoy no tienen estado vacío queda fuera de este REQ** y sigue registrado en `gaps-as-is.md` [REQ-013 §Fuera de Alcance].
- **[REQ-013] `desktop` sigue siendo el viewport único.** El requerimiento **no** habilita mobile: el DS mantiene el responsive del shell como objetivo declarado sin fecha y no declara el viewport `mobile` hasta que el shell lo cumpla. El layout por viewport de esta ficha no cambia [REQ-013 §Fuera de Alcance, CA-15].
- **[REQ-013] El selector de tema vive en el shell, no en esta pantalla.** La superficie gana modo oscuro con un control para elegirlo, ubicado en el pie de la sidebar junto a Cerrar sesión. Como es parte del shell de `(loggedin)`, está presente acá pero **no se declara como bloque de esta ficha**: declararlo en las 21 pantallas autenticadas repetiría veintiuna veces el mismo control. En modo oscuro esta pantalla usa la paleta propia del DS —canvas `#0E121A`, superficies `#1B202C` separadas por contraste y sin borde—, no una inversión de la clara [REQ-013 RF-7, CA-11].
