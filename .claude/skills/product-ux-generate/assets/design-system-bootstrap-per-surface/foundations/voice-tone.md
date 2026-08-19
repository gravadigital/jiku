---
foundation: voice-tone
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
---

# Voice & Tone

> **Placeholder inicial** — Definir según identidad de marca y audiencia del producto.

## Propósito

Define cómo "habla" el producto al usuario: vocabulario, estilo, tono según
contexto. Garantiza coherencia entre microcopy de pantallas, errores,
notificaciones y emails.

## Voice (constante)

La voz del producto NO cambia según contexto. Sugerencias para el placeholder:

- **Directo, no formal** — "Guardá tus cambios" mejor que "Por favor proceda a guardar".
- **Humano, no robótico** — "Algo salió mal, intentá de nuevo" mejor que "Error 500".
- **Conciso** — eliminar palabras de relleno.

## Tone (varía según contexto)

| Contexto | Tono | Ejemplo |
|----------|------|---------|
| Onboarding | Cálido, alentador | "¡Empezá tu primer pedido!" |
| Acciones exitosas | Celebratorio leve | "Listo. Tu pedido fue guardado." |
| Errores del usuario | Empático, no culpabilizante | "Faltan datos en el formulario" (no "Error: campos vacíos") |
| Errores del sistema | Honesto, accionable | "No pudimos guardar. Intentá en unos segundos." |
| Acciones destructivas | Firme, claro | "Esto no se puede deshacer." |

## Guidelines

**Do:**
- Hablar al usuario en segunda persona ("vos" / "tú" según locale).
- Voz activa: "Guardamos tus cambios" mejor que "Tus cambios fueron guardados".
- Microcopy ≤8 palabras cuando es posible.

**Don't:**
- Tecnicismos no traducidos ("commit", "deploy", "stack trace") al usuario final.
- Sarcasmo o humor en mensajes de error.
- Capitalizar Cada Palabra En Botones (sentence case > title case).

## Internacionalización

- Diseñar para variación de longitud (alemán = +30% típico).
- Evitar idiomas culturales / metáforas locales.
- Pluralización: prever singular/plural via ICU MessageFormat.

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial.
