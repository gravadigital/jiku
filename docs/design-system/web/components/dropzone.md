---
component: Dropzone
version: 1.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Tarjetas y paneles»
related:
  - card
  - loader
  - button
---

# Dropzone (web)

> **Normativo.** Especifica la zona de carga de archivos adjuntos.

## Propósito

Permite adjuntar archivos, por arrastre o por selección.

## Anatomía

1. **Container** — radio 14 px, borde claro **punteado**, fondo niebla.
2. **Icono** — `upload`, 24 px.
3. **Instrucción** — «Arrastrá archivos aquí o hacé click para seleccionar».
4. **Restricción** — «Máximo 10 MB por archivo. No se permiten ejecutables ni scripts.»

> **La restricción va dentro del control, siempre visible.** No en un tooltip ni en un mensaje de
> error posterior: el usuario tiene que saber el límite **antes** de elegir un archivo de 40 MB.

## Variants

Una sola.

## Sizes

Sin sizes. Ocupa el ancho de su panel contenedor, con alto mínimo suficiente para las dos líneas de
texto más el icono.

## States

| State | Descripción | Tokens |
|---|---|---|
| `default` | En reposo | `dropzone.border` punteado, `dropzone.bg` |
| `hover` | Puntero encima | `dropzone.hover.border` → verde agua |
| `focus` | Foco por teclado | `focus.ring` |
| `dragover` | Archivo arrastrado encima | Borde verde agua + fondo `bg.active.subtle` (8 %) |
| `uploading` | Subida en curso | [Loader](./loader.md) `inline` + «Subiendo archivo…» |
| `error` | Archivo rechazado | Borde y mensaje en `state.urgent` |

## Spacing & sizing rules

- **Radio:** 14 px (`radius.surface`).
- **Borde:** 1 px punteado `#DFE1E7`; verde agua en `dragover`.
- **Padding:** `space.8` (32 px) vertical.
- **Gap icono–texto:** `space.2` (8 px).
- **Gap instrucción–restricción:** `space.1` (4 px).

## Accesibilidad

- **El arrastre NUNCA es el único mecanismo.** Toda la zona **DEBE** ser accionable por click y por
  teclado, con un `<input type="file">` real detrás. Un dropzone sólo-arrastre excluye a quien
  navega con teclado o usa un lector de pantalla.
- **DEBE** exponer el `<label>` asociado al input, con la instrucción como nombre accesible.
- La restricción **DEBE** estar asociada con `aria-describedby`, para que se anuncie junto al
  control.
- **`dragover` DEBE** tener un cambio visible que no sea sólo color (el borde cambia de punteado a
  sólido).
- El rechazo de un archivo **DEBE** anunciarse en una región `aria-live` y decir **por qué**
  («supera 10 MB», «tipo no permitido»), no sólo que falló.
- **Teclado:** `Enter` / `Space` abren el selector de archivos.

## Guidelines de contenido

- **Instrucción con las dos vías:** «Arrastrá archivos aquí o hacé click para seleccionar».
- **Restricción concreta y completa:** «Máximo 10 MB por archivo. No se permiten ejecutables ni
  scripts.»
- **Error específico:** «El archivo supera 10 MB», no «Archivo inválido».
- Voseo, como el resto del producto.

## Do's & don'ts

**Do:**

- Ofrecer click y arrastre siempre.
- Mostrar el límite antes de que el usuario elija.
- Decir por qué se rechazó un archivo.

**Don't:**

- **NO SE DEBE** confiar sólo en el arrastre.
- **NO SE DEBE** esconder la restricción en un tooltip.
- **NO SE DEBE** usar verde agua pleno como fondo del `dragover`: es el tinte al 8 %.
- **NO SE DEBE** aceptar el archivo y fallar después en el servidor sin explicar.

## API

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `accept` | `string` | — | Tipos admitidos |
| `maxSize` | `number` | `10485760` | Límite por archivo, en bytes |
| `multiple` | `boolean` | `true` | Varios archivos a la vez |
| `onFiles` | `(files) => void` | — | Callback de selección |
| `error` | `string` | — | Mensaje de rechazo |

## Componentes y patterns relacionados

- [Card](./card.md) — el `panel` que lo contiene.
- [Loader](./loader.md) — el estado `uploading`.

## Historial

- **1.0.0** (2026-09-02) — Spec nuevo, desde el Manual de marca Jiku v1.0: radio 14 px con borde
  punteado, restricción visible dentro del control, y la regla de que el arrastre nunca es el único
  mecanismo (MINOR sobre el DS).
