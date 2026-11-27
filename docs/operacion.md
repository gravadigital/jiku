# Operación de Jiku

Cómo se opera el producto: cómo saber si está sano, qué procesos corren solos, cómo se configura y
qué conviene alertar. Para el detalle de qué hace el producto, ver la definición en `_jflow/prd/`.
Para instalarlo en un servidor, [deploy/README.md](../deploy/README.md).

## Servicios y salud

**Hoy ningún servicio de Jiku expone `GET /health` ni `GET /health/ready`**, y las imágenes no
declaran `HEALTHCHECK`. Es una diferencia con el estándar de jiku flow, registrada en el informe de
adopción ([docs/adopcion.md](adopcion.md)); hasta que un requisito la cierre, la salud se mira con
lo que existe:

| Servicio | Health | Qué se puede mirar hoy |
|---|---|---|
| api | No tiene | Que el contenedor esté corriendo. Cualquier ruta de `/api` sin token responde `401` cuando la api está arriba (si no pudo bajar las claves del proveedor de identidad al arrancar, el proceso termina). Si el bus no conecta, la api sigue sirviendo lecturas y las escrituras responden `503 service_unavailable` |
| core | No tiene (no expone HTTP) | Que el contenedor esté corriendo, y sus servicios en el bus: `nats micro ls` / `nats micro info jiku-commands` y `jiku-queries` (discovery `$SRV`). Ante `SIGTERM` termina el lote de notificaciones en curso, drena la conexión y sale |
| web | No tiene | Que el contenedor esté corriendo; `GET /login` responde `200` |
| opus-web | No tiene | Que el contenedor esté corriendo; `GET /login` responde `200` |
| PostgreSQL | `pg_isready` | Healthcheck de Compose en local |
| NATS | `GET http://<nats>:8222/healthz` | Healthcheck de Compose en local; el puerto de monitoreo 8222 también da `/varz`, `/connz`, `/jsz` |
| MinIO (local) | `GET /minio/health/live` | Healthcheck de Compose en local |
| Proveedor de identidad de prueba (local) | `GET http://localhost:9400/health` | `HEALTHCHECK` de su imagen |

En local, `docker compose ps` muestra el estado de cada contenedor y `make up` espera a que los que
tienen healthcheck estén sanos. En el servidor, `deploy/docker-compose.yml` no declara
healthchecks: el estado es el del contenedor (`docker compose ps`). Para mirar el tráfico del bus,
`deploy/bus-inspect.sh`.

## Procesos en segundo plano

Ningún proceso registra métricas de duración, resultado o último éxito: lo que queda de cada
corrida está en los logs del servicio (y, para las notificaciones, en la tabla
`notification_outbox`).

| Proceso | Servicio | Cada cuánto | Qué hace | Métrica de último éxito |
|---|---|---|---|---|
| Envío de notificaciones | core | `notification-dispatch-interval-seconds` de `system_settings` (60 s por defecto), releído en cada ciclo | Toma hasta `notification-batch-size` (50) filas `pending` de `notification_outbox` cuyo `next_attempt_at` ya pasó (`FOR UPDATE SKIP LOCKED`), manda cada mail por SMTP y la marca `sent`; si falla, reprograma con espera exponencial (60 s × 2^intentos, tope 1 día) y, al llegar a `notification-max-attempts` (5), borra la fila. Entrega al menos una vez. Las filas las escribe cada comando en su misma transacción | No hay. Se infiere de la tabla: filas `pending` y el `next_attempt_at` más viejo; logs `[notifications]` |
| Consumidor de eventos de autenticación | core | Por cada conexión aceptada al bus | Escucha `{instancia}.events.auth` (queue group `NATS_EVENTS_QUEUE`) y refleja la identidad (nombre, mail, roles) en la tabla `users` | No hay; logs `[events]` |
| Registro de módulos opcionales | api | Cada 30 s | Lee el registro `JIKU_MODULES` (KV de NATS) y hace ping al módulo `docs` (`$SRV.PING`, 2 s de timeout) para saber si está instalado y responde | No hay; logs `[modules]` |
| Renovación del token de servicio | api, core | Cada 150 s | Renueva el token del usuario de máquina con el que cada servicio se conecta al bus | No hay |
| Recordatorios de horas | api | — | **No existe hoy.** Los composes todavía pasan `LAST_WEEK_MISSING_HOURS_ENABLED`, `CURRENT_WEEK_MISSING_HOURS_ENABLED` y `CONSOLIDATED_HOURS_REMINDER_ENABLED` en `false`, pero ningún código las lee | — |

No hay ningún proceso de limpieza: los archivos que se subieron y nunca se vincularon, y los objetos
desvinculados del bucket, no se borran.

## Configuración

Todo se configura con variables de entorno. En local, cada una tiene un valor por defecto en
`docker-compose.yml` y se puede cambiar con un `.env` copiado de [.env.example](../.env.example).
En un servidor se configuran en `deploy/.env`, copiado de
[deploy/.env.dist](../deploy/.env.dist), que las documenta; los composes de `deploy/` las reparten
a cada servicio. [documentation/configuration.md](../documentation/configuration.md) tiene el
detalle de cada una.

**Validación al arrancar: parcial.** La api no arranca sin `IDENTITY_URL` (salvo `AUTH_BYPASS`
fuera de producción) o con un `JIKU_PUBLIC_URL` que no sea un origen; core no arranca sin
`CORE_TRUSTED_PUBLISHER_ID` ni `OPUS_URL`. El resto no se valida: S3 y SMTP fallan recién en el
primer uso, y a la api sin `KEY_SYNC_ATTEMPS` le rechaza todos los tokens.

### api

| Variable | Para qué | Default |
|---|---|---|
| `NODE_ENV` | `production` en la imagen: logs a archivos, sin `AUTH_BYPASS` | `production` |
| `SERVER_PORT` | Puerto HTTP | `3000` (de `.env.defaults` de la imagen; sin default en el código) |
| `POSTGRESQL_HOST` / `_PORT` / `_DB` | La base | `database` / `5432` / `jiku` |
| `POSTGRESQL_USER` / `_PASSWORD` | El rol de **solo lectura** con el que lee | — |
| `POSTGRESQL_MIGRATION_USER` / `_PASSWORD` | El dueño de la base, para las migraciones al arrancar | los de `POSTGRESQL_USER` |
| `IDENTITY_URL` | Zitadel: de ahí baja las claves (`/oauth/v2/keys`) para validar los tokens | obligatoria |
| `KEY_SYNC_ATTEMPS` | Cuántas veces vuelve a bajar las claves ante un `kid` desconocido | `3` (de `.env.defaults`) |
| `AUTH_BYPASS`, `DEV_USER_ID` | Solo desarrollo: todo pedido entra como ese usuario con rol `admin`. Prohibido con `NODE_ENV=production` | `false` |
| `ZITADEL_SERVICE_USER_KEY_B64` / `ZITADEL_SERVICE_USER_KEY` | Clave JSON del usuario de máquina de la api (en base64 o como ruta) | — |
| `ZITADEL_ISSUER_URL` (o `IDENTITY_ISSUER`), `ZITADEL_PROJECT_ID` | Dónde pide el token de servicio y para qué proyecto | — |
| `NATS_URL`, `NATS_CREDS` | El bus y la credencial centinela | `nats://localhost:4222` / — |
| `NATS_INSTANCE`, `NATS_COMMAND_SERVICE`, `NATS_QUERY_SERVICE`, `NATS_PROTOCOL_VERSION`, `NATS_EVENTS_VERSION` | Arman los subjects del bus | `dev`, `jiku-commands`, `jiku-queries`, `v1`, `v1` |
| `NATS_USER_ID` | Identidad en el bus cuando no hay usuario de máquina (tests) | `api` |
| `NATS_REQUEST_TIMEOUT_MS` / `NATS_QUERY_TIMEOUT_MS` | Espera máxima de un comando / una consulta | `5000` / `10000` |
| `JIKU_PUBLIC_URL` | Origen público de los links compartidos de documentación; vacío los apaga | vacío |
| `API_TRUST_PROXY` | Saltos de proxy a confiar (`1` detrás del ingress) | vacío |
| `LOGGER_INFO_PATH` / `_LEVEL`, `LOGGER_ERROR_PATH` / `_LEVEL`, `LOGGER_FILE_MAX_SIZE`, `LOGGER_MAX_FILES` | Archivos de log en producción | `/var/log/service_*.log`, `info`/`error`, 1 MB, 50 |

### core

| Variable | Para qué | Default |
|---|---|---|
| `CORE_TRUSTED_PUBLISHER_ID` | El `sub` del usuario de máquina de la api: solo de él acepta el sobre de identidad | obligatoria |
| `OPUS_URL` | URL del portal, para los links de los mails | obligatoria |
| `POSTGRESQL_HOST` / `_PORT` / `_DB` / `_USER` / `_PASSWORD` | La base, con el rol dueño (escribe) | puerto `5432` |
| `POSTGRESQL_READ_USER` / `_READ_PASSWORD` | Rol de solo lectura de las consultas por el bus | — |
| `POSTGRESQL_READ_POOL_MAX` | Conexiones de lectura | `10` |
| `POSTGRESQL_STATEMENT_TIMEOUT_MS` | Tope de cada consulta de lectura; tiene que ser menor que `NATS_QUERY_TIMEOUT_MS` de la api | `8000` |
| `POSTGRESQL_READ_RANDOM_PAGE_COST` | Ajuste del planificador en la conexión de lectura | `1.1` |
| `ZITADEL_SERVICE_USER_KEY_B64` / `ZITADEL_SERVICE_USER_KEY`, `ZITADEL_ISSUER_URL`, `ZITADEL_PROJECT_ID` | Usuario de máquina de core | — |
| `NATS_URL`, `NATS_CREDS`, `NATS_INSTANCE`, `NATS_COMMAND_SERVICE`, `NATS_QUERY_SERVICE`, `NATS_PROTOCOL_VERSION`, `NATS_EVENTS_VERSION` | El bus, igual que en la api | ídem |
| `NATS_USER_ID` | Identidad sin usuario de máquina (tests) | `jiku-commands` |
| `NATS_EVENTS_QUEUE` | Queue group del consumidor de eventos de autenticación | `jiku-events` |
| `SERVICE_VERSION` | Versión con la que se registra en el bus (SemVer estricto) | `1.0.0` |
| `STORAGE_S3_ENDPOINT`, `_CREDENTIALS_ACCESSKEY`, `_CREDENTIALS_SECRETKEY`, `_BUCKETNAME`, `_REGION` | El bucket: core firma las URLs de subida y bajada | — (falla en el primer comando de archivos) |
| `STORAGE_S3_FORCEPATHSTYLE` | `true` para MinIO | `false` |
| `STORAGE_S3_KEY_PREFIX` | Prefijo de las claves de los objetos; **no se cambia con datos cargados** | `grava-gestion` |
| `SMTP_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `_FROM` | Envío de notificaciones | puerto `587` |
| `LOG_COMMANDS` | Loguea el contenido de cada comando (URLs firmadas redactadas) | apagado |
| `QUERY_TIMING`, `QUERY_TIMING_SQL`, `QUERY_TIMING_LOOP_MS` | Medición de tiempos por pedido y del event loop | apagado / apagado / `30000` |
| `NODE_ENV`, `LOGGER_*` | Como en la api; con `NODE_ENV=production` las rutas de log son obligatorias | `production` |

### web

| Variable | Para qué | Default |
|---|---|---|
| `API_URL` | URL interna de la api; **tiene que terminar en `/`** | — |
| `AUTH_SECRET` (o `NEXTAUTH_SECRET`) | Cifra la sesión | obligatoria |
| `AUTH_URL` (o `NEXTAUTH_URL`) | URL pública de web | se infiere del Host |
| `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_PROJECT_ID`, `ZITADEL_CLIENT_SECRET` | La aplicación OIDC en Zitadel (cliente público con PKCE) | vacío |
| `APP_NAME`, `APP_DESCRIPTION` | Título y descripción | `Jiku`, `Gestión de proyectos` |
| `EXTERNAL_LINKS` | JSON con links a herramientas externas del menú | sin links |
| `LOG_ACCESS_TOKEN` | `true` imprime el token de acceso: solo para diagnóstico | apagado |

### opus-web

| Variable | Para qué | Default |
|---|---|---|
| `API_URL` | URL interna de la api | — |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Sesión y URL pública del portal | — |
| `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_PROJECT_ID` | La aplicación OIDC en Zitadel | vacío |

### Despliegue (`deploy/.env`)

Además de las anteriores, los composes del servidor leen: `STAGE`, `DOMAIN`, `OPUS_DOMAIN`,
`DOCS_PUBLIC_DOMAIN`, `INGRESS_NETWORK`, `DATABASE_NETWORK`, las versiones de cada imagen
(`API_VERSION`, `CORE_VERSION`, `WEB_VERSION`, `OPUS_WEB_VERSION`, `AUTH_CALLOUT_IMAGE`,
`AUTH_CALLOUT_VERSION`), `DATABASE_*`, `IDENTITY_*`, `GESTION_ZITADEL_ISSUER_URL`,
`GESTION_ZITADEL_PROJECT_ID`, `GESTION_IDP_MODE`, `API_SERVICE_USER_KEY_B64`,
`CORE_SERVICE_USER_KEY_B64`, `WEB_NEXTAUTH_SECRET`, `OPUS_NEXTAUTH_SECRET` y `DUMP_FILE`.

### Parámetros del producto (`system_settings`)

Se guardan en la tabla `system_settings` (clave, valor) y se cambian por SQL. Core los lee en cada
uso, así que un cambio aplica sin reiniciar. Si una clave falta o no se puede leer, vale el default.

| Clave | Para qué | Default |
|---|---|---|
| `hours_per_day` | Horas de una jornada (reportes de horas) | `6` (sembrado por migración; la api no tiene default si falta) |
| `upload-url-ttl-seconds` | Vigencia de la URL firmada de subida | `300` |
| `download-url-ttl-seconds` | Vigencia de la URL firmada de descarga | `300` |
| `file-max-size-bytes` | Tamaño máximo de un adjunto | `10485760` (10 MB) |
| `file-allowed-extensions` | Extensiones permitidas | `.jpg .jpeg .png .gif .webp .svg .pdf .doc .docx .xls .xlsx .txt .csv` |
| `file-allowed-mime-types` | Tipos MIME permitidos | los 12 que corresponden a esas extensiones |
| `notification-dispatch-interval-seconds` | Cada cuánto corre el envío de notificaciones | `60` |
| `notification-batch-size` | Filas por ciclo de envío | `50` |
| `notification-max-attempts` | Intentos antes de descartar una notificación | `5` |

## Observabilidad

**OpenTelemetry no está implementado.** No hay trazas, métricas ni un id de correlación en las
respuestas; los servicios no leen `OTEL_*`. Es una diferencia con el estándar de jiku flow,
registrada en el informe de adopción. Lo que hay:

- **api y core**: logs con winston. Fuera de producción, a la consola en nivel `debug`. Con
  `NODE_ENV=production` (las imágenes), a la consola en nivel `info` y, además, a dos archivos
  rotativos (`LOGGER_INFO_PATH`, `LOGGER_ERROR_PATH`). Son texto, no JSON. La api loguea cada
  pedido HTTP (`MÉTODO URL ESTADO ms`); los links públicos `/p/docs/*` se loguean con el token
  enmascarado. Core prefija sus líneas por área: `[bus]`, `[auth]`, `[dispatch]`, `[cmd]`,
  `[events]`, `[notifications]`, `[timing]`.
- **`LOG_COMMANDS=true`** (core) agrega al log el contenido de cada comando; las URLs firmadas se
  redactan.
- **`QUERY_TIMING=true`** (core) mide cada pedido por el bus y el retraso del event loop
  (`QUERY_TIMING_SQL=true` suma el SQL); si el que pregunta manda los headers `Jiku-Trace-Id` /
  `Jiku-Sent-At`, la respuesta trae `Jiku-Timing`, `Jiku-Recv-At` y `Jiku-Resp-At`.
- **core en el bus**: las estadísticas de NATS micro (`nats micro stats jiku-commands`).
- **web y opus-web**: solo `console.*` de Next.js.

En local los logs se siguen con `make logs` (`S=api` para uno). No hay un perfil de Compose de
observabilidad.

## Alertas recomendadas

Ningún requisito no funcional fija disponibilidad ni tiempos, así que los umbrales que salen del
código se indican como tales y el resto queda **sin NFR: a definir**. No se fija una herramienta:
las implementa el stack que se use.

| Alerta | Condición | Umbral |
|---|---|---|
| Servicio caído | El contenedor de api, core, web, opus-web, nats o auth-callout no está corriendo, o se reinicia en bucle | Sin NFR: a definir (sugerido: cualquier contenedor caído más de 1 minuto) |
| Bus caído | `GET :8222/healthz` de NATS no responde `200` | Sin NFR: a definir. Sin bus, toda escritura responde `503` |
| Tasa de errores | Respuestas `5xx` de la api sobre el total (del log de pedidos), y líneas de nivel `error` en los logs de api y core | Sin NFR: a definir |
| Latencia | Duración de los pedidos de la api (del log de pedidos) | Sin NFR: a definir. El código fija topes: `504` a los 5 s en comandos y 10 s en consultas, y 8 s por consulta SQL de core |
| Proceso que no corrió | El envío de notificaciones no avanza: hay filas `pending` en `notification_outbox` con `next_attempt_at` más viejo que dos intervalos | Del código: más de 2 × `notification-dispatch-interval-seconds` (2 minutos con el default) |
| Cola acumulada | Cantidad de filas `pending` en `notification_outbox` | Sin NFR: a definir (referencia del código: más de un lote, 50, durante varios ciclos) |
| Notificaciones descartadas | Logs `[notifications]` de una fila borrada al llegar a `notification-max-attempts` | Cualquiera: el mail se perdió |

Las consultas para las dos alertas de la cola:

```sql
SELECT count(*) FROM notification_outbox WHERE status = 'pending';
SELECT min(next_attempt_at) FROM notification_outbox WHERE status = 'pending';
```

## Secretos del CI

Lo que los pipelines necesitan y es secreto se configura como variable de la plataforma, nunca en el
repositorio. GitHub: *Settings → Secrets and variables → Actions → New repository secret*. El CI de
cada pull request no usa ningún secreto; los usan los dos workflows que publican imágenes.

| Variable | Qué es | Cómo se crea | Si falta |
|---|---|---|---|
| `DOCKERHUB_USERNAME` | El usuario de Docker Hub que publica en la organización `gravadigital` | Es el nombre del usuario (o de la cuenta de servicio) con permiso de escritura sobre los repositorios `gravadigital/jiku-*` | `dev-images.yml` y `release.yml` fallan en el login a Docker Hub y no publican ninguna imagen |
| `DOCKERHUB_TOKEN` | Un access token de ese usuario | En Docker Hub: *Account settings → Personal access tokens → Generate new token*, con permiso *Read & Write* (o un token de organización con acceso a esos repositorios) | Igual que arriba |

## Builds para descargar

Ninguno: el producto se despliega como imágenes. El CI las publica en Docker Hub, una por servicio:
`gravadigital/jiku-api`, `gravadigital/jiku-core`, `gravadigital/jiku-web` y
`gravadigital/jiku-opus-web`.

| Cuándo | Workflow | Tags |
|---|---|---|
| Cada push a `dev` | `.github/workflows/dev-images.yml` | `dev` (se mueve) y `dev-<sha del commit>` (fijo) |
| Cada tag `vX.Y.Z` | `.github/workflows/release.yml` | `X.Y.Z`, `X.Y` y `latest`. Antes de publicar verifica que el tag coincida con la versión del árbol |

## Despliegue

El detalle está en [deploy/README.md](../deploy/README.md); en resumen:

1. **Variables.** `cp deploy/.env.dist deploy/.env` y completar: claves de la base, la aplicación
   de Zitadel de los frontends, los secretos de sesión (`openssl rand -base64 32`), el bucket S3,
   el SMTP, los dominios y la versión de cada imagen (`API_VERSION`, `CORE_VERSION`, …; `dev` sigue
   la punta de `dev`, `dev-<sha>` fija un build).
2. **Zitadel.** Un proyecto con los roles (`admin`, `user`, `external-user`, `internal-app`,
   `core`), la aplicación OIDC de los frontends, y un **usuario de máquina por servicio** (api con
   rol `internal-app`, core con rol `core`), con *Access Token Type = JWT* y una clave JSON cada
   uno. `deploy/service-user-key.sh api|core <clave.json>` la verifica y la escribe en `.env`.
   `CORE_TRUSTED_PUBLISHER_ID` es el `userId` de la clave de la api: sin él core no arranca.
3. **Identidad de NATS.** `deploy/nats/bootstrap.sh` (necesita `nsc`) genera una vez el operador,
   las cuentas y las credenciales en `deploy/nats/creds/`, que no se versiona: hay que guardar una
   copia. Con el stack arriba se crean el stream `JIKU_EVENTS`, el registro `JIKU_MODULES` y el
   espacio `JIKU_KV` con los scripts `create-*.sh`.
4. **Base.** El usuario de solo lectura de la api se crea a mano una vez (el SQL está en
   deploy/README.md). **Las migraciones las corre la api al arrancar**, con
   `POSTGRESQL_MIGRATION_USER` (el dueño de la base).
5. **Levantar.** `docker compose pull && docker compose up -d` en `deploy/`, con las redes externas
   del ingress y de la base creadas.
6. **Bucket.** CORS del bucket y URL que ve el navegador: los dos pasos más fáciles de saltear,
   explicados por proveedor en deploy/README.md.

**El primer usuario** se crea en Zitadel, con el rol que corresponda en el proyecto. Jiku no
tiene alta de usuarios propia: core refleja a la persona en la tabla `users` a partir de su primera
operación (por el sobre de identidad que manda la api) o de su primera conexión al bus (por el
evento de autenticación del auth-callout).
