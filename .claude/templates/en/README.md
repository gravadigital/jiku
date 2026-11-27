# {{fill: product name}}

{{fill: what the product is, who it is for and what it solves, in a short paragraph}}

## How to run it

All it needs is Docker (with Compose) and `make`.

```bash
make up      # brings everything up and waits until each service is healthy
make down    # brings it down
make logs    # follows the logs
```

| What | Where |
|---|---|
| {{fill: each surface, the API and the local tools, with their URL}} | |

{{fill: what it takes to use it locally (for example, how to create the first user) and where the
configuration is (`.env`, created from `.env.example`)}}

## Commands

| Command | What it does |
|---|---|
| `make check` | Lint, typecheck and every test, same as CI |
| `make test` | Every test (`S={service}` for a single one) |
| `make dev` | Runs with hot reload |
| `make migrate` | Applies the migrations |
| `make help` | Lists the rest |

## Documentation

- [`docs/operations.md`](docs/operations.md): how to operate it — health, processes, configuration, alerts.
- [`docs/integration.md`](docs/integration.md): how to integrate with it, if the product has external
  integrators.
- [`CHANGELOG.md`](CHANGELOG.md): the changes per version.
- The product definition (what it does, rules and decisions) is in `_jflow/prd/index.md`, and the
  requirements with their specification, in Jiku.
- [`AGENTS.md`](AGENTS.md): the guide for the agents that work on the repository.
