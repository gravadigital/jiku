---
component: Avatar
version: 1.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «El símbolo» y «Tablas y datos»
related:
  - logo (foundation)
  - table
  - sidebar-nav
---

# Avatar (web)

> **Normativo.** Especifica la identidad visual de una persona y del propio producto.

## Propósito

Identifica a una persona con sus iniciales, o a la aplicación con su símbolo.

## Anatomía

1. **Container** — circular (radio pill), fondo azul oscuro.
2. **Contenido** — iniciales en texto niebla, o el símbolo de Jiku.

## Variants

| Variant | Contenido | Uso |
|---|---|---|
| `person` | **Iniciales** en niebla sobre azul oscuro | Responsable de tarea, identidad en tabla, pie del sidebar |
| `app` | **Símbolo de Jiku** al 62 % del diámetro | Avatar de aplicación, favicon |

> **El símbolo nunca se usa para una persona y las iniciales nunca para la app.** El símbolo es
> marca (ver [logo](../foundations/logo.md)); las iniciales son dato.

## Sizes

| Size | Diámetro | Uso |
|---|---|---|
| `sm` | 24 px | Dentro de fila de tabla, junto al nombre |
| `md` | 32 px | Cabecera de aplicación, pie del sidebar |

En `app`, **el símbolo ocupa el 62 % del diámetro** en cualquier tamaño — es regla de marca, no de
componente.

## States

Estado único. **No es interactivo por sí mismo:** si abre un menú, el control es el botón que lo
contiene, no el avatar.

## Spacing & sizing rules

- **Radio:** 999 px (`radius.pill`).
- **Fondo:** `avatar.bg` → azul oscuro `#0B1934`.
- **Texto:** `avatar.text` → niebla `#F6F6F9`, dos iniciales en mayúscula.
- **Gap avatar–nombre:** `space.2` (8 px).
- **Sufijo «+N»** para responsables extra, en `text.secondary`, **fuera** del avatar.

## Accesibilidad

- El avatar de persona es **decorativo cuando el nombre está visible al lado**: `aria-hidden="true"`
  evita que el lector diga «AV, Andrés Vandoni».
- Cuando el avatar aparece **sin** el nombre, **DEBE** llevar el nombre completo como
  `aria-label` — las iniciales solas no identifican a nadie.
- El sufijo «+N» **DEBE** ser accesible: «y 1 responsable más», no «+1».
- **Contraste:** niebla sobre azul oscuro **14.6:1**.
- **NO SE DEBE** depender del color para distinguir personas: las iniciales son el dato, y el fondo
  es siempre el mismo azul oscuro.

> **El fondo no varía por persona.** El manual usa un único neutro de marca; no hay colores
> asignados por usuario. «Glifo de área por forma + neutro de marca; **el color de sistema queda
> reservado a estados**.»

## Guidelines de contenido

- **Dos iniciales**, en mayúscula: «AV» para Andrés Vandoni.
- Nombre y apellido cuando hay espacio; en tabla, «Lautaro A.» con el apellido abreviado.
- Sufijo «+N» cuando hay más responsables que los que caben.

## Do's & don'ts

**Do:**

- Usar iniciales sobre azul oscuro, siempre el mismo fondo.
- Marcar el avatar como decorativo cuando el nombre está al lado.
- Usar el sufijo «+N» en lugar de apilar avatares indefinidamente.

**Don't:**

- **NO SE DEBE** asignar un color por persona.
- **NO SE DEBE** usar el símbolo de Jiku como avatar de una persona.
- **NO SE DEBE** recolorear ni rotar el símbolo en la variant `app`.
- **NO SE DEBE** mostrar una sola inicial.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"person" \| "app"` | `"person"` | Persona o aplicación |
| `name` | `string` | — | Nombre completo; de acá salen las iniciales |
| `size` | `"sm" \| "md"` | `"sm"` | Diámetro |
| `nameVisible` | `boolean` | `false` | Si el nombre se muestra al lado (define si es decorativo) |

## Componentes y patterns relacionados

- [logo](../foundations/logo.md) — reglas del símbolo en la variant `app`.
- [Table](./table.md) — identidad de persona en la matriz de asignación.
- [SidebarNav](./sidebar-nav.md) — identidad en el pie.

## Historial

- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: iniciales en niebla
  sobre azul oscuro con fondo único (sin color por persona), variant `app` con el símbolo al 62 %
  del diámetro, y regla de cuándo el avatar es decorativo (MINOR sobre el DS).
