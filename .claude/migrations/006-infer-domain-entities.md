---
target_version: "4.1.0"
requires: "docs/prd/requirements.md"
description: "Inferir Domain Entities desde documentación existente y agregarlas a requirements.md"
---

# Migration 006: Infer Domain Entities

## Purpose

Agrega la sección `## Domain Entities` a `docs/prd/requirements.md` inferida desde la
documentación técnica existente del proyecto. Esta sección es requerida por `new-request`
para anclar las preguntas de clarificación al vocabulario del dominio.

## Execution

### Step 1: Verificar si aplica

1. Leer `docs/prd/requirements.md`
2. Si ya contiene una sección `## Domain Entities` → esta migración ya fue aplicada. Informar al usuario y terminar:
   ```
   ✅ Domain Entities ya existe en requirements.md. Migración omitida.
   ```
3. Si no existe → continuar

### Step 2: Leer documentación existente

Leer todos los siguientes archivos (omitir los que no existan):

1. `docs/prd/requirements.md` — features y capabilities actuales (secciones de Core Features)
2. Todos los archivos en `docs/architectures/` — entidades por servicio, responsabilidades
3. Todos los archivos en `docs/db-schemas/` — tablas, campos, tipos, enums, constraints, relaciones
4. Todos los archivos en `docs/apis/` — request/response bodies, campos con tipos
5. Últimas 10-15 stories en `docs/stories/` — lógica de negocio implementada

Informar al usuario qué documentación fue encontrada:
```
Leí la documentación existente:
- [X] docs/prd/requirements.md
- [X] docs/architectures/ ([N] archivos)
- [X] docs/db-schemas/ ([N] archivos)
- [X] docs/apis/ ([N] archivos)
- [X] docs/stories/ ([N] stories)
```

### Step 3: Inferir entidades del dominio

A partir de la documentación leída, identificar las entidades del dominio:

- **Nombres**: usar los nombres exactos como aparecen en la documentación técnica (tablas de DB, modelos de API)
- **Atributos clave**: extraer campos con sus tipos desde schemas y APIs (no listar todos — solo los relevantes para lógica de negocio)
- **Enums**: extraer todos los valores posibles desde DB constraints o validaciones
- **Transiciones de estado**: si hay campos de estado, buscar en stories o arquitecturas las transiciones permitidas
- **Relaciones**: extraer desde foreign keys en DB o referencias en APIs
- **Business rules**: extraer desde stories implementadas o constraints de DB

### Step 4: Presentar propuesta al usuario

Mostrar las entidades inferidas en el formato del template (sin guardar aún):

```markdown
## Domain Entities

### [EntidadA]
- **Key attributes:** campo (tipo, req/opt), campo (enum: val1/val2, default: val1)
- **Relationships:** belongs_to [EntidadB], has_many [EntidadC]
- **Notes:** [Reglas de negocio identificadas]

### [EntidadB]
...
```

Luego preguntar al usuario:

```
Estas son las entidades que inferí desde la documentación existente.

¿Están completas y correctas? Podés:
- Confirmar para guardar tal cual
- Indicar correcciones o entidades faltantes
- Agregar reglas de negocio que no estén documentadas
```

Esperar respuesta. Iterar si el usuario solicita cambios.

### Step 5: Guardar en requirements.md

1. Insertar la sección `## Domain Entities` al inicio de `docs/prd/requirements.md`,
   antes de cualquier sección existente (después del frontmatter)
2. Guardar el archivo
3. Notificar:

```
✅ Domain Entities agregado a docs/prd/requirements.md

📄 Entidades definidas:
- [EntidadA]: [resumen de atributos clave]
- [EntidadB]: [resumen]
- [EntidadN]: [resumen]

new-request ahora usará estas entidades para anclar las preguntas de clarificación.
```
