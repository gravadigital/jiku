# Operating {{fill: product name}}

How the product is operated: how to know it is healthy, which processes run on their own, how it is
configured and what is worth alerting on. For the detail of what the product does, see the definition
in `_jflow/prd/`.

## Services and health

Each service answers `GET /health` (it is alive) and `GET /health/ready` (it can serve), with its state,
version, commit and the state of each dependency:

```json
{ "status": "up", "version": "1.4.0", "commit": "a1b2c3d", "checks": { "database": "up" } }
```

| Service | Health | Dependencies checked |
|---|---|---|
| {{fill: each service, the URL of its health and what its readiness checks}} | | |

## Background processes

| Process | Service | How often | What it does | Last success metric |
|---|---|---|---|---|
| {{fill: each scheduled process, worker or queue consumer; "None yet." if there are none}} | | | | |

## Configuration

Everything is configured with environment variables (see `.env.example`). If a required one is missing
or invalid, the service does not start and says so.

| Variable | Service | Purpose | Default |
|---|---|---|---|
| {{fill: the variables of each service, including the product parameters}} | | | |

## Observability

The services use OpenTelemetry. To send traces, metrics and logs to an observability stack, it is
enough to set:

| Variable | Value |
|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | The environment's OTLP collector (without it, nothing is exported) |
| `OTEL_SERVICE_NAME` | The service name (already set) |
| `OTEL_RESOURCE_ATTRIBUTES` | `deployment.environment=…,service.version=…` |

Logs are JSON on standard output, with `trace_id` and `span_id`. The response to each request carries
the `trace_id` in a header: with that id you find the whole path of the request.

Locally: `docker compose --profile observability up` brings up a collector and a viewer.

## Recommended alerts

What is worth alerting on, with thresholds that come from the availability and response time
non-functional requirements. No tool is fixed: the stack in use implements them.

| Alert | Condition | Threshold |
|---|---|---|
| Service down | `/health/ready` answers `down` or does not answer | {{fill: from the availability NFR}} |
| Error rate | 5xx responses over the total | {{fill}} |
| Latency | 95th percentile of the operations' duration | {{fill: from the response time NFR}} |
| Process that did not run | Time since the last success of a background process | {{fill: or "not applicable" without processes}} |
| Queue backlog | Pending messages or age of the oldest one | {{fill: or "not applicable" without queues}} |

## CI secrets

What the pipelines need and is secret is set as a platform variable, never in the repository.
GitLab: *Settings → CI/CD → Variables* (masked; protected if only `main` and the tags use it).
GitHub: *Settings → Secrets and variables → Actions*.

| Variable | What it is | How it is created | If missing |
|---|---|---|---|
| {{fill: each secret the CI uses, with the exact command to create it; or "None: the CI only uses the platform token."}} | | | |

## Downloadable builds

{{fill: what the CI leaves to download and where — the latest build of `dev` (fixed link) and the one of
each version (attached to the tag's release); or "None: the product is deployed as images."}}

## Deployment

{{fill: how it is deployed (registry images, variables per environment, migrations), and how whatever
is needed to use it is created (for example, the first user)}}
