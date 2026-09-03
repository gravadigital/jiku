---
component: Input
version: 1.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Campos de formulario»
related:
  - select
  - button
  - form (pattern)
---

# Input (web)

> **Normativo.** Especifica el campo de texto del sistema. Reemplaza a los componentes `InputText`
> (8 usos), `InputTextarea` (4) e `InputDate` (2) relevados del código, que compartían mixin pero
> no especificación.

## Propósito

Captura de un valor de texto, número o fecha dentro de un formulario.

**Cuándo usar:**

- Cualquier dato que el usuario escribe.
- Texto largo (descripción) con la variant `textarea`.
- Fechas, con la variant `date` y su icono de calendario.

**Cuándo NO usar:**

- Elección entre opciones conocidas → [Select](./select.md).
- Búsqueda que filtra una lista en vivo → variant `search`.

## Anatomía

1. **Label** — `text.field-label` (Gabarito 13/400), sobre el campo.
2. **Marca de obligatoriedad** — «(obligatorio)» junto al label, o asterisco `*` verde agua.
3. **Container** — radio 10 px, alto 44 px, borde claro de 1 px.
4. **Valor o placeholder** — placeholder en `#9AA1AC`; valor en `#0B1934`.
5. **Icono (opcional)** — 16 px dentro del campo (calendario, lupa).
6. **Mensaje de error (opcional)** — debajo, en `state.urgent.text` (`#C41F19`).

## Variants

| Variant | Propósito | Nota |
|---|---|---|
| `text` | Valor de una línea | Default |
| `textarea` | Texto largo | Alto mayor a 44 px; el resto igual |
| `date` | Fecha | Placeholder `mm/dd/aaaa`, icono de calendario 16 px |
| `search` | Búsqueda | Con lupa: «Buscar proyecto» |
| `locked` | Valor no editable | Fondo niebla, texto secundario, sin borde de foco |

## Sizes

Un solo tamaño: **alto 44 px, radio 10 px**. El `textarea` crece en alto y conserva radio y borde.

## States

| State | Descripción | Tokens |
|---|---|---|
| `default` (reposo) | Con placeholder en `#9AA1AC` | `input.border`, `input.placeholder` |
| `filled` | Con valor, texto `#0B1934` | `input.text` |
| `focus` | **Anillo de 3 px al 22 %** + borde verde agua | `input.focus.ring`, `input.border.focus` |
| `required` | Obligatoriedad marcada en verde agua | `input.required.mark` |
| `locked` | Bloqueado, en niebla | `input.locked.bg`, `input.locked.text` |
| `error` | Borde y mensaje en rojo de sistema | `state.urgent` |
| `disabled` | No interactivo | `bg.action.disabled`, `text.disabled` |

> **El foco y la obligatoriedad se marcan en verde agua; el estado bloqueado, en niebla.** Es la
> regla del manual, y distingue «no podés editar esto» de «esto está mal».

## Spacing & sizing rules

- **Radio:** 10 px (`radius.field`). **Alto:** 44 px.
- **Padding horizontal:** `space.2` (8 px) mínimo; 16 px cuando hay icono.
- **Gap label–campo:** `space.1` (4 px).
- **Gap entre campos:** `space.4` (16 px).
- **Anillo de foco:** 3 px hacia fuera, sin desplazar el layout (`box-shadow`).

## Accesibilidad

- **ARIA:**
  - Todo campo **DEBE** tener `<label for>` asociado — no basta el placeholder.
  - `aria-required="true"` cuando es obligatorio.
  - `aria-invalid="true"` + `aria-describedby` apuntando al mensaje cuando hay error.
  - `readonly` o `disabled` según corresponda en `locked`.
- **Teclado:** `Tab` navega; el `date` acepta escritura además del selector.
- **Foco:** anillo `focus.ring` visible; **NO SE DEBE** eliminar.
- **Contraste:** el placeholder `#9AA1AC` sobre blanco da ~2.5:1 y **no cumple AA**, por eso
  **el placeholder nunca porta información necesaria** — el label sí, y va siempre.
- **Error:** se comunica con **borde + icono + texto**, nunca sólo con color.

## Guidelines de contenido

- **Label:** sustantivo, sentence case: «Nombre del proyecto», «Fecha de cierre estimada».
- **Placeholder:** ejemplo o formato, nunca repetición del label: «mm/dd/aaaa».
- **Obligatoriedad:** «(obligatorio)» explícito junto al label, además del asterisco.
- **Restricciones:** al lado del control — «Máximo 10 MB por archivo.»

## Do's & don'ts

**Do:**

- Poner siempre label visible asociado al campo.
- Marcar el foco con el anillo verde agua al 22 %.
- Usar `locked` (niebla) para lo que no se puede editar y `error` (rojo) para lo que está mal.

**Don't:**

- **NO SE DEBE** usar el placeholder como label.
- **NO SE DEBE** marcar un error sólo con color.
- **NO SE DEBE** cambiar el alto de 44 px ni el radio de 10 px.
- **NO SE DEBE** usar verde agua para texto dentro del campo.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"text" \| "textarea" \| "date" \| "search" \| "locked"` | `"text"` | Tipo de campo |
| `label` | `string` | — | Label visible, **requerido** |
| `required` | `boolean` | `false` | Marca de obligatoriedad |
| `placeholder` | `string` | — | Ejemplo o formato |
| `error` | `string` | — | Mensaje de error; activa el state `error` |
| `disabled` | `boolean` | `false` | Inactiva el control |
| `icon` | `string` | — | Icono del set, 16 px |
| `value` / `onChange` | — | — | Valor controlado |

> **`error` pasa de booleano a string.** En el código actual es una bandera que sólo pinta el
> borde; acá lleva el mensaje, que es lo que `aria-describedby` necesita.

## Migración

Los tres componentes de campo del código (`InputText`, `InputTextarea`, `InputDate`) y el mixin de
`_mixins.scss` convergen en este spec.

| Hoy | Pasa a |
|---|---|
| Radio `--radius-items` (0.5rem / 8 px) | **10 px** |
| Foco `--color-highlighted` `rgb(54,0,136)` | **`focus.ring`** verde agua al 22 % |
| Borde de error `--color-button-delete` `#FB033F` | `state.urgent` `#F72C25` |
| `error: boolean` | `error: string` con el mensaje |
| Alto no declarado | **44 px** |

## Componentes y patterns relacionados

- [Select](./select.md) — misma caja, para opciones conocidas.
- [Button](./button.md) — comparten el anillo de foco.
- [Dropzone](./dropzone.md) — carga de archivos.

## Historial

- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: radio 10 px, alto 44 px,
  foco y obligatoriedad en verde agua, bloqueado en niebla. Unifica `InputText`, `InputTextarea` e
  `InputDate` (MINOR sobre el DS).
