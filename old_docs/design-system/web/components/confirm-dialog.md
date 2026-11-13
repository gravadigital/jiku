---
component: ConfirmDialog
version: 1.1.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 (paleta y geometría) + relevamiento de código (3 usos)
related:
  - button
  - card
---

# ConfirmDialog (web)

> **Normativo.** El manual no tiene página de modales, así que la superficie, la tipografía y la
> geometría se derivan del resto del sistema, y las reglas de accesibilidad de un diálogo modal son
> las estándar.
>
> **La presentación de la acción destructiva fue decidida el 2026-09-02:** confirmar va como
> **secundario de borde claro**, y **la advertencia la carga el texto**. Ver
> [Presentación de la acción destructiva](#presentación-de-la-acción-destructiva).

## Propósito

Pide confirmación explícita antes de una acción irreversible.

**Cuándo usar:**

- Borrado de una entidad.
- Acción que no se puede deshacer y que el usuario podría haber disparado sin querer.

**Cuándo NO usar:**

- Acciones reversibles: se ejecutan y se ofrece deshacer.
- Avance de estado de un requisito → [Stepper](./stepper.md) / [Badge](./badge.md) editable.

## Anatomía

1. **Overlay** — cubre la vista y atenúa el fondo.
2. **Container** — superficie blanca, radio 14 px, `elevation.raised`.
3. **Título** — `text.card-title` (16/700).
4. **Cuerpo** — `text.body-default`, dice **qué** se va a borrar y que no se puede deshacer.
5. **Acciones** — confirmar y cancelar, **ambas como secundario de borde claro**.

## Variants

Una sola. No hay variant destructiva: la diferencia entre confirmar un borrado y confirmar
cualquier otra cosa **la hace el texto**, no el color.

## Presentación de la acción destructiva

**Decisión del 2026-09-02.** El manual retira el rojo de la paleta de acción —«los rojos se
reservan a estados de vencimiento»— y no propone reemplazo. La resolución:

| Elemento | Tratamiento |
|---|---|
| **Confirmar** («Eliminar») | [Button](./button.md) `secondary-dismiss` — **borde claro** |
| **Cancelar** | [Button](./button.md) `secondary-dismiss` — **borde claro** |
| **La advertencia** | **El texto**: título con el verbo, cuerpo con la entidad y la irreversibilidad |

**Dos razones, y la segunda es la que decide:**

1. **Coherencia de paleta.** No se introduce un segundo significado para el rojo, que en este
   sistema quiere decir «vencido».
2. **Ningún botón compite por el clic.** El verde agua pleno atrae la mirada y el clic; en un
   borrado eso es exactamente lo que **no** se quiere. Con las dos acciones al mismo peso visual,
   **el usuario tiene que leer** — y lo que lee nombra qué se borra y que no hay vuelta atrás.

> **El corolario:** si el texto no advierte, nada advierte. Por eso el microcopy de este componente
> no es una recomendación de estilo sino **parte del mecanismo de seguridad**, y las reglas de
> [Guidelines de contenido](#guidelines-de-contenido) son obligatorias.

## Sizes

Ancho máximo recomendado: **480 px**. Alto según contenido.

## States

| State | Descripción |
|---|---|
| `open` | Visible, con foco atrapado dentro |
| `closed` | No renderizado |
| `pending` | Confirmación en curso — el botón de confirmar en `loading` |

## Spacing & sizing rules

- **Radio:** 14 px (`radius.surface`).
- **Sombra:** `elevation.raised`.
- **Padding:** `space.4` (16 px).
- **Gap entre acciones:** `space.2` (8 px).
- **Z-index:** `z.modal` — **por debajo de `z.tooltip` y por encima de `z.navbar`**, que es
  justamente el orden que hay que corregir (ver [spacing](../foundations/spacing.md#z-index)).

## Accesibilidad

Esto no depende del manual y **es obligatorio**:

- **DEBE** llevar `role="dialog"` con `aria-modal="true"` y `aria-labelledby` hacia su título.
- **El foco DEBE atraparse dentro del diálogo** mientras está abierto, y **volver al elemento que
  lo abrió** al cerrarse.
- **`Esc` DEBE cerrar** el diálogo cancelando la acción.
- El foco inicial va en **la acción menos destructiva** (cancelar), no en confirmar.
- El cuerpo **DEBE** nombrar qué se afecta: «Se va a eliminar el requisito #151. Esta acción no se
  puede deshacer.» — no «¿Estás seguro?».
- El fondo **DEBE** quedar inerte (`aria-hidden` o `inert`), no sólo visualmente atenuado.
- **NO SE DEBE** confiar en el color para señalar el peligro: lo dice el texto.

## Guidelines de contenido

Ver [guidelines/content.md](../guidelines/content.md#confirmación-destructiva).

- **Título:** la acción — «Eliminar requisito».
- **Cuerpo:** qué se afecta **y** que es irreversible.
- **Botón de confirmar: el verbo de la acción**, no «Sí» — «Eliminar».
- **Botón de cancelar:** «Cancelar».

**Do:**

- ✓ «Eliminar requisito» / «Se va a eliminar el requisito #151. Esta acción no se puede deshacer.»
- ✗ «¿Estás seguro?» — no dice qué pasa
- ✗ «Sí / No» — obliga a releer el título para saber qué se confirma

## Do's & don'ts

**Do:**

- Nombrar la entidad afectada.
- Poner el foco inicial en cancelar.
- Usar el verbo de la acción en el botón de confirmar.

**Don't:**

- **NO SE DEBE** usar un diálogo para una acción reversible.
- **NO SE DEBE** dejar el foco fuera del diálogo.
- **NO SE DEBE** usar rojo en el botón de confirmar: en este sistema el rojo es estado de
  vencimiento, no acción.
- **NO SE DEBE** usar el primario verde agua para confirmar un borrado: sería el elemento más
  llamativo del diálogo.
- **NO SE DEBE** dejar el cuerpo sin nombrar la entidad: es lo único que advierte.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `title` | `string` | — | Acción a confirmar |
| `body` | `string` | — | Qué se afecta y su irreversibilidad |
| `confirmLabel` | `string` | — | Verbo de la acción |
| `onConfirm` | `() => void` | — | Callback de confirmación |
| `onCancel` | `() => void` | — | Callback de cancelación |
| `pending` | `boolean` | `false` | Confirmación en curso |

## Migración

El `ConfirmDialog` del código tiene **3 usos**.

| Hoy | Pasa a |
|---|---|
| Borrado con `--color-button-delete` `#FB033F` aplicado por el consumidor | **`secondary-dismiss`** de borde claro; el rojo desaparece de la acción |
| Advertencia apoyada en el color | Advertencia en el **texto**: entidad nombrada + irreversibilidad |
| Foco inicial no verificado | Foco inicial en **cancelar** |

**Al migrar hay que revisar el microcopy de los 3 usos**, no sólo el color: si el cuerpo decía
«¿Estás seguro?», con este tratamiento el diálogo se queda sin nada que advierta.

## Componentes y patterns relacionados

- [Button](./button.md) — las dos acciones; no tiene variant destructivo.
- [Card](./card.md) — comparten radio y sombra.

## Historial

- **1.1.0** (2026-09-02) — **Decidida la presentación de la acción destructiva:** confirmar como
  secundario de borde claro, sin rojo y sin primario, con la advertencia en el texto. El microcopy
  pasa a ser parte del mecanismo de seguridad, no una recomendación de estilo. Deja de estar
  `parcial` (MINOR).
- **1.0.0** (2026-09-02) — Spec nuevo. Superficie, tipografía y geometría derivadas del Manual de
  marca Jiku v1.0; reglas de accesibilidad de diálogo modal especificadas por completo.
