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
> `bus-commands` en `api`, que publica.

## Cuándo aplica

Toda la superficie de entrada del servicio. Core no tiene otra: no expone HTTP ni escucha ninguna
otra fuente de eventos.

## Paquete

```
nats                    # 2.29, cliente
@jiku/nats-protocol     # gramática de subjects, Reply, ErrorCode, hash del inbox
@jiku/zitadel-auth      # token del service user
```

## Gramática de subjects

```
{instance}.{user-id}.{svc}.{version}.{comando}
dev.323332022539911171.gestion.v1.clients.new
```

| Segmento | Qué es | Variable |
|---|---|---|
| `instance` | Despliegue: `dev` / `prod` | `NATS_INSTANCE` |
| `user-id` | **Quién publica**: el `sub` del token, crudo | — |
| `svc` | A quién le habla: `gestion` | `NATS_SERVICE_NAME` |
| `version` | Versión del protocolo: `v1` | `NATS_PROTOCOL_VERSION` |
| `comando` | `clients.new`, `requirements.{id}.edit`, … | — |

Los helpers viven en `@jiku/nats-protocol` y **no se reimplementan**: `subscriptionSubject()`,
`commandFromSubject()`, `callerFromSubject()`, `inboxPrefix()`.

## Suscripción

```ts
// core/src/bus/consumer.ts
const subject = subscriptionSubject();          // {instance}.*.{svc}.{version}.>
this.subscription = this.connection.subscribe(subject, { queue: SERVICE_NAME });
```

- El **wildcard `*` en el user-id** cubre a cualquier caller. Sumar otro publicador es una decisión
  de política del bus, no un cambio de código acá.
- El **queue group** hace que varias réplicas se repartan los mensajes en lugar de procesar cada
  una lo mismo. Sin él, N réplicas ejecutarían N veces cada escritura.

## Autenticación

Dos capas, y la segunda es la que importa:

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

## El inbox va hasheado

```ts
this.connection = await connect({
  servers,
  inboxPrefix: inboxPrefix(userId),   // _INBOX.<hash(user-id)>
  ...
});
```

Es el detalle que más fácil se rompe:

- El `user-id` va **crudo** en el subject de comandos, pero el inbox usa un **hash**: sha256 →
  base32 sin padding → los primeros 16 caracteres en minúscula
  (`packages/nats-protocol/src/index.ts:76-87`).
- Tiene que dar **exactamente lo mismo** que el auth-callout, que es quien mintea el permiso
  `_INBOX.<hash>.>`. La referencia es `cmd/session` en el repo del callout.
- **Hay que fijarlo al conectar.** Por defecto nats.js genera un `_INBOX.<aleatorio>` que ningún
  permiso acotado autoriza, y las respuestas de los servicios que core llame nunca llegarían.
- Va bajo el **user id propio**, no bajo el nombre del servicio: es por réplica, así que dos
  réplicas con distinto service user no se roban las respuestas.

## Procesamiento de mensajes

```ts
for await (const message of this.subscription!) {
  let payload: unknown;
  try {
    payload = message.data.length ? JSON.parse(new TextDecoder().decode(message.data)) : {};
  } catch {
    message.respond(encode(failure(ErrorCode.INVALID_FIELDS, 'Malformed JSON payload')));
    continue;
  }

  // Sin await: cada mensaje se procesa sin bloquear la llegada del siguiente.
  void this.dispatcher.dispatch(message.subject, payload)
    .then((reply) => message.respond(encode(reply)))
    .catch((error: Error) => {
      logger.error(`[bus] ${message.subject}: ${error.message}`);
      message.respond(encode(failure(ErrorCode.INTERNAL_ERROR, 'Internal error')));
    });
}
```

- **Un cuerpo vacío es `{}`**, no un error: los comandos de borrado no llevan payload.
- Un cuerpo que no es JSON no se puede procesar ni reintentar: se responde el error y se sigue.
- **El `dispatch` no se espera dentro del `for await`.** La concurrencia real la acota el pool de
  Sequelize, no el consumer.
- El `.catch()` es la **última red**: el despachador ya captura sus errores. Si llega acá, algo
  falló al fallar.
- **Todo mensaje se responde.** Siempre. Ver [`error-handling`](./error-handling.md).

## Apagado

```ts
async stop(): Promise<void> {
  this.stopTokenRefresh?.();
  if (this.subscription) await this.subscription.drain();
  if (this.connection) { await this.connection.drain(); await this.connection.close(); }
}
```

`SIGTERM` y `SIGINT` llaman a `stop()` (`src/index.ts:27-28`). El **drain** deja que los mensajes
en vuelo terminen antes de cerrar: sin él, un deploy cortaría escrituras a medio camino y —al no
haber JetStream— esas operaciones se perderían sin rastro.

## Lo que este patrón NO da

Explícito porque condiciona el producto:

- **Sin cola.** Si core está caído, la request de la api expira por timeout y la operación no
  ocurrió.
- **Sin reintento.** Ni del lado del bus ni del de la api.
- **Sin persistencia.** Un mensaje no entregado no queda en ningún lado.
- **Sin idempotencia.** No hay id de mensaje ni deduplicación. Si alguna vez se agrega reintento,
  hay que agregar idempotencia primero.

## Reglas

- Los helpers de subject se usan de `@jiku/nats-protocol`. No armes un subject a mano ni parsees
  con `split` fuera del paquete.
- La suscripción siempre lleva `queue: SERVICE_NAME`. Sin queue group, N réplicas escriben N veces.
- `inboxPrefix` siempre se fija al conectar, con el user id del service user.
- Todo mensaje recibido se responde: éxito, falla o error interno. Nunca se descarta en silencio.
- El `dispatch` no se `await`ea dentro del loop de consumo.
- `stop()` drena antes de cerrar. No agregues un `process.exit()` que se saltee el drain.
- Core **no publica** en el bus. Si algún día lo hace, el inbox por réplica ya está resuelto, pero
  la política del callout tiene que autorizarlo.
- No agregues JetStream a un comando suelto: el modo de entrega es del protocolo entero, y
  cambiarlo para uno solo deja dos semánticas conviviendo.

## Integración con otras convenciones

- **[`commands`](./commands.md)**: el despachador traduce el mensaje a la ejecución de un comando.
- **[`error-handling`](./error-handling.md)**: el formato de `Reply` y el catálogo de códigos.
- **[`env-config`](./env-config.md)**: `NATS_*` y `ZITADEL_*`, y qué rompe si faltan.
