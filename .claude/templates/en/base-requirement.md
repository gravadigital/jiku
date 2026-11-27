<!-- Template of the base product requirement that /jflow-product-discover creates in Jiku (jflow.py plan-build),
     English version (es/base-requirement.md is the Spanish one; keep both in step).
     The column Applies filters the criteria by the services of the product:
     always | multi (more than one service) | http | nats | db | frontend | frontend-backend | process,
     and, for a frontend, the platform of its surfaces: web | mobile (mobile-app) | desktop (desktop-app).
     {product} and {services} are filled by the script. Content in the product language: the client reads it. -->

# Scope

## Includes

- The base structure of {product}: the repository, each service with its chosen stack, Docker Compose,
  Make, tests at every level (with an end-to-end test per entry point, against the running product),
  CI, observability and monitoring.
- The product definition of what is built, the README, the operations guide
  (`docs/operations.md`) and the guides for agents (`AGENTS.md`).

## Excludes

- No functional block: each one is built with its requirement of the plan.

## Depends on

- Nothing.

# Proposal

The whole product comes up with a single command, reports its health and its version, records what it
does in a way any observability tool can take, and is ready to receive its first functional block.

## Services

{services}

## Technical detail

- The stack of each service (framework, libraries, base image) is chosen with the current official
  documentation; the language is the one the discovery set.
- Everything runs with Docker Compose and is driven with `make`.
- Observability with OpenTelemetry: traces propagated between services (W3C `traceparent`), JSON logs
  with `trace_id`, metrics of each operation. Configured only with the standard `OTEL_*` variables.
- Monitoring: health endpoints with version, commit and the state of each dependency; graceful shutdown.

# Acceptance criteria

| Change | ID | Criterion | Applies |
|---|---|---|---|
| add | 0-AC-01 | `make up` brings up every service and its dependencies, and each one reports it is healthy | always |
| add | 0-AC-02 | Each service refuses to start, with a clear message, when a configuration variable is missing or invalid | always |
| add | 0-AC-03 | Each HTTP service answers `GET /health` (alive) and `GET /health/ready` (can serve) with its state, version, commit and the state of each dependency | http |
| add | 0-AC-04 | Each service writes JSON logs to standard output with level, time, service, `trace_id` and `span_id` | always |
| add | 0-AC-05 | A request that goes through several services shares the same `trace_id` in the logs of all of them, and the response returns it in a header | multi |
| add | 0-AC-06 | With `OTEL_EXPORTER_OTLP_ENDPOINT` set, each service exports traces and metrics over OTLP; without that variable it works the same, without exporting | always |
| add | 0-AC-07 | An unknown route or an invalid request answers an RFC 9457 error (`application/problem+json`) with a stable `code` | http |
| add | 0-AC-08 | On a shutdown signal (SIGTERM), the service stops accepting requests, finishes the ones in progress and exits | process |
| add | 0-AC-09 | The integration tests run against a real database in a container, with the migrations applied | db |
| add | 0-AC-10 | Every response in the integration tests is validated against the service's contract in `_jflow/apis/` | http |
| add | 0-AC-11 | Every message published in the tests is validated against the service's AsyncAPI contract in `_jflow/apis/` | nats |
| add | 0-AC-12 | Each web surface loads in a real browser (end-to-end test with Playwright, in every browser the compatibility non-functional requirement asks for) and shows the product name | web |
| add | 0-AC-12 | The integration test of each mobile app opens it in a local Android emulator, with the minimum version the compatibility non-functional requirement asks for, and shows the product name (`make test-e2e`) | mobile |
| add | 0-AC-12 | On merging to `dev`, the CI builds the APK and leaves it downloadable at a fixed link; on each version tag, it builds it in release mode, signed with the key from the CI secret variables (or with the debug key and a warning if they are missing), and attaches it to that version's release | mobile |
| add | 0-AC-12 | Each mobile app builds for iOS on a macOS runner, or a technical decision states that it is not built and why | mobile |
| add | 0-AC-12 | Each desktop app builds in the CI and its end-to-end test opens it and shows the product name | desktop |
| add | 0-AC-12 | The end-to-end test of each surface fails on a client render error (in Flutter, an overflow) and leaves a screenshot of every screen it goes through in `reports/screenshots/` | frontend |
| add | 0-AC-13 | The frontend reaches its backend through the configured URL and shows an error state when the backend does not answer | frontend-backend |
| add | 0-AC-14 | `make test` leaves a JUnit report per service and level in `reports/junit/` | always |
| add | 0-AC-15 | The CI of each MR runs lint, typecheck, the unit and integration tests, the secret scanner and the dependency audit; the one of `dev` and of each tag also build the images and build each client for each platform of its surfaces | always |
| add | 0-AC-15 | `make test-perf` runs the performance tests of the non-functional requirements verified with a test, locally; it does not run in the CI | always |
| add | 0-AC-15 | `docs/operations.md` documents each secret the CI uses (name, what it is, how it is created and where it is set in the platform), or says it uses none | always |
| add | 0-AC-16 | `README.md`, `docs/operations.md` and the `AGENTS.md` files say how to run, operate and work on the product, with no pending placeholders | always |
| add | 0-AC-17 | The definition says how each entry point of the product is tested end to end (each surface and each interface a service exposes), the identity each role comes in with and how each external system is replaced; `make test-e2e` runs, against `make up`, an end-to-end test per entry point, with no one intervening | always |
| add | 0-AC-18 | The end-to-end test of each HTTP service comes in through its real interface, with a token from the test issuer (the identity provider replaced in the `test` profile, or the test identities in `.env`), and validates the response against the contract | http |
| add | 0-AC-18 | The end-to-end test of each service that exposes NATS connects to the broker of `make up` authenticated as an actor and validates the message against the AsyncAPI contract | nats |
