---
component: Select
version: 1.1.0
last_updated: 2026-09-04
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Campos de formulario»
related:
  - input
  - badge
  - form (pattern)
---

# Select (web)

> **Normativo, y la duplicación quedó resuelta.** El relevamiento había encontrado **tres formas
> de hacer un select** en esta superficie: `InputSelect` (18 usos), `Select` (15) y `react-select`
> usado directamente en 5 pantallas con su objeto `selectStyles` duplicado literalmente en los 5
> archivos. Este spec es el único selector del sistema y los tres convergieron acá: `InputSelect`
> se dio de baja en S-060 y **`selectStyles` tiene cero ocurrencias**.
>
> `react-select` sobrevive en **dos** usos, cada uno por una capacidad que este componente no
> tiene: opciones **agrupadas** (`TargetSelector`) y multi-select con colapso a `+N`
> (`InputMultipleSelect`). La búsqueda ya no es motivo: la cubre `searchable`.

## Propósito

Elección entre opciones conocidas, de una o de varias.

**Cuándo usar:**

- Elegir un valor de un conjunto cerrado (tipo, cliente, estado).
- Filtrar por varios valores a la vez, con la variant `multiple`.
- **Elegir entre muchas opciones no memorizables**, con la prop `searchable`.

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
6. **Menú desplegable** — superficie blanca, radio 14 px, `elevation.raised`; la lista scrollea a
   partir de 240 px de alto.
7. **Buscador** (sólo con `searchable`) — campo dentro del menú, arriba de la lista, separado por
   un borde.

## Variants

| Variant | Propósito | Ejemplo |
|---|---|---|
| `single` | Una opción | «Tipo → Comercial» |
| `multiple` | Varias opciones, como chips removibles | «Estado → Planificación ×, En cola ×, Desarrollo ×» |
| `locked` | Valor fijo, no editable | «Estado (bloqueado) → Análisis» |
| `inline` | Selector compacto sin label, en toolbars | «5 por página ⌄» |

### `searchable`: buscador dentro del menú

Con `searchable`, el menú abre con un **campo de búsqueda arriba de la lista** que **filtra las
opciones por texto**.

| | |
|---|---|
| **Ubicación** | Dentro del menú, encima de la lista, separado por un borde de 1 px |
| **Caja** | La misma que [Input](./input.md) pero **sin su alto de 44 px**: acá es un campo auxiliar dentro de un desplegable, no un control de formulario |
| **Placeholder** | «Buscar...» |
| **Búsqueda** | **Insensible a acentos y a caja**: normaliza a minúsculas y quita diacríticos en los dos lados de la comparación, así «cañada» aparece escribiendo «canada» |
| **Sin coincidencias** | Fila «Sin resultados» en `text.secondary` — el menú nunca queda vacío sin explicación |
| **Al cerrar** | La consulta se limpia: el menú vuelve a abrir con la lista completa |

> **Es opt-in, y no el default, a propósito.** Con pocas opciones un buscador estorba más de lo que
> ayuda: agrega un campo, un salto de foco y una lista que puede quedar vacía. Se activa cuando la
> lista es **larga y no memorizable**.

**Restaura una funcionalidad que se perdió en la migración.** `react-select` traía filtro de serie;
al converger los tres selectores en el Select propio, el filtro no vino con ellos. El **filtro por
proyecto del listado de requisitos tiene ~100 opciones**, y sin buscador encontrar una es
impracticable — no es una mejora opcional, es la razón por la que la prop existe.

#### La navegación por teclado opera sobre las opciones visibles

El índice activo apunta a la lista **filtrada**, no a `options`. Es la parte que importa para el
teclado: si apuntara a la lista completa mientras el menú muestra un subconjunto, **`Enter`
elegiría una opción distinta de la resaltada**.

- Al abrir, el **foco pasa al buscador** para poder tipear sin un salto de teclado extra. El
  control sigue siendo el `combobox`: el buscador no le quita el rol.
- Cada tecleo **reposiciona el índice activo en la primera opción visible**.
- ↑ ↓ recorren las visibles; `Enter` elige la resaltada; `Esc` cierra y devuelve el foco al control.

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
| `option-hover` | Opción bajo el puntero, o resaltada por teclado | `bg.surface.sunken` |
| `search-empty` | Con `searchable`, la consulta no coincide con ninguna opción | Fila «Sin resultados» en `text.secondary` |
| `option-selected` | Opción elegida en el menú | `bg.active.subtle` (verde agua 8 %) |
| `locked` | Bloqueado | `input.locked.bg` (niebla) |
| `error` | Borde y mensaje en rojo de sistema | `state.urgent` |

## Spacing & sizing rules

- **Radio:** 10 px. **Alto:** 44 px. **Menú:** radio 14 px.
- **Chips:** radio pill, fondo `bg.tint.neutral`, gap `space.1` entre chip y `×`.
- **Gap entre chips:** `space.1` (4 px).
- **Ancho del menú:** igual al del control, como mínimo.
- **Alto máximo de la lista:** 240 px, con scroll vertical.
- **Buscador:** padding `space.2` (8 px) alrededor, borde inferior de 1 px; el campo va en radio 8
  (`radius.action`) con texto de 13 px.

## Accesibilidad

- **ARIA:**
  - `<label for>` asociado, siempre.
  - Rol `combobox` con `aria-expanded` y `aria-controls` sobre el listado.
  - Opciones con rol `option` y `aria-selected`.
  - En `multiple`, cada chip expone su acción de remoción con `aria-label` («Quitar En cola»).
  - `aria-invalid` + `aria-describedby` cuando hay error.
- **Teclado:** `Enter` / `Space` abre; flechas recorren; `Enter` elige; `Esc` cierra;
  `Backspace` quita el último chip en `multiple`. **El menú DEBE ser operable sin puntero.**
- **Con `searchable`:** el buscador lleva su propio `aria-label` («Buscar en Proyecto») y
  `aria-controls` hacia el listado. Las flechas y `Enter` **DEBEN** operar sobre las opciones
  **visibles**; el foco al buscador no traslada el rol de `combobox`, que sigue en el control.
- **«Sin resultados» DEBE ser texto**, no un menú vacío: un desplegable que abre en blanco no dice
  qué pasó.
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
- Activar `searchable` cuando la lista es larga y no memorizable, y dejarlo apagado cuando no.

**Don't:**

- **NO SE DEBE** usar `react-select` con estilos propios: si hace falta la librería, se la envuelve
  en **este** componente y los estilos viven **en un solo lugar**.
- **NO SE DEBE** crear un cuarto selector.
- **NO SE DEBE** usar verde agua pleno como fondo de una opción del menú: el 8 % es el tinte.
- **NO SE DEBE** abrir el menú al recibir foco por teclado sin acción explícita.
- **NO SE DEBE** poner `searchable` por defecto en listas cortas: el buscador estorba más de lo que
  ayuda.
- **NO SE DEBE** hacer que el teclado recorra la lista completa mientras el menú muestra una lista
  filtrada: `Enter` elegiría algo distinto de lo resaltado.
- **NO SE DEBE** dejar el menú en blanco cuando la búsqueda no encuentra nada.

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
| `searchable` | `boolean` | `false` | Agrega un buscador dentro del menú que filtra las opciones, con búsqueda insensible a acentos. **Opt-in:** para listas largas y no memorizables |

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

> **El filtro de texto vuelve con `searchable`.** `react-select` lo traía de serie y la convergencia
> lo dejó afuera; los consumidores con listas largas —el filtro por proyecto, ~100 opciones— lo
> necesitan para ser usables. Es la deuda que la v1.1.0 cierra.

> El `selectStyles` duplicado en 5 archivos fue la razón por la que este spec existe: con tres
> selectores, cualquier cambio de paleta había que aplicarlo tres veces. Cerrado — queda como
> registro de por qué la convergencia valía la pena.

## Componentes y patterns relacionados

- [Input](./input.md) — misma caja, para valor libre.
- [Badge](./badge.md) — badge editable para el estado en la cabecera de detalle.
- [Toggle group](./toggle-group.md) — pocas opciones siempre visibles.

## Historial

- **1.1.0** (2026-09-04) — Se agrega la prop **`searchable`**: un buscador dentro del menú que
  filtra las opciones, con **búsqueda insensible a acentos y a caja**, fila «Sin resultados» cuando
  no hay coincidencias y limpieza de la consulta al cerrar. **Restaura una funcionalidad que se
  perdió al migrar de `react-select` al Select propio**: el filtro por proyecto del listado de
  requisitos tiene ~100 opciones y sin buscador es impracticable. Es **opt-in y no el default**,
  porque con pocas opciones un buscador estorba. Se especifica que la **navegación por teclado
  opera sobre las opciones visibles (filtradas)** y no sobre la lista completa —si no, `Enter`
  elegiría una opción distinta de la resaltada— y que el foco pasa al buscador sin que el control
  pierda su rol de `combobox`. Aditiva y backward compatible (MINOR).
- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0. Unifica `InputSelect`,
  `Select`, `react-select` directo e `InputMultipleSelect` en un solo componente con cuatro
  variants. Resuelve la duplicación registrada en `gaps-as-is.md` (MINOR sobre el DS).
