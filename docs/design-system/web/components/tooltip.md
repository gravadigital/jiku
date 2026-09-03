---
component: Tooltip
version: 1.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 (paleta y geometría) + relevamiento de código (10 usos)
related:
  - badge
  - button
---

# Tooltip (web)

> **Normativo en presentación.** El manual no dedica una página al tooltip, pero fija su paleta y
> su geometría. El componente existe en el código con **10 usos**, así que se especifica con lo que
> el sistema define y se marca lo que no.

## Propósito

Muestra información breve y complementaria al pasar el puntero o al recibir foco.

**Cuándo usar:**

- Aclarar un icono sin label visible.
- Mostrar el texto completo de un valor truncado.

**Cuándo NO usar:**

- Información necesaria para completar la tarea → visible en la pantalla. **Un tooltip es
  complementario por definición:** lo que sólo aparece al pasar el puntero no existe para quien
  usa un teclado o una pantalla táctil.
- Restricciones de un campo → dentro del control, como en [Dropzone](./dropzone.md).
- Mensajes de error → en el campo, con `aria-describedby`.

## Anatomía

1. **Container** — fondo azul oscuro, radio 8 px.
2. **Texto** — `text.field-label` (13/400) en niebla.
3. **Puntero (opcional)** — hacia el elemento que lo dispara.

## Variants

Una sola.

## Sizes

Sin sizes. Ancho máximo recomendado: **240 px**, para que el texto no forme una línea larga.

## States

| State | Descripción |
|---|---|
| `hidden` | En reposo, sin mostrar |
| `visible` | Desplegado por hover o foco |

Aparece con **`motion.fast`** (150 ms) y un retardo breve, para no dispararse al pasar de largo.

## Spacing & sizing rules

- **Radio:** 8 px (`radius.action`).
- **Fondo:** `tooltip.bg` → azul oscuro `#0B1934`.
- **Texto:** `tooltip.text` → niebla `#F6F6F9`.
- **Padding:** `space.1` (4 px) vertical, `space.2` (8 px) horizontal.
- **Separación del elemento:** `space.1` (4 px).
- **Z-index:** `z.tooltip`, el nivel más alto del sistema.

## Accesibilidad

- **DEBE** aparecer también con **foco de teclado**, no sólo con hover.
- El elemento disparador **DEBE** referenciarlo con `aria-describedby`; el tooltip lleva
  `role="tooltip"`.
- **DEBE** poder cerrarse con `Esc` sin mover el foco.
- **NO DEBE** contener controles interactivos: si hace falta un enlace o un botón adentro, es un
  popover, no un tooltip.
- **NO DEBE** desaparecer mientras el puntero se mueve hacia él, ni antes de que se pueda leer.
- **Contraste:** niebla sobre azul oscuro **14.6:1**.
- **En pantallas táctiles no hay hover:** la información **DEBE** estar disponible por otra vía.

## Guidelines de contenido

- **Una frase corta**, sin punto final.
- Aclara, no repite: si el label ya dice «Guardar», el tooltip no dice «Guardar».
- Sentence case, voseo cuando hay imperativo.

## Do's & don'ts

**Do:**

- Dispararlo con hover **y** con foco.
- Mantenerlo en una frase.
- Cerrarlo con `Esc`.

**Don't:**

- **NO SE DEBE** poner información necesaria sólo en un tooltip.
- **NO SE DEBEN** poner controles adentro.
- **NO SE DEBE** usar para textos largos: eso es un panel.
- **NO SE DEBE** usar color de sistema como fondo: el tooltip es azul oscuro.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `content` | `string` | — | Texto, requerido |
| `placement` | `"top" \| "bottom" \| "left" \| "right"` | `"top"` | Posición preferida |
| `delay` | `number` | `300` | Retardo de aparición, en ms |

**Slots:** `children` (el elemento disparador).

## Migración

El componente actual (10 usos) usaba `--color-tooltip-bg` `#625F5F`, un gris que no pertenece a la
paleta nueva.

| Hoy | Pasa a |
|---|---|
| Fondo `#625F5F` | **Azul oscuro `#0B1934`** |
| Sin foco de teclado verificado | Hover **y** foco, con `Esc` para cerrar |

## Componentes y patterns relacionados

- [Dropzone](./dropzone.md) — ejemplo de restricción que **no** va en tooltip.
- [Badge](./badge.md) — el sufijo «+N» suele apoyarse en tooltip.

## Historial

- **1.0.0** (2026-09-02) — Spec nuevo. Presentación derivada de la paleta y la geometría del Manual
  de marca Jiku v1.0 (azul oscuro, radio 8 px); reemplaza el gris `#625F5F` del código. Reglas de
  accesibilidad especificadas: hover **y** foco, `Esc`, sin controles internos (MINOR sobre el DS).
