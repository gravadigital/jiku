---
foundation: grid
version: 0.1.0
last_updated: {{DATE}}
status: placeholder
platform: mobile-app
---

# Grid (app nativa)

> **Placeholder inicial** — Ajustar a las decisiones reales de la app.
> Esta es la variante para superficies `platform: mobile-app`. Una app web usa la otra variante,
> con tabla de breakpoints en px.

## Propósito

En una app nativa de teléfono **hay un solo layout**. El ancho no es un eje de variación: no hay
ventana que el usuario redimensione. Lo que sí varía, y lo que esta foundation define, son tres cosas:

1. **Safe areas** — cuánto espacio come el sistema arriba y abajo, y varía por dispositivo.
2. **Escalado de texto** — el usuario puede agrandar la tipografía y el layout tiene que sobrevivirlo.
3. **Clases de tamaño** — solo si la app soporta tablet.

**Este archivo es la fuente única de estos valores.** Lo consumen `/service-planify-story` (que lo
copia al Story Plan) y `/service-implement-story` (que implementa contra él). Si un valor cambia acá,
cambia el comportamiento del código ya implementado: es un cambio breaking (ver `governance.md`).

**Cómo se implementan** es otra cosa y vive en las convenciones del servicio: para Flutter, en
`.claude/conventions/flutter/adaptive-layout.md` (`SafeArea`, `viewInsets`, `textScaler`,
`LayoutBuilder` con las clases de tamaño, política de orientación). Este archivo declara los valores;
esa convención declara el cómo. No dupliques uno en el otro.

## Orientación

**Política:** {{portrait bloqueado | soporta ambas | portrait salvo pantallas puntuales}}

Declarar esto explícitamente importa: define si `phone-landscape` es un viewport válido para alguna
pantalla de esta superficie.

- Si es **portrait bloqueado**: ninguna pantalla declara `phone-landscape`, y el código lo fuerza en
  la configuración de la app.
- Si hay **pantallas puntuales** que rotan (video, cámara, formularios largos, lectura): solo esas
  declaran `phone-landscape` en su `screen.md`, y acá se listan cuáles y por qué.

| Pantalla | Rota | Por qué |
|----------|------|---------|
| {{pantalla}} | sí | {{razón concreta}} |

## Safe areas

El layout nunca dibuja contenido interactivo dentro del inset del sistema. Los valores dependen del
dispositivo: **no se hardcodean**, se leen de la API de la plataforma.

| Zona | De dónde se lee | Qué NO puede caer ahí |
|------|-----------------|------------------------|
| Superior (status bar / notch) | {{`MediaQuery.padding.top` / `SafeArea`}} | header, botones de navegación |
| Inferior (home indicator) | {{`MediaQuery.padding.bottom`}} | nav-bar inferior, CTA fijo |
| Teclado | {{`MediaQuery.viewInsets.bottom`}} | inputs y su botón de submit |

**Regla:** todo bloque anclado a un borde de la pantalla respeta el inset. Un `nav-bar` inferior o un
CTA fijo mal anclado queda tapado por el home indicator en los dispositivos que lo tienen.

## Escalado de texto

| Aspecto | Decisión |
|---------|----------|
| Escala máxima soportada | {{200%}} |
| Comportamiento al escalar | {{el contenido crece y la pantalla scrollea; nunca se truncan textos}} |
| Alturas fijas | {{prohibidas en bloques con texto — usar altura mínima}} |

**Regla:** ningún bloque con texto tiene altura fija. A 200% el texto necesita el doble de alto, y una
altura fija lo recorta o lo desborda.

## Clases de tamaño

{{Si la app NO soporta tablet:}}
La app es solo para teléfono. No hay clases de tamaño: un layout, un viewport (`phone`).

{{Si la app soporta tablet:}}

| Clase | Ancho (dp) | Viewport UX | Columnas |
|-------|------------|-------------|----------|
| `compact` | < 600 | `phone` | 4 |
| `expanded` | ≥ 600 | `tablet` | 8 |

El corte en dp lo lee el código de la API de la plataforma ({{`MediaQuery.size.width`}}), no de un
valor en píxeles. Los anchos de columna se expresan como fracciones sobre 12, igual que los layouts de
los screens (`docs/ux/surfaces/{{surface}}/screens/*.md` → "Layout por viewport"), para que la spec de
UX y el código hablen el mismo idioma.

## Guidelines

**Do:**
- Diseñar para el teléfono y tratar tablet (si aplica) como un layout aparte, no como un estiramiento.
- Usar el mecanismo de safe area de la plataforma en vez de paddings constantes.
- Dejar que el contenido scrollee cuando el texto escala.

**Don't:**
- No hardcodear el alto del status bar ni del home indicator.
- No usar breakpoints en píxeles: en nativo se razona en dp y en clases de tamaño.
- No poner altura fija en bloques con texto.
- No asumir que la pantalla no rota si el código no lo bloquea explícitamente.

## Accesibilidad

- El layout debe ser usable con la tipografía del sistema al máximo declarado arriba.
- Los targets táctiles cumplen el mínimo de la plataforma ({{44pt iOS / 48dp Android}}).
- El área táctil no depende del tamaño visual del ícono: se amplía sin agrandar el dibujo.

## Historial

- {{DATE}} v0.1.0 — Placeholder inicial (variante app nativa).
