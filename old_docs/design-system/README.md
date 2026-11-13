# Design Systems — Jiku y Opus

> **Las dos superficies están en estados distintos, y hay que leerlas distinto.**
>
> - **`web` es normativo** desde v2.0.0 (2026-09-02): describe lo que el producto **debe** ser
>   según el Manual de marca Jiku v1.0. **El código todavía no lo cumple** — cada spec lleva su
>   sección de migración.
> - **`opus-web` sigue sembrado desde el código existente**: es el registro de lo que el código
>   **ya hace**, con sus incoherencias marcadas como gaps.
>
> La distinción importa para no confundir destino con estado actual. En `web`, un valor que
> discrepa del código es **deliberado**; en `opus-web`, sería un bug del documento.

## Superficies

**Dos marcas, dos Design Systems independientes**, cada uno con su propio versionado y su propia
identidad. No hay intención de unificarlos.

| Superficie | Marca | Audiencia | Versión | Estado | Accent | Tipografía | DS |
|---|---|---|---|---|---|---|---|
| **web** | **Jiku** | equipo interno | `2.4.0` | **normativo** | **`#61CCB9`** verde agua | **Sora + Gabarito** | [web/](web/) |
| **opus-web** | **Opus** | clientes | `0.1.0` | relevado desde código | `#2563eb` azul | stack de sistema | [opus-web/](opus-web/) |

Viewports: `web` es `desktop` único (el shell lo impone); `opus-web` tiene `mobile` y `desktop` con
corte real en 768 px.

> **`web` cambió de identidad en v2.0.0.** El magenta `#DA2C6A` y la tipografía Archivo quedan
> descontinuados; ver
> [mapeo del sistema anterior](web/foundations/color.md#mapeo-del-sistema-anterior).

> **Son dos marcas distintas, y es deliberado.** Decidido el **2026-09-02**: **Jiku** firma el
> gestor interno y **Opus** el portal de clientes. **El Manual de marca Jiku no aplica a
> `opus-web`.**
>
> El criterio es la audiencia: Opus es de **cara al cliente** —se presenta como «¡Bienvenido a
> OPUS!», con su propio logo y `title: 'Opus'`— y Jiku es **interno**. Unificarlas haría que el
> cliente vea la identidad interna de Grava. El manual de Jiku ya razona así: «Jiku firma el
> producto; Grava firma la organización. Nunca se combinan en un mismo bloque.»
>
> **Opus no tiene manual de marca todavía.** Su DS sigue relevado desde el código, y ese es su
> estado correcto —no un pendiente— hasta que exista una fuente de diseño que lo decida.

## Qué está sembrado y qué no

| Foundation | web | opus-web |
|---|---|---|
| `logo.md` | ✅ **Normativo** (nuevo en v2.0.0) | — no existe |
| `color.md` | ✅ **Normativo** | ✅ Paleta real relevada |
| `typography.md` | ✅ **Normativo** | ✅ Escala real relevada |
| `spacing.md` | ✅ **Normativo** | ✅ Escala real relevada |
| `grid.md` | ◐ Mixto — layout normativo, responsive relevado | ✅ Breakpoints reales |
| `iconography.md` | ✅ **Normativo** | ⬜ Placeholder |
| `motion.md` | ✅ **Normativo** | ⬜ Placeholder |
| `elevation.md` | ✅ **Normativo** | ⬜ Placeholder |
| `voice-tone.md` | ◐ Parcial — falta tono por contexto | ⬜ Placeholder |

| Otros | web | opus-web |
|---|---|---|
| `components/` | **20 especificados** + 1 deprecado | 3 especificados, 7 candidatos relevados |
| `tokens/` | ✅ **Normativo** (3 tiers) | ⬜ Placeholder |
| `patterns/` | 1 (`login`) | ⬜ Placeholder |
| `guidelines/` | ◐ `content` normativo · resto placeholder | ⬜ Placeholder |

En `web` lo único que queda abierto es el **comportamiento responsive**, que el manual no menciona. En `opus-web`, los placeholders siguen siendo lo que el código no puede
responder. **En ninguno de los dos se inventaron valores.**

## Lo más importante de cada superficie

**web** — El DS es el **destino, no el estado**: verde agua `#61CCB9` sobre azul oscuro `#0B1934`,
Sora + Gabarito, radios 8/10/14/999. La migración tiene dos trampas registradas: los **29 usos de
`Button` con `secondary`** no se migran automáticamente (un `#D9D9D9` puede ser un «Volver» o un
«Cancelar», y el sistema nuevo los distingue), y hay **código muerto exportado desde el barrel con
nombres que colisionan** con specs nuevos (`Card`, `Input`, `Textarea`).

Sigue vigente del relevamiento: la superficie es **desktop-only por el shell**, y **el manual no
define comportamiento responsive**.

Las **dos decisiones que v2.0.0 dejó abiertas se resolvieron en v2.1.0**: el stepper muestra los
cinco pasos de trabajo y **no** es el control de estado —eso es el badge editable, con los siete—, y
la acción destructiva se confirma con secundario de borde claro, con la advertencia en el texto.

**opus-web** — El corte de **768 px no es de CSS sino de árbol de componentes**: `useIsMobile()`
decide qué montar. Y la **paleta de dominio —los colores de estado y prioridad que el usuario más
ve— vive en 6 lugares, ninguno en los tokens**, con al menos una divergencia de valor real.

Su escala neutral, en cambio, es **coherente y única** (la `slate` de Tailwind), a diferencia de las
tres escalas de gris superpuestas que tenía `web`. Es la parte del sistema que **no** hay que tocar
si algún día Opus recibe su propio manual.

## Cómo usarlo

- **Al implementar en `web`**: los valores son el **destino**. El código actual no los cumple:
  leé la sección **Migración** del spec antes de tocar nada.
- **Al implementar en `opus-web`**: los valores son los que el código **ya usa**. Un cambio de valor
  es un cambio de comportamiento del código existente — versionalo como breaking (ver
  `governance.md` de cada superficie).
- **Al detectar un gap**: no lo arregles en el documento. Está inventariado en
  [`docs/ux/gaps-as-is.md`](../ux/gaps-as-is.md) y se cierra con una story, no con una edición.
- **Al iterar**: `/product-design-system-update`. El skill pregunta sobre qué superficie aplica el
  cambio: **un cambio en `web` nunca toca `opus-web`**, ni al revés.

## Estado

**`web`** — Los 21 componentes están en `status: normativo`, con do/don't, guidelines de contenido
y reglas de accesibilidad completas, porque ahora hay una fuente que las decide: el manual de marca
más las dos decisiones tomadas en v2.1.0. Lo que el manual no cubre —tono por contexto, responsive—
sigue marcado como hueco en su foundation, no rellenado con valores inventados.

**`opus-web`** — Componentes en `status: relevado-desde-código`. Sus secciones de **do/don't,
guidelines de contenido y rationale de accesibilidad están vacías a propósito**: el código muestra
qué se hizo, no qué debe hacerse, e inventar esas reglas las volvería indistinguibles de decisiones
reales.
