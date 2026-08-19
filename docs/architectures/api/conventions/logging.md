---
id: logging
display_name: Logging (Winston + express-winston)
language: node
description: Winston logger with console in development and rotating file transports in production
applies_to: [api]
required_by: []
package: winston
---

# Logging (api, Winston)

> **Reemplaza** la convención `logging` del catálogo, que usa Pino con JSON estructurado a stdout
> y child loggers por request. Este servicio usa Winston con transports a **archivo** en
> producción, y no tiene contexto por request.

## Cuándo aplica

Todo el servicio. El logger es único y compartido.

## Paquete

```
winston                # 3.19
express-winston        # 4.2, log automático de cada request
```

## El logger

Uno solo, exportado por default desde `lib/logger.ts`:

```ts
import logger from '../logger';        // desde lib/routes/
import logger from '../../logger';     // desde lib/utils/middlewares/
```

Dos configuraciones según `NODE_ENV`:

| | Producción | Resto |
|---|---|---|
| Consola | `info`, con `handleExceptions: true` | `debug` |
| Archivo info | `LOGGER_INFO_PATH`, nivel `LOGGER_INFO_LEVEL` | — |
| Archivo error | `LOGGER_ERROR_PATH`, nivel `LOGGER_ERROR_LEVEL` | — |
| Rotación | `LOGGER_FILE_MAX_SIZE` × `LOGGER_MAX_FILES` | — |
| `exitOnError` | `true` | default |

Formato: `{timestamp} {level}: {message}`. Un `message` que sea objeto se serializa con
`JSON.stringify(message, null, 4)` (`lib/logger.ts:5-11`).

> Los archivos son la razón por la que el contenedor necesita `/var/log` escribible
> (`.env.defaults:4,8`). No es logging a stdout: si querés recolectar con el runtime del
> contenedor, hay que cambiar los transports.

## Log de requests

`express-winston` loguea cada request automáticamente (`app.ts:21-28`), con
`statusLevels: true` — el nivel sale del status HTTP — y `meta: false`.

```ts
app.use(expressWinston.logger({
  winstonInstance: logger,
  expressFormat: true,
  colorize: false,
  meta: false,
  statusLevels: true,
}));
```

> **`meta: false` es lo que evita que los query params entren al log.** Es la contraparte de
> haber eliminado el fallback `?jwt=` en la autenticación: los query params quedan en logs,
> historial y `Referer`. No lo pongas en `true`.

## Cómo se loguea

### Errores inesperados: con contexto de origen

El patrón en todo el código es prefijar el endpoint y la función:

```ts
// lib/routes/projects-get.ts:50
logger.error(`GET /api/projects getAllProjects error: ${error.message}`);
```

```ts
// lib/utils/middlewares/validate-project.ts:32
logger.error(`[middleware] validateProject error: ${error.message}`);
```

```ts
// lib/utils/bus/send-command.ts:31
logger.error(`[bus] ${command}: ${error.message}`);
```

Los prefijos en uso: `[middleware]`, `[bus]`, `[DB]`, `[tests]`, o `{MÉTODO} {path} {función}`.

> Se loguea `error.message`, no el `error` completo. El stack solo se loguea en el arranque
> (`bin/index.ts:25`), donde sí hace falta para diagnosticar por qué no levantó.

### Advertencias que importan

```ts
logger.warn('AUTH_BYPASS activo: la api NO valida tokens...');            // validate-token.ts:57
logger.warn(`Attempt to modify past week: ${req.body.weekStart}`);        // validate-week-not-past.ts:22
logger.warn(`Rolled back uploaded file: ${key}`);                        // attachments-post.ts:128
```

### Operaciones de storage

`storage-service.ts` loguea cada operación con la clave y el tamaño — es lo que permite rastrear
un adjunto que no aparece.

## Niveles

| Nivel | Cuándo |
|---|---|
| `error` | error inesperado, fallo de bus, rollback fallido |
| `warn` | estado peligroso pero manejado: bypass activo, regla de negocio rechazada, rollback ejecutado |
| `info` | operación relevante completada: conexión al bus, archivo subido, servidor escuchando |
| `debug` | detalle de arranque (intentos de conexión, sync del esquema). No sale en producción |

## Reglas

- Usá el logger de `lib/logger.ts`. **Nunca `console.log` / `console.error`**. (Hay dos usos de
  `console.error` en `app.ts:48` y `db-upgrade`; son deuda, no el modelo.)
- Prefijá el mensaje con su origen: `{MÉTODO} {path} {función}` en rutas, `[middleware]`,
  `[bus]`, `[DB]` en el resto.
- Logueá `error.message`, no el error completo. El stack, solo en el arranque.
- **Nunca logs de:** tokens, el header `Authorization`, contraseñas, credenciales de S3, el
  contenido de un archivo subido.
- No pongas `meta: true` en `express-winston`: metería los query params al log.
- Un error que se responde al cliente se loguea **antes** de responder.
- El mensaje del log puede estar en inglés o español, pero no metas datos del usuario en él más
  allá de un id.
- No crees un segundo logger ni una instancia con otra config.

## Integración con otras convenciones

- **error-handling**: todo error inesperado se loguea con contexto antes de responder 500.
- **auth-jwt**: el bypass loguea un `warn` por request.
- **bus-commands**: los fallos del bus se loguean con el nombre del comando.
- **storage**: cada operación de S3 se loguea con la clave.
- **env-config**: las cinco variables `LOGGER_*`.
