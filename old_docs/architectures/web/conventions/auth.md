---
id: auth
display_name: Autenticación (Auth.js v5 + Zitadel OIDC)
language: nextjs
description: Auth.js v5 con provider Zitadel, guard en el layout del grupo de rutas, roles del claim del proyecto
applies_to: [frontend]
required_by: []
package: next-auth
---

# Autenticación (web)

> **Reemplaza** la convención `auth` del catálogo, que protege con `middleware.ts` y un patrón
> DAL. Acá el guard está en el layout del grupo de rutas y no hay middleware. La regla
> transversal que sí se mantiene: **deny by default** y el token solo en el servidor.

## Piezas

| Archivo | Rol |
|---|---|
| `src/lib/auth.ts` | Configuración de Auth.js: provider, callbacks, sesión. Exporta `handlers`, `signIn`, `signOut`, `auth` |
| `src/app/api/auth/[...nextauth]/route.ts` | Monta `handlers`. Dos líneas, no se toca |
| `src/app/providers.tsx` | `<SessionProvider>` para el lado cliente |
| `src/app/(loggedin)/layout.tsx` | El guard |
| `src/shared/types/next-auth.d.ts` | Augmentación de tipos de `Session`, `User`, `JWT` |
| `src/shared/utils/decoded-token.ts` | Acceso al token desde los route handlers |
| `src/hooks/use-current-user.ts`, `use-logout.ts` | Lectura de sesión y logout desde el cliente |

## Provider

```ts
Zitadel({
  authorization: {
    params: {
      scope:
        'openid profile email urn:zitadel:iam:org:projects:roles ' +
        `urn:zitadel:iam:org:project:id:${ZITADEL_PROJECT_ID}:aud`,
    },
  },
  clientId: ZITADEL_CLIENT_ID || '',
  clientSecret: ZITADEL_CLIENT_SECRET || '',
  issuer: ZITADEL_ISSUER || '',
  async profile(profile) {
    return {
      id: profile.sub,
      roles: Object.keys(profile['urn:zitadel:iam:org:project:' + `${ZITADEL_PROJECT_ID}:roles`] || {}),
    };
  },
})
```

**Reglas:**

- El scope **debe** incluir `urn:zitadel:iam:org:project:id:{PROJECT_ID}:aud`. Sin eso el access
  token no lleva a la api como audiencia y la api lo rechaza.
- Los roles son las **claves** del claim del proyecto, no sus valores. El claim es un objeto
  `{ "admin": { "orgId": "..." } }`; `Object.keys` da `['admin']`.
- `ZITADEL_PROJECT_ID` aparece dos veces (scope y clave del claim). Si cambia, cambian las dos.
- La app OIDC en Zitadel tiene que ser de tipo **User Agent / PKCE** y declarar el redirect URI
  exacto (`{AUTH_URL}/api/auth/callback/zitadel`).

## Sesión

```ts
session: { strategy: 'jwt', maxAge: 12 * 60 * 60 }
```

JWT firmado en cookie, 12 horas. No hay sesión en base.

### Callback `jwt` — la expiración es real

```ts
async jwt({ token, user, account }) {
  if (account && user) {
    return {
      ...token, user,
      accessToken: account.access_token,
      expiresAt: account.expires_at,
      zitadelSub: getAccessTokenSub(account.access_token),
    };
  }
  token.user ??= user;
  if (token.expiresAt && Date.now() > (token.expiresAt as number) * 1000) {
    console.warn('Access token has expired - user needs to re-authenticate');
    return null;
  }
  return token;
}
```

**Reglas:**

- El primer branch (`account && user`) corre solo en el login. Ahí se guarda el `access_token` y
  su `expires_at`.
- **Devolver `null` invalida la cookie** y fuerza re-login. Es el mecanismo de expiración: no
  hay refresh token, la sesión no se renueva.
- `expiresAt` viene en **segundos** (formato OAuth) y `Date.now()` en milisegundos. De ahí el
  `* 1000`.
- `zitadelSub` se extrae decodificando el payload del access token a mano
  (`getAccessTokenSub`), con `try/catch` que devuelve `null`. Es el `sub` de Zitadel, y sirve
  para resolver qué persona del sistema es el usuario logueado.

### Contrato de sesión

```ts
// src/shared/types/next-auth.d.ts
interface Session {
  user: { id: string; roles: string[]; zitadelId?: string } & DefaultSession['user'];
  accessToken: string;
}
```

**Regla:** cualquier campo nuevo en la sesión se declara acá **y** se copia en el callback
`session`. Sin la declaración TypeScript no lo ve; sin el callback no llega.

## El guard

```tsx
// src/app/(loggedin)/layout.tsx
export const dynamic = 'force-dynamic';

export default async function Layout({ children }) {
  const session = await auth();
  if (!session) redirect('/login');
  if (session.user?.roles?.includes('external-user')) redirect('/unauthorized');
  return (/* shell: aside + main + ToastContainer */);
}
```

**Reglas:**

- **Toda ruta autenticada va dentro de `(loggedin)/`.** Es el único lugar donde está el guard.
  Una ruta creada fuera del grupo no tiene ninguno.
- `export const dynamic = 'force-dynamic'` es obligatorio en el layout: sin eso Next puede
  intentar prerenderizar el grupo y `auth()` no tiene request.
- Las páginas que necesitan un corte **más fino** que el del grupo repiten el chequeo. Hoy tres
  lo hacen, redirigiendo `external-user` a `/projects`:

  ```tsx
  const session = await auth();
  if (session?.user?.roles?.includes('external-user')) redirect('/projects');
  ```

  Están en `time-allocation/page.tsx`, `worked-times/page.tsx` y `worked-times/report/page.tsx`.
  Es redundante con el redirect a `/unauthorized` del layout — el layout ya cortó antes. Queda
  documentado como está.

## Roles

| Rol | Qué implica en `web` |
|---|---|
| `user` | Acceso completo a la navegación interna |
| `admin` | Además: edita la grilla de asignación semanal, carga horas en nombre de otra persona, y dispara la precarga de la semana anterior |
| `external-user` | Redirigido a `/unauthorized` por el layout. Su portal es `opus-web` |

**Reglas:**

- Leer roles de `session.user.roles`, nunca del token crudo.
- En el servidor: `const session = await auth()`. En el cliente: `useSession()` de
  `next-auth/react`.
- El chequeo es `roles.includes('admin')`, con `?? false` cuando el resultado alimenta un boolean:

  ```ts
  const isAdmin = session?.user?.roles?.includes('admin') ?? false;
  ```

- La navegación filtra por rol en `ShellSidebar.tsx` (`getVisibleNavItems`). **Ocultar un ítem
  no es autorización:**
  el corte real está en la página.

## Login y logout

**Login** — `signIn` del lado cliente, con callback a la ruta de entrada:

```tsx
signIn('zitadel', { callbackUrl: '/login/enter' });
```

`/login/enter` es una página de servidor que llama a `presentInApi()` y redirige. Existe para
darle a la api la oportunidad de registrar al usuario antes de la primera pantalla.

> **`presentInApi` traga sus errores** (`console.warn` y continúa) y del lado de `api` el
> endpoint es un no-op documentado. Un usuario nuevo del proveedor de identidad no queda dado
> de alta, y las demás rutas le responden 401. Es una limitación conocida, no un patrón.

**Logout** — dos formas, según dónde esté el botón:

```ts
// cliente
signOut({ callbackUrl: '/login' });          // hooks/use-logout.ts, ShellSidebar.tsx

// server action
await signOut({ redirectTo: '/login' });     // unauthorized/page.tsx:21
```

**Regla:** el parámetro difiere. `callbackUrl` en el cliente, `redirectTo` en el servidor.

## Acceso al token en route handlers

```ts
const token = await decodedToken();
if (!token?.accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

**Regla:** en un route handler usar `decodedToken()`, no `auth()`. En una Server Action no hace
falta nada: el interceptor de `apiClient` ya inyecta el `Bearer`.

## El 401 de la api

```ts
// src/lib/axios.ts:46-51
if (error.response?.status === 401) {
  console.error('Unauthorized request detected - token may be expired');
  if (typeof window !== 'undefined') window.location.href = '/login';
}
```

**Regla:** el interceptor cubre el caso de token vencido en medio de una sesión. La guarda
`typeof window !== 'undefined'` está porque el interceptor corre en el servidor, donde no hay
`window`; en ese caso el error se propaga y lo agarra el `error.tsx` de la ruta.

## Limitación conocida

**`useSessionMonitor` es un no-op.** El cuerpo real está comentado, con el comentario *"Local
development — auth bypassed… Remove this comment and restore the redirect when deploying"*
(`src/hooks/use-session-monitor.ts:3-10`). `<SessionMonitor />` se monta en el layout protegido
y no hace nada.

El acceso inicial sigue protegido por el guard del layout. Lo que falta es la vigilancia
continua: una sesión que muere con la pestaña abierta no redirige hasta el próximo request. Y
como el `SessionProvider` tampoco refresca (`refetchInterval={0}`,
`refetchOnWindowFocus={false}`), no hay ningún otro mecanismo que lo detecte.

## Qué NO hacer

- No crear rutas autenticadas fuera de `(loggedin)/`.
- No pasar el `accessToken` a un componente cliente, ni por props ni por contexto.
- No usar el `id` de la sesión como id de persona: son distintos. El `id` es el `sub` de Zitadel;
  la persona se resuelve con `zitadelId` contra `GET /persons`.
- No agregar un `middleware.ts` sin decidir primero qué pasa con el guard del layout: dos
  mecanismos de protección en paralelo divergen.
