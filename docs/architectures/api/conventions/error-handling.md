---
id: error-handling
display_name: Manejo de errores ({code, message} inline)
language: node
description: Errors are returned inline with res.status().json({code, message}); no error classes
applies_to: [api]
required_by: [http-server, validation, auth-jwt, bus-commands]
package: null
---

# Manejo de errores (api)

> **Reemplaza** la convención `error-handling` del catálogo, que define una jerarquía de clases
> `AppError` con `code` y `httpStatus`, lanzadas y traducidas por un handler global. Este
> servicio **no tiene clases de error**: cada punto responde directamente con
> `res.status(...).json({ code, message })`.

## Cuándo aplica

Todo el servicio. Se auto-incluye con `http-server`, `validation`, `auth-jwt` y `bus-commands`,
porque los cuatro necesitan acordar la misma forma de error.

## La forma del cuerpo

Un objeto de dos claves, siempre:

```json
{ "code": "access_denied", "message": "Access denied" }
```

`daily_limit_exceeded` es la única con una tercera clave, `remainingMinutes`.

> **`message` es texto de interfaz.** Los frontends lo muestran tal cual al usuario, así que no
> es un apoyo de debugging. Hoy están mezclados: algunos en inglés y otros en español. Para
> mensajes nuevos que el usuario va a leer, escribilos en **español**, como los más recientes
> (`worked-times-post.ts:43`, `requirements-id-patch.ts:53`).

## Cómo se responde

Sin `throw`, sin handler global que traduzca: se responde y se corta.

```ts
// Middleware que corta
if (!validRole) {
  return res.status(403).json({ code: 'access_denied', message: 'Access denied' });
}
return next();
```

```ts
// Error inesperado en una lectura: se loguea con contexto y sale 500 genérico
.catch((error) => {
  logger.error(`GET /api/projects getAllProjects error: ${error.message}`);
  return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
});
```

El log lleva el endpoint y la función; la respuesta **no** lleva el detalle del error. No filtres
`error.message` de la base al cliente.

## Códigos por situación

| Status | Código | Cuándo |
|---|---|---|
| 400 | `invalid_fields` | falló Joi. Mensaje: `Invalid field - {primer error}` |
| 400 | `invalid_entity_type`, `no_files`, `upload_failed` | validaciones de adjuntos |
| 400 | `invalid_date_range`, `invalid_week`, `resolution_required` | reglas de negocio de la api |
| 401 | `unauthorized` | sin token, token inválido, o falla la verificación |
| 401 | `user_not_found` | el token vale pero el `sub` no está en `users` |
| 403 | `access_denied` | autenticado, pero el rol o el permiso de proyecto no alcanzan |
| 404 | `{entidad}_not_found` | la entidad del path no existe |
| 404 | `id_not_found`, `not_found` | falta el id en el path, o no hay ruta |
| 500 | `internal_error` | cualquier error inesperado |
| 503 | `service_unavailable` | el bus no responde |

`{entidad}_not_found` sigue el nombre de la entidad: `project_not_found`,
`requirement_not_found`, `objective_not_found`, `client_not_found`.

## Errores que vienen del bus

`sendCommand` / `runCommand` ya traducen y responden. El handler no arma ese error: solo corta.

```ts
const data = await sendCommand(res, 'clients.new', payload);
if (!data) {
  return;    // la respuesta de error ya salió
}
```

La traducción `errorCode` → status vive en `httpStatusFor`, y el cuerpo lo arma `errorBody`
(`lib/utils/bus/protocol.ts`). Ver [`bus-commands`](./bus-commands.md).

> `errorBody` recupera `remainingMinutes` **parseando el mensaje con un regex**, porque el
> formato de respuesta del protocolo no tiene dónde poner datos extra de un error
> (`bus/protocol.ts:96-104`). Está marcado como transitorio. No agregues más datos por esta vía:
> si necesitás otro campo estructurado, el lugar correcto es extender el protocolo.

## Los dos handlers finales de `app.ts`

```ts
// app.ts:40-51
app.use(function (_req, _res, next) {
  const err = { message: 'Not Found', status: 404, stack: {} };
  next(err);
});

app.use((res: Response) => {
  console.error('Not Found');
  return res.status(400).json({ status: 'not_found', message: 'Not Found' });
});
```

> **Están mal y conviene saberlo.** El segundo declara un solo parámetro, así que Express lo
> trata como middleware normal (`(req, res, next)`) y no como error handler de cuatro
> argumentos; el objeto que recibe es la request, no la response. Además responde **400** a algo
> que es 404, usa `status` en vez de `code`, y escribe a `console.error` en vez del logger.
>
> Una ruta inexistente hoy **no** cae acá de forma limpia. Si tocás el manejo de 404, arreglá los
> dos handlers juntos: firma de cuatro argumentos, `{ code: 'not_found' }`, status 404, y
> `logger` en lugar de `console`.

## El error handler de multer

El único error handler bien formado del servicio, montado después de la ruta de adjuntos:

```ts
// lib/routes/attachments-post.ts:138-150
function multerErrorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') { /* 400 upload_failed */ }
    if (err.code === 'LIMIT_FILE_COUNT') { /* 400 upload_failed */ }
    return res.status(400).json({ code: 'upload_failed', message: err.message });
  }
  return next(err);
}
router.use(multerErrorHandler);
```

Es el modelo a seguir si necesitás capturar errores de una librería: cuatro argumentos, tratá lo
que reconocés, delegá el resto con `next(err)`.

## Rollback de efectos externos

Cuando una operación tocó un sistema externo antes de fallar, hay que deshacerla. El caso vivo:
la subida de adjuntos borra del bucket lo ya subido si un archivo posterior falla
(`attachments-post.ts:124-134`). El rollback loguea cada borrado, y si el propio rollback falla
también lo loguea sin interrumpir.

## Reglas

- Respondé con `res.status(n).json({ code, message })`. No introduzcas clases de error ni
  `throw` en handlers.
- `code` es `snake_case` y estable: los fronts hacen `switch` sobre él. No lo renombres sin
  revisar `web` y `opus-web`.
- `message` es texto de interfaz. Nuevos mensajes de usuario, en español.
- Nunca devuelvas el detalle de un error interno. Va al log, con endpoint y función; la respuesta
  sale como `internal_error`.
- Un middleware que responde **no** llama a `next()`.
- Después de `sendCommand` / `runCommand`, cortá con `if (!data) return;` / `if (!ok) return;`.
- Un `errorCode` nuevo de core se agrega a `STATUS_BY_ERROR_CODE`, o sale 500.
- Un error handler de Express lleva **cuatro** argumentos y delega lo que no reconoce con
  `next(err)`.
- Si una operación falló después de tocar un sistema externo, deshacé el efecto y logueá tanto el
  rollback como su posible falla.
- Usá `logger`, nunca `console`.

## Integración con otras convenciones

- **http-server**: la tabla de status por situación.
- **validation**: el 400 `invalid_fields` con el primer error de Joi.
- **auth-jwt**: los 401 `unauthorized` y `user_not_found`.
- **authorization**: los 403 `access_denied`.
- **bus-commands**: `httpStatusFor` y `errorBody`, y el 503 del bus caído.
- **logging**: todo error inesperado se loguea con contexto antes de responder.
