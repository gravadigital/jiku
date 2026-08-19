---
id: env-config
display_name: Configuración de entorno (@t3-oss/env-core)
language: node
description: Type-safe environment variable validation at startup using @t3-oss/env-core and Zod
applies_to: [api, worker, cli]
required_by: []
package: "@t3-oss/env-core"
---

# Environment Config (Node, @t3-oss/env-core)

Type-safe environment variable validation at startup with [@t3-oss/env-core](https://env.t3.gg) and [Zod](https://zod.dev). The service fails fast at boot if required variables are missing or malformed — no silent `undefined` at runtime.

## When to use

- Every Node service that reads from `process.env`.
- APIs, workers, and CLIs alike.

## Package

```
@t3-oss/env-core     # env validation
zod                  # schema (also used by validation convention)
```

## Configuration

```ts
// src/config/env.ts
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
  },
  runtimeEnv: process.env,
  emitErrors: true,        // throws at startup if validation fails
});
```

## How to use

### Access env values

```ts
import { env } from '@/config/env';

const port = env.PORT;           // number (not string)
const dbUrl = env.DATABASE_URL;  // string, guaranteed to be a URL
```

Never access `process.env` directly outside of `src/config/env.ts`. All other files import `env`.

### Required vs optional variables

```ts
server: {
  REDIS_URL: z.string().url().optional(),           // optional — feature may be disabled
  SMTP_HOST: z.string().optional().default(''),     // optional with default
  API_KEY: z.string().min(1),                       // required — throws if missing
}
```

### Coercion

Env values are always strings. Use `z.coerce.number()`, `z.coerce.boolean()`, etc. to convert:

```ts
PORT: z.coerce.number().default(3000),
DRY_RUN: z.coerce.boolean().default(false),
MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
```

### Env files

The service uses four env files with the following priority (later overrides earlier):

| File | Committed | Purpose |
|---|---|---|
| `.env.defaults` | Yes | Baseline values safe for all environments (non-secret defaults) |
| `.env.dev` | Yes | Non-secret values for the `dev` environment |
| `.env.prod` | Yes | Non-secret values for the `prod` environment |
| `.env.local` | No (gitignored) | Local overrides per developer |
| `.env.test` | No (gitignored) | Values for the test environment |

`.env.dev` and `.env.prod` contain only non-secret configuration (URLs, feature flags, timeouts). Secrets (`DATABASE_URL`, `JWT_SECRET`, etc.) are never committed — they come from the runtime environment (CI/CD variables, secrets manager).

The CI pipeline loads `.env.dev` or `.env.prod` depending on the branch. Locally, developers copy `.env.dev` or use `.env.local` for overrides.

```ts
// src/index.ts (entry point)
import 'dotenv/config';     // loads .env.local → .env by default
import { env } from '@/config/env';
import { createServer } from './server';

createServer().listen(env.PORT);
```

For tests, load `.env.test`:

```ts
// vitest.config.ts
import { config } from 'dotenv';
config({ path: '.env.test' });
```

### Example env files

```bash
# .env.defaults
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

```bash
# .env.dev
API_URL=https://api-dev.example.com
FEATURE_NEW_UI=true
```

```bash
# .env.prod
API_URL=https://api.example.com
FEATURE_NEW_UI=false
```

```bash
# .env.example  (documents all required variables — no real values)
DATABASE_URL=          # required — postgres connection string
JWT_SECRET=            # required — min 32 chars
API_URL=               # required — backend API base URL
```

## Rules

- Never call `process.env.VAR` outside of `src/config/env.ts`. Import `env` everywhere else.
- All variables must be declared and validated in `env.ts`. No undeclared variables.
- Sensitive variables (secrets, keys) get a minimum length constraint (at least `z.string().min(1)`).
- Cast numeric and boolean variables with `z.coerce` — they arrive as strings from the environment.
- The service must fail at startup (not at first use) if a required variable is missing. Keep `emitErrors: true`.
- `.env.dev` and `.env.prod` are committed — they contain only non-secret values.
- Secrets are never committed. They come from the runtime environment.
- Commit `.env.example` listing all required variables with empty values and a short comment.
- `.env.local` and `.env.test` are gitignored.

## Integration with other conventions

- **orm**: `DATABASE_URL` declared and validated here.
- **auth-jwt**: `JWT_SECRET`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE` validated here.
- **logging**: `LOG_LEVEL` declared here, consumed by the logger.
- **cache**: `REDIS_URL` validated here.
- **queue**: `REDIS_URL` shared with cache, or a separate `QUEUE_REDIS_URL` if isolation is needed.
