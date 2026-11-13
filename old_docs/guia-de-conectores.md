# Guía para construir un conector de Jiku

> **Para quién es:** un equipo que va a desarrollar un servicio **externo a Jiku** que se integra
> con él: lee datos, escribe datos o reacciona a lo que pasa. **Al cerrar la v1.6.0** describe
> cómo funciona Jiku y lo que hay que respetar para integrarse sin romper nada.
>
> **Qué no es:** no reemplaza a los contratos. Para cualquier detalle de forma —campos, tipos,
> enums— **mandan los tres AsyncAPI de [`docs/apis/`](https://github.com/gravadigital/jiku/tree/v1.6.0/docs/apis)**. Si este documento y un contrato
> no coinciden, gana el contrato.
>
> **Sobre los links:** apuntan al repositorio público
> [gravadigital/jiku](https://github.com/gravadigital/jiku), fijados al tag **`v1.6.0`** para que
> coincidan con lo que describe este documento. Las rutas que aparecen en el texto como código
> (por ejemplo `core/src/authorize-caller.ts`) son relativas a la raíz de ese repositorio.

---

## 1. Qué es un conector, en una frase

Un conector es **un servicio que se conecta al bus NATS de Jiku con una identidad de máquina de
Zitadel** que tiene el rol **`internal-app`**, y desde ahí:

- **lee** por el plano de consultas (`jiku-queries`),
- **escribe** por el plano de comandos (`jiku-commands`),
- **reacciona** a hechos consumiendo el stream de eventos de dominio (`JIKU_EVENTS`).

No hay API HTTP para conectores: **la API HTTP es para los dos frontends de Jiku**. De hecho, la
`api` es *el primer conector*: usa la misma regla y la misma plantilla de permisos que va a usar
el de ustedes.

**Lo que ya existe y no hay que construir:** la regla del auth-callout, la plantilla de permisos
(`deploy/nats/auth-callout/templates/connector.yaml`), el stream de eventos y el contrato de los
tres planos. **Dar de alta un conector no requiere cambiar nada en el repositorio de Jiku.**

---

## 2. La arquitectura de Jiku

### 2.1 El panorama

```
                 Equipo interno            Clientes
                       │                       │
                     web                   opus-web           (Next.js, no hablan con el bus)
                       └─────────┬─────────────┘
                                 │ HTTP
                                 ▼
                                api ─────────── lee directo ──────────┐
                                 │                                    │
                                 │ NATS (request/reply)               │
                                 ▼                                    ▼
  Conector ── NATS ──────▶  NATS + auth-callout ──────▶  core ──▶ PostgreSQL
  (ustedes)                 (permisos por rol)          (único    (una base)
      ▲                                                 que escribe)
      │                                                    │
      └──────── JetStream: stream JIKU_EVENTS ◀────────────┘  (eventos post-commit)

  Archivos: el cliente hace PUT/GET directo al bucket S3 con una URL que firma core.
  Identidad: Zitadel (OIDC). Jiku no crea ni administra usuarios.
```

### 2.2 Las partes

| Parte | Qué hace | ¿Le importa al conector? |
|---|---|---|
| **`core`** | **El único servicio que escribe en la base.** No tiene HTTP: su única interfaz es el bus. Registra dos servicios NATS micro en un mismo proceso: `jiku-commands` (23 comandos) y `jiku-queries` (23 consultas). Publica los eventos de dominio | **Sí: es con quien hablan** |
| **`api`** | Única puerta HTTP. Autentica a las personas, lee la base con un usuario de **solo `SELECT`**, y convierte cada escritura en un comando del bus | No. Es otro conector, en paralelo al suyo |
| **`web`** / **`opus-web`** | Frontend interno y portal de clientes. Nunca tocan el bus | No |
| **NATS** | Bus en modo *operator*. Comandos y consultas: request/reply **sin persistencia**. Eventos de dominio: **JetStream** | Sí: es el transporte |
| **auth-callout** | Intercepta cada conexión al bus, valida el token contra Zitadel y mintea los permisos según el rol (`rules.yaml`). Imagen externa (`gravadigital/nats-zitadel-auth-callout`) | Sí: decide qué pueden hacer |
| **Zitadel** | Proveedor de identidad. Emite los tokens y los roles | Sí: ahí vive su identidad |
| **PostgreSQL** | Base única. Red interna, sin exposición | **No: nunca se accede directo** |
| **Storage S3** | Los bytes de los adjuntos. Solo `core` tiene credenciales; los clientes usan URLs prefirmadas | Solo si manejan archivos |

### 2.3 Las decisiones que condicionan una integración

Son pocas, pero explican casi todos los comportamientos "raros" que van a encontrar. El
desarrollo completo está en [`docs/adrs/`](https://github.com/gravadigital/jiku/tree/v1.6.0/docs/adrs) y [`docs/prd/architecture.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/prd/architecture.md).

1. **Lectura y escritura están separadas por permisos de base, no por convención** (ADR-001).
   Toda escritura pasa por `core`, que la ejecuta en **una transacción por comando, abierta y
   cerrada por el despachador** (ADR-003): o se escribe todo, o no se escribe nada.
2. **Los comandos no tienen JetStream** (ADR-002). No hay cola, ni reintento, ni idempotencia.
   Si `core` no responde, la operación *puede* haber ocurrido igual.
3. **El vocabulario del producto vive en el contrato, no en el esquema** (ADR-004). En el bus se
   dice `task`; en la base, `objectives`. **Siempre usen el vocabulario del contrato.**
4. **La identidad la pone el subject, y el auth-callout la hace infalsificable** (ADR-007).
   Nadie puede publicar bajo un user id que no sea el suyo.
5. **Deny-by-default en todo** (ADR-008): un rol sin regla no conecta; un método sin permiso se
   rechaza; un campo no declarado en un filtro es un error, nunca se ignora.
6. **Los eventos de dominio son best-effort** (ADR-014): se publican después del commit, sin
   outbox. Un evento se puede perder; el dato no.

---

## 3. Identidad y permisos

### 3.1 Dar de alta la identidad del conector

1. En Zitadel, crear un **machine user** con **Access Token Type = JWT**. El tipo por defecto
   (`Bearer`) emite tokens opacos y **el callout los rechaza**.
2. Asignarle el rol **`internal-app`** en el proyecto de Zitadel de Jiku
   (`GESTION_ZITADEL_PROJECT_ID` en la instalación).
3. Generar una **JSON key** del machine user y entregársela al servicio.
4. Pedirle a quien opera la instalación las **creds del sentinel**
   (`deploy/nats/creds/sentinel-client.creds`), la **URL de NATS** y el valor de
   **`NATS_INSTANCE`** (`dev` / `prod`).

Para verificar el token: `deploy/zitadel-token.sh --check <key.json>` dice si es JWT u opaco,
cuándo vence y qué roles trae.

### 3.2 Qué concede `internal-app` — leerlo antes de seguir

**Es el permiso más ancho del producto.** Concretamente:

| Capa | Lo que obtiene el conector |
|---|---|
| Plantilla del callout (`connector.yaml`) | Publicar en `{instance}.{su-id}.jiku-commands.v1.>` y `.jiku-queries.v1.>`; consumir `JIKU_EVENTS` (solo lectura del stream); escuchar su inbox |
| Mapa rol → método de `core` (`core/src/authorize-caller.ts`) | `commands: ALL`, `queries: ALL` |
| Clase de caller en las consultas | **`connector`: no se recorta ninguna fila.** Ve todos los proyectos, todos los requisitos, comentarios internos, horas y ausencias |

**Consecuencia directa:** si el conector expone datos de Jiku a terceros (un cliente, otro
sistema, un canal de chat), **el filtrado por visibilidad es responsabilidad del conector**.
`core` no lo va a hacer por ustedes. Las columnas a mirar son `visibilityLevel` (`public` /
`internal`) en requisitos, tareas y comentarios, y `project-permissions` para saber qué cliente
ve qué proyecto.

> **Si necesitan un conector con permisos acotados, eso es un rol nuevo**, no una variante de
> este: plantilla propia en `deploy/nats/auth-callout/templates/`, regla en `rules.yaml`
> (arriba de las de persona) y entrada propia en `ROLE_METHODS` de
> `core/src/authorize-caller.ts`. Si es un rol de servicio, también va en `SERVICE_ROLES`
> (`core/src/events/auth/identity-type.ts`). Es un cambio de seguridad en Jiku y se pide al equipo de Jiku.

### 3.3 Conectarse al bus

Dos autenticadores **y** el prefijo de inbox. Las tres cosas son obligatorias:

```ts
import { connect, credsAuthenticator, tokenAuthenticator } from 'nats';

const nc = await connect({
  servers: process.env.NATS_URL,
  authenticator: [
    credsAuthenticator(readFileSync(process.env.NATS_CREDS!)), // sentinel: no da permisos solo
    tokenAuthenticator(() => currentZitadelToken()),            // dispara el auth-callout
  ],
  inboxPrefix: inboxPrefix(serviceUserId),                      // ⚠ ver abajo
  name: 'mi-conector',
});
```

**El token de Zitadel vence en ~1 h** y hay que renovarlo en caliente, no por variable de
entorno. Se obtiene con el flujo JWT profile (*private_key_jwt*) usando la JSON key. Como
referencia está [`packages/zitadel-auth/src/index.ts`](https://github.com/gravadigital/jiku/blob/v1.6.0/packages/zitadel-auth/src/index.ts),
que hace exactamente eso con auto-refresh.

#### ⚠ `inboxPrefix`: el error más caro de diagnosticar

Las respuestas vuelven por `_INBOX.<hash>.>`, y **es el único inbox que la plantilla autoriza**.
Si no se fija `inboxPrefix`, la librería genera `_INBOX.<aleatorio>`, las respuestas nunca
llegan y **el síntoma es un timeout, no un error de permisos**.

```
hash = primeros 16 caracteres de lowercase(base32_sin_padding(sha256(userId)))
inboxPrefix = "_INBOX." + hash
```

`userId` es el `sub` del machine user (el campo `userId` de la JSON key). La implementación de
referencia es `hashUserId()` en
[`packages/nats-protocol/src/index.ts`](https://github.com/gravadigital/jiku/blob/v1.6.0/packages/nats-protocol/src/index.ts).

> Los paquetes `@jiku/*` son **privados** (`"private": true`), no están en npm. Si el conector
> está en TypeScript pueden copiar las funciones puras que necesiten (gramática de subjects,
> hash del inbox) — son pocas líneas — o acordar con el equipo de Jiku cómo consumirlos.

### 3.4 El espejo de identidad (y una trampa de arranque)

`core` necesita **una fila en `users`** para el conector. Esa fila se crea sola: cada vez que una
identidad se autentica contra el bus, el auth-callout publica un evento (`{instance}.events.auth`)
y `core` lo espeja. El conector no tiene que hacer nada.

**Pero esa entrega no es durable.** Si `core` está caído o reiniciando en el momento en que el
conector se conecta, el evento se pierde y el conector queda **sin fila**. Los síntomas:

- consultas → `unknown_caller`
- comandos → `caller_not_authorized`

…hasta su próxima autenticación, que con un token renovado en caliente puede no ocurrir en días.

**Qué hacer:** tratar esos dos códigos al arrancar como señal de "reconectar". Cerrar la conexión
y abrir una nueva fuerza una autenticación nueva y, con ella, un evento nuevo. Y dentro de lo
posible, arrancar el conector después de que `core` esté arriba.

---

## 4. La gramática de los subjects

```
Comandos y consultas:  {instance}.{user-id}.{svc}.{version}.{método}
                       prod.281234567890123456.jiku-commands.v1.requirements.new
                       prod.281234567890123456.jiku-queries.v1.tasks.list

Eventos de dominio:    {instance}.events.{version}.{entidad}.{acción}
                       prod.events.v1.requirement.state.changed
```

| Segmento | Valor |
|---|---|
| `instance` | `dev` / `prod` (`NATS_INSTANCE` de la instalación). Aísla despliegues que comparten NATS |
| `user-id` | El `sub` del token del conector, **crudo**. El callout solo lo deja publicar bajo el propio |
| `svc` | `jiku-commands` (escrituras) o `jiku-queries` (lecturas) |
| `version` | `v1`. **Comandos/consultas y eventos se versionan por separado** (`NATS_PROTOCOL_VERSION` y `NATS_EVENTS_VERSION`) |
| `método` | Ej. `clients.new`, `requirements.{id}.edit`. Los `{param}` van **en el subject** en comandos; en consultas el id va **en el payload** |

**No se suscriban a `{instance}.events.>`** (sin versión): ese wildcard también agarra
`{instance}.events.auth`, que es otro publicador con otra semántica y que su plantilla no
autoriza de todos modos.

---

## 5. Leer: el plano de consultas (`jiku-queries`)

**Contrato:** [`docs/apis/core-queries.yaml`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/apis/core-queries.yaml) ·
**Flujo completo:** [`docs/flows/consulta-por-el-bus.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/flows/consulta-por-el-bus.md)

### 5.1 Recursos y operaciones

16 recursos, 23 endpoints. `get` existe solo donde hay pantalla de detalle; traer varios por id
es `list` con `filter.id: [1, 2, 3]`.

| Recurso | Operaciones | Notas |
|---|---|---|
| `clients` | `list`, `get` | Los "actores" (clientes) |
| `projects` | `list`, `get` | |
| `requirements` | `list`, `get`, `tags` | `tags` exige `filter.projectId` y no pagina |
| `tasks` | `list`, `get` | En la base es `objectives`; en el bus, `task` |
| `comments` | `list`, `get` | **Exigen `entityType`**: los ids de comentarios de tarea y de requisito se pisan |
| `activity` | `list` | Ídem, exige `entityType` |
| `subscriptions` | `list` | Ídem, exige `entityType` |
| `attachments` | `list` | El vínculo archivo ↔ entidad. Sin `get` |
| `files` | `get` | Metadatos del archivo. Sin `list` (se listan por `attachments`) |
| `people`, `users` | `list` | **`personId` (número) ≠ `userId` (el `sub` de Zitadel)**. Confundirlos es un bug silencioso |
| `worked-times`, `unworked-times`, `week-assigned-times` | `list` | Horas trabajadas, ausencias y asignación semanal |
| `project-permissions` | `list` | Qué usuario externo ve qué proyecto |
| `settings` | `list` | Configuración del sistema (lista blanca de claves) |
| `meta` | `describe` | **Describe el contrato en datos**: campos, filtros, orden, enums con sus etiquetas |

**Empiecen por `meta.describe`.** Devuelve, por recurso, qué campos hay, cuáles son filtrables
y ordenables, los defaults y **los valores válidos de cada enum**. Se genera de las mismas
estructuras que validan, así que no puede desactualizarse.

### 5.2 La forma de una consulta

```jsonc
// list
{
  "filter":  { "projectId": 12, "state": ["backlog", "activo"],
               "createdAt": { "gte": "2026-08-01T00:00:00.000Z" },
               "or": [ { "state": "activo" }, { "state": "finalizado" } ] },
  "sort":    ["-createdAt"],              // "-" = descendente; siempre se agrega "id" al final
  "page":    { "limit": 50, "cursor": null },
  "fields":  ["id", "title", "state"],   // default: el conjunto "base" del recurso
  "include": ["description", "project"],
  "count":   false                        // true → page.total exacto; "only" → solo el total
}

// get
{ "id": 8140, "fields": [], "include": [] }
```

- **Nunca manden identidad en el payload** (`creator`, `userId` del caller, etc.): responde
  `invalid_fields`. La identidad sale del subject.
- Un nombre no declarado en `filter`, `sort`, `fields` o `include` **es `invalid_fields`**, con
  `errorDetails: { field, value, allowed }`. Nunca se ignora.
- `filter.or` admite **un solo nivel**.
- `page.limit`: default 50, **máximo 200** (más se recorta sin avisar).
- Las colecciones incluidas traen **los 10 más recientes** y marcan `"<relación>Truncated": true`.

### 5.3 Paginación: keyset con presupuesto de bytes

```ts
let cursor: string | null = null;
do {
  const res = await query('tasks.list', { filter, sort, page: { limit: 200, cursor } });
  procesar(res.data.items);
  cursor = res.data.page.cursor ?? null;
} while (cursor);
```

Tres reglas que no son obvias:

1. **La ausencia de `page.cursor` es la ÚNICA señal de fin.** `returned < limit` no significa
   nada: `core` corta la página cuando la respuesta llega a la mitad del `max_payload` de NATS,
   aunque falten items del `limit`.
2. **Entre páginas, `filter` y `sort` tienen que ser idénticos**, o la respuesta es
   `invalid_cursor`. El `limit` sí puede cambiar.
3. Un item que por sí solo no entra se devuelve con el texto truncado y marcado
   (`bodyTruncated: true`). Si necesitan el texto completo, pídanlo con `get`.

### 5.4 Respuesta y errores

```jsonc
{ "status": "success", "data": { "items": [ … ], "page": { "limit": 200, "returned": 173, "cursor": "eyJ…" } } }
{ "status": "success", "data": { "id": 8140, "title": "…" } }          // get
{ "status": "failure", "errorCode": "invalid_fields", "errorMessage": "…", "errorDetails": { … } }
```

| Código | Significado | Qué hacer |
|---|---|---|
| `invalid_fields` | Campo, filtro u orden no declarado; `get` con `page`; falta `entityType` | Bug del conector |
| `invalid_cursor` | Cambió `filter`/`sort` entre páginas | Reiniciar la paginación |
| `{recurso}_not_found` | En un `get`: no existe **o** no es visible (no se distinguen) | — |
| `query_timeout` | La consulta superó los 8 s de la base | Achicar el filtro o el `limit` |
| `unknown_caller` / `caller_not_authorized` | El conector no tiene fila en `users` (§3.4) o el rol no autoriza | Reconectar |
| `internal_error` | Cualquier otra cosa | Reintentar con backoff; las consultas no tienen efectos |

Un `list` sin resultados es `success` con `items: []`, nunca `*_not_found`.

**Timeout recomendado del lado del conector: 10 s.** Tiene que quedar por encima de los 8 s del
`statement_timeout` de la base, para que el error explicable (`query_timeout`) llegue antes que
un timeout mudo del bus.

---

## 6. Escribir: el plano de comandos (`jiku-commands`)

**Contrato:** [`docs/apis/core.yaml`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/apis/core.yaml) ·
**Flujo completo:** [`docs/flows/escritura-por-el-bus.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/flows/escritura-por-el-bus.md)

### 6.1 Los comandos

| Módulo | Comandos |
|---|---|
| Actores | `clients.new`, `clients.{id}.edit` |
| Proyectos | `projects.new`, `projects.{id}.edit` |
| Requisitos | `requirements.new`, `requirements.{id}.edit`, `requirements.{id}.resolve`, `requirements.{id}.comment`, `requirements.{id}.comment.{cid}.edit`, `requirements.{id}.subscriptors.new`, `requirements.{id}.subscriptors.{userId}.delete` |
| Tareas | `tasks.new`, `tasks.{id}.edit`, `tasks.{id}.comment`, `tasks.{id}.comment.{cid}.edit` |
| Archivos | `files.request-upload`, `files.{fileId}.request-download`, `attachments.{id}.delete` |
| Horas | `worked-times.new`, `worked-times.{id}.delete`, `unworked-times.new`, `unworked-times.{id}.delete`, `week-assigned-times.replace` |

El payload de cada uno, los campos obligatorios y los códigos de error que puede devolver
(`x-error-codes`) están en `core.yaml`. Los esquemas Joi de `core` **rechazan claves
desconocidas**.

### 6.2 La respuesta

```jsonc
{ "status": "success", "data": { "id": 1234 } }
{ "status": "failure", "errorCode": "daily_limit_exceeded", "errorMessage": "…", "errorDetails": { … } }
```

**`core` devuelve solo el `id`** (salvo los comandos de archivos, que devuelven la URL firmada).
Si necesitan el recurso completo, consúltenlo después por `jiku-queries`.

### 6.3 Autoría: el conector escribe como sí mismo

Esto es lo más importante de la sección. **Todo lo que escriba el conector queda atribuido a su
machine user**, no a una persona:

- Los campos de autoría del payload (`creator`, `author`, `editor`, `uploader`) **se ignoran**
  si el caller no es la `api`. `core` loguea un `warn` y usa el user id del subject.
- La clave reservada `actor` (con la que la `api` declara a la persona que actúa) **solo la
  puede mandar la `api`**. Si el conector la manda, la respuesta es `invalid_fields`.
- En la interfaz, el autor aparece como identidad de servicio (`users.identity_type = 'service'`).

**Hoy no hay forma de que un conector escriba "en nombre de" una persona.** Si su caso lo
necesita (por ejemplo, un bot de chat donde cada mensaje tiene un autor humano), es una decisión
de diseño a plantear con el equipo de Jiku antes de empezar — no hay workaround seguro.

### 6.4 Timeouts, reintentos e idempotencia

Los comandos **no son idempotentes** y **no hay JetStream** en este plano. Distingan los fallos:

| Lo que ven | Qué pasó | ¿Se puede reintentar? |
|---|---|---|
| `no responders` (NATS) | Nadie atiende el subject: `core` caído o mal desplegado. El comando **no se recibió** | **Sí** |
| Timeout (sin respuesta) | `core` no contestó a tiempo. El comando **puede haberse aplicado** | **No a ciegas.** Verifiquen con una consulta antes |
| `status: failure` | `core` rechazó y **hizo rollback**: no quedó nada escrito | Solo si el error es transitorio (`internal_error`) |

Timeout recomendado: **5 s** (el mismo que usa la `api`, `NATS_REQUEST_TIMEOUT_MS`).

**Para que el reintento sea seguro, diseñen su propia clave de deduplicación.** Por ejemplo,
guardar en una tabla del conector el id externo → id de Jiku antes de reintentar, o buscar la
entidad por un tag que el conector controle (`requirements` admite `tags` `{key, value}`
filtrables por par exacto, p. ej. `{ "key": "origen-id", "value": "EXT-123" }`). Ojo: las
`properties` de `projects` se pueden incluir pero **no filtrar**.

### 6.5 Reglas de negocio que `core` aplica

Las aplica igual para cualquier caller. Las más probables de chocar:

| Regla | Código |
|---|---|
| Horas: solo hoy y los 10 días previos | `invalid_date_range` |
| Tope diario de 1440 minutos (horas + ausencias) | `daily_limit_exceeded` |
| `worked-times`: `taskId` y `requirementId` son excluyentes | `invalid_fields` |
| No se modifican semanas pasadas de la asignación | `invalid_date_range` |
| Resolver una `incidencia` exige tipo y conclusión | `resolution_required` |
| Solo se vinculan archivos que subió el mismo caller | `file_not_owned` |
| Una tarea con `requirementId` tiene que ser del mismo proyecto | `requirement_project_mismatch` |
| Subir un archivo: tamaño y doble lista blanca (extensión + MIME), leídas en caliente de `settings` | `file_too_large`, `file_type_not_allowed` |

**Los enums de estado, prioridad y tipo están en español** (`en_cola`, `sin_prioridad`,
`incidencia`…). Trátenlos como identificadores opacos y tómenlos de `meta.describe`, no del
código.

### 6.6 Efectos de un comando además de la fila

Un comando exitoso puede, además:

- **publicar eventos de dominio** (§7), después del commit;
- **encolar notificaciones por mail** dentro de la misma transacción — `core` ya manda
  mails de requisitos a sus suscriptores. **Si el conector también notifica, coordinen para no
  duplicar avisos.**

---

## 7. Reaccionar: los eventos de dominio (`JIKU_EVENTS`)

**Contrato:** [`docs/apis/core-events.yaml`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/apis/core-events.yaml) ·
**Flujo completo:** [`docs/flows/eventos-de-dominio.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/flows/eventos-de-dominio.md)

Este es el plano pensado para conectores: **reaccionar a lo que pasa sin hacer polling**.

### 7.1 Cómo se producen

```
comando → valida → escribe → COMMIT → core publica los eventos al stream → responde al caller
                                          │
                                          └─ si el publish falla: se loguea y el evento SE PIERDE
```

- Se publican **solo si el comando terminó en `success`**, y **después del commit**: un evento
  siempre describe algo que ya está en la base.
- **Best-effort, sin outbox, sin reintento.** Un fallo de publicación deja el dato escrito y el
  evento perdido. El único rastro es una línea `[events] publish failed …` en el log de `core`.
- Un mismo comando puede emitir varios eventos (un `requirements.{id}.edit` hasta cuatro); todos
  comparten `correlationId`.

### 7.2 El stream

| Parámetro | Valor |
|---|---|
| Nombre | `JIKU_EVENTS` (igual en todas las instalaciones; cada una tiene su cuenta NATS) |
| Subjects | `{instance}.events.v1.>` |
| Retención | `limits`, **`max_age` 7 días** |
| Entrega | **At-least-once** |

### 7.3 Consumir

Un **durable propio por conector**, con nombre único (los permisos no aíslan los durables entre
conectores: si dos usan el mismo nombre, se pisan).

```ts
const jsm = await nc.jetstreamManager();
await jsm.consumers.add('JIKU_EVENTS', {
  durable_name: 'conector-<nombre>',
  filter_subject: `${INSTANCE}.events.v1.>`,   // o más fino: `${INSTANCE}.events.v1.requirement.>`
  ack_policy: AckPolicy.Explicit,
  deliver_policy: DeliverPolicy.All,           // la primera vez; después retoma donde quedó
});

const consumer = await nc.jetstream().consumers.get('JIKU_EVENTS', 'conector-<nombre>');
for await (const msg of await consumer.consume()) {
  const event = msg.json<DomainEvent>();
  if (await yaProcesado(event.eventId)) { msg.ack(); continue; }   // at-least-once
  await procesar(event);
  await marcarProcesado(event.eventId);
  msg.ack();
}
```

Los permisos cubren solo lo que un consumidor durable necesita (`$JS.API.INFO`,
`STREAM.INFO.JIKU_EVENTS`, `CONSUMER.CREATE/DURABLE.CREATE/INFO/MSG.NEXT` sobre `JIKU_EVENTS`).
**No pueden borrar ni modificar el stream, ni borrar su propio durable**: eso lo hace quien opera
la instalación.

Referencia completa y funcionando: el consumidor de prueba del repositorio de Jiku,
[`core/tests/tools/events-test-consumer.ts`](https://github.com/gravadigital/jiku/blob/v1.6.0/core/tests/tools/events-test-consumer.ts), que
valida cada mensaje contra el contrato.

### 7.4 El catálogo (16 eventos)

| Evento | Lo emite |
|---|---|
| `requirement.created` | `requirements.new` |
| `requirement.state.changed` | `requirements.{id}.edit` |
| `requirement.updated` | `requirements.{id}.edit` (cualquier campo salvo el estado) |
| `requirement.assigned` | `requirements.{id}.edit` (cambian los responsables) |
| `requirement.resolved` | `requirements.{id}.edit` — trae `resolutionType`/`Conclusion`/`Comment` en `changes` |
| `requirement.reopened` | `requirements.{id}.edit` |
| `requirement.comment.created` | `requirements.{id}.comment` |
| `requirement.comment.edited` | `requirements.{id}.comment.{cid}.edit` |
| `requirement.subscriptor.added` | `requirements.{id}.subscriptors.new` |
| `requirement.subscriptor.removed` | `requirements.{id}.subscriptors.{userId}.delete` |
| `task.created` | `tasks.new` |
| `task.state.changed` | `tasks.{id}.edit` |
| `task.updated` | `tasks.{id}.edit` |
| `task.assigned` | `tasks.{id}.edit` |
| `task.comment.created` | `tasks.{id}.comment` |
| `task.comment.edited` | `tasks.{id}.comment.{cid}.edit` |

**No hay eventos de proyectos, actores, adjuntos, horas ni ausencias.** Están previstos
(`project.created`, `client.created`, `attachment.linked`…) "cuando exista un conector que los
pida". Si su conector los necesita, es un pedido al equipo de Jiku.

### 7.5 El sobre

```jsonc
{
  "eventId": "01J…",                  // ULID — clave de deduplicación
  "type": "requirement.state.changed", // = la cola del subject
  "version": "v1",
  "occurredAt": "2026-10-24T13:02:11.123Z",
  "correlationId": "…",               // común a los eventos del mismo comando
  "actor":  { "id": "<sub>", "name": "Ana Pérez" },
  "entity": { "type": "requirement", "id": 812, "projectId": 12 },
  "snapshot": { … },                  // la entidad completa DESPUÉS del cambio
  "changes": { … },                   // qué cambió (según el evento)
  "recipients": { "subscriptors": [ … ], "responsiblePersonIds": [ … ] },  // solo requisitos
  "comment": { "id": 55, "body": "…", "fileIds": [] },                    // solo comentarios
  "visibilityLevel": "public"
}
```

Lo que hay que saber del sobre:

- **`additionalProperties: false`**: si validan contra el contrato, todo campo fuera de la lista
  hace fallar la validación.
- **Todo dato de la entidad va dentro de `snapshot`.** Quedan afuera a propósito las relaciones
  (viajan como ids), las colecciones, `totalMinutes` y los textos internos largos (`scope`,
  `technicalSolution`, `acceptanceCriteria`). Si los necesitan, consulten.
- **`TaskSnapshot` trae `priority` (enum) y `priorityValue` (entero).** Es deliberado.
- **`recipients` solo en eventos de requisito.** `subscriptors` puede venir vacío y **puede traer
  duplicados** (deduplicar por `userId`). Un suscriptor con `email: null` es una identidad de
  servicio: **sáltenlo**, no es un dato faltante.
- **`responsiblePersonIds` son ids de `people`, no de `users`.** Para avisarle a un responsable
  hay que resolver Persona → Usuario, y puede no haber a quién resolver.
- **`visibilityLevel`**: el conector ve también lo interno (§3.2). Si reenvían el evento a un
  cliente, filtren por esto.

### 7.6 Lo que el stream NO es

- **No es una fuente reconstruible de estado.** Solo lleva lo que cambió y solo durante 7 días.
- **No hay forma de saber qué eventos se perdieron**, ni por publish fallido ni por quedar el
  conector caído más de 7 días.

Por eso el patrón recomendado es **eventos para reaccionar rápido + consultas para reconciliar**
(§9).

---

## 8. Archivos

**Flujos:** [`subida-de-archivos.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/flows/subida-de-archivos.md) ·
[`vinculacion-de-archivos.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/flows/vinculacion-de-archivos.md) ·
[`lectura-de-archivos.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/flows/lectura-de-archivos.md)

**El byte nunca viaja por el bus** (el `max_payload` es 1 MB). Son tres pasos separados:

1. **Permiso:** comando `files.request-upload` con `fileName`, `mimeType`, `fileSize` y
   `checksum`. `core` valida la política, crea la fila de `files` y devuelve
   `{ id, uploadUrl, expiresIn }`.
2. **Byte:** `PUT` directo al `uploadUrl` (S3 prefirmado). No modifiquen el host de la URL: la
   firma lo incluye.
3. **Vínculo:** mandar el `id` en `fileIds` del comando de dominio (`requirements.new`,
   `tasks.{id}.comment`, etc.). Hasta 10 por comando.

Para descargar: `files.{fileId}.request-download` devuelve una URL prefirmada de `GET`. Esa URL
da acceso **sin credenciales** hasta que vence: no la reenvíen a terceros sin pensarlo.

`files.uploaded_by` queda con el machine user del conector, y **solo ese mismo caller puede
vincular el archivo** (`file_not_owned` en otro caso).

---

## 9. Patrones recomendados

**Sincronización hacia afuera (Jiku → otro sistema):**

1. **Carga inicial** por consultas, paginando con cursor.
2. **Cambios en vivo** por eventos, con durable propio y deduplicación por `eventId`.
3. **Reconciliación periódica** por consultas (por ejemplo, `requirements.list` con
   `filter.updatedAt.gte` desde la última corrida), para cubrir eventos perdidos.
4. Ante un evento, si necesitan más de lo que trae el `snapshot`, hagan un `get`.

**Sincronización hacia adentro (otro sistema → Jiku):**

1. Guarden el mapeo id externo ↔ id de Jiku **antes** de dar por hecha la operación.
2. Ante un timeout, **consulten antes de reintentar** (§6.4).
3. Ignoren los eventos que produjo el propio conector (`actor.id` = su user id), o van a entrar
   en bucle.

**Siempre:**

- Validen los mensajes contra los contratos en sus tests. Los tres AsyncAPI son la fuente de
  verdad.
- Un campo nuevo en una respuesta o en un evento **no es un cambio incompatible** dentro de `v1`.
  Su parser tiene que tolerarlo.
- Logueen `correlationId`, `eventId`, el método y el `errorCode`; **no logueen payloads**:
  traen datos de negocio y personales.

---

## 10. Entorno de desarrollo

### 10.1 Levantar Jiku

Requisitos: Node.js 24, Docker, `nsc`.

```sh
npm install && npm run build
cd deploy/nats && ./bootstrap.sh          # identidad de NATS, una vez por instalación
cd .. && cp .env.dist .env
docker compose -f docker-compose.local.yml up   # con Zitadel real
```

Detalle completo en [`deploy/README.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/deploy/README.md) y
[`documentation/installation.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/documentation/installation.md). El stream de eventos lo
crea `deploy/nats/create-events-stream.sh` (es idempotente).

### 10.2 Sin Zitadel (IdP mock)

`docker-compose.dev.yml` levanta el callout con un IdP falso: el token es el texto
`mock:<sub>:<username>:<roles>`, por ejemplo `mock:conector-dev:conector:internal-app`.

**Limitación importante:** con el mock, el evento de autenticación llega sin `name` y `core` lo
descarta, así que **el conector no queda espejado en `users`** y todas sus llamadas dan
`unknown_caller`. Para trabajar con el mock hay que insertar la fila a mano en la base local:

```sql
INSERT INTO users (id, name, username, email, roles, identity_type)
VALUES ('conector-dev', 'Conector dev', 'conector', NULL, '["internal-app"]', 'service');
```

Para el camino real del espejo, usen `docker-compose.local.yml` con Zitadel.

### 10.3 Herramientas

| Herramienta | Para qué |
|---|---|
| `deploy/zitadel-token.sh --check <key.json>` | Ver si el token es JWT, cuándo vence y qué roles trae |
| `deploy/bus-inspect.sh tail` / `logs` | Ver los comandos que procesa `core` (con `LOG_COMMANDS=true`) |
| `deploy/bus-inspect.sh send <comando> '<json>'` | Publicar un comando a mano |
| `nats micro info jiku-commands` / `jiku-queries` | Listar los endpoints vivos de `core` |
| `deploy/nats/events-test-consumer.sh` | Consumir el stream y validar cada evento contra el contrato |

---

## 11. Diagnóstico rápido

| Síntoma | Causa probable |
|---|---|
| `Authorization Violation` al conectar | Token opaco (Access Token Type ≠ JWT), rol faltante, o proyecto de Zitadel equivocado |
| **Timeout en todas las requests** | **Falta `inboxPrefix`**, o está mal calculado |
| `unknown_caller` / `caller_not_authorized` en todo | Sin fila en `users`: el evento de autenticación se perdió (§3.4). Reconectar |
| `no responders` | `core` caído, o `NATS_INSTANCE` distinto del de la instalación |
| El durable se crea pero no llega ningún evento | `filter_subject` sin la versión o con otra instancia; o simplemente no hubo comandos que emitan eventos |
| El proceso se reinicia en loop | Una suscripción no autorizada: la violación de permisos es **asíncrona** y en nats.js llega como `uncaughtException`. Revisar en el log del servidor NATS (`Subscription Violation`) |
| `invalid_fields` en un comando | Clave desconocida en el payload, o mandaron `actor` |
| `file_not_owned` | Intentan vincular un archivo que subió otro caller |

---

## 12. Checklist antes de producción

- [ ] Machine user con **Access Token Type = JWT** y rol **`internal-app`**, verificado con `zitadel-token.sh --check`.
- [ ] Token renovado en caliente antes de su vencimiento (~1 h).
- [ ] `inboxPrefix` fijado con el hash del `sub`.
- [ ] `NATS_INSTANCE` correcto para el entorno.
- [ ] Manejo de `unknown_caller` / `caller_not_authorized` al arrancar → reconexión.
- [ ] Timeouts: 5 s comandos, 10 s consultas.
- [ ] Ningún reintento ciego de comandos tras un timeout.
- [ ] Durable con **nombre único**, ack explícito, deduplicación por `eventId` persistida.
- [ ] Reconciliación periódica por consultas (eventos perdidos o más de 7 días caído).
- [ ] **Filtrado de visibilidad propio** si los datos salen hacia clientes o terceros.
- [ ] El conector ignora los eventos que él mismo provocó.
- [ ] Sin payloads en los logs.
- [ ] Coordinado con el equipo de Jiku si el conector también notifica por mail.

---

## 13. Límites actuales y temas para hablar con el equipo de Jiku

Antes de diseñar, confirmen que su caso no choca con alguno de estos:

| Límite | Impacto |
|---|---|
| **`internal-app` lo concede todo** | Un conector de solo lectura, o restringido a algunos proyectos, requiere un rol nuevo en Jiku |
| **No se puede escribir en nombre de una persona** | Todo lo que escriba el conector queda a nombre de su machine user |
| **Eventos solo de requisitos y tareas** | Proyectos, actores, adjuntos y horas: solo por consultas |
| **Eventos best-effort, retención de 7 días** | Hace falta reconciliación |
| **Comandos sin idempotencia ni durabilidad** | La deduplicación es del conector |
| **El catálogo de errores no está cerrado** | Puede aparecer un `errorCode` que no conocen: trátenlo como error genérico |
| **Mensajes de error en español, pensados para la UI** | Decidan por `errorCode`, nunca por `errorMessage` |
| **Revocar el rol en Zitadel tiene efecto en el bus recién en la próxima autenticación** | Para cortar el acceso de un conector hay que forzarle la reconexión |
| **Sin rate limiting** | Sean prudentes con el volumen de consultas: `core` comparte la base con todo el producto |

---

## 14. Referencias

| Documento | Para qué |
|---|---|
| [`docs/apis/core-queries.yaml`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/apis/core-queries.yaml) | Contrato de las consultas |
| [`docs/apis/core.yaml`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/apis/core.yaml) | Contrato de los comandos y del `Reply` |
| [`docs/apis/core-events.yaml`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/apis/core-events.yaml) | Contrato de los eventos de dominio |
| [`deploy/nats/auth-callout/README.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/deploy/nats/auth-callout/README.md) | La política de acceso al bus |
| [`deploy/README.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/deploy/README.md) | Despliegue, alta de servicios externos, diagnóstico |
| [`docs/flows/consulta-por-el-bus.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/flows/consulta-por-el-bus.md) | Recorrido completo de una consulta |
| [`docs/flows/escritura-por-el-bus.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/flows/escritura-por-el-bus.md) | Recorrido completo de un comando |
| [`docs/flows/eventos-de-dominio.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/flows/eventos-de-dominio.md) | Recorrido completo de un evento |
| [`docs/flows/sincronizacion-de-identidades.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/flows/sincronizacion-de-identidades.md) | El espejo de `users` |
| [`docs/db-schemas/jiku.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/docs/db-schemas/jiku.md) | El modelo de datos (solo para entender; nunca se accede directo) |
| [`documentation/known-limitations.md`](https://github.com/gravadigital/jiku/blob/v1.6.0/documentation/known-limitations.md) | Limitaciones conocidas del producto |
| [`packages/nats-protocol/src/index.ts`](https://github.com/gravadigital/jiku/blob/v1.6.0/packages/nats-protocol/src/index.ts) | Implementación de referencia de subjects, inbox, `Reply` y tipos de eventos |
| [`core/tests/tools/events-test-consumer.ts`](https://github.com/gravadigital/jiku/blob/v1.6.0/core/tests/tools/events-test-consumer.ts) | Consumidor de eventos de referencia |
