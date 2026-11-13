---
name: alta-actor
surface: web
route: /clients/new
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.1"
date: 2026-09-02
---

# Pantalla: Alta de actor

## Identidad

- **Audiencia primaria:** equipo-interno. Requiere sesión — el guard está en `(loggedin)/layout.tsx:13-21` [fuente: código-existente].
- **JTBD / Propósito:** formulario de dos campos (nombre y descripción markdown) para crear un actor [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport. Sin tratamiento responsive: no hay media queries en la pantalla ni en el formulario.
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Botón `"Nuevo actor"` del encabezado de `listado-actores` · `clients/page.tsx:22` [fuente: código-existente]

**Salidas user-driven:**
- `/clients` · tras crear con éxito · `clients/new/page.tsx:24` — `push('/clients')` [fuente: código-existente]

**Salidas automáticas:**
- Ninguna. **No hay botón de "Volver" ni cancelar:** la única salida desde la pantalla es guardar con éxito, o la navegación del shell / el botón de atrás del navegador (`clients/new/page.tsx:30-36`) [fuente: código-existente].

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | tarjeta-formulario | card | — | layout | desktop | todos los estados | Contenedor del formulario |
| 2 | campo-nombre | text-input | default / error | input | desktop | state_overrides: error de validación→state=error | Nombre del actor |
| 3 | campo-descripcion | text-input | default / error | input | desktop | todos los estados | Descripción en markdown |
| 4 | mensaje-error-general | alert | error | feedback | desktop | visible_only_in_states: error de validación | Error no asociado a un campo |
| 5 | boton-guardar | button | primary · default / loading | input | desktop | state_overrides: loading→spinner en lugar del texto | Envía el alta |

**Origen:** `NewClientForm.tsx:58`, `NewClientForm.tsx:62-70`, `NewClientForm.tsx:74-82`, `NewClientForm.tsx:~85`, `NewClientForm.tsx:88`

`tarjeta-formulario` es un `<SectionCard>`, el contenedor de card compartido. La pantalla no tiene encabezado propio: el título viene de `<PageLayout title="Crear actor">` (`clients/new/page.tsx:31`), que es chrome compartido [fuente: código-existente].

## Layout por viewport

### desktop · 1440px

- tarjeta-formulario
  - campo-nombre
  - campo-descripcion
  - mensaje-error-general (solo en error)
  - boton-guardar (alineado a la derecha)

El `titulo-pagina` (`"Crear actor"`) lo aporta el shell, arriba del bloque.

**Origen:** `clients/new/styles.module.scss:1-3` (`.wrapper { margin-top: 1rem }`) y `NewClientForm.module.scss` — `.formContainer` con `.leftColumn` y `.buttonRow`.

**Las fracciones no son derivables:** el formulario es una sola columna (`.leftColumn` es el único hijo con contenido) dentro de la card, con los campos al ancho completo. La clase se llama `leftColumn` pero no hay columna derecha en el JSX [fuente: código-existente].

## Contenido

### tarjeta-formulario
- Texto/label: sin texto propio — es el `<SectionCard>` que envuelve los campos
- Icono: nada
- Asset: nada
- Annotation: `NewClientForm.tsx:58`

### campo-nombre
- Texto/label: `"Nombre"` · placeholder `"Nombre del actor"`
- Icono: nada
- Asset: nada
- Annotation: `code="name"`. Se hace `.trim()` antes de enviar (`NewClientForm.tsx:63`, `:67`, `:52`) [fuente: código-existente]

### campo-descripcion
- Texto/label: `"Descripción"` · placeholder `"Descripción del actor (soporta **markdown**)"`
- Icono: nada
- Asset: nada
- Annotation: el placeholder anuncia soporte markdown **usando sintaxis markdown en el propio placeholder** (`**markdown**`), que se muestra literal con los asteriscos. No hay preview ni editor enriquecido: es un `<textarea>` plano. El markdown se renderiza recién en `listado-actores`, al expandir la fila (`NewClientForm.tsx:75`, `:79`) [fuente: código-existente]

### mensaje-error-general
- Texto/label: `"No hay cambios para guardar"`
- Icono: nada
- Asset: nada
- Annotation: los errores por campo se guardan en `errors` y los consume la prop `error` de cada input. El único mensaje que llega al bloque general es el de "sin cambios" (`NewClientForm.tsx:34`) [fuente: código-existente]

### boton-guardar
- Texto/label: `"Guardar"`
- Icono: nada
- Asset: nada
- Annotation: `loading` viene de `createClientMutation.isPending`. `<Button>` reemplaza el texto por un spinner y emite `aria-busy` + `<span class="sr-only">Cargando...</span>` (`NewClientForm.tsx:88`) [fuente: código-existente]

### Mensajes de toast (chrome compartido)
- Éxito: `"Actor creado con éxito"` · `clients/new/page.tsx:25`
- Error: `err.message` de la api, o `"Hubo un error al crear el actor"` como fallback · `clients/new/page.tsx:21`

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Ambos campos vacíos al cargar (`NewClientForm.tsx:20-21`) [fuente: código-existente]

### empty
- Aplica: No — no implementado (ver gaps-as-is.md). Es un formulario de alta.

### loading
- Aplica: Sí
- Mensaje: spinner en el botón + `"Cargando..."` como texto `sr-only`
- Cambios:
  - boton-guardar: content=spinner (state_override). **Los campos siguen editables y el botón no se deshabilita:** `<Button>` ignora el click cuando `loading` es true (`Button.tsx:31`), pero el atributo `disabled` no se aplica
- Disparado por `createClientMutation.isPending` (`clients/new/page.tsx:33`, `Button.tsx:51-57`) [fuente: código-existente]

### error de validación
- Aplica: Sí
- Mensajes: `"El nombre es obligatorio"` (por campo) y `"No hay cambios para guardar"` (general)
- Cambios:
  - campo-nombre: state=error, error_msg=`"El nombre es obligatorio"` (state_override), disparado por `schema.validateSync` con `name` vacío en el submit (`NewClientForm.tsx:15`, `:38-49`)
  - mensaje-error-general: solo visible en este estado (visible_only_in_states), con `"No hay cambios para guardar"`, disparado por `!hasChanges` — comparación por `JSON.stringify` del snapshot contra `{name:'', description:''}` (`NewClientForm.tsx:25-27`, `:33-36`)
- **El chequeo de cambios corre antes de validar**, así que un submit con todo vacío muestra `"No hay cambios para guardar"`, no `"El nombre es obligatorio"` [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: toast con `err.message` de la api, o `"Hubo un error al crear el actor"`
- Cambios: ninguno en la pantalla. El formulario queda como estaba, con los datos, y se puede reintentar. El toast tiene `autoClose: 2000`, así que si el usuario no lo ve en 2 segundos no queda rastro del error (`clients/new/page.tsx:16-22`, `(loggedin)/layout.tsx:34`) [fuente: código-existente]
- **REQ-004: la falla del bus se parte en dos y la recuperación no es la misma.** La api separa `503 service_unavailable` —no hay ningún `jiku-commands` escuchando, mensaje `"El servicio no está disponible en este momento"`— de `504 gateway_timeout` —la respuesta no llegó a tiempo, mensaje `"La operación tardó demasiado"`— (RF-16, CA-8, CA-9). Los dos llegan por el mismo toast de `err.message`: **la pantalla no se modifica**. Con el 503 el actor **no se creó** y reintentar es seguro; con el 504 **pudo haberse creado**, y como el formulario queda con los datos, apretar de nuevo "Guardar" es lo más probable que haga el usuario — y duplica el actor. El `autoClose: 2000` del toast agrava el caso: el mensaje que explica la diferencia se va en 2 segundos [REQ-004]

### success
- Aplica: Sí
- Mensaje: toast `"Actor creado con éxito"`
- Cambios: navega a `/clients` **antes** de mostrar el toast (`push` en la línea 24, `toast.success` en la 25), así que el toast se ve sobre el listado (`clients/new/page.tsx:23-26`) [fuente: código-existente]

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md)

### error por campo devuelto por la api
- Aplica: No — no implementado (ver gaps-as-is.md). La api puede rechazar por nombre duplicado u otra regla; la respuesta se muestra como toast genérico y **no se asocia al campo** (`clients/new/page.tsx:16-22`) [fuente: código-existente].

### confirmación al salir con cambios
- Aplica: No — no implementado (ver gaps-as-is.md). Salir por la navegación del shell descarta lo escrito sin aviso; no hay `beforeunload` ni guard de ruta [fuente: código-existente].

## Interacciones

**Eventos:**
- campo-nombre · on change → `setName(value)` · `NewClientForm.tsx:~66`
- campo-descripcion · on change → `setDescription(value)` · `NewClientForm.tsx:~78`
- boton-guardar · on click → `processSubmit()`: limpia errores, chequea `hasChanges`, valida con yup, llama `onSubmit` con los valores trimeados · `NewClientForm.tsx:29-55`
- `onSubmit` (en la página) → `createClientMutation.mutate(payload, {onError, onSuccess})` · `clients/new/page.tsx:14-28`

[fuente: código-existente]

**Validaciones:**
- campo-nombre · `yup.string().required()` → mensaje `"El nombre es obligatorio"` · `NewClientForm.tsx:15`
- campo-descripcion · `yup.string().optional()` → sin regla · `NewClientForm.tsx:16`
- formulario · sin cambios respecto del snapshot inicial → mensaje `"No hay cambios para guardar"` · `NewClientForm.tsx:33-36`

La validación usa `abortEarly: false` y mapea `err.inner` a errores por campo (`NewClientForm.tsx:41-47`), así que con más campos mostraría todos los errores a la vez [fuente: código-existente].

**Feedback:**
- Error por campo: la prop `error` del input (`NewClientForm.tsx:68`)
- Error general: `mensaje-error-general` en la card
- Guardado: spinner en el botón
- Resultado: toast, ya sobre `/clients` en el caso de éxito

## Accesibilidad

- **Orden de foco:** campo-nombre → campo-descripcion → boton-guardar. El botón es `type="button"` y **no hay elemento `<form>`**, así que **no se puede enviar con Enter** desde ningún campo (`NewClientForm.tsx:58-91`, `Button.tsx:44`) [fuente: código-existente].
- **Landmarks y jerarquía:** el `<h1>` (`"Crear actor"`) lo aporta el `titulo-pagina` de `PageLayout`, chrome compartido. La pantalla no agrega encabezados propios [fuente: código-existente].
- **Foco y teclado:** esta pantalla no dispara overlays, así que no introduce focus traps. **Tras un error el foco no se maneja:** queda en el botón, no se mueve al campo con error (`NewClientForm.tsx:29-55`) [fuente: código-existente].
- **Propio de esta composición:**
  - **El error general no se anuncia:** `mensaje-error-general` es un `<span>` sin `role="alert"` ni `aria-live`, así que al aparecer no llega a un lector de pantalla (`NewClientForm.tsx:~85`).
  - **La obligatoriedad del nombre no se anuncia:** no hay `required` ni `aria-required` en el input; solo se descubre al enviar (`NewClientForm.tsx:62-70`).
  - Los toasts sí se anuncian: `react-toastify` renderiza con `role="alert"` por defecto (`(loggedin)/layout.tsx:31`).
  [fuente: código-existente]

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-004 — El bus en dos servicios micro (2026-08-23)

- **Sin cambios de estructura ni de layout: solo se documenta la consecuencia del 504.** El REQ deja `web` sin tocar (RF-16) y los dos mensajes viajan en el cuerpo del error, así que no hay bloque nuevo que diseñar. Se registra en el estado de error porque la escritura **no es idempotente** y el reintento a ciegas crea un actor duplicado.
- **El `autoClose: 2000` deja de ser un detalle.** Con una sola falla genérica, perder el toast costaba poco: el usuario reintentaba y ya. Con dos fallas de recuperación opuesta, perder el mensaje es perder **la única señal** de si conviene reintentar. Queda anotado como consecuencia, no se corrige acá: es un cambio de código en `web`, fuera del alcance del REQ.
- **[REQ-013] La identidad cambia; la pantalla, no.** Esta ficha documenta *qué* hay en la pantalla y *para qué* está; el Manual de marca Jiku v1.0 cambia **con qué está construido**. El accent pasa del magenta `#DA2C6A` al verde agua `#61CCB9` sobre azul oscuro `#0B1934` con fondo niebla `#F6F6F9`, y Archivo se reemplaza por Sora (títulos de vista) + Gabarito (interfaz, datos, microcopy). Ningún bloque de esta pantalla se agrega, se elimina ni cambia de propósito por ese motivo [REQ-013 RF-1, RF-2, CA-1].
- **[REQ-013] Cada elemento hecho a mano pasa a su componente del Design System.** Los bloques que esta ficha declara —botones, campos, selects, tarjetas, tablas, badges— se implementan con los componentes normativos de `docs/design-system/web/components/`, no con marcado propio. Es un cambio de implementación con consecuencia visible —dejan de haber dos botones que se ven distinto haciendo lo mismo— pero **no cambia la estructura declarada acá**: un bloque que ya existía sigue existiendo, con el mismo tipo y el mismo propósito [REQ-013 RF-3, RF-4, CA-5, CA-10].
- **[REQ-013] Los estados declarados en esta ficha se conservan.** La migración es de presentación: ningún estado se agrega, se quita ni cambia su condición de disparo. Lo que cambia es cómo se ve cada uno —el loader es ahora uno solo, el vacío tiene componente `EmptyState` disponible— sin que la ficha declare estados nuevos. **Cablear `EmptyState` en las pantallas que hoy no tienen estado vacío queda fuera de este REQ** y sigue registrado en `gaps-as-is.md` [REQ-013 §Fuera de Alcance].
- **[REQ-013] `desktop` sigue siendo el viewport único.** El requerimiento **no** habilita mobile: el DS mantiene el responsive del shell como objetivo declarado sin fecha y no declara el viewport `mobile` hasta que el shell lo cumpla. El layout por viewport de esta ficha no cambia [REQ-013 §Fuera de Alcance, CA-15].
- **[REQ-013] El selector de tema vive en el shell, no en esta pantalla.** La superficie gana modo oscuro con un control para elegirlo, ubicado en el pie de la sidebar junto a Cerrar sesión. Como es parte del shell de `(loggedin)`, está presente acá pero **no se declara como bloque de esta ficha**: declararlo en las 21 pantallas autenticadas repetiría veintiuna veces el mismo control. En modo oscuro esta pantalla usa la paleta propia del DS —canvas `#0E121A`, superficies `#1B202C` separadas por contraste y sin borde—, no una inversión de la clara [REQ-013 RF-7, CA-11].
