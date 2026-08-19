---
component: InputSelect
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
surface: web
origin: web/src/shared/components/ui/InputSelect/InputSelect.tsx
---

# InputSelect (web)

> **Relevado desde el código existente.**

## Propósito

Selector de una opción dentro de un formulario. **18 usos** [fuente: código-existente].

## Anatomía

Label + control de selección + mensaje de error opcional.

## Variants

Sin variants de presentación. La única prop de variación es `error` (booleana).

## Sizes

Sin sizes declarados.

## States

| Estado | Implementado |
|---|---|
| default | ✅ |
| focus | ✅ — outline con `--color-highlighted` |
| `error` | ✅ — borde con `--color-button-delete` |
| disabled | ⚠️ No relevado |

## Spacing & sizing rules

Encapsulado en el mixin de inputs de `_mixins.scss`. Radio: `--radius-items` (0.5rem).

## Accesibilidad

**Sin verificar:** el relevamiento no registra la asociación label↔control ni el anuncio del
mensaje de error.

## Guidelines de contenido

*(No relevable desde el código.)*

## Do's & don'ts

*(Vacío a propósito.)*

## API

```tsx
<InputSelect error={boolean} ... />
```

## Componentes y patterns relacionados

- `Select` (15 usos) — **otro selector conviviendo**
- `InputMultipleSelect` (1 uso)
- `react-select` — usado **directamente** en 5 pantallas, con su objeto `selectStyles`
  **duplicado literalmente en los 5 archivos** [fuente: código-existente]

> ⚠️ **Hay tres formas de hacer un select en esta superficie**: `InputSelect`, `Select` y
> `react-select` directo. Es la duplicación de componentes más significativa del producto.

## Historial

- **1.0.0** (2026-08-18) — Relevado desde el código existente.
