---
id: auth-jwt
display_name: Autenticación JWT (jose)
language: node
description: JWT-based authentication using the jose library (access + refresh token pattern)
applies_to: [api]
required_by: []
package: jose
---

# Authentication JWT (Node, jose)

JWT creation and verification with [jose](https://github.com/panva/jose). Supports RS256/ES256 (asymmetric) and HS256 (symmetric) signing, JWKS endpoint consumption, and the standard access + refresh token pattern. Framework-agnostic — works with any HTTP server.

## When to use

- APIs that issue or verify JWT access tokens.
- Services that act as resource servers and validate tokens issued by a separate auth service.
- Not needed in workers or CLIs that do not authenticate external callers.

## Package

```
jose                # JWT / JWK / JWKS — runtime
```

## Structure

```
src/
├── auth/
│   ├── jwt.ts          # sign / verify helpers
│   ├── jwks.ts         # JWKS remote key fetching (if acting as resource server)
│   └── middleware.ts   # HTTP middleware that attaches user to request context
```

## Configuration

### Symmetric (HS256) — simple services

```ts
// src/auth/jwt.ts
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '@/config/env';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface TokenPayload extends JWTPayload {
  sub: string;     // user id
  role: string;
}

export async function signAccessToken(payload: Omit<TokenPayload, keyof JWTPayload>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify<TokenPayload>(token, secret);
  return payload;
}
```

### Asymmetric with JWKS (resource server)

```ts
// src/auth/jwks.ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { env } from '@/config/env';

const JWKS = createRemoteJWKSet(new URL(env.AUTH_JWKS_URL));

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: env.AUTH_ISSUER,
    audience: env.AUTH_AUDIENCE,
  });
  return payload;
}
```

## How to use

### Access + refresh token flow

```ts
// src/auth/jwt.ts (continued)
export async function signRefreshToken(sub: string): Promise<string> {
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}
```

- Access tokens: short-lived (15 min). Sent in `Authorization: Bearer <token>`.
- Refresh tokens: long-lived (7 days). Sent via `httpOnly` cookie or secure endpoint.
- Refresh tokens are stored server-side (DB or Redis) and invalidated on use (rotation).

### HTTP middleware

```ts
// src/auth/middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './jwt';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  try {
    const payload = await verifyAccessToken(header.slice(7));
    req.user = { id: payload.sub!, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}
```

### Optional authorization (role check)

```ts
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    next();
  };
}
```

## Rules

- Never use `jsonwebtoken` (sync crypto, callback API). Use `jose` exclusively.
- Never store JWTs in `localStorage`. Access tokens in memory; refresh tokens in `httpOnly` cookies.
- Always validate `exp`, `iss`, and `aud` claims. Pass them as options to `jwtVerify`.
- Refresh tokens must be rotated on use. Old token is invalidated immediately after issuing a new one.
- Do not put sensitive data in the JWT payload — it is only base64-encoded, not encrypted.
- Secret keys come from `env` — never hardcoded strings.
- In tests: sign tokens with a test secret defined in the test env. Do not skip verification.

## Integration with other conventions

- **http-server**: `authenticate` middleware registered per route or globally.
- **error-handling**: `JWTExpired` and `JOSEError` are caught by the global handler and translated to 401.
- **env-config**: `JWT_SECRET`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE` are validated at startup.
- **cache**: refresh token rotation state may be stored in Redis (ioredis).
