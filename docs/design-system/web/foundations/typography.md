---
foundation: typography
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
origin: relevamiento de código — web/src/styles/_variables.scss
---

# Tipografía (web)

> **Sembrado desde el código existente.**

## Familia

| Token | Valor | Origen |
|---|---|---|
| `font.family.primary` | **Archivo** (Google Fonts), expuesta como `--font-primary` | `web/src/app/layout.tsx:6-10` |

Pesos cargados: 100 / 400 / 500 / 600 / 700. Se sirve vía `next/font/google`.

## Escala

| Token DS | Variable | Tamaño | Uso observado |
|---|---|---|---|
| `font.size.xs` | `--font-size-xs` | 0.625rem (10px) | Tags y badges (`tag-base`) |
| `font.size.sm` | `--font-size-sm` | 0.75rem (12px) | Labels (`label-text`), `p` global |
| `font.size.base` | `--font-size-base` | 0.875rem (14px) | Texto de inputs y botones |
| `font.size.md` | `--font-size-md` | 1rem (16px) | `h2`, label de `PageLayout` |
| `font.size.lg` | `--font-size-lg` | 1.25rem (20px) | `span` global |
| `font.size.xl` | `--font-size-xl` | 1.5rem (24px) | (sin uso observado) |
| `font.size.2xl` | `--font-size-2xl` | 2rem (32px) | `h1` |

**Pesos:** `--font-weight-normal` 400 · `-medium` 500 · `-semibold` 600 · `-bold` 700 ·
`-extrabold` 800

**Line heights:** `--line-height-tight` 1.25 · `-normal` 1.5 · `-relaxed` 1.75

## Conflicto: los estilos de elemento compiten con la escala

**Es el problema tipográfico principal de esta superficie.**

`globals.scss:189-207` define estilos de elemento que no usan los tokens:

```scss
h1   { font-size: 2rem;    line-height: 2rem;    }
h2   { font-size: 1rem;    line-height: 1rem;    }
p    { font-size: 0.75rem; line-height: 0.75rem; }
span { font-size: 1.25rem; }
```

Dos consecuencias observables:

1. **Los `line-height` iguales al `font-size` hacen que el texto de más de una línea se toque.**
   Un párrafo de dos renglones queda sin interlineado.
2. **`span` a 20px es más grande que el `p` que lo contiene** (12px). Esto explica por qué muchos
   módulos redefinen el tamaño de sus `span`: están corrigiendo un default que actúa al revés de
   lo esperado.

## Reglas de implementación

- Todo tamaño de texto **DEBE** usar un token `--font-size-*`. **NO SE DEBEN** hardcodear valores.
- **NO SE DEBE** confiar en los estilos de elemento de `globals.scss`: un componente nuevo declara
  su tamaño y su `line-height` explícitamente.
- Un `line-height` **NO DEBE** ser igual al `font-size`. Usar `--line-height-tight` (1.25) como
  mínimo.
- **NO SE DEBE** estilar `span` globalmente. Si un componente necesita un tamaño, lo declara en su
  módulo.

## Gaps registrados

- Estilos de elemento en `globals.scss` compitiendo con la escala de tokens
- `line-height` igual al `font-size` en `h1`, `h2` y `p`
- `span` global a 20px, mayor que el `p` que lo contiene
- `--font-size-xl` declarado sin uso
