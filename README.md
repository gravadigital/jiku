# Jiku

[![CI](https://github.com/gravadigital/jiku/actions/workflows/ci.yml/badge.svg)](https://github.com/gravadigital/jiku/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Project management for a services team, with a separate portal so clients can follow and
request work without access to the internal tool.

Reads and writes are separated into two services: an **api** that only reads, and a **core**
that concentrates every write, talking over NATS.

```
web ─────┐
         ├── HTTP ──> api ── NATS ──> core ──> PostgreSQL
opus-web ┘           (reads)  req/reply  (writes)
         │
         └── the file, direct, with a URL core signs ──> S3
```

The interesting part is that **the split is enforced by database permissions, not by
convention**: the API connects with a role that only holds `SELECT`, so an accidental write
fails at the driver rather than in code review.

Files never pass through either service: the browser asks the bus for permission and moves the
byte straight to the bucket with a URL `core` signed. `core` is also the only service holding
bucket credentials, so the api cannot reach an object it was not signed a URL for.

Alongside the writes, `core` serves **reads over the bus** as a second service, `jiku-queries`,
on its own read-only connection — for consumers other than the two frontends, which keep going
through the api over HTTP.

## What it does

Actors and projects, requirements with a lifecycle and client-visible comments, tasks, worked
and unworked hours with reports, and attachments on any S3-compatible storage. Two frontends:
one internal, one for clients.

Full description in [documentation/features.md](documentation/features.md).

## Structure

An npm workspace: one `npm install` from the root covers everything.

| Directory                        | What it is                                                      |
| -------------------------------- | --------------------------------------------------------------- |
| [api/](api/)                     | HTTP service: reads the database, publishes commands to the bus |
| [core/](core/)                   | The only service that writes; also serves reads over the bus    |
| [web/](web/)                     | Internal frontend (Next.js)                                     |
| [opus-web/](opus-web/)           | Client portal (Next.js)                                         |
| [packages/](packages/)           | Shared code: models, bus contract, identity-provider auth       |
| [deploy/](deploy/)               | Composes, NATS and auth-callout configuration                   |
| [documentation/](documentation/) | Using and running Jiku — the public documentation               |
| [docs/](docs/)                   | Operation and integration guides (Spanish): `operacion.md`, `integracion.md` |
| [_gflow/](_gflow/)               | Product definition: requirements, rules, decisions, contracts (`apis/`), schemas |
| [old_docs/](old_docs/)           | Previous internal documentation (ADRs, flows, stories): historical, not maintained |

## Getting started

Requires **Node.js 24** and **Docker**.

```sh
npm install     # installs the 4 projects and builds the shared packages
npm run build
npm test
npm run lint
```

To run the whole stack, see [documentation/installation.md](documentation/installation.md).

> **Read that first if you plan to deploy.** Starting the stack needs a NATS identity and two
> identity-provider service users that are not in this repository, and there is no way around
> it today. It is the sharpest edge in the project.

## Cómo levantarlo en local

> Esta sección está en español: es la guía de trabajo del equipo. El detalle completo, con la
> solución de problemas, está en [deploy/README.md](deploy/README.md).

Hoy el producto completo se levanta con `deploy/local.sh up`, que usa
`deploy/docker-compose.local.yml`. El requisito de alineación agrega un `docker-compose.yml` en la
raíz y `make up` / `make down` / `make logs`, para levantar todo desde un clon limpio solo con
Docker; mientras tanto, hace falta lo siguiente.

### Qué se necesita

- **Node.js 24** (ver [`.nvmrc`](.nvmrc)), **Docker** con Compose, **`nsc`** (la CLI de NATS),
  `jq`, `curl` y `python3`.
- **Un Zitadel real** con: una app OIDC de tipo User Agent con PKCE para los dos frontends (redirect
  `http://localhost:3000/api/auth/callback/zitadel` y `http://localhost:3001/api/auth/callback/zitadel`);
  un proyecto con los roles `admin`, `user`, `external-user`, `internal-app` y `core`; y dos
  *machine users* con **Access Token Type = JWT** y su JSON key: uno para la api (rol
  `internal-app`) y otro para core (rol `core`).
- **Un dump `.sql` del esquema**: las migraciones de `api/db-upgrade/migrations/` modifican un
  esquema existente y no lo crean desde cero. Sin dump, la api no arranca.

### Pasos

```sh
npm install                                   # instala los workspaces y compila packages/*
cd deploy
cp .env.dist .env                             # completar contraseñas, IDENTITY_*, GESTION_ZITADEL_*,
                                              # secretos de NextAuth, CORE_TRUSTED_PUBLISHER_ID y DUMP_FILE
./service-user-key.sh api  <api-key.json>     # valida la key contra Zitadel y la guarda en .env
./service-user-key.sh core <core-key.json>
(cd nats && ./bootstrap.sh)                   # una vez: genera la identidad de NATS en nats/creds/
./local.sh up                                 # levanta todo
(cd nats && ./create-events-stream.sh)        # una vez, con todo arriba: el stream de eventos JIKU_EVENTS
```

`./local.sh up` levanta PostgreSQL, carga `DUMP_FILE` si la base está vacía, crea el rol de solo
lectura, levanta MinIO y crea el bucket, construye y levanta core, api, web y opus-web, y crea el
registro de módulos `JIKU_MODULES` y el espacio `JIKU_KV`. La api aplica las migraciones al
arrancar. `./local.sh logs [servicio]` sigue los logs y `./local.sh down` baja todo **y borra los
datos**.

Hay además `deploy/docker-compose.dev.yml`, que usa un proveedor de identidad falso (el modo `mock`
del auth-callout), pero hoy necesita ajustes a mano: cargar el esquema, crear el rol de solo
lectura y pasar `GESTION_IDP_MODE=mock`.

### Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Gestión interna (`web`) | http://localhost:3000 |
| Portal de clientes (`opus-web`) | http://localhost:3001 |
| api HTTP | http://localhost:3100/api |
| Links públicos de documentación | http://127.0.0.1:3100/p/docs/&lt;token&gt; |
| NATS (clientes / monitoreo) | `nats://localhost:4222` / http://localhost:8222 |
| MinIO (S3 / consola) | http://localhost:9000 / http://localhost:9001 |
| PostgreSQL | `localhost:5432` |
| Herramientas del bus | `deploy/bus-inspect.sh status\|tail\|logs\|send`, `deploy/zitadel-token.sh --check <key.json>`, `deploy/nats/events-test-consumer.sh` |

La configuración está en `deploy/.env`, creado desde `deploy/.env.dist`. Las variables están
explicadas en [docs/operacion.md](docs/operacion.md#configuración).

### El primer usuario

Jiku no gestiona usuarios: no hay alta ni semilla. Para entrar:

1. Crear la persona en Zitadel y darle un rol en el proyecto: `admin` o `user` para Gestión interna,
   `external-user` para el Portal de clientes.
2. Entrar con ella: la api autoriza leyendo el rol del token, y core crea su fila en `users` la
   primera vez que se conecta al bus o que publica un comando.
3. Lo que el producto no carga solo: la Persona (`people`, vinculada al usuario por `user_id`), las
   personas de cada proyecto y los permisos de proyecto de los clientes
   (`user_project_permissions`). Vienen en el dump o se insertan por SQL.

### Comandos

Hoy se usan los scripts de npm desde la raíz; el requisito de alineación agrega `make check`,
`make test`, `make lint`, `make typecheck`, `make migrate` y el resto de los targets.

| Comando | Qué hace |
|---|---|
| `npm install` | Instala los siete workspaces y compila `packages/*` |
| `npm run build` | Compila los paquetes, la api y core (no los frontends) |
| `npm test` | Tests de `nats-protocol`, api, core, web y opus-web (api y core levantan un PostgreSQL efímero en Docker) |
| `npm run lint` | ESLint en todos los workspaces |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run upgrade-db -w @jiku/api` | Aplica las migraciones (la api también las corre al arrancar) |
| `npm run dev -w @jiku/web` (o `@jiku/opus-web`, `@jiku/api`, `@jiku/core`) | Un servicio con recarga |
| `scripts/set-version.sh --check` | Verifica que todo el monorepo tenga la misma versión |

### Documentación

- [`_gflow/prd/index.md`](_gflow/prd/index.md): la definición del producto — qué hace, reglas y
  decisiones —, con los contratos en [`_gflow/apis/`](_gflow/apis/) y los esquemas en
  [`_gflow/db-schemas/`](_gflow/db-schemas/). Los requisitos y su especificación están en Jiku.
- [`docs/operacion.md`](docs/operacion.md): cómo operarlo — salud, procesos, configuración,
  alertas, despliegue.
- [`docs/integracion.md`](docs/integracion.md): cómo integrarse por el bus (conectores, módulos y
  SDK).
- [`documentation/`](documentation/README.md): la documentación pública, en inglés.
- [`CHANGELOG.md`](CHANGELOG.md): los cambios por versión.
- [`AGENTS.md`](AGENTS.md): la guía para los agentes que trabajan en el repositorio.

## Documentation

Two sets of documentation, for two audiences:

**[documentation/](documentation/README.md)** — using and running Jiku. English, brief, stable.
Start with its README: it maps how the parts fit together.

| | |
|---|---|
| [features.md](documentation/features.md) | what the product does |
| [installation.md](documentation/installation.md) · [configuration.md](documentation/configuration.md) | how to run and configure it |
| [api-reference.md](documentation/api-reference.md) | the 92 HTTP endpoints |
| [_gflow/apis/core.asyncapi.yaml](_gflow/apis/core.asyncapi.yaml) | the bus contract (AsyncAPI) — source of truth for anything crossing the bus; queries, events and the module registry are its siblings in [_gflow/apis/](_gflow/apis/) |
| [known-limitations.md](documentation/known-limitations.md) | **read before adopting** |

**[_gflow/](_gflow/prd/index.md)** and **[docs/](docs/)** — the internal working documentation,
written in Spanish, for the team that builds Jiku. `_gflow/` holds the product definition
(requirements, rules, decisions, contracts and database schemas) and `docs/` the operation and
integration guides. It follows the grava-workflow methodology in [`.claude/`](.claude/). The
previous internal documentation (ADRs, flows, stories) is kept for history in
[old_docs/](old_docs/).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). For security issues, [SECURITY.md](SECURITY.md) —
please do not open a public issue.

## License

[Apache-2.0](LICENSE) © Grava Digital.
