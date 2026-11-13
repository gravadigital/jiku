---
component: Loader
version: 2.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 + resolución de duplicación Loader/Spinner
related:
  - empty-state
  - button
---

# Loader (web)

> **Normativo, y resuelve una duplicación.** El relevamiento encontró **dos componentes de carga
> conviviendo** sin regla de cuándo usar cada uno: `Loader` (25 usos, el segundo componente más
> usado) y `Spinner` (5). Este spec los unifica y fija el microcopy, que hoy tiene **12 valores
> distintos** —incluidos los typos «Cagando...» y «Cargando  ...» con doble espacio.

## Propósito

Indica que una operación está en curso y que la interfaz espera una respuesta.

**Cuándo usar:**

- Carga inicial de una vista o de un bloque de datos.
- Operación disparada por el usuario que demora ≥ 300 ms.

**Cuándo NO usar:**

- La operación terminó y **no hay datos** → [Empty state](./empty-state.md). Son cosas distintas:
  «estamos buscando» no es «no hay nada».
- Carga dentro de un botón → el state `loading` de [Button](./button.md).

## Anatomía

1. **Indicador** — spinner de trazo, en verde agua `#61CCB9`.
2. **Label (opcional según variant)** — `text.body-default`, en `text.secondary`.

## Variants

| Variant | Propósito | Label |
|---|---|---|
| `block` | Carga de una vista o sección completa | Sí, visible |
| `inline` | Carga dentro de una fila, celda o control | No — sólo el indicador |

> **`inline` absorbe al `Spinner` de hoy** y `block` al `Loader`. La regla que faltaba es esta: el
> label aparece cuando el loader **ocupa el lugar del contenido**; no aparece cuando acompaña a un
> elemento que ya está en pantalla.

## Sizes

| Size | Diámetro | Uso |
|---|---|---|
| `md` | 24 px | `block` — default |
| `sm` | 16 px | `inline`, dentro de campos y filas |

## States

Estado único: visible mientras dura la operación. **Rotación continua**, `duration.slow` (300 ms)
por giro — la única animación en bucle del sistema (ver [motion](../foundations/motion.md)).

## Spacing & sizing rules

- **Color del indicador:** `loader.color` → verde agua.
- **Gap indicador–label:** `space.2` (8 px).
- **`block`:** centrado en el área que ocupa, con `space.8` (32 px) de padding vertical mínimo.
- **`inline`:** alineado al centro vertical de su fila.

## Accesibilidad

Es el punto que el relevamiento marcó como **sin verificar**, y queda especificado:

- **ARIA:**
  - El contenedor **DEBE** llevar `role="status"` con `aria-live="polite"`.
  - El elemento que se está cargando **DEBE** llevar `aria-busy="true"` mientras dura.
  - En `inline` sin label visible, el indicador **DEBE** llevar `aria-label="Cargando"`.
  - El indicador gráfico es decorativo: `aria-hidden="true"` cuando ya hay texto anunciado.
- **Screen reader:** el cambio se anuncia una vez al empezar y una vez al terminar. **NO SE DEBE**
  anunciar en bucle.
- **`prefers-reduced-motion: reduce`:** la rotación se detiene y se muestra un indicador estático
  con el mismo texto.
- **Contraste:** el verde agua sobre blanco da 1.9:1, por eso **el indicador nunca es el único
  portador del mensaje** — el label lo acompaña en `block`, y el `aria-label` en `inline`.

## Guidelines de contenido

Ver [guidelines/content.md](../guidelines/content.md#carga).

**Un solo texto para toda la aplicación: «Cargando…».** Con puntos suspensivos tipográficos
(`…`), sin doble espacio, sin variantes por pantalla.

- ✓ «Cargando…»
- ✗ «Cagando...» — typo en producción
- ✗ «Cargando  ...» — doble espacio
- ✗ Un mensaje distinto por consumidor

**Excepción única:** una operación larga y nombrable puede decir qué hace —«Subiendo archivo…»—
cuando el usuario necesita saber **qué** está esperando. No es licencia para 12 variantes.

## Do's & don'ts

**Do:**

- Usar `block` cuando el loader ocupa el lugar del contenido, `inline` cuando lo acompaña.
- Escribir «Cargando…», siempre igual.
- Marcar `aria-busy` en la región que se está cargando.

**Don't:**

- **NO SE DEBE** usar un loader para decir «no hay datos» → [Empty state](./empty-state.md).
- **NO SE DEBE** pasar un label distinto por consumidor.
- **NO SE DEBEN** mostrar dos loaders anidados para la misma operación.
- **NO SE DEBE** dejar el spinner sin `role="status"`.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"block" \| "inline"` | `"block"` | Ocupa el contenido o lo acompaña |
| `size` | `"md" \| "sm"` | `"md"` (`block`) / `"sm"` (`inline`) | Diámetro |
| `label` | `string` | `"Cargando…"` | Sólo en `block`; el default es el correcto casi siempre |

> **`label` deja de ser obligatorio y pasa a tener default.** Es el cambio que evita los 12 textos:
> para escribir algo distinto hay que decidirlo explícitamente.

## Migración

| Hoy | Usos | Pasa a |
|---|---|---|
| `Loader` con `label` propio | 25 | `variant="block"`, **sin pasar `label`** salvo excepción |
| `Spinner` | 5 | `variant="inline"` |
| `AttachmentSkeleton` | — | Se mantiene: un skeleton no es un loader |

**Los 12 labels distintos se reducen a uno.** Migrar significa **borrar** el `label` de los 25
usos, no traducirlo.

**Además:** el indicador pasa de la paleta anterior a verde agua, y se agregan `role="status"`,
`aria-live` y `aria-busy`, que hoy no existen.

## Componentes y patterns relacionados

- [Empty state](./empty-state.md) — cuando terminó de cargar y no hay datos.
- [Button](./button.md) — el state `loading` usa el `inline`.
- [Dropzone](./dropzone.md) — «Subiendo archivo…», la excepción de microcopy.

## Historial

- **2.0.0** (2026-09-02) — Reespecificado. Unifica `Loader` y `Spinner` en dos variants con regla
  explícita de cuándo usar cada una; fija «Cargando…» como único texto y lo pone como default;
  especifica `role="status"`, `aria-live` y `aria-busy`, y el comportamiento con
  `prefers-reduced-motion`. Indicador en verde agua. Pasa de `relevado-desde-código` a `normativo`
  (MAJOR).
- **1.0.0** (2026-08-18) — Relevado desde el código existente.
