---
id: alta-requisito-desde-portal
title: Alta de requisito desde el portal de clientes
type: feature
status: Active
created: 2026-08-18
last_updated: 2026-08-25
stories: [S-003, S-004, S-007, S-014, S-029, S-030, S-033, S-034]
---

# Alta de Requisito desde el Portal de Clientes

**Tipo:** Feature
**Status:** Active (implementado en el código existente)
**Creado:** 2026-08-18
**Última actualización:** 2026-08-25
**Stories:** S-003, S-004, S-007, S-014, S-029, S-030, S-033, S-034

> ## REQ-007 — la autorización por rol y por entidad se muda a `core`
>
> **Es el flujo donde la decisión D-4 del REQ se vuelve visible**: es el caso vivo del chequeo de
> `user_project_permissions`, porque el portal es donde esa tabla está viva.
>
> | Paso | Qué cambia | Story |
> |---|---|---|
> | **4** — *"La api autoriza por rol y por entidad"* | **Se elimina de la api** y **reaparece en `core`** como compuerta de método + chequeo de entidad. El proyecto se resuelve **desde los 9 tipos de entidad** | S-030, S-034 |
> | **4 (matiz que hay que leer)** | El chequeo de `user_project_permissions` se aplica **solo en modo externo**. Un `admin` o un `user` **no** tienen filas en esa tabla —`validateProjectPermissions` de la api hoy los deja pasar de largo— y aplicárselo rompería **toda** la escritura interna | S-030 |
> | **5** | El payload gana la clave reservada **`actor`** — **ya aplicado** | S-029 |
> | **6** | Gana la **validación de la transición de estado** contra la tabla declarada. El requisito nace en `analisis`, y la nota que dice que *"la secuencia posterior solo se valida en `web`"* **se invierte** | S-033 |
>
> **Los códigos:** `caller_not_authorized` (403) si el rol no habilita el método; **`access_denied`
> (403), código nuevo del catálogo**, si el rol habilita pero la entidad no es suya.


## Descripción

Flujo por el cual un **cliente externo** crea un requisito desde el portal Opus. Se dispara al
confirmar el modal de creación. Es el flujo que atraviesa **todas las capas de aislamiento** del
producto: proxy del portal, autorización por rol, permiso de proyecto, y archivos ya subidos que se
vinculan al guardar.

Es también el único flujo en el que un actor externo a la organización **escribe** en el sistema.

## Servicios Involucrados

| Servicio | Rol | Tipo de Participación |
|---|---|---|
| `opus-web` | Modal de creación y **proxy catch-all** que agrega el Bearer | Iniciador |
| `api` | Valida rol y permiso de proyecto; publica el comando; relee para la respuesta | Procesador |
| `core` | Valida el proyecto, la titularidad de los archivos y los responsables; escribe | Procesador |
| PostgreSQL `jiku` | Persiste `requirements`, `people_requirements`, `requirement_subscriptors` y las filas nuevas de `attachments` | Almacenamiento |

## Pasos del Flujo

```mermaid
sequenceDiagram
    participant B as navegador
    participant O as opus-web
    participant A as api
    participant N as NATS
    participant C as core
    participant DB as PostgreSQL

    Note over B,O: (previo) subida de archivos: UploadTicket + PUT directo a S3, sin entityType
    B->>O: POST /api/opus/requirements
    O->>O: middleware: sesión válida y token no vencido
    O->>A: reenvía con Bearer (proxy catch-all)
    A->>A: valida token y rol external-user
    A->>A: validateProjectPermissions(projectId)
    alt sin permiso sobre el proyecto
        A-->>O: 403
    else con permiso
        A->>N: publica requirements.new
        N->>C: entrega el comando
        C->>C: abre transacción
        C->>DB: valida proyecto; resolveActor y titularidad de los fileIds
        alt un archivo no existe, está borrado, o no lo subió el actor
            C-->>N: failure invalid_fields / file_not_owned
            Note over C: rollback: se descarta TODA la escritura
        else todo válido
            C->>DB: INSERT requirements (state: analisis)
            C->>DB: INSERT people_requirements (el 1º es líder)
            C->>DB: UPDATE files SET byte_status='uploaded'
            C->>DB: INSERT attachments (entity_type, entity_id, file_id)
            C-->>N: success { id }
            Note over C: commit
        end
        N-->>A: reply
        A->>DB: relee con relaciones
        A-->>O: 201 Requirement
        O-->>B: pantalla de éxito (1,8 s) y cierra
    end
```

### Paso 1: Subida de archivos (previo, opcional)

**Origen:** navegador → `opus-web` → `api` → `core`, y navegador → S3
**Tipo:** REST (JSON) + PUT directo a S3

Antes de que el requisito exista, el usuario puede subir archivos. **La subida no menciona la
entidad** (D-12): no hay `entityType` ni `entityId`, y **no hay borrador**. El `File` existe sin
vínculo, que es un estado válido (RF-1, CA-7), y su titularidad queda en `uploaded_by`.

```
POST /api/opus/attachments   (application/json)
{ "fileName": "informe.pdf", "mimeType": "application/pdf", "fileSize": 4194304, "checksum": "9c1e..." }

→ 201 UploadTicket { "fileId": 1234, "uploadUrl": "https://...", "expiresIn": 300 }
```

**Un archivo por request** (D-07). Después el navegador hace el **`PUT` directo a `uploadUrl`**: el
byte no pasa ni por `opus-web` ni por la `api` ni por el bus.

**La validación autoritativa es de `core`**, con la política de `system_settings` leída en caliente.

**Ref:** [`subida-de-archivos`](subida-de-archivos.md) · `docs/apis/api.yaml` — `UploadTicket`

---

### Paso 2: El cliente confirma la creación

**Origen:** navegador
**Destino:** `opus-web`
**Tipo:** REST

**Request:**
```
POST /api/opus/requirements        ← al propio origen de opus-web

{
  "title": "El reporte de horas no exporta las ausencias",
  "description": "Al exportar el CSV...",
  "projectId": 12,
  "type": "incidencia",
  "priority": "alta",
  "subscriptorIds": ["3233...", "3234..."],
  "fileIds": [1234, 1235]
}
```

**El único campo obligatorio es `title`.** El estado no es editable: se muestra como un chip fijo
"Análisis".

**Ref:** `opus-web/src/features/requirements/components/CreateRequirementModal.tsx:217-221,314-318`

---

### Paso 3: El proxy catch-all reenvía con el token

**Origen:** `opus-web`
**Destino:** `api`
**Tipo:** REST

El route handler `/api/opus/[...path]` reenvía **cualquier método** a
`{API_URL}api/opus/{path}` agregando `Authorization: Bearer {accessToken}` de la sesión.

**El access token nunca llega al navegador**
([ADR-009](../adrs/ADR-009-token-confinado-al-servidor.md)).

> **El proxy no filtra paths ni métodos** (NFR-S08). Toda la superficie de `/api/opus/*` queda
> alcanzable para cualquier usuario logueado; la autorización la decide enteramente la api.

---

### Paso 4: La api autoriza por rol y por entidad

**Origen:** `api`
**Destino:** `api` (interno)
**Tipo:** Interno

Dos capas independientes ([ADR-008](../adrs/ADR-008-autorizacion-deny-by-default.md)):

1. **Rol:** `hasAnyRole(['external-user', 'user', 'admin'])`
2. **Entidad:** `validateProjectPermissions(projectId)` — el usuario tiene que tener fila en
   `user_project_permissions` para ese proyecto

**Es la capa 2 la que sostiene el aislamiento entre clientes**: sin ella, un cliente podría crear
requisitos en el proyecto de otro.

**Ref:** `docs/db-schemas/jiku.md` — `user_project_permissions`

---

### Paso 5: La api publica el comando

**Origen:** `api`
**Destino:** `core`
**Tipo:** Evento (NATS request/reply)

**Subject:** `{instance}.{user-id}.jiku-commands.v1.requirements.new`

**Payload:**
```json
{
  "actor": { "id": "323332022539911171", "roles": ["external-user"] },
  "creator": "323332022539911171",
  "title": "El reporte de horas no exporta las ausencias",
  "description": "Al exportar el CSV...",
  "projectId": 12,
  "type": "incidencia",
  "priority": "alta",
  "state": "analisis",
  "visibilityLevel": "public",
  "responsiblePersonIds": [],
  "fileIds": [1234, 1235]
}
```

`actor` (Actor, opcional en el contrato — **siempre presente desde la api**) ·
`creator` (IdentityUserId, **req**) · `title` (string, req) · `description` (string, req) ·
`projectId` (integer, req) · `type` (enum|null) · `priority` (enum, default `sin_prioridad`) ·
`state` (enum, default `analisis`) · `visibilityLevel` (enum, default `public`) ·
`responsiblePersonIds` (integer[]) · `estimatedFinishDate` (date-time|null) · `tags` (Tag[]) ·
`fileIds` (`FileIds`, integer[], `maxItems: 10`)

> **El sobre de identidad (S-029, entregado).** Todo comando que publica la api lleva además la
> clave reservada **`actor`** —`{ id, roles, name?, username?, email? }`— armada con el claim que la
> api ya verificó contra Zitadel. La inyecta `sendCommand` una sola vez, así que **ninguna ruta la
> arma a mano**. `core` la extrae **antes** de validar y espeja `users` en su propia transacción
> antes de autorizar. Contrato: `components/schemas/Actor` de `docs/apis/core.yaml`.

> **`attachmentIds` pasó a `fileIds`, y `attachmentScope` desapareció del payload:** existía solo
> para elegir el anclaje del draft, y no hay draft. El tope de 10 archivos deja de ser un límite de
> transporte (`multer`) y pasa a ser **regla de dominio** en el contrato del bus (D-20).

> **`creator` viaja en el cuerpo, no en el subject.** El subject identifica al **service user de
> la api**, no a la persona. Core confía en este campo sin verificarlo: la única defensa es la
> política del auth-callout ([ADR-007](../adrs/ADR-007-identidad-zitadel-auth-callout.md)).

**Ref:** `docs/apis/core.yaml` — canal `requirements.new`, `RequirementsNewPayload`

---

### Paso 6: Core valida y escribe, todo en una transacción

**Origen:** `core`
**Destino:** PostgreSQL
**Tipo:** Interno

El despachador abre la transacción. Validaciones:

1. **El proyecto existe** → `project_not_found`
2. **Los archivos existen, están vivos, y los subió el actor de este comando:** cada `fileId` tiene
   que existir con `retention_status: 'active'` → si no, `invalid_fields`; y cumplir
   `File.uploaded_by == resolveActor(ctx, payload)` → si no, **`file_not_owned`** (RF-12).
   **Si uno solo falla, se descarta toda la escritura.**
3. **Las personas responsables existen** → `person_not_found`

**Operaciones de BD:**
```sql
INSERT INTO requirements (title, description, project_id, type, priority, state,
                          visibility_level, created_by)
VALUES (..., 'analisis', 'public', '323332022539911171');

-- el PRIMERO de responsiblePersonIds queda como líder: el ORDEN es información
INSERT INTO people_requirements (requirement_id, person_id, is_leader) VALUES (...);

-- el navegador reportó el PUT y se le cree (D-13)
UPDATE files SET byte_status = 'uploaded' WHERE id IN (1234, 1235);

-- el vínculo, una fila por archivo, contra la entidad recién creada
INSERT INTO attachments (entity_type, entity_id, file_id)
VALUES ('requirement', {nuevoId}, 1234), ('requirement', {nuevoId}, 1235);

-- si vinieron suscriptores
INSERT INTO requirement_subscriptors (requirement_id, user_id) VALUES (...);
```

**Response (éxito):** `{ "status": "success", "data": { "id": 412 } }` → **commit**

**Ref:** `core/src/commands/requirements/requirements-new.ts:130` · `docs/db-schemas/jiku.md`

---

### Paso 7: La api relee y el portal confirma

**Origen:** `api` → `opus-web` → navegador
**Tipo:** REST

La api relee la base para armar el recurso completo. El portal muestra una **pantalla de éxito
durante 1,8 segundos** y cierra el modal, invalidando las queries del tablero.

## Manejo de Errores

| Paso | Error | Código | Response | Comportamiento |
|---|---|---|---|---|
| 3 | Sesión ausente o access token vencido | 401 | `{"error":"Unauthorized"}` | El middleware de `opus-web` corta antes de reenviar |
| 4 | Rol no autorizado | 403 | `{ code: access_denied }` | La api rechaza sin publicar |
| 4 | **Sin permiso sobre el proyecto** | 403 | `{ code: access_denied }` | **La capa que aísla un cliente de otro.** Rechaza sin publicar |
| 6 | Proyecto inexistente | 400 | `{ code: project_not_found }` | Rollback |
| 6 | Un `fileId` no existe o está borrado | 400 | `{ code: invalid_fields }` | **Rollback: se descarta el requisito entero**, no solo el vínculo |
| 6 | **`File.uploaded_by` ≠ el actor resuelto** | **403** | `{ code: file_not_owned }` | **Rollback total igual.** Es error de permisos, no de forma (CA-10 a CA-13) |
| 6 | Persona responsable inexistente | 400 | `{ code: person_not_found }` | Rollback |
| 5 | **Nadie escuchando** el subject (core no desplegado) | **503** | `{ code: service_unavailable }` | **La operación no ocurrió.** El server contesta *no responders* en milisegundos. **Reintentar es seguro** |
| 5 | **La respuesta no llegó a tiempo** (core lento) | **504** | `{ code: gateway_timeout }` | **PUDO haber ocurrido.** Sin acuse ni idempotencia ([ADR-002](../adrs/ADR-002-comandos-nats-sin-jetstream.md)): **reintentar a ciegas puede duplicar** |
| 2 | **Fallo de creación en el portal** | cualquiera | — | **El modal no muestra el error.** El botón vuelve de "Creando..." a "Crear elemento" sin mensaje (NFR-U06, gap conocido) |

## Resultado

**Éxito:** El cliente ve una pantalla de éxito y el requisito aparece en la columna **Análisis**
del tablero. El equipo interno lo ve en `web` con el mismo estado.

**Estado final:**
- `requirements`: fila nueva con `state: 'analisis'`, `visibility_level: 'public'`,
  `created_by` = el usuario del cliente
- `people_requirements`: filas de responsables, con `is_leader` en la primera
- `attachments`: se crean **N filas nuevas** apuntando a los `files` ya existentes, con
  `entity_type: 'requirement'`, `entity_id: {nuevoId}` y `file_id`
- `files`: los archivos vinculados pasan a `byte_status: 'uploaded'`
- `requirement_subscriptors`: filas de los suscriptores elegidos
- **Ninguna notificación se envía a nadie** (ver Notas)

## Notas

- **El vínculo se crea dentro de la misma transacción** que crea el requisito, así que no puede
  quedar un vínculo huérfano de un requisito que falló. Lo que **sí queda** son los `File` sin
  vínculo, que es un estado válido (RF-1, CA-7) y no un huérfano. Ver
  [`vinculacion-de-archivos`](vinculacion-de-archivos.md).
- **El requisito nace siempre en `analisis`.** El portal lo muestra como chip fijo y core lo
  valida por default, pero **la secuencia posterior del workflow solo se valida en `web`**
  (NFR-S07): por esta misma superficie se puede llevar un requisito a cualquier estado.
- **Los suscriptores no reciben nada.** La suscripción se registra en la base y **no hay canal de
  notificación en el producto**. Es la brecha del feature group FG-2.
- **Un usuario interno puede usar esta misma superficie.** `opus-web` no corta navegación por rol,
  así que un `user` o `admin` que entre al portal puede crear requisitos y cambiar estado y
  prioridad inline (pregunta abierta 4).
- **El comentario que un cliente escriba después se crea siempre como `public`**, y el feed que ve
  filtra por `visibilityLevel: 'public'`: es lo que impide que vea actividad interna.
