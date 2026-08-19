---
id: error-handling
display_name: Manejo de errores
language: nextjs
description: error.tsx boundaries, expected vs unexpected errors, contract with the backend
applies_to: [frontend]
required_by: [data-fetching, mutations, forms]
package: null
---

# Error Handling (Next.js)

How a Next.js app surfaces, contains, and recovers from errors. Two principles: **expected errors are values**, **unexpected errors propagate to an error boundary**.

## When to use

Any Next.js app. Auto-included whenever `data-fetching`, `mutations`, or `forms` is active because all three produce errors that need a contract.

## Two classes of errors

| Class | Examples | How to handle |
|---|---|---|
| **Expected** | Form validation fails, "email already taken", "not found", permission denied for a known reason. | **Return as a value** from the Server Action or fetch helper. The component renders inline messages. |
| **Unexpected** | DB down, third-party API 500, network timeout, bug. | **Throw**. The nearest `error.tsx` catches it and renders fallback UI. |

Never throw for expected errors. The user does not see `error.tsx` as a "form error"; they see it as "something broke". Wrong UX.

## `error.tsx` per route segment

`error.tsx` is the App Router's error boundary. Place one per route segment that needs distinct error UI. The closest `error.tsx` up the tree catches.

```tsx
// src/app/users/error.tsx
'use client';

import { useEffect } from 'react';

export default function UsersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optional: report to monitoring
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4">
      <h2 className="font-semibold">Could not load users</h2>
      <p className="mt-1 text-sm text-red-700">
        Something went wrong. The team has been notified.
      </p>
      <button
        onClick={reset}
        className="mt-3 rounded bg-red-600 px-3 py-1 text-sm text-white"
      >
        Try again
      </button>
    </div>
  );
}
```

Rules of `error.tsx`:
- It is a **Client Component** (must declare `'use client'`).
- It receives `error` (a JavaScript `Error`) and `reset` (a function that re-renders the segment).
- The `error.message` of a Server Component error is **redacted in production** — only `error.digest` is exposed. Do not display `error.message` to the user; show a generic message and use `digest` for support lookups.
- One `error.tsx` per segment that needs distinct UI. Default to one at the root and add more as needed.

## `not-found.tsx` and `notFound()`

For "this resource does not exist", use `notFound()` from `next/navigation` and a `not-found.tsx`:

```tsx
// src/app/users/[id]/page.tsx
import { notFound } from 'next/navigation';
import { getUserById } from '@/lib/users';

export default async function UserPage({ params }: { params: { id: string } }) {
  const user = await getUserById(params.id);
  if (!user) notFound();
  return <Profile user={user} />;
}
```

```tsx
// src/app/users/[id]/not-found.tsx
export default function UserNotFound() {
  return <p>User not found.</p>;
}
```

`notFound()` is **not** an error. Do not throw a normal `Error` for "not found"; use `notFound()`.

## Global error: `global-error.tsx`

For errors that the root layout itself fails to render (rare), add `src/app/global-error.tsx`. It replaces the entire HTML document and must include `<html>` and `<body>` tags. Use only as a last-resort fallback.

```tsx
// src/app/global-error.tsx
'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <h1>Something went wrong</h1>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
```

## Error shape from the backend

When the API/backend is in a separate service (e.g., the Node service with `http-server` + `error-handling` conventions), the response error shape is:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is not valid",
    "details": { "field": "email" }
  }
}
```

(or the override shape this service defines — check the backend service's `architectures/{service}/` for any override of `error-handling`.)

Server Components and Server Actions that call the backend translate this contract:

```ts
// src/lib/api/client.ts
type ApiError = { error: { code: string; message: string; details?: unknown } };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.API_URL}${path}`, init);
  if (!res.ok) {
    const body = (await res.json()) as ApiError;
    throw new ApiCallError(body.error.code, body.error.message, res.status, body.error.details);
  }
  return res.json();
}

export class ApiCallError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiCallError';
  }
}
```

- **In Server Components**: `ApiCallError` thrown -> nearest `error.tsx` catches.
- **In Server Actions**: catch `ApiCallError` and convert to a return value when it represents an expected error (validation, conflict). Let it propagate when it represents an unexpected one (5xx).

```ts
// src/actions/user-actions.ts
'use server';
import { apiFetch, ApiCallError } from '@/lib/api/client';

export async function createUser(_prev: State, formData: FormData) {
  try {
    const user = await apiFetch<User>('/users', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    return { ok: true, data: user };
  } catch (err) {
    if (err instanceof ApiCallError && err.code === 'VALIDATION_ERROR') {
      return { errors: err.details as Record<string, string[]> };
    }
    throw err; // unexpected -> error.tsx
  }
}
```

## Logging

In production, log unexpected errors with a server-side logger (or a reporting service like Sentry). The `error.digest` exposed to the client lets support correlate user reports with server logs.

```ts
// In a Server Component or Server Action
import { logger } from '@/lib/logger';

try {
  // ...
} catch (err) {
  logger.error({ err, route: '/users' }, 'Failed to load users');
  throw err;
}
```

## Rules

- **Expected errors are return values.** Validation, business rules, "not found", "conflict" — all return.
- **Unexpected errors are thrown.** DB failures, network timeouts, bugs — let `error.tsx` catch.
- **`notFound()` for missing resources**, not a generic `Error`.
- **One `error.tsx` per segment that needs distinct UI.** Always have at least a root-level one.
- **Do not display `error.message`** to the user in production. Use a generic message and the `digest` for support.
- **`error.tsx` is a Client Component** (`'use client'` at the top).
- **The backend error shape is the contract.** When calling the backend, the client wrapper translates the backend's `{ error: { code, message, details } }` (or override shape) to typed exceptions.
- **Server Actions: catch expected, throw unexpected.** Map known error codes from the backend to user-friendly return values; let unknown errors propagate.
- **No `console.error` in production code** — use the logger. `console.error` is acceptable in `error.tsx` because the boundary is the right place to log uncaught errors before reporting.
- **`global-error.tsx` is last resort.** If you find yourself relying on it for normal flows, add a more specific `error.tsx`.

## Integration with other conventions

- **data-fetching**: failed fetches throw; the nearest `error.tsx` catches. Wrap data-loading functions to translate backend errors into typed exceptions.
- **mutations**: expected errors from Server Actions return as values; unexpected ones throw.
- **forms**: validation errors always return as values (never throw), so `useActionState` can render inline messages.
- **_base**: the `logger` used here is configured in `src/lib/logger.ts`.
