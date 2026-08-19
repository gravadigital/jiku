---
name: product-generate-flows
description: Detect and generate all system flow documents from existing APIs, schemas, and architectures
argument-hint: "[product-path service-path-1 ...]"
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion"
---

# Generate Flows

## Purpose

Analyze all existing product and service documentation to automatically detect and generate ALL system flow documents. This is a **migration/utility command** for projects upgrading to v4 that already have APIs, DB schemas, and architectures documented but no flow documentation.

**Flow:**
```
Step 0: Validate input (product path + service paths required)
  |
Step 1: Initialize (Files index, locate documentation)
  |
Step 2: Read ALL technical documentation
  |
Step 3: Detect all cross-service interactions
  |
Step 4: Propose flow list to user for approval
  |
Step 5: Generate all approved flow documents
  |
Step 6: Summary
```

**Result:** All detected system flows documented in **flows_folder**, one file per flow.

**This command does NOT:**
- Create or modify API specs, DB schemas, or architectures
- Read source code -- it works exclusively from existing documentation
- Replace existing flow documents -- it skips flows already documented

## Role

**Adopt the Technical Leader Agent role** - Read [Technical Leader Agent](.claude/agents/technical-leader.md)

## CRITICAL RULES

1. **Use Spanish** for all user interactions and document content
   - Translate ALL content including section titles from English templates
   - Examples: "Goals" -> "Objetivos", "Background" -> "Contexto", "Success Criteria" -> "Criterios de Exito"
2. **Save first, then validate** - Save documents, notify user, wait for confirmation
3. **Reference locations from Files index** - Do not hardcode paths
   - Read [Files index](.claude/utils/index.md) for all folder locations
4. **Do NOT dump full content in chat** - Save to file, show summary, let user review file directly
5. **Copy field names verbatim from documentation** - When referencing endpoints, copy exact field names and types from OpenAPI YAMLs. When referencing tables, copy exact column names from DBML schemas. NEVER paraphrase or rename fields.
6. **Do NOT invent interactions** - Only document interactions that are evidenced in the API specs, DB schemas, or architecture documents. If an interaction is implied but not documented, flag it as `NOT DOCUMENTED - needs verification`.
7. **Skip existing flows** - If a flow document already exists in **flows_folder**, do NOT regenerate it.

## Execution

### Step 0: Validate Input

**CRITICAL: This command REQUIRES paths as parameters.**

Expected usage:
```
/product-generate-flows {product-path} {service-path-1} [service-path-2] [...]
```

Parse $ARGUMENTS to extract paths. The first argument is the product repo path, and subsequent arguments are service repo paths.

If user did NOT provide paths:

```markdown
Este comando requiere paths como parametros.

**Uso:** `/product-generate-flows {product-path} {service-path-1} [service-path-2] [...]`

**Ejemplos:**
- `/product-generate-flows . ../api-backend ../web-app`
- `/product-generate-flows /home/user/producto /home/user/api /home/user/web`
- Monorepo: `/product-generate-flows . .`

**Se necesita al menos:**
- 1 path al repo de producto (donde estan **apis_folder**, **db_schemas_folder**, etc.)
- 1 path a un repo de servicio (donde esta la arquitectura del servicio)
```

**ABORT if no paths provided.**

**0.1 Validate Paths**

For the product repo path:
1. Check directory exists
2. Verify **apis_folder**, **db_schemas_folder**, **architectures_folder** exist (at least one)

For each service repo path:
1. Check directory exists
2. Check if it has `.claude/local-config.yaml` or architecture documentation

**If invalid:** Inform which path failed and why. ABORT.

---

### Step 1: Initialize

**1.1 Load Context**

1. Read [Files index](.claude/utils/index.md) to get all folder locations
2. Identify key folders in the product repo:
   - **apis_folder** - API specifications
   - **db_schemas_folder** - Database schemas
   - **architectures_folder** - Service architectures
   - **flows_folder** - Where to save generated flows
   - **adrs_folder** - Architectural decisions (optional context)

**1.2 Create flows_folder if needed**

If **flows_folder** does not exist, create it.

**1.3 Inventory Available Documentation**

```markdown
Documentacion encontrada:

**Producto** ({{product_path}}):
- APIs: {{list API files found}}
- Schemas de BD: {{list schema files found}}
- Arquitecturas: {{list architecture folders found}}
- ADRs: {{list ADR files found}}
- Flujos existentes: {{list flow files found or "Ninguno"}}

**Servicios:**
{{for each service path}}
- {{service_name}} ({{path}}): {{service_type}}, {{brief description of docs found}}
{{endfor}}
```

**Continue automatically to Step 2.**

---

### Step 2: Read ALL Technical Documentation

**CRITICAL: Read ALL documentation COMPLETELY before proceeding.**

**2.1 Read ALL API Specifications**

For each file in **apis_folder**:
- Read the complete OpenAPI YAML
- Index every endpoint: method, path, request body fields+types, response body fields+types
- Note authentication requirements per endpoint
- Note which services each API belongs to

**2.2 Read ALL Database Schemas**

For each file in **db_schemas_folder**:
- Read the complete schema document (DBML + markdown)
- Index every table: name, columns with types, relationships, constraints
- Note which services own each database

**2.3 Read ALL Service Architectures**

For each service in **architectures_folder**:
- Read the index and ALL sections completely
- Pay special attention to:
  - **service-layer.md** -- business logic, handlers, processors (this is where cross-service calls and event handling are documented)
  - **api-standards.md** -- REST patterns, error handling
  - **data-layer.md** -- DB access patterns, repositories
- Extract ALL cross-service communication patterns:
  - REST calls to other services (which endpoint, what data)
  - Events published (event name, payload shape)
  - Events consumed (event name, handler logic)
  - Message queues (queue name, message format)
  - Webhooks (inbound or outbound)
  - External API calls (third-party services)

**2.4 Read ADRs**

For each file in **adrs_folder**:
- Read to understand cross-service decisions (communication patterns, data flow rules, sync strategies)

**2.5 Read Existing Flows** (if any)

For each file in **flows_folder**:
- Read to understand what is already documented
- These flows will be SKIPPED during generation

**2.6 Inform User**

```markdown
Documentacion tecnica leida:

**APIs:** {{N}} servicios, {{M}} endpoints totales
**Schemas de BD:** {{N}} bases de datos, {{M}} tablas totales
**Arquitecturas:** {{N}} servicios analizados
**ADRs:** {{N}} decisiones de arquitectura
**Flujos existentes:** {{N}} (se van a omitir)

Analizando interacciones cross-service...
```

**Continue automatically to Step 3.**

---

### Step 3: Detect All Cross-Service Interactions

**3.1 Identify Cross-Service Calls**

From the architecture documents (especially service-layer), identify every interaction where one service communicates with another:

- **REST calls:** Service A calls endpoint on Service B
- **Events/Messages:** Service A publishes event, Service B consumes it
- **Shared databases:** Two services read/write the same tables
- **External API calls:** Service calls third-party API
- **Webhooks:** Service receives or sends webhook calls

**3.2 Group Interactions into Flows**

Group related interactions into coherent end-to-end flows:

- **By feature:** Group all interactions needed to complete a user-facing feature (e.g., all calls involved in "creating an order")
- **By event:** Group all interactions triggered by a system event (e.g., all handlers that fire when "order.created" is published)
- **By trigger:** Group interactions that share the same entry point (e.g., all processing that happens when a NATS message arrives on a specific subject)

For each identified flow, determine:
- Flow name (kebab-case)
- Flow type (Feature or Event)
- Trigger (what starts the flow)
- Services involved
- Approximate number of steps

**3.3 Filter Out Already Documented Flows**

Compare detected flows with existing flow documents in **flows_folder**. Remove from the list any flow that already has a document.

---

### Step 4: Propose Flow List

Present the complete list of detected flows to the user:

```markdown
Flujos detectados: {{N}} flujos cross-service

{{if existing_flows > 0}}
**Flujos existentes (se omiten):** {{existing_flows}}
{{for each existing}}
- ~~{{flow-name}}~~ -- ya documentado
{{endfor}}
{{endif}}

**Flujos a generar:**

| # | Nombre | Tipo | Trigger | Servicios | Pasos (aprox) |
|---|--------|------|---------|-----------|---------------|
| 1 | {{flow-name}} | {{Feature/Evento}} | {{trigger}} | {{services}} | {{N}} |
| 2 | {{flow-name}} | {{Feature/Evento}} | {{trigger}} | {{services}} | {{N}} |
| ... | ... | ... | ... | ... | ... |

**Aprobas esta lista?**
- **Si** -> Genero los {{N}} flujos
- **Modificar** -> Decime que agregar, quitar o renombrar
```

**WAIT for user response.**

If user approves, continue to Step 5.
If user modifies, adjust the list and present again.

---

### Step 5: Generate All Flow Documents

**5.1 Read Template Specification**

Read **Flow Template** from Files index to understand document structure, format, and examples.

**5.2 For Each Approved Flow, Generate Document**

Process each flow sequentially. For each flow:

**5.2.1 Trace the Flow**

Starting from the trigger, trace the complete flow step by step:

For each step:
1. Identify the source service and target service
2. Find the exact endpoint in the OpenAPI YAML (copy method, path, request/response schemas verbatim)
3. Find the exact DB operations in the DBML schema (copy table names, column names verbatim)
4. Identify any events published or consumed
5. Map error scenarios from the API spec (copy error codes and response shapes)

**CRITICAL RULES during tracing:**
- **COPY exact field names** from the OpenAPI YAML -- do NOT paraphrase
- **COPY exact column names** from the DBML schema -- do NOT paraphrase
- If an interaction is implied but the endpoint is NOT in the API spec, flag it: `NOT DOCUMENTED`
- If a DB operation is implied but the table is NOT in the schema, flag it: `NOT DOCUMENTED`

**5.2.2 Draft Flow Document**

Following the template structure exactly, generate the complete flow document in Spanish.

Include ALL sections:
- Frontmatter (id, title, type, status: Active, dates, stories: [])
- Header
- Descripcion
- Servicios Involucrados (table)
- Pasos del Flujo:
  - Mermaid sequence diagram (overview)
  - Detailed step-by-step (with exact fields from API/DB docs)
- Manejo de Errores (table)
- Resultado
- Notas (if applicable -- discrepancies, assumptions, undocumented interactions)

**5.2.3 Save Document**

Save to **flows_folder**/{{flow-name}}.md

**5.2.4 Notify Progress**

After saving each flow, inform briefly:

```markdown
({{current}}/{{total}}) Flujo guardado: `{{flows_folder}}/{{flow-name}}.md` -- {{N}} pasos, {{M}} servicios
```

**Do NOT wait for user confirmation between flows.** Continue to the next flow immediately.

---

### Step 6: Summary

After ALL flows are generated, present the complete summary:

```markdown
**Generacion de flujos completada**

**Resultado:**
- Flujos generados: {{N}}
- Flujos omitidos (ya existian): {{M}}
- Total de flujos en **flows_folder**: {{N + M + existing}}

**Flujos generados:**

| Flujo | Tipo | Servicios | Pasos | Errores | Warnings |
|-------|------|-----------|-------|---------|----------|
| {{flow-name}} | {{type}} | {{services}} | {{steps}} | {{errors}} | {{warnings}} |
| ... | ... | ... | ... | ... | ... |

{{if total_undocumented > 0}}
---

**Interacciones no documentadas detectadas: {{total_undocumented}}**

Esto indica que la documentacion de APIs, DB schemas o arquitecturas puede estar incompleta.
Revisa los flujos generados y busca las marcas `NOT DOCUMENTED` para identificar que falta.
{{endif}}

---

**Revisa los flujos generados en **flows_folder** y decime si queres cambios en alguno.**
```

**WAIT for user response.**

If user requests changes to specific flows, edit those files and notify again.

## Output

- **flows_folder**/{{flow-name}}.md - One flow document per detected cross-service interaction, following Flow Template
