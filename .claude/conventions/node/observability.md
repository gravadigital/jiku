---
id: observability
display_name: Observabilidad (OpenTelemetry)
language: node
description: Distributed tracing and log correlation with OpenTelemetry auto-instrumentation
applies_to: [api, worker]
required_by: []
package: "@opentelemetry/sdk-node"
---

# Observability (Node, OpenTelemetry)

Distributed tracing with [OpenTelemetry](https://opentelemetry.io/docs/languages/js/). Auto-instrumentation captures HTTP requests, DB queries, and Redis calls without manual spans. Trace context (`traceId`, `spanId`) is injected into every log entry for log/trace correlation.

## When to use

- APIs and workers deployed in production where distributed tracing and observability are needed.
- Services that make outbound HTTP calls or DB queries that need to be traced.
- Not needed for short CLIs or offline scripts.

## Package

```
@opentelemetry/sdk-node                          # SDK bootstrap
@opentelemetry/auto-instrumentations-node        # auto-instrumentation (HTTP, PG, Redis, etc.)
@opentelemetry/exporter-trace-otlp-http          # OTLP exporter (Jaeger, Grafana Tempo, etc.)
@opentelemetry/resources                         # service metadata
@opentelemetry/semantic-conventions              # standard attribute names
```

## Structure

```
src/
├── instrumentation.ts     # OTel bootstrap — must be the FIRST import
└── index.ts               # entry point, imports instrumentation.ts first
```

## Configuration

```ts
// src/instrumentation.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceDetectors } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { env } from '@/config/env';

const sdk = new NodeSDK({
  resource: {
    attributes: {
      [SEMRESATTRS_SERVICE_NAME]: env.SERVICE_NAME,
      [SEMRESATTRS_SERVICE_VERSION]: env.SERVICE_VERSION,
    },
  },
  traceExporter: env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT })
    : undefined,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },  // too noisy
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => sdk.shutdown());
```

```ts
// src/index.ts
import './instrumentation';   // MUST be first — before any other import
import { env } from '@/config/env';
import { createServer } from './server';
// ...
```

## How to use

### Log / trace correlation

Inject `traceId` and `spanId` into Pino logs using the active span context:

```ts
// src/shared/logger.ts
import pino from 'pino';
import { trace, context } from '@opentelemetry/api';

export const logger = pino({
  // ... base config from logging convention ...
  mixin() {
    const span = trace.getSpan(context.active());
    if (!span) return {};
    const { traceId, spanId } = span.spanContext();
    return { traceId, spanId };
  },
});
```

Every log entry in a traced request now includes `traceId` and `spanId` automatically.

### Manual spans (when needed)

Auto-instrumentation covers most cases. Add manual spans for domain-level operations:

```ts
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('order-service');

async function processOrder(orderId: string) {
  return tracer.startActiveSpan('processOrder', async (span) => {
    span.setAttribute('order.id', orderId);
    try {
      const result = await doWork(orderId);
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

### Health check endpoint

Expose a health check that does NOT create traces (to avoid noise):

```ts
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

Configure the OTel HTTP instrumentation to ignore `/health` (done in auto-instrumentation options if needed).

## Rules

- `instrumentation.ts` must be imported before any other module in the entry point. Node.js module patching requires this.
- Do not disable auto-instrumentation unless a specific instrumentation is too noisy. Document disabled instrumentations with a reason.
- Always include `SERVICE_NAME` and `SERVICE_VERSION` in the resource attributes. Both come from env.
- Manual spans record exceptions via `span.recordException(err)` and set error status. Never leave spans without calling `.end()`.
- `traceId` is injected into logs via the Pino `mixin` — do not log it manually.
- The OTLP exporter endpoint is optional (feature-flagged by `OTEL_EXPORTER_OTLP_ENDPOINT`). If not set, traces are not exported (dev default).
- Shutdown the SDK on `SIGTERM` to flush pending spans.

## Integration with other conventions

- **logging**: `mixin()` on the Pino logger injects `traceId` and `spanId` into every log entry.
- **http-server**: auto-instrumentation patches the HTTP server. No manual setup needed per route.
- **env-config**: `SERVICE_NAME`, `SERVICE_VERSION`, `OTEL_EXPORTER_OTLP_ENDPOINT` validated at startup.
- **orm**: auto-instrumentation patches `pg` / database drivers and creates spans per query.
