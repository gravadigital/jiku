---
document: UX Survey Screen
screen: alta-actor
route: /clients/new
service: web
source_files:
  - src/app/(loggedin)/clients/new/page.tsx
  - src/app/(loggedin)/clients/new/styles.module.scss
  - src/features/clients/components/NewClientForm/NewClientForm.tsx
  - src/features/clients/components/NewClientForm/NewClientForm.module.scss
  - src/features/clients/hooks/useCreateClient.ts
  - src/features/clients/services/clientsClientApi.ts
viewports_detected: []
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: alta-actor

> **Relevamiento as-is** de `/clients/new`, extraído de `src/app/(loggedin)/clients/new/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md) y no se repite acá.

## Identidad

- **Ruta:** `/clients/new`
- **Archivo:** `src/app/(loggedin)/clients/new/page.tsx` (`'use client'`)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** formulario de dos campos (nombre y descripción markdown) para crear un
  actor.
- **Viewports con tratamiento:** ninguno.

## Entrada y salida

**Entradas:**
- Botón `"Nuevo actor"` del encabezado de `listado-actores` · `clients/page.tsx:22`

**Salidas:**
- `/clients` · tras crear con éxito · `clients/new/page.tsx:24` — `push('/clients')`

**Redirects automáticos:**
- Ninguno. **No hay botón de "Volver" ni cancelar:** la única salida desde la pantalla es guardar
  con éxito, o la navegación del shell / el botón de atrás del navegador.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | tarjeta-formulario | `card` | — | ambos | `<SectionCard>` | `NewClientForm.tsx:58` |
| 2 | campo-nombre | `text-input` | default / error | ambos | `<InputText label="Nombre">` | `NewClientForm.tsx:62-70` |
| 3 | campo-descripcion | `text-input` | default / error | ambos | `<InputTextarea label="Descripción">` | `NewClientForm.tsx:74-82` |
| 4 | mensaje-error-general | `alert` | error | ambos | `<span className={styles.errorText}>` | `NewClientForm.tsx:~85` |
| 5 | boton-guardar | `button` | primary · default / loading | ambos | `<Button label="Guardar" loading>` | `NewClientForm.tsx:88` |

> `tarjeta-formulario` es un `<SectionCard>`, el contenedor de card compartido. La pantalla no tiene
> encabezado propio: el título viene de `<PageLayout title="Crear actor">`
> (`clients/new/page.tsx:31`), relevado en [_shell.md](./_shell.md).

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- titulo-pagina (`"Crear actor"`, del shell)
- tarjeta-formulario
  - campo-nombre
  - campo-descripcion
  - mensaje-error-general (solo en error)
  - boton-guardar (alineado a la derecha)

**Origen:** `clients/new/styles.module.scss:1-3` (`.wrapper { margin-top: 1rem }`) y
`NewClientForm.module.scss` — `.formContainer` con `.leftColumn` y `.buttonRow`.

**Las fracciones no son derivables:** el formulario es una sola columna
(`.leftColumn` es el único hijo con contenido) dentro de la card, con los campos al ancho completo.
La clase se llama `leftColumn` pero **no hay columna derecha** en el JSX.

## Contenido

### campo-nombre
- Texto/label: `"Nombre"` · placeholder `"Nombre del actor"`
- Origen: `NewClientForm.tsx:63`, `:67`
- Annotation: `code="name"`. Se hace `.trim()` antes de enviar (`NewClientForm.tsx:52`)

### campo-descripcion
- Texto/label: `"Descripción"` · placeholder `"Descripción del actor (soporta **markdown**)"`
- Origen: `NewClientForm.tsx:75`, `:79`
- Annotation: el placeholder anuncia soporte markdown **usando sintaxis markdown en el propio
  placeholder** (`**markdown**`), que se muestra literal con los asteriscos. No hay preview ni
  editor enriquecido: es un `<textarea>` plano. El markdown se renderiza recién en
  `listado-actores`, al expandir la fila.

### mensaje-error-general
- Textos verbatim posibles:
  - `"No hay cambios para guardar"` — `NewClientForm.tsx:34`
- Origen: `NewClientForm.tsx:34`
- Annotation: los errores por campo se guardan en `errors` y los consume la prop `error` de cada
  input. El único mensaje que llega al bloque general es el de "sin cambios".

### boton-guardar
- Texto/label: `"Guardar"`
- Origen: `NewClientForm.tsx:88`
- Annotation: `loading` viene de `createClientMutation.isPending`. `<Button>` reemplaza el texto por
  un spinner y emite `aria-busy` + `<span class="sr-only">Cargando...</span>`.

### Mensajes de toast
- Éxito: `"Actor creado con éxito"` · `clients/new/page.tsx:25`
- Error: `err.message` de la api, o `"Hubo un error al crear el actor"` como fallback ·
  `clients/new/page.tsx:21`

## Estados presentes

### default
- Disparado por: carga de la pantalla; ambos campos vacíos
- Origen: `NewClientForm.tsx:20-21`

### error de validación — campo requerido
- Mensaje: `"El nombre es obligatorio"`
- Disparado por: `schema.validateSync` con `name` vacío, en el submit
- Origen: `NewClientForm.tsx:15`, `:38-49`
- Cambios: la prop `error` del `<InputText>` de nombre recibe el mensaje

### error de validación — sin cambios
- Mensaje: `"No hay cambios para guardar"`
- Disparado por: `!hasChanges` — comparación por `JSON.stringify` del snapshot contra
  `{name:'', description:''}`
- Origen: `NewClientForm.tsx:25-27`, `:33-36`
- Cambios: aparece `mensaje-error-general`. **Se chequea antes de validar**, así que un submit con
  todo vacío muestra este mensaje, no `"El nombre es obligatorio"`.

### loading (durante el guardado)
- Mensaje: spinner en el botón + `"Cargando..."` como texto `sr-only`
- Disparado por: `createClientMutation.isPending`
- Origen: `clients/new/page.tsx:33`, `Button.tsx:51-57`
- Cambios: solo el contenido del botón. **Los campos siguen editables** y el botón no se
  deshabilita: `<Button>` ignora el click cuando `loading` es true (`Button.tsx:31`), pero el
  atributo `disabled` no se aplica.

### success
- Mensaje: toast `"Actor creado con éxito"`
- Disparado por: `onSuccess` de la mutación
- Origen: `clients/new/page.tsx:23-26`
- Cambios: navega a `/clients` **antes** de mostrar el toast (`push` en la línea 24, `toast.success`
  en la 25). El toast se ve sobre el listado.

### error de sistema
- Mensaje: `err.message` de la api, o `"Hubo un error al crear el actor"`
- Disparado por: `onError` de la mutación
- Origen: `clients/new/page.tsx:16-22`
- Cambios: toast de error. **La pantalla no cambia**: el formulario queda como estaba, con los
  datos, y se puede reintentar.

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| empty | no aplica: es un formulario de alta | — |
| loading inicial | no aplica: no trae datos | — |
| not found | no aplica | — |
| estado terminal / readonly | no aplica | — |
| **error de sistema visible en la pantalla** | solo hay toast, con `autoClose: 2000`. Si el usuario no lo ve en 2 segundos, no queda rastro del error: el formulario se ve idéntico a antes del intento | `clients/new/page.tsx:21`, `(loggedin)/layout.tsx:34` |
| **error por campo desde la api** | la api puede rechazar por nombre duplicado u otra regla; la respuesta se muestra como toast genérico, **no se asocia al campo** | `clients/new/page.tsx:16-22` |
| **confirmación al salir con cambios** | no existe. Salir por la navegación del shell descarta lo escrito sin aviso | `clients/new/page.tsx` sin `beforeunload` ni guard de ruta |
| **cancelar / volver** | **no hay control.** La pantalla no ofrece salida más que guardar | `clients/new/page.tsx:30-36` |

## Interacciones

**Eventos:**
- campo-nombre · on change → `setName(value)` · `NewClientForm.tsx:~66`
- campo-descripcion · on change → `setDescription(value)` · `NewClientForm.tsx:~78`
- boton-guardar · click → `processSubmit()`: limpia errores, chequea `hasChanges`, valida con yup,
  llama `onSubmit` con los valores trimeados · `NewClientForm.tsx:29-55`
- `onSubmit` (en la página) → `createClientMutation.mutate(payload, {onError, onSuccess})` ·
  `clients/new/page.tsx:14-28`

**Validaciones:**
- `name` · `yup.string().required()` → mensaje `"El nombre es obligatorio"` ·
  `NewClientForm.tsx:15`
- `description` · `yup.string().optional()` → sin regla · `NewClientForm.tsx:16`
- formulario · sin cambios respecto del snapshot inicial → `"No hay cambios para guardar"` ·
  `NewClientForm.tsx:33-36`

**Nota sobre el orden:** la validación usa `abortEarly: false` y mapea `err.inner` a errores por
campo (`NewClientForm.tsx:41-47`), así que con más campos mostraría todos los errores a la vez. Con
un solo campo requerido el efecto no se nota.

**Feedback:**
- Error por campo: la prop `error` del input · `NewClientForm.tsx:68`
- Error general: `mensaje-error-general` en la card
- Guardado: spinner en el botón
- Resultado: toast, ya sobre `/clients` en el caso de éxito

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Alt en imágenes | No aplica: la pantalla no tiene imágenes | — |
| Labels de los campos | Presentes vía la prop `label` de `InputText` / `InputTextarea` | `NewClientForm.tsx:63,75` |
| Asociación label-input | Depende de la implementación de `InputText`, que usa `code` como `id`/`name` | `NewClientForm.tsx:64,76` |
| Campo requerido anunciado | **ausente:** no hay `required` ni `aria-required` en el input de nombre; la obligatoriedad solo se descubre al enviar | `NewClientForm.tsx:62-70` |
| Error asociado al campo | Se pasa por la prop `error`; **no se pudo verificar desde este archivo** si `InputText` lo vincula con `aria-describedby` / `aria-invalid` | `NewClientForm.tsx:68` |
| Anuncio del error general | El mensaje es un `<span>` sin `role="alert"` ni `aria-live`: al aparecer no se anuncia | `NewClientForm.tsx:~85` |
| Nombre accesible del botón en loading | Correcto: `<Button>` emite `aria-busy` y un `<span class="sr-only">Cargando...</span>` | `Button.tsx:48`, `:53-57` |
| `<form>` semántico | **ausente:** no hay elemento `<form>`. Es un `<SectionCard>` con inputs y un botón `type="button"`. **No se puede enviar con Enter** | `NewClientForm.tsx:58-91`, `Button.tsx:44` |
| Anuncio del toast | `react-toastify` renderiza con `role="alert"` por defecto | `(loggedin)/layout.tsx:31` |
| Foco tras el error | **no se maneja:** el foco queda en el botón, no se mueve al campo con error | `NewClientForm.tsx:29-55` |

## Observaciones del relevamiento

- **No hay `<form>`.** El botón es `type="button"` (lo fija `Button.tsx:44`) y no hay elemento
  `<form>` que lo envuelva, así que **Enter en el campo de nombre no envía nada**. Es consistente en
  las dos pantallas de actor y difiere del resto del producto, donde varios formularios sí usan
  `<form onSubmit>`.
- **Existe un segundo componente casi idéntico.** `ClientForm` (usado por `edicion-actor`) tiene la
  misma estructura y los mismos textos, pero **valida distinto**: sin schema yup, con un
  `if (!name.trim())` que produce el mensaje `"El nombre es obligatorio"` como error *general* en
  lugar de por campo. Dos implementaciones de la misma pantalla que divergen en el manejo de errores.
  Ver [edicion-actor.md](./edicion-actor.md).
- **El placeholder muestra sintaxis markdown literal**
  (`"Descripción del actor (soporta **markdown**)"`). No se puede determinar si es intencional
  (mostrar un ejemplo) o un descuido.
- **`hasChanges` compara por `JSON.stringify`.** Funciona con dos strings, pero es sensible al orden
  de las claves y no escala a objetos anidados.
- **El toast de éxito aparece después de navegar**, así que se ve sobre el listado y no sobre el
  formulario. Es el patrón del producto, no una particularidad de esta pantalla.
- **`.leftColumn` sin columna derecha:** el nombre de la clase sugiere un layout de dos columnas que
  el JSX no arma. Hay una `.fieldCol` adicional en el módulo, usada solo para envolver el campo de
  nombre.
- **A confirmar en consolidación:** si hace falta un control de cancelar/volver, si el error de la
  api debería asociarse al campo (nombre duplicado, por ejemplo), y si conviene unificar
  `NewClientForm` con `ClientForm`.
