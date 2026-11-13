---
document: UX Survey Screen
screen: edicion-actor
route: /clients/edit/[id]
service: web
source_files:
  - src/app/(loggedin)/clients/edit/[id]/page.tsx
  - src/app/(loggedin)/clients/edit/[id]/styles.module.scss
  - src/features/clients/components/ClientForm/ClientForm.tsx
  - src/features/clients/hooks/useClient.ts
  - src/features/clients/hooks/useUpdateClient.ts
viewports_detected: []
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: edicion-actor

> **Relevamiento as-is** de `/clients/edit/[id]`, extraído de
> `src/app/(loggedin)/clients/edit/[id]/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> El chrome está relevado en [_shell.md](./_shell.md).

## Identidad

- **Ruta:** `/clients/edit/[id]`
- **Archivo:** `src/app/(loggedin)/clients/edit/[id]/page.tsx` (`'use client'`)
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** edita el nombre y la descripción de un actor existente.
- **Viewports con tratamiento:** ninguno **efectivo** — ver Observaciones.

## Entrada y salida

**Entradas:**
- Icono de lápiz en la fila de `listado-actores` · `ClientCard.tsx:60-67`

**Salidas:**
- `/clients` · tras guardar con éxito · `clients/edit/[id]/page.tsx:40` — `push('/clients')`

**Redirects automáticos:**
- Ninguno. **Sin botón de volver ni cancelar**, igual que `alta-actor`.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | cargando-actor | `loader` | — | ambos | `<Loader label="Cargando...">` | `clients/edit/[id]/page.tsx:48` |
| 2 | tarjeta-formulario | `card` | — | ambos | `<SectionCard>` | `ClientForm.tsx:61` |
| 3 | campo-nombre | `text-input` | default | ambos | `<InputText label="Nombre">` | `ClientForm.tsx:64-71` |
| 4 | campo-descripcion | `text-input` | default | ambos | `<InputTextarea label="Descripción">` | `ClientForm.tsx:74-82` |
| 5 | mensaje-error-general | `alert` | error | ambos | `<span className={styles.errorText}>` | `ClientForm.tsx:~86` |
| 6 | boton-guardar-cambios | `button` | primary · default / loading | ambos | `<Button label={submitLabel} loading>` | `ClientForm.tsx:88` |

El título viene de `<PageLayout title="Editar actor">` (`clients/edit/[id]/page.tsx:52`).

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive efectivo: el layout es el mismo a cualquier ancho.

**Mientras carga:** solo `cargando-actor`, sin la card ni el título de `PageLayout` — el `return`
temprano ocurre **antes** del `<PageLayout>` (`clients/edit/[id]/page.tsx:47-49`).

**Cargado:**
- titulo-pagina (`"Editar actor"`, del shell)
- tarjeta-formulario
  - campo-nombre
  - campo-descripcion
  - mensaje-error-general (solo en error)
  - boton-guardar-cambios (alineado a la derecha)

**Origen:** `clients/edit/[id]/styles.module.scss:1-3` (`.wrapper { margin-top: 1rem }`) y
`ClientForm.module.scss` — una sola columna (`.leftColumn`) con los campos al ancho completo.

**Las fracciones no son derivables:** columna única dentro de la card.

> **El `@media (max-width: 900px)` de esta ruta no tiene efecto.** Está en
> `clients/edit/[id]/styles.module.scss:108-121` y apunta a `.formContainer`, `.column`, `.btnCont` y
> `.keyValuePairRow` — **la página solo usa `styles.wrapper`**. Ver Observaciones.

## Contenido

### cargando-actor
- Texto/label: `"Cargando..."`
- Origen: `clients/edit/[id]/page.tsx:48`

### campo-nombre
- Texto/label: `"Nombre"` · placeholder `"Nombre del actor"`
- Origen: `ClientForm.tsx:65`, `:69`
- Annotation: valor inicial desde `client.name` de la api. Se hace `.trim()` antes de enviar.

### campo-descripcion
- Texto/label: `"Descripción"` · placeholder `"Descripción del actor (soporta **markdown**)"`
- Origen: `ClientForm.tsx:76`, `:79`
- Annotation: mismo placeholder con markdown literal que en `alta-actor`. `<textarea>` plano, sin
  preview.

### mensaje-error-general
- Textos verbatim posibles:
  - `"No hay cambios para guardar"` · `ClientForm.tsx:45`
  - `"El nombre es obligatorio"` · `ClientForm.tsx:50`
- Origen: `ClientForm.tsx:41-52`

> **Diferencia con `alta-actor`:** acá `"El nombre es obligatorio"` es un error **general**, no del
> campo. `ClientForm` no usa yup ni la prop `error` de los inputs: valida con
> `if (!name.trim()) setGeneralError(...)`.

### boton-guardar-cambios
- Texto/label: `"Guardar cambios"` — llega por la prop `submitLabel` desde la página
- Origen: `clients/edit/[id]/page.tsx:57`, renderizado en `ClientForm.tsx:88`

### Mensajes de toast
- Éxito: `"Actor actualizado con éxito"` · `clients/edit/[id]/page.tsx:41`
- Error: `err.message` de la api, o `"Hubo un error al editar el actor"` ·
  `clients/edit/[id]/page.tsx:36`

## Estados presentes

### loading inicial
- Mensaje: `"Cargando..."`
- Disparado por: `isLoadingClient || !initialValues`
- Origen: `clients/edit/[id]/page.tsx:47-49`
- Cambios: reemplaza toda la pantalla, incluido el título

> La condición tiene **dos** disparadores. `!initialValues` es un segundo gate: el estado local se
> puebla en un `useEffect` que corre después de que llega `client`. Ver Observaciones.

### default (cargado)
- Disparado por: `client` resuelto e `initialValues` poblado
- Origen: `clients/edit/[id]/page.tsx:51-63`
- Cambios: los campos vienen precargados con los valores actuales

### error de validación — sin cambios
- Mensaje: `"No hay cambios para guardar"`
- Disparado por: `!hasChanges` — snapshot actual igual al de `initialValues`
- Origen: `ClientForm.tsx:29-39`, `:44-47`
- Cambios: aparece `mensaje-error-general`

### error de validación — nombre vacío
- Mensaje: `"El nombre es obligatorio"`
- Disparado por: `!name.trim()` en el submit, **después** del chequeo de cambios
- Origen: `ClientForm.tsx:49-52`
- Cambios: aparece `mensaje-error-general`

> **El orden importa:** borrar el nombre por completo es un cambio, así que pasa el primer gate y
> llega al segundo. Pero enviar sin tocar nada muestra `"No hay cambios para guardar"` incluso si el
> actor ya tenía el nombre vacío.

### loading (durante el guardado)
- Mensaje: spinner en el botón + `"Cargando..."` `sr-only`
- Disparado por: `updateClientMutation.isPending`
- Origen: `clients/edit/[id]/page.tsx:58`
- Cambios: solo el botón. Los campos siguen editables y el botón no lleva `disabled`.

### success
- Mensaje: toast `"Actor actualizado con éxito"`
- Disparado por: `onSuccess` de la mutación
- Origen: `clients/edit/[id]/page.tsx:39-42`
- Cambios: navega a `/clients` y el toast se ve sobre el listado

### error de sistema (guardado)
- Mensaje: `err.message` o `"Hubo un error al editar el actor"`
- Disparado por: `onError` de la mutación
- Origen: `clients/edit/[id]/page.tsx:34-38`
- Cambios: solo toast; el formulario queda con los datos y se puede reintentar

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error al cargar el actor** | **no se maneja.** `useClient` se desestructura como `{ data: client, isLoading: isLoadingClient }`: `isError` se ignora. Ante un fallo, `client` queda `undefined`, el `useEffect` no puebla `initialValues`, y la condición `isLoadingClient \|\| !initialValues` sigue siendo verdadera: **la pantalla queda en `"Cargando..."` para siempre** | `clients/edit/[id]/page.tsx:15`, `:21-28`, `:47-49` |
| **not found (id inexistente)** | mismo comportamiento: loader infinito. No hay `notFound()` ni validación del `id` | `clients/edit/[id]/page.tsx:13` |
| **id no numérico** | el tipo declara `Promise<{ id: number }>` pero el valor de la URL es un string. `/clients/edit/abc` pasa `"abc"` a la api sin validar | `clients/edit/[id]/page.tsx:12-13` |
| empty | no aplica: es un formulario de edición | — |
| error por campo desde la api | se muestra como toast genérico, no asociado al campo | `clients/edit/[id]/page.tsx:34-38` |
| confirmación al salir con cambios | no existe: salir por la navegación descarta lo editado sin aviso | sin `beforeunload` ni guard de ruta |
| cancelar / volver | **no hay control** | `clients/edit/[id]/page.tsx:51-63` |
| estado terminal / readonly | no existe. No hay noción de actor no editable | `ClientForm.tsx:60-91` |

## Interacciones

**Eventos:**
- campo-nombre · on change → `setName(value)` · `ClientForm.tsx:~68`
- campo-descripcion · on change → `setDescription(value)` · `ClientForm.tsx:~78`
- boton-guardar-cambios · click → `processSubmit()`: limpia el error general, chequea `hasChanges`,
  chequea nombre no vacío, llama `onSubmit` con los valores trimeados · `ClientForm.tsx:41-58`
- `onSubmit` (en la página) → `updateClientMutation.mutate({ id, payload }, {onError, onSuccess})` ·
  `clients/edit/[id]/page.tsx:30-45`

**Validaciones:**
- formulario · snapshot igual al inicial → `"No hay cambios para guardar"` · `ClientForm.tsx:44-47`
- `name` · `!name.trim()` → `"El nombre es obligatorio"` (como error general) ·
  `ClientForm.tsx:49-52`
- `description` · sin regla

**Feedback:**
- Error: `mensaje-error-general` dentro de la card
- Guardado: spinner en el botón
- Resultado: toast, ya sobre `/clients` en el caso de éxito

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Alt en imágenes | El `<Loader>` usa `alt="loader"` en su `<Image>`; siendo decorativo debería ser `alt=""` | `Loader.tsx:14` |
| Labels de los campos | Presentes vía la prop `label` | `ClientForm.tsx:65,75` |
| Campo requerido anunciado | **ausente:** sin `required` ni `aria-required` | `ClientForm.tsx:64-71` |
| Error asociado al campo | **ausente por diseño de este componente:** el error es general, no se pasa la prop `error` a ningún input. Un lector de pantalla no puede saber qué campo falló | `ClientForm.tsx:49-52` |
| Anuncio del error | El mensaje es un `<span>` sin `role="alert"` ni `aria-live` | `ClientForm.tsx:~86` |
| `<form>` semántico | **ausente:** no hay elemento `<form>`; el botón es `type="button"`. **No se puede enviar con Enter** | `ClientForm.tsx:61-90`, `Button.tsx:44` |
| Anuncio del estado de carga | El `<Loader>` no tiene `aria-live` ni `role="status"` | `Loader.tsx:11-17` |
| Nombre accesible del botón en loading | Correcto vía `<Button>` | `Button.tsx:48,53-57` |
| Foco tras el error | No se maneja | `ClientForm.tsx:41-58` |

## Observaciones del relevamiento

- **El loader infinito es el hallazgo más importante de esta pantalla.** La condición de carga es
  `isLoadingClient || !initialValues`, y `initialValues` se puebla en un `useEffect` que depende de
  `client`. Si la query falla, `client` nunca llega, `initialValues` queda `undefined`, y no hay
  ninguna rama que salga de ese estado. Ni error, ni reintento, ni mensaje.
- **El `useEffect` que copia datos de query a estado local es el antipatrón** que la convención de
  estado documenta explícitamente (`clients/edit/[id]/page.tsx:21-28`). Es la causa directa del punto
  anterior: con un initializer de `useState` o leyendo `client` directo, el `!initialValues` no
  existiría.
- **`ClientForm` y `NewClientForm` son dos implementaciones de la misma pantalla que divergen en la
  validación.** `NewClientForm` usa yup con errores por campo; `ClientForm` usa un `if` con error
  general. El mensaje `"El nombre es obligatorio"` es el mismo texto pero aparece en lugares
  distintos de la UI. Ver [alta-actor.md](./alta-actor.md).
- **`ClientForm` recibe una prop `clientId` que no usa.** Está en la interfaz
  (`ClientForm.tsx:16`), se pasa desde la página (`clients/edit/[id]/page.tsx:59`), y no se
  desestructura en el cuerpo del componente (`ClientForm.tsx:19-24`). Código sin efecto.
- **El módulo SCSS de esta ruta tiene 13 clases y la página usa una.** Define `.formContainer`,
  `.column`, `.textareaCont`, `.keyValuePairsSection`, `.keyValuePairRow`, `.addKeyValueButton`,
  `.removeKeyValueButton`, `.loader`, etc., más un `@media (max-width: 900px)` que las ajusta. La
  página solo usa `.wrapper`. La estructura de clases coincide con la de los formularios de
  **proyecto** (que sí tienen `keyValuePairs`), lo que sugiere que el archivo se copió de ahí — pero
  **el código no lo dice**.
- **La invalidación del cache está bien resuelta acá:** `useUpdateClient` invalida `['clients']` y
  `['client', variables.id]` (`useUpdateClient.ts:13-16`), así que volver a entrar a editar el mismo
  actor no muestra valores viejos. Es el patrón correcto y no todas las mutaciones del producto lo
  siguen.
- **A confirmar en consolidación:** si hace falta cancelar/volver, si el error de carga debe mostrar
  algo, y si conviene unificar los dos componentes de formulario.
