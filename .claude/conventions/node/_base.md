---
id: _base
display_name: Convenciones generales
language: node
description: Base conventions for any Node service (always active)
applies_to: [api, worker, cli, library]
required_by: []
package: typescript
---

# Base Conventions (Node)

This convention is **always included** when the service uses Node. It defines what does not vary across service types: base language, naming, minimal structure.

## TypeScript

- TypeScript is mandatory. Plain JavaScript is not used in new code.
- `tsconfig.json` with `strict: true`. No exceptions per service.
- `noUncheckedIndexedAccess: true` enabled.
- `target: ES2022` or higher.
- No `any` except in boundaries with untyped libraries. When used, comment the reason.

## Naming

| Element | Convention | Example |
|---|---|---|
| Files | `kebab-case` | `user-service.ts`, `auth-middleware.ts` |
| Folders | `kebab-case` | `domain/users/`, `infra/database/` |
| Classes | `PascalCase` | `UserService`, `AuthMiddleware` |
| Functions, variables | `camelCase` | `getUserById`, `currentUser` |
| Global constants | `SCREAMING_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Types / interfaces | `PascalCase`, no `I` prefix | `User`, `CreateUserInput` |
| Enums | `PascalCase` for name, `SCREAMING_SNAKE_CASE` for values | `enum Role { ADMIN, USER }` |

## Dates

- At all **system boundaries** (HTTP, DB, events, logs) dates are **ISO 8601 UTC**: `2025-03-15T10:30:00.000Z`.
- In memory, work with `Date` objects or types from the chosen package. Never strings without a defined format.
- Never assume the server timezone. Timestamps are always absolute (UTC).

## Minimal project structure

```
{service}/
├── src/
│   ├── index.ts                 # Entry point
│   ├── config/                  # Configuration: env vars, constants
│   ├── domain/                  # Business logic by module
│   │   └── {module}/
│   ├── infra/                   # Adapters: db, http clients, externals
│   └── shared/                  # Cross-cutting utilities (logger, errors, etc.)
├── test/                        # Tests (if not colocated with code)
├── package.json
├── tsconfig.json
└── README.md
```

Specific conventions (http-server, queue, etc.) may add additional folders (`http/`, `workers/`, etc.). The business-module structure (`domain/{module}/`) is mandatory.

## Imports

- **Absolute imports** from `src/` using `tsconfig` paths (`@/domain/users/...`). No `../../../`.
- **Order** within a file:
  1. External libraries (`node:*`, npm)
  2. Absolute imports from this project (`@/...`)
  3. Relative imports from the same module (`./...`)
- Separate groups with a blank line.

## Environment variables

- All env vars are loaded and validated in **one place** (`src/config/env.ts`).
- Validation at startup (fail fast). The rest of the code consumes the typed object, not `process.env`.
- Sensitive variables are never logged (see `logging`).

## Errors as values vs. exceptions

- **Expected business errors** (validation, not found, unauthorized): modeled with specific error classes and thrown with `throw`. The `error-handling` convention defines how they translate at the system boundary.
- **Unexpected errors**: allowed to propagate up to the global handler.
- `Result<T, E>` types are not used except in specific cases where they add clarity.

## Async / Promises

- `async/await` over `.then()`.
- Unhandled promises are an error. No `await` may be missing in a critical flow.
- For parallelism: `Promise.all` when errors are fatal, `Promise.allSettled` when everything must complete.

## Comments

- Default: no comments. Clear names explain the code.
- Comment **only the why** when it is not obvious (workaround, external constraint, surprising decision).
- No `// TODO` without an associated issue.
