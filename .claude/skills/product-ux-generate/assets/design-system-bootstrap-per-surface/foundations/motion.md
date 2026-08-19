---
foundation: motion
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
---

# Motion

> **Placeholder inicial** — Definir según necesidades del producto.

## Propósito

Define durations, easings y principios de motion. Las animaciones comunican
cambios de estado, jerarquía y feedback sin distraer.

## Durations (placeholder)

| Token | Valor | Uso |
|-------|-------|-----|
| `motion.instant` | 0ms | Sin animación (e.g., focus) |
| `motion.fast` | 150ms | Micro-interacciones (hover, focus) |
| `motion.base` | 250ms | Transiciones default (fade, slide cortos) |
| `motion.slow` | 400ms | Transiciones complejas (modal, page) |
| `motion.lazy` | 600ms+ | Pesadas (preferir evitar) |

## Easings

| Token | Curva | Uso |
|-------|-------|-----|
| `ease.in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default — natural |
| `ease.out` | `cubic-bezier(0, 0, 0.2, 1)` | Entrada (algo aparece) |
| `ease.in` | `cubic-bezier(0.4, 0, 1, 1)` | Salida (algo desaparece) |
| `ease.bounce` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Énfasis (usar con cuidado) |

## Principios

1. **Funcional, no decorativo** — comunica cambios, no impresiona.
2. **Direccional** — entrada de derecha = navegación adelante.
3. **Predecible** — el mismo trigger siempre produce la misma animación.
4. **Interruptible** — el usuario puede cancelar una animación en curso.

## Guidelines

**Do:**
- Animar fades, slides cortos, scale sutil (0.95 → 1).
- Loading spinners para acciones >300ms.
- Respetar `prefers-reduced-motion` del usuario.

**Don't:**
- Animaciones >600ms sin razón fuerte (bloquean al usuario).
- Parallax o efectos decorativos en flows críticos.
- Sin alternativa para `prefers-reduced-motion: reduce`.

## Accesibilidad

- Detectar `prefers-reduced-motion: reduce` y desactivar animaciones no críticas.
- No flashing >3 veces/segundo (evita seizures).
- Animaciones largas (>5s) deben ser pausables.

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial.
