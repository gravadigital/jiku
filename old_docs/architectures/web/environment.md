# Configuración: web

Todas las variables se leen **en el servidor y en runtime**. No hay ninguna con prefijo
`NEXT_PUBLIC_`, y eso es lo que permite una sola imagen para todos los entornos.

## Variables

| Variable | Obligatoria | Dónde se lee | Qué rompe si falta |
|---|---|---|---|
| `API_URL` | **sí** | `src/lib/axios.ts:17` y 6 route handlers | `baseURL` queda en `/api` (path relativo sin host). Toda lectura y escritura falla. Los handlers arman `undefinedapi/...` |
| `AUTH_SECRET` | **sí** | Auth.js (implícito) | Auth.js no puede firmar ni verificar la cookie de sesión. Nadie puede loguearse |
| `AUTH_URL` | **sí** en producción | Auth.js (implícito) | El redirect URI que se le manda a Zitadel no coincide con el declarado y el callback falla. Detrás de proxy no se puede inferir |
| `ZITADEL_ISSUER` | **sí** | `src/lib/auth.ts:70`, `src/app/api/userinfo/route.ts:5` | Cae a `''`. Auth.js no puede descubrir los endpoints OIDC |
| `ZITADEL_CLIENT_ID` | **sí** | `src/lib/auth.ts:68` | Cae a `''`. Zitadel rechaza la autorización |
| `ZITADEL_PROJECT_ID` | **sí** | `src/lib/auth.ts:65` y `:75` | El scope de audiencia queda mal armado y **los roles llegan vacíos**: todos entran como usuario sin rol |
| `ZITADEL_CLIENT_SECRET` | no | `src/lib/auth.ts:69` | Nada, con app de tipo *User Agent / PKCE*. Cae a `''` |
| `APP_NAME` | no | `src/app/layout.tsx:14`, `(loggedin)/layout.tsx:26` | Default `'Jiku'` (título del documento y `alt` del logo) |
| `APP_DESCRIPTION` | no | `src/app/layout.tsx:13` | Default `'Gestión de proyectos'` |
| `EXTERNAL_LINKS` | no | `shared/utils/parse-external-links.ts` | El bloque de accesos externos no se muestra. Un JSON mal formado se ignora con `console.error` |
| `LOG_ACCESS_TOKEN` | no | `authApi.ts:8` | Nada. **Con `'true'` imprime el access token completo por consola** |

`trustHost: true` está fijo en la config de Auth.js (`src/lib/auth.ts:18`), necesario para que
funcione detrás del proxy.

## `API_URL`: el trailing slash importa

Los dos consumidores lo tratan distinto:

```ts
// src/lib/axios.ts:17-18  — normaliza
const apiUrl = process.env.API_URL ?? '';
const baseURL = `${apiUrl.replace(/\/$/, '')}/api`;

// src/app/api/clients/route.ts:17  — asume que termina en '/'
await fetch(`${process.env.API_URL}api/clients`, ...)
```

En el deploy el valor es `http://api:3000/` **con** barra final, así que ambos funcionan. Con un
valor sin barra (`http://api:3000`) los route handlers arman `http://api:3000api/clients` y
fallan, mientras las Server Actions siguen andando.

**Regla:** `API_URL` termina en `/`. Al agregar un route handler nuevo, revisar el formato.

## `EXTERNAL_LINKS`

JSON con los accesos a las herramientas del equipo, en el pie de la navegación:

```json
[{"tool":"github","href":"https://github.com/org","label":"Código"},
 {"tool":"mattermost","href":"https://chat.example.com","label":"Chat"}]
```

- `tool` elige el ícono entre `github`, `gitlab`, `hedgedoc`, `mattermost`, `mail`. Si no coincide,
  se usa el genérico de GitHub.
- Se descartan las entradas sin `href` o sin `label`.
- JSON inválido: `console.error` y el bloque queda vacío. El comentario en el código lo justifica —
  *"Una variable mal formada no debería tumbar la navegación entera."*
- Son enlaces a la infraestructura de cada equipo, no del producto. Sin la variable, el bloque no
  se muestra.

## `LOG_ACCESS_TOKEN`

```ts
// src/features/auth/services/authApi.ts:6-15
// Temporal (entorno local): imprime el access token para poder probar la api a mano.
// Sacar antes de mergear.
if (process.env.LOG_ACCESS_TOKEN === 'true') {
  const session = await auth();
  console.log('\n===== ACCESS TOKEN =====\n' + (session?.accessToken ?? '(sin sesión)') + '\n');
}
```

**No definir en ningún entorno compartido.** Un access token en los logs es una credencial en los
logs. El propio código dice que es temporal.

## Configuración por entorno

### Desarrollo local

```sh
API_URL=http://localhost:3001/
AUTH_URL=http://localhost:3000
AUTH_SECRET=$(openssl rand -base64 32)
ZITADEL_ISSUER=https://id.example.com
ZITADEL_CLIENT_ID=...
ZITADEL_PROJECT_ID=...
```

La app OIDC en Zitadel tiene que declarar el redirect URI exacto
`http://localhost:3000/api/auth/callback/zitadel`.

### Producción

```yaml
# deploy/docker-compose.yml:13-24
environment:
  - VIRTUAL_HOST=${DOMAIN}
  - VIRTUAL_PORT=3000
  - LETSENCRYPT_HOST=${DOMAIN}
  - API_URL=http://api:3000/
  - APP_NAME=${APP_NAME:-Jiku}
  - EXTERNAL_LINKS=${EXTERNAL_LINKS:-}
  - AUTH_URL=https://${DOMAIN}
  - AUTH_SECRET=${WEB_NEXTAUTH_SECRET}
  - ZITADEL_ISSUER=${IDENTITY_ISSUER}
  - ZITADEL_CLIENT_ID=${IDENTITY_CLIENT_ID}
  - ZITADEL_PROJECT_ID=${IDENTITY_PROJECT_ID}
```

`API_URL` apunta a la red interna de Docker. El navegador nunca la alcanza, y no necesita: todo el
tráfico de datos sale del proceso de Next.js. `VIRTUAL_HOST` y `LETSENCRYPT_HOST` los consume
`nginx-proxy` + `letsencrypt`, no la aplicación.

`web` y `opus-web` comparten `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID` y `ZITADEL_PROJECT_ID`, pero
tienen **secretos de sesión distintos** (`WEB_NEXTAUTH_SECRET` vs `OPUS_NEXTAUTH_SECRET`).

### Tests

```
# web/.env.test
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=testsecret
ZITADEL_ISSUER=https://id.example.com
ZITADEL_CLIENT_ID=test
ZITADEL_PROJECT_ID=test
```

## Inconsistencias registradas

1. **`.env.test` usa los nombres de NextAuth v4.** Define `NEXTAUTH_URL` y `NEXTAUTH_SECRET`,
   mientras el deploy y el README usan `AUTH_URL` y `AUTH_SECRET` (v5). Los tests no arrancan la
   app, así que no falla — pero el archivo no documenta la configuración real.
2. **`NEXT_PUBLIC_API_URL` no se usa.** Está en `.env.test` y no aparece en ningún archivo de
   `src/`. Es un resto de cuando el cliente llamaba a la api directo.
3. **No hay validación de configuración al arrancar.** A diferencia de `api`, que tiene
   `assertAuthConfig()` y se niega a levantar mal configurada, `web` arranca con cualquier
   combinación: `ZITADEL_CLIENT_ID` vacío cae a `''` (`|| ''` en `auth.ts:68-70`) y el fallo aparece
   recién cuando alguien intenta loguearse. `API_URL` faltante produce requests a un path
   relativo, y el síntoma es un 404 confuso.

## Checklist para un entorno nuevo

1. Crear la app OIDC en Zitadel, tipo **User Agent / PKCE**, con el redirect URI
   `{AUTH_URL}/api/auth/callback/zitadel`.
2. Verificar que el proyecto de Zitadel tenga los roles `admin`, `user`, `external-user` y que
   estén asignados.
3. Generar `AUTH_SECRET` con `openssl rand -base64 32`. Distinto del de `opus-web`.
4. Apuntar `API_URL` a la api **con barra final**.
5. `AUTH_URL` con el esquema y host públicos (`https://...`), no el interno.
6. Confirmar que `LOG_ACCESS_TOKEN` **no** está definido.
