---
id: auth
display_name: Autenticación (NextAuth v5 + Zitadel OIDC)
language: nextjs
description: NextAuth v5 con provider Zitadel, guard en middleware.ts, roles del claim del proyecto
applies_to: [frontend]
required_by: []
package: next-auth
---

# Autenticación (opus-web)

> **Reemplaza** la convención `auth` del catálogo. Misma librería y proveedor que `web`, pero
> el guard está en `middleware.ts` y no en un layout, y las variables usan los nombres de v4.

## Configuración

Toda en `src/features/auth/config/nextauth.config.ts`. La ruta `[...nextauth]` solo re-exporta lo
que arma `NextAuth()`.

```ts
// src/features/auth/config/nextauth.config.ts:13-17
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  // ...
});
```

| Qué | Valor |
|---|---|
| Proveedor | `Zitadel` de `next-auth/providers/zitadel` |
| Flujo | Authorization Code + PKCE — `clientSecret: ''`, app de tipo *User Agent / PKCE* |
| Scope | `openid profile email urn:zitadel:iam:org:projects:roles urn:zitadel:iam:org:project:id:{ZITADEL_PROJECT_ID}:aud` |
| Estrategia de sesión | JWT en cookie firmada |
| `maxAge` | **no declarado** → default de NextAuth (30 días) |
| `trustHost` | `true`, necesario detrás del proxy |

> **`web` declara `maxAge: 12h` y `opus-web` no.** La cookie de este portal dura 30 días. El
> access token de Zitadel vence mucho antes, y de eso se ocupa el middleware — pero la ventana de
> la cookie es distinta entre los dos frontends sin que haya un motivo escrito.

## El guard vive en el middleware

Al revés que `web`, que lo pone en el layout de `(loggedin)/`.

```ts
// src/middleware.ts:25-47
export default async function middleware(request: NextRequest) {
  const session = (await (auth as unknown as () => Promise<Session | null>)()) ?? null;
  const isValid = isSessionValid(session);
  const isLoginPage = request.nextUrl.pathname === '/login';

  // Autenticado en /login → redirigir a inicio
  if (isValid && isLoginPage) return NextResponse.redirect(new URL('/', request.url));

  // No autenticado fuera de /login → redirigir a login
  if (!isValid && !isLoginPage) return NextResponse.redirect(new URL('/login', request.url));

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|attachments|_next/static|_next/image|favicon.ico).*)',
};
```

**La protección es por defecto y por exclusión.** Una página nueva queda protegida sin registrarla
en ningún lado — lo contrario de `web`, donde una ruta fuera de `(loggedin)/` no tiene guard.

Lo excluido del matcher, y por qué:

| Exclusión | Motivo |
|---|---|
| `api` | Los route handlers manejan su propia auth. Si pasaran por el middleware, un 401 se convertiría en un redirect a `/login` — inútil para una llamada de axios |
| `attachments` | El handler de descarga pública es intencionalmente sin sesión. Ver [api-routes](./api-routes.md) |
| `_next/static`, `_next/image`, `favicon.ico` | Estáticos |

**Regla:** agregar una ruta pública implica editar ese regex. Y sacar algo del matcher significa
que **no tiene sesión**, no solo que no redirige.

### La validación no es solo "hay cookie"

```ts
// src/middleware.ts:14-23
function isSessionValid(session: Session | null): boolean {
  if (!session?.user?.id) return false;
  const expiresAt = (session as { expiresAt?: number }).expiresAt;
  if (typeof expiresAt === 'number' && expiresAt > 0 && expiresAt <= Date.now()) return false;
  return true;
}
```

Una cookie válida con el access token vencido **no alcanza**: el token es lo que se le manda a la
api, y vencido no sirve.

> **`web` invalida desde el callback `jwt`; acá el callback deja pasar y corta el middleware.**
> El efecto para el usuario es el mismo (vuelve al login); el punto de control, no. Consecuencia:
> una llamada de axios con la sesión vencida **no** pasa por el middleware (`api` está excluido),
> así que llega al route handler, que reenvía un token vencido y recibe un 401 de la api. Ahí
> actúa el interceptor.

### El cast de `auth`

```ts
// src/middleware.ts:26-28
// `auth` está sobrecargada en v5: sirve como wrapper de middleware y como getter de
// sesión. Acá se usa la segunda forma, así que se acota el tipo.
const session = (await (auth as unknown as () => Promise<Session | null>)()) ?? null;
```

Está documentado en el código. No es un cast al azar: es acotar una sobrecarga.

## Los callbacks

```ts
// src/features/auth/config/nextauth.config.ts:19-46
async jwt({ token, user, account }) {
  token.user ??= user;
  token.accessToken ??= account?.access_token;
  token.refreshToken ??= account?.refresh_token;
  token.expiresAt ??= (account?.expires_at ?? 0) * 1000;
  token.error = null;
  return token;
},
async session({ session, token }) {
  const tokenUser = token.user as { id: string; name?: string; email?: string; roles: string[] };
  session.user = {
    ...session.user,
    id: tokenUser.id,
    name: tokenUser.name ?? session.user?.name ?? '',
    email: tokenUser.email ?? session.user?.email ?? '',
    roles: tokenUser.roles,
  };
  session.accessToken = token.accessToken as string;
  // El middleware necesita `expiresAt` para rechazar sesiones cuyo access token ya
  // venció, así que se expone acá: en v4 lo leía del token vía getToken().
  (session as { expiresAt?: number }).expiresAt = token.expiresAt as number;
  return session;
},
```

**`??=` y no `=`.** El token solo se completa la primera vez (cuando llegan `user` y `account`); en
los refrescos posteriores conserva los valores. Es lo que hace que `expiresAt` refleje el
vencimiento original del access token y el middleware pueda rechazarlo.

**`expiresAt` en milisegundos.** `account.expires_at` viene en segundos y se multiplica por 1000
para comparar contra `Date.now()`.

**No hay refresh del access token.** `refreshToken` se guarda y no lo usa nadie. Cuando el access
token vence, se vuelve al login.

**`token.error = null` se setea y nunca se lee.** Resto de una implementación anterior.

## El `profile()` hace un fetch de rescate

```ts
// src/features/auth/config/nextauth.config.ts:60-88
async profile(profile, tokens) {
  let name = profile.name ?? profile.preferred_username ?? '';
  let email = profile.email ?? '';

  // Si name o email vienen vacíos, los buscamos en el userinfo endpoint
  if (!name || !email) {
    try {
      const res = await fetch(`${ZITADEL_ISSUER}/oidc/v1/userinfo`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (res.ok) { /* completa lo que falte */ }
    } catch {
      // si falla el userinfo, usamos lo que tenemos
    }
  }

  return {
    id: profile.sub,
    name, email,
    roles: Object.keys(profile[`urn:zitadel:iam:org:project:${ZITADEL_PROJECT_ID}:roles`] || {}),
  };
}
```

Dos cosas:

- **El fetch extra es tolerante a fallos.** Si el `userinfo` no responde, entra con lo que tenga.
- **Los roles son las CLAVES del claim**, no sus valores. El claim de Zitadel es un objeto
  `{rol: {orgId: dominio}}`, así que `Object.keys()` da `['admin']`, `['external-user']`, etc.

## El contrato de la sesión

Declarado en `src/shared/types/next-auth.d.ts`:

```ts
declare module 'next-auth' {
  interface Session {
    user: { id: string; name: string; email: string; roles: string[] };
    accessToken: string;
  }
}
```

Es lo que permite `session.user.roles.includes('external-user')` sin cast.

> **`expiresAt` no está declarado ahí**, y por eso los dos lugares que lo usan hacen
> `(session as { expiresAt?: number })` (`middleware.ts:18`, `nextauth.config.ts:44`). Agregarlo a
> la augmentación eliminaría los dos casts.

## Roles: qué habilitan

**No hay ningún corte de navegación por rol.** Cualquier usuario autenticado ve las mismas rutas.
El rol solo cambia qué se renderiza:

| Rol | Efecto | Dónde |
|---|---|---|
| `user` o `admin` | Los pills de estado y prioridad se vuelven dropdowns editables | `ListRequirementRow.tsx:119-120`, `KanbanCard.tsx:102-103` |
| `external-user` | Aparece el botón de suscripción | `ModalTopbar.tsx:98`, `BoardHeader.tsx:111`, `RequirementDetailModal.tsx:25` |

El patrón para leer el rol es siempre el mismo:

```tsx
const { data: session } = useSession();
const isInternal = session?.user?.roles?.includes('user') || session?.user?.roles?.includes('admin');
const isExternalUser = session?.user?.roles?.includes('external-user') ?? false;
```

Esto es coherente con que el portal sea de clientes: **el filtro real es de datos** — `api` solo
devuelve los proyectos con permiso — y no de rutas. La UI por rol es presentación.

> **Si `ZITADEL_PROJECT_ID` está mal, los roles llegan vacíos y la aplicación no falla:** nadie es
> interno ni `external-user`, los pills no son editables y no aparece el botón de suscripción. Sin
> ningún error visible. Ver [environment.md](../environment.md).

## Login y logout

**Login** — un botón que delega en Zitadel:

```tsx
// src/app/(auth)/login/page.tsx:12-15
function handleLogin() {
  setLoading(true);
  signIn('zitadel', { callbackUrl: '/login/enter' });
}
```

**El callback no va a `/`, va a `/login/enter`**, que es un server component que se presenta ante
la api y recién ahí redirige:

```tsx
// src/app/(auth)/login/enter/page.tsx:4-7
export default async function LoginEnterPage() {
  await presentInApi();
  redirect('/');
}
```

**Logout** — un hook de una línea:

```ts
// src/shared/hooks/useLogout.ts:3-5
export function useLogout() {
  return () => signOut({ callbackUrl: '/login' });
}
```

Lo usan `Sidebar`, `Header` y `MobileMenu` (los dos últimos, código muerto).

## `presentInApi` traga los errores a propósito

```ts
// src/features/auth/services/authApi.ts:24-31
} catch (error) {
  // No es fatal: si el alta falla, el usuario igual tiene sesión y las pantallas
  // resuelven solas si le falta permiso. Antes se relanzaba y /login/enter quedaba en
  // una pantalla blanca de error, sin poder entrar. La web ya lo trataba así.
  console.warn('Failed to present in API, but continuing:', apiError.message);
  return null;
}
```

Es deliberado y está documentado. **El costo:** si el alta falla, no hay señal — el usuario entra y
ve un portal vacío, indistinguible de un usuario sin proyectos asignados.

Es el único archivo con `'use server'`, y usa `apiClientBase` (no `apiClient`) porque corre en el
servidor.

## El 401 desde el navegador

El interceptor de respuesta de axios normaliza el error y, si es 401, saca al usuario:

```ts
// src/lib/axios.ts:31-36
// Redirect a login si es 401 (solo en cliente)
if (error.response?.status === 401) {
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
```

Es `window.location.href`, no `router.push`: fuerza una recarga completa, que limpia el estado de
React y el cache de TanStack Query.

**Con esto y el middleware están cubiertos los dos caminos:** una navegación con la sesión vencida
la corta el middleware; una llamada de datos la corta el interceptor.

## Qué NO hacer

- No usar `getToken()` de `next-auth/jwt`: en v5 está explícitamente desaconsejado. El comentario
  de `middleware.ts:6-8` lo dice.
- No agregar un guard por rol en un layout sin decidir antes si el portal debe cortar navegación —
  hoy, a propósito, no lo hace.
- No sacar una ruta del matcher sin entender que queda **sin sesión**.
- No leer el rol de otro lado que no sea `session.user.roles`.
- No asumir que hay refresh de token: no lo hay.
