---
component: Button
version: 2.0.1
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Botones y controles de acción»
related:
  - input
  - badge
  - sidebar-nav
---

# Button (web)

> **Normativo.** Especifica el botón que el producto **debe** tener. El componente actual
> (`web/src/shared/components/ui/Button/Button.tsx`, **29 usos**, el más usado del producto) sirve
> magenta `#DA2C6A` con dos variants; esta especificación lo reemplaza. La deuda del código está en
> [Migración](#migración).

## Propósito

Disparador de acciones del usuario. Comunica una intención concreta y entrega feedback inmediato.

**Cuándo usar:**

- Acciones que cambian estado del sistema (guardar, agregar, pasar a revisión).
- Acción principal de una vista.
- Confirmaciones y descartes en formularios.

**Cuándo NO usar:**

- Navegación entre pantallas → un enlace, en `text.link` (`#12897A`).
- Alta rápida dentro de una sección → [FAB de sección](#fab-de-sección).
- Selección entre opciones excluyentes → [toggle segmentado](./toggle-group.md).

## Anatomía

1. **Container** — rectángulo de radio 8 px, alto 40 px.
2. **Label** — texto centrado, verbo primero, en `text.body-default` (Gabarito 14/400).
3. **Icono (opcional)** — 16 px, mismo color que el label; en la acción de flujo va a la derecha (→).
4. **Indicador de carga** — spinner inline que reemplaza el label.

## Variants

**Un solo botón primario por vista.**

| Variant | Propósito | Tokens | Ejemplo |
|---|---|---|---|
| `primary` | Acción principal de la vista | `button.primary.*` — fondo `#61CCB9`, texto `#0B1934` | «Nuevo proyecto», «Guardar», «Agregar» |
| `secondary-nav` | Navegación hacia atrás | `button.secondary.border.nav` — **borde verde agua** | «Volver» |
| `secondary-dismiss` | Descartar | `button.secondary.border.dismiss` — **borde claro** | «Cancelar» |
| `session` | Entrada y salida de sesión | `button.session.*` — radio **10 px**, alto **46 px** | «Iniciar sesión», «Cerrar sesión» |
| `flow` | Avance de estado de un flujo | `button.flow.*` con icono → | «Pasar a revisión» |

> **La distinción entre los dos secundarios es semántica, no decorativa:** el borde verde agua
> indica que la acción **navega**; el borde claro, que **descarta**. No son intercambiables.

> **No hay variant `destructive`, y es una decisión tomada.** El rojo del sistema (`#F72C25`) está
> **reservado a estados de vencimiento**, no a acciones. Un borrado se confirma con
> [ConfirmDialog](./confirm-dialog.md), donde **ambas acciones van como `secondary-dismiss`** y la
> advertencia la carga el texto — ver
> [Presentación de la acción destructiva](./confirm-dialog.md#presentación-de-la-acción-destructiva).

### FAB de sección

Botón circular de alta rápida: «+ agregar etapa / requisito / tarea». Tokens `fab.*` — radio pill,
fondo verde agua, icono azul oscuro.

## Sizes

| Size | Alto | Radio | Uso |
|---|---|---|---|
| `default` | **40 px** | 8 px | Primario, secundarios y acción de flujo |
| `session` | **46 px** | 10 px | **Sólo** login y logout |

**No hay size `small`.** El botón del código lo tiene, para usarse dentro de tablas y cards; en el
sistema nuevo esos casos se resuelven con [badge editable](./badge.md) o pills.

## States

| State | Descripción | Tokens |
|---|---|---|
| `default` | Estado base | `button.{variant}.bg` |
| `hover` | Puntero encima — transición `motion.fast` | oscurecimiento del fondo |
| `focus` | Foco por teclado | **`focus.ring`** — anillo verde agua 3 px al 22 % |
| `active` | Durante el click | `elevation` sin cambio, fondo un paso más oscuro |
| `disabled` | No interactivo | **fondo niebla, borde claro, texto `#9AA1AC`** |
| `loading` | Acción en progreso | spinner inline, `aria-busy="true"` |

## Spacing & sizing rules

- **Radio:** 8 px (`radius.action`); 10 px en `session`.
- **Alto:** 40 px; 46 px en `session`.
- **Padding horizontal:** `space.4` (16 px) mínimo; el label nunca toca el borde.
- **Gap entre botones adyacentes:** `space.2` (8 px).
- **Gap label–icono:** `space.1` (4 px).

## Accesibilidad

- **ARIA:**
  - Elemento `<button>` nativo — rol implícito.
  - `aria-disabled="true"` cuando `disabled`.
  - `aria-busy="true"` cuando `loading`.
  - `aria-label` obligatorio en el FAB, que no tiene texto visible.
- **Teclado:** `Enter` y `Space` activan; `Tab` / `Shift+Tab` navegan el foco.
- **Foco:** anillo `focus.ring` visible. **NO SE DEBE** suprimir con `outline: none` sin reemplazo.
- **Contraste:** azul oscuro sobre verde agua da **9.8:1** — cumple AA y AAA.
  El estado `disabled` (texto `#9AA1AC` sobre niebla) **no alcanza AA a propósito**: comunica
  inactividad, y por eso **nunca es el único indicador** —el botón además no responde.
- **Screen reader:** al pasar a `loading` la región anuncia el cambio; el label del botón no cambia
  de significado.

## Guidelines de contenido

Ver [guidelines/content.md](../guidelines/content.md#labels-y-ctas).

- **Longitud:** 1–3 palabras ideal, máximo 5.
- **Verbo primero:** «Guardar», «Agregar», «Pasar a revisión».
- **Sentence case:** «Nuevo proyecto», nunca «Nuevo Proyecto».
- **Sin signos de exclamación.**

**Microcopy:**

- ✓ «Guardar», «Volver», «Pasar a revisión», «Iniciar sesión»
- ✗ «Click aquí» — no informa qué hace
- ✗ «Submit» — técnico, no humano
- ✗ «¡Guardar!» — el tono de marca es sereno

## Do's & don'ts

**Do:**

- **Un solo botón primario por vista.** Es uno de los diez controles del checklist de marca.
- Usar borde verde agua para navegar y borde claro para descartar.
- Reservar el radio de 10 px y el alto de 46 px a login y logout.
- Mostrar `loading` cuando la acción demora ≥ 300 ms.

**Don't:**

- **NO SE DEBEN** apilar dos botones primarios en una misma vista.
- **NO SE DEBE** usar un color de sistema como fondo de botón: el rojo es de estado, no de acción.
- **NO SE DEBE** usar el botón para navegar entre pantallas.
- **NO SE DEBE** inventar un tamaño intermedio ni un radio distinto de 8/10 px.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"primary" \| "secondary-nav" \| "secondary-dismiss" \| "session" \| "flow"` | `"primary"` | Variant semántico |
| `disabled` | `boolean` | `false` | Inactiva el control |
| `loading` | `boolean` | `false` | Muestra spinner inline y marca `aria-busy` |
| `icon` | `string` | — | Nombre del icono del set (16 px) |
| `iconTrailing` | `boolean` | `false` | Icono a la derecha — `true` en `flow` |
| `onClick` | `(e) => void` | — | Callback de activación |

**Slots:** `children` (label).

> **`size` desaparece de la API** y `variant` cambia de valores. Es el cambio breaking de este
> componente.

## Migración

Estado actual: `variant="primary" | "secondary"` + `size="normal" | "small"`, fondo
`--color-button` `#DA2C6A`, secundario `#D9D9D9`, foco `--color-highlighted` `rgb(54,0,136)`.

| Hoy | Pasa a |
|---|---|
| `primary` (`#DA2C6A`) | `primary` con fondo `#61CCB9` y texto `#0B1934` |
| `secondary` (`#D9D9D9`) | `secondary-nav` o `secondary-dismiss` según **qué hace** — requiere revisar los usos uno por uno |
| `size="small"` | Se elimina; el caso se resuelve con badge o pill |
| Foco violeta `rgb(54,0,136)` | `focus.ring` verde agua al 22 % |
| Borrado con `--color-button-delete` aplicado por el consumidor | `secondary-dismiss` dentro de [ConfirmDialog](./confirm-dialog.md); el rojo deja de ser color de acción |

**El `secondary` de hoy no se puede migrar automáticamente:** un `#D9D9D9` puede ser un «Volver» o
un «Cancelar», y el sistema nuevo los distingue. Son 29 usos a clasificar.

**Resuelto de paso:** el relevamiento marcó que el contraste de `secondary` sobre `#D9D9D9` era el
candidato más probable a no alcanzar AA. Los secundarios nuevos son outline sobre fondo claro, con
texto `#0B1934`.

## Componentes y patterns relacionados

- [Input](./input.md) — comparten el anillo de foco.
- [Badge](./badge.md) — reemplaza al botón `small` dentro de tablas y cards.
- [Toggle group](./toggle-group.md) — selección excluyente, no acción.
- [Loader](./loader.md) — el spinner del estado `loading`.

## Historial

- **2.0.2** (2026-09-03, story S-058) — Corrige la implementación para cumplir lo que este spec
  ya declaraba («el label del botón no cambia de significado» en loading): cuando `children` es
  texto plano, `loading` fija ese texto como `aria-label` explícito del `<button>`, así el
  nombre accesible no pasa a "Cargando" mientras el spinner reemplaza el contenido visible. Antes
  de esta corrección el nombre accesible sí cambiaba — el defecto que motivó la CA-4 de S-058 en
  el botón de `login`. No cambia contrato de API (PATCH).
- **2.0.1** (2026-09-02) — Se enlaza la decisión sobre la acción destructiva, ya resuelta en
  `confirm-dialog.md`: no se agrega variant `destructive` (PATCH).
- **2.0.0** (2026-09-02) — Reespecificado desde el Manual de marca Jiku v1.0. Fondo verde agua con
  texto azul oscuro, radio 8 px, alto 40 px; cinco variants semánticos que reemplazan
  `primary`/`secondary`; se elimina `size`; foco con anillo verde agua al 22 %; se agrega el FAB de
  sección. Pasa de `relevado-desde-código` a `normativo` (MAJOR).
- **1.0.0** (2026-08-18) — Relevado desde el código existente durante la importación del producto.
