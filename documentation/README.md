# Jiku documentation

Project management for a services team, with a separate portal so clients can follow and
request work without access to the internal tool.

This is the documentation for **using and running Jiku**. The internal working documentation —
architecture per service, conventions, stories, decision records — lives in [`docs/`](../docs/)
and is written in Spanish for the team that builds it.

| | |
|---|---|
| [features.md](features.md) | what the product does |
| [installation.md](installation.md) | how to run it |
| [configuration.md](configuration.md) | what to configure |
| [api-reference.md](api-reference.md) | the 61 HTTP endpoints |
| [known-limitations.md](known-limitations.md) | **read before adopting** |

## How the parts fit together

```
   browser
      │
      │  same-origin HTTP
      ▼
  web / opus-web ──────HTTP──────▶ api ──────NATS──────▶ core
   (Next.js)                    (reads)   request/reply  (writes)
                                    │                       │
                                    └──── PostgreSQL ◀───────┘
                                       SELECT      INSERT/UPDATE
```

Five deployables and one external dependency:

| Part | What it is responsible for |
|---|---|
| `web` | Internal frontend. What the team uses. |
| `opus-web` | Client portal. A restricted view of the same data. |
| `api` | The only HTTP surface. Authenticates, authorises by role, reads the database, turns writes into bus commands. |
| `core` | Serves commands, validates business rules, writes. No HTTP at all. |
| `nats` | The bus between api and core. Request/reply, no JetStream. |
| `auth-callout` | Authorises bus connections against the identity provider. A published image, not part of this repository. |

Identity is not Jiku's job: an external provider (Zitadel) authenticates people and carries
their role on the token. **Jiku does not create or manage users** — see
[known-limitations.md](known-limitations.md).

## Only one service writes

The api reads the database directly. Every mutation is published as a command on the bus, and
`core` is the only service that writes.

**Database permissions enforce this, not convention.** The api connects with a role that holds
only `SELECT`, so an accidental `INSERT` fails at the driver rather than in code review.

Two consequences when deploying:

- The read-only role must be created with `ALTER DEFAULT PRIVILEGES`, or tables created by
  future migrations become invisible to the api. See [installation.md](installation.md).
- **Migrations are the exception.** They run at api startup and do need to write, so they use
  separate credentials.

The cost of the split is a network hop and one more moving part. It pays off because writes
carry real business rules and now live in one place; it would not pay off for a CRUD.

## The frontends proxy the api

Neither frontend lets the browser reach the api. The browser calls `/api/...` on the frontend
itself, and a route handler forwards it server-side, attaching the access token.

Two things follow. The token never reaches the browser. And **the published images carry no
configuration**: Next.js bakes `NEXT_PUBLIC_*` into the browser bundle at build time, so an api
URL there would tie an image to one installation. Reading it from `API_URL` on the server means
one image runs anywhere.

## When a write fails

Because writes cross the bus, a failed mutation has one more place to look than a read.

- **503** — the api could not reach the bus.
- **timeout** — core did not answer in time. There is no JetStream, so **the command may have
  been applied anyway**.

`deploy/bus-inspect.sh` shows what is happening on the bus. See
[deploy/README.md](../deploy/README.md).

## Going further

- The bus contract, command by command: [`docs/apis/core.yaml`](../docs/apis/core.yaml)
  (AsyncAPI). It is the source of truth for anything crossing the bus.
- Per-service architecture and conventions: [`docs/architectures/`](../docs/architectures/).
- Running and operating a deployment: [`deploy/README.md`](../deploy/README.md).
- Contributing: [`CONTRIBUTING.md`](../CONTRIBUTING.md).
