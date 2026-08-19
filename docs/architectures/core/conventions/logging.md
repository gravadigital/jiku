---
id: logging
display_name: Logging (Winston, con traza opcional de comandos)
language: node
description: Winston with per-environment transports, origin prefixes, and an opt-in command trace
applies_to: [worker]
required_by: []
package: winston
---

# Logging (core, Winston)

> **Reemplaza** la convención `logging` del catálogo, que usa Pino con JSON estructurado y loggers
> hijos por request. Este servicio usa Winston con un logger único y mensajes de texto plano con
> prefijo de origen.

## Cuándo aplica

Todo el servicio.

## Paquete

```
winston            # 3.19
```

## Configuración

Dos configuraciones según el entorno (`core/src/logger.ts`):

| Entorno | Transports | Nivel |
|---|---|---|
| `production` | Consola + 2 archivos (info y error) | `info` en consola |
| resto | Solo consola | `debug` |

```ts
const myFormat = format.printf(({level, message, timestamp}) => {
  let toLog = message;
  if (message && message.constructor === Object) {
    toLog = JSON.stringify(message, null, 4);
  }
  return `${timestamp} ${level}: ${toLog}`;
});
```

**Un objeto se serializa como JSON indentado**; el resto va como texto. No es logging estructurado:
la salida es legible por humanos, no por un agregador.

En producción `handleExceptions: true` y `exitOnError: true` en el transport de consola: una
excepción no capturada se loguea y el proceso termina, para que el orquestador lo reinicie.

## Prefijos de origen

Todo mensaje empieza con el prefijo del componente. Es lo que hace grepeable un log de texto plano:

| Prefijo | Componente |
|---|---|
| `[core]` | Arranque y señales (`src/index.ts`) |
| `[bus]` | Conexión, suscripción, estado del bus (`consumer.ts`) |
| `[dispatch]` | Resolución de comando y errores del despachador |
| `[cmd]` | La traza de comandos con `LOG_COMMANDS` |
| `[DB]` | Conexión y sync de Sequelize |

## Niveles

| Nivel | Cuándo | Ejemplo |
|---|---|---|
| `error` | Algo falló y hay que mirarlo | `[dispatch] tasks.new: ...` |
| `warn` | Entrada inválida que el servicio maneja bien | comando desconocido, payload no-JSON |
| `info` | Hitos del ciclo de vida | arranque, conexión al bus, cambios de estado |
| `debug` | Diagnóstico de desarrollo | intentos de conexión a la base |

**Un comando que responde `failure` no es un `error`.** Una entidad que no existe es una respuesta
normal del protocolo; loguearla llenaría el log de ruido. Solo lo inesperado va a `error`.

## La traza de comandos

```ts
// core/src/bus/dispatcher.ts
if (process.env.LOG_COMMANDS === 'true') {
  logger.info(`[cmd] ${name} <- ${JSON.stringify(raw)}`);
}
// ...
if (process.env.LOG_COMMANDS === 'true') {
  logger.info(`[cmd] ${name} -> ${JSON.stringify(reply)}`);
}
```

Imprime cada comando con su payload y su respuesta. **Apagada por defecto a propósito: el payload
lleva datos de negocio** (títulos, descripciones, comentarios, ids de usuario).

Es la herramienta de diagnóstico del servicio, y por eso el SQL de Sequelize está apagado: el
comando dice más que la query.

**No la enciendas de forma permanente en producción.**

## Qué no se loguea

- **El payload de un comando fuera de `LOG_COMMANDS`.** Ni siquiera parcialmente.
- **El token del service user**, ni la key de Zitadel, ni las creds del bus.
- **Las URLs prefirmadas de storage** (`uploadUrl`, `downloadUrl`). Llevan la firma: dan acceso al
  contenido del objeto sin ninguna credencial durante todo su TTL. **Ni siquiera bajo
  `LOG_COMMANDS`** — el despachador las reemplaza por `[redacted]` antes de serializar el reply
  (`src/bus/dispatcher.ts`, `REDACTED_REPLY_KEYS`). Un campo nuevo que transporte una firma o un
  token se agrega a esa lista en el mismo cambio que lo introduce.
- **El SQL.** `logging: false` en la conexión.
- **El stack de un error esperado.** Solo los inesperados llevan stack (`src/index.ts:32`).
- Comentarios, descripciones y títulos de entidades fuera de la traza opt-in.

## Estado de la conexión al bus

```ts
for await (const status of this.connection!.status()) {
  logger.info(`[bus] ${status.type}: ${JSON.stringify(status.data ?? '')}`);
}
```

Reconexiones y desconexiones quedan registradas. En un servicio sin JetStream es la única evidencia
de una ventana en la que se pudieron perder comandos: **si hay que investigar un dato faltante, se
empieza acá.**

## Deuda conocida

Los transports de archivo de producción se configuran con variables que **el compose no define**:

```ts
new (transports.File)({
  filename: process.env.LOGGER_INFO_PATH,      // undefined en producción
  level:    process.env.LOGGER_INFO_LEVEL,
  maxsize:  Number(process.env.LOGGER_FILE_MAX_SIZE),   // NaN
  maxFiles: Number(process.env.LOGGER_MAX_FILES),       // NaN
})
```

`deploy/docker-compose.yml:128-142` no pasa ninguna `LOGGER_*` a core. El transport de consola sí
funciona, que es de donde salen los logs en Docker. Al tocar el logger, o se definen las variables o
se sacan los transports de archivo — hoy son configuración muerta que aparenta funcionar.

## Reglas

- Un solo logger, importado de `../logger`. No crees instancias nuevas.
- **Nunca `console.log`.**
- Todo mensaje empieza con el prefijo del componente entre corchetes.
- Un `failure` esperado no se loguea como `error`.
- El payload de un comando solo se loguea bajo `LOG_COMMANDS`, y esa variable queda apagada en
  producción.
- Nunca loguees tokens, keys ni credenciales — **incluidas las URLs prefirmadas**, que el
  despachador redacta incluso con `LOG_COMMANDS` encendido.
- El detalle de un error inesperado va al log; el mensaje que cruza el bus es genérico.
- Los mensajes son cortos y descriptivos, con el dato variable al final.

## Integración con otras convenciones

- **[`error-handling`](./error-handling.md)**: qué se loguea de un error y qué se responde.
- **[`bus-consumer`](./bus-consumer.md)**: el log del estado de la conexión.
- **[`env-config`](./env-config.md)**: `LOG_COMMANDS` y las `LOGGER_*`.
