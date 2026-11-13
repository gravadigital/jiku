---
id: scheduled-worker
display_name: Plano de ejecución periódico (setTimeout encadenado, SKIP LOCKED)
language: node
description: Time-driven dispatch loop with chained setTimeout, uncached settings re-read per cycle, and FOR UPDATE SKIP LOCKED batch claiming for multi-replica safety
applies_to: [worker]
required_by: []
package: nodemailer
---

# Plano de ejecución periódico (core)

> **Convención nueva**, sin equivalente en el catálogo. **No reemplaza** a
> [`bus-consumer`](./bus-consumer.md) ni a [`bus-publisher`](./bus-publisher.md): `bus-consumer`
> documenta la **entrada** del servicio (comandos y consultas, request/reply, disparados por un
> mensaje) y `bus-publisher` documenta la **salida** por el bus (eventos de dominio,
> fire-and-forget, disparados por un commit). Este plano no arranca en ninguno de los dos: arranca
> en un **temporizador**, y su efecto sale **fuera del producto**, hacia un servidor SMTP de
> terceros. Existe desde REQ-015 / S-073.

## Cuándo aplica

El proceso de envío de notificaciones (`core/src/notifications/dispatch/`), y cualquier plano
futuro de `core` que necesite correr por tiempo en vez de por mensaje.

## Paquete

```
nodemailer         # el cliente SMTP que este plano usa para enviar
```

**Es la primera dependencia de red saliente del servicio.** NATS, PostgreSQL y Zitadel son
infraestructura del propio producto; un servidor SMTP es un tercero fuera del control de Jiku.

## Estructura

```
core/src/notifications/dispatch/
├── index.ts          # superficie pública: startDispatchLoop, stopDispatchLoop, runDispatchCycle
├── scheduler.ts       # el setTimeout ENCADENADO: tick(), relectura del intervalo, parada que espera
├── run-cycle.ts        # el ciclo: toma el lote -> render -> SMTP -> markSent / backoff / descarte
├── claim-batch.ts       # FOR UPDATE SKIP LOCKED, transacción propia del módulo
├── settings.ts            # los 3 parámetros de system_settings, leídos SIN caché en cada ciclo
├── transport.ts             # nodemailer perezoso, interfaz Mailer inyectable en tests
└── backoff.ts                 # backoff exponencial: base 60s, tope 1 día
```

## Cómo se usa

`src/index.ts` (Task 7) es el único consumidor de la superficie pública: llama a
`startDispatchLoop()` después de `host.start()` y a `stopDispatchLoop()` antes de `host.stop()`.
Ningún otro módulo del servicio importa nada de `dispatch/` directamente — el resto del proceso de
notificaciones (`registry.ts`, `recipients.ts`, `payload.ts`, `write-notifications.ts`,
`templates/`) es del plano de **encolado**, dentro del despachador de comandos, y no de este.

## `setTimeout` encadenado: por qué nunca `setInterval`

`core/src/notifications/dispatch/scheduler.ts`. La razón, verbatim del código:

> Si una corrida tarda más que el intervalo configurado, `setInterval` dispararía la siguiente
> ANTES de que la primera termine, en la MISMA réplica. Ahí `FOR UPDATE SKIP LOCKED` no ayuda: las
> dos corridas usarían conexiones DISTINTAS del mismo pool de Sequelize, así que cada una tomaría
> un lote propio y sin ningún problema de bloqueo entre sí — la garantía de "nunca dos corridas
> solapadas en la misma réplica" se perdería sin ningún síntoma visible hasta que dos corridas
> concurrentes empiecen a competir por conexiones del pool de 5.

`setTimeout` encadenado evita el problema de raíz: el siguiente ciclo se programa **recién cuando
el anterior terminó**, nunca antes.

**Estado del módulo:** tres variables de módulo — `timer`, `runningCycle`, `stopping`.

**Mecanismo de `tick()`:**

1. Corre `runDispatchCycle()` envuelto en un `.catch()` que loguea — una **segunda red**: un
   rechazo que escapara mataría el proceso, porque el logger corre con `exitOnError: true` en
   `NODE_ENV=production`.
2. Guarda la promesa en `runningCycle`, la espera, la limpia.
3. Si `stopping` → **no reprograma**.
4. Lee el intervalo vigente con `readIntervalSeconds()` — transacción propia y liviana. Si falla,
   loguea y cae a **5 segundos fijos**: la razón es no dejar de reprogramar, porque eso pararía el
   proceso de envío en silencio.
5. `setTimeout(() => void tick(), intervalSeconds * 1000)`.

`stopDispatchLoop()` pone `stopping = true`, hace `clearTimeout(timer)` y **espera
`runningCycle`** si hay una corrida en vuelo — ver "El arranque y la parada" más abajo.

## Relectura de `system_settings` sin caché entre ciclos

`core/src/notifications/dispatch/settings.ts`. Las tres claves, contrato con el operador que las
ajusta por SQL:

```ts
export const NOTIFICATION_SETTING_KEYS = {
  intervalSeconds: 'notification-dispatch-interval-seconds',
  batchSize: 'notification-batch-size',
  maxAttempts: 'notification-max-attempts',
} as const;

export const DEFAULT_INTERVAL_SECONDS = 60;
export const DEFAULT_BATCH_SIZE = 50;
export const DEFAULT_MAX_ATTEMPTS = 5;
```

- **Sin caché de ningún tipo, a propósito:** un cambio por SQL aplica en la corrida siguiente, sin
  redeploy. Cachear con TTL rompería exactamente eso. Precedente: `commands/files/settings.ts`
  (S-018).
- **Una sola consulta** para las tres claves (`Op.in` sobre `key`), que va por el índice UNIQUE.
- **Un valor no parseable cae al default** (`Number.isFinite`, nunca `Number(x) || default`, que
  dejaría pasar un `NaN` silencioso a comparaciones de tamaño de lote o de intentos).
- **Un valor parseable pero absurdo (`0` o negativo) también cae al default:** un intervalo de `0`
  sería un busy loop, un `maxAttempts` de `0` descartaría cada fila en su primer intento.
- **Los defaults viven en el código, no solo en el seed:** el sistema tiene que funcionar con
  `system_settings` vacía. La migración de S-069 siembra las tres con estos mismos valores **por
  conveniencia**; las constantes de este archivo son la garantía real.
- **Estas claves NO se agregan a `src/queries/settings/settings-spec.ts`:** esa lista blanca es
  deny-by-default a propósito — exponerlas por el plano de consultas es una decisión aparte que
  esta story no toma.
- `readNotificationSettings(transaction)` **no asume de quién es la transacción que recibe**:
  `run-cycle.ts` la invoca **dos veces con transacciones distintas** — una para `intervalSeconds`
  en el scheduler, otra para `batchSize`/`maxAttempts` antes del lote. **Nunca** se ejecuta dentro
  de la transacción larga del lote de `claim-batch.ts`; mantenerla corta es intencional.

## `FOR UPDATE SKIP LOCKED`: el patrón para un plano que corre por tiempo con múltiples réplicas

`core/src/notifications/dispatch/claim-batch.ts`. La consulta, verbatim:

```sql
SELECT id, type, recipient_user_id, recipient_email, payload, attempts
  FROM notification_outbox
 WHERE status = 'pending'
   AND next_attempt_at <= NOW()
 ORDER BY next_attempt_at, id
 LIMIT :batchSize
   FOR UPDATE SKIP LOCKED
```

Cuatro razones, todas necesarias:

1. **La transacción es de este módulo, no del despachador — ampliación consciente de
   [ADR-003](../../../adrs/ADR-003-transaccion-del-despachador.md).** El proceso corre por
   **tiempo**, no por mensaje: no hay ningún comando en curso cuya transacción reusar, así que
   este módulo es **la única pieza de `core`, fuera del despachador, que abre y cierra su propia
   transacción**.
2. **`SKIP LOCKED` es requisito, no detalle:** el queue group `gestion` **no reparte** un proceso
   que corre por tiempo — las dos réplicas disparan su propio timer, al mismo tiempo, sin
   coordinación entre ellas. Sin `SKIP LOCKED`, las dos leerían y tomarían las **mismas** filas y
   cada mail saldría dos veces. Con él, la segunda transacción **saltea** las filas que la primera
   ya bloqueó y toma las siguientes disponibles.
3. **Es la transacción más larga del servicio:** queda abierta durante **todos** los envíos SMTP
   del lote, que son secuenciales. Ocupa 1 de las 5 conexiones del pool de Sequelize, compitiendo
   con el pool de comandos — es la razón real por la que `batchSize` es configurable: un lote más
   chico acorta cuánto tiempo se retiene esa conexión.
4. **`readDb` no sirve para esto:** es solo lectura (hacen falta `UPDATE`/`DELETE` después) y tiene
   `statement_timeout: 8000`, que cortaría la transacción del lote antes de terminar de enviar. El
   raw query va sobre `sequelize`, la conexión del usuario dueño.

Los valores van por `replacements`, **nunca interpolados**.

## El patrón de log del descarte, sin payload

`core/src/notifications/dispatch/run-cycle.ts`. El formato es **literal y no se cambia** (misma
razón que `bus-publisher`: un `grep` en producción tiene que encontrar siempre el mismo patrón):

```
[notifications] discard id=<id> type=<type> entity=<type>:<id> recipient=<userId> reason=<causa>
```

`entityType`/`entityId` caen a `'desconocido'` si el payload no los trae. **El payload NO se
loguea.** El descarte es un **`DELETE`**, no un `status = 'failed'`: la columna solo admite
`'pending'`/`'sent'`, así que **el único rastro que queda del descarte es este log**.

Los ocho logs del módulo, catálogo completo:

| Evento | Log | Nivel |
|---|---|---|
| Arranque | `[notifications] proceso de envío arrancado` | info |
| Parada | `[notifications] proceso de envío detenido` | info |
| Descarte | `[notifications] discard id=… type=… entity=…:… recipient=… reason=…` | error |
| Ciclo no manejado (segunda red) | `[notifications] ciclo no manejado: {msg}` | error |
| Intervalo ilegible | `[notifications] no se pudo leer el intervalo, se reintenta: {msg}` | error |
| Config del ciclo ilegible | `[notifications] no se pudo leer la configuración del ciclo: {msg}` | error |
| Lote no tomado | `[notifications] no se pudo tomar el lote: {msg}` | error |
| Ciclo fallado | `[notifications] el ciclo falló: {msg}` | error |

## La garantía de no-rechazo, y por qué es local en cada archivo

`runDispatchCycle()` **nunca rechaza ni lanza**. En producción, un `unhandledRejection` del timer
que la invoca **mata el proceso** (`exitOnError: true`), así que todo fallo del ciclo se resuelve
en un `catch` local, nunca escapa. La garantía se repite en `scheduler.ts` (`tick()` envuelve la
llamada igual, como **segunda red**) por el mismo criterio que ya fija `bus-publisher`: tiene que
ser local y visible en cada archivo, no una propiedad que alguien pueda romper editando otro.

**Envíos secuenciales, nunca en paralelo** (`for...of` + `await`, deliberadamente sin
`Promise.all`/`allSettled` — la diferencia consciente con `bus-publisher`, que sí usa
`allSettled`): 50 conexiones SMTP en paralelo es la forma más rápida de que un proveedor aplique
rate limit. Un lote de 50 con ~500ms de latencia por envío tarda ~25s en serie, que entra cómodo
en el ciclo por defecto de 60s.

## El arranque y la parada

```ts
// core/src/index.ts
await host.start();
startDispatchLoop();          // DESPUÉS de host.start()

async function shutdown(signal: string): Promise<void> {
  await stopDispatchLoop();    // ANTES de host.stop(), esperando la corrida en curso
  await host.stop();
  process.exit(0);
}
```

**Arranque después de `host.start()`:** es el primer plano de `core` que corre **por tiempo y no
por mensaje**, y no depende de que el bus esté arriba —solo de la base—, pero mantener el orden
documentado (comandos, consultas, notificaciones) es lo que hace obvio en el log qué arrancó y en
qué secuencia.

**`shutdown` es `async` y espera la corrida en curso:** un `SIGTERM` a mitad de lote no corta el
envío en seco — los mails en curso completan, y por at-least-once los que no llegaron a marcarse
se reenvían en la réplica siguiente, sin deduplicación. **Con un lote grande esto puede alargar la
parada del contenedor** hasta lo que tarde ese lote: es la razón práctica, además del pool, por la
que `batchSize` es configurable.

**Se conserva el `catch { process.exit(1) }`:** un fallo al cerrar sigue terminando el proceso,
nunca lo deja colgado.

## El backoff

`core/src/notifications/dispatch/backoff.ts`: `BASE_SECONDS = 60`, `MAX_SECONDS = 24*60*60` (1
día). `nextAttemptAt(attempts, now)` → `min(60 * 2^attempts, 86400)` segundos desde `now`. Con
`attempts = 0` (primer fallo) da 60s; después 120s, 240s… **El tope existe** porque sin él un
`attempts` alto (si `notification-max-attempts` se sube por SQL después de que una fila ya
acumuló intentos) haría desbordar `2^attempts` a un valor absurdamente grande.

## El transporte SMTP, perezoso

`core/src/notifications/dispatch/transport.ts`. `getTransport()` construye el `nodemailer` **la
primera vez que se necesita** y lo reusa. Mismo criterio que `STORAGE_S3_*` en
`commands/files/storage.ts`:

- Las `SMTP_*` **no llevan assert de arranque** porque su modo de fallo es **ruidoso y
  recuperable** (la fila queda `pending` con `last_error`), no silencioso ni destructivo.
- Construirlo al importar el módulo **rompería la suite de tests**, que no tiene SMTP real.
- La interfaz `Mailer` (`sendMail` y nada más) y `setTransport()` son el **mismo patrón** que
  `StorageSigner`/`setStorageSigner()`: inyectable desde los tests con
  `tests/helpers/smtp-double.ts`, molde de `s3-double.ts`.
- El default del puerto vive **donde se lee la variable**: `Number(process.env.SMTP_PORT) || 587`
  — no se duplica en `.env.dist` (regla de [`env-config`](./env-config.md)).

## La discrepancia con ADR-003, registrada y no resuelta acá

> **[ADR-003](../../../adrs/ADR-003-transaccion-del-despachador.md) dice post-commit para
> efectos externos; las notificaciones son pre-commit porque no son externas.**
>
> La última Implementation Rule de ADR-003 dice que un efecto externo declarado **DEBE**
> ejecutarse **después** del `commit()` y **NO DEBE** propagar su error. `writeNotifications`
> (`core/src/notifications/write-notifications.ts`) hace **exactamente lo contrario, a
> propósito**: corre **antes** del commit, dentro del mismo `try` que envuelve `command.execute()`,
> y **sí** propaga — un fallo de encolado produce el `rollback()` del comando entero, tratado
> igual que cualquier otro fallo de escritura.
>
> La razón, verbatim de `dispatcher.ts`: un evento de dominio va a JetStream, un bus **externo**
> que no participa de la transacción — de ahí post-commit y pérdida asumida (ADR-014). La fila de
> `notification_outbox`, en cambio, es **una escritura más sobre la misma base**: no hay ninguna
> razón para sacarla de la transacción, y sacarla renunciaría a la única garantía que REQ-015
> persigue — *"si el comando commiteó, el mail existe; si el comando falló, rollback y no queda
> mail fantasma"*.
>
> Esta convención **no edita ADR-003** — ampliarlo es alcance de
> `/product-change-technical-definition`, no de documentación. Se deja la discrepancia registrada
> acá y en el paso 5 de [`escritura-por-el-bus.md`](../../../flows/escritura-por-el-bus.md), como
> candidata a una futura ampliación del ADR.

Ver también [ADR-014](../../../adrs/ADR-014-jetstream-para-eventos-de-dominio.md) por contraste:
los eventos de dominio son **fire-and-forget, best-effort, sin outbox** (si la publicación falla,
se pierde y se loguea); las notificaciones son lo opuesto — **outbox persistente, at-least-once,
con reintentos y backoff**. Son dos decisiones distintas para dos efectos que se parecen en la
forma pero no en la garantía.

## Lo que este plano NO tiene

No hay retry con jitter, no hay dead-letter queue, no hay métricas, no hay circuit breaker. El
descarte va a un log y nada más — esa pobreza es un hecho del código, no una omisión de esta
documentación.

## Reglas

- Un plano periódico usa `setTimeout` **encadenado**. `setInterval` está prohibido: permite
  corridas solapadas en la misma réplica sin ningún síntoma visible.
- Relee su configuración de `system_settings` **en cada ciclo, sin caché**. Un valor no parseable o
  absurdo (`0`, negativo) cae al default del código, nunca propaga.
- Toma su trabajo con `FOR UPDATE SKIP LOCKED`, en una transacción propia del módulo, cuando el
  queue group del bus no reparte el disparo entre réplicas.
- Nunca deja escapar un rechazo del ciclo: un fallo se resuelve en un `catch` local, con una
  segunda red en el scheduler.
- Los envíos hacia un proveedor externo van **secuenciales**, nunca en paralelo con
  `Promise.all`/`allSettled`.
- Su parada **espera la corrida en curso** antes de resolver.
- No loguea payloads, nunca. El log del descarte lleva únicamente los identificadores acordados.

## Integración con otras convenciones

- **[`orm`](./orm.md)**: la transacción propia de `claim-batch.ts` como ampliación consciente de
  ADR-003; el uso del usuario dueño (`sequelize`), nunca `readDb`.
- **[`logging`](./logging.md)**: `exitOnError: true` como la razón de que ningún rechazo pueda
  escapar; el formato literal del descarte para que un `grep` en producción lo encuentre siempre.
- **[`env-config`](./env-config.md)**: `SMTP_*` sin assert de arranque, lectura perezosa al primer
  ciclo con filas para enviar.
- **[`bus-publisher`](./bus-publisher.md)**: el contraste deliberado — post-commit / best-effort /
  sin outbox (eventos) vs. pre-commit / at-least-once / con outbox y backoff (notificaciones); y
  la garantía de no-rechazo, que las dos convenciones exigen local a cada archivo.
- **[`commands`](./commands.md)**: un comando **declara** en `Reply.notifications`, nunca escribe
  en `notification_outbox` por su cuenta — el otro extremo del recorrido, donde nace la fila que
  este plano consume.
</content>
