---
id: mutations
display_name: Mutaciones (Server Actions)
language: nextjs
description: Server Actions as the default mutation pattern
applies_to: [frontend]
required_by: [forms]
package: next
---

# Mutations (Next.js)

Default pattern for any write operation in a Next.js app: **Server Actions**. Replaces API routes + client `fetch` for internal mutations. The action runs on the server; the client calls it like a normal async function. Works with progressive enhancement (forms still submit without JavaScript).

## When to use

Any user action that changes server state: create, update, delete, optimistic UI, form submission, file upload, business workflow step. **Default to Server Actions**. Use API Route Handlers only when an external client (webhook, mobile, third-party) needs the endpoint — see `api-routes`.

## Package

```
next                  # 'use server' directive is built-in
```

## File organization

Server Actions live in `src/actions/`, one file per domain. The file starts with `'use server'` so every exported function is automatically a Server Action.

```
src/
└── actions/
    ├── user-actions.ts
    ├── order-actions.ts
    └── upload-actions.ts
```

Inline `'use server'` inside a component is allowed for small one-offs, but extract to a file when:
- The action is reused by more than one component.
- The action is more than ~15 lines.
- The action validates input (validation belongs near the action, not in the component).

## Defining a Server Action

```ts
// src/actions/user-actions.ts
'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

export async function createUser(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const parsed = createUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await db.user.create({ data: parsed.data });

  revalidateTag('users');
  redirect(`/users/${user.id}`);
}
```

## Return shape: expected errors as values

For **expected errors** (validation, business rules, "not found", "conflict"), **return a result object**, do not throw:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: Record<string, string[]> }
  | { ok: false; error: string };
```

Why: throwing in a Server Action triggers the nearest `error.tsx`, which is the wrong UX for "email is invalid". Return values flow back to the caller, which renders inline error messages.

For **unexpected errors** (DB down, third-party crashed), **throw**. The error boundary catches them. See `error-handling`.

## Calling a Server Action

### From a form (recommended, works without JS)

```tsx
// src/app/users/new/page.tsx
import { createUser } from '@/actions/user-actions';

export default function NewUserPage() {
  return (
    <form action={createUser}>
      <input name="email" type="email" required />
      <input name="name" required />
      <button type="submit">Create</button>
    </form>
  );
}
```

This is a Server Component. The form submits even with JavaScript disabled.

### From a Client Component with state

```tsx
'use client';
import { useTransition } from 'react';
import { deletePost } from '@/actions/post-actions';

export function DeleteButton({ postId }: { postId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => deletePost(postId))}
    >
      {isPending ? 'Deleting...' : 'Delete'}
    </button>
  );
}
```

For form state with validation errors, use `useActionState` — covered in `forms`.

## Revalidating cached data

After a successful mutation, invalidate the caches set by `data-fetching`:

- `revalidatePath('/users')` — invalidate a specific route.
- `revalidateTag('users')` — invalidate all `fetch` calls tagged with `'users'`.

Always pair mutations with revalidation. Without it, the UI shows stale data after the action returns.

## Redirecting after mutation

`redirect(...)` (from `next/navigation`) is **outside** any `try/catch` block — it works by throwing a special exception that Next catches. If you wrap it in `try/catch`, the redirect breaks. Run validation/business logic first, then `redirect` last.

## Authentication and authorization

Server Actions are HTTP endpoints under the hood. **Treat input as hostile**:

- Always validate input with a schema (see `forms` for Zod patterns).
- Always check the session and permissions at the top of the action.
- Never trust client-passed IDs (e.g., "delete post with id X") without verifying the current user owns it.

## Optimistic updates

For UI that should feel instant, use `useOptimistic` (React 19+):

```tsx
'use client';
import { useOptimistic } from 'react';
import { addComment } from '@/actions/comment-actions';

export function CommentList({ comments }: { comments: Comment[] }) {
  const [optimistic, addOptimistic] = useOptimistic(comments, (state, newComment: Comment) => [
    ...state,
    newComment,
  ]);

  async function action(formData: FormData) {
    const text = formData.get('text') as string;
    addOptimistic({ id: 'temp', text, pending: true });
    await addComment(formData);
  }

  return (
    <>
      {optimistic.map((c) => (
        <Comment key={c.id} {...c} />
      ))}
      <form action={action}>...</form>
    </>
  );
}
```

## Rules

- **Default to Server Actions** for mutations. API Route Handlers only for external clients.
- **One file per domain** in `src/actions/`, starting with `'use server'`.
- **Authenticate and authorize at the top** of every action. The action receives raw input from the network.
- **Validate input with Zod** (see `forms` for full pattern). Never trust `FormData` values.
- **Expected errors are return values**, unexpected errors are thrown.
- **Always revalidate** the relevant cache (`revalidatePath` or `revalidateTag`) after a successful mutation that affects displayed data.
- **`redirect(...)` last, outside `try/catch`.** It works by throwing.
- **Never pass secrets through Server Action arguments.** Server-only data stays on the server; the action looks it up from session/DB.
- **Server Actions are serializable boundaries.** Inputs and outputs must be JSON-serializable. No functions, no class instances, no `Date` objects in the return value (use ISO strings).

## Integration with other conventions

- **forms**: `forms` builds on `mutations` using `useActionState` + Zod + Server Actions. The action signature changes to `(prevState, formData)`.
- **data-fetching**: every mutation calls `revalidatePath` or `revalidateTag` to refresh the caches that `data-fetching` set up.
- **error-handling**: throws from Server Actions land in the nearest `error.tsx`. Expected errors are returned, not thrown.
- **api-routes**: when an external client (webhook, mobile, third-party) needs the endpoint, use Route Handlers instead. Internal mutations stay on Server Actions.
