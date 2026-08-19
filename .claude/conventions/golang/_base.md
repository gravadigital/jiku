---
id: _base
display_name: Convenciones generales
language: golang
description: Base conventions for any Go service (always active)
applies_to: [api, worker, cli, library]
required_by: []
package: go
---

# Base Conventions (Go)

This convention is **always included** when the service uses Go. It defines what does not vary across service types: language baseline, naming, project layout, error philosophy, context and concurrency.

## Go baseline

- Latest stable Go (`go 1.23+`). Pin the version in `go.mod` and CI.
- Code is formatted with **`gofumpt`** (superset of `gofmt`). Unformatted code does not merge.
- A single module per repository (`go.mod` at the root). Multi-module repos only with a documented reason.
- No global mutable state. Dependencies are passed explicitly (see `## Dependency wiring`). The only acceptable package-level vars are immutable constants and sentinel errors.
- Accept interfaces, return structs. Define interfaces where they are **consumed**, not where they are implemented.

## Naming

| Element | Convention | Example |
|---|---|---|
| Packages | short, lowercase, single word, no plural, no `under_score` | `order`, `session`, `pairing` |
| Files | lowercase, one responsibility per file | `store.go`, `consumer.go`, `reconnect.go` |
| Test files | `*_test.go`, package `{pkg}_test` for black-box | `store_test.go` |
| Exported identifiers | `MixedCaps` | `NewStore`, `OrderStore` |
| Unexported identifiers | `mixedCaps` | `makeKey`, `defaultTimeout` |
| Interfaces | `PascalCase`, no `I` prefix, named by behavior | `Store`, `ConfigRetriever`, `Reader` |
| Constants | `MixedCaps` (NOT `SCREAMING_SNAKE`) | `MaxRetries`, `defaultTimeout` |
| Sentinel errors | `Err` prefix | `ErrNotFound`, `ErrAlreadyExists` |
| Structs implementing an interface | concrete name, **no** `Impl` suffix | `KVStore` implements `Store` |

- Acronyms keep their case: `HTTPServer`, `orderID`, `URL` (not `Url`, `HttpServer`).
- Receivers are short (1-2 letters), consistent per type: `func (s *KVStore) ...`.

## Project structure

```
{service}/
├── cmd/
│   └── {service}/
│       ├── main.go           # entry: signals, config load, wiring, run
│       └── config.go         # Config struct (env tags) + defaults
├── internal/                 # all non-public code; not importable from outside
│   ├── {module}/             # one package per domain capability (orders, sessions, ...)
│   │   ├── {module}.go       # domain types + business logic
│   │   ├── store.go          # port interface + adapter (or split into adapters)
│   │   └── *_test.go
│   ├── config/               # configuration loading/merging
│   └── shared/               # cross-cutting helpers (logger, errors) — keep thin
├── config/                   # config files / templates
├── deploy/                   # docker-compose, k8s manifests
├── Dockerfile
├── Makefile
├── go.mod
└── README.md
```

- **`cmd/{service}/`**: entry point and dependency wiring only. No business logic.
- **`internal/{module}/`**: the domain is organized **by capability** (a package per business module), not by technical layer. This is mandatory.
- **`pkg/`**: only for code genuinely meant to be imported by other repos. Default to `internal/`.
- Specific conventions (`http-server`, `messaging`, etc.) add their own folders (`internal/http/`, `internal/transport/`).

## Dependency wiring

- **Manual, explicit wiring** in `cmd/{service}/`. No DI framework (`wire`, `fx`).
- Constructors return a fully built value: `func NewStore(js JetStream, log *zerolog.Logger) (*KVStore, error)`. Validate required deps and return an error (never `panic`) on misconfiguration.
- Optional/late-bound deps use setter methods (`SetConfigRetriever(...)`), but prefer constructor injection when possible.
- Keep `main`/`run` readable: split wiring into focused `initX()` helpers (one per subsystem). A single 800-line wiring function is a smell.

## Errors

- Wrap with context: `fmt.Errorf("get order %s: %w", id, err)`. Always use `%w` to preserve the chain.
- Inspect with `errors.Is` / `errors.As`, never string matching.
- Domain code returns **typed or sentinel errors**, never bare `errors.New` at call sites that callers must branch on. See the `error-handling` convention for the hierarchy and boundary mapping.
- `panic` is reserved for truly unrecoverable programmer errors (nil that can never be nil). Libraries never panic across their boundary.

## Context

- `context.Context` is the **first parameter** of any function that does I/O, blocks, or may be cancelled: `func (s *KVStore) Get(ctx context.Context, id string) (...)`.
- Never store a `Context` in a struct. Pass it through the call chain.
- `context.Background()` only in `main`, tests, and top-level entry points. Everywhere else, propagate the received context.
- Check `ctx.Err()` before and after long operations; honour cancellation and timeouts.

## Concurrency

- Every goroutine has a clear owner and a defined way to stop (context cancellation, channel close, `sync.WaitGroup`).
- Use `golang.org/x/sync/errgroup` for fan-out where the first error should cancel the rest.
- No goroutine leaks: a goroutine started in a constructor must be stopped by a `Close()`/`Stop()` method.
- Protect shared state with `sync.Mutex`/`sync.RWMutex` or channels. Run tests with `-race`.

## Comments

- Default: no comments. Clear names explain the code.
- Exported identifiers that are part of the package API get a doc comment starting with the identifier name (`// NewStore creates ...`).
- Comment **only the why** when not obvious (workaround, external constraint, ordering requirement).
- No `// TODO` without an associated issue.
