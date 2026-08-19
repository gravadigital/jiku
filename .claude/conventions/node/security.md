---
id: security
display_name: Seguridad HTTP (helmet + rate-limit)
language: node
description: HTTP security headers, rate limiting, and CORS configuration for Node APIs
applies_to: [api]
required_by: []
package: helmet
---

# Security HTTP (Node, helmet)

HTTP security hardening for Node APIs with [helmet](https://helmetjs.github.io) (security headers), [express-rate-limit](https://express-rate-limit.mintlify.app) (rate limiting), and explicit CORS configuration. These three together cover the most common HTTP-level attack surface.

## When to use

- Every public-facing Node API.
- Not needed for internal services that are not exposed outside the cluster, but recommended even then.

## Package

```
helmet                  # security headers
express-rate-limit      # rate limiting middleware
cors                    # CORS (or use the http-server convention's built-in if available)
```

## Configuration

```ts
// src/http/security.ts
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { env } from '@/config/env';
import type { Express } from 'express';

export function applySecurityMiddleware(app: Express) {
  // 1. Security headers
  app.use(helmet());

  // 2. CORS — explicit allowlist, not wildcard
  app.use(cors({
    origin: env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // 3. Rate limiting — applied globally; tighten per sensitive route
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,    // 15 min
    max: 100,                     // requests per window per IP
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'TOO_MANY_REQUESTS' },
  }));
}
```

Register before routes in the app factory:

```ts
// src/app.ts
import { applySecurityMiddleware } from './http/security';

export function createApp() {
  const app = express();
  applySecurityMiddleware(app);
  // ... routes
  return app;
}
```

## How to use

### Stricter rate limit for auth endpoints

```ts
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                   // 10 attempts per 15 min
  message: { error: 'TOO_MANY_REQUESTS' },
});

router.post('/auth/login', authLimiter, loginHandler);
router.post('/auth/refresh', authLimiter, refreshHandler);
```

### Content Security Policy customization

helmet's default CSP may break APIs that serve HTML (admin panels, email templates). Adjust per need:

```ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // adjust for your UI
    },
  },
}));
```

For pure JSON APIs with no HTML, the default CSP is fine.

### Input sanitization

Reject oversized payloads at the framework level:

```ts
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
```

Do not rely on application code to catch huge payloads — reject them at the middleware layer.

## Rules

- `helmet()` is always applied with defaults. Only customize when a specific directive breaks legitimate functionality; document the exception.
- CORS `origin` is always an explicit allowlist. Never use `origin: '*'` in production.
- Rate limiting is applied globally at minimum. Sensitive endpoints (auth, password reset, OTP) get a stricter dedicated limiter.
- Payload size limits are set at the framework level (`express.json({ limit: '1mb' })`), not in application code.
- Do not expose stack traces or internal error messages in API responses in production. `error-handling` convention controls the response shape.
- `CORS_ALLOWED_ORIGINS` comes from env. Never hardcode origins.
- HTTPS is enforced at the infrastructure level (load balancer / reverse proxy). The application does not handle TLS directly.

## Integration with other conventions

- **http-server**: security middleware is applied inside the app factory, before route registration.
- **auth-jwt**: rate limiting on auth endpoints is tighter than the global limit.
- **env-config**: `CORS_ALLOWED_ORIGINS` validated at startup.
- **error-handling**: error responses follow the standard shape — no stack leakage in prod.
