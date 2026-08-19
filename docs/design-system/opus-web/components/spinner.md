---
component: Spinner
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
surface: opus-web
origin: opus-web/src/shared/components/ui/Spinner/
---

# Spinner (opus-web)

> **Relevado desde el código existente.**

## Propósito

Indicador de carga. **7 usos**, el componente compartido más usado de la superficie
[fuente: código-existente].

## Anatomía

Indicador visual sin label. A diferencia del `Loader` de `web`, **no lleva texto**.

## Variants

Sin variants. Variación por tamaño.

## Sizes

`sm` · `md` · `lg`, expresados con atributo `data-size`.

## States

Estado único: visible mientras dura la carga.

## Spacing & sizing rules

*(No relevado a este nivel.)*

## Accesibilidad

**Sin verificar:** el relevamiento no registra `aria-busy`, `aria-live` ni `role="status"`. Un
spinner sin texto **y** sin región viva no comunica nada a un lector de pantalla.

Es más relevante acá que en `web`, porque el `Loader` de `web` al menos tiene label visible.

## Guidelines de contenido

No aplica: el componente no tiene texto.

## Do's & don'ts

*(Vacío a propósito.)*

## API

```tsx
<Spinner data-size="sm" | "md" | "lg" />
```

## Componentes y patterns relacionados

- `AttachmentSkeleton` (3 usos) — skeleton específico de adjuntos, con variante `isImage`

## Historial

- **1.0.0** (2026-08-18) — Relevado desde el código existente.
