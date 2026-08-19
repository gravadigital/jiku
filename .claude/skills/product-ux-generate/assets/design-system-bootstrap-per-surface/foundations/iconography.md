---
foundation: iconography
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
---

# Iconografía

> **Placeholder inicial** — Definir set de íconos oficial y reglas de uso.

## Propósito

Define el set de íconos del producto, sus dimensiones, estilo y reglas de uso.

## Set base (placeholder)

**Recomendación:** usar un set open-source para acelerar (no custom desde v1):
- [Lucide](https://lucide.dev/) — outlined, hand-drawn feel
- [Heroicons](https://heroicons.com/) — outlined / solid (Tailwind ecosystem)
- [Material Symbols](https://fonts.google.com/icons) — outlined / filled / round

Una vez elegido, listar acá los íconos efectivamente usados.

## Sizes

| Token | Tamaño | Uso |
|-------|--------|-----|
| `icon.sm` | 16px | Inline en texto |
| `icon.md` | 20px | Default (botones, inputs) |
| `icon.lg` | 24px | Headers, navigation |
| `icon.xl` | 32px | Empty states, splash |

## Naming convention

- Singular, kebab-case: `search`, `arrow-right`, `user`.
- Sin prefijos `icon-` (redundante).
- Acción + dirección cuando aplica: `arrow-down`, `chevron-right`.

## Guidelines

**Do:**
- Iconos solo para refuerzo semántico, NO decoración.
- Combinar icono + label cuando hay duda de significado.
- Usar `aria-label` cuando el ícono es la única indicación de acción.

**Don't:**
- No mezclar estilos (outlined + filled) en una misma pantalla.
- No usar iconos en lugar de texto crítico (CTAs, errores).
- No reescalar manualmente; usar los tokens de size.

## Accesibilidad

- Iconos puramente decorativos: `aria-hidden="true"`.
- Iconos con función: `aria-label` o `<title>` interno en SVG.
- Contraste contra fondo: **≥3:1**.

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial.
