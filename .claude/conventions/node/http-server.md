---
id: http-server
display_name: Servidor HTTP (Fastify)
language: node
description: HTTP server, routing, middlewares
applies_to: [api]
required_by: []
package: fastify
---

# HTTP Server (Node)

HTTP server for services exposing a REST API. Default: [Fastify](https://fastify.dev), chosen for performance, typing, and plugin ecosystem.

## When to use

Services of type `api`. Workers that do not expose HTTP do not use this (they can expose a simple `/health` without this convention).

## Package

```
fastify
@fastify/cors
@fastify/helmet
```

## Structure

```
src/
├── http/
│   ├── server.ts                # creates and configures the fastify instance
│   ├── middleware/
│   │   ├── request-context.ts   # requestId + child logger
│   │   └── error-handler.ts     # global handler
│   └── routes/
│       └── index.ts             # registers routes (delegates to each module)
├── domain/
│   └── users/
│       ├── user.routes.ts       # module endpoints
│       ├── user.controller.ts   # handlers
│       ├── user.schema.ts       # validation (see validation convention)
│       └── user.service.ts      # logic
└── index.ts                     # bootstrap
```

Each domain module exposes its `*.routes.ts` file. `http/routes/index.ts` registers all of them.

## Base configuration

```ts
// src/http/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { logger } from '@/shared/logger';
import { requestContext } from './middleware/request-context';
import { errorHandler } from './middleware/error-handler';
import { registerRoutes } from './routes';

export async function buildServer() {
  const app = Fastify({
    loggerInstance: logger,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
  });

  await app.register(helmet);
  await app.register(cors, { origin: true, credentials: true });

  app.addHook('onRequest', requestContext);
  app.setErrorHandler(errorHandler);

  await registerRoutes(app);

  return app;
}
```

## Routing

One `*.routes.ts` file per module:

```ts
// src/domain/users/user.routes.ts
import { FastifyInstance } from 'fastify';
import { userController } from './user.controller';

export async function userRoutes(app: FastifyInstance) {
  app.post('/users', userController.create);
  app.get('/users/:id', userController.getById);
  app.patch('/users/:id', userController.update);
  app.delete('/users/:id', userController.delete);
}
```

Centralized registration:

```ts
// src/http/routes/index.ts
import { FastifyInstance } from 'fastify';
import { userRoutes } from '@/domain/users/user.routes';

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(userRoutes, { prefix: '/api' });
}
```

## Controllers

One controller per module. Its only responsibility: **parse input, call the service, format output**. No business logic.

```ts
// src/domain/users/user.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { createUserSchema } from './user.schema';
import { userService } from './user.service';
import { ValidationError } from '@/shared/errors';

export const userController = {
  async create(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', {
        errors: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }

    const user = await userService.create(parsed.data);
    return reply.code(201).send(user);
  },

  async getById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = await userService.getById(req.params.id);
    return reply.send(user);
  },
};
```

## REST conventions

| Operation | Method | Path | Success status |
|---|---|---|---|
| List | GET | `/users` | 200 |
| Get | GET | `/users/:id` | 200 |
| Create | POST | `/users` | 201 |
| Partial update | PATCH | `/users/:id` | 200 |
| Replace | PUT | `/users/:id` | 200 |
| Delete | DELETE | `/users/:id` | 204 |

- Resources in **plural**, **kebab-case** (`/order-items`, not `/orderItems` nor `/order_items`).
- No verbs in paths. Exceptional actions: sub-resource (`POST /orders/:id/cancel`).
- Path versioning: `/api/v1/...` when applicable.
- Query params in `camelCase`: `?pageSize=20&sortBy=createdAt`.

## Request context (logger + requestId)

Hook that creates a child logger per request:

```ts
// src/http/middleware/request-context.ts
import { FastifyRequest } from 'fastify';

export async function requestContext(req: FastifyRequest) {
  req.log = req.log.child({
    requestId: req.id,
    userId: undefined,  // set from auth when active
  });
}
```

Any log inside a handler must use `req.log` (not the global logger), to keep the `requestId`.

## Global error handler

Implements what is described in `error-handling`:

```ts
// src/http/middleware/error-handler.ts
import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '@/shared/errors';

export function errorHandler(
  err: FastifyError | Error,
  req: FastifyRequest,
  reply: FastifyReply
) {
  if (err instanceof AppError) {
    req.log.warn({ err, code: err.code }, 'Application error');
    return reply.code(err.httpStatus).send({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  req.log.error({ err }, 'Unexpected error');
  return reply.code(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}
```

## Health check

Every service exposes `GET /health` without auth, returning 200 if the service can accept requests. If it must check dependencies (DB, Redis), expose `GET /health/ready` for readiness and keep `/health` as a lightweight liveness check.

## Rules

- **One route = one controller**. No nested logic.
- Controllers **do not access DB** or external APIs directly. They call the module's `service`.
- Every endpoint that receives external input **validates** with Zod (see `validation`). No endpoints are "open" without validation.
- Status codes per table. **Do not** return 200 with `{ error: ... }` inside. Errors have their status.
- Responses **without generic envelope** (`{ data: ... }`). The resource is returned directly. Errors have an envelope (`{ error: ... }`) per `error-handling`.
- Pagination: query params `pageSize`, `cursor` (cursor-based preferred) or `page` (offset). Response includes `nextCursor` or `totalPages` accordingly.
- CORS and Helmet enabled by default. If relaxed, document the reason in the service's `overview.md`.
- No handler may take longer than `30s`. Long operations go to the queue convention.

## Framework variants

If the service justifies a different framework (NestJS for strong DI, Express for legacy integration), the rules for routing, status, validation, and errors **still apply**. Only the "how" of setup changes. Document the reason for the variant in `overview.md`.
