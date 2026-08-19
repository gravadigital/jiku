---
target_version: "6.0.0"
requires: "docs/architectures/"
description: "Notificar al usuario que debe migrar los servicios con arquitectura en formato legacy al nuevo formato manifest.yaml + conventions"
---

# Migration 008: Notify Architecture Migration Required

## Purpose

La v6.0.0 reemplaza el formato de arquitectura de múltiples archivos de sección
(`tech-stack.md`, `project-structure.md`, etc.) por un `manifest.yaml` + convenciones custom.

Esta migración detecta los servicios que aún usan el formato viejo y le avisa al usuario
que debe ejecutar `/product-migrate-architecture` para cada uno.

## Execution

### Step 1: Detectar servicios legacy

Buscar en `docs/architectures/` subdirectorios que contengan `tech-stack.md` pero NO `manifest.yaml`.

Si no hay ninguno → esta migración no aplica. Terminar silenciosamente.

### Step 2: Notificar al usuario

Mostrar el siguiente mensaje (en español), reemplazando la lista con los servicios encontrados:

```
⚠️  Migración de arquitectura requerida (v6.0.0)

La v6.0.0 introduce un nuevo formato de arquitectura basado en manifest.yaml
y convenciones custom. Los siguientes servicios todavía usan el formato anterior
y deben migrarse antes de planificar o implementar nuevas stories:

{para cada servicio legacy:}
  - {service-name}  →  docs/architectures/{service-name}/

Para migrar, ejecutá:

  /product-migrate-architecture

El skill detecta automáticamente los servicios pendientes y guía el proceso
de migración uno por uno.

Esta migración no es automática porque requiere acceso al código fuente
de cada servicio para inferir las convenciones correctas.
```
