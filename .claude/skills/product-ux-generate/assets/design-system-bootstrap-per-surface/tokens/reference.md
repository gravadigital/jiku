---
tokens: reference
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
---

# Tokens — Reference (primitivos)

> **Placeholder inicial** — Tier 1: tokens primitivos. NO se consumen
> directamente por componentes; siempre vía tokens semánticos.

## Propósito

Tier 1 de la jerarquía de tokens (Nathan Curtis):

```
Reference (primitivos)  ←  ESTE NIVEL
        ↓
Semantic (alias)
        ↓
Component (por componente)
```

Los tokens reference son **el inventario crudo** de valores: paleta de
colores raw, escala de espaciado raw, type scale raw.

## Color (placeholder)

```
color.blue.50  : #eff6ff
color.blue.100 : #dbeafe
color.blue.500 : #2563eb
color.blue.900 : #1e3a8a

color.gray.0   : #ffffff
color.gray.50  : #f8fafc
color.gray.100 : #f1f5f9
color.gray.500 : #64748b
color.gray.900 : #0f172a

color.green.500: #10b981
color.amber.500: #f59e0b
color.red.500  : #ef4444
```

## Spacing (placeholder)

```
space.0  : 0px
space.1  : 4px
space.2  : 8px
space.3  : 12px
space.4  : 16px
space.5  : 24px
space.6  : 32px
space.8  : 48px
space.10 : 64px
```

## Typography (placeholder)

```
font.size.xs  : 12px
font.size.sm  : 14px
font.size.md  : 16px
font.size.lg  : 18px
font.size.xl  : 24px
font.size.2xl : 32px
font.size.3xl : 48px

font.weight.regular : 400
font.weight.medium  : 500
font.weight.semibold: 600
font.weight.bold    : 700

font.lineHeight.tight : 1.2
font.lineHeight.base  : 1.5
font.lineHeight.loose : 1.75
```

## Radius (placeholder)

```
radius.none : 0px
radius.sm   : 4px
radius.md   : 8px
radius.lg   : 12px
radius.full : 9999px
```

## Reglas

- **No consumir desde componentes directamente.** Usar siempre via tokens semánticos.
- **No agregar valores arbitrarios** sin justificación.
- **Cambios aquí afectan TODO** — bumpear MAJOR si se modifica un valor existente.

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial.
