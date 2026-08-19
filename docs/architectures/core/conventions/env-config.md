---
id: env-config
display_name: Configuración de entorno (dotenv + process.env, con un assert de arranque)
language: node
description: dotenv loaded at entry, process.env read directly at construction time, one startup assert
applies_to: [worker]
required_by: []
package: dotenv
---

# Configuración de entorno (core)

> **Reemplaza** la convención `env-config` del catálogo, que usa `@t3-oss/env-core` con un esquema
> Zod validado al arrancar y un objeto `env` tipado. Este servicio usa `dotenv` y lee `process.env`
> directamente, **casi sin validación**: desde REQ-001 (S-002) hay **un** assert de arranque, el de
> `CORE_TRUSTED_PUBLISHER_ID`. `api` tiene dos.

## Cuándo aplica

Todo el servicio.

## Paquete

```
dotenv             # 17.2
```

## Carga

```ts
// core/src/index.ts — las dos primeras líneas del proceso
import * as dotenv from 'dotenv';
dotenv.config();
```

**Tiene que ser lo primero.** `src/models/index.ts` construye el Sequelize **al importarse**, leyendo
`process.env` en ese momento; si `dotenv.config()` corriera después de ese import, la conexión se
armaría con valores vacíos. El orden de imports en `src/index.ts` no es cosmético.

Los tests tienen el mismo problema resuelto de otra forma: ver [`testing`](./testing.md).

## Las variables

| Variable | Para qué | Default | Si falta |
|---|---|---|---|
| `POSTGRESQL_DB` | Base | — | Falla el arranque tras 5 reintentos |
| `POSTGRESQL_USER` | **Usuario dueño** de la base | — | Ídem |
| `POSTGRESQL_PASSWORD` | | — | Ídem |
| `POSTGRESQL_HOST` | | — | Ídem |
| `POSTGRESQL_PORT` | | `5432` | — |
| `NATS_URL` | El bus | `nats://localhost:4222` | — |
| `NATS_CREDS` | Path a las creds del sentinel | — | Se conecta sin ese autenticador |
| `ZITADEL_SERVICE_USER_KEY_B64` | Key del service user, en base64 | — | **La conexión al bus se rechaza** |
| `ZITADEL_ISSUER_URL` | Instancia de Zitadel | — | No se puede pedir el token |
| `ZITADEL_PROJECT_ID` | Proyecto que tiene los roles | — | El callout no matchea ninguna regla |
| `NATS_INSTANCE` | Primer segmento del subject | `dev` | — |
| `NATS_SERVICE_NAME` | Para qué servicio atiende | `gestion` | — |
| `NATS_PROTOCOL_VERSION` | Versión del protocolo | `v1` | — |
| `NATS_USER_ID` | Fallback del inbox sin service user (solo tests) | `SERVICE_NAME` | — |
| `NODE_ENV` | Entorno | `production` (en `models/`) | — |
| `LOG_COMMANDS` | Traza de comandos con payload | apagado | — |
| `CORE_TRUSTED_PUBLISHER_ID` | El `sub` del service user de la api, contra el que se compara el `caller` del subject | **ninguno, a propósito** | **Falla el arranque** (el único assert del servicio) |
| `STORAGE_S3_ENDPOINT` | Endpoint del proveedor compatible con S3 | — | Falla al construir el firmador |
| `STORAGE_S3_CREDENTIALS_ACCESSKEY` · `STORAGE_S3_CREDENTIALS_SECRETKEY` | Credenciales de firma, de **lectura y escritura** | — | Ídem |
| `STORAGE_S3_BUCKETNAME` · `STORAGE_S3_REGION` | Bucket y región | — | Ídem |
| `STORAGE_S3_FORCEPATHSTYLE` | `'true'` para MinIO y compatibles | `false` | — |
| `STORAGE_S3_KEY_PREFIX` | Prefijo de las claves de storage | `grava-gestion` | **Cambiarlo con datos cargados deja inaccesibles los archivos existentes** |
| `LOGGER_INFO_PATH` · `LOGGER_ERROR_PATH` · `LOGGER_*_LEVEL` · `LOGGER_FILE_MAX_SIZE` · `LOGGER_MAX_FILES` | Transports de archivo en producción | — | Los transports quedan con `filename: undefined` |

### La que rompe de forma no obvia

`ZITADEL_SERVICE_USER_KEY_B64`. Sin ella el servicio **arranca**, conecta a la base y falla al
conectarse al bus: las creds del sentinel no conceden permisos por sí solas — es el token el que
dispara el auth-callout que mintea los permisos. El síntoma es `Authorization Violation`, no una
variable faltante.

## Validación al arrancar: un solo assert

**Hay exactamente un assert**, y lo agregó S-002: `loadConfig()` en `src/config.ts`, invocado por
`src/index.ts` después de `dotenv.config()` y antes de `consumer.start()`. Lanza si
`CORE_TRUSTED_PUBLISHER_ID` está ausente **o vacío**.

**Por qué esta variable y no las otras candidatas:** su modo de fallo es silencioso y corrompe datos.
Un default vacío haría que ningún `caller` coincida con el publicador confiable, así que todos los
comandos caerían por la rama externa de `resolveActor`: `files.uploaded_by` quedaría con el service
user de la api en vez de la persona, y ningún usuario podría vincular lo que subió. El único síntoma
sería un `file_not_owned` — que parece un problema de permisos y no de configuración.

**El patrón `process.env.X || 'default'` está prohibido para esta variable**, aunque sea la convención
en todo el resto del servicio: `|| ''` es exactamente el bug que el assert previene.

Fuera de ese assert no hay esquema ni validación. Las consecuencias, para que no sorprendan:

- Una `POSTGRESQL_*` faltante se manifiesta como **cinco intentos de conexión fallidos** y después
  `Cant connect database`. No dice cuál falta.
- Los defaults de `NATS_*` viven en `@jiku/nats-protocol`
  (`process.env.NATS_SERVICE_NAME || 'gestion'`), no en core. Se leen **al importar el módulo**, así
  que cambiarlas en caliente no tiene efecto.
- Un `NATS_INSTANCE` mal escrito no da error: core se suscribe a un subject que nadie usa y **se
  queda esperando en silencio**. Es el modo de falla más difícil de diagnosticar del servicio.
- Los `LOGGER_*` numéricos pasan por `Number(undefined)` → `NaN` sin quejarse.

**Si se agregan más asserts, los candidatos por impacto siguen siendo `NATS_INSTANCE` y
`ZITADEL_SERVICE_USER_KEY_B64`.**

## Dónde se leen

| Variable | Dónde | Cuándo |
|---|---|---|
| `POSTGRESQL_*` | `src/models/index.ts:18-22` | **Al importar el módulo** |
| `NATS_*` (subject) | `packages/nats-protocol/src/index.ts:26-28` | **Al importar el paquete** |
| `NATS_URL`, `NATS_CREDS`, `NATS_USER_ID` | `src/bus/consumer.ts:31-35` | En `start()` |
| `ZITADEL_*` | `@jiku/zitadel-auth`, vía `serviceUserFromEnv()` | En `start()` |
| `LOGGER_*`, `NODE_ENV` | `src/logger.ts:12` | **Al importar el módulo** |
| `CORE_TRUSTED_PUBLISHER_ID` | `src/config.ts` | En `loadConfig()`, al arrancar — **nunca dentro de un comando** |
| `STORAGE_S3_*` | `src/commands/files/storage.ts` | Al construir el firmador, **perezosamente al primer uso** (no al importar: si no, la suite de tests no arrancaría sin credenciales) |
| `LOG_COMMANDS` | `src/bus/dispatcher.ts:33` | **En cada comando** |

Las que se leen al importar no se pueden cambiar en caliente. `LOG_COMMANDS` es la excepción: se
evalúa por comando.

## Tests

`core/.env.test` trae la configuración de CI; en local `tests/setup-env.ts` pisa host, puerto y
credenciales con los del contenedor efímero. Ver [`testing`](./testing.md).

## Reglas

- `dotenv.config()` va en las dos primeras líneas de `src/index.ts`, antes de cualquier otro import.
- **Un comando nunca lee `process.env`.** Las constantes de negocio son constantes de módulo.
- Una variable nueva se documenta en tres lugares: esta convención, `core/README.md` y
  `deploy/.env.dist`.
- Una variable nueva que el servicio necesita para funcionar va también en el `environment` de
  `deploy/docker-compose.yml`. Los `LOGGER_*` son el ejemplo de qué pasa si no.
- No pongas secretos en `deploy/.env.dist`: va con el valor vacío o un placeholder.
- Los defaults van donde se lee la variable, con `||`. No dupliques un default en dos archivos.
- No metas configuración de negocio en variables de entorno: el tope diario es una constante del
  código, y cambiarlo es un cambio de producto.

## Integración con otras convenciones

- **[`bus-consumer`](./bus-consumer.md)**: `NATS_*` y `ZITADEL_*`, y el modo de falla del subject.
- **[`orm`](./orm.md)**: `POSTGRESQL_*` y el reintento de conexión.
- **[`logging`](./logging.md)**: `LOG_COMMANDS` y la deuda de los `LOGGER_*`.
- **[`testing`](./testing.md)**: `.env.test`, `CI` y `KEEP_DB`.
