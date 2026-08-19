---
id: auth
display_name: Autenticación (Auth.js)
language: nextjs
description: Authentication with Auth.js — OIDC providers and Credentials, DAL pattern, middleware protection
applies_to: [frontend]
required_by: []
package: next-auth
---

# Authentication (Next.js, Auth.js)

Authentication with [Auth.js v5](https://authjs.dev) (also known as NextAuth.js v5). Handles the OAuth2/OIDC flow, session management via `httpOnly` cookies, and exposes the session to Server Components and Server Actions through a Data Access Layer (DAL). Works with any external OIDC provider (Zitadel, Google, etc.) and with a custom email/password login against your own API.

## When to use

- Any Next.js app that requires authenticated routes or user identity.
- Works with external Identity Providers (OIDC/OAuth2) and with Credentials (email + password against your own API).

## Package

```
next-auth@^5.x      # Auth.js v5
```

## Structure

```
src/
├── auth.ts               # Auth.js config (providers, session strategy)
├── middleware.ts         # route protection (optimistic check only)
└── lib/
    └── dal.ts            # Data Access Layer — verifySession(), getUser()
```

## Configuration

```ts
// src/auth.ts
import NextAuth from 'next-auth';
import Zitadel from 'next-auth/providers/zitadel';
import Credentials from 'next-auth/providers/credentials';
import { env } from '@/lib/env';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Option A: external OIDC provider (Zitadel, Google, etc.)
    Zitadel({
      clientId: env.ZITADEL_CLIENT_ID,
      clientSecret: env.ZITADEL_CLIENT_SECRET,
      issuer: env.ZITADEL_ISSUER,
    }),

    // Option B: custom email + password against your own API
    Credentials({
      async authorize(credentials) {
        const res = await fetch(`${env.API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });
        if (!res.ok) return null;
        return res.json(); // must return { id, name, email, ... } or null
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub!;
      return session;
    },
  },
});
```

```ts
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

## Data Access Layer (DAL)

The DAL is the single place that verifies the session and exposes user identity to the rest of the app. Use it in Server Components, Server Actions, and Route Handlers — never rely on layout-level session checks alone (layouts don't re-run on every navigation).

```ts
// src/lib/dal.ts
import 'server-only';
import { cache } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

// cache() deduplicates calls within a single render pass — no extra DB roundtrips
export const verifySession = cache(async () => {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return session;
});

export const getUser = cache(async () => {
  const session = await verifySession();
  return session.user;
});
```

Usage in a Server Component:

```ts
import { verifySession } from '@/lib/dal';

export default async function Dashboard() {
  const session = await verifySession(); // redirects to /login if unauthenticated
  return <h1>Hello, {session.user.name}</h1>;
}
```

Usage in a Server Action:

```ts
'use server';
import { verifySession } from '@/lib/dal';

export async function updateProfile(formData: FormData) {
  const session = await verifySession();
  // session.user.id is guaranteed here
}
```

## Middleware

Middleware protects routes at the edge before the page renders. Keep it **optimistic** — read the session cookie without a DB call, so it stays fast.

```ts
// src/middleware.ts
import { auth } from '@/auth';

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/dashboard');

  if (isProtectedRoute && !isAuthenticated) {
    return Response.redirect(new URL('/login', req.nextUrl));
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

Middleware is a first defense, not the final authorization check. Always call `verifySession()` inside Server Components and Server Actions — middleware can be bypassed.

## How to use

### Sign in / sign out

```tsx
// src/app/(auth)/login/page.tsx
import { signIn } from '@/auth';

export default function LoginPage() {
  return (
    <form
      action={async () => {
        'use server';
        await signIn('zitadel', { redirectTo: '/dashboard' });
      }}
    >
      <button type="submit">Sign in with Zitadel</button>
    </form>
  );
}
```

```tsx
// src/components/sign-out-button.tsx
'use client';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return <button onClick={() => signOut({ callbackUrl: '/' })}>Sign out</button>;
}
```

### Role-based authorization

```ts
// src/lib/dal.ts (extended)
export const requireRole = cache(async (role: string) => {
  const session = await verifySession();
  if (session.user.role !== role) redirect('/unauthorized');
  return session;
});
```

```ts
// In a Server Action
export async function deleteUser(id: string) {
  await requireRole('admin');
  // ...
}
```

## Credentials provider — limitations

The `Credentials` provider does not support automatic refresh token rotation. If your API issues short-lived access tokens with refresh tokens:

- Store the access token and refresh token in the Auth.js `jwt` callback.
- Handle rotation manually in the `jwt` callback by calling your API's refresh endpoint when the access token is expired.
- If this becomes too complex, consider using `jose` directly to verify tokens without Auth.js session management.

## Rules

- Call `verifySession()` from the DAL at the top of every Server Component and Server Action that requires authentication. Never rely solely on middleware.
- Middleware only reads the cookie (no DB call). The DAL does the real verification.
- `server-only` is imported in `dal.ts` to prevent accidental use in Client Components.
- Never expose the full session object to Client Components. Pass only the fields the component needs.
- `signIn()` and `signOut()` from `next-auth/react` are Client Component APIs. Server-side equivalents come from `@/auth`.
- Environment variables for auth (`ZITADEL_CLIENT_ID`, `AUTH_SECRET`, etc.) are validated at startup via the `env-config` convention.
- `AUTH_SECRET` must be a random string of at least 32 characters. Generate with `openssl rand -base64 32`.

## Integration with other conventions

- **_base**: `verifySession()` and `getUser()` live in `src/lib/dal.ts`. Auth.js route handler in `src/app/api/auth/[...nextauth]/route.ts`.
- **mutations**: every Server Action that modifies data calls `verifySession()` at the top.
- **api-routes**: Route Handlers that require auth call `verifySession()` from the DAL.
- **env-config**: `AUTH_SECRET`, provider client IDs and secrets are validated at startup.
