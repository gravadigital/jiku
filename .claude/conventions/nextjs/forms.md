---
id: forms
display_name: Formularios (Server Actions + useActionState + Zod)
language: nextjs
description: Forms with Server Actions, useActionState, and Zod validation
applies_to: [frontend]
required_by: []
package: zod
---

# Forms (Next.js)

Default form pattern: **Server Action + `useActionState` + Zod**. No `react-hook-form` library — the framework's primitives cover validation, error display, pending state, and progressive enhancement natively.

## When to use

Any form that submits data to the server. Login, signup, settings, "create X" / "edit X", search forms with submit, file upload. For pure client interaction (search-as-you-type, filters) `forms` does not apply — use plain state.

## Package

```
zod                    # schema validation, shared client/server
```

## Pattern

A form is three things:
1. A **Zod schema** in `src/lib/schemas/` (or colocated with the action).
2. A **Server Action** in `src/actions/` that validates with the schema and returns a result.
3. A **Client Component** that uses `useActionState` to bind the action and display errors.

### 1. Define the schema

```ts
// src/lib/schemas/user-schemas.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Must be a valid email'),
  name: z.string().min(1, 'Name is required').max(100),
  age: z.coerce.number().int().min(18, 'Must be 18 or older'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
```

`z.coerce.number()` converts the string from `FormData` to a number before validating.

### 2. Define the Server Action

```ts
// src/actions/user-actions.ts
'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { createUserSchema } from '@/lib/schemas/user-schemas';

export type CreateUserState = {
  errors?: {
    email?: string[];
    name?: string[];
    age?: string[];
  };
  message?: string;
};

export async function createUser(
  _prevState: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const parsed = createUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    age: formData.get('age'),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const user = await db.user.create({ data: parsed.data });
    revalidateTag('users');
    redirect(`/users/${user.id}`);
  } catch (err) {
    return { message: 'Could not create the user. Try again.' };
  }
}
```

The signature is `(prevState, formData) => Promise<State>`. The state is whatever the form needs to render errors and success messages.

### 3. Use `useActionState` in the form

```tsx
// src/components/users/create-user-form.tsx
'use client';

import { useActionState } from 'react';
import { createUser, type CreateUserState } from '@/actions/user-actions';

const initialState: CreateUserState = {};

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
        {state.errors?.email && (
          <p className="text-sm text-red-600">{state.errors.email[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required />
        {state.errors?.name && (
          <p className="text-sm text-red-600">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="age">Age</label>
        <input id="age" name="age" type="number" required />
        {state.errors?.age && (
          <p className="text-sm text-red-600">{state.errors.age[0]}</p>
        )}
      </div>

      {state.message && <p className="text-sm text-red-600">{state.message}</p>}

      <button type="submit" disabled={pending}>
        {pending ? 'Creating...' : 'Create user'}
      </button>
    </form>
  );
}
```

`pending` is `true` while the action is running. Use it to disable the submit button and show a loading label.

## Submit button as a separate Client Component

If only the submit button needs the pending state (and the rest of the form can stay server-rendered), use the `useFormStatus` hook in a tiny Client Component:

```tsx
// src/components/ui/submit-button.tsx
'use client';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Working...' : label}
    </button>
  );
}
```

This lets the parent form stay a Server Component when it only needs server-rendered inputs.

## Sharing the schema with the client (optional)

The Zod schema is the source of truth. To validate on the client **before** submission (UX improvement, not security), import the schema in a Client Component and run `safeParse` on `onSubmit`:

```tsx
'use client';
import { useState } from 'react';
import { createUserSchema } from '@/lib/schemas/user-schemas';

export function ClientValidatedForm() {
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(formData: FormData) {
    const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    await createUser({}, formData); // server still validates
  }

  return <form action={onSubmit}>...</form>;
}
```

Client-side validation is a UX nicety. **The Server Action MUST validate independently.** Never trust the client.

## File uploads

`FormData` accepts files. Validate size and type in the action:

```ts
'use server';
import { z } from 'zod';

const uploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((f) => f.size > 0, 'File is required')
    .refine((f) => f.size <= 5 * 1024 * 1024, 'Max 5 MB')
    .refine((f) => ['image/png', 'image/jpeg'].includes(f.type), 'Only PNG or JPEG'),
});

export async function uploadAvatar(prevState: unknown, formData: FormData) {
  const parsed = uploadSchema.safeParse({ file: formData.get('file') });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  // ... write to storage
}
```

The form needs `encType="multipart/form-data"`:

```tsx
<form action={formAction} encType="multipart/form-data">
  <input type="file" name="file" accept="image/png,image/jpeg" />
  <SubmitButton label="Upload" />
</form>
```

## Rules

- **Zod schema is the source of truth.** Define it once, use it on both sides if you want UX validation on the client.
- **The Server Action always validates**, regardless of client-side checks.
- **Validation errors are return values, not thrown errors.** Throwing triggers `error.tsx`, which is wrong UX for a form.
- **Use `safeParse`, not `parse`**, so you control the error path.
- **Use `useActionState`** for forms that need to display field errors. Use plain `action={...}` for forms that redirect on success without needing inline error rendering.
- **Use `useFormStatus`** for the submit button when the rest of the form can stay server-rendered.
- **HTML `required`, `type="email"`, `min`, `max` are not optional.** They give native UX before the round-trip. Zod validates after.
- **Never put secrets in `formData`.** It is plain text in the request.
- **One schema per action.** If two actions use the same shape, extract to `lib/schemas/`.
- **`redirect(...)` goes outside `try/catch`**, last. It works by throwing internally.

## Integration with other conventions

- **mutations**: this convention is a specialization of `mutations` for the form case. The schema/`useActionState`/error-shape rules here are additive to `mutations`.
- **error-handling**: validation errors return as values; unexpected errors thrown from inside the Server Action land in the nearest `error.tsx`.
- **data-fetching**: after a successful submit, call `revalidatePath` or `revalidateTag` so the next render sees the new data.
- **styling**: error messages and pending states use the design system tokens (Tailwind utility classes, `cn()` helper).
