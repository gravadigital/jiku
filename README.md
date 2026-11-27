# Jiku

[![CI](https://github.com/gravadigital/jiku/actions/workflows/ci.yml/badge.svg)](https://github.com/gravadigital/jiku/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Project management for a services team, with a separate portal so clients can follow and
request work without access to the internal tool.

> **En castellano:** Jiku es el gestor de proyectos de un equipo de servicios: actores y
> proyectos, requisitos con su ciclo de vida, tareas, horas trabajadas y no trabajadas con sus
> reportes, y adjuntos. Lo usa el equipo interno (`web`) y, por un portal aparte (`opus-web`), sus
> clientes, que siguen y piden trabajo sin entrar a la herramienta interna.

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

| Directory                                  | What it is                                                      |
| ------------------------------------------ | --------------------------------------------------------------- |
| [services/api/](services/api/)             | HTTP service: reads the database, publishes commands to the bus |
| [services/core/](services/core/)           | The only service that writes; also serves reads over the bus    |
| [services/web/](services/web/)             | Internal frontend (Next.js)                                     |
| [services/opus-web/](services/opus-web/)   | Client portal (Next.js)                                         |
| [packages/](packages/)                     | Shared code: models, bus contract, identity-provider auth       |
| [deploy/](deploy/)                         | Server composes, NATS and auth-callout configuration, the local fake identity provider |
| [\_jflow/](_jflow/)                        | The product definition and the contracts (`_jflow/apis/`), for agents |
| [documentation/](documentation/)           | Using and running Jiku — the public documentation               |
| [docs/](docs/)                             | Internal docs: operations guide, architecture, decisions, flows, stories |

## Cómo levantarlo

Para levantar el producto en local solo hace falta **Docker** (con Compose) y `make`. Para correr
los chequeos (`make check`, `make lint`, los tests) hace falta además **Node.js 24** en la máquina.

```sh
make up      # construye las imágenes, levanta todo y espera a que cada servicio esté listo
make down    # lo baja
make logs    # sigue los logs (S=api para uno solo)
```

| Qué | Dónde |
|---|---|
| web (la herramienta interna) | http://localhost:3000 |
| opus-web (el portal de clientes) | http://localhost:3001 |
| api (HTTP) | http://localhost:3100 |
| Proveedor de identidad de prueba | http://localhost:9400 (también `http://idp.localhost:9400`) |
| Mailpit (los mails que manda el producto) | http://localhost:8025 |
| Consola de MinIO (los archivos) | http://localhost:9001 (usuario `jiku-local`, clave `jiku-local-secret`) |
| NATS | `nats://localhost:4222`, monitoreo en http://localhost:8222 |

`make up` arranca, sin ninguna credencial, todo lo que el producto necesita: PostgreSQL con el
esquema que arman las migraciones (`migrate` corre el baseline y las migraciones de
`services/api/db-upgrade/`), NATS con su identidad generada y el auth-callout, un proveedor de
identidad de prueba en lugar de Zitadel (`deploy/test/fake-idp`), MinIO en lugar de S3 y Mailpit
en lugar del SMTP real.

### Usuarios de prueba

No hay que crear ningún usuario. Al entrar a web o a opus-web, la página de login del proveedor
de identidad de prueba deja elegir con quién entrar:

| Usuario | Nombre | Rol | Para qué |
|---|---|---|---|
| `admin` | Ana Admin | `admin` | Todo web, incluida la asignación de horas |
| `user` | Uriel Usuario | `user` | Web como integrante del equipo |
| `external` | Elena Externa | `external-user` | El portal de clientes (opus-web) |

Están en [deploy/test/fake-idp/users.json](deploy/test/fake-idp/users.json), junto con los
usuarios de máquina de la api y de core.

### Configuración local

No hace falta ningún `.env`: cada variable tiene un valor seguro por defecto en
`docker-compose.yml`. Para cambiar uno (un puerto, una clave local), copiá
[.env.example](.env.example) a `.env` y editá ese valor; `.env` no se versiona. Los servidores no
usan nada de esto: se configuran con `deploy/.env` (ver [deploy/README.md](deploy/README.md)).

## Comandos

`S={servicio}` limita cualquier comando a uno (`api`, `core`, `web`, `opus-web`): `make test S=api`.

| Comando | Qué hace |
|---|---|
| `make up` / `make down` | Levanta / baja todo el producto |
| `make logs` | Sigue los logs |
| `make dev` | Levanta con `docker compose watch`: reconstruye y reinicia un servicio cuando cambia su código o el de `packages/` |
| `make check` | Lint, typecheck y todos los tests; lo que tiene que pasar antes de cerrar un trabajo |
| `make test` | Todos los niveles de test; reportes JUnit en `reports/junit/` |
| `make test-unit` · `make test-integration` · `make test-e2e` | Un nivel. Los de integración usan una base PostgreSQL propia de Compose; los end-to-end corren contra `make up` |
| `make lint` · `make typecheck` · `make fmt` | Chequeos estáticos y formato |
| `make migrate` | Aplica las migraciones a la base local |
| `make build` | Construye las imágenes |

Los comandos de npm siguen funcionando para quien los prefiera:

```sh
npm install     # installs the 4 projects and builds the shared packages
npm run build
npm test
npm run lint
```

To run the whole stack on a server, see [documentation/installation.md](documentation/installation.md)
and [deploy/README.md](deploy/README.md).

> **Read that first if you plan to deploy.** Starting the stack on a server needs a NATS identity
> and two identity-provider service users that are not in this repository, and there is no way
> around it today. It is the sharpest edge in the project. (Locally, `make up` generates the NATS
> identity and uses the fake identity provider, so none of this applies.)

## Documentación

- [`docs/operacion.md`](docs/operacion.md): cómo operarlo — salud, procesos en segundo plano,
  configuración, alertas, secretos del CI y despliegue.
- [`docs/adopcion.md`](docs/adopcion.md): el informe de la adopción de Jiku a jiku flow.
- [`documentation/`](documentation/README.md): la documentación pública, en inglés (ver abajo).
- [`CHANGELOG.md`](CHANGELOG.md): los cambios por versión.
- La definición del producto (qué hace, reglas y decisiones) está en `_jflow/prd/`, y los
  contratos en `_jflow/apis/`; los requisitos con su especificación, en Jiku.
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
| [_jflow/apis/core.asyncapi.yaml](_jflow/apis/core.asyncapi.yaml) | the bus contract (AsyncAPI) — source of truth for anything crossing the bus |
| [known-limitations.md](documentation/known-limitations.md) | **read before adopting** |

**[docs/](docs/)** — the internal working documentation: the operations guide, architecture per
service, conventions, stories and decision records. Written in Spanish, for the team that builds
Jiku. It follows the grava-workflow methodology in [`.claude/`](.claude/).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). For security issues, [SECURITY.md](SECURITY.md) —
please do not open a public issue.

## License

[Apache-2.0](LICENSE) © Grava Digital.
