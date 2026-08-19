---
id: dockerfile
display_name: Dockerfile (Go)
language: golang
description: Multi-stage build producing a small, non-root, static image
applies_to: [api, worker, cli]
required_by: []
package: null
---

# Dockerfile (Go)

Multi-stage build: compile a static binary in a builder stage, then copy it into a minimal runtime image (distroless or scratch). The result is a small, non-root container with no toolchain or shell.

## When to use

Every deployable Go service (`api`, `worker`) and distributed CLIs. Libraries are not containerized.

## Dockerfile

```dockerfile
# --- builder ---
FROM golang:1.23-alpine AS builder
WORKDIR /src

# Cache modules first
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Static, stripped binary
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath -ldflags="-s -w" \
    -o /out/app ./cmd/{service}

# --- runtime ---
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/app /app/app
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/app"]
```

For a CLI or when an even smaller image is required, `FROM scratch` works for a fully static binary (copy CA certs if the app makes TLS calls).

## Rules

- Multi-stage build. The final image contains **only** the binary (+ CA certs if needed), no Go toolchain, no source, no shell.
- `CGO_ENABLED=0` for a static binary (unless a cgo dependency is required and documented).
- Build with `-trimpath -ldflags="-s -w"` to strip paths and debug info.
- Copy `go.mod`/`go.sum` and `go mod download` **before** the source, to cache dependencies across builds.
- Runtime image is **non-root** (`distroless ...:nonroot` or an explicit `USER`). Never run as root.
- Pin base image tags (`golang:1.23-alpine`, `distroless/static-debian12`). No `latest`.
- A `.dockerignore` excludes `.git`, local `.env`, build artifacts, and tests from the context.
- One process per container; configuration via env (see `config`), logs to stdout (see `logging`).

## Integration with other conventions

- **config**: all runtime configuration is injected via environment variables.
- **ci-gitlab**: the pipeline builds and pushes this image in the release stage.
