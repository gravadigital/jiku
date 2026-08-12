# Deploy

Cómo levantar Jiku: en una máquina de desarrollo y en un servidor.

```
deploy/
├── local.sh                  levanta el stack completo en la máquina
├── service-user-key.sh       prepara la key de un service user para el .env
├── zitadel-token.sh          diagnostica una key contra Zitadel
├── bus-inspect.sh            mirar qué pasa en el bus
├── .env.dist                 plantilla de variables — copiar a .env
├── docker-compose.local.yml  desarrollo: buildea desde el repo
├── docker-compose.yml        producción: pull de imágenes del registry
├── docker-compose.dev.yml    sin dependencias externas (IdP mock)
└── nats/
    ├── nats-server.conf
    ├── auth-callout/         rules.yaml + templates/ (política de acceso)
    └── creds/                identidad de NATS — NO se versiona
```

**Nada de lo que hace falta para levantar el stack vive fuera de `deploy/`.** Los secretos
van en `deploy/.env` y en `deploy/nats/creds/`, ninguno de los dos versionado.

---

## Puesta en marcha

Cuatro pasos. Los tres primeros son de una sola vez.

### 1. Variables

```sh
cd deploy
cp .env.dist .env
```

Completar en `.env`:

| Variable                                      | Qué poner                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `DATABASE_PASSWORD`                           | contraseña del dueño de la base                                                    |
| `DATABASE_READONLY_PASSWORD`                  | contraseña del usuario de solo lectura de la api                                   |
| `IDENTITY_CLIENT_ID`, `IDENTITY_PROJECT_ID`   | la aplicación de Zitadel que usan los fronts                                       |
| `GESTION_ZITADEL_PROJECT_ID`                  | el proyecto donde viven los roles                                                  |
| `WEB_NEXTAUTH_SECRET`, `OPUS_NEXTAUTH_SECRET` | `openssl rand -base64 32`                                                          |
| `STORAGE_S3_*`                                | credenciales del almacenamiento compatible con S3 (en local sirve cualquier valor) |
| `DUMP_FILE`                                   | opcional: un `.sql` para precargar la base                                         |

### 2. Service users de Zitadel

api y core se conectan al bus con un machine user cada uno. En Zitadel hace falta:

- Un **machine user** para cada servicio, con **Access Token Type = JWT**. Por defecto es
  `Bearer`, que emite tokens opacos y el auth-callout rechaza.
- El **rol** correspondiente sobre el proyecto de `GESTION_ZITADEL_PROJECT_ID`:
  `internal-app` para la api, `core` para core.
- Una **key JSON** de cada uno: Keys → New → JSON.

Con esas dos keys:

```sh
./service-user-key.sh api  ~/Descargas/api-su.json
./service-user-key.sh core ~/Descargas/core-su.json
```

El script verifica la key contra Zitadel —que el token sea JWT y traiga el rol correcto— y
la escribe en `.env` codificada en base64. Los `.json` no hacen falta después.

Cada servicio pide su token con esa key y lo renueva antes de que venza, así que no hay
nada que refrescar a mano.

### 3. Identidad de NATS

El servidor corre en modo operator y necesita una identidad que se genera una sola vez:

```sh
cd nats
./bootstrap.sh          # requiere nsc
```

Detalle en [nats/creds/README.md](nats/creds/README.md). Nada de eso se versiona, así que
**hay que guardar una copia**: regenerarla obliga a reemitir las credenciales de todos los
servicios.

Sin `nats/creds/nats-resolver.conf` el servidor no arranca.

### 4. Levantar

```sh
./local.sh up
```

| Servicio         | URL                   |
| ---------------- | --------------------- |
| web              | http://localhost:3000 |
| opus-web         | http://localhost:3001 |
| api              | http://localhost:3100 |
| NATS (monitoreo) | http://localhost:8222 |

`./local.sh down` baja todo y borra los datos. `./local.sh logs api` sigue los logs de un
servicio.

---

## En un servidor

Mismo esquema, con `docker-compose.yml`, que hace `pull` de imágenes en vez de buildear:

```sh
cp .env.dist .env      # completar, incluidas las versiones de cada servicio
./service-user-key.sh api  <key.json>
./service-user-key.sh core <key.json>
cd nats && ./bootstrap.sh && cd ..    # o copiar el creds/ ya generado
docker compose pull
docker compose up -d
```

Diferencias con el entorno local:

- Requiere dos redes externas: la de ingress (`INGRESS_NETWORK`) y la de base de datos
  (`DATABASE_NETWORK`).
- Las versiones se fijan por servicio (`API_VERSION`, `CORE_VERSION`, …), así se puede
  desplegar core sin tocar los fronts.
- El usuario de solo lectura hay que crearlo a mano (SQL más abajo); `local.sh` lo hace
  solo, pero el compose de producción no.

---

## Cómo se reparten los secretos

| Qué                                               | Dónde                       | Versionado |
| ------------------------------------------------- | --------------------------- | ---------- |
| Contraseñas, client ids, keys de service user     | `deploy/.env`               | no         |
| Identidad de NATS (operator, cuentas, sentinelas) | `deploy/nats/creds/`        | no         |
| Política de acceso al bus (roles → permisos)      | `deploy/nats/auth-callout/` | **sí**     |

La política de acceso se versiona a propósito: es una decisión de producto, no un secreto.

### El usuario de solo lectura

La api conecta con `DATABASE_READONLY_USER`. `local.sh` lo crea; en un servidor hay que
hacerlo una vez:

```sql
CREATE USER jiku_readonly WITH PASSWORD '...';
GRANT CONNECT ON DATABASE jiku TO jiku_readonly;
GRANT USAGE ON SCHEMA public TO jiku_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO jiku_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO jiku_readonly;
```

La última línea importa: sin ella, las tablas que cree una migración futura quedan
inaccesibles para la api.

**Las migraciones son la excepción**: las corre la api al arrancar y necesitan escribir,
así que usan `POSTGRESQL_MIGRATION_USER` (el dueño de la base).

---

## Diagnóstico

### `Errors.App.NotFound` al loguear en un front

Zitadel no reconoce el `client_id`: la **aplicación** no existe o fue recreada. El
_proyecto_ puede existir igual — son cosas distintas.

```sh
curl -s "https://<tu-instancia-zitadel>/oauth/v2/authorize?client_id=<CLIENT_ID>\
&redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fapi%2Fauth%2Fcallback%2Fzitadel\
&response_type=code&scope=openid" -o /dev/null -w "%{http_code}\n"
```

`302` = la app existe. `400` = no.

La aplicación tiene que ser de tipo **User Agent / PKCE** (los fronts no usan client
secret) y declarar el redirect URI exacto:
`http://localhost:3000/api/auth/callback/zitadel` para web, `:3001` para opus-web.

### `Authorization Violation` al conectar al bus

El token del service user no sirve. Para ver por qué:

```sh
./zitadel-token.sh --check <key.json>
```

Dice si el token es JWT u opaco, cuándo expira y qué roles trae. Las dos causas
habituales: el machine user emite tokens opacos (Access Token Type = Bearer), o le falta
el rol.

### Inspeccionar el bus

```sh
./bus-inspect.sh status                            # conexiones y contadores
./bus-inspect.sh logs                              # comandos que procesó core
./bus-inspect.sh tail                              # en vivo
./bus-inspect.sh send clients.new '{"name":"X"}'   # publicar uno a mano
```

`tail` y `logs` leen la traza de core, que con `LOG_COMMANDS=true` imprime cada comando y
su respuesta:

```
[cmd] clients.new <- {"name":"Prueba"}
[cmd] clients.new -> {"status":"success","data":{"id":10}}
```

Apagada por defecto: el payload lleva datos de negocio.

**Un `nats sub` no sirve para espiar.** Los permisos que mintea el auth-callout son
cerrados a propósito: `internal-app` solo publica bajo su sesión y `core` solo escucha su
endpoint. Para eso está el rol `bus-observer` en
[nats/auth-callout/templates/observer.yaml](nats/auth-callout/templates/observer.yaml),
que escucha todo sin poder publicar. Necesita un service user con ese rol y es **solo para
entornos locales**: leería el contenido de todos los comandos.

---

## Sin dependencias externas

`docker-compose.dev.yml` levanta el stack con el IdP `mock` del callout, sin Zitadel ni
red. Los tokens tienen formato `mock:<sub>:<username>:<roles>`.

```sh
cp .env.dist .env
docker compose -f docker-compose.dev.yml up --build
```

web en 3001, opus-web en 3002, NATS en 4222, PostgreSQL en 5432.

---

## Notas

- **Las migraciones las corre la api** al arrancar, con `POSTGRESQL_MIGRATION_USER`.
- **auth-callout no vive en este repo**: se consume como imagen publicada en Docker Hub
  (`gravadigital/nats-zitadel-auth-callout`), y trae **solo el callout** — el servidor NATS es
  un servicio propio del compose. Lo que sí está acá es su configuración
  (`nats/auth-callout/`), que se monta por path y se lee al arrancar.
- **JetStream está apagado**: el protocolo es request/reply directo.
