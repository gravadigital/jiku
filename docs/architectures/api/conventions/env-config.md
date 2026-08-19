---
id: env-config
display_name: Configuración de entorno (dotenv + asserts al arrancar)
language: node
description: Environment variables read directly from process.env, with explicit startup asserts for the critical ones
applies_to: [api]
required_by: []
package: dotenv
---

# Configuración de entorno (api)

> **Reemplaza** la convención `env-config` del catálogo, que valida todas las variables con
> `@t3-oss/env-core` + Zod en un módulo tipado. Este servicio lee `process.env` directamente y
> valida **solo lo crítico**, con asserts explícitos que cortan el arranque.

## Cuándo aplica

Todo el servicio.

## Paquete

```
dotenv                 # 17.2, carga el .env
```

## Cómo se carga

`dotenv.config()` es lo **primero** que corre en el entry point, antes de cualquier import que
lea el entorno:

```ts
// bin/index.ts:1-2
import * as dotenv from 'dotenv';
dotenv.config();
import { afterInitialize, initialize } from '../app';
```

> El orden importa y no es estético: `lib/models/index.ts` construye el Sequelize **en el momento
> en que se importa**, leyendo `process.env` ahí mismo. Si el `.env` se carga después, la conexión
> queda apuntando a otro host. Es el mismo problema que `tests/setup-env.ts` resuelve para los
> tests, y está explicado en su comentario de cabecera.

## Los tres archivos

| Archivo | Rol |
|---|---|
| `.env.dist` | plantilla documentada, para correr el servicio fuera de Docker. **Se commitea** |
| `.env.defaults` | valores de producción; el Dockerfile lo copia como `.env` en la imagen |
| `.env.test` | valores de los tests |

`.env` **no** se commitea.

## Las variables

### Servidor y logging

| Variable | Default | Rompe si falta |
|---|---|---|
| `NODE_ENV` | `production` en `lib/models`, `production` en `.env.defaults` | cambia el logger, el bypass de auth y el `sync()` del esquema |
| `SERVER_PORT` | — | `listen(undefined)` toma un puerto aleatorio |
| `LOGGER_INFO_PATH` / `LOGGER_ERROR_PATH` | — | en producción, Winston no puede escribir |
| `LOGGER_INFO_LEVEL` / `LOGGER_ERROR_LEVEL` | — | nivel `undefined` |
| `LOGGER_FILE_MAX_SIZE` / `LOGGER_MAX_FILES` | — | rotación con `NaN` |

### Base de datos

| Variable | Notas |
|---|---|
| `POSTGRESQL_DB`, `_USER`, `_PASSWORD`, `_HOST` | el usuario es el de **solo lectura** |
| `POSTGRESQL_PORT` | default `5432` en el código |
| `POSTGRESQL_MIGRATION_USER` / `_PASSWORD` | credenciales de escritura para las migraciones; caen a las de la api si no están |
| `POSTGRESQL_POOL_*` | declaradas en los `.env` pero **no leídas** por el código |

> `POSTGRESQL_POOL_MAX`, `_MIN` y `_IDLE` están en `.env.dist` y `.env.defaults` pero
> `lib/models/index.ts` no las usa: el pool queda en el default de Sequelize. Es deuda; no asumas
> que ajustarlas tiene efecto.

### Autenticación

| Variable | Notas |
|---|---|
| `IDENTITY_URL` | **obligatoria.** Sin ella y sin bypass, el proceso no arranca |
| `KEY_SYNC_ATTEMPS` | reintentos de resincronización del JWKS. Sin default: `NaN` desactiva el reintento |
| `AUTH_BYPASS` | `'true'` desactiva la validación. Prohibida en producción |
| `DEV_USER_ID` | obligatoria si `AUTH_BYPASS=true` |

### Bus

| Variable | Default |
|---|---|
| `NATS_URL` | `nats://localhost:4222` |
| `NATS_CREDS` | path a las creds del sentinel; opcional |
| `NATS_REQUEST_TIMEOUT_MS` | `5000` |
| `NATS_INSTANCE` | `dev` — primer segmento del subject |
| `NATS_SERVICE_NAME` | `gestion` |
| `NATS_PROTOCOL_VERSION` | `v1` |
| `NATS_USER_ID` | `api` — **solo fallback para tests.** En un deploy real el user id sale de la key del service user |

Más las que consume `@jiku/zitadel-auth` para el service user.

> `NATS_INSTANCE` tiene que coincidir con la instancia de core: forma parte del subject, así que
> un valor distinto hace que core no reciba el comando (y la api vea un timeout → 503).

### Storage

| Variable | Notas |
|---|---|
| `STORAGE_S3_ENDPOINT`, `_CREDENTIALS_ACCESSKEY`, `_CREDENTIALS_SECRETKEY`, `_BUCKETNAME`, `_REGION` | **las cinco obligatorias**, sin default. El servicio lanza si falta alguna |
| `STORAGE_S3_FORCEPATHSTYLE` | `'true'` para MinIO local |
| `STORAGE_S3_KEY_PREFIX` | default `'grava-gestion'`. **No cambiar en una instalación con datos** |

## Validación: solo lo crítico, y antes de escuchar

No hay validación centralizada. Hay dos asserts, en los dos puntos donde una variable mal puesta
tiene consecuencias graves:

### 1. `assertAuthConfig()` — corta el arranque

Corre en `bin/index.ts:13`, **antes** de conectar a la base y antes de escuchar:

```ts
// lib/utils/middlewares/validate-token.ts:31-52
if (AUTH_BYPASS_REQUESTED && IS_PRODUCTION)  throw ...   // la api quedaría abierta
if (BYPASS_AUTH && !DEV_USER_ID)             throw ...   // no hay usuario que cargar
if (!IDENTITY_URL || IDENTITY_URL.trim() === '') throw ...
```

> Es preferible no levantar a levantar sin validar tokens. La razón histórica está en el
> comentario del archivo: antes, una variable sin completar dejaba la api abierta y con rol
> `admin`, en silencio.

### 2. El constructor de `StorageService` — lanza al construirse

Las cinco variables de S3 se validan al instanciar (`lib/utils/storage-service.ts:60-67`), no al
subir el primer archivo.

### Y el patrón general

El resto se lee con default explícito en el punto de uso:

```ts
const REQUEST_TIMEOUT_MS = Number(process.env.NATS_REQUEST_TIMEOUT_MS) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'production';
export const STORAGE_KEY_PREFIX = process.env.STORAGE_S3_KEY_PREFIX || 'grava-gestion';
```

Los booleanos se comparan contra el string `'true'`, nunca por truthiness:
`process.env.AUTH_BYPASS === 'true'`.

## Reglas

- `dotenv.config()` va primero en el entry point, antes de cualquier import que lea el entorno.
- Una variable nueva se documenta en `.env.dist` **con un comentario de qué rompe si falta**, y se
  agrega a `.env.defaults` si aplica a producción.
- Leé `process.env` en el punto de uso, con default explícito: `Number(...) || n`,
  `process.env.X || 'y'`.
- Los booleanos se comparan contra `'true'`. Nunca `if (process.env.FLAG)`.
- Si una variable ausente compromete la seguridad o deja el servicio inservible, **validala al
  arrancar y cortá el proceso**. No la descubras en la primera request.
- Nunca infieras un modo permisivo de configuración ausente. El bypass es opt-in explícito.
- Nunca logs de credenciales: ni el `.env`, ni las claves de S3, ni el path de las creds de NATS.
- No introduzcas un módulo de config centralizado y tipado sin migrar todos los puntos de lectura:
  quedarían dos fuentes de verdad.
- No agregues defaults a las variables de S3.

## Integración con otras convenciones

- **auth-jwt**: `assertAuthConfig()` y las cuatro variables de autenticación.
- **storage**: las siete `STORAGE_S3_*` y por qué cinco no tienen default.
- **bus-commands**: las variables `NATS_*` y por qué `NATS_USER_ID` es solo fallback.
- **orm**: las de PostgreSQL, incluidas las de migración.
- **logging**: las cinco `LOGGER_*`.
- **dockerfile**: la imagen copia `.env.defaults` como `.env`.
