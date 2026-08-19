---
id: dockerfile
display_name: Dockerfile (Next.js)
language: nextjs
description: Multi-stage Dockerfile for Next.js apps — test, builder, and production stages with standalone output
applies_to: [frontend]
required_by: []
package: null
---

# Dockerfile (Next.js)

Multi-stage Dockerfile for Next.js applications. Three stages: `test` (for CI lint/test), `builder` (Next.js build), `production` (standalone output, minimal runtime image). Uses Next.js `output: 'standalone'` to produce a self-contained bundle without `node_modules` in the final image.

## When to use

Any Next.js app deployed via Docker.

## Package

```
# No npm package — this is a Docker convention
# Requires: Docker, Node.js base image (node:24-alpine), next.config.ts with output: 'standalone'
```

## Configuration

### next.config.ts (required)

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',   // required for the production Docker stage
};

export default nextConfig;
```

### Dockerfile

```dockerfile
# Dockerfile

# ============================================
# Stage 1: Test (used by CI for lint and tests)
# ============================================
FROM node:24-alpine AS test

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Stage is ready — CI runs lint, type-check, and unit tests against this stage

# ============================================
# Stage 2: Builder (Next.js build)
# ============================================
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build-time env vars (public only — NEXT_PUBLIC_*)
# Pass secrets at runtime, not at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ============================================
# Stage 3: Production (standalone output)
# ============================================
FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Copy standalone output (includes server.js + minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "server.js"]
```

## How to use

### Health check endpoint

The `HEALTHCHECK` hits `GET /api/health`. Add a Route Handler:

```ts
// src/app/api/health/route.ts
export function GET() {
  return Response.json({ status: 'ok' });
}
```

### Build-time vs runtime env vars

- **`NEXT_PUBLIC_*` variables** are baked into the JS bundle at build time. Pass them as `ARG`/`ENV` in the `builder` stage.
- **Server-only variables** (`DATABASE_URL`, secrets) are injected at runtime. Never pass them as build args — they would be visible in the image layers.

```bash
# Build with public env vars
docker build \
  --target production \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  -t {service}:local .

# Run with runtime secrets
docker run \
  -e DATABASE_URL=postgres://... \
  -e AUTH_SECRET=... \
  -p 3000:3000 \
  {service}:local
```

### Building locally

```bash
# Build production image
docker build --target production -t {service}:local .

# Build test image (same as CI)
docker build --target test -t {service}:ci-test .
```

## Rules

- `output: 'standalone'` must be set in `next.config.ts`. Without it the production stage does not work.
- Never copy `node_modules` into the production stage — the standalone output includes only what is needed.
- `NEXT_PUBLIC_*` vars are build-time only. Pass them as `ARG` in the `builder` stage. All other env vars are runtime.
- Never bake secrets into the image at build time. Secrets come from the runtime environment.
- The production stage runs as a non-root user (`nextjs`).
- The `GET /api/health` endpoint must exist and return `200` with no auth.
- Static assets (`public/` and `.next/static/`) are served by the standalone server — no separate nginx needed for basic deployments.

## Integration with other conventions

- **ci-gitlab**: the CI pipeline builds `--target test` for lint/test and `--target production` for release.
- **env-config**: server-only vars are validated at startup via `@t3-oss/env-core`. `NEXT_PUBLIC_*` vars are validated client-side in the same config.
- **api-routes**: `GET /api/health` is a Route Handler required by the `HEALTHCHECK`.
