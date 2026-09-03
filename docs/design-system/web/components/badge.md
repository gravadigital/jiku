---
component: Badge
version: 1.1.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Badges, etiquetas y estados»
related:
  - stepper
  - card
  - table
---

# Badge (web)

> **Normativo.** Especifica los pills de estado, tipo y prioridad. Es el componente donde vive la
> mayor parte de los colores de sistema, y el que más se ve en listados y tarjetas.

## Propósito

Comunica el estado, el tipo o la prioridad de una entidad en un espacio mínimo.

**Cuándo usar:**

- Estado de un requisito, proyecto o tarea.
- Tipo y prioridad como etiqueta.
- **Cambiar el estado** de un requisito desde la cabecera de detalle, con la variant `editable`.

**Cuándo NO usar:**

- Mostrar en qué paso del trabajo está un requisito → [Stepper](./stepper.md), que **informa** y no
  cambia el estado.
- Elegir un valor en un formulario → [Select](./select.md).
- Acción → [Button](./button.md).

## Anatomía

1. **Container** — pill de radio 999 px.
2. **Punto de color** — 8 px, a la izquierda. **El color vive en el punto y en el borde.**
3. **Label** — `text.filter-label` (11/600 versalitas), en el texto profundo de su familia.
4. **Chevron `▾`** (sólo `editable`) — a la derecha.

> **El color vive en el punto y en el borde; el texto se mantiene legible.** Es la regla del
> manual, y es la que hace que el badge cumpla contraste sin renunciar al color de estado.

## Variants

| Variant | Propósito | Presentación |
|---|---|---|
| `state` | Estado de requisito / proyecto / tarea | Pill con punto de color |
| `outline` | Tipo y prioridad | Pill outline, sin punto |
| `area` | Área de la tarea | Glifo de área **por forma** + neutro de marca |
| `editable` | **Control de cambio de estado** en cabecera de detalle | Pill con chevron `▾` |
| `card-tag` | Etiqueta de tarjeta | Pill compacto — «Interno», «Comercial», «Prioridad 0» |

### Mapeo de estado a familia de color

| Estado | Familia | Tinte / Borde / Texto |
|---|---|---|
| Planificación | `state.analysis` | `#E9E7FA` / `#D5D1F5` / `#1F01B9` |
| En cola | `state.neutral` | `#EDEEF1` / `#DFE1E7` / `#6D727B` |
| Desarrollo | `state.in-progress` | `#E1F4F0` / `#BFE7DF` / `#12897A` |
| Revisión | `state.review` | `#FFF2DE` / `#FBE0B6` / `#8A5405` |
| Resuelto | `state.resolved` | `#E7F6F3` / `#CDEBE5` / `#12897A` |
| Cancelado | `state.neutral` | `#EDEEF1` / `#DFE1E7` / `#6D727B` |

| Prioridad | Familia |
|---|---|
| Alta | `state.urgent` |
| Media | `state.review` |
| Baja | `state.neutral` |
| Sin prioridad | `state.neutral`, tinte grafito |

> **«En curso» en una tarjeta usa verde agua pleno** (`badge.current.bg`), porque marca el elemento
> activo de interfaz. **Los estados en tabla y listado usan `#1B998B`**, no verde agua. Es la
> distinción del manual: verde agua para lo activo en interfaz, `#1B998B` para el dato.

**Campos sin valor** («Sin tipo», «Sin prioridad») usan **tinte grafito**.

### El badge editable es el control de estado

La variant `editable` de la cabecera de detalle **ofrece los siete estados, sin recorte de
secuencia**: hacia adelante y hacia atrás, incluidos `resuelto` y `cancelado`, que desde
**REQ-012** (stories S-049 y S-050) dejaron de ser terminales.

Es una división deliberada con el [Stepper](./stepper.md#reparto-de-responsabilidades):

| Control | Rol |
|---|---|
| **Badge editable** (este) | Decide **a dónde va** — los siete estados |
| Stepper | Muestra **dónde está** — los cinco pasos de trabajo |

**El badge no se deshabilita en estado terminal.** Un requisito `resuelto` o `cancelado` sigue
ofreciendo los siete estados como cualquier otro (S-050, CA-2).

## Sizes

Un solo tamaño. Alto determinado por el `text.filter-label` (11/600) más el padding: **~22 px**.
El `card-tag` comparte tamaño.

## States

| State | Descripción |
|---|---|
| `default` | En reposo |
| `hover` | Sólo en `editable` — el pill indica que es accionable |
| `focus` | Sólo en `editable` — `focus.ring` |
| `open` | Sólo en `editable` — menú de estados desplegado |

`state`, `outline`, `area` y `card-tag` **no son interactivos**: no tienen hover ni foco.

## Spacing & sizing rules

- **Radio:** 999 px (`radius.pill`).
- **Punto:** 8 px de diámetro, gap `space.1` (4 px) al label.
- **Padding horizontal:** `space.2` (8 px).
- **Borde:** 1 px, del color de borde de su familia.
- **Gap entre badges adyacentes:** `space.1` (4 px).

## Accesibilidad

- **El estado NUNCA se comunica sólo con color:** el badge lleva **punto + texto** siempre. Es uno
  de los diez controles del checklist de marca.
- El texto usa la **versión profunda** de cada matiz (`#12897A`, `#8A5405`, `#C41F19`, `#1F01B9`)
  precisamente para alcanzar contraste sobre el tinte al 12 %.
- El punto de color es decorativo: `aria-hidden="true"`. La información está en el texto.
- **`editable`:** es un control — `<button>` con `aria-haspopup="listbox"` y `aria-expanded`; el
  chevron `▾` es su affordance visible y **no basta por sí solo**, el rol lo declara. Su nombre
  accesible **DEBE** incluir qué cambia: «Estado: Desarrollo», no sólo «Desarrollo».
- El glifo de `area` distingue **por forma además de por color**, para no depender del matiz.

## Guidelines de contenido

- El **término de dominio, siempre igual**: el estado se escribe idéntico en el pill, en el stepper
  y en la tabla.
- **Versalitas** — es el uso reservado para ellas junto con los labels de filtro.
- Campo vacío: «Sin tipo», «Sin prioridad» — explícito, no en blanco.

## Do's & don'ts

**Do:**

- Poner el color en el punto y el borde, y dejar el texto legible.
- Usar tinte grafito para lo que no tiene valor.
- Distinguir el badge editable con el chevron `▾`.

**Don't:**

- **NO SE DEBE** usar verde agua de marca como color de un estado en tabla o listado: ese es
  `#1B998B`.
- **NO SE DEBE** rellenar el pill con el color pleno de sistema: el fondo es el tinte al 12 %.
- **NO SE DEBE** comunicar el estado sólo con color.
- **NO SE DEBE** usar un badge como botón: si dispara una acción, es un [Button](./button.md).
- **NO SE DEBE** deshabilitar el badge editable en `resuelto` ni `cancelado`.
- **NO SE DEBE** recortar los estados ofrecidos según el estado actual: son los siete, siempre.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"state" \| "outline" \| "area" \| "editable" \| "card-tag"` | `"state"` | Presentación |
| `family` | `"resolved" \| "in-progress" \| "review" \| "urgent" \| "analysis" \| "neutral"` | `"neutral"` | Familia de color de sistema |
| `label` | `string` | — | Texto visible, requerido |
| `options` | `{ value, label }[]` | — | Sólo `editable`: estados disponibles |
| `onChange` | `(value) => void` | — | Sólo `editable` |

## Componentes y patterns relacionados

- [Stepper](./stepper.md) — muestra el recorrido de trabajo; **no** cambia el estado.
- [ViewHeader](./view-header.md) — la cabecera `detail` donde vive el badge editable.
- [Card](./card.md) — usa `card-tag` y `area`.
- [Table](./table.md) — columna de estado y de prioridad.
- [Select](./select.md) — el menú del `editable` sigue sus reglas de teclado.

## Historial

- **1.1.0** (2026-09-02) — Se explicita que la variant `editable` **es** el control de cambio de
  estado y ofrece los siete sin recorte, incluso en estado terminal (REQ-012 / S-049 / S-050), en
  reparto deliberado con el stepper (MINOR).
- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: pill con punto de color,
  cinco variants, mapeo de los siete estados y las prioridades a las familias de sistema con sus
  tintes al 12 % y bordes al 26 %, y la distinción entre verde agua (activo de interfaz) y
  `#1B998B` (dato) (MINOR sobre el DS).
