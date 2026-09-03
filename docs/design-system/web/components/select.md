---
component: Select
version: 1.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Campos de formulario»
related:
  - input
  - badge
  - form (pattern)
---

# Select (web)

> **Normativo, y resuelve una duplicación.** El relevamiento encontró **tres formas de hacer un
> select** en esta superficie: `InputSelect` (18 usos), `Select` (15) y `react-select` usado
> directamente en 5 pantallas con su objeto `selectStyles` **duplicado literalmente en los 5
> archivos**. Este spec es el único selector del sistema; los tres convergen acá.

## Propósito

Elección entre opciones conocidas, de una o de varias.

**Cuándo usar:**

- Elegir un valor de un conjunto cerrado (tipo, cliente, estado).
- Filtrar por varios valores a la vez, con la variant `multiple`.

**Cuándo NO usar:**

- Valor libre que el usuario escribe → [Input](./input.md).
- Dos o tres opciones excluyentes siempre visibles → [Toggle group](./toggle-group.md).
- Cambiar el estado de un requisito desde su cabecera → [Badge editable](./badge.md).

## Anatomía

1. **Label** — `text.field-label` (13/400).
2. **Container** — radio 10 px, alto 44 px, borde claro — **la misma caja que
   [Input](./input.md)**.
3. **Valor** o placeholder («Cliente del proyecto»).
4. **Chevron `⌄`** — a la derecha, en `text.secondary`.
5. **Chips de selección** (variant `multiple`) — pill con `×` de remoción.
6. **Menú desplegable** — superficie blanca, radio 14 px, `elevation.raised`.

## Variants

| Variant | Propósito | Ejemplo |
|---|---|---|
| `single` | Una opción | «Tipo → Comercial» |
| `multiple` | Varias opciones, como chips removibles | «Estado → Planificación ×, En cola ×, Desarrollo ×» |
| `locked` | Valor fijo, no editable | «Estado (bloqueado) → Análisis» |
| `inline` | Selector compacto sin label, en toolbars | «5 por página ⌄» |

## Sizes

Un solo tamaño: **alto 44 px, radio 10 px**, igual que Input. El `inline` puede reducir el padding
horizontal, **nunca el alto de la zona clickeable**.

## States

| State | Descripción | Tokens |
|---|---|---|
| `default` | Cerrado, con placeholder | `select.chevron`, `input.border` |
| `filled` | Con valor seleccionado | `input.text` |
| `focus` | Anillo verde agua 3 px al 22 % | `input.focus.ring` |
| `open` | Menú desplegado | `elevation.raised`, chevron rotado |
| `option-hover` | Opción bajo el puntero | `bg.surface.sunken` |
| `option-selected` | Opción elegida en el menú | `bg.active.subtle` (verde agua 8 %) |
| `locked` | Bloqueado | `input.locked.bg` (niebla) |
| `error` | Borde y mensaje en rojo de sistema | `state.urgent` |

## Spacing & sizing rules

- **Radio:** 10 px. **Alto:** 44 px. **Menú:** radio 14 px.
- **Chips:** radio pill, fondo `bg.tint.neutral`, gap `space.1` entre chip y `×`.
- **Gap entre chips:** `space.1` (4 px).
- **Ancho del menú:** igual al del control, como mínimo.

## Accesibilidad

- **ARIA:**
  - `<label for>` asociado, siempre.
  - Rol `combobox` con `aria-expanded` y `aria-controls` sobre el listado.
  - Opciones con rol `option` y `aria-selected`.
  - En `multiple`, cada chip expone su acción de remoción con `aria-label` («Quitar En cola»).
  - `aria-invalid` + `aria-describedby` cuando hay error.
- **Teclado:** `Enter` / `Space` abre; flechas recorren; `Enter` elige; `Esc` cierra;
  `Backspace` quita el último chip en `multiple`. **El menú DEBE ser operable sin puntero.**
- **Foco:** anillo `focus.ring`; al cerrar, el foco vuelve al control.
- **Contraste:** el chevron y el placeholder no portan información necesaria; el valor sí y va en
  `#0B1934` (14.0:1 sobre niebla).

## Guidelines de contenido

- **Label:** sustantivo — «Tipo», «Cliente», «Estado».
- **Placeholder:** qué se elige — «Cliente del proyecto», no «Seleccionar…».
- **Opciones:** el término de dominio, escrito igual que en el resto del producto.
- **`inline`:** unidad explícita — «5 por página».

## Do's & don'ts

**Do:**

- Usar la misma caja que Input: el formulario se lee como un sistema.
- Mostrar la selección múltiple como chips removibles, no como texto concatenado.
- Marcar la opción elegida en el menú con verde agua al 8 %.

**Don't:**

- **NO SE DEBE** usar `react-select` con estilos propios: si hace falta la librería, se la envuelve
  en **este** componente y los estilos viven **en un solo lugar**.
- **NO SE DEBE** crear un cuarto selector.
- **NO SE DEBE** usar verde agua pleno como fondo de una opción del menú: el 8 % es el tinte.
- **NO SE DEBE** abrir el menú al recibir foco por teclado sin acción explícita.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"single" \| "multiple" \| "locked" \| "inline"` | `"single"` | Modo de selección |
| `label` | `string` | — | Label visible, requerido salvo en `inline` |
| `options` | `{ value, label }[]` | — | Opciones disponibles |
| `value` | `string \| string[]` | — | Valor(es) seleccionado(s) |
| `onChange` | `(value) => void` | — | Callback de cambio |
| `placeholder` | `string` | — | Texto en reposo |
| `required` | `boolean` | `false` | Marca de obligatoriedad |
| `error` | `string` | — | Mensaje de error |
| `disabled` | `boolean` | `false` | Inactiva el control |

## Migración

**Tres implementaciones convergen en una.** Es el trabajo de mayor volumen del componente:

| Hoy | Usos | Pasa a |
|---|---|---|
| `InputSelect` | 18 | `variant="single"` |
| `Select` | 15 | `variant="single"` o `"inline"` según contexto |
| `react-select` directo | 5 pantallas | Este componente; `selectStyles` **se borra de los 5 archivos** |
| `InputMultipleSelect` | 1 | `variant="multiple"` |
| `MultiSelect` | 0 (código muerto) | Se elimina |

**Además:** `error` pasa de booleano a string con el mensaje, el radio de 8 px pasa a **10 px** y el
foco violeta `rgb(54,0,136)` pasa al **anillo verde agua al 22 %**.

> El `selectStyles` duplicado en 5 archivos es la razón por la que este spec existe. Mientras haya
> tres selectores, cualquier cambio de la paleta hay que aplicarlo tres veces —y es exactamente lo
> que esta migración de marca tendría que hacer.

## Componentes y patterns relacionados

- [Input](./input.md) — misma caja, para valor libre.
- [Badge](./badge.md) — badge editable para el estado en la cabecera de detalle.
- [Toggle group](./toggle-group.md) — pocas opciones siempre visibles.

## Historial

- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0. Unifica `InputSelect`,
  `Select`, `react-select` directo e `InputMultipleSelect` en un solo componente con cuatro
  variants. Resuelve la duplicación registrada en `gaps-as-is.md` (MINOR sobre el DS).
