# Design System — Changelog

Sigue el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y el versionado [Semantic Versioning](https://semver.org/lang/es/).

## [0.1.1] - 2026-09-01

### Eliminado
- Tokens de etapa `--color-stage-{scope,support,date,hours,month}` y sus `-bg` (10 en total).
  El concepto de etapas ya no existe en el producto y no tenían ningún consumidor.

### Cambiado
- `--color-stage-{active,finished}` (+ `-bg`) renombrados a `--color-success` / `--color-danger`
  (+ `-bg`), con los mismos valores. No eran colores de etapa: `clients/edit/[id]` los usaba como
  verde/rojo genéricos de los botones agregar/quitar par clave-valor.

> Remover tokens es breaking bajo la política de versionado de este DS. Se registra como PATCH
> porque `0.1.0` es el scaffold de bootstrap —su propia nota dice que el primer DS real se versiona
> `0.2.0` o superior— y bumpear a `1.0.0` por una limpieza daría una señal equivocada.

---

## [0.1.0] - 2026-08-18

### Agregado
- Estructura inicial del Design System (bootstrap automático).
- Archivos placeholder en foundations/, tokens/, guidelines/.
- Carpetas vacías components/ y patterns/.

> **Nota:** esta versión `0.1.0` es solo la estructura inicial. El primer DS
> "real" se versiona como `0.2.0` o superior cuando el equipo de diseño
> reemplace los placeholders con valores definitivos.

---

## Cómo registrar cambios

Cada vez que se ejecuta `/product-design-system-update`, el agente:

1. Aplica el cambio pedido.
2. Bumpea versión semver según naturaleza:
   - **MAJOR**: breaking (remover variant, renombrar componente)
   - **MINOR**: agregar (componente, variant, foundation)
   - **PATCH**: corrección, ajuste de spec
3. Agrega entrada en este CHANGELOG con formato:

```
## [X.Y.Z] - YYYY-MM-DD

### Agregado / Cambiado / Eliminado / Corregido / Deprecado
- {descripción concisa del cambio}
```
