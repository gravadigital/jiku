---
id: http-server
display_name: Servidor HTTP (chi)
language: golang
description: HTTP server, routing, middleware for REST APIs
applies_to: [api]
required_by: []
package: github.com/go-chi/chi/v5
---

# HTTP Server (Go, chi)

HTTP server for services exposing a REST API. Default: [chi](https://github.com/go-chi/chi) — a thin router over the standard `net/http`, with idiomatic middleware and zero magic. The standard library `net/http.ServeMux` (Go 1.22+ routing) is a valid no-dependency variant; the rules below still apply.

## When to use

Services of type `api`. Workers that only consume messages do not use this (they may expose a minimal `/health` without the router). Services whose transport is a message bus use `messaging` instead.

## Package

```
github.com/go-chi/chi/v5            # router
github.com/go-chi/chi/v5/middleware # request-id, recoverer, etc.
```

## Structure

```
internal/
├── http/
│   ├── server.go              # builds the *http.Server + router
│   ├── middleware/
│   │   ├── request_context.go # requestId + child logger into ctx
│   │   └── recoverer.go       # panic -> 500 (or chi's middleware.Recoverer)
│   └── routes.go              # mounts each module's routes
└── {module}/
    ├── handler.go             # HTTP handlers (parse, call service, write response)
    ├── service.go             # business logic
    └── {module}.go            # domain types
```

Each module exposes its routes; `internal/http/routes.go` mounts them under a prefix.

## Base configuration

```go
// internal/http/server.go
package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
)

func NewServer(addr string, log *zerolog.Logger, mount func(r chi.Router)) *http.Server {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(requestContext(log)) // child logger with requestId into ctx
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	mount(r)

	return &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}
```

## Routing

One `routes` function per module, mounted centrally:

```go
// internal/order/handler.go
func (h *Handler) Routes(r chi.Router) {
	r.Post("/orders", h.create)
	r.Get("/orders/{id}", h.getByID)
	r.Patch("/orders/{id}", h.update)
	r.Delete("/orders/{id}", h.delete)
}

// internal/http/routes.go
func Mount(orderH *order.Handler) func(chi.Router) {
	return func(r chi.Router) {
		r.Route("/api/v1", func(r chi.Router) {
			orderH.Routes(r)
		})
	}
}
```

## Handlers

A handler only **decodes input, calls the service, writes the response**. No business logic, no direct DB access.

```go
// internal/order/handler.go
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in CreateOrderInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, r, errs.NewValidation("invalid body", nil))
		return
	}

	order, err := h.svc.Create(r.Context(), in)
	if err != nil {
		writeError(w, r, err) // mapped per error-handling convention
		return
	}

	writeJSON(w, http.StatusCreated, order)
}
```

`writeError` translates a domain error to the canonical shape and status (see `error-handling`); `writeJSON` is a small shared helper.

## REST conventions

| Operation | Method | Path | Success |
|---|---|---|---|
| List | GET | `/orders` | 200 |
| Get | GET | `/orders/{id}` | 200 |
| Create | POST | `/orders` | 201 |
| Partial update | PATCH | `/orders/{id}` | 200 |
| Replace | PUT | `/orders/{id}` | 200 |
| Delete | DELETE | `/orders/{id}` | 204 |

- Resources in **plural, kebab-case** (`/order-items`). No verbs in paths; exceptional actions as sub-resources (`POST /orders/{id}/cancel`).
- Path versioning `/api/v1/...` when the API is external.
- Query params in `camelCase`: `?pageSize=20&sortBy=createdAt`.

## Request context

A middleware injects a request-scoped child logger carrying `requestId`. Handlers and services log through `zerolog.Ctx(ctx)` (see `logging`), never the global logger, so every line keeps the `requestId`.

## Rules

- One route maps to one handler method. No nested logic in the router.
- Handlers do not access the DB or external APIs directly; they call the module's service.
- Every endpoint that receives external input **validates** it (see `validation`). No unvalidated endpoints.
- Status codes per the table. Never `200` with an `{"error": ...}` body — errors carry their own status.
- The resource is returned directly (no `{"data": ...}` envelope). Errors use the `{"error": ...}` envelope from `error-handling`.
- Always set server timeouts (`ReadHeaderTimeout` at minimum). Never run an unbounded handler; long work goes to `messaging`/a worker.
- `GET /health` is unauthenticated and cheap (liveness). Add `GET /health/ready` when readiness must check dependencies.

## Framework variants

The standard library `net/http` with `ServeMux` (Go 1.22 method+wildcard routing) is acceptable for small services — it removes the dependency at the cost of writing middleware by hand. Heavier frameworks (Echo, Gin, Fiber) are allowed when justified. In every variant the rules above (routing, status, validation, error shape, timeouts) still apply; document the choice in the service `overview.md`.

## Integration with other conventions

- **validation**: handlers validate `body`/`query`/`path` before calling the service.
- **error-handling**: `writeError` maps domain errors to the canonical response and status.
- **logging**: the request-context middleware creates the child logger used by handlers.
- **observability**: the same middleware starts the request span when tracing is active.
