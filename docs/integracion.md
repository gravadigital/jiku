# Integración con Jiku

Cómo se integra un servicio externo con Jiku: qué identidad necesita, qué operaciones puede usar y
cómo cambian sus versiones. Para la forma exacta de cada mensaje —campos, tipos, enums, errores—
mandan los contratos de [`_gflow/apis/`](../_gflow/apis/): si esta guía y un contrato no coinciden,
gana el contrato. La guía detallada anterior, con ejemplos de código, está en
[old_docs/guia-de-conectores.md](../old_docs/guia-de-conectores.md) (escrita para la v1.6.0).

## Quiénes se integran

Toda integración externa es **por el bus NATS**. La api HTTP es solo para los dos frontends de
Jiku: no hay API HTTP para integradores.

| Integrador | Qué es | Rol en Zitadel |
|---|---|---|
| **Conector** | Un servicio que lee, escribe o reacciona a lo que pasa en Jiku (por ejemplo, jiku-email-tickets). La propia api de Jiku es un conector más, con la misma plantilla de permisos | `internal-app` |
| **Módulo opcional** | Un servicio que agrega funciones a Jiku y que la api descubre por el registro `JIKU_MODULES`. El primero es **jiku-docs** (documentación), en su propio repositorio | `internal-app` y `docs` |
| **SDK** | jiku-go (`Client`) y jiku-ts (`client`), las librerías con las que se construyen conectores y módulos. Encapsulan la conexión, los subjects, el inbox y el espacio KV `JIKU_KV` | el del servicio que las usa |

## Cómo se autentican

Cada integrador tiene **dos credenciales, y las dos son obligatorias**:

1. **Un *service user* de Zitadel** (un *machine user*) con **Access Token Type = JWT** —el tipo
   por defecto emite tokens opacos y el auth-callout los rechaza— y el rol que le corresponde en
   el proyecto de Jiku (`GESTION_ZITADEL_PROJECT_ID` de la instalación). El servicio recibe su JSON
   key y con ella pide el token (flujo *JWT profile*), que vence en alrededor de una hora y se
   renueva en caliente. La implementación de referencia es
   [`packages/zitadel-auth/src/index.ts`](../packages/zitadel-auth/src/index.ts).
2. **Las credenciales NATS del sentinel** (`deploy/nats/creds/sentinel-client.creds`), que entrega
   quien opera la instalación junto con la URL de NATS y el valor de `NATS_INSTANCE`. Por sí solas
   no dan ningún permiso.

Al conectar con las dos, el servidor NATS delega en el **auth-callout**: valida el token contra
Zitadel, elige la plantilla de permisos según el rol
([`deploy/nats/auth-callout/`](../deploy/nats/auth-callout/README.md); un rol sin regla no conecta)
y emite un usuario NATS con esos permisos, atados al `sub` del token. Nadie puede publicar bajo un
id de usuario que no sea el suyo.

Tres detalles que conviene saber antes de empezar:

- **El inbox tiene que fijarse.** Las respuestas vuelven solo por `_INBOX.<hash>.>`, donde `<hash>`
  son los primeros 16 caracteres de `base32` (minúsculas, sin relleno) del SHA-256 del `userId`.
  Sin ese prefijo, todo pedido termina en timeout. La referencia es `hashUserId()` en
  [`packages/nats-protocol/src/index.ts`](../packages/nats-protocol/src/index.ts); los SDK ya lo
  hacen.
- **Core necesita una fila en `users` para el integrador.** La crea solo, con el evento que publica
  el auth-callout en cada autenticación. Esa entrega no es durable: si core estaba caído, las
  llamadas responden `unknown_caller` o `caller_not_authorized` hasta la próxima autenticación.
  Ante esos códigos al arrancar, reconectar.
- **`internal-app` es el permiso más amplio del producto**: todas las consultas y todos los
  comandos, sin recorte por visibilidad. Si el integrador expone datos de Jiku a terceros, el
  filtrado por `visibilityLevel` y por permisos de proyecto es responsabilidad suya. Un conector
  con permisos acotados es un rol nuevo, y eso es un cambio en Jiku.

Para verificar un token: `deploy/zitadel-token.sh --check <key.json>` dice si es JWT, cuándo vence
y qué roles trae.

## Qué operaciones usan

Los subjects siguen una gramática fija:

```
Comandos y consultas:  {instance}.{user-id}.{servicio}.v1.{método}
                       prod.281234567890123456.jiku-commands.v1.requirements.new
Eventos de dominio:    {instance}.events.v1.{entidad}.{acción}
                       prod.events.v1.requirement.state.changed
```

| Operación | Cómo | Contrato |
|---|---|---|
| **Consultas** (leer) | Request/reply a `{instance}.{user-id}.jiku-queries.v1.{recurso}.{list\|get}`. Filtros, orden, campos, *includes* y paginación por cursor. `meta.describe` devuelve el contrato en datos: campos, filtros y valores de cada enum | [core-queries.asyncapi.yaml](../_gflow/apis/core-queries.asyncapi.yaml) |
| **Comandos** (escribir) | Request/reply a `{instance}.{user-id}.jiku-commands.v1.{método}`, por ejemplo `requirements.new` o `tasks.{id}.edit`. Core aplica las mismas reglas que para la api y responde solo el `id`. **No son idempotentes ni tienen reintento**: ante un timeout, consultar antes de reintentar. Lo que escribe un conector queda a nombre de su *service user* | [core.asyncapi.yaml](../_gflow/apis/core.asyncapi.yaml) |
| **Eventos de dominio** (reaccionar) | Consumidor durable propio, con nombre único, sobre el stream de JetStream `JIKU_EVENTS` (`{instance}.events.v1.>`, retención de 7 días). Core los publica después del commit y sin reintento: un evento se puede perder y el dato no, así que conviene reconciliar por consultas. Entrega al menos una vez: deduplicar por `eventId`. Hoy hay eventos de requisitos y de tareas | [core-events.asyncapi.yaml](../_gflow/apis/core-events.asyncapi.yaml) |
| **Archivos** | El byte nunca viaja por el bus: `files.request-upload` devuelve una URL firmada, el integrador hace `PUT` directo al bucket y después manda el `id` en `fileIds` del comando que lo vincula | [core.asyncapi.yaml](../_gflow/apis/core.asyncapi.yaml) |
| **Registro de módulos** `JIKU_MODULES` | Bucket KV de JetStream. Cada módulo escribe **su propia clave** al arrancar (`$KV.JIKU_MODULES.{módulo}`) con su `serviceName` y su versión de protocolo, y atiende los servicios micro `{serviceName}-commands` y `{serviceName}-queries`. La api la observa y le hace `PING` cada 30 s para mostrar el estado del módulo. Conectores y personas solo lo leen | [jiku-modules.asyncapi.yaml](../_gflow/apis/jiku-modules.asyncapi.yaml) |
| **Espacio KV** `JIKU_KV` | Bucket KV de JetStream donde los SDK guardan el estado de cada integrador (jiku-go `Client.KV`, jiku-ts `client.kv()`). Las claves son `{instance}.{user-id}.{clave}`: cada identidad `internal-app` o `docs` lee y escribe **solo las suyas**, y las personas no tienen acceso. Sin TTL e historial 1. Lo crea `deploy/nats/create-kv-space.sh`; sin el bucket, el SDK no arranca | [deploy/nats/create-kv-space.sh](../deploy/nats/create-kv-space.sh) |

El módulo de documentación tiene además sus propios subjects (`jiku-docs-commands`,
`jiku-docs-queries`, `{instance}.docs-events.v1.>` y su stream `JIKU_DOCS_EVENTS`), definidos en el
contrato de jiku-docs, en su repositorio. La api de Jiku solo los consume.

## Dar de alta un integrador

No requiere cambiar nada en el repositorio de Jiku: la regla del auth-callout, las plantillas de
permisos, el stream y los buckets ya existen.

1. En Zitadel, crear el *machine user* con Access Token Type = JWT y asignarle el rol
   (`internal-app` para un conector; `internal-app` y `docs` para jiku-docs) en el proyecto de Jiku.
2. Generar su JSON key y entregarla al servicio, junto con las credenciales del sentinel, la URL de
   NATS y `NATS_INSTANCE`.
3. Si usa el espacio KV, verificar que la instalación tenga `JIKU_KV`
   (`cd deploy/nats && NATS_DOCKER_NETWORK=jiku_jiku-bus ./create-kv-space.sh`, idempotente). Si
   consume eventos, que tenga `JIKU_EVENTS` (`./create-events-stream.sh`).
4. Para un módulo, crear también el registro `JIKU_MODULES` (`./create-modules-kv.sh`) y seguir los
   pasos de [documentation/installation.md](../documentation/installation.md#the-documentation-module-optional).

El paso a paso del lado de la instalación, con el diagnóstico de los errores de conexión, está en
[deploy/README.md](../deploy/README.md#letting-an-external-service-publish).

## Cómo cambian las versiones

- **La versión va en el subject**: el segmento `v1` de comandos y consultas
  (`NATS_PROTOCOL_VERSION`) y el de eventos (`NATS_EVENTS_VERSION`) se versionan por separado. Un
  cambio incompatible en el bus sale con un segmento nuevo (`v2`); las plantillas del auth-callout
  hoy autorizan solo `v1`.
- **Dentro de `v1`, agregar no rompe**: un campo nuevo en una respuesta, en un evento o en el
  registro de módulos es compatible, y el integrador tiene que tolerarlo. Un `errorCode` que no
  conoce se trata como error genérico. Las decisiones se toman por `errorCode`, nunca por
  `errorMessage`.
- **Cada contrato tiene su `info.version`**, que sube el requisito que lo cambia. Hoy los cinco
  están en `1.0.0`.
- **La versión del producto** sigue SemVer para todo el monorepo: un cambio que rompe el contrato
  HTTP o el del bus es una versión mayor. Las notas de cada versión, con lo que tiene que hacer una
  instalación existente, están en [CHANGELOG.md](../CHANGELOG.md).
