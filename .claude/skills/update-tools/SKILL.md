---
name: update-tools
description: Update Grava Workflow tools to the latest version - handles versioning, backups, and migrations
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep"
---

# Update Tools

Actualizar las herramientas Grava Workflow a la ultima version disponible.

## Script

Utilizar `.claude/scripts/update-tools.sh` para todas las operaciones. El script maneja:
- Versionado semantico
- Clonado del repositorio remoto
- Deteccion de modificaciones locales
- Backups en `/tmp` (no ensucian el repositorio)
- Actualizacion con o sin preservacion de cambios
- Archivos modificados se guardan como `.bkp`, los nuevos quedan con nombre original
- **Archivos protegidos** (`settings.local.json`, `local-config.yaml`) se preservan SIEMPRE automaticamente

## Flujo de Ejecucion

### 1. Verificar versiones
```bash
bash .claude/scripts/update-tools.sh check-version
bash .claude/scripts/update-tools.sh fetch-remote
bash .claude/scripts/update-tools.sh compare
```

Interpretar resultado de `COMPARISON`:
- `0`: Versiones iguales - preguntar si desea forzar reinstalacion
- `1`: Local mayor - advertir posible desarrollo local
- `2`: Remota mayor - continuar con actualizacion

### 2. Mostrar changelog
```bash
bash .claude/scripts/update-tools.sh changelog
```

Resumir cambios importantes al usuario.

### 3. Detectar modificaciones locales
```bash
bash .claude/scripts/update-tools.sh detect-changes
```

Si hay archivos `MODIFIED` o `LOCAL_ONLY`, preguntar al usuario.
Los archivos `PROTECTED` se preservan automaticamente sin preguntar.
1. Actualizar todo (perder cambios locales)
2. Actualizar preservando archivos modificados
3. Ver diff de archivos especificos
4. Cancelar

### 4. Crear backup y actualizar
```bash
bash .claude/scripts/update-tools.sh backup
bash .claude/scripts/update-tools.sh update-full
# O con preservacion:
bash .claude/scripts/update-tools.sh update-preserve "archivo1" "archivo2"
```

### 5. Ejecutar migraciones
```bash
bash .claude/scripts/update-tools.sh migrate
```

Ejecuta automaticamente las migraciones necesarias entre la version anterior y la nueva.
El sistema:
- Detecta o crea `.grava-version` en el proyecto
- Compara con la nueva version del workflow
- Ejecuta solo las migraciones necesarias
- Actualiza `.grava-version` automaticamente

### 6. Ejecutar migraciones de agente

Verificar si existen migraciones que requieren analisis semantico (no ejecutables por bash):

```bash
# El archivo se genera automaticamente por migrate.sh si hay pendientes
cat .claude/agent-migrations-pending.md 2>/dev/null || echo "NO_PENDING"
```

Si el archivo existe y tiene entradas:

1. Leer cada migracion listada (los archivos `.md` en `.claude/migrations/`)
2. Para cada una, verificar si aplica al proyecto actual (campo `requires` en el frontmatter)
3. Si aplica, ejecutar los pasos definidos en el archivo de migracion
4. Al terminar todas, eliminar `.claude/agent-migrations-pending.md`

Si no existe o esta vacio: continuar al Step 7.

### 7. Verificar y limpiar
```bash
bash .claude/scripts/update-tools.sh verify
bash .claude/scripts/update-tools.sh cleanup
```

### 8. Resumen
Mostrar al usuario:
- Version anterior -> nueva
- Ubicacion del backup (en `/tmp`)
- Archivos protegidos que se preservaron (ej: `settings.local.json`)
- Archivos con conflictos (`.bkp`) si los hay - revisar manualmente
- Migraciones bash ejecutadas (si hubo alguna)
- Migraciones de agente ejecutadas (si hubo alguna)
