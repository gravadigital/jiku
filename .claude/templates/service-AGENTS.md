# {{fill: service}}

{{fill: what the service is, in one line, and what it exposes}}. Its place in the product is in
`_gflow/prd/architecture/services.md`.

## Stack

| Concern | Choice | Version | Why |
|---|---|---|---|
| {{fill: language and runtime}} | | | |
| {{fill: HTTP / UI, validation, persistence, tests, OpenTelemetry and logging…}} | | | |

Chosen from the official documentation current when the service was created. Before adding or
upgrading a dependency, check the official documentation for the stable version and its recommended
practices.

## Commands

| Command | Runs |
|---|---|
| `make test S={{service}}` | {{fill}} |
| `make lint S={{service}}` | {{fill}} |
| `make typecheck S={{service}}` | {{fill}} |
| `make migrate` | {{fill, or "n/a"}} |

## Structure

{{fill: where modules, tests and migrations live, in a short list}}

## Canonical examples

The best example of each kind of code: copy its shape when writing a new one.

| Kind | File |
|---|---|
| {{fill as they exist: endpoint with validation and errors, transaction with a guarantee, scheduled job, integration test, e2e test}} | |

## Recurring errors

One line per mistake that showed up twice (in verification, in CI or in review).

- (none yet)
