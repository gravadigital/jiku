---
tokens: component
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
---

# Tokens — Component-level

> **Placeholder inicial** — Tier 3: tokens por componente. Mapean roles
> semánticos a propiedades específicas de cada componente.

## Propósito

Tier 3 de la jerarquía de tokens. Cada token nombra **una propiedad de un
componente específico**. Permite ajustar un componente sin afectar otros que
comparten el mismo semántico.

Formato: `{componente}.{variant}.{propiedad}.{estado}`

## Button (placeholder)

```
button.primary.bg          : bg.action.primary
button.primary.bg.hover    : bg.action.primary.hover
button.primary.bg.active   : color.blue.700
button.primary.bg.disabled : color.gray.300
button.primary.text        : text.inverse
button.primary.text.disabled : text.secondary
button.primary.border      : transparent

button.secondary.bg        : transparent
button.secondary.bg.hover  : color.blue.50
button.secondary.text      : text.action.primary
button.secondary.border    : border.focus

button.destructive.bg      : bg.error
button.destructive.text    : text.inverse
```

## TextInput (placeholder)

```
input.bg           : bg.surface
input.text         : text.primary
input.placeholder  : text.secondary
input.border       : border.default
input.border.focus : border.focus
input.border.error : border.error
input.height.md    : 44px
```

## Card (placeholder)

```
card.bg            : bg.surface
card.border        : border.default
card.padding       : space.padding.default
card.radius        : radius.md
card.elevation     : elevation.1
```

## Reglas

- **Cada componente declara sus tokens al crearse** (via `/product-design-system-update`).
- **Componentes consumen estos tokens** en su implementación de código.
- **Cambiar valor de un component token** = PATCH si es ajuste fino;
  MINOR si introduce nuevo subtoken.
- **Renombrar/remover un component token** = MAJOR.

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial.
