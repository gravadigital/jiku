# Operación de Jiku

Cómo se opera el producto: cómo saber si está sano, qué procesos corren solos, cómo se configura y
qué conviene alertar. Para el detalle de qué hace el producto, ver la definición en `_gflow/prd/`.
El paso a paso de una instalación, con la solución de problemas, está en
[deploy/README.md](../deploy/README.md).

## Servicios y salud

**Los endpoints de salud no existen todavía.** El default es que cada servicio responda
`GET /health` (está vivo) y `GET /health/ready` (puede atender) con su estado, versión, commit y el
estado de cada dependencia; hoy ningún servicio los tiene, ninguna imagen declara `HEALTHCHECK` y
ningún Compose define `healthcheck:`. El requisito de alineación los agrega.

| Servicio | Health | Lo que hay hoy para saber si está vivo |
|---|---|---|
| `api` | No existe todavía | Que responda HTTP en el puerto 3000 del contenedor (3100 en local). Si no puede conectarse a la base (5 intentos) o bajar las claves de Zitadel al arrancar, el proceso sale con código 1. Si no puede conectarse al bus, solo lo loguea y sigue |
| `core` | No existe todavía (no tiene HTTP) | Responde el `PING`/`INFO`/`STATS` de NATS micro: `nats micro info jiku-commands` y `nats micro info jiku-queries` |
| `web` | No existe todavía | Que responda HTTP en el puerto 3000 del contenedor |
| `opus-web` | No existe todavía | Que responda HTTP en el puerto 3000 del contenedor |
| NATS | `GET /healthz` en el puerto de monitoreo 8222 | Lo usa `deploy/local.sh` para esperar al servidor |
| PostgreSQL | — | `pg_isready` (lo usa `deploy/local.sh`) |

Diagnóstico del bus: `deploy/bus-inspect.sh status` (estado del servidor y de los servicios
micro), `deploy/bus-inspect.sh tail` y `logs` (los comandos que procesa core, con
`LOG_COMMANDS=true`).

## Procesos en segundo plano

| Proceso | Servicio | Cada cuánto | Qué hace | Métrica de último éxito |
|---|---|---|---|---|
| Envío de notificaciones (outbox) | core | Cada `notification-dispatch-interval-seconds` de `system_settings` (60 s por defecto; 5 s si no puede leer el ajuste) | Toma hasta `notification-batch-size` filas pendientes y vencidas de `notification_outbox` (50 por defecto, con `FOR UPDATE SKIP LOCKED`) y las manda por SMTP. Éxito: la fila pasa a `sent`. Falla: suma un intento y reprograma con espera `60 × 2^intentos` s, con tope de 1 día. Al llegar a `notification-max-attempts` (5 por defecto) **borra la fila** y deja un log `[notifications] discard`. Se detiene ordenadamente con `SIGTERM` | No existe todavía |
| Chequeo de módulos opcionales | api | Cada 30 s | Lee la clave `docs` del registro `JIKU_MODULES`, la observa con un *watch* (lo reabre si se cayó) y hace `PING` a `docs-queries` con 2 s de espera. Calcula el estado del módulo (`not_installed`, `incompatible`, `unavailable`, `available`) en memoria, por réplica | No existe todavía |
| Espejo de identidades | core | Por evento | Consume `{instance}.events.auth`, que publica el auth-callout en cada autenticación al bus (cola `NATS_EVENTS_QUEUE`), y crea o actualiza la fila de `users`. La entrega no es durable: si core está caído, el evento se pierde | No existe todavía |
| Renovación del token del *service user* | api y core | Antes de que venza (margen de 300 s; revisa cada 150 s) | Pide a Zitadel un token JWT nuevo con la key del *service user* para la conexión al bus | No existe todavía |
| Monitor del *event loop* | core | Cada `QUERY_TIMING_LOOP_MS` (30 s), solo con `QUERY_TIMING=true` | Loguea el retraso del *event loop* | — |

Las métricas de duración, resultado y último éxito de cada proceso, y las de la cola
`notification_outbox` (pendientes y antigüedad de la más vieja), no existen todavía.

## Configuración

Todo se configura con variables de entorno. En un servidor, en `deploy/.env`, creado desde
[`deploy/.env.dist`](../deploy/.env.dist), que trae el detalle de cada una; los Compose de `deploy/`
las pasan a cada contenedor con el nombre que lee el servicio. Hoy la validación al arrancar es
parcial: la api valida la autenticación y `JIKU_PUBLIC_URL`, core valida
`CORE_TRUSTED_PUBLISHER_ID` y `OPUS_URL`; el resto (S3, SMTP, puertos) falla recién al usarse.

### `deploy/.env`

| Variable | Servicio | Para qué | Default |
|---|---|---|---|
| `DUMP_FILE` | `local.sh` | `.sql` con el esquema para la primera carga; obligatorio en una instalación nueva | vacío |
| `STAGE` | Compose | Sufijo de contenedores y volúmenes | `dev` |
| `DOMAIN` | web, api | Host de Gestión interna; la api queda en `api.${DOMAIN}` | vacío |
| `OPUS_DOMAIN` | opus-web, core | Host del Portal de clientes; core arma con él los links de los mails (`OPUS_URL`) | vacío |
| `DOCS_PUBLIC_DOMAIN` | api | Host de los links públicos de documentación (`JIKU_PUBLIC_URL`); vacío los apaga | vacío |
| `API_TRUST_PROXY` | api | Saltos de proxy de confianza, para el límite de pedidos de `/p/docs` | vacío (`1` en el Compose de servidor) |
| `INGRESS_NETWORK` | Compose | Red externa del nginx-proxy | `server-nginx` |
| `API_VERSION`, `CORE_VERSION`, `WEB_VERSION`, `OPUS_WEB_VERSION` | Compose | Tag de la imagen de cada servicio | la versión actual |
| `AUTH_CALLOUT_IMAGE`, `AUTH_CALLOUT_VERSION` | auth-callout | Imagen y tag del auth-callout | `gravadigital/nats-zitadel-auth-callout`, `0.1.0` |
| `DATABASE_NETWORK` | Compose | Red externa de la base | `jiku-database` |
| `DATABASE_NAME` | api, core | Base de datos | `jiku` |
| `DATABASE_USER`, `DATABASE_PASSWORD` | core, migraciones de la api | Rol dueño: escribe y migra | `fakeuser`, `fakepass` |
| `DATABASE_PORT` | Compose de desarrollo | Puerto publicado de PostgreSQL | `5432` |
| `DATABASE_READONLY_USER`, `DATABASE_READONLY_PASSWORD` | api, lecturas de core | Rol de solo lectura | `jiku_readonly`, vacío |
| `POSTGRESQL_READ_POOL_MAX` | core | Conexiones del pool de lectura | `10` |
| `POSTGRESQL_STATEMENT_TIMEOUT_MS` | core | Corte de una consulta de lectura en la base (debe quedar por debajo de `NATS_QUERY_TIMEOUT_MS`) | `8000` |
| `POSTGRESQL_READ_RANDOM_PAGE_COST` | core | Ajuste del planificador para los índices trigram | `1.1` |
| `IDENTITY_URL` | api | Zitadel, para validar los tokens de las personas | placeholder |
| `IDENTITY_ISSUER`, `IDENTITY_CLIENT_ID`, `IDENTITY_PROJECT_ID` | web, opus-web | App OIDC con PKCE de los frontends | placeholder, vacío, vacío |
| `NATS_INSTANCE` | api, core, auth-callout | Primer segmento de los subjects; aísla instalaciones | `dev` |
| `NATS_URL` | api, core | URL del bus | `nats://nats:4222` |
| `NATS_PROTOCOL_VERSION`, `NATS_EVENTS_VERSION` | api, core, scripts | Versión de comandos y consultas, y de eventos (las plantillas del callout tienen `v1` fijo) | `v1`, `v1` |
| `NATS_COMMAND_SERVICE`, `NATS_QUERY_SERVICE` | api, core | Nombres de los servicios del bus (fijos en las plantillas del callout) | `jiku-commands`, `jiku-queries` |
| `NATS_EVENTS_QUEUE` | core | Grupo de cola del consumidor de `events.auth` | `jiku-events` |
| `SERVICE_VERSION` | core | Versión que anuncia core en NATS micro (SemVer estricto) | `1.0.0` |
| `NATS_REQUEST_TIMEOUT_MS` | api | Espera de la respuesta de un comando (después, 504) | `5000` |
| `NATS_QUERY_TIMEOUT_MS` | api | Espera de la respuesta de una consulta | `10000` |
| `NATS_CREDS` | api, core | Ruta, en el contenedor, de las credenciales del sentinel | `/run/secrets/nats.creds` |
| `API_SERVICE_USER_KEY_B64`, `CORE_SERVICE_USER_KEY_B64` | api, core | JSON key del *service user* de Zitadel, en base64 (la escribe `service-user-key.sh`) | vacío |
| `CORE_TRUSTED_PUBLISHER_ID` | core | `userId` del *service user* de la api: el único al que core le acepta el sobre `actor`. Sin ella core no arranca | vacío |
| `GESTION_IDP_MODE` | auth-callout | `zitadel` o `mock` | `zitadel` |
| `GESTION_ZITADEL_ISSUER_URL`, `GESTION_ZITADEL_PROJECT_ID` | auth-callout, api, core | Issuer y proyecto de Zitadel donde viven los roles | placeholder, vacío |
| `WEB_NEXTAUTH_SECRET`, `OPUS_NEXTAUTH_SECRET` | web, opus-web | Secreto de la sesión de NextAuth | vacío |
| `STORAGE_S3_ENDPOINT` | core | Endpoint S3 con el que se firman las URLs; lo tiene que alcanzar el navegador | `http://172.28.0.1:9000` (MinIO local) |
| `STORAGE_S3_CREDENTIALS_ACCESSKEY`, `STORAGE_S3_CREDENTIALS_SECRETKEY` | core | Credenciales del bucket (solo core las tiene) | las de MinIO local |
| `STORAGE_S3_BUCKETNAME`, `STORAGE_S3_REGION` | core | Bucket y región | `jiku`, `us-east-1` |
| `STORAGE_S3_FORCEPATHSTYLE` | core | URLs path-style (MinIO) | `true` |
| `STORAGE_S3_KEY_PREFIX` | core | Prefijo de las claves de los objetos; no se cambia con datos cargados | `grava-gestion` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | core | Servidor de mail de las notificaciones | vacío, `587`, vacío, vacío, vacío |

### Variables de cada servicio que no están en `deploy/.env`

| Variable | Servicio | Para qué | Default |
|---|---|---|---|
| `SERVER_PORT` | api | Puerto HTTP | `3000` en la imagen (sin default en el código) |
| `POSTGRESQL_DB`, `POSTGRESQL_HOST`, `POSTGRESQL_PORT`, `POSTGRESQL_USER`, `POSTGRESQL_PASSWORD` | api, core | Conexión a la base (los Compose las arman desde `DATABASE_*`) | puerto `5432` |
| `POSTGRESQL_MIGRATION_USER`, `POSTGRESQL_MIGRATION_PASSWORD` | api | Rol con el que la api corre las migraciones | — |
| `POSTGRESQL_READ_USER`, `POSTGRESQL_READ_PASSWORD` | core | Rol de solo lectura de las consultas | — |
| `KEY_SYNC_ATTEMPS` | api | Reintentos de bajar las claves de Zitadel ante un `kid` desconocido | `3` en la imagen (sin default en el código) |
| `JIKU_PUBLIC_URL` | api | Origen público de los links de documentación (sale de `DOCS_PUBLIC_DOMAIN`) | vacío: apagados |
| `LOG_ACCESS_TOKEN` | web | Solo desarrollo: con `true` imprime en el log el access token completo (lo expone `deploy/docker-compose.local.yml`) | sin valor (apagado) |
| `AUTH_BYPASS`, `DEV_USER_ID` | api | Solo desarrollo: entra como `admin` sin token. Prohibido con `NODE_ENV=production` | `false` |
| `NATS_USER_ID` | api, core | Segmento de usuario de los subjects cuando no hay *service user* (modo `mock`) | `api` / `jiku-commands` |
| `ZITADEL_SERVICE_USER_KEY_B64` o `ZITADEL_SERVICE_USER_KEY`, `ZITADEL_ISSUER_URL`, `ZITADEL_PROJECT_ID` | api, core | Key del *service user* (base64 o archivo), issuer y proyecto (los Compose las arman desde las de arriba) | — |
| `OPUS_URL` | core | URL del Portal de clientes para los links de los mails. Obligatoria | — |
| `LOG_COMMANDS` | core | Loguea cada comando procesado | apagado |
| `QUERY_TIMING`, `QUERY_TIMING_SQL`, `QUERY_TIMING_LOOP_MS` | core | Medición propia de tiempos de las consultas | apagado, apagado, `30000` |
| `NODE_ENV` | api, core | `production` agrega logs a archivo y prohíbe `AUTH_BYPASS` | `production` en las imágenes |
| `LOGGER_INFO_PATH`, `LOGGER_INFO_LEVEL`, `LOGGER_ERROR_PATH`, `LOGGER_ERROR_LEVEL`, `LOGGER_FILE_MAX_SIZE`, `LOGGER_MAX_FILES` | api, core | Archivos de log con `NODE_ENV=production` | api: `/var/log/service_info.log` y `/var/log/service_error.log` en la imagen; core: sin default |
| `API_URL` | web, opus-web | URL interna de la api (con barra final) | `http://api:3000/` en los Compose |
| `AUTH_URL`, `AUTH_SECRET` | web | URL pública y secreto de NextAuth | — |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | opus-web | URL pública y secreto de NextAuth | — |
| `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_PROJECT_ID`, `ZITADEL_CLIENT_SECRET` | web (y opus-web, sin el secreto) | App OIDC de Zitadel (salen de `IDENTITY_*`) | vacío |
| `APP_NAME`, `APP_DESCRIPTION` | web | Título y descripción de la página | `Jiku`, `Gestión de proyectos` |
| `EXTERNAL_LINKS` | web | Links a otras herramientas en la barra lateral, JSON `[{tool, href, label}]` | vacío |

### Parámetros que se ajustan en la base

Core lee estos ajustes de `system_settings` en cada uso, con su default en el código:

| Clave | Para qué | Default |
|---|---|---|
| `file-max-size-bytes` | Tamaño máximo de un archivo subido | 10485760 (10 MiB) |
| `file-allowed-extensions`, `file-allowed-mime-types` | Tipos de archivo permitidos | ver `_gflow/prd/parameters.md` |
| `upload-url-ttl-seconds`, `download-url-ttl-seconds` | Vida de las URLs firmadas | 300 |
| `notification-dispatch-interval-seconds` | Intervalo del envío de notificaciones | 60 |
| `notification-batch-size` | Notificaciones por ciclo | 50 |
| `notification-max-attempts` | Intentos antes de descartar una notificación | 5 |
| `hours_per_day` | Horas por día de los reportes | 6 |

## Observabilidad

**OpenTelemetry no existe todavía**: no hay trazas, métricas ni propagación de `traceparent`, y
las variables `OTEL_*` no tienen efecto. Tampoco hay un id de correlación en los logs ni en las
respuestas. El requisito de alineación lo agrega.

Lo que hay hoy:

| Servicio | Logs | Otros |
|---|---|---|
| api | winston, en texto (`<timestamp> <nivel>: <mensaje>`, con colores) a la salida estándar, más una línea de acceso por pedido (`GET /url status ms`). Con `NODE_ENV=production`, además a los archivos `LOGGER_*_PATH`. Los links públicos loguean el token enmascarado | — |
| core | winston, en texto, con prefijos por componente: `[bus]`, `[auth]`, `[dispatch]`, `[cmd]`, `[query]`, `[events]`, `[notifications]`, `[timing]`. Con `NODE_ENV=production`, además a los archivos `LOGGER_*_PATH` | Medición propia de tiempos con `QUERY_TIMING=true`: toma `Jiku-Trace-Id` de los headers NATS, devuelve el desglose en `Jiku-Timing` y escribe una línea `[timing]` por mensaje. Las estadísticas de NATS micro (`nats micro stats`) cuentan pedidos, pero no errores ni la duración real |
| web, opus-web | `console.warn` y `console.error` en el servidor | — |

En local no hay un perfil de observabilidad: ver los logs con `deploy/local.sh logs [servicio]`.

## Alertas recomendadas

Qué conviene alertar, con umbrales que salen de los requisitos no funcionales de disponibilidad y
tiempos. No se fija una herramienta: las implementa el stack que se use. Hoy faltan las métricas y
los endpoints de salud en los que se apoyan (ver arriba), así que la mayoría se pueden armar solo a
partir de los logs.

| Alerta | Condición | Umbral |
|---|---|---|
| Servicio caído | `/health/ready` responde `down` o no responde (hoy: el contenedor se reinicia o no responde HTTP; core no responde el `PING` de NATS micro) | Sin NFR de disponibilidad: a definir |
| Tasa de errores | Respuestas 5xx sobre el total | Sin NFR: a definir |
| Latencia | Percentil 95 de la duración de las operaciones | Sin NFR de latencia: a definir. Los cortes que sí fija la definición sirven de techo: respuestas `query_timeout` (consulta de más de 8000 ms en la base, NFR-01), 504 de un comando (más de 5000 ms, NFR-02) y consultas del bus de más de 10000 ms (NFR-03) |
| Proceso que no corrió | Tiempo desde el último éxito de un proceso en segundo plano | Sin NFR: a definir. El envío de notificaciones corre cada 60 s por defecto |
| Cola acumulada | Notificaciones pendientes en `notification_outbox` o antigüedad de la más vieja | Sin NFR: a definir. Toda línea `[notifications] discard` en el log de core es una notificación perdida después de 5 intentos (NFR-08) |
| Eventos perdidos | Línea `[events] publish failed` en el log de core: el cambio quedó y el evento no se publicó (NFR-09) | Cualquier ocurrencia |

## Secretos del CI

Lo que los pipelines necesitan y es secreto se configura como variable de la plataforma, nunca en el
repositorio. Jiku está en GitHub: *Settings → Secrets and variables → Actions → New repository
secret*. El workflow `ci.yml` no usa secretos; `dev-images.yml` y `release.yml` los usan para
publicar en Docker Hub, en el namespace `gravadigital`.

| Variable | Qué es | Cómo se crea | Si falta |
|---|---|---|---|
| `DOCKERHUB_USERNAME` | Usuario de Docker Hub con permiso de escritura en los repositorios `gravadigital/jiku-*` | Es el nombre de la cuenta de Docker Hub | Falla el login del job `publish` y no se publica ninguna imagen; el job `summary` marca el workflow como fallido. Los tests corren igual |
| `DOCKERHUB_TOKEN` | Token de acceso personal de esa cuenta | En Docker Hub, *Account settings → Personal access tokens → Generate new token*, con permiso *Read & Write* | Igual que el anterior |

## Builds para descargar

El producto se despliega como imágenes. El CI publica en Docker Hub una imagen por servicio:
`gravadigital/jiku-api`, `gravadigital/jiku-core`, `gravadigital/jiku-web` y
`gravadigital/jiku-opus-web`.

| Tag | Cuándo se publica | Para qué |
|---|---|---|
| `dev` | En cada push a `dev` (`dev-images.yml`) | La última versión de `dev`; se mueve en cada push |
| `dev-<sha>` | En cada push a `dev` | Un build de `dev` fijo, por commit |
| `X.Y.Z` | Al subir el tag `vX.Y.Z` (`release.yml`), después de verificar que coincide con `package.json` y de correr los tests | Una versión publicada, inmutable |
| `X.Y` | Ídem | La última corrección de esa versión |
| `latest` | Ídem | La última versión publicada |

## Despliegue

En un servidor se usan las imágenes publicadas, sin construir nada
([deploy/README.md](../deploy/README.md#on-a-server) y
[documentation/installation.md](../documentation/installation.md)):

1. **Variables.** `cd deploy && cp .env.dist .env`, y completar la tabla de [Configuración](#configuración).
   Cada servicio se fija a una versión con `API_VERSION`, `CORE_VERSION`, `WEB_VERSION` y
   `OPUS_WEB_VERSION` (`dev` sigue la punta de `dev`, sin promesa de estabilidad).
2. **Zitadel.** Una app OIDC con PKCE para los frontends y dos *machine users* con Access Token Type
   = JWT: la api con el rol `internal-app` y core con el rol `core`. `./service-user-key.sh api
   <key.json>` y `./service-user-key.sh core <key.json>` validan cada key y la guardan en `.env`.
3. **Identidad de NATS.** `cd nats && ./bootstrap.sh` genera operador, cuentas y credenciales en
   `deploy/nats/creds/` (no versionado), incluida la credencial de eventos del auth-callout.
4. **Esquema.** Las migraciones no crean el esquema desde cero: una instalación nueva necesita
   cargar antes un dump `.sql` del esquema.
5. **Rol de solo lectura.** En un servidor se crea a mano (`CREATE USER jiku_readonly …`,
   `GRANT SELECT` y `ALTER DEFAULT PRIVILEGES … GRANT SELECT`); el SQL exacto está en
   deploy/README.md. Sin `ALTER DEFAULT PRIVILEGES`, las tablas de migraciones futuras quedan
   fuera del alcance de la api.
6. **Levantar.** `docker compose pull && docker compose up -d`. Hacen falta las dos redes externas
   (`INGRESS_NETWORK` y `DATABASE_NETWORK`); el ingreso es un nginx-proxy con Let's Encrypt.
   **La api aplica las migraciones al arrancar** (`npm run built-start` = `upgrade-db` y después el
   servidor), con el rol dueño (`POSTGRESQL_MIGRATION_USER`).
7. **Bus.** Con todo arriba, una vez: `cd nats && NATS_DOCKER_NETWORK=jiku_jiku-bus
   ./create-events-stream.sh`, `./create-modules-kv.sh` y `./create-kv-space.sh` (el stream
   `JIKU_EVENTS`, el registro `JIKU_MODULES` y el espacio `JIKU_KV`). Los tres se pueden repetir.
8. **Bucket.** Configurar el CORS del bucket para los dos frontends; deploy/README.md tiene la
   receta para AWS S3, MinIO, DigitalOcean Spaces y Cloudflare R2.
9. **Opcionales.** El módulo de documentación (jiku-docs, en su propio repositorio) y los links
   públicos (`DOCS_PUBLIC_DOMAIN`, con el DNS apuntado antes de activarlo).

**El primer usuario** se crea en Zitadel con un rol en el proyecto (`admin`, `user` o
`external-user`); Jiku no tiene alta de usuarios. Core crea la fila de `users` cuando la persona se
conecta al bus o publica su primer comando. Las Personas (`people`), las personas de cada proyecto
y los permisos de proyecto de los clientes (`user_project_permissions`) no se cargan desde el
producto: vienen en el dump o se insertan por SQL.

**Actualizar** es cambiar los `*_VERSION` en `deploy/.env` y repetir `docker compose pull && docker
compose up -d`: la api aplica las migraciones nuevas al arrancar. Las notas de cada versión, con lo
que hay que hacer en una instalación existente, están en [CHANGELOG.md](../CHANGELOG.md).
