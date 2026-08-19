---
id: error-handling
display_name: Manejo de errores (Reply de falla, nunca excepciones)
language: node
description: Errors are failure Replies with a protocol code; the dispatcher never throws and the status decides the transaction
applies_to: [worker]
required_by: []
package: "@jiku/nats-protocol"
---

# Manejo de errores (core)

> **Reemplaza** la convención `error-handling` del catálogo, que modela errores como clases que se
> lanzan y se traducen en un handler HTTP. Acá **no se lanza nada**: un error es un valor de retorno,
> y su `status` decide si la transacción se confirma o se descarta.

## Cuándo aplica

Todo el servicio.

## El formato

```ts
// packages/nats-protocol/src/index.ts
export interface Reply<T = unknown> {
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
  data?: T;
}

export function success<T>(data?: T): Reply<T>;
export function failure(errorCode: string, errorMessage: string): Reply<never>;
```

```json
{ "status": "success", "data": { "id": 7 } }
{ "status": "failure", "errorCode": "project_not_found", "errorMessage": "Project not found" }
```

Igual para los 17 comandos. **Se construye siempre con los helpers**, nunca a mano.

## El `status` decide la transacción

```ts
if (reply.status === 'success') await transaction.commit();
else await transaction.rollback();
```

No es solo un dato para el cliente: **devolver `failure` descarta todo lo que el comando escribió**.
Por eso una validación tardía es segura, y por eso un comando **no puede** responder `failure`
esperando conservar parte del trabajo.

## El despachador nunca lanza

```ts
// core/src/bus/dispatcher.ts
} catch (error: any) {
  await transaction.rollback();
  logger.error(`[dispatch] ${name}: ${error.message}`);
  return failure(ErrorCode.INTERNAL_ERROR, 'Internal error');
}
```

Del otro lado hay una request esperando. Quedarse sin contestar dejaría a la api colgada hasta su
timeout (`NATS_REQUEST_TIMEOUT_MS`, 5000ms) y el usuario vería un 503 genérico en vez del error real.

**El detalle del error va al log, no al mensaje.** Un error inesperado responde `Internal error` a
secas: el stack no cruza el bus.

Hay una última red en el consumer (`consumer.ts:101-105`) por si el despachador fallara al fallar.

## Los tres errores que no vienen de un comando

| Situación | Código | Dónde |
|---|---|---|
| Cuerpo que no es JSON | `invalid_fields` — "Malformed JSON payload" | `consumer.ts:93` |
| Comando no registrado | `unknown_command` | `dispatcher.ts:26` |
| Excepción no capturada | `internal_error` — "Internal error" | `dispatcher.ts:63` |

## El catálogo de códigos

Definido en `@jiku/nats-protocol`. **Se usa la constante, no el literal**:

```ts
return failure(ErrorCode.PROJECT_NOT_FOUND, 'Project not found');
```

| Código | Cuándo |
|---|---|
| `invalid_fields` | Falla la validación Joi, o el cuerpo no es JSON |
| `internal_error` | Excepción no capturada |
| `unknown_command` | El registry no resuelve el nombre |
| `client_not_found` · `project_not_found` · `objective_not_found` · `requirement_not_found` · `user_not_found` · `person_not_found` | La entidad no existe |
| `invalid_responsible_person` | Un responsable de requirement no existe (tasks usa `person_not_found`) |
| `invalid_attachment_id` | El adjunto no es un draft propio, vivo y anclado a la entidad |
| `requirement_project_mismatch` | El requisito no pertenece al proyecto indicado |
| `daily_limit_exceeded` | Se superarían los 1440 min del día |
| `already_subscribed` · `subscription_not_found` | Suscripciones |
| `resolution_required` | Una incidencia sin conclusión |
| `worked_time_not_found` · `unworked_time_not_found` | El registro a borrar no existe |

### Deuda conocida del catálogo

- **Tres códigos se emiten como literal** en vez de la constante: `resolution_required`
  (`requirements-resolve.ts:49`), `worked_time_not_found` (`worked-times.ts:125`) y
  `unworked_time_not_found` (`unworked-times.ts:95`). El valor es correcto pero está duplicado a
  mano. Al tocar esos archivos, pasalos a la constante.
- **Cuatro códigos declarados que ningún comando emite**: `invalid_date_range`,
  `invalid_state_transition`, `stage_not_found` y `unknown_command` (que sí se emite, pero **la api
  no lo mapea a HTTP** y cae en un 500 genérico).
- **El catálogo no está cerrado**, y así lo declara el contrato. Un código nuevo va en el paquete,
  en `docs/apis/core.yaml` y en el mapa a HTTP de la api: **los tres**, o el usuario ve un 500.

## Los mensajes llegan al usuario final

El `errorMessage` cruza la api y algunos frontends lo muestran directamente. Dos consecuencias:

1. **Está mezclado entre inglés y español**, a veces en el mismo archivo:
   `worked-times.ts:44` responde `'Person not found'` y `:49` responde `'Proyecto no encontrado'`.
   Es inconsistencia heredada. Para un mensaje nuevo, **español** — es lo que ve el usuario.
2. **No pongas datos internos en el mensaje**: ids de otras entidades, nombres de columna, detalle
   de excepción.

### El mensaje como canal de datos: `daily_limit_exceeded`

```ts
return failure(
  ErrorCode.DAILY_LIMIT_EXCEEDED,
  `Se superaría el máximo de 24 horas (1440 minutos). Minutos disponibles: ${remainingMinutes}`
);
```

La api recupera `remainingMinutes` **parseando este texto con un regex**. Es deuda documentada:
cambiar la redacción de este mensaje rompe la api. Si hace falta devolver datos con un error, la
solución es extender `Reply`, no otro mensaje parseable.

## Dónde va cada tipo de error

| Tipo | Dónde se detecta | Qué devuelve |
|---|---|---|
| Forma del payload | esquema Joi | `invalid_fields` |
| Relación entre campos del payload | esquema Joi (`oxor`) | `invalid_fields` |
| La entidad no existe | `execute`, con `findByPk` | `*_not_found` |
| Regla de negocio | `execute` | el código específico |
| Inesperado | ningún lado: lo captura el despachador | `internal_error` |

## Reglas

- Un comando **nunca lanza** para señalar un error esperado: devuelve `failure(...)`.
- `success()` y `failure()` se construyen con los helpers de `@jiku/nats-protocol`, nunca a mano.
- Se usa la **constante** `ErrorCode.X`, no el literal.
- Un código nuevo se agrega en tres lugares: el paquete, `docs/apis/core.yaml`, y el mapa a HTTP de
  la api.
- El detalle de un error inesperado va al log; el mensaje que cruza el bus es genérico.
- Los mensajes nuevos van en **español** y no llevan datos internos.
- No uses el mensaje como canal de datos estructurados. Si hace falta, se extiende `Reply`.
- Todo mensaje del bus se responde. Nunca se descarta en silencio.
- Devolver `failure` descarta toda la escritura del comando: no esperes conservar parte del trabajo.

## Integración con otras convenciones

- **[`commands`](./commands.md)**: el `status` decide el commit; el orden de validaciones dentro de
  `execute`.
- **[`bus-consumer`](./bus-consumer.md)**: los errores previos al despachador y la última red.
- **[`validation`](./validation.md)**: un fallo de esquema es siempre `invalid_fields`.
- **[`logging`](./logging.md)**: qué se loguea de un error y con qué prefijo.
