---
component: Button
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
surface: web
origin: web/src/shared/components/ui/Button/Button.tsx
---

# Button (web)

> **Relevado desde el código existente.** Las secciones que el código no puede responder —do/don't,
> rationale de accesibilidad— quedan **explícitamente vacías**, no inventadas.

## Propósito

Disparador de acciones. **29 usos** en la superficie: es el componente más usado del producto
[fuente: código-existente].

## Anatomía

Label de texto, con estado de carga que reemplaza el contenido. Sin slot de ícono propio: los
botones con ícono lo componen aparte.

## Variants

| Variant | Uso observado | Color de fondo |
|---|---|---|
| `primary` | Acción principal de la pantalla | `--color-button` (`#DA2C6A`) |
| `secondary` | Acción alternativa, cancelar | `--color-general-disabled` (`#D9D9D9`) |

**No hay variant `danger`.** El borrado usa `--color-button-delete` (`#FB033F`) aplicado por el
módulo del consumidor, no por el componente.

## Sizes

| Size | Uso observado |
|---|---|
| `normal` | Default |
| `small` | Acciones dentro de tablas y cards |

## States

| Estado | Implementado | Cómo |
|---|---|---|
| default | ✅ | — |
| hover | ✅ | Definido en `_mixins.scss` |
| focus | ✅ | Outline con `--color-highlighted` (`rgb(54, 0, 136)`) |
| `disabled` | ✅ | Prop booleana |
| `loading` | ✅ | Prop booleana |
| active/pressed | ⚠️ | No relevado explícitamente |

## Spacing & sizing rules

Encapsulado en el mixin de botones de `_mixins.scss`. Radio: `--radius-buttons` (0.5rem).

*(Los valores exactos de padding no fueron relevados al nivel de este documento.)*

## Accesibilidad

- Es un `<button>` nativo: rol, foco y activación por teclado vienen dados
  [fuente: código-existente].
- El foco usa `--color-highlighted`, un violeta oscuro sobre el fondo del botón.

**Sin verificar:** el contraste de `primary` (`#DA2C6A`) y de `secondary` (`#D9D9D9`) contra su
texto no fue medido en el relevamiento. `secondary` sobre `#D9D9D9` es el candidato más probable a
no alcanzar AA.

**Sin registro:** el rationale de las decisiones de accesibilidad del componente. El código no lo
documenta.

## Guidelines de contenido

*(No relevable desde el código. Los 29 usos tienen labels variados y no hay convención documentada
de cómo redactarlos.)*

## Do's & don'ts

*(Vacío a propósito. El código muestra qué se hizo, no qué debe hacerse. Se completa cuando el
equipo defina las reglas.)*

## API

```tsx
<Button
  variant="primary" | "secondary"
  size="normal" | "small"
  loading={boolean}
  disabled={boolean}
  onClick={handler}
>
  Label
</Button>
```

## Componentes y patterns relacionados

- `AddButton` — botón de alta especializado (1 uso)
- `AttachFileButton` — botón de adjuntar (1 uso)
- `ToggleGroup` — selección entre opciones excluyentes (3 usos)

## Historial

- **1.0.0** (2026-08-18) — Relevado desde el código existente durante la importación del producto.
