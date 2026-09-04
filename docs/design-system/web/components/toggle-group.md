---
component: ToggleGroup
version: 1.1.0
last_updated: 2026-09-04
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
| `day-chip` | Chips de día, con **punto de estado de carga** debajo del label | «Vie 21 / Lun 24» |

> **`stepper-value` incluye «Otro» a propósito:** una escala corta cubre el caso frecuente sin
> encerrar al usuario. Al elegir «Otro» se abre un [Input](./input.md).

### `status`: el semáforo de carga del chip de día

La variant `day-chip` pinta el estado de carga de la jornada como un **punto de color de 6 px
centrado debajo del label**:

| `status` | Punto | Significado |
|---|---|---|
| `completed` | **Verde agua profundo** `#12897A` — `toggle.status.completed` | Carga completa |
| `partial` | **Ámbar** `#FEA82F` — `toggle.status.partial` | Carga parcial |
| `empty` | **Grafito** `#C9D0DA` — `toggle.status.empty` | Sin carga |

El punto es **decorativo** (`aria-hidden="true"`); el estado se comunica en texto con
**`statusLabel`**, que va en un **`sr-only`** dentro del chip: «carga completa», «carga parcial»,
«sin carga». Así el estado **no depende del color** sin que el chip deje de ser un chip.

> **Reemplaza la solución anterior, que metía el estado dentro del TEXTO del label.** El chip decía
> «Vie 4 ○ sin carga»: cumplía la regla de no comunicar sólo por color, pero **convertía cada chip
> en una frase** —ocho chips de una semana laboral, cada uno con su oración— y perdía la lectura
> rápida que un selector de día tiene que dar. El punto vuelve a ser gráfico y la accesibilidad la
> cubre el `sr-only`.

Las dos props son **opcionales y aditivas**: sin `status`, el chip se renderiza como antes. Un
`status` sin `statusLabel` pinta el punto pero **no** aporta el texto accesible, así que
`statusLabel` es obligatorio en la práctica.

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

- **Radio del ítem:** 10 px (`radius.field`); dentro de `segmented`, 8 px (`radius.action`).
- **Contenedor `segmented`:** **radio 10** (`radius.field`) —**no** pill de 999—, fondo
  `bg.tint.neutral`, padding 3 px.
- **El contenedor `segmented` se ajusta a su contenido en los dos ejes** (`width: fit-content` +
  `height: fit-content`), sin tocar su alineación.
- **Padding del ítem:** `space.1` (4 px) vertical, `space.2` (8 px) horizontal; alto mínimo 32 px.
- **Gap entre pills** (`range-pill`, `stepper-value`, `day-chip`): `space.1` (4 px).
- Los segmentos de `segmented` **no llevan gap**: van unidos.
- **Punto de estado (`day-chip`):** 6 px, posicionado absoluto y centrado abajo; el chip reserva
  `space.2` + 6 px de padding inferior para alojarlo sin que ocupe flujo.

### Por qué el `segmented` se ajusta a su contenido

`fit-content` en los dos ejes, y no `align-self`, y la razón es concreta:

- Sin acotar el alto, un padre flex con `align-items: stretch` lo estiraba: en la vista de horas el
  control quedaba en **61 px** de alto con opciones de 32 px, y esos 29 px sobrantes se veían como
  un bloque gris alrededor de los segmentos.
- **`align-self: center` resolvía eso pero introducía otro problema:** en un contenedor
  `flex-column` centra el control **horizontalmente**, y el toggle «Presente / Ausente» de la carga
  de horas quedaba en el medio de la pantalla en vez de alineado a la izquierda.

`fit-content` acota el tamaño **sin tocar la alineación**, que la sigue decidiendo el contenedor.

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
- **El punto de estado del `day-chip` es decorativo** (`aria-hidden="true"`): el estado va en el
  `sr-only` que aporta `statusLabel`. **El punto solo no alcanza**, y por eso `statusLabel` va
  siempre que haya `status`.
- El nombre accesible del chip queda «Vie 4, sin carga» sin que el label visible cargue con esa
  frase.

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
- Pasar `statusLabel` junto con cada `status`: el punto es gráfico, el texto es el dato.

**Don't:**

- **NO SE DEBE** usar para más de cuatro o cinco opciones.
- **NO SE DEBE** permitir selección múltiple: para eso es [Select](./select.md) `multiple`.
- **NO SE DEBE** implementar como botones sueltos sin `radiogroup`.
- **NO SE DEBE** dejar el grupo sin ninguna opción elegida cuando el valor es obligatorio.
- **NO SE DEBE** meter el estado dentro del texto del label («Vie 4 ○ sin carga»): el label es la
  opción, el estado es el punto más su `statusLabel`.
- **NO SE DEBE** pasar `status` sin `statusLabel`: el estado quedaría comunicado sólo por color.
- **NO SE DEBE** dar radio pill al contenedor `segmented`: va en radio 10.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"segmented" \| "range-pill" \| "stepper-value" \| "day-chip"` | `"segmented"` | Presentación |
| `label` | `string` | — | Nombre accesible del grupo, requerido |
| `options` | `{ value, label, status?, statusLabel?, disabled? }[]` | — | Opciones visibles |
| `value` | `string` | — | Opción elegida |
| `onChange` | `(value) => void` | — | Callback |
| `allowOther` | `boolean` | `false` | Sólo `stepper-value`: habilita «Otro» |

**Por opción:**

| Campo | Tipo | Descripción |
|---|---|---|
| `status` | `"empty" \| "partial" \| "completed"` | **Sólo `day-chip`:** punto de color de 6 px debajo del label |
| `statusLabel` | `string` | Texto del estado para lectores de pantalla — «sin carga», «carga parcial», «carga completa». **Obligatorio si hay `status`** |
| `disabled` | `boolean` | Opción no disponible |

## Componentes y patterns relacionados

- [Tabs](./tabs.md) — filtrado de listado con contadores.
- [Select](./select.md) — muchas opciones, o selección múltiple.
- [Input](./input.md) — el campo que abre «Otro».

## Historial

- **1.1.0** (2026-09-04) — Se agregan las props de opción **`status`**
  (`"empty" | "partial" | "completed"`) y **`statusLabel`**, que la variant `day-chip` pinta como
  un **punto de color de 6 px debajo del label**, con el texto del estado en un `sr-only`.
  Reemplaza la solución anterior, que metía el estado **dentro del texto del label** («Vie 4 ○ sin
  carga»): cumplía la regla de no comunicar sólo por color, pero convertía cada chip en una frase y
  perdía la lectura rápida de un selector de día. Aditivas y opcionales: sin `status`, el chip se
  ve igual que antes.
  En el mismo corte se corrige la especificación del contenedor `segmented` contra el código:
  **pasa de pill 999 a radio 10** y se **ajusta a su contenido en los dos ejes** con `fit-content`
  —sin `align-self`, que centraba el control horizontalmente en un contenedor `flex-column`— y se
  documenta `disabled` por opción, ya presente en el componente (MINOR).
- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: cuatro variants
  (segmentado, pills de rango, selector de horas con escape a «Otro», chips de día), seleccionado
  en verde agua con texto azul oscuro, patrón ARIA de radiogroup (MINOR sobre el DS).
