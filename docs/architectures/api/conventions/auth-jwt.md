---
id: auth-jwt
display_name: Autenticación JWT (Zitadel + JWKS propio)
language: node
description: JWT verification against Zitadel's JWKS with retry-on-unknown-kid, roles from a project claim, opt-in dev bypass
applies_to: [api]
required_by: []
package: jsonwebtoken
---

# Autenticación JWT (api, Zitadel)

> **Reemplaza** la convención `auth-jwt` del catálogo, que usa `jose` con un patrón de access +
> refresh token emitidos por el propio servicio. Acá la api **no emite tokens**: los verifica
> contra el JWKS de Zitadel, que es el proveedor de identidad.

## Cuándo aplica

Todo el servicio: la autenticación se instala globalmente, no por ruta.

## Paquete

```
jsonwebtoken           # 9.0, verificación
axios                  # trae el JWKS
crypto (node:crypto)   # createPublicKey desde el JWK
@jiku/zitadel-auth     # token del service user, para el bus (no para requests HTTP)
```

## Se instala globalmente, por método HTTP

`app.ts:32-35` monta `validateToken` para **todo path excepto** las exenciones de
`config/public.ts`, armadas como regex de lookahead negativo:

```ts
app.get(publicPaths('get'), validateToken);
app.patch(publicPaths('patch'), validateToken);
app.post(publicPaths('post'), validateToken);
app.delete(publicPaths('delete'), validateToken);
```

**Deny-by-default.** Una ruta nueva queda protegida sin hacer nada.

> **Consecuencia al leer el código:** un archivo de ruta puede *parecer* desprotegido y estar
> cubierto. No agregues `validateToken` a la cadena de una ruta al ver que no lo tiene.
>
> Algunas rutas **sí** lo declaran explícitamente (`attachments-get.ts:86`,
> `unworked-times-get.ts:51`). Es redundante pero inofensivo. Para código nuevo, no lo repitas.

### La única exención

`GET /api/opus/attachments/:id/public`, declarada en `config/public.ts:20`. Está exenta porque
**tiene su propio control de acceso**: valida `visibilityLevel === 'public'` por cada
`entityType` y responde 403 en cualquier otro caso.

> Agregar algo a esa lista deja el endpoint accesible sin credencial. Solo va ahí lo que tenga
> control de acceso propio, y el comentario del archivo lo dice explícitamente.
>
> El método `PUT` **no** está en `PublicPath` (`config/public.ts:2-7`), así que
> `publicPaths('put')` nunca se llama. `PUT /api/week-assigned-times` queda cubierto porque
> declara `validateToken` en su propia cadena (`week-assigned-times-put.ts:121`). Si agregás otro
> `PUT`, declaralo explícitamente o agregá el método a la config.

## El flujo de `validateToken`

```
Authorization: Bearer <jwt>
  │  solo por header: el fallback ?jwt= se eliminó (queda en logs, historial y Referer)
  ▼
decodeAuthToken(token)                          jwt.verify con getKey
  │  getKey busca el kid en las claves cacheadas
  │  si no está: resincroniza el JWKS y reintenta, hasta KEY_SYNC_ATTEMPS veces
  ▼
req.decodedToken, req.decodedTokenRoles         roles del claim del proyecto
  ▼
User.findByPk(decodedToken.sub)
  │  no existe → 401 user_not_found  (excepto en /api/auth/present)
  ▼
req.user   →   next()
```

Cualquier fallo responde `401 { code: 'unauthorized' }`.

## El JWKS se sincroniza con reintentos

`synchronizeIdentityKeys()` trae `{IDENTITY_URL}/oauth/v2/keys` al arrancar
(`app.ts:59`, dentro de `afterInitialize`). Si llega un token con un `kid` desconocido,
`verifyingKeys` **resincroniza y reintenta** hasta `KEY_SYNC_ATTEMPS` veces
(`lib/utils/auth-helper.ts:33-57`).

> Eso es lo que cubre la rotación de claves en Zitadel sin reiniciar el servicio. No cachees el
> JWKS en otro lado ni saltees el reintento.

## Roles

Salen del claim de proyecto de Zitadel, como las **claves** del objeto:

```ts
// lib/utils/auth-helper.ts:92-97
function getRolesFromToken(decodedToken: DecodedToken) {
  if (!decodedToken['urn:zitadel:iam:org:project:roles']) {
    return [];
  }
  return Object.keys(decodedToken['urn:zitadel:iam:org:project:roles']);
}
```

Roles del producto: `admin`, `user`, `external-user`. Quedan en `req.decodedTokenRoles`.

El uso está en [`authorization`](./authorization.md).

## El bypass de desarrollo

`AUTH_BYPASS=true` desactiva la validación y trata **cada request como `admin`**. Tiene tres
candados:

1. **Opt-in explícito**: hace falta declarar la variable. No se infiere de que falte
   configuración.
2. **Prohibido en producción**: con `NODE_ENV=production` el arranque falla.
3. **Exige `DEV_USER_ID`**: sin el usuario que cargar, falla.

Y `assertAuthConfig()` corre **antes de escuchar** (`bin/index.ts:13`): si falta `IDENTITY_URL`
y no hay bypass declarado, el proceso no arranca.

> **La razón está en el código** (`lib/utils/middlewares/validate-token.ts:12-24`): antes el
> bypass se activaba solo con que faltara `IDENTITY_URL`, así que una variable sin completar
> dejaba la api abierta y con rol `admin` para todo el mundo, en silencio. Es preferible no
> levantar a levantar abierta.
>
> No relajes ninguno de los tres candados, y no vuelvas a inferir el bypass de configuración
> ausente.

Con el bypass activo, cada request loguea un `warn`.

## El usuario tiene que existir en `users`

Un token válido cuyo `sub` no está en la tabla recibe **401 `user_not_found`**. La api no crea
usuarios: `POST /api/auth/present` era la única escritura que nunca se convirtió en comando y hoy
es un **no-op** que responde 200 sin tocar nada.

Por eso esa ruta es la única exceptuada del chequeo:

```ts
// lib/utils/middlewares/validate-token.ts:115
if (!user && req.path !== '/api/auth/present') {
  return res.status(401).json({ code: 'user_not_found', message: 'User not found' });
}
```

> Consecuencia operativa: **una persona nueva de Zitadel no queda dada de alta**. Hoy la única
> vía es insertarla directamente en la base. Está sin decidir si el alta pasa a ser un comando de
> core, si la resuelve el auth-callout al autenticar, o si esa ruta conserva escritura propia.

## El token del service user (bus)

Distinto del token de las requests. `@jiku/zitadel-auth` obtiene un access token con la JSON key
del service user y lo **renueva solo** (caduca en ~1h). Con él la api se autentica en NATS, donde
el auth-callout lee el rol y mintea los permisos de subject.

El `userId` con el que se publica sale de esa key, no de una variable de entorno: tiene que
coincidir con el `sub` que el callout lee. Ver [`bus-commands`](./bus-commands.md).

## Reglas

- No agregues `validateToken` a la cadena de una ruta: ya está global. Es redundante.
- Toda ruta nueva es privada por default. No la agregues a `config/public.ts` salvo que implemente
  su propio control de acceso, y documentá cuál.
- Un `PUT` nuevo necesita `validateToken` explícito, o agregar `put` a `PublicPath`.
- El token va **solo** por header `Authorization: Bearer`. No reintroduzcas el fallback por query
  param.
- No relajes los candados del bypass, y no lo infieras de configuración ausente.
- Las claves del JWKS se leen del cache con reintento y resincronización. No las caches aparte.
- Los roles se leen de `req.decodedTokenRoles`, nunca del cuerpo de la request.
- El id del usuario que actúa se toma de `req.user.id`, nunca del cuerpo.
- Los errores de autenticación son `401` con `unauthorized` o `user_not_found`. Nunca 403: el 403
  es de autorización.
- No implementes alta de usuarios en la api: no puede escribir.

## Integración con otras convenciones

- **authorization**: consume `req.decodedTokenRoles` y `req.user` para las capas de rol y entidad.
- **http-server**: `validateToken` se monta en `app.ts`, no en los archivos de ruta.
- **error-handling**: los 401 `unauthorized` / `user_not_found`.
- **bus-commands**: `req.user.id` viaja como actor; el service user autentica la conexión.
- **env-config**: `IDENTITY_URL`, `KEY_SYNC_ATTEMPS`, `AUTH_BYPASS`, `DEV_USER_ID`.
