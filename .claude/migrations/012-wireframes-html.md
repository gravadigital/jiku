---
target_version: "6.2.0"
requires: "docs/ux/surfaces"
description: "Migrar los wireframes de .excalidraw al book HTML autocontenido"
---

# Migration 012: Wireframes en HTML

## Purpose

El renderer de wireframes pasó de Excalidraw a un **book HTML autocontenido**. Esta migración
regenera los wireframes existentes con el renderer nuevo y da de baja el `.excalidraw`.

Es una migración de agente y no un script porque el paso central —derivar `screens.json` desde los
`screens/*.md`— es interpretación, no transformación mecánica. El `.excalidraw` viejo **no** es la
fuente: es una salida. La fuente son las screen specs, que no cambian.

**Qué cambia para el que lee wireframes:** en vez de abrir Excalidraw, doble clic en un `.html`.
Toggles de viewport y de estado, e ir a una pantalla haciendo clic en el bloque que dispara la
transición, en vez de seguir una flecha.

**Qué cambia para el que los versiona:** aparece `screens.json` en el repo. Es el intermedio canónico
y es lo que `git diff` muestra cuando un wireframe cambia — el `.excalidraw` diffeaba ~127k líneas
por regeneración aunque no cambiara nada, porque los ids eran aleatorios.

**Nada se rompe si esta migración no se corre**, salvo que los wireframes quedan en un formato que
ningún skill regenera más.

## Execution

### Step 1: Verificar si aplica

```bash
ls docs/ux/surfaces/*/wireframes.excalidraw 2>/dev/null
```

Si no hay ninguno → informar y terminar:
```
No hay wireframes Excalidraw en este proyecto. Migración omitida.
```

Si ya existe `wireframes.html` en todas las superficies y ningún `.excalidraw` → ya se aplicó.

### Step 2: Verificar que las specs estén completas

Por cada superficie con `.excalidraw`, verificar que exista `docs/ux/surfaces/{surface}/screens/`
con al menos un `.md`.

**Si una superficie tiene `.excalidraw` pero no tiene `screens/`**, el wireframe se generó fuera del
workflow o las specs se perdieron. **No borrar el `.excalidraw`**: informarlo y dejarlo, porque en ese
caso sí es la única copia que queda. Seguir con las demás superficies.

### Step 3: Chequear que las specs declaren viewports

Si los `screens/*.md` todavía usan `device:` en vez de `viewports:`, correr primero la
[migración 011](011-add-viewports-to-ux.md) y volver acá. Sin viewports declarados, el book se
renderiza mobile-only.

### Step 4: Regenerar

Por cada superficie con specs, delegar:

```
/product-ux-wireframes {{CSV de superficies}} --no-interactive
```

Esto escribe `screens.json` y `wireframes.html`. Verificar que ambos existan antes de seguir.

### Step 5: Revisar los warnings del render

El renderer avisa por stderr sobre dos cosas que el formato viejo escondía:

- **`N bloque(s) declarados pero ausentes del layout`** — la pantalla declara un `layout` que no
  menciona todos sus bloques. Un layout REEMPLAZA el stack por defecto, así que esos bloques no se
  dibujan. Es un bug de la spec que el renderer viejo no podía reportar. Mostrarle al usuario la
  lista por pantalla y preguntar si los agrega al layout o los saca de Estructura.
- **`transición a una pantalla inexistente`** — `transitions[]` y el inventario no coinciden.

**No arreglar esto en silencio:** son decisiones de diseño sobre pantallas reales.

### Step 6: Dar de baja el .excalidraw

Solo en las superficies donde el `wireframes.html` se generó bien:

```bash
git rm docs/ux/surfaces/{surface}/wireframes.excalidraw
```

Pedir confirmación antes. El archivo queda en la historia de git; no se pierde nada.

### Step 7: Informar

```markdown
✅ Migración 012 aplicada.

**Superficies migradas:** {{N}}
- `{{surface}}`: {{N}} pantallas, {{N}} screen-states → `wireframes.html` ({{N}} KB)

**Warnings a resolver:** {{N}} pantallas declaran bloques que su layout no dibuja:
- `{{pantalla}}`: {{bloques}}

Esto existía antes de la migración; el formato viejo no lo reportaba.

**Archivos nuevos (versionar):**
- `docs/ux/surfaces/{{surface}}/screens.json` — intermedio canónico, es lo que diffea

**Archivos dados de baja:**
- `docs/ux/surfaces/{{surface}}/wireframes.excalidraw`

Para abrir el book: doble clic en `wireframes.html`. No necesita servidor ni conexión.
```
