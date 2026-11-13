# Configuración: opus-web

Todas las variables se leen **en el servidor y en runtime**. No hay ninguna con prefijo
`NEXT_PUBLIC_`, y eso es lo que permite una sola imagen para todos los entornos.

`opus-web` usa los nombres **de NextAuth v4** (`NEXTAUTH_*`), que v5 sigue leyendo. `web`, el otro
frontend, usa los de v5 (`AUTH_*`). Ver "Inconsistencias registradas".

## Variables

| Variable | Obligatoria | Dónde se lee | Qué rompe si falta |
|---|---|---|---|
| `API_URL` | **sí** | `src/lib/axios.ts:16`, `api/opus/[...path]/route.ts:16`, `api/attachments/[id]/preview/route.ts:11`, `attachments/[id]/[fileName]/route.ts:9` | El proxy responde `500 {"code":"server_misconfigured"}`. Los otros dos handlers arman `undefinedapi/opus/...` y fallan con un error opaco |
| `NEXTAUTH_SECRET` | **sí** | NextAuth (implícito) | NextAuth no puede firmar ni verificar la cookie. Nadie puede loguearse |
| `NEXTAUTH_URL` | **sí** en producción | NextAuth (implícito) | El redirect URI que se le manda a Zitadel no coincide con el declarado y el callback falla. Detrás de proxy no se puede inferir |
| `ZITADEL_ISSUER` | **sí** | `nextauth.config.ts:4` y `:59`, y el fetch de `userinfo` en `:67` | Cae a `''`. NextAuth no puede descubrir los endpoints OIDC |
| `ZITADEL_CLIENT_ID` | **sí** | `nextauth.config.ts:4` y `:57` | Cae a `''`. Zitadel rechaza la autorización |
| `ZITADEL_PROJECT_ID` | **sí** | `nextauth.config.ts:4`, `:54` y `:85` | El scope de audiencia queda mal armado y **los roles llegan vacíos**. Nadie es interno ni `external-user`: los pills no son editables y no aparece el botón de suscripción |
| `NEXT_PUBLIC_APP_VERSION` | no | Inyectada por `next.config.js:11` desde `npm_package_version` | Nada: no se lee en ningún archivo de `src/` |

No hay `ZITADEL_CLIENT_SECRET`: el cliente es público y usa PKCE. El campo está fijo en `''` en el
código, con el motivo escrito al lado (`nextauth.config.ts:58`).

`trustHost: true` está fijo en la config (`nextauth.config.ts:14`), necesario para que funcione
detrás del proxy.

## `API_URL`: el trailing slash importa

Los cuatro consumidores lo tratan distinto. **Dos normalizan y dos no:**

```ts
// api/opus/[...path]/route.ts:33-36  — normaliza
const target = new URL(
  `api/opus/${path.join('/')}${req.nextUrl.search}`,
  base.endsWith('/') ? base : `${base}/`
);

// api/attachments/[id]/preview/route.ts:11  — asume que termina en '/'
const backendUrl = `${process.env.API_URL}api/opus/attachments/${id}/preview`;

// attachments/[id]/[fileName]/route.ts:9  — asume que termina en '/'
const backendUrl = `${process.env.API_URL}api/opus/attachments/${id}/public`;
```

En el deploy el valor es `http://api:3000/` **con** barra final, así que todos funcionan. Con un
valor sin barra, el proxy sigue andando y **los adjuntos dejan de funcionar**: arman
`http://api:3000api/opus/...`.

**Regla:** `API_URL` termina en `/`. Al agregar un route handler nuevo, usar el patrón del proxy
(`new URL` con base normalizada), no la interpolación directa.

`apiClientBase` (`lib/axios.ts:15-21`) también lo lee, pero hoy su único uso es `presentInApi`,
que llama a `/api/auth/present` — con barra inicial, así que axios resuelve bien en los dos casos.

## Configuración por entorno

### Desarrollo local

```sh
API_URL=http://localhost:3100/
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ZITADEL_ISSUER=https://id.example.com
ZITADEL_CLIENT_ID=...
ZITADEL_PROJECT_ID=...
```

La app OIDC en Zitadel tiene que declarar el redirect URI exacto
`http://localhost:3001/api/auth/callback/zitadel`.

Con `deploy/docker-compose.local.yml` el valor es `API_URL=http://api:3000/`, porque dentro del
contenedor `localhost` es el propio `opus-web` y no la api (`docker-compose.local.yml:196-200`).

### Producción

```yaml
# deploy/docker-compose.yml:28-43
opus-web:
  image: gravadigital/jiku-opus-web:${OPUS_WEB_VERSION}
  environment:
    - VIRTUAL_HOST=${OPUS_DOMAIN}
    - VIRTUAL_PORT=3000
    - LETSENCRYPT_HOST=${OPUS_DOMAIN}
    - API_URL=http://api:3000/
    - NEXTAUTH_URL=https://${OPUS_DOMAIN}
    - NEXTAUTH_SECRET=${OPUS_NEXTAUTH_SECRET}
    - ZITADEL_ISSUER=${IDENTITY_ISSUER}
    - ZITADEL_CLIENT_ID=${IDENTITY_CLIENT_ID}
    - ZITADEL_PROJECT_ID=${IDENTITY_PROJECT_ID}
```

`API_URL` apunta a la red interna de Docker. El navegador nunca la alcanza, y no necesita: llama a
`/api/opus/*` de su propio origen. `VIRTUAL_HOST` y `LETSENCRYPT_HOST` los consume `nginx-proxy` +
`letsencrypt`, no la aplicación.

`opus-web` y `web` comparten `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID` y `ZITADEL_PROJECT_ID`, pero
tienen **secretos de sesión distintos** (`OPUS_NEXTAUTH_SECRET` vs `WEB_NEXTAUTH_SECRET`).

> **Las dos apps comparten `ZITADEL_CLIENT_ID`.** El comentario de
> `docker-compose.local.yml:193` lo dice: *"La app de la web ya tiene declarado el redirect del
> 3001."* Una sola app OIDC en Zitadel declara los redirect URIs de los dos frontends.

### Tests

No hay `.env.test`. `vitest.config.mts:27-29` fija solo `TZ: 'UTC'`; los tests no arrancan la
aplicación ni necesitan las variables de OIDC.

## Inconsistencias registradas

1. **Nombres de NextAuth v4 en un proyecto que usa v5.** `NEXTAUTH_URL` y `NEXTAUTH_SECRET`
   mientras `web` usa `AUTH_URL` y `AUTH_SECRET`. v5 sigue leyendo los viejos, así que funciona,
   pero las dos mitades del monorepo se configuran distinto. Está anotado en el README del
   servicio y en `documentation/known-limitations.md`.

2. **No hay validación de configuración al arrancar.** A diferencia de `api`, que tiene
   `assertAuthConfig()` y se niega a levantar mal configurada, `opus-web` arranca con cualquier
   combinación. `ZITADEL_CLIENT_ID` vacío cae a `''` (`nextauth.config.ts:57`) y el fallo aparece
   recién cuando alguien intenta loguearse.

3. **`ZITADEL_PROJECT_ID` mal puesto no falla: degrada en silencio.** El scope de audiencia queda
   mal armado, el claim de roles no llega, y `roles` queda como array vacío. La aplicación anda —
   pero nadie es interno ni `external-user`, así que los pills no son editables y no aparece el
   botón de suscripción. Sin ningún error visible.

4. **`NEXT_PUBLIC_APP_VERSION` se inyecta y no se usa.** `next.config.js:10-12` la expone desde
   `npm_package_version` y no aparece en ningún archivo de `src/`.

## Checklist para un entorno nuevo

1. Verificar que la app OIDC de Zitadel (la misma que usa `web`) declare el redirect URI
   `{NEXTAUTH_URL}/api/auth/callback/zitadel` de este frontend.
2. Confirmar que la app sea de tipo **User Agent / PKCE** — no hay client secret.
3. Verificar que el proyecto de Zitadel tenga el rol `external-user` y esté asignado a los
   usuarios cliente.
4. Generar `NEXTAUTH_SECRET` con `openssl rand -base64 32`. **Distinto del de `web`.**
5. Apuntar `API_URL` a la api **con barra final**, o los adjuntos van a fallar.
6. `NEXTAUTH_URL` con el esquema y host públicos (`https://...`), no el interno.
