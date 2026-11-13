---
id: bus-consumer
display_name: Consumo del bus (NATS request/reply)
language: node
description: NATS request/reply consumer with queue group, hashed inbox prefix and drain on shutdown
applies_to: [worker]
required_by: []
package: nats
---

# Consumo del bus (core, NATS)

> **Convención nueva**, sin equivalente en el catálogo (que solo cubre colas con `queue`/BullMQ).
> Esta no es una cola: es **request/reply sincrónico y sin persistencia**. La contraparte es
> `bus-commands` en `api`, que publica. Documenta la **entrada** del servicio — la **salida**,
> desde REQ-014, la documenta [`bus-publisher`](./bus-publisher.md).

## Cuándo aplica

Los dos planos de entrada del servicio: **comandos** (`jiku-commands`) y **consultas**
(`jiku-queries`), servidos como dos servicios micro sobre la misma conexión al bus. Core no expone
HTTP ni escucha ninguna otra fuente de entrada.

## Paquete

```
nats                    # 2.29, cliente
@jiku/nats-protocol     # gramática de subjects, Reply, ErrorCode, hash del inbox
@jiku/zitadel-auth      # token del service user
```

## Gramática de subjects

```
{instance}.{user-id}.{svc}.{version}.{método}
dev.323332022539911171.jiku-commands.v1.clients.new
dev.323332022539911171.jiku-queries.v1.tasks.list
```

| Segmento | Qué es | Variable |
|---|---|---|
| `instance` | Despliegue: `dev` / `prod` | `NATS_INSTANCE` |
| `user-id` | **Quién publica**: el `sub` del token, crudo | — |
| `svc` | A qué plano le habla: `jiku-commands` o `jiku-queries` | `NATS_COMMAND_SERVICE` / `NATS_QUERY_SERVICE` |
| `version` | Versión del protocolo: `v1` | `NATS_PROTOCOL_VERSION` |
| `método` | `clients.new`, `requirements.{id}.edit`, `tasks.list`, … | — |

**Los dos servicios van en el mismo proceso y con una sola conexión al bus**, pero con dos nombres
distintos en `{svc}` — nunca anidado uno bajo el otro: NATS compara los tokens **enteros**, así que
un permiso sobre uno no habilita el otro. Es lo que permite dar acceso de solo lectura sin enumerar
recurso por recurso.

Los helpers viven en `@jiku/nats-protocol` y **no se reimplementan**: `groupSubject()`,
`endpointSubject()`, `endpointName()`, `methodFromSubject()`, `callerFromSubject()`,
`inboxPrefix()`.

## Suscripción: un servicio micro con un grupo y un endpoint por patrón

No hay una suscripción wildcard única de comandos. `core/src/bus/service.ts` registra **un
servicio micro por plano**, sobre `nc.services.add()`:

```ts
// registerService(nc, spec) — un por plano, sobre la misma conexión
const service = await nc.services.add({
  name: spec.name,               // 'jiku-commands' o 'jiku-queries'
  queue: spec.name,               // el queue group vive ACÁ, no en subscribe()
  ...
});

const group = service.addGroup(groupSubject(spec.name));   // {instance}.*.{svc}.{version}

for (const pattern of spec.patterns) {
  group.addEndpoint(endpointName(pattern), {
    subject: endpointSubject(pattern),   // {param} -> '*'
    handler: (err, msg) => { /* … */ },
  });
}
```

- **El wildcard `*` en el user-id** (dentro de `groupSubject()`) cubre a cualquier caller. Sumar
  otro publicador es una decisión de política del bus, no un cambio de código acá.
- **El queue group va en la configuración del servicio** (`queue: spec.name`), no en un
  `subscribe()` a mano: micro lo hereda en cascada al grupo y a cada endpoint. Sin él, N réplicas
  ejecutarían N veces cada escritura.
- **Un endpoint por patrón**, no una suscripción wildcard que despacha internamente. Dos patrones
  que armen el mismo subject (`endpointSubject()`) chocan **al arrancar**: micro rechaza el
  duplicado.

## Autenticación

Dos capas, y la segunda es la que importa (`core/src/bus/host.ts:95-98`):

```ts
const authenticators = [
  ...(credsPath ? [credsAuthenticator(readFileSync(credsPath))] : []),
  ...(serviceUser ? [tokenAuthenticator(() => serviceUser.currentToken())] : []),
];
```

- **Las creds del sentinel no conceden permisos por sí solas.** Es el token de Zitadel el que
  dispara el auth-callout, que lee el rol y mintea los permisos de subject para esa conexión.
- El token se pide con la key JSON del service user y **se renueva solo**: caduca en ~1h, así que
  pasarlo por variable de entorno obligaría a reiniciar el servicio.
- `tokenAuthenticator` de nats.js espera una función **síncrona**, así que `currentToken()`
  devuelve el cacheado y la renovación corre aparte con `startAutoRefresh()`.

## El inbox va hasheado, el subject no

```ts
this.connection = await connect({
  servers,
  inboxPrefix: inboxPrefix(userId),   // _INBOX.<hash(user-id)>
  ...
});
```

Es el detalle que más fácil se rompe:

- El `user-id` va **crudo** en el subject de comandos y consultas, pero el inbox usa un **hash**:
  sha256 → base32 sin padding → los primeros 16 caracteres en minúscula
  (`packages/nats-protocol/src/index.ts:272-299`).
- Tiene que dar **exactamente lo mismo** que el auth-callout, que es quien mintea el permiso
  `_INBOX.<hash>.>`. La referencia es `cmd/session` en el repo del callout.
- **Hay que fijarlo al conectar.** Por defecto nats.js genera un `_INBOX.<aleatorio>` que ningún
  permiso acotado autoriza, y las respuestas de los servicios que core llame nunca llegarían.
- Va bajo el **user id propio**, no bajo el nombre del servicio: es por réplica, así que dos
  réplicas con distinto service user no se roban las respuestas.

## Procesamiento de mensajes

`core/src/bus/service.ts`, `handle()` — la última red antes de responder:

```ts
async function handle(spec: ServiceSpec, msg: ServiceMsg): Promise<void> {
  let payload: unknown;
  try {
    payload = msg.data.length ? msg.json() : {};
  } catch {
    respond(msg, failure(ErrorCode.INVALID_FIELDS, 'Malformed JSON payload'));
    return;
  }

  try {
    respond(msg, await spec.handle(msg.subject, payload));
  } catch (error: any) {
    logger.error(`[bus] ${msg.subject}: ${error.message}`);
    respond(msg, failure(ErrorCode.INTERNAL_ERROR, 'Internal error'));
  }
}
```

- **Un cuerpo vacío es `{}`**, no un error: los comandos de borrado no llevan payload.
- Un cuerpo que no es JSON no se puede procesar ni reintentar: se responde el error y se sigue.
- **Sin `await` en el handler del endpoint** (`service.ts`, el `void handle(spec, msg)` del
  registro): cada mensaje se procesa sin bloquear la llegada del siguiente. La concurrencia real la
  acota el pool de Sequelize, no este archivo.
- El `catch` de `handle()` es la **última red**: el despachador ya captura sus errores. Si llega
  acá, algo falló al fallar.
- **Todo mensaje se responde.** Siempre. Ver [`error-handling`](./error-handling.md).

## Apagado

`SIGTERM` y `SIGINT` llaman a `stop()` (`core/src/index.ts:106-107`). El **drain** deja que los
mensajes en vuelo terminen antes de cerrar: sin él, un deploy cortaría escrituras a medio camino, y
—al no haber JetStream en este plano— esas operaciones se perderían sin rastro.

## Lo que este patrón NO da, en el plano de comandos y consultas

Explícito porque condiciona el producto. **Vale para comandos y consultas**; el plano de
**eventos de dominio** tiene otras garantías —ver [`bus-publisher`](./bus-publisher.md):

- **Sin cola.** Si core está caído, la request del caller expira por timeout y la operación no
  ocurrió.
- **Sin reintento.** Ni del lado del bus ni del de quien publica.
- **Sin persistencia.** Un mensaje no entregado no queda en ningún lado.
- **Sin idempotencia.** No hay id de mensaje ni deduplicación. Si alguna vez se agrega reintento,
  hay que agregar idempotencia primero.

## Reglas

- Los helpers de subject se usan de `@jiku/nats-protocol`. No armes un subject a mano ni parsees
  con `split` fuera del paquete.
- El queue group va en la configuración del servicio micro (`queue: spec.name`), nunca en un
  `subscribe()` a mano.
- `inboxPrefix` siempre se fija al conectar, con el user id del service user.
- Todo mensaje recibido se responde: éxito, falla o error interno. Nunca se descarta en silencio.
- El handler de un endpoint no se `await`ea: un mensaje no bloquea la llegada del siguiente.
- `stop()` drena antes de cerrar. No agregues un `process.exit()` que se saltee el drain.
- **Core sí publica al bus**, en un plano distinto: eventos de dominio, fire-and-forget, con
  JetStream. Ver [`bus-publisher`](./bus-publisher.md) — no la documentación de esta convención.
- No agregues JetStream a un comando o a una consulta sueltos: el modo de entrega de **este plano**
  es del protocolo entero, y cambiarlo para uno solo deja dos semánticas conviviendo. **No aplica al
  plano de eventos**, que usa JetStream por diseño desde REQ-014
  ([ADR-014](../../../adrs/ADR-014-jetstream-para-eventos-de-dominio.md)).

## Integración con otras convenciones

- **[`bus-publisher`](./bus-publisher.md)**: la salida del servicio — eventos de dominio,
  post-commit, con JetStream.
- **[`commands`](./commands.md)**: el despachador traduce el mensaje a la ejecución de un comando.
- **[`error-handling`](./error-handling.md)**: el formato de `Reply` y el catálogo de códigos.
- **[`env-config`](./env-config.md)**: `NATS_*` y `ZITADEL_*`, y qué rompe si faltan.
