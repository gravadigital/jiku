---
id: logging
display_name: Logging estructurado (Pino)
language: node
description: Structured logging with Pino
applies_to: [api, worker, cli]
required_by: []
package: pino
---

# Logging (Node)

Structured JSON logging with [Pino](https://getpino.io). A single shared logger for the whole service.

## When to use

Any Node service that needs observability: APIs, workers, long-running CLIs. May not apply to short interactive CLIs.

## Package

```
pino                # runtime
pino-pretty         # dev only, for readable output
```

## Configuration

```ts
// src/shared/logger.ts
import pino from 'pino';
import { env } from '@/config/env';

export const logger = pino({
  level: env.LOG_LEVEL ?? 'info',
  base: {
    service: env.SERVICE_NAME,
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.refreshToken',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

## How to use

### Global logger

```ts
import { logger } from '@/shared/logger';

logger.info({ userId: user.id }, 'User created');
logger.warn({ retryCount }, 'Retrying operation');
logger.error({ err, orderId }, 'Order processing failed');
```

### Child loggers (per request / job context)

Create a child logger per request, job, or flow, with context included in all subsequent logs:

```ts
const reqLogger = logger.child({ requestId, userId });
reqLogger.info('Processing request');
// → { service, env, requestId, userId, msg: 'Processing request', ... }
```

In APIs, `http-server` attaches a child logger per request automatically.

## Levels

| Level | When |
|---|---|
| `trace` | Very fine-grained, off by default. |
| `debug` | Debug information, off in prod. |
| `info` | Normal system events (request received, job processed, etc.). |
| `warn` | Something unexpected but recoverable (retry, fallback). |
| `error` | Error that broke an operation. |
| `fatal` | The service cannot continue. |

Default in prod: `info`. Default in dev: `debug`.

## Log structure

Always:

```ts
logger.info({ context }, 'message');
//          ^^^^^^^^^^   ^^^^^^^^^
//          plain object  fixed string
```

- **First argument**: object with context. Fields do not vary across calls of the same log.
- **Second argument**: short and **static** message. No variable interpolation (that goes in the object).

Bad:
```ts
logger.info(`User ${userId} created in ${ms}ms`);  // variable message
```

Good:
```ts
logger.info({ userId, durationMs: ms }, 'User created');
```

## Errors

```ts
try {
  await processOrder(orderId);
} catch (err) {
  logger.error({ err, orderId }, 'Order processing failed');
  throw err;
}
```

- Pino serializes `err` automatically with stack included (when it is an `Error`).
- **Expected errors** (`AppError` from `error-handling`): log with `warn` or `info`, without stack. They are part of the flow.
- **Unexpected errors**: log with `error`, with full stack.

## Rules

- One logger per service. No multiple instances with different configs.
- Never log: passwords, tokens, API keys, session cookies, request bodies with PII. Trust `redact` and also **do not include them explicitly**.
- Do not log large response contents (may contain PII and saturates).
- In APIs: each request has a `requestId` included in all logs of that request (via child logger).
- Messages are short, descriptive, static. No emojis. No dynamic info in the string.
- In tests: silence logs or use a test transport. Do not pollute CI output.

## Consumption by other conventions

- `http-server`: uses the logger for request/response logs and to attach to `req`.
- `error-handling`: uses the logger in the global handler.
- `queue`: child logger per job (`{ jobId, jobName }`).
