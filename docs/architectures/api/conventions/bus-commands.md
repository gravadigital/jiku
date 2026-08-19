---
id: bus-commands
display_name: Escritura por el bus (NATS request/reply)
language: node
description: Every mutation is published as a NATS command to core; the api then re-reads the database
applies_to: [api]
required_by: []
package: nats
---

# Escritura por el bus (api, NATS)

> **Convención nueva**, sin equivalente en el catálogo (que solo cubre colas con `queue`/BullMQ).
> Esta no es una cola: es request/reply sincrónico y es **la decisión estructural del servicio**.
> La api no puede escribir en la base; toda mutación se publica como comando a `core`.

## Cuándo aplica

Todo endpoint que modifique datos. Las excepciones son las migraciones (credenciales propias),
la fila de `attachments` (`Attachment.create()` directo), `PUT /api/week-assigned-times`
(escribe con el ORM en una transacción; nunca se convirtió en comando) y
`POST /api/auth/present` (hoy un no-op).

## Paquete

```
nats                   # 2.29, cliente del bus
@jiku/nats-protocol    # subjects, formato de Reply, hash del inbox — compartido con core
@jiku/zitadel-auth     # token del service user, con auto-refresh
```

## Por qué

La api conecta a PostgreSQL con un rol de solo lectura (`lib/models/index.ts:19-31`). La
separación lectura/escritura es una decisión de infraestructura, no de estilo: contra un rol
estrictamente `SELECT`, un `Model.update()` en un handler falla en runtime.

> Dos rutas todavía escriben con el ORM —la fila de `attachments` y
> `PUT /api/week-assigned-times`— y funcionan porque el rol de la instalación se lo permite. Son
> deuda conocida. Ver [`orm`](./orm.md).

## El flujo completo de una mutación

```
handler
  │  sendCommand(res, 'requirements.new', payload)
  ▼
bus().request(command, payload)                       lib/utils/bus/index.ts
  │  subject: {instance}.{user-id}.gestion.v1.requirements.new
  ▼
NATS  ──request/reply, timeout NATS_REQUEST_TIMEOUT_MS──▶  core  ──escribe──▶  PostgreSQL
  │
  ▼
Reply { status, errorCode?, errorMessage?, data? }
  │  success → devuelve data          failure → res.status(httpStatusFor(errorCode))
  ▼
handler relee la base con Sequelize y arma la respuesta completa
```

## Cómo se usa

### `sendCommand` — cuando la respuesta trae datos

Devuelve el `data` de la respuesta, o `null` si ya se respondió con un error. **Cuando devuelve
`null`, hay que cortar**: la respuesta HTTP ya salió.

```ts
// lib/routes/clients-post.ts:14-24
const data = await sendCommand<{ id: number }>(res, 'clients.new', {
  name: req.body.name,
  description: req.body.description,
});
if (!data) {
  return;
}

// Core solo devuelve el id: el contrato con la web es el recurso completo.
const client = await Client.findByPk(data.id);
return res.status(201).json(client);
```

### `runCommand` — cuando no trae datos

Devuelve `true` si salió bien. Existe porque un comando exitoso sin `data` haría que
`sendCommand` devuelva `null`, indistinguible de un error.

```ts
// lib/routes/clients-patch.ts:14-22
const ok = await runCommand(res, `clients.${req.params.id}.edit`, req.body);
if (!ok) {
  return;
}
return res.status(200).json({ code: 'client_updated', message: 'Client Updated' });
```

### El nombre del comando

Interpolado con el id del recurso, siguiendo la gramática del protocolo:

| Operación | Comando |
|---|---|
| Alta | `{recurso}.new` |
| Edición | `{recurso}.{id}.edit` |
| Borrado | `{recurso}.{id}.delete` |
| Sub-recurso | `{recurso}.{id}.{sub}.new` |
| Acción | `tasks.{id}.comment` |

Los 13 comandos que publica hoy la api están en el overview; el contrato completo de los 17 que
sirve core, en [`docs/apis/core.yaml`](../../../apis/core.yaml).

### El usuario que actúa

Core **no conoce roles ni usuarios finales**: confía en el `creator` / `author` / `editor` que
viaja en el cuerpo. Ese id lo pone la api desde el token.

```ts
const data = await sendCommand(res, 'requirements.new', {
  creator: req.user.id,      // o actor(req), el helper de send-command.ts
  ...
});
```

> El `user-id` del **subject** identifica al service user de la api, no a la persona. Por eso el
> usuario final tiene que ir en el cuerpo.

## Traducción de errores a HTTP

`httpStatusFor` mapea el `errorCode` de core al status que espera cada front
(`lib/utils/bus/protocol.ts:40-75`). **Es lo que sostiene el contrato con `web` y `opus-web`.**

| errorCode | Status |
|---|---|
| `invalid_fields`, `*_not_found` de validación de entrada, `daily_limit_exceeded`, `invalid_date_range`, `already_subscribed`, `invalid_state_transition`, `resolution_required` | 400 |
| `user_not_found`, `subscription_not_found` | 404 |
| `unknown_command`, `internal_error`, y cualquier código no mapeado | 500 |

`requirement_not_found` sale **400** y no 404, porque las rutas que lo reciben lo usan como
validación de entrada. La única que responde 404 (`PATCH /api/requirements/:reqid`, cuando no
existe el requisito del path) lo resuelve por su cuenta antes de publicar, con
`validateRequirement`.

> Al agregar un `errorCode` nuevo en core, **agregalo también a `STATUS_BY_ERROR_CODE`**. Sin
> entrada en el mapa sale 500, y el front lo trata como error de servidor en vez de mostrar el
> mensaje.

## Traductores de contrato

El bus renombró conceptos que ni la base ni los fronts cambiaron. Las traducciones viven en
`lib/utils/bus/`, no dispersas en los handlers:

| Contrato HTTP | Contrato del bus | Dónde |
|---|---|---|
| `priority` numérica 0-5 | enum `sin_prioridad`…`urgente` | `bus/priority.ts` |
| `keyValuePairs` (objeto plano) | `properties` (lista `{code, value}`) | `bus/properties.ts` |
| `objectives` | `tasks` | nombre del comando |
| `personIds` | `responsiblePersonIds` | `objectives-post.ts:33` |
| `objectiveId` | `taskId` | `worked-times-post.ts:124` |

El mapeo de `priority` **tiene que coincidir con `core/src/commands/tasks/priority.ts`**. Si
cambia uno, cambia el otro.

## Campos opcionales: el spread condicional

Un `undefined` explícito en el payload no es lo mismo que la ausencia del campo: el protocolo
usa semántica de edición parcial, y lo que no llega queda como estaba. El patrón en todo el
código:

```ts
...(description !== undefined ? { description } : {}),
```

> Excepción documentada: `projects.{id}.edit` manda `endDate: null` explícito cuando el cuerpo no
> lo trae, para preservar el comportamiento heredado de la api, que vaciaba el campo
> (`projects-patch.ts:16-34`).

## Bus caído

Sin JetStream **no hay reintento ni cola**. Un timeout o un bus inaccesible responde 503
`service_unavailable` y la operación no ocurrió.

```ts
// lib/utils/bus/send-command.ts:29-38
} catch (error: any) {
  logger.error(`[bus] ${command}: ${error.message}`);
  res.status(503).json({ code: 'service_unavailable', message: 'El servicio no está disponible en este momento' });
  return null;
}
```

Al arrancar, si el bus no está disponible la api **igual levanta**: las rutas de lectura
funcionan y las de escritura responden 503 hasta que se restablezca (`app.ts:52-59`).

> **Riesgo asumido:** si core escribe y la respuesta se pierde, el cliente ve un error de algo
> que sí ocurrió. Los comandos no son idempotentes, así que reintentar a ciegas puede duplicar.
> No agregues reintento automático sin resolver la idempotencia primero.

## Identidad en el bus

Dos detalles que rompen de forma silenciosa si se tocan:

1. **El `userId` sale de la key del service user**, no de una variable de entorno
   (`bus/index.ts:44-46`). Tiene que ser exactamente el `sub` que el auth-callout lee del token,
   o el permiso no cubre el subject. `NATS_USER_ID` es solo fallback para tests.
2. **`inboxPrefix` se fija explícitamente** (`bus/index.ts:67`). Los permisos que mintea el
   callout solo autorizan `_INBOX.<hash(user-id)>.>`; sin el prefijo, la librería genera un inbox
   aleatorio y **las respuestas nunca llegan**.

El token caduca en ~1h y se renueva solo (`serviceUser.startAutoRefresh`). No lo pases por
variable de entorno.

## Reglas

- Ninguna mutación nueva usa el modelo: publicá un comando. Las dos escrituras que quedan
  (`Attachment.create()` y `PUT /api/week-assigned-times`) son deuda, no precedente.
- Después de `sendCommand`, chequeá `if (!data) return;`. Después de `runCommand`,
  `if (!ok) return;`. Sin eso se responde dos veces.
- Usá `runCommand` cuando el comando no devuelve datos, y `sendCommand` cuando sí.
- El usuario que actúa va en el cuerpo (`creator` / `author` / `editor`), tomado de
  `req.user.id`. Nunca lo tomes del cuerpo de la request.
- Un `errorCode` nuevo en core se agrega a `STATUS_BY_ERROR_CODE`, o sale 500.
- Los campos opcionales van con spread condicional, no con `undefined` explícito.
- Las traducciones de nombres o formatos van en `lib/utils/bus/`, no en el handler.
- Si el comando necesita el rol, el usuario final o la fecha de hoy para validarse, esa
  validación se queda en la api: core no tiene esos datos.
- No agregues reintento automático: los comandos no son idempotentes.
- En los tests, usá el `FakeBus`. Ver [`testing`](./testing.md).

## Integración con otras convenciones

- **http-server**: el handler es quien publica; la cadena de middlewares valida antes.
- **orm**: la relectura post-comando usa el mismo Sequelize de solo lectura.
- **error-handling**: `httpStatusFor` y `errorBody` son el puente entre el error del bus y el
  cuerpo HTTP.
- **auth-jwt**: de ahí sale el `req.user.id` que viaja como actor, y el token del service user.
- **testing**: el `FakeBus` ejecuta los comandos contra core real.
