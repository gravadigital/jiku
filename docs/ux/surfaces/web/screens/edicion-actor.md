---
name: edicion-actor
surface: web
route: /clients/edit/[id]
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Edición de actor

## Identidad

- **Audiencia primaria:** equipo-interno. Requiere sesión — el guard está en `(loggedin)/layout.tsx:13-21` [fuente: código-existente].
- **JTBD / Propósito:** edita el nombre y la descripción de un actor existente [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport. Sin tratamiento responsive **efectivo**: el `@media (max-width: 900px)` de esta ruta apunta a clases que la página no usa (ver Layout).
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Icono de lápiz (`accion-editar-actor`) en la fila de `listado-actores` · `ClientCard.tsx:60-67` [fuente: código-existente]

**Salidas user-driven:**
- `/clients` · tras guardar con éxito · `clients/edit/[id]/page.tsx:40` — `push('/clients')` [fuente: código-existente]

**Salidas automáticas:**
- Ninguna. **Sin botón de volver ni cancelar**, igual que `alta-actor` (`clients/edit/[id]/page.tsx:51-63`) [fuente: código-existente].

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | cargando-actor | loader | — | feedback | desktop | visible_only_in_states: loading | Indicador mientras trae el actor |
| 2 | tarjeta-formulario | card | — | layout | desktop | hidden_in_states: loading | Contenedor del formulario |
| 3 | campo-nombre | text-input | default | input | desktop | hidden_in_states: loading | Nombre del actor |
| 4 | campo-descripcion | text-input | default | input | desktop | hidden_in_states: loading | Descripción en markdown |
| 5 | mensaje-error-general | alert | error | feedback | desktop | visible_only_in_states: error de validación | Errores del formulario (todos son generales) |
| 6 | boton-guardar-cambios | button | primary · default / loading | input | desktop | state_overrides: loading→spinner en lugar del texto | Envía la edición |

**Origen:** `clients/edit/[id]/page.tsx:48`, `ClientForm.tsx:61`, `ClientForm.tsx:64-71`, `ClientForm.tsx:74-82`, `ClientForm.tsx:~86`, `ClientForm.tsx:88`

El título viene de `<PageLayout title="Editar actor">` (`clients/edit/[id]/page.tsx:52`), chrome compartido [fuente: código-existente].

## Layout por viewport

### desktop · 1440px

**Mientras carga:** solo `cargando-actor`, sin la card ni el título de `PageLayout` — el `return` temprano ocurre **antes** del `<PageLayout>` (`clients/edit/[id]/page.tsx:47-49`).

**Cargado:**
- tarjeta-formulario
  - campo-nombre
  - campo-descripcion
  - mensaje-error-general (solo en error)
  - boton-guardar-cambios (alineado a la derecha)

El `titulo-pagina` (`"Editar actor"`) lo aporta el shell, arriba del bloque.

**Origen:** `clients/edit/[id]/styles.module.scss:1-3` (`.wrapper { margin-top: 1rem }`) y `ClientForm.module.scss` — una sola columna (`.leftColumn`) con los campos al ancho completo.

**Las fracciones no son derivables:** columna única dentro de la card.

**El `@media (max-width: 900px)` de esta ruta no tiene efecto.** Está en `clients/edit/[id]/styles.module.scss:108-121` y apunta a `.formContainer`, `.column`, `.btnCont` y `.keyValuePairRow` — la página solo usa `styles.wrapper` [fuente: código-existente].

## Contenido

### cargando-actor
- Texto/label: `"Cargando..."`
- Icono: nada
- Asset: imagen del componente `<Loader>` con `alt="loader"`
- Annotation: `clients/edit/[id]/page.tsx:48`

### tarjeta-formulario
- Texto/label: sin texto propio — es el `<SectionCard>` que envuelve los campos
- Icono: nada
- Asset: nada
- Annotation: `ClientForm.tsx:61`

### campo-nombre
- Texto/label: `"Nombre"` · placeholder `"Nombre del actor"`
- Icono: nada
- Asset: nada
- Annotation: valor inicial desde `client.name` de la api. Se hace `.trim()` antes de enviar (`ClientForm.tsx:65`, `:69`) [fuente: código-existente]

### campo-descripcion
- Texto/label: `"Descripción"` · placeholder `"Descripción del actor (soporta **markdown**)"`
- Icono: nada
- Asset: nada
- Annotation: mismo placeholder con markdown literal que en `alta-actor`. `<textarea>` plano, sin preview (`ClientForm.tsx:76`, `:79`) [fuente: código-existente]

### mensaje-error-general
- Texto/label: `"No hay cambios para guardar"` o `"El nombre es obligatorio"`
- Icono: nada
- Asset: nada
- Annotation: **acá `"El nombre es obligatorio"` es un error general, no del campo.** `ClientForm` no usa yup ni la prop `error` de los inputs: valida con `if (!name.trim()) setGeneralError(...)` (`ClientForm.tsx:41-52`, `:45`, `:50`) [fuente: código-existente]

### boton-guardar-cambios
- Texto/label: `"Guardar cambios"`
- Icono: nada
- Asset: nada
- Annotation: llega por la prop `submitLabel` desde la página (`clients/edit/[id]/page.tsx:57`), renderizado en `ClientForm.tsx:88`

### Mensajes de toast (chrome compartido)
- Éxito: `"Actor actualizado con éxito"` · `clients/edit/[id]/page.tsx:41`
- Error: `err.message` de la api, o `"Hubo un error al editar el actor"` · `clients/edit/[id]/page.tsx:36`

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Los campos vienen precargados con los valores actuales; disparado por `client` resuelto e `initialValues` poblado (`clients/edit/[id]/page.tsx:51-63`) [fuente: código-existente]

### empty
- Aplica: No — no implementado (ver gaps-as-is.md). Es un formulario de edición.

### loading
- Aplica: Sí
- Mensajes: `"Cargando..."` en la carga inicial; spinner en el botón + `"Cargando..."` `sr-only` durante el guardado
- Cambios:
  - **Carga inicial:** cargando-actor solo visible en este estado (visible_only_in_states); reemplaza toda la pantalla, incluido el título. Disparado por `isLoadingClient || !initialValues` (`clients/edit/[id]/page.tsx:47-49`). La condición tiene dos disparadores: `!initialValues` es un segundo gate, porque el estado local se puebla en un `useEffect` que corre después de que llega `client`
  - **Guardado:** boton-guardar-cambios: content=spinner (state_override). Los campos siguen editables y el botón no lleva `disabled`. Disparado por `updateClientMutation.isPending` (`clients/edit/[id]/page.tsx:58`)
  [fuente: código-existente]

### error de validación
- Aplica: Sí
- Mensajes: `"No hay cambios para guardar"` y `"El nombre es obligatorio"`
- Cambios:
  - mensaje-error-general: solo visible en este estado (visible_only_in_states), con uno de los dos textos
  - campo-nombre y campo-descripcion: sin cambio de variant — el error **no** se asocia a ningún campo
- `"No hay cambios para guardar"` se dispara por `!hasChanges` (snapshot actual igual al de `initialValues`, `ClientForm.tsx:29-39`, `:44-47`); `"El nombre es obligatorio"` por `!name.trim()` en el submit, **después** del chequeo de cambios (`ClientForm.tsx:49-52`). Borrar el nombre por completo es un cambio, así que pasa el primer gate y llega al segundo; enviar sin tocar nada muestra `"No hay cambios para guardar"` incluso si el actor ya tenía el nombre vacío [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí (solo para el guardado)
- Mensaje: toast con `err.message` o `"Hubo un error al editar el actor"`
- Cambios: ninguno en la pantalla; el formulario queda con los datos y se puede reintentar (`clients/edit/[id]/page.tsx:34-38`) [fuente: código-existente]
- **El error al cargar el actor no se maneja:** `useClient` se desestructura como `{ data: client, isLoading: isLoadingClient }` e ignora `isError`. Ante un fallo, `client` queda `undefined`, el `useEffect` no puebla `initialValues`, y la condición `isLoadingClient || !initialValues` sigue siendo verdadera: **la pantalla queda en `"Cargando..."` para siempre** (`clients/edit/[id]/page.tsx:15`, `:21-28`, `:47-49`) [fuente: código-existente]

### success
- Aplica: Sí
- Mensaje: toast `"Actor actualizado con éxito"`
- Cambios: navega a `/clients` y el toast se ve sobre el listado (`clients/edit/[id]/page.tsx:39-42`) [fuente: código-existente]

### not found
- Aplica: No — no implementado (ver gaps-as-is.md). Un id inexistente produce el mismo loader infinito: no hay `notFound()` ni validación del `id`, y `/clients/edit/abc` pasa `"abc"` a la api sin validar aunque el tipo declare `Promise<{ id: number }>` (`clients/edit/[id]/page.tsx:12-13`) [fuente: código-existente].

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). No hay noción de actor no editable (`ClientForm.tsx:60-91`) [fuente: código-existente].

### error por campo devuelto por la api
- Aplica: No — no implementado (ver gaps-as-is.md). Se muestra como toast genérico, no asociado al campo (`clients/edit/[id]/page.tsx:34-38`) [fuente: código-existente].

### confirmación al salir con cambios
- Aplica: No — no implementado (ver gaps-as-is.md). Salir por la navegación descarta lo editado sin aviso; no hay `beforeunload` ni guard de ruta [fuente: código-existente].

## Interacciones

**Eventos:**
- campo-nombre · on change → `setName(value)` · `ClientForm.tsx:~68`
- campo-descripcion · on change → `setDescription(value)` · `ClientForm.tsx:~78`
- boton-guardar-cambios · on click → `processSubmit()`: limpia el error general, chequea `hasChanges`, chequea nombre no vacío, llama `onSubmit` con los valores trimeados · `ClientForm.tsx:41-58`
- `onSubmit` (en la página) → `updateClientMutation.mutate({ id, payload }, {onError, onSuccess})` · `clients/edit/[id]/page.tsx:30-45`

[fuente: código-existente]

**Validaciones:**
- formulario · snapshot igual al inicial → mensaje `"No hay cambios para guardar"` · `ClientForm.tsx:44-47`
- campo-nombre · `!name.trim()` → mensaje `"El nombre es obligatorio"` (como error general) · `ClientForm.tsx:49-52`
- campo-descripcion · sin regla

**Feedback:**
- Error: `mensaje-error-general` dentro de la card
- Guardado: spinner en el botón
- Resultado: toast, ya sobre `/clients` en el caso de éxito

## Accesibilidad

- **Orden de foco:** campo-nombre → campo-descripcion → boton-guardar-cambios. **No hay elemento `<form>`** y el botón es `type="button"`, así que **no se puede enviar con Enter** (`ClientForm.tsx:61-90`, `Button.tsx:44`) [fuente: código-existente].
- **Landmarks y jerarquía:** el `<h1>` (`"Editar actor"`) lo aporta el `titulo-pagina` de `PageLayout`, chrome compartido. **En el estado de carga ni siquiera ese `<h1>` se renderiza**, porque el `return` temprano ocurre antes del `<PageLayout>` (`clients/edit/[id]/page.tsx:47-49`) [fuente: código-existente].
- **Foco y teclado:** esta pantalla no dispara overlays, así que no introduce focus traps. Tras un error el foco no se maneja (`ClientForm.tsx:41-58`) [fuente: código-existente].
- **Propio de esta composición:**
  - **El error no se asocia a ningún campo:** este componente solo emite errores generales y no pasa la prop `error` a ningún input, así que un lector de pantalla no puede saber qué campo falló (`ClientForm.tsx:49-52`).
  - **El error no se anuncia:** el mensaje es un `<span>` sin `role="alert"` ni `aria-live` (`ClientForm.tsx:~86`).
  - **El estado de carga no se anuncia:** el `<Loader>` no tiene `aria-live` ni `role="status"` (`Loader.tsx:11-17`), y su `<Image>` usa `alt="loader"` siendo decorativo (`Loader.tsx:14`).
  - **La obligatoriedad del nombre no se anuncia:** sin `required` ni `aria-required` (`ClientForm.tsx:64-71`).
  [fuente: código-existente]

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
