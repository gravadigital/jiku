---
id: observability
display_name: Observabilidad (OpenTelemetry)
language: golang
description: Distributed tracing and metrics with OpenTelemetry, correlated with logs
applies_to: [api, worker]
required_by: []
package: go.opentelemetry.io/otel
---

# Observability (Go, OpenTelemetry)

Distributed tracing and metrics with [OpenTelemetry](https://opentelemetry.io). Spans are created at the boundary and propagated through context; trace ids are added to logs so traces and logs correlate.

## When to use

`api` and `worker` services running in an environment with a collector (OTLP endpoint). Local/dev can disable export and keep no-op providers.

## Package

```
go.opentelemetry.io/otel
go.opentelemetry.io/otel/sdk
go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc
go.opentelemetry.io/contrib/instrumentation/...  # per transport (net/http, etc.)
```

## Base configuration

```go
// internal/shared/otel/otel.go
func Setup(ctx context.Context, cfg Config) (shutdown func(context.Context) error, err error) {
	exp, err := otlptracegrpc.New(ctx, otlptracegrpc.WithEndpoint(cfg.OTLPEndpoint))
	if err != nil {
		return nil, fmt.Errorf("otlp exporter: %w", err)
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(resource.NewSchemaless(
			semconv.ServiceName(cfg.ServiceName),
		)),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	return tp.Shutdown, nil
}
```

`Setup` is called in `main`; its `shutdown` is deferred so spans flush on exit. When `OTLP_ENDPOINT` is empty, install no-op providers (observability off without code changes).

## How to use

### Spans

Boundary instrumentation (HTTP/messaging middleware) opens the root span. Inside the domain, wrap meaningful operations:

```go
func (s *Service) Create(ctx context.Context, in CreateOrderInput) (Order, error) {
	ctx, span := otel.Tracer("order").Start(ctx, "Service.Create")
	defer span.End()

	o, err := s.repo.Create(ctx, toOrder(in))
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "create failed")
		return Order{}, err
	}
	span.SetAttributes(attribute.String("order.id", o.ID))
	return o, nil
}
```

### Log correlation

Add the trace id to the request/job child logger so logs join their trace:

```go
sc := trace.SpanContextFromContext(ctx)
log = log.With().Str("traceId", sc.TraceID().String()).Logger()
```

## Rules

- Context propagation is mandatory: spans flow through `ctx`. Never create detached spans.
- Instrument at the boundary (incoming HTTP/messages) and at meaningful domain operations and external calls. Do not span trivial functions.
- Record errors on the span (`RecordError` + `SetStatus`) for failures.
- Trace id is added to logs (see `logging`) so the two correlate.
- Observability must be **toggleable by config** (no endpoint → no-op providers). The service runs identically with it off.
- Span/attribute names are stable and low-cardinality. Never put secrets or high-cardinality values (raw ids only when useful) in attributes.

## Integration with other conventions

- **logging**: trace id added as a log field.
- **http-server / messaging**: boundary middleware opens the root span and propagates context.
- **config**: the OTLP endpoint and service name come from `Config`.
