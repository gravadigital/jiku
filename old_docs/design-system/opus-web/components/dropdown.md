---
component: Dropdown
version: 1.0.0
last_updated: 2026-08-18
status: relevado-desde-código
surface: opus-web
origin: opus-web/src/shared/components/ui/Dropdown/
---

# Dropdown (opus-web)

> **Relevado desde el código existente.**

## Propósito

Menú de selección desplegable, renderizado **en un portal**. **4 usos**: los dropdowns de estado y
prioridad del tablero [fuente: código-existente].

## Anatomía

Trigger + panel de opciones. La composición es por render props: `renderTrigger` y `renderItem`.

## Variants

| Prop | Valores |
|---|---|
| `align` | `left`, `right` |

## Sizes

Sin sizes declarados.

## States

| Estado | Implementado |
|---|---|
| cerrado | ✅ |
| abierto | ✅ |
| opción seleccionada | ⚠️ Ver Accesibilidad |

## Spacing & sizing rules

Se renderiza en un portal, con `--z-dropdown` (100).

## Accesibilidad

🔴 **Problema registrado:** el relevamiento detecta `aria-selected="false"` **fijo en todas las
opciones**, incluida la seleccionada [fuente: código-existente]. Un lector de pantalla nunca
anuncia cuál está activa.

**Sin verificar:** navegación por teclado (flechas, Escape, Home/End) y devolución del foco al
trigger al cerrar.

> **Contraste con los dropdowns inline:** `CreateRequirementModal` **no usa este componente**: tiene
> tres paneles posicionados a mano, cuyas opciones son elementos clickeables sin `role` ni
> `tabIndex`. Este `Dropdown` con portal es la implementación correcta de las dos, y conviene
> converger hacia él.

## Guidelines de contenido

*(No relevable desde el código.)*

## Do's & don'ts

*(Vacío a propósito.)*

## API

```tsx
<Dropdown align="left" | "right"
          renderTrigger={fn}
          renderItem={fn} />
```

## Componentes y patterns relacionados

- Los paneles inline de `CreateRequirementModal` — **implementación paralela** del mismo problema,
  sin portal y sin accesibilidad
- `UserSelector` — otro panel posicionado a mano

## Historial

- **1.0.0** (2026-08-18) — Relevado desde el código existente.
