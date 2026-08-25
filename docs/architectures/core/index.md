# Arquitectura: core — Índice

> Generado a partir de `manifest.yaml`. No editar a mano.

Consumidor NATS de Jiku: **el único servicio que escribe en la base de datos**. Atiende los comandos
que publica la api, valida las reglas de negocio y escribe, y desde REQ-006 atiende además **el
contrato de consultas del producto** por una conexión de solo lectura. No expone HTTP y **no valida
tokens**; sí lee roles, y solo en el plano de consultas.

- **Tipo:** worker · **Lenguaje:** node (TypeScript, `strict`) · **Path:** `core/`
- **Expone:** **20 comandos** (`jiku-commands`) y **23 consultas sobre 16 recursos**
  (`jiku-queries`), request/reply sin JetStream, dos micro servicios sobre una sola conexión
- **Consume:** PostgreSQL `jiku` por **dos conexiones** (usuario dueño para escribir, rol de solo
  lectura para consultar), NATS, Zitadel (solo su propio token), S3 (las dos firmas de `files`)

## Documentos

| Documento | Contenido |
|---|---|
| [overview.md](./overview.md) | La decisión de ser el único escritor, la transacción del despachador, estructura, módulos, reglas que viven acá, limitaciones |
| [manifest.yaml](./manifest.yaml) | Declaración de convenciones y módulos |
| [`docs/apis/core.yaml`](../../apis/core.yaml) | Contrato AsyncAPI de los **20 comandos**. **Es la fuente de verdad**: ante discrepancia con el código, manda el documento |
| [`docs/apis/core-queries.yaml`](../../apis/core-queries.yaml) | Contrato AsyncAPI de las **23 consultas sobre 16 recursos**, con las cinco listas blancas por recurso. **Es la fuente de verdad** con el mismo criterio |
| [`docs/db-schemas/jiku.md`](../../db-schemas/jiku.md) | Esquema de la base compartida con `api` |
| [`docs/flows/consulta-por-el-bus.md`](../../flows/consulta-por-el-bus.md) | El recorrido completo de una consulta, de la publicación al cursor |

## Convenciones

Las 12 son **custom**: el stack del servicio (Joi, Sequelize, Winston, Mocha, dotenv, GitHub
Actions) difiere del que recomienda el catálogo de Node (Zod, Prisma, Pino, Vitest +
Testcontainers, `@t3-oss/env-core`, GitLab CI). `core` es un servicio existente que se importó al
workflow y su stack es anterior al catálogo.

Es el mismo caso que [`api`](../api/), con una diferencia: core **no declara `http-server`**. No
expone HTTP en absoluto, y esa ausencia es estructural, no una omisión.

Tres no tienen equivalente en el catálogo y son **nuevas**, no reemplazos:

- **`bus-consumer`** — la conexión al bus. El catálogo solo cubre colas (`queue`/BullMQ), que es otra
  cosa: esto es request/reply sincrónico, sin persistencia ni reintento.
- **`commands`** — la unidad de trabajo del servicio. Recoge la decisión más importante del
  codebase: la transacción es del despachador y el comando no puede tocarla.
- **`contract-translation`** — las traducciones entre el vocabulario del bus y el de la base: cuatro
  de escritura, repartidas entre comandos, y seis de **solo lectura**, que viven en las fichas de
  consulta. Existe porque olvidarse una escribe en la columna equivocada, o publica el nombre de una
  columna en el contrato.

| id | Display name | Qué cubre |
|---|---|---|
| [_base](./conventions/_base.md) | Convenciones generales (core) | `strict: true`, un archivo por comando, imports relativos, las dos representaciones de fecha, comentarios del por qué |
| [bus-consumer](./conventions/bus-consumer.md) | Consumo del bus (NATS request/reply) | Gramática de subjects, queue group, el inbox hasheado, el drain al cerrar, lo que el patrón NO da |
| [commands](./conventions/commands.md) | Comandos (validar y escribir) | La interfaz `Command`, el registry por segmentos, la transacción del despachador, la edición parcial, el orden dentro de `execute` |
| [contract-translation](./conventions/contract-translation.md) | Traducción contrato ↔ base | task/objective, properties/keyValuePairs, priority enum/entero, el escape transitorio `priorityValue`, y las seis traducciones de solo lectura de las fichas (incluida `hours-per-day` ← `hours_per_day`) |
| [orm](./conventions/orm.md) | Acceso a datos (Sequelize, usuario dueño) | La conexión de escritura, modelos compartidos, sin repositorio, por qué toda operación lleva la transacción |
| [validation](./conventions/validation.md) | Validación de payloads (Joi por comando) | `validateWith`, defaults solo en el new, qué acepta `null`, coerción cuando la columna no coincide |
| [error-handling](./conventions/error-handling.md) | Manejo de errores (`Reply` de falla) | El `status` decide la transacción, el despachador nunca lanza, el catálogo de códigos y su deuda |
| [logging](./conventions/logging.md) | Logging (Winston) | Transports por entorno, prefijos de origen, la traza `LOG_COMMANDS` y por qué está apagada |
| [testing](./conventions/testing.md) | Testing (Mocha + base real) | Por qué entran por el despachador, el orden de arranque, qué cubrir en un comando |
| [env-config](./conventions/env-config.md) | Configuración (dotenv, sin validación) | Las variables y qué rompe si faltan, dónde se lee cada una, los modos de falla silenciosos |
| [dockerfile](./conventions/dockerfile.md) | Dockerfile (workspace de monorepo) | Contexto en la raíz, las dos etapas, por qué `--ignore-scripts`, por qué `NODE_ENV=production` importa |
| [ci-github](./conventions/ci-github.md) | CI/CD (GitHub Actions) | Los tres workflows, la base que necesitan los tests, tags y caché por servicio |

### No aplican

Preocupaciones del catálogo que este servicio no tiene:

| id | Por qué |
|---|---|
| `http-server` | **No expone HTTP.** Sin puerto, sin endpoints, sin verbos, sin framework web. Es la diferencia estructural con `api` |
| `auth-jwt` | No valida tokens de usuario. Solo obtiene el suyo para el bus, y eso vive en `bus-consumer` |
| `authorization` | No hay un framework de autorización que configurar. **Matiz desde REQ-005/006:** los dos despachadores autorizan al *caller del subject* contra `users.roles`, y el de consultas resuelve además una *clase de caller* que decide el recorte de filas. Eso vive en `authorize-caller.ts` y en las fichas, no en una preocupación transversal; la autorización del usuario final sigue siendo de `api` |
| `cache` | No hay Redis ni cache de aplicación |
| `queue` | No hay cola de trabajos. El bus es request/reply sincrónico, cubierto por `bus-consumer` |
| `observability` | No hay OpenTelemetry ni tracing. La observabilidad es el log de Winston |
| `security` | Sin superficie HTTP no hay headers, CORS ni rate limiting que configurar |
| `storage` | **Desactualizado desde REQ-001:** core **es el único dueño del storage** — firma PUT y GET contra S3 en `commands/files/`, y la api no tiene credenciales de S3. No se declara como convención transversal porque la superficie es de dos comandos, no del servicio |

## Módulos

**La lista ya no describe solo `src/commands/`.** Los siete primeros son carpetas de comandos, una por
entidad, con un archivo por comando. El octavo —`queries`— es la **superficie de lectura completa** y
vive en `src/queries/`.

| Módulo | Comandos | Carpeta | Superficie |
|---|---|---|---|
| `clients` | 2 | `commands/clients/` | "Actores" en la UI, `clients` en la base y en el bus |
| `projects` | 2 | `commands/projects/` | Traduce `properties` ↔ `key_value_pairs` |
| `tasks` | 3 | `commands/tasks/` | Tabla `objectives`. El historial se calcula a mano, antes de escribir |
| `requirements` | 6 | `commands/requirements/` | El historial lo calcula el hook `@BeforeUpdate` del modelo |
| `times` | 4 | `commands/times/` | Tope diario compartido entre horas trabajadas y ausencias |
| `attachments` | 1 | `commands/attachments/` | Borrado lógico del vínculo; el archivo lo retiene `files` |
| `files` | 2 | `commands/files/` | Firma PUT y GET contra S3. La api **no** tiene credenciales de S3 |
| **`queries`** | — | **`src/queries/`** | **23 endpoints sobre 16 recursos.** Un motor genérico que no conoce ningún recurso, más una ficha por recurso: las cinco listas blancas como DATO. Contrato: `docs/apis/core-queries.yaml` |
