---
id: validation
display_name: Validacion de inputs (Zod)
language: node
description: Input validation with Zod
applies_to: [api, worker]
required_by: []
package: zod
---

# Validation (Node)

Validation of external inputs (HTTP body/params/query, queue messages, env vars) with [Zod](https://zod.dev). Schemas separated from domain code.

## When to use

Any service that receives data from outside. APIs and workers both use it. Complementary to `http-server` (invoked per request) and to the queue convention (per message).

## Package

```
zod
```

## Where schemas live

Per domain module:

```
src/domain/users/
├── user.schema.ts        # Zod schemas for the module
├── user.types.ts         # types inferred from schemas
├── user.service.ts
└── ...
```

One `*.schema.ts` file per module. If it grows, split by entity or by operation.

## Pattern

### Define schema

```ts
// src/domain/users/user.schema.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user']).default('user'),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true });
```

### Infer types

```ts
// src/domain/users/user.types.ts
import { z } from 'zod';
import { createUserSchema, updateUserSchema } from './user.schema';

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

Domain types are inferred from schemas. **Do not** define types by hand that duplicate the schema.

### Validate at the system boundary

```ts
import { createUserSchema } from './user.schema';
import { ValidationError } from '@/shared/errors';

function parseCreateUser(input: unknown): CreateUserInput {
  const result = createUserSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError('Invalid input', {
      errors: result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  return result.data;
}
```

- Use `safeParse`, not `parse`. Allows error control.
- Map Zod errors to the `ValidationError` shape defined in `error-handling`.
- The parsing function lives near the schema or in the adapter (controller, worker).

## Rules

- **Never** trust `unknown` data from outside without going through a schema. This includes body, query, params, headers, queue messages, env vars.
- **Schemas are the source of truth** for domain types. If the schema changes, the type changes.
- Zod error messages can be customized per field when needed via `.message()`:
  ```ts
  z.string().email({ message: 'is not a valid email' })
  ```
- Composition over duplication: use `.partial()`, `.omit()`, `.pick()`, `.extend()` instead of redefining similar schemas.
- For outputs (responses), validate **only in tests** or in critical boundaries. Not mandatory on every response.
- For env vars, validate at service startup (see `_base`).

## Integration with other conventions

- `http-server`: validates `body`, `query`, `params` per endpoint using a middleware/wrapper that calls the corresponding schema.
- `error-handling`: Zod errors are translated to `ValidationError` (status 400, code `VALIDATION_ERROR`).
- Worker (future `queue`): validates the message payload before processing.
