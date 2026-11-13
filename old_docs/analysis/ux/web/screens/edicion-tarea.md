---
document: UX Survey Screen
screen: edicion-tarea
route: /objectives/edit/[id]
service: web
source_files:
  - src/app/(loggedin)/objectives/edit/[id]/page.tsx
  - src/app/(loggedin)/objectives/edit/[id]/styles.module.scss
  - src/features/objectives/hooks/useObjective.ts
  - src/features/objectives/hooks/useUpdateObjective.ts
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: edicion-tarea

> **Relevamiento as-is** de `/objectives/edit/[id]`, extraído de
> `src/app/(loggedin)/objectives/edit/[id]/page.tsx` (442 líneas, `'use client'`).
> Describe lo que el código hace hoy, no lo que debería hacer.
>
> **Es el par de [alta-tareas](./alta-tareas.md)** pero **no un duplicado exacto**: edita un solo
> formulario y agrega dos campos. El chrome está relevado en [_shell.md](./_shell.md).

## Identidad

- **Ruta:** `/objectives/edit/[id]`
- **Archivo:** `src/app/(loggedin)/objectives/edit/[id]/page.tsx`
- **Requiere auth:** sí — `(loggedin)/layout.tsx:13-21`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** edita una tarea existente: título, proyecto, requisito, responsables,
  área, estado, prioridad, visibilidad, fecha estimada y descripción.
- **Viewports con tratamiento:** ninguno.

## Diferencias con `alta-tareas`

| # | Diferencia | Origen |
|---|---|---|
| 1 | **Un solo formulario:** sin `"Clonar"` ni `"Borrar"`, sin array de formularios | `:239` |
| 2 | **Tiene campo de estado** con 5 opciones, obligatorio | `:322-353` |
| 3 | **Tiene campo de prioridad**, obligatorio | `:355-389` |
| 4 | El campo de proyecto es un `<InputText>` **deshabilitado**, no un select | `:254-261` |
| 5 | Título `"Tareas / editar"` | `:238` |

> **Es la única pantalla del producto donde se puede setear la prioridad de una tarea.** Ni el alta de
> tarea ni ninguno de los dos formularios de proyecto tienen ese campo.

## Entrada y salida

**Entradas:**
- Botón `"Editar"` de `detalle-tarea` · `objectives/[id]/page.tsx:23`

**Salidas:**
- `/objectives/{id}` · tras guardar con éxito, al **detalle de la tarea** · `:207`

> **El flujo de ida y vuelta es coherente:** se entra desde el detalle y se vuelve al detalle, igual
> que en `edicion-requisito` y a diferencia de `edicion-proyecto`, que vuelve al listado.

**Redirects automáticos:**
- Ninguno.

> **No hay botón de volver ni cancelar**, igual que en el alta.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | cargando-datos | `loader` | — | ambos | `<Loader label="Cargando...">` | `:~232` |
| 2 | boton-guardar | `button` | primary · loading / disabled | ambos | `<Button label="Guardar">` en `actions` de `PageLayout` | `:220-223` |
| 3 | tarjeta-formulario | `card` | — | ambos | `<SectionCard>` | `:239` |
| 4 | campo-titulo | `text-input` | default / error | ambos | `<InputText label="Título">` | `:243-252` |
| 5 | campo-proyecto | `text-input` | **disabled** | ambos | `<InputText label="Corresponde a...">` | `:254-261` |
| 6 | campo-requisito | `dropdown` | closed / open | ambos | `<InputSelect label="Requisito">` | `:263-272` |
| 7 | campo-responsables | `dropdown` | multi · error | ambos | `<InputMultiplePersons label="Responsable(s)">` | `:273-289` |
| 8 | campo-area | `dropdown` | closed / open · error | ambos | `<InputSelect label="Área">` | `:291-318` |
| 9 | campo-estado | `dropdown` | closed / open · error | ambos | `<InputSelect label="Estado">` | `:322-353` |
| 10 | campo-prioridad | `dropdown` | closed / open · error | ambos | `<InputSelect label="Prioridad">` | `:355-389` |
| 11 | campo-visibilidad | `dropdown` | closed / open | ambos | `<InputSelect label="Nivel de visibilidad">` | `:392-408` |
| 12 | campo-fecha-estimada | `date-picker` | default | ambos | `<InputDate label="Fecha de finalización estimada">` | `:410-419` |
| 13 | campo-descripcion | `text-input` | default / error | ambos | `<InputTextarea label="Descripción">` | `:422-431` |
| 14 | mensaje-error-formulario | `alert` | error | ambos | `<div className={styles.generalError}>` con `<p>* Campos incompletos</p>` | `:435-437` |

> **Usa los componentes compartidos**, igual que el alta, y a diferencia de los formularios de
> proyecto y requisito.

> **Hay un bloque de error de formulario, pero distinto del alta:** acá es
> `<p>* Campos incompletos</p>` **sin icono** (`:435-437`), mientras el alta muestra
> `"Revisá que no haya campos incompletos"` con un icono de error. Dos textos y dos tratamientos
> visuales para el mismo error en pantallas hermanas.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- titulo-pagina (`"Tareas / editar"`, del shell) · boton-guardar
- tarjeta-formulario
  - row `formulario` (2 columnas): los 10 campos repartidos entre `.textareaCont` y `.column`

**Origen:** `objectives/edit/[id]/styles.module.scss`. **Las fracciones no son derivables de este
relevamiento:** los anchos exactos no se leyeron.

## Contenido

### titulo-pagina
- Texto/label: `"Tareas / editar"`
- Origen: `:238`
- Annotation: misma notación con barra que el alta (`"Tareas / crear"`)

### Campos

| Campo | Label verbatim | Placeholder verbatim | Editable |
|---|---|---|---|
| campo-titulo | `"Título"` | `"Título de la tarea"` | sí |
| campo-proyecto | `"Corresponde a..."` | — | **no — `disabled`** |
| campo-requisito | `"Requisito"` | `"Seleccionar requisito (opcional)"` | sí |
| campo-responsables | `"Responsable(s)"` | `"Nombre(s)"` | sí |
| campo-area | `"Área"` | `"Área de la tarea"` | sí |
| campo-estado | `"Estado"` | `"Estado de la tarea"` | sí |
| campo-prioridad | `"Prioridad"` | `"Prioridad de la tarea"` | sí |
| campo-visibilidad | `"Nivel de visibilidad"` | — | sí |
| campo-fecha-estimada | `"Fecha de finalización estimada"` | — | sí |
| campo-descripcion | `"Descripción"` | `"Descripción de la tarea"` | sí |

Origen: `:243-431`

Opciones de `campo-area`: `"Diseño"` · `"Desarrollo"` · `"Gestión"` · `"Investigación"` · `:296-313`

Opciones de `campo-estado`: `"Activo"` (`activo`) · `"Backlog"` (`backlog`) ·
`"En revisión"` (`en_revision`) · `"Finalizado"` (`finalizado`) · `"Cancelado"` (`cancelado`) ·
`:327-348`

Opciones de `campo-visibilidad`: `"Público"` (`public`) · `"Interno"` (`internal`) · `:397-405`

> **`campo-proyecto` está deshabilitado:** una tarea **no se puede reasignar a otro proyecto** desde
> esta pantalla (`:254-261`). En el alta sí es un select editable. No hay mensaje que lo explique.

> **`campo-estado` ofrece las 5 opciones sin restricción**, incluido volver de `finalizado` a
> `activo`. Es el mismo conjunto que el dropdown inline de `<StateTag>` en el listado y las cards, así
> que hay **dos caminos equivalentes** para cambiar el estado de una tarea — a diferencia de los
> requisitos, donde el detalle tiene reglas de workflow y la edición no.

### Mensajes de toast
- Éxito: `"Tarea editada con éxito"` · `:208`
- Error: `error?.message ?? "Hubo un error al editar la tarea"` · `:204`

## Estados presentes

### loading inicial
- Mensaje: `"Cargando..."`
- Disparado por: `isLoadingObjective || isLoadingPersons || !formInitialized`
- Origen: `:231-235`
- Cambios: reemplaza toda la pantalla, incluido el título

> **`!formInitialized` es un tercer gate**, además de los dos `isLoading`: es la bandera que se
> levanta cuando el estado local del formulario se pobló desde la tarea. Es el mismo patrón que
> produce el loader infinito en `edicion-actor`.

### default (precargado)
- Disparado por: la tarea resuelta y el estado local poblado
- Origen: `:239-433`

### campo con error (sub-estado)
- Disparado por: `fieldHasError(campo, valor)` tras un intento de submit
- Origen: `:250`, `:287`, `:316`, `:351`, `:388`, `:429`
- Cambios: la prop `error` del componente marca el campo

### loading (durante el guardado)
- Mensaje: spinner en el botón
- Disparado por: `isPending` de la mutación
- Origen: `:220-223`

### success
- Mensaje: toast `"Tarea editada con éxito"`
- Disparado por: `onSuccess`
- Origen: `:207-209`
- Cambios: navega a `/objectives/{id}` (`:207`)

### error de validación
- Mensaje: `"* Campos incompletos"`
- Disparado por: `generalError === true`, seteado en el submit
- Origen: `:64`, `:435-437`
- Cambios: aparece el texto debajo de los campos; los campos con error se marcan vía `fieldHasError`

### error de sistema
- Mensaje: toast `error?.message ?? "Hubo un error al editar la tarea"`
- Disparado por: `onError`
- Origen: `:203-205`

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| **error al cargar la tarea** | **no se maneja.** `useObjective` se desestructura como `{ data: objective, isLoading: isLoadingObjective }`: `isError` se ignora. La condición de carga es `isLoadingObjective \|\| isLoadingPersons \|\| !formInitialized` (`:231`), y `formInitialized` solo pasa a `true` cuando la tarea llegó: ante un fallo, **loader infinito** | `:68`, `:231-235` |
| **not found (tarea inexistente)** | mismo loader infinito. No hay `notFound()` | `:231-235` |
| **id no numérico** | sin validación: el tipo declara `Promise<{ id: number }>` pero el valor de la URL es string. `/objectives/edit/abc` pasa `"abc"` a la api | `:59-60` |
| error al cargar personas | `usePersons` sin `isError`: el select de responsables queda vacío | `:69` |
| mensaje de error de formulario | **existe pero con otro texto y sin icono:** `"* Campos incompletos"` contra `"Revisá que no haya campos incompletos"` con icono en el alta | `:435-437` vs `objectives/new/page.tsx:404-410` |
| empty | no aplica: es una edición | — |
| confirmación al salir con cambios | no existe. Salir por la navegación descarta lo editado sin aviso | `:239-433` |
| cancelar / volver | **no hay control** | `:239-433` |
| error por campo desde la api | toast genérico | `:203-205` |
| **estado terminal / readonly** | **no existe.** Una tarea `finalizado` o `cancelado` se edita igual, y el select permite volverla a `activo` sin restricción | `:327-348` |
| **cambio de proyecto** | **deshabilitado sin explicación.** El campo se ve gris y no responde; nada dice por qué ni cómo mover una tarea a otro proyecto | `:254-261` |

## Interacciones

**Eventos:**
- cada campo · on change → `handleInputChange(campo, valor)` sobre el estado local ·
  `:248`, `:269`, `:281-287`, `:315`, `:350`, `:387`, `:406`, `:417`, `:427`
- boton-guardar · click → valida y llama a la mutación · `:222`
- `<form>` · submit → `handleSubmit` con `preventDefault()`

**Validaciones:**
- `fieldHasError(campo, valor)` en `title`, `personIds`, `area`, `state`, `priority` y `description` ·
  `:250`, `:287`, `:316`, `:351`, `:388`, `:429`

**Feedback:**
- Campos marcados con la prop `error`
- Spinner en el botón de guardar
- Toast del resultado

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Labels de los campos | Presentes vía la prop `label` de los componentes compartidos | `:244`, `:255`, `:264`, `:274`, `:292`, `:323`, `:356`, `:393`, `:411`, `:424` |
| Asociación label-input | La resuelven los componentes `Input*` usando `code` como `id`/`name` | `:245`, `:265`, `:275`, `:293` |
| Error asociado al campo | Se pasa por la prop `error`; **no se verificó** si `Input*` lo vincula con `aria-invalid` / `aria-describedby` | `:250` |
| Campo deshabilitado sin explicación | `campo-proyecto` está `disabled`: sale del orden de tabulación y **no hay `aria-describedby`** que diga por qué no se puede cambiar | `:254-261` |
| Nombre accesible del botón en loading | Correcto vía `<Button>` | `Button.tsx:48`, `:53-57` |
| Jerarquía de encabezados | Solo el `<h1>` del `PageLayout`. La tarjeta no tiene encabezado — aceptable con un solo formulario, a diferencia del alta | `:238`, `:239` |
| Botón fuera del `<form>` | El guardado va en el `actions` de `PageLayout`, fuera del `<form>` de la tarjeta: **Enter en un campo y el click en el botón son caminos distintos** | `:220-223`, `:~240` |
| Anuncio del error | Sin `role="alert"` relevado | `:250` |

## Observaciones del relevamiento

- **Es la única pantalla del producto donde se setea la prioridad de una tarea** (`:355-389`). Ni el
  alta de tarea ni los formularios de proyecto la tienen, y `listado-tareas` la muestra como columna.
  Esto responde en parte la pregunta abierta de `alta-proyecto` sobre la prioridad de proyecto: para
  tareas, se setea en la edición. **Para proyectos sigue sin respuesta.**
- **El proyecto no se puede cambiar.** `campo-proyecto` es un `<InputText disabled>` (`:254-261`),
  mientras en el alta es un select editable. No hay mensaje ni pista de cómo mover una tarea de
  proyecto. **A verificar en `api`** si el cambio está permitido a nivel de contrato.
- **Dos caminos equivalentes para el estado.** Este select y el dropdown inline de `<StateTag>` ofrecen
  las mismas 5 opciones sin restricción. Contrasta con los requisitos, donde el detalle tiene un
  stepper con reglas y el formulario de edición no las respeta — acá los dos caminos son
  consistentes, porque ninguno tiene reglas.
- **No es un duplicado exacto del alta**, a diferencia de los pares de proyecto y de requisito: 442
  contra 428 líneas, un formulario en vez de N, y dos campos más. Aun así comparte los labels, los
  placeholders, el patrón de `handleInputChange` y `fieldHasError`, y el módulo SCSS.
- **El mensaje de error difiere del alta.** `"* Campos incompletos"` sin icono acá (`:435-437`) contra
  `"Revisá que no haya campos incompletos"` con icono en el alta. Mismo error, dos textos, dos
  tratamientos. El asterisco inicial sugiere una nota al pie, pero no hay ningún asterisco en los
  labels que lo referencie.
- **No se relevaron con precisión** los anchos exactos de las dos columnas del layout
  (`objectives/edit/[id]/styles.module.scss`). El resto del relevamiento está completo.
- **A confirmar en consolidación:** por qué el proyecto no es editable, si el estado debería tener
  reglas de transición como los requisitos, y si hace falta un control de cancelar.
