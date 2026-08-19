---
id: logging
display_name: Logging estructurado (zerolog)
language: golang
description: Structured JSON logging, one logger per service, request-scoped child loggers
applies_to: [api, worker, cli]
required_by: []
package: github.com/rs/zerolog
---

# Logging (Go, zerolog)

Structured JSON logging with [zerolog](https://github.com/rs/zerolog): low allocation, leveled, context-aware. One logger is built at startup and injected; request/job scopes use child loggers carrying correlation fields.

## When to use

Any Go service that needs observability: APIs, workers, long-running CLIs. Short one-shot CLIs may log to the console only.

## Package

```
github.com/rs/zerolog
```

## Base configuration

```go
// internal/shared/logging/logging.go
package logging

import (
	"os"

	"github.com/rs/zerolog"
)

func New(level string, pretty bool) zerolog.Logger {
	lvl, err := zerolog.ParseLevel(level)
	if err != nil {
		lvl = zerolog.InfoLevel
	}

	logger := zerolog.New(os.Stdout).Level(lvl).With().Timestamp().Logger()

	if pretty { // dev only: human-readable console output
		logger = logger.Output(zerolog.ConsoleWriter{Out: os.Stdout})
	}
	return logger
}
```

The logger is created once in `main`, then passed as a dependency (`*zerolog.Logger`). No package-level global logger.

## How to use

### Logging with fields

```go
log.Info().
	Str("orderId", order.ID).
	Int("items", len(order.Items)).
	Msg("order created")
```

The message is a short static string; variable data goes in fields, never interpolated into the message.

### Request / job scoped child logger

Create a child logger per request or job and put it in the context so every downstream log keeps the correlation id:

```go
reqLog := log.With().Str("requestId", reqID).Logger()
ctx = reqLog.WithContext(ctx)

// downstream, anywhere with the ctx:
zerolog.Ctx(ctx).Info().Msg("processing")
```

`http-server`/`messaging` middleware set this up; handlers and services read `zerolog.Ctx(ctx)`.

### Logging errors

```go
zerolog.Ctx(ctx).Error().Err(err).Str("orderId", id).Msg("failed to persist order")
```

Use `.Err(err)` (not a field) so the full chain is captured. Expected domain errors are logged at `warn` without the cause; unexpected at `error` with the cause.

## Levels

| Level | Use |
|---|---|
| `debug` | Development detail. Off in production by default. |
| `info` | Normal lifecycle events (started, request handled, job done). |
| `warn` | Expected, handled problems (validation rejected, retry). |
| `error` | Unexpected failures the service recovered from. |
| `fatal` | Unrecoverable startup failure; process exits. Only in `main`/bootstrap. |

## Rules

- One logger per service, built at startup and injected. No global logger, no `log.Print`/`fmt.Println` in service code.
- Output is **JSON in production** (`ConsoleWriter` is dev-only, gated by config).
- Messages are short, static, lowercase. Variable data goes in **fields**, not in the string.
- Never log: passwords, tokens, API keys, full auth headers, other users' PII.
- Always log through `zerolog.Ctx(ctx)` inside a request/job so the correlation id is preserved.
- Log an error **once**, at the boundary (see `error-handling`). Do not log-and-return at every layer.
- Log level is configurable via env (see `config`), default `info`.

## Framework variant

The standard library `log/slog` is an acceptable no-dependency alternative with the same rules (structured handler, `slog.With` for child loggers, `ctx`-based propagation via a custom handler). Choose one logger for the service and keep it consistent; document the choice in `overview.md`.

## Integration with other conventions

- **http-server / messaging**: their middleware creates the request/job child logger in the context.
- **error-handling**: the boundary handler logs the cause of internal errors here.
- **observability**: when tracing is active, the trace/span id is added as a field to correlate logs and traces.
