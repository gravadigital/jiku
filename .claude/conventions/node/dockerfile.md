---
id: dockerfile
display_name: Dockerfile (Node)
language: node
description: Multi-stage Dockerfile for Node.js services — test, builder, and production stages
applies_to: [api, worker, cli]
required_by: []
package: null
---

# Dockerfile (Node)

Multi-stage Dockerfile for Node.js (TypeScript) services. Three stages: `test` (for CI lint/test), `builder` (TypeScript compilation), `production` (minimal runtime image). The CI pipeline uses the `test` stage; deployments use `production`.

## When to use

Any Node service that is containerized. This covers APIs, workers, and CLIs deployed via Docker.

## Package

```
# No npm package — this is a Docker convention
# Requires: Docker, Node.js base image (node:24-alpine)
```

## Configuration

```dockerfile
# Dockerfile

# ============================================
# Stage 1: Test (used by CI for lint and tests)
# ============================================
FROM node:24-alpine AS test

WORKDIR /app

# Native module compilation dependencies
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

# Stage is ready — CI runs lint and tests against this stage

# ============================================
# Stage 2: Builder (TypeScript compilation)
# ============================================
FROM node:24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ============================================
# Stage 3: Production (minimal runtime image)
# ============================================
FROM node:24-alpine AS production

WORKDIR /app

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S app -u 1001 -G nodejs

# Copy compiled output and default env
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.env.defaults ./

COPY package*.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force

# HTTP APIs: expose port and add healthcheck
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

USER app

CMD ["npm", "run", "start"]
```

## How to use

### Adapting per service type

**API (exposes HTTP):** keep `EXPOSE` and `HEALTHCHECK` as shown above.

**Worker (no HTTP):** remove `EXPOSE` and replace `HEALTHCHECK` with a process check:

```dockerfile
# No EXPOSE — worker does not serve HTTP
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "process.exit(0)"  # replace with a real liveness check if available
```

**Extra files at runtime** (e.g., DB migrations folder):

```dockerfile
# Copy migration files needed at runtime
COPY --from=builder /app/src/db ./src/db
```

### Non-root user name

Name the user after the service for clarity:

```dockerfile
RUN addgroup -g 1001 -S nodejs && \
    adduser -S {service-name} -u 1001 -G nodejs
```

### Building locally

```bash
# Build production image
docker build --target production -t {service-name}:local .

# Build test image (same as CI)
docker build --target test -t {service-name}:ci-test .
```

## Rules

- Always use multi-stage builds. Never ship dev dependencies or source TypeScript in the production image.
- Always run as a non-root user in the `production` stage.
- `npm ci --omit=dev` in production — never `npm install`.
- `npm cache clean --force` after install to reduce image size.
- `apk add python3 make g++` is required only when the service has native modules (e.g., `bcrypt`, `sharp`). Remove it if not needed.
- The `test` stage installs all dependencies (including devDependencies) so lint and tests can run.
- `.env.defaults` is copied into the production image as the baseline config. Secrets come from environment variables at runtime — never baked into the image.
- The `HEALTHCHECK` in APIs hits `GET /health`. That endpoint must exist and return `200` with no auth required.
- Workers that have no HTTP endpoint must define an alternative liveness check.

## Integration with other conventions

- **ci-gitlab**: the CI pipeline builds `--target test` for lint/test stages and `--target production` for release. The Dockerfile stages map directly to CI stages.
- **env-config**: `.env.defaults` provides baseline values. Real secrets are injected at runtime via environment variables, never in the image.
- **http-server**: the `GET /health` endpoint required by `HEALTHCHECK` is defined in the HTTP server convention.
