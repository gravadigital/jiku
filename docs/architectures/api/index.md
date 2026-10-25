# Arquitectura: api — Índice

> Generado a partir de `manifest.yaml`. No editar a mano.

Única puerta HTTP de Jiku. Autentica contra Zitadel, autoriza por rol y por entidad, **lee la base
directamente** y convierte toda mutación en un comando publicado en NATS que atiende `core`. Con el
módulo opcional de documentación (jiku-docs) instalado, también lee y escribe documentos **por el
bus** en nombre de la persona ([ADR-015](../../adrs/ADR-015-modulos-opcionales-del-bus.md)).

- **Tipo:** api · **Lenguaje:** node (TypeScript) · **Path:** `api/`
- **Expone:** 89 operaciones (`docs/apis/api.yaml`) — 72 internas bajo `/api`, 15 del portal en `/api/opus/*` y 2 públicas en `/p/docs/*` (en la raíz, host propio)
- **Consume:** PostgreSQL (solo lectura), NATS (→ core; → jiku-docs, **opcional**, descubierto por el KV `JIKU_MODULES`), Zitadel, storage S3-compatible

## Documentos

| Documento | Contenido |
|---|---|
| [overview.md](./overview.md) | La decisión de leer/escribir separado y sus excepciones, estructura, módulos, autorización, reglas que viven acá, limitaciones |
| [manifest.yaml](./manifest.yaml) | Declaración de convenciones y módulos |

## Convenciones

Las 15 son **custom**: el stack del servicio (Express 5, Joi, Sequelize, `jsonwebtoken`, Winston,
Mocha, dotenv, GitHub Actions) difiere del que recomienda el catálogo de Node (Fastify, Zod,
Prisma, `jose`, Pino, Vitest + Testcontainers, `@t3-oss/env-core`, GitLab CI). `api` es un
servicio existente que se importó al workflow y su stack es anterior al catálogo.

Tres no tienen equivalente en el catálogo y son **nuevas**, no reemplazos:

- **`bus-commands`** — la escritura por NATS. Es la decisión estructural del servicio, y el
  catálogo solo cubre colas (`queue`/BullMQ), que es otra cosa: esto es request/reply sincrónico.
- **`bus-modules`** — las llamadas, de lectura y de escritura, a módulos opcionales del bus (hoy
  jiku-docs): descubrimiento por registro, estado por réplica, identidad con el `actor` de `buildActor` (falla cerrado) y mapa de
  errores propio del módulo. Es la segunda excepción a la lectura directa de la base (ADR-015).
- **`ci-github`** — el catálogo solo trae `ci-gitlab`.

Y dos separan lo que el catálogo trata junto:

- **`authorization`** — el catálogo la mete dentro de `auth-jwt`; acá se separa porque el permiso
  por entidad tiene ~180 líneas de lógica propia.
- **`storage`** — sin equivalente: es la única superficie con estado externo.

| id | Display name | Qué cubre |
|---|---|---|
| [_base](./conventions/_base.md) | Convenciones generales (api) | Sin `src/`, dominio en el prefijo del archivo, imports relativos, `strict` apagado, comentarios del por qué |
| [http-server](./conventions/http-server.md) | Servidor HTTP (Express 5, un archivo por endpoint) | Montaje automático por barrel, la excepción de `lib/public-routes/` en la raíz, forma del archivo de ruta, orden de la cadena de middlewares, paginación |
| [bus-commands](./conventions/bus-commands.md) | Escritura por el bus (NATS request/reply) | `sendCommand`/`runCommand`, traducción de errores a HTTP, traductores de contrato, identidad en el bus |
| [bus-modules](./conventions/bus-modules.md) | Llamadas a módulos opcionales del bus (NATS) | `requireModule`, `moduleQuery`/`moduleCommand`, estado `not_installed`/`unavailable`/`available`, `actor` de `buildActor` que falla cerrado, cuerpo `{code, message, details?}` |
| [orm](./conventions/orm.md) | Acceso a datos (Sequelize, solo lectura) | La conexión de solo lectura y sus dos excepciones, modelos compartidos, filtros, migraciones |
| [validation](./conventions/validation.md) | Validación de inputs (Joi, inline en la ruta) | Los dos middlewares, enums derivados del modelo, qué no valida Joi |
| [error-handling](./conventions/error-handling.md) | Manejo de errores (`{code, message}` inline) | Códigos por situación, errores del bus, el cuerpo con `details` de los módulos, los handlers finales rotos de `app.ts` |
| [auth-jwt](./conventions/auth-jwt.md) | Autenticación JWT (Zitadel + JWKS propio) | Instalación global por los cinco métodos, la única exención (`GET /p/docs/`), reintento del JWKS, roles del claim, el bypass y sus tres candados |
| [authorization](./conventions/authorization.md) | Autorización (rol + permiso por entidad) | Las tres capas, `hasAnyRole`, permiso de proyecto, los 9 `entityType` de adjuntos, la superficie de documentación (la api no autoriza el dominio) |
| [logging](./conventions/logging.md) | Logging (Winston + express-winston) | Transports por entorno, prefijos de origen, por qué `meta: false`, `/p/docs/*` con el token enmascarado |
| [storage](./conventions/storage.md) | Almacenamiento de adjuntos (S3-compatible) | Clave del objeto, doble lista blanca, rollback, el endpoint público enumerable |
| [testing](./conventions/testing.md) | Testing (Mocha + base real + FakeBus) | Base real, el doble que ejecuta core, los dobles de módulo (KV, ping), qué cubrir en un test de ruta |
| [env-config](./conventions/env-config.md) | Configuración de entorno (dotenv + asserts) | Las variables y qué rompe si faltan (incl. `JIKU_PUBLIC_URL`, `API_TRUST_PROXY`), los asserts de arranque |
| [dockerfile](./conventions/dockerfile.md) | Dockerfile (workspace de monorepo) | Contexto en la raíz, las dos etapas, por qué `--ignore-scripts` |
| [ci-github](./conventions/ci-github.md) | CI/CD (GitHub Actions) | Los tres workflows, concurrencia, tags, verificación de versión |

### No aplican

Preocupaciones del catálogo que este servicio no tiene:

| id | Por qué |
|---|---|
| `cache` | no hay Redis ni cache de aplicación. Las lecturas van a PostgreSQL en cada request |
| `queue` | no hay cola de trabajos. El bus es request/reply sincrónico, cubierto por `bus-commands` y `bus-modules` |
| `observability` | no hay OpenTelemetry ni tracing distribuido. La observabilidad es el log de Winston |
| `security` | no hay `helmet` y CORS está abierto (`app.ts`). Hay **rate limiting y cabeceras de seguridad solo en `/p/docs/*`** (60/min/IP por réplica; CSP, `noindex`, `no-store`), puestas a mano por `lib/utils/middlewares/public-docs.ts`. El resto de la api no tiene ninguno |

## Módulos

Los módulos no son carpetas: son **grupos de archivos de ruta con un prefijo común** en
`lib/routes/`.

| Módulo | Prefijo | Endpoints | Superficie |
|---|---|---|---|
| `clients` | `clients-*` | 5 | "Actores" en la UI |
| `projects` | `projects-*` | 6 | Con `keyValuePairs` de enlaces |
| `requirements` | `requirements-*` | 8 | Reglas de resolución propias |
| `objectives` | `objectives-*` | 6 | "Tareas" en la UI, `task` en el bus |
| `worked-times` | `worked-times-*` | 8 | Carga de horas + 3 reportes |
| `unworked-times` | `unworked-times-*` | 5 | Ausencias y motivos |
| `week-assigned-times` | `week-assigned-times-*` | 2 | Escribe con el ORM; solo `admin` |
| `attachments` | `attachments-*` | 6 | S3, rollback, checksum |
| `opus` | `opus-*` (salvo docs y modules) | 11 | Portal de clientes |
| `auth` | `auth-present-post`, `settings-get`, `persons-get` | 3 | `present` es hoy un no-op |
| `modules` | `modules-get`, `opus-modules-get` | 2 | Estado de los módulos opcionales |
| `docs` | `docs-*`, `opus-docs-*`, `lib/public-routes/public-docs-*` | 25 | jiku-docs por el bus: 20 internas, 3 de portal, 2 públicas |

## Documentación relacionada

| Documento | Contenido |
|---|---|
| [../../analysis/services/api.md](../../analysis/services/api.md) | Análisis de importación |
| [../../apis/api.yaml](../../apis/api.yaml) | OpenAPI 3.0 — las 89 operaciones |
| [../../apis/core.yaml](../../apis/core.yaml) | AsyncAPI del bus — el otro lado de cada comando |
| [../../apis/jiku-modules.yaml](../../apis/jiku-modules.yaml) | Contrato del registro `JIKU_MODULES` (descubrimiento de módulos) |
| [../../adrs/ADR-015-modulos-opcionales-del-bus.md](../../adrs/ADR-015-modulos-opcionales-del-bus.md) | Decisión de los módulos opcionales del bus y la segunda excepción a ADR-001 |
| [../../db-schemas/jiku.md](../../db-schemas/jiku.md) | Las 28 entidades de la base |
