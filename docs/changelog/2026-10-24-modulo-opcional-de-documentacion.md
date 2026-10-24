# Módulo opcional de documentación (jiku-docs) — qué cambia en una instalación existente

**Story:** S-075 a S-085 · **Request:** REQ-016 · **Fecha:** 2026-10-24

Jiku puede hablar con un servicio externo de documentación, jiku-docs, que vive en otro
repositorio. Es **opcional**: sin él, Jiku funciona igual y la interfaz no muestra nada de
documentos. La decisión de arquitectura está en
[ADR-015](../adrs/ADR-015-modulos-opcionales-del-bus.md); los recorridos, en los flujos
[descubrimiento-de-modulos](../flows/descubrimiento-de-modulos.md),
[documentos-desde-la-web](../flows/documentos-desde-la-web.md) y
[lectura-por-link-compartido](../flows/lectura-por-link-compartido.md).

## Contrato HTTP

- **27 operaciones nuevas, todas aditivas** (`x-jiku-module: docs` en `docs/apis/api.yaml`): estado
  del módulo (`GET /modules`, `GET /opus/modules`), 20 rutas internas `/docs/*`, 3 de portal
  `/opus/docs/*` (solo lectura, `visibility: public` forzado) y 2 públicas `GET /p/docs/*`.
- `PUT` pasa a estar bajo la autenticación global (`validateToken` para cinco métodos). Sin cambio de
  comportamiento: `week-assigned-times-put` ya autenticaba.
- Única exención de autenticación: `GET /p/docs/`, con host exclusivo, rate limit, token de 256 bits y
  404 indistinguible.
- Límite de cuerpo de 768kb solo en `POST`/`PUT` bajo `/api/docs`; el resto de la api conserva 100 kb.

## Bus

- Rol nuevo `docs` en el auth-callout (`rules.yaml`, regla `docs` **antes** de `internal-app`) con su
  plantilla `templates/docs.yaml`; `connector` y las plantillas de persona amplían los permisos de
  lectura y watch del KV `JIKU_MODULES`.
- KV nuevo `JIKU_MODULES` (clave `docs`, escrita por jiku-docs).
- La api pasa a **leer por el bus** para la documentación: segunda excepción a ADR-001.

## Core

- `SERVICE_ROLES = ['internal-app', 'core', 'docs']`: sin esto, el evento de autenticación del
  machine user de jiku-docs se descartaba. Sin migraciones.

## Notes for existing installations

```markdown
### Notes for existing installations

The documentation module is optional. Installations that do not run jiku-docs only need the
auth-callout update and a restart; nothing breaks without the module.

- **Create the `JIKU_MODULES` KV bucket.** Run `deploy/nats/create-modules-kv.sh` (idempotent;
  needs `nsc`, `docker`, the credentials from `bootstrap.sh` and JetStream enabled in the account).
  Without it the API logs an error and retries every 30 seconds, and the module reports as not
  installed. `./local.sh up` creates it, and therefore **now requires `nsc`**; `./local.sh down -v`
  deletes it.
- **Update and restart the auth-callout.** New `docs` rule above `internal-app`, new
  `templates/docs.yaml`, and widened `connector` and `person-*` templates. If the rule ends up below
  `internal-app` the machine user is matched as `internal-app` and the module cannot connect.
- **Create the `docs` role and the jiku-docs machine user, only if you install the module.** The
  role goes in the roles project (`GESTION_ZITADEL_PROJECT_ID`); the machine user carries both
  `internal-app` and `docs`, with Access Token Type JWT.
- **Deploy core before jiku-docs connects.** Core now accepts `docs` as a service role
  (`SERVICE_ROLES`); an older core drops the machine user's authentication event.
- **Optional new variables, empty by default:** `DOCS_PUBLIC_DOMAIN` (own host, distinct from
  `api.<DOMAIN>`, `DOMAIN` and `OPUS_DOMAIN`; create the DNS record first because the certificate is
  a single combined one; empty turns shared links off) and `API_TRUST_PROXY` (defaults to `1` in the
  production compose). `JIKU_PUBLIC_URL` is derived by the compose files and must match the one
  configured in jiku-docs. A malformed value stops the API at startup.
- **Wider `internal-app` scope.** Widening `connector.yaml` means every `internal-app` machine user
  can now call jiku-docs, which treats it as the `service` class and lets it read all documentation.
- The bus policy is literal: the templates authorize `jiku-docs-commands` and `jiku-docs-queries`.
  A module registered under another `serviceName` is rejected by the bus.
- No database migrations.
```
