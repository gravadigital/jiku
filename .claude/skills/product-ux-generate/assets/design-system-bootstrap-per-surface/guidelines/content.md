---
guideline: content
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
---

# Content

> **Placeholder inicial** — Reemplazar con guías reales del producto.

## Propósito

Reglas transversales de microcopy. Complementa `foundations/voice-tone.md`
con tácticas concretas por contexto.

## Buttons y CTAs

- Verb-first: "Guardar", "Enviar", "Cancelar".
- 1-3 palabras ideal, máximo 5.
- Sentence case ("Guardar pedido"), no Title Case ("Guardar Pedido").
- ❌ "Click aquí" (no informa qué hace).
- ❌ "Submit" (técnico, no humano).

## Labels de inputs

- Cortos, descriptivos: "Email", no "Tu dirección de correo electrónico".
- Indicador de opcional/required explícito (preferir marcar lo opcional).
- Helper text bajo el input para contexto extra.

## Mensajes de error

- Empático, no culpabilizante.
- ✓ "El email no es válido. Probá con otro."
- ✗ "Error: invalid email format."
- Accionable: decir qué hacer para resolver.

## Mensajes de éxito

- Confirmatorios, no celebratorios excesivos.
- ✓ "Pedido guardado."
- ✗ "¡¡¡Felicitaciones!!! Tu pedido fue guardado con éxito 🎉"

## Empty states

- 3 partes: ilustración o icono + heading + paragraph + CTA.
- Heading: indica el estado ("Sin pedidos aún").
- Paragraph: explica + sugiere acción.
- CTA: dispara la acción sugerida.

## Loading

- ≤300ms: sin loader (usuario no percibe).
- 300ms - 1s: loader inline + label opcional.
- >1s: loader con mensaje contextual ("Cargando pedidos…").
- Skeletons cuando se conoce el layout final.

## Notificaciones

- Asunto en 1 línea, ≤50 chars.
- Body en 1-3 líneas.
- CTA único si requiere acción.

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial.
