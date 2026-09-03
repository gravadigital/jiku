---
component: Stepper
version: 1.1.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Stepper de estado del requisito»
related:
  - badge
---

# Stepper (web)

> **Normativo.** Especifica el stepper de estado del requisito: **cinco pasos de trabajo**, que es
> lo que el manual define y lo que el producto ya implementa.
>
> **El stepper no es el control de cambio de estado.** Muestra **dónde está** el requisito dentro
> del recorrido de trabajo; **a dónde puede ir** lo decide el [badge editable](./badge.md) de la
> cabecera, que ofrece los siete estados sin recorte. Cerrar el requisito
> (Resolver / Cancelar / Reabrir) vive en la card de resolución. Ver
> [Reparto de responsabilidades](#reparto-de-responsabilidades).

## Propósito

Muestra el recorrido de trabajo de un requisito: qué se completó, dónde está y qué falta.

**Cuándo usar:**

- Vista de detalle de un requisito, para **leer** en qué paso del trabajo está.

**Cuándo NO usar:**

- **Cambiar el estado** → [Badge editable](./badge.md) de la cabecera. El stepper informa; no es
  el selector de estado.
- Resolver o cancelar → card de resolución.
- Elegir un estado en un formulario → [Select](./select.md).

## Reparto de responsabilidades

Tres controles distintos, y la separación es deliberada:

| Control | Qué hace | Alcance |
|---|---|---|
| **Stepper** (este spec) | Leer **dónde está** el requisito | Los **cinco** pasos de trabajo |
| **[Badge editable](./badge.md)** en el [ViewHeader](./view-header.md) | Decidir **a dónde va** | Los **siete** estados, sin recorte de secuencia |
| **Card de resolución** | Cerrar y reabrir | Resolver · Cancelar · Reabrir |

> **Por qué importa.** Desde **REQ-012** (stories S-049 y S-050) cualquier estado se alcanza desde
> cualquier otro, hacia adelante y hacia atrás: `core` eliminó la tabla de transiciones y
> `resuelto`/`cancelado` dejaron de ser terminales. Esa libertad **no vive en el stepper**: vive en
> el badge. El stepper sigue mostrando los cinco pasos porque es *cómo el equipo lee dónde está el
> requisito*, no un menú de destinos.
>
> El título de S-050 —«el stepper ofrece los siete estados»— describe **la capacidad del sistema**
> (ningún estado queda recortado por secuencia), no la cantidad de nodos del stepper.
> `RequirementStatusCard` renderiza cinco pasos y lo dice explícitamente en el código.

## Anatomía

1. **Nodos** — uno por etapa, con `✓` (recorrida) o su número (pendiente).
2. **Labels** — nombre de la etapa, con el término de dominio exacto.
3. **Conectores** — línea entre nodos, en borde claro.

## Etapas

**Cinco pasos fijos**, para cualquier tipo de requisito:

| # | Etapa |
|---|---|
| 1 | Análisis |
| 2 | Planificación |
| 3 | En cola |
| 4 | Desarrollo |
| 5 | Revisión |

**Resuelto** y **Cancelado** **no son nodos del stepper**: son estados de cierre. Se ven en el
[badge](./badge.md) —que documenta los siete— y se alcanzan desde la card de resolución.

> **«En cola» se muestra también para incidencias**, aunque no forme parte de su recorrido
> habitual. El stepper no recorta por tipo: muestra los cinco pasos siempre, porque su función es
> ubicar, no restringir.

### Atajo al paso siguiente

Junto al stepper puede ofrecerse un **botón de transición** al destino habitual («Pasar a
revisión →»), con la variant `flow` de [Button](./button.md). Es un **atajo, no la única salida**:
el badge sigue ofreciendo los siete estados.

Desde **Revisión** el atajo no sugiere destino: cerrar el requisito vive en la card de resolución.
Desde **Resuelto** o **Cancelado**, el atajo y «Reabrir» apuntan al mismo destino, para no ofrecer
dos vueltas distintas a lo mismo.

## Variants

Una sola. La representación cambia por el **estado de cada nodo**, no por variant.

## States

Tres estados de nodo, y son la especificación central:

| State | Descripción | Tokens |
|---|---|---|
| **Recorrido** | Etapa completada | **Verde agua pleno** + `✓` en azul oscuro — `stepper.done.*` |
| **Actual** | Etapa en curso | **Anillo** — `stepper.current.ring`, texto `text.primary` |
| **Pendiente** | Etapa por delante | **Borde claro** + número, texto `text.disabled` — `stepper.pending.*` |

> «Lo recorrido va en verde agua pleno; la etapa actual, en anillo; lo pendiente, en borde claro.»
> Es el único lugar del sistema donde el verde agua se usa **pleno como fondo**, y funciona porque
> el `✓` va en azul oscuro (9.8:1).

## Spacing & sizing rules

- **Nodo:** circular, radio pill.
- **Conector:** 1 px `#DFE1E7`, alineado al centro vertical de los nodos.
- **Gap nodo–label:** `space.1` (4 px).
- **Anillo del actual:** 3 px, mismo grosor que `focus.ring` pero **no es foco** — es estado.

## Accesibilidad

- **DEBE** ser una lista ordenada (`<ol>`), que es lo que un recorrido es.
- Cada nodo **DEBE** anunciar su estado en texto: «Análisis, completada», «Desarrollo, etapa
  actual», «Revisión, pendiente». **El `✓` y el anillo son visuales y no alcanzan.**
- La etapa actual **DEBE** llevar `aria-current="step"`.
- Si el stepper permite avanzar, cada nodo accionable es un `<button>` con `focus.ring`; si es sólo
  informativo, **NO DEBE** ser focusable.
- El estado **NO SE COMUNICA sólo con color:** `✓` / número / anillo distinguen por forma.
- **El stepper informativo NO DEBE ser focusable.** Si en una vista no cambia el estado —el caso
  por defecto, porque eso lo hace el badge— no entra en el orden de foco y se expone como lista,
  no como grupo de controles.
- **Contraste:** azul oscuro sobre verde agua **9.8:1**; texto pendiente `#9AA1AC` es
  deliberadamente bajo y **acompañado de su número**.

## Guidelines de contenido

- El nombre de la etapa **escrito igual** que en el badge y en la tabla.
- Sin abreviar: «Planificación», no «Planif.» (esa abreviatura es de los tintes de la paleta, no de
  la interfaz).

## Do's & don'ts

**Do:**

- Usar verde agua pleno **sólo** para lo recorrido.
- Distinguir el actual con anillo, no con otro color.
- Anunciar el estado de cada etapa en texto.

**Don't:**

- **NO SE DEBE** usar un color de sistema en los nodos: el recorrido no es un estado de sistema.
- **NO SE DEBE** rellenar el nodo actual: el anillo es lo que lo distingue.
- **NO SE DEBE** convertir el stepper en el selector de estado: para eso está el badge editable.
- **NO SE DEBEN** agregar Resuelto y Cancelado como nodos: son cierre, no pasos de trabajo.
- **NO SE DEBE** recortar los cinco pasos por tipo de requisito.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `steps` | `{ key, label }[]` | — | Etapas, en orden |
| `currentKey` | `string` | — | Etapa actual |
| `interactive` | `boolean` | `false` | Si los nodos avanzan el estado |
| `onStepChange` | `(key) => void` | — | Callback de avance |

## Componentes y patterns relacionados

- [Badge](./badge.md) — el badge editable **es** el control de cambio de estado; documenta los siete.
- [ViewHeader](./view-header.md) — donde vive ese badge, en la variant `detail`.
- [Button](./button.md) — variant `flow` para el atajo al paso siguiente.

## Historial

- **1.1.0** (2026-09-02) — Confirmado el reparto de responsabilidades: el stepper muestra los
  **cinco** pasos de trabajo y **no** es el control de cambio de estado; los siete estados los
  ofrece el badge editable de la cabecera, y el cierre vive en la card de resolución. Se agrega el
  atajo al paso siguiente y la regla de que el stepper informativo no es focusable. Deja de estar
  `parcial`: el manual y la implementación coinciden (MINOR).
- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: tres estados de nodo
  (recorrido en verde agua pleno, actual en anillo, pendiente en borde claro).
