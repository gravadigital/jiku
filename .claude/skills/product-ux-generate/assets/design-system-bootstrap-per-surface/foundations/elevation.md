---
foundation: elevation
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
---

# Elevation

> **Placeholder inicial** — Definir según diseño del producto.

## Propósito

Define la jerarquía visual de capas (z-index) y sombras que comunican
profundidad. Una elevación más alta = más cerca del usuario.

## Niveles (placeholder)

| Token | z-index | Sombra | Uso |
|-------|---------|--------|-----|
| `elevation.0` | 0 | none | Base, fondo |
| `elevation.1` | 10 | `0 1px 2px rgba(0,0,0,0.05)` | Cards reposadas |
| `elevation.2` | 20 | `0 4px 6px -1px rgba(0,0,0,0.1)` | Cards hover, dropdowns |
| `elevation.3` | 30 | `0 10px 15px -3px rgba(0,0,0,0.1)` | Popovers |
| `elevation.4` | 40 | `0 20px 25px -5px rgba(0,0,0,0.1)` | Modales |
| `elevation.5` | 50 | `0 25px 50px -12px rgba(0,0,0,0.25)` | Notificaciones / toasts |

## Guidelines

**Do:**
- Mantener la jerarquía: modal siempre encima de popover, etc.
- Usar sombras sutiles en mid-fi; dramáticas solo si el producto lo pide.

**Don't:**
- No apilar más de 3 niveles de elevación visibles a la vez (caos visual).
- No usar elevation como decoración (solo para comunicar profundidad).

## Accesibilidad

- Elementos elevados (modales) deben atrapar foco.
- Backdrop (fondo oscurecido) debe tener contraste ≥3:1 contra el fondo.
- ESC debe cerrar elementos en `elevation.4+`.

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial.
