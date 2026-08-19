---
id: messaging
display_name: Mensajería / eventos (NATS)
language: golang
description: Async messaging and events over a message bus (pub/sub, request/reply, work queues)
applies_to: [api, worker]
required_by: []
package: github.com/nats-io/nats.go
---

# Messaging (Go, NATS)

Asynchronous communication and events over a message bus. Default: [NATS](https://nats.io) with JetStream for durability — pub/sub, request/reply, and durable work queues. A service publishes domain events and/or consumes them; the bus decouples producers from consumers.

## When to use

- `worker` services that consume messages/events.
- `api` services that publish domain events or use request/reply to other services.
- Any cross-service interaction that should be decoupled and resilient to a peer being down.

For synchronous, client-facing request/response, use `http-server` instead.

## Package

```
github.com/nats-io/nats.go             # core client
github.com/nats-io/nats.go/jetstream   # JetStream API used by the publisher/consumer below
```

## Structure

```
internal/
├── bus/
│   ├── conn.go               # connection lifecycle (connect, drain, reconnect handlers)
│   └── subjects.go           # subject constants (single source of truth)
└── {module}/
    ├── publisher.go          # publishes this module's events
    └── consumer.go           # subscribes and dispatches to the service
```

## Subjects

Subjects are **constants in one place**, hierarchical and documented:

```go
// internal/bus/subjects.go
const (
	SubjectOrderCreated = "orders.created"   // published by order service
	SubjectOrderCancel  = "orders.cancel"    // request/reply: cancel an order
)
```

- Namespace by domain (`orders.*`, `sessions.*`). Wildcards (`orders.*`) only for subscribers.
- A subject's payload schema is part of the contract; version it (`orders.created.v1`) when it must evolve incompatibly.

## How to use

### Publishing an event

```go
// internal/order/publisher.go
func (p *Publisher) OrderCreated(ctx context.Context, o Order) error {
	data, err := json.Marshal(o)
	if err != nil {
		return fmt.Errorf("marshal order: %w", err)
	}
	if _, err := p.js.Publish(ctx, bus.SubjectOrderCreated, data); err != nil {
		return fmt.Errorf("publish %s: %w", bus.SubjectOrderCreated, err)
	}
	return nil
}
```

### Consuming (durable JetStream consumer)

```go
// internal/order/consumer.go
type Consumer struct {
	js  jetstream.JetStream
	svc *Service
	cc  jetstream.ConsumeContext // retained so Stop() can drain
}

func (c *Consumer) Start(ctx context.Context) error {
	cons, err := c.js.Consumer(ctx, "ORDERS", "order-worker")
	if err != nil {
		return fmt.Errorf("bind consumer: %w", err)
	}
	// Consume is non-blocking and returns a ConsumeContext; keep it to stop later.
	cc, err := cons.Consume(func(msg jetstream.Msg) {
		log := zerolog.Ctx(ctx).With().Str("subject", msg.Subject()).Logger()

		var o Order
		if err := json.Unmarshal(msg.Data(), &o); err != nil {
			log.Error().Err(err).Msg("bad payload, terminating message")
			_ = msg.Term() // poison message: do not redeliver
			return
		}
		if err := c.svc.Handle(ctx, o); err != nil {
			log.Error().Err(err).Msg("handler failed, will redeliver")
			_ = msg.Nak() // transient: redeliver later
			return
		}
		_ = msg.Ack()
	})
	if err != nil {
		return fmt.Errorf("consume ORDERS: %w", err)
	}
	c.cc = cc
	return nil
}

// Stop drains the consumer so in-flight messages finish before shutdown.
func (c *Consumer) Stop() {
	if c.cc != nil {
		c.cc.Drain()
	}
}
```

## Delivery semantics

| Outcome | Action | Meaning |
|---|---|---|
| Success | `Ack()` | Processed; do not redeliver. |
| Transient failure | `Nak()` | Retry later (network, downstream down). |
| Permanent failure | `Term()` | Poison message; never redeliver (bad payload). |

Consumers must be **idempotent**: the same message may be delivered more than once (at-least-once). Key handlers on a stable id.

## Rules

- Subjects are constants in one place. No string literals scattered across the code.
- Payloads are explicit DTOs (JSON by default), versioned when the contract must change incompatibly.
- Consumers are **idempotent** and explicitly `Ack`/`Nak`/`Term` every message. Never leave a message unacknowledged silently.
- Bad payloads are `Term`-ed (and logged), not retried forever.
- The connection is created once and injected; register reconnect handlers; `Drain()` on shutdown so in-flight messages finish.
- Every consume/publish takes `ctx` and logs through the request/job child logger.
- A handler error maps to a domain/typed error and is logged once (see `error-handling`, `logging`).

## Framework variant

Kafka (`segmentio/kafka-go`, `confluent-kafka-go`) or RabbitMQ are acceptable when the platform standard differs. The rules (constant subjects/topics, explicit ack semantics, idempotent consumers, injected connection, ctx propagation) still apply. Document the broker in `overview.md`.

## Integration with other conventions

- **error-handling**: handler errors use typed errors; this convention triggers `error-handling` via `required_by`.
- **logging**: each message handled creates a child logger with the subject/message id.
- **observability**: propagate trace context in message headers when tracing is active.
