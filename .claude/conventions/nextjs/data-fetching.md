---
id: data-fetching
display_name: Obtencion de datos (Server Components + fetch)
language: nextjs
description: Data fetching with Server Components and the native fetch
applies_to: [frontend]
required_by: []
package: next
---

# Data Fetching (Next.js)

Read-side data fetching for the App Router. Default: **Server Components with the native `fetch`** (or direct DB/SDK calls). The framework's caching is opt-in per request, decided at fetch time.

## When to use

Any Next.js app that reads data: pages, layouts, components that display server-rendered content. Server Components are the default; client-side fetching is the exception (see "Client-side fetching" below).

## Package

```
next                  # native fetch with extensions
```

No additional library required for the default path. Optional helpers for advanced cases:

```
swr                   # only when client-side fetching is justified
```

## Fetching in Server Components

```tsx
// src/app/users/page.tsx
import { getUsers } from '@/lib/users';

export default async function UsersPage() {
  const users = await getUsers();
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  );
}
```

```ts
// src/lib/users.ts
import { env } from '@/lib/env';
import type { User } from '@/types/user';

export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${env.API_URL}/users`, {
    next: { revalidate: 60 }, // explicit cache: revalidate every 60s
  });
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  return res.json();
}
```

## Caching policy (Next 15+)

`fetch` is **not cached by default** in Next 15+. Caching is opt-in per call:

- `{ next: { revalidate: 60 } }` — Time-based revalidation (ISR-like). The response is cached and refreshed after 60 seconds.
- `{ next: { tags: ['users'] } }` — Tag-based cache. Invalidate later with `revalidateTag('users')`.
- `{ cache: 'force-cache' }` — Cache indefinitely until manual invalidation. Use for immutable data.
- `{ cache: 'no-store' }` (default in Next 15+) — Never cache. Use for highly dynamic or per-user data.

**Choose explicitly at every `fetch`.** Implicit defaults change between Next versions; explicit choices do not.

For non-`fetch` data sources (DB clients, ORMs, SDKs) use `unstable_cache`:

```ts
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';

export const getUserById = unstable_cache(
  async (id: string) => db.user.findUnique({ where: { id } }),
  ['user-by-id'],
  { revalidate: 60, tags: ['users'] },
);
```

## Streaming with Suspense

For slow data, use `loading.tsx` (route-level) or `<Suspense>` (component-level) to stream:

```tsx
// src/app/dashboard/page.tsx
import { Suspense } from 'react';
import { RecentOrders } from './recent-orders';
import { OrdersSkeleton } from '@/components/skeletons';

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <Suspense fallback={<OrdersSkeleton />}>
        <RecentOrders />
      </Suspense>
    </main>
  );
}
```

`RecentOrders` is itself an async Server Component that awaits its data. The page renders immediately, the orders stream in when ready.

## Parallel data fetching

When a Server Component needs multiple independent sources, fetch in parallel with `Promise.all`:

```tsx
export default async function ProfilePage({ params }: { params: { id: string } }) {
  const [user, posts, friends] = await Promise.all([
    getUser(params.id),
    getPosts(params.id),
    getFriends(params.id),
  ]);
  return <Profile user={user} posts={posts} friends={friends} />;
}
```

Sequential `await`s waste time when calls are independent.

## Request memoization

React deduplicates `fetch` calls **within a single render** automatically (same URL + same options). Two components in the same render that fetch the same URL hit the network once. This is automatic — no setup needed.

## Client-side fetching (exception)

Use client-side fetching **only** when:
- The data must update in real time on the client (polling, websockets).
- The data is user-driven and changes frequently (search-as-you-type, filters that should not trigger a full route navigation).
- The data depends on browser-only state (geolocation, scroll position).

When client-side fetching is justified, use SWR or TanStack Query. Otherwise, prefer Server Components.

```tsx
'use client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function Notifications({ userId }: { userId: string }) {
  const { data, isLoading } = useSWR(`/api/users/${userId}/notifications`, fetcher, {
    refreshInterval: 5000,
  });
  if (isLoading) return <div>Loading...</div>;
  return <ul>{data.map(...)}</ul>;
}
```

## Rules

- **Default to Server Components.** Client-side fetching needs an explicit reason.
- **Explicit caching at every `fetch`.** Never rely on implicit defaults — they change between Next versions.
- **One data-loading function per resource**, exported from `src/lib/`. Server Components import these, do not inline `fetch` in pages.
- **Throw on non-2xx responses**, do not silently return `null` or empty arrays. The caller is responsible for handling via `error.tsx` (see `error-handling`).
- **Parallelize independent calls** with `Promise.all`. Avoid sequential `await`s when there is no data dependency.
- **Use Suspense for slow data.** Block the page on critical content, stream the rest.
- **Tag caches that need invalidation** (`{ next: { tags: [...] } }`) so Server Actions can call `revalidateTag(...)` after mutations.
- **Never expose secrets to the client.** Tokens, API keys, DB URLs stay in Server Components and Server Actions. If a value reaches a Client Component, it is public.
- **No data fetching in layouts** unless the data is truly shared by all children. Layouts re-render less often; fetching in them ties caching to the layout lifecycle.

## Integration with other conventions

- **mutations**: after a Server Action mutates data, it calls `revalidatePath(...)` or `revalidateTag(...)` to invalidate the caches set here.
- **error-handling**: failed fetches throw; the nearest `error.tsx` catches and renders fallback UI.
- **_base**: data-loading functions live in `src/lib/`, never in `src/app/` pages.
