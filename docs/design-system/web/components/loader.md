---
component: Loader
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
surface: web
origin: web/src/shared/components/ui/Loader/Loader.tsx
---

# Loader (web)

> **Relevado desde el código existente.**

## Propósito

Indicador de carga con etiqueta. **25 usos**, el segundo componente más usado
[fuente: código-existente].

## Anatomía

Indicador visual + `label` de texto.

## Variants

Sin variants. La única variación es el contenido del `label`, que **toma 12 valores distintos** en
la superficie.

> ⚠️ **Los 12 labels distintos son un hallazgo, no una feature.** Incluyen los typos
> **"Cagando..."** y **"Cargando  ..."** (doble espacio) [fuente: código-existente]. Un componente
> con un mensaje por consumidor produce inconsistencia por construcción.

## Sizes

Sin sizes declarados.

## States

Estado único: visible mientras dura la carga.

## Spacing & sizing rules

*(No relevado a este nivel.)*

## Accesibilidad

**Sin verificar:** el relevamiento no registra `aria-busy`, `aria-live` ni `role="status"`. Un
loader sin región viva **no anuncia el cambio a un lector de pantalla**.

## Guidelines de contenido

*(Sin convención documentada — de ahí los 12 labels distintos.)*

## Do's & don'ts

*(Vacío a propósito.)*

## API

```tsx
<Loader label="Cargando..." />
```

## Componentes y patterns relacionados

- `Spinner` (5 usos) — **hay dos componentes de carga conviviendo**, sin regla documentada de
  cuándo usar cada uno
- `AttachmentSkeleton` — skeleton específico de adjuntos

## Historial

- **1.0.0** (2026-08-18) — Relevado desde el código existente.
