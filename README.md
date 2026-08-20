# Jiku

[![CI](https://github.com/gravadigital/jiku/actions/workflows/ci.yml/badge.svg)](https://github.com/gravadigital/jiku/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Project management for a services team, with a separate portal so clients can follow and
request work without access to the internal tool.

Reads and writes are separated into two services: an **api** that only reads, and a **core**
that concentrates every write, talking over NATS.

```
web ─────┐
         ├──HTTP──> api ──NATS──> core ──> PostgreSQL
opus-web ┘         (reads)  req/reply  (writes)
```

The interesting part is that **the split is enforced by database permissions, not by
convention**: the API connects with a role that only holds `SELECT`, so an accidental write
fails at the driver rather than in code review.

## What it does

Actors and projects, requirements with a lifecycle and client-visible comments, tasks, worked
and unworked hours with reports, and attachments on any S3-compatible storage. Two frontends:
one internal, one for clients.

Full description in [documentation/features.md](documentation/features.md).

## Structure

An npm workspace: one `npm install` from the root covers everything.

| Directory              | What it is                                                      |
| ---------------------- | --------------------------------------------------------------- |
| [api/](api/)           | HTTP service: reads the database, publishes commands to the bus |
| [core/](core/)         | NATS consumer: the only service that writes                     |
| [web/](web/)           | Internal frontend (Next.js)                                     |
| [opus-web/](opus-web/) | Client portal (Next.js)                                         |
| [packages/](packages/) | Shared code: models, bus contract, identity-provider auth       |
| [deploy/](deploy/)     | Composes, NATS and auth-callout configuration                   |
| [docs/](docs/)         | Documentation                                                   |

## Getting started

Requires **Node.js 24** and **Docker**.

```sh
npm install     # installs the 4 projects and builds the shared packages
npm run build
npm test
npm run lint
```

To run the whole stack, see [documentation/installation.md](documentation/installation.md).

> **Read that first if you plan to deploy.** Starting the stack needs a NATS identity and two
> identity-provider service users that are not in this repository, and there is no way around
> it today. It is the sharpest edge in the project.

## Documentation

Two sets of documentation, for two audiences:

**[documentation/](documentation/README.md)** — using and running Jiku. English, brief, stable.
Start with its README: it maps how the parts fit together.

| | |
|---|---|
| [features.md](documentation/features.md) | what the product does |
| [installation.md](documentation/installation.md) · [configuration.md](documentation/configuration.md) | how to run and configure it |
| [api-reference.md](documentation/api-reference.md) | the 60 HTTP endpoints |
| [docs/apis/core.yaml](docs/apis/core.yaml) | the bus contract (AsyncAPI) — source of truth for anything crossing the bus |
| [known-limitations.md](documentation/known-limitations.md) | **read before adopting** |

**[docs/](docs/)** — the internal working documentation: architecture per service, conventions,
stories and decision records. Written in Spanish, for the team that builds Jiku. It follows the
grava-workflow methodology in [`.claude/`](.claude/).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). For security issues, [SECURITY.md](SECURITY.md) —
please do not open a public issue.

## License

[Apache-2.0](LICENSE) © Grava Digital.
