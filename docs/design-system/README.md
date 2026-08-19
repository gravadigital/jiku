# Design System — Jiku

> **Sembrado desde el código existente** durante la importación del producto (2026-08-18). No es un
> sistema diseñado y después implementado: es el registro de lo que el código **ya hace**, con sus
> incoherencias marcadas como tales.
>
> Esto importa para leerlo bien: **un DS cuyos valores discrepan silenciosamente del código es peor
> que uno vacío**, porque el implementador confía en él. Acá los valores son los reales, y lo que
> está mal está señalado como gap, no corregido en el papel.

## Superficies

El producto tiene **dos superficies con Design Systems independientes**, cada una con su propio
versionado.

| Superficie | Accent | Tipografía | Viewports | DS |
|---|---|---|---|---|
| **web** — gestor interno | `#DA2C6A` (magenta) | Archivo (Google Fonts) | `desktop` único | [web/](web/) |
| **opus-web** — portal de clientes | `#2563eb` (azul) | Stack de sistema | `mobile`, `desktop` (corte 768px) | [opus-web/](opus-web/) |

> **Las dos superficies no comparten identidad visual.** Color de marca distinto, tipografía
> distinta, y escalas tipográficas distintas (`web` arranca en 10px, `opus-web` en 12px con base
> 16). Lo único que comparten es la **escala de espaciado**.
>
> No hay evidencia en el código de si es deliberado —dos productos, uno interno y uno de cara al
> cliente— o divergencia acumulada. Es una **pregunta abierta** que conviene responder antes de
> unificar nada.

## Qué está sembrado y qué no

| Foundation | web | opus-web |
|---|---|---|
| `grid.md` | ✅ Breakpoints reales | ✅ Breakpoints reales |
| `color.md` | ✅ Paleta real | ✅ Paleta real |
| `typography.md` | ✅ Escala real | ✅ Escala real |
| `spacing.md` | ✅ Escala real | ✅ Escala real |
| `elevation.md` | ⬜ Placeholder | ⬜ Placeholder |
| `iconography.md` | ⬜ Placeholder | ⬜ Placeholder |
| `motion.md` | ⬜ Placeholder | ⬜ Placeholder |
| `voice-tone.md` | ⬜ Placeholder | ⬜ Placeholder |

| Otros | web | opus-web |
|---|---|---|
| `components/` | 3 especificados, 13 candidatos relevados | 3 especificados, 7 candidatos relevados |
| `tokens/` | ⬜ Placeholder | ⬜ Placeholder |
| `patterns/` | ⬜ Placeholder | ⬜ Placeholder |
| `guidelines/` | ⬜ Placeholder | ⬜ Placeholder |

Las cuatro foundations sembradas son las que el código **puede** responder. Las que quedan en
placeholder son las que dependen de decisiones que nadie tomó explícitamente: no se sembraron con
valores inventados.

## Lo más importante de cada superficie

**web** — El `grid.md` documenta que la superficie es **desktop-only por el shell**, no por
decisión: la sidebar mide 290 px fijos y el layout no tiene media queries. Además hay **14 media
queries crudas con 6 valores distintos**, dos de ellos separados por 1 px.

**opus-web** — El corte de **768 px no es de CSS sino de árbol de componentes**: `useIsMobile()`
decide qué montar. Y la **paleta de dominio —los colores de estado y prioridad que el usuario más
ve— vive en 6 lugares, ninguno en los tokens**, con al menos una divergencia de valor real.

## Cómo usarlo

- **Al implementar**: los valores de acá son los que el código ya usa. Un cambio de valor es un
  cambio de comportamiento del código existente — versionalo como breaking (ver `governance.md` de
  cada superficie).
- **Al detectar un gap**: no lo arregles en el documento. Está inventariado en
  [`docs/ux/gaps-as-is.md`](../ux/gaps-as-is.md) y se cierra con una story, no con una edición.
- **Al iterar**: `/product-design-system-update`.

## Estado

Los componentes están en `status: relevado-desde-código`. Sus secciones de **do/don't, guidelines
de contenido y rationale de accesibilidad están vacías a propósito**: el código muestra qué se
hizo, no qué debe hacerse, e inventar esas reglas las volvería indistinguibles de decisiones reales.
