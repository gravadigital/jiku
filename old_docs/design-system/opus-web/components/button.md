---
component: Button
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
surface: opus-web
origin: opus-web/src/shared/components/ui/Button/
---

# Button (opus-web)

> **Relevado desde el código existente.** Las secciones que el código no puede responder quedan
> explícitamente vacías, no inventadas.

## Propósito

Disparador de acciones del portal. **3 usos vivos** (más 3 en componentes muertos)
[fuente: código-existente].

## Anatomía

Label de texto, con estado de carga. Las variantes se expresan con **atributos `data-*`**, no con
clases: `<button data-variant="primary" data-size="md">`.

## Variants

| Variant | Uso observado | Color |
|---|---|---|
| `primary` | Acción principal | `--color-primary` (`#2563eb`) |
| `secondary` | Acción alternativa | — |
| `danger` | Acción destructiva | `--color-error` (`#dc2626`) |

> A diferencia de `web`, esta superficie **sí tiene variant `danger`** en el componente, en vez de
> aplicarlo desde el consumidor.

## Sizes

`sm` · `md` · `lg`

## States

| Estado | Implementado |
|---|---|
| default | ✅ |
| hover | ✅ — `--color-primary-hover` (`#1d4ed8`) en `primary` |
| focus | ✅ — focus ring con `--color-primary` |
| `loading` | ✅ — prop booleana |
| disabled | ⚠️ No relevado explícitamente |

## Spacing & sizing rules

Radios de `--radius-*`. Los módulos del tablero usan **px literales fuera de la escala**
(`padding: 14px 20px`), que es deuda registrada.

## Accesibilidad

- Es un `<button>` nativo [fuente: código-existente].

**Sin verificar:** contraste de las tres variants. `#2563eb` sobre blanco es un azul estándar con
buen contraste esperado, pero no fue medido.

**Sin registro:** el rationale de las decisiones de accesibilidad.

## Guidelines de contenido

*(No relevable desde el código.)*

## Do's & don'ts

*(Vacío a propósito.)*

## API

```tsx
<Button data-variant="primary" | "secondary" | "danger"
        data-size="sm" | "md" | "lg"
        loading={boolean} />
```

## Componentes y patterns relacionados

- `Dropdown` (4 usos) — el otro control interactivo compartido
- `Badge` — **código muerto**, pero define 5 variants (`default`, `success`, `warning`, `error`,
  `info`) que serían útiles

## Historial

- **1.0.0** (2026-08-18) — Relevado desde el código existente.
