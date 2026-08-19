---
id: error-handling
display_name: Manejo de errores
language: node
description: Error modeling, propagation, and canonical error shape
applies_to: [api, worker]
required_by: [http-server, validation, auth-jwt]
package: null
---

# Error Handling (Node)

Defines how errors are modeled, propagated, and translated. Auto-included when `http-server`, `validation`, or `auth-jwt` are active, because they all need to agree on a common shape.

## When to use

Any Node service that exposes an interface to the outside (API, worker that consumes messages). Does not apply directly to `cli` / `library`.

## Error hierarchy

A base class plus specific classes per problem type:

```ts
// src/shared/errors/base.ts
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}
```

```ts
// src/shared/errors/index.ts
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 400;
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly httpStatus = 404;
}

export class UnauthorizedError extends AppError {
  readonly code = 'UNAUTHORIZED';
  readonly httpStatus = 401;
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN';
  readonly httpStatus = 403;
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
  readonly httpStatus = 409;
}
```

## When to use each one

| Error | When |
|---|---|
| `ValidationError` | Invalid input (structure, types, domain rules). |
| `NotFoundError` | Requested resource does not exist. |
| `UnauthorizedError` | No credentials or invalid credentials. |
| `ForbiddenError` | Valid credentials but no permission for this action. |
| `ConflictError` | Resource state prevents the operation (duplicate, already processed, etc.). |

For errors not covered, create a new class. Never throw plain `Error` from domain code.

## Canonical error shape (response to client)

Any error response from the system follows this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is not valid",
    "details": {
      "field": "email",
      "value": "foo@"
    }
  }
}
```

- `code`: string in `SCREAMING_SNAKE_CASE`, stable, part of the public contract.
- `message`: human-readable, no sensitive info.
- `details`: optional, free-form. Only info useful to the client. **Never** stack traces, SQL queries, internal paths.

For validations with multiple errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": [
        { "field": "email", "message": "is not valid" },
        { "field": "age", "message": "must be greater than 18" }
      ]
    }
  }
}
```

> Note: the `message` field is human-readable text. The application can localize it (e.g., Spanish for end users) — the convention only requires consistency and absence of sensitive info, not a specific language.

## Translation at the system boundary

Conventions that expose an interface (`http-server`, workers, etc.) implement a **global handler** that:

1. Catches all exceptions.
2. If it is an `AppError`: translates to a response using `code`, `httpStatus`, `message`, `details`.
3. If it is not an `AppError`: responds with shape `INTERNAL_ERROR` / status 500, generic message ("Internal error"). The real error is logged but **not exposed**.
4. Logs the error following the `logging` convention (with stack for internal errors, without stack for expected `AppError`s).

## Rules

- Always throw specific errors. Never `throw new Error("...")` in domain code.
- The `code` values are **part of the public contract**. Changing one is a breaking change.
- Do not include sensitive information in `message` or `details` (passwords, tokens, other users' data, internals).
- 5xx errors are never rethrown or mapped to 4xx to "hide bugs". They are logged and a 500 is returned.
- Each error has **one canonical place** where it is thrown. If the same error can arise in N places, extract a helper.
