---
foundation: iconography
version: 2.0.0
last_updated: 2026-09-02
status: normativo
origin: Manual de marca Jiku v1.0 (septiembre 2026)
---

# Iconografía (web)

> **Normativo.** Reemplaza el placeholder que recomendaba elegir un set open-source: el manual
> define un estilo propio y el set de navegación del producto.

## Propósito

Define el estilo, los tamaños y el color de los iconos de Jiku, y cómo conviven con los logos de
terceros.

## Estilo

| Propiedad | Valor |
|---|---|
| Trazo | **1,6 px** |
| Grilla | **24 px** |
| Terminaciones y uniones | **Redondeadas** |
| Relleno | **Ninguno** — sólo trazo |

**Nunca dos colores en un mismo icono.**

## Set de navegación

Los iconos del producto, con el nombre con que se referencian:

| Icono | Uso |
|---|---|
| `actores` | Sección Actores |
| `proyectos` | Sección Proyectos |
| `requisitos` | Sección Requisitos |
| `tareas` | Sección Tareas |
| `asignacion` | Sección Asignación de tiempo |
| `horas` | Carga de horas |
| `clock-sub` | Subítem de horas |
| `calendario` | Selección de fecha y navegación de semana |
| `upload` | Adjuntar archivos, dropzone |
| `logout` | Cerrar sesión |
| `gitlab` | Enlace a GitLab (marca de tercero) |
| `mattermost` | Enlace a Mattermost (marca de tercero) |

## Tamaños

| Token DS | Tamaño | Uso |
|---|---|---|
| `icon.nav` | **24 px** | Sidebar y toolbars |
| `icon.nav-item` | **22 px** | Ítem de sidebar |
| `icon.nav-subitem` | **19 px** | Subítems |
| `icon.field` | **16 px** | Dentro de campos de formulario |
| `icon.meta` | **14 px** | Metadatos de tarjeta |

## Color

| Estado | Color | Nota |
|---|---|---|
| Inactivo | `#626C78` | Grafito primario |
| Normal | `#0B1934` | Azul oscuro |
| Activo | `#12897A` | Verde profundo |
| Sobre chip verde agua | `#0B1934` | Azul oscuro, para mantener contraste |

**El ítem activo hereda verde agua**; el icono de un ítem activo usa `#12897A`, no `#61CCB9`, para
alcanzar contraste sobre fondo claro.

## El símbolo de marca

El símbolo (seis rombos girando alrededor de un centro vacío) **no es un icono de interfaz** y no
sigue estas reglas. Las suyas:

- **`#61CCB9` como único color de las piezas.** Nunca se recolorea.
- **El centro vacío es parte del dibujo y nunca se rellena.**
- Sin contorno, sin sombra, sin degradado.
- **Sin rotación:** el eje vertical siempre a plomo.
- En avatares circulares ocupa el **62 % del diámetro** sobre azul oscuro.
- Tamaño mínimo: **16 px**.
- Icono de app: símbolo centrado sobre azul oscuro, 62 % del lienzo, **radio 22 %**.

Ver [logo](./logo.md) para las variantes de firma y el área de resguardo.

## Marcas de terceros

**GitLab, Mattermost, HedgeDoc y mailserver se insertan con su logo oficial en su color original:
no se re-dibujan ni se tiñen.** Es la única excepción a la regla de color de esta foundation.

## Guidelines

**Do:**

- Usar trazo de 1,6 px sobre grilla de 24 px, sin relleno.
- Elegir el tamaño por contexto según la tabla, no por gusto.
- Teñir el icono según su estado, con un solo color.

**Don't:**

- **NO SE DEBE** usar un icono con relleno ni con dos colores.
- **NO SE DEBE** teñir un logo de tercero.
- **NO SE DEBE** rotar, recolorear ni deformar el símbolo de marca.
- **NO SE DEBE** usar el símbolo de marca como icono de interfaz.

## Accesibilidad

- Un icono sin texto visible **DEBE** llevar `aria-label`.
- Un icono decorativo junto a un label **DEBE** ser `aria-hidden="true"`.
- El color del icono **NO DEBE** ser el único portador de información: el ítem activo del sidebar
  se marca además con la barra verde agua y la superficie blanca.
- Contraste del trazo contra su fondo ≥ 3:1.

## Ejemplos

- [Sidebar nav](../components/sidebar-nav.md) — icono 22 px, activo en `#12897A`.
- [Input](../components/input.md) — icono 16 px dentro del campo.
- [Card](../components/card.md) — metadatos con icono 14 px.

## Historial

- 2026-09-02 v2.0.0 — Definición completa desde el Manual de marca Jiku v1.0: trazo 1,6 px sobre
  grilla 24 px, set de navegación de 12 iconos, cinco tamaños por contexto, color por estado y las
  reglas del símbolo de marca. Reemplaza el placeholder que sugería elegir un set open-source
  (MAJOR).
- 2026-08-18 v0.1.0 — Placeholder inicial.
