---
target_version: "6.2.0"
requires: "docs/ux/product-overview.md"
description: "Declarar viewports por superficie, generar el layout de cada viewport, mover el accent color al design system y limpiar el frontmatter de fidelidad"
---

# Migration 011: Viewports en la documentación UX

## Purpose

El track UX pasó de un `device` único por pantalla a **viewports por superficie**, con un layout
declarado por viewport en cada `screen.md`. Esta migración lleva la documentación UX existente al
modelo nuevo.

Se hace como migración **de agente** y no como script bash porque el trabajo central no es mecánico:
un script puede renombrar un campo, pero **no puede inferir el layout desktop de una pantalla que
solo existía en mobile**. Decidir si la navegación pasa a sidebar, si las cards van en grilla de tres,
si un bottom-sheet se vuelve panel inline — eso es diseño, y necesita propuesta y aprobación.

**Nada se rompe si esta migración no se corre.** El renderer lee `device` como alias deprecado de un
solo viewport, así que los wireframes existentes se siguen generando igual. Lo que falta sin correrla
es el viewport desktop.

## Execution

### Step 1: Verificar si aplica

1. Verificar que exista `docs/ux/product-overview.md`. Si no existe → el producto no tiene UX
   documentado, informar y terminar:
   ```
   No hay documentación UX en este proyecto. Migración omitida.
   ```

2. Leer `docs/ux/product-overview.md` → sección "Inventario de Superficies".

3. Si **todas** las superficies ya declaran `Viewports:` → la migración ya se aplicó. Informar y
   terminar:
   ```
   ✅ Todas las superficies ya declaran sus viewports. Migración omitida.
   ```

4. Si algunas sí y otras no → continuar solo con las que faltan.

### Step 2: Relevar el estado actual

Por cada superficie sin viewports declarados:

1. Listar sus pantallas: `docs/ux/surfaces/{surface}/screens/*.md`.
2. Leer el frontmatter de cada una para juntar el `device` actual (`mobile` / `desktop` / `tablet`).
3. Leer `docs/ux/surfaces/{surface}/product-map.md` — el propósito de cada pantalla y la estructura
   de navegación indican qué tan bien se sostiene en desktop.
4. Leer `docs/prd/goals-and-context.md` para entender el contexto de uso: una app que se usa en
   movimiento no necesariamente gana algo con desktop.

Informar el relevamiento:
```markdown
Relevé la documentación UX actual:

| Superficie | Pantallas | `device` actual |
|---|---|---|
| {{surface}} | {{N}} | {{mobile}} |
```

### Step 3: Proponer los viewports de cada superficie

Proponer, **en un solo bloque**, los viewports de cada superficie con su justificación. El default es
conservar el viewport actual y **agregar `desktop`** cuando el contexto lo justifica (superficie de
monitoreo, administración, tablas densas, uso en escritorio mencionado en el PRD).

```markdown
## Viewports propuestos

| Superficie | Viewports | Por qué |
|---|---|---|
| {{surface-1}} | `mobile` (primario), `desktop` | {{razón concreta del PRD o del product-map}} |
| {{surface-2}} | `mobile` (único) | {{por qué NO desktop}} |

**Costo de cada `desktop` agregado:** cada pantalla de esa superficie necesita un layout de
escritorio propio. Son {{N}} pantallas en total.

**¿Confirmás? Podés quitar `desktop` de las superficies donde no aplique.**
```

**ESPERAR respuesta del usuario.** Iterar hasta que confirme.

### Step 4: Proponer los layouts desktop, por superficie

Para cada superficie que gana `desktop`, proponer el layout de **todas** sus pantallas en un solo
bloque — un gate por superficie, no uno por pantalla.

Para cada pantalla, leer su `screen.md` completo y decidir el arreglo desktop a partir de sus bloques
reales. Las dos formas que resuelven la mayoría de los casos:

- **shell**: `sidebar` (2-3/12) + contenido principal (9-10/12), cuando la superficie tiene
  navegación persistente. Requiere agregar un bloque `sidebar` marcado `solo desktop`, y marcar el
  `nav-bar` inferior existente como `solo mobile`.
- **grilla**: cards o tiles repetidos, 3-4 por fila (4/12 o 3/12 cada uno).

**Regla dura:** no proponer un layout desktop que sea el stack de mobile estirado a 1160px. Si una
pantalla realmente no tiene nada para poner al lado, contener el contenido en una columna centrada
(`2/12` vacío + `8/12` contenido + `2/12` vacío) y decirlo explícitamente.

```markdown
## Layouts desktop propuestos — `{{surface}}`

### {{pantalla-1}}
- Bloques nuevos: `sidebar-nav` (solo desktop)
- Bloques que pasan a solo mobile: `nav-inferior`
- Layout:
  - row `shell`: sidebar-nav 3/12 + main 9/12
  - dentro de main: row `grilla` con card × 3 (4/12 cada una)

### {{pantalla-2}}
...

**¿Aprobás estos layouts para `{{surface}}`?** Podés ajustar cualquiera antes de que los escriba.
```

**ESPERAR aprobación.** Iterar hasta confirmar. Recién entonces escribir.

### Step 5: Aplicar los cambios

**5.1 `product-overview.md`** — Agregar la línea `Viewports:` a cada superficie del "Inventario de
Superficies", con la justificación confirmada.

**5.2 Cada `screen.md`** de las superficies afectadas:

1. **Frontmatter**: reemplazar `device: {{x}}` por `viewports: [{{lista}}]`. Eliminar `device` — es el
   alias deprecado. Además:
   - **Eliminar `accent_color`**: es una propiedad de superficie que estaba duplicada en cada pantalla.
     Antes de borrarla de la primera, verificar que el valor coincida con `color.brand.primary` de
     `docs/design-system/{{surface}}/foundations/color.md`; si difieren, avisar al usuario y preguntar
     cuál es el correcto — uno de los dos venía desactualizado, y el DS es el que consume el
     implementador.
   - **Colapsar `fidelity`**: el mapa de tres ejes (`visuals`/`content`/`interactivity`) pasa a un
     escalar `fidelity: mid`. Los tres valores eran siempre los mismos y ningún skill los leía.
2. **Identidad**: reemplazar "Dispositivo principal" por "Viewports", con una línea por viewport
   sobre qué optimiza. Si el proyecto usaba `device: tablet`, declararlo acá como "se comporta como
   {{mobile|desktop}}".
3. **Estructura**: agregar la columna `Viewports` a la tabla de bloques. Los bloques existentes son
   `ambos` salvo los que la propuesta marcó como restringidos. Agregar las filas de los bloques
   nuevos (`sidebar-nav`).
4. **Layout por viewport** (sección nueva, entre Estructura y Contenido): una subsección por
   viewport. La de mobile es el stack en el orden actual de Estructura — el layout que ya tenía.
5. **Contenido**: agregar la subsección de microcopy de cada bloque nuevo, con texto real.
6. **Decisiones y descartes**: agregar por qué el layout desktop es el que es, y qué se descartó.
   Citar esta migración como origen.
7. **Eliminar la sección `## Specs visuales`** si existe. Decía "Pendiente — high-fi" en todas las
   pantallas de todos los productos, y esa etapa no existe: la especificación visual vive en el design
   system de la superficie. Si alguna pantalla tenía contenido real ahí (raro pero posible), **no lo
   borres**: mostráselo al usuario y preguntá a dónde va — casi siempre es un componente del DS que
   falta, o un asset.
8. **Accesibilidad**: si la sección repite lo que le corresponde al componente (contraste de un botón,
   ARIA de un ícono), dejar solo lo de composición — orden de foco entre bloques, landmarks, focus
   traps de sus overlays.

**5.3 No tocar** `Estados`, `Interacciones`, `Entrada y salida` ni la trazabilidad: son
independientes del viewport y ya están correctos.

**5.4 `product-overview.md`**: agregar la línea `Accent:` a cada superficie, con el valor que quedó en
`color.brand.primary` del DS, como traza de la decisión. El valor vivo sigue siendo el del DS.

**5.5 `foundations/grid.md`** de cada superficie afectada: completar la tabla
"Viewports de UX ↔ breakpoints" y resolver el placeholder del rango intermedio (640–1023px), que es
la única guía que va a tener el implementador para los anchos sin wireframe.

### Step 6: Regenerar wireframes

Por cada superficie afectada, delegar en `/product-ux-wireframes`:

```
/product-ux-wireframes {{CSV de superficies afectadas}} --no-interactive
```

Verificar que el `wireframes.html` de cada superficie se haya regenerado (timestamp más nuevo). Si alguna
falla, avisar sin abortar: el usuario puede correrlo a mano.

### Step 7: Informar

```markdown
✅ Migración 011 aplicada.

**Superficies migradas:**
- `{{surface}}`: `mobile` + `desktop` · {{N}} pantallas con layout por viewport

**Superficies que quedaron con un solo viewport:**
- `{{surface}}`: `mobile` — {{razón}}

**Accent color:** movido al design system (`color.brand.primary`). Se eliminó `accent_color` del
frontmatter de {{N}} pantallas — era una propiedad de superficie duplicada por pantalla.
{{Si hubo discrepancia:}} **Ojo:** {{N}} pantallas declaraban un accent distinto al del DS; resolvimos
por `{{valor}}`.

**Fidelidad:** `fidelity` colapsado a un escalar y sección `Specs visuales` eliminada de {{N}}
pantallas — anunciaba una etapa de alta fidelidad que el workflow no produce.

**Archivos modificados:**
- `docs/ux/product-overview.md`
- `docs/ux/surfaces/{{surface}}/screens/*.md` ({{N}} archivos)
- `docs/design-system/{{surface}}/foundations/grid.md`
- `docs/ux/surfaces/{{surface}}/wireframes.html` (regenerado)

**Revisá los wireframes antes de planificar stories nuevas:** desde ahora
`/service-planify-story` genera tareas y test scenarios para cada viewport declarado, y el
Story Plan lleva un preview ASCII por viewport.
```
