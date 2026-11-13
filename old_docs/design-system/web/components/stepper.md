---
component: Stepper
version: 1.2.0
last_updated: 2026-09-04
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

1. **Nodos** — circulares de **34 px**, uno por etapa, con `✓` (recorrida), `×` (omitida) o **su
   número** (actual y pendiente).
2. **Labels** — nombre de la etapa, con el término de dominio exacto.
3. **Conectores** — línea de **2 px** entre nodos, centrada en el nodo, en borde claro.

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
| **Recorrido** | Etapa completada | **Verde agua pleno** + `✓` en azul oscuro — `stepper.active.bg` |
| **Omitida** | Recorrida sin actividad real (caso «cancelado») | Mismo fondo que recorrido, glifo `×` en vez de `✓` |
| **Actual** | Etapa en curso | **Superficie limpia + borde de 2 px verde agua + anillo exterior de 4 px**, con **su número** en 13/700 — `stepper.current.ring` |
| **Pendiente** | Etapa por delante | **Superficie limpia + borde de 1,5 px claro** + número, texto `text.disabled` — `stepper.pending.bg` |

> «Lo recorrido va en verde agua pleno; la etapa actual, en anillo; lo pendiente, en borde claro.»
> Es el único lugar del sistema donde el verde agua se usa **pleno como fondo**, y funciona porque
> el `✓` va en azul oscuro (9.8:1).

### El paso actual muestra su número

El nodo actual **lleva su número**, igual que los pendientes, en **13 px / peso 700**. Antes
quedaba vacío y el círculo del actual se leía como un hueco en la secuencia, no como el paso donde
está el requisito.

Lo que lo distingue no es la ausencia de contenido sino **el anillo**: borde de 2 px en verde agua
**más** un anillo exterior de 4 px (`stepper.current.ring`). La v1.1.0 lo especificaba como un
borde de 3 px sin anillo, y a ese grosor el paso actual no se separaba de los pendientes.

> **El anillo no es foco de teclado.** Usa `stepper.current.ring`, no `focus.ring`: es **estado**,
> y el stepper informativo ni siquiera es focusable.

### El pendiente es superficie limpia, no tinte

El nodo pendiente pasó de **relleno de tinte** a **superficie limpia (`bg.surface`) con borde de
1,5 px**. Con relleno, los pasos pendientes competían visualmente con el recorrido: cinco nodos
todos con fondo, y el verde agua pleno perdía su condición de único destacado.

## Spacing & sizing rules

- **Nodo:** circular de **34 px** de diámetro (antes 28), radio pill.
- **Conector:** **2 px** `#DFE1E7`, alineado al **centro del nodo** — a media altura de su diámetro
  (34/2 = 17 px). Con el nodo de 28 px el conector quedaba calculado en 14 px y, al crecer el nodo,
  por encima de su centro.
- **Gap nodo–label:** `space.2` (8 px).
- **Borde del actual:** 2 px verde agua, **más anillo exterior de 4 px** al 20 % de opacidad.
- **Borde del pendiente:** 1,5 px `border.default`.
- **Número del actual:** 13 px / peso 700. **Número del pendiente:** 14 px / peso 600.
- **La lista ocupa el ancho completo** (`width: 100%`) y los cinco pasos se reparten el espacio en
  partes iguales. Antes encogía al contenido —259 px en el detalle de requisito— y las etiquetas
  quedaban pegadas entre sí, sin espacio para el conector ni para leerse por separado.

## Accesibilidad

- **DEBE** ser una lista ordenada (`<ol>`), que es lo que un recorrido es.
- Cada nodo **DEBE** anunciar su estado en texto: «Análisis, completada», «Desarrollo, etapa
  actual», «Revisión, pendiente». **El `✓` y el anillo son visuales y no alcanzan.**
- La etapa actual **DEBE** llevar `aria-current="step"`.
- Si el stepper permite avanzar, cada nodo accionable es un `<button>` con `focus.ring`; si es sólo
  informativo, **NO DEBE** ser focusable.
- El estado **NO SE COMUNICA sólo con color:** `✓` / `×` / número / anillo distinguen por forma. El
  nodo actual y el pendiente comparten glifo (su número) y se separan por el anillo y el grosor de
  borde, además del texto accesible.
- La **etapa omitida** lleva `×` y se anuncia «omitida», no «completada»: mismo fondo verde agua,
  pero el glifo no sugiere que se completó.
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
- Distinguir el actual con anillo, no con otro color, y mostrarle su número.
- Dejar el pendiente en superficie limpia con borde.
- Anunciar el estado de cada etapa en texto.
- Dar a la lista el ancho completo para que los labels no se peguen.

**Don't:**

- **NO SE DEBE** usar un color de sistema en los nodos: el recorrido no es un estado de sistema.
- **NO SE DEBE** rellenar el nodo actual: la superficie limpia con anillo es lo que lo distingue.
- **NO SE DEBE** dejar el nodo actual sin su número: vacío se lee como un hueco.
- **NO SE DEBE** rellenar de tinte el nodo pendiente: compite con el verde agua pleno del
  recorrido.
- **NO SE DEBE** usar `focus.ring` para el anillo del actual: es estado, no foco.
- **NO SE DEBE** convertir el stepper en el selector de estado: para eso está el badge editable.
- **NO SE DEBEN** agregar Resuelto y Cancelado como nodos: son cierre, no pasos de trabajo.
- **NO SE DEBE** recortar los cinco pasos por tipo de requisito.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `steps` | `{ key, label }[]` | — | Etapas, en orden |
| `currentKey` | `string` | — | Etapa actual |
| `doneKeys` | `string[]` | — | Marca pasos como recorridos aun cuando `currentKey` no es uno de los `steps` (un estado terminal como `resuelto`/`cancelado`, que no es nodo pero implica el recorrido completo) |
| `skippedKeys` | `string[]` | — | De los recorridos, cuáles no tuvieron actividad real: se dibujan con `×` en vez de `✓` (caso «cancelado», S-050) |
| `interactive` | `boolean` | `false` | Si los nodos avanzan el estado. En `false` no son focusables |
| `onStepChange` | `(key) => void` | — | Callback de avance |

## Componentes y patterns relacionados

- [Badge](./badge.md) — el badge editable **es** el control de cambio de estado; documenta los siete.
- [ViewHeader](./view-header.md) — donde vive ese badge, en la variant `detail`.
- [Button](./button.md) — variant `flow` para el atajo al paso siguiente.

## Historial

- **1.2.0** (2026-09-04) — Se corrige la especificación visual del nodo contra el código, sin
  cambiar la API. El **nodo pasa de 28 px a 34 px**. El **paso actual muestra su número** (antes
  quedaba vacío y el círculo se leía como un hueco) en 13 px / peso 700, y se distingue con **borde
  de 2 px más anillo exterior de 4 px** en lugar del borde de 3 px sin anillo, que a ese grosor no
  lo separaba de los pendientes. El **pendiente pasa de relleno de tinte a superficie limpia con
  borde de 1,5 px**, porque con relleno competía visualmente con el verde agua pleno del recorrido.
  El **conector pasa a 2 px y se centra en el nodo** (a media altura de sus 34 px; antes estaba
  calculado para el nodo de 28 y quedaba por encima del centro). La **lista ocupa el ancho
  completo**: antes encogía al contenido —259 px en el detalle de requisito— y las etiquetas
  quedaban pegadas entre sí. Se documentan `doneKeys`, `skippedKeys` y el estado de nodo
  **omitida** (`×`), ya presentes en el componente desde S-050 (MINOR: aditivo en API, sin ruptura
  de contrato).
- **1.1.0** (2026-09-02) — Confirmado el reparto de responsabilidades: el stepper muestra los
  **cinco** pasos de trabajo y **no** es el control de cambio de estado; los siete estados los
  ofrece el badge editable de la cabecera, y el cierre vive en la card de resolución. Se agrega el
  atajo al paso siguiente y la regla de que el stepper informativo no es focusable. Deja de estar
  `parcial`: el manual y la implementación coinciden (MINOR).
- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: tres estados de nodo
  (recorrido en verde agua pleno, actual en anillo, pendiente en borde claro).
