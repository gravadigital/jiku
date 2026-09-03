---
component: ToggleGroup
version: 1.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Botones y controles de acción»
related:
  - tabs
  - select
  - button
---

# ToggleGroup (web)

> **Normativo.** Especifica los controles de selección excluyente siempre visible: toggle
> segmentado, pills de rango, selector de horas y chips de día. Reemplaza al `ToggleGroup` del
> código (3 usos).

## Propósito

Elegir una opción entre pocas, con todas las opciones visibles.

**Cuándo usar:**

- Dos o tres opciones excluyentes: «Presente / Ausente», «Por persona / Por proyecto».
- Rango temporal: «Esta semana / Semana pasada / Este mes».
- Valor de una escala corta: selector de horas «0 / 1 / 2 / Otro».
- Elección de día: «Vie 21 / Lun 24».

**Cuándo NO usar:**

- Muchas opciones → [Select](./select.md).
- Filtrar un listado por estado, con contadores → [Tabs](./tabs.md).
- Disparar una acción → [Button](./button.md).

## Variants

| Variant | Presentación | Ejemplo |
|---|---|---|
| `segmented` | Segmentos unidos en un contenedor de tinte grafito | «Presente / Ausente» |
| `range-pill` | Pills independientes con borde claro | «Esta semana / Semana pasada / Este mes» |
| `stepper-value` | Valores cortos + escape a valor libre | «0 / 1 / 2 / Otro» |
| `day-chip` | Chips de día | «Vie 21 / Lun 24» |

> **`stepper-value` incluye «Otro» a propósito:** una escala corta cubre el caso frecuente sin
> encerrar al usuario. Al elegir «Otro» se abre un [Input](./input.md).

## Sizes

Sin sizes. El alto lo da el `text.body-default` más el padding; la zona clickeable **nunca baja de
32 px** de alto.

## States

| State | Descripción | Tokens |
|---|---|---|
| `default` | Opción no elegida, texto secundario | `toggle.item.text` |
| `hover` | Bajo el puntero | `motion.base` |
| `focus` | Foco por teclado | `focus.ring` |
| `selected` | Opción elegida | **Fondo verde agua + texto azul oscuro** — `toggle.item.active.*` |
| `disabled` | No disponible | `text.disabled` |

## Spacing & sizing rules

- **Radio:** 999 px (`radius.pill`) en las cuatro variants.
- **Fondo del contenedor** (`segmented`): `bg.tint.neutral`.
- **Padding del ítem:** `space.1` (4 px) vertical, `space.2` (8 px) horizontal.
- **Gap entre pills** (`range-pill`, `day-chip`): `space.1` (4 px).
- Los segmentos de `segmented` **no llevan gap**: van unidos.

## Accesibilidad

- **DEBE** implementarse como grupo de radios (`role="radiogroup"` con `role="radio"` y
  `aria-checked`), no como botones sueltos: la exclusividad tiene que ser evidente para el lector
  de pantalla.
- **Teclado:** flechas mueven la selección dentro del grupo; `Tab` entra y sale del grupo. Es el
  patrón de radios, no el de botones.
- El grupo **DEBE** tener nombre accesible (`aria-label` o `<legend>`): «Ordenar por», «Vista».
- La selección **NO SE COMUNICA sólo con color:** el fondo pleno cambia la forma percibida del
  ítem, y `aria-checked` lo declara.
- **Contraste:** azul oscuro sobre verde agua **9.8:1**.

## Guidelines de contenido

- **Labels cortos:** una o dos palabras.
- **Paralelismo:** todas las opciones del mismo tipo gramatical — «Presente / Ausente», no
  «Presente / No vino».
- **Sentence case.**
- Fechas abreviadas en `day-chip`: «Vie 21».

## Do's & don'ts

**Do:**

- Mostrar todas las opciones a la vez: es la razón de existir del componente.
- Usar fondo verde agua con texto azul oscuro para lo elegido.
- Dar escape a valor libre cuando la escala pueda no alcanzar.

**Don't:**

- **NO SE DEBE** usar para más de cuatro o cinco opciones.
- **NO SE DEBE** permitir selección múltiple: para eso es [Select](./select.md) `multiple`.
- **NO SE DEBE** implementar como botones sueltos sin `radiogroup`.
- **NO SE DEBE** dejar el grupo sin ninguna opción elegida cuando el valor es obligatorio.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"segmented" \| "range-pill" \| "stepper-value" \| "day-chip"` | `"segmented"` | Presentación |
| `label` | `string` | — | Nombre accesible del grupo, requerido |
| `options` | `{ value, label }[]` | — | Opciones visibles |
| `value` | `string` | — | Opción elegida |
| `onChange` | `(value) => void` | — | Callback |
| `allowOther` | `boolean` | `false` | Sólo `stepper-value`: habilita «Otro» |

## Componentes y patterns relacionados

- [Tabs](./tabs.md) — filtrado de listado con contadores.
- [Select](./select.md) — muchas opciones, o selección múltiple.
- [Input](./input.md) — el campo que abre «Otro».

## Historial

- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: cuatro variants
  (segmentado, pills de rango, selector de horas con escape a «Otro», chips de día), seleccionado
  en verde agua con texto azul oscuro, patrón ARIA de radiogroup (MINOR sobre el DS).
