# Arquitectura: core — Índice

> Generado a partir de `manifest.yaml`. No editar a mano.

Consumidor NATS de Jiku: **el único servicio que escribe en la base de datos**. Atiende los comandos
que publica la api, valida las reglas de negocio y escribe. No expone HTTP y no valida tokens ni
roles.

- **Tipo:** worker · **Lenguaje:** node (TypeScript, `strict`) · **Path:** `core/`
- **Expone:** 17 comandos NATS, request/reply sin JetStream
- **Consume:** PostgreSQL `jiku` (lectura y **escritura**), NATS, Zitadel (solo su propio token)

## Documentos

| Documento | Contenido |
|---|---|
| [overview.md](./overview.md) | La decisión de ser el único escritor, la transacción del despachador, estructura, módulos, reglas que viven acá, limitaciones |
| [manifest.yaml](./manifest.yaml) | Declaración de convenciones y módulos |
| [`docs/apis/core.yaml`](../../apis/core.yaml) | Contrato AsyncAPI de los 17 comandos. **Es la fuente de verdad**: ante discrepancia con el código, manda el documento |
| [`docs/db-schemas/jiku.md`](../../db-schemas/jiku.md) | Esquema de la base compartida con `api` |

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
- **`contract-translation`** — las cuatro traducciones entre el vocabulario del bus y el de la base.
  Existe porque están repartidas entre varios comandos y olvidarse una escribe en la columna
  equivocada.

| id | Display name | Qué cubre |
|---|---|---|
| [_base](./conventions/_base.md) | Convenciones generales (core) | `strict: true`, un archivo por comando, imports relativos, las dos representaciones de fecha, comentarios del por qué |
| [bus-consumer](./conventions/bus-consumer.md) | Consumo del bus (NATS request/reply) | Gramática de subjects, queue group, el inbox hasheado, el drain al cerrar, lo que el patrón NO da |
| [commands](./conventions/commands.md) | Comandos (validar y escribir) | La interfaz `Command`, el registry por segmentos, la transacción del despachador, la edición parcial, el orden dentro de `execute` |
| [contract-translation](./conventions/contract-translation.md) | Traducción contrato ↔ base | task/objective, properties/keyValuePairs, priority enum/entero, y el escape transitorio `priorityValue` |
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
| `authorization` | No conoce roles ni usuarios finales. La autorización es de `api`, y la del bus la hace el auth-callout |
| `cache` | No hay Redis ni cache de aplicación |
| `queue` | No hay cola de trabajos. El bus es request/reply sincrónico, cubierto por `bus-consumer` |
| `observability` | No hay OpenTelemetry ni tracing. La observabilidad es el log de Winston |
| `security` | Sin superficie HTTP no hay headers, CORS ni rate limiting que configurar |
| `storage` | No toca el storage S3. Confirma filas de `attachments`, pero los objetos los sube `api` |

## Módulos

Los módulos son **carpetas bajo `src/commands/`**, una por entidad. Un archivo por comando.

| Módulo | Comandos | Carpeta | Superficie |
|---|---|---|---|
| `clients` | 2 | `commands/clients/` | "Actores" en la UI, `clients` en la base y en el bus |
| `projects` | 2 | `commands/projects/` | Traduce `properties` ↔ `key_value_pairs` |
| `tasks` | 3 | `commands/tasks/` | Tabla `objectives`. El historial se calcula a mano, antes de escribir |
| `requirements` | 6 | `commands/requirements/` | El historial lo calcula el hook `@BeforeUpdate` del modelo |
| `times` | 4 | `commands/times/` | Tope diario compartido entre horas trabajadas y ausencias |
