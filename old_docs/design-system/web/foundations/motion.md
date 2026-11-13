---
foundation: motion
version: 2.0.0
last_updated: 2026-09-02
status: normativo
origin: Manual de marca Jiku v1.0 (septiembre 2026) — «Geometría del sistema»
---

# Motion (web)

> **Normativo en lo que el manual define.** El manual fija las tres duraciones y la curva; los
> principios de aplicación se derivan de la personalidad de marca —**preciso, sereno, sin
> adorno**— y están marcados como tales.

## Propósito

Define duraciones y curvas de transición. El motion comunica cambio de estado y feedback;
**no decora**.

## Duraciones

Tres duraciones, todas con curva `ease`.

| Token DS | Valor | Uso |
|---|---|---|
| `motion.fast` | **150 ms** `ease` | Micro-interacciones: hover, foco, cambio de color |
| `motion.base` | **200 ms** `ease` | Transición default: apertura de dropdown, cambio de tab |
| `motion.slow` | **300 ms** `ease` | Transiciones de mayor recorrido: acordeón, panel lateral |

**No hay una cuarta duración.** Nada en el producto se anima por más de 300 ms.

## Principios de aplicación

Derivados de la personalidad de marca (preciso, sereno, técnico, sin adorno):

- **El movimiento explica un cambio de estado**, no llama la atención sobre sí mismo.
- **Se anima la propiedad más barata que comunique el cambio**: color, opacidad y transformación.
- **Un solo elemento se mueve por vez** en una interacción.
- **Sin rebotes, sin elásticos, sin animación de entrada en la carga de página.**

## Qué se anima

| Elemento | Propiedad | Duración |
|---|---|---|
| Hover de botón, chip, fila de tabla | `background-color`, `border-color` | `motion.fast` |
| Anillo de foco | `box-shadow` | `motion.fast` |
| Dropdown y multiselección | `opacity`, `transform` | `motion.base` |
| Tab y toggle segmentado | `background-color` | `motion.base` |
| Acordeón de etapa | `height`, `opacity` | `motion.slow` |
| Spinner de carga | `rotate`, en bucle | continuo |

## Guidelines

**Do:**

- Usar `motion.fast` para todo lo que responde al puntero.
- Animar `opacity` y `transform`, que no fuerzan reflow.
- Dejar el spinner como única animación en bucle del sistema.

**Don't:**

- **NO SE DEBE** animar por más de 300 ms.
- **NO SE DEBE** usar curvas con rebote ni sobreimpulso.
- **NO SE DEBE** animar la entrada de una vista completa.
- **NO SE DEBE** usar movimiento como único indicador de un cambio de estado.

## Accesibilidad

- **`prefers-reduced-motion: reduce` DEBE respetarse:** las transiciones de posición y tamaño pasan
  a un cambio instantáneo, y el spinner se reemplaza por un indicador estático.

```scss
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

- Ninguna animación **DEBE** parpadear más de 3 veces por segundo.
- El movimiento **NO DEBE** ser el único portador de información.

## Ejemplos

- [Button](../components/button.md) — hover con `motion.fast`.
- [Accordion](../components/accordion.md) — apertura con `motion.slow`.
- [Loader](../components/loader.md) — única animación en bucle.

## Historial

- 2026-09-02 v2.0.0 — Duraciones y curva fijadas por la «Geometría del sistema» del Manual de marca
  Jiku v1.0 (150/200/300 ms `ease`); se eliminan `motion.instant` y `motion.lazy` del placeholder.
  Principios derivados de la personalidad de marca y regla de `prefers-reduced-motion` (MAJOR).
- 2026-08-18 v0.1.0 — Placeholder inicial.
