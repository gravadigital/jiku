# Arquitectura: api — Overview

## Qué es

La única puerta HTTP de Jiku. Autentica contra Zitadel, autoriza por rol y por entidad,
**lee la base de datos directamente** y convierte toda mutación en un comando publicado en
NATS que atiende `core`.

- **Tipo:** api (servicio HTTP) · **Lenguaje:** node (TypeScript) · **Path:** `api/`
- **Expone:** 61 endpoints REST bajo `/api` — 49 internos y 12 en `/api/opus/*`
- **Consume:** PostgreSQL (solo lectura), NATS (→ core), Zitadel, storage S3-compatible

## La decisión estructural: lee la base, escribe por el bus

Es lo que define el servicio y condiciona todo lo demás. Está desarrollada en
[`conventions/bus-commands.md`](./conventions/bus-commands.md); acá el resumen:

**Casi no escribe.** Conecta con un rol de PostgreSQL de solo lectura
(`api/lib/models/index.ts:19-31`). La separación lectura/escritura es una decisión de
infraestructura, no de estilo.

**Tres excepciones:**

| Excepción | Dónde | Estado |
|---|---|---|
| Las migraciones | `db-upgrade/config.js:10-14` | **Deliberada.** Corren al arrancar con credenciales propias (`POSTGRESQL_MIGRATION_USER`), cayendo a las de la api solo si no están definidas. La api es la dueña del esquema |
| La fila de `attachments` | `lib/routes/attachments-post.ts:105-118` | **Deuda.** `Attachment.create()` sin pasar por el bus, con las credenciales de la api |
| `PUT /api/week-assigned-times` | `lib/routes/week-assigned-times-put.ts:39-78` | **Deuda.** `destroy` + `bulkCreate` en una transacción: la única ruta que escribe con el ORM, y la única que usa los middlewares de transacción. Nunca se convirtió en comando, y su futuro está sin decidir |

> Las dos últimas escriben con las credenciales de solo lectura y funcionan porque el rol de la
> instalación se lo permite. Contra un rol estrictamente `SELECT` fallarían.

**Toda otra mutación** se publica como comando y espera respuesta. Después de publicar, la api
**relee la base** para armar la respuesta: core solo devuelve el `id`, pero el contrato con los
fronts es el recurso completo con sus relaciones.

## Estructura

No es MVC ni Clean Architecture: es **un archivo por endpoint**, con la validación, los
permisos y el handler colocados juntos.

```
api/
├── app.ts                    Express, middleware global, montaje de rutas
├── bin/index.ts              entry point; valida la config de auth ANTES de escuchar
├── config/public.ts          exenciones de autenticación (regex de lookahead negativo)
├── lib/
│   ├── routes/               61 archivos, uno por endpoint, + index.ts (barrel)
│   ├── models/index.ts       Sequelize de solo lectura; registra los modelos compartidos
│   ├── interfaces/           augmentación de Express.Request (user, project, transaction…)
│   ├── logger.ts             Winston
│   └── utils/
│       ├── bus/              cliente NATS, sendCommand/runCommand, protocolo, traductores
│       ├── middlewares/      7 compartidos: auth, roles, entidades del path, fechas
│       └── *.ts              validación, storage, permisos de adjuntos, helpers
├── db-upgrade/migrations/   103 migraciones, corren al arrancar
├── tests/                    61 archivos de rutas + utils + configuraciones
└── types/
```

El montaje es automático: `app.ts:35-37` itera `Object.keys(routes)` y hace
`app.use('/api', router)` sobre cada export del barrel. Agregar un endpoint es crear un archivo
y una línea en `lib/routes/index.ts`; nada más se toca.

## Módulos de dominio

Los módulos no son carpetas: son **grupos de archivos de ruta con un prefijo común**. Esa es la
particularidad de este servicio respecto de la estructura `domain/{module}/` del catálogo.

| Módulo | Prefijo de archivos | Endpoints | Superficie |
|---|---|---|---|
| `clients` | `clients-*` | 5 | "Actores" en la UI |
| `projects` | `projects-*` | 6 | Incluye `keyValuePairs` con los enlaces del proyecto |
| `requirements` | `requirements-*` | 8 | Con reglas de resolución propias de la api |
| `objectives` | `objectives-*` | 6 | "Tareas" en la UI, `task` en el bus |
| `worked-times` | `worked-times-*` | 8 | Carga de horas + 3 reportes |
| `unworked-times` | `unworked-times-*` | 5 | Ausencias y motivos |
| `week-assigned-times` | `week-assigned-times-*` | 2 | El único `PUT`; solo `admin` |
| `attachments` | `attachments-*` | 6 | S3, rollback, checksum |
| `opus` | `opus-*` | 12 | Portal de clientes, acotado por permiso de proyecto |
| `auth` | `auth-present-post`, `settings-get`, `persons-get` | 3 | `present` es hoy un no-op |

## Autenticación y autorización

Tres capas, detalladas en [`conventions/auth-jwt.md`](./conventions/auth-jwt.md) y
[`conventions/authorization.md`](./conventions/authorization.md).

1. **Global por método HTTP, no por ruta.** `app.ts:32-35` instala `validateToken` para todo
   path *excepto* las exenciones de `config/public.ts`, armadas como regex de lookahead
   negativo. Deny-by-default.

   > **Consecuencia para quien lee el código:** un archivo de ruta puede *parecer*
   > desprotegido y estar cubierto. No agregues `validateToken` "por si acaso" al ver una ruta
   > sin él, y no asumas que una ruta nueva es pública.

   Una sola exención hoy: `GET /api/opus/attachments/:id/public`, que tiene su propio control
   (valida `visibilityLevel === 'public'` por cada `entityType` y responde 403 en cualquier
   otro caso).

2. **Por rol:** `hasAnyRole([...])` sobre el claim `urn:zitadel:iam:org:project:roles`.
   Roles: `admin`, `user`, `external-user`.

3. **Por entidad:** `validateProjectPermissions` y `canUserAccessEntity` / `canUserViewEntity`
   restringen a `external-user` por `user_project_permissions`, resolviendo el proyecto desde
   9 tipos de entidad distintos.

## Traducciones de contrato api ↔ bus

El bus renombró conceptos que ni la base ni los frontends cambiaron. La api traduce en ambos
sentidos para no tocar el contrato HTTP.

| Contrato HTTP | Contrato del bus | Dónde |
|---|---|---|
| `objectives` | `tasks` | nombre del comando |
| `priority` numérica 0-5 | enum `sin_prioridad`…`urgente` | `lib/utils/bus/priority.ts` |
| `keyValuePairs` (objeto plano) | `properties` (lista `{code, value}`) | `lib/utils/bus/properties.ts` |
| `personIds` | `responsiblePersonIds` | `lib/routes/objectives-post.ts:33` |
| `objectiveId` | `taskId` | `lib/routes/worked-times-post.ts:124` |

> Al agregar un campo, decidí de qué lado vive el nombre. Si el bus lo llama distinto, la
> traducción va en `lib/utils/bus/` y no dispersa en los handlers.

## Reglas de negocio que viven acá y no en core

> **Esta sección tenía una premisa que ya no es cierta.** Decía: *"Core no conoce roles, ni
> usuarios finales, ni el calendario. Todo lo que dependa de eso se queda en la api"*. **El sobre
> de identidad de S-029 la derogó**: `core` recibe el actor y sus roles en cada comando, así que
> ahora *puede* aplicar reglas que dependen de quién actúa.

| Regla | Dónde | Por qué acá |
|---|---|---|
| No se modifican semanas pasadas | `middlewares/validate-week-not-past.ts` | Depende del calendario |
| Una incidencia no se resuelve sin tipo y conclusión | `requirements-id-patch.ts:36-58` | Combina el estado que llega con el que ya tiene, y devuelve un código que no está en el protocolo |
| Deadline para borrar una ausencia: 10 días desde `created_at` | `unworked-times-id-delete.ts` | **`deadline_exceeded` no está en el protocolo del bus**, y compara `created_at`, no `date`: es otra regla que la ventana de carga. `core` decidió explícitamente no tomarla (S-031) |
| Visibilidad automática de actividades | `utils/visibility-helper.ts` | Estado, título y descripción son `public`; el resto `internal`. Solo los comentarios permiten elegir |
| Límites de adjuntos: 10 archivos, 10 MB, 13 extensiones | `attachments-post.ts:15-31` | La api es la que recibe el multipart |

### Lo que se fue con REQ-007 (S-031)

Las tres reglas de horas que esta tabla listaba **ya no están en la api**, y con ellas el `.oxor`
de la exclusión tarea/requisito y la titularidad al borrar:

| Regla que estaba acá | Dónde vive ahora | Código |
|---|---|---|
| Ventana de carga: día actual + 10 previos (alta y borrado) | `core` · `commands/times/` | `invalid_date_range` → 400 |
| Solo `admin` imputa horas a otra persona | `core` · `worked-times.new` | `access_denied` → 403 |
| `personId` por default = Persona del **actor** | `core` · `worked-times.new` | `person_not_found` → 400 |
| Exclusión `objectiveId` / `requirementId` | `core` (única definición) | `invalid_fields` → 400 |
| Titularidad al borrar horas y ausencias | `core` | `access_denied` → 403 |

**Ninguna línea de UI cambió:** los status y los códigos son exactamente los mismos.

> **El criterio para decidir dónde vive una regla ya no es "¿necesita el rol, el usuario final o
> la fecha de hoy?".** Con el sobre, `core` tiene los tres. La pregunta ahora es **de quién es la
> regla**:
>
> - **Es del escritor** — decide si la operación puede ocurrir sobre estos datos, y tiene que dar
>   el mismo resultado por HTTP y por el bus → **va a `core`**, dentro del comando.
> - **Es del transporte HTTP** — la forma del input, la traducción de nombres de contrato, el 404
>   de la entidad del path, un código que el protocolo del bus no tiene → **se queda en la api**.
>
> El despachador de `core` decide *"¿tu rol habilita este método?"*; el comando decide *"¿podés
> hacer esto con estos datos?"*; la api decide *"¿esta request está bien formada y a quién
> corresponde?"*.

## Integraciones

| Integración | Detalle |
|---|---|
| **Zitadel** | JWKS en `{IDENTITY_URL}/oauth/v2/keys`, resincronizado con reintentos cuando aparece un `kid` desconocido. Service user con JSON key para autenticarse en el bus, con auto-refresh del token (caduca en ~1h) |
| **NATS → core** | 13 formas de comando. Subject `{instance}.{user-id}.gestion.v1.{comando}`. El `user-id` va crudo; el inbox usa un hash del mismo id, y hay que fijar `inboxPrefix` explícitamente o las respuestas no llegan |
| **Storage S3-compatible** | Sirve AWS S3, MinIO, DigitalOcean Spaces o Cloudflare R2. Sin defaults para bucket y región a propósito |
| **Paquetes del monorepo** | `@jiku/models` (26 modelos, compartidos con core), `@jiku/nats-protocol` (contrato del bus), `@jiku/zitadel-auth` (token del service user) |

## Limitaciones conocidas

Registradas en `documentation/known-limitations.md` del repositorio y verificadas en el código.
Importan porque condicionan qué se puede planificar sobre este servicio.

1. **No se pueden crear usuarios desde el producto.** `POST /api/auth/present` es un **no-op**:
   era la única escritura que nunca se convirtió en comando, y con la api en solo-lectura ya no
   puede hacerla (`lib/routes/auth-present-post.ts`). Quien autentica pero no está en `users`
   recibe 401 `user_not_found` de todas las demás rutas. Hoy la única vía es insertarlo a mano.
   Sin definir si pasa a ser comando de core, lo resuelve el auth-callout, o la ruta conserva
   escritura propia.

2. **Las migraciones no construyen el esquema desde cero.** Las 103 asumen un esquema existente
   y ninguna crea `objectives`. Una instalación nueva necesita un dump previo (`DUMP_FILE`).

3. **Un comando perdido es un comando perdido.** Sin JetStream: sin reintentos, sin transacción
   distribuida, sin idempotencia garantizada. Si core escribe y la respuesta se pierde, el
   cliente ve un error de algo que sí ocurrió.

4. **Los códigos de error no están catalogados.** No hay lista cerrada ni mapeo documentado.
   `daily_limit_exceeded` lleva datos extra que la api **recupera parseando el mensaje con un
   regex** (`bus/protocol.ts:96-104`), porque el formato de respuesta no tiene dónde ponerlos.
   Explícitamente transitorio.

5. **Los mensajes de error son texto de interfaz.** Los fronts los muestran tal cual al
   usuario. Están mezclados: algunos en inglés, otros en español.

6. **Deuda visible en el código:**
   - `entityType: 'comment'` legado sin migrar, pendiente de confirmar en producción (S-096)
   - `stageId` se sigue aceptando y reenviando aunque la tabla `stages` ya no exista: la web
     todavía lo manda y los fronts no se tocan
   - Adjuntos históricos con `entityType: 'stage'` quedan sin proyecto contra el que verificar
     permisos, y por eso **no se autorizan**
   - `week-assigned-times` es el único `PUT` de la api, la única ruta que escribe con el ORM, y
     su futuro está sin decidir: puede mantenerse, rehacerse o eliminarse
   - Tres tablas sin uso quedaron de las notificaciones por mail eliminadas:
     `objective_mail_threads`, `requirement_mail_threads` e `inbound_mail_threads`. Ninguna
     migración las borra, porque eliminar un modelo no elimina su tabla y una migración
     destructiva perdería datos
